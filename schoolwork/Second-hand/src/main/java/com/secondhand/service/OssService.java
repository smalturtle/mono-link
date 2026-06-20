package com.secondhand.service;

import com.aliyun.oss.OSS;
import com.aliyun.oss.OSSClientBuilder;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.util.UUID;

/**
 * 阿里云 OSS 文件上传服务
 */
@Slf4j
@Service
public class OssService {

    @Value("${oss.endpoint}")
    private String endpoint;

    @Value("${oss.access-key-id}")
    private String accessKeyId;

    @Value("${oss.access-key-secret}")
    private String accessKeySecret;

    @Value("${oss.bucket-name}")
    private String bucketName;

    private String baseUrl;

    @PostConstruct
    public void init() {
        // 构建文件访问基础URL
        this.baseUrl = "https://" + bucketName + "." + endpoint + "/";
    }

    /**
     * 上传图片到 OSS
     * @param file 前端传来的图片文件
     * @return 图片的公网访问URL
     */
    public String uploadImage(MultipartFile file) {
        // 校验配置
        if (accessKeyId.startsWith("your-")) {
            throw new RuntimeException("请先在 application.yml 中配置阿里云 OSS 参数");
        }

        // 生成唯一文件名，保留原始扩展名
        String originalName = file.getOriginalFilename();
        String ext = "";
        if (originalName != null && originalName.contains(".")) {
            ext = originalName.substring(originalName.lastIndexOf("."));
        }
        String objectName = "products/" + UUID.randomUUID().toString().replace("-", "") + ext;

        OSS ossClient = null;
        try (InputStream inputStream = file.getInputStream()) {
            ossClient = new OSSClientBuilder().build(endpoint, accessKeyId, accessKeySecret);
            ossClient.putObject(bucketName, objectName, inputStream);
            log.info("图片上传成功: {}", objectName);
            return baseUrl + objectName;
        } catch (Exception e) {
            log.error("OSS 上传失败", e);
            throw new RuntimeException("图片上传失败: " + e.getMessage());
        } finally {
            if (ossClient != null) {
                ossClient.shutdown();
            }
        }
    }
}
