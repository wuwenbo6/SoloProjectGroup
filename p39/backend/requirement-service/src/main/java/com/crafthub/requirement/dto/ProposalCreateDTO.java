package com.crafthub.requirement.dto;

import jakarta.validation.constraints.*;
import lombok.Data;
import java.math.BigDecimal;
import java.util.List;

@Data
public class ProposalCreateDTO {

    @NotNull(message = "需求ID不能为空")
    private Long requirementId;

    @NotBlank(message = "方案标题不能为空")
    @Size(max = 200, message = "方案标题最多200字")
    private String title;

    @Size(max = 2000, message = "方案描述最多2000字")
    private String description;

    @NotNull(message = "报价不能为空")
    @DecimalMin(value = "0.01", message = "报价必须大于0")
    private BigDecimal price;

    @NotNull(message = "交付周期不能为空")
    @Min(value = 1, message = "交付周期至少1天")
    private Integer deliveryDays;

    @Size(max = 1000, message = "用材说明最多1000字")
    private String materialDesc;

    @Size(max = 1000, message = "工艺说明最多1000字")
    private String craftDesc;

    private List<AttachmentDTO> attachments;

    @Data
    public static class AttachmentDTO {
        private String fileName;
        private String fileUrl;
        private String fileType;
        private Long fileSize;
        private Integer sortOrder;
    }
}
