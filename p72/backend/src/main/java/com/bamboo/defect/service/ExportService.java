package com.bamboo.defect.service;

import com.bamboo.defect.entity.DefectRecord;
import com.bamboo.defect.entity.DetectionRecord;
import com.bamboo.defect.repository.DefectRecordRepository;
import com.bamboo.defect.repository.DetectionRecordRepository;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class ExportService {
    
    @Autowired
    private DetectionRecordRepository detectionRecordRepository;
    
    @Autowired
    private DefectRecordRepository defectRecordRepository;
    
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    
    public byte[] exportDetectionRecords(LocalDateTime startTime, LocalDateTime endTime, String format) throws Exception {
        List<DetectionRecord> records = detectionRecordRepository.findByTimestampBetweenOrderByTimestampDesc(startTime, endTime);
        
        if ("excel".equalsIgnoreCase(format)) {
            return exportToExcel(records);
        } else {
            return exportToCSV(records);
        }
    }
    
    public byte[] exportDefectRecords(LocalDateTime startTime, LocalDateTime endTime, Integer level, String format) throws Exception {
        List<DefectRecord> records;
        if (level != null) {
            records = defectRecordRepository.findByTimestampBetweenAndLevelOrderByTimestampDesc(startTime, endTime, level);
        } else {
            records = defectRecordRepository.findByTimestampBetweenOrderByTimestampDesc(startTime, endTime);
        }
        
        if ("excel".equalsIgnoreCase(format)) {
            return exportDefectsToExcel(records);
        } else {
            return exportDefectsToCSV(records);
        }
    }
    
    private byte[] exportToExcel(List<DetectionRecord> records) throws Exception {
        Workbook workbook = new XSSFWorkbook();
        Sheet sheet = workbook.createSheet("检测记录");
        
        CellStyle headerStyle = createHeaderStyle(workbook);
        CellStyle dataStyle = createDataStyle(workbook);
        
        String[] headers = {"ID", "产品编号", "缺陷数量", "是否有缺陷", "操作员", "检测时间"};
        Row headerRow = sheet.createRow(0);
        for (int i = 0; i < headers.length; i++) {
            Cell cell = headerRow.createCell(i);
            cell.setCellValue(headers[i]);
            cell.setCellStyle(headerStyle);
        }
        
        int rowNum = 1;
        for (DetectionRecord record : records) {
            Row row = sheet.createRow(rowNum++);
            createCell(row, 0, record.getId(), dataStyle);
            createCell(row, 1, record.getProductId(), dataStyle);
            createCell(row, 2, record.getDefectCount(), dataStyle);
            createCell(row, 3, record.getHasDefect() ? "是" : "否", dataStyle);
            createCell(row, 4, record.getOperator(), dataStyle);
            createCell(row, 5, record.getTimestamp() != null ? record.getTimestamp().format(DATE_FORMATTER) : "", dataStyle);
        }
        
        for (int i = 0; i < headers.length; i++) {
            sheet.autoSizeColumn(i);
        }
        
        createStatisticsSheet(workbook, records);
        
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        workbook.write(outputStream);
        workbook.close();
        
        return outputStream.toByteArray();
    }
    
    private byte[] exportDefectsToExcel(List<DefectRecord> records) throws Exception {
        Workbook workbook = new XSSFWorkbook();
        Sheet sheet = workbook.createSheet("缺陷记录");
        
        CellStyle headerStyle = createHeaderStyle(workbook);
        CellStyle dataStyle = createDataStyle(workbook);
        CellStyle severity1Style = createSeverityStyle(workbook, IndexedColors.GREEN);
        CellStyle severity2Style = createSeverityStyle(workbook, IndexedColors.YELLOW);
        CellStyle severity3Style = createSeverityStyle(workbook, IndexedColors.RED);
        
        String[] headers = {"ID", "检测ID", "缺陷类型", "严重程度", "严重度评分", "位置X", "位置Y", "尺寸", "置信度", "描述", "是否已处理", "检测时间"};
        Row headerRow = sheet.createRow(0);
        for (int i = 0; i < headers.length; i++) {
            Cell cell = headerRow.createCell(i);
            cell.setCellValue(headers[i]);
            cell.setCellStyle(headerStyle);
        }
        
        int rowNum = 1;
        for (DefectRecord record : records) {
            Row row = sheet.createRow(rowNum++);
            CellStyle rowStyle = getSeverityStyle(record.getLevel(), dataStyle, severity1Style, severity2Style, severity3Style);
            
            createCell(row, 0, record.getId(), rowStyle);
            createCell(row, 1, record.getDetectionId(), rowStyle);
            createCell(row, 2, record.getType(), rowStyle);
            createCell(row, 3, record.getLevelName(), rowStyle);
            createCell(row, 4, record.getSeverityScore(), rowStyle);
            createCell(row, 5, record.getPositionX(), rowStyle);
            createCell(row, 6, record.getPositionY(), rowStyle);
            createCell(row, 7, record.getSize(), rowStyle);
            createCell(row, 8, record.getConfidence(), rowStyle);
            createCell(row, 9, record.getDescription(), rowStyle);
            createCell(row, 10, record.getHandled() ? "是" : "否", rowStyle);
            createCell(row, 11, record.getTimestamp() != null ? record.getTimestamp().format(DATE_FORMATTER) : "", rowStyle);
        }
        
        for (int i = 0; i < headers.length; i++) {
            sheet.autoSizeColumn(i);
        }
        
        createDefectStatisticsSheet(workbook, records);
        
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        workbook.write(outputStream);
        workbook.close();
        
        return outputStream.toByteArray();
    }
    
    private byte[] exportToCSV(List<DetectionRecord> records) {
        StringBuilder sb = new StringBuilder();
        sb.append("ID,产品编号,缺陷数量,是否有缺陷,操作员,检测时间\n");
        
        for (DetectionRecord record : records) {
            sb.append(record.getId()).append(",");
            sb.append(record.getProductId()).append(",");
            sb.append(record.getDefectCount()).append(",");
            sb.append(record.getHasDefect() ? "是" : "否").append(",");
            sb.append(record.getOperator()).append(",");
            sb.append(record.getTimestamp() != null ? record.getTimestamp().format(DATE_FORMATTER) : "").append("\n");
        }
        
        return sb.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
    }
    
    private byte[] exportDefectsToCSV(List<DefectRecord> records) {
        StringBuilder sb = new StringBuilder();
        sb.append("ID,检测ID,缺陷类型,严重程度,严重度评分,位置X,位置Y,尺寸,置信度,描述,是否已处理,检测时间\n");
        
        for (DefectRecord record : records) {
            sb.append(record.getId()).append(",");
            sb.append(record.getDetectionId()).append(",");
            sb.append(record.getType()).append(",");
            sb.append(record.getLevelName()).append(",");
            sb.append(record.getSeverityScore()).append(",");
            sb.append(record.getPositionX()).append(",");
            sb.append(record.getPositionY()).append(",");
            sb.append(record.getSize()).append(",");
            sb.append(record.getConfidence()).append(",");
            sb.append("\"").append(record.getDescription() != null ? record.getDescription().replace("\"", "\"\"") : "").append("\"").append(",");
            sb.append(record.getHandled() ? "是" : "否").append(",");
            sb.append(record.getTimestamp() != null ? record.getTimestamp().format(DATE_FORMATTER) : "").append("\n");
        }
        
        return sb.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
    }
    
    private void createStatisticsSheet(Workbook workbook, List<DetectionRecord> records) {
        Sheet sheet = workbook.createSheet("统计汇总");
        CellStyle headerStyle = createHeaderStyle(workbook);
        CellStyle dataStyle = createDataStyle(workbook);
        
        long totalRecords = records.size();
        long defectRecords = records.stream().filter(DetectionRecord::getHasDefect).count();
        long totalDefects = records.stream().mapToInt(DetectionRecord::getDefectCount).sum();
        double avgDefects = totalRecords > 0 ? (double) totalDefects / totalRecords : 0;
        double defectRate = totalRecords > 0 ? (double) defectRecords / totalRecords * 100 : 0;
        
        String[][] stats = {
            {"统计项", "数值"},
            {"总检测记录数", String.valueOf(totalRecords)},
            {"有缺陷记录数", String.valueOf(defectRecords)},
            {"无缺陷记录数", String.valueOf(totalRecords - defectRecords)},
            {"总缺陷数", String.valueOf(totalDefects)},
            {"平均缺陷数/件", String.format("%.2f", avgDefects)},
            {"缺陷率(%)", String.format("%.2f", defectRate)}
        };
        
        int rowNum = 0;
        for (String[] stat : stats) {
            Row row = sheet.createRow(rowNum++);
            CellStyle style = rowNum == 1 ? headerStyle : dataStyle;
            createCell(row, 0, stat[0], style);
            createCell(row, 1, stat[1], style);
        }
        
        sheet.autoSizeColumn(0);
        sheet.autoSizeColumn(1);
    }
    
    private void createDefectStatisticsSheet(Workbook workbook, List<DefectRecord> records) {
        Sheet sheet = workbook.createSheet("缺陷统计");
        CellStyle headerStyle = createHeaderStyle(workbook);
        CellStyle dataStyle = createDataStyle(workbook);
        
        Map<String, Integer> typeCount = new HashMap<>();
        Map<Integer, Integer> levelCount = new HashMap<>();
        long handledCount = records.stream().filter(DefectRecord::getHandled).count();
        
        for (DefectRecord record : records) {
            typeCount.merge(record.getType(), 1, Integer::sum);
            levelCount.merge(record.getLevel(), 1, Integer::sum);
        }
        
        int rowNum = 0;
        
        Row header1 = sheet.createRow(rowNum++);
        createCell(header1, 0, "按类型统计", headerStyle);
        createCell(header1, 1, "数量", headerStyle);
        
        for (Map.Entry<String, Integer> entry : typeCount.entrySet()) {
            Row row = sheet.createRow(rowNum++);
            createCell(row, 0, entry.getKey(), dataStyle);
            createCell(row, 1, entry.getValue(), dataStyle);
        }
        
        rowNum++;
        
        Row header2 = sheet.createRow(rowNum++);
        createCell(header2, 0, "按严重程度统计", headerStyle);
        createCell(header2, 1, "数量", dataStyle);
        
        String[] levelNames = {"", "轻微", "一般", "严重"};
        for (int i = 1; i <= 3; i++) {
            Row row = sheet.createRow(rowNum++);
            createCell(row, 0, levelNames[i], dataStyle);
            createCell(row, 1, levelCount.getOrDefault(i, 0), dataStyle);
        }
        
        rowNum++;
        
        Row header3 = sheet.createRow(rowNum++);
        createCell(header3, 0, "处理统计", headerStyle);
        createCell(header3, 1, "数量", dataStyle);
        
        Row handledRow = sheet.createRow(rowNum++);
        createCell(handledRow, 0, "已处理", dataStyle);
        createCell(handledRow, 1, handledCount, dataStyle);
        
        Row unhandledRow = sheet.createRow(rowNum++);
        createCell(unhandledRow, 0, "未处理", dataStyle);
        createCell(unhandledRow, 1, records.size() - handledCount, dataStyle);
        
        sheet.autoSizeColumn(0);
        sheet.autoSizeColumn(1);
    }
    
    private CellStyle createHeaderStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        Font font = workbook.createFont();
        font.setBold(true);
        font.setColor(IndexedColors.WHITE.getIndex());
        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setAlignment(HorizontalAlignment.CENTER);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        return style;
    }
    
    private CellStyle createDataStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        style.setAlignment(HorizontalAlignment.CENTER);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        return style;
    }
    
    private CellStyle createSeverityStyle(Workbook workbook, IndexedColors color) {
        CellStyle style = workbook.createCellStyle();
        style.setAlignment(HorizontalAlignment.CENTER);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        style.setFillForegroundColor(color.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        return style;
    }
    
    private CellStyle getSeverityStyle(Integer level, CellStyle defaultStyle, 
                                       CellStyle style1, CellStyle style2, CellStyle style3) {
        if (level == null) return defaultStyle;
        switch (level) {
            case 1: return style1;
            case 2: return style2;
            case 3: return style3;
            default: return defaultStyle;
        }
    }
    
    private void createCell(Row row, int column, Object value, CellStyle style) {
        Cell cell = row.createCell(column);
        if (value == null) {
            cell.setCellValue("");
        } else if (value instanceof Number) {
            cell.setCellValue(((Number) value).doubleValue());
        } else {
            cell.setCellValue(String.valueOf(value));
        }
        cell.setCellStyle(style);
    }
}
