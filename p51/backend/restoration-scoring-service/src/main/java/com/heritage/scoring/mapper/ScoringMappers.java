package com.heritage.scoring.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.heritage.scoring.entity.*;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface RestorationScoreMapper extends BaseMapper<RestorationScore> {
}

@Mapper
interface RestorationPlanMapper extends BaseMapper<RestorationPlan> {
}

@Mapper
interface ExpertReviewMapper extends BaseMapper<ExpertReview> {
}

@Mapper
interface ReviewWorkflowMapper extends BaseMapper<ReviewWorkflow> {
}