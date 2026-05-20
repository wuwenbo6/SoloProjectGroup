package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net"
	"os"
	"os/signal"
	"syscall"

	"github.com/ebpf-cni/netpol-ebpf/pkg/ebpf"
	"github.com/ebpf-cni/netpol-ebpf/pkg/k8s"
	"github.com/ebpf-cni/netpol-ebpf/pkg/loki"
	"github.com/ebpf-cni/netpol-ebpf/pkg/podwatcher"
	"github.com/ebpf-cni/netpol-ebpf/pkg/policy"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
)

var (
	iface       = flag.String("iface", "eth0", "Network interface to attach eBPF program")
	kubeconfig  = flag.String("kubeconfig", "", "Path to kubeconfig file")
	lokiURL     = flag.String("loki-url", "", "Loki server URL for connection logging")
	mirrorIP    = flag.String("mirror-ip", "", "Mirror target IP address")
	mirrorPort  = flag.Uint("mirror-port", 0, "Mirror target port")
)

func main() {
	flag.Parse()

	fmt.Println("=== eBPF L7 Network Policy Daemon with Traffic Mirroring & Rate Limiting ===")
	fmt.Printf("Interface: %s\n", *iface)
	if *lokiURL != "" {
		fmt.Printf("Loki URL: %s\n", *lokiURL)
	}
	if *mirrorIP != "" {
		fmt.Printf("Mirror Target: %s:%d\n", *mirrorIP, *mirrorPort)
	}
	fmt.Println("===============================================================================")

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	ebpfManager := ebpf.NewManager(*iface)
	if err := ebpfManager.Load(); err != nil {
		log.Fatalf("Failed to load eBPF program: %v", err)
	}
	defer ebpfManager.Close()
	fmt.Println("eBPF program loaded and attached successfully")

	ebpfManager.Start(ctx)

	go func() {
		for event := range ebpfManager.Events() {
			action := "ALLOW"
			if event.Action == ebpf.ActionDeny {
				action = "DENY"
			} else if event.Action == ebpf.ActionRateLimit {
				action = "RATE_LIMIT"
			}
			typeStr := "HTTP"
			if event.Type == 2 {
				typeStr = "GRPC"
			}
			fmt.Printf("[%s] %s:%d -> %s Path: %s Method: %s\n",
				action,
				event.GetSrcIP(),
				event.DstPort,
				typeStr,
				event.GetPath(),
				event.GetMethod())
		}
	}()

	if *lokiURL != "" {
		lokiClient := loki.NewClient(*lokiURL, map[string]string{
			"node": os.Getenv("NODE_NAME"),
		})
		lokiClient.Start()
		defer lokiClient.Stop()
		
		go func() {
			for event := range ebpfManager.ConnLogEvents() {
				lokiClient.Events() <- event
			}
		}()
		fmt.Println("Loki connection logging enabled")
	} else {
		go func() {
			for range ebpfManager.ConnLogEvents() {
			}
		}()
	}

	if *mirrorIP != "" && *mirrorPort > 0 {
		if err := ebpfManager.SetMirrorConfig(
			true,
			net.ParseIP(*mirrorIP),
			uint16(*mirrorPort),
			true,
			true,
		); err != nil {
			log.Printf("Warning: Failed to set mirror config: %v", err)
		} else {
			fmt.Println("Traffic mirroring enabled")
		}
	}

	k8sClient, err := createK8sClient()
	if err != nil {
		log.Fatalf("Failed to create K8s client: %v", err)
	}

	watcher, err := k8s.NewWatcher()
	if err != nil {
		log.Fatalf("Failed to create K8s policy watcher: %v", err)
	}

	converter := policy.NewConverter(ebpfManager)

	watcher.OnAdd(converter.HandlePolicyAdd)
	watcher.OnUpdate(converter.HandlePolicyUpdate)
	watcher.OnDelete(converter.HandlePolicyDelete)

	if err := watcher.Start(ctx); err != nil {
		log.Fatalf("Failed to start K8s policy watcher: %v", err)
	}
	fmt.Println("L7 policy watcher started")

	podWatcher := podwatcher.NewWatcher(k8sClient, ebpfManager)
	
	podWatcher.AddPolicy(podwatcher.RateLimitPolicy{
		LabelSelector:  map[string]string{"app": "high-traffic"},
		BytesPerSecond: 1024 * 1024,
		PacketsPerSecond: 1000,
	})
	
	podWatcher.AddPolicy(podwatcher.RateLimitPolicy{
		LabelSelector:  map[string]string{"tier": "frontend"},
		BytesPerSecond: 5 * 1024 * 1024,
		PacketsPerSecond: 5000,
	})

	if err := podWatcher.Start(); err != nil {
		log.Fatalf("Failed to start pod watcher: %v", err)
	}
	defer podWatcher.Stop()
	fmt.Println("Pod rate limit watcher started")

	fmt.Println("\nDaemon started successfully. Press Ctrl+C to exit")

	<-sigCh
	fmt.Println("\nShutting down...")
	cancel()
}

func createK8sClient() (*kubernetes.Clientset, error) {
	config, err := clientcmd.BuildConfigFromFlags("", *kubeconfig)
	if err != nil {
		return nil, fmt.Errorf("building kubeconfig: %v", err)
	}

	return kubernetes.NewForConfig(config)
}
