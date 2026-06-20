package com.secondhand.service;

import com.secondhand.entity.User;

import java.util.List;

public interface UserService {

    /** 用户注册 */
    User register(String username, String password, String phone);

    /** 用户登录，返回包含token的用户信息 */
    User login(String username, String password);

    /** 根据token获取用户 */
    User getByToken(String token);

    /** 根据ID获取用户 */
    User getById(Long id);

    /** 用户列表（管理员） */
    List<User> list();

    /** 更新用户信息（管理员） */
    void update(User user);

    /** 删除/禁用用户（管理员） */
    void delete(Long id);

    /** 修改个人信息（昵称、手机号、头像） */
    void updateProfile(Long userId, String nickname, String phone, String avatar);

    /** 修改密码 */
    void updatePassword(Long userId, String oldPassword, String newPassword);

    /** 批量更新用户状态（管理员） */
    void batchUpdateStatus(List<Long> ids, Integer status);

    /** 永久删除用户（管理员） */
    void deletePermanently(Long id);

    /** 批量永久删除用户（管理员） */
    void batchDelete(List<Long> ids);
}
