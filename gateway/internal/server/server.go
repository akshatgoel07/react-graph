package server

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/google/uuid"
	"github.com/nats-io/nats.go"

	"github.com/akshatgoel07/react-graph/gateway/internal/bus"
	"github.com/akshatgoel07/react-graph/gateway/internal/contracts"
)

const Version = "0.7.0-phase7"

// Server is the HTTP/orchestration tier. It owns no AI logic — it validates,
// carries the BYOK key, and brokers work to the worker over NATS.
type Server struct {
	bus *bus.Bus
}

func New(b *bus.Bus) *Server { return &Server{bus: b} }

func (s *Server) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(chimw.RequestID)
	r.Use(chimw.Recoverer)
	r.Use(logger)
	r.Use(withCORS)
	r.Use(byok)

	r.Get("/health", s.handleHealth)
	r.Get("/readyz", s.handleReady)

	r.Route("/api", func(r chi.Router) {
		r.Post("/index", s.handleIndex)     // index a local repo, streaming progress (SSE)
		r.Post("/graph", s.handleGraph)     // React Flow diagram (request/reply)
		r.Post("/chat", s.handleChat)          // streamed RAG answer (SSE)
		r.Get("/notes", s.handleNotesList)     // list notes for a project
		r.Post("/notes", s.handleNotesAdd)     // add a note
		r.Delete("/notes", s.handleNotesDelete) // delete a note
	})
	return r
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"status":  "ok",
		"service": "gateway",
		"version": Version,
	})
}

// handleReady reports NATS connectivity — the gateway is only useful with it.
func (s *Server) handleReady(w http.ResponseWriter, _ *http.Request) {
	ready := s.bus.Connected()
	code := http.StatusOK
	if !ready {
		code = http.StatusServiceUnavailable
	}
	writeJSON(w, code, map[string]any{"ready": ready, "nats": s.bus.Connected()})
}

// handleIndex indexes a local repo and streams progress as SSE. To avoid
// missing early events on a fast job, the gateway subscribes to the progress
// subject BEFORE publishing the request (core NATS has no replay).
func (s *Server) handleIndex(w http.ResponseWriter, r *http.Request) {
	key, ok := geminiKey(r.Context())
	if !ok {
		writeErr(w, http.StatusBadRequest, "missing "+geminiKeyHeader+" header (BYOK)")
		return
	}
	var body struct {
		Project string `json:"project"`
		Path    string `json:"path"`
		RepoURL string `json:"repo_url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if body.Project == "" || body.Path == "" {
		writeErr(w, http.StatusBadRequest, "project and path are required")
		return
	}

	job := uuid.NewString()
	sub, ch, err := s.bus.SubscribeChan(contracts.IndexProgressSubject(job))
	if err != nil {
		writeErr(w, http.StatusBadGateway, "subscribe failed: "+err.Error())
		return
	}
	defer sub.Unsubscribe()

	sse, ok := newSSE(w)
	if !ok {
		writeErr(w, http.StatusInternalServerError, "streaming unsupported")
		return
	}
	jobJSON, _ := json.Marshal(map[string]string{"job_id": job})
	sse.event("job", jobJSON)

	data, _ := json.Marshal(contracts.IndexRequest{
		JobID:     job,
		Project:   body.Project,
		Path:      body.Path,
		RepoURL:   body.RepoURL,
		GeminiKey: key,
	})
	if err := s.bus.Publish(contracts.SubjectIndexRequest, data); err != nil {
		sse.event("error", []byte(`{"error":"failed to enqueue index job"}`))
		return
	}

	// Embedding a large repo can take a while; reset the idle timer on activity
	// so a slow-but-alive job keeps streaming, while a dead worker still ends.
	const idle = 180 * time.Second
	timeout := time.NewTimer(idle)
	defer timeout.Stop()
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()
	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			return
		case <-timeout.C:
			sse.event("error", []byte(`{"error":"indexing stalled — worker unavailable or no progress"}`))
			return
		case <-ticker.C:
			sse.comment("keepalive")
		case msg := <-ch:
			sse.event("progress", msg.Data)
			var ev contracts.ProgressEvent
			if json.Unmarshal(msg.Data, &ev) == nil && (ev.Done || ev.Error != "") {
				return
			}
			if !timeout.Stop() {
				select {
				case <-timeout.C:
				default:
				}
			}
			timeout.Reset(idle)
		}
	}
}

// handleGraph asks the worker for a diagram via request/reply.
func (s *Server) handleGraph(w http.ResponseWriter, r *http.Request) {
	key, ok := geminiKey(r.Context())
	if !ok {
		writeErr(w, http.StatusBadRequest, "missing "+geminiKeyHeader+" header (BYOK)")
		return
	}
	var body struct {
		Project string `json:"project"`
		Path    string `json:"path"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if body.Project == "" || body.Path == "" {
		writeErr(w, http.StatusBadRequest, "project and path are required")
		return
	}

	data, _ := json.Marshal(contracts.GraphRequest{
		Project:   body.Project,
		Path:      body.Path,
		GeminiKey: key,
	})
	ctx, cancel := context.WithTimeout(r.Context(), 120*time.Second)
	defer cancel()

	msg, err := s.bus.Request(ctx, contracts.SubjectGraphRequest, data)
	if err != nil {
		if errors.Is(err, nats.ErrNoResponders) {
			writeErr(w, http.StatusServiceUnavailable, "graph worker not available yet (lands in Phase 5)")
			return
		}
		writeErr(w, http.StatusGatewayTimeout, "graph request failed: "+err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(msg.Data)
}

// handleChat publishes a chat request and streams the worker's answer chunks
// back as SSE. Uses POST (body carries the query) with a streamed response.
func (s *Server) handleChat(w http.ResponseWriter, r *http.Request) {
	key, ok := geminiKey(r.Context())
	if !ok {
		writeErr(w, http.StatusBadRequest, "missing "+geminiKeyHeader+" header (BYOK)")
		return
	}
	var body struct {
		Project string `json:"project"`
		Query   string `json:"query"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if body.Query == "" {
		writeErr(w, http.StatusBadRequest, "query is required")
		return
	}

	stream := uuid.NewString()
	sub, ch, err := s.bus.SubscribeChan(contracts.ChatStreamSubject(stream))
	if err != nil {
		writeErr(w, http.StatusBadGateway, "subscribe failed: "+err.Error())
		return
	}
	defer sub.Unsubscribe()

	sse, ok := newSSE(w)
	if !ok {
		writeErr(w, http.StatusInternalServerError, "streaming unsupported")
		return
	}

	data, _ := json.Marshal(contracts.ChatRequest{
		StreamID:  stream,
		Project:   body.Project,
		Query:     body.Query,
		GeminiKey: key,
	})
	if err := s.bus.Publish(contracts.SubjectChatRequest, data); err != nil {
		sse.event("error", []byte(`{"error":"failed to enqueue chat"}`))
		return
	}

	// Bound the wait so a missing worker can't hang the connection; reset on
	// each chunk so a slow-but-alive answer keeps flowing.
	const idle = 90 * time.Second
	timeout := time.NewTimer(idle)
	defer timeout.Stop()
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()
	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			return
		case <-timeout.C:
			sse.event("error", []byte(`{"error":"chat worker timed out (lands in Phase 6)"}`))
			return
		case <-ticker.C:
			sse.comment("keepalive")
		case msg := <-ch:
			sse.event("chunk", msg.Data)
			var c contracts.ChatChunk
			if json.Unmarshal(msg.Data, &c) == nil && (c.Done || c.Error != "") {
				return
			}
			if !timeout.Stop() {
				select {
				case <-timeout.C:
				default:
				}
			}
			timeout.Reset(idle)
		}
	}
}

// notesRPC forwards a notes operation to the worker and relays its reply.
// Notes need no Gemini key.
func (s *Server) notesRPC(w http.ResponseWriter, payload map[string]any) {
	data, _ := json.Marshal(payload)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	msg, err := s.bus.Request(ctx, contracts.SubjectNotesRequest, data)
	if err != nil {
		if errors.Is(err, nats.ErrNoResponders) {
			writeErr(w, http.StatusServiceUnavailable, "notes worker unavailable")
			return
		}
		writeErr(w, http.StatusGatewayTimeout, "notes request failed: "+err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(msg.Data)
}

func (s *Server) handleNotesList(w http.ResponseWriter, r *http.Request) {
	project := r.URL.Query().Get("project")
	if project == "" {
		writeErr(w, http.StatusBadRequest, "project query param required")
		return
	}
	s.notesRPC(w, map[string]any{"op": "list", "project": project})
}

func (s *Server) handleNotesAdd(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Project string `json:"project"`
		Text    string `json:"text"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if body.Project == "" || body.Text == "" {
		writeErr(w, http.StatusBadRequest, "project and text are required")
		return
	}
	s.notesRPC(w, map[string]any{"op": "add", "project": body.Project, "text": body.Text})
}

func (s *Server) handleNotesDelete(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Project string `json:"project"`
		ID      string `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if body.Project == "" || body.ID == "" {
		writeErr(w, http.StatusBadRequest, "project and id are required")
		return
	}
	s.notesRPC(w, map[string]any{"op": "delete", "project": body.Project, "id": body.ID})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]any{"error": msg})
}
