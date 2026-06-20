package com.secondhand.service;

import com.secondhand.common.PageResult;
import com.secondhand.entity.Product;
import com.secondhand.entity.User;
import com.secondhand.mapper.ProductMapper;
import com.secondhand.mapper.UserMapper;
import com.secondhand.service.impl.ProductServiceImpl;
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
import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * ProductService 单元测试
 * 覆盖: 商品查询 / 价格计算 / 库存校验 / 正常值 / 边界值 / 异常输入 / 空值 / Mock依赖
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("商品服务单元测试")
class ProductServiceTest {

    @Mock
    private ProductMapper productMapper;

    @Mock
    private UserMapper userMapper;

    @InjectMocks
    private ProductServiceImpl productService;

    private Product mockProduct;
    private User mockUser;

    @BeforeEach
    void setUp() {
        mockProduct = new Product();
        mockProduct.setId(1L);
        mockProduct.setName("测试商品");
        mockProduct.setDescription("这是一个测试商品");
        mockProduct.setPrice(new BigDecimal("99.99"));
        mockProduct.setCategoryId(1L);
        mockProduct.setUserId(100L);
        mockProduct.setStatus(1);
        mockProduct.setCondition("几乎全新");
        mockProduct.setViewCount(0L);
        mockProduct.setCreateTime(LocalDateTime.now());

        mockUser = new User();
        mockUser.setId(100L);
        mockUser.setUsername("seller1");
        mockUser.setNickname("卖家昵称");
        mockUser.setPhone("13800138000");
    }

    // ==================== 商品分页列表测试 ====================

    @Nested
    @DisplayName("商品分页列表")
    class PageListTests {

        @Test
        @DisplayName("TC-PROD-001: 正常查询 - 无筛选条件分页")
        void shouldReturnPagedListWithoutFilters() {
            List<Product> products = List.of(mockProduct);
            when(productMapper.selectByCondition(isNull(), isNull(), isNull(), isNull(), isNull(), eq(0), eq(12)))
                    .thenReturn(products);
            when(productMapper.countByCondition(isNull(), isNull(), isNull(), isNull()))
                    .thenReturn(1L);

            PageResult<Product> result = productService.pageList(null, null, null, null, null, 1, 12);

            assertNotNull(result);
            assertEquals(1, result.getTotal());
            assertEquals(1, result.getRecords().size());
            assertEquals(1, result.getPage());
            assertEquals(12, result.getSize());
        }

        @Test
        @DisplayName("TC-PROD-002: 正常查询 - 按价格区间筛选")
        void shouldFilterByPriceRange() {
            when(productMapper.selectByCondition(
                    isNull(), isNull(), eq("10"), eq("200"), isNull(), eq(0), eq(12)))
                    .thenReturn(List.of(mockProduct));
            when(productMapper.countByCondition(isNull(), isNull(), eq("10"), eq("200")))
                    .thenReturn(1L);

            PageResult<Product> result = productService.pageList(null, null, "10", "200", null, 1, 12);

            assertNotNull(result);
            assertEquals(1, result.getTotal());
            verify(productMapper).selectByCondition(isNull(), isNull(), eq("10"), eq("200"), isNull(), eq(0), eq(12));
        }

        @Test
        @DisplayName("TC-PROD-003: 边界值 - 空结果集")
        void shouldReturnEmptyWhenNoProducts() {
            when(productMapper.selectByCondition(any(), any(), any(), any(), any(), anyInt(), anyInt()))
                    .thenReturn(Collections.emptyList());
            when(productMapper.countByCondition(any(), any(), any(), any()))
                    .thenReturn(0L);

            PageResult<Product> result = productService.pageList(null, null, null, null, null, 1, 12);

            assertNotNull(result);
            assertEquals(0, result.getTotal());
            assertTrue(result.getRecords().isEmpty());
        }

        @Test
        @DisplayName("TC-PROD-004: 边界值 - 第二页查询（offset计算验证）")
        void shouldCalculateOffsetCorrectly() {
            when(productMapper.selectByCondition(isNull(), isNull(), isNull(), isNull(), isNull(), eq(24), eq(12)))
                    .thenReturn(Collections.emptyList());
            when(productMapper.countByCondition(isNull(), isNull(), isNull(), isNull()))
                    .thenReturn(0L);

            PageResult<Product> result = productService.pageList(null, null, null, null, null, 3, 12);

            assertNotNull(result);
            verify(productMapper).selectByCondition(isNull(), isNull(), isNull(), isNull(), isNull(), eq(24), eq(12));
        }

        @Test
        @DisplayName("TC-PROD-005: 正常查询 - 按名称模糊搜索")
        void shouldSearchByName() {
            when(productMapper.selectByCondition(eq("手机"), isNull(), isNull(), isNull(), isNull(), eq(0), eq(12)))
                    .thenReturn(List.of(mockProduct));
            when(productMapper.countByCondition(eq("手机"), isNull(), isNull(), isNull()))
                    .thenReturn(1L);

            PageResult<Product> result = productService.pageList("手机", null, null, null, null, 1, 12);

            assertEquals(1, result.getTotal());
        }
    }

    // ==================== 商品详情测试 ====================

    @Nested
    @DisplayName("商品详情")
    class DetailTests {

        @Test
        @DisplayName("TC-PROD-006: 正常获取 - 商品存在，返回详情含卖家信息")
        void shouldReturnDetailWithSellerInfo() {
            when(productMapper.selectById(1L)).thenReturn(mockProduct);
            when(userMapper.selectById(100L)).thenReturn(mockUser);
            when(productMapper.countBySellerId(100L)).thenReturn(5);

            Map<String, Object> result = productService.getDetail(1L);

            assertNotNull(result);
            assertNotNull(result.get("product"));
            assertNotNull(result.get("seller"));
            assertEquals(5, result.get("sellerProductCount"));
            verify(productMapper).incrementViewCount(1L);
        }

        @Test
        @DisplayName("TC-PROD-007: 异常输入 - 商品不存在")
        void shouldThrowWhenProductNotFound() {
            when(productMapper.selectById(999L)).thenReturn(null);

            RuntimeException ex = assertThrows(RuntimeException.class, () ->
                    productService.getDetail(999L));

            assertEquals("商品不存在", ex.getMessage());
        }

        @Test
        @DisplayName("TC-PROD-008: 正常获取 - 卖家信息不存在时仍返回商品")
        void shouldReturnProductWhenSellerNotFound() {
            when(productMapper.selectById(1L)).thenReturn(mockProduct);
            when(userMapper.selectById(100L)).thenReturn(null);
            when(productMapper.countBySellerId(100L)).thenReturn(0);

            Map<String, Object> result = productService.getDetail(1L);

            assertNotNull(result);
            assertNotNull(result.get("product"));
            // 实际代码中 seller 字段始终是一个 Map（即使 seller 为 null 时也是空 Map）
            assertNotNull(result.get("seller"));
            assertTrue(((Map<?, ?>) result.get("seller")).isEmpty());
        }
    }

    // ==================== 商品发布测试 ====================

    @Nested
    @DisplayName("商品发布")
    class AddTests {

        @Test
        @DisplayName("TC-PROD-009: 正常发布 - 完整商品信息")
        void shouldAddProductSuccessfully() {
            when(productMapper.insert(any(Product.class))).thenReturn(1);

            assertDoesNotThrow(() -> productService.add(mockProduct));

            verify(productMapper).insert(mockProduct);
        }

        @Test
        @DisplayName("TC-PROD-010: 边界值 - 价格为零的商品")
        void shouldHandleZeroPrice() {
            mockProduct.setPrice(BigDecimal.ZERO);
            when(productMapper.insert(any(Product.class))).thenReturn(1);

            assertDoesNotThrow(() -> productService.add(mockProduct));

            verify(productMapper).insert(argThat(p -> p.getPrice().compareTo(BigDecimal.ZERO) == 0));
        }

        @Test
        @DisplayName("TC-PROD-011: 边界值 - 极大价格")
        void shouldHandleVeryLargePrice() {
            mockProduct.setPrice(new BigDecimal("99999999.99"));
            when(productMapper.insert(any(Product.class))).thenReturn(1);

            assertDoesNotThrow(() -> productService.add(mockProduct));
        }
    }

    // ==================== 商品删除测试 ====================

    @Nested
    @DisplayName("商品删除")
    class DeleteTests {

        @Test
        @DisplayName("TC-PROD-012: 正常删除 - 本人删除自己的商品")
        void shouldDeleteOwnProduct() {
            when(productMapper.selectById(1L)).thenReturn(mockProduct);
            when(productMapper.deleteById(1L)).thenReturn(1);

            assertDoesNotThrow(() -> productService.delete(1L, 100L));

            verify(productMapper).deleteById(1L);
        }

        @Test
        @DisplayName("TC-PROD-013: 异常输入 - 无权删除他人商品")
        void shouldThrowWhenDeletingOthersProduct() {
            when(productMapper.selectById(1L)).thenReturn(mockProduct);

            RuntimeException ex = assertThrows(RuntimeException.class, () ->
                    productService.delete(1L, 200L));

            assertEquals("无权删除此商品", ex.getMessage());
            verify(productMapper, never()).deleteById(anyLong());
        }

        @Test
        @DisplayName("TC-PROD-014: 异常输入 - 商品不存在")
        void shouldThrowWhenProductNotExist() {
            when(productMapper.selectById(999L)).thenReturn(null);

            RuntimeException ex = assertThrows(RuntimeException.class, () ->
                    productService.delete(999L, 100L));

            assertEquals("商品不存在", ex.getMessage());
        }
    }

    // ==================== 商品状态切换测试 ====================

    @Nested
    @DisplayName("商品上下架")
    class ToggleStatusTests {

        @Test
        @DisplayName("TC-PROD-015: 正常切换 - 在售→下架")
        void shouldToggleFromOnSaleToOffSale() {
            mockProduct.setStatus(1);
            when(productMapper.selectById(1L)).thenReturn(mockProduct);
            when(productMapper.updateById(any(Product.class))).thenReturn(1);

            assertDoesNotThrow(() -> productService.toggleStatus(1L, 100L));

            verify(productMapper).updateById(argThat(p -> p.getStatus() == 0));
        }

        @Test
        @DisplayName("TC-PROD-016: 正常切换 - 下架→在售")
        void shouldToggleFromOffSaleToOnSale() {
            mockProduct.setStatus(0);
            when(productMapper.selectById(1L)).thenReturn(mockProduct);
            when(productMapper.updateById(any(Product.class))).thenReturn(1);

            assertDoesNotThrow(() -> productService.toggleStatus(1L, 100L));

            verify(productMapper).updateById(argThat(p -> p.getStatus() == 1));
        }

        @Test
        @DisplayName("TC-PROD-017: 异常输入 - 无权操作他人商品")
        void shouldThrowWhenToggleOthersProduct() {
            when(productMapper.selectById(1L)).thenReturn(mockProduct);

            RuntimeException ex = assertThrows(RuntimeException.class, () ->
                    productService.toggleStatus(1L, 200L));

            assertEquals("无权操作此商品", ex.getMessage());
        }
    }
}
