# 闲小铺 - 二手商品交易平台

基于 Spring Boot 3 + MyBatis-Plus + MySQL 的二手商品交易平台，前端采用原生 HTML/CSS/JS 实现的 SPA 单页应用。

---

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 后端框架 | Spring Boot | 3.2.0 |
| ORM | MyBatis-Plus | 3.5.5 |
| 数据库 | MySQL | 8.x |
| 文件存储 | 阿里云 OSS | - |
| API 文档 | Knife4j (Swagger) | 4.4.0 |
| 密码加密 | BCrypt (Spring Security Crypto) | - |
| 构建工具 | Maven | - |
| 前端 | 原生 HTML + CSS + JavaScript | - |
| JDK | Java 17 | - |

---

## 项目结构

```
Second-hand/
├── sql/
│   ├── init.sql                        # 数据库完整建表脚本（首次部署用）
│   └── migration.sql                   # 数据库迁移脚本（从旧版升级用）
├── src/main/java/com/secondhand/
│   ├── SecondHandApplication.java      # Spring Boot 启动类
│   ├── common/                         # 公共组件
│   │   ├── Result.java                 # 统一响应格式 {code, message, data}
│   │   ├── PageResult.java             # 分页结果封装
│   │   ├── SecurityConfig.java         # BCrypt 密码加密器 Bean
│   │   ├── GlobalExceptionHandler.java # 全局异常处理器
│   │   ├── DataInitializer.java        # 启动时初始化管理员账户和分类数据
│   │   └── PortPrinter.java            # 启动端口打印工具
│   ├── entity/                         # 实体类（对应 8 张数据库表）
│   │   ├── User.java                   # 用户
│   │   ├── Product.java                # 商品（含多图 JSON 解析、库存管理）
│   │   ├── Category.java               # 分类（树形结构，通过 parent_id 关联）
│   │   ├── Cart.java                   # 购物车
│   │   ├── Order.java                  # 订单
│   │   ├── OrderItem.java              # 订单明细
│   │   ├── Favorite.java               # 收藏
│   │   └── ProductListingHistory.java  # 商品上架历史（用于最新发布排序）
│   ├── mapper/                         # MyBatis Mapper 接口
│   │   ├── UserMapper.java
│   │   ├── ProductMapper.java
│   │   ├── CategoryMapper.java
│   │   ├── CartMapper.java
│   │   ├── OrderMapper.java
│   │   ├── OrderItemMapper.java
│   │   ├── FavoriteMapper.java
│   │   └── ProductListingHistoryMapper.java
│   ├── service/                        # 业务逻辑层
│   │   ├── UserService.java / UserServiceImpl.java
│   │   ├── ProductService.java / ProductServiceImpl.java
│   │   ├── CategoryService.java / CategoryServiceImpl.java
│   │   ├── CartService.java / CartServiceImpl.java
│   │   ├── OrderService.java / OrderServiceImpl.java
│   │   ├── FavoriteService.java / FavoriteServiceImpl.java
│   │   └── OssService.java            # 阿里云 OSS 文件上传服务
│   └── controller/                     # REST 控制器
│       ├── UserController.java         # 用户注册/登录/个人信息
│       ├── ProductController.java      # 商品 CRUD + 分页搜索
│       ├── OrderController.java        # 订单管理
│       ├── CartController.java         # 购物车增删改查
│       ├── FavoriteController.java     # 收藏功能
│       ├── CategoryController.java     # 分类管理（管理员端）
│       ├── PublicCategoryController.java # 分类查询（公开接口）
│       └── UploadController.java       # 图片上传
├── src/main/resources/
│   ├── application.yml                 # 主配置文件
│   ├── mapper/                         # MyBatis XML 映射文件
│   │   ├── CartMapper.xml
│   │   ├── FavoriteMapper.xml
│   │   ├── OrderMapper.xml
│   │   └── ProductMapper.xml
│   └── static/                         # 前端静态资源
│       ├── index.html                  # 入口页面
│       ├── css/style.css               # 全局样式（CSS 变量 + 响应式）
│       └── js/
│           ├── api.js                  # API 通信层（封装所有后端请求）
│           └── app.js                  # 前端主逻辑（SPA 路由、状态管理、视图渲染）
└── pom.xml                             # Maven 依赖配置
```

---

## 快速启动

### 1. 环境准备

- JDK 17+
- MySQL 8.x
- Maven 3.6+

### 2. 创建数据库

```bash
mysql -u root -p
CREATE DATABASE second_hand DEFAULT CHARACTER SET utf8mb4;
USE second_hand;
SOURCE sql/init.sql;
```

> **首次部署**执行 `init.sql` 即可完成所有表的创建。
>
> **从旧版升级**（已有数据需保留时）则执行 `migration.sql`，它仅做增量变更，不会丢失已有数据：
> ```bash
> mysql -u root -p second_hand < sql/migration.sql
> ```

### 3. 修改配置

编辑 `src/main/resources/application.yml`：

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/second_hand?useUnicode=true&characterEncoding=utf-8&serverTimezone=Asia/Shanghai
    username: root
    password: 你的MySQL密码      # 改为你的实际密码
```

> 如果暂时不需要图片上传功能，可以忽略 OSS 配置；需要时请将 `oss.*` 下的值替换为你的阿里云 OSS 实际参数。

### 4. 启动项目

```bash
mvn spring-boot:run
# 或直接在 IDE 中运行 SecondHandApplication.main()
```

### 5. 访问

| 地址 | 说明 |
|------|------|
| http://localhost:8080 | 前端首页 |
| http://localhost:8080/swagger-ui.html | API 文档（Knife4j） |

### 6. 默认账户

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | admin | admin123 |
| 普通用户 | 自行注册 | - |

---

## 后端架构详解

### 分层架构

```
Controller 层（接收请求、参数校验、调用 Service）
    │
    ▼
Service 层（业务逻辑、事务控制）
    │
    ▼
Mapper 层（数据库访问，MyBatis-Plus BaseMapper + 自定义 SQL）
    │
    ▼
MySQL 数据库
```

### 数据模型（ER 关系）

```
user ──1:N──> product              （用户发布多个商品）
user ──1:N──> cart                 （一个用户购物车多个商品）
user ──1:N──> favorite             （一个用户收藏多个商品）
user ──1:N──> order(buyer)        （一个买家有多个订单）
user ──1:N──> order(seller)       （一个卖家有多个订单）
product ──N:1──> category         （商品属于一个分类）
product ──1:N──> product_listing_history  （商品多次上架记录）
category ──自关联──> parent_id    （分类树形结构）
order ──1:N──> order_item         （一个订单多个明细）
```

### 核心业务流

#### 订单状态流转

```
待付款 (0) ──付款──> 已付款 (1) ──发货──> 已发货 (2) ──确认──> 已完成 (3)
    │
    └── 取消 ──> 已取消 (4)
```

#### 下单流程（按卖家拆单）

```
1. 查询用户购物车
2. 过滤已售/下架商品，校验不能买自己的商品
3. 按卖家 ID 分组
4. 每个卖家生成一个独立订单
5. 批量创建订单 + 订单明细
6. 清空购物车
```

整个过程用 `@Transactional` 保证事务一致性，任何一步失败都会回滚。

### 统一响应格式

所有接口返回 JSON 格式如下：

```json
{
  "code": 200,         // 200 成功，500 失败
  "message": "操作成功",
  "data": { ... }      // 具体数据
}
```

由 `common/Result.java` 统一封装。

### 鉴权机制

- 注册/登录成功 → 服务端生成 token 字符串存入 `user.token` 字段 → 返回给前端
- 前端存到 `localStorage`
- 后续请求在 HTTP Header 中携带 `token` 字段
- 服务端通过拦截 Controller 方法中的 `@RequestHeader("token")` 获取 token，然后调用 `UserService.getByToken()` 校验

```java
// 典型的鉴权写法（在各 Controller 中）
User user = getLoginUser(token);  // 从 token 获取用户，token 无效则抛异常
```

---

## 前后端互联详解

### 整体架构

```
 ┌─────────────────────────────────────────────────────────┐
 │                     浏览器                                │
 │  ┌──────────┐    ┌──────────┐    ┌────────────────────┐ │
 │  │ index.html│───>│  app.js  │───>│     api.js         │ │
 │  │  (DOM)    │    │ (路由+渲染)│   │  (fetch 封装)       │ │
 │  └──────────┘    └──────────┘    └────────┬───────────┘ │
 └───────────────────────────────────────────┼─────────────┘
                                              │ fetch()
                   同源（都在 localhost:8080）  │
 ┌───────────────────────────────────────────┼─────────────┐
 │              Spring Boot 服务器                          │
 │  ┌────────────────┐    ┌────────────┐    ┌────────────┐ │
 │  │   Controller   │───>│  Service   │───>│   Mapper    │ │
 │  │  (接收请求)      │    │ (业务逻辑)   │    │  (数据库)    │ │
 │  └────────────────┘    └────────────┘    └────────────┘ │
 └─────────────────────────────────────────────────────────┘
```

因为前端文件放在 `src/main/resources/static/` 下，Spring Boot 默认将其作为静态资源提供，所以前后端运行在**同一端口**，不存在跨域问题。

### 核心文件职责

| 文件 | 职责 |
|------|------|
| `static/index.html` | 页面骨架（导航栏、主内容区容器、弹窗容器） |
| `static/js/api.js` | HTTP 请求封装，按模块组织所有后端接口调用 |
| `static/js/app.js` | SPA 路由、全局状态管理、视图渲染逻辑 |

### 一、API 通信层（api.js）

核心是 `request()` 方法，封装了所有 fetch 调用：

```javascript
async function request(method, path, body = null, needToken = false) {
    const headers = { 'Content-Type': 'application/json' };
    if (needToken) {
        headers['token'] = AppState.getToken();   // 从全局状态取 token
    }
    const res = await fetch(path, { method, headers, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.code !== 200) throw new Error(data.message);
    return data;
}
```

然后将所有后端接口按模块封装为 `API` 对象：

```javascript
const API = {
    User: {
        login: (u, p)    => post('/api/user/login', { username: u, password: p }),
        register: (...)  => post('/api/user/register', {...}),
        me: ()           => get('/api/user/me', true),   // true = 需要 token
        // ...
    },
    Product: {
        list: (...)  => get('/api/product/list?...'),
        getById: id  => get(`/api/product/${id}`),
        publish: data => post('/api/product', data, true),
        // ...
    },
    Cart:    { add, list, updateQuantity, remove },
    Order:   { submit, list, cancel, pay, ... },
    Favorite:{ add, remove, check, list },
    Category:{ list, adminList, add, ... },
    Upload:  { image, images },
};
```

### 二、鉴权数据流

```
注册/登录:
  前端: API.User.login(username, password)
        → POST /api/user/login  Body: {"username":"...","password":"..."}
  后端: UserController.login()
        → UserService.login() → 校验密码(BCrypt) → 生成 token → 存库 → 返回 User{token}
  前端: AppState.setAuth(user, token) → 存入 localStorage

鉴权请求:
  前端: API.Order.submit({address, remark})
        → POST /api/order/submit  Header: {"token": "abc123"}
  后端: OrderController.submit(@RequestHeader("token") token)
        → getLoginUser(token) → UserService.getByToken(token) → 验证
```

### 三、页面渲染如何触发 API

`app.js` 中采用 SPA 路由模式，基于 URL hash 切换页面：

```javascript
const router = {
    navigate(view) {
        this._current = view;
        this.render();   // 根据当前视图调用对应的渲染函数
    },
    render() {
        switch (this._current) {
            case 'home':   renderHome();   break;   // 首页 + 商品列表
            case 'cart':   renderCart();   break;   // 购物车
            case 'orders': renderOrders(); break;   // 我的订单
            case 'publish':renderPublish();break;   // 发布商品
            // ...
        }
    }
};
```

每个 `renderXxx()` 函数的典型流程：

```
1. 设置 mainContent.innerHTML = HTML 骨架
2. 调用 API 模块获取数据（如 API.Product.list(...)）
3. 拿到数据后遍历生成 DOM 卡片，插入页面
4. 绑定按钮事件（点击、筛选、分页等）
```

以首页加载商品为例：

```javascript
async function loadProducts(page) {
    const res = await API.Product.list(
        currentNameFilter, currentCategoryFilter,
        currentMinPrice, currentMaxPrice, currentSortBy,
        page, currentPageSize
    );
    // res.data.records 是商品数组
    // 遍历生成商品卡片 DOM 插入 #productGrid
}
```

### 四、文件上传的特殊处理

与普通 JSON 请求不同，上传文件使用 `FormData` 且不设置 `Content-Type`（让浏览器自动生成 `multipart/form-data` 边界）：

```javascript
// api.js 中的 uploadFile()
async function uploadFile(path, file, needToken = false) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(path, { method: 'POST', headers, body: formData });
    // ...
}
```

后端接收：

```java
// UploadController.java
@PostMapping("/api/upload/image")
public Result<Map<String, String>> uploadImage(
        @RequestHeader("token") String token,
        @RequestParam("file") MultipartFile file) {
    String url = ossService.uploadImage(file);
    return Result.success(Map.of("url", url));
}
```

### 五、完整接口对照表

| 前端调用 | HTTP 方法 | 路径 | 后端 Controller 方法 | 是否需要登录 |
|----------|-----------|------|---------------------|:---:|
| `API.User.register()` | POST | `/api/user/register` | `UserController.register()` | ❌ |
| `API.User.login()` | POST | `/api/user/login` | `UserController.login()` | ❌ |
| `API.User.me()` | GET | `/api/user/me` | `UserController.me()` | ✅ |
| `API.User.updateProfile()` | PUT | `/api/user/profile` | `UserController.updateProfile()` | ✅ |
| `API.Product.list()` | GET | `/api/product/list` | `ProductController.list()` | ❌ |
| `API.Product.getById()` | GET | `/api/product/{id}` | `ProductController.getById()` | ❌ |
| `API.Product.publish()` | POST | `/api/product` | `ProductController.add()` | ✅ |
| `API.Cart.add()` | POST | `/api/cart/add` | `CartController.add()` | ✅ |
| `API.Cart.list()` | GET | `/api/cart/list` | `CartController.list()` | ✅ |
| `API.Order.submit()` | POST | `/api/order/submit` | `OrderController.submit()` | ✅ |
| `API.Order.pay()` | PUT | `/api/order/{id}/pay` | `OrderController.pay()` | ✅ |
| `API.Order.cancel()` | PUT | `/api/order/{id}/cancel` | `OrderController.cancel()` | ✅ |
| `API.Favorite.add()` | POST | `/api/favorite/add` | `FavoriteController.add()` | ✅ |
| `API.Favorite.list()` | GET | `/api/favorite/list` | `FavoriteController.list()` | ✅ |
| `API.Category.list()` | GET | `/api/category/list` | `PublicCategoryController.list()` | ❌ |
| `API.Upload.image()` | POST | `/api/upload/image` | `UploadController.uploadImage()` | ✅ |

---

## 关键设计决策

### 1. 按卖家拆单
提交订单时，购物车中的商品按卖家分组，不同卖家的商品生成不同订单。这更符合真实二手交易场景（每个卖家独立发货）。

### 2. 库存管理
商品支持 `quantity`（总数量）、`remaining`（剩余数量）、`sold_count`（累计售出）三个字段管理库存。每次下单成功扣减 `remaining`，归零时商品状态自动变为已售/下架。通过 `product_listing_history` 表记录每次重新上架的时间，用于首页「最新发布」排序。

### 3. Token 认证
采用自定义 Header `token` 的方式传递认证信息，非标准 JWT。实现简单，适合小型项目，但缺乏过期机制和刷新机制。

### 4. 多图存储
商品的 `images` 字段以 JSON 数组字符串存储（如 `["url1.jpg","url2.jpg"]`），通过 `Product.getImageList()` 解析为 List。`imageUrl` 字段保留向后兼容（取多图第一张）。

### 5. 前端 SPA 无框架
前端未使用 Vue/React 等框架，纯原生 JS 实现。路由基于 hash 变化，状态管理通过 `AppState` 单例 + `localStorage` 持久化。优点是零依赖，缺点是代码量大时维护困难。

---

## 注意事项

1. **数据库密码**：部署前务必修改 `application.yml` 中的数据库密码，不要使用 `123456`
2. **OSS 配置**：需要图片上传功能时，替换 `application.yml` 中 `oss.*` 为自己的阿里云 OSS 参数，并将 Bucket 设为公共读
3. **Token 安全**：当前 token 无过期时间，生产环境建议改用 JWT 并设置有效期
4. **并发下单**：当前下单逻辑在高并发场景下可能需要额外加锁机制
