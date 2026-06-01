package server

import (
	"context"
	"log"
	"net/http"
	"time"
)

const geminiKeyHeader = "X-Gemini-Key"

type ctxKey int

const geminiKeyCtx ctxKey = iota

// withCORS allows the browser and the BYOK key header through.
func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("Access-Control-Allow-Origin", "*")
		h.Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		h.Set("Access-Control-Allow-Headers", "Content-Type, "+geminiKeyHeader)
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// byok lifts the per-request Gemini key into the context if present. It does
// not enforce — handlers that need a key call geminiKey() and 400 if absent.
// The key is never logged.
func byok(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if k := r.Header.Get(geminiKeyHeader); k != "" {
			r = r.WithContext(context.WithValue(r.Context(), geminiKeyCtx, k))
		}
		next.ServeHTTP(w, r)
	})
}

func geminiKey(ctx context.Context) (string, bool) {
	k, ok := ctx.Value(geminiKeyCtx).(string)
	return k, ok && k != ""
}

// logger logs method, path and duration without wrapping the ResponseWriter,
// so SSE handlers keep their http.Flusher.
func logger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start).Round(time.Millisecond))
	})
}
