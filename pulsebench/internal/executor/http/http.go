// Package http implements the HTTP protocol executor.
//
// It executes a single scenario step against the target, applies per-request
// timeouts and assertions, and returns a plugin.RequestResult. It performs no
// aggregation — that is the metrics collector's job.
package http

import (
	"context"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/pulsebench/pulsebench/internal/scenario"
	"github.com/pulsebench/pulsebench/pkg/plugin"
)

// Executor issues HTTP requests over a connection pool sized for the
// configured number of virtual users.
type Executor struct {
	client  *http.Client
	baseURL string
}

// New builds an executor whose Transport is tuned for `users` concurrent
// connections. The stdlib default MaxIdleConnsPerHost of 2 would make high
// concurrency degrade into connection churn / queueing (DESIGN §5.2).
func New(baseURL string, users int) *Executor {
	if users < 1 {
		users = 1
	}
	transport := &http.Transport{
		MaxIdleConns:        users * 2,
		MaxIdleConnsPerHost: users,
		MaxConnsPerHost:     0, // unlimited; concurrency is bounded by VUs
		IdleConnTimeout:     90 * time.Second,
		ForceAttemptHTTP2:   true,
	}
	return &Executor{
		client: &http.Client{
			Transport: transport,
			// Per-request timeouts are enforced via context; no global
			// client timeout so step-level overrides work.
		},
		baseURL: strings.TrimRight(baseURL, "/"),
	}
}

// PoolConfig describes the transport tuning, for the pre-run self-check.
func (e *Executor) PoolConfig() (maxIdle, maxIdlePerHost int) {
	t := e.client.Transport.(*http.Transport)
	return t.MaxIdleConns, t.MaxIdleConnsPerHost
}

// Do executes one step and returns the classified result. It never returns
// an error: every failure mode is encoded in the RequestResult so the load
// loop keeps running.
func (e *Executor) Do(ctx context.Context, step *scenario.Step) *plugin.RequestResult {
	url := e.baseURL + "/" + strings.TrimLeft(step.Request.URL, "/")
	res := &plugin.RequestResult{
		StepName:  step.Name,
		Method:    step.Request.Method,
		URL:       url,
		Timestamp: time.Now(),
	}

	reqCtx, cancel := context.WithTimeout(ctx, step.Request.Timeout.D())
	defer cancel()

	var body io.Reader
	if step.Request.Body != "" {
		body = strings.NewReader(step.Request.Body)
	}
	req, err := http.NewRequestWithContext(reqCtx, step.Request.Method, url, body)
	if err != nil {
		res.NetworkError = err.Error()
		return res
	}
	for k, v := range step.Request.Headers {
		req.Header.Set(k, v)
	}

	start := time.Now()
	resp, err := e.client.Do(req)
	if err != nil {
		res.Latency = time.Since(start)
		res.NetworkError = err.Error()
		return res
	}
	// Drain and close the body so the connection returns to the pool.
	_, readErr := io.Copy(io.Discard, resp.Body)
	resp.Body.Close()
	res.Latency = time.Since(start)
	res.StatusCode = resp.StatusCode
	if readErr != nil {
		res.NetworkError = "read body: " + readErr.Error()
		return res
	}

	// Status assertion: explicit expected code, or generic >=400 check.
	if step.Assert.Status > 0 {
		res.StatusFailed = resp.StatusCode != step.Assert.Status
	} else {
		res.StatusFailed = resp.StatusCode >= 400
	}
	// Latency assertion — "slow, not wrong" (DESIGN §7.3).
	if step.Assert.MaxLatency > 0 && res.Latency > step.Assert.MaxLatency.D() {
		res.AssertFailed = true
	}
	return res
}
