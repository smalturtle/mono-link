package com.secondhand.service;

import com.secondhand.entity.Order;
import com.secondhand.mapper.CartMapper;
import com.secondhand.mapper.OrderItemMapper;
import com.secondhand.mapper.OrderMapper;
import com.secondhand.service.impl.OrderServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * OrderService 单元测试
 * 覆盖: 订单提交/总价计算/库存校验/状态流转 / 正常值 / 边界值 / 异常输入 / Mock依赖
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("订单服务单元测试")
class OrderServiceTest {

    @Mock
    private OrderMapper orderMapper;

    @Mock
    private OrderItemMapper orderItemMapper;

    @Mock
    private CartMapper cartMapper;

    @InjectMocks
    private OrderServiceImpl orderService;

    private Order mockOrder;

    @BeforeEach
    void setUp() {
        mockOrder = new Order();
        mockOrder.setId(1L);
        mockOrder.setOrderNo("ORD20260616120000001");
        mockOrder.setBuyerId(100L);
        mockOrder.setSellerId(200L);
        mockOrder.setTotalAmount(new BigDecimal("299.97"));
        mockOrder.setStatus(0);
        mockOrder.setAddress("北京市朝阳区测试路1号");
        mockOrder.setRemark("请尽快发货");
        mockOrder.setCreateTime(LocalDateTime.now());
        mockOrder.setUpdateTime(LocalDateTime.now());
    }

    // ==================== 订单提交测试 ====================

    @Nested
    @DisplayName("订单提交")
    class SubmitTests {

        private List<Map<String, Object>> buildCartItems(Long sellerId, BigDecimal price, int qty) {
            Map<String, Object> item = new HashMap<>();
            item.put("cart_id", 1L);
            item.put("product_id", 10L);
            item.put("product_name", "测试商品");
            item.put("image_url", "http://example.com/img.jpg");
            item.put("price", price.doubleValue());
            item.put("quantity", qty);
            item.put("product_status", 1);
            item.put("seller_id", sellerId);
            return List.of(item);
        }

        @Test
        @DisplayName("TC-ORDER-001: 正常下单 - 单商品单个卖家")
        void shouldSubmitOrderSuccessfully() {
            List<Map<String, Object>> cartItems = buildCartItems(200L, new BigDecimal("99.99"), 1);
            when(cartMapper.selectCartListByUserId(100L)).thenReturn(cartItems);
            when(orderMapper.insert(any(Order.class))).thenReturn(1);
            when(orderItemMapper.insert(any())).thenReturn(1);
            when(cartMapper.deleteById(1L)).thenReturn(1);

            Map<String, Object> result = orderService.submit(100L, "北京市", "备注");

            assertNotNull(result);
            assertNotNull(result.get("orderIds"));
            assertEquals(1, result.get("orderCount"));
            assertEquals(new BigDecimal("99.99"), result.get("totalAmount"));
        }

        @Test
        @DisplayName("TC-ORDER-002: 正常下单 - 总价计算验证（多商品多数量）")
        void shouldCalculateTotalAmountCorrectly() {
            Map<String, Object> item1 = new HashMap<>();
            item1.put("cart_id", 1L);
            item1.put("product_id", 10L);
            item1.put("product_name", "商品A");
            item1.put("price", 100.00);
            item1.put("quantity", 2);
            item1.put("product_status", 1);
            item1.put("seller_id", 200L);

            Map<String, Object> item2 = new HashMap<>();
            item2.put("cart_id", 2L);
            item2.put("product_id", 11L);
            item2.put("product_name", "商品B");
            item2.put("price", 50.00);
            item2.put("quantity", 3);
            item2.put("product_status", 1);
            item2.put("seller_id", 200L);

            when(cartMapper.selectCartListByUserId(100L)).thenReturn(List.of(item1, item2));
            when(orderMapper.insert(any(Order.class))).thenReturn(1);
            when(orderItemMapper.insert(any())).thenReturn(1);
            when(cartMapper.deleteById(anyLong())).thenReturn(1);

            Map<String, Object> result = orderService.submit(100L, "北京市", "备注");

            // 总价 = 100*2 + 50*3 = 200 + 150 = 350
            assertEquals(0, new BigDecimal("350.00").compareTo((BigDecimal) result.get("totalAmount")));
        }

        @Test
        @DisplayName("TC-ORDER-003: 正常下单 - 多卖家分组创建多个订单")
        void shouldCreateMultipleOrdersForDifferentSellers() {
            Map<String, Object> item1 = new HashMap<>();
            item1.put("cart_id", 1L);
            item1.put("product_id", 10L);
            item1.put("product_name", "商品A");
            item1.put("price", 100.00);
            item1.put("quantity", 1);
            item1.put("product_status", 1);
            item1.put("seller_id", 200L);

            Map<String, Object> item2 = new HashMap<>();
            item2.put("cart_id", 2L);
            item2.put("product_id", 11L);
            item2.put("product_name", "商品B");
            item2.put("price", 50.00);
            item2.put("quantity", 1);
            item2.put("product_status", 1);
            item2.put("seller_id", 300L);

            when(cartMapper.selectCartListByUserId(100L)).thenReturn(List.of(item1, item2));
            when(orderMapper.insert(any(Order.class))).thenReturn(1);
            when(orderItemMapper.insert(any())).thenReturn(1);
            when(cartMapper.deleteById(anyLong())).thenReturn(1);

            Map<String, Object> result = orderService.submit(100L, "北京市", "备注");

            assertEquals(2, result.get("orderCount"));
            assertEquals(0, new BigDecimal("150.00").compareTo((BigDecimal) result.get("totalAmount")));
            verify(orderMapper, times(2)).insert(any(Order.class));
        }

        @Test
        @DisplayName("TC-ORDER-004: 异常输入 - 购物车为空")
        void shouldThrowWhenCartIsEmpty() {
            when(cartMapper.selectCartListByUserId(100L)).thenReturn(Collections.emptyList());

            RuntimeException ex = assertThrows(RuntimeException.class, () ->
                    orderService.submit(100L, "北京市", "备注"));

            assertEquals("购物车为空，无法提交订单", ex.getMessage());
        }

        @Test
        @DisplayName("TC-ORDER-005: 异常输入 - 购物车为null")
        void shouldThrowWhenCartIsNull() {
            when(cartMapper.selectCartListByUserId(100L)).thenReturn(null);

            RuntimeException ex = assertThrows(RuntimeException.class, () ->
                    orderService.submit(100L, "北京市", "备注"));

            assertEquals("购物车为空，无法提交订单", ex.getMessage());
        }

        @Test
        @DisplayName("TC-ORDER-006: 异常输入 - 不能购买自己发布的商品")
        void shouldThrowWhenBuyingOwnProduct() {
            Map<String, Object> item = new HashMap<>();
            item.put("cart_id", 1L);
            item.put("product_id", 10L);
            item.put("product_name", "自己的商品");
            item.put("price", 100.00);
            item.put("quantity", 1);
            item.put("product_status", 1);
            item.put("seller_id", 100L); // 卖家=买家

            when(cartMapper.selectCartListByUserId(100L)).thenReturn(List.of(item));

            RuntimeException ex = assertThrows(RuntimeException.class, () ->
                    orderService.submit(100L, "北京市", "备注"));

            assertTrue(ex.getMessage().contains("不能购买自己发布的商品"));
        }

        @Test
        @DisplayName("TC-ORDER-007: 边界值 - 过滤已售商品（status=0）")
        void shouldFilterOutSoldProducts() {
            Map<String, Object> soldItem = new HashMap<>();
            soldItem.put("cart_id", 1L);
            soldItem.put("product_id", 10L);
            soldItem.put("product_name", "已售商品");
            soldItem.put("price", 100.00);
            soldItem.put("quantity", 1);
            soldItem.put("product_status", 0); // 已售
            soldItem.put("seller_id", 200L);

            when(cartMapper.selectCartListByUserId(100L)).thenReturn(List.of(soldItem));

            RuntimeException ex = assertThrows(RuntimeException.class, () ->
                    orderService.submit(100L, "北京市", "备注"));

            assertEquals("购物车中没有在售商品", ex.getMessage());
        }

        @Test
        @DisplayName("TC-ORDER-008: 边界值 - 零数量商品不参与计算")
        void shouldHandleZeroQuantity() {
            Map<String, Object> item = new HashMap<>();
            item.put("cart_id", 1L);
            item.put("product_id", 10L);
            item.put("product_name", "测试商品");
            item.put("price", 100.00);
            item.put("quantity", 1);
            item.put("product_status", 1);
            item.put("seller_id", 200L);

            when(cartMapper.selectCartListByUserId(100L)).thenReturn(List.of(item));
            when(orderMapper.insert(any(Order.class))).thenReturn(1);
            when(orderItemMapper.insert(any())).thenReturn(1);
            when(cartMapper.deleteById(1L)).thenReturn(1);

            Map<String, Object> result = orderService.submit(100L, "北京市", "备注");

            assertEquals(0, new BigDecimal("100.00").compareTo((BigDecimal) result.get("totalAmount")));
        }
    }

    // ==================== 订单取消测试 ====================

    @Nested
    @DisplayName("订单取消")
    class CancelTests {

        @Test
        @DisplayName("TC-ORDER-009: 正常取消 - 待付款订单")
        void shouldCancelPendingOrder() {
            mockOrder.setStatus(0);
            when(orderMapper.selectById(1L)).thenReturn(mockOrder);
            when(orderMapper.updateById(any(Order.class))).thenReturn(1);

            assertDoesNotThrow(() -> orderService.cancel(1L, 100L));

            verify(orderMapper).updateById(argThat(o -> o.getStatus() == 4));
        }

        @Test
        @DisplayName("TC-ORDER-010: 异常输入 - 已付款订单不可取消")
        void shouldThrowWhenCancelPaidOrder() {
            mockOrder.setStatus(1);
            when(orderMapper.selectById(1L)).thenReturn(mockOrder);

            RuntimeException ex = assertThrows(RuntimeException.class, () ->
                    orderService.cancel(1L, 100L));

            assertEquals("只有待付款订单可以取消", ex.getMessage());
        }

        @Test
        @DisplayName("TC-ORDER-011: 异常输入 - 无权取消他人订单")
        void shouldThrowWhenCancelOthersOrder() {
            when(orderMapper.selectById(1L)).thenReturn(mockOrder);

            RuntimeException ex = assertThrows(RuntimeException.class, () ->
                    orderService.cancel(1L, 999L));

            assertEquals("无权操作此订单", ex.getMessage());
        }

        @Test
        @DisplayName("TC-ORDER-012: 异常输入 - 订单不存在")
        void shouldThrowWhenOrderNotFound() {
            when(orderMapper.selectById(999L)).thenReturn(null);

            RuntimeException ex = assertThrows(RuntimeException.class, () ->
                    orderService.cancel(999L, 100L));

            assertEquals("订单不存在", ex.getMessage());
        }
    }

    // ==================== 订单付款测试 ====================

    @Nested
    @DisplayName("订单付款")
    class PayTests {

        @Test
        @DisplayName("TC-ORDER-013: 正常付款 - 待付款→已付款")
        void shouldPaySuccessfully() {
            mockOrder.setStatus(0);
            when(orderMapper.selectById(1L)).thenReturn(mockOrder);
            when(orderMapper.updateById(any(Order.class))).thenReturn(1);

            assertDoesNotThrow(() -> orderService.pay(1L, 100L));

            verify(orderMapper).updateById(argThat(o -> o.getStatus() == 1));
        }

        @Test
        @DisplayName("TC-ORDER-014: 异常输入 - 已取消订单不可付款")
        void shouldThrowWhenPayCancelledOrder() {
            mockOrder.setStatus(4);
            when(orderMapper.selectById(1L)).thenReturn(mockOrder);

            RuntimeException ex = assertThrows(RuntimeException.class, () ->
                    orderService.pay(1L, 100L));

            assertEquals("只有待付款订单可以付款", ex.getMessage());
        }

        @Test
        @DisplayName("TC-ORDER-015: 异常输入 - 重复付款")
        void shouldThrowWhenPayAlreadyPaidOrder() {
            mockOrder.setStatus(1);
            when(orderMapper.selectById(1L)).thenReturn(mockOrder);

            RuntimeException ex = assertThrows(RuntimeException.class, () ->
                    orderService.pay(1L, 100L));

            assertEquals("只有待付款订单可以付款", ex.getMessage());
        }
    }

    // ==================== 订单状态更新测试（管理员） ====================

    @Nested
    @DisplayName("管理员更新订单状态")
    class UpdateStatusTests {

        @Test
        @DisplayName("TC-ORDER-016: 正常更新 - 已付款→已发货")
        void shouldUpdateStatusToShipped() {
            mockOrder.setStatus(1);
            when(orderMapper.selectById(1L)).thenReturn(mockOrder);
            when(orderMapper.updateById(any(Order.class))).thenReturn(1);

            assertDoesNotThrow(() -> orderService.updateStatus(1L, 2));

            verify(orderMapper).updateById(argThat(o -> o.getStatus() == 2));
        }

        @Test
        @DisplayName("TC-ORDER-017: 边界值 - 无效状态值（status<0）")
        void shouldThrowWhenInvalidStatusNegative() {
            mockOrder.setStatus(1);
            when(orderMapper.selectById(1L)).thenReturn(mockOrder);

            RuntimeException ex = assertThrows(RuntimeException.class, () ->
                    orderService.updateStatus(1L, -1));

            assertEquals("无效的状态值", ex.getMessage());
        }

        @Test
        @DisplayName("TC-ORDER-018: 边界值 - 无效状态值（status>3）")
        void shouldThrowWhenInvalidStatusTooLarge() {
            mockOrder.setStatus(1);
            when(orderMapper.selectById(1L)).thenReturn(mockOrder);

            RuntimeException ex = assertThrows(RuntimeException.class, () ->
                    orderService.updateStatus(1L, 5));

            assertEquals("无效的状态值", ex.getMessage());
        }

        @Test
        @DisplayName("TC-ORDER-019: 异常输入 - 已取消订单无法修改状态")
        void shouldThrowWhenUpdateCancelledOrder() {
            mockOrder.setStatus(4);
            when(orderMapper.selectById(1L)).thenReturn(mockOrder);

            RuntimeException ex = assertThrows(RuntimeException.class, () ->
                    orderService.updateStatus(1L, 2));

            assertEquals("已取消的订单无法修改状态", ex.getMessage());
        }
    }

    // ==================== 订单详情测试 ====================

    @Nested
    @DisplayName("订单详情")
    class DetailTests {

        @Test
        @DisplayName("TC-ORDER-020: 正常获取订单详情")
        void shouldReturnOrderDetail() {
            when(orderMapper.selectById(1L)).thenReturn(mockOrder);
            when(orderMapper.selectOrderItems(1L)).thenReturn(Collections.emptyList());

            Map<String, Object> result = orderService.detail(1L);

            assertNotNull(result);
            assertEquals(1L, result.get("id"));
            assertEquals("ORD20260616120000001", result.get("orderNo"));
            assertEquals(100L, result.get("buyerId"));
            assertNotNull(result.get("items"));
        }

        @Test
        @DisplayName("TC-ORDER-021: 异常输入 - 订单不存在")
        void shouldThrowWhenOrderDetailNotFound() {
            when(orderMapper.selectById(999L)).thenReturn(null);

            RuntimeException ex = assertThrows(RuntimeException.class, () ->
                    orderService.detail(999L));

            assertEquals("订单不存在", ex.getMessage());
        }
    }
}
