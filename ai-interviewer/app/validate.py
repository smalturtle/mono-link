import re

TIE_BREAK = ("depth", "accuracy", "structure", "relevance")
NO_DETAIL = ("没有具体", "无具体", "缺乏具体", "缺少细节", "没有细节", "空泛")
SENTENCE_END = re.compile(r"[。！？!?]")


def lowest_dimension(scores) -> str:
    return min(TIE_BREAK, key=lambda name: (getattr(scores, name), TIE_BREAK.index(name)))


def one_sentence(text: str) -> str:
    stripped = text.strip()
    match = SENTENCE_END.search(stripped)
    if match is None:
        return stripped
    return stripped[: match.end()]


def validate(result, answer: str):
    """Return a copy. scores_raw is left unchanged. scores may be capped."""
    graded = result.model_copy(deep=True)
    graded.reasons = [
        reason
        for reason in graded.reasons
        if reason.quote and reason.quote in answer and getattr(graded.scores, reason.dimension) < 5
    ]
    mentions_no_detail = any(token in reason.text for reason in graded.reasons for token in NO_DETAIL)
    if mentions_no_detail and graded.scores.depth > 2:
        graded.scores.depth = 2
    graded.reasons = [
        reason for reason in graded.reasons if getattr(graded.scores, reason.dimension) < 5
    ]
    graded.followup_dimension = lowest_dimension(graded.scores)
    graded.followup = one_sentence(graded.followup)
    return graded
