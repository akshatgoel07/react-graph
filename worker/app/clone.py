"""Clone a public git repo into the workspace by URL.

Public repos only — a shallow `git clone` over HTTPS, which needs no GitHub
account or token, so it doesn't reintroduce the per-user GitHub auth dependency
this rewrite removed. The clone lands under WORKSPACE_DIR so the normal local
source reader indexes it.
"""

from __future__ import annotations

import asyncio
import logging
import re
from pathlib import Path
from urllib.parse import urlparse

log = logging.getLogger("worker.clone")

CLONE_TIMEOUT = 240  # seconds


def derive_name(url: str) -> str:
    """A safe workspace dir name from a repo URL (e.g. .../foo/bar.git -> bar)."""
    last = urlparse(url).path.rstrip("/").split("/")[-1]
    if last.endswith(".git"):
        last = last[:-4]
    safe = re.sub(r"[^A-Za-z0-9._-]", "_", last).strip("_")
    return safe or "repo"


async def clone_repo(workspace_dir: str, url: str) -> str:
    """Clone `url` into the workspace; return the relative dir name.

    Reuses an existing checkout of the same name rather than re-cloning.
    """
    url = (url or "").strip()
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.netloc:
        raise ValueError("only public https git URLs are supported")

    base = Path(workspace_dir).resolve()
    name = derive_name(url)
    target = (base / name).resolve()
    try:
        target.relative_to(base)  # sandbox: stay inside the workspace
    except ValueError as exc:
        raise ValueError("derived path escapes the workspace") from exc

    if target.exists() and any(target.iterdir()):
        log.info("reusing existing checkout at %s", target)
        return name

    log.info("cloning %s -> %s", url, target)
    proc = await asyncio.create_subprocess_exec(
        "git", "clone", "--depth", "1", url, str(target),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        _, stderr = await asyncio.wait_for(proc.communicate(), timeout=CLONE_TIMEOUT)
    except asyncio.TimeoutError as exc:
        proc.kill()
        raise TimeoutError("git clone timed out") from exc
    if proc.returncode != 0:
        msg = stderr.decode("utf-8", "ignore").strip()[:300]
        raise RuntimeError(f"git clone failed: {msg}")
    return name
