"""Local-filesystem source reader.

GitHub is gone. The repo to analyze lives on disk, mounted read-only into the
worker at WORKSPACE_DIR. `path` in a request is relative to that root and is
sandboxed so it cannot escape the workspace.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Iterator

# Noisy / generated directories we never index.
IGNORE_DIRS = {
    "node_modules", ".git", ".next", "build", "dist", "out", "__pycache__",
    ".venv", "venv", "env", ".idea", ".vscode", "target", "vendor", ".turbo",
    ".cache", "coverage", ".pytest_cache", ".mypy_cache", "bin", "obj",
    ".gradle", ".terraform",
}

# Binary / non-source extensions.
IGNORE_EXTS = {
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp", ".bmp",
    ".pdf", ".zip", ".tar", ".gz", ".tgz", ".rar", ".7z",
    ".exe", ".dll", ".so", ".dylib", ".bin", ".class", ".o", ".a", ".wasm",
    ".woff", ".woff2", ".ttf", ".eot", ".otf",
    ".mp4", ".mp3", ".mov", ".avi", ".wav", ".flac",
    ".lock", ".map", ".min.js", ".min.css",
}

# Specific lockfiles / junk by name.
SKIP_NAMES = {
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "poetry.lock",
    "go.sum", "cargo.lock", "composer.lock", ".ds_store",
}

MAX_BYTES = 1_000_000  # skip files larger than ~1 MB


def resolve_repo(workspace_dir: str, rel_path: str) -> Path:
    """Resolve a request path to an absolute dir, refusing to escape the root."""
    base = Path(workspace_dir).resolve()
    target = (base / rel_path.lstrip("/")).resolve()
    try:
        target.relative_to(base)
    except ValueError as exc:
        raise ValueError("path escapes the workspace") from exc
    if not target.exists():
        raise FileNotFoundError(f"'{rel_path}' not found under workspace")
    if not target.is_dir():
        raise NotADirectoryError(f"'{rel_path}' is not a directory")
    return target


def _should_process(p: Path) -> bool:
    name = p.name.lower()
    if name in SKIP_NAMES:
        return False
    if p.suffix.lower() in IGNORE_EXTS:
        return False
    if name.endswith(".min.js") or name.endswith(".min.css"):
        return False
    try:
        if p.stat().st_size > MAX_BYTES:
            return False
    except OSError:
        return False
    return True


def iter_files(root: Path) -> Iterator[Path]:
    """Yield indexable files under root, pruning ignored directories."""
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in IGNORE_DIRS]
        for fn in filenames:
            p = Path(dirpath) / fn
            if _should_process(p):
                yield p


def read_text(p: Path) -> str | None:
    """Read a file as UTF-8 text; return None for binary/unreadable files."""
    try:
        data = p.read_bytes()
    except OSError:
        return None
    if b"\x00" in data[:8192]:  # NUL byte => almost certainly binary
        return None
    return data.decode("utf-8", errors="ignore")
