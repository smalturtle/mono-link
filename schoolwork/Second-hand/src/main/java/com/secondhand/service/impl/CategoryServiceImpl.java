package com.secondhand.service.impl;

import com.secondhand.entity.Category;
import com.secondhand.mapper.CategoryMapper;
import com.secondhand.mapper.ProductMapper;
import com.secondhand.service.CategoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CategoryServiceImpl implements CategoryService {

    private final CategoryMapper categoryMapper;
    private final ProductMapper productMapper;

    @Override
    public List<Category> list() {
        // 查询所有分类，组装为树形结构
        List<Category> allCategories = categoryMapper.selectList(null);
        // 找出顶级分类，递归构建子分类
        return allCategories.stream()
                .filter(c -> c.getParentId() == 0)
                .map(c -> buildTree(c, allCategories))
                .collect(Collectors.toList());
    }

    /** 递归构建分类树 */
    private Category buildTree(Category parent, List<Category> all) {
        List<Category> children = new ArrayList<>();
        for (Category c : all) {
            if (c.getParentId().equals(parent.getId())) {
                children.add(buildTree(c, all));
            }
        }
        parent.setChildren(children);
        return parent;
    }

    @Override
    public Category getById(Long id) {
        Category category = categoryMapper.selectById(id);
        if (category == null) {
            throw new RuntimeException("分类不存在");
        }
        return category;
    }

    @Override
    public void add(Category category) {
        categoryMapper.insert(category);
    }

    @Override
    public void update(Category category) {
        Category exist = categoryMapper.selectById(category.getId());
        if (exist == null) {
            throw new RuntimeException("分类不存在");
        }
        categoryMapper.updateById(category);
    }

    @Override
    public void delete(Long id) {
        Category category = categoryMapper.selectById(id);
        if (category == null) {
            throw new RuntimeException("分类不存在");
        }
        // 校验该分类下无关联商品
        int count = productMapper.countByCategoryId(id);
        if (count > 0) {
            throw new RuntimeException("该分类下存在 " + count + " 个商品，无法删除");
        }
        // 校验无子分类
        List<Category> all = categoryMapper.selectList(null);
        boolean hasChildren = all.stream().anyMatch(c -> c.getParentId().equals(id));
        if (hasChildren) {
            throw new RuntimeException("该分类下存在子分类，请先删除子分类");
        }
        categoryMapper.deleteById(id);
    }
}
