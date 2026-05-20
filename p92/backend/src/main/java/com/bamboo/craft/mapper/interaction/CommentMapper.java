package com.bamboo.craft.mapper.interaction;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.bamboo.craft.entity.interaction.Comment;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface CommentMapper extends BaseMapper<Comment> {
}
