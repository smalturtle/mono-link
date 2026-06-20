package com.secondhand.service.impl;

import com.secondhand.common.PageResult;
import com.secondhand.entity.Product;
import com.secondhand.entity.ProductListingHistory;
import com.secondhand.entity.User;
import com.secondhand.mapper.OrderMapper;
import com.secondhand.mapper.ProductListingHistoryMapper;
import com.secondhand.mapper.ProductMapper;
import com.secondhand.mapper.UserMapper;
import com.secondhand.service.ProductService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ProductServiceImpl implements ProductService {

    private final ProductMapper productMapper;
    private final UserMapper userMapper;
    private final OrderMapper orderMapper;
    private final ProductListingHistoryMapper listingHistoryMapper;

    @Override
    public PageResult<Product> pageList(String name, Long categoryId, String minPrice,
                                         String maxPrice, String sortBy, int page, int size) {
        int offset = (page - 1) * size;
        List<Product> records = productMapper.selectByCondition(
                name, categoryId, minPrice, maxPrice, sortBy, offset, size);
        long total = productMapper.countByCondition(name, categoryId, minPrice, maxPrice);
        return PageResult.of(records, total, page, size);
    }

    @Override
    public Product getById(Long id) {
        Product product = productMapper.selectById(id);
        if (product == null) {
            throw new RuntimeException("商品不存在");
        }
        return product;
    }

    @Override
    public Map<String, Object> getDetail(Long id) {
        Product product = productMapper.selectById(id);
        if (product == null) {
            throw new RuntimeException("商品不存在");
        }
        // 增加浏览次数
        productMapper.incrementViewCount(id);

        // 查询卖家信息
        User seller = userMapper.selectById(product.getUserId());
        Map<String, Object> sellerInfo = new LinkedHashMap<>();
        if (seller != null) {
            sellerInfo.put("id", seller.getId());
            sellerInfo.put("username", seller.getUsername());
            sellerInfo.put("nickname", seller.getNickname());
            sellerInfo.put("avatar", seller.getAvatar());
            sellerInfo.put("phone", seller.getPhone() != null ? seller.getPhone().replaceAll("(\\d{3})\\d{4}(\\d{4})", "$1****$2") : null);
        }
        // 统计卖家在售商品数量
        int sellerProductCount = productMapper.countBySellerId(product.getUserId());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("product", product);
        result.put("seller", sellerInfo);
        result.put("sellerProductCount", sellerProductCount);
        return result;
    }

    @Override
    public void add(Product product) {
        // 发布时余量 = 总数量，默认至少1
        if (product.getQuantity() == null || product.getQuantity() < 1) {
            product.setQuantity(1);
        }
        product.setRemaining(product.getQuantity());
        product.setSoldCount(0);
        product.setStatus(1);
        productMapper.insert(product);
        // 记录首次上架
        ProductListingHistory history = new ProductListingHistory();
        history.setProductId(product.getId());
        history.setListingTime(LocalDateTime.now());
        listingHistoryMapper.insert(history);
    }

    @Override
    public void update(Product product, Long userId) {
        Product exist = productMapper.selectById(product.getId());
        if (exist == null) {
            throw new RuntimeException("商品不存在");
        }
        // userId 为 null 表示管理员操作，跳过归属校验
        if (userId != null && !exist.getUserId().equals(userId)) {
            throw new RuntimeException("无权编辑此商品");
        }
        // 如果用户修改了库存（quantity），余量按比例调整
        if (product.getQuantity() != null) {
            int oldQuantity = exist.getQuantity() != null ? exist.getQuantity() : 1;
            int oldRemaining = exist.getRemaining() != null ? exist.getRemaining() : oldQuantity;
            int sold = oldQuantity - oldRemaining; // 已售数量
            int newQuantity = product.getQuantity();
            int newRemaining = Math.max(0, newQuantity - sold);
            product.setRemaining(newRemaining);
            // 余量归零：库存也归零，自动下架
            if (newRemaining <= 0) {
                product.setQuantity(0);
                product.setRemaining(0);
                product.setStatus(0);
            }
        }
        productMapper.updateById(product);
    }

    @Override
    public void delete(Long id, Long userId) {
        Product exist = productMapper.selectById(id);
        if (exist == null) {
            throw new RuntimeException("商品不存在");
        }
        // userId 为 null 表示管理员操作，跳过归属校验
        if (userId != null && !exist.getUserId().equals(userId)) {
            throw new RuntimeException("无权删除此商品");
        }
        productMapper.deleteById(id);
    }

    @Override
    public void toggleStatus(Long id, Long userId) {
        Product exist = productMapper.selectById(id);
        if (exist == null) {
            throw new RuntimeException("商品不存在");
        }
        if (!exist.getUserId().equals(userId)) {
            throw new RuntimeException("无权操作此商品");
        }
        int newStatus = exist.getStatus() == 1 ? 0 : 1;
        // 上架时检查是否有余量
        if (newStatus == 1 && (exist.getRemaining() == null || exist.getRemaining() <= 0)) {
            throw new RuntimeException("商品已售罄，无法上架。请补充数量后再上架");
        }
        Product update = new Product();
        update.setId(id);
        update.setStatus(newStatus);
        productMapper.updateById(update);
        // 上架时记录历史
        if (newStatus == 1) {
            ProductListingHistory history = new ProductListingHistory();
            history.setProductId(id);
            history.setListingTime(LocalDateTime.now());
            listingHistoryMapper.insert(history);
        }
    }

    @Override
    public PageResult<Product> myProducts(Long userId, Integer status, int page, int size) {
        int offset = (page - 1) * size;
        List<Product> records = productMapper.selectByUserId(userId, status, offset, size);
        long total = productMapper.countByUserId(userId, status);
        return PageResult.of(records, total, page, size);
    }

    @Override
    public PageResult<Product> getSellerProducts(Long sellerId, int page, int size) {
        int offset = (page - 1) * size;
        List<Product> records = productMapper.selectByUserId(sellerId, 1, offset, size);
        long total = productMapper.countByUserId(sellerId, 1);
        return PageResult.of(records, total, page, size);
    }

    @Override
    public void batchDelete(List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            throw new RuntimeException("请选择要删除的商品");
        }
        productMapper.deleteBatchIds(ids);
    }

    @Override
    public void batchUpdateStatus(List<Long> ids, Integer status) {
        if (ids == null || ids.isEmpty()) {
            throw new RuntimeException("请选择商品");
        }
        if (status == null || (status != 0 && status != 1)) {
            throw new RuntimeException("无效的状态值");
        }
        for (Long id : ids) {
            productMapper.updateProductStatus(id, status);
        }
    }

    @Override
    public boolean decrementRemaining(Long productId, int count) {
        Product product = productMapper.selectById(productId);
        if (product == null) return false;
        int newRemaining = (product.getRemaining() == null ? 0 : product.getRemaining()) - count;
        if (newRemaining < 0) newRemaining = 0;
        int newSold = (product.getSoldCount() == null ? 0 : product.getSoldCount()) + count;
        Product update = new Product();
        update.setId(productId);
        update.setRemaining(newRemaining);
        update.setSoldCount(newSold);
        // 售罄：数量归零，自动下架
        if (newRemaining <= 0) {
            update.setQuantity(0);
            update.setRemaining(0);
            update.setStatus(0);
        }
        productMapper.updateById(update);
        return newRemaining <= 0;
    }

    @Override
    public List<Map<String, Object>> getListingHistory(Long productId) {
        List<ProductListingHistory> records = listingHistoryMapper.selectByProductId(productId);
        List<Map<String, Object>> result = new ArrayList<>();
        for (ProductListingHistory h : records) {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", h.getId());
            map.put("productId", h.getProductId());
            map.put("listingTime", h.getListingTime().toString());
            result.add(map);
        }
        return result;
    }

    @Override
    public Map<String, Object> getSellerOverview(Long userId) {
        // 商品
        int productsTotal = (int) productMapper.countByUserId(userId, null);
        int productsToday = productMapper.countTodayByUserId(userId);
        int productsWeek = productMapper.countRecent7DaysByUserId(userId);
        int active = (int) productMapper.countByUserId(userId, 1);
        int soldOut = productMapper.countSoldOutByUserId(userId);
        int offShelf = productMapper.countOffShelfByUserId(userId);

        // 订单
        int ordersTotal = orderMapper.countBySellerId(userId);
        int ordersToday = orderMapper.countTodayBySellerId(userId);
        int ordersWeek = orderMapper.countRecent7DaysBySellerId(userId);

        // 流水GMV（已完成订单）
        BigDecimal gmvTotal = orderMapper.sumRevenueBySellerId(userId);
        BigDecimal gmvToday = orderMapper.sumGmvTodayBySellerId(userId);
        BigDecimal gmvWeek = orderMapper.sumRevenue7DaysBySellerId(userId);

        Map<String, Object> overview = new LinkedHashMap<>();
        overview.put("products", buildCounts(productsTotal, productsToday, productsWeek));
        overview.put("active", active);
        overview.put("soldOut", soldOut);
        overview.put("offShelf", offShelf);
        overview.put("orders", buildCounts(ordersTotal, ordersToday, ordersWeek));
        overview.put("revenue", buildRevenue(gmvTotal, gmvToday, gmvWeek));
        return overview;
    }

    @Override
    public Map<String, Object> getAdminOverview() {
        // 商品
        int productsTotal = productMapper.countAll();
        int productsToday = productMapper.countToday();
        int productsWeek = productMapper.countRecent7Days();

        // 订单
        int ordersTotal = orderMapper.countAll();
        int ordersToday = orderMapper.countToday();
        int ordersWeek = orderMapper.countRecent7Days();

        // 用户
        int usersTotal = userMapper.countAll();
        int usersToday = userMapper.countToday();
        int usersWeek = userMapper.countRecent7Days();

        // 商户
        int merchantsTotal = userMapper.countMerchants();

        // 流水GMV（已完成订单）
        BigDecimal gmvTotal = orderMapper.sumAllRevenue();
        BigDecimal gmvToday = orderMapper.sumGmvToday();
        BigDecimal gmvWeek = orderMapper.sumRevenue7Days();

        Map<String, Object> overview = new LinkedHashMap<>();
        overview.put("products", buildCounts(productsTotal, productsToday, productsWeek));
        overview.put("orders", buildCounts(ordersTotal, ordersToday, ordersWeek));
        overview.put("users", buildCounts(usersTotal, usersToday, usersWeek));
        overview.put("merchants", buildCounts(merchantsTotal, 0, 0));
        overview.put("revenue", buildRevenue(gmvTotal, gmvToday, gmvWeek));
        return overview;
    }

    /** 构建 {total, today, week} 结构 */
    private Map<String, Object> buildCounts(int total, int today, int week) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("total", total);
        m.put("today", today);
        m.put("week", week);
        return m;
    }

    /** 构建收入结构：流水GMV、平台收入(10%)、商户收入(90%) */
    private Map<String, Object> buildRevenue(BigDecimal gmvTotal, BigDecimal gmvToday, BigDecimal gmvWeek) {
        Map<String, Object> rev = new LinkedHashMap<>();
        rev.put("total", buildRevItem(gmvTotal));
        rev.put("today", buildRevItem(gmvToday));
        rev.put("week", buildRevItem(gmvWeek));
        return rev;
    }

    private Map<String, Object> buildRevItem(BigDecimal gmv) {
        BigDecimal platform = gmv.multiply(new BigDecimal("0.10"));
        BigDecimal merchant = gmv.multiply(new BigDecimal("0.90"));
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("gmv", gmv);
        item.put("platform", platform);
        item.put("merchant", merchant);
        return item;
    }
}
