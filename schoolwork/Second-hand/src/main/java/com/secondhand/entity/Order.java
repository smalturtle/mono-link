package com.secondhand.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 订单实体类
 * 状态: 0-待付款, 1-已付款, 2-已发货, 3-已完成, 4-已取消
 */
@Data
@TableName("orders")
public class Order {
    @TableId(type = IdType.AUTO)
    private Long id;
    /** 订单编号 */
    private String orderNo;
    /** 买家ID */
    private Long buyerId;
    /** 卖家ID（发布商品的管理员） */
    private Long sellerId;
    /** 订单总金额 */
    private BigDecimal totalAmount;
    /** 状态: 0-待付款, 1-已付款, 2-已发货, 3-已完成, 4-已取消 */
    private Integer status;
    /** 收货地址 */
    private String address;
    /** 备注 */
    private String remark;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
