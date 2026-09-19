# PulseBench — 性能测试框架设计文档

> 版本：v1.1（2026-09-19）
> 状态：设计阶段，未开始编码
> v1.0 → v1.1 变更见文末「变更记录」

---

## 1. 项目定位

**PulseBench** 是一个面向 API/HTTP 场景的**插件化性能测试框架**，目标是：

- 用 YAML 描述压测场景，降低 QA/开发上手成本
- Core 只负责调度与指标，**日志、报告、告警、监控**全部通过插件扩展
- 能接 CI/CD，threshold 失败时非零退出
- 第一版聚焦 HTTP；开放负载模型、WebSocket、gRPC、分布式 worker 留到后续版本

定位说明：**不是替代 k6**，而是「插件优先、集成友好、YAML 驱动」的轻量框架，方便按自己的 QA/DevOps 流程深度定制。

---

## 2. 目标用户与使用场景

| 用户 | 场景 |
|------|------|
| 开发 | 本地/预发接口压测、回归前冒烟 |
| QA | 固定 scenario 做性能基线、对比版本 |
| DevOps | CI 中跑压测、threshold 卡点、报告归档 |
| SRE | 接 Prometheus/Grafana、告警联动 |

---

## 3. 功能需求

### 3.1 MVP（第一版必须做）

| 编号 | 需求 | 说明 |
|------|------|------|
| R1 | Scenario 驱动 | YAML 定义 base_url、并发、时长、步骤、超时 |
| R2 | HTTP 压测 | GET/POST，headers/body，连接池按并发数配置 |
| R3 | 负载模型（closed model） | 虚拟用户、duration、ramp-up、think-time；语义见 §7.1 |
| R4 | 指标采集 | RPS、错误率、p50/p95/p99、min/max；稳态窗口与全程分开统计 |
| R5 | 断言 | status、单请求 max_latency；与错误的关系见 §7.3 |
| R6 | Threshold | 稳态窗口的 p95、error_rate，失败 exit code = 2 |
| R7 | 插件机制 | on_run_start / on_request / on_run_end，**异步事件总线分发**（见 §6.3） |
| R8 | 内置插件 | Console 实时输出、JSON 报告、结构化日志 |
| R9 | CLI | `pulsebench run scenario.yaml` |
| R10 | 文档 | 快速开始、架构、插件开发指南 |

### 3.2 P1（第二版）

- **开放负载模型（constant arrival rate）executor**——决定框架能否做容量测试，优先级最高
- HTML 报告（图表）
- 变量提取与步骤间传参（`${token}`）
- CSV 数据驱动（多账号/token 池）
- GitHub Actions 集成模板
- Prometheus metrics exporter

### 3.3 P2（第三版）

- WebSocket / gRPC Executor（插件式）
- 分布式 worker（master/worker）
- Webhook 告警（钉钉/Slack/飞书）
- InfluxDB / Elasticsearch 日志投递

---

## 4. 非功能需求

| 类别 | 要求 |
|------|------|
| 性能 | 单机 1k+ 并发连接（HTTP keep-alive，连接池按 users 配置） |
| 测量保真 | 插件不得阻塞压测循环；事件丢弃须计数并在报告中呈现 |
| 可扩展 | 新集成只加 Plugin，不改 Core；Plugin 接口位于公开包 |
| 可观测 | 每次请求可 JSONL 落盘，run 级 summary |
| 可移植 | 单二进制分发，无运行时依赖 |
| 可测试 | scenario 解析、metrics 聚合、threshold 判定三个纯逻辑模块单测覆盖率 > 80% |
| CI 友好 | threshold 失败 → exit 2，运行错误 → exit 1 |

---

## 5. 技术选型

### 5.1 为什么选 Go

| 维度 | Go | Python (Locust) | Node (Artillery) | Java (JMeter) |
|------|-----|-----------------|------------------|---------------|
| 并发模型 | goroutine，原生适合压测 | GIL 限制 | 事件循环，中等 | 线程重，资源占用高 |
| 分发 | 单二进制 | 需 Python 环境 | 需 Node | JVM |
| 生态 | k6/vegeta 同类 | Locust 成熟 | Artillery 成熟 | 企业常见但偏重 |
| CI 集成 | 极好 | 好 | 好 | 一般 |

**结论：Core 用 Go**——和 k6、vegeta 同路线，适合高并发 + 单文件部署。

### 5.2 技术栈明细

| 层级 | 选型 | 理由 |
|------|------|------|
| 语言 | **Go 1.22+** | 并发、部署、性能 |
| CLI | **Cobra** | Go CLI 事实标准 |
| 配置 | **YAML**（gopkg.in/yaml.v3） | QA 可读 |
| HTTP | **net/http** + 自定义 Transport | 标准库；**必须调大 `MaxIdleConnsPerHost`**（默认 2，会让高并发退化为排队），按 `users` 数配置 |
| 延迟分位 | **hdrhistogram-go** | 固定内存、任意分位、合并友好（为分布式预留）；实现成本与排序法相当，直接采用，不做二次迁移 |
| 日志 | **log/slog** JSON | Go 1.21+ 标准，接 ELK/Loki |
| 测试 | **go test** + testify（可选） | 标准工具链 |
| 构建 | **Makefile** + **GoReleaser**（P1） | 跨平台 release |

Scenario 格式不引入 JS（不像 k6），第一版保持**纯 YAML**。

---

## 6. 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                      CLI (pulsebench)                    │
│              run | version | plugin list (P1)            │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│                    Scenario Loader                       │
│           YAML → 校验 → Scenario 对象                     │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│                     Load Engine                          │
│   Scheduler (ramp-up) → Virtual Users → Executor         │
└───────┬──────────────────────────────────────┬──────────┘
        │                                      │
┌───────▼────────┐                   ┌─────────▼─────────┐
│ HTTP Executor  │                   │ Metrics Collector │
│ (可插拔)        │                   │ RPS / 分位 / 错误率 │
└───────┬────────┘                   └─────────┬─────────┘
        │      RequestResult                   │
        └──────────────┬───────────────────────┘
                       ▼
        ┌──────────────────────────────┐
        │   Event Bus (buffered chan)  │   ← VU 非阻塞投递
        └──────────────┬───────────────┘
                       │ 独立 goroutine 消费
┌──────────────────────▼──────────────────────────────────┐
│                   Plugin Registry                        │
│  console | json_report | structlog | prometheus | ...    │
└─────────────────────────────────────────────────────────┘
```

### 6.1 核心模块职责

| 模块 | 职责 | 不应做 |
|------|------|--------|
| **scenario** | 解析/校验 YAML | 不发请求 |
| **engine** | 调度 VU、生命周期、稳态窗口划分、threshold | 不解析 HTTP |
| **executor** | 协议层执行（HTTP 等）、超时控制 | 不做聚合统计 |
| **metrics** | 采集、分位计算、summary（稳态/全程双份） | 不写文件 |
| **eventbus** | RequestResult 异步分发、背压与丢弃计数 | 不含业务逻辑 |
| **plugin** | 扩展点接口定义（公开包） | 不含实现 |
| **plugins/** | 具体集成实现 | 不侵入 engine |

### 6.2 Plugin 接口（扩展契约）

```
Plugin
├── Name() string
├── Init(config map[string]any) error      // 接收 YAML plugins: 段的配置
├── OnRunStart(ctx, runContext)
├── OnRequest(ctx, runContext, requestResult)   // 经事件总线异步调用
└── OnRunEnd(ctx, runContext, summary)          // 同步调用，保证报告落盘后才退出
```

**包位置**：接口放公开包 `pkg/plugin/`（不是 `internal/`），否则第三方无法 import，与「只实现 Plugin 即可扩展」的核心卖点矛盾。

**外部插件加载策略（现在定，暂不实现）**：

- MVP/P1：插件**编译进二进制**（内置 + fork 后自行添加）。Go 原生 `plugin` 机制在 macOS/交叉编译下不可用，不采用。
- P2 如确有进程外插件需求，采用 **hashicorp/go-plugin**（子进程 + RPC）。在此之前，文档中对「第三方扩展」的表述统一为「fork 或 import 后注册编译」。

### 6.3 事件总线（MVP 必做，非优化项）

同步调用插件 hook 会让插件耗时（尤其写盘）计入压测循环，污染测量结果。因此：

- VU 完成请求后只做两件事：更新 Metrics Collector（内存操作，纳秒级）、把 `RequestResult` 投入 **buffered channel**（非阻塞 send）
- 独立的 dispatcher goroutine 消费 channel，依次调用各插件的 `OnRequest`
- **背压策略**：channel 满时丢弃事件并原子计数；`OnRunEnd` 的 summary 中报告 `dropped_events` 数量。Metrics Collector 不经过总线，**指标永远不丢**，丢的只是插件侧的逐请求事件（如 JSONL 日志行）
- channel 容量默认 4096，可通过 scenario 配置

---

## 7. 关键语义定义（v1.1 新增章节）

### 7.1 负载模型：closed model 及其含义

MVP 采用**闭环模型**：固定 `users` 个虚拟用户循环执行步骤。这意味着：

- **RPS 是因变量**：被测服务变慢时，VU 的发送速率自动下降。适合「N 个并发用户下系统表现如何」的问题
- **不适合容量测试**：无法表达「以固定 500 RPS 打压」。这是 coordinated omission 问题的温和形态——服务劣化时施压强度反而减弱
- 文档与报告中须明确标注负载模型，避免用户误读 RPS 数字
- P1 增加 **open model（constant arrival rate）executor**，其优先级高于 WebSocket 支持

### 7.2 稳态窗口与 threshold 统计范围

- 一次 run 分为两段：**ramp-up 段**（0 → ramp_up 结束）与**稳态段**（ramp_up 结束 → duration 结束）
- **threshold 只对稳态段样本判定**（冷启动的连接建立、缓存预热不应导致 CI 误卡）
- 报告中两段指标**分开呈现**，全程汇总另附

### 7.3 错误分类与 error_rate 定义

| 类别 | 例子 | 计入 error_rate | 单独计数 |
|------|------|:---:|------|
| 网络/传输错误 | 超时、连接拒绝、DNS 失败 | ✅ | `network_errors` |
| status 断言失败 | 期望 200 实际 500 | ✅ | `status_failures` |
| latency 断言失败 | 响应成功但超过 max_latency | ❌（是「慢」不是「错」） | `assert_failures` |

`thresholds.error_rate` 按前两类之和 / 总请求数计算。三类计数均出现在报告中。

---

## 8. Scenario 规范

```yaml
name: api-smoke                 # 必填
base_url: https://api.example   # 必填

load:                           # 必填
  duration: 60s                 # 总时长（含 ramp-up）
  ramp_up: 10s                  # 用户线性爬坡；threshold 只统计其后的稳态段
  users: 50                     # 并发虚拟用户数

timeout:                        # v1.1 新增，必填其一，缺省 request: 10s
  request: 5s                   # 单请求超时（可被 step 级覆盖）

think_time: 200ms               # 可选，每轮步骤间隔

plugins:                        # v1.1 新增，可选：插件启用与配置
  console: {}
  json_report:
    out_dir: reports
  logger:
    log_dir: logs

steps:                          # 必填，至少 1 步
  - name: list_items
    request:
      method: GET
      url: /api/items
      headers: {}
      body: ""
      timeout: 2s               # 可选，覆盖全局
    assert:
      status: 200
      max_latency: 500ms        # 失败计入 assert_failures，不计入 error_rate

thresholds:                     # 可选，用于 CI 卡点；只对稳态段判定
  p95_latency: 800ms
  error_rate: 0.01              # 网络错误 + status 断言失败
```

**P1 扩展字段（预留）：** `extract`（响应变量提取）、`data_source`（CSV）、`tags`（报告分组）、`load.mode: arrival_rate`。

---

## 9. 输出物规范

| 输出 | 路径 | 格式 | 用途 |
|------|------|------|------|
| 终端摘要 | stderr | 文本 | 实时观察 |
| 结构化日志 | `logs/{run_id}.jsonl` | JSON Lines | 慢请求排查、接 ELK |
| 运行报告 | `reports/{run_id}.json` | JSON | CI 归档、自动化对比 |
| HTML 报告 | `reports/{run_id}.html` | HTML（P1） | 人读 |

**run_id 格式：** `YYYYMMDD-HHMMSS-<4位随机>`，时区固定 **UTC**。随机后缀避免 CI 并行 job 冲突。

报告 JSON 中必含：负载模型标注、稳态/全程两份指标、三类错误计数、`dropped_events`。

---

## 10. CLI 需求

```bash
# MVP
pulsebench run scenarios/smoke.yaml
pulsebench run scenario.yaml --out reports --log-dir logs
pulsebench run scenario.yaml --no-report
pulsebench version

# P1
pulsebench plugin list
pulsebench report show reports/20260919-050000-a3f2.json
```

**退出码：**

| Code | 含义 |
|------|------|
| 0 | 成功且 threshold 通过 |
| 1 | scenario 解析/运行错误 |
| 2 | threshold 未通过（CI 可区分） |

---

## 11. 目录结构（设计参考）

```
pulsebench/
├── cmd/pulsebench/          # CLI 入口
├── pkg/
│   └── plugin/              # Plugin 接口（公开，供第三方 import）
├── internal/
│   ├── scenario/            # YAML 解析与校验
│   ├── engine/              # 调度引擎、稳态窗口、threshold
│   ├── metrics/             # 指标聚合（HDR histogram）
│   ├── eventbus/            # 异步事件分发
│   ├── executor/http/       # HTTP 执行器（Transport 调优、超时）
│   └── plugins/             # 内置插件实现
│       ├── console/
│       ├── jsonreport/
│       └── logger/
├── scenarios/               # 示例场景
├── docs/
│   ├── architecture.md
│   ├── quickstart.md
│   ├── scenario-spec.md
│   └── plugins.md
├── go.mod
├── Makefile
└── README.md
```

---

## 12. 集成路线图

| 阶段 | 集成 | 优先级 | 依赖 |
|------|------|--------|------|
| MVP | Console / JSON Report / slog JSONL | P0 | — |
| MVP | 事件总线 | P0 | — |
| P1 | Open model (arrival rate) | 高 | engine 抽象 |
| P1 | HTML Report | 高 | JSON Report |
| P1 | Prometheus | 高 | metrics |
| P1 | GitHub Actions 模板 | 高 | exit code |
| P2 | Webhook 告警 | 中 | run_end hook |
| P2 | InfluxDB | 中 | logger plugin |
| P2 | WebSocket Executor | 中 | executor 抽象 |
| P3 | 分布式 Worker | 低 | gRPC 控制面、HDR 合并 |

---

## 13. 验收标准（MVP Done 定义）

1. 一条 YAML scenario 可对**本地 test server**（Go `httptest`，随仓库提供）跑通 60s 压测；httpbin 只作为文档示例，不作为验收依赖
2. 终端输出 RPS、p95、错误率（稳态段）
3. 生成 JSON 报告 + JSONL 日志，报告含稳态/全程双指标与三类错误计数
4. threshold 超限返回 exit code 2；解析错误返回 1
5. 插件写盘阻塞时压测循环不受影响（`dropped_events` 递增而非 RPS 下降）——需有验证手段
6. 文档含：安装、第一个 scenario、插件开发示例
7. scenario 解析、分位计算、threshold 判定单测覆盖率 > 80%

---

## 14. 风险与对策

| 风险 | 对策 |
|------|------|
| 重复造 k6 轮子 | MVP 只做 HTTP + 插件，不追求全功能 |
| closed model 误读为容量测试 | 报告标注负载模型；P1 优先做 arrival rate |
| 插件拖慢压测循环 | 事件总线 + 丢弃计数（MVP 落地，见 §6.3） |
| 连接池成为瓶颈 | Transport 按 users 配置，压测前 self-check 输出配置 |
| YAML 表达力不足 | P1 加 extract / data_source |
| 「可扩展」宣传与 Go 插件现实的落差 | 明确 fork/import 编译模式；P2 再评估 go-plugin |

---

## 15. 文档清单（后续编写）

| 文档 | 内容 |
|------|------|
| `README.md` | 项目介绍、Quick Start、命令示例 |
| `docs/architecture.md` | 架构图、模块职责、事件总线、数据流 |
| `docs/scenario-spec.md` | YAML 字段完整说明、错误分类、稳态窗口语义 |
| `docs/plugins.md` | Plugin 接口、内置插件、自定义示例、编译接入方式 |
| `docs/integrations.md` | Prometheus/CI/Webhook 接入指南 |
| `docs/roadmap.md` | P1/P2/P3 排期 |

---

## 变更记录

### v1.1（2026-09-19）

1. **事件总线升为 MVP 必做**（原为 P1 风险对策）：同步插件 hook 会污染测量结果；新增 §6.3，明确背压/丢弃/指标不丢语义
2. **负载模型语义显式化**（新增 §7.1）：MVP 为 closed model，RPS 是因变量；open model 提为 P1 最高优先级
3. **threshold 只统计稳态段**（新增 §7.2）：ramp-up 段与稳态段分开呈现
4. **错误分类定义**（新增 §7.3）：latency 断言失败不计入 error_rate
5. **Scenario 增加 `timeout` 与 `plugins:` 配置段**；明确 `MaxIdleConnsPerHost` 须按并发调优
6. **Plugin 接口移到 `pkg/plugin/` 公开包**；定下外部插件为编译接入，P2 再评估 go-plugin；接口增加 `Init(config)`
7. run_id 改为 `UTC + 4 位随机后缀`
8. 分位计算直接采用 hdrhistogram-go，取消「先排序法后迁移」
9. 覆盖率目标限定为三个纯逻辑模块
10. 验收标准改用本地 test server，去除对 httpbin 的依赖；新增插件阻塞不影响压测的验收项
