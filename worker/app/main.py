"""Worker entrypoint.

Connects to NATS and consumes index jobs. Indexing currently walks + chunks the
repo and streams progress (Phase 3); Gemini embeddings + Qdrant arrive in Phase
4, and graph/chat handlers in Phases 5/6.
"""

from __future__ import annotations

import asyncio
import json
import logging
import signal

from nats.aio.msg import Msg

from app import ai, config, contracts, graph, indexer, rag, source
from app.bus import Bus
from app.embeddings import Embedder
from app.store import Store

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("worker")


async def amain() -> None:
    cfg = config.load()
    log.info("starting worker (phase 6)")
    log.info("  nats=%s qdrant=%s workspace=%s", cfg.nats_url, cfg.qdrant_url, cfg.workspace_dir)
    log.info("  chat=%s embed=%s(dim=%d)", cfg.chat_model, cfg.embed_model, cfg.embed_dim)

    bus = await Bus.connect(cfg.nats_url)

    async def on_index(msg: Msg) -> None:
        try:
            req = json.loads(msg.data)
        except json.JSONDecodeError:
            log.warning("dropping malformed index request")
            return
        # Run the job off the subscription callback so we keep consuming.
        asyncio.create_task(indexer.run_index(bus, cfg, req))

    async def on_graph(msg: Msg) -> None:
        try:
            req = json.loads(msg.data)
            key = req.get("gemini_key", "")
            if not key:
                raise ValueError("no Gemini key supplied (BYOK)")
            root = source.resolve_repo(cfg.workspace_dir, req.get("path", ""))
            paths = [str(p.relative_to(root)) for p in source.iter_files(root)]
            gem = ai.Gemini(key, cfg.chat_model)
            flow = await graph.build_graph(gem, root, paths)
            await msg.respond(json.dumps({"ok": True, "flow": flow}).encode())
        except Exception as exc:  # noqa: BLE001 - reply with the error
            log.exception("graph request failed")
            await msg.respond(json.dumps({"ok": False, "error": str(exc)}).encode())

    async def run_chat(req: dict) -> None:
        stream_id = req.get("stream_id", "")
        subject = contracts.chat_stream_subject(stream_id)

        async def send(chunk: dict) -> None:
            await bus.publish(subject, json.dumps(chunk).encode())

        store: Store | None = None
        try:
            key = req.get("gemini_key", "")
            if not key:
                raise ValueError("no Gemini key supplied (BYOK)")
            query = req.get("query", "")
            project = req.get("project", "")

            embedder = Embedder(key, cfg.embed_model, cfg.embed_dim)
            store = Store(cfg.qdrant_url, cfg.embed_dim)
            qvec = await embedder.embed_query(query)
            hits = await store.search(project, qvec, top_k=rag.TOP_K)

            gem = ai.Gemini(key, cfg.chat_model)
            async for delta in gem.stream(rag.build_prompt(query, hits)):
                await send({"delta": delta, "done": False})
            await send({"done": True})
        except Exception as exc:  # noqa: BLE001 - stream the error to the UI
            log.exception("chat request failed")
            await send({"done": True, "error": str(exc)})
        finally:
            if store is not None:
                await store.close()

    async def on_chat(msg: Msg) -> None:
        try:
            req = json.loads(msg.data)
        except json.JSONDecodeError:
            log.warning("dropping malformed chat request")
            return
        asyncio.create_task(run_chat(req))

    await bus.subscribe(contracts.SUBJECT_INDEX_REQUEST, on_index, queue=contracts.WORKER_QUEUE)
    await bus.subscribe(contracts.SUBJECT_GRAPH_REQUEST, on_graph, queue=contracts.WORKER_QUEUE)
    await bus.subscribe(contracts.SUBJECT_CHAT_REQUEST, on_chat, queue=contracts.WORKER_QUEUE)
    log.info("subscribed to index/graph/chat (queue=%s)", contracts.WORKER_QUEUE)

    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, stop.set)

    log.info("ready — awaiting jobs")
    await stop.wait()
    log.info("shutting down")
    await bus.close()


def main() -> None:
    asyncio.run(amain())


if __name__ == "__main__":
    main()
