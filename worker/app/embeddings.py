"""Gemini embeddings (BYOK).

A fresh client is built per request from the user's key — it is never stored.
Uses the async Gen AI SDK so we don't block the event loop. Embeddings are
batched; vectors are L2-normalized when the output dimension is truncated below
the model's native 3072 (per Google's guidance) so cosine search stays correct.
"""

from __future__ import annotations

import logging
import math

from google import genai
from google.genai import types

log = logging.getLogger("worker.embeddings")

NATIVE_DIM = 3072
BATCH = 50  # texts per embed_content call


def _l2_normalize(v: list[float]) -> list[float]:
    norm = math.sqrt(sum(x * x for x in v)) or 1.0
    return [x / norm for x in v]


class Embedder:
    def __init__(self, api_key: str, model: str, dim: int) -> None:
        self.client = genai.Client(api_key=api_key)
        self.model = model
        self.dim = dim

    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return await self._embed(texts, "RETRIEVAL_DOCUMENT")

    async def embed_query(self, text: str) -> list[float]:
        vecs = await self._embed([text], "RETRIEVAL_QUERY")
        return vecs[0]

    async def _embed(self, texts: list[str], task_type: str) -> list[list[float]]:
        out: list[list[float]] = []
        for i in range(0, len(texts), BATCH):
            sub = texts[i : i + BATCH]
            resp = await self.client.aio.models.embed_content(
                model=self.model,
                contents=sub,
                config=types.EmbedContentConfig(
                    task_type=task_type,
                    output_dimensionality=self.dim,
                ),
            )
            for e in resp.embeddings:
                vec = list(e.values)
                if self.dim != NATIVE_DIM:
                    vec = _l2_normalize(vec)
                out.append(vec)
        return out
