// Command gateway is the orchestration tier for react-graph.
//
// It is the only service the browser talks to. Its jobs: terminate HTTP/SSE,
// carry the user's BYOK Gemini key per request (never persisted), validate
// input, hand work to the Python worker over NATS, and stream progress/results
// back to the frontend. It contains no Gemini SDK and no AI logic.
package main

import (
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/akshatgoel07/react-graph/gateway/internal/bus"
	"github.com/akshatgoel07/react-graph/gateway/internal/config"
	"github.com/akshatgoel07/react-graph/gateway/internal/server"
)

func main() {
	healthcheck := flag.Bool("healthcheck", false, "probe local /health and exit 0/1 (used by docker)")
	flag.Parse()

	cfg := config.Load()
	if *healthcheck {
		os.Exit(probe(cfg.Port))
	}

	b, err := connectWithRetry(cfg.NATSURL, 15)
	if err != nil {
		log.Fatalf("could not connect to NATS at %s: %v", cfg.NATSURL, err)
	}
	defer b.Close()

	srv := server.New(b)
	httpSrv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           srv.Router(),
		ReadHeaderTimeout: 10 * time.Second,
		// No WriteTimeout: SSE responses are long-lived.
	}

	log.Printf("gateway %s listening on :%s (nats=%s)", server.Version, cfg.Port, cfg.NATSURL)
	if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server error: %v", err)
	}
}

// connectWithRetry tolerates NATS not being ready the instant the gateway boots.
func connectWithRetry(url string, attempts int) (*bus.Bus, error) {
	var last error
	for i := 0; i < attempts; i++ {
		b, err := bus.Connect(url)
		if err == nil {
			return b, nil
		}
		last = err
		log.Printf("nats connect attempt %d/%d failed: %v", i+1, attempts, err)
		time.Sleep(2 * time.Second)
	}
	return nil, last
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
