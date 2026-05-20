package pool

import (
	"context"
	"fmt"
	"sync"
	"time"

	"modbus-mqtt-gateway/pkg/config"
	"modbus-mqtt-gateway/pkg/converter"
	"modbus-mqtt-gateway/pkg/edge"
	modbusclient "modbus-mqtt-gateway/pkg/modbus"
)

type Task struct {
	DeviceID  string
	ModbusCfg config.ModbusConfig
	Registers []config.RegisterConfig
}

type Result struct {
	DeviceID string
	Data     []converter.RegisterData
	Err      error
	Time     time.Time
}

type WorkerPool struct {
	taskChan    chan Task
	resultChan  chan Result
	workerCount int
	workers     []*Worker
	wg          sync.WaitGroup
	ctx         context.Context
	cancel      context.CancelFunc
	mu          sync.RWMutex
	running     bool
	processors  map[string]*edge.EdgeProcessor
	edgeCfg     *config.EdgeConfig
}

type Worker struct {
	id         int
	pool       *WorkerPool
	modbusCli  *modbusclient.Client
	lastDevice string
}

func NewWorkerPool(workerCount int, queueSize int, edgeCfg *config.EdgeConfig) *WorkerPool {
	ctx, cancel := context.WithCancel(context.Background())
	return &WorkerPool{
		taskChan:    make(chan Task, queueSize),
		resultChan:  make(chan Result, queueSize),
		workerCount: workerCount,
		ctx:         ctx,
		cancel:      cancel,
		processors:  make(map[string]*edge.EdgeProcessor),
		edgeCfg:     edgeCfg,
	}
}

func (p *WorkerPool) Start() {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.running {
		return
	}

	p.workers = make([]*Worker, p.workerCount)
	for i := 0; i < p.workerCount; i++ {
		worker := &Worker{
			id:   i,
			pool: p,
		}
		p.workers[i] = worker
		p.wg.Add(1)
		go worker.Start()
	}

	p.running = true
}

func (p *WorkerPool) Stop() {
	p.mu.Lock()
	defer p.mu.Unlock()

	if !p.running {
		return
	}

	p.cancel()
	close(p.taskChan)
	p.wg.Wait()
	close(p.resultChan)
	p.running = false
}

func (p *WorkerPool) Submit(task Task) error {
	p.mu.RLock()
	defer p.mu.RUnlock()

	if !p.running {
		return fmt.Errorf("pool is not running")
	}

	select {
	case p.taskChan <- task:
		return nil
	case <-p.ctx.Done():
		return p.ctx.Err()
	}
}

func (p *WorkerPool) Results() <-chan Result {
	return p.resultChan
}

func (p *WorkerPool) GetOrCreateProcessor(deviceId string, registers []config.RegisterConfig) *edge.EdgeProcessor {
	p.mu.Lock()
	defer p.mu.Unlock()

	if proc, exists := p.processors[deviceId]; exists {
		return proc
	}

	proc := edge.NewEdgeProcessor(p.edgeCfg, registers)
	p.processors[deviceId] = proc
	return proc
}

func (p *WorkerPool) UpdateProcessorConfig(edgeCfg *config.EdgeConfig, devices map[string][]config.RegisterConfig) {
	p.mu.Lock()
	defer p.mu.Unlock()

	p.edgeCfg = edgeCfg

	for deviceId, registers := range devices {
		if proc, exists := p.processors[deviceId]; exists {
			proc.UpdateConfig(edgeCfg, registers)
		} else {
			p.processors[deviceId] = edge.NewEdgeProcessor(edgeCfg, registers)
		}
	}
}

func (w *Worker) Start() {
	defer w.pool.wg.Done()

	for {
		select {
		case <-w.pool.ctx.Done():
			return
		case task, ok := <-w.pool.taskChan:
			if !ok {
				return
			}
			result := w.processTask(task)
			select {
			case w.pool.resultChan <- result:
			case <-w.pool.ctx.Done():
				return
			}
		}
	}
}

func (w *Worker) processTask(task Task) Result {
	result := Result{
		DeviceID: task.DeviceID,
		Time:     time.Now(),
	}

	if w.modbusCli == nil || w.lastDevice != task.DeviceID {
		if w.modbusCli != nil {
			w.modbusCli.Disconnect()
		}

		cli, err := modbusclient.NewClient(task.ModbusCfg)
		if err != nil {
			result.Err = fmt.Errorf("failed to create modbus client: %w", err)
			return result
		}
		w.modbusCli = cli
		w.lastDevice = task.DeviceID
	}

	data, err := w.modbusCli.ReadAllRegisters(task.Registers)
	if err != nil {
		result.Err = err
		result.Data = data
		return result
	}

	result.Data = data
	return result
}

func (p *WorkerPool) ProcessResults(handler func(Result, []edge.ProcessedData)) {
	for result := range p.Results() {
		processor := p.GetOrCreateProcessor(result.DeviceID, nil)
		var processed []edge.ProcessedData
		for _, d := range result.Data {
			processed = append(processed, processor.Process(d))
		}
		handler(result, processed)
	}
}
