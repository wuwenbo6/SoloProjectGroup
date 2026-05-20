package commands

import (
	"fmt"
	"strings"
	"text/tabwriter"

	"github.com/spf13/cobra"
)

var (
	searchByCategory string
	searchByTag      string
)

var searchCmd = &cobra.Command{
	Use:   "search [query]",
	Short: "Search code snippets",
	RunE: func(cmd *cobra.Command, args []string) error {
		query := ""
		if len(args) > 0 {
			query = args[0]
		}

		snippets, err := manager.SearchSnippets(query, searchByCategory, searchByTag)
		if err != nil {
			return err
		}

		if len(snippets) == 0 {
			fmt.Println("No snippets found.")
			return nil
		}

		fmt.Printf("Found %d snippet(s):\n\n", len(snippets))

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

func init() {
	searchCmd.Flags().StringVarP(&searchByCategory, "category", "C", "", "Filter by category")
	searchCmd.Flags().StringVarP(&searchByTag, "tag", "T", "", "Filter by tag")
}
