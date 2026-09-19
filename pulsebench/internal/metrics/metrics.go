// Package metrics aggregates request results into windowed statistics.
//
// The collector is updated inline by virtual users (a mutex-guarded
// in-memory operation), NOT through the event bus, so metrics are never
// dropped under backpressure. It keeps two windows: the whole run
// ("overall") and the post-ramp-up steady state ("steady"); thresholds are
// judged against the latter only. It does no I/O.
package metrics

import (
	"sync"
	"time"

	hdrhistogram "github.com/HdrHistogram/hdrhistogram-go"

	"github.com/pulsebench/pulsebench/pkg/plugin"
)

// Histogram bounds: 1µs .. 10min at 3 significant figures.
const (
	histMin    = int64(time.Microsecond)
	histMax    = int64(10 * time.Minute)
	histSigFig = 3
)

type window struct {
	hist           *hdrhistogram.Histogram
	requests       int64
	networkErrors  int64
	statusFailures int64
	assertFailures int64
}

func newWindow() *window {
	return &window{hist: hdrhistogram.New(histMin, histMax, histSigFig)}
}

func (w *window) record(r *plugin.RequestResult) {
	w.requests++
	switch {
	case r.NetworkError != "":
		w.networkErrors++
	case r.StatusFailed:
		w.statusFailures++
	}
	if r.AssertFailed {
		w.assertFailures++
	}
	// Latency of failed transports is still a real observation (e.g. time
	// until timeout); record everything with a measurable latency.
	if r.Latency > 0 {
		lat := r.Latency
		if int64(lat) > histMax {
			lat = time.Duration(histMax)
		}
		_ = w.hist.RecordValue(int64(lat))
	}
}

func (w *window) stats(seconds float64) plugin.WindowStats {
	s := plugin.WindowStats{
		WindowSeconds:  seconds,
		Requests:       w.requests,
		NetworkErrors:  w.networkErrors,
		StatusFailures: w.statusFailures,
		AssertFailures: w.assertFailures,
	}
	if w.requests > 0 {
		s.ErrorRate = float64(w.networkErrors+w.statusFailures) / float64(w.requests)
	}
	if seconds > 0 {
		s.RPS = float64(w.requests) / seconds
	}
	if w.hist.TotalCount() > 0 {
		s.LatencyMin = time.Duration(w.hist.Min())
		s.LatencyMax = time.Duration(w.hist.Max())
		s.LatencyMean = time.Duration(w.hist.Mean())
		s.LatencyP50 = time.Duration(w.hist.ValueAtQuantile(50))
		s.LatencyP95 = time.Duration(w.hist.ValueAtQuantile(95))
		s.LatencyP99 = time.Duration(w.hist.ValueAtQuantile(99))
	}
	return s
}

// Collector aggregates request results for one run.
type Collector struct {
	mu      sync.Mutex
	overall *window
	steady  *window
}

// NewCollector creates an empty collector.
func NewCollector() *Collector {
	return &Collector{overall: newWindow(), steady: newWindow()}
}

// Record adds one result. Results with InSteady=true are counted in both
// windows; ramp-up results only in the overall window.
func (c *Collector) Record(r *plugin.RequestResult) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.overall.record(r)
	if r.InSteady {
		c.steady.record(r)
	}
}

// Snapshot computes stats for both windows. overallSeconds is the elapsed
// run time; steadySeconds is the elapsed time after ramp-up.
func (c *Collector) Snapshot(overallSeconds, steadySeconds float64) (overall, steady plugin.WindowStats) {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.overall.stats(overallSeconds), c.steady.stats(steadySeconds)
}
