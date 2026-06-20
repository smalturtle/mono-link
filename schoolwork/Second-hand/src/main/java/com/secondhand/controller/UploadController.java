package com.secondhand.controller;

import com.secondhand.common.Result;
import com.secondhand.entity.User;
import com.secondhand.service.OssService;
import com.secondhand.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 文件上传控制器
 */
@RestController
@RequiredArgsConstructor
public class UploadController {

    private final OssService ossService;
    private final UserService userService;

    /**
     * 上传图片到阿里云 OSS（需登录）
     * @return { url: "https://bucket.endpoint/products/xxx.jpg" }
     */
    @PostMapping("/api/upload/image")
    public Result<Map<String, String>> uploadImage(
            @RequestHeader(value = "token", required = false) String token,
            @RequestParam("file") MultipartFile file) {
        checkLogin(token);
        checkFile(file);
        String url = ossService.uploadImage(file);
        return Result.success(Map.of("url", url));
    }

    /**
     * 批量上传图片（支持多图，需登录）
     * @return { urls: ["url1", "url2", ...] }
     */
    @PostMapping("/api/upload/images")
    public Result<Map<String, Object>> uploadImages(
            @RequestHeader(value = "token", required = false) String token,
            @RequestParam("files") List<MultipartFile> files) {
        checkLogin(token);
        if (files == null || files.isEmpty()) {
            return Result.error("请选择图片文件");
        }
        List<String> urls = new ArrayList<>();
        for (MultipartFile file : files) {
            checkFile(file);
            urls.add(ossService.uploadImage(file));
        }
        return Result.success(Map.of("urls", urls));
    }

    private void checkLogin(String token) {
        User user = userService.getByToken(token);
        if (user == null) {
            throw new RuntimeException("请先登录");
        }
    }

    private void checkFile(MultipartFile file) {
        if (file.isEmpty()) {
            throw new RuntimeException("请选择图片文件");
        }
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new RuntimeException("只允许上传图片文件");
        }
    }
}
