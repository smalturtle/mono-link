import logging
from contextvars import ContextVar
from pathlib import Path
from typing import Optional

current_request_id: ContextVar[str] = ContextVar("grade_request_id", default="-")

ROOT = Path(__file__).resolve().parents[1]
LOG_PATH = ROOT / "logs" / "grade.log"


def grade_logger() -> logging.Logger:
    logger = logging.getLogger("ai-interviewer.grade")
    if logger.handlers:
        return logger
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    logger.setLevel(logging.INFO)
    logger.propagate = False
    formatter = logging.Formatter("%(asctime)s %(message)s", datefmt="%H:%M:%S")
    file_handler = logging.FileHandler(LOG_PATH, encoding="utf-8")
    stream_handler = logging.StreamHandler()
    file_handler.setFormatter(formatter)
    stream_handler.setFormatter(formatter)
    logger.addHandler(file_handler)
    logger.addHandler(stream_handler)
    return logger


def log_step(text: str, request_id: Optional[str] = None) -> None:
    grade_logger().info("[%s] %s", request_id or current_request_id.get(), text)
