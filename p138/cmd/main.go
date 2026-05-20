package main

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"log"
	"net"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/cilium/ebpf/link"
	"github.com/cilium/ebpf/ringbuf"
	"github.com/spf13/cobra"

	"github.com/ebpf-http-latency/internal/container"
	"github.com/ebpf-http-latency/internal/database"
	"github.com/ebpf-http-latency/internal/flamegraph"
	"github.com/ebpf-http-latency/internal/tui"
)

//go:generate go run github.com/cilium/ebpf/cmd/bpf2go -cc clang-14 -cflags "-O2 -g -Wall -Werror" bpf ../ebpf/http_latency.bpf.c

var (
	outputFile    string
	dbPath        string
	enableDB      bool
	enableTop     bool
	httpThreshold float64
	grpcThreshold float64
	mysqlThreshold float64
	enableCgroup  bool
)

type Event struct {
	Pid        uint32
	Tgid       uint32
	RequestTs  uint64
	ResponseTs uint64
	LatencyNs  uint64
	Comm       [16]byte
	Sport      uint16
	Dport      uint16
	Saddr      uint32
	Daddr      uint32
	Protocol   uint8
	IsRequest  uint8
	IsResponse uint8
}

var protocolNames = map[uint8]string{
	1: "HTTP",
	2: "gRPC",
	3: "MySQL",
}

var rootCmd = &cobra.Command{
	Use:   "http-latency",
	Short: "eBPF-based HTTP/gRPC/MySQL latency monitoring tool",
	Run:   runMonitor,
}

func init() {
	rootCmd.PersistentFlags().StringVarP(&outputFile, "output", "o", "latency.folded", "Output file for flamegraph data")
	rootCmd.PersistentFlags().StringVarP(&dbPath, "db", "d", "http_latency.db", "SQLite database path")
	rootCmd.PersistentFlags().BoolVar(&enableDB, "enable-db", true, "Enable database storage")
	rootCmd.PersistentFlags().BoolVar(&enableTop, "top", true, "Enable real-time top UI")
	rootCmd.PersistentFlags().Float64Var(&httpThreshold, "http-threshold", 500.0, "HTTP latency threshold in ms for alerts")
	rootCmd.PersistentFlags().Float64Var(&grpcThreshold, "grpc-threshold", 300.0, "gRPC latency threshold in ms for alerts")
	rootCmd.PersistentFlags().Float64Var(&mysqlThreshold, "mysql-threshold", 200.0, "MySQL latency threshold in ms for alerts")
	rootCmd.PersistentFlags().BoolVar(&enableCgroup, "container", true, "Enable container ID detection")
}

func runMonitor(cmd *cobra.Command, args []string) {
	var objs bpfObjects
	if err := loadBpfObjects(&objs, nil); err != nil {
		log.Fatalf("loading objects: %v", err)
	}
	defer objs.Close()

	acceptLink, err := link.Kprobe("inet_csk_accept", objs.KprobeInetCskAccept, nil)
	if err != nil {
		log.Fatalf("linking inet_csk_accept kprobe: %v", err)
	}
	defer acceptLink.Close()

	sendmsgLink, err := link.Kprobe("tcp_sendmsg", objs.KprobeTcpSendmsg, nil)
	if err != nil {
		log.Fatalf("linking tcp_sendmsg kprobe: %v", err)
	}
	defer sendmsgLink.Close()

	recvmsgLink, err := link.Kprobe("tcp_recvmsg", objs.KprobeTcpRecvmsg, nil)
	if err != nil {
		log.Printf("warning: tcp_recvmsg kprobe not available: %v", err)
	} else {
		defer recvmsgLink.Close()
	}

	rd, err := ringbuf.NewReader(objs.Events)
	if err != nil {
		log.Fatalf("opening ringbuf reader: %v", err)
	}
	defer rd.Close()

	var db *database.Database
	if enableDB {
		db, err = database.New(dbPath)
		if err != nil {
			log.Fatalf("opening database: %v", err)
		}
		defer db.Close()
	}

	var fg *flamegraph.Flamegraph
	if outputFile != "" {
		fg = flamegraph.New()
	}

	var topUI *tui.TopUI
	if enableTop {
		topUI = tui.NewTopUI()
		topUI.SetThreshold("HTTP", httpThreshold)
		topUI.SetThreshold("gRPC", grpcThreshold)
		topUI.SetThreshold("MySQL", mysqlThreshold)
		topUI.SetAlertCallback(func(alert *tui.Alert) {
			log.Printf("🚨 ALERT [%s] %s: %.2fms", alert.Protocol, alert.Message, alert.Latency)
		})
	}

	stopper := make(chan os.Signal, 1)
	signal.Notify(stopper, os.Interrupt, syscall.SIGTERM)

	eventChan := make(chan Event, 1024)

	go func() {
		var event Event
		for {
			record, err := rd.Read()
			if err != nil {
				if ringbuf.IsClosed(err) {
					close(eventChan)
					return
				}
				log.Printf("reading from ringbuf: %v", err)
				continue
			}

			if len(record.RawSample) < binary.Size(event) {
				continue
			}

			if err := binary.Read(bytes.NewBuffer(record.RawSample), binary.LittleEndian, &event); err != nil {
				log.Printf("parsing event: %v", err)
				continue
			}

			eventChan <- event
		}
	}()

	go func() {
		for event := range eventChan {
			processEvent(event, db, fg, topUI)
		}
	}()

	if enableTop && topUI != nil {
		go func() {
			<-stopper
			log.Println("Received signal, exiting...")
			topUI.Stop()
			rd.Close()

			if fg != nil {
				if err := fg.WriteFolded(outputFile); err != nil {
					log.Printf("writing flamegraph data: %v", err)
				}
				log.Printf("Flamegraph data written to %s", outputFile)
			}
		}()

		if err := topUI.Run(); err != nil {
			log.Fatalf("running UI: %v", err)
		}
	} else {
		<-stopper
		log.Println("Received signal, exiting...")
		rd.Close()

		if fg != nil {
			if err := fg.WriteFolded(outputFile); err != nil {
				log.Printf("writing flamegraph data: %v", err)
			}
			log.Printf("Flamegraph data written to %s", outputFile)
		}
	}
}

func processEvent(event Event, db *database.Database, fg *flamegraph.Flamegraph, topUI *tui.TopUI) {
	saddr := intToIP(event.Saddr)
	daddr := intToIP(event.Daddr)
	comm := nullTerminatedString(event.Comm[:])
	protocol := protocolNames[event.Protocol]

	containerID := ""
	if enableCgroup {
		containerID = container.GetContainerID(int(event.Tgid))
	}

	latencyMs := float64(event.LatencyNs) / 1000000

	if event.IsResponse == 1 {
		if !enableTop {
			fmt.Printf("PID: %d, Comm: %s, Proto: %s, Src: %s:%d, Dst: %s:%d, Latency: %.2fms, Container: %s\n",
				event.Tgid, comm, protocol, saddr, event.Sport, daddr, ntohs(event.Dport), latencyMs, containerID)
		}

		if fg != nil && protocol != "" {
			fg.AddRecord(comm, latencyMs, protocol)
		}

		if db != nil && protocol != "" {
			err := db.InsertRecord(&database.Record{
				PID:         int(event.Tgid),
				Comm:        comm,
				SourceAddr:  fmt.Sprintf("%s:%d", saddr, event.Sport),
				DestAddr:    fmt.Sprintf("%s:%d", daddr, ntohs(event.Dport)),
				LatencyMs:   latencyMs,
				ContainerID: containerID,
				Protocol:    protocol,
				Timestamp:   time.Now(),
			})
			if err != nil {
				log.Printf("inserting record: %v", err)
			}
		}
	}

	if topUI != nil {
		topUI.RecordEvent(int(event.Tgid), comm, containerID, protocol, latencyMs, event.IsRequest == 1, event.IsResponse == 1)
	}
}

func ntohs(port uint16) uint16 {
	return (port>>8)&0xFF | (port&0xFF)<<8
}

func intToIP(ip uint32) net.IP {
	return net.IPv4(
		byte(ip),
		byte(ip>>8),
		byte(ip>>16),
		byte(ip>>24),
	)
}

func nullTerminatedString(b []byte) string {
	for i, c := range b {
		if c == 0 {
			return string(b[:i])
		}
	}
	return string(b)
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
