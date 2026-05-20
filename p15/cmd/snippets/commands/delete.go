package commands

import (
	"fmt"
	"strconv"

	"github.com/manifoldco/promptui"
	"github.com/spf13/cobra"
)

var deleteCmd = &cobra.Command{
	Use:   "delete [id]",
	Short: "Delete a code snippet",
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

		prompt := promptui.Select{
			Label: fmt.Sprintf("Are you sure you want to delete snippet #%d '%s'", id, snippet.Title),
			Items: []string{"No", "Yes"},
		}
		_, result, err := prompt.Run()
		if err != nil {
			return err
		}

		if result == "No" {
			fmt.Println("Delete cancelled")
			return nil
		}

		if err := manager.DeleteSnippet(id); err != nil {
			return err
		}

		fmt.Printf("Snippet #%d deleted successfully\n", id)
		return nil
	},
}
