# ── build ────────────────────────────────────────────────────────────────────
FROM golang:1.25-alpine AS build
WORKDIR /src

# Dependencies first for layer caching.
COPY go.mod go.sum ./
RUN go mod download

COPY . .
# Static binary so it can run on a scratch image and serve as its own healthcheck.
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /gateway .

# ── runtime ──────────────────────────────────────────────────────────────────
FROM scratch
COPY --from=build /gateway /gateway
EXPOSE 8080
ENTRYPOINT ["/gateway"]
