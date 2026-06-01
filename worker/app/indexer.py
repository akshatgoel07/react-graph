"""Indexing orchestration.

Phase 3: walk the repo, chunk every source file, and stream progress events the
gateway relays to the browser as SSE — proving the filesystem reader, chunker
and progress pipeline end to end. Phase 4 slots Gemini embeddings + Qdrant
upsert into the marked spot without changing this control flow.
"""

from __future__ import annotations

import json
import logging

from app import chunker, contracts, source
from app.bus import Bus
from app.config import Config

log = logging.getLogger("worker.indexer")


async def run_index(bus: Bus, cfg: Config, req: dict) -> None:
    job = req.get("job_id", "")
    project = req.get("project", "")
    rel = req.get("path", "")
    subject = contracts.index_progress_subject(job)

    async def emit(stage, message, current=0, total=0, done=False, error=""):
        ev = contracts.progress_event(job, stage, message, current, total, done, error)
        await bus.publish(subject, json.dumps(ev).encode())

    log.info("index job %s: project=%s path=%s", job, project, rel)
    try:
        root = source.resolve_repo(cfg.workspace_dir, rel)

        await emit("scan", f"scanning {rel} …")
        files = list(source.iter_files(root))
        total = len(files)
        await emit("scan", f"found {total} source files", 0, total)
        if total == 0:
            await emit("done", "no source files found to index", 0, 0, done=True)
            return

        chunk_count = 0
        for i, path in enumerate(files, start=1):
            text = source.read_text(path)
            if text is None:
                continue
            rel_file = str(path.relative_to(root))
            chunks = chunker.chunk_file(rel_file, text)
            chunk_count += len(chunks)

            # ── Phase 4 will go here ───────────────────────────────────────
            #   embeddings = embed([c.content for c in chunks], key=req["gemini_key"])
            #   qdrant.upsert(project, chunks, embeddings)
            # ───────────────────────────────────────────────────────────────

            if i % 10 == 0 or i == total:
                await emit(
                    "chunk",
                    f"processed {i}/{total} files · {chunk_count} chunks",
                    i,
                    total,
                )

        await emit(
            "done",
            f"prepared {chunk_count} chunks from {total} files "
            f"(embedding + storage land in Phase 4)",
            total,
            total,
            done=True,
        )
        log.info("index job %s complete: %d files, %d chunks", job, total, chunk_count)
    except Exception as exc:  # noqa: BLE001 - report failure to the UI
        log.exception("index job %s failed", job)
        await emit("error", "indexing failed", error=str(exc))
