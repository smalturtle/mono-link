"""智谱 AI API 测试 — 读取 doc.md / doc.pdf 发送给模型"""

import json
from pathlib import Path

from zai import ZhipuAiClient
import zai

BASE_DIR = Path(__file__).resolve().parent
config = json.loads((BASE_DIR / "config.json").read_text(encoding="utf-8"))


def load_document(path: Path) -> str:
    if not path.exists():
        raise SystemExit(f"文件不存在: {path}")
    else:
        text = path.read_text(encoding="utf-8")

    text = text.strip()
    if not text:
        raise SystemExit(f"文件内容为空: {path}")
    return text


api_key = config["api_key"].strip()
if not api_key or api_key == "your-api-key":
    raise SystemExit("请在 config.json 中填写有效的 api_key")

doc_path = BASE_DIR / config.get("doc", "doc.md")
article = load_document(doc_path)

client = ZhipuAiClient(api_key=api_key)

try:
    for i in range(1):
        response = client.chat.completions.create(
        model=config.get("model", "glm-5.2"),
        messages=[
            {
                "role": "user",
                "content": f"请阅读以下文章并总结要点：\n\n{article}",
            }
        ],
    )
    print(response.choices[0].message.content)
    print(f"第{i+1}次消耗的token: {response.usage.total_tokens}")
except zai.core.APIAuthenticationError:
    raise SystemExit(
        "API 身份验证失败 (401)。请检查 config.json 中的 api_key 是否正确。"
    ) from None

print(response.choices[0].message.content)
