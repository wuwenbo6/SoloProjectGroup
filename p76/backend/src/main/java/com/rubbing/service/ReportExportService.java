package com.rubbing.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.rubbing.entity.RubbingRecord;
import com.rubbing.mapper.RubbingRecordMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReportExportService {

    private final RubbingRecordMapper rubbingRecordMapper;

    public byte[] exportToExcel(String qualityLevel, String keyword, LocalDateTime startTime, LocalDateTime endTime) {
        log.info("开始导出Excel报表: qualityLevel={}, keyword={}", qualityLevel, keyword);
        
        LambdaQueryWrapper<RubbingRecord> wrapper = new LambdaQueryWrapper<>();
        
        if (qualityLevel != null && !qualityLevel.isEmpty()) {
            wrapper.eq(RubbingRecord::getQualityLevel, qualityLevel);
        }
        
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.and(w -> w.like(RubbingRecord::getRubbingId, keyword)
                    .or().like(RubbingRecord::getName, keyword));
        }
        
        if (startTime != null) {
            wrapper.ge(RubbingRecord::getCaptureTime, startTime);
        }
        
        if (endTime != null) {
            wrapper.le(RubbingRecord::getCaptureTime, endTime);
        }
        
        wrapper.orderByDesc(RubbingRecord::getCaptureTime);
        List<RubbingRecord> records = rubbingRecordMapper.selectList(wrapper);
        
        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            
            Sheet sheet = workbook.createSheet("拓片采集记录");
            
            createHeaderRow(workbook, sheet);
            createDataRows(workbook, sheet, records);
            
            for (int i = 0; i < 15; i++) {
                sheet.autoSizeColumn(i);
            }
            
            workbook.write(out);
            log.info("Excel报表导出完成，共{}条记录", records.size());
            return out.toByteArray();
            
        } catch (IOException e) {
            log.error("Excel导出失败: {}", e.getMessage());
            throw new RuntimeException("导出失败", e);
        }
    }

    private void createHeaderRow(Workbook workbook, Sheet sheet) {
        Row headerRow = sheet.createRow(0);
        CellStyle headerStyle = createHeaderStyle(workbook);
        
        String[] headers = {
            "ID", "拓片编号", "拓片名称", "所属朝代", "分辨率宽度", "分辨率高度",
            "DPI", "色彩深度", "文件格式", "文件大小(MB)", "质量评分", "质量等级",
            "采集时间", "归档等级", "归档时间", "亮度参数", "对比度参数", "阈值参数"
        };
        
        for (int i = 0; i < headers.length; i++) {
            Cell cell = headerRow.createCell(i);
            cell.setCellValue(headers[i]);
            cell.setCellStyle(headerStyle);
        }
    }

    private void createDataRows(Workbook workbook, Sheet sheet, List<RubbingRecord> records) {
        CellStyle dataStyle = createDataStyle(workbook);
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
        
        int rowNum = 1;
        for (RubbingRecord record : records) {
            Row row = sheet.createRow(rowNum++);
            
            int colNum = 0;
            createCell(row, colNum++, record.getId(), dataStyle);
            createCell(row, colNum++, record.getRubbingId(), dataStyle);
            createCell(row, colNum++, record.getName(), dataStyle);
            createCell(row, colNum++, record.getDynasty(), dataStyle);
            createCell(row, colNum++, record.getResolutionWidth(), dataStyle);
            createCell(row, colNum++, record.getResolutionHeight(), dataStyle);
            createCell(row, colNum++, record.getDpi(), dataStyle);
            createCell(row, colNum++, record.getColorDepth(), dataStyle);
            createCell(row, colNum++, record.getFileFormat(), dataStyle);
            createCell(row, colNum++, record.getFileSize() != null ? record.getFileSize().doubleValue() : 0, dataStyle);
            createCell(row, colNum++, record.getQualityScore(), dataStyle);
            createCell(row, colNum++, record.getQualityLevel(), dataStyle);
            createCell(row, colNum++, record.getCaptureTime() != null ? record.getCaptureTime().format(formatter) : "", dataStyle);
            createCell(row, colNum++, record.getArchiveLevel(), dataStyle);
            createCell(row, colNum++, record.getArchiveTime() != null ? record.getArchiveTime().format(formatter) : "", dataStyle);
            createCell(row, colNum++, record.getParamBrightness(), dataStyle);
            createCell(row, colNum++, record.getParamContrast(), dataStyle);
            createCell(row, colNum++, record.getParamThreshold(), dataStyle);
        }
    }

    private void createCell(Row row, int column, Object value, CellStyle style) {
        Cell cell = row.createCell(column);
        if (value == null) {
            cell.setCellValue("");
        } else if (value instanceof Number) {
            cell.setCellValue(((Number) value).doubleValue());
        } else {
            cell.setCellValue(value.toString());
        }
        cell.setCellStyle(style);
    }

    private CellStyle createHeaderStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        Font font = workbook.createFont();
        font.setBold(true);
        font.setFontHeightInPoints((short) 12);
        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        style.setAlignment(HorizontalAlignment.CENTER);
        return style;
    }

    private CellStyle createDataStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        style.setAlignment(HorizontalAlignment.CENTER);
        return style;
    }

    public String generateCSV(String qualityLevel, String keyword, LocalDateTime startTime, LocalDateTime endTime) {
        log.info("开始导出CSV报表: qualityLevel={}, keyword={}", qualityLevel, keyword);
        
        LambdaQueryWrapper<RubbingRecord> wrapper = new LambdaQueryWrapper<>();
        
        if (qualityLevel != null && !qualityLevel.isEmpty()) {
            wrapper.eq(RubbingRecord::getQualityLevel, qualityLevel);
        }
        
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.and(w -> w.like(RubbingRecord::getRubbingId, keyword)
                    .or().like(RubbingRecord::getName, keyword));
        }
        
        if (startTime != null) {
            wrapper.ge(RubbingRecord::getCaptureTime, startTime);
        }
        
        if (endTime != null) {
            wrapper.le(RubbingRecord::getCaptureTime, endTime);
        }
        
        wrapper.orderByDesc(RubbingRecord::getCaptureTime);
        List<RubbingRecord> records = rubbingRecordMapper.selectList(wrapper);
        
        StringBuilder sb = new StringBuilder();
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
        
        sb.append("ID,拓片编号,拓片名称,所属朝代,分辨率宽度,分辨率高度,DPI,色彩深度,文件格式,文件大小(MB),质量评分,质量等级,采集时间,归档等级,归档时间\n");
        
        for (RubbingRecord record : records) {
            sb.append(record.getId()).append(",");
            sb.append(escapeCSV(record.getRubbingId())).append(",");
            sb.append(escapeCSV(record.getName())).append(",");
            sb.append(escapeCSV(record.getDynasty())).append(",");
            sb.append(record.getResolutionWidth()).append(",");
            sb.append(record.getResolutionHeight()).append(",");
            sb.append(record.getDpi()).append(",");
            sb.append(escapeCSV(record.getColorDepth())).append(",");
            sb.append(escapeCSV(record.getFileFormat())).append(",");
            sb.append(record.getFileSize()).append(",");
            sb.append(record.getQualityScore()).append(",");
            sb.append(record.getQualityLevel()).append(",");
            sb.append(record.getCaptureTime() != null ? record.getCaptureTime().format(formatter) : "").append(",");
            sb.append(record.getArchiveLevel()).append(",");
            sb.append(record.getArchiveTime() != null ? record.getArchiveTime().format(formatter) : "").append("\n");
        }
        
        log.info("CSV报表导出完成，共{}条记录", records.size());
        return sb.toString();
    }

    private String escapeCSV(String value) {
        if (value == null) return "";
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }
}
