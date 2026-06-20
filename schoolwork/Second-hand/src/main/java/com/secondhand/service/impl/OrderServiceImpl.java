package com.secondhand.service.impl;

import com.secondhand.entity.Order;
import com.secondhand.entity.OrderItem;
import com.secondhand.entity.User;
import com.secondhand.mapper.CartMapper;
import com.secondhand.mapper.OrderItemMapper;
import com.secondhand.mapper.OrderMapper;
import com.secondhand.mapper.ProductMapper;
import com.secondhand.mapper.UserMapper;
import com.secondhand.service.OrderService;
import com.secondhand.service.ProductService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@RequiredArgsConstructor
public class OrderServiceImpl implements OrderService {

    private final OrderMapper orderMapper;
    private final OrderItemMapper orderItemMapper;
    private final CartMapper cartMapper;
    private final ProductMapper productMapper;
    private final UserMapper userMapper;
    private final ProductService productService;

    @Override
    @Transactional
    public Map<String, Object> submit(Long buyerId, String address, String remark) {
        // 1. 查询购物车商品
        List<Map<String, Object>> cartItems = cartMapper.selectCartListByUserId(buyerId);
        if (cartItems == null || cartItems.isEmpty()) {
            throw new RuntimeException("购物车为空，无法提交订单");
        }

        // 2. 过滤在售商品，计算总金额，按卖家分组
        Map<Long, List<Map<String, Object>>> sellerGroups = new LinkedHashMap<>();
        BigDecimal totalAmount = BigDecimal.ZERO;

        for (Map<String, Object> item : cartItems) {
            Integer status = (Integer) item.get("product_status");
            if (status == null || status != 1) {
                continue; // 跳过已售商品
            }
            Object sellerIdObj = item.get("seller_id");
            if (sellerIdObj == null) continue;
            Long sellerId = Long.valueOf(sellerIdObj.toString());

            // 不允许购买自己的商品
            if (sellerId.equals(buyerId)) {
                String productName = (String) item.get("product_name");
                throw new RuntimeException("不能购买自己发布的商品：" + (productName != null ? productName : ""));
            }

            sellerGroups.computeIfAbsent(sellerId, k -> new ArrayList<>()).add(item);

            BigDecimal price = new BigDecimal(item.get("price").toString());
            int qty = Integer.parseInt(item.get("quantity").toString());
            totalAmount = totalAmount.add(price.multiply(BigDecimal.valueOf(qty)));
        }

        if (sellerGroups.isEmpty()) {
            throw new RuntimeException("购物车中没有在售商品");
        }

        // 3. 为每个卖家创建一个订单
        List<Long> orderIds = new ArrayList<>();
        List<Long> cartIdsToRemove = new ArrayList<>();

        for (Map.Entry<Long, List<Map<String, Object>>> entry : sellerGroups.entrySet()) {
            Long sellerId = entry.getKey();
            List<Map<String, Object>> items = entry.getValue();

            // 计算该卖家订单金额
            BigDecimal orderAmount = BigDecimal.ZERO;
            for (Map<String, Object> item : items) {
                BigDecimal price = new BigDecimal(item.get("price").toString());
                int qty = Integer.parseInt(item.get("quantity").toString());
                orderAmount = orderAmount.add(price.multiply(BigDecimal.valueOf(qty)));
            }

            // 生成订单编号
            String orderNo = "ORD" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"))
                    + String.format("%04d", new Random().nextInt(10000));

            Order order = new Order();
            order.setOrderNo(orderNo);
            order.setBuyerId(buyerId);
            order.setSellerId(sellerId);
            order.setTotalAmount(orderAmount);
            order.setStatus(0); // 待付款
            order.setAddress(address);
            order.setRemark(remark);
            order.setCreateTime(LocalDateTime.now());
            order.setUpdateTime(LocalDateTime.now());
            orderMapper.insert(order);

            // 创建订单明细
            for (Map<String, Object> item : items) {
                Long productId = Long.valueOf(item.get("product_id").toString());
                String productName = (String) item.get("product_name");
                String productImage = (String) item.get("image_url");
                BigDecimal price = new BigDecimal(item.get("price").toString());
                int qty = Integer.parseInt(item.get("quantity").toString());
                Long cartId = Long.valueOf(item.get("cart_id").toString());

                OrderItem orderItem = new OrderItem();
                orderItem.setOrderId(order.getId());
                orderItem.setProductId(productId);
                orderItem.setProductName(productName);
                orderItem.setProductImage(productImage);
                orderItem.setPrice(price);
                orderItem.setQuantity(qty);
                orderItemMapper.insert(orderItem);

                cartIdsToRemove.add(cartId);
            }

            orderIds.add(order.getId());
        }

        // 4. 清空已下单的购物车记录
        for (Long cartId : cartIdsToRemove) {
            cartMapper.deleteById(cartId);
        }

        // 5. 返回结果
        Map<String, Object> result = new HashMap<>();
        result.put("orderIds", orderIds);
        result.put("orderCount", orderIds.size());
        result.put("totalAmount", totalAmount);
        return result;
    }

    @Override
    public List<Map<String, Object>> listBuyerOrders(Long buyerId, Integer status) {
        List<Map<String, Object>> orders = orderMapper.selectBuyerOrders(buyerId, status);
        // 为每个订单加载明细
        for (Map<String, Object> order : orders) {
            Long orderId = Long.valueOf(order.get("id").toString());
            order.put("items", orderMapper.selectOrderItems(orderId));
        }
        return orders;
    }

    @Override
    @Transactional
    public void cancel(Long orderId, Long buyerId) {
        Order order = orderMapper.selectById(orderId);
        if (order == null) {
            throw new RuntimeException("订单不存在");
        }
        if (!order.getBuyerId().equals(buyerId)) {
            throw new RuntimeException("无权操作此订单");
        }
        if (order.getStatus() != 0) {
            throw new RuntimeException("只有待付款订单可以取消");
        }
        order.setStatus(4); // 已取消
        order.setUpdateTime(LocalDateTime.now());
        orderMapper.updateById(order);
    }

    @Override
    @Transactional
    public void pay(Long orderId, Long buyerId) {
        Order order = orderMapper.selectById(orderId);
        if (order == null) {
            throw new RuntimeException("订单不存在");
        }
        if (!order.getBuyerId().equals(buyerId)) {
            throw new RuntimeException("无权操作此订单");
        }
        if (order.getStatus() != 0) {
            throw new RuntimeException("只有待付款订单可以付款");
        }
        order.setStatus(1); // 已付款（待发货）
        order.setUpdateTime(LocalDateTime.now());
        orderMapper.updateById(order);

        // 付款后扣减商品余量（余量归零自动下架）
        List<Map<String, Object>> items = orderMapper.selectOrderItems(orderId);
        for (Map<String, Object> item : items) {
            Long productId = Long.valueOf(item.get("product_id").toString());
            int qty = Integer.parseInt(item.get("quantity").toString());
            productService.decrementRemaining(productId, qty);
        }
    }

    @Override
    @Transactional
    public void confirm(Long orderId, Long buyerId) {
        Order order = orderMapper.selectById(orderId);
        if (order == null) {
            throw new RuntimeException("订单不存在");
        }
        if (!order.getBuyerId().equals(buyerId)) {
            throw new RuntimeException("无权操作此订单");
        }
        if (order.getStatus() != 2) {
            throw new RuntimeException("只有已发货订单可以确认收货");
        }
        order.setStatus(3); // 已完成
        order.setUpdateTime(LocalDateTime.now());
        orderMapper.updateById(order);
    }

    @Override
    public List<Map<String, Object>> listSellerOrders(Long sellerId, Integer status) {
        List<Map<String, Object>> orders = orderMapper.selectSellerOrders(sellerId, status);
        for (Map<String, Object> order : orders) {
            Long orderId = Long.valueOf(order.get("id").toString());
            order.put("items", orderMapper.selectOrderItems(orderId));
        }
        return orders;
    }

    @Override
    @Transactional
    public void ship(Long orderId, Long sellerId) {
        Order order = orderMapper.selectById(orderId);
        if (order == null) {
            throw new RuntimeException("订单不存在");
        }
        if (!order.getSellerId().equals(sellerId)) {
            throw new RuntimeException("无权操作此订单");
        }
        if (order.getStatus() != 1) {
            throw new RuntimeException("只有已付款订单可以发货");
        }
        order.setStatus(2); // 已发货
        order.setUpdateTime(LocalDateTime.now());
        orderMapper.updateById(order);
    }

    @Override
    public List<Map<String, Object>> listAllOrders(Integer status) {
        List<Map<String, Object>> orders = orderMapper.selectAllOrders(status);
        for (Map<String, Object> order : orders) {
            Long orderId = Long.valueOf(order.get("id").toString());
            order.put("items", orderMapper.selectOrderItems(orderId));
        }
        return orders;
    }

    @Override
    public void updateStatus(Long orderId, Integer status) {
        Order order = orderMapper.selectById(orderId);
        if (order == null) {
            throw new RuntimeException("订单不存在");
        }
        if (order.getStatus() == 4) {
            throw new RuntimeException("已取消的订单无法修改状态");
        }
        if (status < 0 || status > 3) {
            throw new RuntimeException("无效的状态值");
        }
        order.setStatus(status);
        order.setUpdateTime(LocalDateTime.now());
        orderMapper.updateById(order);
    }

    @Override
    public void batchUpdateStatus(List<Long> ids, Integer status) {
        if (ids == null || ids.isEmpty()) {
            throw new RuntimeException("请选择订单");
        }
        if (status < 0 || status > 4) {
            throw new RuntimeException("无效的状态值");
        }
        for (Long id : ids) {
            Order order = orderMapper.selectById(id);
            if (order == null || order.getStatus() == 4) {
                continue; // 跳过不存在的或已取消的订单
            }
            order.setStatus(status);
            order.setUpdateTime(LocalDateTime.now());
            orderMapper.updateById(order);
        }
    }

    @Override
    public void delete(Long orderId) {
        Order order = orderMapper.selectById(orderId);
        if (order == null) {
            throw new RuntimeException("订单不存在");
        }
        // 先删明细
        List<Map<String, Object>> items = orderMapper.selectOrderItems(orderId);
        List<Long> itemIds = items.stream()
                .map(i -> Long.valueOf(i.get("id").toString()))
                .toList();
        if (!itemIds.isEmpty()) {
            orderItemMapper.deleteBatchIds(itemIds);
        }
        orderMapper.deleteById(orderId);
    }

    @Override
    public void batchDelete(List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            throw new RuntimeException("请选择订单");
        }
        for (Long id : ids) {
            delete(id);
        }
    }

    @Override
    public Map<String, Object> detail(Long orderId) {
        Order order = orderMapper.selectById(orderId);
        if (order == null) {
            throw new RuntimeException("订单不存在");
        }
        Map<String, Object> result = new HashMap<>();
        result.put("id", order.getId());
        result.put("orderNo", order.getOrderNo());
        result.put("buyerId", order.getBuyerId());
        result.put("sellerId", order.getSellerId());
        result.put("totalAmount", order.getTotalAmount());
        result.put("status", order.getStatus());
        result.put("address", order.getAddress());
        result.put("remark", order.getRemark());
        result.put("createTime", order.getCreateTime());
        result.put("updateTime", order.getUpdateTime());
        // 买家/卖家名称
        User buyer = userMapper.selectById(order.getBuyerId());
        User seller = userMapper.selectById(order.getSellerId());
        result.put("buyerName", buyer != null ? buyer.getUsername() : "-");
        result.put("sellerName", seller != null ? seller.getUsername() : "-");
        result.put("items", orderMapper.selectOrderItems(orderId));
        return result;
    }
}
