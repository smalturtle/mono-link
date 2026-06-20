package com.secondhand.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.util.List;

/**
 * 分类实体类（支持树形结构）
 */
@Data
@TableName("category")
public class Category {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String name;
    /** 父分类ID，0表示顶级分类 */
    private Long parentId;
    /** 子分类列表（非数据库字段） */
    @TableField(exist = false)
    private List<Category> children;
}
