package com.secondhand.controller;

import com.secondhand.common.Result;
import com.secondhand.entity.User;
import com.secondhand.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    // ==================== 前台用户端 ====================

    /** 用户注册 */
    @PostMapping("/api/user/register")
    public Result<User> register(@RequestBody Map<String, String> body) {
        String username = body.get("username");
        String password = body.get("password");
        String phone = body.get("phone");
        if (username == null || username.isEmpty() || password == null || password.isEmpty()) {
            return Result.error("用户名和密码不能为空");
        }
        User user = userService.register(username, password, phone);
        return Result.success("注册成功", user);
    }

    /** 用户登录 */
    @PostMapping("/api/user/login")
    public Result<User> login(@RequestBody Map<String, String> body) {
        String username = body.get("username");
        String password = body.get("password");
        if (username == null || username.isEmpty() || password == null || password.isEmpty()) {
            return Result.error("用户名和密码不能为空");
        }
        User user = userService.login(username, password);
        return Result.success("登录成功", user);
    }

    /** 获取当前登录用户信息 */
    @GetMapping("/api/user/me")
    public Result<User> me(@RequestHeader(value = "token", required = false) String token) {
        if (token == null || token.isEmpty()) {
            return Result.error("未登录");
        }
        User user = userService.getByToken(token);
        if (user == null) {
            return Result.error("登录已过期");
        }
        return Result.success(user);
    }

    /** 修改个人信息（昵称、手机号、头像） */
    @PutMapping("/api/user/profile")
    public Result<?> updateProfile(@RequestHeader(value = "token", required = false) String token,
                                    @RequestBody Map<String, String> body) {
        User user = getLoginUser(token);
        userService.updateProfile(user.getId(),
                body.get("nickname"),
                body.get("phone"),
                body.get("avatar"));
        return Result.success("保存成功");
    }

    /** 修改密码 */
    @PutMapping("/api/user/password")
    public Result<?> updatePassword(@RequestHeader(value = "token", required = false) String token,
                                     @RequestBody Map<String, String> body) {
        User user = getLoginUser(token);
        userService.updatePassword(user.getId(),
                body.get("oldPassword"),
                body.get("newPassword"));
        return Result.success("密码修改成功");
    }

    // ==================== 后台管理系统 ====================

    /** 获取用户列表 */
    @GetMapping("/api/admin/user/list")
    public Result<List<User>> list(@RequestHeader(value = "token", required = false) String token) {
        checkAdmin(token);
        return Result.success(userService.list());
    }

    /** 获取单个用户 */
    @GetMapping("/api/admin/user/{id}")
    public Result<User> getById(@RequestHeader(value = "token", required = false) String token,
                                @PathVariable Long id) {
        checkAdmin(token);
        return Result.success(userService.getById(id));
    }

    /** 更新用户信息 */
    @PutMapping("/api/admin/user/{id}")
    public Result<?> update(@RequestHeader(value = "token", required = false) String token,
                            @PathVariable Long id,
                            @RequestBody User user) {
        checkAdmin(token);
        user.setId(id);
        userService.update(user);
        return Result.success("更新成功", null);
    }

    /** 删除/禁用用户 */
    @DeleteMapping("/api/admin/user/{id}")
    public Result<?> delete(@RequestHeader(value = "token", required = false) String token,
                            @PathVariable Long id) {
        checkAdmin(token);
        userService.delete(id);
        return Result.success("操作成功", null);
    }

    /** 批量更新用户状态（启用/禁用） */
    @PutMapping("/api/admin/user/batch/status")
    public Result<?> batchUpdateStatus(@RequestHeader(value = "token", required = false) String token,
                                        @RequestBody Map<String, Object> body) {
        checkAdmin(token);
        @SuppressWarnings("unchecked")
        List<Long> ids = ((List<Integer>) body.get("ids")).stream().map(Long::valueOf).toList();
        Integer status = Integer.valueOf(body.get("status").toString());
        userService.batchUpdateStatus(ids, status);
        return Result.success("批量操作成功", null);
    }

    /** 永久删除用户 */
    @DeleteMapping("/api/admin/user/{id}/permanent")
    public Result<?> deletePermanently(@RequestHeader(value = "token", required = false) String token,
                                        @PathVariable Long id) {
        checkAdmin(token);
        userService.deletePermanently(id);
        return Result.success("用户已删除", null);
    }

    /** 批量永久删除用户 */
    @DeleteMapping("/api/admin/user/batch")
    public Result<?> batchDelete(@RequestHeader(value = "token", required = false) String token,
                                  @RequestBody Map<String, Object> body) {
        checkAdmin(token);
        @SuppressWarnings("unchecked")
        List<Long> ids = ((List<Integer>) body.get("ids")).stream().map(Long::valueOf).toList();
        userService.batchDelete(ids);
        return Result.success("批量删除成功", null);
    }

    /** 校验管理员权限 */
    private void checkAdmin(String token) {
        User user = userService.getByToken(token);
        if (user == null || !"admin".equals(user.getRole())) {
            throw new RuntimeException("无管理员权限");
        }
    }

    /** 获取当前登录用户 */
    private User getLoginUser(String token) {
        if (token == null || token.isEmpty()) {
            throw new RuntimeException("未登录");
        }
        User user = userService.getByToken(token);
        if (user == null) {
            throw new RuntimeException("登录已过期");
        }
        return user;
    }
}
