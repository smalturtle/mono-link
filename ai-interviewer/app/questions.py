import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
QUESTIONS_PATH = ROOT / "data" / "questions.json"


def load_question(code: str) -> dict:
    questions = json.loads(QUESTIONS_PATH.read_text(encoding="utf-8"))
    question = questions.get(code)
    if question is None:
        raise KeyError(code)
    return question
