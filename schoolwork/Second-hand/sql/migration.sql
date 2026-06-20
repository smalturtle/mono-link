-- =====================================================
-- 闲小铺 数据库迁移脚本
-- 适用场景：从 v1.0 升级到 v1.1（增量变更）
-- 如果首次部署，直接执行 init.sql 即可，无需此脚本
-- =====================================================
-- 执行方式:
--   mysql -u root -p second_hand < migration.sql
-- =====================================================

-- =====================================================
-- 1. 商品表：补充多图字段（images）
--    从单图升级到多图支持
-- =====================================================
ALTER TABLE product
    ADD COLUMN IF NOT EXISTS images TEXT
    COMMENT '多图 URL（JSON 数组格式）' AFTER image_url;

-- =====================================================
-- 2. 商品表：补充成色字段（condition）
-- =====================================================
ALTER TABLE product
    ADD COLUMN IF NOT EXISTS `condition` VARCHAR(50) DEFAULT '几乎全新'
    COMMENT '成色: 全新, 几乎全新, 轻微使用痕迹, 明显使用痕迹' AFTER status;

-- =====================================================
-- 3. 商品表：补充浏览次数（view_count）
-- =====================================================
ALTER TABLE product
    ADD COLUMN IF NOT EXISTS view_count BIGINT DEFAULT 0
    COMMENT '浏览次数' AFTER `condition`;

-- =====================================================
-- 4. 商品表：补充库存管理字段
--    quantity: 发布时填写的总数量
--    remaining: 当前剩余数量（售出扣减）
-- =====================================================
ALTER TABLE product
    ADD COLUMN IF NOT EXISTS quantity INT DEFAULT 1
    COMMENT '总数量（发布时填写）' AFTER view_count;

ALTER TABLE product
    ADD COLUMN IF NOT EXISTS remaining INT DEFAULT 1
    COMMENT '剩余数量（售出扣减，归零自动下架）' AFTER quantity;

-- 将存量数据的 remaining 初始化为 quantity
UPDATE product SET remaining = quantity WHERE remaining IS NULL;

-- =====================================================
-- 5. 商品表：补充历史累计售出数量（sold_count）
-- =====================================================
ALTER TABLE product
    ADD COLUMN IF NOT EXISTS sold_count INT DEFAULT 0
    COMMENT '历史累计售出数量' AFTER remaining;

-- 初始化存量数据的 sold_count
UPDATE product SET sold_count = quantity - remaining
WHERE remaining IS NOT NULL AND quantity IS NOT NULL;

-- =====================================================
-- 6. 创建商品上架历史记录表
--    用于记录每次上架时间，支持首页「最新发布」排序
-- =====================================================
CREATE TABLE IF NOT EXISTS product_listing_history (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '记录ID（主键）',
    product_id   BIGINT   NOT NULL                 COMMENT '商品ID',
    listing_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '上架时间',
    INDEX idx_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品上架历史记录表';

-- =====================================================
-- 7. 用户表：补充昵称（nickname）和头像（avatar）
-- =====================================================
ALTER TABLE user
    ADD COLUMN IF NOT EXISTS nickname VARCHAR(50)
    COMMENT '昵称（显示名称）' AFTER username;

ALTER TABLE user
    ADD COLUMN IF NOT EXISTS avatar VARCHAR(500)
    COMMENT '头像 URL' AFTER phone;

-- =====================================================
-- 8. 订单表：补充唯一索引（order_no）
--    确保订单编号全局唯一（如已有重复需先清理）
-- =====================================================
ALTER TABLE orders
    ADD INDEX IF NOT EXISTS idx_order_no (order_no);

-- =====================================================
-- 9. 商品表：补充常用查询索引
-- =====================================================
ALTER TABLE product
    ADD INDEX IF NOT EXISTS idx_category (category_id),
    ADD INDEX IF NOT EXISTS idx_user (user_id),
    ADD INDEX IF NOT EXISTS idx_status (status);

-- =====================================================
-- 10. 收藏表：补充用户索引
-- =====================================================
ALTER TABLE favorite
    ADD INDEX IF NOT EXISTS idx_user (user_id);

-- =====================================================
-- 11. 购物车表：补充用户索引
-- =====================================================
ALTER TABLE cart
    ADD INDEX IF NOT EXISTS idx_user (user_id);

-- =====================================================
-- 12. 订单表重命名（如果旧版使用了 `order` 表名）
--     注意：此操作仅在旧版表名为 `order` 时执行
-- =====================================================
-- RENAME TABLE IF EXISTS `order` TO `orders`;