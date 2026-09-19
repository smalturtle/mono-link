// Package console is the built-in plugin that prints live progress and the
// final summary to stderr.
package console

import (
	"context"
	"fmt"
	"io"
	"os"
	"sync/atomic"
	"time"

	"github.com/pulsebench/pulsebench/pkg/plugin"
)

// Plugin prints a start banner, a progress line every interval, and the
// run summary. Progress counters are fed by bus events and may therefore
// slightly undercount under backpressure; the final summary always comes
// from the collector and is exact.
type Plugin struct {
	out      io.Writer
	interval time.Duration

	requests atomic.Int64
	errors   atomic.Int64
	stop     chan struct{}
	done     chan struct{}
}

// New creates the console plugin writing to stderr.
func New() *Plugin {
	return &Plugin{out: os.Stderr, interval: 5 * time.Second}
}

func (p *Plugin) Name() string { return "console" }

// Init accepts an optional "interval" duration string.
func (p *Plugin) Init(config map[string]any) error {
	if v, ok := config["interval"]; ok {
		s, ok := v.(string)
		if !ok {
			return fmt.Errorf("console: interval must be a duration string")
		}
		d, err := time.ParseDuration(s)
		if err != nil {
			return fmt.Errorf("console: invalid interval: %w", err)
		}
		p.interval = d
	}
	return nil
}

func (p *Plugin) OnRunStart(_ context.Context, run *plugin.RunContext) error {
	fmt.Fprintf(p.out, "▶ pulsebench run %s\n", run.RunID)
	fmt.Fprintf(p.out, "  scenario:   %s\n", run.ScenarioName)
	fmt.Fprintf(p.out, "  target:     %s\n", run.BaseURL)
	fmt.Fprintf(p.out, "  load model: %s (RPS is a dependent variable — not a capacity test)\n", run.LoadModel)
	fmt.Fprintf(p.out, "  users:      %d  duration: %s  ramp-up: %s\n",
		run.Users, run.Duration, run.RampUp)
	fmt.Fprintf(p.out, "  conn pool:  MaxIdleConnsPerHost=%d (scaled to users)\n\n", run.Users)

	p.stop = make(chan struct{})
	p.done = make(chan struct{})
	start := time.Now()
	go func() {
		defer close(p.done)
		t := time.NewTicker(p.interval)
		defer t.Stop()
		for {
			select {
			case <-t.C:
				elapsed := time.Since(start).Round(time.Second)
				fmt.Fprintf(p.out, "  [%s] requests≈%d errors≈%d\n",
					elapsed, p.requests.Load(), p.errors.Load())
			case <-p.stop:
				return
			}
		}
	}()
	return nil
}

func (p *Plugin) OnRequest(_ context.Context, _ *plugin.RunContext, r *plugin.RequestResult) {
	p.requests.Add(1)
	if r.IsError() {
		p.errors.Add(1)
	}
}

func (p *Plugin) OnRunEnd(_ context.Context, _ *plugin.RunContext, s *plugin.Summary) error {
	if p.stop != nil {
		close(p.stop)
		<-p.done
	}

	w := p.out
	fmt.Fprintf(w, "\n━━ Summary %s (load model: %s) ━━\n", s.RunID, s.LoadModel)
	printWindow(w, "steady-state (thresholds apply here)", &s.Steady)
	printWindow(w, "overall (ramp-up included)", &s.Overall)
	fmt.Fprintf(w, "  dropped plugin events: %d (metrics are never dropped)\n", s.DroppedEvents)

	if len(s.Thresholds) > 0 {
		fmt.Fprintln(w, "\n  thresholds (steady-state):")
		for _, t := range s.Thresholds {
			mark := "PASS"
			if !t.Passed {
				mark = "FAIL"
			}
			fmt.Fprintf(w, "    [%s] %-12s limit=%s actual=%s\n", mark, t.Name, t.Limit, t.Actual)
		}
	}
	return nil
}

func printWindow(w io.Writer, title string, s *plugin.WindowStats) {
	fmt.Fprintf(w, "\n  %s — %.1fs\n", title, s.WindowSeconds)
	fmt.Fprintf(w, "    requests: %-8d rps: %.1f  error_rate: %.2f%%\n",
		s.Requests, s.RPS, s.ErrorRate*100)
	fmt.Fprintf(w, "    errors:   network=%d status=%d assert(latency)=%d\n",
		s.NetworkErrors, s.StatusFailures, s.AssertFailures)
	fmt.Fprintf(w, "    latency:  min=%s p50=%s p95=%s p99=%s max=%s\n",
		s.LatencyMin.Round(time.Microsecond), s.LatencyP50.Round(time.Microsecond),
		s.LatencyP95.Round(time.Microsecond), s.LatencyP99.Round(time.Microsecond),
		s.LatencyMax.Round(time.Microsecond))
}
