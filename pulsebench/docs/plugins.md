# 插件开发指南

## 接口

插件接口位于公开包 `pkg/plugin`,第三方可直接 import:

```go
type Plugin interface {
    Name() string
    Init(config map[string]any) error   // 接收 YAML plugins: 段的配置
    OnRunStart(ctx context.Context, run *RunContext) error
    OnRequest(ctx context.Context, run *RunContext, result *RequestResult)
    OnRunEnd(ctx context.Context, run *RunContext, summary *Summary) error
}
```

调用时机与保证:

| Hook | 调用方式 | 说明 |
|------|---------|------|
| `OnRunStart` | 同步,压测开始前 | 返回 error 会中止 run(exit 1) |
| `OnRequest` | **异步**,经事件总线 | 单一 dispatcher goroutine 顺序调用,无需加锁;阻塞只会导致事件被丢弃计数,不影响压测循环 |
| `OnRunEnd` | 同步,bus 排空后 | 保证报告落盘后进程才退出 |

注意:`OnRequest` 收到的事件可能因背压而不完整(缺口计入 `summary.dropped_events`);需要精确计数的逻辑应使用 `OnRunEnd` 里的 `Summary`,它来自 metrics collector,永不丢样本。

## 内置插件

| 名称 | 配置项 | 说明 |
|------|--------|------|
| `console` | `interval`(默认 `5s`) | 启动横幅、周期进度、最终摘要,输出到 stderr |
| `json_report` | `out_dir`(默认 `reports`) | `OnRunEnd` 写 `{run_id}.json` |
| `logger` | `log_dir`(默认 `logs`) | 逐请求 slog JSONL 写 `{run_id}.jsonl` |

## 自定义插件示例

```go
package myplugin

import (
    "context"
    "fmt"

    "github.com/pulsebench/pulsebench/pkg/plugin"
)

type SlowRequestAlert struct {
    webhook string
}

func (p *SlowRequestAlert) Name() string { return "slow_alert" }

func (p *SlowRequestAlert) Init(config map[string]any) error {
    if v, ok := config["webhook"].(string); ok {
        p.webhook = v
    }
    if p.webhook == "" {
        return fmt.Errorf("slow_alert: webhook is required")
    }
    return nil
}

func (p *SlowRequestAlert) OnRunStart(context.Context, *plugin.RunContext) error { return nil }

func (p *SlowRequestAlert) OnRequest(_ context.Context, _ *plugin.RunContext, r *plugin.RequestResult) {
    // 运行在 dispatcher goroutine 上;耗时操作不会拖慢压测循环,
    // 但可能导致后续事件被丢弃(计入 dropped_events)。
}

func (p *SlowRequestAlert) OnRunEnd(_ context.Context, _ *plugin.RunContext, s *plugin.Summary) error {
    if !s.ThresholdPassed {
        // POST p.webhook ...
    }
    return nil
}
```

## 接入方式(编译期注册)

MVP/P1 阶段插件**编译进二进制**(Go 原生 `plugin` 机制在 macOS/交叉编译下不可用,不采用):

1. fork 本仓库(或以 library 方式 import engine)
2. 在 `cmd/pulsebench/main.go` 的 `buildPlugins` 中注册你的插件构造函数
3. 在 scenario 的 `plugins:` 段启用并传入配置
4. 重新编译

P2 如确有进程外插件需求,将评估 hashicorp/go-plugin(子进程 + RPC)。
