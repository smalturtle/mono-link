# PulseBench

插件优先、YAML 驱动的轻量 HTTP 性能测试框架。Core 只负责调度与指标,日志、报告、告警等全部通过插件扩展,适合接入 CI/CD(threshold 失败时非零退出)。

> 定位:不是替代 k6,而是方便按自己 QA/DevOps 流程深度定制的轻量框架。设计详见 [DESIGN.md](DESIGN.md)。

## 特性(MVP)

- **YAML 场景**:base_url、并发、时长、ramp-up、步骤、超时、断言
- **闭环负载模型(closed model)**:固定虚拟用户数循环施压;RPS 是因变量,**不是容量测试**(open model 在 P1)
- **指标**:RPS、错误率、p50/p95/p99/min/max(HDR histogram);**稳态窗口与全程分开统计**
- **Threshold CI 卡点**:只对 ramp-up 之后的稳态段判定;失败 exit code = 2
- **异步事件总线**:插件写盘阻塞不影响压测循环,事件溢出丢弃并计数(`dropped_events`),指标永不丢
- **内置插件**:console 实时输出、JSON 报告、slog JSONL 结构化日志

## 快速开始

```bash
# 构建
make build

# 终端 1:启动随仓库提供的本地测试服务器
./bin/testserver

# 终端 2:跑压测
./bin/pulsebench run scenarios/smoke.yaml
```

结束后:

- 终端输出稳态段与全程的 RPS / 分位 / 错误率
- `reports/<run_id>.json` — 运行报告(CI 归档)
- `logs/<run_id>.jsonl` — 逐请求结构化日志(接 ELK/Loki)

常用参数:

```bash
pulsebench run scenario.yaml --out reports --log-dir logs
pulsebench run scenario.yaml --no-report
pulsebench version
```

## 第一个 scenario

```yaml
name: api-smoke
base_url: http://localhost:8080

load:
  duration: 60s
  ramp_up: 10s        # threshold 只统计其后的稳态段
  users: 50

timeout:
  request: 5s

steps:
  - name: list_items
    request:
      method: GET
      url: /api/items
    assert:
      status: 200
      max_latency: 500ms   # 超时计入 assert_failures,不计入 error_rate

thresholds:
  p95_latency: 800ms
  error_rate: 0.01         # 网络错误 + status 断言失败
```

完整字段说明见 [docs/scenario-spec.md](docs/scenario-spec.md)。

## 退出码

| Code | 含义 |
|------|------|
| 0 | 成功且 threshold 通过 |
| 1 | scenario 解析/运行错误 |
| 2 | threshold 未通过(CI 可区分) |

## 文档

- [docs/quickstart.md](docs/quickstart.md) — 安装与第一次压测
- [docs/architecture.md](docs/architecture.md) — 架构、事件总线、数据流
- [docs/scenario-spec.md](docs/scenario-spec.md) — YAML 字段、错误分类、稳态窗口语义
- [docs/plugins.md](docs/plugins.md) — 插件接口与自定义插件开发

## 开发

```bash
make test    # 全部测试(含 -race)
make cover   # 三个纯逻辑模块的覆盖率(目标 > 80%)
make vet
```
