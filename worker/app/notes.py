"""Per-project notes — the user's accumulated understanding of a repo.

Persisted as a JSON file per project under a writable volume (/data/notes).
Small and human-readable; no embeddings needed. Notes are also folded into the
chat prompt so understanding compounds over a session.
"""

from __future__ import annotations

import asyncio
import json
import time
import uuid
from pathlib import Path

NOTES_DIR = Path("/data/notes")
_lock = asyncio.Lock()


def _file(project: str) -> Path:
    safe = "".join(c if (c.isalnum() or c in "-_") else "_" for c in project).strip("_")
    return NOTES_DIR / f"{safe or 'default'}.json"


def _load(project: str) -> list[dict]:
    f = _file(project)
    if f.is_file():
        try:
            return json.loads(f.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return []
    return []


def _save(project: str, notes: list[dict]) -> None:
    f = _file(project)
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(json.dumps(notes, indent=2), encoding="utf-8")


async def list_notes(project: str) -> list[dict]:
    async with _lock:
        return _load(project)


async def add_note(project: str, text: str) -> list[dict]:
    text = (text or "").strip()
    if not text:
        raise ValueError("note text is empty")
    async with _lock:
        notes = _load(project)
        notes.append({"id": uuid.uuid4().hex[:8], "text": text, "created": int(time.time())})
        _save(project, notes)
        return notes


async def delete_note(project: str, note_id: str) -> list[dict]:
    async with _lock:
        notes = [n for n in _load(project) if n.get("id") != note_id]
        _save(project, notes)
        return notes
