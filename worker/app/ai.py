"""Gemini text generation (BYOK).

A transient client per request from the user's key. Used for graph generation
(Phase 5) and RAG chat (Phase 6). Includes a tolerant JSON extractor for model
output that may be fenced or wrapped in prose.
"""

from __future__ import annotations

import json
import logging
import re
from typing import AsyncIterator

from google import genai

log = logging.getLogger("worker.ai")


class Gemini:
    def __init__(self, api_key: str, model: str) -> None:
        self.client = genai.Client(api_key=api_key)
        self.model = model

    async def generate(self, prompt: str) -> str:
        resp = await self.client.aio.models.generate_content(
            model=self.model, contents=prompt
        )
        return resp.text or ""

    async def stream(self, prompt: str) -> AsyncIterator[str]:
        async for chunk in await self.client.aio.models.generate_content_stream(
            model=self.model, contents=prompt
        ):
            if chunk.text:
                yield chunk.text


def parse_json_block(text: str) -> dict:
    """Parse JSON from a model response, tolerating code fences / surrounding prose."""
    t = text.strip()
    t = re.sub(r"^```(?:json)?", "", t).strip()
    t = re.sub(r"```$", "", t).strip()
    try:
        return json.loads(t)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", t, re.DOTALL)
        if m:
            return json.loads(m.group(0))
        raise
