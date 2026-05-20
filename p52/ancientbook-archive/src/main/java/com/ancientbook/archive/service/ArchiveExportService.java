package com.ancientbook.archive.service;

import com.ancientbook.common.util.PdfGenerator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Slf4j
@Service
@RequiredArgsConstructor
public class ArchiveExportService {

    private final Map<String, ExportTask> taskStore = new ConcurrentHashMap<>();

    public String createBatchExportTask(List<String> archiveCodes, String operatorId) {
        String taskId = "EXPORT_" + System.currentTimeMillis();

        ExportTask task = new ExportTask();
        task.setTaskId(taskId);
        task.setArchiveCodes(archiveCodes);
        task.setOperatorId(operatorId);
        task.setTotalCount(archiveCodes.size());
        task.setProgress(0);
        task.setStatus(0);
        task.setCreateTime(LocalDateTime.now());

        taskStore.put(taskId, task);
        log.info("创建批量导出任务: {}, 档案数: {}", taskId, archiveCodes.size());

        asyncExecuteExport(task);

        return taskId;
    }

    private void asyncExecuteExport(ExportTask task) {
        new Thread(() -> {
            try {
                task.setStatus(1);

                List<Map<String, Object>> archives = new ArrayList<>();
                for (int i = 0; i < task.getArchiveCodes().size(); i++) {
                    String code = task.getArchiveCodes().get(i);
                    Map<String, Object> archive = generateMockArchiveData(code);
                    archives.add(archive);
                    task.setProgress((i + 1) * 100 / task.getTotalCount());
                    Thread.sleep(100);
                }

                byte[] pdfBytes = PdfGenerator.generateBatchArchivePdf(archives);
                task.setFileData(pdfBytes);
                task.setFileName("古籍修复档案_" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss")) + ".pdf");
                task.setFileSize(pdfBytes.length);
                task.setStatus(2);

                log.info("批量导出任务完成: {}, 文件大小: {} bytes", task.getTaskId(), pdfBytes.length);
            } catch (Exception e) {
                log.error("批量导出任务失败", e);
                task.setStatus(3);
                task.setErrorMsg(e.getMessage());
            }
        }).start();
    }

    private Map<String, Object> generateMockArchiveData(String archiveCode) {
        Map<String, Object> archive = new LinkedHashMap<>();
        archive.put("archiveCode", archiveCode);
        archive.put("bookCode", "BOOK_" + archiveCode.hashCode() % 1000);
        archive.put("bookName", "古籍样本_" + archiveCode);
        archive.put("startTime", LocalDateTime.now().minusDays(7).format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
        archive.put("endTime", LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
        archive.put("totalDuration", 180 + (int) (Math.random() * 100));
        archive.put("restorerNames", "张修复师,李修复师");
        archive.put("processIds", "PROC_001,PROC_002");
        archive.put("materialUsage", "宣纸10张,浆糊50g");
        archive.put("qualityScore", 85 + (int) (Math.random() * 15));
        archive.put("archiveTime", LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
        archive.put("archivistName", "系统管理员");
        archive.put("remark", "这是模拟导出的档案数据");
        return archive;
    }

    public ExportTask getTaskStatus(String taskId) {
        return taskStore.get(taskId);
    }

    public byte[] downloadTaskResult(String taskId) {
        ExportTask task = taskStore.get(taskId);
        if (task == null) {
            throw new RuntimeException("导出任务不存在");
        }
        if (task.getStatus() != 2) {
            throw new RuntimeException("导出任务尚未完成或已失败");
        }
        return task.getFileData();
    }

    public byte[] exportSingleArchive(String archiveCode) {
        Map<String, Object> archive = generateMockArchiveData(archiveCode);
        return PdfGenerator.generateSingleArchivePdf(archive);
    }

    public byte[] exportMultipleArchives(List<String> archiveCodes) {
        List<Map<String, Object>> archives = new ArrayList<>();
        for (String code : archiveCodes) {
            archives.add(generateMockArchiveData(code));
        }
        return PdfGenerator.generateBatchArchivePdf(archives);
    }

    public byte[] exportAsZip(List<String> archiveCodes) throws Exception {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (ZipOutputStream zos = new ZipOutputStream(baos)) {
            for (String code : archiveCodes) {
                byte[] pdfBytes = exportSingleArchive(code);
                ZipEntry entry = new ZipEntry("档案_" + code + ".pdf");
                zos.putNextEntry(entry);
                zos.write(pdfBytes);
                zos.closeEntry();
            }
        }
        return baos.toByteArray();
    }

    public static class ExportTask {
        private String taskId;
        private List<String> archiveCodes;
        private String operatorId;
        private int totalCount;
        private int progress;
        private int status;
        private String fileName;
        private long fileSize;
        private byte[] fileData;
        private String errorMsg;
        private LocalDateTime createTime;

        public String getTaskId() { return taskId; }
        public void setTaskId(String taskId) { this.taskId = taskId; }
        public List<String> getArchiveCodes() { return archiveCodes; }
        public void setArchiveCodes(List<String> archiveCodes) { this.archiveCodes = archiveCodes; }
        public String getOperatorId() { return operatorId; }
        public void setOperatorId(String operatorId) { this.operatorId = operatorId; }
        public int getTotalCount() { return totalCount; }
        public void setTotalCount(int totalCount) { this.totalCount = totalCount; }
        public int getProgress() { return progress; }
        public void setProgress(int progress) { this.progress = progress; }
        public int getStatus() { return status; }
        public void setStatus(int status) { this.status = status; }
        public String getFileName() { return fileName; }
        public void setFileName(String fileName) { this.fileName = fileName; }
        public long getFileSize() { return fileSize; }
        public void setFileSize(long fileSize) { this.fileSize = fileSize; }
        public byte[] getFileData() { return fileData; }
        public void setFileData(byte[] fileData) { this.fileData = fileData; }
        public String getErrorMsg() { return errorMsg; }
        public void setErrorMsg(String errorMsg) { this.errorMsg = errorMsg; }
        public LocalDateTime getCreateTime() { return createTime; }
        public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
    }
}
