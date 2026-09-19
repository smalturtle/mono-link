// Package logger writes one slog JSON line per request to
// logs/{run_id}.jsonl — suitable for slow-request digging and shipping to
// ELK/Loki. Lines are delivered through the event bus and may be dropped
// under backpressure (the drop count appears in the report).
package logger

import (
	"bufio"
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"

	"github.com/pulsebench/pulsebench/pkg/plugin"
)

// Plugin streams per-request JSONL to a file.
type Plugin struct {
	logDir string
	file   *os.File
	buf    *bufio.Writer
	log    *slog.Logger
	// Path of the log written by the last run (informational).
	Path string
}

// New creates the logger plugin with the default log directory.
func New() *Plugin { return &Plugin{logDir: "logs"} }

func (p *Plugin) Name() string { return "logger" }

// Init accepts an optional "log_dir" string.
func (p *Plugin) Init(config map[string]any) error {
	if v, ok := config["log_dir"]; ok {
		s, ok := v.(string)
		if !ok || s == "" {
			return fmt.Errorf("logger: log_dir must be a non-empty string")
		}
		p.logDir = s
	}
	return nil
}

// SetLogDir overrides the log directory (used by the --log-dir CLI flag).
func (p *Plugin) SetLogDir(dir string) { p.logDir = dir }

func (p *Plugin) OnRunStart(_ context.Context, run *plugin.RunContext) error {
	if err := os.MkdirAll(p.logDir, 0o755); err != nil {
		return fmt.Errorf("logger: %w", err)
	}
	p.Path = filepath.Join(p.logDir, run.RunID+".jsonl")
	f, err := os.Create(p.Path)
	if err != nil {
		return fmt.Errorf("logger: %w", err)
	}
	p.file = f
	p.buf = bufio.NewWriterSize(f, 64*1024)
	p.log = slog.New(slog.NewJSONHandler(p.buf, nil))
	return nil
}

// OnRequest runs on the event bus dispatcher goroutine, never concurrently
// with itself, so the buffered writer needs no locking.
func (p *Plugin) OnRequest(_ context.Context, _ *plugin.RunContext, r *plugin.RequestResult) {
	if p.log == nil {
		return
	}
	attrs := []any{
		slog.String("step", r.StepName),
		slog.String("method", r.Method),
		slog.String("url", r.URL),
		slog.Int("status", r.StatusCode),
		slog.Duration("latency", r.Latency),
		slog.Bool("in_steady", r.InSteady),
	}
	switch {
	case r.NetworkError != "":
		attrs = append(attrs, slog.String("network_error", r.NetworkError))
		p.log.Error("request", attrs...)
	case r.StatusFailed:
		attrs = append(attrs, slog.Bool("status_failed", true))
		p.log.Error("request", attrs...)
	case r.AssertFailed:
		attrs = append(attrs, slog.Bool("assert_failed", true))
		p.log.Warn("request", attrs...)
	default:
		p.log.Info("request", attrs...)
	}
}

func (p *Plugin) OnRunEnd(context.Context, *plugin.RunContext, *plugin.Summary) error {
	if p.buf != nil {
		if err := p.buf.Flush(); err != nil {
			return fmt.Errorf("logger: flush: %w", err)
		}
	}
	if p.file != nil {
		if err := p.file.Close(); err != nil {
			return fmt.Errorf("logger: close: %w", err)
		}
		fmt.Fprintf(os.Stderr, "  log:    %s\n", p.Path)
	}
	return nil
}
