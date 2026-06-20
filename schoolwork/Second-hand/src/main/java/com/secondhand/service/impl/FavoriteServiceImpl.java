package com.secondhand.service.impl;

import com.secondhand.entity.Favorite;
import com.secondhand.entity.Product;
import com.secondhand.mapper.FavoriteMapper;
import com.secondhand.mapper.ProductMapper;
import com.secondhand.service.FavoriteService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class FavoriteServiceImpl implements FavoriteService {

    private final FavoriteMapper favoriteMapper;
    private final ProductMapper productMapper;

    @Override
    public void add(Long userId, Long productId) {
        Product product = productMapper.selectById(productId);
        if (product == null) {
            throw new RuntimeException("商品不存在");
        }
        Favorite exist = favoriteMapper.selectByUserIdAndProductId(userId, productId);
        if (exist != null) {
            throw new RuntimeException("已收藏该商品");
        }
        Favorite favorite = new Favorite();
        favorite.setUserId(userId);
        favorite.setProductId(productId);
        favoriteMapper.insert(favorite);
    }

    @Override
    public void remove(Long userId, Long productId) {
        Favorite exist = favoriteMapper.selectByUserIdAndProductId(userId, productId);
        if (exist == null) {
            throw new RuntimeException("未收藏该商品");
        }
        favoriteMapper.deleteById(exist.getId());
    }

    @Override
    public boolean isFavorited(Long userId, Long productId) {
        return favoriteMapper.selectByUserIdAndProductId(userId, productId) != null;
    }

    @Override
    public List<Map<String, Object>> list(Long userId) {
        return favoriteMapper.selectFavoriteListByUserId(userId);
    }
}
