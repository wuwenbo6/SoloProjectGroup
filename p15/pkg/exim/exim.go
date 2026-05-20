package exim

import (
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"snippets/pkg/manager"
	"snippets/pkg/models"
	"strings"
	"time"
)

type Exporter struct {
	manager *manager.Manager
}

func NewExporter(mgr *manager.Manager) *Exporter {
	return &Exporter{manager: mgr}
}

func (e *Exporter) ExportToJSON(filePath string) error {
	snippets, err := e.manager.ListSnippets()
	if err != nil {
		return err
	}

	data, err := json.MarshalIndent(snippets, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(filePath, data, 0644)
}

func (e *Exporter) ExportToMarkdown(filePath string) error {
	snippets, err := e.manager.ListSnippets()
	if err != nil {
		return err
	}

	var sb strings.Builder
	sb.WriteString("# Code Snippets\n\n")
	sb.WriteString(fmt.Sprintf("Exported at: %s\n\n", time.Now().Format(time.RFC3339)))

	for _, snippet := range snippets {
		sb.WriteString(fmt.Sprintf("## %s (ID: %d)\n\n", snippet.Title, snippet.ID))
		sb.WriteString(fmt.Sprintf("- **Language**: %s\n", snippet.Language))
		if snippet.Category != nil {
			sb.WriteString(fmt.Sprintf("- **Category**: %s\n", snippet.Category.Name))
		}
		if len(snippet.Tags) > 0 {
			tagNames := make([]string, len(snippet.Tags))
			for i, tag := range snippet.Tags {
				tagNames[i] = tag.Name
			}
			sb.WriteString(fmt.Sprintf("- **Tags**: %s\n", strings.Join(tagNames, ", ")))
		}
		sb.WriteString(fmt.Sprintf("- **Created**: %s\n\n", snippet.CreatedAt.Format(time.RFC3339)))

		if snippet.Description != "" {
			sb.WriteString(fmt.Sprintf("**Description**: %s\n\n", snippet.Description))
		}

		sb.WriteString(fmt.Sprintf("```%s\n%s\n```\n\n", snippet.Language, snippet.Code))
		sb.WriteString("---\n\n")
	}

	return os.WriteFile(filePath, []byte(sb.String()), 0644)
}

type Importer struct {
	manager *manager.Manager
}

func NewImporter(mgr *manager.Manager) *Importer {
	return &Importer{manager: mgr}
}

func (i *Importer) ImportFromJSON(filePath string) (int, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return 0, err
	}

	var snippets []models.Snippet
	if err := json.Unmarshal(data, &snippets); err != nil {
		return 0, err
	}

	count := 0
	for _, snippet := range snippets {
		tagNames := make([]string, len(snippet.Tags))
		for i, tag := range snippet.Tags {
			tagNames[i] = tag.Name
		}

		categoryName := ""
		if snippet.Category != nil {
			categoryName = snippet.Category.Name
		}

		_, err := i.manager.CreateSnippet(
			snippet.Title,
			snippet.Description,
			snippet.Code,
			snippet.Language,
			categoryName,
			tagNames,
		)
		if err == nil {
			count++
		}
	}

	return count, nil
}

func (i *Importer) ImportFromMarkdown(filePath string) (int, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return 0, err
	}

	content := string(data)
	sections := strings.Split(content, "---")

	count := 0
	for _, section := range sections {
		section = strings.TrimSpace(section)
		if section == "" || strings.HasPrefix(section, "# Code Snippets") {
			continue
		}

		snippet, err := i.parseMarkdownSnippet(section)
		if err != nil {
			continue
		}

		_, err = i.manager.CreateSnippet(
			snippet.Title,
			snippet.Description,
			snippet.Code,
			snippet.Language,
			snippet.CategoryName,
			snippet.TagNames,
		)
		if err == nil {
			count++
		}
	}

	return count, nil
}

type parsedSnippet struct {
	Title        string
	Description  string
	Code         string
	Language     string
	CategoryName string
	TagNames     []string
}

func (i *Importer) parseMarkdownSnippet(section string) (*parsedSnippet, error) {
	snippet := &parsedSnippet{}

	lines := strings.Split(section, "\n")
	inCodeBlock := false
	codeLines := []string{}

	for _, line := range lines {
		if strings.HasPrefix(line, "## ") {
			title := strings.TrimPrefix(line, "## ")
			if idx := strings.Index(title, "(ID:"); idx != -1 {
				title = strings.TrimSpace(title[:idx])
			}
			snippet.Title = title
			continue
		}

		if strings.HasPrefix(line, "```") {
			if !inCodeBlock {
				inCodeBlock = true
				snippet.Language = strings.TrimPrefix(line, "```")
			} else {
				break
			}
			continue
		}

		if inCodeBlock {
			codeLines = append(codeLines, line)
			continue
		}

		if strings.HasPrefix(line, "- **Language**: ") {
			snippet.Language = strings.TrimPrefix(line, "- **Language**: ")
			continue
		}

		if strings.HasPrefix(line, "- **Category**: ") {
			snippet.CategoryName = strings.TrimPrefix(line, "- **Category**: ")
			continue
		}

		if strings.HasPrefix(line, "- **Tags**: ") {
			tagsStr := strings.TrimPrefix(line, "- **Tags**: ")
			tagNames := strings.Split(tagsStr, ", ")
			snippet.TagNames = tagNames
			continue
		}

		if strings.HasPrefix(line, "**Description**: ") {
			snippet.Description = strings.TrimPrefix(line, "**Description**: ")
			continue
		}
	}

	snippet.Code = strings.Join(codeLines, "\n")

	if snippet.Title == "" || snippet.Code == "" {
		return nil, fmt.Errorf("incomplete snippet")
	}

	return snippet, nil
}

func GetFileExtension(language string) string {
	switch strings.ToLower(language) {
	case "python":
		return ".py"
	case "go":
		return ".go"
	case "javascript", "js":
		return ".js"
	case "bash", "shell":
		return ".sh"
	case "typescript", "ts":
		return ".ts"
	case "rust", "rs":
		return ".rs"
	case "c":
		return ".c"
	case "cpp", "c++":
		return ".cpp"
	case "java":
		return ".java"
	case "html":
		return ".html"
	case "css":
		return ".css"
	case "json":
		return ".json"
	case "yaml", "yml":
		return ".yml"
	case "markdown", "md":
		return ".md"
	case "text", "txt":
		return ".txt"
	default:
		return ".txt"
	}
}

func SanitizeFilename(filename string) string {
	re := regexp.MustCompile(`[^a-zA-Z0-9_.-]`)
	sanitized := re.ReplaceAllString(filename, "_")
	if len(sanitized) > 50 {
		sanitized = sanitized[:50]
	}
	return strings.ToLower(sanitized)
}
