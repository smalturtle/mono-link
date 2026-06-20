package com.secondhand.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.secondhand.entity.Cart;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.Map;

@Mapper
public interface CartMapper extends BaseMapper<Cart> {

    /**
     * 联表查询购物车列表，包含商品详情
     */
    List<Map<String, Object>> selectCartListByUserId(@Param("userId") Long userId);

    /**
     * 检查商品是否已在用户购物车中
     */
    Cart selectByUserIdAndProductId(@Param("userId") Long userId, @Param("productId") Long productId);
}
