package engine

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/pulsebench/pulsebench/internal/scenario"
	"github.com/pulsebench/pulsebench/pkg/plugin"
)

// recordingPlugin counts hook invocations for assertions.
type recordingPlugin struct {
	started, ended atomic.Int64
	requests       atomic.Int64
	onRequest      func(*plugin.RequestResult) // optional extra behaviour
	summary        *plugin.Summary
}

func (p *recordingPlugin) Name() string              { return "recording" }
func (p *recordingPlugin) Init(map[string]any) error { return nil }
func (p *recordingPlugin) OnRunStart(context.Context, *plugin.RunContext) error {
	p.started.Add(1)
	return nil
}
func (p *recordingPlugin) OnRequest(_ context.Context, _ *plugin.RunContext, r *plugin.RequestResult) {
	p.requests.Add(1)
	if p.onRequest != nil {
		p.onRequest(r)
	}
}
func (p *recordingPlugin) OnRunEnd(_ context.Context, _ *plugin.RunContext, s *plugin.Summary) error {
	p.ended.Add(1)
	p.summary = s
	return nil
}

func testScenario(baseURL string) *scenario.Scenario {
	sc := &scenario.Scenario{
		Name:    "engine-test",
		BaseURL: baseURL,
		Load: scenario.Load{
			Duration: scenario.Duration(1200 * time.Millisecond),
			RampUp:   scenario.Duration(300 * time.Millisecond),
			Users:    5,
		},
		Timeout:     scenario.Timeout{Request: scenario.Duration(time.Second)},
		EventBuffer: 4096,
		Steps: []scenario.Step{{
			Name: "ping",
			Request: scenario.Request{
				Method:  "GET",
				URL:     "/ping",
				Timeout: scenario.Duration(time.Second),
			},
			Assert: scenario.Assert{Status: 200},
		}},
	}
	return sc
}

func TestRunAgainstLocalServer(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
	}))
	defer srv.Close()

	rec := &recordingPlugin{}
	sc := testScenario(srv.URL)
	sc.Thresholds = &scenario.Thresholds{
		P95Latency: scenario.Duration(500 * time.Millisecond),
		ErrorRate:  f(0.01),
	}

	summary, err := New(sc, []plugin.Plugin{rec}).Run(context.Background())
	if err != nil {
		t.Fatalf("Run: %v", err)
	}

	if rec.started.Load() != 1 || rec.ended.Load() != 1 {
		t.Errorf("hooks: started=%d ended=%d", rec.started.Load(), rec.ended.Load())
	}
	if summary.Overall.Requests == 0 || summary.Steady.Requests == 0 {
		t.Fatalf("no requests recorded: %+v", summary)
	}
	if summary.Steady.Requests > summary.Overall.Requests {
		t.Errorf("steady %d > overall %d", summary.Steady.Requests, summary.Overall.Requests)
	}
	if summary.Overall.ErrorRate != 0 {
		t.Errorf("error rate = %v", summary.Overall.ErrorRate)
	}
	if !summary.ThresholdPassed || len(summary.Thresholds) != 2 {
		t.Errorf("thresholds: passed=%v %+v", summary.ThresholdPassed, summary.Thresholds)
	}
	if summary.LoadModel != plugin.LoadModelClosed {
		t.Errorf("load model = %q", summary.LoadModel)
	}
	if summary.RunID == "" {
		t.Error("empty run id")
	}
	// Bus delivered events (some may be dropped in theory, none expected here).
	if rec.requests.Load()+summary.DroppedEvents != summary.Overall.Requests {
		t.Errorf("bus events %d + dropped %d != requests %d",
			rec.requests.Load(), summary.DroppedEvents, summary.Overall.Requests)
	}
}

func TestThresholdFailureReported(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(500) // every request fails the status assertion
	}))
	defer srv.Close()

	sc := testScenario(srv.URL)
	sc.Load.Duration = scenario.Duration(600 * time.Millisecond)
	sc.Load.RampUp = scenario.Duration(100 * time.Millisecond)
	sc.Thresholds = &scenario.Thresholds{ErrorRate: f(0.01)}

	summary, err := New(sc, nil).Run(context.Background())
	if err != nil {
		t.Fatalf("Run: %v", err)
	}
	if summary.ThresholdPassed {
		t.Error("threshold should fail with 100% status failures")
	}
	if summary.Steady.StatusFailures == 0 {
		t.Errorf("status failures = %d", summary.Steady.StatusFailures)
	}
}

// TestBlockedPluginDoesNotSlowLoadLoop verifies acceptance criterion #5:
// a plugin stuck on I/O must inflate dropped_events, not deflate RPS.
func TestBlockedPluginDoesNotSlowLoadLoop(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
	}))
	defer srv.Close()

	block := make(chan struct{})
	stuck := &recordingPlugin{onRequest: func(*plugin.RequestResult) { <-block }}

	sc := testScenario(srv.URL)
	sc.EventBuffer = 8 // tiny buffer so the stuck plugin overflows it quickly

	done := make(chan *plugin.Summary, 1)
	go func() {
		summary, err := New(sc, []plugin.Plugin{stuck}).Run(context.Background())
		if err != nil {
			t.Errorf("Run: %v", err)
		}
		done <- summary
	}()

	// Unblock the dispatcher shortly before the run deadline so Close() can
	// drain; the load loop itself must have kept running the whole time.
	time.Sleep(1100 * time.Millisecond)
	close(block)

	summary := <-done
	if summary == nil {
		t.Fatal("no summary")
	}
	if summary.DroppedEvents == 0 {
		t.Error("expected dropped events with a blocked plugin")
	}
	// The load loop was not throttled: with 5 users and a local server we
	// expect far more requests than the 8-slot buffer plus handled events.
	if summary.Overall.Requests < 100 {
		t.Errorf("requests = %d, load loop appears throttled by the blocked plugin",
			summary.Overall.Requests)
	}
}

func TestContextCancelStopsRun(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
	}))
	defer srv.Close()

	sc := testScenario(srv.URL)
	sc.Load.Duration = scenario.Duration(30 * time.Second)

	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancel()

	start := time.Now()
	if _, err := New(sc, nil).Run(ctx); err != nil {
		t.Fatalf("Run: %v", err)
	}
	if elapsed := time.Since(start); elapsed > 5*time.Second {
		t.Errorf("cancel did not stop the run promptly (%v)", elapsed)
	}
}

func TestThinkTimeIsRespected(t *testing.T) {
	var hits atomic.Int64
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		w.WriteHeader(200)
	}))
	defer srv.Close()

	sc := testScenario(srv.URL)
	sc.Load.Users = 1
	sc.Load.RampUp = 0
	sc.Load.Duration = scenario.Duration(600 * time.Millisecond)
	sc.ThinkTime = scenario.Duration(200 * time.Millisecond)

	if _, err := New(sc, nil).Run(context.Background()); err != nil {
		t.Fatalf("Run: %v", err)
	}
	// 600ms / (~0ms request + 200ms think) ≈ 3 rounds; allow slack.
	if n := hits.Load(); n > 6 {
		t.Errorf("hits = %d, think_time not respected", n)
	}
}
