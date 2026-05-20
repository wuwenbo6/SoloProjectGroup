package topology

import (
	"bgp-simulator/internal/bgp"
	"encoding/json"
	"fmt"
	"net"

	"github.com/syndtr/goleveldb/leveldb"
	"github.com/syndtr/goleveldb/leveldb/util"
)

type Store struct {
	db *leveldb.DB
}

func NewStore(path string) (*Store, error) {
	db, err := leveldb.OpenFile(path, nil)
	if err != nil {
		return nil, err
	}
	return &Store{db: db}, nil
}

func (s *Store) Close() error {
	return s.db.Close()
	return nil
}

func (s *Store) SaveTopology(topology *bgp.Topology) error {
	batch := new(leveldb.Batch)

	for asn, as := range topology.GetAllASes() {
		key := []byte(fmt.Sprintf("as:%d", asn))
		data, err := json.Marshal(as)
		if err != nil {
			return err
		}
		batch.Put(key, data)
	}

	for id, router := range topology.GetAllRouters() {
		key := []byte(fmt.Sprintf("router:%s", id))
		data, err := json.Marshal(router)
		if err != nil {
			return err
		}
		batch.Put(key, data)
	}

	for id, link := range topology.GetAllLinks() {
		key := []byte(fmt.Sprintf("link:%s", id))
		data, err := json.Marshal(link)
		if err != nil {
			return err
		}
		batch.Put(key, data)
	}

	return s.db.Write(batch, nil)
}

func (s *Store) LoadTopology() (*bgp.Topology, error) {
	topology := bgp.NewTopology()

	iter := s.db.NewIterator(util.BytesPrefix([]byte("as:")), nil)
	for iter.Next() {
		var as bgp.AS
		if err := json.Unmarshal(iter.Value(), &as); err != nil {
			iter.Release()
			return nil, err
		}
		topology.AddAS(&as)
	}
	iter.Release()

	iter = s.db.NewIterator(util.BytesPrefix([]byte("router:")), nil)
	for iter.Next() {
		var router bgp.Router
		if err := json.Unmarshal(iter.Value(), &router); err != nil {
			iter.Release()
			return nil, err
		}
		rt := bgp.NewRouter(router.ID, router.Name, router.ASN, router.IP)
		rt.LoopbackIP = router.LoopbackIP
		rt.ConnectedRoutes = router.ConnectedRoutes
		for id, n := range router.Neighbors {
			rt.Neighbors[id] = n
		}
		topology.AddRouter(rt)
	}
	iter.Release()

	iter = s.db.NewIterator(util.BytesPrefix([]byte("link:")), nil)
	for iter.Next() {
		var link bgp.Link
		if err := json.Unmarshal(iter.Value(), &link); err != nil {
			iter.Release()
			return nil, err
		}
		topology.AddLink(&link)
	}
	iter.Release()

	if err := iter.Error(); err != nil {
		return nil, err
	}

	return topology, nil
}

func (s *Store) SaveAS(as *bgp.AS) error {
	key := []byte(fmt.Sprintf("as:%d", as.Number))
	data, err := json.Marshal(as)
	if err != nil {
		return err
	}
	return s.db.Put(key, data, nil)
}

func (s *Store) DeleteAS(asn bgp.ASNumber) error {
	key := []byte(fmt.Sprintf("as:%d", asn))
	return s.db.Delete(key, nil)
}

func (s *Store) SaveRouter(router *bgp.Router) error {
	key := []byte(fmt.Sprintf("router:%s", router.ID))
	data, err := json.Marshal(router)
	if err != nil {
		return err
	}
	return s.db.Put(key, data, nil)
}

func (s *Store) DeleteRouter(routerID string) error {
	key := []byte(fmt.Sprintf("router:%s", routerID))
	return s.db.Delete(key, nil)
}

func (s *Store) SaveLink(link *bgp.Link) error {
	key := []byte(fmt.Sprintf("link:%s", link.ID))
	data, err := json.Marshal(link)
	if err != nil {
		return err
	}
	return s.db.Put(key, data, nil)
}

func (s *Store) DeleteLink(linkID string) error {
	key := []byte(fmt.Sprintf("link:%s", linkID))
	return s.db.Delete(key, nil)
}

func (s *Store) Clear() error {
	iter := s.db.NewIterator(nil, nil)
	for iter.Next() {
		if err := s.db.Delete(iter.Key(), nil); err != nil {
			iter.Release()
			return err
		}
	}
	iter.Release()
	return iter.Error()
}

func (s *Store) GetAllASes() (map[bgp.ASNumber]*bgp.AS, error) {
	result := make(map[bgp.ASNumber]*bgp.AS)

	iter := s.db.NewIterator(util.BytesPrefix([]byte("as:")), nil)
	for iter.Next() {
		var as bgp.AS
		if err := json.Unmarshal(iter.Value(), &as); err != nil {
			iter.Release()
			return nil, err
		}
		result[as.Number] = &as
	}
	iter.Release()

	return result, iter.Error()
}

func (s *Store) GetAllRouters() (map[string]*bgp.Router, error) {
	result := make(map[string]*bgp.Router)

	iter := s.db.NewIterator(util.BytesPrefix([]byte("router:")), nil)
	for iter.Next() {
		var router bgp.Router
		if err := json.Unmarshal(iter.Value(), &router); err != nil {
			iter.Release()
			return nil, err
		}
		rt := bgp.NewRouter(router.ID, router.Name, router.ASN, router.IP)
		rt.LoopbackIP = router.LoopbackIP
		rt.ConnectedRoutes = router.ConnectedRoutes
		result[router.ID] = rt
	}
	iter.Release()

	return result, iter.Error()
}

func (s *Store) GetAllLinks() (map[string]*bgp.Link, error) {
	result := make(map[string]*bgp.Link)

	iter := s.db.NewIterator(util.BytesPrefix([]byte("link:")), nil)
	for iter.Next() {
		var link bgp.Link
		if err := json.Unmarshal(iter.Value(), &link); err != nil {
			iter.Release()
			return nil, err
		}
		result[link.ID] = &link
	}
	iter.Release()

	return result, iter.Error()
}

func (s *Store) SaveRoute(routerID string, route *bgp.Route) error {
	key := []byte(fmt.Sprintf("route:%s:%s", routerID, route.Prefix.String()))
	data, err := json.Marshal(route)
	if err != nil {
		return err
	}
	return s.db.Put(key, data, nil)
}

func (s *Store) GetRoutes(routerID string) ([]*bgp.Route, error) {
	var routes []*bgp.Route

	prefix := []byte(fmt.Sprintf("route:%s:", routerID))
	iter := s.db.NewIterator(util.BytesPrefix(prefix), nil)
	for iter.Next() {
		var route bgp.Route
		if err := json.Unmarshal(iter.Value(), &route); err != nil {
			iter.Release()
			return nil, err
		}
		routes = append(routes, &route)
	}
	iter.Release()

	return routes, iter.Error()
}

func (s *Store) DeleteRoute(routerID string, prefix string) error {
	key := []byte(fmt.Sprintf("route:%s:%s", routerID, prefix))
	return s.db.Delete(key, nil)
}

func CreateSampleTopology() *bgp.Topology {
	topology := bgp.NewTopology()

	as100 := bgp.NewAS(100, "AS100")
	as200 := bgp.NewAS(200, "AS200")
	as300 := bgp.NewAS(300, "AS300")

	topology.AddAS(as100)
	topology.AddAS(as200)
	topology.AddAS(as300)

	routerA := bgp.NewRouter("router-a", "Router A", 100, net.ParseIP("10.0.0.1"))
	routerB := bgp.NewRouter("router-b", "Router B", 100, net.ParseIP("10.0.0.2"))
	routerC := bgp.NewRouter("router-c", "Router C", 200, net.ParseIP("10.0.0.3"))
	routerD := bgp.NewRouter("router-d", "Router D", 300, net.ParseIP("10.0.0.4"))

	prefix1, _ := bgp.ParseIPNet("192.168.100.0/24")
	prefix2, _ := bgp.ParseIPNet("192.168.200.0/24")
	routerA.AddConnectedRoute(prefix1)
	routerC.AddConnectedRoute(prefix2)

	topology.AddRouter(routerA)
	topology.AddRouter(routerB)
	topology.AddRouter(routerC)
	topology.AddRouter(routerD)

	ipNetAB, _ := bgp.ParseIPNet("10.1.1.0/30")
	linkAB := &bgp.Link{
		ID:         "link-ab",
		RouterA:    "router-a",
		RouterB:    "router-b",
		IPNetwork:  ipNetAB,
		IPAddressA: net.ParseIP("10.1.1.1"),
		IPAddressB: net.ParseIP("10.1.1.2"),
		IsUp:       true,
		Bandwidth:  10000,
		Latency:    5,
	}
	topology.AddLink(linkAB)

	ipNetBC, _ := bgp.ParseIPNet("10.1.2.0/30")
	linkBC := &bgp.Link{
		ID:         "link-bc",
		RouterA:    "router-b",
		RouterB:    "router-c",
		IPNetwork:  ipNetBC,
		IPAddressA: net.ParseIP("10.1.2.1"),
		IPAddressB: net.ParseIP("10.1.2.2"),
		IsUp:       true,
		Bandwidth:  10000,
		Latency:    10,
	}
	topology.AddLink(linkBC)

	ipNetCD, _ := bgp.ParseIPNet("10.1.3.0/30")
	linkCD := &bgp.Link{
		ID:         "link-cd",
		RouterA:    "router-c",
		RouterB:    "router-d",
		IPNetwork:  ipNetCD,
		IPAddressA: net.ParseIP("10.1.3.1"),
		IPAddressB: net.ParseIP("10.1.3.2"),
		IsUp:       true,
		Bandwidth:  10000,
		Latency:    15,
	}
	topology.AddLink(linkCD)

	ipNetAD, _ := bgp.ParseIPNet("10.1.4.0/30")
	linkAD := &bgp.Link{
		ID:         "link-ad",
		RouterA:    "router-a",
		RouterB:    "router-d",
		IPNetwork:  ipNetAD,
		IPAddressA: net.ParseIP("10.1.4.1"),
		IPAddressB: net.ParseIP("10.1.4.2"),
		IsUp:       true,
		Bandwidth:  1000,
		Latency:    50,
	}
	topology.AddLink(linkAD)

	return topology
}
