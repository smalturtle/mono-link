# 架构

```
┌─────────────────────────────────────────────────────────┐
│                      CLI (pulsebench)                    │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│              Scenario Loader (internal/scenario)         │
│                YAML → 校验 → Scenario 对象                │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│               Load Engine (internal/engine)              │
│      Scheduler (ramp-up) → Virtual Users → Executor      │
└───────┬──────────────────────────────────────┬──────────┘
        │                                      │
┌───────▼────────┐                   ┌─────────▼─────────┐
│ HTTP Executor  │                   │ Metrics Collector │
│ (internal/     │                   │ (internal/metrics)│
│  executor/http)│                   │ 双窗口 HDR 直方图  │
└───────┬────────┘                   └─────────┬─────────┘
        │      RequestResult                   │
        └──────────────┬───────────────────────┘
                       ▼
        ┌──────────────────────────────┐
        │ Event Bus (internal/eventbus)│  ← VU 非阻塞投递
        └──────────────┬───────────────┘
                       │ 独立 goroutine 消费
┌──────────────────────▼──────────────────────────────────┐
│           Plugins: console | json_report | logger        │
└─────────────────────────────────────────────────────────┘
```

## 模块职责

| 模块 | 职责 | 不应做 |
|------|------|--------|
| `internal/scenario` | 解析/校验 YAML | 不发请求 |
| `internal/engine` | 调度 VU、生命周期、稳态窗口、threshold | 不解析 HTTP |
| `internal/executor/http` | 协议执行、超时、断言分类 | 不做聚合统计 |
| `internal/metrics` | 双窗口聚合、分位计算 | 不写文件 |
| `internal/eventbus` | 异步分发、背压与丢弃计数 | 不含业务逻辑 |
| `pkg/plugin` | 扩展点接口与数据类型(公开包) | 不含实现 |
| `internal/plugins/*` | 内置插件实现 | 不侵入 engine |

## 数据流与事件总线

每个虚拟用户(goroutine)完成一次请求后只做两件事:

1. `collector.Record(result)` — 互斥锁保护的内存操作,**指标永不丢失**
2. `bus.Publish(result)` — 对 buffered channel 的**非阻塞 send**

独立的 dispatcher goroutine 消费 channel,依次调用各插件的 `OnRequest`。channel 满(默认容量 4096,可用 `event_buffer` 配置)时事件被丢弃并原子计数,最终以 `dropped_events` 呈现在报告里。因此:

- 插件写盘再慢,也只会丢插件侧的逐请求事件(如 JSONL 日志行)
- RPS、分位、错误率等指标不受任何插件影响
- `OnRunEnd` 是同步调用,发生在 bus 排空之后,保证报告落盘后进程才退出

这一行为有专门的测试保障:`internal/engine.TestBlockedPluginDoesNotSlowLoadLoop` 用卡死的插件验证 `dropped_events` 递增而请求量不下降。

## 负载模型与窗口

- **closed model**:`users` 个 VU 循环执行 steps,`think_time` 为轮间隔。ramp-up 阶段 VU 按 `ramp_up * i / users` 线性错峰启动。
- 一次 run 分两段:**ramp-up 段**与**稳态段**(ramp-up 结束 → duration 结束)。每个 `RequestResult` 按发起时刻打上 `in_steady` 标记,collector 维护两套 HDR 直方图。
- **threshold 只对稳态段判定**,避免冷启动(连接建立、缓存预热)导致 CI 误卡。报告中两段指标分开呈现。

## 错误分类

| 类别 | 计入 error_rate | 报告字段 |
|------|:---:|------|
| 网络/传输错误(超时、拒连、DNS) | ✅ | `network_errors` |
| status 断言失败 | ✅ | `status_failures` |
| max_latency 断言失败(慢而不错) | ❌ | `assert_failures` |

## HTTP 连接池

标准库默认 `MaxIdleConnsPerHost = 2`,高并发下会退化为连接排队。Executor 按 `users` 配置 `MaxIdleConnsPerHost = users`、`MaxIdleConns = users*2`,并在 console 插件的启动横幅中输出该配置(self-check)。
