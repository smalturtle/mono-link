GO      ?= go
BINDIR  := bin

.PHONY: build test cover vet run-testserver clean

build:
	$(GO) build -o $(BINDIR)/pulsebench ./cmd/pulsebench
	$(GO) build -o $(BINDIR)/testserver ./cmd/testserver

test:
	$(GO) test -race ./...

# Coverage for the three pure-logic modules (target: > 80%, DESIGN §4).
cover:
	$(GO) test -cover -coverprofile=coverage.out \
		./internal/scenario/ ./internal/metrics/ ./internal/engine/
	$(GO) tool cover -func=coverage.out | tail -1

vet:
	$(GO) vet ./...

run-testserver:
	$(GO) run ./cmd/testserver

clean:
	rm -rf $(BINDIR) coverage.out reports logs
