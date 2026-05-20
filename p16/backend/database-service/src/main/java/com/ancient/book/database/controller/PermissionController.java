package com.ancient.book.database.controller;

import com.ancient.book.common.entity.Permission;
import com.ancient.book.common.entity.Role;
import com.ancient.book.common.entity.User;
import com.ancient.book.database.service.PermissionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequiredArgsConstructor
public class PermissionController {

    private final PermissionService permissionService;

    @GetMapping("/api/users")
    public ResponseEntity<List<User>> getAllUsers() {
        log.info("获取所有用户列表");
        return ResponseEntity.ok(permissionService.getAllUsers());
    }

    @GetMapping("/api/users/{id}")
    public ResponseEntity<User> getUserById(@PathVariable Long id) {
        log.info("获取用户详情: {}", id);
        User user = permissionService.getUserById(id);
        return ResponseEntity.ok(user);
    }

    @PostMapping("/api/users")
    public ResponseEntity<User> createUser(@RequestBody User user) {
        log.info("创建用户: {}", user.getUsername());
        User created = permissionService.createUser(user);
        return ResponseEntity.ok(created);
    }

    @PutMapping("/api/users/{id}")
    public ResponseEntity<User> updateUser(@PathVariable Long id, @RequestBody User user) {
        log.info("更新用户: {}", id);
        User updated = permissionService.updateUser(id, user);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/api/users/{id}")
    public ResponseEntity<Map<String, Object>> deleteUser(@PathVariable Long id) {
        log.info("删除用户: {}", id);
        boolean success = permissionService.deleteUser(id);
        return ResponseEntity.ok(Map.of(
                "success", success,
                "message", success ? "删除成功" : "用户不存在"
        ));
    }

    @GetMapping("/api/users/{id}/permissions")
    public ResponseEntity<List<String>> getUserPermissions(@PathVariable Long id) {
        log.info("获取用户权限列表: {}", id);
        List<String> permissions = permissionService.getUserPermissions(id);
        return ResponseEntity.ok(permissions);
    }

    @GetMapping("/api/users/{id}/has-permission/{permissionCode}")
    public ResponseEntity<Map<String, Object>> hasPermission(@PathVariable Long id,
                                                              @PathVariable String permissionCode) {
        log.info("检查用户权限: {} - {}", id, permissionCode);
        boolean hasPermission = permissionService.hasPermission(id, permissionCode);
        return ResponseEntity.ok(Map.of(
                "userId", id,
                "permissionCode", permissionCode,
                "hasPermission", hasPermission
        ));
    }

    @GetMapping("/api/roles")
    public ResponseEntity<List<Role>> getAllRoles() {
        log.info("获取所有角色列表");
        return ResponseEntity.ok(permissionService.getAllRoles());
    }

    @GetMapping("/api/roles/{id}")
    public ResponseEntity<Role> getRoleById(@PathVariable Long id) {
        log.info("获取角色详情: {}", id);
        Role role = permissionService.getRoleById(id);
        return ResponseEntity.ok(role);
    }

    @PostMapping("/api/roles")
    public ResponseEntity<Role> createRole(@RequestBody Role role) {
        log.info("创建角色: {}", role.getRoleCode());
        Role created = permissionService.createRole(role);
        return ResponseEntity.ok(created);
    }

    @PutMapping("/api/roles/{id}")
    public ResponseEntity<Role> updateRole(@PathVariable Long id, @RequestBody Role role) {
        log.info("更新角色: {}", id);
        Role updated = permissionService.updateRole(id, role);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/api/roles/{id}")
    public ResponseEntity<Map<String, Object>> deleteRole(@PathVariable Long id) {
        log.info("删除角色: {}", id);
        boolean success = permissionService.deleteRole(id);
        return ResponseEntity.ok(Map.of(
                "success", success,
                "message", success ? "删除成功" : "角色不存在或为系统角色，无法删除"
        ));
    }

    @GetMapping("/api/permissions")
    public ResponseEntity<List<Permission>> getAllPermissions() {
        log.info("获取所有权限列表");
        return ResponseEntity.ok(permissionService.getAllPermissions());
    }

    @GetMapping("/api/permissions/{id}")
    public ResponseEntity<Permission> getPermissionById(@PathVariable Long id) {
        log.info("获取权限详情: {}", id);
        Permission permission = permissionService.getPermissionById(id);
        return ResponseEntity.ok(permission);
    }

    @PostMapping("/api/auth/check-access")
    public ResponseEntity<Map<String, Object>> checkAccess(@RequestBody Map<String, String> request) {
        Long userId = Long.parseLong(request.get("userId"));
        String resourcePath = request.get("resourcePath");
        String action = request.get("action");

        log.info("检查访问权限: 用户={}, 资源={}, 操作={}", userId, resourcePath, action);
        Map<String, Object> result = permissionService.checkAccess(userId, resourcePath, action);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/api/auth/token")
    public ResponseEntity<Map<String, Object>> generateToken(@RequestBody Map<String, Long> request) {
        Long userId = request.get("userId");
        log.info("生成用户Token: {}", userId);
        String token = permissionService.generateToken(userId);
        return ResponseEntity.ok(Map.of(
                "userId", userId,
                "token", token,
                "expiresIn", 86400
        ));
    }

    @PostMapping("/api/auth/logout")
    public ResponseEntity<Map<String, Object>> logout(@RequestBody Map<String, String> request) {
        String token = request.get("token");
        log.info("用户登出，销毁Token");
        permissionService.invalidateToken(token);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "登出成功"
        ));
    }

    @GetMapping("/api/auth/statistics")
    public ResponseEntity<Map<String, Object>> getStatistics() {
        log.info("获取权限系统统计信息");
        Map<String, Object> stats = permissionService.getStatistics();
        return ResponseEntity.ok(stats);
    }
}
