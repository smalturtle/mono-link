package com.secondhand.service;

import com.secondhand.entity.Category;

import java.util.List;

public interface CategoryService {

    /** 获取分类树 */
    List<Category> list();

    /** 根据ID查询 */
    Category getById(Long id);

    /** 新增分类 */
    void add(Category category);

    /** 更新分类 */
    void update(Category category);

    /** 删除分类（需校验无关联商品） */
    void delete(Long id);
}
