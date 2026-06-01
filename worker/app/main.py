"""Worker entrypoint.

Phase 1: prove the container boots, read config, and idle with a heartbeat so
the rest of the stack can come up and be observed. Phase 3 replaces the idle
loop with a NATS subscription; Phase 4 adds embeddings + Qdrant.
"""

from __future__ import annotations

import logging
import signal
import sys
import time

from app import config

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s worker: %(message)s",
)
log = logging.getLogger("worker")

_running = True


def _stop(signum, _frame):
    global _running
    log.info("received signal %s, shutting down", signum)
    _running = False


def main() -> int:
    signal.signal(signal.SIGTERM, _stop)
    signal.signal(signal.SIGINT, _stop)

    cfg = config.load()
    log.info("starting (phase 1)")
    log.info("  nats        = %s", cfg.nats_url)
    log.info("  qdrant      = %s", cfg.qdrant_url)
    log.info("  workspace   = %s", cfg.workspace_dir)
    log.info("  chat model  = %s", cfg.chat_model)
    log.info("  embed model = %s (dim=%d)", cfg.embed_model, cfg.embed_dim)
    log.info("  byok        = key arrives per-request from the UI (not stored)")

    # Idle heartbeat until NATS wiring lands in Phase 3.
    while _running:
        time.sleep(15)
        log.info("heartbeat — idle, awaiting NATS wiring (phase 3)")

    return 0


if __name__ == "__main__":
    sys.exit(main())
