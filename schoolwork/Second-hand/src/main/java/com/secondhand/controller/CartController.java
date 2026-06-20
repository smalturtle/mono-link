package com.secondhand.controller;

import com.secondhand.common.Result;
import com.secondhand.entity.User;
import com.secondhand.service.CartService;
import com.secondhand.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/cart")
@RequiredArgsConstructor
public class CartController {

    private final CartService cartService;
    private final UserService userService;

    /** 添加商品到购物车 */
    @PostMapping("/add")
    public Result<?> add(@RequestHeader(value = "token", required = false) String token,
                         @RequestBody Map<String, Object> body) {
        User user = getLoginUser(token);
        Long productId = Long.valueOf(body.get("productId").toString());
        Integer quantity = body.get("quantity") != null
                ? Integer.valueOf(body.get("quantity").toString()) : 1;
        cartService.add(user.getId(), productId, quantity);
        return Result.success("已添加到购物车", null);
    }

    /** 查看购物车列表 */
    @GetMapping("/list")
    public Result<List<Map<String, Object>>> list(@RequestHeader(value = "token", required = false) String token) {
        User user = getLoginUser(token);
        List<Map<String, Object>> cartList = cartService.list(user.getId());
        return Result.success(cartList);
    }

    /** 更新购物车商品数量 */
    @PutMapping("/{id}")
    public Result<?> updateQuantity(@RequestHeader(value = "token", required = false) String token,
                                    @PathVariable Long id,
                                    @RequestBody Map<String, Object> body) {
        getLoginUser(token);
        Integer quantity = Integer.valueOf(body.get("quantity").toString());
        cartService.updateQuantity(id, quantity);
        return Result.success("更新成功", null);
    }

    /** 从购物车移除商品 */
    @DeleteMapping("/{id}")
    public Result<?> remove(@RequestHeader(value = "token", required = false) String token,
                            @PathVariable Long id) {
        getLoginUser(token);
        cartService.remove(id);
        return Result.success("已移除", null);
    }

    /** 获取当前登录用户 */
    private User getLoginUser(String token) {
        User user = userService.getByToken(token);
        if (user == null) {
            throw new RuntimeException("请先登录");
        }
        return user;
    }
}
