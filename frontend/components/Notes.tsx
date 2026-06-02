"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, X } from "lucide-react";

import { addNote, deleteNote, listNotes, type Note } from "@/lib/api";

export default function Notes({ project }: { project: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const p = project.trim();
    if (!p) return;
    listNotes(p)
      .then(setNotes)
      .catch(() => setNotes([]));
  }, [project]);

  const add = useCallback(async () => {
    const t = text.trim();
    if (!t) return;
    try {
      setNotes(await addNote(project.trim(), t));
      setText("");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [text, project]);

  const remove = useCallback(
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
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
        <p style={{ color: "var(--muted)", fontSize: 12.5, margin: "0 0 12px", lineHeight: 1.55 }}>
          What you learn about <strong style={{ color: "var(--text)" }}>{project || "this repo"}</strong>.
          Saved notes are fed into chat as established context.
        </p>
        {notes.length === 0 ? (
          <div style={{ color: "var(--faint)", fontSize: 13 }}>No notes yet.</div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {notes.map((n) => (
              <li
                key={n.id}
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-start",
                  background: "var(--panel)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "9px 11px",
                  fontSize: 13,
                  lineHeight: 1.45,
                }}
              >
                <span style={{ flex: 1 }}>{n.text}</span>
                <button
                  onClick={() => remove(n.id)}
                  aria-label="Delete note"
                  style={{ background: "transparent", border: "none", color: "var(--faint)", cursor: "pointer", padding: 0, display: "grid", placeItems: "center" }}
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && <div style={{ color: "var(--bad)", fontSize: 12.5, marginTop: 10 }}>{error}</div>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid var(--border)" }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a note…"
          style={{
            flex: 1,
            background: "var(--panel)",
            border: "1px solid var(--border-strong)",
            borderRadius: 10,
            padding: "9px 12px",
            color: "var(--text)",
            fontSize: 13.5,
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={!text.trim()}
          aria-label="Add note"
          style={{
            display: "grid",
            placeItems: "center",
            width: 38,
            height: 38,
            borderRadius: 10,
            border: "none",
            background: text.trim() ? "var(--accent)" : "var(--hover)",
            color: text.trim() ? "var(--accent-text)" : "var(--faint)",
            cursor: text.trim() ? "pointer" : "not-allowed",
          }}
        >
          <Plus size={16} />
        </button>
      </form>
    </div>
  );
}
