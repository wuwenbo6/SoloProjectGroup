package controllers

import (
	"bytes"
	"ceramic-api/database"
	"ceramic-api/models"
	"encoding/csv"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/xuri/excelize/v2"
)

type ExportRequest struct {
	BatchIDs    []string `json:"batch_ids"`
	ProcessStages []string `json:"process_stages"`
	ParamNames  []string `json:"param_names"`
	StartTime   string   `json:"start_time"`
	EndTime     string   `json:"end_time"`
	Format      string   `json:"format" binding:"required,oneof=csv excel"`
	IncludeSummary bool  `json:"include_summary"`
}

func ExportProcessData(c *gin.Context) {
	var req ExportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	query := database.ProcessDB.Model(&models.ProcessParam{})

	if len(req.BatchIDs) > 0 {
		query = query.Where("batch_id IN ?", req.BatchIDs)
	}
	if len(req.ProcessStages) > 0 {
		query = query.Where("process_stage IN ?", req.ProcessStages)
	}
	if len(req.ParamNames) > 0 {
		query = query.Where("param_name IN ?", req.ParamNames)
	}
	if req.StartTime != "" {
		query = query.Where("recorded_at >= ?", req.StartTime)
	}
	if req.EndTime != "" {
		query = query.Where("recorded_at <= ?", req.EndTime)
	}

	var params []models.ProcessParam
	query.Order("batch_id, process_stage, recorded_at").Find(&params)

	if len(params) == 0 {
		c.JSON(http.StatusOK, gin.H{"message": "No data to export", "count": 0})
		return
	}

	var filename string
	var content []byte
	var contentType string

	if req.Format == "csv" {
		filename = fmt.Sprintf("process_data_%s.csv", time.Now().Format("20060102_150405"))
		content = generateCSV(params, req.IncludeSummary)
		contentType = "text/csv"
	} else {
		filename = fmt.Sprintf("process_data_%s.xlsx", time.Now().Format("20060102_150405"))
		content = generateExcel(params, req.IncludeSummary)
		contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	}

	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.Header("Content-Type", contentType)
	c.Data(http.StatusOK, contentType, content)
}

func generateCSV(params []models.ProcessParam, includeSummary bool) []byte {
	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)

	headers := []string{"批次ID", "工艺阶段", "参数名称", "参数值", "标准最小值", "标准最大值", "是否合格", "记录时间"}
	writer.Write(headers)

	for _, p := range params {
		qualified := "否"
		if p.IsQualified {
			qualified = "是"
		}
		record := []string{
			p.BatchID,
			p.ProcessStage,
			p.ParamName,
			strconv.FormatFloat(p.ParamValue, 'f', 4, 64),
			strconv.FormatFloat(p.StandardMin, 'f', 4, 64),
			strconv.FormatFloat(p.StandardMax, 'f', 4, 64),
			qualified,
			p.RecordedAt.Format("2006-01-02 15:04:05"),
		}
		writer.Write(record)
	}

	if includeSummary {
		writer.Write([]string{})
		writer.Write([]string{"数据汇总"})

		summary := generateSummary(params)
		for key, value := range summary {
			writer.Write([]string{key, fmt.Sprintf("%v", value)})
		}
	}

	writer.Flush()
	return buf.Bytes()
}

func generateExcel(params []models.ProcessParam, includeSummary bool) []byte {
	f := excelize.NewFile()
	sheetName := "工艺参数数据"
	f.SetSheetName("Sheet1", sheetName)

	headers := []string{"批次ID", "工艺阶段", "参数名称", "参数值", "标准最小值", "标准最大值", "是否合格", "记录时间"}
	for i, header := range headers {
		cell := string(rune('A'+i)) + "1"
		f.SetCellValue(sheetName, cell, header)
		style, _ := f.NewStyle(&excelize.Style{
			Font: &excelize.Font{Bold: true, Color: "FFFFFF"},
			Fill: excelize.Fill{Type: "pattern", Color: []string{"4472C4"}, Pattern: 1},
		})
		f.SetCellStyle(sheetName, cell, cell, style)
	}

	for i, p := range params {
		row := i + 2
		qualified := "否"
		if p.IsQualified {
			qualified = "是"
		}
		f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), p.BatchID)
		f.SetCellValue(sheetName, fmt.Sprintf("B%d", row), p.ProcessStage)
		f.SetCellValue(sheetName, fmt.Sprintf("C%d", row), p.ParamName)
		f.SetCellValue(sheetName, fmt.Sprintf("D%d", row), p.ParamValue)
		f.SetCellValue(sheetName, fmt.Sprintf("E%d", row), p.StandardMin)
		f.SetCellValue(sheetName, fmt.Sprintf("F%d", row), p.StandardMax)
		f.SetCellValue(sheetName, fmt.Sprintf("G%d", row), qualified)
		f.SetCellValue(sheetName, fmt.Sprintf("H%d", row), p.RecordedAt.Format("2006-01-02 15:04:05"))

		if !p.IsQualified {
			style, _ := f.NewStyle(&excelize.Style{
				Fill: excelize.Fill{Type: "pattern", Color: []string{"FFC7CE"}, Pattern: 1},
			})
			f.SetCellStyle(sheetName, fmt.Sprintf("A%d", row), fmt.Sprintf("H%d", row), style)
		}
	}

	for i := range headers {
		col := string(rune('A' + i))
		f.SetColWidth(sheetName, col, col, 18)
	}

	if includeSummary {
		summarySheet := "数据汇总"
		f.NewSheet(summarySheet)

		summary := generateSummary(params)
		row := 1

		f.SetCellValue(summarySheet, "A1", "汇总项")
		f.SetCellValue(summarySheet, "B1", "数值")
		style, _ := f.NewStyle(&excelize.Style{
			Font: &excelize.Font{Bold: true, Color: "FFFFFF"},
			Fill: excelize.Fill{Type: "pattern", Color: []string{"70AD47"}, Pattern: 1},
		})
		f.SetCellStyle(summarySheet, "A1", "B1", style)

		for key, value := range summary {
			row++
			f.SetCellValue(summarySheet, fmt.Sprintf("A%d", row), key)
			f.SetCellValue(summarySheet, fmt.Sprintf("B%d", row), value)
		}

		f.SetColWidth(summarySheet, "A", "A", 25)
		f.SetColWidth(summarySheet, "B", "B", 15)
	}

	buf, _ := f.WriteToBuffer()
	return buf.Bytes()
}

func generateSummary(params []models.ProcessParam) map[string]interface{} {
	qualifiedCount := 0
	batchMap := make(map[string]bool)
	stageMap := make(map[string]int)
	paramMap := make(map[string]int)

	for _, p := range params {
		batchMap[p.BatchID] = true
		stageMap[p.ProcessStage]++
		paramMap[p.ParamName]++
		if p.IsQualified {
			qualifiedCount++
		}
	}

	qualifiedRate := 0.0
	if len(params) > 0 {
		qualifiedRate = float64(qualifiedCount) / float64(len(params)) * 100
	}

	return map[string]interface{}{
		"总记录数":       len(params),
		"合格记录数":     qualifiedCount,
		"不合格记录数":   len(params) - qualifiedCount,
		"合格率(%)":    fmt.Sprintf("%.2f", qualifiedRate),
		"涉及批次数量":   len(batchMap),
		"工艺阶段数量":   len(stageMap),
		"参数种类数量":   len(paramMap),
		"导出时间":       time.Now().Format("2006-01-02 15:04:05"),
	}
}

func ExportFiringParams(c *gin.Context) {
	var req struct {
		BatchIDs  []string `json:"batch_ids"`
		KilnIDs   []string `json:"kiln_ids"`
		ParamTypes []string `json:"param_types"`
		StartTime string   `json:"start_time"`
		EndTime   string   `json:"end_time"`
		Format    string   `json:"format" binding:"required,oneof=csv excel"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	query := database.FiringDB.Model(&models.FiringParam{})

	if len(req.BatchIDs) > 0 {
		query = query.Where("batch_id IN ?", req.BatchIDs)
	}
	if len(req.KilnIDs) > 0 {
		query = query.Where("kiln_id IN ?", req.KilnIDs)
	}
	if len(req.ParamTypes) > 0 {
		query = query.Where("param_type IN ?", req.ParamTypes)
	}
	if req.StartTime != "" {
		query = query.Where("collected_at >= ?", req.StartTime)
	}
	if req.EndTime != "" {
		query = query.Where("collected_at <= ?", req.EndTime)
	}

	var params []models.FiringParam
	query.Order("batch_id, kiln_id, collected_at").Find(&params)

	if len(params) == 0 {
		c.JSON(http.StatusOK, gin.H{"message": "No data to export", "count": 0})
		return
	}

	var filename string
	var content []byte
	var contentType string

	if req.Format == "csv" {
		filename = fmt.Sprintf("firing_params_%s.csv", time.Now().Format("20060102_150405"))
		content = generateFiringCSV(params)
		contentType = "text/csv"
	} else {
		filename = fmt.Sprintf("firing_params_%s.xlsx", time.Now().Format("20060102_150405"))
		content = generateFiringExcel(params)
		contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	}

	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.Header("Content-Type", contentType)
	c.Data(http.StatusOK, contentType, content)
}

func generateFiringCSV(params []models.FiringParam) []byte {
	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)

	headers := []string{"批次ID", "窑炉ID", "参数类型", "参数值", "单位", "采集时间"}
	writer.Write(headers)

	for _, p := range params {
		record := []string{
			p.BatchID,
			p.KilnID,
			p.ParamType,
			strconv.FormatFloat(p.ParamValue, 'f', 4, 64),
			p.ParamUnit,
			p.CollectedAt.Format("2006-01-02 15:04:05"),
		}
		writer.Write(record)
	}

	writer.Flush()
	return buf.Bytes()
}

func generateFiringExcel(params []models.FiringParam) []byte {
	f := excelize.NewFile()
	sheetName := "烧制参数数据"
	f.SetSheetName("Sheet1", sheetName)

	headers := []string{"批次ID", "窑炉ID", "参数类型", "参数值", "单位", "采集时间"}
	for i, header := range headers {
		cell := string(rune('A'+i)) + "1"
		f.SetCellValue(sheetName, cell, header)
		style, _ := f.NewStyle(&excelize.Style{
			Font: &excelize.Font{Bold: true, Color: "FFFFFF"},
			Fill: excelize.Fill{Type: "pattern", Color: []string{"5B9BD5"}, Pattern: 1},
		})
		f.SetCellStyle(sheetName, cell, cell, style)
	}

	for i, p := range params {
		row := i + 2
		f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), p.BatchID)
		f.SetCellValue(sheetName, fmt.Sprintf("B%d", row), p.KilnID)
		f.SetCellValue(sheetName, fmt.Sprintf("C%d", row), p.ParamType)
		f.SetCellValue(sheetName, fmt.Sprintf("D%d", row), p.ParamValue)
		f.SetCellValue(sheetName, fmt.Sprintf("E%d", row), p.ParamUnit)
		f.SetCellValue(sheetName, fmt.Sprintf("F%d", row), p.CollectedAt.Format("2006-01-02 15:04:05"))
	}

	for i := range headers {
		col := string(rune('A' + i))
		f.SetColWidth(sheetName, col, col, 18)
	}

	buf, _ := f.WriteToBuffer()
	return buf.Bytes()
}

func ExportAlertRecords(c *gin.Context) {
	var req struct {
		BatchIDs  []string `json:"batch_ids"`
		KilnIDs   []string `json:"kiln_ids"`
		Handled   *bool    `json:"handled"`
		StartTime string   `json:"start_time"`
		EndTime   string   `json:"end_time"`
		Format    string   `json:"format" binding:"required,oneof=csv excel"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	query := database.FiringDB.Model(&models.AlertRecord{})

	if len(req.BatchIDs) > 0 {
		query = query.Where("batch_id IN ?", req.BatchIDs)
	}
	if len(req.KilnIDs) > 0 {
		query = query.Where("kiln_id IN ?", req.KilnIDs)
	}
	if req.Handled != nil {
		query = query.Where("handled = ?", *req.Handled)
	}
	if req.StartTime != "" {
		query = query.Where("created_at >= ?", req.StartTime)
	}
	if req.EndTime != "" {
		query = query.Where("created_at <= ?", req.EndTime)
	}

	var alerts []models.AlertRecord
	query.Order("created_at DESC").Find(&alerts)

	if len(alerts) == 0 {
		c.JSON(http.StatusOK, gin.H{"message": "No data to export", "count": 0})
		return
	}

	var filename string
	var content []byte
	var contentType string

	if req.Format == "csv" {
		filename = fmt.Sprintf("alert_records_%s.csv", time.Now().Format("20060102_150405"))
		content = generateAlertCSV(alerts)
		contentType = "text/csv"
	} else {
		filename = fmt.Sprintf("alert_records_%s.xlsx", time.Now().Format("20060102_150405"))
		content = generateAlertExcel(alerts)
		contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	}

	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.Header("Content-Type", contentType)
	c.Data(http.StatusOK, contentType, content)
}

func generateAlertCSV(alerts []models.AlertRecord) []byte {
	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)

	headers := []string{"批次ID", "窑炉ID", "参数类型", "参数值", "阈值下限", "阈值上限", "告警级别", "告警类型", "消息", "是否处理", "处理人", "创建时间"}
	writer.Write(headers)

	for _, a := range alerts {
		handled := "否"
		if a.Handled {
			handled = "是"
		}
		handledBy := ""
		if a.HandledBy != "" {
			handledBy = a.HandledBy
		}
		record := []string{
			a.BatchID,
			a.KilnID,
			a.ParamType,
			strconv.FormatFloat(a.ParamValue, 'f', 4, 64),
			strconv.FormatFloat(a.ThresholdMin, 'f', 4, 64),
			strconv.FormatFloat(a.ThresholdMax, 'f', 4, 64),
			fmt.Sprintf("Level %d", a.AlertLevel),
			a.AlertType,
			a.Message,
			handled,
			handledBy,
			a.CreatedAt.Format("2006-01-02 15:04:05"),
		}
		writer.Write(record)
	}

	writer.Flush()
	return buf.Bytes()
}

func generateAlertExcel(alerts []models.AlertRecord) []byte {
	f := excelize.NewFile()
	sheetName := "告警记录"
	f.SetSheetName("Sheet1", sheetName)

	headers := []string{"批次ID", "窑炉ID", "参数类型", "参数值", "阈值下限", "阈值上限", "告警级别", "告警类型", "消息", "是否处理", "处理人", "创建时间"}
	for i, header := range headers {
		cell := string(rune('A'+i)) + "1"
		f.SetCellValue(sheetName, cell, header)
		style, _ := f.NewStyle(&excelize.Style{
			Font: &excelize.Font{Bold: true, Color: "FFFFFF"},
			Fill: excelize.Fill{Type: "pattern", Color: []string{"C55A11"}, Pattern: 1},
		})
		f.SetCellStyle(sheetName, cell, cell, style)
	}

	for i, a := range alerts {
		row := i + 2
		handled := "否"
		if a.Handled {
			handled = "是"
		}

		f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), a.BatchID)
		f.SetCellValue(sheetName, fmt.Sprintf("B%d", row), a.KilnID)
		f.SetCellValue(sheetName, fmt.Sprintf("C%d", row), a.ParamType)
		f.SetCellValue(sheetName, fmt.Sprintf("D%d", row), a.ParamValue)
		f.SetCellValue(sheetName, fmt.Sprintf("E%d", row), a.ThresholdMin)
		f.SetCellValue(sheetName, fmt.Sprintf("F%d", row), a.ThresholdMax)
		f.SetCellValue(sheetName, fmt.Sprintf("G%d", row), fmt.Sprintf("Level %d", a.AlertLevel))
		f.SetCellValue(sheetName, fmt.Sprintf("H%d", row), a.AlertType)
		f.SetCellValue(sheetName, fmt.Sprintf("I%d", row), a.Message)
		f.SetCellValue(sheetName, fmt.Sprintf("J%d", row), handled)
		f.SetCellValue(sheetName, fmt.Sprintf("K%d", row), a.HandledBy)
		f.SetCellValue(sheetName, fmt.Sprintf("L%d", row), a.CreatedAt.Format("2006-01-02 15:04:05"))

		if a.AlertLevel >= 2 {
			style, _ := f.NewStyle(&excelize.Style{
				Fill: excelize.Fill{Type: "pattern", Color: []string{"FFC7CE"}, Pattern: 1},
			})
			f.SetCellStyle(sheetName, fmt.Sprintf("A%d", row), fmt.Sprintf("L%d", row), style)
		}
	}

	colWidths := []float64{15, 12, 12, 10, 10, 10, 10, 10, 40, 10, 12, 20}
	for i, width := range colWidths {
		col := string(rune('A' + i))
		f.SetColWidth(sheetName, col, col, width)
	}

	buf, _ := f.WriteToBuffer()
	return buf.Bytes()
}
