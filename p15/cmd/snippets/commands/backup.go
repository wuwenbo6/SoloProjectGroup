package commands

import (
	"encoding/json"
	"fmt"
	"snippets/pkg/backup"
	"snippets/pkg/models"

	"github.com/spf13/cobra"
)

var (
	backupRepo   string
	backupRemote string
	backupBranch string
)

var backupCmd = &cobra.Command{
	Use:   "backup",
	Short: "Backup snippets to Git repository",
	RunE: func(cmd *cobra.Command, args []string) error {
		if !backup.IsGitInstalled() {
			return fmt.Errorf("git is not installed")
		}

		repoPath := backupRepo
		if repoPath == "" {
			var err error
			repoPath, err = backup.GetDefaultRepoPath()
			if err != nil {
				return err
			}
		}

		gb := backup.NewGitBackup(repoPath)

		if !backup.IsGitRepository(repoPath) {
			fmt.Println("Initializing new git repository...")
			if err := gb.Init(); err != nil {
				return err
			}
		}

		if backupRemote != "" {
			if !gb.HasRemote("origin") {
				fmt.Printf("Setting remote origin to %s...\n", backupRemote)
				if err := gb.SetRemote("origin", backupRemote); err != nil {
					return err
				}
			}
		}

		snippets, err := manager.ListSnippets()
		if err != nil {
			return err
		}

		var snippetData []*models.Snippet
		for _, s := range snippets {
			snippetData = append(snippetData, s)
		}

		jsonData, err := json.MarshalIndent(snippetData, "", "  ")
		if err != nil {
			return err
		}

		fmt.Println("Backing up snippets...")
		if err := gb.BackupSnippetsJSON(jsonData); err != nil {
			return err
		}

		if gb.HasRemote("origin") {
			fmt.Println("Pushing to remote...")
			branch := backupBranch
			if branch == "" {
				branch = "main"
			}
			if err := gb.Push("origin", branch); err != nil {
				return err
			}
		}

		fmt.Println("Backup completed successfully!")
		return nil
	},
}

func init() {
	backupCmd.Flags().StringVarP(&backupRepo, "repo", "r", "", "Repository path")
	backupCmd.Flags().StringVarP(&backupRemote, "remote", "R", "", "Remote repository URL")
	backupCmd.Flags().StringVarP(&backupBranch, "branch", "b", "main", "Branch name")
}
