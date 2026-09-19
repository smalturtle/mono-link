package engine

import (
	"testing"
	"time"

	"github.com/pulsebench/pulsebench/internal/scenario"
	"github.com/pulsebench/pulsebench/pkg/plugin"
)

func f(v float64) *float64 { return &v }

func TestEvaluateThresholdsNilConfig(t *testing.T) {
	results, passed := EvaluateThresholds(nil, plugin.WindowStats{})
	if !passed || results != nil {
		t.Errorf("nil thresholds: passed=%v results=%v", passed, results)
	}
}

func TestEvaluateThresholdsEmptyConfig(t *testing.T) {
	results, passed := EvaluateThresholds(&scenario.Thresholds{}, plugin.WindowStats{
		LatencyP95: time.Hour, ErrorRate: 1,
	})
	if !passed || len(results) != 0 {
		t.Errorf("empty thresholds: passed=%v results=%v", passed, results)
	}
}

func TestEvaluateThresholdsP95(t *testing.T) {
	cfg := &scenario.Thresholds{P95Latency: scenario.Duration(800 * time.Millisecond)}

	results, passed := EvaluateThresholds(cfg, plugin.WindowStats{LatencyP95: 500 * time.Millisecond})
	if !passed || len(results) != 1 || !results[0].Passed || results[0].Name != "p95_latency" {
		t.Errorf("pass case: passed=%v results=%+v", passed, results)
	}

	// Boundary: equal is a pass.
	_, passed = EvaluateThresholds(cfg, plugin.WindowStats{LatencyP95: 800 * time.Millisecond})
	if !passed {
		t.Error("p95 == limit should pass")
	}

	results, passed = EvaluateThresholds(cfg, plugin.WindowStats{LatencyP95: 900 * time.Millisecond})
	if passed || results[0].Passed {
		t.Errorf("fail case: passed=%v results=%+v", passed, results)
	}
}

func TestEvaluateThresholdsErrorRate(t *testing.T) {
	cfg := &scenario.Thresholds{ErrorRate: f(0.01)}

	_, passed := EvaluateThresholds(cfg, plugin.WindowStats{ErrorRate: 0.005})
	if !passed {
		t.Error("0.005 <= 0.01 should pass")
	}
	_, passed = EvaluateThresholds(cfg, plugin.WindowStats{ErrorRate: 0.01})
	if !passed {
		t.Error("boundary equal should pass")
	}
	results, passed := EvaluateThresholds(cfg, plugin.WindowStats{ErrorRate: 0.02})
	if passed || results[0].Passed {
		t.Errorf("0.02 > 0.01 should fail: %+v", results)
	}
	// error_rate: 0 means "no errors tolerated" and must still be evaluated.
	cfgZero := &scenario.Thresholds{ErrorRate: f(0)}
	results, passed = EvaluateThresholds(cfgZero, plugin.WindowStats{ErrorRate: 0.001})
	if passed || len(results) != 1 {
		t.Errorf("zero threshold: passed=%v results=%+v", passed, results)
	}
}

func TestEvaluateThresholdsCombined(t *testing.T) {
	cfg := &scenario.Thresholds{
		P95Latency: scenario.Duration(800 * time.Millisecond),
		ErrorRate:  f(0.01),
	}
	// One passes, one fails → overall fail, both reported.
	results, passed := EvaluateThresholds(cfg, plugin.WindowStats{
		LatencyP95: 100 * time.Millisecond,
		ErrorRate:  0.5,
	})
	if passed {
		t.Error("combined should fail")
	}
	if len(results) != 2 || !results[0].Passed || results[1].Passed {
		t.Errorf("results = %+v", results)
	}
}

func TestNewRunID(t *testing.T) {
	now := time.Date(2026, 9, 19, 5, 0, 0, 0, time.UTC)
	id := NewRunID(now)
	if len(id) != len("20260919-050000-abcd") {
		t.Fatalf("run id %q has unexpected length", id)
	}
	if id[:15] != "20260919-050000" {
		t.Errorf("run id prefix = %q", id[:15])
	}
	if NewRunID(now) == NewRunID(now) {
		t.Error("expected random suffix to differ")
	}
}
