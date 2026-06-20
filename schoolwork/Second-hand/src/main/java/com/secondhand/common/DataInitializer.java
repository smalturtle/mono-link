package com.secondhand.common;

import com.secondhand.entity.Category;
import com.secondhand.entity.User;
import com.secondhand.mapper.CategoryMapper;
import com.secondhand.mapper.UserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 数据初始化器：启动时检查并创建默认管理员账号和示例分类
 */
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserMapper userMapper;
    private final CategoryMapper categoryMapper;
    private final BCryptPasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        // 初始化管理员账号
        User admin = userMapper.selectByUsername("admin");
        if (admin == null) {
            User user = new User();
            user.setUsername("admin");
            user.setPassword(passwordEncoder.encode("admin123"));
            user.setPhone("13800000000");
            user.setRole("admin");
            user.setStatus(1);
            user.setCreateTime(LocalDateTime.now());
            userMapper.insert(user);
            System.out.println(">>> 默认管理员账号已创建: admin / admin123");
        }

        // 初始化示例分类数据
        List<Category> categories = categoryMapper.selectList(null);
        if (categories == null || categories.isEmpty()) {
            insertCategory(1L, "电子产品", 0L);
            insertCategory(2L, "手机", 1L);
            insertCategory(3L, "电脑", 1L);
            insertCategory(4L, "图书教材", 0L);
            insertCategory(5L, "教材", 4L);
            insertCategory(6L, "课外书", 4L);
            insertCategory(7L, "生活用品", 0L);
            insertCategory(8L, "服饰", 7L);
            insertCategory(9L, "家具", 7L);
            System.out.println(">>> 示例分类数据已初始化");
        }
    }

    private void insertCategory(Long id, String name, Long parentId) {
        Category category = new Category();
        category.setId(id);
        category.setName(name);
        category.setParentId(parentId);
        categoryMapper.insert(category);
    }
}
