// Package jsonreport writes the run summary as reports/{run_id}.json for CI
// archiving and automated comparison.
package jsonreport

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/pulsebench/pulsebench/pkg/plugin"
)

// Plugin writes one JSON report per run in OnRunEnd (synchronous, so the
// file is guaranteed to exist before the process exits).
type Plugin struct {
	outDir string
	// Path of the report written by the last run (informational).
	Path string
}

// New creates the JSON report plugin with the default output directory.
func New() *Plugin { return &Plugin{outDir: "reports"} }

func (p *Plugin) Name() string { return "json_report" }

// Init accepts an optional "out_dir" string.
func (p *Plugin) Init(config map[string]any) error {
	if v, ok := config["out_dir"]; ok {
		s, ok := v.(string)
		if !ok || s == "" {
			return fmt.Errorf("json_report: out_dir must be a non-empty string")
		}
		p.outDir = s
	}
	return nil
}

// SetOutDir overrides the output directory (used by the --out CLI flag).
func (p *Plugin) SetOutDir(dir string) { p.outDir = dir }

func (p *Plugin) OnRunStart(context.Context, *plugin.RunContext) error {
	return os.MkdirAll(p.outDir, 0o755)
}

func (p *Plugin) OnRequest(context.Context, *plugin.RunContext, *plugin.RequestResult) {}

func (p *Plugin) OnRunEnd(_ context.Context, run *plugin.RunContext, s *plugin.Summary) error {
	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return fmt.Errorf("json_report: marshal: %w", err)
	}
	p.Path = filepath.Join(p.outDir, run.RunID+".json")
	if err := os.WriteFile(p.Path, data, 0o644); err != nil {
		return fmt.Errorf("json_report: write: %w", err)
	}
	fmt.Fprintf(os.Stderr, "\n  report: %s\n", p.Path)
	return nil
}
