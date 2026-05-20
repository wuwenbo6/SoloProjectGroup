package pcap

import (
	"bgp-simulator/internal/bgp"
	"encoding/binary"
	"fmt"
	"net"
	"os"
	"sync"
	"time"
)

const (
	PCAP_MAGIC        = 0xa1b2c3d4
	PCAP_VERSION_MAJOR = 2
	PCAP_VERSION_MINOR = 4
	PCAP_SNAPLEN      = 65535
	PCAP_NETWORK_ETHERNET = 1
	PCAP_NETWORK_RAW = 101

	ETHERTYPE_IP     = 0x0800
	IPPROTO_TCP      = 6
	BGP_PORT         = 179
)

type PCAPGlobalHeader struct {
	MagicNumber  uint32
	VersionMajor uint16
	VersionMinor uint16
	Thiszone     int32
	Sigfigs      uint32
	Snaplen      uint32
	Network      uint32
}

type PCAPPacketHeader struct {
	TsSec   uint32
	TsUsec  uint32
	InclLen uint32
	OrigLen uint32
}

type PacketCapture struct {
	packets     []*bgp.BGPPacket
	mu          sync.RWMutex
	captureAll  bool
	filterASN   []bgp.ASNumber
	filterRouter []string
}

func NewPacketCapture() *PacketCapture {
	return &PacketCapture{
		packets:     make([]*bgp.BGPPacket, 0),
		captureAll:  true,
		filterASN:   make([]bgp.ASNumber, 0),
		filterRouter: make([]string, 0),
	}
}

func (pc *PacketCapture) Capture(packet *bgp.BGPPacket) {
	if !pc.shouldCapture(packet) {
		return
	}

	pc.mu.Lock()
	defer pc.mu.Unlock()
	pc.packets = append(pc.packets, packet)
}

func (pc *PacketCapture) shouldCapture(packet *bgp.BGPPacket) bool {
	if pc.captureAll {
		return true
	}

	for _, asn := range pc.filterASN {
		if packet.SrcASN == asn || packet.DstASN == asn {
			return true
		}
	}

	return false
}

func (pc *PacketCapture) SetCaptureAll(all bool) {
	pc.mu.Lock()
	defer pc.mu.Unlock()
	pc.captureAll = all
}

func (pc *PacketCapture) AddASNFilter(asn bgp.ASNumber) {
	pc.mu.Lock()
	defer pc.mu.Unlock()
	pc.filterASN = append(pc.filterASN, asn)
}

func (pc *PacketCapture) ClearFilters() {
	pc.mu.Lock()
	defer pc.mu.Unlock()
	pc.filterASN = make([]bgp.ASNumber, 0)
	pc.filterRouter = make([]string, 0)
}

func (pc *PacketCapture) GetPackets() []*bgp.BGPPacket {
	pc.mu.RLock()
	defer pc.mu.RUnlock()

	result := make([]*bgp.BGPPacket, len(pc.packets))
	copy(result, pc.packets)
	return result
}

func (pc *PacketCapture) GetPacketCount() int {
	pc.mu.RLock()
	defer pc.mu.RUnlock()
	return len(pc.packets)
}

func (pc *PacketCapture) Clear() {
	pc.mu.Lock()
	defer pc.mu.Unlock()
	pc.packets = make([]*bgp.BGPPacket, 0)
}

func (pc *PacketCapture) ExportToFile(filename string) error {
	pc.mu.RLock()
	defer pc.mu.RUnlock()

	file, err := os.Create(filename)
	if err != nil {
		return err
	}
	defer file.Close()

	globalHeader := PCAPGlobalHeader{
		MagicNumber:  PCAP_MAGIC,
		VersionMajor: PCAP_VERSION_MAJOR,
		VersionMinor: PCAP_VERSION_MINOR,
		Thiszone:     0,
		Sigfigs:      0,
		Snaplen:      PCAP_SNAPLEN,
		Network:      PCAP_NETWORK_RAW,
	}

	if err := binary.Write(file, binary.LittleEndian, globalHeader); err != nil {
		return err
	}

	for _, packet := range pc.packets {
		packetBytes := encodeBGPPacket(packet)

		ts := packet.Timestamp
		packetHeader := PCAPPacketHeader{
			TsSec:   uint32(ts.Unix()),
			TsUsec:  uint32(ts.Nanosecond() / 1000),
			InclLen: uint32(len(packetBytes)),
			OrigLen: uint32(len(packetBytes)),
		}

		if err := binary.Write(file, binary.LittleEndian, packetHeader); err != nil {
			return err
		}

		if _, err := file.Write(packetBytes); err != nil {
			return err
		}
	}

	fmt.Printf("Exported %d packets to %s\n", len(pc.packets), filename)
	return nil
}

func encodeBGPPacket(packet *bgp.BGPPacket) []byte {
	var result []byte

	ipv4Header := encodeIPv4Header(packet.SrcIP, packet.DstIP, IPPROTO_TCP)
	result = append(result, ipv4Header...)

	tcpHeader := encodeTCPHeader(BGP_PORT, BGP_PORT, packet.Type)
	result = append(result, tcpHeader...)

	bgpHeader := encodeBGPHeader(packet.Type)
	result = append(result, bgpHeader...)

	switch packet.Type {
	case bgp.BGPPacketOpen:
		if payload, ok := packet.Payload.(*bgp.BGPOpenPayload); ok {
			result = append(result, encodeBGPOpen(payload)...)
		}
	case bgp.BGPPacketUpdate:
		if payload, ok := packet.Payload.(*bgp.BGPUpdatePayload); ok {
			result = append(result, encodeBGPUpdate(payload)...)
		}
	}

	return result
}

func encodeIPv4Header(srcIP, dstIP net.IP, protocol uint8) []byte {
	header := make([]byte, 20)

	header[0] = 0x45
	header[1] = 0x00
	totalLen := uint16(20 + 20 + 19)
	binary.BigEndian.PutUint16(header[2:4], totalLen)
	binary.BigEndian.PutUint16(header[4:6], 0)
	header[6] = 0x40
	header[7] = 0x00
	header[8] = 64
	header[9] = protocol
	binary.BigEndian.PutUint16(header[10:12], 0)

	copy(header[12:16], srcIP.To4())
	copy(header[16:20], dstIP.To4())

	checksum := calculateChecksum(header)
	binary.BigEndian.PutUint16(header[10:12], checksum)

	return header
}

func encodeTCPHeader(srcPort, dstPort uint16, packetType bgp.BGPPacketType) []byte {
	header := make([]byte, 20)

	binary.BigEndian.PutUint16(header[0:2], srcPort)
	binary.BigEndian.PutUint16(header[2:4], dstPort)
	binary.BigEndian.PutUint32(header[4:8], uint32(packetType))
	binary.BigEndian.PutUint32(header[8:12], 0)
	header[12] = 0x50
	header[13] = 0x18
	binary.BigEndian.PutUint16(header[14:16], 8192)
	binary.BigEndian.PutUint16(header[16:18], 0)
	binary.BigEndian.PutUint16(header[18:20], 0)

	return header
}

func encodeBGPHeader(packetType bgp.BGPPacketType) []byte {
	header := make([]byte, 19)

	for i := 0; i < 16; i++ {
		header[i] = 0xff
	}

	binary.BigEndian.PutUint16(header[16:18], 19)
	header[18] = uint8(packetType)

	return header
}

func encodeBGPOpen(payload *bgp.BGPOpenPayload) []byte {
	data := make([]byte, 10)

	data[0] = payload.Version
	binary.BigEndian.PutUint16(data[1:3], uint16(payload.ASN))
	binary.BigEndian.PutUint16(data[3:5], payload.HoldTime)
	copy(data[5:9], payload.BGPIdentifier.To4())
	data[9] = 0

	return data
}

func encodeBGPUpdate(payload *bgp.BGPUpdatePayload) []byte {
	var data []byte

	withdrawnLen := uint16(0)
	for _, prefix := range payload.WithdrawnRoutes {
		withdrawnLen += 1
		ones, _ := prefix.Mask.Size()
		data = append(data, uint8(ones))
		ip := prefix.IP.To4()
		bytes := (ones + 7) / 8
		data = append(data, ip[:bytes]...)
	}

	pathAttrLen := uint16(0)
	if payload.PathAttributes != nil {
		attrBytes := encodePathAttributes(payload.PathAttributes)
		pathAttrLen = uint16(len(attrBytes))
		data = append(data, attrBytes...)
	}

	nlriLen := uint16(0)
	for _, prefix := range payload.NLRI {
		nlriLen += 1
		ones, _ := prefix.Mask.Size()
		data = append(data, uint8(ones))
		ip := prefix.IP.To4()
		bytes := (ones + 7) / 8
		data = append(data, ip[:bytes]...)
	}

	fullData := make([]byte, 4)
	binary.BigEndian.PutUint16(fullData[0:2], withdrawnLen)
	binary.BigEndian.PutUint16(fullData[2:4], pathAttrLen)
	fullData = append(fullData, data...)

	return fullData
}

func encodePathAttributes(attrs *bgp.BGPPathAttributes) []byte {
	var data []byte

	data = append(data, 0x40)
	data = append(data, 1)
	data = append(data, 1)
	data = append(data, attrs.Origin)

	asPathBytes := encodeASPath(attrs.ASPath)
	data = append(data, 0x40)
	data = append(data, 2)
	data = append(data, uint8(len(asPathBytes)))
	data = append(data, asPathBytes...)

	data = append(data, 0x40)
	data = append(data, 3)
	data = append(data, 4)
	data = append(data, attrs.NextHop.To4()...)

	data = append(data, 0x40)
	data = append(data, 5)
	data = append(data, 4)
	localPrefBytes := make([]byte, 4)
	binary.BigEndian.PutUint32(localPrefBytes, attrs.LocalPref)
	data = append(data, localPrefBytes...)

	return data
}

func encodeASPath(asPath []bgp.ASNumber) []byte {
	var data []byte

	if len(asPath) == 0 {
		return data
	}

	data = append(data, 2)
	data = append(data, uint8(len(asPath)))
	for _, asn := range asPath {
		asnBytes := make([]byte, 2)
		binary.BigEndian.PutUint16(asnBytes, uint16(asn))
		data = append(data, asnBytes...)
	}

	return data
}

func calculateChecksum(data []byte) uint16 {
	var sum uint32
	for i := 0; i < len(data); i += 2 {
		sum += uint32(binary.BigEndian.Uint16(data[i:]))
	}
	for sum>>16 != 0 {
		sum = (sum & 0xffff) + (sum >> 16)
	}
	return ^uint16(sum)
}

func (pc *PacketCapture) PrintStats() {
	pc.mu.RLock()
	defer pc.mu.RUnlock()

	typeCount := make(map[bgp.BGPPacketType]int)
	for _, p := range pc.packets {
		typeCount[p.Type]++
	}

	fmt.Println("\n=== Packet Capture Statistics ===")
	fmt.Printf("Total Packets: %d\n", len(pc.packets))
	fmt.Printf("OPEN: %d\n", typeCount[bgp.BGPPacketOpen])
	fmt.Printf("UPDATE: %d\n", typeCount[bgp.BGPPacketUpdate])
	fmt.Printf("NOTIFY: %d\n", typeCount[bgp.BGPPacketNotify])
	fmt.Printf("KEEPALIVE: %d\n", typeCount[bgp.BGPPacketKeepalive])
}
