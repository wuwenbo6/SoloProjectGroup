package nat

import (
	"fmt"
	"net"
	"strings"
	"time"

	"github.com/huin/goupnp"
	"github.com/huin/goupnp/dcps/internetgateway2"
)

type UPnP struct {
	client *internetgateway2.WANIPConnection2
}

func NewUPnP() (*UPnP, error) {
	clients, _, err := internetgateway2.NewWANIPConnection2Clients()
	if err != nil {
		return nil, err
	}

	if len(clients) == 0 {
		return nil, fmt.Errorf("no UPnP device found")
	}

	return &UPnP{client: clients[0]}, nil
}

func (u *UPnP) GetExternalIP() (string, error) {
	ip, err := u.client.GetExternalIPAddress()
	return ip, err
}

func (u *UPnP) AddPortMapping(internalPort, externalPort int, protocol string, description string) error {
	localIP, err := getLocalIP()
	if err != nil {
		return err
	}

	protocol = strings.ToUpper(protocol)
	if protocol != "TCP" && protocol != "UDP" {
		protocol = "TCP"
	}

	return u.client.AddPortMapping(
		"",
		uint16(externalPort),
		protocol,
		uint16(internalPort),
		localIP,
		true,
		description,
		3600,
	)
}

func (u *UPnP) RemovePortMapping(externalPort int, protocol string) error {
	protocol = strings.ToUpper(protocol)
	return u.client.DeletePortMapping("", uint16(externalPort), protocol)
}

func getLocalIP() (string, error) {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return "", err
	}

	for _, addr := range addrs {
		if ipNet, ok := addr.(*net.IPNet); ok && !ipNet.IP.IsLoopback() {
			if ipNet.IP.To4() != nil {
				return ipNet.IP.String(), nil
			}
		}
	}

	return "", fmt.Errorf("no local IP found")
}

func (u *UPnP) SetupPortForwarding(port int) (string, int, error) {
	externalIP, err := u.GetExternalIP()
	if err != nil {
		return "", 0, err
	}

	err = u.AddPortMapping(port, port, "TCP", "Kademlia DHT Node")
	if err != nil {
		return "", 0, err
	}

	return externalIP, port, nil
}

func (u *UPnP) KeepAlive(port int, stopChan <-chan struct{}) {
	ticker := time.NewTicker(30 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			u.AddPortMapping(port, port, "TCP", "Kademlia DHT Node")
		case <-stopChan:
			return
		}
	}
}
