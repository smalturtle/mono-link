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


def validation_note(before, after, answer: str) -> str:
    """Describe what validate changed. Does not alter scores."""
    bad_quote = [reason for reason in before.reasons if not reason.quote or reason.quote not in answer]
    full_score = [
        reason
        for reason in before.reasons
        if reason.quote and reason.quote in answer and getattr(before.scores, reason.dimension) >= 5
    ]
    notes = []
    if bad_quote:
        notes.append(f"引用不是原话被丢掉 {len(bad_quote)} 条")
    if full_score:
        notes.append(f"满分项的理由被去掉 {len(full_score)} 条")
    if before.scores.depth != after.scores.depth:
        notes.append(f"depth 因为「没有具体细节」从 {before.scores.depth} 压到 {after.scores.depth}")
    if before.followup_dimension != after.followup_dimension:
        notes.append(f"追问项从 {before.followup_dimension} 改到 {after.followup_dimension}")
    if not notes:
        return "未改分"
    return "；".join(notes)


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
