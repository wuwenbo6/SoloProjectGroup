package commands

import (
	"fmt"
	"path/filepath"

	"snippets/pkg/exim"

	"github.com/spf13/cobra"
)

var importCmd = &cobra.Command{
	Use:   "import [file]",
	Short: "Import code snippets from file",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		filePath := args[0]

		importer := exim.NewImporter(manager)

		var count int
		var err error

		ext := filepath.Ext(filePath)
		if ext == ".json" {
			count, err = importer.ImportFromJSON(filePath)
		} else if ext == ".md" || ext == ".markdown" {
			count, err = importer.ImportFromMarkdown(filePath)
		} else {
			return fmt.Errorf("unsupported file format: %s", ext)
		}

		if err != nil {
			return err
		}

		fmt.Printf("Successfully imported %d snippet(s)!\n", count)
		return nil
	},
}
