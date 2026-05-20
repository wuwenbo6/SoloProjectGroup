package commands

import (
	"fmt"

	"snippets/pkg/exim"

	"github.com/spf13/cobra"
)

var (
	exportFormat string
	exportOutput string
)

var exportCmd = &cobra.Command{
	Use:   "export",
	Short: "Export code snippets",
	RunE: func(cmd *cobra.Command, args []string) error {
		if exportOutput == "" {
			if exportFormat == "json" {
				exportOutput = "snippets.json"
			} else {
				exportOutput = "snippets.md"
			}
		}

		exporter := exim.NewExporter(manager)

		if exportFormat == "json" {
			if err := exporter.ExportToJSON(exportOutput); err != nil {
				return err
			}
		} else {
			if err := exporter.ExportToMarkdown(exportOutput); err != nil {
				return err
			}
		}

		fmt.Printf("Snippets exported to %s successfully!\n", exportOutput)
		return nil
	},
}

func init() {
	exportCmd.Flags().StringVarP(&exportFormat, "format", "f", "json", "Export format (json/markdown)")
	exportCmd.Flags().StringVarP(&exportOutput, "output", "o", "", "Output file path")
}
