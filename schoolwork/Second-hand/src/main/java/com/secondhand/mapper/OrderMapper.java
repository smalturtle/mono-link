package com.secondhand.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.secondhand.entity.Order;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Mapper
public interface OrderMapper extends BaseMapper<Order> {

    /** 买家订单列表（含订单明细） */
    List<Map<String, Object>> selectBuyerOrders(@Param("buyerId") Long buyerId,
                                                 @Param("status") Integer status);

    /** 管理员/卖家：全部订单列表 */
    List<Map<String, Object>> selectAllOrders(@Param("status") Integer status);

    /** 卖家订单列表 */
    List<Map<String, Object>> selectSellerOrders(@Param("sellerId") Long sellerId,
                                                  @Param("status") Integer status);

    /** 根据订单ID查询明细 */
    List<Map<String, Object>> selectOrderItems(@Param("orderId") Long orderId);

    /** 卖家概览：总订单数 */
    @Select("SELECT COUNT(*) FROM orders WHERE seller_id = #{sellerId}")
    int countBySellerId(@Param("sellerId") Long sellerId);

    /** 卖家概览：总收入（已完成订单） */
    @Select("SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE seller_id = #{sellerId} AND status = 3")
    BigDecimal sumRevenueBySellerId(@Param("sellerId") Long sellerId);

    /** 管理员概览：总订单数 */
    @Select("SELECT COUNT(*) FROM orders")
    int countAll();

    /** 管理员概览：总收入（已完成订单） */
    @Select("SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status = 3")
    BigDecimal sumAllRevenue();

    /** 管理员概览：7日内新订单数 */
    @Select("SELECT COUNT(*) FROM orders WHERE create_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)")
    int countRecent7Days();

    /** 管理员概览：7日内收入（已完成订单） */
    @Select("SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status = 3 AND create_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)")
    BigDecimal sumRevenue7Days();

    /** 管理端：当日订单数 */
    @Select("SELECT COUNT(*) FROM orders WHERE create_time >= CURDATE()")
    int countToday();

    /** 管理端：当日流水GMV（已完成订单） */
    @Select("SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status = 3 AND create_time >= CURDATE()")
    BigDecimal sumGmvToday();

    /** 卖家：当日订单数 */
    @Select("SELECT COUNT(*) FROM orders WHERE seller_id = #{sellerId} AND create_time >= CURDATE()")
    int countTodayBySellerId(@Param("sellerId") Long sellerId);

    /** 卖家：当日流水GMV（已完成订单） */
    @Select("SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE seller_id = #{sellerId} AND status = 3 AND create_time >= CURDATE()")
    BigDecimal sumGmvTodayBySellerId(@Param("sellerId") Long sellerId);

    /** 卖家概览：7日内订单数 */
    @Select("SELECT COUNT(*) FROM orders WHERE seller_id = #{sellerId} AND create_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)")
    int countRecent7DaysBySellerId(@Param("sellerId") Long sellerId);

    /** 卖家概览：7日内收入（已完成订单） */
    @Select("SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE seller_id = #{sellerId} AND status = 3 AND create_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)")
    BigDecimal sumRevenue7DaysBySellerId(@Param("sellerId") Long sellerId);
}
