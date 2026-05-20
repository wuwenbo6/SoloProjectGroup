package commands

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"snippets/pkg/backup"
	"snippets/pkg/config"
	"snippets/pkg/exim"
	"snippets/pkg/models"
	"time"

	"github.com/spf13/cobra"
)

var (
	syncPull  bool
	syncPush  bool
	syncForce bool
)

var syncCmd = &cobra.Command{
	Use:   "sync",
	Short: "Sync snippets via Git repository",
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg, err := config.Load()
		if err != nil {
			return err
		}

		if cfg.SyncRemote == "" {
			return fmt.Errorf("sync remote not configured, use 'snippets config --sync-remote <url>'")
		}

		gitBackup := backup.NewGitBackup("")

		if syncPull {
			fmt.Println("Pulling snippets from remote...")
			if err := syncPullSnippets(gitBackup, cfg); err != nil {
				return err
			}
			return nil
		}

		if syncPush {
			fmt.Println("Pushing snippets to remote...")
			if err := syncPushSnippets(gitBackup, cfg); err != nil {
				return err
			}
			return nil
		}

		fmt.Println("Syncing snippets with remote...")
		if err := syncPullSnippets(gitBackup, cfg); err != nil {
			fmt.Printf("Warning: pull failed: %v\n", err)
		}
		if err := syncPushSnippets(gitBackup, cfg); err != nil {
			return err
		}

		fmt.Println("Sync completed")
		return nil
	},
}

func syncPullSnippets(gitBackup *backup.GitBackup, cfg *config.Config) error {
	repoPath := gitBackup.RepoPath()

	if err := os.MkdirAll(repoPath, 0755); err != nil {
		return err
	}

	isRepo := false
	if _, err := os.Stat(filepath.Join(repoPath, ".git")); err == nil {
		isRepo = true
	}

	if !isRepo {
		fmt.Println("Cloning repository...")
		if err := gitBackup.Clone(cfg.SyncRemote); err != nil {
			return fmt.Errorf("clone failed: %v", err)
		}
	} else {
		fmt.Println("Pulling latest changes...")
		if err := gitBackup.Pull("origin", cfg.SyncBranch); err != nil {
			return fmt.Errorf("pull failed: %v", err)
		}
	}

	snippetsFile := filepath.Join(repoPath, "snippets.json")
	if _, err := os.Stat(snippetsFile); err == nil {
		data, err := os.ReadFile(snippetsFile)
		if err != nil {
			return err
		}

		var remoteSnippets []*models.Snippet
		if err := json.Unmarshal(data, &remoteSnippets); err != nil {
			return err
		}

		fmt.Printf("Found %d snippets in remote\n", len(remoteSnippets))

		localSnippets, err := manager.ListSnippets()
		if err != nil {
			return err
		}

		localMap := make(map[int]*models.Snippet)
		for _, s := range localSnippets {
			localMap[s.ID] = s
		}

		imported := 0
		updated := 0

		for _, remote := range remoteSnippets {
			if local, exists := localMap[remote.ID]; exists {
				if syncForce || remote.UpdatedAt.After(local.UpdatedAt) {
					fmt.Printf("Updating snippet #%d: %s\n", remote.ID, remote.Title)
					if err := updateSnippetFromRemote(remote); err != nil {
						fmt.Printf("  Error: %v\n", err)
					} else {
						updated++
					}
				}
			} else {
				fmt.Printf("Importing snippet #%d: %s\n", remote.ID, remote.Title)
				if err := importSnippetFromRemote(remote); err != nil {
					fmt.Printf("  Error: %v\n", err)
				} else {
					imported++
				}
			}
		}

		fmt.Printf("\nPull summary: %d imported, %d updated\n", imported, updated)
	} else {
		fmt.Println("No snippets.json found in repository")
	}

	return nil
}

func syncPushSnippets(gitBackup *backup.GitBackup, cfg *config.Config) error {
	repoPath := gitBackup.RepoPath()
	if err := os.MkdirAll(repoPath, 0755); err != nil {
		return err
	}

	snippets, err := manager.ListSnippets()
	if err != nil {
		return err
	}

	fmt.Printf("Exporting %d snippets...\n", len(snippets))

	snippetsFile := filepath.Join(repoPath, "snippets.json")
	data, err := json.MarshalIndent(snippets, "", "  ")
	if err != nil {
		return err
	}
	if err := os.WriteFile(snippetsFile, data, 0644); err != nil {
		return err
	}

	exportDir := filepath.Join(repoPath, "snippets")
	os.MkdirAll(exportDir, 0755)

	for _, s := range snippets {
		ext := exim.GetFileExtension(s.Language)
		filename := fmt.Sprintf("%d_%s%s", s.ID, exim.SanitizeFilename(s.Title), ext)
		filePath := filepath.Join(exportDir, filename)
		os.WriteFile(filePath, []byte(s.Code), 0644)
	}

	timestamp := time.Now().Format("2006-01-02 15:04:05")
	message := fmt.Sprintf("Sync: %d snippets (%s)", len(snippets), timestamp)

	fmt.Println("Committing changes...")
	if err := gitBackup.Commit(message); err != nil {
		return fmt.Errorf("commit failed: %v", err)
	}

	fmt.Println("Pushing to remote...")
	if err := gitBackup.Push("origin", cfg.SyncBranch); err != nil {
		return fmt.Errorf("push failed: %v", err)
	}

	fmt.Println("Push completed")
	return nil
}

func updateSnippetFromRemote(snippet *models.Snippet) error {
	categoryName := ""
	if snippet.Category != nil {
		categoryName = snippet.Category.Name
	}

	tagNames := []string{}
	for _, t := range snippet.Tags {
		tagNames = append(tagNames, t.Name)
	}

	_, err := manager.UpdateSnippet(snippet.ID, snippet.Title, snippet.Description,
		snippet.Code, snippet.Language, categoryName, tagNames)
	return err
}

func importSnippetFromRemote(snippet *models.Snippet) error {
	categoryName := ""
	if snippet.Category != nil {
		categoryName = snippet.Category.Name
	}

	tagNames := []string{}
	for _, t := range snippet.Tags {
		tagNames = append(tagNames, t.Name)
	}

	_, err := manager.CreateSnippetWithID(snippet.ID, snippet.Title, snippet.Description,
		snippet.Code, snippet.Language, categoryName, tagNames, snippet.CreatedAt, snippet.UpdatedAt)
	return err
}

func init() {
	syncCmd.Flags().BoolVarP(&syncPull, "pull", "p", false, "Only pull from remote")
	syncCmd.Flags().BoolVarP(&syncPush, "push", "u", false, "Only push to remote")
	syncCmd.Flags().BoolVarP(&syncForce, "force", "f", false, "Force overwrite local changes")
}
