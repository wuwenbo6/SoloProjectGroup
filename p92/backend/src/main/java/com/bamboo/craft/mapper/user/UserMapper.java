package com.bamboo.craft.mapper.user;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.bamboo.craft.entity.user.User;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface UserMapper extends BaseMapper<User> {
}
