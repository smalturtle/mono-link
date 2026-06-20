package com.secondhand.service;

import java.util.List;
import java.util.Map;

public interface OrderService {

    /** 买家提交订单（从购物车商品生成订单） */
    Map<String, Object> submit(Long buyerId, String address, String remark);

    /** 买家订单列表 */
    List<Map<String, Object>> listBuyerOrders(Long buyerId, Integer status);

    /** 买家取消订单 */
    void cancel(Long orderId, Long buyerId);

    /** 模拟付款：待付款 → 已付款 */
    void pay(Long orderId, Long buyerId);

    /** 买家确认收货：已发货 → 已完成 */
    void confirm(Long orderId, Long buyerId);

    /** 卖家订单列表 */
    List<Map<String, Object>> listSellerOrders(Long sellerId, Integer status);

    /** 卖家发货：已付款 → 已发货 */
    void ship(Long orderId, Long sellerId);

    /** 管理员/卖家：全部订单列表 */
    List<Map<String, Object>> listAllOrders(Integer status);

    /** 管理员更新订单状态 */
    void updateStatus(Long orderId, Integer status);

    /** 批量更新订单状态（管理员） */
    void batchUpdateStatus(List<Long> ids, Integer status);

    /** 管理员删除订单 */
    void delete(Long orderId);

    /** 批量删除订单（管理员） */
    void batchDelete(List<Long> ids);

    /** 订单详情（含明细） */
    Map<String, Object> detail(Long orderId);
}
