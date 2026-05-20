package com.rubbing.service;

import com.rubbing.entity.rubbing.Rubbing;
import com.rubbing.repository.rubbing.RubbingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RubbingService {

    private final RubbingRepository rubbingRepository;

    @Value("${file.upload-path}")
    private String uploadPath;

    public Rubbing uploadRubbing(MultipartFile file, String name, String description, Long userId) throws IOException {
        Files.createDirectories(Paths.get(uploadPath));

        String originalFilename = file.getOriginalFilename();
        String extension = originalFilename.substring(originalFilename.lastIndexOf("."));
        String filename = UUID.randomUUID().toString() + extension;

        Path filePath = Paths.get(uploadPath, filename);
        file.transferTo(filePath.toFile());

        BufferedImage image = ImageIO.read(filePath.toFile());
        int width = image.getWidth();
        int height = image.getHeight();

        Rubbing rubbing = new Rubbing();
        rubbing.setName(name);
        rubbing.setDescription(description);
        rubbing.setImageUrl("/uploads/" + filename);
        rubbing.setThumbnailUrl("/uploads/" + filename);
        rubbing.setWidth(width);
        rubbing.setHeight(height);
        rubbing.setCreatedBy(userId);
        rubbing.setStatus(Rubbing.Status.UPLOADED);

        return rubbingRepository.save(rubbing);
    }

    public List<Rubbing> listRubbings(Long userId) {
        return rubbingRepository.findByCreatedByOrderByCreatedAtDesc(userId);
    }

    public Map<String, Object> listRubbingsWithPaging(int page, int size, Long userId) {
        List<Rubbing> all = listRubbings(userId);
        int start = page * size;
        int end = Math.min(start + size, all.size());
        List<Rubbing> content = all.subList(start, end);

        Map<String, Object> result = new HashMap<>();
        result.put("list", content);
        result.put("total", all.size());
        return result;
    }

    public Rubbing getRubbingById(Long id) {
        return rubbingRepository.findById(id).orElse(null);
    }

    public void deleteRubbing(Long id) {
        Rubbing rubbing = getRubbingById(id);
        if (rubbing != null && rubbing.getImageUrl() != null) {
            try {
                Path filePath = Paths.get(uploadPath, rubbing.getImageUrl().replace("/uploads/", ""));
                Files.deleteIfExists(filePath);
            } catch (IOException e) {
                e.printStackTrace();
            }
        }
        rubbingRepository.deleteById(id);
    }
}
