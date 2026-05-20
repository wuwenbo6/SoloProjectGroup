package bgp

import (
	"encoding/json"
	"fmt"
	"net"
	"sort"
	"strings"
	"sync"
	"time"
)

type ASNumber uint32

func (asn ASNumber) String() string {
	return fmt.Sprintf("%d", asn)
}

type IPNet struct {
	IP   net.IP
	Mask net.IPMask
}

func ParseIPNet(cidr string) (*IPNet, error) {
	ip, ipNet, err := net.ParseCIDR(cidr)
	if err != nil {
		return nil, err
	}
	return &IPNet{IP: ip, Mask: ipNet.Mask}, nil
}

func (n *IPNet) String() string {
	ones, _ := n.Mask.Size()
	return fmt.Sprintf("%s/%d", n.IP.String(), ones)
}

func (n *IPNet) MarshalJSON() ([]byte, error) {
	return json.Marshal(n.String())
}

func (n *IPNet) UnmarshalJSON(data []byte) error {
	var s string
	if err := json.Unmarshal(data, &s); err != nil {
		return err
	}
	parsed, err := ParseIPNet(s)
	if err != nil {
		return err
	}
	*n = *parsed
	return nil
}

type BGPPathAttributes struct {
	Origin         uint8      `json:"origin"`
	ASPath         []ASNumber `json:"as_path"`
	NextHop        net.IP     `json:"next_hop"`
	LocalPref      uint32     `json:"local_pref"`
	MultiExitDisc  uint32     `json:"med"`
	Communities    []string   `json:"communities,omitempty"`
}

func (pa *BGPPathAttributes) Clone() *BGPPathAttributes {
	return &BGPPathAttributes{
		Origin:        pa.Origin,
		ASPath:        append([]ASNumber{}, pa.ASPath...),
		NextHop:       append(net.IP{}, pa.NextHop...),
		LocalPref:     pa.LocalPref,
		MultiExitDisc: pa.MultiExitDisc,
		Communities:   append([]string{}, pa.Communities...),
	}
}

func (pa *BGPPathAttributes) ASPathLength() int {
	return len(pa.ASPath)
}

func (pa *BGPPathAttributes) ContainsAS(asn ASNumber) bool {
	for _, as := range pa.ASPath {
		if as == asn {
			return true
		}
	}
	return false
}

func (pa *BGPPathAttributes) PrependAS(asn ASNumber) {
	pa.ASPath = append([]ASNumber{asn}, pa.ASPath...)
}

type Route struct {
	Prefix     *IPNet             `json:"prefix"`
	Attributes *BGPPathAttributes `json:"attributes"`
	LearnedFrom string            `json:"learned_from"`
	Protocol    string            `json:"protocol"`
	Weight      uint32            `json:"weight"`
	Timestamp   time.Time         `json:"timestamp"`
}

func (r *Route) Clone() *Route {
	return &Route{
		Prefix:      &IPNet{IP: append(net.IP{}, r.Prefix.IP...), Mask: append(net.IPMask{}, r.Prefix.Mask...)},
		Attributes:  r.Attributes.Clone(),
		LearnedFrom: r.LearnedFrom,
		Protocol:    r.Protocol,
		Weight:      r.Weight,
		Timestamp:   r.Timestamp,
	}
}

type RouteCompareResult int

const (
	RouteBetter RouteCompareResult = iota
	RouteWorse
	RouteEqual
)

func CompareRoutes(a, b *Route) RouteCompareResult {
	if a.Weight > b.Weight {
		return RouteBetter
	} else if a.Weight < b.Weight {
		return RouteWorse
	}

	if a.Attributes.LocalPref > b.Attributes.LocalPref {
		return RouteBetter
	} else if a.Attributes.LocalPref < b.Attributes.LocalPref {
		return RouteWorse
	}

	if a.Attributes.ASPathLength() < b.Attributes.ASPathLength() {
		return RouteBetter
	} else if a.Attributes.ASPathLength() > b.Attributes.ASPathLength() {
		return RouteWorse
	}

	if a.Attributes.Origin < b.Attributes.Origin {
		return RouteBetter
	} else if a.Attributes.Origin > b.Attributes.Origin {
		return RouteWorse
	}

	if a.Attributes.MultiExitDisc < b.Attributes.MultiExitDisc {
		return RouteBetter
	} else if a.Attributes.MultiExitDisc > b.Attributes.MultiExitDisc {
		return RouteWorse
	}

	return RouteEqual
}

type RoutingTable struct {
	mu     sync.RWMutex
	routes map[string][]*Route
	best   map[string]*Route
}

func NewRoutingTable() *RoutingTable {
	return &RoutingTable{
		routes: make(map[string][]*Route),
		best:   make(map[string]*Route),
	}
}

func (rt *RoutingTable) AddRoute(route *Route) bool {
	rt.mu.Lock()
	defer rt.mu.Unlock()

	prefix := route.Prefix.String()
	rt.routes[prefix] = append(rt.routes[prefix], route)
	return rt.selectBestRoute(prefix)
}

func (rt *RoutingTable) RemoveRoute(prefix string, routerID string) bool {
	rt.mu.Lock()
	defer rt.mu.Unlock()

	routes, exists := rt.routes[prefix]
	if !exists {
		return false
	}

	newRoutes := make([]*Route, 0, len(routes))
	for _, r := range routes {
		if r.LearnedFrom != routerID {
			newRoutes = append(newRoutes, r)
		}
	}

	if len(newRoutes) == 0 {
		delete(rt.routes, prefix)
		delete(rt.best, prefix)
		return true
	}

	rt.routes[prefix] = newRoutes
	return rt.selectBestRoute(prefix)
}

func (rt *RoutingTable) selectBestRoute(prefix string) bool {
	routes := rt.routes[prefix]
	if len(routes) == 0 {
		delete(rt.best, prefix)
		return false
	}

	best := routes[0]
	changed := false

	for _, r := range routes[1:] {
		if CompareRoutes(r, best) == RouteBetter {
			best = r
			changed = true
		}
	}

	currentBest, exists := rt.best[prefix]
	if !exists || CompareRoutes(best, currentBest) != RouteEqual {
		rt.best[prefix] = best
		return true
	}
	return changed
}

func (rt *RoutingTable) GetBestRoute(prefix string) *Route {
	rt.mu.RLock()
	defer rt.mu.RUnlock()
	return rt.best[prefix]
}

func (rt *RoutingTable) GetAllRoutes() map[string][]*Route {
	rt.mu.RLock()
	defer rt.mu.RUnlock()

	result := make(map[string][]*Route)
	for prefix, routes := range rt.routes {
		result[prefix] = make([]*Route, len(routes))
		copy(result[prefix], routes)
	}
	return result
}

func (rt *RoutingTable) GetBestRoutes() map[string]*Route {
	rt.mu.RLock()
	defer rt.mu.RUnlock()

	result := make(map[string]*Route)
	for prefix, route := range rt.best {
		result[prefix] = route.Clone()
	}
	return result
}

func (rt *RoutingTable) GetRoutesForPrefix(prefix string) []*Route {
	rt.mu.RLock()
	defer rt.mu.RUnlock()

	routes, exists := rt.routes[prefix]
	if !exists {
		return nil
	}

	result := make([]*Route, len(routes))
	copy(result, routes)
	return result
}

type NeighborType string

const (
	NeighborTypeEBGP NeighborType = "eBGP"
	NeighborTypeIBGP NeighborType = "iBGP"
)

type Neighbor struct {
	RouterID     string       `json:"router_id"`
	ASN          ASNumber     `json:"asn"`
	Type         NeighborType `json:"type"`
	LocalIP      net.IP       `json:"local_ip"`
	RemoteIP     net.IP       `json:"remote_ip"`
	IsUp         bool         `json:"is_up"`
	LastFlap     time.Time    `json:"last_flap"`
	HoldTime     uint16       `json:"hold_time"`
	KeepaliveTime uint16      `json:"keepalive_time"`
}

func (n *Neighbor) Clone() *Neighbor {
	return &Neighbor{
		RouterID:     n.RouterID,
		ASN:          n.ASN,
		Type:         n.Type,
		LocalIP:      append(net.IP{}, n.LocalIP...),
		RemoteIP:     append(net.IP{}, n.RemoteIP...),
		IsUp:         n.IsUp,
		LastFlap:     n.LastFlap,
		HoldTime:     n.HoldTime,
		KeepaliveTime: n.KeepaliveTime,
	}
}

type AS struct {
	Number  ASNumber           `json:"number"`
	Name    string             `json:"name"`
	Routers map[string]*Router `json:"routers"`
	mu      sync.RWMutex
}

func NewAS(asn ASNumber, name string) *AS {
	return &AS{
		Number:  asn,
		Name:    name,
		Routers: make(map[string]*Router),
	}
}

func (as *AS) AddRouter(router *Router) {
	as.mu.Lock()
	defer as.mu.Unlock()
	as.Routers[router.ID] = router
}

func (as *AS) RemoveRouter(routerID string) {
	as.mu.Lock()
	defer as.mu.Unlock()
	delete(as.Routers, routerID)
}

func (as *AS) GetRouter(routerID string) *Router {
	as.mu.RLock()
	defer as.mu.RUnlock()
	return as.Routers[routerID]
}

func (as *AS) GetAllRouters() map[string]*Router {
	as.mu.RLock()
	defer as.mu.RUnlock()

	result := make(map[string]*Router)
	for id, r := range as.Routers {
		result[id] = r
	}
	return result
}

type Router struct {
	ID         string                 `json:"id"`
	Name       string                 `json:"name"`
	ASN        ASNumber               `json:"asn"`
	IP         net.IP                 `json:"ip"`
	LoopbackIP net.IP                 `json:"loopback_ip"`

	Neighbors       map[string]*Neighbor `json:"neighbors"`
	RoutingTable    *RoutingTable        `json:"-"`
	ConnectedRoutes []*IPNet             `json:"connected_routes"`

	eventBus      interface{}
	packetCapture interface{}
	mu            sync.RWMutex
}

func NewRouter(id, name string, asn ASNumber, ip net.IP) *Router {
	return &Router{
		ID:            id,
		Name:          name,
		ASN:           asn,
		IP:            ip,
		LoopbackIP:    ip,
		Neighbors:     make(map[string]*Neighbor),
		RoutingTable:  NewRoutingTable(),
		ConnectedRoutes: make([]*IPNet, 0),
	}
}

func (r *Router) AddNeighbor(neighbor *Neighbor) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.Neighbors[neighbor.RouterID] = neighbor
}

func (r *Router) RemoveNeighbor(routerID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.Neighbors, routerID)
}

func (r *Router) GetNeighbor(routerID string) *Neighbor {
	r.mu.RLock()
	defer r.mu.RUnlock()
	n, exists := r.Neighbors[routerID]
	if !exists {
		return nil
	}
	return n.Clone()
}

func (r *Router) GetAllNeighbors() map[string]*Neighbor {
	r.mu.RLock()
	defer r.mu.RUnlock()

	result := make(map[string]*Neighbor)
	for id, n := range r.Neighbors {
		result[id] = n.Clone()
	}
	return result
}

func (r *Router) SetEventBus(eb interface{}) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.eventBus = eb
}

func (r *Router) SetPacketCapture(pc interface{}) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.packetCapture = pc
}

func (r *Router) AddConnectedRoute(prefix *IPNet) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.ConnectedRoutes = append(r.ConnectedRoutes, prefix)
}

func (r *Router) GetConnectedRoutes() []*IPNet {
	r.mu.RLock()
	defer r.mu.RUnlock()

	result := make([]*IPNet, len(r.ConnectedRoutes))
	copy(result, r.ConnectedRoutes)
	return result
}

type Link struct {
	ID         string   `json:"id"`
	RouterA    string   `json:"router_a"`
	RouterB    string   `json:"router_b"`
	IPNetwork  *IPNet   `json:"ip_network"`
	IPAddressA net.IP   `json:"ip_a"`
	IPAddressB net.IP   `json:"ip_b"`
	IsUp       bool     `json:"is_up"`
	Bandwidth  uint64   `json:"bandwidth"`
	Latency    uint32   `json:"latency_ms"`
}

func (l *Link) Clone() *Link {
	return &Link{
		ID:         l.ID,
		RouterA:    l.RouterA,
		RouterB:    l.RouterB,
		IPNetwork:  &IPNet{IP: append(net.IP{}, l.IPNetwork.IP...), Mask: append(net.IPMask{}, l.IPNetwork.Mask...)},
		IPAddressA: append(net.IP{}, l.IPAddressA...),
		IPAddressB: append(net.IP{}, l.IPAddressB...),
		IsUp:       l.IsUp,
		Bandwidth:  l.Bandwidth,
		Latency:    l.Latency,
	}
}

type Topology struct {
	ASes     map[ASNumber]*AS `json:"ases"`
	Routers  map[string]*Router `json:"routers"`
	Links    map[string]*Link `json:"links"`
	mu       sync.RWMutex
}

func NewTopology() *Topology {
	return &Topology{
		ASes:    make(map[ASNumber]*AS),
		Routers: make(map[string]*Router),
		Links:   make(map[string]*Link),
	}
}

func (t *Topology) AddAS(as *AS) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.ASes[as.Number] = as
}

func (t *Topology) RemoveAS(asn ASNumber) {
	t.mu.Lock()
	defer t.mu.Unlock()
	delete(t.ASes, asn)
}

func (t *Topology) GetAS(asn ASNumber) *AS {
	t.mu.RLock()
	defer t.mu.RUnlock()
	return t.ASes[asn]
}

func (t *Topology) AddRouter(router *Router) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.Routers[router.ID] = router

	if as, exists := t.ASes[router.ASN]; exists {
		as.AddRouter(router)
	}
}

func (t *Topology) RemoveRouter(routerID string) {
	t.mu.Lock()
	defer t.mu.Unlock()

	router := t.Routers[routerID]
	if router != nil {
		if as, exists := t.ASes[router.ASN]; exists {
			as.RemoveRouter(routerID)
		}
	}

	delete(t.Routers, routerID)
}

func (t *Topology) GetRouter(routerID string) *Router {
	t.mu.RLock()
	defer t.mu.RUnlock()
	return t.Routers[routerID]
}

func (t *Topology) AddLink(link *Link) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.Links[link.ID] = link
}

func (t *Topology) RemoveLink(linkID string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	delete(t.Links, linkID)
}

func (t *Topology) GetLink(linkID string) *Link {
	t.mu.RLock()
	defer t.mu.RUnlock()
	l, exists := t.Links[linkID]
	if !exists {
		return nil
	}
	return l.Clone()
}

func (t *Topology) GetAllLinks() map[string]*Link {
	t.mu.RLock()
	defer t.mu.RUnlock()

	result := make(map[string]*Link)
	for id, l := range t.Links {
		result[id] = l.Clone()
	}
	return result
}

func (t *Topology) GetAllRouters() map[string]*Router {
	t.mu.RLock()
	defer t.mu.RUnlock()

	result := make(map[string]*Router)
	for id, r := range t.Routers {
		result[id] = r
	}
	return result
}

func (t *Topology) GetAllASes() map[ASNumber]*AS {
	t.mu.RLock()
	defer t.mu.RUnlock()

	result := make(map[ASNumber]*AS)
	for asn, as := range t.ASes {
		result[asn] = as
	}
	return result
}

type BGPPacketType uint8

const (
	BGPPacketOpen     BGPPacketType = 1
	BGPPacketUpdate   BGPPacketType = 2
	BGPPacketNotify   BGPPacketType = 3
	BGPPacketKeepalive BGPPacketType = 4
)

type BGPPacket struct {
	Type     BGPPacketType `json:"type"`
	SrcIP    net.IP        `json:"src_ip"`
	DstIP    net.IP        `json:"dst_ip"`
	SrcASN   ASNumber      `json:"src_asn"`
	DstASN   ASNumber      `json:"dst_asn"`
	Payload  interface{}   `json:"payload"`
	Timestamp time.Time    `json:"timestamp"`
}

type BGPOpenPayload struct {
	Version      uint8    `json:"version"`
	ASN          ASNumber `json:"asn"`
	HoldTime     uint16   `json:"hold_time"`
	BGPIdentifier net.IP  `json:"bgp_id"`
}

type BGPUpdatePayload struct {
	WithdrawnRoutes []*IPNet          `json:"withdrawn_routes"`
	PathAttributes  *BGPPathAttributes `json:"path_attributes"`
	NLRI            []*IPNet          `json:"nlri"`
}

type BGPNotifyPayload struct {
	ErrorCode    uint8  `json:"error_code"`
	ErrorSubcode uint8  `json:"error_subcode"`
	ErrorData    []byte `json:"error_data"`
}

func PrettyPrintRouteTable(routes map[string]*Route) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("%-20s %-10s %-30s %-15s\n", "Prefix", "AS Path", "Next Hop", "Local Pref"))
	sb.WriteString(strings.Repeat("-", 80) + "\n")

	var prefixes []string
	for p := range routes {
		prefixes = append(prefixes, p)
	}
	sort.Strings(prefixes)

	for _, prefix := range prefixes {
		route := routes[prefix]
		asPath := make([]string, len(route.Attributes.ASPath))
		for i, asn := range route.Attributes.ASPath {
			asPath[i] = asn.String()
		}
		sb.WriteString(fmt.Sprintf("%-20s %-10s %-30s %-15d\n",
			prefix,
			strings.Join(asPath, " "),
			route.Attributes.NextHop.String(),
			route.Attributes.LocalPref,
		))
	}
	return sb.String()
}
