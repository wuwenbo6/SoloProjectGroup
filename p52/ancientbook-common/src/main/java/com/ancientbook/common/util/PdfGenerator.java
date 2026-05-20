package com.ancientbook.common.util;

import lombok.extern.slf4j.Slf4j;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

@Slf4j
public class PdfGenerator {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    public static byte[] generateSingleArchivePdf(Map<String, Object> archiveData) {
        StringBuilder html = new StringBuilder();
        html.append("<!DOCTYPE html>");
        html.append("<html><head><meta charset='UTF-8'>");
        html.append("<title>古籍修复档案</title>");
        html.append("<style>");
        html.append("body{font-family:'SimSun',serif;padding:20px}");
        html.append(".header{text-align:center;border-bottom:3px double #333;padding-bottom:20px;margin-bottom:30px}");
        html.append(".title{font-size:24px;font-weight:bold;letter-spacing:8px}");
        html.append(".subtitle{font-size:14px;color:#666;margin-top:10px}");
        html.append(".section{margin-bottom:25px}");
        html.append(".section-title{font-size:16px;font-weight:bold;border-left:4px solid #1e88e5;padding-left:10px;margin-bottom:15px;color:#333}");
        html.append(".info-table{width:100%;border-collapse:collapse}");
        html.append(".info-table td{padding:8px 12px;border:1px solid #ddd;font-size:14px}");
        html.append(".info-table td:first-child{width:25%;background-color:#f5f5f5;font-weight:bold}");
        html.append(".footer{margin-top:50px;text-align:right;font-size:12px;color:#666}");
        html.append(".watermark{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:60px;color:rgba(0,0,0,0.05);z-index:-1}");
        html.append("</style></head><body>");

        html.append("<div class='watermark'>古籍修复档案</div>");

        html.append("<div class='header'>");
        html.append("<div class='title'>古籍善本修复档案</div>");
        html.append("<div class='subtitle'>ARCHIVE CODE: ").append(archiveData.get("archiveCode")).append("</div>");
        html.append("</div>");

        html.append("<div class='section'>");
        html.append("<div class='section-title'>基本信息</div>");
        html.append("<table class='info-table'>");
        html.append("<tr><td>档案编号</td><td>").append(archiveData.get("archiveCode")).append("</td></tr>");
        html.append("<tr><td>善本编号</td><td>").append(archiveData.get("bookCode")).append("</td></tr>");
        html.append("<tr><td>善本名称</td><td>").append(archiveData.get("bookName")).append("</td></tr>");
        html.append("<tr><td>修复人员</td><td>").append(archiveData.get("restorerNames")).append("</td></tr>");
        html.append("<tr><td>归档时间</td><td>").append(archiveData.get("archiveTime")).append("</td></tr>");
        html.append("</table></div>");

        html.append("<div class='section'>");
        html.append("<div class='section-title'>修复概况</div>");
        html.append("<table class='info-table'>");
        html.append("<tr><td>开始时间</td><td>").append(archiveData.get("startTime")).append("</td></tr>");
        html.append("<tr><td>结束时间</td><td>").append(archiveData.get("endTime")).append("</td></tr>");
        html.append("<tr><td>总耗时</td><td>").append(archiveData.get("totalDuration")).append(" 分钟</td></tr>");
        html.append("<tr><td>质量评分</td><td>").append(archiveData.get("qualityScore")).append(" 分</td></tr>");
        html.append("</table></div>");

        if (archiveData.get("materialUsage") != null) {
            html.append("<div class='section'>");
            html.append("<div class='section-title'>材料使用情况</div>");
            html.append("<table class='info-table'>");
            html.append("<tr><td>材料清单</td><td>").append(archiveData.get("materialUsage")).append("</td></tr>");
            html.append("</table></div>");
        }

        if (archiveData.get("remark") != null) {
            html.append("<div class='section'>");
            html.append("<div class='section-title'>备注说明</div>");
            html.append("<table class='info-table'>");
            html.append("<tr><td>").append(archiveData.get("remark")).append("</td></tr>");
            html.append("</table></div>");
        }

        html.append("<div class='footer'>");
        html.append("导出时间: ").append(LocalDateTime.now().format(DATE_FORMAT));
        html.append("</div>");

        html.append("</body></html>");

        return htmlToPdfBytes(html.toString());
    }

    public static byte[] generateBatchArchivePdf(List<Map<String, Object>> archiveList) {
        StringBuilder html = new StringBuilder();
        html.append("<!DOCTYPE html>");
        html.append("<html><head><meta charset='UTF-8'>");
        html.append("<title>古籍修复档案批量导出</title>");
        html.append("<style>");
        html.append("body{font-family:'SimSun',serif;padding:20px}");
        html.append(".header{text-align:center;border-bottom:3px double #333;padding-bottom:20px;margin-bottom:30px}");
        html.append(".title{font-size:24px;font-weight:bold;letter-spacing:8px}");
        html.append(".subtitle{font-size:14px;color:#666;margin-top:10px}");
        html.append(".summary-table{width:100%;border-collapse:collapse;margin-bottom:30px}");
        html.append(".summary-table th{background-color:#1e88e5;color:white;padding:10px;font-weight:bold;text-align:center}");
        html.append(".summary-table td{padding:10px;border:1px solid #ddd;text-align:center}");
        html.append(".page-break{page-break-after:always}");
        html.append("</style></head><body>");

        html.append("<div class='header'>");
        html.append("<div class='title'>古籍善本修复档案 - 批量导出</div>");
        html.append("<div class='subtitle'>共 ").append(archiveList.size()).append(" 份档案 | 导出时间: ").append(LocalDateTime.now().format(DATE_FORMAT)).append("</div>");
        html.append("</div>");

        html.append("<div><div style='font-weight:bold;margin-bottom:10px;font-size:16px'>目录索引</div>");
        html.append("<table class='summary-table'>");
        html.append("<thead><tr><th>序号</th><th>档案编号</th><th>善本编号</th><th>善本名称</th><th>修复人员</th><th>归档时间</th></tr></thead>");
        html.append("<tbody>");
        for (int i = 0; i < archiveList.size(); i++) {
            Map<String, Object> archive = archiveList.get(i);
            html.append("<tr>");
            html.append("<td>").append(i + 1).append("</td>");
            html.append("<td>").append(archive.get("archiveCode")).append("</td>");
            html.append("<td>").append(archive.get("bookCode")).append("</td>");
            html.append("<td>").append(archive.get("bookName")).append("</td>");
            html.append("<td>").append(archive.get("restorerNames")).append("</td>");
            html.append("<td>").append(archive.get("archiveTime")).append("</td>");
            html.append("</tr>");
        }
        html.append("</tbody></table></div>");

        for (int i = 0; i < archiveList.size(); i++) {
            if (i > 0) {
                html.append("<div class='page-break'></div>");
            }
            Map<String, Object> archive = archiveList.get(i);
            html.append(generateSingleArchiveHtml(archive, i + 1));
        }

        html.append("</body></html>");
        return htmlToPdfBytes(html.toString());
    }

    private static String generateSingleArchiveHtml(Map<String, Object> archiveData, int index) {
        StringBuilder html = new StringBuilder();

        html.append("<div style='border:2px solid #333;padding:20px;margin-bottom:20px'>");
        html.append("<div style='text-align:center;border-bottom:2px solid #ddd;padding-bottom:15px;margin-bottom:20px'>");
        html.append("<div style='font-size:20px;font-weight:bold;letter-spacing:4px'>古籍善本修复档案</div>");
        html.append("<div style='font-size:14px;color:#666;margin-top:8px'>第 ").append(index).append(" 份 | 档案编号: ").append(archiveData.get("archiveCode")).append("</div>");
        html.append("</div>");

        html.append("<table style='width:100%;border-collapse:collapse'>");
        html.append("<tr><td style='width:25%;padding:8px;background-color:#f5f5f5;font-weight:bold;border:1px solid #ddd'>善本编号</td><td style='padding:8px;border:1px solid #ddd'>").append(archiveData.get("bookCode")).append("</td></tr>");
        html.append("<tr><td style='padding:8px;background-color:#f5f5f5;font-weight:bold;border:1px solid #ddd'>善本名称</td><td style='padding:8px;border:1px solid #ddd'>").append(archiveData.get("bookName")).append("</td></tr>");
        html.append("<tr><td style='padding:8px;background-color:#f5f5f5;font-weight:bold;border:1px solid #ddd'>修复人员</td><td style='padding:8px;border:1px solid #ddd'>").append(archiveData.get("restorerNames")).append("</td></tr>");
        html.append("<tr><td style='padding:8px;background-color:#f5f5f5;font-weight:bold;border:1px solid #ddd'>质量评分</td><td style='padding:8px;border:1px solid #ddd'>").append(archiveData.get("qualityScore")).append(" 分</td></tr>");
        html.append("<tr><td style='padding:8px;background-color:#f5f5f5;font-weight:bold;border:1px solid #ddd'>归档时间</td><td style='padding:8px;border:1px solid #ddd'>").append(archiveData.get("archiveTime")).append("</td></tr>");
        html.append("</table>");
        html.append("</div>");

        return html.toString();
    }

    private static byte[] htmlToPdfBytes(String html) {
        return html.getBytes(StandardCharsets.UTF_8);
    }
}
