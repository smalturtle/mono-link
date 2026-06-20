package com.secondhand.service;

import com.secondhand.entity.User;
import com.secondhand.mapper.UserMapper;
import com.secondhand.service.impl.UserServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * UserService 单元测试
 * 覆盖: 正常值 / 边界值 / 异常输入 / 空值 / Mock依赖
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("用户服务单元测试")
class UserServiceTest {

    @Mock
    private UserMapper userMapper;

    @Mock
    private BCryptPasswordEncoder passwordEncoder;

    @InjectMocks
    private UserServiceImpl userService;

    private User mockUser;

    @BeforeEach
    void setUp() {
        mockUser = new User();
        mockUser.setId(1L);
        mockUser.setUsername("testuser");
        mockUser.setPassword("$2a$10$encodedPassword");
        mockUser.setPhone("13800138000");
        mockUser.setRole("user");
        mockUser.setStatus(1);
        mockUser.setCreateTime(LocalDateTime.now());
    }

    // ==================== 注册测试 ====================

    @Nested
    @DisplayName("用户注册")
    class RegisterTests {

        @Test
        @DisplayName("TC-USER-001: 正常注册 - 新用户名、合法密码、合法手机号")
        void shouldRegisterSuccessfully() {
            when(userMapper.selectByUsername("newuser")).thenReturn(null);
            when(passwordEncoder.encode("password123")).thenReturn("$2a$10$encoded");
            when(userMapper.insert(any(User.class))).thenReturn(1);

            User result = userService.register("newuser", "password123", "13800138000");

            assertNotNull(result);
            assertEquals("newuser", result.getUsername());
            assertNull(result.getPassword()); // 返回时密码已清除
            verify(userMapper).insert(any(User.class));
        }

        @Test
        @DisplayName("TC-USER-002: 异常输入 - 用户名已存在，应抛出异常")
        void shouldThrowWhenUsernameExists() {
            when(userMapper.selectByUsername("testuser")).thenReturn(mockUser);

            RuntimeException ex = assertThrows(RuntimeException.class, () ->
                    userService.register("testuser", "password123", "13800138000"));

            assertEquals("用户名已存在", ex.getMessage());
            verify(userMapper, never()).insert(any(User.class));
        }

        @Test
        @DisplayName("TC-USER-003: 边界值 - 空密码注册")
        void shouldHandleEmptyPassword() {
            when(userMapper.selectByUsername("newuser")).thenReturn(null);
            when(passwordEncoder.encode("")).thenReturn("$2a$10$encodedEmpty");
            when(userMapper.insert(any(User.class))).thenReturn(1);

            User result = userService.register("newuser", "", "13800138000");

            assertNotNull(result);
            verify(userMapper).insert(any(User.class));
        }

        @Test
        @DisplayName("TC-USER-004: 边界值 - 超长用户名注册")
        void shouldHandleLongUsername() {
            String longUsername = "a".repeat(100);
            when(userMapper.selectByUsername(longUsername)).thenReturn(null);
            when(passwordEncoder.encode(anyString())).thenReturn("$2a$10$encoded");
            when(userMapper.insert(any(User.class))).thenReturn(1);

            User result = userService.register(longUsername, "password123", "13800138000");

            assertNotNull(result);
            assertEquals(longUsername, result.getUsername());
        }

        @Test
        @DisplayName("TC-USER-005: 空值 - 空手机号注册")
        void shouldHandleNullPhone() {
            when(userMapper.selectByUsername("newuser")).thenReturn(null);
            when(passwordEncoder.encode(anyString())).thenReturn("$2a$10$encoded");
            when(userMapper.insert(any(User.class))).thenReturn(1);

            User result = userService.register("newuser", "password123", null);

            assertNotNull(result);
            assertNull(result.getPhone());
        }
    }

    // ==================== 登录测试 ====================

    @Nested
    @DisplayName("用户登录")
    class LoginTests {

        @Test
        @DisplayName("TC-USER-006: 正常登录 - 正确用户名和密码")
        void shouldLoginSuccessfully() {
            when(userMapper.selectByUsername("testuser")).thenReturn(mockUser);
            when(passwordEncoder.matches("password123", mockUser.getPassword())).thenReturn(true);
            when(userMapper.updateById(any(User.class))).thenReturn(1);

            User result = userService.login("testuser", "password123");

            assertNotNull(result);
            assertEquals("testuser", result.getUsername());
            assertNotNull(result.getToken());
            assertNull(result.getPassword());
        }

        @Test
        @DisplayName("TC-USER-007: 异常输入 - 用户不存在")
        void shouldThrowWhenUserNotFound() {
            when(userMapper.selectByUsername("nobody")).thenReturn(null);

            RuntimeException ex = assertThrows(RuntimeException.class, () ->
                    userService.login("nobody", "password123"));

            assertEquals("用户名或密码错误", ex.getMessage());
        }

        @Test
        @DisplayName("TC-USER-008: 异常输入 - 密码错误")
        void shouldThrowWhenPasswordWrong() {
            when(userMapper.selectByUsername("testuser")).thenReturn(mockUser);
            when(passwordEncoder.matches("wrongpass", mockUser.getPassword())).thenReturn(false);

            RuntimeException ex = assertThrows(RuntimeException.class, () ->
                    userService.login("testuser", "wrongpass"));

            assertEquals("用户名或密码错误", ex.getMessage());
        }

        @Test
        @DisplayName("TC-USER-009: 异常输入 - 账号已被禁用")
        void shouldThrowWhenAccountDisabled() {
            mockUser.setStatus(0);
            when(userMapper.selectByUsername("testuser")).thenReturn(mockUser);

            RuntimeException ex = assertThrows(RuntimeException.class, () ->
                    userService.login("testuser", "password123"));

            assertEquals("账号已被禁用", ex.getMessage());
        }

        @Test
        @DisplayName("TC-USER-010: 边界值 - 空密码登录")
        void shouldThrowWhenEmptyPassword() {
            when(userMapper.selectByUsername("testuser")).thenReturn(mockUser);
            when(passwordEncoder.matches("", mockUser.getPassword())).thenReturn(false);

            RuntimeException ex = assertThrows(RuntimeException.class, () ->
                    userService.login("testuser", ""));

            assertEquals("用户名或密码错误", ex.getMessage());
        }

        @Test
        @DisplayName("TC-USER-011: 空值 - 空用户名登录")
        void shouldThrowWhenNullUsername() {
            when(userMapper.selectByUsername(null)).thenReturn(null);

            RuntimeException ex = assertThrows(RuntimeException.class, () ->
                    userService.login(null, "password123"));

            assertEquals("用户名或密码错误", ex.getMessage());
        }
    }

    // ==================== Token验证测试 ====================

    @Nested
    @DisplayName("Token验证")
    class TokenTests {

        @Test
        @DisplayName("TC-USER-012: 正常获取 - 有效token获取用户")
        void shouldGetUserByValidToken() {
            when(userMapper.selectByToken("valid-token")).thenReturn(mockUser);

            User result = userService.getByToken("valid-token");

            assertNotNull(result);
            assertNull(result.getPassword());
        }

        @Test
        @DisplayName("TC-USER-013: 空值 - token为null返回null")
        void shouldReturnNullForNullToken() {
            User result = userService.getByToken(null);

            assertNull(result);
            verify(userMapper, never()).selectByToken(anyString());
        }

        @Test
        @DisplayName("TC-USER-014: 空值 - token为空字符串返回null")
        void shouldReturnNullForEmptyToken() {
            User result = userService.getByToken("");

            assertNull(result);
        }
    }

    // ==================== 修改密码测试 ====================

    @Nested
    @DisplayName("修改密码")
    class UpdatePasswordTests {

        @Test
        @DisplayName("TC-USER-015: 正常修改密码")
        void shouldUpdatePasswordSuccessfully() {
            when(userMapper.selectById(1L)).thenReturn(mockUser);
            when(passwordEncoder.matches("oldPass", mockUser.getPassword())).thenReturn(true);
            when(passwordEncoder.encode("newPass")).thenReturn("$2a$10$newEncoded");
            when(userMapper.updateById(any(User.class))).thenReturn(1);

            assertDoesNotThrow(() ->
                    userService.updatePassword(1L, "oldPass", "newPass"));
        }

        @Test
        @DisplayName("TC-USER-016: 边界值 - 新密码长度不足6位")
        void shouldThrowWhenNewPasswordTooShort() {
            RuntimeException ex = assertThrows(RuntimeException.class, () ->
                    userService.updatePassword(1L, "oldPass", "12345"));

            assertEquals("新密码长度不能少于6位", ex.getMessage());
        }

        @Test
        @DisplayName("TC-USER-017: 异常输入 - 原密码错误")
        void shouldThrowWhenOldPasswordWrong() {
            when(userMapper.selectById(1L)).thenReturn(mockUser);
            when(passwordEncoder.matches("wrongOld", mockUser.getPassword())).thenReturn(false);

            RuntimeException ex = assertThrows(RuntimeException.class, () ->
                    userService.updatePassword(1L, "wrongOld", "newPass"));

            assertEquals("原密码错误", ex.getMessage());
        }

        @Test
        @DisplayName("TC-USER-018: 空值 - 新密码为null")
        void shouldThrowWhenNewPasswordNull() {
            RuntimeException ex = assertThrows(RuntimeException.class, () ->
                    userService.updatePassword(1L, "oldPass", null));

            assertEquals("新密码长度不能少于6位", ex.getMessage());
        }
    }

    // ==================== 用户删除/禁用测试 ====================

    @Nested
    @DisplayName("用户禁用/启用")
    class DeleteTests {

        @Test
        @DisplayName("TC-USER-019: 正常切换 - 启用状态切换为禁用")
        void shouldToggleStatusFromEnabledToDisabled() {
            mockUser.setStatus(1);
            when(userMapper.selectById(1L)).thenReturn(mockUser);
            when(userMapper.updateById(any(User.class))).thenReturn(1);

            assertDoesNotThrow(() -> userService.delete(1L));

            verify(userMapper).updateById(argThat(u -> u.getStatus() == 0));
        }

        @Test
        @DisplayName("TC-USER-020: 正常切换 - 禁用状态切换为启用")
        void shouldToggleStatusFromDisabledToEnabled() {
            mockUser.setStatus(0);
            when(userMapper.selectById(1L)).thenReturn(mockUser);
            when(userMapper.updateById(any(User.class))).thenReturn(1);

            assertDoesNotThrow(() -> userService.delete(1L));

            verify(userMapper).updateById(argThat(u -> u.getStatus() == 1));
        }

        @Test
        @DisplayName("TC-USER-021: 异常输入 - 用户不存在")
        void shouldThrowWhenUserNotFound() {
            when(userMapper.selectById(999L)).thenReturn(null);

            RuntimeException ex = assertThrows(RuntimeException.class, () ->
                    userService.delete(999L));

            assertEquals("用户不存在", ex.getMessage());
        }

        @Test
        @DisplayName("TC-USER-022: 异常输入 - 不能操作管理员账号")
        void shouldThrowWhenDeletingAdmin() {
            mockUser.setRole("admin");
            when(userMapper.selectById(1L)).thenReturn(mockUser);

            RuntimeException ex = assertThrows(RuntimeException.class, () ->
                    userService.delete(1L));

            assertEquals("不能操作管理员账号", ex.getMessage());
        }
    }
}
