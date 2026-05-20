package commands

import (
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/manifoldco/promptui"
	"github.com/spf13/cobra"
)

var (
	addTitle       string
	addDescription string
	addCode        string
	addLanguage    string
	addCategory    string
	addTags        []string
	addFromFile    string
)

var addCmd = &cobra.Command{
	Use:   "add",
	Short: "Add a new code snippet",
	RunE: func(cmd *cobra.Command, args []string) error {
		if addTitle == "" {
			prompt := promptui.Prompt{
				Label: "Title",
				Validate: func(input string) error {
					if len(input) == 0 {
						return fmt.Errorf("title is required")
					}
					return nil
				},
			}
			result, err := prompt.Run()
			if err != nil {
				return err
			}
			addTitle = result
		}

		if addDescription == "" {
			prompt := promptui.Prompt{
				Label: "Description (optional)",
			}
			result, err := prompt.Run()
			if err == nil {
				addDescription = result
			}
		}

		if addLanguage == "" {
			prompt := promptui.Select{
				Label: "Language",
				Items: []string{"Python", "Go", "JavaScript", "Shell"},
			}
			_, result, err := prompt.Run()
			if err != nil {
				return err
			}
			addLanguage = result
		}

		if addCode == "" && addFromFile == "" {
			fmt.Println("Enter code (press Ctrl+D when finished):")
			codeBytes, err := io.ReadAll(os.Stdin)
			if err != nil {
				return err
			}
			addCode = string(codeBytes)
		} else if addFromFile != "" {
			codeBytes, err := os.ReadFile(addFromFile)
			if err != nil {
				return err
			}
			addCode = string(codeBytes)
		}

		if addCategory == "" {
			prompt := promptui.Prompt{
				Label: "Category (optional)",
			}
			result, err := prompt.Run()
			if err == nil {
				addCategory = result
			}
		}

		if len(addTags) == 0 {
			prompt := promptui.Prompt{
				Label: "Tags (comma separated, optional)",
			}
			result, err := prompt.Run()
			if err == nil && result != "" {
				addTags = strings.Split(result, ",")
			}
		}

		id, err := manager.CreateSnippet(addTitle, addDescription, addCode, addLanguage, addCategory, addTags)
		if err != nil {
			return err
		}

		fmt.Printf("Snippet #%d created successfully!\n", id)
		return nil
	},
}

func init() {
	addCmd.Flags().StringVarP(&addTitle, "title", "t", "", "Snippet title")
	addCmd.Flags().StringVarP(&addDescription, "description", "d", "", "Snippet description")
	addCmd.Flags().StringVarP(&addCode, "code", "c", "", "Code content")
	addCmd.Flags().StringVarP(&addLanguage, "language", "l", "", "Programming language")
	addCmd.Flags().StringVarP(&addCategory, "category", "C", "", "Category name")
	addCmd.Flags().StringSliceVarP(&addTags, "tags", "T", []string{}, "Tags (comma separated)")
	addCmd.Flags().StringVarP(&addFromFile, "file", "f", "", "Read code from file")
}
