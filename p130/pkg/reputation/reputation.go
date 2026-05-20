package reputation

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"sync"
)

type NodeReputation struct {
	NodeID        string `json:"node_id"`
	Address       string `json:"address"`
	UploadBytes   int64  `json:"upload_bytes"`
	DownloadBytes int64  `json:"download_bytes"`
	FileCount     int    `json:"file_count"`
	SuccessCount  int    `json:"success_count"`
	FailCount     int    `json:"fail_count"`
}

type ReputationStore struct {
	mu       sync.RWMutex
	nodes    map[string]*NodeReputation
	dataPath string
}

func NewReputationStore(dataDir string) *ReputationStore {
	path := filepath.Join(dataDir, "reputation.json")
	rs := &ReputationStore{
		nodes:    make(map[string]*NodeReputation),
		dataPath: path,
	}
	rs.load()
	return rs
}

func (rs *ReputationStore) load() {
	data, err := os.ReadFile(rs.dataPath)
	if err != nil {
		return
	}
	json.Unmarshal(data, &rs.nodes)
}

func (rs *ReputationStore) save() error {
	rs.mu.RLock()
	defer rs.mu.RUnlock()
	data, err := json.MarshalIndent(rs.nodes, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(rs.dataPath, data, 0644)
}

func (rs *ReputationStore) RecordUpload(nodeID, address string, bytes int64) {
	rs.mu.Lock()
	defer rs.mu.Unlock()

	if _, exists := rs.nodes[nodeID]; !exists {
		rs.nodes[nodeID] = &NodeReputation{
			NodeID:  nodeID,
			Address: address,
		}
	}
	rs.nodes[nodeID].UploadBytes += bytes
	rs.nodes[nodeID].SuccessCount++
	rs.save()
}

func (rs *ReputationStore) RecordDownload(nodeID, address string, bytes int64) {
	rs.mu.Lock()
	defer rs.mu.Unlock()

	if _, exists := rs.nodes[nodeID]; !exists {
		rs.nodes[nodeID] = &NodeReputation{
			NodeID:  nodeID,
			Address: address,
		}
	}
	rs.nodes[nodeID].DownloadBytes += bytes
	rs.save()
}

func (rs *ReputationStore) RecordSuccess(nodeID string) {
	rs.mu.Lock()
	defer rs.mu.Unlock()

	if _, exists := rs.nodes[nodeID]; exists {
		rs.nodes[nodeID].SuccessCount++
		rs.save()
	}
}

func (rs *ReputationStore) RecordFailure(nodeID string) {
	rs.mu.Lock()
	defer rs.mu.Unlock()

	if _, exists := rs.nodes[nodeID]; exists {
		rs.nodes[nodeID].FailCount++
		rs.save()
	}
}

func (rs *ReputationStore) GetScore(nodeID string) float64 {
	rs.mu.RLock()
	defer rs.mu.RUnlock()

	node, exists := rs.nodes[nodeID]
	if !exists {
		return 0.5
	}

	uploadScore := min(float64(node.UploadBytes)/100000000, 1.0)
	successRate := 0.5
	if node.SuccessCount+node.FailCount > 0 {
		successRate = float64(node.SuccessCount) / float64(node.SuccessCount+node.FailCount)
	}

	return 0.6*uploadScore + 0.4*successRate
}

func (rs *ReputationStore) SortByPriority(nodes []string) []string {
	rs.mu.RLock()
	defer rs.mu.RUnlock()

	type nodeScore struct {
		addr  string
		score float64
	}

	var scored []nodeScore
	for _, addr := range nodes {
		score := 0.5
		for _, node := range rs.nodes {
			if node.Address == addr {
				score = rs.GetScore(node.NodeID)
				break
			}
		}
		scored = append(scored, nodeScore{addr, score})
	}

	sort.Slice(scored, func(i, j int) bool {
		return scored[i].score > scored[j].score
	})

	result := make([]string, len(scored))
	for i, s := range scored {
		result[i] = s.addr
	}
	return result
}

func (rs *ReputationStore) GetAllNodes() []*NodeReputation {
	rs.mu.RLock()
	defer rs.mu.RUnlock()

	result := make([]*NodeReputation, 0, len(rs.nodes))
	for _, node := range rs.nodes {
		result = append(result, node)
	}
	return result
}

func min(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}
