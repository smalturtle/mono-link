from fastapi import FastAPI, HTTPException

from app.chain import grade_answer
from app.questions import load_question
from app.schemas import GradeRequest, GradeResult

app = FastAPI(title="ai-interviewer")


@app.post("/api/v1/grade", response_model=GradeResult)
def grade(body: GradeRequest) -> GradeResult:
    if not body.answer.strip():
        raise HTTPException(status_code=400, detail="answer is required")
    try:
        question = load_question(body.questionCode)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"unknown questionCode: {body.questionCode}") from exc
    try:
        return grade_answer(question["stem"], body.answer)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
