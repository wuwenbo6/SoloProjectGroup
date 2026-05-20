package com.ancient.book.image.controller;

import com.ancient.book.common.dto.PageUploadRequest;
import com.ancient.book.common.dto.RestorationResponse;
import com.ancient.book.image.service.ImageParserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/image")
@RequiredArgsConstructor
public class ImageParserController {

    private final ImageParserService imageParserService;

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<RestorationResponse> uploadAndParse(@Valid PageUploadRequest request) {
        log.info("接收到古籍图像上传请求: bookName={}, pageNumber={}", 
                request.getBookName(), request.getPageNumber());
        RestorationResponse response = imageParserService.parseAncientBookImage(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/damage/analyze")
    public ResponseEntity<Map<String, Object>> analyzeDamageAreas(@RequestBody Map<String, String> request) {
        String imagePath = request.get("imagePath");
        log.info("接收到残损区域分析请求: imagePath={}", imagePath);
        Map<String, Object> result = imageParserService.analyzeDamageAreas(imagePath);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/text/extract")
    public ResponseEntity<String> extractTextFromImage(@RequestBody Map<String, String> request) {
        String imagePath = request.get("imagePath");
        log.info("接收到文字提取请求: imagePath={}", imagePath);
        String extractedText = imageParserService.extractTextFromImage(imagePath);
        return ResponseEntity.ok(extractedText);
    }

    @GetMapping("/info")
    public ResponseEntity<Map<String, Object>> getImageInfo(@RequestParam String imagePath) {
        log.info("接收到图像信息查询请求: imagePath={}", imagePath);
        Map<String, Object> result = imageParserService.getImageInfo(imagePath);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/health")
    public ResponseEntity<String> healthCheck() {
        return ResponseEntity.ok("image-parser-service is running");
    }
}
