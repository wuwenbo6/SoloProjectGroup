package com.ancient.book.database.service;

import com.ancient.book.common.entity.Permission;
import com.ancient.book.common.entity.Role;
import com.ancient.book.common.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import jakarta.annotation.PostConstruct;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class PermissionService {

    private final Map<Long, User> users = new ConcurrentHashMap<>();
    private final Map<Long, Role> roles = new ConcurrentHashMap<>();
    private final Map<Long, Permission> permissions = new ConcurrentHashMap<>();
    private final Map<String, Long> permissionCodeIndex = new ConcurrentHashMap<>();
    private final Map<String, Long> userTokenIndex = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        log.info("初始化权限管控服务...");
        initializePermissions();
        initializeRoles();
        initializeUsers();
        log.info("权限管控服务初始化完成: {} 权限, {} 角色, {} 用户",
                permissions.size(), roles.size(), users.size());
    }

    private void initializePermissions() {
        String[][] permissionData = {
                {"1", "仪表盘查看", "dashboard:view", "DASHBOARD", "/api/dashboard/**", "GET"},
                {"2", "数据源管理", "datasource:manage", "DATASOURCE", "/api/datasources/**", "*"},
                {"3", "数据源查看", "datasource:view", "DATASOURCE", "/api/datasources/**", "GET"},
                {"4", "数据源同步", "datasource:sync", "DATASOURCE", "/api/datasources/*/sync", "POST"},
                {"5", "图像查看", "image:view", "IMAGE", "/api/images/**", "GET"},
                {"6", "图像上传", "image:upload", "IMAGE", "/api/images/upload", "POST"},
                {"7", "图像编辑", "image:edit", "IMAGE", "/api/images/*", "PUT"},
                {"8", "图像删除", "image:delete", "IMAGE", "/api/images/*", "DELETE"},
                {"9", "修复操作", "restoration:operate", "RESTORATION", "/api/restoration/**", "*"},
                {"10", "修复查看", "restoration:view", "RESTORATION", "/api/restoration/**", "GET"},
                {"11", "修复审批", "restoration:approve", "RESTORATION", "/api/restoration/*/approve", "POST"},
                {"12", "文字识别", "ocr:process", "OCR", "/api/ocr/**", "*"},
                {"13", "异体字转换", "dialect:convert", "DIALECT", "/api/dialect/**", "*"},
                {"14", "语义匹配", "semantic:match", "SEMANTIC", "/api/semantic/**", "*"},
                {"15", "导出操作", "export:create", "EXPORT", "/api/export/**", "POST"},
                {"16", "导出下载", "export:download", "EXPORT", "/api/export/download/*", "GET"},
                {"17", "用户管理", "user:manage", "USER", "/api/users/**", "*"},
                {"18", "用户查看", "user:view", "USER", "/api/users/**", "GET"},
                {"19", "角色管理", "role:manage", "ROLE", "/api/roles/**", "*"},
                {"20", "权限管理", "permission:manage", "PERMISSION", "/api/permissions/**", "*"},
                {"21", "日志查看", "log:view", "AUDIT_LOG", "/api/logs/**", "GET"},
                {"22", "日志导出", "log:export", "AUDIT_LOG", "/api/logs/export", "POST"},
                {"23", "系统配置", "system:config", "SYSTEM", "/api/system/**", "*"},
                {"24", "进度查看", "progress:view", "PROGRESS", "/api/progress/**", "GET"},
                {"25", "进度管理", "progress:manage", "PROGRESS", "/api/progress/**", "*"},
        };

        for (String[] data : permissionData) {
            Permission p = new Permission();
            p.setId(Long.parseLong(data[0]));
            p.setPermissionName(data[1]);
            p.setPermissionCode(data[2]);
            p.setResourceType(data[3]);
            p.setResourcePath(data[4]);
            p.setAction(data[5]);
            p.setDescription(data[1] + "权限");
            p.setLevel(1);
            p.setSortOrder(Integer.parseInt(data[0]));
            p.setStatus("ACTIVE");
            p.setCreateTime(LocalDateTime.now());
            p.setUpdateTime(LocalDateTime.now());
            permissions.put(p.getId(), p);
            permissionCodeIndex.put(p.getPermissionCode(), p.getId());
        }
    }

    private void initializeRoles() {
        Role adminRole = new Role();
        adminRole.setId(1L);
        adminRole.setRoleName("系统管理员");
        adminRole.setRoleCode("ADMIN");
        adminRole.setDescription("拥有系统全部权限");
        adminRole.setPermissionCodes(new ArrayList<>(permissionCodeIndex.keySet()));
        adminRole.setSortOrder(1);
        adminRole.setStatus("ACTIVE");
        adminRole.setIsSystem(true);
        adminRole.setCreateTime(LocalDateTime.now());
        adminRole.setUpdateTime(LocalDateTime.now());
        roles.put(1L, adminRole);

        Role restorerRole = new Role();
        restorerRole.setId(2L);
        restorerRole.setRoleName("修复师");
        restorerRole.setRoleCode("RESTORER");
        restorerRole.setDescription("古籍修复专业人员");
        restorerRole.setPermissionCodes(Arrays.asList(
                "dashboard:view", "image:view", "image:upload", "image:edit",
                "restoration:view", "restoration:operate", "ocr:process",
                "dialect:convert", "semantic:match", "export:create", "export:download",
                "progress:view"
        ));
        restorerRole.setSortOrder(2);
        restorerRole.setStatus("ACTIVE");
        restorerRole.setIsSystem(true);
        restorerRole.setCreateTime(LocalDateTime.now());
        restorerRole.setUpdateTime(LocalDateTime.now());
        roles.put(2L, restorerRole);

        Role proofreaderRole = new Role();
        proofreaderRole.setId(3L);
        proofreaderRole.setRoleName("校对员");
        proofreaderRole.setRoleCode("PROOFREADER");
        proofreaderRole.setDescription("古籍文字校对人员");
        proofreaderRole.setPermissionCodes(Arrays.asList(
                "dashboard:view", "image:view", "restoration:view",
                "ocr:process", "dialect:convert", "semantic:match",
                "export:view", "progress:view"
        ));
        proofreaderRole.setSortOrder(3);
        proofreaderRole.setStatus("ACTIVE");
        proofreaderRole.setIsSystem(true);
        proofreaderRole.setCreateTime(LocalDateTime.now());
        proofreaderRole.setUpdateTime(LocalDateTime.now());
        roles.put(3L, proofreaderRole);

        Role reviewerRole = new Role();
        reviewerRole.setId(4L);
        reviewerRole.setRoleName("审核员");
        reviewerRole.setRoleCode("REVIEWER");
        reviewerRole.setDescription("修复成果审核人员");
        reviewerRole.setPermissionCodes(Arrays.asList(
                "dashboard:view", "image:view", "restoration:view",
                "restoration:approve", "export:download", "log:view",
                "progress:view"
        ));
        reviewerRole.setSortOrder(4);
        reviewerRole.setStatus("ACTIVE");
        reviewerRole.setIsSystem(true);
        reviewerRole.setCreateTime(LocalDateTime.now());
        reviewerRole.setUpdateTime(LocalDateTime.now());
        roles.put(4L, reviewerRole);

        Role guestRole = new Role();
        guestRole.setId(5L);
        guestRole.setRoleName("访客");
        guestRole.setRoleCode("GUEST");
        guestRole.setDescription("只读权限用户");
        guestRole.setPermissionCodes(Arrays.asList(
                "dashboard:view", "image:view", "restoration:view",
                "datasource:view", "progress:view"
        ));
        guestRole.setSortOrder(5);
        guestRole.setStatus("ACTIVE");
        guestRole.setIsSystem(true);
        guestRole.setCreateTime(LocalDateTime.now());
        guestRole.setUpdateTime(LocalDateTime.now());
        roles.put(5L, guestRole);
    }

    private void initializeUsers() {
        User admin = new User();
        admin.setId(1L);
        admin.setUsername("admin");
        admin.setPasswordHash("$2a$10$adminHash");
        admin.setEmail("admin@ancient-book.com");
        admin.setRealName("系统管理员");
        admin.setDepartment("技术部");
        admin.setTitle("高级工程师");
        admin.setStatus("ACTIVE");
        admin.setRoleIds(Arrays.asList(1L));
        admin.setIsActive(true);
        admin.setIsLocked(false);
        admin.setLoginCount(0);
        admin.setCreateTime(LocalDateTime.now());
        admin.setUpdateTime(LocalDateTime.now());
        users.put(1L, admin);

        User restorer1 = new User();
        restorer1.setId(2L);
        restorer1.setUsername("restorer_zhang");
        restorer1.setPasswordHash("$2a$10$restorerHash1");
        restorer1.setEmail("zhang@ancient-book.com");
        restorer1.setRealName("张修复");
        restorer1.setDepartment("修复部");
        restorer1.setTitle("高级修复师");
        restorer1.setStatus("ACTIVE");
        restorer1.setRoleIds(Arrays.asList(2L));
        restorer1.setIsActive(true);
        restorer1.setIsLocked(false);
        restorer1.setLoginCount(0);
        restorer1.setCreateTime(LocalDateTime.now());
        restorer1.setUpdateTime(LocalDateTime.now());
        users.put(2L, restorer1);

        User restorer2 = new User();
        restorer2.setId(3L);
        restorer2.setUsername("restorer_li");
        restorer2.setPasswordHash("$2a$10$restorerHash2");
        restorer2.setEmail("li@ancient-book.com");
        restorer2.setRealName("李修复");
        restorer2.setDepartment("修复部");
        restorer2.setTitle("中级修复师");
        restorer2.setStatus("ACTIVE");
        restorer2.setRoleIds(Arrays.asList(2L));
        restorer2.setIsActive(true);
        restorer2.setIsLocked(false);
        restorer2.setLoginCount(0);
        restorer2.setCreateTime(LocalDateTime.now());
        restorer2.setUpdateTime(LocalDateTime.now());
        users.put(3L, restorer2);

        User proofreader = new User();
        proofreader.setId(4L);
        proofreader.setUsername("proofreader_wang");
        proofreader.setPasswordHash("$2a$10$proofreaderHash");
        proofreader.setEmail("wang@ancient-book.com");
        proofreader.setRealName("王校对");
        proofreader.setDepartment("研究部");
        proofreader.setTitle("研究员");
        proofreader.setStatus("ACTIVE");
        proofreader.setRoleIds(Arrays.asList(3L));
        proofreader.setIsActive(true);
        proofreader.setIsLocked(false);
        proofreader.setLoginCount(0);
        proofreader.setCreateTime(LocalDateTime.now());
        proofreader.setUpdateTime(LocalDateTime.now());
        users.put(4L, proofreader);

        User reviewer = new User();
        reviewer.setId(5L);
        reviewer.setUsername("reviewer_zhao");
        reviewer.setPasswordHash("$2a$10$reviewerHash");
        reviewer.setEmail("zhao@ancient-book.com");
        reviewer.setRealName("赵审核");
        reviewer.setDepartment("审核部");
        reviewer.setTitle("主任审核员");
        reviewer.setStatus("ACTIVE");
        reviewer.setRoleIds(Arrays.asList(4L));
        reviewer.setIsActive(true);
        reviewer.setIsLocked(false);
        reviewer.setLoginCount(0);
        reviewer.setCreateTime(LocalDateTime.now());
        reviewer.setUpdateTime(LocalDateTime.now());
        users.put(5L, reviewer);
    }

    public User getUserById(Long id) {
        return users.get(id);
    }

    public User getUserByUsername(String username) {
        return users.values().stream()
                .filter(u -> u.getUsername().equals(username))
                .findFirst()
                .orElse(null);
    }

    public List<User> getAllUsers() {
        return new ArrayList<>(users.values());
    }

    public User createUser(User user) {
        Long newId = users.keySet().stream().max(Long::compareTo).orElse(0L) + 1;
        user.setId(newId);
        user.setCreateTime(LocalDateTime.now());
        user.setUpdateTime(LocalDateTime.now());
        user.setIsActive(true);
        user.setIsLocked(false);
        user.setLoginCount(0);
        users.put(newId, user);
        log.info("创建用户: {} - {}", user.getUsername(), user.getRealName());
        return user;
    }

    public User updateUser(Long id, User user) {
        User existing = users.get(id);
        if (existing != null) {
            user.setId(id);
            user.setUpdateTime(LocalDateTime.now());
            users.put(id, user);
            log.info("更新用户: {}", user.getUsername());
        }
        return user;
    }

    public boolean deleteUser(Long id) {
        User removed = users.remove(id);
        if (removed != null) {
            log.info("删除用户: {}", removed.getUsername());
            return true;
        }
        return false;
    }

    public Role getRoleById(Long id) {
        return roles.get(id);
    }

    public Role getRoleByCode(String roleCode) {
        return roles.values().stream()
                .filter(r -> r.getRoleCode().equals(roleCode))
                .findFirst()
                .orElse(null);
    }

    public List<Role> getAllRoles() {
        return roles.values().stream()
                .sorted(Comparator.comparing(Role::getSortOrder))
                .collect(Collectors.toList());
    }

    public Role createRole(Role role) {
        Long newId = roles.keySet().stream().max(Long::compareTo).orElse(0L) + 1;
        role.setId(newId);
        role.setCreateTime(LocalDateTime.now());
        role.setUpdateTime(LocalDateTime.now());
        role.setIsSystem(false);
        roles.put(newId, role);
        log.info("创建角色: {} - {}", role.getRoleCode(), role.getRoleName());
        return role;
    }

    public Role updateRole(Long id, Role role) {
        Role existing = roles.get(id);
        if (existing != null) {
            role.setId(id);
            role.setUpdateTime(LocalDateTime.now());
            roles.put(id, role);
            log.info("更新角色: {}", role.getRoleCode());
        }
        return role;
    }

    public boolean deleteRole(Long id) {
        Role role = roles.get(id);
        if (role != null && !role.getIsSystem()) {
            roles.remove(id);
            log.info("删除角色: {}", role.getRoleCode());
            return true;
        }
        return false;
    }

    public Permission getPermissionById(Long id) {
        return permissions.get(id);
    }

    public List<Permission> getAllPermissions() {
        return permissions.values().stream()
                .sorted(Comparator.comparing(Permission::getSortOrder))
                .collect(Collectors.toList());
    }

    public boolean hasPermission(Long userId, String permissionCode) {
        User user = users.get(userId);
        if (user == null || !user.getIsActive() || user.getIsLocked()) {
            return false;
        }

        if (user.getRoleIds() == null) {
            return false;
        }

        for (Long roleId : user.getRoleIds()) {
            Role role = roles.get(roleId);
            if (role != null && "ACTIVE".equals(role.getStatus())) {
                if (role.getPermissionCodes() != null &&
                        role.getPermissionCodes().contains(permissionCode)) {
                    return true;
                }
            }
        }

        return false;
    }

    public List<String> getUserPermissions(Long userId) {
        User user = users.get(userId);
        if (user == null || user.getRoleIds() == null) {
            return Collections.emptyList();
        }

        Set<String> userPermissions = new HashSet<>();
        for (Long roleId : user.getRoleIds()) {
            Role role = roles.get(roleId);
            if (role != null && role.getPermissionCodes() != null) {
                userPermissions.addAll(role.getPermissionCodes());
            }
        }

        return new ArrayList<>(userPermissions);
    }

    public Map<String, Object> checkAccess(Long userId, String resourcePath, String action) {
        Map<String, Object> result = new HashMap<>();

        User user = users.get(userId);
        if (user == null) {
            result.put("allowed", false);
            result.put("reason", "用户不存在");
            return result;
        }

        if (!user.getIsActive()) {
            result.put("allowed", false);
            result.put("reason", "用户未激活");
            return result;
        }

        if (user.getIsLocked()) {
            result.put("allowed", false);
            result.put("reason", "用户已被锁定");
            return result;
        }

        for (Long roleId : user.getRoleIds()) {
            Role role = roles.get(roleId);
            if (role != null && "ACTIVE".equals(role.getStatus())) {
                for (String permCode : role.getPermissionCodes()) {
                    Permission perm = permissions.get(permissionCodeIndex.get(permCode));
                    if (perm != null &&
                            pathMatches(resourcePath, perm.getResourcePath()) &&
                            actionMatches(action, perm.getAction())) {
                        result.put("allowed", true);
                        result.put("matchedPermission", permCode);
                        result.put("matchedRole", role.getRoleCode());
                        return result;
                    }
                }
            }
        }

        result.put("allowed", false);
        result.put("reason", "权限不足");
        return result;
    }

    private boolean pathMatches(String requestPath, String resourcePath) {
        if ("*".equals(resourcePath)) {
            return true;
        }
        String pattern = resourcePath.replace("**", ".*").replace("*", "[^/]*");
        return requestPath.matches(pattern);
    }

    private boolean actionMatches(String requestAction, String resourceAction) {
        return "*".equals(resourceAction) || requestAction.equalsIgnoreCase(resourceAction);
    }

    public Map<String, Object> getStatistics() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalUsers", users.size());
        stats.put("activeUsers", users.values().stream()
                .filter(u -> Boolean.TRUE.equals(u.getIsActive())).count());
        stats.put("lockedUsers", users.values().stream()
                .filter(u -> Boolean.TRUE.equals(u.getIsLocked())).count());
        stats.put("totalRoles", roles.size());
        stats.put("systemRoles", roles.values().stream()
                .filter(r -> Boolean.TRUE.equals(r.getIsSystem())).count());
        stats.put("totalPermissions", permissions.size());

        Map<String, Long> userByRole = new HashMap<>();
        for (Role role : roles.values()) {
            long count = users.values().stream()
                    .filter(u -> u.getRoleIds() != null && u.getRoleIds().contains(role.getId()))
                    .count();
            userByRole.put(role.getRoleCode(), count);
        }
        stats.put("userByRoleDistribution", userByRole);

        return stats;
    }

    public String generateToken(Long userId) {
        String token = "token_" + userId + "_" + System.currentTimeMillis() + "_" +
                UUID.randomUUID().toString().substring(0, 8);
        userTokenIndex.put(token, userId);
        return token;
    }

    public Long getUserIdByToken(String token) {
        return userTokenIndex.get(token);
    }

    public void invalidateToken(String token) {
        userTokenIndex.remove(token);
    }
}
