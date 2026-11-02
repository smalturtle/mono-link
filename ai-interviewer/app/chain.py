import os
from pathlib import Path

from dotenv import load_dotenv
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

from pydantic import BaseModel

from app.schemas import DimensionName, GradeResult, Reason, Scores
from app.validate import validate


class ModelGrade(BaseModel):
    scores: Scores
    reasons: list[Reason]
    followup_dimension: DimensionName
    followup: str

ROOT = Path(__file__).resolve().parents[1]
CONTRACT_PATH = ROOT / "prompts" / "contract-v1.md"
load_dotenv(ROOT / ".env")


def _llm() -> ChatOpenAI:
    api_key = os.environ.get("OPENAI_API_KEY") or os.environ.get("DASHSCOPE_API_KEY")
    if not api_key:
        raise RuntimeError("missing OPENAI_API_KEY or DASHSCOPE_API_KEY")
    model = os.environ.get("MODEL_NAME", "gpt-4o-mini")
    kwargs = {"model": model, "temperature": 0, "api_key": api_key}
    base_url = os.environ.get("OPENAI_BASE_URL")
    if not base_url and os.environ.get("DASHSCOPE_API_KEY") and not os.environ.get("OPENAI_API_KEY"):
        base_url = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    if base_url:
        kwargs["base_url"] = base_url
    return ChatOpenAI(**kwargs)


def _invoke(question_stem: str, answer: str) -> ModelGrade:
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", "{contract}"),
            ("human", "题目：{stem}\n回答：{answer}"),
        ]
    )
    chain = prompt | _llm().with_structured_output(ModelGrade)
    contract = CONTRACT_PATH.read_text(encoding="utf-8")
    return chain.invoke({"contract": contract, "stem": question_stem, "answer": answer})


def grade_answer(question_stem: str, answer: str) -> GradeResult:
    last_error = None
    for _ in range(2):
        try:
            drafted = _invoke(question_stem, answer)
            raw = drafted.scores.model_copy()
            result = GradeResult(
                scores=raw.model_copy(),
                scores_raw=raw,
                reasons=drafted.reasons,
                followup_dimension=drafted.followup_dimension,
                followup=drafted.followup,
            )
            return validate(result, answer)
        except Exception as exc:  # retry once on any model or parse failure
            last_error = exc
    raise RuntimeError("grade failed after 1 retry") from last_error
