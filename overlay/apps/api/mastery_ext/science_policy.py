"""Deterministic learning policy, not a calibrated retention or ability model.

Separates opportunities to practise from evidence of independent, delayed
retrieval. Keeps sequencing decisions inspectable and fully offline.
"""
from __future__ import annotations
from datetime import datetime, timedelta

MIN_DELAY_HOURS = 20
REVIEW_DAYS = (3, 7, 14, 30, 60)


def is_delayed(previous_at: str | None, now: datetime) -> bool:
    if not previous_at:
        return False
    prior = datetime.fromisoformat(previous_at)
    if prior.tzinfo is None:
        from datetime import timezone
        prior = prior.replace(tzinfo=timezone.utc)
    return now - prior >= timedelta(hours=MIN_DELAY_HOURS)


def next_review(*, now: datetime, prior_due: str | None, previous_independent_at: str | None,
                review_successes: int, correct: bool, assisted: bool,
                mode: str, fresh: bool = True) -> tuple[str, int, bool]:
    """Return (due ISO, confirmed review successes, confirmed delayed review).

    A correct answer during acquisition doesn't magically constitute a
    successful spaced review. Reviewing early or after help does not advance.
    """
    old = datetime.fromisoformat(prior_due) if prior_due else None
    if old is not None and old.tzinfo is None:
        from datetime import timezone
        old = old.replace(tzinfo=timezone.utc)
    if assisted and correct:
        return (old or now).isoformat(), review_successes, False
    if not correct:
        return (now + timedelta(minutes=15)).isoformat(), 0, False
    if mode == 'repair':
        return (old or now).isoformat(), review_successes, False
    if old is None:
        return (now + timedelta(days=1)).isoformat(), 0, False
    qualified = (fresh and mode == 'review' and old <= now
                 and is_delayed(previous_independent_at, now))
    if qualified and not assisted:
        count = min(review_successes + 1, len(REVIEW_DAYS))
        return (now + timedelta(days=REVIEW_DAYS[count - 1])).isoformat(), count, True
    return old.isoformat(), review_successes, False


def instruction(recent_independent: list[bool]) -> dict:
    """Recent observations listed oldest to newest; do not infer abilities.

    Worked examples are *available on demand*, never forced before retrieval.
    """
    recent = recent_independent[-4:]
    trouble = (len(recent) >= 2 and recent.count(False) >= 2
               and not (len(recent) >= 3 and all(recent[-3:])))
    return {
        'first_step': 'attempt_before_hint',
        'scaffold': 'worked_example_available' if trouble else 'independent',
        'prompt': ('Attempt the problem first. If stuck, request a worked example for the skill; '
                   'then solve a new item without help.' if trouble else
                   'Retrieve the method from memory, explain your choice, then submit. '
                   'Hints are optional and do not count as independent mastery.'),
        'evidence': 'last_four_independent_responses' if recent else 'no_prior_evidence',
    }
