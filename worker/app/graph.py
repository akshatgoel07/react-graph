"""Architecture-diagram generation.

Turns a repo's file layout + detected stack into a React Flow graph by prompting
Gemini. Returns a {"nodes": [...], "edges": [...]} dict ready for the frontend.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from app.ai import Gemini, parse_json_block

log = logging.getLogger("worker.graph")

MAX_PATHS_IN_PROMPT = 250


def _structure_text(paths: list[str]) -> str:
    shown = sorted(paths)[:MAX_PATHS_IN_PROMPT]
    lines = "\n".join(shown)
    if len(paths) > MAX_PATHS_IN_PROMPT:
        lines += f"\n… and {len(paths) - MAX_PATHS_IN_PROMPT} more files"
    return lines


def _detect_stack(root: Path, paths: list[str]) -> str:
    bits: list[str] = []

    def read(name: str) -> str | None:
        p = root / name
        try:
            return p.read_text(encoding="utf-8", errors="ignore") if p.is_file() else None
        except OSError:
            return None

    pkg = read("package.json")
    if pkg:
        try:
            data = json.loads(pkg)
            deps = list((data.get("dependencies") or {}).keys())
            if deps:
                bits.append("npm deps: " + ", ".join(deps[:25]))
        except json.JSONDecodeError:
            pass
    for reqfile in ("requirements.txt", "pyproject.toml"):
        r = read(reqfile)
        if r:
            bits.append(f"{reqfile} present")
            break
    if (root / "go.mod").is_file():
        bits.append("Go module")
    if (root / "Dockerfile").is_file() or (root / "docker-compose.yml").is_file():
        bits.append("Dockerized")

    exts: dict[str, int] = {}
    for p in paths:
        ext = Path(p).suffix.lower()
        if ext:
            exts[ext] = exts.get(ext, 0) + 1
    top = sorted(exts.items(), key=lambda kv: -kv[1])[:8]
    if top:
        bits.append("file types: " + ", ".join(f"{e}×{n}" for e, n in top))
    return "\n".join(bits) or "(no obvious stack markers)"


_PROMPT = """You are a software architect. Given a repository's file layout and \
detected stack, produce an architecture diagram as React Flow JSON.

Identify the main logical components/layers (e.g. frontend, API/gateway, \
services, data stores, external APIs, background workers) and how they connect. \
Prefer ~6-14 nodes — group files into components, don't make one node per file.

Lay the graph out top-to-bottom: give each node an (x, y) position so layers \
stack vertically (y increases down) and siblings spread horizontally (x). Use \
spacing of ~220 in x and ~120 in y.

Respond with ONLY a JSON object, no prose, no code fences, of exactly this shape:
{
  "nodes": [
    {"id": "frontend", "type": "default", "position": {"x": 250, "y": 0}, "data": {"label": "Frontend (Next.js)"}}
  ],
  "edges": [
    {"id": "e1", "source": "frontend", "target": "gateway", "animated": true, "type": "smoothstep", "label": "HTTP"}
  ]
}

Repository file layout:
{structure}

Detected stack:
{stack}
"""


async def build_graph(gem: Gemini, root: Path, paths: list[str]) -> dict:
    # .replace (not .format): the prompt's JSON example contains literal braces.
    prompt = (
        _PROMPT.replace("{structure}", _structure_text(paths))
        .replace("{stack}", _detect_stack(root, paths))
    )
    text = await gem.generate(prompt)
    flow = parse_json_block(text)
    # Minimal shape guard so the frontend always gets arrays.
    flow.setdefault("nodes", [])
    flow.setdefault("edges", [])
    log.info("graph: %d nodes, %d edges", len(flow["nodes"]), len(flow["edges"]))
    return flow
