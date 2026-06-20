package com.secondhand.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 商品实体类
 */
@Data
@TableName("product")
public class Product {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @TableId(type = IdType.AUTO)
    private Long id;
    private String name;
    private String description;
    private BigDecimal price;
    /** 单图URL（向后兼容，取多图第一张） */
    private String imageUrl;
    /** 多图URL（JSON数组字符串） */
    private String images;
    private Long categoryId;
    private Long userId;
    private LocalDateTime createTime;
    /** 状态: 1-在售, 0-已售 */
    private Integer status;
    /** 成色: 全新, 几乎全新, 轻微使用痕迹, 明显使用痕迹 */
    @TableField("`condition`")
    private String condition;
    /** 浏览次数 */
    private Long viewCount;
    /** 总数量（发布时填写） */
    private Integer quantity;
    /** 剩余数量（每售出一件减一，归零自动下架） */
    private Integer remaining;
    /** 历史累计售出数量 */
    private Integer soldCount;

    /** 获取图片列表（解析 images JSON） */
    @TableField(exist = false)
    private List<String> imageList;

    public List<String> getImageList() {
        if (imageList != null) return imageList;
        imageList = new ArrayList<>();
        String source = (images != null && !images.isEmpty()) ? images : imageUrl;
        if (source == null || source.isEmpty()) return imageList;
        try {
            if (source.startsWith("[")) {
                imageList = MAPPER.readValue(source, new TypeReference<List<String>>() {});
            } else {
                imageList.add(source);
            }
        } catch (Exception e) {
            imageList.add(source);
        }
        return imageList;
    }
}
