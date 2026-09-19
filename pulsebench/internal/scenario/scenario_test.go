package scenario

import (
	"strings"
	"testing"
	"time"
)

const validYAML = `
name: api-smoke
base_url: https://api.example

load:
  duration: 60s
  ramp_up: 10s
  users: 50

timeout:
  request: 5s

think_time: 200ms

plugins:
  console: {}
  json_report:
    out_dir: reports

steps:
  - name: list_items
    request:
      method: GET
      url: /api/items
      timeout: 2s
    assert:
      status: 200
      max_latency: 500ms

thresholds:
  p95_latency: 800ms
  error_rate: 0.01
`

func TestParseValid(t *testing.T) {
	sc, err := Parse([]byte(validYAML))
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	if sc.Name != "api-smoke" {
		t.Errorf("Name = %q", sc.Name)
	}
	if sc.BaseURL != "https://api.example" {
		t.Errorf("BaseURL = %q", sc.BaseURL)
	}
	if sc.Load.Duration.D() != 60*time.Second || sc.Load.RampUp.D() != 10*time.Second || sc.Load.Users != 50 {
		t.Errorf("Load = %+v", sc.Load)
	}
	if sc.Timeout.Request.D() != 5*time.Second {
		t.Errorf("Timeout.Request = %v", sc.Timeout.Request.D())
	}
	if sc.ThinkTime.D() != 200*time.Millisecond {
		t.Errorf("ThinkTime = %v", sc.ThinkTime.D())
	}
	if !sc.PluginsSet {
		t.Error("PluginsSet should be true")
	}
	if _, ok := sc.Plugins["console"]; !ok {
		t.Error("console plugin missing")
	}
	if sc.Plugins["json_report"]["out_dir"] != "reports" {
		t.Errorf("json_report config = %v", sc.Plugins["json_report"])
	}
	if len(sc.Steps) != 1 {
		t.Fatalf("Steps len = %d", len(sc.Steps))
	}
	st := sc.Steps[0]
	if st.Request.Method != "GET" || st.Request.URL != "/api/items" {
		t.Errorf("Step request = %+v", st.Request)
	}
	if st.Request.Timeout.D() != 2*time.Second {
		t.Errorf("step timeout = %v", st.Request.Timeout.D())
	}
	if st.Assert.Status != 200 || st.Assert.MaxLatency.D() != 500*time.Millisecond {
		t.Errorf("Step assert = %+v", st.Assert)
	}
	if sc.Thresholds == nil || sc.Thresholds.P95Latency.D() != 800*time.Millisecond {
		t.Fatalf("Thresholds = %+v", sc.Thresholds)
	}
	if sc.Thresholds.ErrorRate == nil || *sc.Thresholds.ErrorRate != 0.01 {
		t.Errorf("ErrorRate = %v", sc.Thresholds.ErrorRate)
	}
}

func TestDefaults(t *testing.T) {
	sc, err := Parse([]byte(`
name: minimal
base_url: http://localhost:8080
load:
  duration: 10s
  users: 5
steps:
  - name: ping
    request:
      method: get
      url: /ping
`))
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	if sc.Timeout.Request.D() != DefaultRequestTimeout {
		t.Errorf("default timeout = %v", sc.Timeout.Request.D())
	}
	if sc.EventBuffer != DefaultEventBuffer {
		t.Errorf("default event buffer = %d", sc.EventBuffer)
	}
	if sc.PluginsSet {
		t.Error("PluginsSet should be false when omitted")
	}
	// Method is upper-cased; step timeout inherits run-level timeout.
	if sc.Steps[0].Request.Method != "GET" {
		t.Errorf("method = %q", sc.Steps[0].Request.Method)
	}
	if sc.Steps[0].Request.Timeout.D() != DefaultRequestTimeout {
		t.Errorf("inherited step timeout = %v", sc.Steps[0].Request.Timeout.D())
	}
	if sc.Load.RampUp != 0 {
		t.Errorf("ramp_up default = %v", sc.Load.RampUp.D())
	}
	if sc.Thresholds != nil {
		t.Error("thresholds should be nil")
	}
}

func TestEmptyPluginsSection(t *testing.T) {
	sc, err := Parse([]byte(`
name: no-plugins
base_url: http://localhost:8080
load:
  duration: 10s
  users: 5
plugins: {}
steps:
  - name: ping
    request: {method: GET, url: /ping}
`))
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	if !sc.PluginsSet {
		t.Error("PluginsSet should be true for explicit empty plugins")
	}
	if len(sc.Plugins) != 0 {
		t.Errorf("Plugins = %v", sc.Plugins)
	}
}

func TestValidationErrors(t *testing.T) {
	cases := []struct {
		name string
		yaml string
		want string
	}{
		{"missing name", `
base_url: http://x
load: {duration: 10s, users: 1}
steps: [{name: a, request: {method: GET, url: /}}]
`, "name is required"},
		{"missing base_url", `
name: x
load: {duration: 10s, users: 1}
steps: [{name: a, request: {method: GET, url: /}}]
`, "base_url is required"},
		{"bad scheme", `
name: x
base_url: ftp://x
load: {duration: 10s, users: 1}
steps: [{name: a, request: {method: GET, url: /}}]
`, "base_url must start with"},
		{"no duration", `
name: x
base_url: http://x
load: {users: 1}
steps: [{name: a, request: {method: GET, url: /}}]
`, "load.duration must be > 0"},
		{"no users", `
name: x
base_url: http://x
load: {duration: 10s}
steps: [{name: a, request: {method: GET, url: /}}]
`, "load.users must be > 0"},
		{"ramp_up >= duration", `
name: x
base_url: http://x
load: {duration: 10s, ramp_up: 10s, users: 1}
steps: [{name: a, request: {method: GET, url: /}}]
`, "ramp_up must be shorter"},
		{"no steps", `
name: x
base_url: http://x
load: {duration: 10s, users: 1}
steps: []
`, "at least one step"},
		{"step without name", `
name: x
base_url: http://x
load: {duration: 10s, users: 1}
steps: [{request: {method: GET, url: /}}]
`, "name is required"},
		{"bad method", `
name: x
base_url: http://x
load: {duration: 10s, users: 1}
steps: [{name: a, request: {method: TRACE_ME, url: /}}]
`, "unsupported method"},
		{"missing url", `
name: x
base_url: http://x
load: {duration: 10s, users: 1}
steps: [{name: a, request: {method: GET}}]
`, "request.url is required"},
		{"bad error_rate", `
name: x
base_url: http://x
load: {duration: 10s, users: 1}
steps: [{name: a, request: {method: GET, url: /}}]
thresholds: {error_rate: 1.5}
`, "error_rate must be within"},
		{"bad assert status", `
name: x
base_url: http://x
load: {duration: 10s, users: 1}
steps: [{name: a, request: {method: GET, url: /}, assert: {status: 999}}]
`, "assert.status must be"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := Parse([]byte(tc.yaml))
			if err == nil {
				t.Fatal("expected error, got nil")
			}
			if !strings.Contains(err.Error(), tc.want) {
				t.Errorf("error %q does not contain %q", err, tc.want)
			}
		})
	}
}

func TestBadYAMLSyntax(t *testing.T) {
	if _, err := Parse([]byte("::: not yaml")); err == nil {
		t.Fatal("expected parse error")
	}
	if _, err := Parse([]byte("name: x\nload:\n  duration: banana\n")); err == nil ||
		!strings.Contains(err.Error(), "invalid duration") {
		t.Fatalf("expected duration error, got %v", err)
	}
	// Unknown fields are rejected to catch typos early.
	if _, err := Parse([]byte(`
name: x
base_url: http://x
laod: {duration: 10s, users: 1}
steps: [{name: a, request: {method: GET, url: /}}]
`)); err == nil {
		t.Fatal("expected unknown-field error for typo'd key")
	}
}

func TestLoadFile(t *testing.T) {
	if _, err := LoadFile("does-not-exist.yaml"); err == nil {
		t.Fatal("expected error for missing file")
	}
}
