"use client";

import { useCallback, useEffect, useState } from "react";

const GATEWAY_URL =
  process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:8080";

type Health = { status: string; service: string; version: string };

export default function Home() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  const check = useCallback(async () => {
    setChecking(true);
    setError(null);
    try {
      const res = await fetch(`${GATEWAY_URL}/health`, { cache: "no-store" });
      if (!res.ok) throw new Error(`gateway returned ${res.status}`);
      setHealth((await res.json()) as Health);
    } catch (e) {
      setHealth(null);
      setError(e instanceof Error ? e.message : "unreachable");
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  const up = !!health && !error;

  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "64px 24px",
      }}
    >
      <h1 style={{ fontSize: 32, margin: 0, letterSpacing: -0.5 }}>
        react-graph
      </h1>
      <p style={{ color: "var(--muted)", marginTop: 8, lineHeight: 1.5 }}>
        Local-first repo comprehension. Point it at a repo on your machine,
        understand its architecture, talk to it, and build up notes — powered
        only by your own Gemini key.
      </p>

      <section
        style={{
          marginTop: 32,
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <strong>Gateway</strong>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              color: up ? "var(--ok)" : "var(--bad)",
              fontSize: 14,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: checking
                  ? "var(--muted)"
                  : up
                    ? "var(--ok)"
                    : "var(--bad)",
                display: "inline-block",
              }}
            />
            {checking ? "checking…" : up ? "online" : "offline"}
          </span>
        </div>

        <pre
          style={{
            marginTop: 14,
            marginBottom: 0,
            color: "var(--muted)",
            fontSize: 13,
            whiteSpace: "pre-wrap",
          }}
        >
          {up
            ? JSON.stringify(health, null, 2)
            : `cannot reach ${GATEWAY_URL}\n${error ?? ""}`}
        </pre>

        <button
          onClick={check}
          style={{
            marginTop: 16,
            background: "transparent",
            color: "var(--accent)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "8px 14px",
            cursor: "pointer",
          }}
        >
          Re-check
        </button>
      </section>

      <p style={{ color: "var(--muted)", marginTop: 28, fontSize: 13 }}>
        Phase 1 — scaffold &amp; orchestration. Indexing, graph, chat and notes
        arrive in later phases.
      </p>
    </main>
  );
}
