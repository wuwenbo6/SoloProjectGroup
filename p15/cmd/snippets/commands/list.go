package commands

import (
	"fmt"
	"strings"
	"text/tabwriter"

	"github.com/spf13/cobra"
)

var listCmd = &cobra.Command{
	Use:   "list",
	Short: "List all code snippets",
	RunE: func(cmd *cobra.Command, args []string) error {
		snippets, err := manager.ListSnippets()
		if err != nil {
			return err
		}

		if len(snippets) == 0 {
			fmt.Println("No snippets found.")
			return nil
		}

		w := tabwriter.NewWriter(cmd.OutOrStdout(), 0, 0, 2, ' ', 0)
		fmt.Fprintln(w, "ID\tTitle\tLanguage\tCategory\tTags")
		fmt.Fprintln(w, "--\t-----\t--------\t--------\t----")

		for _, snippet := range snippets {
			category := "-"
			if snippet.Category != nil {
				category = snippet.Category.Name
			}

			tags := "-"
			if len(snippet.Tags) > 0 {
				tagNames := make([]string, len(snippet.Tags))
				for i, tag := range snippet.Tags {
					tagNames[i] = tag.Name
				}
				tags = strings.Join(tagNames, ", ")
			}

			fmt.Fprintf(w, "%d\t%s\t%s\t%s\t%s\n",
				snippet.ID, snippet.Title, snippet.Language, category, tags)
		}

		w.Flush()
		return nil
	},
}
