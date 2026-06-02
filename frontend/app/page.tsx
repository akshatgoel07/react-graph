"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  Boxes,
  Database,
  GitBranch,
  KeyRound,
  Loader2,
  MessageSquare,
  NotebookPen,
} from "lucide-react";

import { generateGraph, indexRepo, type Flow, type ProgressEvent } from "@/lib/api";
import Chat from "@/components/Chat";
import Notes from "@/components/Notes";

const Diagram = dynamic(() => import("@/components/Diagram"), { ssr: false });

const KEY_STORAGE = "rg.geminiKey";

// Workspace-safe slug from a repo URL (…/owner/repo.git -> "repo").
function slugFromUrl(url: string): string {
  try {
    const seg = new URL(url).pathname.replace(/\/+$/, "").split("/").pop() ?? "";
    return seg.replace(/\.git$/, "").replace(/[^A-Za-z0-9._-]/g, "_");
  } catch {
    return "";
  }
}

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [repo, setRepo] = useState("sample");
  const [flow, setFlow] = useState<Flow | null>(null);
  const [indexing, setIndexing] = useState(false);
  const [graphing, setGraphing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"chat" | "notes">("chat");

  useEffect(() => {
    const saved = localStorage.getItem(KEY_STORAGE);
    if (saved) setApiKey(saved);
  }, []);
  useEffect(() => {
    if (apiKey) localStorage.setItem(KEY_STORAGE, apiKey);
  }, [apiKey]);

  // One field accepts either a GitHub URL or a local workspace path.
  const trimmed = repo.trim();
  const isUrl = /^https?:\/\//i.test(trimmed);
  const repoUrl = isUrl ? trimmed : "";
  const project = isUrl ? slugFromUrl(trimmed) : trimmed;
  const ready = !!apiKey.trim() && !!project;

  const onIndex = useCallback(async () => {
    if (!ready) return;
    setError(null);
    setIndexing(true);
    setStatus("starting…");
    try {
      await indexRepo({
        project,
        path: project,
        key: apiKey.trim(),
        repoUrl: repoUrl || undefined,
        onEvent: (e: ProgressEvent) => {
          setStatus(e.message);
          if (e.error) setError(e.error);
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIndexing(false);
    }
  }, [ready, project, repoUrl, apiKey]);

  const onGraph = useCallback(async () => {
    if (!ready) return;
    setError(null);
    setGraphing(true);
    try {
      setFlow(await generateGraph({ project, path: project, key: apiKey.trim() }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGraphing(false);
    }
  }, [ready, project, apiKey]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header
        style={{
          height: "var(--topbar-h)",
          flexShrink: 0,
          borderBottom: "1px solid var(--border)",
          background: "var(--panel)",
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "0 16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, letterSpacing: -0.2 }}>
          <Boxes size={18} />
          react-graph
        </div>

        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Field icon={<KeyRound size={14} />}>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Gemini key"
              style={{ ...bareInput, width: 130 }}
            />
          </Field>
          <Field icon={<GitBranch size={14} />}>
            <input
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="workspace path or github.com/owner/repo"
              style={{ ...bareInput, width: 280 }}
            />
          </Field>
          <button onClick={onIndex} disabled={!ready || indexing} style={ghostBtn(!ready || indexing)}>
            {indexing ? <Loader2 size={14} style={spin} /> : <Database size={14} />} Index
          </button>
          <button onClick={onGraph} disabled={!ready || graphing} style={solidBtn(!ready || graphing)}>
            {graphing ? <Loader2 size={14} style={spin} /> : <GitBranch size={14} />} Generate diagram
          </button>
        </div>

        <div style={{ fontSize: 12, color: error ? "var(--bad)" : "var(--muted)", maxWidth: 320, textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {error ?? (indexing ? status : status && !graphing ? status : "")}
        </div>
      </header>

      {/* ── Split: graph left, chat/notes right ──────────────────────────── */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <section style={{ flex: 1.5, minWidth: 0, borderRight: "1px solid var(--border)", position: "relative" }}>
          {flow ? <Diagram flow={flow} /> : <GraphEmpty />}
        </section>

        <aside style={{ width: 420, flexShrink: 0, display: "flex", flexDirection: "column", background: "var(--panel)", minHeight: 0 }}>
          <div style={{ display: "flex", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
            <Tab active={tab === "chat"} onClick={() => setTab("chat")} icon={<MessageSquare size={14} />}>Chat</Tab>
            <Tab active={tab === "notes"} onClick={() => setTab("notes")} icon={<NotebookPen size={14} />}>Notes</Tab>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            {tab === "chat" ? <Chat apiKey={apiKey} project={project} /> : <Notes project={project} />}
          </div>
        </aside>
      </div>
    </div>
  );
}

function GraphEmpty() {
  return (
    <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "var(--faint)" }}>
      <div style={{ textAlign: "center" }}>
        <svg width="120" height="86" viewBox="0 0 120 86" fill="none" stroke="#d4d4d8" strokeWidth="1.5">
          <rect x="44" y="6" width="32" height="20" rx="4" />
          <rect x="8" y="58" width="32" height="20" rx="4" />
          <rect x="80" y="58" width="32" height="20" rx="4" />
          <path d="M56 26 L28 58 M64 26 L92 58" />
        </svg>
        <div style={{ marginTop: 16, fontSize: 13, color: "var(--muted)" }}>
          Index a repo, then <strong style={{ color: "var(--text)" }}>Generate diagram</strong>.
        </div>
      </div>
    </div>
  );
}

function Field({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        background: "var(--bg)",
        border: "1px solid var(--border-strong)",
        borderRadius: 8,
        padding: "0 10px",
        height: 34,
        color: "var(--muted)",
      }}
    >
      {icon}
      {children}
    </div>
  );
}

function Tab({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        padding: "11px 0",
        background: "transparent",
        border: "none",
        borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
        color: active ? "var(--text)" : "var(--muted)",
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        cursor: "pointer",
      }}
    >
      {icon}
      {children}
    </button>
  );
}

const bareInput: React.CSSProperties = {
  background: "transparent",
  border: "none",
  outline: "none",
  color: "var(--text)",
  fontSize: 13,
  fontFamily: "var(--font-sans)",
};
const spin: React.CSSProperties = { animation: "spin 1s linear infinite" };

function ghostBtn(disabled: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 34,
    padding: "0 13px",
    borderRadius: 8,
    border: "1px solid var(--border-strong)",
    background: "var(--panel)",
    color: disabled ? "var(--faint)" : "var(--text)",
    fontSize: 13,
    fontWeight: 500,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}
function solidBtn(disabled: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 34,
    padding: "0 14px",
    borderRadius: 8,
    border: "none",
    background: disabled ? "var(--hover)" : "var(--accent)",
    color: disabled ? "var(--faint)" : "var(--accent-text)",
    fontSize: 13,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}
