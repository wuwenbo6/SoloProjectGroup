package commands

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/manifoldco/promptui"
	"github.com/spf13/cobra"
)

var (
	editTitle       string
	editDescription string
	editCode        string
	editLanguage    string
	editCategory    string
	editTags        []string
)

var editCmd = &cobra.Command{
	Use:   "edit [id]",
	Short: "Edit an existing code snippet",
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

		if editTitle == "" {
			prompt := promptui.Prompt{
				Label:   "Title",
				Default: snippet.Title,
			}
			result, err := prompt.Run()
			if err == nil {
				editTitle = result
			}
		}

		if editDescription == "" {
			prompt := promptui.Prompt{
				Label:   "Description",
				Default: snippet.Description,
			}
			result, err := prompt.Run()
			if err == nil {
				editDescription = result
			}
		}

		if editLanguage == "" {
			prompt := promptui.Prompt{
				Label:   "Language",
				Default: snippet.Language,
			}
			result, err := prompt.Run()
			if err == nil {
				editLanguage = result
			}
		}

		if editCategory == "" && snippet.Category != nil {
			editCategory = snippet.Category.Name
		}

		if len(editTags) == 0 && len(snippet.Tags) > 0 {
			tagNames := make([]string, len(snippet.Tags))
			for i, t := range snippet.Tags {
				tagNames[i] = t.Name
			}
			prompt := promptui.Prompt{
				Label:   "Tags (comma separated)",
				Default: strings.Join(tagNames, ", "),
			}
			result, err := prompt.Run()
			if err == nil && result != "" {
				editTags = strings.Split(result, ",")
			}
		}

		_, err = manager.UpdateSnippet(id, editTitle, editDescription, editCode, editLanguage, editCategory, editTags)
		if err != nil {
			return err
		}

		fmt.Printf("Snippet #%d updated successfully\n", id)
		return nil
	},
}

func init() {
	editCmd.Flags().StringVarP(&editTitle, "title", "t", "", "New title")
	editCmd.Flags().StringVarP(&editDescription, "description", "d", "", "New description")
	editCmd.Flags().StringVarP(&editCode, "code", "c", "", "New code content")
	editCmd.Flags().StringVarP(&editLanguage, "language", "l", "", "New programming language")
	editCmd.Flags().StringVarP(&editCategory, "category", "C", "", "New category")
	editCmd.Flags().StringSliceVarP(&editTags, "tags", "T", []string{}, "New tags")
}
