// Command gateway is the orchestration tier for react-graph.
//
// It is the only service the browser talks to. Its jobs: terminate HTTP/SSE,
// carry the user's BYOK Gemini key per request (never persisted), validate
// input, and (from Phase 2 onward) hand work to the Python worker over NATS and
// stream results/progress back to the frontend.
//
// Phase 1 is deliberately dependency-free (standard library only): a health
// surface plus CORS so the rest of the system can boot and be observed.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"
)

const version = "0.1.0-phase1"

func main() {
	healthcheck := flag.Bool("healthcheck", false, "probe local /health and exit 0/1 (used by docker)")
	flag.Parse()

	port := getenv("GATEWAY_PORT", "8080")

	if *healthcheck {
		os.Exit(probe(port))
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/health", handleHealth)
	mux.HandleFunc("/readyz", handleReady)

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           withCORS(withLogging(mux)),
		ReadHeaderTimeout: 10 * time.Second,
	}

	log.Printf("gateway %s listening on :%s (nats=%s)", version, port, getenv("NATS_URL", "unset"))
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server error: %v", err)
	}
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"status":  "ok",
		"service": "gateway",
		"version": version,
	})
}

// handleReady will, in later phases, also report NATS connectivity. For now the
// gateway is ready as soon as it can serve.
func handleReady(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"ready": true})
}

// probe is the docker healthcheck entrypoint: hit our own /health.
func probe(port string) int {
	c := &http.Client{Timeout: 3 * time.Second}
	resp, err := c.Get("http://localhost:" + port + "/health")
	if err != nil {
		fmt.Fprintln(os.Stderr, "healthcheck:", err)
		return 1
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, resp.Body)
	if resp.StatusCode != http.StatusOK {
		return 1
	}
	return 0
}

// withCORS allows the browser frontend (and the BYOK key header) through.
func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Gemini-Key")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func withLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start).Round(time.Millisecond))
	})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
