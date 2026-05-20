package kademlia

import (
	"crypto/sha1"
	"encoding/hex"
	"math/big"
	"net"
	"time"
)

const (
	IDLength      = 20
	BucketSize    = 20
	Alpha         = 3
	BucketsCount  = 160
)

type NodeID [IDLength]byte

func NewNodeID(data string) NodeID {
	hash := sha1.Sum([]byte(data))
	return NodeID(hash)
}

func (id NodeID) String() string {
	return hex.EncodeToString(id[:])
}

func (id NodeID) Distance(other NodeID) *big.Int {
	distance := new(big.Int)
	for i := 0; i < IDLength; i++ {
		distance.Lsh(distance, 8)
		distance.Or(distance, big.NewInt(int64(id[i]^other[i])))
	}
	return distance
}

func (id NodeID) BucketIndex(other NodeID) int {
	distance := id.Distance(other)
	for i := 0; i < BucketsCount; i++ {
		if distance.Bit(i) == 1 {
			return i
		}
	}
	return 0
}

type Contact struct {
	ID        NodeID
	Address   string
	LastSeen  time.Time
}

type Bucket struct {
	Contacts []*Contact
}

func NewBucket() *Bucket {
	return &Bucket{
		Contacts: make([]*Contact, 0, BucketSize),
	}
}

func (b *Bucket) Len() int {
	return len(b.Contacts)
}

func (b *Bucket) Add(contact *Contact) {
	for i, c := range b.Contacts {
		if c.ID == contact.ID {
			b.Contacts = append(b.Contacts[:i], b.Contacts[i+1:]...)
			break
		}
	}

	if len(b.Contacts) >= BucketSize {
		b.Contacts = b.Contacts[1:]
	}

	contact.LastSeen = time.Now()
	b.Contacts = append(b.Contacts, contact)
}

func (b *Bucket) FindClosest(target NodeID, count int) []*Contact {
	contacts := make([]*Contact, len(b.Contacts))
	copy(contacts, b.Contacts)

	for i := 0; i < len(contacts); i++ {
		for j := i + 1; j < len(contacts); j++ {
			d1 := contacts[i].ID.Distance(target)
			d2 := contacts[j].ID.Distance(target)
			if d1.Cmp(d2) > 0 {
				contacts[i], contacts[j] = contacts[j], contacts[i]
			}
		}
	}

	if count > len(contacts) {
		count = len(contacts)
	}

	return contacts[:count]
}

type RoutingTable struct {
	SelfID  NodeID
	Buckets [BucketsCount]*Bucket
}

func NewRoutingTable(selfID NodeID) *RoutingTable {
	rt := &RoutingTable{SelfID: selfID}
	for i := 0; i < BucketsCount; i++ {
		rt.Buckets[i] = NewBucket()
	}
	return rt
}

func (rt *RoutingTable) AddContact(contact *Contact) {
	if contact.ID == rt.SelfID {
		return
	}
	bucketIdx := rt.SelfID.BucketIndex(contact.ID)
	rt.Buckets[bucketIdx].Add(contact)
}

func (rt *RoutingTable) FindClosest(target NodeID, count int) []*Contact {
	var allContacts []*Contact
	for _, bucket := range rt.Buckets {
		allContacts = append(allContacts, bucket.Contacts...)
	}

	for i := 0; i < len(allContacts); i++ {
		for j := i + 1; j < len(allContacts); j++ {
			d1 := allContacts[i].ID.Distance(target)
			d2 := allContacts[j].ID.Distance(target)
			if d1.Cmp(d2) > 0 {
				allContacts[i], allContacts[j] = allContacts[j], allContacts[i]
			}
		}
	}

	if count > len(allContacts) {
		count = len(allContacts)
	}

	return allContacts[:count]
}

type Node struct {
	ID           NodeID
	Address      string
	RoutingTable *RoutingTable
	listener     net.Listener
}

func NewNode(address string) *Node {
	id := NewNodeID(address)
	return &Node{
		ID:           id,
		Address:      address,
		RoutingTable: NewRoutingTable(id),
	}
}
