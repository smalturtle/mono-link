package com.secondhand.service;

import com.secondhand.entity.Cart;

import java.util.List;
import java.util.Map;

public interface CartService {

    /** 添加商品到购物车 */
    void add(Long userId, Long productId, Integer quantity);

    /** 查看购物车列表（联表查询商品详情） */
    List<Map<String, Object>> list(Long userId);

    /** 更新购物车商品数量 */
    void updateQuantity(Long cartId, Integer quantity);

    /** 从购物车移除商品 */
    void remove(Long cartId);
}
