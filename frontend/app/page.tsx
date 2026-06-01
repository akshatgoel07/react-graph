"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

import {
  addNote,
  chat,
  deleteNote,
  generateGraph,
  indexRepo,
  listNotes,
  type Flow,
  type Note,
  type ProgressEvent,
} from "@/lib/api";

type Msg = { role: "user" | "assistant"; content: string };

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

  const [messages, setMessages] = useState<Msg[]>([]);
  const [question, setQuestion] = useState("");
  const [chatting, setChatting] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  const [notes, setNotes] = useState<Note[]>([]);
  const [noteText, setNoteText] = useState("");

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
  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight });
  }, [messages]);

  // Load notes whenever the project changes.
  useEffect(() => {
    const p = project.trim();
    if (!p) return;
    listNotes(p)
      .then(setNotes)
      .catch(() => setNotes([]));
  }, [project]);

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

  const onAsk = useCallback(async () => {
    const q = question.trim();
    if (!q || chatting || !apiKey.trim()) return;
    setError(null);
    setQuestion("");
    setMessages((m) => [...m, { role: "user", content: q }, { role: "assistant", content: "" }]);
    setChatting(true);
    try {
      await chat({
        project: project.trim(),
        query: q,
        key: apiKey.trim(),
        onDelta: (d) =>
          setMessages((m) => {
            const next = [...m];
            next[next.length - 1] = {
              role: "assistant",
              content: next[next.length - 1].content + d,
            };
            return next;
          }),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setChatting(false);
    }
  }, [question, chatting, apiKey, project]);

  const onAddNote = useCallback(async () => {
    const t = noteText.trim();
    if (!t) return;
    try {
      setNotes(await addNote(project.trim(), t));
      setNoteText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [noteText, project]);

  const onDeleteNote = useCallback(
    async (id: string) => {
      try {
        setNotes(await deleteNote(project.trim(), id));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [project],
  );

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

      {/* Notes */}
      <section style={panel}>
        <strong style={{ fontSize: 15 }}>Notes &amp; understanding</strong>
        <p style={{ color: "var(--muted)", fontSize: 12.5, margin: "4px 0 12px" }}>
          Capture what you learn about <code>{project || "this repo"}</code>.
          Saved notes are fed into chat as established context.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onAddNote();
          }}
          style={{ display: "flex", gap: 10, marginBottom: 12 }}
        >
          <input
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="e.g. The gateway never holds the Gemini key — it's BYOK per request."
            style={{ ...input, flex: 1 }}
          />
          <button type="submit" disabled={!noteText.trim()} style={btn(!noteText.trim())}>
            Save
          </button>
        </form>
        {notes.length === 0 ? (
          <div style={{ color: "var(--muted)", fontSize: 13 }}>No notes yet.</div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {notes.map((n) => (
              <li
                key={n.id}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  background: "#0e1218",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 13.5,
                }}
              >
                <span style={{ flex: 1, lineHeight: 1.45 }}>{n.text}</span>
                <button
                  onClick={() => onDeleteNote(n.id)}
                  title="Delete note"
                  style={{
                    background: "transparent",
                    color: "var(--muted)",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 16,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Chat */}
      <section style={panel}>
        <strong style={{ fontSize: 15 }}>Talk to the repo</strong>
        <p style={{ color: "var(--muted)", fontSize: 12.5, margin: "4px 0 12px" }}>
          Index the repo first, then ask about it. Answers are grounded in the
          retrieved code.
        </p>
        <div
          ref={chatRef}
          style={{
            maxHeight: 320,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginBottom: 12,
          }}
        >
          {messages.length === 0 && (
            <div style={{ color: "var(--muted)", fontSize: 13 }}>
              e.g. “How does routing work?” · “Where are vectors stored?”
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "85%",
                background: m.role === "user" ? "var(--accent)" : "#0e1218",
                color: m.role === "user" ? "#0b0d12" : "var(--text)",
                border: m.role === "user" ? "none" : "1px solid var(--border)",
                borderRadius: 10,
                padding: "9px 13px",
                fontSize: 13.5,
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
              }}
            >
              {m.content || (chatting && i === messages.length - 1 ? "…" : "")}
            </div>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onAsk();
          }}
          style={{ display: "flex", gap: 10 }}
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={apiKey ? "Ask about the codebase…" : "Enter your Gemini key above first"}
            disabled={chatting || !apiKey}
            style={{ ...input, flex: 1 }}
          />
          <button type="submit" disabled={chatting || !question.trim() || !apiKey} style={btn(chatting || !question.trim() || !apiKey)}>
            {chatting ? "…" : "Ask"}
          </button>
        </form>
      </section>
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
