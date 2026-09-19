package engine

import (
	"fmt"

	"github.com/pulsebench/pulsebench/internal/scenario"
	"github.com/pulsebench/pulsebench/pkg/plugin"
)

// EvaluateThresholds judges the configured thresholds against steady-state
// stats (DESIGN §7.2: ramp-up samples never gate CI). A nil config passes
// with no results. Pure logic, unit-testable.
func EvaluateThresholds(t *scenario.Thresholds, steady plugin.WindowStats) (results []plugin.ThresholdResult, passed bool) {
	passed = true
	if t == nil {
		return nil, true
	}
	if t.P95Latency > 0 {
		ok := steady.LatencyP95 <= t.P95Latency.D()
		results = append(results, plugin.ThresholdResult{
			Name:   "p95_latency",
			Limit:  t.P95Latency.D().String(),
			Actual: steady.LatencyP95.String(),
			Passed: ok,
		})
		passed = passed && ok
	}
	if t.ErrorRate != nil {
		ok := steady.ErrorRate <= *t.ErrorRate
		results = append(results, plugin.ThresholdResult{
			Name:   "error_rate",
			Limit:  fmt.Sprintf("%.4f", *t.ErrorRate),
			Actual: fmt.Sprintf("%.4f", steady.ErrorRate),
			Passed: ok,
		})
		passed = passed && ok
	}
	return results, passed
}
