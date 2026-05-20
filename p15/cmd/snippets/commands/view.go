package commands

import (
	"fmt"
	"strconv"
	"strings"
	"snippets/pkg/highlight"

	"github.com/spf13/cobra"
)

var viewCmd = &cobra.Command{
	Use:   "view [id]",
	Short: "View a specific code snippet",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		id, err := strconv.Atoi(args[0])
		if err != nil {
			return fmt.Errorf("invalid ID: %s", args[0])
		}

		snippet, err := manager.GetSnippet(id)
		if err != nil {
			return err
		}
		if snippet == nil {
			return fmt.Errorf("snippet #%d not found", id)
		}

		fmt.Printf("\033[1;36m=== Snippet #%d ===\033[0m\n", snippet.ID)
	fmt.Printf("\033[1;37mTitle:\033[0m %s\n", snippet.Title)
	if snippet.Description != "" {
		fmt.Printf("\033[1;37mDescription:\033[0m %s\n", snippet.Description)
	}
	fmt.Printf("\033[1;37mLanguage:\033[0m %s\n", snippet.Language)
	if snippet.Category != nil {
		fmt.Printf("\033[1;37mCategory:\033[0m %s\n", snippet.Category.Name)
	}
	if len(snippet.Tags) > 0 {
		tagNames := make([]string, len(snippet.Tags))
		for i, tag := range snippet.Tags {
			tagNames[i] = fmt.Sprintf("\033[38;5;220m%s\033[0m", tag.Name)
		}
		fmt.Printf("\033[1;37mTags:\033[0m %s\n", strings.Join(tagNames, ", "))
	}
	fmt.Printf("\033[1;37mCreated:\033[0m %s\n", snippet.CreatedAt.Format("2006-01-02 15:04:05"))
	fmt.Printf("\033[1;37mUpdated:\033[0m %s\n", snippet.UpdatedAt.Format("2006-01-02 15:04:05"))
	fmt.Println("\n\033[1;34m--- Code ---\033[0m")
	fmt.Print(highlight.Highlight(snippet.Code, snippet.Language))

	return nil
	},
}
