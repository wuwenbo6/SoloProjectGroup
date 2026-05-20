package com.dye.traceability.thirdparty.dto;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

@Data
@ApiModel("第三方检测报告同步参数")
public class ThirdPartyReportDTO {

    @ApiModelProperty("批次号")
    private String batchNo;

    @ApiModelProperty("检测机构")
    private String inspectionAgency;

    @ApiModelProperty("检测日期")
    private String inspectionDate;

    @ApiModelProperty("检测人员")
    private String inspector;

    @ApiModelProperty("色差")
    private Double colorDifference;

    @ApiModelProperty("水洗色牢度")
    private Double colorFastnessWashing;

    @ApiModelProperty("光照色牢度")
    private Double colorFastnessLight;

    @ApiModelProperty("摩擦色牢度")
    private Double colorFastnessRubbing;

    @ApiModelProperty("PH值")
    private Double phValue;

    @ApiModelProperty("甲醛含量")
    private Double formaldehydeContent;

    @ApiModelProperty("重金属")
    private String heavyMetals;

    @ApiModelProperty("检测结果")
    private String inspectionResult;

    @ApiModelProperty("报告URL")
    private String reportUrl;

    @ApiModelProperty("备注")
    private String remark;
}
