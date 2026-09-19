package metrics

import (
	"fmt"
	"math"
	"sync"
	"testing"
	"time"

	"github.com/pulsebench/pulsebench/pkg/plugin"
)

func result(latency time.Duration, steady bool) *plugin.RequestResult {
	return &plugin.RequestResult{Latency: latency, InSteady: steady, StatusCode: 200}
}

func TestEmptyCollector(t *testing.T) {
	c := NewCollector()
	overall, steady := c.Snapshot(10, 5)
	if overall.Requests != 0 || steady.Requests != 0 {
		t.Errorf("requests = %d/%d", overall.Requests, steady.Requests)
	}
	if overall.RPS != 0 || overall.ErrorRate != 0 {
		t.Errorf("rps=%v errRate=%v", overall.RPS, overall.ErrorRate)
	}
	if overall.LatencyP95 != 0 {
		t.Errorf("p95 = %v", overall.LatencyP95)
	}
}

func TestWindowSeparation(t *testing.T) {
	c := NewCollector()
	// 3 ramp-up requests at 100ms, 7 steady requests at 10ms.
	for i := 0; i < 3; i++ {
		c.Record(result(100*time.Millisecond, false))
	}
	for i := 0; i < 7; i++ {
		c.Record(result(10*time.Millisecond, true))
	}
	overall, steady := c.Snapshot(10, 7)

	if overall.Requests != 10 {
		t.Errorf("overall requests = %d", overall.Requests)
	}
	if steady.Requests != 7 {
		t.Errorf("steady requests = %d", steady.Requests)
	}
	if overall.RPS != 1.0 {
		t.Errorf("overall RPS = %v", overall.RPS)
	}
	if steady.RPS != 1.0 {
		t.Errorf("steady RPS = %v", steady.RPS)
	}
	// Steady max must not see the slow ramp-up samples.
	if steady.LatencyMax > 15*time.Millisecond {
		t.Errorf("steady max = %v, ramp-up leaked into steady window", steady.LatencyMax)
	}
	if overall.LatencyMax < 90*time.Millisecond {
		t.Errorf("overall max = %v", overall.LatencyMax)
	}
}

func TestErrorClassification(t *testing.T) {
	c := NewCollector()
	// 4 OK, 2 network errors, 2 status failures, 2 latency-assert failures.
	for i := 0; i < 4; i++ {
		c.Record(result(time.Millisecond, true))
	}
	for i := 0; i < 2; i++ {
		c.Record(&plugin.RequestResult{Latency: 5 * time.Second, InSteady: true, NetworkError: "timeout"})
	}
	for i := 0; i < 2; i++ {
		c.Record(&plugin.RequestResult{Latency: time.Millisecond, InSteady: true, StatusCode: 500, StatusFailed: true})
	}
	for i := 0; i < 2; i++ {
		c.Record(&plugin.RequestResult{Latency: time.Second, InSteady: true, StatusCode: 200, AssertFailed: true})
	}
	_, steady := c.Snapshot(10, 10)

	if steady.Requests != 10 {
		t.Fatalf("requests = %d", steady.Requests)
	}
	if steady.NetworkErrors != 2 || steady.StatusFailures != 2 || steady.AssertFailures != 2 {
		t.Errorf("counts = net %d, status %d, assert %d",
			steady.NetworkErrors, steady.StatusFailures, steady.AssertFailures)
	}
	// error_rate excludes latency assertion failures (DESIGN §7.3).
	if want := 0.4; math.Abs(steady.ErrorRate-want) > 1e-9 {
		t.Errorf("error rate = %v, want %v", steady.ErrorRate, want)
	}
}

func TestPercentiles(t *testing.T) {
	c := NewCollector()
	// Latencies 1..100 ms.
	for i := 1; i <= 100; i++ {
		c.Record(result(time.Duration(i)*time.Millisecond, true))
	}
	_, steady := c.Snapshot(100, 100)

	approx := func(name string, got time.Duration, want time.Duration) {
		// HDR at 3 significant figures: allow 1% relative error.
		if math.Abs(float64(got-want)) > float64(want)*0.01 {
			t.Errorf("%s = %v, want ~%v", name, got, want)
		}
	}
	approx("p50", steady.LatencyP50, 50*time.Millisecond)
	approx("p95", steady.LatencyP95, 95*time.Millisecond)
	approx("p99", steady.LatencyP99, 99*time.Millisecond)
	approx("min", steady.LatencyMin, 1*time.Millisecond)
	approx("max", steady.LatencyMax, 100*time.Millisecond)
	approx("mean", steady.LatencyMean, 50500*time.Microsecond)
}

func TestLatencyAboveHistogramMaxIsClamped(t *testing.T) {
	c := NewCollector()
	c.Record(result(time.Hour, true)) // beyond the 10min histogram bound
	_, steady := c.Snapshot(1, 1)
	if steady.Requests != 1 {
		t.Fatalf("requests = %d", steady.Requests)
	}
	if steady.LatencyMax > 11*time.Minute {
		t.Errorf("max = %v, expected clamp to histogram bound", steady.LatencyMax)
	}
}

func TestZeroLatencyNotRecordedInHistogram(t *testing.T) {
	c := NewCollector()
	c.Record(&plugin.RequestResult{Latency: 0, InSteady: true, NetworkError: "dns"})
	_, steady := c.Snapshot(1, 1)
	if steady.Requests != 1 || steady.NetworkErrors != 1 {
		t.Fatalf("stats = %+v", steady)
	}
	if steady.LatencyMax != 0 {
		t.Errorf("max = %v", steady.LatencyMax)
	}
}

func TestConcurrentRecord(t *testing.T) {
	c := NewCollector()
	var wg sync.WaitGroup
	const goroutines, perG = 8, 1000
	for g := 0; g < goroutines; g++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := 0; i < perG; i++ {
				c.Record(result(time.Millisecond, true))
			}
		}()
	}
	wg.Wait()
	overall, steady := c.Snapshot(1, 1)
	if overall.Requests != goroutines*perG || steady.Requests != goroutines*perG {
		t.Errorf("requests = %d/%d", overall.Requests, steady.Requests)
	}
}

func ExampleCollector() {
	c := NewCollector()
	c.Record(&plugin.RequestResult{Latency: 20 * time.Millisecond, InSteady: true, StatusCode: 200})
	overall, _ := c.Snapshot(1, 1)
	fmt.Println(overall.Requests)
	// Output: 1
}
