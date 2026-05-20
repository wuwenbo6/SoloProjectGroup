package flamegraph

import (
	"fmt"
	"os"
	"sort"
	"sync"
)

type Flamegraph struct {
	mu        sync.Mutex
	records   map[string][]float64
	protocols map[string]bool
}

func New() *Flamegraph {
	return &Flamegraph{
		records:   make(map[string][]float64),
		protocols: make(map[string]bool),
	}
}

func (f *Flamegraph) AddRecord(comm string, latencyMs float64, protocol string) {
	f.mu.Lock()
	defer f.mu.Unlock()

	if protocol != "" {
		f.protocols[protocol] = true
	}

	bucket := getLatencyBucket(latencyMs)
	key := fmt.Sprintf("%s;%s", comm, bucket)
	if protocol != "" {
		key = fmt.Sprintf("%s;%s;%s", protocol, comm, bucket)
	}
	f.records[key] = append(f.records[key], latencyMs)
}

func (f *Flamegraph) WriteFolded(filename string) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	file, err := os.Create(filename)
	if err != nil {
		return err
	}
	defer file.Close()

	var keys []string
	for key := range f.records {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	for _, key := range keys {
		latencies := f.records[key]
		count := len(latencies)
		if count > 0 {
			fmt.Fprintf(file, "%s %d\n", key, count)
		}
	}

	return nil
}

func getLatencyBucket(latencyMs float64) string {
	switch {
	case latencyMs < 1:
		return "<1ms"
	case latencyMs < 5:
		return "1-5ms"
	case latencyMs < 10:
		return "5-10ms"
	case latencyMs < 50:
		return "10-50ms"
	case latencyMs < 100:
		return "50-100ms"
	case latencyMs < 500:
		return "100-500ms"
	default:
		return ">500ms"
	}
}
