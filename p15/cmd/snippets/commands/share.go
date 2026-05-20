package commands

import (
	"fmt"
	"strconv"
	"strings"
	"text/tabwriter"
	"time"
	"snippets/pkg/share"

	"github.com/spf13/cobra"
)

var (
	shareExpire  string
	shareRevoke  string
	shareList    bool
)

var shareCmd = &cobra.Command{
	Use:   "share [id]",
	Short: "Share a code snippet",
	Args:  cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		sm, err := share.NewShareManager()
		if err != nil {
			return err
		}

		if shareRevoke != "" {
			if err := sm.RevokeShare(shareRevoke); err != nil {
				return fmt.Errorf("failed to revoke share: %v", err)
			}
			fmt.Printf("Share link %s has been revoked\n", shareRevoke)
			return nil
		}

		if shareList {
			shares, err := sm.ListShares(0)
			if err != nil {
				return err
			}

			if len(shares) == 0 {
				fmt.Println("No shares found")
				return nil
			}

			w := tabwriter.NewWriter(cmd.OutOrStdout(), 0, 0, 2, ' ', 0)
			fmt.Fprintln(w, "Share ID\tSnippet\tTitle\tViews\tExpires")
			fmt.Fprintln(w, "--------\t-------\t-----\t-----\t-------")

			for _, s := range shares {
				expires := "Never"
				if !s.ExpiresAt.IsZero() {
					expires = s.ExpiresAt.Format("2006-01-02 15:04")
				}
				fmt.Fprintf(w, "%s\t#%d\t%s\t%d\t%s\n",
					s.ShareID, s.SnippetID, s.Title, s.ViewCount, expires)
			}
			w.Flush()
			return nil
		}

		if len(args) == 0 {
			return fmt.Errorf("please specify a snippet ID to share")
		}

		id, err := strconv.Atoi(args[0])
		if err != nil {
			return fmt.Errorf("invalid ID: %s", args[0])
		}

		snippet, err := manager.GetSnippet(id)
		if err != nil {
			return err
		}
		if snippet == nil {
			return fmt.Errorf("snippet #%d not found", id)
		}

		var expiresIn time.Duration
		switch strings.ToLower(shareExpire) {
		case "1h":
			expiresIn = time.Hour
		case "1d", "":
			expiresIn = 24 * time.Hour
		case "7d", "1w":
			expiresIn = 7 * 24 * time.Hour
		case "30d":
			expiresIn = 30 * 24 * time.Hour
		case "never":
			expiresIn = 0
		default:
			return fmt.Errorf("invalid expire time: %s (use: 1h, 1d, 7d, 30d, never)", shareExpire)
		}

		shared, err := sm.CreateShare(snippet, expiresIn)
		if err != nil {
			return err
		}

		link := share.GenerateShareLink(shared.ShareID)

		fmt.Printf("Successfully shared snippet #%d\n", id)
		fmt.Printf("Share ID: %s\n", shared.ShareID)
		fmt.Printf("Share Link: %s\n", link)
		fmt.Printf("Expires: %s\n", shared.ExpiresAt.Format("2006-01-02 15:04:05"))
		fmt.Println("\nTo view the shared snippet:")
		fmt.Printf("  snippets share-view %s\n", shared.ShareID)

		return nil
	},
}

var shareViewCmd = &cobra.Command{
	Use:   "share-view [share-id]",
	Short: "View a shared snippet",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		sm, err := share.NewShareManager()
		if err != nil {
			return err
		}

		shared, err := sm.GetShare(args[0])
		if err != nil {
			return err
		}

		fmt.Printf("Shared Snippet: %s\n", shared.Title)
		fmt.Printf("Language: %s\n", shared.Language)
		fmt.Printf("Views: %d\n", shared.ViewCount)
		fmt.Println("\n--- Code ---")
		fmt.Println(shared.Code)

		return nil
	},
}

func init() {
	shareCmd.Flags().StringVarP(&shareExpire, "expire", "e", "1d", "Expiration time (1h, 1d, 7d, 30d, never)")
	shareCmd.Flags().StringVarP(&shareRevoke, "revoke", "r", "", "Revoke a share by ID")
	shareCmd.Flags().BoolVarP(&shareList, "list", "l", false, "List all shares")
}
