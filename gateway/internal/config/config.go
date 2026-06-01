package config

import "os"

// Config is the gateway's runtime configuration. The gateway holds no Gemini
// key — keys arrive per-request from the browser (BYOK) and are forwarded to
// the worker transiently, never stored.
type Config struct {
	Port    string
	NATSURL string
}

func Load() Config {
	return Config{
		Port:    getenv("GATEWAY_PORT", "8080"),
		NATSURL: getenv("NATS_URL", "nats://nats:4222"),
	}
}

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
