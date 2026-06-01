package server

import (
	"fmt"
	"net/http"
)

// sseWriter is a tiny Server-Sent-Events helper over a flushable ResponseWriter.
type sseWriter struct {
	w http.ResponseWriter
	f http.Flusher
}

func newSSE(w http.ResponseWriter) (*sseWriter, bool) {
	f, ok := w.(http.Flusher)
	if !ok {
		return nil, false
	}
	h := w.Header()
	h.Set("Content-Type", "text/event-stream")
	h.Set("Cache-Control", "no-cache")
	h.Set("Connection", "keep-alive")
	h.Set("X-Accel-Buffering", "no") // disable proxy buffering
	w.WriteHeader(http.StatusOK)
	f.Flush()
	return &sseWriter{w: w, f: f}, true
}

// event writes a named SSE event with a JSON data payload.
func (s *sseWriter) event(name string, data []byte) {
	if name != "" {
		fmt.Fprintf(s.w, "event: %s\n", name)
	}
	fmt.Fprintf(s.w, "data: %s\n\n", data)
	s.f.Flush()
}

// comment writes an SSE comment line — used for keepalives.
func (s *sseWriter) comment(text string) {
	fmt.Fprintf(s.w, ": %s\n\n", text)
	s.f.Flush()
}
