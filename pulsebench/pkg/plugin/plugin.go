// Package plugin defines the public extension contract of PulseBench.
//
// Third-party integrations implement the Plugin interface and register the
// plugin at build time (fork or import). See docs/plugins.md.
package plugin

import (
	"context"
	"time"
)

// LoadModelClosed marks the MVP closed-loop load model: a fixed number of
// virtual users issue requests in a loop, so RPS is a dependent variable.
const LoadModelClosed = "closed"

// RunContext carries immutable information about the current run. It is
// passed to every plugin hook.
type RunContext struct {
	RunID        string        `json:"run_id"`
	ScenarioName string        `json:"scenario"`
	BaseURL      string        `json:"base_url"`
	LoadModel    string        `json:"load_model"`
	Users        int           `json:"users"`
	Duration     time.Duration `json:"duration"`
	RampUp       time.Duration `json:"ramp_up"`
	StartTime    time.Time     `json:"start_time"`
}

// RequestResult is the outcome of a single request executed by a virtual
// user. It is delivered to plugins asynchronously through the event bus.
type RequestResult struct {
	StepName   string        `json:"step"`
	Method     string        `json:"method"`
	URL        string        `json:"url"`
	StatusCode int           `json:"status_code"`
	Latency    time.Duration `json:"latency"`
	Timestamp  time.Time     `json:"timestamp"`
	// InSteady reports whether the request started after the ramp-up phase.
	InSteady bool `json:"in_steady"`

	// NetworkError is non-empty on transport-level failures (timeout,
	// connection refused, DNS failure, ...). Counts toward error_rate.
	NetworkError string `json:"network_error,omitempty"`
	// StatusFailed reports a status assertion failure. Counts toward error_rate.
	StatusFailed bool `json:"status_failed,omitempty"`
	// AssertFailed reports a max_latency assertion failure. It is "slow, not
	// wrong" and does NOT count toward error_rate (see DESIGN.md §7.3).
	AssertFailed bool `json:"assert_failed,omitempty"`
}

// IsError reports whether the result counts toward error_rate
// (network errors and status assertion failures only).
func (r *RequestResult) IsError() bool {
	return r.NetworkError != "" || r.StatusFailed
}

// WindowStats aggregates metrics over one observation window
// (steady-state window or the whole run).
type WindowStats struct {
	WindowSeconds  float64 `json:"window_seconds"`
	Requests       int64   `json:"requests"`
	RPS            float64 `json:"rps"`
	NetworkErrors  int64   `json:"network_errors"`
	StatusFailures int64   `json:"status_failures"`
	AssertFailures int64   `json:"assert_failures"`
	// ErrorRate = (NetworkErrors + StatusFailures) / Requests.
	ErrorRate float64 `json:"error_rate"`

	LatencyMin  time.Duration `json:"latency_min_ns"`
	LatencyMax  time.Duration `json:"latency_max_ns"`
	LatencyMean time.Duration `json:"latency_mean_ns"`
	LatencyP50  time.Duration `json:"latency_p50_ns"`
	LatencyP95  time.Duration `json:"latency_p95_ns"`
	LatencyP99  time.Duration `json:"latency_p99_ns"`
}

// ThresholdResult is the verdict for one configured threshold, evaluated
// against the steady-state window only.
type ThresholdResult struct {
	Name   string `json:"name"`
	Limit  string `json:"limit"`
	Actual string `json:"actual"`
	Passed bool   `json:"passed"`
}

// Summary is the final aggregate of a run, passed to OnRunEnd.
type Summary struct {
	RunID     string    `json:"run_id"`
	Scenario  string    `json:"scenario"`
	LoadModel string    `json:"load_model"`
	StartTime time.Time `json:"start_time"`
	EndTime   time.Time `json:"end_time"`

	// Steady covers samples after ramp-up; thresholds are judged on it.
	Steady WindowStats `json:"steady"`
	// Overall covers every sample of the run, ramp-up included.
	Overall WindowStats `json:"overall"`

	// DroppedEvents counts plugin-side events discarded by the event bus
	// under backpressure. Metrics never pass through the bus and are never
	// dropped.
	DroppedEvents int64 `json:"dropped_events"`

	Thresholds      []ThresholdResult `json:"thresholds,omitempty"`
	ThresholdPassed bool              `json:"threshold_passed"`
}

// Plugin is the extension point of PulseBench.
//
// OnRequest is invoked asynchronously by the event bus dispatcher goroutine;
// a slow OnRequest never blocks the load loop (events are dropped and counted
// instead). OnRunStart and OnRunEnd are invoked synchronously, so reports are
// guaranteed to be flushed before the process exits.
type Plugin interface {
	Name() string
	// Init receives this plugin's config block from the scenario `plugins:`
	// section (may be nil/empty).
	Init(config map[string]any) error
	OnRunStart(ctx context.Context, run *RunContext) error
	OnRequest(ctx context.Context, run *RunContext, result *RequestResult)
	OnRunEnd(ctx context.Context, run *RunContext, summary *Summary) error
}
