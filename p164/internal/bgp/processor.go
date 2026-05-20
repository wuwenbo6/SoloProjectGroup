package bgp

import (
	"bgp-simulator/internal/event"
	"encoding/json"
	"fmt"
	"net"
	"time"

	"github.com/google/uuid"
)

type BGPProcessor struct {
	router      *Router
	topology    *Topology
	eventBus    *event.EventBus
	packetCapture interface{}
	running     bool
	done        chan struct{}
}

func NewBGPProcessor(router *Router, topology *Topology, eb *event.EventBus) *BGPProcessor {
	return &BGPProcessor{
		router:   router,
		topology: topology,
		eventBus: eb,
		done:     make(chan struct{}),
	}
}

func (bp *BGPProcessor) SetPacketCapture(pc interface{}) {
	bp.packetCapture = pc
}

func (bp *BGPProcessor) Start() {
	if bp.running {
		return
	}
	bp.running = true

	bp.eventBus.Subscribe(event.EventTypeBGPUpdate, bp.handleBGPUpdate)
	bp.eventBus.Subscribe(event.EventTypeBGPWithdraw, bp.handleBGPWithdraw)
	bp.eventBus.Subscribe(event.EventTypeLinkDown, bp.handleLinkDown)
	bp.eventBus.Subscribe(event.EventTypeLinkUp, bp.handleLinkUp)

	bp.announceConnectedRoutes()

	go bp.keepaliveLoop()
}

func (bp *BGPProcessor) Stop() {
	if !bp.running {
		return
	}
	bp.running = false
	close(bp.done)
}

func (bp *BGPProcessor) handleBGPUpdate(e event.Event) {
	if e.Target != bp.router.ID && e.Target != "" {
		return
	}

	data, err := json.Marshal(e.Data)
	if err != nil {
		return
	}

	var update BGPUpdatePayload
	if err := json.Unmarshal(data, &update); err != nil {
		return
	}

	srcRouter := bp.topology.GetRouter(e.Source)
	if srcRouter == nil {
		return
	}

	neighbor := bp.router.GetNeighbor(e.Source)
	if neighbor == nil || !neighbor.IsUp {
		return
	}

	for _, nlri := range update.NLRI {
		attrs := update.PathAttributes.Clone()

		if neighbor.Type == NeighborTypeEBGP {
			attrs.PrependAS(bp.router.ASN)
			attrs.NextHop = bp.router.IP
		} else {
			attrs.LocalPref = 100
		}

		route := &Route{
			Prefix:      nlri,
			Attributes:  attrs,
			LearnedFrom: e.Source,
			Protocol:    "bgp",
			Weight:      0,
			Timestamp:   time.Now(),
		}

		bestChanged := bp.router.RoutingTable.AddRoute(route)

		if bestChanged {
			bp.eventBus.Publish(event.Event{
				ID:     uuid.New().String(),
				Type:   event.EventTypeRouteAdded,
				Source: bp.router.ID,
				Data: map[string]interface{}{
					"prefix": nlri.String(),
					"route":  route,
				},
			})

			bp.propagateRoute(route, e.Source)
		}
	}

	bp.capturePacket(&BGPPacket{
		Type:      BGPPacketUpdate,
		SrcIP:     srcRouter.IP,
		DstIP:     bp.router.IP,
		SrcASN:    srcRouter.ASN,
		DstASN:    bp.router.ASN,
		Payload:   update,
		Timestamp: time.Now(),
	})
}

func (bp *BGPProcessor) handleBGPWithdraw(e event.Event) {
	if e.Target != bp.router.ID {
		return
	}

	data, err := json.Marshal(e.Data)
	if err != nil {
		return
	}

	var update BGPUpdatePayload
	if err := json.Unmarshal(data, &update); err != nil {
		return
	}

	for _, prefix := range update.WithdrawnRoutes {
		bp.router.RoutingTable.RemoveRoute(prefix.String(), e.Source)
		bp.withdrawFromNeighbors(prefix, e.Source)
	}
}

func (bp *BGPProcessor) handleLinkDown(e event.Event) {
	data, err := json.Marshal(e.Data)
	if err != nil {
		return
	}

	var linkData struct {
		LinkID   string `json:"link_id"`
		RouterA  string `json:"router_a"`
		RouterB  string `json:"router_b"`
	}
	if err := json.Unmarshal(data, &linkData); err != nil {
		return
	}

	var neighborID string
	if linkData.RouterA == bp.router.ID {
		neighborID = linkData.RouterB
	} else if linkData.RouterB == bp.router.ID {
		neighborID = linkData.RouterA
	} else {
		return
	}

	neighbor := bp.router.Neighbors[neighborID]
	if neighbor != nil {
		neighbor.IsUp = false
		neighbor.LastFlap = time.Now()

		routes := bp.router.RoutingTable.GetAllRoutes()
		for prefix, routesList := range routes {
			for _, r := range routesList {
				if r.LearnedFrom == neighborID {
					bp.router.RoutingTable.RemoveRoute(prefix, neighborID)
					bp.withdrawFromNeighbors(r.Prefix, neighborID)
				}
			}
		}
	}
}

func (bp *BGPProcessor) handleLinkUp(e event.Event) {
	data, err := json.Marshal(e.Data)
	if err != nil {
		return
	}

	var linkData struct {
		LinkID   string `json:"link_id"`
		RouterA  string `json:"router_a"`
		RouterB  string `json:"router_b"`
	}
	if err := json.Unmarshal(data, &linkData); err != nil {
		return
	}

	var neighborID string
	if linkData.RouterA == bp.router.ID {
		neighborID = linkData.RouterB
	} else if linkData.RouterB == bp.router.ID {
		neighborID = linkData.RouterA
	} else {
		return
	}

	neighbor := bp.router.Neighbors[neighborID]
	if neighbor != nil {
		neighbor.IsUp = true
		neighbor.LastFlap = time.Now()

		neighborRouter := bp.topology.GetRouter(neighborID)
		if neighborRouter != nil {
			bp.sendOpenMessage(neighborRouter)
		}
	}
}

func (bp *BGPProcessor) announceConnectedRoutes() {
	connectedRoutes := bp.router.GetConnectedRoutes()

	for _, prefix := range connectedRoutes {
		attrs := &BGPPathAttributes{
			Origin:    0,
			ASPath:    []ASNumber{bp.router.ASN},
			NextHop:   bp.router.IP,
			LocalPref: 100,
		}

		route := &Route{
			Prefix:      prefix,
			Attributes:  attrs,
			LearnedFrom: "connected",
			Protocol:    "connected",
			Weight:      32768,
			Timestamp:   time.Now(),
		}

		bp.router.RoutingTable.AddRoute(route)
		bp.propagateRoute(route, "")
	}
}

func (bp *BGPProcessor) propagateRoute(route *Route, excludeNeighbor string) {
	neighbors := bp.router.GetAllNeighbors()

	for neighborID, neighbor := range neighbors {
		if neighborID == excludeNeighbor || !neighbor.IsUp {
			continue
		}

		neighborRouter := bp.topology.GetRouter(neighborID)
		if neighborRouter == nil {
			continue
		}

		attrs := route.Attributes.Clone()

		if neighbor.Type == NeighborTypeEBGP {
			if !route.Attributes.ContainsAS(neighbor.ASN) {
				update := &BGPUpdatePayload{
					NLRI:           []*IPNet{route.Prefix},
					PathAttributes: attrs,
				}

				bp.eventBus.Publish(event.Event{
					ID:     uuid.New().String(),
					Type:   event.EventTypeBGPUpdate,
					Source: bp.router.ID,
					Target: neighborID,
					Data:   update,
				})
			}
		} else {
			if route.LearnedFrom != "" && bp.router.Neighbors[route.LearnedFrom] != nil &&
				bp.router.Neighbors[route.LearnedFrom].Type == NeighborTypeIBGP {
				continue
			}

			update := &BGPUpdatePayload{
				NLRI:           []*IPNet{route.Prefix},
				PathAttributes: attrs,
			}

			bp.eventBus.Publish(event.Event{
				ID:     uuid.New().String(),
				Type:   event.EventTypeBGPUpdate,
				Source: bp.router.ID,
				Target: neighborID,
				Data:   update,
			})
		}
	}
}

func (bp *BGPProcessor) withdrawFromNeighbors(prefix *IPNet, excludeNeighbor string) {
	neighbors := bp.router.GetAllNeighbors()

	for neighborID, neighbor := range neighbors {
		if neighborID == excludeNeighbor || !neighbor.IsUp {
			continue
		}

		update := &BGPUpdatePayload{
			WithdrawnRoutes: []*IPNet{prefix},
		}

		bp.eventBus.Publish(event.Event{
			ID:     uuid.New().String(),
			Type:   event.EventTypeBGPWithdraw,
			Source: bp.router.ID,
			Target: neighborID,
			Data:   update,
		})
	}
}

func (bp *BGPProcessor) sendOpenMessage(neighborRouter *Router) {
	open := &BGPOpenPayload{
		Version:      4,
		ASN:          bp.router.ASN,
		HoldTime:     180,
		BGPIdentifier: bp.router.IP,
	}

	bp.eventBus.Publish(event.Event{
		ID:     uuid.New().String(),
		Type:   "BGP_OPEN",
		Source: bp.router.ID,
		Target: neighborRouter.ID,
		Data:   open,
	})

	bp.capturePacket(&BGPPacket{
		Type:      BGPPacketOpen,
		SrcIP:     bp.router.IP,
		DstIP:     neighborRouter.IP,
		SrcASN:    bp.router.ASN,
		DstASN:    neighborRouter.ASN,
		Payload:   open,
		Timestamp: time.Now(),
	})

	go func() {
		time.Sleep(100 * time.Millisecond)
		bp.announceAllRoutes(neighborRouter.ID)
	}()
}

func (bp *BGPProcessor) announceAllRoutes(targetNeighbor string) {
	bestRoutes := bp.router.RoutingTable.GetBestRoutes()

	for _, route := range bestRoutes {
		neighbor := bp.router.Neighbors[targetNeighbor]
		if neighbor == nil {
			continue
		}

		attrs := route.Attributes.Clone()

		if neighbor.Type == NeighborTypeEBGP {
			if route.Attributes.ContainsAS(neighbor.ASN) {
				continue
			}
		}

		update := &BGPUpdatePayload{
			NLRI:           []*IPNet{route.Prefix},
			PathAttributes: attrs,
		}

		bp.eventBus.Publish(event.Event{
			ID:     uuid.New().String(),
			Type:   event.EventTypeBGPUpdate,
			Source: bp.router.ID,
			Target: targetNeighbor,
			Data:   update,
		})
	}
}

func (bp *BGPProcessor) keepaliveLoop() {
	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			bp.sendKeepalives()
		case <-bp.done:
			return
		}
	}
}

func (bp *BGPProcessor) sendKeepalives() {
	neighbors := bp.router.GetAllNeighbors()

	for neighborID, neighbor := range neighbors {
		if !neighbor.IsUp {
			continue
		}

		neighborRouter := bp.topology.GetRouter(neighborID)
		if neighborRouter == nil {
			continue
		}

		bp.capturePacket(&BGPPacket{
			Type:      BGPPacketKeepalive,
			SrcIP:     bp.router.IP,
			DstIP:     neighborRouter.IP,
			SrcASN:    bp.router.ASN,
			DstASN:    neighborRouter.ASN,
			Timestamp: time.Now(),
		})
	}
}

func (bp *BGPProcessor) capturePacket(packet *BGPPacket) {
	if bp.packetCapture == nil {
		return
	}

	if pc, ok := bp.packetCapture.(interface{ Capture(*BGPPacket) }); ok {
		pc.Capture(packet)
	}
}

func (bp *BGPProcessor) InjectRoute(prefix *IPNet, localPref uint32, asPath []ASNumber) {
	attrs := &BGPPathAttributes{
		Origin:    0,
		ASPath:    append([]ASNumber{bp.router.ASN}, asPath...),
		NextHop:   bp.router.IP,
		LocalPref: localPref,
	}

	route := &Route{
		Prefix:      prefix,
		Attributes:  attrs,
		LearnedFrom: "injected",
		Protocol:    "static",
		Weight:      0,
		Timestamp:   time.Now(),
	}

	bestChanged := bp.router.RoutingTable.AddRoute(route)

	if bestChanged {
		bp.propagateRoute(route, "")
	}

	fmt.Printf("[%s] Injected route: %s\n", bp.router.Name, prefix.String())
}

func EstablishBGPSession(topology *Topology, eb *event.EventBus, routerAID, routerBID string, linkID string) error {
	routerA := topology.GetRouter(routerAID)
	routerB := topology.GetRouter(routerBID)

	if routerA == nil || routerB == nil {
		return fmt.Errorf("router not found")
	}

	link := topology.GetLink(linkID)
	if link == nil {
		return fmt.Errorf("link not found")
	}

	neighborType := NeighborTypeEBGP
	if routerA.ASN == routerB.ASN {
		neighborType = NeighborTypeIBGP
	}

	neighborA := &Neighbor{
		RouterID:     routerBID,
		ASN:          routerB.ASN,
		Type:         neighborType,
		LocalIP:      link.IPAddressA,
		RemoteIP:     link.IPAddressB,
		IsUp:         true,
		LastFlap:     time.Now(),
		HoldTime:     180,
		KeepaliveTime: 60,
	}

	neighborB := &Neighbor{
		RouterID:     routerAID,
		ASN:          routerA.ASN,
		Type:         neighborType,
		LocalIP:      link.IPAddressB,
		RemoteIP:     link.IPAddressA,
		IsUp:         true,
		LastFlap:     time.Now(),
		HoldTime:     180,
		KeepaliveTime: 60,
	}

	routerA.AddNeighbor(neighborA)
	routerB.AddNeighbor(neighborB)

	fmt.Printf("Established %s session between %s (AS%s) and %s (AS%s)\n",
		neighborType, routerA.Name, routerA.ASN, routerB.Name, routerB.ASN)

	return nil
}
