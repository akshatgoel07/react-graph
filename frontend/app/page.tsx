"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

import {
  generateGraph,
  indexRepo,
  type Flow,
  type ProgressEvent,
} from "@/lib/api";

// React Flow is client-only; avoid SSR measuring issues.
const Diagram = dynamic(() => import("@/components/Diagram"), { ssr: false });

const KEY_STORAGE = "rg.geminiKey";

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [project, setProject] = useState("sample");
  const [path, setPath] = useState("sample");

  const [log, setLog] = useState<string[]>([]);
  const [indexing, setIndexing] = useState(false);
  const [graphing, setGraphing] = useState(false);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  // Persist the key locally (never leaves the browser except as X-Gemini-Key).
  useEffect(() => {
    const saved = localStorage.getItem(KEY_STORAGE);
    if (saved) setApiKey(saved);
  }, []);
  useEffect(() => {
    if (apiKey) localStorage.setItem(KEY_STORAGE, apiKey);
  }, [apiKey]);
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [log]);

  const append = useCallback(
    (line: string) => setLog((l) => [...l, line]),
    [],
  );

  const ready = apiKey.trim() && project.trim() && path.trim();

  const onIndex = useCallback(async () => {
    setError(null);
    setLog([]);
    setIndexing(true);
    try {
      await indexRepo({
        project: project.trim(),
        path: path.trim(),
        key: apiKey.trim(),
        onEvent: (e: ProgressEvent) => {
          append(`[${e.stage}] ${e.message}`);
          if (e.error) setError(e.error);
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIndexing(false);
    }
  }, [project, path, apiKey, append]);

  const onGraph = useCallback(async () => {
    setError(null);
    setGraphing(true);
    try {
      const f = await generateGraph({
        project: project.trim(),
        path: path.trim(),
        key: apiKey.trim(),
      });
      setFlow(f);
      append(`[graph] ${f.nodes.length} nodes, ${f.edges.length} edges`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGraphing(false);
    }
  }, [project, path, apiKey, append]);

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px" }}>
      <h1 style={{ fontSize: 28, margin: 0, letterSpacing: -0.5 }}>
        react-graph
      </h1>
      <p style={{ color: "var(--muted)", marginTop: 6, lineHeight: 1.5 }}>
        Local-first repo comprehension. Index a repo under{" "}
        <code>./workspace</code>, then generate its architecture diagram —
        powered only by your Gemini key.
      </p>

      {/* Controls */}
      <section style={panel}>
        <label style={lbl}>
          Gemini API key (BYOK · stored only in your browser)
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="AIza…"
            style={input}
          />
        </label>
        <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
          <label style={{ ...lbl, flex: 1 }}>
            Project name
            <input
              value={project}
              onChange={(e) => setProject(e.target.value)}
              style={input}
            />
          </label>
          <label style={{ ...lbl, flex: 1 }}>
            Path (relative to ./workspace)
            <input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              style={input}
            />
          </label>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <button
            onClick={onIndex}
            disabled={!ready || indexing}
            style={btn(!ready || indexing)}
          >
            {indexing ? "Indexing…" : "Index repo"}
          </button>
          <button
            onClick={onGraph}
            disabled={!ready || graphing}
            style={btn(!ready || graphing)}
          >
            {graphing ? "Generating…" : "Generate diagram"}
          </button>
        </div>
        {error && (
          <p style={{ color: "var(--bad)", marginTop: 12, fontSize: 13 }}>
            {error}
          </p>
        )}
      </section>

      {/* Progress log */}
      {log.length > 0 && (
        <div
          ref={logRef}
          style={{
            ...panel,
            maxHeight: 160,
            overflowY: "auto",
            fontFamily: "ui-monospace, monospace",
            fontSize: 12.5,
            color: "var(--muted)",
          }}
        >
          {log.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}

      {/* Diagram */}
      {flow && (
        <div style={{ marginTop: 20 }}>
          <Diagram flow={flow} />
        </div>
      )}
    </main>
  );
}

const panel: React.CSSProperties = {
  marginTop: 20,
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 20,
};
const lbl: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontSize: 13,
  color: "var(--muted)",
};
const input: React.CSSProperties = {
  background: "#0e1218",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "9px 12px",
  color: "var(--text)",
  fontSize: 14,
  outline: "none",
};
function btn(disabled: boolean): React.CSSProperties {
  return {
    background: disabled ? "#1b2230" : "var(--accent)",
    color: disabled ? "var(--muted)" : "#0b0d12",
    border: "none",
    borderRadius: 8,
    padding: "10px 18px",
    fontSize: 14,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}
