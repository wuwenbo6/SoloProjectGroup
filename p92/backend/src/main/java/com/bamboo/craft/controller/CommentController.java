package com.bamboo.craft.controller;

import com.bamboo.craft.common.Result;
import com.bamboo.craft.entity.interaction.Comment;
import com.bamboo.craft.service.CommentService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/interactions/crafts/{craftId}/comments")
public class CommentController {

    @Autowired
    private CommentService commentService;

    @GetMapping
    public Result<List<Comment>> list(@PathVariable Long craftId) {
        List<Comment> comments = commentService.listByCraftId(craftId);
        return Result.success(comments);
    }

    @PostMapping
    public Result<Void> save(@PathVariable Long craftId, @RequestBody Comment comment) {
        comment.setCraftId(craftId);
        boolean success = commentService.save(comment);
        return success ? Result.success() : Result.error("评论失败");
    }

    @PostMapping("/{id}/like")
    public Result<Void> like(@PathVariable Long craftId, @PathVariable Long id) {
        boolean success = commentService.like(id);
        return success ? Result.success() : Result.error("点赞失败");
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long craftId, @PathVariable Long id) {
        boolean success = commentService.delete(id);
        return success ? Result.success() : Result.error("删除失败");
    }
}
