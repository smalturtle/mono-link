"""智谱 AI API 测试 — 读取 doc.md / doc.pdf 发送给模型"""

import json
import time
from pathlib import Path
from datetime import datetime

from zai import ZhipuAiClient
import zai


def chat_with_retry(client, model, messages, max_tokens, max_retries=2, timeout=600):
    """简单的带重试和超时的对话请求"""
    for retry in range(max_retries):
        try:
            return client.chat.completions.create(
                model=model,
                messages=messages,
                max_tokens=max_tokens,
                timeout=timeout,
            )
        except Exception as e:
            if retry == max_retries - 1:
                raise
            print(f"请求失败 ({retry+1}/{max_retries})，2秒后重试: {e}")
            time.sleep(2)

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

models = config.get("models", [config.get("model", "glm-5.2")])
current_model_index = 0

# 模型输出 tokens 配置（设置为最大值的70%）
model_max_tokens = {
    "glm-5.2": 89600,
    "glm-5.1": 89600,
    "glm-5": 89600,
    "glm-5-Turbo": 89600,
    "glm-4.7": 89600,
    "glm-4.7-FlashX": 89600,
    "glm-4.6": 89600,
    "glm-4.5-Air": 67200,
    "glm-4.5-AirX": 67200,
    "glm-4-Long": 2800,
    "glm-4.7-Flash": 89600,
    "glm-4.5-Flash": 67200,
    "glm-4-Flash-250414": 11200,
}

try:
    log_path = BASE_DIR / "log.txt"
    for i in range(100):
        success = False
        while not success and current_model_index < len(models):
            current_model = models[current_model_index]
            max_tokens_val = model_max_tokens.get(current_model, 32768)
            try:
                # 链式多轮对话 - 扩展为8轮以最大化 token 消耗
                conversation = []
                total_tokens = 0
                
                # 第1轮：深度分析
                print(f"\n=== 第{i+1}轮对话 - 第1步：深度分析 ===")
                response1 = chat_with_retry(
                    client,
                    current_model,
                    [
                        {
                            "role": "user",
                            "content": f"""请仔细阅读以下文章，进行超详细深度分析：

文章内容：
{article}

请完成以下任务（必须极其详细）：
1. 提取所有核心概念和术语（不少于100个，每个概念都要有详细定义和解释）
2. 分析文章的整体结构和逻辑框架（画出逻辑流程图并用文字详细描述）
3. 识别文章中的所有论点和论据（每个论点都要有详细分析）
4. 指出文章的创新点和贡献（与相关领域其他研究对比分析）
5. 分析文章的局限性和可以改进的地方（提出具体的改进方案）
6. 总结文章对该领域的影响和意义

请用极其详细的 Markdown 格式回答，每个部分不少于2000字，不要省略任何细节。""",
                        }
                    ],
                    max_tokens_val,
                )
                print(response1.choices[0].message.content)
                total_tokens += response1.usage.total_tokens
                log_entry = f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - 第{i+1}轮对话-第1步（深度分析）: 模型={current_model}, 消耗token={response1.usage.total_tokens}\n"
                with open(log_path, "a", encoding="utf-8") as f:
                    f.write(log_entry)
                conversation.append({"role": "user", "content": f"请仔细阅读以下文章，进行超详细深度分析：\n\n{article}\n\n请完成以下任务（必须极其详细）：\n1. 提取所有核心概念和术语（不少于100个，每个概念都要有详细定义和解释）\n2. 分析文章的整体结构和逻辑框架（画出逻辑流程图并用文字详细描述）\n3. 识别文章中的所有论点和论据（每个论点都要有详细分析）\n4. 指出文章的创新点和贡献（与相关领域其他研究对比分析）\n5. 分析文章的局限性和可以改进的地方（提出具体的改进方案）\n6. 总结文章对该领域的影响和意义\n\n请用极其详细的 Markdown 格式回答，每个部分不少于2000字，不要省略任何细节。"})
                conversation.append({"role": "assistant", "content": response1.choices[0].message.content})
                
                # 第2轮：生成超详细思维导图
                print(f"\n=== 第{i+1}轮对话 - 第2步：生成超详细思维导图 ===")
                response2 = chat_with_retry(
                    client,
                    current_model,
                    conversation + [
                        {
                            "role": "user",
                            "content": """基于以上分析，请为这篇文章创建一个极其详尽的思维导图结构。要求：
1. 至少包含10个主要分支
2. 每个主要分支至少包含15个子分支
3. 每个子分支至少包含10个孙分支
4. 每个节点都要有极其详细的描述和解释
5. 使用 Markdown 列表格式表示层级关系
6. 每个分支都要有实际内容，不能是空的

请尽可能详尽，把每个概念都展开到极致，不要省略任何细节。""",
                        }
                    ],
                    max_tokens_val,
                )
                print(response2.choices[0].message.content)
                total_tokens += response2.usage.total_tokens
                log_entry = f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - 第{i+1}轮对话-第2步（思维导图）: 模型={current_model}, 消耗token={response2.usage.total_tokens}\n"
                with open(log_path, "a", encoding="utf-8") as f:
                    f.write(log_entry)
                conversation.append({"role": "user", "content": "基于以上分析，请为这篇文章创建一个极其详尽的思维导图结构。要求：\n1. 至少包含10个主要分支\n2. 每个主要分支至少包含15个子分支\n3. 每个子分支至少包含10个孙分支\n4. 每个节点都要有极其详细的描述和解释\n5. 使用 Markdown 列表格式表示层级关系\n6. 每个分支都要有实际内容，不能是空的\n\n请尽可能详尽，把每个概念都展开到极致，不要省略任何细节。"})
                conversation.append({"role": "assistant", "content": response2.choices[0].message.content})
                
                # 第3轮：多语言详细翻译
                print(f"\n=== 第{i+1}轮对话 - 第3步：多语言详细翻译 ===")
                response3 = chat_with_retry(
                    client,
                    current_model,
                    conversation + [
                        {
                            "role": "user",
                            "content": """请将原始文章的完整内容（包括所有细节）翻译成以下语言，每个语言版本都要极其完整、准确、详细：
1. 英语（English）
2. 日语（日本語）
3. 韩语（한국어）
4. 法语（Français）
5. 德语（Deutsch）
6. 西班牙语（Español）
7. 俄语（Русский）
8. 阿拉伯语（العربية）
9. 葡萄牙语（Português）
10. 意大利语（Italiano）

每个语言版本不少于3000字，保持原文的所有信息、细节和语气，逐字逐句准确翻译，不要省略任何内容。""",
                        }
                    ],
                    max_tokens_val,
                )
                print(response3.choices[0].message.content)
                total_tokens += response3.usage.total_tokens
                log_entry = f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - 第{i+1}轮对话-第3步（多语言翻译）: 模型={current_model}, 消耗token={response3.usage.total_tokens}\n"
                with open(log_path, "a", encoding="utf-8") as f:
                    f.write(log_entry)
                conversation.append({"role": "user", "content": "请将原始文章的完整内容（包括所有细节）翻译成以下语言，每个语言版本都要极其完整、准确、详细：\n1. 英语（English）\n2. 日语（日本語）\n3. 韩语（한국어）\n4. 法语（Français）\n5. 德语（Deutsch）\n6. 西班牙语（Español）\n7. 俄语（Русский）\n8. 阿拉伯语（العربية）\n9. 葡萄牙语（Português）\n10. 意大利语（Italiano）\n\n每个语言版本不少于3000字，保持原文的所有信息、细节和语气，逐字逐句准确翻译，不要省略任何内容。"})
                conversation.append({"role": "assistant", "content": response3.choices[0].message.content})
                
                # 第4轮：生成完整教学材料
                print(f"\n=== 第{i+1}轮对话 - 第4步：生成完整教学材料 ===")
                response4 = chat_with_retry(
                    client,
                    current_model,
                    conversation + [
                        {
                            "role": "user",
                            "content": """基于以上所有内容，请为这篇文章创建一套极其完整的大学课程教学材料，包括：
1. 课程大纲（32学时，详细到每节课的具体内容）
2. 每节课的超详细教案（包含教学目标、教学重点、教学难点、教学过程、时间分配、板书设计、课后作业等）
3. 200道练习题（包含50道选择题、50道填空题、50道简答题、50道论述题，每题都要有详细的知识点说明）
4. 完整的答案和解析（每个答案都要有详细的解释和引用依据）
5. 推荐的延伸阅读资料（至少50篇参考文献，每篇都要有详细的内容简介和推荐理由）
6. 期末考试试卷（包含答案和评分标准）
7. 课程评估标准和方法

请尽可能详尽和全面，适合作为一学期的大学课程使用，每个部分都要有实质性内容。""",
                        }
                    ],
                    max_tokens_val,
                )
                print(response4.choices[0].message.content)
                total_tokens += response4.usage.total_tokens
                log_entry = f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - 第{i+1}轮对话-第4步（教学材料）: 模型={current_model}, 消耗token={response4.usage.total_tokens}\n"
                with open(log_path, "a", encoding="utf-8") as f:
                    f.write(log_entry)
                
                success = True
                final_response = response4
                
            except zai.core.APIReachLimitError:
                print(f"模型 {current_model} 配额不足，尝试下一个模型")
                current_model_index += 1
                if current_model_index >= len(models):
                    raise SystemExit("所有模型都已不可用")
        
        print(f"\n第{i+1}轮对话完成！总消耗token: {total_tokens}，使用模型: {current_model}")
        
        log_entry = f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - 第{i+1}次请求: 模型={current_model}, 消耗token={total_tokens}\n"
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(log_entry)
except zai.core.APIAuthenticationError:
    raise SystemExit(
        "API 身份验证失败 (401)。请检查 config.json 中的 api_key 是否正确。"
    ) from None

print(final_response.choices[0].message.content)
