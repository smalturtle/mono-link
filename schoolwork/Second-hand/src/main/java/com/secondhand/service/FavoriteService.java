package com.secondhand.service;

import java.util.List;
import java.util.Map;

public interface FavoriteService {

    /** 添加收藏 */
    void add(Long userId, Long productId);

    /** 取消收藏 */
    void remove(Long userId, Long productId);

    /** 检查是否已收藏 */
    boolean isFavorited(Long userId, Long productId);

    /** 收藏列表（含商品信息） */
    List<Map<String, Object>> list(Long userId);
}
