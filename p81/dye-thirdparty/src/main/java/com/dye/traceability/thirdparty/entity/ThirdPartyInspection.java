package com.dye.traceability.thirdparty.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.dye.traceability.common.core.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("third_party_inspection")
public class ThirdPartyInspection extends BaseEntity {

    private static final long serialVersionUID = 1L;

    @TableField("report_no")
    private String reportNo;

    @TableField("batch_no")
    private String batchNo;

    @TableField("inspection_agency")
    private String inspectionAgency;

    @TableField("inspection_date")
    private String inspectionDate;

    @TableField("inspector")
    private String inspector;

    @TableField("color_difference")
    private BigDecimal colorDifference;

    @TableField("color_fastness_washing")
    private BigDecimal colorFastnessWashing;

    @TableField("color_fastness_light")
    private BigDecimal colorFastnessLight;

    @TableField("color_fastness_rubbing")
    private BigDecimal colorFastnessRubbing;

    @TableField("ph_value")
    private BigDecimal phValue;

    @TableField("formaldehyde_content")
    private BigDecimal formaldehydeContent;

    @TableField("heavy_metals")
    private String heavyMetals;

    @TableField("inspection_result")
    private String inspectionResult;

    @TableField("report_url")
    private String reportUrl;

    @TableField("sync_status")
    private String syncStatus;

    @TableField("remark")
    private String remark;
}
