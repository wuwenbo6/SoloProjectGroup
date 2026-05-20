package com.bamboo.craft.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.bamboo.craft.controller.WebSocketController;
import com.bamboo.craft.entity.interaction.Comment;
import com.bamboo.craft.mapper.interaction.CommentMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CommentService {

    @Autowired
    private CommentMapper commentMapper;

    @Autowired(required = false)
    private WebSocketController webSocketController;

    public List<Comment> listByCraftId(Long craftId) {
        LambdaQueryWrapper<Comment> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Comment::getCraftId, craftId);
        wrapper.orderByDesc(Comment::getCreateTime);
        return commentMapper.selectList(wrapper);
    }

    public boolean save(Comment comment) {
        boolean success = commentMapper.insert(comment) > 0;
        if (success && webSocketController != null) {
            try {
                webSocketController.broadcastNewComment(comment.getCraftId(), comment);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
        return success;
    }

    public boolean like(Long id) {
        Comment comment = commentMapper.selectById(id);
        if (comment != null) {
            comment.setLikes(comment.getLikes() + 1);
            return commentMapper.updateById(comment) > 0;
        }
        return false;
    }

    public boolean delete(Long id) {
        return commentMapper.deleteById(id) > 0;
    }
}
