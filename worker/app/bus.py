"""NATS connection for the worker (asyncio)."""

from __future__ import annotations

import logging
from typing import Awaitable, Callable

import nats
from nats.aio.msg import Msg

log = logging.getLogger("worker.bus")

Handler = Callable[[Msg], Awaitable[None]]


class Bus:
    def __init__(self, nc: "nats.NATS") -> None:
        self.nc = nc

    @classmethod
    async def connect(cls, url: str) -> "Bus":
        nc = await nats.connect(
            url,
            name="react-graph-worker",
            max_reconnect_attempts=-1,  # ride out broker blips forever
            reconnect_time_wait=1,
            connect_timeout=5,
        )
        log.info("connected to NATS at %s", url)
        return cls(nc)

    async def subscribe(self, subject: str, cb: Handler, queue: str = "") -> None:
        await self.nc.subscribe(subject, queue=queue, cb=cb)

    async def publish(self, subject: str, data: bytes) -> None:
        await self.nc.publish(subject, data)

    async def close(self) -> None:
        try:
            await self.nc.drain()
        except Exception:  # noqa: BLE001 - best-effort shutdown
            pass
