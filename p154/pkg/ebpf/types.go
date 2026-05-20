package ebpf

import (
    "net"
    "time"
)

const (
    MaxRules     = 1024
    MaxPathLen   = 64
    MaxMethodLen = 32
    MaxLabelLen  = 64

    HTTPType = 1
    GRPCType = 2

    ActionAllow    = 1
    ActionDeny     = 0
    ActionRateLimit = 2
)

type L7Key struct {
    SrcIP   uint32
    DstIP   uint32
    DstPort uint16
    Proto   uint8
}

type L7Rule struct {
    Type   uint8
    Action uint8
    Path   [MaxPathLen]byte
    Method [MaxMethodLen]byte
}

type ConnState struct {
    Seq        uint32
    Ack        uint32
    HTTPParsed uint8
    GRPCParsed uint8
    BytesTx    uint64
    BytesRx    uint64
    PacketsTx  uint64
    PacketsRx  uint64
    TsStart    uint64
}

type Event struct {
    SrcIP   uint32
    DstIP   uint32
    DstPort uint16
    Proto   uint8
    Action  uint8
    Type    uint8
    Path    [MaxPathLen]byte
    Method  [MaxMethodLen]byte
}

type MirrorConfig struct {
    Enabled      uint32
    TargetIP     uint32
    TargetPort   uint16
    MirrorIngress uint8
    MirrorEgress  uint8
}

type RateLimitKey struct {
    PodIP uint32
}

type RateLimitRule struct {
    BytesPerSecond   uint64
    PacketsPerSecond uint64
    LastUpdate       uint64
    BytesUsed        uint64
    PacketsUsed      uint64
    PodLabel         [MaxLabelLen]byte
    Enabled          uint8
}

type ConnLogEvent struct {
    SrcIP      uint32
    DstIP      uint32
    SrcPort    uint16
    DstPort    uint16
    Proto      uint8
    TCPFlags   uint8
    BytesTx    uint64
    BytesRx    uint64
    PacketsTx  uint64
    PacketsRx  uint64
    DurationMs uint64
    Timestamp  uint64
    Action     uint8
}

func (e *Event) GetSrcIP() net.IP {
    return net.IPv4(byte(e.SrcIP), byte(e.SrcIP>>8), byte(e.SrcIP>>16), byte(e.SrcIP>>24))
}

func (e *Event) GetDstIP() net.IP {
    return net.IPv4(byte(e.DstIP), byte(e.DstIP>>8), byte(e.DstIP>>16), byte(e.DstIP>>24))
}

func (e *Event) GetPath() string {
    return string(e.Path[:])
}

func (e *Event) GetMethod() string {
    return string(e.Method[:])
}

func (e *ConnLogEvent) GetSrcIP() net.IP {
    return net.IPv4(byte(e.SrcIP), byte(e.SrcIP>>8), byte(e.SrcIP>>16), byte(e.SrcIP>>24))
}

func (e *ConnLogEvent) GetDstIP() net.IP {
    return net.IPv4(byte(e.DstIP), byte(e.DstIP>>8), byte(e.DstIP>>16), byte(e.DstIP>>24))
}

func (e *ConnLogEvent) GetTime() time.Time {
    return time.Unix(0, int64(e.Timestamp)*1000000)
}

func IPToUint32(ip net.IP) uint32 {
    ipv4 := ip.To4()
    if ipv4 == nil {
        return 0
    }
    return uint32(ipv4[0]) | uint32(ipv4[1])<<8 | uint32(ipv4[2])<<16 | uint32(ipv4[3])<<24
}

func Uint32ToIP(n uint32) net.IP {
    return net.IPv4(byte(n), byte(n>>8), byte(n>>16), byte(n>>24))
}
