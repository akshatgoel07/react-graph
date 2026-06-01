# ── build ────────────────────────────────────────────────────────────────────
FROM golang:1.23-alpine AS build
WORKDIR /src

# Dependencies first for layer caching. go.sum may be absent in Phase 1 (no deps).
COPY go.mod ./
COPY go.su[m] ./
RUN go mod download || true

COPY . .
# Static binary so it can run on a scratch image and serve as its own healthcheck.
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /gateway .

# ── runtime ──────────────────────────────────────────────────────────────────
FROM scratch
COPY --from=build /gateway /gateway
EXPOSE 8080
ENTRYPOINT ["/gateway"]
