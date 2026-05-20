package com.bamboo.craft.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.bamboo.craft.entity.user.User;
import com.bamboo.craft.mapper.user.UserMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class UserService {

    @Autowired
    private UserMapper userMapper;

    public User getById(Long id) {
        return userMapper.selectById(id);
    }

    public boolean update(User user) {
        return userMapper.updateById(user) > 0;
    }

    public List<User> listArtisans() {
        LambdaQueryWrapper<User> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(User::getIsArtisan, 1);
        wrapper.eq(User::getStatus, 1);
        return userMapper.selectList(wrapper);
    }
}
