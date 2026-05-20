package com.dye.traceability.quality.dto;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import java.math.BigDecimal;

@Data
@ApiModel("品质检测请求参数")
public class QualityInspectionDTO {

    @ApiModelProperty("批次号")
    private String batchNo;

    @ApiModelProperty("配方号")
    private String formulaNo;

    @ApiModelProperty("检测人员")
    private String inspector;

    @ApiModelProperty("检测类型")
    private String inspectionType;

    @ApiModelProperty("色差")
    private Double colorDifference;

    @ApiModelProperty("色牢度")
    private Double colorFastness;

    @ApiModelProperty("PH值")
    private Double phValue;

    @ApiModelProperty("固含量")
    private Double solidContent;

    @ApiModelProperty("外观描述")
    private String appearance;

    @ApiModelProperty("检测结果")
    private String inspectionResult;

    @ApiModelProperty("备注")
    private String remark;
}
