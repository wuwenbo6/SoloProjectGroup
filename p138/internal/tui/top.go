package tui

import (
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
)

type ProtocolStats struct {
	Protocol     string
	Count        int
	TotalLatency float64
	AvgLatency   float64
	MaxLatency   float64
	MinLatency   float64
}

type ProcessStats struct {
	PID          int
	Comm         string
	ContainerID  string
	Protocol     string
	Count        int
	TotalLatency float64
	AvgLatency   float64
	LastLatency  float64
}

type Alert struct {
	Message  string
	Level    string
	Time     time.Time
	Latency  float64
	Protocol string
}

type TopUI struct {
	app            *tview.Application
	protocolTable  *tview.Table
	processTable   *tview.Table
	alertList      *tview.List
	statusBar      *tview.TextView
	mu             sync.Mutex
	protocolStats  map[string]*ProtocolStats
	processStats   map[string]*ProcessStats
	alerts         []*Alert
	thresholds     map[string]float64
	totalRequests  int
	totalResponses int
	startTime      time.Time
	alertCallback  func(*Alert)
}

func NewTopUI() *TopUI {
	ui := &TopUI{
		protocolStats: make(map[string]*ProtocolStats),
		processStats:  make(map[string]*ProcessStats),
		thresholds: map[string]float64{
			"HTTP":  500.0,
			"gRPC":  300.0,
			"MySQL": 200.0,
		},
		startTime: time.Now(),
	}

	ui.initUI()
	return ui
}

func (ui *TopUI) initUI() {
	ui.app = tview.NewApplication()

	flex := tview.NewFlex().SetDirection(tview.FlexRow)

	title := tview.NewTextView()
	title.SetTextColor(tcell.ColorGreen)
	title.SetTextAlign(tview.AlignCenter)
	title.SetText("🐝 eBPF Latency Monitor - Press 'q' to quit, 'c' to clear stats")

	ui.statusBar = tview.NewTextView()
	ui.statusBar.SetTextColor(tcell.ColorYellow)
	ui.statusBar.SetBackgroundColor(tcell.ColorDefault)
	ui.updateStatusBar()

	ui.protocolTable = tview.NewTable()
	ui.protocolTable.SetBorders(true)
	ui.protocolTable.SetBorder(true)
	ui.protocolTable.SetTitle(" Protocol Statistics ")
	ui.protocolTable.SetTitleColor(tcell.ColorCyan)

	headers := []string{"Protocol", "Count", "Avg(ms)", "Min(ms)", "Max(ms)", "Total(ms)"}
	for i, h := range headers {
		ui.protocolTable.SetCell(0, i, tview.NewTableCell(h).SetTextColor(tcell.ColorGreen).SetAlign(tview.AlignCenter))
	}

	ui.processTable = tview.NewTable()
	ui.processTable.SetBorders(true)
	ui.processTable.SetBorder(true)
	ui.processTable.SetTitle(" Top Processes ")
	ui.processTable.SetTitleColor(tcell.ColorCyan)

	processHeaders := []string{"PID", "Command", "Container", "Protocol", "Count", "Last(ms)", "Avg(ms)"}
	for i, h := range processHeaders {
		ui.processTable.SetCell(0, i, tview.NewTableCell(h).SetTextColor(tcell.ColorGreen).SetAlign(tview.AlignCenter))
	}

	ui.alertList = tview.NewList()
	ui.alertList.SetBorder(true)
	ui.alertList.SetTitle(" Alerts (Recent 10) ")
	ui.alertList.SetTitleColor(tcell.ColorRed)

	tables := tview.NewFlex().SetDirection(tview.FlexColumn)
	tables.AddItem(ui.protocolTable, 0, 1, false)
	tables.AddItem(ui.processTable, 0, 2, false)

	flex.AddItem(title, 1, 0, false)
	flex.AddItem(ui.statusBar, 1, 0, false)
	flex.AddItem(tables, 0, 3, false)
	flex.AddItem(ui.alertList, 10, 1, false)

	ui.app.SetRoot(flex, true)

	ui.app.SetInputCapture(func(event *tcell.EventKey) *tcell.EventKey {
		if event.Rune() == 'q' {
			ui.app.Stop()
			return nil
		}
		if event.Rune() == 'c' {
			ui.Clear()
			return nil
		}
		return event
	})
}

func (ui *TopUI) updateStatusBar() {
	duration := time.Since(ui.startTime).Round(time.Second)
	status := fmt.Sprintf("  📊 Total: %d req / %d resp | ⏱ Uptime: %v | 🚨 Thresholds: HTTP=%.0fms gRPC=%.0fms MySQL=%.0fms",
		ui.totalRequests, ui.totalResponses, duration,
		ui.thresholds["HTTP"], ui.thresholds["gRPC"], ui.thresholds["MySQL"])
	ui.statusBar.SetText(status)
}

func (ui *TopUI) SetThreshold(protocol string, thresholdMs float64) {
	ui.mu.Lock()
	defer ui.mu.Unlock()
	ui.thresholds[protocol] = thresholdMs
}

func (ui *TopUI) GetThreshold(protocol string) float64 {
	ui.mu.Lock()
	defer ui.mu.Unlock()
	return ui.thresholds[protocol]
}

func (ui *TopUI) SetAlertCallback(callback func(*Alert)) {
	ui.mu.Lock()
	defer ui.mu.Unlock()
	ui.alertCallback = callback
}

func (ui *TopUI) RecordEvent(pid int, comm, containerID, protocol string, latencyMs float64, isRequest, isResponse bool) {
	ui.mu.Lock()
	defer ui.mu.Unlock()

	if isRequest {
		ui.totalRequests++
	}
	if isResponse {
		ui.totalResponses++
	}

	if protocol == "" {
		return
	}

	if _, exists := ui.protocolStats[protocol]; !exists {
		ui.protocolStats[protocol] = &ProtocolStats{
			Protocol:   protocol,
			MinLatency: 999999,
		}
	}

	ps := ui.protocolStats[protocol]
	if isResponse {
		ps.Count++
		ps.TotalLatency += latencyMs
		ps.AvgLatency = ps.TotalLatency / float64(ps.Count)
		if latencyMs > ps.MaxLatency {
			ps.MaxLatency = latencyMs
		}
		if latencyMs < ps.MinLatency {
			ps.MinLatency = latencyMs
		}

		if threshold, ok := ui.thresholds[protocol]; ok && latencyMs > threshold {
			alert := &Alert{
				Message:  fmt.Sprintf("High latency detected: %.2fms", latencyMs),
				Level:    "WARNING",
				Time:     time.Now(),
				Latency:  latencyMs,
				Protocol: protocol,
			}
			ui.alerts = append([]*Alert{alert}, ui.alerts...)
			if len(ui.alerts) > 10 {
				ui.alerts = ui.alerts[:10]
			}
			if ui.alertCallback != nil {
				ui.alertCallback(alert)
			}
		}
	}

	key := fmt.Sprintf("%d-%s-%s", pid, comm, protocol)
	if _, exists := ui.processStats[key]; !exists {
		ui.processStats[key] = &ProcessStats{
			PID:         pid,
			Comm:        comm,
			ContainerID: containerID,
			Protocol:    protocol,
		}
	}

	proc := ui.processStats[key]
	if isResponse {
		proc.Count++
		proc.TotalLatency += latencyMs
		proc.AvgLatency = proc.TotalLatency / float64(proc.Count)
		proc.LastLatency = latencyMs
	}

	ui.app.QueueUpdateDraw(func() {
		ui.refreshTables()
		ui.refreshAlerts()
		ui.updateStatusBar()
	})
}

func (ui *TopUI) refreshTables() {
	protocols := make([]*ProtocolStats, 0, len(ui.protocolStats))
	for _, p := range ui.protocolStats {
		protocols = append(protocols, p)
	}
	sort.Slice(protocols, func(i, j int) bool {
		return protocols[i].Count > protocols[j].Count
	})

	for row, p := range protocols {
		colors := map[string]tcell.Color{
			"HTTP":  tcell.ColorBlue,
			"gRPC":  tcell.ColorGreen,
			"MySQL": tcell.ColorOrange,
		}
		color := colors[p.Protocol]

		ui.protocolTable.SetCell(row+1, 0, tview.NewTableCell(p.Protocol).SetTextColor(color))
		ui.protocolTable.SetCell(row+1, 1, tview.NewTableCell(fmt.Sprintf("%d", p.Count)).SetAlign(tview.AlignRight))
		ui.protocolTable.SetCell(row+1, 2, tview.NewTableCell(fmt.Sprintf("%.2f", p.AvgLatency)).SetAlign(tview.AlignRight))
		ui.protocolTable.SetCell(row+1, 3, tview.NewTableCell(fmt.Sprintf("%.2f", p.MinLatency)).SetAlign(tview.AlignRight))
		ui.protocolTable.SetCell(row+1, 4, tview.NewTableCell(fmt.Sprintf("%.2f", p.MaxLatency)).SetAlign(tview.AlignRight))
		ui.protocolTable.SetCell(row+1, 5, tview.NewTableCell(fmt.Sprintf("%.2f", p.TotalLatency)).SetAlign(tview.AlignRight))
	}

	processes := make([]*ProcessStats, 0, len(ui.processStats))
	for _, p := range ui.processStats {
		processes = append(processes, p)
	}
	sort.Slice(processes, func(i, j int) bool {
		return processes[i].Count > processes[j].Count
	})

	maxRows := 15
	for row, p := range processes {
		if row >= maxRows {
			break
		}
		containerID := p.ContainerID
		if len(containerID) > 12 {
			containerID = containerID[:12]
		}

		colors := map[string]tcell.Color{
			"HTTP":  tcell.ColorBlue,
			"gRPC":  tcell.ColorGreen,
			"MySQL": tcell.ColorOrange,
		}
		color := colors[p.Protocol]

		ui.processTable.SetCell(row+1, 0, tview.NewTableCell(fmt.Sprintf("%d", p.PID)).SetAlign(tview.AlignRight))
		ui.processTable.SetCell(row+1, 1, tview.NewTableCell(p.Comm).SetTextColor(color))
		ui.processTable.SetCell(row+1, 2, tview.NewTableCell(containerID).SetAlign(tview.AlignCenter))
		ui.processTable.SetCell(row+1, 3, tview.NewTableCell(p.Protocol).SetTextColor(color))
		ui.processTable.SetCell(row+1, 4, tview.NewTableCell(fmt.Sprintf("%d", p.Count)).SetAlign(tview.AlignRight))
		ui.processTable.SetCell(row+1, 5, tview.NewTableCell(fmt.Sprintf("%.2f", p.LastLatency)).SetAlign(tview.AlignRight))
		ui.processTable.SetCell(row+1, 6, tview.NewTableCell(fmt.Sprintf("%.2f", p.AvgLatency)).SetAlign(tview.AlignRight))
	}
}

func (ui *TopUI) refreshAlerts() {
	ui.alertList.Clear()
	for _, alert := range ui.alerts {
		color := tcell.ColorYellow
		if alert.Level == "CRITICAL" {
			color = tcell.ColorRed
		}
		item := fmt.Sprintf("[%s] %s - %s - %.2fms", alert.Time.Format("15:04:05"), alert.Protocol, alert.Message, alert.Latency)
		ui.alertList.AddItem(item, "", 0, nil)
		ui.alertList.SetItemColor(ui.alertList.GetItemCount()-1, 0, color)
	}
}

func (ui *TopUI) Clear() {
	ui.mu.Lock()
	defer ui.mu.Unlock()

	ui.protocolStats = make(map[string]*ProtocolStats)
	ui.processStats = make(map[string]*ProcessStats)
	ui.alerts = nil
	ui.totalRequests = 0
	ui.totalResponses = 0
	ui.startTime = time.Now()

	ui.app.QueueUpdateDraw(func() {
		ui.protocolTable.Clear()
		headers := []string{"Protocol", "Count", "Avg(ms)", "Min(ms)", "Max(ms)", "Total(ms)"}
		for i, h := range headers {
			ui.protocolTable.SetCell(0, i, tview.NewTableCell(h).SetTextColor(tcell.ColorGreen).SetAlign(tview.AlignCenter))
		}

		ui.processTable.Clear()
		processHeaders := []string{"PID", "Command", "Container", "Protocol", "Count", "Last(ms)", "Avg(ms)"}
		for i, h := range processHeaders {
			ui.processTable.SetCell(0, i, tview.NewTableCell(h).SetTextColor(tcell.ColorGreen).SetAlign(tview.AlignCenter))
		}
		ui.refreshAlerts()
		ui.updateStatusBar()
	})
}

func (ui *TopUI) Run() error {
	return ui.app.Run()
}

func (ui *TopUI) Stop() {
	ui.app.Stop()
}
