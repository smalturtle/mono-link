package com.secondhand.service.impl;

import com.secondhand.entity.User;
import com.secondhand.mapper.UserMapper;
import com.secondhand.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private final UserMapper userMapper;
    private final BCryptPasswordEncoder passwordEncoder;

    @Override
    public User register(String username, String password, String phone) {
        // 校验用户名唯一性
        User existUser = userMapper.selectByUsername(username);
        if (existUser != null) {
            throw new RuntimeException("用户名已存在");
        }
        // 密码加密存储
        User user = new User();
        user.setUsername(username);
        user.setPassword(passwordEncoder.encode(password));
        user.setPhone(phone);
        user.setRole("user");
        user.setStatus(1);
        user.setCreateTime(LocalDateTime.now());
        userMapper.insert(user);
        // 返回时清除密码字段
        user.setPassword(null);
        return user;
    }

    @Override
    public User login(String username, String password) {
        User user = userMapper.selectByUsername(username);
        if (user == null) {
            throw new RuntimeException("用户名或密码错误");
        }
        if (user.getStatus() == 0) {
            throw new RuntimeException("账号已被禁用");
        }
        // 密码比对
        if (!passwordEncoder.matches(password, user.getPassword())) {
            throw new RuntimeException("用户名或密码错误");
        }
        // 生成token并更新
        String token = UUID.randomUUID().toString().replace("-", "");
        user.setToken(token);
        userMapper.updateById(user);
        // 返回时清除密码
        user.setPassword(null);
        return user;
    }

    @Override
    public User getByToken(String token) {
        if (token == null || token.isEmpty()) {
            return null;
        }
        User user = userMapper.selectByToken(token);
        if (user != null) {
            user.setPassword(null);
        }
        return user;
    }

    @Override
    public User getById(Long id) {
        User user = userMapper.selectById(id);
        if (user != null) {
            user.setPassword(null);
        }
        return user;
    }

    @Override
    public List<User> list() {
        List<User> users = userMapper.selectList(null);
        users.forEach(u -> u.setPassword(null));
        return users;
    }

    @Override
    public void update(User user) {
        // 不允许通过此接口修改密码和角色
        user.setPassword(null);
        user.setToken(null);
        userMapper.updateById(user);
    }

    @Override
    public void delete(Long id) {
        User user = userMapper.selectById(id);
        if (user == null) {
            throw new RuntimeException("用户不存在");
        }
        if ("admin".equals(user.getRole())) {
            throw new RuntimeException("不能操作管理员账号");
        }
        // 切换启用/禁用状态
        user.setStatus(user.getStatus() == 1 ? 0 : 1);
        userMapper.updateById(user);
    }

    @Override
    public void updateProfile(Long userId, String nickname, String phone, String avatar) {
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new RuntimeException("用户不存在");
        }
        if (nickname != null) {
            user.setNickname(nickname);
        }
        if (phone != null) {
            user.setPhone(phone);
        }
        if (avatar != null) {
            user.setAvatar(avatar);
        }
        // 只更新这三个字段，不触碰 token/password 等
        userMapper.updateById(user);
    }

    @Override
    public void updatePassword(Long userId, String oldPassword, String newPassword) {
        if (newPassword == null || newPassword.length() < 6) {
            throw new RuntimeException("新密码长度不能少于6位");
        }
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new RuntimeException("用户不存在");
        }
        if (!passwordEncoder.matches(oldPassword, user.getPassword())) {
            throw new RuntimeException("原密码错误");
        }
        user.setPassword(passwordEncoder.encode(newPassword));
        userMapper.updateById(user);
    }

    @Override
    public void batchUpdateStatus(List<Long> ids, Integer status) {
        if (ids == null || ids.isEmpty()) {
            throw new RuntimeException("请选择用户");
        }
        if (status == null || (status != 0 && status != 1)) {
            throw new RuntimeException("无效的状态值");
        }
        for (Long id : ids) {
            User user = userMapper.selectById(id);
            if (user == null || "admin".equals(user.getRole())) {
                continue; // 跳过不存在的或管理员账号
            }
            user.setStatus(status);
            userMapper.updateById(user);
        }
    }

    @Override
    public void deletePermanently(Long id) {
        User user = userMapper.selectById(id);
        if (user == null) {
            throw new RuntimeException("用户不存在");
        }
        if ("admin".equals(user.getRole())) {
            throw new RuntimeException("不能删除管理员账号");
        }
        userMapper.deleteById(id);
    }

    @Override
    public void batchDelete(List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            throw new RuntimeException("请选择用户");
        }
        for (Long id : ids) {
            User user = userMapper.selectById(id);
            if (user == null || "admin".equals(user.getRole())) {
                continue; // 跳过不存在的或管理员账号
            }
            userMapper.deleteById(id);
        }
    }
}
