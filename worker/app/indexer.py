"""Indexing pipeline: walk -> chunk -> embed -> store, streaming progress.

The user's Gemini key arrives inline on the request and is used only to build a
transient embedder. Vectors land in a per-project Qdrant collection.
"""

from __future__ import annotations

import json
import logging

from qdrant_client import models

from app import chunker, contracts, source
from app.bus import Bus
from app.config import Config
from app.embeddings import Embedder
from app.store import Store, point_id

log = logging.getLogger("worker.indexer")

EMBED_BATCH = 50  # flush to Gemini + Qdrant every N chunks


async def run_index(bus: Bus, cfg: Config, req: dict) -> None:
    job = req.get("job_id", "")
    project = req.get("project", "")
    rel = req.get("path", "")
    key = req.get("gemini_key", "")
    subject = contracts.index_progress_subject(job)

    async def emit(stage, message, current=0, total=0, done=False, error=""):
        ev = contracts.progress_event(job, stage, message, current, total, done, error)
        await bus.publish(subject, json.dumps(ev).encode())

    log.info("index job %s: project=%s path=%s", job, project, rel)
    store: Store | None = None
    try:
        if not key:
            raise ValueError("no Gemini key supplied (BYOK)")
        root = source.resolve_repo(cfg.workspace_dir, rel)

        await emit("scan", f"scanning {rel} …")
        files = list(source.iter_files(root))
        total = len(files)
        await emit("scan", f"found {total} source files", 0, total)
        if total == 0:
            await emit("done", "no source files found to index", 0, 0, done=True)
            return

        embedder = Embedder(key, cfg.embed_model, cfg.embed_dim)
        store = Store(cfg.qdrant_url, cfg.embed_dim)
        await store.reset_collection(project)
        await emit("prepare", f"created vector collection (dim={cfg.embed_dim})")

        pending: list[chunker.Chunk] = []
        chunk_total = 0
        upserted = 0

        async def flush() -> None:
            nonlocal upserted
            if not pending:
                return
            vectors = await embedder.embed_documents([c.content for c in pending])
            points = [
                models.PointStruct(
                    id=point_id(project, c.file, c.name),
                    vector=vec,
                    payload={
                        "project": project,
                        "file": c.file,
                        "name": c.name,
                        "kind": c.kind,
                        "content": c.content,
                    },
                )
                for c, vec in zip(pending, vectors)
            ]
            await store.upsert(project, points)
            upserted += len(points)
            pending.clear()

        for i, path in enumerate(files, start=1):
            text = source.read_text(path)
            if text is not None:
                rel_file = str(path.relative_to(root))
                for c in chunker.chunk_file(rel_file, text):
                    pending.append(c)
                    chunk_total += 1
                    if len(pending) >= EMBED_BATCH:
                        await flush()
            if i % 10 == 0 or i == total:
                await emit(
                    "embed",
                    f"{i}/{total} files · {upserted}/{chunk_total} chunks embedded",
                    i,
                    total,
                )

        await flush()
        await emit(
            "done",
            f"indexed {upserted} chunks from {total} files into Qdrant",
            total,
            total,
            done=True,
        )
        log.info("index job %s complete: %d files, %d chunks", job, total, upserted)
    except Exception as exc:  # noqa: BLE001 - surface failure to the UI
        log.exception("index job %s failed", job)
        await emit("error", "indexing failed", error=str(exc))
    finally:
        if store is not None:
            await store.close()
