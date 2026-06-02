// Package contracts defines the wire protocol between the gateway and the
// Python worker over NATS. The Python side mirrors these shapes. Every request
// to the worker carries the user's BYOK Gemini key inline; it is forwarded
// transiently and never persisted.
package contracts

import "encoding/json"

// NATS subjects. Prefix "rg." keeps react-graph traffic namespaced.
const (
	SubjectIndexRequest = "rg.index.request" // gateway -> worker (queue group)
	SubjectGraphRequest = "rg.graph.request" // gateway <-> worker (request/reply)
	SubjectChatRequest  = "rg.chat.request"  // gateway -> worker (starts a stream)
	SubjectNotesRequest = "rg.notes.request" // gateway <-> worker (request/reply)
)

// IndexProgressSubject is where the worker publishes progress for a job and the
// gateway subscribes to relay it to the browser as SSE.
func IndexProgressSubject(jobID string) string { return "rg.index.progress." + jobID }

// ChatStreamSubject is where the worker streams answer chunks for a chat turn.
func ChatStreamSubject(streamID string) string { return "rg.chat.stream." + streamID }

// IndexRequest asks the worker to index a repo into Qdrant. If RepoURL is set
// (a public https git URL), the worker shallow-clones it into the workspace
// first, then indexes the result at Path.
type IndexRequest struct {
	JobID     string `json:"job_id"`
	Project   string `json:"project"`
	Path      string `json:"path"`               // relative to the worker's WORKSPACE_DIR
	RepoURL   string `json:"repo_url,omitempty"` // optional public git URL to clone
	GeminiKey string `json:"gemini_key"`
}

// ProgressEvent is emitted repeatedly during indexing.
type ProgressEvent struct {
	JobID   string `json:"job_id"`
	Stage   string `json:"stage"`
	Message string `json:"message"`
	Current int    `json:"current"`
	Total   int    `json:"total"`
	Done    bool   `json:"done"`
	Error   string `json:"error,omitempty"`
}

// GraphRequest asks the worker to produce a React Flow diagram for a repo.
type GraphRequest struct {
	Project   string `json:"project"`
	Path      string `json:"path"`
	GeminiKey string `json:"gemini_key"`
}

// GraphResponse is the worker's reply to a GraphRequest. Flow is opaque React
// Flow JSON ({nodes, edges}) passed straight through to the browser.
type GraphResponse struct {
	OK    bool            `json:"ok"`
	Flow  json.RawMessage `json:"flow,omitempty"`
	Error string          `json:"error,omitempty"`
}

// ChatRequest starts a streamed RAG answer. The worker publishes ChatChunks to
// ChatStreamSubject(StreamID).
type ChatRequest struct {
	StreamID  string `json:"stream_id"`
	Project   string `json:"project"`
	Query     string `json:"query"`
	GeminiKey string `json:"gemini_key"`
}

// ChatChunk is one streamed delta of an answer.
type ChatChunk struct {
	Delta string `json:"delta,omitempty"`
	Done  bool   `json:"done"`
	Error string `json:"error,omitempty"`
}
