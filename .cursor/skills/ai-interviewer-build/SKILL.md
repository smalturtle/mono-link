---
name: ai-interviewer-build
description: >-
  Build a general AI mock interviewer (single-turn grade + one follow-up).
  Use when the user works on ai-interviewer, mock interview grading, contract.md,
  eval regression, LangChain structured output, or FastAPI grade API.
  Enforce contract-first, no RAG/agents/voice in v1, and eval after every prompt change.
---

# AI 面试官 — 实现工作流（项目 Skill）

## 硬边界（v1）

- 输入：题目 + 一段文字回答
- 输出：四维分 + reasons（必须含 quote）+ 一句 followup（最低分维度）
- 禁止：RAG、多 Agent、语音、无限聊天、简历解析
- 改 `prompts/contract*.md` 后必须跑 `eval_run` 并更新 `docs/eval-*.md`

## 实现顺序（不得跳步）

1. `contract.md` + 1 题好答/虚答 + 人工分（用户手写）
2. Pydantic `GradeResult` + `POST /grade`（单链 LangChain structured output，temperature=0）
3. `validate(result, answer)` + pytest
4. `eval_set.json`（≥10 条）+ `eval_run.py`
5. 最小 Vue 或 Swagger 演示
6. v1.1：LangGraph 第二 turn（可选）

## Agent 收到实现请求时

- 先读 `docs/ai-interviewer-playbook.md` 当前阶段
- 若用户未提供 contract，只帮整理合同草案，**不先写业务代码**
- 若模型输出违反 contract，优先改 contract 或 validator，不要堆 feature

## 引用

详细逐步问答与验收见：`docs/ai-interviewer-playbook.md`
