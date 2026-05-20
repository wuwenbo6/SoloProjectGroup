package manager

import (
	"fmt"
	"snippets/pkg/models"
	"snippets/pkg/runner"
	"snippets/pkg/storage"
	"strings"
	"time"
)

type Manager struct {
	store *storage.SQLiteStore
}

func NewManager() (*Manager, error) {
	store, err := storage.NewSQLiteStore()
	if err != nil {
		return nil, err
	}
	return &Manager{store: store}, nil
}

func (m *Manager) CreateSnippet(title, description, code, language, category string, tags []string) (int, error) {
	snippet := &models.Snippet{
		Title:       title,
		Description: description,
		Code:        code,
		Language:    language,
	}

	if category != "" {
		cat, err := m.store.GetCategoryByName(category)
		if err != nil {
			return 0, err
		}
		if cat == nil {
			catID, err := m.store.CreateCategory(category)
			if err != nil {
				return 0, err
			}
			snippet.CategoryID = &catID
		} else {
			snippet.CategoryID = &cat.ID
		}
	}

	id, err := m.store.CreateSnippet(snippet)
	if err != nil {
		return 0, err
	}

	for _, tagName := range tags {
		tagName = strings.TrimSpace(tagName)
		if tagName == "" {
			continue
		}
		tag, err := m.store.GetTagByName(tagName)
		if err != nil {
			continue
		}
		if tag == nil {
			tagID, err := m.store.CreateTag(tagName)
			if err != nil {
				continue
			}
			m.store.AddSnippetTag(id, tagID)
		} else {
			m.store.AddSnippetTag(id, tag.ID)
		}
	}

	return id, nil
}

func (m *Manager) CreateSnippetWithID(id int, title, description, code, language, category string, tags []string, createdAt, updatedAt time.Time) (int, error) {
	snippet := &models.Snippet{
		ID:          id,
		Title:       title,
		Description: description,
		Code:        code,
		Language:    language,
		CreatedAt:   createdAt,
		UpdatedAt:   updatedAt,
	}

	if category != "" {
		cat, err := m.store.GetCategoryByName(category)
		if err != nil {
			return 0, err
		}
		if cat == nil {
			catID, err := m.store.CreateCategory(category)
			if err != nil {
				return 0, err
			}
			snippet.CategoryID = &catID
		} else {
			snippet.CategoryID = &cat.ID
		}
	}

	newID, err := m.store.CreateSnippetWithID(snippet)
	if err != nil {
		return 0, err
	}

	for _, tagName := range tags {
		tagName = strings.TrimSpace(tagName)
		if tagName == "" {
			continue
		}
		tag, err := m.store.GetTagByName(tagName)
		if err != nil {
			continue
		}
		if tag == nil {
			tagID, err := m.store.CreateTag(tagName)
			if err != nil {
				continue
			}
			m.store.AddSnippetTag(newID, tagID)
		} else {
			m.store.AddSnippetTag(newID, tag.ID)
		}
	}

	return newID, nil
}

func (m *Manager) GetSnippet(id int) (*models.Snippet, error) {
	return m.store.GetSnippet(id)
}

func (m *Manager) CreateVersion(id int) error {
	snippet, err := m.store.GetSnippet(id)
	if err != nil {
		return err
	}
	if snippet == nil {
		return fmt.Errorf("snippet not found")
	}

	_, err = m.store.CreateVersion(id, snippet.Title, snippet.Description, snippet.Code, snippet.Language)
	return err
}

func (m *Manager) UpdateSnippet(id int, title, description, code, language, category string, tags []string) (*models.Snippet, error) {
	snippet, err := m.store.GetSnippet(id)
	if err != nil {
		return nil, err
	}
	if snippet == nil {
		return nil, nil
	}

	m.CreateVersion(id)

	if title != "" {
		snippet.Title = title
	}
	if description != "" {
		snippet.Description = description
	}
	if code != "" {
		snippet.Code = code
	}
	if language != "" {
		snippet.Language = language
	}

	if category != "" {
		cat, err := m.store.GetCategoryByName(category)
		if err != nil {
			return nil, err
		}
		if cat == nil {
			catID, err := m.store.CreateCategory(category)
			if err != nil {
				return nil, err
			}
			snippet.CategoryID = &catID
		} else {
			snippet.CategoryID = &cat.ID
		}
	}

	if err := m.store.UpdateSnippet(snippet); err != nil {
		return nil, err
	}

	if len(tags) > 0 {
		if err := m.store.RemoveSnippetTags(id); err != nil {
			return nil, err
		}
		for _, tagName := range tags {
			tagName = strings.TrimSpace(tagName)
			if tagName == "" {
				continue
			}
			tag, err := m.store.GetTagByName(tagName)
			if err != nil {
				continue
			}
			if tag == nil {
				tagID, err := m.store.CreateTag(tagName)
				if err != nil {
					continue
				}
				m.store.AddSnippetTag(id, tagID)
			} else {
				m.store.AddSnippetTag(id, tag.ID)
			}
		}
	}

	return m.store.GetSnippet(id)
}

func (m *Manager) DeleteSnippet(id int) error {
	return m.store.DeleteSnippet(id)
}

func (m *Manager) ListSnippets() ([]*models.Snippet, error) {
	return m.store.ListSnippets()
}

func (m *Manager) SearchSnippets(query, category, tag string) ([]*models.Snippet, error) {
	return m.store.SearchSnippets(query, category, tag)
}

func (m *Manager) ListCategories() ([]*models.Category, error) {
	return m.store.ListCategories()
}

func (m *Manager) ListVersions(snippetID int) ([]*models.Version, error) {
	return m.store.GetVersions(snippetID)
}

func (m *Manager) GetVersion(snippetID, version int) (*models.Version, error) {
	return m.store.GetVersion(snippetID, version)
}

func (m *Manager) RestoreVersion(snippetID, version int) error {
	return m.store.RestoreVersion(snippetID, version)
}

func (m *Manager) RunSnippet(id int) (string, error) {
	snippet, err := m.store.GetSnippet(id)
	if err != nil {
		return "", err
	}
	if snippet == nil {
		return "", fmt.Errorf("snippet not found")
	}

	r := runner.NewRunner(snippet.Language, snippet.Code)
	return r.Run()
}

func (m *Manager) Close() error {
	return m.store.Close()
}
