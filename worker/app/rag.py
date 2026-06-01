"""Retrieval-augmented prompting for codebase chat."""

from __future__ import annotations

import logging

log = logging.getLogger("worker.rag")

TOP_K = 6


def build_prompt(query: str, hits: list, notes: list[dict] | None = None) -> str:
    if hits:
        snippets = []
        for i, h in enumerate(hits, 1):
            p = getattr(h, "payload", None) or {}
            snippets.append(
                f"--- snippet {i}: {p.get('file', '?')} ({p.get('name', '')}) ---\n"
                f"{p.get('content', '')}"
            )
        context = "\n\n".join(snippets)
    else:
        context = (
            "(no indexed snippets matched — answer from general reasoning and "
            "note that the repo may not be indexed yet)"
        )

    notes_section = ""
    if notes:
        bullets = "\n".join(f"- {n.get('text', '')}" for n in notes)
        notes_section = (
            "\nThe user has recorded these notes / understanding about this repo; "
            "treat them as established context:\n" + bullets + "\n"
        )

    return (
        "You are a senior engineer helping someone understand a codebase. "
        "Answer the question accurately and concretely using the retrieved code "
        "snippets below. Cite file paths when you reference code. If the snippets "
        "don't fully answer it, say what's missing and reason from what's there.\n"
        f"{notes_section}\n"
        f"Question: {query}\n\n"
        f"Retrieved snippets:\n{context}\n\n"
        "Answer:"
    )
