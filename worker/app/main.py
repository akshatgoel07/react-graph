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

from app import config, contracts, indexer
from app.bus import Bus

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("worker")


async def amain() -> None:
    cfg = config.load()
    log.info("starting worker (phase 4)")
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

    await bus.subscribe(contracts.SUBJECT_INDEX_REQUEST, on_index, queue=contracts.WORKER_QUEUE)
    log.info("subscribed to %s (queue=%s)", contracts.SUBJECT_INDEX_REQUEST, contracts.WORKER_QUEUE)

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
