package commands

import (
	"fmt"
	"snippets/pkg/config"

	"github.com/spf13/cobra"
)

var (
	setPythonPath   string
	setNodePath     string
	setGoPath       string
	setShellPath    string
	setEditor       string
	setSyncRemote   string
	setSyncBranch   string
	setGitRemote    string
	setGitBranch    string
	setAutoSync     bool
	setRunTimeout   int
	setDefaultTheme string
)

var configCmd = &cobra.Command{
	Use:   "config",
	Short: "Manage configuration",
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg, err := config.Load()
		if err != nil {
			return err
		}

		updated := false

		if setPythonPath != "" {
			cfg.PythonPath = setPythonPath
			updated = true
		}
		if setNodePath != "" {
			cfg.NodePath = setNodePath
			updated = true
		}
		if setGoPath != "" {
			cfg.GoPath = setGoPath
			updated = true
		}
		if setShellPath != "" {
			cfg.ShellPath = setShellPath
			updated = true
		}
		if setEditor != "" {
			cfg.DefaultEditor = setEditor
			updated = true
		}
		if setSyncRemote != "" {
			cfg.SyncRemote = setSyncRemote
			updated = true
		}
		if setSyncBranch != "" {
			cfg.SyncBranch = setSyncBranch
			updated = true
		}
		if setGitRemote != "" {
			cfg.GitRemote = setGitRemote
			updated = true
		}
		if setGitBranch != "" {
			cfg.GitBranch = setGitBranch
			updated = true
		}
		if cmd.Flags().Changed("auto-sync") {
			cfg.AutoSync = setAutoSync
			updated = true
		}
		if setRunTimeout > 0 {
			cfg.RunTimeout = setRunTimeout
			updated = true
		}
		if setDefaultTheme != "" {
			cfg.DefaultTheme = setDefaultTheme
			updated = true
		}

		if updated {
			if err := cfg.Save(); err != nil {
				return err
			}
			fmt.Println("\033[32m✓ Configuration saved\033[0m")
		}

		fmt.Println("\n\033[1;36m=== Current Configuration ===\033[0m")
		fmt.Println("\n\033[1;37m[Interpreters]\033[0m")
		fmt.Printf("  Python:    %s\n", displayValue(cfg.PythonPath))
		fmt.Printf("  Node.js:   %s\n", displayValue(cfg.NodePath))
		fmt.Printf("  Go:        %s\n", displayValue(cfg.GoPath))
		fmt.Printf("  Shell:     %s\n", displayValue(cfg.ShellPath))
		fmt.Printf("  Editor:    %s\n", cfg.DefaultEditor)

		fmt.Println("\n\033[1;37m[Git Sync]\033[0m")
		fmt.Printf("  Sync Remote:  %s\n", displayValue(cfg.SyncRemote))
		fmt.Printf("  Sync Branch:  %s\n", cfg.SyncBranch)
		fmt.Printf("  Git Remote:   %s\n", displayValue(cfg.GitRemote))
		fmt.Printf("  Git Branch:   %s\n", cfg.GitBranch)
		fmt.Printf("  Auto Sync:    %v\n", cfg.AutoSync)

		fmt.Println("\n\033[1;37m[Runtime]\033[0m")
		fmt.Printf("  Run Timeout:  %d seconds\n", cfg.RunTimeout)
		fmt.Printf("  Theme:        %s\n", cfg.DefaultTheme)
		fmt.Println()

		return nil
	},
}

func displayValue(s string) string {
	if s == "" {
		return "\033[2m(not set)\033[0m"
	}
	return s
}

func init() {
	configCmd.Flags().StringVar(&setPythonPath, "python-path", "", "Set default Python interpreter path")
	configCmd.Flags().StringVar(&setNodePath, "node-path", "", "Set default Node.js interpreter path")
	configCmd.Flags().StringVar(&setGoPath, "go-path", "", "Set default Go compiler path")
	configCmd.Flags().StringVar(&setShellPath, "shell-path", "", "Set default Shell interpreter path")
	configCmd.Flags().StringVar(&setEditor, "editor", "", "Set default editor")
	configCmd.Flags().StringVar(&setSyncRemote, "sync-remote", "", "Set Git sync remote URL")
	configCmd.Flags().StringVar(&setSyncBranch, "sync-branch", "", "Set Git sync branch")
	configCmd.Flags().StringVar(&setGitRemote, "git-remote", "", "Set Git backup remote URL")
	configCmd.Flags().StringVar(&setGitBranch, "git-branch", "", "Set Git backup branch")
	configCmd.Flags().BoolVar(&setAutoSync, "auto-sync", false, "Enable auto sync on start")
	configCmd.Flags().IntVar(&setRunTimeout, "run-timeout", 30, "Set default run timeout in seconds")
	configCmd.Flags().StringVar(&setDefaultTheme, "theme", "", "Set default theme (light/dark)")
}
