// Package eventbus decouples the load loop from plugin hooks.
//
// Virtual users publish RequestResults with a non-blocking send into a
// buffered channel; a single dispatcher goroutine consumes it and invokes
// the handler (plugin OnRequest fan-out). When the buffer is full the event
// is dropped and counted — a slow plugin can never slow down the load loop,
// it only loses per-request events (metrics do not pass through the bus).
package eventbus

import (
	"sync"
	"sync/atomic"

	"github.com/pulsebench/pulsebench/pkg/plugin"
)

// Bus is an asynchronous single-consumer event bus for request results.
type Bus struct {
	ch      chan *plugin.RequestResult
	dropped atomic.Int64
	wg      sync.WaitGroup

	closeOnce sync.Once
}

// New creates a bus with the given buffer capacity and starts the dispatcher
// goroutine. handler is invoked sequentially, one event at a time.
func New(capacity int, handler func(*plugin.RequestResult)) *Bus {
	if capacity < 1 {
		capacity = 1
	}
	b := &Bus{ch: make(chan *plugin.RequestResult, capacity)}
	b.wg.Add(1)
	go func() {
		defer b.wg.Done()
		for r := range b.ch {
			handler(r)
		}
	}()
	return b
}

// Publish enqueues a result without blocking. If the buffer is full the
// event is dropped and the drop counter incremented.
func (b *Bus) Publish(r *plugin.RequestResult) {
	select {
	case b.ch <- r:
	default:
		b.dropped.Add(1)
	}
}

// Close stops accepting events, waits for the dispatcher to drain the buffer
// and returns. Safe to call multiple times.
func (b *Bus) Close() {
	b.closeOnce.Do(func() { close(b.ch) })
	b.wg.Wait()
}

// Dropped returns the number of events discarded under backpressure.
func (b *Bus) Dropped() int64 {
	return b.dropped.Load()
}
