package main

import (
	"context"
	"fmt"
	"net"
	"net/url"
	"os"
	"strings"

	"github.com/spf13/cobra"
	"github.com/ebpf-cni/netpol-ebpf/pkg/ebpf"
)

var (
	rootCmd = &cobra.Command{
		Use:   "netpol-cli",
		Short: "CLI tool for managing eBPF L7 network policies",
		Long:  `A command line interface for managing and monitoring eBPF-based Layer 7 network policies.`,
	}

	iface string
)

func init() {
	rootCmd.PersistentFlags().StringVarP(&iface, "iface", "i", "eth0", "Network interface")

	rootCmd.AddCommand(rulesCmd)
	rootCmd.AddCommand(addRuleCmd)
	rootCmd.AddCommand(deleteRuleCmd)
	rootCmd.AddCommand(monitorCmd)

	addRuleCmd.Flags().String("src-ip", "", "Source IP address")
	addRuleCmd.Flags().String("dst-ip", "0.0.0.0", "Destination IP address")
	addRuleCmd.Flags().Uint16("dst-port", 80, "Destination port")
	addRuleCmd.Flags().Uint8("proto", 6, "Protocol (6=TCP, 17=UDP)")
	addRuleCmd.Flags().String("type", "http", "Rule type (http/grpc)")
	addRuleCmd.Flags().String("action", "deny", "Action (allow/deny)")
	addRuleCmd.Flags().String("path", "", "HTTP path pattern")
	addRuleCmd.Flags().String("method", "", "HTTP method")

	deleteRuleCmd.Flags().String("src-ip", "", "Source IP address")
	deleteRuleCmd.Flags().String("dst-ip", "0.0.0.0", "Destination IP address")
	deleteRuleCmd.Flags().Uint16("dst-port", 80, "Destination port")
	deleteRuleCmd.Flags().Uint8("proto", 6, "Protocol (6=TCP, 17=UDP)")
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}

var rulesCmd = &cobra.Command{
	Use:   "rules",
	Short: "List all L7 rules",
	Run: func(cmd *cobra.Command, args []string) {
		manager := ebpf.NewManager(iface)
		if err := manager.Load(); err != nil {
			fmt.Printf("Error loading eBPF program: %v\n", err)
			return
		}
		defer manager.Close()

		rules, err := manager.ListRules()
		if err != nil {
			fmt.Printf("Error listing rules: %v\n", err)
			return
		}

		fmt.Println("=== L7 Network Policy Rules ===")
		for i, r := range rules {
			typeStr := "HTTP"
			if r.Rule.Type == 2 {
				typeStr = "GRPC"
			}
			actionStr := "DENY"
			if r.Rule.Action == 1 {
				actionStr = "ALLOW"
			}
			path := strings.TrimRight(string(r.Rule.Path[:]), "\x00")
			method := strings.TrimRight(string(r.Rule.Method[:]), "\x00")

			fmt.Printf("Rule %d:\n", i+1)
			fmt.Printf("  SrcIP: %s\n", ebpf.Uint32ToIP(r.Key.SrcIP))
			fmt.Printf("  DstIP: %s\n", ebpf.Uint32ToIP(r.Key.DstIP))
			fmt.Printf("  DstPort: %d\n", r.Key.DstPort)
			fmt.Printf("  Proto: %d\n", r.Key.Proto)
			fmt.Printf("  Type: %s\n", typeStr)
			fmt.Printf("  Action: %s\n", actionStr)
			fmt.Printf("  Path: %s\n", path)
			fmt.Printf("  Method: %s\n", method)
			fmt.Println()
		}
		fmt.Printf("Total: %d rules\n", len(rules))
	},
}

var addRuleCmd = &cobra.Command{
	Use:   "add-rule",
	Short: "Add a new L7 rule",
	Run: func(cmd *cobra.Command, args []string) {
		srcIPStr, _ := cmd.Flags().GetString("src-ip")
		dstIPStr, _ := cmd.Flags().GetString("dst-ip")
		dstPort, _ := cmd.Flags().GetUint16("dst-port")
		proto, _ := cmd.Flags().GetUint8("proto")
		ruleTypeStr, _ := cmd.Flags().GetString("type")
		actionStr, _ := cmd.Flags().GetString("action")
		path, _ := cmd.Flags().GetString("path")
		method, _ := cmd.Flags().GetString("method")

		if srcIPStr == "" {
			fmt.Println("Error: --src-ip is required")
			return
		}

		srcIP := net.ParseIP(srcIPStr)
		if srcIP == nil {
			fmt.Printf("Invalid source IP: %s\n", srcIPStr)
			return
		}

		dstIP := net.ParseIP(dstIPStr)
		if dstIP == nil {
			fmt.Printf("Invalid destination IP: %s\n", dstIPStr)
			return
		}

		var ruleType uint8
		switch strings.ToLower(ruleTypeStr) {
		case "http":
			ruleType = ebpf.HTTPType
		case "grpc":
			ruleType = ebpf.GRPCType
		default:
			fmt.Printf("Invalid rule type: %s\n", ruleTypeStr)
			return
		}

		var action uint8
		switch strings.ToLower(actionStr) {
		case "deny":
			action = ebpf.ActionDeny
		case "allow":
			action = ebpf.ActionAllow
		default:
			fmt.Printf("Invalid action: %s\n", actionStr)
			return
		}

		normalizedPath := path
		if decodedPath, err := url.QueryUnescape(path); err == nil {
			normalizedPath = decodedPath
		}

		manager := ebpf.NewManager(iface)
		if err := manager.Load(); err != nil {
			fmt.Printf("Error loading eBPF program: %v\n", err)
			return
		}
		defer manager.Close()

		if err := manager.AddRule(srcIP, dstIP, dstPort, proto, ruleType, action, normalizedPath, method); err != nil {
			fmt.Printf("Error adding rule: %v\n", err)
			return
		}

		if normalizedPath != path {
			fmt.Printf("Rule added successfully! (path normalized from '%s' to '%s')\n", path, normalizedPath)
		} else {
			fmt.Println("Rule added successfully!")
		}
	},
}

var deleteRuleCmd = &cobra.Command{
	Use:   "delete-rule",
	Short: "Delete a L7 rule",
	Run: func(cmd *cobra.Command, args []string) {
		srcIPStr, _ := cmd.Flags().GetString("src-ip")
		dstIPStr, _ := cmd.Flags().GetString("dst-ip")
		dstPort, _ := cmd.Flags().GetUint16("dst-port")
		proto, _ := cmd.Flags().GetUint8("proto")

		if srcIPStr == "" {
			fmt.Println("Error: --src-ip is required")
			return
		}

		srcIP := net.ParseIP(srcIPStr)
		if srcIP == nil {
			fmt.Printf("Invalid source IP: %s\n", srcIPStr)
			return
		}

		dstIP := net.ParseIP(dstIPStr)
		if dstIP == nil {
			fmt.Printf("Invalid destination IP: %s\n", dstIPStr)
			return
		}

		manager := ebpf.NewManager(iface)
		if err := manager.Load(); err != nil {
			fmt.Printf("Error loading eBPF program: %v\n", err)
			return
		}
		defer manager.Close()

		if err := manager.DeleteRule(srcIP, dstIP, dstPort, proto); err != nil {
			fmt.Printf("Error deleting rule: %v\n", err)
			return
		}

		fmt.Println("Rule deleted successfully!")
	},
}

var monitorCmd = &cobra.Command{
	Use:   "monitor",
	Short: "Monitor policy events",
	Run: func(cmd *cobra.Command, args []string) {
		manager := ebpf.NewManager(iface)
		if err := manager.Load(); err != nil {
			fmt.Printf("Error loading eBPF program: %v\n", err)
			return
		}
		defer manager.Close()

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		manager.Start(ctx)

		fmt.Println("Monitoring policy events... (Press Ctrl+C to exit)")
		fmt.Println("================================================================================")

		for event := range manager.Events() {
			action := "ALLOW"
			if event.Action == 0 {
				action = "DENY"
			}
			typeStr := "HTTP"
			if event.Type == 2 {
				typeStr = "GRPC"
			}
			path := strings.TrimRight(event.GetPath(), "\x00")
			method := strings.TrimRight(event.GetMethod(), "\x00")

			fmt.Printf("[%s] %s:%d -> %s Path: %s Method: %s\n",
				action,
				event.GetSrcIP(),
				event.DstPort,
				typeStr,
				path,
				method)
		}
	},
}
