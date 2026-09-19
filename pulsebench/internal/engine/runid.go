package engine

import (
	"crypto/rand"
	"encoding/hex"
	"time"
)

// NewRunID returns "YYYYMMDD-HHMMSS-<4 hex chars>" in UTC. The random suffix
// avoids collisions between parallel CI jobs (DESIGN §9).
func NewRunID(now time.Time) string {
	var b [2]byte
	_, _ = rand.Read(b[:])
	return now.UTC().Format("20060102-150405") + "-" + hex.EncodeToString(b[:])
}
