"""Image-to-sample aggregation. The model is image-level; this rule turns field calls into one sample result.

Provisional rule agreed with the team (30 Sep 2026): majority of fields, and a tie is reported as positive
because a missed positive is the costlier screening error. Replace it once the rule is fixed with the
clinical collaborator.
"""
from typing import Literal

TIE_CALL: Literal['positive', 'negative'] = 'positive'
RULE = 'Majority of fields; a tie is reported as positive.'


def aggregate(calls: list[str]) -> dict:
    if not calls:
        raise ValueError('A sample needs at least one field.')
    positives = sum(call == 'positive' for call in calls)
    negatives = len(calls) - positives
    call = 'positive' if positives > negatives else 'negative' if negatives > positives else TIE_CALL
    return {
        'call': call,
        # Fields that disagree are flagged so the clinician checks each one.
        'needsReview': 0 < positives < len(calls),
        'positiveFields': positives,
        'totalFields': len(calls),
        'rule': RULE,
    }
