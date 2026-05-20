package com.papermanagement.controller;

import com.papermanagement.dto.Result;
import com.papermanagement.entity.ReportTemplate;
import com.papermanagement.service.PdfExportService;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/pdf")
public class PdfExportController {

    @Autowired
    private PdfExportService pdfExportService;

    @PostMapping("/export")
    public void exportReports(@RequestBody Map<String, Object> params, HttpServletResponse response) throws Exception {
        List<Long> reportIds = (List<Long>) params.get("reportIds");
        Long templateId = params.get("templateId") != null ? ((Number) params.get("templateId")).longValue() : null;

        byte[] pdfData = pdfExportService.exportReports(reportIds, templateId);

        String fileName = "质检报告_" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss")) + ".pdf";
        response.setContentType("application/pdf");
        response.setHeader("Content-Disposition", "attachment; filename=" + URLEncoder.encode(fileName, StandardCharsets.UTF_8));
        response.setContentLength(pdfData.length);
        response.getOutputStream().write(pdfData);
        response.getOutputStream().flush();
    }

    @GetMapping("/templates")
    public Result<List<ReportTemplate>> getTemplates() {
        return pdfExportService.getTemplates();
    }

    @PostMapping("/template")
    public Result<ReportTemplate> createTemplate(@RequestBody ReportTemplate template) {
        return pdfExportService.createTemplate(template);
    }
}
