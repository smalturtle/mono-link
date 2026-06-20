-- =====================================================
-- 闲小铺（Second-hand）数据库完整初始化脚本
-- =====================================================
-- 执行方式（方案一：命令行导入）:
--   mysql -u root -p < sql/init.sql
--
-- 执行方式（方案二：进入 MySQL 后执行）:
--   mysql -u root -p
--   SOURCE sql/init.sql;
-- =====================================================

-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS second_hand
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_unicode_ci;

USE second_hand;

-- =====================================================
-- 1. 用户表
-- =====================================================
CREATE TABLE IF NOT EXISTS user (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '用户ID（主键）',
    username    VARCHAR(50)  NOT NULL UNIQUE          COMMENT '用户名（登录用，唯一）',
    nickname    VARCHAR(50)                           COMMENT '昵称（显示名称）',
    password    VARCHAR(200) NOT NULL                 COMMENT '密码（BCrypt 加密存储）',
    phone       VARCHAR(20)                           COMMENT '手机号',
    avatar      VARCHAR(500)                          COMMENT '头像图片 URL',
    role        VARCHAR(20)  DEFAULT 'user'           COMMENT '角色: user=普通用户, admin=管理员',
    status      INT          DEFAULT 1                COMMENT '状态: 1=正常, 0=禁用',
    create_time DATETIME     DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间',
    token       VARCHAR(200)                          COMMENT '登录 token（会话标识）'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- =====================================================
-- 2. 分类表（商品分类，支持两级树形层级）
-- =====================================================
CREATE TABLE IF NOT EXISTS category (
    id        BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '分类ID（主键）',
    name      VARCHAR(100) NOT NULL             COMMENT '分类名称',
    parent_id BIGINT       DEFAULT 0            COMMENT '父分类ID，0 表示顶级分类'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品分类表（两级树形结构）';

-- =====================================================
-- 3. 商品表
-- =====================================================
CREATE TABLE IF NOT EXISTS product (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '商品ID（主键）',
    name        VARCHAR(200)   NOT NULL           COMMENT '商品名称',
    description TEXT                               COMMENT '商品描述',
    price       DECIMAL(10,2)  NOT NULL            COMMENT '售价（元）',
    image_url   VARCHAR(500)                       COMMENT '主图 URL（兼容旧版单图）',
    images      TEXT                               COMMENT '多图 URL（JSON 数组格式）',
    category_id BIGINT                             COMMENT '所属分类ID',
    user_id     BIGINT                             COMMENT '卖家用户ID',
    status      INT            DEFAULT 1           COMMENT '状态: 1=在售, 0=已售/下架',
    `condition` VARCHAR(50)    DEFAULT '几乎全新'   COMMENT '成色: 全新, 几乎全新, 轻微使用痕迹, 明显使用痕迹',
    view_count  BIGINT         DEFAULT 0           COMMENT '浏览次数',
    quantity    INT            DEFAULT 1           COMMENT '总数量（发布时填写）',
    remaining   INT            DEFAULT 1           COMMENT '剩余数量（售出扣减，归零自动下架）',
    sold_count  INT            DEFAULT 0           COMMENT '历史累计售出数量',
    create_time DATETIME       DEFAULT CURRENT_TIMESTAMP COMMENT '发布时间',
    INDEX idx_category (category_id),
    INDEX idx_user (user_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品表';

-- =====================================================
-- 4. 购物车表
-- =====================================================
CREATE TABLE IF NOT EXISTS cart (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '购物车记录ID（主键）',
    user_id     BIGINT   NOT NULL                 COMMENT '用户ID',
    product_id  BIGINT   NOT NULL                 COMMENT '商品ID',
    quantity    INT      DEFAULT 1                COMMENT '购买数量',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '加入时间',
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='购物车表';

-- =====================================================
-- 5. 订单表
-- =====================================================
CREATE TABLE IF NOT EXISTS orders (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '订单ID（主键）',
    order_no     VARCHAR(32)   NOT NULL            COMMENT '订单编号（唯一标识）',
    buyer_id     BIGINT        NOT NULL            COMMENT '买家用户ID',
    seller_id    BIGINT        NOT NULL            COMMENT '卖家用户ID',
    total_amount DECIMAL(10,2) NOT NULL            COMMENT '订单总金额',
    status       INT           DEFAULT 0           COMMENT '状态: 0=待付款, 1=已付款, 2=已发货, 3=已完成, 4=已取消',
    address      VARCHAR(500)                      COMMENT '收货地址',
    remark       VARCHAR(500)                      COMMENT '买家备注',
    create_time  DATETIME      DEFAULT CURRENT_TIMESTAMP       COMMENT '下单时间',
    update_time  DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
    UNIQUE KEY uk_order_no (order_no),
    INDEX idx_buyer (buyer_id),
    INDEX idx_seller (seller_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单表';

-- =====================================================
-- 6. 订单明细表
-- =====================================================
CREATE TABLE IF NOT EXISTS order_item (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '明细ID（主键）',
    order_id      BIGINT        NOT NULL            COMMENT '所属订单ID',
    product_id    BIGINT        NOT NULL            COMMENT '商品ID',
    product_name  VARCHAR(200)  NOT NULL            COMMENT '商品名称（下单快照）',
    product_image VARCHAR(500)                      COMMENT '商品图片（下单快照）',
    price         DECIMAL(10,2) NOT NULL            COMMENT '单件价格（下单快照）',
    quantity      INT           DEFAULT 1           COMMENT '购买数量',
    INDEX idx_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单明细表';

-- =====================================================
-- 7. 收藏表
-- =====================================================
CREATE TABLE IF NOT EXISTS favorite (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '收藏记录ID（主键）',
    user_id     BIGINT   NOT NULL                 COMMENT '用户ID',
    product_id  BIGINT   NOT NULL                 COMMENT '商品ID',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '收藏时间',
    UNIQUE KEY uk_user_product (user_id, product_id),
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='收藏表';

-- =====================================================
-- 8. 商品上架历史记录表
--    记录每次商品重新上架的时间，用于首页「最新发布」排序
-- =====================================================
CREATE TABLE IF NOT EXISTS product_listing_history (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '记录ID（主键）',
    product_id   BIGINT   NOT NULL                 COMMENT '商品ID',
    listing_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '上架时间',
    INDEX idx_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品上架历史记录表';