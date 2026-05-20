package com.papermanagement.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.papermanagement.dto.Result;
import com.papermanagement.entity.FileChunk;
import com.papermanagement.mapper.FileChunkMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class FileUploadService {

    private static final Logger logger = LoggerFactory.getLogger(FileUploadService.class);

    @Value("${file.upload.path:./uploads}")
    private String uploadPath;

    @Autowired
    private FileChunkMapper fileChunkMapper;

    public Result<Map<String, Object>> checkChunk(String fileId, String fileName) {
        LambdaQueryWrapper<FileChunk> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(FileChunk::getFileId, fileId);
        List<FileChunk> chunks = fileChunkMapper.selectList(wrapper);

        Map<String, Object> result = new HashMap<>();
        if (!chunks.isEmpty()) {
            List<Integer> uploadedChunks = chunks.stream()
                    .map(FileChunk::getChunkNumber)
                    .collect(Collectors.toList());
            result.put("uploadedChunks", uploadedChunks);
            result.put("totalChunks", chunks.get(0).getTotalChunks());
            result.put("skipUpload", uploadedChunks.size() == chunks.get(0).getTotalChunks());
            logger.info("文件断点续传检查: fileId={}, 已上传={}/{}", fileId, uploadedChunks.size(), chunks.get(0).getTotalChunks());
        } else {
            result.put("uploadedChunks", Collections.emptyList());
            result.put("skipUpload", false);
        }
        return Result.success(result);
    }

    @Transactional(rollbackFor = Exception.class)
    public Result<Map<String, Object>> uploadChunk(MultipartFile file, String fileId, Integer chunkNumber,
                                                    Integer chunkSize, Long totalSize, Integer totalChunks,
                                                    String fileName, String contentType, String batchNo,
                                                    String processCode, Long userId) throws IOException {
        LambdaQueryWrapper<FileChunk> existWrapper = new LambdaQueryWrapper<>();
        existWrapper.eq(FileChunk::getFileId, fileId)
                .eq(FileChunk::getChunkNumber, chunkNumber);
        FileChunk existChunk = fileChunkMapper.selectOne(existWrapper);
        if (existChunk != null) {
            Map<String, Object> result = new HashMap<>();
            result.put("chunkNumber", chunkNumber);
            result.put("skipped", true);
            return Result.success("分片已存在，跳过", result);
        }

        String chunkDir = uploadPath + File.separator + "chunks" + File.separator + fileId;
        Files.createDirectories(Paths.get(chunkDir));

        String chunkFileName = fileId + "_" + chunkNumber + ".part";
        String chunkPath = chunkDir + File.separator + chunkFileName;
        file.transferTo(new File(chunkPath));

        FileChunk chunk = new FileChunk();
        chunk.setFileId(fileId);
        chunk.setChunkNumber(chunkNumber);
        chunk.setChunkSize(chunkSize);
        chunk.setTotalSize(totalSize);
        chunk.setTotalChunks(totalChunks);
        chunk.setChunkPath(chunkPath);
        chunk.setFileName(fileName);
        chunk.setContentType(contentType);
        chunk.setBatchNo(batchNo);
        chunk.setProcessCode(processCode);
        chunk.setCreateUserId(userId);
        fileChunkMapper.insert(chunk);

        logger.debug("分片上传成功: fileId={}, chunkNumber={}/{}", fileId, chunkNumber, totalChunks);

        LambdaQueryWrapper<FileChunk> countWrapper = new LambdaQueryWrapper<>();
        countWrapper.eq(FileChunk::getFileId, fileId);
        Long uploadedCount = fileChunkMapper.selectCount(countWrapper);

        Map<String, Object> result = new HashMap<>();
        result.put("chunkNumber", chunkNumber);
        result.put("uploadedCount", uploadedCount);
        result.put("totalChunks", totalChunks);
        result.put("progress", uploadedCount * 100.0 / totalChunks);
        result.put("mergeRequired", uploadedCount.equals(totalChunks.longValue()));

        return Result.success("分片上传成功", result);
    }

    @Transactional(rollbackFor = Exception.class)
    public Result<Map<String, Object>> mergeChunks(String fileId, String fileName) throws IOException {
        LambdaQueryWrapper<FileChunk> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(FileChunk::getFileId, fileId);
        List<FileChunk> chunks = fileChunkMapper.selectList(wrapper);

        if (chunks.isEmpty()) {
            return Result.error("未找到文件分片");
        }

        String mergeDir = uploadPath + File.separator + "files";
        Files.createDirectories(Paths.get(mergeDir));

        String ext = fileName.contains(".") ? fileName.substring(fileName.lastIndexOf(".")) : "";
        String finalFileName = fileId + ext;
        String finalFilePath = mergeDir + File.separator + finalFileName;

        chunks.sort(Comparator.comparingInt(FileChunk::getChunkNumber));

        try (BufferedOutputStream outStream = new BufferedOutputStream(Files.newOutputStream(Paths.get(finalFilePath)))) {
            for (FileChunk chunk : chunks) {
                Path chunkPath = Paths.get(chunk.getChunkPath());
                Files.copy(chunkPath, outStream);
                Files.delete(chunkPath);
            }
        }

        fileChunkMapper.delete(wrapper);

        logger.info("文件合并完成: fileId={}, fileName={}", fileId, finalFileName);

        Map<String, Object> result = new HashMap<>();
        result.put("fileId", fileId);
        result.put("fileName", fileName);
        result.put("filePath", finalFilePath);
        result.put("fileSize", chunks.get(0).getTotalSize());

        return Result.success("文件合并完成", result);
    }

    public Result<List<Map<String, Object>>> getFileList(String batchNo, String processCode) {
        LambdaQueryWrapper<FileChunk> wrapper = new LambdaQueryWrapper<>();
        if (batchNo != null && !batchNo.isEmpty()) {
            wrapper.eq(FileChunk::getBatchNo, batchNo);
        }
        if (processCode != null && !processCode.isEmpty()) {
            wrapper.eq(FileChunk::getProcessCode, processCode);
        }
        wrapper.groupBy(FileChunk::getFileId);
        wrapper.select(FileChunk::getFileId, FileChunk::getFileName, FileChunk::getBatchNo, FileChunk::getProcessCode, FileChunk::getCreateTime);
        wrapper.orderByDesc(FileChunk::getCreateTime);

        List<FileChunk> files = fileChunkMapper.selectList(wrapper);
        List<Map<String, Object>> result = files.stream().map(f -> {
            Map<String, Object> map = new HashMap<>();
            map.put("fileId", f.getFileId());
            map.put("fileName", f.getFileName());
            map.put("batchNo", f.getBatchNo());
            map.put("processCode", f.getProcessCode());
            map.put("createTime", f.getCreateTime());
            return map;
        }).collect(Collectors.toList());

        return Result.success(result);
    }
}
