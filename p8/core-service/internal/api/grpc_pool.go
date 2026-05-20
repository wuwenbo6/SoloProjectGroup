package api

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"go.uber.org/zap"
	"google.golang.org/grpc"
	"google.golang.org/grpc/connectivity"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/keepalive"
)

const (
	DefaultMaxConnections = 10
	DefaultMaxIdleTime    = 5 * time.Minute
)

type LoadBalancerStrategy string

const (
	RoundRobin LoadBalancerStrategy = "round_robin"
	LeastConn  LoadBalancerStrategy = "least_conn"
)

type GRPCConnectionPool struct {
	logger           *zap.Logger
	mu               sync.RWMutex
	connections      []*grpc.ClientConn
	target           string
	maxConns         int
	currentIdx       uint32
	strategy         LoadBalancerStrategy
	connCounts       map[*grpc.ClientConn]int32
	idleTimeout      time.Duration
	clientParams     []grpc.DialOption
	keepaliveParams  keepalive.ClientParameters
}

type PoolConfig struct {
	Target           string
	MaxConnections   int
	Strategy         LoadBalancerStrategy
	IdleTimeout      time.Duration
	KeepaliveTime    time.Duration
	KeepaliveTimeout time.Duration
}

func NewGRPCConnectionPool(cfg PoolConfig, logger *zap.Logger) (*GRPCConnectionPool, error) {
	if cfg.MaxConnections <= 0 {
		cfg.MaxConnections = DefaultMaxConnections
	}
	if cfg.IdleTimeout <= 0 {
		cfg.IdleTimeout = DefaultMaxIdleTime
	}
	if cfg.Strategy == "" {
		cfg.Strategy = RoundRobin
	}

	pool := &GRPCConnectionPool{
		logger:          logger,
		target:          cfg.Target,
		maxConns:        cfg.MaxConnections,
		strategy:        cfg.Strategy,
		connections:     make([]*grpc.ClientConn, 0, cfg.MaxConnections),
		connCounts:      make(map[*grpc.ClientConn]int32),
		idleTimeout:     cfg.IdleTimeout,
		keepaliveParams: keepalive.ClientParameters{
			Time:                cfg.KeepaliveTime,
			Timeout:             cfg.KeepaliveTimeout,
			PermitWithoutStream: true,
		},
	}

	pool.clientParams = []grpc.DialOption{
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithKeepaliveParams(pool.keepaliveParams),
		grpc.WithDefaultServiceConfig(fmt.Sprintf(`{"loadBalancingPolicy":"%s"}`, cfg.Strategy)),
	}

	if err := pool.initializeConnections(); err != nil {
		return nil, err
	}

	go pool.startHealthChecker()

	return pool, nil
}

func (p *GRPCConnectionPool) initializeConnections() error {
	p.mu.Lock()
	defer p.mu.Unlock()

	for i := 0; i < p.maxConns; i++ {
		conn, err := p.createConnection()
		if err != nil {
			return fmt.Errorf("failed to create connection %d: %w", i, err)
		}
		p.connections = append(p.connections, conn)
		p.connCounts[conn] = 0
	}

	p.logger.Info("GRPC connection pool initialized",
		zap.Int("connections", len(p.connections)),
		zap.String("target", p.target),
		zap.String("strategy", string(p.strategy)))

	return nil
}

func (p *GRPCConnectionPool) createConnection() (*grpc.ClientConn, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	conn, err := grpc.DialContext(ctx, p.target, p.clientParams...)
	if err != nil {
		return nil, err
	}

	return conn, nil
}

func (p *GRPCConnectionPool) Get() (*grpc.ClientConn, error) {
	p.mu.RLock()
	defer p.mu.RUnlock()

	if len(p.connections) == 0 {
		return nil, errors.New("no available connections in pool")
	}

	var selected *grpc.ClientConn

	switch p.strategy {
	case RoundRobin:
		idx := atomic.AddUint32(&p.currentIdx, 1) % uint32(len(p.connections))
		selected = p.connections[idx]

	case LeastConn:
		minCount := int32(1 << 30)
		for _, conn := range p.connections {
			count := atomic.LoadInt32(&p.connCounts[conn])
			if count < minCount {
				minCount = count
				selected = conn
			}
		}

	default:
		idx := atomic.AddUint32(&p.currentIdx, 1) % uint32(len(p.connections))
		selected = p.connections[idx]
	}

	if selected.GetState() == connectivity.Shutdown {
		p.mu.RUnlock()
		if err := p.replaceDeadConnection(selected); err != nil {
			p.logger.Warn("Failed to replace dead connection", zap.Error(err))
		}
		p.mu.RLock()
		if len(p.connections) > 0 {
			selected = p.connections[0]
		} else {
			return nil, errors.New("no healthy connections available")
		}
	}

	atomic.AddInt32(&p.connCounts[selected], 1)
	return selected, nil
}

func (p *GRPCConnectionPool) Put(conn *grpc.ClientConn) {
	atomic.AddInt32(&p.connCounts[conn], -1)
}

func (p *GRPCConnectionPool) replaceDeadConnection(deadConn *grpc.ClientConn) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	for i, conn := range p.connections {
		if conn == deadConn {
			_ = conn.Close()
			delete(p.connCounts, conn)

			newConn, err := p.createConnection()
			if err != nil {
				p.connections = append(p.connections[:i], p.connections[i+1:]...)
				return err
			}

			p.connections[i] = newConn
			p.connCounts[newConn] = 0
			p.logger.Info("Replaced dead GRPC connection")
			return nil
		}
	}

	return errors.New("connection not found in pool")
}

func (p *GRPCConnectionPool) startHealthChecker() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		p.checkConnectionsHealth()
	}
}

func (p *GRPCConnectionPool) checkConnectionsHealth() {
	p.mu.RLock()
	defer p.mu.RUnlock()

	for _, conn := range p.connections {
		state := conn.GetState()

		if state == connectivity.Shutdown || state == connectivity.TransientFailure {
			p.logger.Warn("Detected unhealthy GRPC connection",
				zap.String("state", state.String()))
		}
	}
}

func (p *GRPCConnectionPool) GetStats() map[string]interface{} {
	p.mu.RLock()
	defer p.mu.RUnlock()

	stats := make(map[string]interface{})
	stats["total_connections"] = len(p.connections)
	stats["target"] = p.target
	stats["strategy"] = p.strategy

	connStats := make(map[string]int32)
	for conn, count := range p.connCounts {
		state := conn.GetState().String()
		connStats[state] += count
	}
	stats["connection_stats"] = connStats

	return stats
}

func (p *GRPCConnectionPool) Close() error {
	p.mu.Lock()
	defer p.mu.Unlock()

	var errs []error
	for _, conn := range p.connections {
		if err := conn.Close(); err != nil {
			errs = append(errs, err)
		}
	}

	p.connections = nil
	p.connCounts = make(map[*grpc.ClientConn]int32)

	if len(errs) > 0 {
		return fmt.Errorf("errors closing connections: %v", errs)
	}

	return nil
}

func (p *GRPCConnectionPool) Invoke(ctx context.Context, method string, args, reply interface{}, opts ...grpc.CallOption) error {
	conn, err := p.Get()
	if err != nil {
		return err
	}
	defer p.Put(conn)

	return conn.Invoke(ctx, method, args, reply, opts...)
}

func (p *GRPCConnectionPool) NewStream(ctx context.Context, desc *grpc.StreamDesc, method string, opts ...grpc.CallOption) (grpc.ClientStream, error) {
	conn, err := p.Get()
	if err != nil {
		return nil, err
	}

	stream, err := grpc.NewClientStream(ctx, desc, conn, method, opts...)
	if err != nil {
		p.Put(conn)
		return nil, err
	}

	return &monitoredStream{
		ClientStream: stream,
		pool:         p,
		conn:         conn,
	}, nil
}

type monitoredStream struct {
	grpc.ClientStream
	pool *GRPCConnectionPool
	conn *grpc.ClientConn
}

func (s *monitoredStream) CloseSend() error {
	err := s.ClientStream.CloseSend()
	s.pool.Put(s.conn)
	return err
}
