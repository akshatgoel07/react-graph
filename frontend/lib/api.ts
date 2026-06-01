// Thin client for the gateway. The Gemini key is read from the caller (kept in
// localStorage by the UI) and sent per request as X-Gemini-Key — never to any
// third party but Gemini, via our own worker.

const GATEWAY =
  process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:8080";

export type ProgressEvent = {
  job_id: string;
  stage: string;
  message: string;
  current: number;
  total: number;
  done: boolean;
  error?: string;
};

export type FlowNode = {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: { label: string };
};
export type FlowEdge = {
  id: string;
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
  type?: string;
};
export type Flow = { nodes: FlowNode[]; edges: FlowEdge[] };

function headers(key: string): HeadersInit {
  return { "Content-Type": "application/json", "X-Gemini-Key": key };
}

/** Index a local repo, invoking onEvent for each streamed progress event. */
export async function indexRepo(opts: {
  project: string;
  path: string;
  key: string;
  onEvent: (e: ProgressEvent) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const res = await fetch(`${GATEWAY}/api/index`, {
    method: "POST",
    headers: headers(opts.key),
    body: JSON.stringify({ project: opts.project, path: opts.path }),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`index request failed: HTTP ${res.status}`);
  }
  await readSSE(res.body, (event, data) => {
    if (event === "progress") {
      try {
        opts.onEvent(JSON.parse(data) as ProgressEvent);
      } catch {
        /* ignore malformed line */
      }
    } else if (event === "error") {
      try {
        throw new Error((JSON.parse(data) as { error: string }).error);
      } catch (e) {
        throw e instanceof Error ? e : new Error("stream error");
      }
    }
  });
}

/** Generate a React Flow architecture diagram for a repo. */
export async function generateGraph(opts: {
  project: string;
  path: string;
  key: string;
}): Promise<Flow> {
  const res = await fetch(`${GATEWAY}/api/graph`, {
    method: "POST",
    headers: headers(opts.key),
    body: JSON.stringify({ project: opts.project, path: opts.path }),
  });
  const json = (await res.json()) as {
    ok?: boolean;
    flow?: Flow;
    error?: string;
  };
  if (!res.ok || !json.ok || !json.flow) {
    throw new Error(json.error || `graph request failed: HTTP ${res.status}`);
  }
  return json.flow;
}

export type ChatChunk = { delta?: string; done: boolean; error?: string };

/** Ask a question about an indexed repo; onDelta fires for each streamed token. */
export async function chat(opts: {
  project: string;
  query: string;
  key: string;
  onDelta: (delta: string) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const res = await fetch(`${GATEWAY}/api/chat`, {
    method: "POST",
    headers: headers(opts.key),
    body: JSON.stringify({ project: opts.project, query: opts.query }),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`chat request failed: HTTP ${res.status}`);
  }
  await readSSE(res.body, (event, data) => {
    if (event === "chunk") {
      const c = JSON.parse(data) as ChatChunk;
      if (c.error) throw new Error(c.error);
      if (c.delta) opts.onDelta(c.delta);
    } else if (event === "error") {
      throw new Error((JSON.parse(data) as { error: string }).error);
    }
  });
}

// Minimal SSE parser over a fetch ReadableStream (EventSource can't POST).
async function readSSE(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: string, data: string) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const frames = buf.split("\n\n");
    buf = frames.pop() ?? "";
    for (const frame of frames) {
      let event = "message";
      let data = "";
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (data) onEvent(event, data);
    }
  }
}
