package ebpf

import (
	"context"
	"fmt"
	"log"
	"net"
	"os"
	"path/filepath"
	"sync"

	"github.com/cilium/ebpf"
	"github.com/cilium/ebpf/link"
	"github.com/cilium/ebpf/perf"
)

//go:generate go run github.com/cilium/ebpf/cmd/bpf2go -cc clang -cflags "-O2 -g -Wall -Werror" bpf ../../bpf/netpol.c

type Manager struct {
	objs             *bpfObjects
	egressLink       link.Link
	ingressLink      link.Link
	perfReader       *perf.Reader
	connLogPerfReader *perf.Reader
	eventChan        chan Event
	connLogChan      chan ConnLogEvent
	iface            string
	mapMu            sync.RWMutex
}

func NewManager(iface string) *Manager {
	return &Manager{
		iface:       iface,
		eventChan:   make(chan Event, 1024),
		connLogChan: make(chan ConnLogEvent, 1024),
	}
}

func (m *Manager) Load() error {
	objs := &bpfObjects{}
	if err := loadBpfObjects(objs, nil); err != nil {
		return fmt.Errorf("loading objects: %v", err)
	}
	m.objs = objs

	iface, err := net.InterfaceByName(m.iface)
	if err != nil {
		return fmt.Errorf("getting interface %s: %v", m.iface, err)
	}

	egressLink, err := link.AttachTCX(link.TCXOptions{
		Interface: iface.Index,
		Program:   objs.NetpolEgress,
		Attach:    ebpf.AttachTCXEgress,
	})
	if err != nil {
		return fmt.Errorf("attaching egress TCX: %v", err)
	}
	m.egressLink = egressLink

	ingressLink, err := link.AttachTCX(link.TCXOptions{
		Interface: iface.Index,
		Program:   objs.NetpolIngress,
		Attach:    ebpf.AttachTCXIngress,
	})
	if err != nil {
		return fmt.Errorf("attaching ingress TCX: %v", err)
	}
	m.ingressLink = ingressLink

	perfReader, err := perf.NewReader(objs.Events, os.Getpagesize()*4)
	if err != nil {
		return fmt.Errorf("creating perf reader: %v", err)
	}
	m.perfReader = perfReader

	connLogPerfReader, err := perf.NewReader(objs.ConnLogEvents, os.Getpagesize()*4)
	if err != nil {
		return fmt.Errorf("creating conn log perf reader: %v", err)
	}
	m.connLogPerfReader = connLogPerfReader

	return nil
}

func (m *Manager) Start(ctx context.Context) {
	go m.readEvents(ctx)
	go m.readConnLogEvents(ctx)
}

func (m *Manager) readEvents(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
			record, err := m.perfReader.Read()
			if err != nil {
				if perf.IsClosed(err) {
					return
				}
				log.Printf("Error reading perf event: %v", err)
				continue
			}

			if record.LostSamples != 0 {
				log.Printf("Lost %d perf events", record.LostSamples)
				continue
			}

			if len(record.RawSample) >= 80 {
				var event Event
				event.SrcIP = uint32(record.RawSample[0]) | uint32(record.RawSample[1])<<8 | uint32(record.RawSample[2])<<16 | uint32(record.RawSample[3])<<24
				event.DstIP = uint32(record.RawSample[4]) | uint32(record.RawSample[5])<<8 | uint32(record.RawSample[6])<<16 | uint32(record.RawSample[7])<<24
				event.DstPort = uint16(record.RawSample[8]) | uint16(record.RawSample[9])<<8
				event.Proto = record.RawSample[10]
				event.Action = record.RawSample[11]
				event.Type = record.RawSample[12]
				copy(event.Path[:], record.RawSample[13:13+MaxPathLen])
				copy(event.Method[:], record.RawSample[13+MaxPathLen:13+MaxPathLen+MaxMethodLen])
				m.eventChan <- event
			}
		}
	}
}

func (m *Manager) Events() <-chan Event {
	return m.eventChan
}

func (m *Manager) ConnLogEvents() <-chan ConnLogEvent {
	return m.connLogChan
}

func (m *Manager) readConnLogEvents(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
			record, err := m.connLogPerfReader.Read()
			if err != nil {
				if perf.IsClosed(err) {
					return
				}
				log.Printf("Error reading conn log event: %v", err)
				continue
			}

			if record.LostSamples != 0 {
				log.Printf("Lost %d conn log events", record.LostSamples)
				continue
			}

			if len(record.RawSample) >= 64 {
				var event ConnLogEvent
				event.SrcIP = uint32(record.RawSample[0]) | uint32(record.RawSample[1])<<8 | uint32(record.RawSample[2])<<16 | uint32(record.RawSample[3])<<24
				event.DstIP = uint32(record.RawSample[4]) | uint32(record.RawSample[5])<<8 | uint32(record.RawSample[6])<<16 | uint32(record.RawSample[7])<<24
				event.SrcPort = uint16(record.RawSample[8]) | uint16(record.RawSample[9])<<8
				event.DstPort = uint16(record.RawSample[10]) | uint16(record.RawSample[11])<<8
				event.Proto = record.RawSample[12]
				event.TCPFlags = record.RawSample[13]
				
				offset := 16
				event.BytesTx = uint64(record.RawSample[offset]) | uint64(record.RawSample[offset+1])<<8 | uint64(record.RawSample[offset+2])<<16 | uint64(record.RawSample[offset+3])<<24 | uint64(record.RawSample[offset+4])<<32 | uint64(record.RawSample[offset+5])<<40 | uint64(record.RawSample[offset+6])<<48 | uint64(record.RawSample[offset+7])<<56
				offset += 8
				event.BytesRx = uint64(record.RawSample[offset]) | uint64(record.RawSample[offset+1])<<8 | uint64(record.RawSample[offset+2])<<16 | uint64(record.RawSample[offset+3])<<24 | uint64(record.RawSample[offset+4])<<32 | uint64(record.RawSample[offset+5])<<40 | uint64(record.RawSample[offset+6])<<48 | uint64(record.RawSample[offset+7])<<56
				offset += 8
				event.PacketsTx = uint64(record.RawSample[offset]) | uint64(record.RawSample[offset+1])<<8 | uint64(record.RawSample[offset+2])<<16 | uint64(record.RawSample[offset+3])<<24 | uint64(record.RawSample[offset+4])<<32 | uint64(record.RawSample[offset+5])<<40 | uint64(record.RawSample[offset+6])<<48 | uint64(record.RawSample[offset+7])<<56
				offset += 8
				event.PacketsRx = uint64(record.RawSample[offset]) | uint64(record.RawSample[offset+1])<<8 | uint64(record.RawSample[offset+2])<<16 | uint64(record.RawSample[offset+3])<<24 | uint64(record.RawSample[offset+4])<<32 | uint64(record.RawSample[offset+5])<<40 | uint64(record.RawSample[offset+6])<<48 | uint64(record.RawSample[offset+7])<<56
				offset += 8
				event.DurationMs = uint64(record.RawSample[offset]) | uint64(record.RawSample[offset+1])<<8 | uint64(record.RawSample[offset+2])<<16 | uint64(record.RawSample[offset+3])<<24 | uint64(record.RawSample[offset+4])<<32 | uint64(record.RawSample[offset+5])<<40 | uint64(record.RawSample[offset+6])<<48 | uint64(record.RawSample[offset+7])<<56
				offset += 8
				event.Timestamp = uint64(record.RawSample[offset]) | uint64(record.RawSample[offset+1])<<8 | uint64(record.RawSample[offset+2])<<16 | uint64(record.RawSample[offset+3])<<24 | uint64(record.RawSample[offset+4])<<32 | uint64(record.RawSample[offset+5])<<40 | uint64(record.RawSample[offset+6])<<48 | uint64(record.RawSample[offset+7])<<56
				offset += 8
				event.Action = record.RawSample[offset]
				
				m.connLogChan <- event
			}
		}
	}
}

func (m *Manager) AddRateLimitRule(podIP net.IP, bytesPerSec, packetsPerSec uint64, podLabel string) error {
	key := RateLimitKey{PodIP: IPToUint32(podIP)}
	
	rule := RateLimitRule{
		BytesPerSecond:   bytesPerSec,
		PacketsPerSecond: packetsPerSec,
		Enabled:          1,
	}
	
	labelBytes := []byte(podLabel)
	for i := 0; i < MaxLabelLen && i < len(labelBytes); i++ {
		rule.PodLabel[i] = labelBytes[i]
	}

	m.mapMu.Lock()
	defer m.mapMu.Unlock()
	return m.objs.RateLimits.Put(key, rule)
}

func (m *Manager) DeleteRateLimitRule(podIP net.IP) error {
	key := RateLimitKey{PodIP: IPToUint32(podIP)}
	
	m.mapMu.Lock()
	defer m.mapMu.Unlock()
	return m.objs.RateLimits.Delete(key)
}

func (m *Manager) SetMirrorConfig(enabled bool, targetIP net.IP, targetPort uint16, mirrorIngress, mirrorEgress bool) error {
	config := MirrorConfig{
		TargetIP:      IPToUint32(targetIP),
		TargetPort:    targetPort,
	}
	
	if enabled {
		config.Enabled = 1
	}
	if mirrorIngress {
		config.MirrorIngress = 1
	}
	if mirrorEgress {
		config.MirrorEgress = 1
	}
	
	key := uint32(0)
	m.mapMu.Lock()
	defer m.mapMu.Unlock()
	return m.objs.MirrorCfg.Put(key, config)
}

func (m *Manager) AddRule(srcIP, dstIP net.IP, dstPort uint16, proto uint8, ruleType uint8, action uint8, path, method string) error {
	key := L7Key{
		SrcIP:   IPToUint32(srcIP),
		DstIP:   IPToUint32(dstIP),
		DstPort: dstPort,
		Proto:   proto,
	}

	rule := L7Rule{
		Type:   ruleType,
		Action: action,
	}

	pathBytes := []byte(path)
	for i := 0; i < MaxPathLen && i < len(pathBytes); i++ {
		rule.Path[i] = pathBytes[i]
	}

	methodBytes := []byte(method)
	for i := 0; i < MaxMethodLen && i < len(methodBytes); i++ {
		rule.Method[i] = methodBytes[i]
	}

	m.mapMu.Lock()
	defer m.mapMu.Unlock()
	return m.objs.L7Rules.Put(key, rule)
}

func (m *Manager) DeleteRule(srcIP, dstIP net.IP, dstPort uint16, proto uint8) error {
	key := L7Key{
		SrcIP:   IPToUint32(srcIP),
		DstIP:   IPToUint32(dstIP),
		DstPort: dstPort,
		Proto:   proto,
	}

	m.mapMu.Lock()
	defer m.mapMu.Unlock()
	return m.objs.L7Rules.Delete(key)
}

func (m *Manager) ListRules() ([]struct {
	Key  L7Key
	Rule L7Rule
}, error) {
	var rules []struct {
		Key  L7Key
		Rule L7Rule
	}

	m.mapMu.RLock()
	defer m.mapMu.RUnlock()

	var key L7Key
	var rule L7Rule
	iter := m.objs.L7Rules.Iterate()
	for iter.Next(&key, &rule) {
		rules = append(rules, struct {
			Key  L7Key
			Rule L7Rule
		}{key, rule})
	}

	return rules, iter.Err()
}

func (m *Manager) Close() error {
	if m.perfReader != nil {
		m.perfReader.Close()
	}
	if m.connLogPerfReader != nil {
		m.connLogPerfReader.Close()
	}
	if m.egressLink != nil {
		m.egressLink.Close()
	}
	if m.ingressLink != nil {
		m.ingressLink.Close()
	}
	if m.objs != nil {
		m.objs.Close()
	}
	close(m.eventChan)
	close(m.connLogChan)
	return nil
}

func LoadBPFProgram(bpfPath string) (*ebpf.CollectionSpec, error) {
	return ebpf.LoadCollectionSpec(filepath.Clean(bpfPath))
}
