package com.secondhand.service.impl;

import com.secondhand.entity.Cart;
import com.secondhand.entity.Product;
import com.secondhand.mapper.CartMapper;
import com.secondhand.mapper.ProductMapper;
import com.secondhand.service.CartService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class CartServiceImpl implements CartService {

    private final CartMapper cartMapper;
    private final ProductMapper productMapper;

    @Override
    public void add(Long userId, Long productId, Integer quantity) {
        // 校验商品是否存在且在售
        Product product = productMapper.selectById(productId);
        if (product == null) {
            throw new RuntimeException("商品不存在");
        }
        if (product.getStatus() == 0) {
            throw new RuntimeException("商品已售出，无法加入购物车");
        }
        // 检查购物车中是否已有该商品
        Cart existCart = cartMapper.selectByUserIdAndProductId(userId, productId);
        if (existCart != null) {
            // 已有则累加数量
            existCart.setQuantity(existCart.getQuantity() + quantity);
            cartMapper.updateById(existCart);
        } else {
            // 否则新增
            Cart cart = new Cart();
            cart.setUserId(userId);
            cart.setProductId(productId);
            cart.setQuantity(quantity);
            cart.setCreateTime(LocalDateTime.now());
            cartMapper.insert(cart);
        }
    }

    @Override
    public List<Map<String, Object>> list(Long userId) {
        return cartMapper.selectCartListByUserId(userId);
    }

    @Override
    public void updateQuantity(Long cartId, Integer quantity) {
        Cart cart = cartMapper.selectById(cartId);
        if (cart == null) {
            throw new RuntimeException("购物车记录不存在");
        }
        if (quantity <= 0) {
            cartMapper.deleteById(cartId);
        } else {
            cart.setQuantity(quantity);
            cartMapper.updateById(cart);
        }
    }

    @Override
    public void remove(Long cartId) {
        Cart cart = cartMapper.selectById(cartId);
        if (cart == null) {
            throw new RuntimeException("购物车记录不存在");
        }
        cartMapper.deleteById(cartId);
    }
}
