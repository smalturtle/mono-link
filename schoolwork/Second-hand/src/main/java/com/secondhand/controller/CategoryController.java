package com.secondhand.controller;

import com.secondhand.common.Result;
import com.secondhand.entity.Category;
import com.secondhand.entity.User;
import com.secondhand.service.CategoryService;
import com.secondhand.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/category")
@RequiredArgsConstructor
public class CategoryController {

    private final CategoryService categoryService;
    private final UserService userService;

    /** 获取分类列表（树形结构） */
    @GetMapping("/list")
    public Result<List<Category>> list(@RequestHeader(value = "token", required = false) String token) {
        checkAdmin(token);
        return Result.success(categoryService.list());
    }

    /** 获取单个分类 */
    @GetMapping("/{id}")
    public Result<Category> getById(@RequestHeader(value = "token", required = false) String token,
                                    @PathVariable Long id) {
        checkAdmin(token);
        return Result.success(categoryService.getById(id));
    }

    /** 新增分类 */
    @PostMapping
    public Result<?> add(@RequestHeader(value = "token", required = false) String token,
                         @RequestBody Category category) {
        checkAdmin(token);
        categoryService.add(category);
        return Result.success("新增成功", null);
    }

    /** 更新分类 */
    @PutMapping("/{id}")
    public Result<?> update(@RequestHeader(value = "token", required = false) String token,
                            @PathVariable Long id,
                            @RequestBody Category category) {
        checkAdmin(token);
        category.setId(id);
        categoryService.update(category);
        return Result.success("更新成功", null);
    }

    /** 删除分类 */
    @DeleteMapping("/{id}")
    public Result<?> delete(@RequestHeader(value = "token", required = false) String token,
                            @PathVariable Long id) {
        checkAdmin(token);
        categoryService.delete(id);
        return Result.success("删除成功", null);
    }

    private void checkAdmin(String token) {
        User user = userService.getByToken(token);
        if (user == null || !"admin".equals(user.getRole())) {
            throw new RuntimeException("无管理员权限");
        }
    }
}
