"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUp, Loader2 } from "lucide-react";

import { chat } from "@/lib/api";

type Msg = { role: "user" | "assistant"; content: string };

export default function Chat({
  apiKey,
  project,
}: {
  apiKey: string;
  project: string;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const send = useCallback(async () => {
    const q = input.trim();
    if (!q || busy || !apiKey.trim()) return;
    setError(null);
    setInput("");
    setMessages((m) => [
      ...m,
      { role: "user", content: q },
      { role: "assistant", content: "" },
    ]);
    setBusy(true);
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
      setBusy(false);
    }
  }, [input, busy, apiKey, project]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px" }}>
        {messages.length === 0 && (
          <div style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.6 }}>
            Ask about <strong style={{ color: "var(--text)" }}>{project || "the repo"}</strong> once it&apos;s indexed.
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
              {["How does routing work?", "Where are vectors stored?", "Explain the request flow."].map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  style={{
                    textAlign: "left",
                    background: "transparent",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: "7px 11px",
                    color: "var(--muted)",
                    fontSize: 12.5,
                    cursor: "pointer",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {messages.map((m, i) => {
            const streaming = busy && i === messages.length - 1 && m.role === "assistant";
            if (m.role === "user") {
              return (
                <div key={i} style={{ alignSelf: "flex-end", maxWidth: "88%" }}>
                  <div
                    style={{
                      background: "var(--accent)",
                      color: "var(--accent-text)",
                      borderRadius: 12,
                      borderBottomRightRadius: 4,
                      padding: "8px 13px",
                      fontSize: 13.5,
                      lineHeight: 1.5,
                    }}
                  >
                    {m.content}
                  </div>
                </div>
              );
            }
            return (
              <div key={i} style={{ alignSelf: "flex-start", maxWidth: "100%", width: "100%" }}>
                <div
                  className={`md${streaming ? " caret" : ""}`}
                  style={{ fontSize: 13.5, color: "var(--text)" }}
                >
                  {m.content ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                  ) : streaming ? (
                    <span style={{ color: "var(--muted)" }}>
                      <Loader2 size={14} style={{ verticalAlign: "-2px", animation: "spin 1s linear infinite" }} /> thinking…
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {error && <div style={{ color: "var(--bad)", fontSize: 12.5, marginTop: 10 }}>{error}</div>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        style={{
          display: "flex",
          gap: 8,
          alignItems: "flex-end",
          padding: 12,
          borderTop: "1px solid var(--border)",
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          placeholder={apiKey ? "Ask about the codebase…" : "Add your Gemini key first"}
          disabled={busy || !apiKey}
          style={{
            flex: 1,
            resize: "none",
            background: "var(--panel)",
            border: "1px solid var(--border-strong)",
            borderRadius: 10,
            padding: "9px 12px",
            color: "var(--text)",
            fontSize: 13.5,
            fontFamily: "var(--font-sans)",
            outline: "none",
            maxHeight: 120,
          }}
        />
        <button
          type="submit"
          disabled={busy || !input.trim() || !apiKey}
          aria-label="Send"
          style={{
            display: "grid",
            placeItems: "center",
            width: 38,
            height: 38,
            borderRadius: 10,
            border: "none",
            background: busy || !input.trim() || !apiKey ? "var(--hover)" : "var(--accent)",
            color: busy || !input.trim() || !apiKey ? "var(--faint)" : "var(--accent-text)",
            cursor: busy || !input.trim() || !apiKey ? "not-allowed" : "pointer",
          }}
        >
          {busy ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <ArrowUp size={16} />}
        </button>
      </form>
    </div>
  );
}
