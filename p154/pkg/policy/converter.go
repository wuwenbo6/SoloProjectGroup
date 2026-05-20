package policy

import (
	"fmt"
	"net"
	"net/url"

	"github.com/ebpf-cni/netpol-ebpf/pkg/ebpf"
	"github.com/ebpf-cni/netpol-ebpf/pkg/k8s"
)

type Converter struct {
	ebpfManager *ebpf.Manager
}

func NewConverter(ebpfManager *ebpf.Manager) *Converter {
	return &Converter{
		ebpfManager: ebpfManager,
	}
}

func (c *Converter) HandlePolicyAdd(policy *k8s.L7NetworkPolicy) error {
	fmt.Printf("Processing policy add: %s/%s\n", policy.Namespace, policy.Name)

	for _, ingress := range policy.Spec.Ingress {
		if err := c.processIngressRule(ingress); err != nil {
			return fmt.Errorf("processing ingress rule: %v", err)
		}
	}

	for _, egress := range policy.Spec.Egress {
		if err := c.processEgressRule(egress); err != nil {
			return fmt.Errorf("processing egress rule: %v", err)
		}
	}

	return nil
}

func (c *Converter) HandlePolicyUpdate(policy *k8s.L7NetworkPolicy) error {
	fmt.Printf("Processing policy update: %s/%s\n", policy.Namespace, policy.Name)
	return c.HandlePolicyAdd(policy)
}

func (c *Converter) HandlePolicyDelete(policy *k8s.L7NetworkPolicy) error {
	fmt.Printf("Processing policy delete: %s/%s\n", policy.Namespace, policy.Name)
	return nil
}

func (c *Converter) processIngressRule(rule k8s.L7NetworkPolicyIngressRule) error {
	if rule.HTTP != nil {
		if err := c.processHTTPRule(rule.HTTP, rule.Ports, rule.From); err != nil {
			return err
		}
	}
	if rule.GRPC != nil {
		if err := c.processGRPCRule(rule.GRPC, rule.Ports, rule.From); err != nil {
			return err
		}
	}
	return nil
}

func (c *Converter) processEgressRule(rule k8s.L7NetworkPolicyEgressRule) error {
	if rule.HTTP != nil {
		if err := c.processHTTPRule(rule.HTTP, rule.Ports, rule.To); err != nil {
			return err
		}
	}
	if rule.GRPC != nil {
		if err := c.processGRPCRule(rule.GRPC, rule.Ports, rule.To); err != nil {
			return err
		}
	}
	return nil
}

func normalizePath(path string) string {
	decoded, err := url.QueryUnescape(path)
	if err != nil {
		return path
	}
	return decoded
}

func (c *Converter) processHTTPRule(http *k8s.HTTPRule, ports []k8s.NetworkPolicyPort, peers []k8s.NetworkPolicyPeer) error {
	for _, peer := range peers {
		srcIPs, err := c.resolvePeerIPs(peer)
		if err != nil {
			return err
		}

		for _, srcIP := range srcIPs {
			for _, port := range ports {
				dstPort := uint16(80)
				if port.Port != nil {
					dstPort = uint16(*port.Port)
				}

				proto := uint8(6)
				if port.Protocol != nil && *port.Protocol == "UDP" {
					proto = 17
				}

				for _, path := range http.Paths {
					normalizedPath := normalizePath(path)
					for _, method := range http.Methods {
						err := c.ebpfManager.AddRule(
							srcIP,
							net.IPv4(0, 0, 0, 0),
							dstPort,
							proto,
							ebpf.HTTPType,
							ebpf.ActionDeny,
							normalizedPath,
							method,
						)
						if err != nil {
							return fmt.Errorf("adding HTTP rule: %v", err)
						}
						fmt.Printf("Added HTTP deny rule: %s:%s -> :%d %s (original: %s)\n",
							srcIP, method, dstPort, normalizedPath, path)
					}
				}
			}
		}
	}
	return nil
}

func (c *Converter) processGRPCRule(grpc *k8s.GRPCRule, ports []k8s.NetworkPolicyPort, peers []k8s.NetworkPolicyPeer) error {
	for _, peer := range peers {
		srcIPs, err := c.resolvePeerIPs(peer)
		if err != nil {
			return err
		}

		for _, srcIP := range srcIPs {
			for _, port := range ports {
				dstPort := uint16(50051)
				if port.Port != nil {
					dstPort = uint16(*port.Port)
				}

				proto := uint8(6)
				if port.Protocol != nil && *port.Protocol == "UDP" {
					proto = 17
				}

				for _, svc := range grpc.Services {
					err := c.ebpfManager.AddRule(
						srcIP,
						net.IPv4(0, 0, 0, 0),
						dstPort,
						proto,
						ebpf.GRPCType,
						ebpf.ActionDeny,
						"/"+svc+"/*",
						"*",
					)
					if err != nil {
						return fmt.Errorf("adding gRPC rule: %v", err)
					}
					fmt.Printf("Added gRPC deny rule: %s -> :%d service: %s\n",
						srcIP, dstPort, svc)
				}
			}
		}
	}
	return nil
}

func (c *Converter) resolvePeerIPs(peer k8s.NetworkPolicyPeer) ([]net.IP, error) {
	var ips []net.IP

	if peer.IPBlock != nil {
		_, ipNet, err := net.ParseCIDR(peer.IPBlock.CIDR)
		if err != nil {
			return nil, fmt.Errorf("parsing CIDR: %v", err)
		}

		ip := ipNet.IP
		for i := 0; i < 256; i++ {
			testIP := net.IPv4(ip[0], ip[1], ip[2], byte(i))
			if ipNet.Contains(testIP) {
				ips = append(ips, testIP)
			}
		}
	}

	if peer.PodSelector != nil {
		ips = append(ips, net.IPv4(10, 244, 0, 1))
	}

	if len(ips) == 0 {
		ips = append(ips, net.IPv4(0, 0, 0, 0))
	}

	return ips, nil
}
