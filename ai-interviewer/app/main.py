import time
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse

from app.chain import grade_answer
from app.log import current_request_id, log_step
from app.questions import load_question
from app.schemas import GradeRequest, GradeResult

app = FastAPI(title="ai-interviewer")
PAGE = Path(__file__).resolve().parent / "static" / "index.html"


@app.get("/")
def home() -> FileResponse:
    return FileResponse(PAGE)


def _scores(scores) -> str:
    return (
        f"structure={scores.structure} depth={scores.depth} "
        f"accuracy={scores.accuracy} relevance={scores.relevance}"
    )


@app.post("/api/v1/grade", response_model=GradeResult)
def grade(body: GradeRequest) -> GradeResult:
    request_id = uuid4().hex[:6]
    current_request_id.set(request_id)
    started = time.perf_counter()
    log_step(f"收到请求：题号 {body.questionCode}，回答字数 {len(body.answer.strip())}")
    if not body.answer.strip():
        log_step("返回：停在检查回答，异常类型 ValueError，HTTP 400")
        raise HTTPException(status_code=400, detail="answer is required")
    try:
        question = load_question(body.questionCode)
    except KeyError as exc:
        log_step(f"查到题目：找不到 {body.questionCode}，HTTP 404，结束")
        raise HTTPException(status_code=404, detail=f"unknown questionCode: {body.questionCode}") from exc
    log_step(f"查到题目：{question['stem']}")
    try:
        graded = grade_answer(question["stem"], body.answer)
    except RuntimeError as exc:
        elapsed = int((time.perf_counter() - started) * 1000)
        cause = type(exc.__cause__).__name__ if exc.__cause__ else type(exc).__name__
        log_step(f"返回：停在调用模型，异常类型 {cause}，耗时 {elapsed}ms，HTTP 502")
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    elapsed = int((time.perf_counter() - started) * 1000)
    log_step(f"返回：{_scores(graded.scores)}，最终追问项 {graded.followup_dimension}，耗时 {elapsed}ms，HTTP 200")
    return graded
