package com.secondhand.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 用户实体类
 */
@Data
@TableName("user")
public class User {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String username;
    /** 昵称（用于展示） */
    private String nickname;
    private String password;
    private String phone;
    /** 头像URL */
    private String avatar;
    /** 角色: user-普通用户, admin-管理员 */
    private String role;
    /** 状态: 1-正常, 0-禁用 */
    private Integer status;
    private LocalDateTime createTime;
    private String token;
}
