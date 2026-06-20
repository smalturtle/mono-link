package com.secondhand.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.secondhand.entity.Product;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface ProductMapper extends BaseMapper<Product> {

    /**
     * 按条件分页搜索商品（名称、分类、价格区间、排序）
     */
    List<Product> selectByCondition(@Param("name") String name,
                                     @Param("categoryId") Long categoryId,
                                     @Param("minPrice") String minPrice,
                                     @Param("maxPrice") String maxPrice,
                                     @Param("sortBy") String sortBy,
                                     @Param("offset") Integer offset,
                                     @Param("size") Integer size);

    /**
     * 按条件统计总数
     */
    long countByCondition(@Param("name") String name,
                          @Param("categoryId") Long categoryId,
                          @Param("minPrice") String minPrice,
                          @Param("maxPrice") String maxPrice);

    /**
     * 查询某分类下的商品数量
     */
    @Select("SELECT COUNT(*) FROM product WHERE category_id = #{categoryId}")
    int countByCategoryId(@Param("categoryId") Long categoryId);

    /**
     * 查询用户发布的商品（分页）
     */
    List<Product> selectByUserId(@Param("userId") Long userId,
                                  @Param("status") Integer status,
                                  @Param("offset") Integer offset,
                                  @Param("size") Integer size);

    /**
     * 统计用户发布的商品数量
     */
    long countByUserId(@Param("userId") Long userId, @Param("status") Integer status);

    /**
     * 增加浏览次数
     */
    @org.apache.ibatis.annotations.Update("UPDATE product SET view_count = view_count + 1 WHERE id = #{id}")
    void incrementViewCount(@Param("id") Long id);

    /**
     * 查询某卖家在售商品数量
     */
    @Select("SELECT COUNT(*) FROM product WHERE user_id = #{userId} AND status = 1")
    int countBySellerId(@Param("userId") Long userId);

    /**
     * 更新商品状态（上架/下架）
     */
    @org.apache.ibatis.annotations.Update("UPDATE product SET status = #{status} WHERE id = #{id}")
    void updateProductStatus(@Param("id") Long id, @Param("status") Integer status);

    /** 卖家概览：已售罄商品数（status=0 && quantity<=0） */
    @Select("SELECT COUNT(*) FROM product WHERE user_id = #{userId} AND status = 0 AND (quantity IS NULL OR quantity <= 0)")
    int countSoldOutByUserId(@Param("userId") Long userId);

    /** 卖家概览：已下架商品数（status=0 && quantity>0） */
    @Select("SELECT COUNT(*) FROM product WHERE user_id = #{userId} AND status = 0 AND quantity > 0")
    int countOffShelfByUserId(@Param("userId") Long userId);

    /** 管理员概览：商品总数 */
    @Select("SELECT COUNT(*) FROM product")
    int countAll();

    /** 管理员概览：7日内新商品 */
    @Select("SELECT COUNT(*) FROM product WHERE create_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)")
    int countRecent7Days();

    /** 管理员概览：当日新商品 */
    @Select("SELECT COUNT(*) FROM product WHERE create_time >= CURDATE()")
    int countToday();

    /** 卖家概览：7日内新商品 */
    @Select("SELECT COUNT(*) FROM product WHERE user_id = #{userId} AND create_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)")
    int countRecent7DaysByUserId(@Param("userId") Long userId);

    /** 卖家概览：当日新商品 */
    @Select("SELECT COUNT(*) FROM product WHERE user_id = #{userId} AND create_time >= CURDATE()")
    int countTodayByUserId(@Param("userId") Long userId);
}
