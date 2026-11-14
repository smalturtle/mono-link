# ai-interviewer

单题打分。`prompts/contract-v1.md`、`data/samples/good.txt`、`data/samples/fluff.txt` 和 `data/samples/human-scores.json` 是按已确认 seed 生成的草案。`human-scores.json` 里的分数不是你的人工分，正式对比前请替换。

```bash
cd ai-interviewer
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # 填 OPENAI_API_KEY 或 DASHSCOPE_API_KEY，以及 MODEL_NAME
uvicorn app.main:app --reload --port 8000
```

```bash
curl -s -X POST localhost:8000/api/v1/grade \
  -H 'content-type: application/json' \
  -d "$(python -c 'import json,pathlib; print(json.dumps({"question":"介绍一个项目","answer":pathlib.Path("data/samples/fluff.txt").read_text()}))')"
```

好答把 `fluff.txt` 换成 `good.txt`。结果可存到 `artifacts/grade-fluff.json` 与 `artifacts/grade-good.json`。

校验测试：`pytest`。

回归：`python eval/eval_run.py`（会请求本机 8000 端口）。输出 `artifacts/eval.csv`，并在末尾打印虚答且原分 depth≥3 的条数，以及校验后 depth。
