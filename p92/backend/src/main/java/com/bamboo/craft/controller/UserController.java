package com.bamboo.craft.controller;

import com.bamboo.craft.common.Result;
import com.bamboo.craft.entity.user.User;
import com.bamboo.craft.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/users")
public class UserController {

    @Autowired
    private UserService userService;

    @GetMapping("/{id}")
    public Result<User> getById(@PathVariable Long id) {
        User user = userService.getById(id);
        return Result.success(user);
    }

    @PutMapping("/{id}")
    public Result<Void> update(@PathVariable Long id, @RequestBody User user) {
        user.setId(id);
        boolean success = userService.update(user);
        return success ? Result.success() : Result.error("更新失败");
    }

    @GetMapping("/artisans")
    public Result<List<User>> listArtisans() {
        List<User> artisans = userService.listArtisans();
        return Result.success(artisans);
    }
}
