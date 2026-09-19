# 快速开始

## 安装

需要 Go 1.22+。

```bash
git clone <repo> && cd pulsebench
make build        # 产出 bin/pulsebench 和 bin/testserver
```

或直接:

```bash
go install ./cmd/pulsebench
```

## 第一次压测

PulseBench 随仓库提供一个本地测试服务器,快速开始不依赖任何外部服务:

```bash
# 终端 1
./bin/testserver          # 监听 :8080,提供 /ping /api/items /slow /flaky

# 终端 2
./bin/pulsebench run scenarios/quick.yaml   # 10 秒 sanity run
./bin/pulsebench run scenarios/smoke.yaml   # 60 秒完整示例
```

运行时终端每 5 秒输出一行进度;结束后输出摘要:

```
━━ Summary 20260919-052341-a3f2 (load model: closed) ━━

  steady-state (thresholds apply here) — 50.0s
    requests: 11832    rps: 236.6  error_rate: 0.00%
    ...
  overall (ramp-up included) — 60.0s
    ...
  dropped plugin events: 0 (metrics are never dropped)

  thresholds (steady-state):
    [PASS] p95_latency  limit=800ms actual=12.4ms
    [PASS] error_rate   limit=0.0100 actual=0.0000
```

## 输出物

| 输出 | 路径 | 用途 |
|------|------|------|
| 终端摘要 | stderr | 实时观察 |
| JSON 报告 | `reports/{run_id}.json` | CI 归档、自动化对比 |
| JSONL 日志 | `logs/{run_id}.jsonl` | 慢请求排查、接 ELK |

`run_id` 格式为 `YYYYMMDD-HHMMSS-<4位随机>`(UTC),随机后缀避免 CI 并行任务冲突。

## 接入 CI

threshold 失败时 exit code 为 2,解析/运行错误为 1:

```bash
pulsebench run scenarios/smoke.yaml --out artifacts/reports
case $? in
  0) echo "pass" ;;
  2) echo "threshold failed" ; exit 1 ;;
  *) echo "run error" ; exit 1 ;;
esac
```

## 读数注意

MVP 使用**闭环负载模型(closed model)**:固定 `users` 个虚拟用户循环发压。被测服务变慢时发送速率自动下降,因此 **RPS 是因变量**,适合回答"N 个并发用户下系统表现如何",**不适合**"以固定 500 RPS 打压"这类容量测试(open model 在 P1 路线图上)。
