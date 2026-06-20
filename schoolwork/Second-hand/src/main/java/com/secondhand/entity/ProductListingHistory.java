package com.secondhand.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/** 商品上架历史记录 */
@Data
@TableName("product_listing_history")
public class ProductListingHistory {
    @TableId(type = IdType.AUTO)
    private Long id;
    /** 商品ID */
    private Long productId;
    /** 上架时间 */
    private LocalDateTime listingTime;
}
