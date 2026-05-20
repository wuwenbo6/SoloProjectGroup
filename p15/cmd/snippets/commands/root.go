package commands

import (
	"fmt"
	"os"
	"snippets/pkg/manager"

	"github.com/spf13/cobra"
)

var manager *manager.Manager

var rootCmd = &cobra.Command{
	Use:   "snippets",
	Short: "A cross-platform code snippet management tool",
	Long:  `A powerful command-line tool for managing, running, and backing up code snippets.`,
	PersistentPreRun: func(cmd *cobra.Command, args []string) {
		var err error
		manager, err = manager.NewManager()
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error initializing manager: %v\n", err)
			os.Exit(1)
		}
	},
	PersistentPostRun: func(cmd *cobra.Command, args []string) {
		if manager != nil {
			manager.Close()
		}
	},
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func init() {
	rootCmd.AddCommand(addCmd)
	rootCmd.AddCommand(listCmd)
	rootCmd.AddCommand(viewCmd)
	rootCmd.AddCommand(searchCmd)
	rootCmd.AddCommand(editCmd)
	rootCmd.AddCommand(deleteCmd)
	rootCmd.AddCommand(runCmd)
	rootCmd.AddCommand(exportCmd)
	rootCmd.AddCommand(importCmd)
	rootCmd.AddCommand(backupCmd)
	rootCmd.AddCommand(shareCmd)
	rootCmd.AddCommand(shareViewCmd)
	rootCmd.AddCommand(versionCmd)
	rootCmd.AddCommand(scheduleCmd)
	rootCmd.AddCommand(configCmd)
	rootCmd.AddCommand(syncCmd)
	rootCmd.AddCommand(completionCmd)
	rootCmd.AddCommand(batchCmd)
	rootCmd.AddCommand(statsCmd)
}
