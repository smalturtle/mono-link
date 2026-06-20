package com.secondhand.controller;

import com.secondhand.common.Result;
import com.secondhand.entity.User;
import com.secondhand.service.OrderService;
import com.secondhand.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;
    private final UserService userService;

    // ==================== 买家端 ====================

    /** 提交订单（从购物车结算） */
    @PostMapping("/api/order/submit")
    public Result<Map<String, Object>> submit(
            @RequestHeader(value = "token", required = false) String token,
            @RequestBody Map<String, String> body) {
        User user = getLoginUser(token);
        String address = body.getOrDefault("address", "");
        String remark = body.getOrDefault("remark", "");
        Map<String, Object> result = orderService.submit(user.getId(), address, remark);
        return Result.success("下单成功", result);
    }

    /** 我的订单列表 */
    @GetMapping("/api/order/list")
    public Result<List<Map<String, Object>>> list(
            @RequestHeader(value = "token", required = false) String token,
            @RequestParam(required = false) Integer status) {
        User user = getLoginUser(token);
        return Result.success(orderService.listBuyerOrders(user.getId(), status));
    }

    /** 订单详情 */
    @GetMapping("/api/order/{id}")
    public Result<Map<String, Object>> detail(
            @RequestHeader(value = "token", required = false) String token,
            @PathVariable Long id) {
        getLoginUser(token);
        return Result.success(orderService.detail(id));
    }

    /** 取消订单 */
    @PutMapping("/api/order/{id}/cancel")
    public Result<?> cancel(
            @RequestHeader(value = "token", required = false) String token,
            @PathVariable Long id) {
        User user = getLoginUser(token);
        orderService.cancel(id, user.getId());
        return Result.success("订单已取消", null);
    }

    /** 模拟付款 */
    @PutMapping("/api/order/{id}/pay")
    public Result<?> pay(
            @RequestHeader(value = "token", required = false) String token,
            @PathVariable Long id) {
        User user = getLoginUser(token);
        orderService.pay(id, user.getId());
        return Result.success("付款成功", null);
    }

    /** 确认收货 */
    @PutMapping("/api/order/{id}/confirm")
    public Result<?> confirm(
            @RequestHeader(value = "token", required = false) String token,
            @PathVariable Long id) {
        User user = getLoginUser(token);
        orderService.confirm(id, user.getId());
        return Result.success("确认收货成功", null);
    }

    // ==================== 卖家端 ====================

    /** 卖家订单列表 */
    @GetMapping("/api/seller/order/list")
    public Result<List<Map<String, Object>>> sellerList(
            @RequestHeader(value = "token", required = false) String token,
            @RequestParam(required = false) Integer status) {
        User user = getLoginUser(token);
        return Result.success(orderService.listSellerOrders(user.getId(), status));
    }

    /** 卖家发货 */
    @PutMapping("/api/seller/order/{id}/ship")
    public Result<?> ship(
            @RequestHeader(value = "token", required = false) String token,
            @PathVariable Long id) {
        User user = getLoginUser(token);
        orderService.ship(id, user.getId());
        return Result.success("发货成功", null);
    }

    // ==================== 管理员端 ====================

    /** 全部订单列表 */
    @GetMapping("/api/admin/order/list")
    public Result<List<Map<String, Object>>> adminList(
            @RequestHeader(value = "token", required = false) String token,
            @RequestParam(required = false) Integer status) {
        getAdmin(token);
        return Result.success(orderService.listAllOrders(status));
    }

    /** 更新订单状态 */
    @PutMapping("/api/admin/order/{id}/status")
    public Result<?> updateStatus(
            @RequestHeader(value = "token", required = false) String token,
            @PathVariable Long id,
            @RequestBody Map<String, Object> body) {
        getAdmin(token);
        Integer status = Integer.valueOf(body.get("status").toString());
        orderService.updateStatus(id, status);
        return Result.success("状态更新成功", null);
    }

    /** 批量更新订单状态 */
    @PutMapping("/api/admin/order/batch/status")
    public Result<?> batchUpdateStatus(
            @RequestHeader(value = "token", required = false) String token,
            @RequestBody Map<String, Object> body) {
        getAdmin(token);
        @SuppressWarnings("unchecked")
        List<Long> ids = ((List<Integer>) body.get("ids")).stream().map(Long::valueOf).toList();
        Integer status = Integer.valueOf(body.get("status").toString());
        orderService.batchUpdateStatus(ids, status);
        return Result.success("批量更新成功", null);
    }

    /** 删除订单 */
    @DeleteMapping("/api/admin/order/{id}")
    public Result<?> deleteOrder(
            @RequestHeader(value = "token", required = false) String token,
            @PathVariable Long id) {
        getAdmin(token);
        orderService.delete(id);
        return Result.success("订单已删除", null);
    }

    /** 批量删除订单 */
    @DeleteMapping("/api/admin/order/batch")
    public Result<?> batchDeleteOrders(
            @RequestHeader(value = "token", required = false) String token,
            @RequestBody Map<String, Object> body) {
        getAdmin(token);
        @SuppressWarnings("unchecked")
        List<Long> ids = ((List<Integer>) body.get("ids")).stream().map(Long::valueOf).toList();
        orderService.batchDelete(ids);
        return Result.success("批量删除成功", null);
    }

    // ==================== 辅助方法 ====================

    private User getLoginUser(String token) {
        User user = userService.getByToken(token);
        if (user == null) {
            throw new RuntimeException("请先登录");
        }
        return user;
    }

    private User getAdmin(String token) {
        User user = userService.getByToken(token);
        if (user == null || !"admin".equals(user.getRole())) {
            throw new RuntimeException("无管理员权限");
        }
        return user;
    }
}
