package com.ancient.book.common.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import org.springframework.web.multipart.MultipartFile;

@Data
public class PageUploadRequest {

    @NotBlank(message = "古籍名称不能为空")
    private String bookName;

    @NotNull(message = "页码不能为空")
    private Integer pageNumber;

    @NotNull(message = "请上传古籍扫描图")
    private MultipartFile imageFile;

    private String damageAreas;

    private Long operatorId;
}
