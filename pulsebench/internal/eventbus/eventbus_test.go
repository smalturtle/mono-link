package eventbus

import (
	"sync/atomic"
	"testing"
	"time"

	"github.com/pulsebench/pulsebench/pkg/plugin"
)

func TestDeliverAll(t *testing.T) {
	var got atomic.Int64
	b := New(64, func(*plugin.RequestResult) { got.Add(1) })
	for i := 0; i < 50; i++ {
		b.Publish(&plugin.RequestResult{})
	}
	b.Close()
	if got.Load() != 50 {
		t.Errorf("delivered = %d, want 50", got.Load())
	}
	if b.Dropped() != 0 {
		t.Errorf("dropped = %d, want 0", b.Dropped())
	}
}

func TestBlockedHandlerDropsInsteadOfBlocking(t *testing.T) {
	release := make(chan struct{})
	var handled atomic.Int64
	b := New(4, func(*plugin.RequestResult) {
		<-release // simulate a plugin stuck on disk I/O
		handled.Add(1)
	})

	// Publish far more events than the buffer can hold. Publish must return
	// immediately (never block the load loop) and count the overflow.
	done := make(chan struct{})
	go func() {
		for i := 0; i < 100; i++ {
			b.Publish(&plugin.RequestResult{})
		}
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("Publish blocked on a stuck handler")
	}

	if b.Dropped() == 0 {
		t.Error("expected dropped events with a stuck handler")
	}

	close(release)
	b.Close()
	// Everything not dropped must eventually be handled (buffer drained).
	if handled.Load()+b.Dropped() != 100 {
		t.Errorf("handled %d + dropped %d != 100", handled.Load(), b.Dropped())
	}
}

func TestCloseDrainsBuffer(t *testing.T) {
	var got atomic.Int64
	b := New(128, func(*plugin.RequestResult) {
		time.Sleep(time.Millisecond)
		got.Add(1)
	})
	for i := 0; i < 20; i++ {
		b.Publish(&plugin.RequestResult{})
	}
	b.Close() // must wait until the dispatcher consumed the whole buffer
	if got.Load() != 20 {
		t.Errorf("handled = %d, want 20", got.Load())
	}
}

func TestCloseIdempotent(t *testing.T) {
	b := New(1, func(*plugin.RequestResult) {})
	b.Close()
	b.Close() // must not panic
}

func TestMinimumCapacity(t *testing.T) {
	b := New(0, func(*plugin.RequestResult) {})
	b.Publish(&plugin.RequestResult{})
	b.Close()
}
