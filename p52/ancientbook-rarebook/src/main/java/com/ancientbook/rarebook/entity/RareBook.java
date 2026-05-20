package com.ancientbook.rarebook.entity;

import com.ancientbook.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

@Data
@EqualsAndHashCode(callSuper = true)
public class RareBook extends BaseEntity {

    @NotBlank(message = "善本编号不能为空")
    private String bookCode;

    @NotBlank(message = "善本名称不能为空")
    private String bookName;

    private String author;

    private String dynasty;

    private String publicationYear;

    private String edition;

    private String material;

    private Integer pageCount;

    private String dimensions;

    @NotNull(message = "破损等级不能为空")
    private Integer conditionLevel;

    private String conditionDesc;

    private String location;

    private Integer status;

    private String remark;
}
