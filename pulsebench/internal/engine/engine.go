// Package engine schedules virtual users (closed load model), splits the run
// into ramp-up and steady-state windows, and evaluates thresholds. It knows
// nothing about HTTP parsing — protocol work lives in executors.
package engine

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/pulsebench/pulsebench/internal/eventbus"
	httpexec "github.com/pulsebench/pulsebench/internal/executor/http"
	"github.com/pulsebench/pulsebench/internal/metrics"
	"github.com/pulsebench/pulsebench/internal/scenario"
	"github.com/pulsebench/pulsebench/pkg/plugin"
)

// Engine runs one scenario with the closed load model: `users` virtual users
// loop over the steps until the duration elapses. RPS is a dependent
// variable (DESIGN §7.1).
type Engine struct {
	sc      *scenario.Scenario
	plugins []plugin.Plugin
}

// New creates an engine for one scenario with the given (already Init-ed)
// plugins.
func New(sc *scenario.Scenario, plugins []plugin.Plugin) *Engine {
	return &Engine{sc: sc, plugins: plugins}
}

// Run executes the scenario and returns the final summary. The returned
// error covers run-level failures (plugin OnRunStart/OnRunEnd errors);
// threshold verdicts are reported via Summary.ThresholdPassed.
func (e *Engine) Run(ctx context.Context) (*plugin.Summary, error) {
	sc := e.sc
	start := time.Now()
	runCtx := &plugin.RunContext{
		RunID:        NewRunID(start),
		ScenarioName: sc.Name,
		BaseURL:      sc.BaseURL,
		LoadModel:    plugin.LoadModelClosed,
		Users:        sc.Load.Users,
		Duration:     sc.Load.Duration.D(),
		RampUp:       sc.Load.RampUp.D(),
		StartTime:    start,
	}

	collector := metrics.NewCollector()
	exec := httpexec.New(sc.BaseURL, sc.Load.Users)

	// Event bus: fans each RequestResult out to plugin OnRequest hooks
	// without ever blocking the load loop (DESIGN §6.3).
	bus := eventbus.New(sc.EventBuffer, func(r *plugin.RequestResult) {
		for _, p := range e.plugins {
			p.OnRequest(ctx, runCtx, r)
		}
	})

	for _, p := range e.plugins {
		if err := p.OnRunStart(ctx, runCtx); err != nil {
			bus.Close()
			return nil, fmt.Errorf("plugin %s OnRunStart: %w", p.Name(), err)
		}
	}

	runCtxT, cancelRun := context.WithDeadline(ctx, start.Add(sc.Load.Duration.D()))
	defer cancelRun()
	steadyStart := start.Add(sc.Load.RampUp.D())

	var wg sync.WaitGroup
	for i := 0; i < sc.Load.Users; i++ {
		wg.Add(1)
		// Linear ramp-up: user i starts at rampUp * i / users.
		var delay time.Duration
		if sc.Load.Users > 0 {
			delay = sc.Load.RampUp.D() * time.Duration(i) / time.Duration(sc.Load.Users)
		}
		go func(startDelay time.Duration) {
			defer wg.Done()
			select {
			case <-time.After(startDelay):
			case <-runCtxT.Done():
				return
			}
			e.runUser(runCtxT, exec, collector, bus, steadyStart)
		}(delay)
	}

	wg.Wait()
	end := time.Now()
	bus.Close() // drain remaining events before building the summary

	overallSec := end.Sub(start).Seconds()
	steadySec := end.Sub(steadyStart).Seconds()
	if steadySec < 0 {
		steadySec = 0
	}
	overall, steady := collector.Snapshot(overallSec, steadySec)

	summary := &plugin.Summary{
		RunID:         runCtx.RunID,
		Scenario:      sc.Name,
		LoadModel:     plugin.LoadModelClosed,
		StartTime:     start,
		EndTime:       end,
		Steady:        steady,
		Overall:       overall,
		DroppedEvents: bus.Dropped(),
	}
	summary.Thresholds, summary.ThresholdPassed = EvaluateThresholds(sc.Thresholds, steady)

	// OnRunEnd is synchronous: reports are flushed before the process exits.
	var endErr error
	for _, p := range e.plugins {
		if err := p.OnRunEnd(ctx, runCtx, summary); err != nil && endErr == nil {
			endErr = fmt.Errorf("plugin %s OnRunEnd: %w", p.Name(), err)
		}
	}
	return summary, endErr
}

// runUser is the virtual-user loop: execute all steps, sleep think_time,
// repeat until the run deadline.
func (e *Engine) runUser(ctx context.Context, exec *httpexec.Executor, collector *metrics.Collector, bus *eventbus.Bus, steadyStart time.Time) {
	for {
		for i := range e.sc.Steps {
			if ctx.Err() != nil {
				return
			}
			res := exec.Do(ctx, &e.sc.Steps[i])
			// Requests cancelled by the run deadline are scheduling
			// artifacts, not service errors — discard them.
			if ctx.Err() != nil && res.NetworkError != "" {
				return
			}
			res.InSteady = !res.Timestamp.Before(steadyStart)
			collector.Record(res) // in-memory, never dropped
			bus.Publish(res)      // non-blocking, may be dropped + counted
		}
		if e.sc.ThinkTime > 0 {
			select {
			case <-time.After(e.sc.ThinkTime.D()):
			case <-ctx.Done():
				return
			}
		}
	}
}
