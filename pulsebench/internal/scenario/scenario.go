// Package scenario parses and validates PulseBench YAML scenario files.
// It is pure logic: it never issues HTTP requests.
package scenario

import (
	"fmt"
	"os"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

// DefaultRequestTimeout applies when `timeout.request` is omitted.
const DefaultRequestTimeout = 10 * time.Second

// DefaultEventBuffer is the event bus channel capacity when
// `event_buffer` is omitted.
const DefaultEventBuffer = 4096

var allowedMethods = map[string]bool{
	"GET": true, "POST": true, "PUT": true, "PATCH": true,
	"DELETE": true, "HEAD": true, "OPTIONS": true,
}

// Duration wraps time.Duration with YAML unmarshalling from strings
// like "500ms", "5s", "1m".
type Duration time.Duration

// D returns the underlying time.Duration.
func (d Duration) D() time.Duration { return time.Duration(d) }

// UnmarshalYAML implements yaml.Unmarshaler.
func (d *Duration) UnmarshalYAML(node *yaml.Node) error {
	var s string
	if err := node.Decode(&s); err != nil {
		return fmt.Errorf("duration must be a string like \"500ms\" or \"5s\": %w", err)
	}
	parsed, err := time.ParseDuration(s)
	if err != nil {
		return fmt.Errorf("invalid duration %q: %w", s, err)
	}
	*d = Duration(parsed)
	return nil
}

// Load describes the closed-model load profile.
type Load struct {
	Duration Duration `yaml:"duration"`
	RampUp   Duration `yaml:"ramp_up"`
	Users    int      `yaml:"users"`
}

// Timeout holds run-level timeout settings.
type Timeout struct {
	Request Duration `yaml:"request"`
}

// Request describes the HTTP request of a step.
type Request struct {
	Method  string            `yaml:"method"`
	URL     string            `yaml:"url"`
	Headers map[string]string `yaml:"headers"`
	Body    string            `yaml:"body"`
	// Timeout overrides the run-level request timeout when > 0.
	Timeout Duration `yaml:"timeout"`
}

// Assert describes per-request assertions.
type Assert struct {
	// Status is the expected status code. 0 means "no explicit assertion";
	// in that case any status >= 400 counts as a status failure.
	Status int `yaml:"status"`
	// MaxLatency, when > 0, flags slower responses as assert_failures
	// (not errors, see DESIGN.md §7.3).
	MaxLatency Duration `yaml:"max_latency"`
}

// Step is one scripted request executed by every virtual user each round.
type Step struct {
	Name    string  `yaml:"name"`
	Request Request `yaml:"request"`
	Assert  Assert  `yaml:"assert"`
}

// Thresholds are CI gates, judged against the steady-state window only.
type Thresholds struct {
	// P95Latency: steady-state p95 must be <= this value. 0 = unset.
	P95Latency Duration `yaml:"p95_latency"`
	// ErrorRate: steady-state (network + status failures) / requests must be
	// <= this value. nil = unset.
	ErrorRate *float64 `yaml:"error_rate"`
}

// Scenario is the root of a parsed scenario file.
type Scenario struct {
	Name    string  `yaml:"name"`
	BaseURL string  `yaml:"base_url"`
	Load    Load    `yaml:"load"`
	Timeout Timeout `yaml:"timeout"`
	// ThinkTime is the pause between step rounds of one virtual user.
	ThinkTime Duration `yaml:"think_time"`
	// EventBuffer is the event bus channel capacity (default 4096).
	EventBuffer int `yaml:"event_buffer"`
	// Plugins maps plugin name to its config block. When the section is
	// omitted entirely, the engine enables the default built-ins
	// (console, json_report, logger).
	Plugins    map[string]map[string]any `yaml:"plugins"`
	Steps      []Step                    `yaml:"steps"`
	Thresholds *Thresholds               `yaml:"thresholds"`

	// PluginsSet records whether the `plugins:` key was present in YAML.
	PluginsSet bool `yaml:"-"`
}

// LoadFile reads, parses and validates a scenario YAML file.
func LoadFile(path string) (*Scenario, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read scenario: %w", err)
	}
	return Parse(data)
}

// Parse parses and validates scenario YAML content.
func Parse(data []byte) (*Scenario, error) {
	// Detect presence of the `plugins:` key to distinguish "omitted"
	// (enable defaults) from "empty" (enable none).
	var probe struct {
		Plugins *map[string]map[string]any `yaml:"plugins"`
	}
	if err := yaml.Unmarshal(data, &probe); err != nil {
		return nil, fmt.Errorf("parse scenario: %w", err)
	}

	var sc Scenario
	dec := yaml.NewDecoder(strings.NewReader(string(data)))
	dec.KnownFields(true)
	if err := dec.Decode(&sc); err != nil {
		return nil, fmt.Errorf("parse scenario: %w", err)
	}
	sc.PluginsSet = probe.Plugins != nil

	sc.applyDefaults()
	if err := sc.validate(); err != nil {
		return nil, err
	}
	return &sc, nil
}

func (s *Scenario) applyDefaults() {
	if s.Timeout.Request == 0 {
		s.Timeout.Request = Duration(DefaultRequestTimeout)
	}
	if s.EventBuffer == 0 {
		s.EventBuffer = DefaultEventBuffer
	}
	for i := range s.Steps {
		s.Steps[i].Request.Method = strings.ToUpper(strings.TrimSpace(s.Steps[i].Request.Method))
		if s.Steps[i].Request.Timeout == 0 {
			s.Steps[i].Request.Timeout = s.Timeout.Request
		}
	}
}

func (s *Scenario) validate() error {
	var errs []string
	add := func(format string, args ...any) {
		errs = append(errs, fmt.Sprintf(format, args...))
	}

	if strings.TrimSpace(s.Name) == "" {
		add("name is required")
	}
	if strings.TrimSpace(s.BaseURL) == "" {
		add("base_url is required")
	} else if !strings.HasPrefix(s.BaseURL, "http://") && !strings.HasPrefix(s.BaseURL, "https://") {
		add("base_url must start with http:// or https://")
	}

	if s.Load.Duration <= 0 {
		add("load.duration must be > 0")
	}
	if s.Load.Users <= 0 {
		add("load.users must be > 0")
	}
	if s.Load.RampUp < 0 {
		add("load.ramp_up must be >= 0")
	}
	if s.Load.Duration > 0 && s.Load.RampUp >= s.Load.Duration {
		add("load.ramp_up must be shorter than load.duration (no steady-state window otherwise)")
	}

	if s.Timeout.Request <= 0 {
		add("timeout.request must be > 0")
	}
	if s.ThinkTime < 0 {
		add("think_time must be >= 0")
	}
	if s.EventBuffer < 0 {
		add("event_buffer must be >= 0")
	}

	if len(s.Steps) == 0 {
		add("steps must contain at least one step")
	}
	for i, st := range s.Steps {
		label := st.Name
		if label == "" {
			label = fmt.Sprintf("#%d", i+1)
		}
		if strings.TrimSpace(st.Name) == "" {
			add("steps[%d]: name is required", i)
		}
		if !allowedMethods[st.Request.Method] {
			add("step %s: unsupported method %q", label, st.Request.Method)
		}
		if strings.TrimSpace(st.Request.URL) == "" {
			add("step %s: request.url is required", label)
		}
		if st.Request.Timeout < 0 {
			add("step %s: request.timeout must be >= 0", label)
		}
		if st.Assert.Status < 0 || st.Assert.Status > 599 {
			add("step %s: assert.status must be a valid HTTP status code", label)
		}
		if st.Assert.MaxLatency < 0 {
			add("step %s: assert.max_latency must be >= 0", label)
		}
	}

	if s.Thresholds != nil {
		if s.Thresholds.P95Latency < 0 {
			add("thresholds.p95_latency must be >= 0")
		}
		if s.Thresholds.ErrorRate != nil && (*s.Thresholds.ErrorRate < 0 || *s.Thresholds.ErrorRate > 1) {
			add("thresholds.error_rate must be within [0, 1]")
		}
	}

	if len(errs) > 0 {
		return fmt.Errorf("invalid scenario:\n  - %s", strings.Join(errs, "\n  - "))
	}
	return nil
}
