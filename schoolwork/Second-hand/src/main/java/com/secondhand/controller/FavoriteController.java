package com.secondhand.controller;

import com.secondhand.common.Result;
import com.secondhand.entity.User;
import com.secondhand.service.FavoriteService;
import com.secondhand.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/favorite")
@RequiredArgsConstructor
public class FavoriteController {

    private final FavoriteService favoriteService;
    private final UserService userService;

    /** 添加收藏 */
    @PostMapping("/add")
    public Result<?> add(@RequestHeader(value = "token", required = false) String token,
                         @RequestBody Map<String, Object> body) {
        User user = getLoginUser(token);
        Long productId = Long.valueOf(body.get("productId").toString());
        favoriteService.add(user.getId(), productId);
        return Result.success("收藏成功", null);
    }

    /** 取消收藏 */
    @DeleteMapping("/remove/{productId}")
    public Result<?> remove(@RequestHeader(value = "token", required = false) String token,
                            @PathVariable Long productId) {
        User user = getLoginUser(token);
        favoriteService.remove(user.getId(), productId);
        return Result.success("已取消收藏", null);
    }

    /** 检查是否已收藏 */
    @GetMapping("/check/{productId}")
    public Result<Boolean> check(@RequestHeader(value = "token", required = false) String token,
                                  @PathVariable Long productId) {
        User user = getLoginUser(token);
        return Result.success(favoriteService.isFavorited(user.getId(), productId));
    }

    /** 我的收藏列表 */
    @GetMapping("/list")
    public Result<List<Map<String, Object>>> list(@RequestHeader(value = "token", required = false) String token) {
        User user = getLoginUser(token);
        return Result.success(favoriteService.list(user.getId()));
    }

    private User getLoginUser(String token) {
        User user = userService.getByToken(token);
        if (user == null) {
            throw new RuntimeException("请先登录");
        }
        return user;
    }
}
