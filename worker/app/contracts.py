"""NATS wire protocol — mirrors gateway/internal/contracts.

Every request from the gateway carries the user's BYOK Gemini key inline
(`gemini_key`); it is used transiently and never persisted.
"""

from __future__ import annotations

# Subjects (prefix "rg." namespaces react-graph traffic).
SUBJECT_INDEX_REQUEST = "rg.index.request"  # gateway -> worker (queue group)
SUBJECT_GRAPH_REQUEST = "rg.graph.request"  # gateway <-> worker (request/reply)
SUBJECT_CHAT_REQUEST = "rg.chat.request"    # gateway -> worker (starts a stream)

# Queue group so multiple workers share the index workload.
WORKER_QUEUE = "react-graph-workers"


def index_progress_subject(job_id: str) -> str:
    return f"rg.index.progress.{job_id}"


def chat_stream_subject(stream_id: str) -> str:
    return f"rg.chat.stream.{stream_id}"


def progress_event(
    job_id: str,
    stage: str,
    message: str,
    current: int = 0,
    total: int = 0,
    done: bool = False,
    error: str = "",
) -> dict:
    ev = {
        "job_id": job_id,
        "stage": stage,
        "message": message,
        "current": current,
        "total": total,
        "done": done,
    }
    if error:
        ev["error"] = error
    return ev
