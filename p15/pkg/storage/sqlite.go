package storage

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"snippets/pkg/models"
	"time"

	_ "modernc.org/sqlite"
)

type SQLiteStore struct {
	db *sql.DB
}

func NewSQLiteStore() (*SQLiteStore, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}

	dbDir := filepath.Join(homeDir, ".snippets")
	if err := os.MkdirAll(dbDir, 0755); err != nil {
		return nil, err
	}

	dbPath := filepath.Join(dbDir, "snippets.db")
	db, err := sql.Open("sqlite", dbPath+"?_pragma=encoding(UTF-8)&_pragma=case_sensitive_like(0)")
	if err != nil {
		return nil, err
	}

	_, err = db.Exec("PRAGMA encoding = 'UTF-8'")
	if err != nil {
		return nil, err
	}
	_, err = db.Exec("PRAGMA case_sensitive_like = OFF")
	if err != nil {
		return nil, err
	}

	store := &SQLiteStore{db: db}
	if err := store.initTables(); err != nil {
		return nil, err
	}

	return store, nil
}

func (s *SQLiteStore) initTables() error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS categories (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL UNIQUE,
			created_at DATETIME NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS tags (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL UNIQUE,
			created_at DATETIME NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS snippets (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			title TEXT NOT NULL,
			description TEXT,
			code TEXT NOT NULL,
			language TEXT NOT NULL,
			category_id INTEGER,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			FOREIGN KEY (category_id) REFERENCES categories(id)
		)`,
		`CREATE TABLE IF NOT EXISTS snippet_tags (
			snippet_id INTEGER,
			tag_id INTEGER,
			PRIMARY KEY (snippet_id, tag_id),
			FOREIGN KEY (snippet_id) REFERENCES snippets(id) ON DELETE CASCADE,
			FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS versions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			snippet_id INTEGER NOT NULL,
			version INTEGER NOT NULL,
			title TEXT NOT NULL,
			description TEXT,
			code TEXT NOT NULL,
			language TEXT NOT NULL,
			created_at DATETIME NOT NULL,
			FOREIGN KEY (snippet_id) REFERENCES snippets(id) ON DELETE CASCADE,
			UNIQUE(snippet_id, version)
		)`,
	}

	for _, q := range queries {
		if _, err := s.db.Exec(q); err != nil {
			return err
		}
	}

	return nil
}

func (s *SQLiteStore) CreateSnippet(snippet *models.Snippet) (int, error) {
	now := time.Now()
	res, err := s.db.Exec(
		`INSERT INTO snippets (title, description, code, language, category_id, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		snippet.Title, snippet.Description, snippet.Code, snippet.Language,
		snippet.CategoryID, now, now,
	)
	if err != nil {
		return 0, err
	}

	id, err := res.LastInsertId()
	if err != nil {
		return 0, err
	}

	return int(id), nil
}

func (s *SQLiteStore) CreateSnippetWithID(snippet *models.Snippet) (int, error) {
	res, err := s.db.Exec(
		`INSERT OR REPLACE INTO snippets (id, title, description, code, language, category_id, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		snippet.ID, snippet.Title, snippet.Description, snippet.Code, snippet.Language,
		snippet.CategoryID, snippet.CreatedAt, snippet.UpdatedAt,
	)
	if err != nil {
		return 0, err
	}

	id, err := res.LastInsertId()
	if err != nil {
		return snippet.ID, nil
	}

	return int(id), nil
}

func (s *SQLiteStore) GetSnippet(id int) (*models.Snippet, error) {
	snippet := &models.Snippet{}
	var categoryID sql.NullInt64

	err := s.db.QueryRow(
		`SELECT id, title, description, code, language, category_id, created_at, updated_at
		 FROM snippets WHERE id = ?`,
		id,
	).Scan(
		&snippet.ID, &snippet.Title, &snippet.Description, &snippet.Code,
		&snippet.Language, &categoryID, &snippet.CreatedAt, &snippet.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	if categoryID.Valid {
		catID := int(categoryID.Int64)
		snippet.CategoryID = &catID
		category, err := s.GetCategory(catID)
		if err == nil && category != nil {
			snippet.Category = category
		}
	}

	tags, err := s.GetSnippetTags(id)
	if err == nil {
		snippet.Tags = tags
	}

	return snippet, nil
}

func (s *SQLiteStore) UpdateSnippet(snippet *models.Snippet) error {
	_, err := s.db.Exec(
		`UPDATE snippets SET title = ?, description = ?, code = ?, language = ?, 
		 category_id = ?, updated_at = ? WHERE id = ?`,
		snippet.Title, snippet.Description, snippet.Code, snippet.Language,
		snippet.CategoryID, time.Now(), snippet.ID,
	)
	return err
}

func (s *SQLiteStore) DeleteSnippet(id int) error {
	_, err := s.db.Exec("DELETE FROM snippets WHERE id = ?", id)
	return err
}

func (s *SQLiteStore) ListSnippets() ([]*models.Snippet, error) {
	rows, err := s.db.Query(
		`SELECT id, title, description, code, language, category_id, created_at, updated_at
		 FROM snippets ORDER BY created_at DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var snippets []*models.Snippet
	for rows.Next() {
		snippet := &models.Snippet{}
		var categoryID sql.NullInt64

		err := rows.Scan(
			&snippet.ID, &snippet.Title, &snippet.Description, &snippet.Code,
			&snippet.Language, &categoryID, &snippet.CreatedAt, &snippet.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		if categoryID.Valid {
			catID := int(categoryID.Int64)
			snippet.CategoryID = &catID
			category, err := s.GetCategory(catID)
			if err == nil && category != nil {
				snippet.Category = category
			}
		}

		tags, err := s.GetSnippetTags(snippet.ID)
		if err == nil {
			snippet.Tags = tags
		}

		snippets = append(snippets, snippet)
	}

	return snippets, nil
}

func (s *SQLiteStore) SearchSnippets(query, category, tag string) ([]*models.Snippet, error) {
	var args []interface{}
	whereClause := "1=1"

	if query != "" {
		whereClause += " AND (title LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\' OR code LIKE ? ESCAPE '\\')"
		args = append(args, "%"+query+"%", "%"+query+"%", "%"+query+"%")
	}

	if category != "" {
		whereClause += " AND EXISTS (SELECT 1 FROM categories c WHERE c.id = snippets.category_id AND c.name LIKE ? ESCAPE '\\')"
		args = append(args, "%"+category+"%")
	}

	if tag != "" {
		whereClause += ` AND EXISTS (
			SELECT 1 FROM snippet_tags st 
			JOIN tags t ON st.tag_id = t.id 
			WHERE st.snippet_id = snippets.id AND t.name LIKE ? ESCAPE '\'
		)`
		args = append(args, "%"+tag+"%")
	}

	sqlQuery := fmt.Sprintf(
		`SELECT id, title, description, code, language, category_id, created_at, updated_at
		 FROM snippets WHERE %s ORDER BY created_at DESC`,
		whereClause,
	)

	rows, err := s.db.Query(sqlQuery, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var snippets []*models.Snippet
	for rows.Next() {
		snippet := &models.Snippet{}
		var categoryID sql.NullInt64

		err := rows.Scan(
			&snippet.ID, &snippet.Title, &snippet.Description, &snippet.Code,
			&snippet.Language, &categoryID, &snippet.CreatedAt, &snippet.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		if categoryID.Valid {
			catID := int(categoryID.Int64)
			snippet.CategoryID = &catID
			category, _ := s.GetCategory(catID)
			snippet.Category = category
		}

		tags, _ := s.GetSnippetTags(snippet.ID)
		snippet.Tags = tags

		snippets = append(snippets, snippet)
	}

	return snippets, nil
}

func (s *SQLiteStore) CreateCategory(name string) (int, error) {
	now := time.Now()
	res, err := s.db.Exec(
		"INSERT INTO categories (name, created_at) VALUES (?, ?)",
		name, now,
	)
	if err != nil {
		return 0, err
	}

	id, err := res.LastInsertId()
	return int(id), err
}

func (s *SQLiteStore) GetCategory(id int) (*models.Category, error) {
	category := &models.Category{}
	err := s.db.QueryRow(
		"SELECT id, name, created_at FROM categories WHERE id = ?",
		id,
	).Scan(&category.ID, &category.Name, &category.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return category, err
}

func (s *SQLiteStore) GetCategoryByName(name string) (*models.Category, error) {
	category := &models.Category{}
	err := s.db.QueryRow(
		"SELECT id, name, created_at FROM categories WHERE name = ?",
		name,
	).Scan(&category.ID, &category.Name, &category.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return category, err
}

func (s *SQLiteStore) ListCategories() ([]*models.Category, error) {
	rows, err := s.db.Query("SELECT id, name, created_at FROM categories ORDER BY name")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var categories []*models.Category
	for rows.Next() {
		cat := &models.Category{}
		err := rows.Scan(&cat.ID, &cat.Name, &cat.CreatedAt)
		if err != nil {
			return nil, err
		}
		categories = append(categories, cat)
	}

	return categories, nil
}

func (s *SQLiteStore) CreateTag(name string) (int, error) {
	now := time.Now()
	res, err := s.db.Exec(
		"INSERT INTO tags (name, created_at) VALUES (?, ?)",
		name, now,
	)
	if err != nil {
		return 0, err
	}

	id, err := res.LastInsertId()
	return int(id), err
}

func (s *SQLiteStore) GetTagByName(name string) (*models.Tag, error) {
	tag := &models.Tag{}
	err := s.db.QueryRow(
		"SELECT id, name, created_at FROM tags WHERE name = ?",
		name,
	).Scan(&tag.ID, &tag.Name, &tag.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return tag, err
}

func (s *SQLiteStore) AddSnippetTag(snippetID, tagID int) error {
	_, err := s.db.Exec(
		"INSERT OR IGNORE INTO snippet_tags (snippet_id, tag_id) VALUES (?, ?)",
		snippetID, tagID,
	)
	return err
}

func (s *SQLiteStore) RemoveSnippetTags(snippetID int) error {
	_, err := s.db.Exec("DELETE FROM snippet_tags WHERE snippet_id = ?", snippetID)
	return err
}

func (s *SQLiteStore) GetSnippetTags(snippetID int) ([]models.Tag, error) {
	rows, err := s.db.Query(
		`SELECT t.id, t.name, t.created_at FROM tags t
		 JOIN snippet_tags st ON t.id = st.tag_id
		 WHERE st.snippet_id = ?`,
		snippetID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tags []models.Tag
	for rows.Next() {
		tag := models.Tag{}
		err := rows.Scan(&tag.ID, &tag.Name, &tag.CreatedAt)
		if err != nil {
			return nil, err
		}
		tags = append(tags, tag)
	}

	return tags, nil
}

func (s *SQLiteStore) CreateVersion(snippetID int, title, description, code, language string) (int, error) {
	var maxVersion int
	err := s.db.QueryRow(
		"SELECT COALESCE(MAX(version), 0) FROM versions WHERE snippet_id = ?",
		snippetID,
	).Scan(&maxVersion)
	if err != nil {
		return 0, err
	}

	newVersion := maxVersion + 1
	now := time.Now()

	res, err := s.db.Exec(
		`INSERT INTO versions (snippet_id, version, title, description, code, language, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		snippetID, newVersion, title, description, code, language, now,
	)
	if err != nil {
		return 0, err
	}

	id, err := res.LastInsertId()
	return int(id), err
}

func (s *SQLiteStore) GetVersions(snippetID int) ([]*models.Version, error) {
	rows, err := s.db.Query(
		`SELECT id, snippet_id, version, title, description, code, language, created_at
		 FROM versions WHERE snippet_id = ? ORDER BY version DESC`,
		snippetID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var versions []*models.Version
	for rows.Next() {
		v := &models.Version{}
		err := rows.Scan(
			&v.ID, &v.SnippetID, &v.Version, &v.Title, &v.Description,
			&v.Code, &v.Language, &v.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		versions = append(versions, v)
	}

	return versions, nil
}

func (s *SQLiteStore) GetVersion(snippetID, version int) (*models.Version, error) {
	v := &models.Version{}
	err := s.db.QueryRow(
		`SELECT id, snippet_id, version, title, description, code, language, created_at
		 FROM versions WHERE snippet_id = ? AND version = ?`,
		snippetID, version,
	).Scan(
		&v.ID, &v.SnippetID, &v.Version, &v.Title, &v.Description,
		&v.Code, &v.Language, &v.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return v, nil
}

func (s *SQLiteStore) RestoreVersion(snippetID, version int) error {
	v, err := s.GetVersion(snippetID, version)
	if err != nil {
		return err
	}

	_, err = s.db.Exec(
		`UPDATE snippets SET title = ?, description = ?, code = ?, language = ?, updated_at = ?
		 WHERE id = ?`,
		v.Title, v.Description, v.Code, v.Language, time.Now(), snippetID,
	)
	return err
}

func (s *SQLiteStore) DeleteOldVersions(snippetID, keepCount int) error {
	_, err := s.db.Exec(
		`DELETE FROM versions WHERE snippet_id = ? AND version <= (
			SELECT version FROM versions WHERE snippet_id = ? ORDER BY version DESC LIMIT 1 OFFSET ?
		)`,
		snippetID, snippetID, keepCount,
	)
	return err
}

func (s *SQLiteStore) Close() error {
	return s.db.Close()
}
