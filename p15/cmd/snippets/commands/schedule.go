package commands

import (
	"fmt"
	"snippets/pkg/scheduler"

	"github.com/spf13/cobra"
)

var (
	scheduleEnable  bool
	scheduleDisable bool
	scheduleInterval string
	scheduleRemote  string
	scheduleBranch  string
	scheduleRun     bool
)

var scheduleCmd = &cobra.Command{
	Use:   "schedule",
	Short: "Manage auto backup schedule",
	RunE: func(cmd *cobra.Command, args []string) error {
		s, err := scheduler.NewScheduler()
		if err != nil {
			return err
		}

		if scheduleRun {
			fmt.Println("Running manual backup...")
			if err := s.RunBackup(); err != nil {
				return err
			}
			fmt.Println("Backup completed successfully")
			return nil
		}

		if scheduleDisable {
			schedule, err := s.GetSchedule()
			if err != nil {
				return err
			}
			schedule.Enabled = false
			if err := s.SaveSchedule(schedule); err != nil {
				return err
			}
			if err := s.RemoveCronJob(); err != nil {
				fmt.Printf("Warning: failed to remove cron job: %v\n", err)
			}
			fmt.Println("Auto backup disabled")
			return nil
		}

		if scheduleEnable || scheduleInterval != "" || scheduleRemote != "" || scheduleBranch != "" {
			schedule, err := s.GetSchedule()
			if err != nil {
				return err
			}

			if scheduleInterval != "" {
				hours, err := scheduler.ParseInterval(scheduleInterval)
				if err != nil {
					return err
				}
				schedule.Interval = scheduleInterval
				schedule.IntervalHours = hours
			}

			if scheduleRemote != "" {
				schedule.Remote = scheduleRemote
			}
			if scheduleBranch != "" {
				schedule.Branch = scheduleBranch
			}

			schedule.Enabled = true

			if err := s.SaveSchedule(schedule); err != nil {
				return err
			}

			if err := s.SetupCronJob(); err != nil {
				fmt.Printf("Warning: failed to setup cron job: %v\n", err)
				fmt.Println("You may need to setup the backup task manually")
			}

			fmt.Println("Auto backup schedule updated:")
			fmt.Printf("  Enabled: %v\n", schedule.Enabled)
			fmt.Printf("  Interval: %s (%d hours)\n", schedule.Interval, schedule.IntervalHours)
			if schedule.Remote != "" {
				fmt.Printf("  Remote: %s\n", schedule.Remote)
			}
			fmt.Printf("  Branch: %s\n", schedule.Branch)
			return nil
		}

		schedule, err := s.GetSchedule()
		if err != nil {
			return err
		}

		fmt.Println("Current backup schedule:")
		fmt.Printf("  Enabled: %v\n", schedule.Enabled)
		fmt.Printf("  Interval: %s (%d hours)\n", schedule.Interval, schedule.IntervalHours)
		if schedule.Remote != "" {
			fmt.Printf("  Remote: %s\n", schedule.Remote)
		}
		fmt.Printf("  Branch: %s\n", schedule.Branch)
		if schedule.LastBackup != "" {
			fmt.Printf("  Last Backup: %s\n", schedule.LastBackup)
		}

		if !schedule.Enabled {
			fmt.Println("\nEnable auto backup: snippets schedule --enable -i daily -R <remote>")
		}

		return nil
	},
}

func init() {
	scheduleCmd.Flags().BoolVarP(&scheduleEnable, "enable", "e", false, "Enable auto backup")
	scheduleCmd.Flags().BoolVarP(&scheduleDisable, "disable", "d", false, "Disable auto backup")
	scheduleCmd.Flags().StringVarP(&scheduleInterval, "interval", "i", "", "Backup interval (hourly, daily, weekly, NNh)")
	scheduleCmd.Flags().StringVarP(&scheduleRemote, "remote", "R", "", "Git remote URL")
	scheduleCmd.Flags().StringVarP(&scheduleBranch, "branch", "b", "", "Git branch name")
	scheduleCmd.Flags().BoolVarP(&scheduleRun, "run", "r", false, "Run backup now")
}
