package com.papermanagement.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.papermanagement.dto.Result;
import com.papermanagement.entity.QualityReport;
import com.papermanagement.entity.ReportTemplate;
import com.papermanagement.mapper.QualityReportMapper;
import com.papermanagement.mapper.ReportTemplateMapper;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class PdfExportService {

    private static final Logger logger = LoggerFactory.getLogger(PdfExportService.class);
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    @Autowired
    private QualityReportMapper qualityReportMapper;

    @Autowired
    private ReportTemplateMapper reportTemplateMapper;

    public byte[] exportReports(List<Long> reportIds, Long templateId) throws Exception {
        LambdaQueryWrapper<QualityReport> wrapper = new LambdaQueryWrapper<>();
        wrapper.in(QualityReport::getId, reportIds);
        List<QualityReport> reports = qualityReportMapper.selectList(wrapper);

        if (reports.isEmpty()) {
            throw new RuntimeException("未找到质检报告数据");
        }

        ReportTemplate template = null;
        if (templateId != null) {
            template = reportTemplateMapper.selectById(templateId);
        }
        if (template == null) {
            template = getDefaultTemplate();
        }

        return generatePdf(reports, template);
    }

    private byte[] generatePdf(List<QualityReport> reports, ReportTemplate template) throws IOException {
        PDDocument document = new PDDocument();

        for (int i = 0; i < reports.size(); i++) {
            QualityReport report = reports.get(i);
            PDPage page = new PDPage();
            document.addPage(page);
            try (PDPageContentStream contentStream = new PDPageContentStream(document, page)) {
                drawReportPage(contentStream, report, template, i + 1, reports.size());
            }
        }

        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        document.save(outputStream);
        document.close();

        logger.info("PDF导出成功，共{}份报告", reports.size());
        return outputStream.toByteArray();
    }

    private void drawReportPage(PDPageContentStream contentStream, QualityReport report,
                                ReportTemplate template, int pageNum, int total) throws IOException {
        float margin = 50;
        float yStart = 750;
        float width = 500;
        float leading = 20;

        contentStream.setFont(PDType1Font.HELVETICA_BOLD, 18);
        contentStream.beginText();
        contentStream.newLineAtOffset(margin, yStart);
        contentStream.showText("古法造纸品质检测报告");
        contentStream.endText();

        contentStream.setFont(PDType1Font.HELVETICA, 10);
        contentStream.beginText();
        contentStream.newLineAtOffset(margin + 400, yStart);
        contentStream.showText("第 " + pageNum + " / " + total + " 页");
        contentStream.endText();

        yStart -= 40;
        contentStream.setLineWidth(1);
        contentStream.moveTo(margin, yStart);
        contentStream.lineTo(margin + width, yStart);
        contentStream.stroke();

        yStart -= 30;

        String[][] basicInfo = {
            {"报告编号", report.getReportNo(), "批次号", report.getBatchNo()},
            {"检验员", report.getInspectorName(), "检验时间", report.getInspectTime() != null ? report.getInspectTime().format(DATE_FORMAT) : ""},
            {"质量等级", getQualityLevelText(report.getQualityLevel()), "检测结果", report.getResult()}
        };

        contentStream.setFont(PDType1Font.HELVETICA_BOLD, 12);
        contentStream.beginText();
        contentStream.newLineAtOffset(margin, yStart);
        contentStream.showText("一、基本信息");
        contentStream.endText();

        yStart -= 30;
        contentStream.setFont(PDType1Font.HELVETICA, 10);

        for (String[] row : basicInfo) {
            contentStream.beginText();
            contentStream.newLineAtOffset(margin, yStart);
            contentStream.showText(row[0] + ": " + (row[1] != null ? row[1] : ""));
            contentStream.endText();

            contentStream.beginText();
            contentStream.newLineAtOffset(margin + 250, yStart);
            contentStream.showText(row[2] + ": " + (row[3] != null ? row[3] : ""));
            contentStream.endText();
            yStart -= leading;
        }

        yStart -= 20;
        contentStream.setFont(PDType1Font.HELVETICA_BOLD, 12);
        contentStream.beginText();
        contentStream.newLineAtOffset(margin, yStart);
        contentStream.showText("二、检测指标");
        contentStream.endText();

        yStart -= 30;

        String[][] indicators = {
            {"厚度(mm)", report.getThickness() != null ? report.getThickness().toPlainString() : "-"},
            {"密度(g/cm³)", report.getDensity() != null ? report.getDensity().toPlainString() : "-"},
            {"抗张强度", report.getTensileStrength() != null ? report.getTensileStrength().toPlainString() : "-"},
            {"白度(%)", report.getWhiteness() != null ? report.getWhiteness().toPlainString() : "-"},
            {"竹浆配比(%)", report.getFiberRatioBamboo() != null ? report.getFiberRatioBamboo().toPlainString() : "-"},
            {"木浆配比(%)", report.getFiberRatioWood() != null ? report.getFiberRatioWood().toPlainString() : "-"},
            {"麻浆配比(%)", report.getFiberRatioHemp() != null ? report.getFiberRatioHemp().toPlainString() : "-"},
            {"棉浆配比(%)", report.getFiberRatioCotton() != null ? report.getFiberRatioCotton().toPlainString() : "-"}
        };

        drawTable(contentStream, margin, yStart, width, indicators);
        yStart -= (indicators.length + 1) * 20 + 20;

        contentStream.setFont(PDType1Font.HELVETICA_BOLD, 12);
        contentStream.beginText();
        contentStream.newLineAtOffset(margin, yStart);
        contentStream.showText("三、外观描述");
        contentStream.endText();

        yStart -= 25;
        contentStream.setFont(PDType1Font.HELVETICA, 10);
        contentStream.beginText();
        contentStream.newLineAtOffset(margin, yStart);
        contentStream.showText(report.getAppearance() != null ? report.getAppearance() : "无");
        contentStream.endText();

        yStart -= 40;
        contentStream.setFont(PDType1Font.HELVETICA_BOLD, 12);
        contentStream.beginText();
        contentStream.newLineAtOffset(margin, yStart);
        contentStream.showText("四、备注");
        contentStream.endText();

        yStart -= 25;
        contentStream.setFont(PDType1Font.HELVETICA, 10);
        contentStream.beginText();
        contentStream.newLineAtOffset(margin, yStart);
        contentStream.showText(report.getRemark() != null ? report.getRemark() : "无");
        contentStream.endText();

        yStart -= 60;
        contentStream.setLineWidth(1);
        contentStream.moveTo(margin, yStart);
        contentStream.lineTo(margin + width, yStart);
        contentStream.stroke();

        yStart -= 20;
        contentStream.setFont(PDType1Font.HELVETICA, 8);
        contentStream.beginText();
        contentStream.newLineAtOffset(margin, yStart);
        contentStream.showText("生成时间: " + java.time.LocalDateTime.now().format(DATE_FORMAT));
        contentStream.endText();

        contentStream.beginText();
        contentStream.newLineAtOffset(margin + 350, yStart);
        contentStream.showText("古法造纸质量管理系统");
        contentStream.endText();
    }

    private void drawTable(PDPageContentStream contentStream, float x, float y, float width, String[][] data) throws IOException {
        float rowHeight = 20;
        float col1Width = 120;
        float col2Width = 130;

        contentStream.setFont(PDType1Font.HELVETICA, 10);

        for (int i = 0; i < data.length; i++) {
            float currentY = y - i * rowHeight;

            contentStream.setLineWidth(0.5f);
            contentStream.addRect(x, currentY - rowHeight, col1Width, rowHeight);
            contentStream.stroke();
            contentStream.addRect(x + col1Width, currentY - rowHeight, col2Width, rowHeight);
            contentStream.stroke();
            contentStream.addRect(x + col1Width + col2Width, currentY - rowHeight, col1Width, rowHeight);
            contentStream.stroke();
            contentStream.addRect(x + col1Width * 2 + col2Width, currentY - rowHeight, col2Width, rowHeight);
            contentStream.stroke();

            int nextIndex = i + 1;
            String label2 = nextIndex < data.length ? data[nextIndex][0] : "";
            String value2 = nextIndex < data.length ? data[nextIndex][1] : "";

            contentStream.beginText();
            contentStream.newLineAtOffset(x + 5, currentY - 14);
            contentStream.showText(data[i][0]);
            contentStream.endText();

            contentStream.beginText();
            contentStream.newLineAtOffset(x + col1Width + 5, currentY - 14);
            contentStream.showText(data[i][1]);
            contentStream.endText();

            contentStream.beginText();
            contentStream.newLineAtOffset(x + col1Width + col2Width + 5, currentY - 14);
            contentStream.showText(label2);
            contentStream.endText();

            contentStream.beginText();
            contentStream.newLineAtOffset(x + col1Width * 2 + col2Width + 5, currentY - 14);
            contentStream.showText(value2);
            contentStream.endText();

            i++;
        }
    }

    private String getQualityLevelText(String level) {
        Map<String, String> map = new HashMap<>();
        map.put("EXCELLENT", "优秀");
        map.put("GOOD", "良好");
        map.put("PASS", "合格");
        map.put("FAIL", "不合格");
        return map.getOrDefault(level, level);
    }

    private ReportTemplate getDefaultTemplate() {
        LambdaQueryWrapper<ReportTemplate> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(ReportTemplate::getIsDefault, 1);
        wrapper.eq(ReportTemplate::getStatus, 1);
        ReportTemplate template = reportTemplateMapper.selectOne(wrapper);
        if (template == null) {
            template = new ReportTemplate();
            template.setTemplateName("默认模板");
            template.setTemplateCode("DEFAULT");
            template.setHeader("古法造纸品质检测报告");
            template.setFooter("古法造纸质量管理系统");
            template.setIsDefault(1);
            template.setStatus(1);
        }
        return template;
    }

    public Result<List<ReportTemplate>> getTemplates() {
        LambdaQueryWrapper<ReportTemplate> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(ReportTemplate::getStatus, 1);
        wrapper.orderByDesc(ReportTemplate::getIsDefault);
        List<ReportTemplate> templates = reportTemplateMapper.selectList(wrapper);
        return Result.success(templates);
    }

    public Result<ReportTemplate> createTemplate(ReportTemplate template) {
        template.setStatus(1);
        reportTemplateMapper.insert(template);
        return Result.success("模板创建成功", template);
    }
}
