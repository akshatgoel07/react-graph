"""Qdrant vector store (async).

One collection per project, cosine distance. Point ids are deterministic
(uuid5 of project+file+chunk) so re-indexing a repo overwrites cleanly rather
than duplicating.
"""

from __future__ import annotations

import logging
import uuid

from qdrant_client import AsyncQdrantClient, models

log = logging.getLogger("worker.store")

_NS = uuid.UUID("6f1d4b2e-0000-4000-8000-000000000001")  # stable namespace


def collection_name(project: str) -> str:
    safe = "".join(c if (c.isalnum() or c in "-_") else "_" for c in project).strip("_")
    return f"repo_{safe or 'default'}"


def point_id(project: str, file: str, name: str) -> str:
    return str(uuid.uuid5(_NS, f"{project}:{file}:{name}"))


class Store:
    def __init__(self, url: str, dim: int) -> None:
        self.client = AsyncQdrantClient(url=url)
        self.dim = dim

    async def reset_collection(self, project: str) -> None:
        """Drop and recreate the project's collection for a clean re-index."""
        name = collection_name(project)
        if await self.client.collection_exists(name):
            await self.client.delete_collection(name)
        await self.client.create_collection(
            collection_name=name,
            vectors_config=models.VectorParams(size=self.dim, distance=models.Distance.COSINE),
        )

    async def upsert(self, project: str, points: list[models.PointStruct]) -> None:
        await self.client.upsert(collection_name(project), points=points)

    async def search(self, project: str, vector: list[float], top_k: int):
        name = collection_name(project)
        if not await self.client.collection_exists(name):
            return []
        res = await self.client.query_points(
            collection_name=name,
            query=vector,
            limit=top_k,
            with_payload=True,
        )
        return res.points

    async def close(self) -> None:
        try:
            await self.client.close()
        except Exception:  # noqa: BLE001 - best-effort
            pass
