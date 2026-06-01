// Package bus wraps the NATS connection the gateway uses to talk to the worker.
// NATS is the single fabric: a job queue (publish), request/reply, and progress
// pub-sub all flow through it.
package bus

import (
	"context"
	"time"

	"github.com/nats-io/nats.go"
)

type Bus struct {
	nc *nats.Conn
}

// Connect dials NATS with infinite reconnect so the gateway rides out a worker
// or broker blip without crashing.
func Connect(url string) (*Bus, error) {
	nc, err := nats.Connect(url,
		nats.Name("react-graph-gateway"),
		nats.MaxReconnects(-1),
		nats.ReconnectWait(time.Second),
		nats.Timeout(5*time.Second),
	)
	if err != nil {
		return nil, err
	}
	return &Bus{nc: nc}, nil
}

func (b *Bus) Connected() bool { return b.nc != nil && b.nc.IsConnected() }

func (b *Bus) Close() {
	if b.nc != nil {
		_ = b.nc.Drain()
	}
}

// Publish fires a message onto a subject (fire-and-forget; used for jobs).
func (b *Bus) Publish(subject string, data []byte) error {
	return b.nc.Publish(subject, data)
}

// Request does NATS request/reply, honoring the context deadline. Returns
// nats.ErrNoResponders immediately if nothing is listening.
func (b *Bus) Request(ctx context.Context, subject string, data []byte) (*nats.Msg, error) {
	return b.nc.RequestWithContext(ctx, subject, data)
}

// SubscribeChan subscribes to a subject and delivers messages on a channel.
// Caller must Unsubscribe when done.
func (b *Bus) SubscribeChan(subject string) (*nats.Subscription, chan *nats.Msg, error) {
	ch := make(chan *nats.Msg, 64)
	sub, err := b.nc.ChanSubscribe(subject, ch)
	if err != nil {
		return nil, nil, err
	}
	return sub, ch, nil
}
