package commands

import (
	"fmt"
	"strconv"
	"text/tabwriter"
	"snippets/pkg/highlight"

	"github.com/spf13/cobra"
)

var (
	versionRestore int
	versionView    int
)

var versionCmd = &cobra.Command{
	Use:   "version [id]",
	Short: "Manage snippet versions",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		id, err := strconv.Atoi(args[0])
		if err != nil {
			return fmt.Errorf("invalid ID: %s", args[0])
		}

		if versionView > 0 {
			version, err := manager.GetVersion(id, versionView)
			if err != nil {
				return err
			}

			fmt.Printf("\033[1;36m=== Snippet #%d - Version %d ===\033[0m\n", id, version.Version)
			fmt.Printf("Title: %s\n", version.Title)
			fmt.Printf("Created: %s\n", version.CreatedAt.Format("2006-01-02 15:04:05"))
			fmt.Println("\n\033[1;34m--- Code ---\033[0m")
			fmt.Print(highlight.Highlight(version.Code, version.Language))
			return nil
		}

		if versionRestore > 0 {
			if err := manager.RestoreVersion(id, versionRestore); err != nil {
				return err
			}
			fmt.Printf("Restored snippet #%d to version %d\n", id, versionRestore)
			return nil
		}

		versions, err := manager.ListVersions(id)
		if err != nil {
			return err
		}

		if len(versions) == 0 {
			fmt.Println("No versions found for this snippet")
			return nil
		}

		w := tabwriter.NewWriter(cmd.OutOrStdout(), 0, 0, 2, ' ', 0)
		fmt.Fprintln(w, "Version\tTitle\tCreated")
		fmt.Fprintln(w, "-------\t-----\t-------")

		for _, v := range versions {
			fmt.Fprintf(w, "%d\t%s\t%s\n",
				v.Version, v.Title, v.CreatedAt.Format("2006-01-02 15:04"))
		}
		w.Flush()

		fmt.Println("\nView a version: snippets version [id] -v [version]")
		fmt.Println("Restore a version: snippets version [id] -r [version]")

		return nil
	},
}

func init() {
	versionCmd.Flags().IntVarP(&versionView, "view", "v", 0, "View a specific version")
	versionCmd.Flags().IntVarP(&versionRestore, "restore", "r", 0, "Restore to a specific version")
}
