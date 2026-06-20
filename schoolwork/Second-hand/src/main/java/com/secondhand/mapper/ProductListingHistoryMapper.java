package com.secondhand.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.secondhand.entity.ProductListingHistory;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface ProductListingHistoryMapper extends BaseMapper<ProductListingHistory> {

    /** 查询某商品的上架历史（按时间倒序） */
    @Select("SELECT * FROM product_listing_history WHERE product_id = #{productId} ORDER BY listing_time DESC")
    List<ProductListingHistory> selectByProductId(@Param("productId") Long productId);
}
