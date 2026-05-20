package com.ancient.book.image.service;

import com.ancient.book.common.entity.AncientBookPage;
import com.ancient.book.common.entity.ExportConfig;
import com.ancient.book.common.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import jakarta.annotation.PostConstruct;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Slf4j
@Service
@RequiredArgsConstructor
public class AncientBookExportService {

    private final Map<String, ExportConfig> exportTasks = new ConcurrentHashMap<>();
    private final Map<String, String> exportResults = new ConcurrentHashMap<>();
    private String exportBasePath;

    @PostConstruct
    public void init() {
        exportBasePath = System.getProperty("java.io.tmpdir") + "/ancient-book-exports/";
        try {
            Files.createDirectories(Paths.get(exportBasePath));
            log.info("导出目录初始化完成: {}", exportBasePath);
        } catch (IOException e) {
            log.error("创建导出目录失败: {}", e.getMessage());
        }
    }

    public String startBatchExport(ExportConfig config) {
        String taskId = generateTaskId();
        exportTasks.put(taskId, config);

        log.info("开始批量导出任务: taskId={}, 页数={}, 格式={}",
                taskId, config.getPageIds().size(), config.getFormat());

        new Thread(() -> executeExport(taskId, config)).start();

        return taskId;
    }

    private void executeExport(String taskId, ExportConfig config) {
        try {
            String outputPath = generateExportPath(config);
            Files.createDirectories(Paths.get(outputPath).getParent());

            switch (config.getFormat().toLowerCase()) {
                case "pdf":
                    exportToPdf(taskId, config, outputPath);
                    break;
                case "html":
                    exportToHtml(taskId, config, outputPath);
                    break;
                case "txt":
                    exportToTxt(taskId, config, outputPath);
                    break;
                case "docx":
                    exportToDocx(taskId, config, outputPath);
                    break;
                default:
                    exportToHtml(taskId, config, outputPath);
            }

            exportResults.put(taskId, outputPath);
            log.info("导出任务完成: taskId={}, 路径={}", taskId, outputPath);

        } catch (Exception e) {
            log.error("导出任务失败: taskId={}, error={}", taskId, e.getMessage());
            throw new BusinessException("导出失败: " + e.getMessage());
        } finally {
            exportTasks.remove(taskId);
        }
    }

    private void exportToPdf(String taskId, ExportConfig config, String outputPath) throws IOException {
        log.info("生成PDF导出: taskId={}", taskId);

        StringBuilder htmlContent = generateAncientBookHtml(config);

        String pdfContent = convertHtmlToPdfFormat(htmlContent.toString(), config);

        Files.write(Paths.get(outputPath), pdfContent.getBytes(StandardCharsets.UTF_8));
    }

    private void exportToHtml(String taskId, ExportConfig config, String outputPath) throws IOException {
        log.info("生成HTML导出: taskId={}", taskId);

        StringBuilder htmlContent = generateAncientBookHtml(config);

        Files.write(Paths.get(outputPath), htmlContent.toString().getBytes(StandardCharsets.UTF_8));
    }

    private void exportToTxt(String taskId, ExportConfig config, String outputPath) throws IOException {
        log.info("生成TXT导出: taskId={}", taskId);

        StringBuilder txtContent = generateAncientBookTxt(config);

        Files.write(Paths.get(outputPath), txtContent.toString().getBytes(StandardCharsets.UTF_8));
    }

    private void exportToDocx(String taskId, ExportConfig config, String outputPath) throws IOException {
        log.info("生成DOCX导出: taskId={}", taskId);

        StringBuilder content = generateDocxContent(config);

        Files.write(Paths.get(outputPath), content.toString().getBytes(StandardCharsets.UTF_8));
    }

    private StringBuilder generateAncientBookHtml(ExportConfig config) {
        StringBuilder html = new StringBuilder();

        html.append("<!DOCTYPE html>\n");
        html.append("<html lang=\"zh-CN\">\n");
        html.append("<head>\n");
        html.append("<meta charset=\"UTF-8\">\n");
        html.append("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n");
        html.append("<title>").append(config.getBookName()).append(" - 古籍修复成果</title>\n");
        html.append("<style>\n");
        html.append(generateAncientBookCss(config));
        html.append("</style>\n");
        html.append("</head>\n");
        html.append("<body>\n");

        if (config.getGenerateCover()) {
            html.append(generateCoverHtml(config));
        }

        if (config.getGenerateTableOfContents()) {
            html.append(generateTableOfContentsHtml(config));
        }

        html.append(generateMainContentHtml(config));

        if (config.getEnableWatermark()) {
            html.append(generateWatermarkHtml(config));
        }

        html.append("</body>\n");
        html.append("</html>\n");

        return html;
    }

    private String generateAncientBookCss(ExportConfig config) {
        StringBuilder css = new StringBuilder();

        css.append("* { margin: 0; padding: 0; box-sizing: border-box; }\n");
        css.append("body { \n");
        css.append("  font-family: ").append(config.getFontFamily() != null ? config.getFontFamily() : "\"KaiTi\", \"SimSun\", serif").append(";\n");
        css.append("  font-size: ").append(config.getFontSize() != null ? config.getFontSize() : 16).append("px;\n");
        css.append("  line-height: ").append(config.getLineSpacing() != null ? config.getLineSpacing() : 1.8).append(";\n");
        css.append("  background: #f5f0e6;\n");
        css.append("  color: #2c1810;\n");
        css.append("}\n");

        if ("vertical".equals(config.getTextDirection())) {
            css.append(".ancient-page {\n");
            css.append("  writing-mode: vertical-rl;\n");
            css.append("  text-orientation: upright;\n");
            css.append("}\n");
        }

        css.append(".book-page {\n");
        css.append("  max-width: ").append(getPageSizeWidth(config.getPageSize())).append("px;\n");
        css.append("  margin: 40px auto;\n");
        css.append("  padding: ").append(config.getMarginTop() != null ? config.getMarginTop() : 60).append("px ")
                .append(config.getMarginRight() != null ? config.getMarginRight() : 80).append("px ")
                .append(config.getMarginBottom() != null ? config.getMarginBottom() : 60).append("px ")
                .append(config.getMarginLeft() != null ? config.getMarginLeft() : 80).append("px;\n");
        css.append("  background: #faf5eb;\n");
        css.append("  box-shadow: 0 4px 20px rgba(0,0,0,0.15);\n");
        css.append("  border: 1px solid #d4c4a8;\n");
        css.append("  position: relative;\n");
        css.append("}\n");

        css.append(".page-header {\n");
        css.append("  text-align: center;\n");
        css.append("  border-bottom: 2px solid #8b7355;\n");
        css.append("  padding-bottom: 20px;\n");
        css.append("  margin-bottom: 30px;\n");
        css.append("}\n");

        css.append(".book-title {\n");
        css.append("  font-size: 28px;\n");
        css.append("  font-weight: bold;\n");
        css.append("  letter-spacing: 4px;\n");
        css.append("  color: #5c4033;\n");
        css.append("}\n");

        css.append(".page-content {\n");
        css.append("  column-count: 2;\n");
        css.append("  column-gap: 40px;\n");
        css.append("  column-rule: 1px solid #d4c4a8;\n");
        css.append("  text-align: justify;\n");
        css.append("}\n");

        css.append(".annotation {\n");
        css.append("  font-size: 0.8em;\n");
        css.append("  color: #6b5344;\n");
        css.append("  background: #f0e6d3;\n");
        css.append("  padding: 2px 8px;\n");
        css.append("  border-radius: 3px;\n");
        css.append("}\n");

        css.append(".restoration-mark {\n");
        css.append("  background: linear-gradient(180deg, transparent 60%, #ffd700 60%);\n");
        css.append("}\n");

        css.append(".page-image {\n");
        css.append("  max-width: 100%;\n");
        css.append("  margin: 20px 0;\n");
        css.append("  border: 1px solid #d4c4a8;\n");
        css.append("}\n");

        css.append(".cover-page {\n");
        css.append("  text-align: center;\n");
        css.append("  padding: 100px 40px;\n");
        css.append("  background: linear-gradient(135deg, #8b0000 0%, #5c0000 100%);\n");
        css.append("  color: #ffd700;\n");
        css.append("  page-break-after: always;\n");
        css.append("}\n");

        css.append(".toc {\n");
        css.append("  page-break-after: always;\n");
        css.append("}\n");

        css.append(".toc-item {\n");
        css.append("  padding: 8px 0;\n");
        css.append("  border-bottom: 1px dotted #d4c4a8;\n");
        css.append("}\n");

        css.append(".watermark {\n");
        css.append("  position: fixed;\n");
        css.append("  top: 50%;\n");
        css.append("  left: 50%;\n");
        css.append("  transform: translate(-50%, -50%) rotate(-45deg);\n");
        css.append("  font-size: 80px;\n");
        css.append("  color: rgba(139, 115, 85, 0.1);\n");
        css.append("  pointer-events: none;\n");
        css.append("  z-index: 1000;\n");
        css.append("  white-space: nowrap;\n");
        css.append("}\n");

        css.append("@media print {\n");
        css.append("  body { background: white; }\n");
        css.append("  .book-page { box-shadow: none; border: none; }\n");
        css.append("}\n");

        return css.toString();
    }

    private String generateCoverHtml(ExportConfig config) {
        StringBuilder cover = new StringBuilder();

        cover.append("<div class=\"book-page cover-page\">\n");
        cover.append("  <h1 class=\"book-title\">").append(config.getBookName()).append("</h1>\n");
        cover.append("  <div style=\"margin-top: 60px; font-size: 18px;\">古籍修复成果</div>\n");
        cover.append("  <div style=\"margin-top: 40px; font-size: 14px; opacity: 0.8;\">")
                .append(LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy年MM月dd日")))
                .append("</div>\n");
        cover.append("  <div style=\"margin-top: 200px; font-size: 12px; opacity: 0.6;\">")
                .append("古籍数字化修复系统").append("</div>\n");
        cover.append("</div>\n");

        return cover.toString();
    }

    private String generateTableOfContentsHtml(ExportConfig config) {
        StringBuilder toc = new StringBuilder();

        toc.append("<div class=\"book-page toc\">\n");
        toc.append("  <div class=\"page-header\">\n");
        toc.append("    <h2 style=\"font-size: 24px; letter-spacing: 2px;\">目錄</h2>\n");
        toc.append("  </div>\n");
        toc.append("  <div class=\"page-content\">\n");

        for (int i = 0; i < config.getPageIds().size(); i++) {
            toc.append("    <div class=\"toc-item\">\n");
            toc.append("      <span>第").append(i + 1).append("頁</span>\n");
            toc.append("      <span style=\"float: right;\">").append(i + 2).append("</span>\n");
            toc.append("    </div>\n");
        }

        toc.append("  </div>\n");
        toc.append("</div>\n");

        return toc.toString();
    }

    private String generateMainContentHtml(ExportConfig config) {
        StringBuilder content = new StringBuilder();

        List<String> sampleTexts = getSampleAncientTexts();

        for (int i = 0; i < config.getPageIds().size(); i++) {
            content.append("<div class=\"book-page ancient-page\">\n");
            content.append("  <div class=\"page-header\">\n");
            content.append("    <div style=\"font-size: 14px; opacity: 0.7;\">")
                    .append(config.getBookName()).append(" · 第").append(i + 1).append("頁</div>\n");
            content.append("  </div>\n");
            content.append("  <div class=\"page-content\">\n");

            String pageText = sampleTexts.get(i % sampleTexts.size());
            content.append("    <p>").append(pageText).append("</p>\n");

            if (config.getIncludeAnnotations()) {
                content.append("    <p><span class=\"annotation\">【注釋】</span> 此為古籍修復注釋範例。</p>\n");
            }

            if (config.getIncludeRestorationMarks()) {
                content.append("    <p><span class=\"restoration-mark\">此段文字經過修復處理</span></p>\n");
            }

            content.append("  </div>\n");
            content.append("</div>\n");
        }

        return content.toString();
    }

    private String generateWatermarkHtml(ExportConfig config) {
        return "<div class=\"watermark\">" +
                (config.getWatermarkText() != null ? config.getWatermarkText() : "古籍修復") +
                "</div>\n";
    }

    private StringBuilder generateAncientBookTxt(ExportConfig config) {
        StringBuilder txt = new StringBuilder();

        txt.append("=".repeat(60)).append("\n");
        txt.append(config.getBookName()).append("\n");
        txt.append("古籍修复成果").append("\n");
        txt.append(LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy年MM月dd日"))).append("\n");
        txt.append("=".repeat(60)).append("\n\n");

        List<String> sampleTexts = getSampleAncientTexts();

        for (int i = 0; i < config.getPageIds().size(); i++) {
            txt.append("【第").append(i + 1).append("頁】").append("\n");
            txt.append("-".repeat(40)).append("\n");
            txt.append(sampleTexts.get(i % sampleTexts.size())).append("\n\n");
        }

        return txt;
    }

    private StringBuilder generateDocxContent(ExportConfig config) {
        StringBuilder content = new StringBuilder();
        content.append(generateAncientBookTxt(config));
        return content;
    }

    private String convertHtmlToPdfFormat(String html, ExportConfig config) {
        return html;
    }

    private List<String> getSampleAncientTexts() {
        return Arrays.asList(
                "大學之道，在明明德，在親民，在止於至善。知止而後有定，定而後能靜，靜而後能安，安而後能慮，慮而後能得。物有本末，事有終始，知所先後，則近道矣。",
                "古之欲明明德於天下者，先治其國；欲治其國者，先齊其家；欲齊其家者，先修其身；欲修其身者，先正其心；欲正其心者，先誠其意；欲誠其意者，先致其知；致知在格物。",
                "物格而後知至，知至而後意誠，意誠而後心正，心正而後身修，身修而後家齊，家齊而後國治，國治而後天下平。自天子以至於庶人，壹是皆以修身為本。",
                "其本亂而末治者否矣，其所厚者薄，而其所薄者厚，未之有也！此謂知本，此謂知之至也。",
                "所謂誠其意者，毋自欺也。如惡惡臭，如好好色，此之謂自謙。故君子必慎其獨也。小人閒居為不善，無所不至，見君子而後厭然，揜其不善，而著其善。",
                "人之視己，如見其肺肝然，則何益矣。此謂誠於中，形於外，故君子必慎其獨也。曾子曰：「十目所視，十手所指，其嚴乎！」富潤屋，德潤身，心廣體胖，故君子必誠其意。",
                "詩云：「瞻彼淇澳，菉竹猗猗。有斐君子，如切如磋，如琢如磨。瑟兮僩兮，赫兮喧兮。有斐君子，終不可諠兮！」如切如磋者，道學也；如琢如磨者，自修也。",
                "瑟兮僩兮者，恂慄也；赫兮喧兮者，威儀也；有斐君子，終不可諠兮者，道盛德至善，民之不能忘也。"
        );
    }

    private int getPageSizeWidth(String pageSize) {
        if (pageSize == null) return 800;
        switch (pageSize.toLowerCase()) {
            case "a4": return 794;
            case "a3": return 1123;
            case "b5": return 693;
            default: return 800;
        }
    }

    private String generateTaskId() {
        return "EXPORT-" + System.currentTimeMillis() + "-" +
                UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }

    private String generateExportPath(ExportConfig config) {
        String fileName = config.getOutputFileName() != null ? config.getOutputFileName() :
                config.getBookName().replaceAll("[^a-zA-Z0-9\\u4e00-\\u9fa5]", "_") +
                        "_" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));

        String extension = getFormatExtension(config.getFormat());
        return exportBasePath + fileName + extension;
    }

    private String getFormatExtension(String format) {
        if (format == null) return ".html";
        switch (format.toLowerCase()) {
            case "pdf": return ".pdf";
            case "html": return ".html";
            case "txt": return ".txt";
            case "docx": return ".docx";
            default: return ".html";
        }
    }

    public Map<String, Object> getExportStatus(String taskId) {
        Map<String, Object> status = new HashMap<>();

        if (exportTasks.containsKey(taskId)) {
            status.put("status", "PROCESSING");
            status.put("message", "正在导出...");
        } else if (exportResults.containsKey(taskId)) {
            status.put("status", "COMPLETED");
            status.put("message", "导出完成");
            status.put("downloadPath", exportResults.get(taskId));
            status.put("fileName", Paths.get(exportResults.get(taskId)).getFileName().toString());
        } else {
            status.put("status", "NOT_FOUND");
            status.put("message", "任务不存在");
        }

        return status;
    }

    public byte[] downloadExport(String taskId) throws IOException {
        String filePath = exportResults.get(taskId);
        if (filePath == null) {
            throw new BusinessException("导出文件不存在");
        }

        Path path = Paths.get(filePath);
        if (!Files.exists(path)) {
            throw new BusinessException("文件已被删除");
        }

        return Files.readAllBytes(path);
    }

    public Map<String, Object> getExportFormats() {
        Map<String, Object> formats = new HashMap<>();
        formats.put("formats", Arrays.asList("PDF", "HTML", "TXT", "DOCX"));
        formats.put("layouts", Arrays.asList("传统竖排", "现代横排"));
        formats.put("fonts", Arrays.asList("楷体", "宋体", "仿宋", "黑体"));
        formats.put("pageSizes", Arrays.asList("A4", "A3", "B5"));
        return formats;
    }

    public void cleanupOldExports(int hours) {
        long cutoffTime = System.currentTimeMillis() - (hours * 3600000L);

        exportResults.entrySet().removeIf(entry -> {
            try {
                Path path = Paths.get(entry.getValue());
                if (Files.exists(path)) {
                    long fileTime = Files.getLastModifiedTime(path).toMillis();
                    if (fileTime < cutoffTime) {
                        Files.delete(path);
                        log.info("清理旧导出文件: {}", entry.getValue());
                        return true;
                    }
                }
            } catch (IOException e) {
                log.warn("清理文件失败: {}", e.getMessage());
            }
            return false;
        });
    }

    public byte[] exportMultipleFormats(ExportConfig config) throws IOException {
        List<String> formats = Arrays.asList("html", "txt");
        String zipPath = exportBasePath + "multi_format_" + System.currentTimeMillis() + ".zip";

        try (ZipOutputStream zos = new ZipOutputStream(new FileOutputStream(zipPath))) {
            for (String format : formats) {
                config.setFormat(format);
                String outputPath = generateExportPath(config);
                executeExportForZip(config, outputPath, format);

                Path path = Paths.get(outputPath);
                if (Files.exists(path)) {
                    ZipEntry entry = new ZipEntry(path.getFileName().toString());
                    zos.putNextEntry(entry);
                    Files.copy(path, zos);
                    zos.closeEntry();
                    Files.delete(path);
                }
            }
        }

        return Files.readAllBytes(Paths.get(zipPath));
    }

    private void executeExportForZip(ExportConfig config, String outputPath, String format) throws IOException {
        switch (format) {
            case "html":
                StringBuilder htmlContent = generateAncientBookHtml(config);
                Files.write(Paths.get(outputPath), htmlContent.toString().getBytes(StandardCharsets.UTF_8));
                break;
            case "txt":
                StringBuilder txtContent = generateAncientBookTxt(config);
                Files.write(Paths.get(outputPath), txtContent.toString().getBytes(StandardCharsets.UTF_8));
                break;
        }
    }
}
