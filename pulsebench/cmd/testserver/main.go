// Command testserver is the local target server used for acceptance runs and
// the quickstart (DESIGN §13: no dependency on httpbin).
//
//	go run ./cmd/testserver          # listens on :8080
//	go run ./cmd/testserver -addr :9090
//
// Endpoints:
//
//	GET  /ping          → 200 "pong"
//	GET  /api/items     → 200 JSON list, ~2-8ms simulated work
//	POST /api/items     → 201 echo
//	GET  /slow          → 200 after 300ms (for max_latency demos)
//	GET  /flaky         → 500 for ~10% of requests (for error_rate demos)
package main

import (
	"encoding/json"
	"flag"
	"io"
	"log"
	"math/rand/v2"
	"net/http"
	"time"
)

func main() {
	addr := flag.String("addr", ":8080", "listen address")
	flag.Parse()

	mux := http.NewServeMux()
	mux.HandleFunc("GET /ping", func(w http.ResponseWriter, r *http.Request) {
		io.WriteString(w, "pong")
	})
	mux.HandleFunc("GET /api/items", func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(time.Duration(2+rand.IntN(6)) * time.Millisecond)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"items": []string{"alpha", "beta", "gamma"},
		})
	})
	mux.HandleFunc("POST /api/items", func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		w.Write(body)
	})
	mux.HandleFunc("GET /slow", func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(300 * time.Millisecond)
		io.WriteString(w, "slow ok")
	})
	mux.HandleFunc("GET /flaky", func(w http.ResponseWriter, r *http.Request) {
		if rand.IntN(10) == 0 {
			http.Error(w, "boom", http.StatusInternalServerError)
			return
		}
		io.WriteString(w, "ok")
	})

	log.Printf("testserver listening on %s", *addr)
	log.Fatal(http.ListenAndServe(*addr, mux))
}
