package pdf_exporter

import (
	"bytes"
	"fmt"
	"plc-simulator/internal/fbd"
	"plc-simulator/internal/ladder"
	"time"

	"github.com/jung-kurt/gofpdf"
)

// ExportConfig PDF导出配置
type ExportConfig struct {
	Title       string
	Author      string
	Description string
	PageSize    string // A4, Letter
	Orientation string // P (Portrait), L (Landscape)
	IncludeDate bool
}

// LadderDiagramData 梯形图数据
type LadderDiagramData struct {
	Rungs      []ladder.Rung   `json:"rungs"`
	Variables  []fbd.Variable  `json:"variables"`
}

// FBDDiagramData FBD功能块图数据
type FBDDiagramData struct {
	Blocks     []fbd.Block     `json:"blocks"`
	Wires      []fbd.Wire      `json:"wires"`
	Variables  []fbd.Variable  `json:"variables"`
}

// ExportResult 导出结果
type ExportResult struct {
	Data      []byte
	Filename  string
	PageCount int
}

// ExportLadderToPDF 导出梯形图为PDF
func ExportLadderToPDF(data LadderDiagramData, config ExportConfig) (*ExportResult, error) {
	pdf := initPDF(config)

	// 添加标题页
	addTitlePage(pdf, config.Title, config.Description)

	// 添加变量表
	addVariableTable(pdf, data.Variables)

	// 添加梯形图
	for i, rung := range data.Rungs {
		pdf.AddPage()
		addRungDiagram(pdf, rung, i+1)
	}

	// 添加页脚
	addFooter(pdf)

	var buf bytes.Buffer
	err := pdf.Output(&buf)
	if err != nil {
		return nil, err
	}

	return &ExportResult{
		Data:      buf.Bytes(),
		Filename:  fmt.Sprintf("ladder_%s.pdf", time.Now().Format("20060102_150405")),
		PageCount: pdf.PageCount(),
	}, nil
}

// ExportFBDToPDF 导出功能块图为PDF
func ExportFBDToPDF(data FBDDiagramData, config ExportConfig) (*ExportResult, error) {
	pdf := initPDF(config)

	// 添加标题页
	addTitlePage(pdf, config.Title, config.Description)

	// 添加变量表
	addVariableTable(pdf, data.Variables)

	// 添加FBD图
	pdf.AddPage()
	addFBDDiagram(pdf, data.Blocks, data.Wires)

	// 添加页脚
	addFooter(pdf)

	var buf bytes.Buffer
	err := pdf.Output(&buf)
	if err != nil {
		return nil, err
	}

	return &ExportResult{
		Data:      buf.Bytes(),
		Filename:  fmt.Sprintf("fbd_%s.pdf", time.Now().Format("20060102_150405")),
		PageCount: pdf.PageCount(),
	}, nil
}

// 初始化PDF
func initPDF(config ExportConfig) *gofpdf.Fpdf {
	pdf := gofpdf.New(config.Orientation, "mm", config.PageSize, "")
	pdf.SetFont("Arial", "", 12)
	pdf.SetMargins(15, 15, 15)
	pdf.SetAutoPageBreak(true, 15)
	return pdf
}

// 添加标题页
func addTitlePage(pdf *gofpdf.Fpdf, title, description string) {
	pdf.AddPage()

	// 标题
	pdf.SetFont("Arial", "B", 24)
	pdf.CellFormat(0, 30, title, "", 1, "C", false, 0, "")

	// 描述
	if description != "" {
		pdf.SetFont("Arial", "", 12)
		pdf.MultiCell(0, 8, description, "", "C", false)
	}

	// 日期
	pdf.Ln(20)
	pdf.SetFont("Arial", "I", 10)
	pdf.CellFormat(0, 8, fmt.Sprintf("生成时间: %s", time.Now().Format("2006-01-02 15:04:05")), "", 1, "C", false, 0, "")

	// 图例
	pdf.Ln(30)
	addLegend(pdf)
}

// 添加图例
func addLegend(pdf *gofpdf.Fpdf) {
	pdf.SetFont("Arial", "B", 12)
	pdf.CellFormat(0, 10, "图例说明", "", 1, "L", false, 0, "")
	
	legends := []struct {
		color []uint8
		text  string
	}{
		{[]uint8{76, 175, 80}, "正常常开触点"},
		{[]uint8{244, 67, 54}, "常闭触点"},
		{[]uint8{33, 150, 243}, "输出线圈"},
		{[]uint8{156, 39, 176}, "定时器/计数器"},
		{[]uint8{255, 152, 0}, "功能块"},
	}

	for _, l := range legends {
		pdf.Ln(6)
		// 颜色方块
		pdf.SetFillColor(l.color[0], l.color[1], l.color[2])
		pdf.Rect(20, pdf.GetY(), 8, 8, "F")
		pdf.SetX(32)
		pdf.SetFont("Arial", "", 10)
		pdf.CellFormat(0, 8, l.text, "", 0, "L", false, 0, "")
	}
}

// 添加变量表
func addVariableTable(pdf *gofpdf.Fpdf, variables []fbd.Variable) {
	if len(variables) == 0 {
		return
	}

	pdf.AddPage()
	pdf.SetFont("Arial", "B", 14)
	pdf.CellFormat(0, 10, "变量列表", "", 1, "L", false, 0, "")
	pdf.Ln(5)

	// 表头
	pdf.SetFont("Arial", "B", 10)
	pdf.SetFillColor(240, 240, 240)
	
	headers := []string{"名称", "类型", "地址", "说明"}
	widths := []float64{40, 30, 30, 90}
	
	for i, h := range headers {
		pdf.CellFormat(widths[i], 8, h, "1", 0, "C", true, 0, "")
	}
	pdf.Ln(-1)

	// 内容
	pdf.SetFont("Arial", "", 9)
	pdf.SetFillColor(255, 255, 255)
	
	for i, v := range variables {
		if i%2 == 0 {
			pdf.SetFillColor(250, 250, 250)
		} else {
			pdf.SetFillColor(255, 255, 255)
		}
		
		pdf.CellFormat(widths[0], 7, v.Name, "1", 0, "L", true, 0, "")
		pdf.CellFormat(widths[1], 7, v.Type, "1", 0, "C", true, 0, "")
		pdf.CellFormat(widths[2], 7, v.Address, "1", 0, "C", true, 0, "")
		pdf.CellFormat(widths[3], 7, v.Description, "1", 1, "L", true, 0, "")
	}
}

// 添加梯级图
func addRungDiagram(pdf *gofpdf.Fpdf, rung ladder.Rung, rungNum int) {
	startX := 20.0
	startY := 40.0
	spacing := 25.0

	// 梯级标题
	pdf.SetFont("Arial", "B", 12)
	pdf.SetY(startY - 15)
	pdf.CellFormat(0, 10, fmt.Sprintf("梯级 %d", rungNum), "", 1, "L", false, 0, "")

	// 绘制母线
	pdf.SetDrawColor(0, 0, 0)
	pdf.SetLineWidth(0.5)
	pdf.Line(startX, startY, startX, startY+50)   // 左母线
	pdf.Line(startX+170, startY, startX+170, startY+50) // 右母线

	// 绘制元件
	x := startX + 10
	for i, elem := range rung.Elements {
		switch elem.Type {
		case ladder.ElementNormOpen:
			drawOpenContact(pdf, x, startY+20, elem.Name)
		case ladder.ElementNormClosed:
			drawClosedContact(pdf, x, startY+20, elem.Name)
		case ladder.ElementCoil:
			drawCoil(pdf, x, startY+20, elem.Name)
		case ladder.ElementTimer:
			drawTimer(pdf, x, startY+15, elem.Name)
		}
		x += spacing
		
		// 绘制连接线
		if i < len(rung.Elements)-1 {
			pdf.Line(x-spacing+10, startY+20, x, startY+20)
		}
	}

	// 连接到右母线
	if len(rung.Elements) > 0 {
		pdf.Line(x-spacing+10, startY+20, startX+170, startY+20)
	}
}

// 绘制常开触点
func drawOpenContact(pdf *gofpdf.Fpdf, x, y float64, label string) {
	pdf.SetDrawColor(76, 175, 80)
	pdf.SetLineWidth(0.8)
	
	// 竖线
	pdf.Line(x, y-8, x, y+8)
	pdf.Line(x+10, y-8, x+10, y+8)
	
	// 标签
	pdf.SetFont("Arial", "", 8)
	pdf.SetXY(x, y+12)
	pdf.CellFormat(15, 5, label, "", 0, "C", false, 0, "")
}

// 绘制常闭触点
func drawClosedContact(pdf *gofpdf.Fpdf, x, y float64, label string) {
	pdf.SetDrawColor(244, 67, 54)
	pdf.SetLineWidth(0.8)
	
	// 竖线
	pdf.Line(x, y-8, x, y+8)
	pdf.Line(x+10, y-8, x+10, y+8)
	
	// 斜线
	pdf.Line(x+2, y-5, x+8, y+5)
	
	// 标签
	pdf.SetFont("Arial", "", 8)
	pdf.SetXY(x, y+12)
	pdf.CellFormat(15, 5, label, "", 0, "C", false, 0, "")
}

// 绘制线圈
func drawCoil(pdf *gofpdf.Fpdf, x, y float64, label string) {
	pdf.SetDrawColor(33, 150, 243)
	pdf.SetLineWidth(0.8)
	
	// 圆形
	pdf.Ellipse(x+7, y, 7, 7, 0, 0, 360, "")
	
	// 标签
	pdf.SetFont("Arial", "", 8)
	pdf.SetXY(x-5, y+12)
	pdf.CellFormat(24, 5, label, "", 0, "C", false, 0, "")
}

// 绘制定时器
func drawTimer(pdf *gofpdf.Fpdf, x, y float64, label string) {
	pdf.SetDrawColor(156, 39, 176)
	pdf.SetFillColor(237, 231, 246)
	pdf.SetLineWidth(0.8)
	
	// 矩形框
	pdf.Rect(x, y, 30, 20, "D")
	
	// 标签
	pdf.SetFont("Arial", "B", 8)
	pdf.SetXY(x, y+5)
	pdf.CellFormat(30, 5, "TIMER", "", 0, "C", false, 0, "")
	
	pdf.SetFont("Arial", "", 7)
	pdf.SetXY(x, y+12)
	pdf.CellFormat(30, 5, label, "", 0, "C", false, 0, "")
}

// 添加FBD图
func addFBDDiagram(pdf *gofpdf.Fpdf, blocks []fbd.Block, wires []fbd.Wire) {
	startX := 20.0
	startY := 40.0
	scale := 0.3

	pdf.SetFont("Arial", "B", 14)
	pdf.CellFormat(0, 10, "功能块图 (FBD)", "", 1, "L", false, 0, "")

	// 绘制连接线
	pdf.SetDrawColor(100, 100, 100)
	pdf.SetLineWidth(0.5)
	for _, wire := range wires {
		x1 := startX + float64(wire.From.X)*scale
		y1 := startY + float64(wire.From.Y)*scale
		x2 := startX + float64(wire.To.X)*scale
		y2 := startY + float64(wire.To.Y)*scale
		pdf.Line(x1, y1, x2, y2)
	}

	// 绘制功能块
	for _, block := range blocks {
		x := startX + float64(block.Position.X)*scale
		y := startY + float64(block.Position.Y)*scale
		w := float64(block.Width) * scale
		h := float64(block.Height) * scale

		// 边框
		pdf.SetDrawColor(66, 66, 66)
		pdf.SetFillColor(255, 152, 0)
		pdf.Rect(x, y, w, h, "DF")

		// 标签
		pdf.SetFont("Arial", "B", 8)
		pdf.SetTextColor(255, 255, 255)
		pdf.SetXY(x, y+h/2-3)
		pdf.CellFormat(w, 6, block.Type, "", 0, "C", false, 0, "")
		pdf.SetTextColor(0, 0, 0)
	}
}

// 添加页脚
func addFooter(pdf *gofpdf.Fpdf) {
	pdf.AliasNbPages("")
	pdf.SetFooterFunc(func() {
		pdf.SetY(-15)
		pdf.SetFont("Arial", "I", 8)
		pdf.CellFormat(0, 10, fmt.Sprintf("第 %d 页 / 共 {nb} 页", pdf.PageNo()), "", 0, "C", false, 0, "")
	})
}

// 导出摘要信息
func GenerateSummary(data interface{}) string {
	switch d := data.(type) {
	case LadderDiagramData:
		return fmt.Sprintf(
			"程序摘要: %d 个梯级, %d 个变量",
			len(d.Rungs), len(d.Variables),
		)
	case FBDDiagramData:
		return fmt.Sprintf(
			"程序摘要: %d 个功能块, %d 个连接线, %d 个变量",
			len(d.Blocks), len(d.Wires), len(d.Variables),
		)
	}
	return ""
}
