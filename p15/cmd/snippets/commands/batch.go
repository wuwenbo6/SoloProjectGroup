package commands

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"text/tabwriter"
	"snippets/pkg/sandbox"
	"time"

	"github.com/spf13/cobra"
)

var (
	batchCategory string
	batchTag      string
	batchSandbox  bool
	batchTimeout  int
	batchCompare  bool
)

type BatchResult struct {
	ID       int
	Title    string
	Language string
	Output   string
	Error    error
	ExitCode int
	Duration time.Duration
	Success  bool
}

var batchCmd = &cobra.Command{
	Use:   "batch [ids...]",
	Short: "Run multiple snippets and compare results",
	RunE: func(cmd *cobra.Command, args []string) error {
		var snippetsToRun []int

		if len(args) > 0 {
			for _, arg := range args {
				id, err := strconv.Atoi(arg)
				if err != nil {
					return fmt.Errorf("invalid ID: %s", arg)
				}
				snippetsToRun = append(snippetsToRun, id)
			}
		}

		if len(snippetsToRun) == 0 {
			allSnippets, err := manager.ListSnippets()
			if err != nil {
				return err
			}

			for _, s := range allSnippets {
				match := true
				if batchCategory != "" {
					if s.Category == nil || !strings.EqualFold(s.Category.Name, batchCategory) {
						match = false
					}
				}
				if batchTag != "" {
					hasTag := false
					for _, t := range s.Tags {
						if strings.EqualFold(t.Name, batchTag) {
							hasTag = true
							break
						}
					}
					if !hasTag {
						match = false
					}
				}
				if match {
					snippetsToRun = append(snippetsToRun, s.ID)
				}
			}
		}

		if len(snippetsToRun) == 0 {
			fmt.Println("No snippets selected to run")
			fmt.Println("Usage: snippets batch 1 2 3")
			fmt.Println("       snippets batch -c python")
			fmt.Println("       snippets batch -t utility")
			return nil
		}

		fmt.Printf("Running %d snippet(s)...\n\n", len(snippetsToRun))

		var results []*BatchResult

		for _, id := range snippetsToRun {
			snippet, err := manager.GetSnippet(id)
			if err != nil {
				results = append(results, &BatchResult{
					ID:      id,
					Title:   fmt.Sprintf("(Error loading #%d)", id),
					Error:   err,
					Success: false,
				})
				continue
			}
			if snippet == nil {
				results = append(results, &BatchResult{
					ID:      id,
					Title:   "(Not found)",
					Error:   fmt.Errorf("snippet not found"),
					Success: false,
				})
				continue
			}

			fmt.Printf("[%d/%d] Running #%d: %s... ", len(results)+1, len(snippetsToRun), id, snippet.Title)

			result := &BatchResult{
				ID:       id,
				Title:    snippet.Title,
				Language: snippet.Language,
			}

			start := time.Now()

			if batchSandbox {
				config := sandbox.DefaultConfig()
				if batchTimeout > 0 {
					config.Timeout = time.Duration(batchTimeout) * time.Second
				}
				s := sandbox.NewSandbox(snippet.Language, snippet.Code, config)
				sbResult, err := s.Run()
				if err != nil {
					result.Error = err
				} else {
					result.Output = sbResult.Output
					result.ExitCode = sbResult.ExitCode
					result.Duration = sbResult.Duration
					result.Success = sbResult.ExitCode == 0
				}
			} else {
				output, err := manager.RunSnippet(id)
				result.Output = output
				result.Duration = time.Since(start)
				result.Success = err == nil
				if err != nil {
					result.Error = err
				}
			}

			if result.Success {
				fmt.Printf("\033[32m✓ %v\033[0m\n", result.Duration)
			} else {
				fmt.Printf("\033[31m✗ %v\033[0m\n", result.Duration)
			}

			results = append(results, result)
		}

		fmt.Println("\n--- Summary ---")
		w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
		fmt.Fprintln(w, "ID\tTitle\tLanguage\tStatus\tDuration")
		fmt.Fprintln(w, "--\t-----\t--------\t------\t--------")

		successCount := 0
		for _, r := range results {
			status := "\033[31mFAILED\033[0m"
			if r.Success {
				status = "\033[32mOK\033[0m"
				successCount++
			}
			fmt.Fprintf(w, "#%d\t%s\t%s\t%s\t%v\n",
				r.ID, truncate(r.Title, 30), r.Language, status, r.Duration)
		}
		w.Flush()

		fmt.Printf("\nSuccess: %d/%d (%.1f%%)\n",
			successCount, len(results),
			float64(successCount)/float64(len(results))*100)

		if batchCompare {
			fmt.Println("\n--- Output Comparison ---")
			for _, r := range results {
				fmt.Printf("\n\033[1;36m#%d: %s\033[0m\n", r.ID, r.Title)
				if r.Success {
					if r.Output != "" {
						lines := strings.Split(strings.TrimSpace(r.Output), "\n")
						for i, line := range lines {
							if i >= 10 {
								fmt.Printf("  ... (%d more lines)\n", len(lines)-10)
								break
							}
							fmt.Printf("  %s\n", line)
						}
					} else {
						fmt.Println("  (no output)")
					}
				} else {
					fmt.Printf("  Error: %v\n", r.Error)
				}
			}
		}

		return nil
	},
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max-3] + "..."
}

func init() {
	batchCmd.Flags().StringVarP(&batchCategory, "category", "c", "", "Filter snippets by category")
	batchCmd.Flags().StringVarP(&batchTag, "tag", "t", "", "Filter snippets by tag")
	batchCmd.Flags().BoolVar(&batchSandbox, "sandbox", false, "Run in sandbox mode")
	batchCmd.Flags().IntVar(&batchTimeout, "timeout", 30, "Timeout in seconds")
	batchCmd.Flags().BoolVarP(&batchCompare, "compare", "v", false, "Show output comparison")
}
