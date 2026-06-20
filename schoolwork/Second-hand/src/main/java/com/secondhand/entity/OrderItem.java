package com.secondhand.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;

/**
 * 订单明细实体类
 */
@Data
@TableName("order_item")
public class OrderItem {
    @TableId(type = IdType.AUTO)
    private Long id;
    /** 订单ID */
    private Long orderId;
    /** 商品ID */
    private Long productId;
    /** 商品名称快照 */
    private String productName;
    /** 商品图片快照（取第一张） */
    private String productImage;
    /** 购买时单价 */
    private BigDecimal price;
    /** 购买数量 */
    private Integer quantity;
}
