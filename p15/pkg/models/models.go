package models

import (
	"time"
)

type Version struct {
	ID          int       `json:"id"`
	SnippetID   int       `json:"snippet_id"`
	Version     int       `json:"version"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Code        string    `json:"code"`
	Language    string    `json:"language"`
	CreatedAt   time.Time `json:"created_at"`
}

type Snippet struct {
	ID          int       `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Code        string    `json:"code"`
	Language    string    `json:"language"`
	CategoryID  *int      `json:"category_id,omitempty"`
	Category    *Category `json:"category,omitempty"`
	Tags        []Tag     `json:"tags,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Category struct {
	ID        int       `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

type Tag struct {
	ID        int       `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

type SnippetTag struct {
	SnippetID int
	TagID     int
}
