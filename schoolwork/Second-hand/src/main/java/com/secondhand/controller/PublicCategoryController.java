package com.secondhand.controller;

import com.secondhand.common.Result;
import com.secondhand.entity.Category;
import com.secondhand.service.CategoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 前台公开的分类接口
 */
@RestController
@RequiredArgsConstructor
public class PublicCategoryController {

    private final CategoryService categoryService;

    /** 获取分类列表（树形结构） */
    @GetMapping("/api/category/list")
    public Result<List<Category>> list() {
        return Result.success(categoryService.list());
    }
}
