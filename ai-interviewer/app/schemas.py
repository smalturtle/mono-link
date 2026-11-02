from typing import Literal

from pydantic import BaseModel, Field

DimensionName = Literal["structure", "depth", "accuracy", "relevance"]


class Scores(BaseModel):
    structure: int = Field(ge=0, le=5)
    depth: int = Field(ge=0, le=5)
    accuracy: int = Field(ge=0, le=5)
    relevance: int = Field(ge=0, le=5)


class Reason(BaseModel):
    dimension: DimensionName
    quote: str
    text: str


class GradeResult(BaseModel):
    scores: Scores
    scores_raw: Scores
    reasons: list[Reason]
    followup_dimension: DimensionName
    followup: str


class GradeRequest(BaseModel):
    questionCode: str
    answer: str
