package com.papermanagement.controller;

import com.papermanagement.dto.Result;
import com.papermanagement.service.FileUploadService;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/file")
public class FileUploadController {

    private static final Logger logger = LoggerFactory.getLogger(FileUploadController.class);

    @Autowired
    private FileUploadService fileUploadService;

    @GetMapping("/check-chunk")
    public Result<Map<String, Object>> checkChunk(@RequestParam String fileId, @RequestParam String fileName) {
        logger.info("检查分片: fileId={}, fileName={}", fileId, fileName);
        return fileUploadService.checkChunk(fileId, fileName);
    }

    @PostMapping("/upload-chunk")
    public Result<Map<String, Object>> uploadChunk(
            @RequestParam("file") MultipartFile file,
            @RequestParam String fileId,
            @RequestParam Integer chunkNumber,
            @RequestParam Integer chunkSize,
            @RequestParam Long totalSize,
            @RequestParam Integer totalChunks,
            @RequestParam String fileName,
            @RequestParam(required = false) String contentType,
            @RequestParam(required = false) String batchNo,
            @RequestParam(required = false) String processCode,
            HttpServletRequest request) throws IOException {

        Long userId = (Long) request.getAttribute("userId");
        logger.info("上传分片: fileId={}, chunkNumber={}/{}, fileName={}", fileId, chunkNumber, totalChunks, fileName);
        return fileUploadService.uploadChunk(file, fileId, chunkNumber, chunkSize, totalSize, totalChunks,
                fileName, contentType, batchNo, processCode, userId);
    }

    @PostMapping("/merge-chunks")
    public Result<Map<String, Object>> mergeChunks(@RequestBody Map<String, String> params) throws IOException {
        String fileId = params.get("fileId");
        String fileName = params.get("fileName");
        logger.info("合并分片: fileId={}, fileName={}", fileId, fileName);
        return fileUploadService.mergeChunks(fileId, fileName);
    }

    @GetMapping("/list")
    public Result<List<Map<String, Object>>> getFileList(
            @RequestParam(required = false) String batchNo,
            @RequestParam(required = false) String processCode) {
        return fileUploadService.getFileList(batchNo, processCode);
    }
}
