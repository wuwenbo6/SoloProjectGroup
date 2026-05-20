package share

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"snippets/pkg/models"
	"time"
)

type SharedSnippet struct {
	ShareID    string    `json:"share_id"`
	SnippetID  int       `json:"snippet_id"`
	Title      string    `json:"title"`
	Code       string    `json:"code"`
	Language   string    `json:"language"`
	ExpiresAt  time.Time `json:"expires_at"`
	CreatedAt  time.Time `json:"created_at"`
	ViewCount  int       `json:"view_count"`
}

type ShareManager struct {
	shareDir string
}

func NewShareManager() (*ShareManager, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}
	shareDir := filepath.Join(homeDir, ".snippets", "shares")
	if err := os.MkdirAll(shareDir, 0755); err != nil {
		return nil, err
	}
	return &ShareManager{shareDir: shareDir}, nil
}

func generateShareID() string {
	b := make([]byte, 12)
	rand.Read(b)
	return base64.URLEncoding.EncodeToString(b)[:12]
}

func (sm *ShareManager) CreateShare(snippet *models.Snippet, expiresIn time.Duration) (*SharedSnippet, error) {
	shareID := generateShareID()

	var expiresAt time.Time
	if expiresIn > 0 {
		expiresAt = time.Now().Add(expiresIn)
	} else {
		expiresAt = time.Now().AddDate(1, 0, 0)
	}

	shared := &SharedSnippet{
		ShareID:   shareID,
		SnippetID: snippet.ID,
		Title:     snippet.Title,
		Code:      snippet.Code,
		Language:  snippet.Language,
		ExpiresAt: expiresAt,
		CreatedAt: time.Now(),
		ViewCount: 0,
	}

	filePath := filepath.Join(sm.shareDir, shareID+".json")
	data, err := json.MarshalIndent(shared, "", "  ")
	if err != nil {
		return nil, err
	}

	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return nil, err
	}

	return shared, nil
}

func (sm *ShareManager) GetShare(shareID string) (*SharedSnippet, error) {
	filePath := filepath.Join(sm.shareDir, shareID+".json")
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("share not found")
	}

	var shared SharedSnippet
	if err := json.Unmarshal(data, &shared); err != nil {
		return nil, err
	}

	if time.Now().After(shared.ExpiresAt) {
		os.Remove(filePath)
		return nil, fmt.Errorf("share has expired")
	}

	shared.ViewCount++
	data, _ = json.MarshalIndent(shared, "", "  ")
	os.WriteFile(filePath, data, 0644)

	return &shared, nil
}

func (sm *ShareManager) RevokeShare(shareID string) error {
	filePath := filepath.Join(sm.shareDir, shareID+".json")
	return os.Remove(filePath)
}

func (sm *ShareManager) ListShares(snippetID int) ([]*SharedSnippet, error) {
	files, err := filepath.Glob(filepath.Join(sm.shareDir, "*.json"))
	if err != nil {
		return nil, err
	}

	var shares []*SharedSnippet
	for _, file := range files {
		data, err := os.ReadFile(file)
		if err != nil {
			continue
		}

		var shared SharedSnippet
		if err := json.Unmarshal(data, &shared); err != nil {
			continue
		}

		if snippetID == 0 || shared.SnippetID == snippetID {
			shares = append(shares, &shared)
		}
	}

	return shares, nil
}

func (sm *ShareManager) CleanupExpired() int {
	count := 0
	files, _ := filepath.Glob(filepath.Join(sm.shareDir, "*.json"))
	for _, file := range files {
		data, err := os.ReadFile(file)
		if err != nil {
			continue
		}

		var shared SharedSnippet
		if err := json.Unmarshal(data, &shared); err != nil {
			continue
		}

		if time.Now().After(shared.ExpiresAt) {
			os.Remove(file)
			count++
		}
	}
	return count
}

func GenerateShareLink(shareID string) string {
	return fmt.Sprintf("snippet://share/%s", shareID)
}

func ExportToGist(snippet *models.Snippet, githubToken string) (string, error) {
	return "", fmt.Errorf("gist export requires GitHub API integration")
}
