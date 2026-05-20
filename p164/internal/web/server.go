package web

import (
	"bgp-simulator/internal/bgp"
	"bgp-simulator/internal/event"
	"bgp-simulator/internal/pcap"
	"bgp-simulator/internal/topology"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type Simulator struct {
	Topology      *bgp.Topology
	EventBus      *event.EventBus
	Store         *topology.Store
	PacketCapture *pcap.PacketCapture
	Processors    map[string]*bgp.BGPProcessor
	WebDir        string
	mu            sync.RWMutex
	wsClients     map[*websocket.Conn]bool
}

func NewSimulator(webDir string) *Simulator {
	return &Simulator{
		Topology:      bgp.NewTopology(),
		EventBus:      event.NewEventBus(10000),
		PacketCapture: pcap.NewPacketCapture(),
		Processors:    make(map[string]*bgp.BGPProcessor),
		WebDir:        webDir,
		wsClients:     make(map[*websocket.Conn]bool),
	}
}

func (s *Simulator) Start(addr string) error {
	mux := http.NewServeMux()

	mux.HandleFunc("/api/topology", s.handleTopology)
	mux.HandleFunc("/api/routers", s.handleRouters)
	mux.HandleFunc("/api/routers/", s.handleRouter)
	mux.HandleFunc("/api/links", s.handleLinks)
	mux.HandleFunc("/api/links/", s.handleLink)
	mux.HandleFunc("/api/ases", s.handleASes)
	mux.HandleFunc("/api/routes/", s.handleRoutes)
	mux.HandleFunc("/api/routing-table/", s.handleRoutingTable)
	mux.HandleFunc("/api/inject-route", s.handleInjectRoute)
	mux.HandleFunc("/api/fault/link-down", s.handleLinkDown)
	mux.HandleFunc("/api/fault/link-up", s.handleLinkUp)
	mux.HandleFunc("/api/fault/router-down", s.handleRouterDown)
	mux.HandleFunc("/api/pcap/export", s.handlePCAPExport)
	mux.HandleFunc("/api/pcap/stats", s.handlePCAPStats)
	mux.HandleFunc("/api/save", s.handleSave)
	mux.HandleFunc("/api/load", s.handleLoad)
	mux.HandleFunc("/api/ws", s.handleWebSocket)
	mux.HandleFunc("/", s.handleStatic)

	setupEventForwarding(s)

	fmt.Printf("Web server starting on %s...\n", addr)
	return http.ListenAndServe(addr, mux)
}

func setupEventForwarding(s *Simulator) {
	s.EventBus.Subscribe(event.EventTypeBGPUpdate, func(e event.Event) {
		s.broadcastWebSocket(e)
	})
	s.EventBus.Subscribe(event.EventTypeBGPWithdraw, func(e event.Event) {
		s.broadcastWebSocket(e)
	})
	s.EventBus.Subscribe(event.EventTypeRouteAdded, func(e event.Event) {
		s.broadcastWebSocket(e)
	})
	s.EventBus.Subscribe(event.EventTypeLinkDown, func(e event.Event) {
		s.broadcastWebSocket(e)
	})
	s.EventBus.Subscribe(event.EventTypeLinkUp, func(e event.Event) {
		s.broadcastWebSocket(e)
	})
}

func (s *Simulator) broadcastWebSocket(e event.Event) {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := json.Marshal(e)
	if err != nil {
		return
	}

	for client := range s.wsClients {
		client.WriteMessage(websocket.TextMessage, data)
	}
}

func (s *Simulator) handleStatic(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path
	if path == "/" {
		path = "/index.html"
	}

	fullPath := filepath.Join(s.WebDir, path)
	if _, err := os.Stat(fullPath); os.IsNotExist(err) {
		http.NotFound(w, r)
		return
	}

	http.ServeFile(w, r, fullPath)
}

func (s *Simulator) handleTopology(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	response := map[string]interface{}{
		"ases":    s.Topology.GetAllASes(),
		"routers": s.Topology.GetAllRouters(),
		"links":   s.Topology.GetAllLinks(),
	}

	json.NewEncoder(w).Encode(response)
}

func (s *Simulator) handleRouters(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method == "POST" {
		var req struct {
			ID   string `json:"id"`
			Name string `json:"name"`
			ASN  int    `json:"asn"`
			IP   string `json:"ip"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		ip := net.ParseIP(req.IP)
		if ip == nil {
			http.Error(w, "invalid IP address", http.StatusBadRequest)
			return
		}

		router := bgp.NewRouter(req.ID, req.Name, bgp.ASNumber(req.ASN), ip)
		s.Topology.AddRouter(router)

		processor := bgp.NewBGPProcessor(router, s.Topology, s.EventBus)
		processor.SetPacketCapture(s.PacketCapture)
		s.mu.Lock()
		s.Processors[req.ID] = processor
		s.mu.Unlock()
		processor.Start()

		json.NewEncoder(w).Encode(router)
		return
	}

	json.NewEncoder(w).Encode(s.Topology.GetAllRouters())
}

func (s *Simulator) handleRouter(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	routerID := strings.TrimPrefix(r.URL.Path, "/api/routers/")

	router := s.Topology.GetRouter(routerID)
	if router == nil {
		http.Error(w, "router not found", http.StatusNotFound)
		return
	}

	if r.Method == "DELETE" {
		s.Topology.RemoveRouter(routerID)
		s.mu.Lock()
		if proc, ok := s.Processors[routerID]; ok {
			proc.Stop()
			delete(s.Processors, routerID)
		}
		s.mu.Unlock()
		w.WriteHeader(http.StatusOK)
		return
	}

	json.NewEncoder(w).Encode(router)
}

func (s *Simulator) handleLinks(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method == "POST" {
		var req struct {
			ID        string `json:"id"`
			RouterA   string `json:"router_a"`
			RouterB   string `json:"router_b"`
			Network   string `json:"network"`
			IPAddressA string `json:"ip_a"`
			IPAddressB string `json:"ip_b"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		ipNet, err := bgp.ParseIPNet(req.Network)
		if err != nil {
			http.Error(w, "invalid network: "+err.Error(), http.StatusBadRequest)
			return
		}

		link := &bgp.Link{
			ID:         req.ID,
			RouterA:    req.RouterA,
			RouterB:    req.RouterB,
			IPNetwork:  ipNet,
			IPAddressA: net.ParseIP(req.IPAddressA),
			IPAddressB: net.ParseIP(req.IPAddressB),
			IsUp:       true,
			Bandwidth:  10000,
			Latency:    10,
		}

		s.Topology.AddLink(link)

		if err := bgp.EstablishBGPSession(s.Topology, s.EventBus, req.RouterA, req.RouterB, req.ID); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(link)
		return
	}

	json.NewEncoder(w).Encode(s.Topology.GetAllLinks())
}

func (s *Simulator) handleLink(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	linkID := strings.TrimPrefix(r.URL.Path, "/api/links/")

	link := s.Topology.GetLink(linkID)
	if link == nil {
		http.Error(w, "link not found", http.StatusNotFound)
		return
	}

	if r.Method == "DELETE" {
		s.Topology.RemoveLink(linkID)
		w.WriteHeader(http.StatusOK)
		return
	}

	json.NewEncoder(w).Encode(link)
}

func (s *Simulator) handleASes(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method == "POST" {
		var req struct {
			Number int    `json:"number"`
			Name   string `json:"name"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		as := bgp.NewAS(bgp.ASNumber(req.Number), req.Name)
		s.Topology.AddAS(as)
		json.NewEncoder(w).Encode(as)
		return
	}

	json.NewEncoder(w).Encode(s.Topology.GetAllASes())
}

func (s *Simulator) handleRoutes(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	routerID := strings.TrimPrefix(r.URL.Path, "/api/routes/")

	router := s.Topology.GetRouter(routerID)
	if router == nil {
		http.Error(w, "router not found", http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(router.RoutingTable.GetAllRoutes())
}

func (s *Simulator) handleRoutingTable(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	routerID := strings.TrimPrefix(r.URL.Path, "/api/routing-table/")

	router := s.Topology.GetRouter(routerID)
	if router == nil {
		http.Error(w, "router not found", http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(router.RoutingTable.GetBestRoutes())
}

func (s *Simulator) handleInjectRoute(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != "POST" {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		RouterID  string   `json:"router_id"`
		Prefix    string   `json:"prefix"`
		LocalPref uint32   `json:"local_pref"`
		ASPath    []uint32 `json:"as_path"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	s.mu.RLock()
	processor, ok := s.Processors[req.RouterID]
	s.mu.RUnlock()

	if !ok {
		http.Error(w, "router processor not found", http.StatusNotFound)
		return
	}

	prefix, err := bgp.ParseIPNet(req.Prefix)
	if err != nil {
		http.Error(w, "invalid prefix: "+err.Error(), http.StatusBadRequest)
		return
	}

	asPath := make([]bgp.ASNumber, len(req.ASPath))
	for i, asn := range req.ASPath {
		asPath[i] = bgp.ASNumber(asn)
	}

	processor.InjectRoute(prefix, req.LocalPref, asPath)

	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

func (s *Simulator) handleLinkDown(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != "POST" {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		LinkID string `json:"link_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	link := s.Topology.GetLink(req.LinkID)
	if link == nil {
		http.Error(w, "link not found", http.StatusNotFound)
		return
	}

	link.IsUp = false

	s.EventBus.Publish(event.Event{
		ID:     uuid.New().String(),
		Type:   event.EventTypeLinkDown,
		Source: "api",
		Data: map[string]interface{}{
			"link_id":  req.LinkID,
			"router_a": link.RouterA,
			"router_b": link.RouterB,
		},
	})

	json.NewEncoder(w).Encode(map[string]string{"status": "success", "link_id": req.LinkID})
}

func (s *Simulator) handleLinkUp(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != "POST" {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		LinkID string `json:"link_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	link := s.Topology.GetLink(req.LinkID)
	if link == nil {
		http.Error(w, "link not found", http.StatusNotFound)
		return
	}

	link.IsUp = true

	s.EventBus.Publish(event.Event{
		ID:     uuid.New().String(),
		Type:   event.EventTypeLinkUp,
		Source: "api",
		Data: map[string]interface{}{
			"link_id":  req.LinkID,
			"router_a": link.RouterA,
			"router_b": link.RouterB,
		},
	})

	json.NewEncoder(w).Encode(map[string]string{"status": "success", "link_id": req.LinkID})
}

func (s *Simulator) handleRouterDown(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req struct {
		RouterID string `json:"router_id"`
		Down     bool   `json:"down"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

func (s *Simulator) handlePCAPExport(w http.ResponseWriter, r *http.Request) {
	filename := "bgp_capture_" + strconv.FormatInt(time.Now().Unix(), 10) + ".pcap"

	if err := s.PacketCapture.ExportToFile(filename); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Disposition", "attachment; filename="+filename)
	w.Header().Set("Content-Type", "application/vnd.tcpdump.pcap")
	http.ServeFile(w, r, filename)
}

func (s *Simulator) handlePCAPStats(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	stats := map[string]interface{}{
		"total_packets": s.PacketCapture.GetPacketCount(),
		"packets":       s.PacketCapture.GetPackets(),
	}

	json.NewEncoder(w).Encode(stats)
}

func (s *Simulator) handleSave(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != "POST" {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if s.Store == nil {
		http.Error(w, "store not initialized", http.StatusInternalServerError)
		return
	}

	if err := s.Store.SaveTopology(s.Topology); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

func (s *Simulator) handleLoad(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != "POST" {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if s.Store == nil {
		http.Error(w, "store not initialized", http.StatusInternalServerError)
		return
	}

	loadedTopology, err := s.Store.LoadTopology()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	s.Topology = loadedTopology

	s.mu.Lock()
	for id, proc := range s.Processors {
		proc.Stop()
		delete(s.Processors, id)
	}
	s.mu.Unlock()

	for _, router := range s.Topology.GetAllRouters() {
		processor := bgp.NewBGPProcessor(router, s.Topology, s.EventBus)
		processor.SetPacketCapture(s.PacketCapture)
		s.mu.Lock()
		s.Processors[router.ID] = processor
		s.mu.Unlock()
		processor.Start()
	}

	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

func (s *Simulator) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	s.mu.Lock()
	s.wsClients[conn] = true
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		delete(s.wsClients, conn)
		s.mu.Unlock()
		conn.Close()
	}()

	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			break
		}
	}
}

func (s *Simulator) InitWithSampleTopology() {
	s.Topology = topology.CreateSampleTopology()

	for _, router := range s.Topology.GetAllRouters() {
		processor := bgp.NewBGPProcessor(router, s.Topology, s.EventBus)
		processor.SetPacketCapture(s.PacketCapture)
		s.Processors[router.ID] = processor
	}

	links := []string{"link-ab", "link-bc", "link-cd", "link-ad"}
	routers := [][]string{
		{"router-a", "router-b"},
		{"router-b", "router-c"},
		{"router-c", "router-d"},
		{"router-a", "router-d"},
	}

	for i, linkID := range links {
		bgp.EstablishBGPSession(s.Topology, s.EventBus, routers[i][0], routers[i][1], linkID)
	}

	for _, proc := range s.Processors {
		proc.Start()
	}

	fmt.Println("Sample topology initialized: AS100, AS200, AS300 with 4 routers")
}

func (s *Simulator) Close() {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, proc := range s.Processors {
		proc.Stop()
	}

	s.EventBus.Close()

	if s.Store != nil {
		s.Store.Close()
	}
}
