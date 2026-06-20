package com.secondhand.controller;

import com.secondhand.common.PageResult;
import com.secondhand.common.Result;
import com.secondhand.entity.Product;
import com.secondhand.entity.User;
import com.secondhand.service.ProductService;
import com.secondhand.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class ProductController {

    private final ProductService productService;
    private final UserService userService;

    // ==================== 前台用户端 ====================

    /** 商品列表（分页，支持名称、分类、价格区间、排序） */
    @GetMapping("/api/product/list")
    public Result<PageResult<Product>> list(@RequestParam(required = false) String name,
                                             @RequestParam(required = false) Long categoryId,
                                             @RequestParam(required = false) String minPrice,
                                             @RequestParam(required = false) String maxPrice,
                                             @RequestParam(required = false) String sortBy,
                                             @RequestParam(defaultValue = "1") int page,
                                             @RequestParam(defaultValue = "12") int size) {
        return Result.success(productService.pageList(
                name, categoryId, minPrice, maxPrice, sortBy, page, size));
    }

    /** 商品详情（含卖家信息，自动计次） */
    @GetMapping("/api/product/{id}")
    public Result<Map<String, Object>> getById(@PathVariable Long id) {
        return Result.success(productService.getDetail(id));
    }

    /** 卖家其他在售商品 */
    @GetMapping("/api/product/seller/{userId}")
    public Result<PageResult<Product>> sellerProducts(
            @PathVariable Long userId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "6") int size) {
        return Result.success(productService.getSellerProducts(userId, page, size));
    }

    // ==================== 用户发布商品 ====================

    /** 用户发布商品 */
    @PostMapping("/api/product")
    public Result<?> add(@RequestHeader(value = "token", required = false) String token,
                         @RequestBody Product product) {
        User user = getLoginUser(token);
        product.setUserId(user.getId());
        product.setStatus(1);
        productService.add(product);
        return Result.success("发布成功", null);
    }

    /** 用户更新自己的商品 */
    @PutMapping("/api/product/{id}")
    public Result<?> update(@RequestHeader(value = "token", required = false) String token,
                            @PathVariable Long id,
                            @RequestBody Product product) {
        User user = getLoginUser(token);
        product.setId(id);
        productService.update(product, user.getId());
        return Result.success("更新成功", null);
    }

    /** 用户删除自己的商品 */
    @DeleteMapping("/api/product/{id}")
    public Result<?> delete(@RequestHeader(value = "token", required = false) String token,
                            @PathVariable Long id) {
        User user = getLoginUser(token);
        productService.delete(id, user.getId());
        return Result.success("删除成功", null);
    }

    /** 用户上下架自己的商品 */
    @PutMapping("/api/product/{id}/status")
    public Result<?> toggleStatus(@RequestHeader(value = "token", required = false) String token,
                                   @PathVariable Long id) {
        User user = getLoginUser(token);
        productService.toggleStatus(id, user.getId());
        return Result.success("操作成功", null);
    }

    /** 我的发布列表 */
    @GetMapping("/api/product/my-list")
    public Result<PageResult<Product>> myList(@RequestHeader(value = "token", required = false) String token,
                                               @RequestParam(required = false) Integer status,
                                               @RequestParam(defaultValue = "1") int page,
                                               @RequestParam(defaultValue = "12") int size) {
        User user = getLoginUser(token);
        return Result.success(productService.myProducts(user.getId(), status, page, size));
    }

    /** 卖家个人概览 */
    @GetMapping("/api/product/overview")
    public Result<Map<String, Object>> sellerOverview(@RequestHeader(value = "token", required = false) String token) {
        User user = getLoginUser(token);
        return Result.success(productService.getSellerOverview(user.getId()));
    }

    // ==================== 后台管理系统 ====================

    /** 新增商品（管理员） */
    @PostMapping("/api/admin/product")
    public Result<?> adminAdd(@RequestHeader(value = "token", required = false) String token,
                              @RequestBody Product product) {
        User admin = getAdmin(token);
        product.setUserId(admin.getId());
        productService.add(product);
        return Result.success("新增成功", null);
    }

    /** 更新商品（管理员 - 仅允许修改状态、名称、描述、价格等审核字段，不允许修改数量） */
    @PutMapping("/api/admin/product/{id}")
    public Result<?> adminUpdate(@RequestHeader(value = "token", required = false) String token,
                                 @PathVariable Long id,
                                 @RequestBody Product product) {
        getAdmin(token);
        product.setId(id);
        // 管理员不允许修改数量和余量
        product.setQuantity(null);
        product.setRemaining(null);
        product.setUserId(null); // 不修改归属
        productService.update(product, null);
        return Result.success("更新成功", null);
    }

    /** 删除商品（管理员） */
    @DeleteMapping("/api/admin/product/{id}")
    public Result<?> adminDelete(@RequestHeader(value = "token", required = false) String token,
                                 @PathVariable Long id) {
        getAdmin(token);
        Product exist = productService.getById(id);
        productService.delete(id, exist.getUserId());
        return Result.success("删除成功", null);
    }

    /** 批量删除商品（管理员） */
    @DeleteMapping("/api/admin/product/batch")
    public Result<?> adminBatchDelete(@RequestHeader(value = "token", required = false) String token,
                                       @RequestBody Map<String, Object> body) {
        getAdmin(token);
        @SuppressWarnings("unchecked")
        List<Long> ids = ((List<Integer>) body.get("ids")).stream().map(Long::valueOf).toList();
        productService.batchDelete(ids);
        return Result.success("批量删除成功", null);
    }

    /** 批量更新商品状态（管理员） */
    @PutMapping("/api/admin/product/batch/status")
    public Result<?> adminBatchUpdateStatus(@RequestHeader(value = "token", required = false) String token,
                                             @RequestBody Map<String, Object> body) {
        getAdmin(token);
        @SuppressWarnings("unchecked")
        List<Long> ids = ((List<Integer>) body.get("ids")).stream().map(Long::valueOf).toList();
        Integer status = Integer.valueOf(body.get("status").toString());
        productService.batchUpdateStatus(ids, status);
        return Result.success("批量更新成功", null);
    }

    /** 查询商品上架历史记录（管理员） */
    @GetMapping("/api/admin/product/{id}/listing-history")
    public Result<List<Map<String, Object>>> listingHistory(@RequestHeader(value = "token", required = false) String token,
                                                             @PathVariable Long id) {
        getAdmin(token);
        return Result.success(productService.getListingHistory(id));
    }

    /** 管理员全局概览 */
    @GetMapping("/api/admin/overview")
    public Result<Map<String, Object>> adminOverview(@RequestHeader(value = "token", required = false) String token) {
        getAdmin(token);
        return Result.success(productService.getAdminOverview());
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
