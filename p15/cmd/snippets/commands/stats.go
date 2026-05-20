package commands

import (
	"fmt"
	"os"
	"sort"
	"text/tabwriter"
	"time"

	"github.com/spf13/cobra"
)

var (
	statsDetail bool
	statsChart  bool
)

type LanguageStats struct {
	Name  string
	Count int
}

type CategoryStats struct {
	Name  string
	Count int
}

type TagStats struct {
	Name  string
	Count int
}

var statsCmd = &cobra.Command{
	Use:   "stats",
	Short: "Show snippets statistics",
	RunE: func(cmd *cobra.Command, args []string) error {
		snippets, err := manager.ListSnippets()
		if err != nil {
			return err
		}

		fmt.Println("\033[1;36m=== Snippets Statistics ===\033[0m\n")

		fmt.Printf("Total Snippets: \033[1;32m%d\033[0m\n\n", len(snippets))

		languageStats := make(map[string]int)
		categoryStats := make(map[string]int)
		tagStats := make(map[string]int)

		var totalCodeLines int
		var totalSize int64
		var latestUpdated time.Time

		for _, s := range snippets {
			languageStats[s.Language]++
			if s.Category != nil {
				categoryStats[s.Category.Name]++
			}
			for _, t := range s.Tags {
				tagStats[t.Name]++
			}

			lines := len(s.Code) / 50
			if lines == 0 && len(s.Code) > 0 {
				lines = 1
			}
			totalCodeLines += lines
			totalSize += int64(len(s.Code))

			if s.UpdatedAt.After(latestUpdated) {
				latestUpdated = s.UpdatedAt
			}
		}

		fmt.Println("\033[1;37mLanguages:\033[0m")
		printStats(languageStats, true)

		fmt.Println("\n\033[1;37mCategories:\033[0m")
		if len(categoryStats) == 0 {
			fmt.Println("  No categories defined")
		} else {
			printStats(categoryStats, true)
		}

		fmt.Println("\n\033[1;37mTags:\033[0m")
		if len(tagStats) == 0 {
			fmt.Println("  No tags defined")
		} else {
			printStats(tagStats, true)
		}

		fmt.Println("\n\033[1;37mOverview:\033[0m")
		fmt.Printf("  Total estimated lines: %d\n", totalCodeLines)
		fmt.Printf("  Total size: %s\n", formatSize(totalSize))
		fmt.Printf("  Last updated: %s\n", latestUpdated.Format("2006-01-02 15:04:05"))

		if statsDetail {
			fmt.Println("\n\033[1;37mRecent Snippets:\033[0m")
			sort.Slice(snippets, func(i, j int) bool {
				return snippets[i].UpdatedAt.After(snippets[j].UpdatedAt)
			})

			w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
			fmt.Fprintln(w, "ID\tTitle\tLanguage\tCategory\tUpdated")
			fmt.Fprintln(w, "--\t-----\t--------\t--------\t-------")

			for i, s := range snippets {
				if i >= 10 {
					break
				}
				category := "None"
				if s.Category != nil {
					category = s.Category.Name
				}
				fmt.Fprintf(w, "#%d\t%s\t%s\t%s\t%s\n",
					s.ID, truncate(s.Title, 25), s.Language,
					category, s.UpdatedAt.Format("2006-01-02"))
			}
			w.Flush()
		}

		fmt.Println()
		return nil
	},
}

func printStats(stats map[string]int, showPercent bool) {
	type item struct {
		name  string
		count int
	}

	var total int
	var items []item
	for name, count := range stats {
		items = append(items, item{name, count})
		total += count
	}

	sort.Slice(items, func(i, j int) bool {
		return items[i].count > items[j].count
	})

	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	for i, it := range items {
		if i >= 10 {
			break
		}
		percent := float64(it.count) / float64(total) * 100
		if showPercent {
			fmt.Fprintf(w, "  %s:\t%d\t(%.1f%%)\t%s\n",
				it.name, it.count, percent, generateBar(percent))
		} else {
			fmt.Fprintf(w, "  %s:\t%d\t%s\n", it.name, it.count, generateBar(float64(it.count)/5.0))
		}
	}
	w.Flush()

	if len(items) > 10 {
		fmt.Printf("  ... and %d more\n", len(items)-10)
	}
}

func generateBar(percent float64) string {
	fill := int(percent / 5)
	if fill > 20 {
		fill = 20
	}
	bar := "["
	for i := 0; i < 20; i++ {
		if i < fill {
			bar += "="
		} else {
			bar += " "
		}
	}
	bar += "]"
	return bar
}

func formatSize(bytes int64) string {
	if bytes < 1024 {
		return fmt.Sprintf("%d B", bytes)
	}
	if bytes < 1024*1024 {
		return fmt.Sprintf("%.1f KB", float64(bytes)/1024)
	}
	return fmt.Sprintf("%.1f MB", float64(bytes)/(1024*1024))
}

func init() {
	statsCmd.Flags().BoolVarP(&statsDetail, "detail", "d", false, "Show detailed statistics")
	statsCmd.Flags().BoolVarP(&statsChart, "chart", "c", true, "Show chart visualization")
}
