"""Runtime configuration for the worker, sourced from the environment.

The Gemini API is the only external dependency. The key itself is *not* read
here for normal requests — it travels per-request from the browser (BYOK) so it
is never persisted. GEMINI_API_KEY is only an optional local dev fallback.
"""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Config:
    nats_url: str
    qdrant_url: str
    workspace_dir: str
    chat_model: str
    embed_model: str
    embed_dim: int
    # Optional dev-only fallback; real requests carry the key from the UI.
    gemini_api_key_fallback: str


def load() -> Config:
    return Config(
        nats_url=os.getenv("NATS_URL", "nats://nats:4222"),
        qdrant_url=os.getenv("QDRANT_URL", "http://qdrant:6333"),
        workspace_dir=os.getenv("WORKSPACE_DIR", "/workspace"),
        chat_model=os.getenv("GEMINI_CHAT_MODEL", "gemini-2.5-flash"),
        embed_model=os.getenv("GEMINI_EMBED_MODEL", "gemini-embedding-001"),
        embed_dim=int(os.getenv("EMBED_DIM", "3072")),
        gemini_api_key_fallback=os.getenv("GEMINI_API_KEY", ""),
    )
