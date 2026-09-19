package http

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/pulsebench/pulsebench/internal/scenario"
)

func newStep(method, url string) *scenario.Step {
	return &scenario.Step{
		Name: "t",
		Request: scenario.Request{
			Method:  method,
			URL:     url,
			Timeout: scenario.Duration(2 * time.Second),
		},
	}
}

func TestSuccessfulGet(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		io.WriteString(w, "ok")
	}))
	defer srv.Close()

	e := New(srv.URL, 10)
	step := newStep("GET", "/api/items")
	step.Assert.Status = 200
	res := e.Do(context.Background(), step)

	if res.NetworkError != "" || res.StatusFailed || res.AssertFailed {
		t.Fatalf("unexpected failure: %+v", res)
	}
	if res.StatusCode != 200 || res.Latency <= 0 {
		t.Errorf("status=%d latency=%v", res.StatusCode, res.Latency)
	}
}

func TestStatusAssertionFailure(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(500)
	}))
	defer srv.Close()

	e := New(srv.URL, 1)
	step := newStep("GET", "/")
	step.Assert.Status = 200
	res := e.Do(context.Background(), step)
	if !res.StatusFailed || res.NetworkError != "" {
		t.Errorf("result = %+v", res)
	}
}

func TestImplicitStatusCheck(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(503)
	}))
	defer srv.Close()

	e := New(srv.URL, 1)
	res := e.Do(context.Background(), newStep("GET", "/")) // no assert.status
	if !res.StatusFailed {
		t.Errorf("5xx without explicit assert should be a status failure: %+v", res)
	}
}

func TestLatencyAssertion(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(50 * time.Millisecond)
		w.WriteHeader(200)
	}))
	defer srv.Close()

	e := New(srv.URL, 1)
	step := newStep("GET", "/")
	step.Assert.Status = 200
	step.Assert.MaxLatency = scenario.Duration(10 * time.Millisecond)
	res := e.Do(context.Background(), step)
	if !res.AssertFailed {
		t.Error("expected latency assertion failure")
	}
	// Slow-but-successful must NOT be an error (DESIGN §7.3).
	if res.IsError() {
		t.Errorf("latency failure must not count as error: %+v", res)
	}
}

func TestTimeoutIsNetworkError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(500 * time.Millisecond)
	}))
	defer srv.Close()

	e := New(srv.URL, 1)
	step := newStep("GET", "/")
	step.Request.Timeout = scenario.Duration(30 * time.Millisecond)
	res := e.Do(context.Background(), step)
	if res.NetworkError == "" {
		t.Fatalf("expected network error, got %+v", res)
	}
}

func TestConnectionRefused(t *testing.T) {
	e := New("http://127.0.0.1:1", 1) // nothing listens on port 1
	res := e.Do(context.Background(), newStep("GET", "/"))
	if res.NetworkError == "" {
		t.Fatalf("expected network error, got %+v", res)
	}
}

func TestPostBodyAndHeaders(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		if r.Method != "POST" || string(body) != `{"a":1}` || r.Header.Get("X-Token") != "t1" {
			w.WriteHeader(400)
			return
		}
		w.WriteHeader(201)
	}))
	defer srv.Close()

	e := New(srv.URL, 1)
	step := newStep("POST", "/create")
	step.Request.Body = `{"a":1}`
	step.Request.Headers = map[string]string{"X-Token": "t1"}
	step.Assert.Status = 201
	res := e.Do(context.Background(), step)
	if res.StatusFailed || res.NetworkError != "" {
		t.Errorf("result = %+v", res)
	}
}

func TestPoolConfigScalesWithUsers(t *testing.T) {
	e := New("http://x", 128)
	maxIdle, perHost := e.PoolConfig()
	if perHost != 128 || maxIdle != 256 {
		t.Errorf("pool = %d/%d", maxIdle, perHost)
	}
}
