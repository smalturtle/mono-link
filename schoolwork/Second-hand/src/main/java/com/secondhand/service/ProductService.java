package com.secondhand.service;

import com.secondhand.common.PageResult;
import com.secondhand.entity.Product;

import java.util.List;
import java.util.Map;

public interface ProductService {

    /** 分页查询商品（支持名称、分类、价格区间、排序） */
    PageResult<Product> pageList(String name, Long categoryId, String minPrice,
                                  String maxPrice, String sortBy, int page, int size);

    /** 根据ID查询（不带卖家信息） */
    Product getById(Long id);

    /** 获取商品详情（含卖家信息，自动计数） */
    Map<String, Object> getDetail(Long id);

    /** 新增商品 */
    void add(Product product);

    /** 更新商品（校验归属） */
    void update(Product product, Long userId);

    /** 删除商品（校验归属） */
    void delete(Long id, Long userId);

    /** 切换商品上下架状态 */
    void toggleStatus(Long id, Long userId);

    /** 查询用户发布的商品 */
    PageResult<Product> myProducts(Long userId, Integer status, int page, int size);

    /** 查询卖家其他在售商品 */
    PageResult<Product> getSellerProducts(Long sellerId, int page, int size);

    /** 批量删除商品（管理员） */
    void batchDelete(List<Long> ids);

    /** 批量更新商品状态（管理员） */
    void batchUpdateStatus(List<Long> ids, Integer status);

    /** 扣减余量（付款时调用），返回扣减后是否售罄 */
    boolean decrementRemaining(Long productId, int count);

    /** 查询商品上架历史记录 */
    List<Map<String, Object>> getListingHistory(Long productId);

    /** 卖家个人概览 */
    Map<String, Object> getSellerOverview(Long userId);

    /** 管理员全局概览 */
    Map<String, Object> getAdminOverview();
}
