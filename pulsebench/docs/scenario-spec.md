# Scenario 规范

完整示例见 `scenarios/smoke.yaml`。未知字段会被拒绝(防止 key 拼写错误静默失效)。

```yaml
name: api-smoke                 # 必填
base_url: https://api.example   # 必填,http:// 或 https://

load:                           # 必填
  duration: 60s                 # 总时长(含 ramp-up),> 0
  ramp_up: 10s                  # 可选,默认 0;必须 < duration
  users: 50                     # 并发虚拟用户数,> 0

timeout:                        # 可选,缺省 request: 10s
  request: 5s                   # 单请求超时(可被 step 级覆盖)

think_time: 200ms               # 可选,每轮步骤之间的间隔

event_buffer: 4096              # 可选,事件总线容量,默认 4096

plugins:                        # 可选;整段省略时启用全部内置插件
  console:
    interval: 5s                # 进度输出间隔
  json_report:
    out_dir: reports
  logger:
    log_dir: logs

steps:                          # 必填,至少 1 步
  - name: list_items            # 必填
    request:
      method: GET               # GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS
      url: /api/items           # 必填,相对 base_url
      headers:                  # 可选
        Authorization: Bearer x
      body: ""                  # 可选
      timeout: 2s               # 可选,覆盖全局 timeout.request
    assert:                     # 可选
      status: 200               # 期望状态码;省略时 status >= 400 视为失败
      max_latency: 500ms        # 超过计入 assert_failures,不计入 error_rate

thresholds:                     # 可选,CI 卡点;只对稳态段判定
  p95_latency: 800ms            # 稳态 p95 <= 该值
  error_rate: 0.01              # (网络错误 + status 失败) / 总请求 <= 该值
```

## 语义说明

### 稳态窗口

一次 run 分为 **ramp-up 段**(0 → `ramp_up`)与**稳态段**(`ramp_up` → `duration`)。`thresholds` 只对稳态段样本判定;报告中两段指标分开呈现。

### 错误分类与 error_rate

| 类别 | 例子 | 计入 error_rate | 报告字段 |
|------|------|:---:|------|
| 网络/传输错误 | 超时、连接拒绝、DNS 失败 | ✅ | `network_errors` |
| status 断言失败 | 期望 200 实际 500 | ✅ | `status_failures` |
| latency 断言失败 | 响应成功但超过 max_latency | ❌(慢不是错) | `assert_failures` |

### 负载模型

MVP 为 **closed model**:固定 `users` 个 VU 循环施压,RPS 是因变量。服务变慢时施压强度随之下降,不适合容量测试(固定 RPS 的 open model 在 P1)。

### plugins 段的省略与置空

- 整段**省略** → 启用全部内置插件(console、json_report、logger)的默认配置
- `plugins: {}`(显式置空)→ 不启用任何插件
- 列出部分 → 只启用列出的插件

CLI 的 `--out` / `--log-dir` 覆盖对应插件的目录配置,`--no-report` 禁用 json_report。

## 报告 JSON 结构

```jsonc
{
  "run_id": "20260919-052341-a3f2",
  "scenario": "api-smoke",
  "load_model": "closed",          // 负载模型标注
  "start_time": "...", "end_time": "...",
  "steady":  { /* 稳态窗口指标,threshold 依据 */ },
  "overall": { /* 全程指标 */ },
  "dropped_events": 0,             // 背压丢弃的插件事件数
  "thresholds": [
    {"name": "p95_latency", "limit": "800ms", "actual": "12.4ms", "passed": true}
  ],
  "threshold_passed": true
}
```

每个窗口(`steady` / `overall`)包含:`window_seconds`、`requests`、`rps`、`network_errors`、`status_failures`、`assert_failures`、`error_rate`、`latency_{min,max,mean,p50,p95,p99}_ns`(纳秒)。
