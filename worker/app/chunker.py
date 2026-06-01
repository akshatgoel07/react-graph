"""Code chunking.

Pragmatic and dependency-free: small files are kept whole; large code files are
split into overlapping line windows; large prose/data files into overlapping
character windows. Symbol-aware (tree-sitter) chunking is a Phase 4+ refinement.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

CODE_EXTS = {
    ".js", ".jsx", ".ts", ".tsx", ".py", ".go", ".java", ".rb", ".rs",
    ".c", ".h", ".cpp", ".cc", ".hpp", ".cs", ".php", ".kt", ".swift",
    ".scala", ".m", ".mm", ".sh", ".bash", ".sql",
}

MAX_CHARS = 4000      # ~1k tokens: keep files this size or smaller in one chunk
WINDOW_LINES = 60     # line window for large code files
OVERLAP_LINES = 8     # carry-over so context isn't cut mid-thought
CHAR_OVERLAP = 400    # carry-over for character windows


@dataclass
class Chunk:
    file: str   # path relative to repo root
    name: str   # human-friendly label (e.g. "server.go:L1-60")
    kind: str   # "file" | "code" | "text"
    content: str


def chunk_file(rel_path: str, content: str) -> list[Chunk]:
    if not content.strip():
        return []
    name = os.path.basename(rel_path)
    if len(content) <= MAX_CHARS:
        return [Chunk(rel_path, name, "file", content)]

    ext = os.path.splitext(rel_path)[1].lower()
    if ext in CODE_EXTS:
        return _window_by_lines(rel_path, content)
    return _window_by_chars(rel_path, content)


def _window_by_lines(rel_path: str, content: str) -> list[Chunk]:
    name = os.path.basename(rel_path)
    lines = content.splitlines()
    step = max(1, WINDOW_LINES - OVERLAP_LINES)
    chunks: list[Chunk] = []
    i = 0
    n = len(lines)
    while i < n:
        window = lines[i : i + WINDOW_LINES]
        start, end = i + 1, min(i + WINDOW_LINES, n)
        chunks.append(Chunk(rel_path, f"{name}:L{start}-{end}", "code", "\n".join(window)))
        i += step
    return chunks


def _window_by_chars(rel_path: str, content: str) -> list[Chunk]:
    name = os.path.basename(rel_path)
    step = max(1, MAX_CHARS - CHAR_OVERLAP)
    chunks: list[Chunk] = []
    i = 0
    part = 1
    while i < len(content):
        chunks.append(Chunk(rel_path, f"{name} (part {part})", "text", content[i : i + MAX_CHARS]))
        i += step
        part += 1
    return chunks
