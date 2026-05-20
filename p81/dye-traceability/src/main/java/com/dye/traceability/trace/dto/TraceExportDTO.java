package com.dye.traceability.trace.dto;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@ApiModel("溯源数据导出参数")
public class TraceExportDTO {

    @ApiModelProperty("批次号列表")
    private List<String> batchNos;

    @ApiModelProperty("开始时间")
    private LocalDateTime startTime;

    @ApiModelProperty("结束时间")
    private LocalDateTime endTime;

    @ApiModelProperty("溯源类型：material-原料, process-工艺, all-全部")
    private String traceType;

    @ApiModelProperty("导出格式：excel-Excel, csv-CSV")
    private String exportFormat;
}
