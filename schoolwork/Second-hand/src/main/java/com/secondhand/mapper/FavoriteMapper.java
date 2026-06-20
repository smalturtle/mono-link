package com.secondhand.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.secondhand.entity.Favorite;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.Map;

@Mapper
public interface FavoriteMapper extends BaseMapper<Favorite> {

    /** 查询用户收藏列表（联表查询商品信息） */
    List<Map<String, Object>> selectFavoriteListByUserId(@Param("userId") Long userId);

    /** 检查是否已收藏 */
    Favorite selectByUserIdAndProductId(@Param("userId") Long userId,
                                         @Param("productId") Long productId);
}
