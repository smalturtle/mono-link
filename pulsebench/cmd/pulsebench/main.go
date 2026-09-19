// Command pulsebench is the CLI entry point.
//
// Exit codes: 0 success, 1 scenario/run error, 2 threshold failure.
package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/spf13/cobra"

	"github.com/pulsebench/pulsebench/internal/engine"
	"github.com/pulsebench/pulsebench/internal/plugins/console"
	"github.com/pulsebench/pulsebench/internal/plugins/jsonreport"
	"github.com/pulsebench/pulsebench/internal/plugins/logger"
	"github.com/pulsebench/pulsebench/internal/scenario"
	"github.com/pulsebench/pulsebench/pkg/plugin"
)

var version = "0.1.0-dev"

const (
	exitOK        = 0
	exitRunError  = 1
	exitThreshold = 2
)

func main() {
	os.Exit(run())
}

func run() int {
	var (
		outDir   string
		logDir   string
		noReport bool
	)

	root := &cobra.Command{
		Use:           "pulsebench",
		Short:         "PulseBench — plugin-first, YAML-driven HTTP load testing",
		SilenceUsage:  true,
		SilenceErrors: true,
	}

	exitCode := exitOK

	runCmd := &cobra.Command{
		Use:   "run <scenario.yaml>",
		Short: "Run a load test scenario",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			sc, err := scenario.LoadFile(args[0])
			if err != nil {
				return err
			}

			plugins, err := buildPlugins(sc, outDir, logDir, noReport)
			if err != nil {
				return err
			}

			ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
			defer stop()

			summary, err := engine.New(sc, plugins).Run(ctx)
			if err != nil {
				return err
			}
			if !summary.ThresholdPassed {
				fmt.Fprintln(os.Stderr, "\nthreshold check FAILED (steady-state window)")
				exitCode = exitThreshold
			}
			return nil
		},
	}
	runCmd.Flags().StringVar(&outDir, "out", "", "override JSON report output directory")
	runCmd.Flags().StringVar(&logDir, "log-dir", "", "override JSONL log directory")
	runCmd.Flags().BoolVar(&noReport, "no-report", false, "disable the JSON report plugin")

	versionCmd := &cobra.Command{
		Use:   "version",
		Short: "Print version",
		Run: func(cmd *cobra.Command, args []string) {
			fmt.Printf("pulsebench %s\n", version)
		},
	}

	root.AddCommand(runCmd, versionCmd)

	if err := root.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		return exitRunError
	}
	return exitCode
}

// buildPlugins assembles built-in plugins from the scenario `plugins:`
// section, then applies CLI overrides. When the section is omitted, all
// default built-ins are enabled.
func buildPlugins(sc *scenario.Scenario, outDir, logDir string, noReport bool) ([]plugin.Plugin, error) {
	builtins := map[string]func() plugin.Plugin{
		"console":     func() plugin.Plugin { return console.New() },
		"json_report": func() plugin.Plugin { return jsonreport.New() },
		"logger":      func() plugin.Plugin { return logger.New() },
	}

	enabled := map[string]map[string]any{}
	if sc.PluginsSet {
		for name, cfg := range sc.Plugins {
			enabled[name] = cfg
		}
	} else {
		for name := range builtins {
			enabled[name] = nil
		}
	}
	if noReport {
		delete(enabled, "json_report")
	}

	// Deterministic order: console, json_report, logger.
	var plugins []plugin.Plugin
	for _, name := range []string{"console", "json_report", "logger"} {
		cfg, ok := enabled[name]
		if !ok {
			continue
		}
		delete(enabled, name)
		p := builtins[name]()
		if err := p.Init(cfg); err != nil {
			return nil, err
		}
		switch v := p.(type) {
		case *jsonreport.Plugin:
			if outDir != "" {
				v.SetOutDir(outDir)
			}
		case *logger.Plugin:
			if logDir != "" {
				v.SetLogDir(logDir)
			}
		}
		plugins = append(plugins, p)
	}
	for name := range enabled {
		return nil, fmt.Errorf("unknown plugin %q (built-ins: console, json_report, logger)", name)
	}
	return plugins, nil
}
