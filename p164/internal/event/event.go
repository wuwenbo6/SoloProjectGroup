package event

import (
	"encoding/json"
	"sync"
	"time"
)

type EventType string

const (
	EventTypeBGPUpdate    EventType = "BGP_UPDATE"
	EventTypeBGPWithdraw  EventType = "BGP_WITHDRAW"
	EventTypeLinkDown     EventType = "LINK_DOWN"
	EventTypeLinkUp       EventType = "LINK_UP"
	EventTypeRouteAdded   EventType = "ROUTE_ADDED"
	EventTypeRouteRemoved EventType = "ROUTE_REMOVED"
	EventTypePacket       EventType = "PACKET"
)

type Event struct {
	ID        string      `json:"id"`
	Type      EventType   `json:"type"`
	Source    string      `json:"source"`
	Target    string      `json:"target,omitempty"`
	Timestamp time.Time   `json:"timestamp"`
	Data      interface{} `json:"data"`
}

type EventHandler func(Event)

type EventBus struct {
	mu          sync.RWMutex
	subscribers map[EventType][]EventHandler
	eventQueue  chan Event
	done        chan struct{}
}

func NewEventBus(bufferSize int) *EventBus {
	eb := &EventBus{
		subscribers: make(map[EventType][]EventHandler),
		eventQueue:  make(chan Event, bufferSize),
		done:        make(chan struct{}),
	}
	go eb.processEvents()
	return eb
}

func (eb *EventBus) Subscribe(eventType EventType, handler EventHandler) {
	eb.mu.Lock()
	defer eb.mu.Unlock()
	eb.subscribers[eventType] = append(eb.subscribers[eventType], handler)
}

func (eb *EventBus) Publish(event Event) {
	event.Timestamp = time.Now()
	select {
	case eb.eventQueue <- event:
	default:
	}
}

func (eb *EventBus) processEvents() {
	for {
		select {
		case event := <-eb.eventQueue:
			eb.dispatch(event)
		case <-eb.done:
			return
		}
	}
}

func (eb *EventBus) dispatch(event Event) {
	eb.mu.RLock()
	defer eb.mu.RUnlock()

	handlers := eb.subscribers[event.Type]
	for _, handler := range handlers {
		go handler(event)
	}

	allHandlers := eb.subscribers["*"]
	for _, handler := range allHandlers {
		go handler(event)
	}
}

func (eb *EventBus) Close() {
	close(eb.done)
	close(eb.eventQueue)
}

func (e *Event) ToJSON() ([]byte, error) {
	return json.Marshal(e)
}

func FromJSON(data []byte) (*Event, error) {
	var e Event
	if err := json.Unmarshal(data, &e); err != nil {
		return nil, err
	}
	return &e, nil
}
