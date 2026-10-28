"""Conservative, answer-specific feedback that needs no network or model.

A distractor tells us which answer was picked; it does NOT prove a student's
reasoning. These descriptions are hypotheses to check through a fresh item.
"""
from __future__ import annotations

# Order corresponds to the three *constructed* wrong answers in practice_bank.py.
PATTERNS = {
    '_linear': (
        'The chosen value reverses the sign of the solution. Recheck moving terms across the equals sign.',
        'The answer differs by a small constant. Recheck the distribution and final subtraction.',
        'The answer differs by a small constant. Recheck the distribution and final subtraction.',
    ),
    '_quadratic': (
        'You selected the other valid root. The question asks for the greater one.',
        'You may have reversed a sign while extracting the root.',
        'Recheck whether the calculated root was changed by one during the final step.',
    ),
    '_sequence': (
        'You may have used n instead of n−1. Term 1 has zero common differences added.',
        'You may have used n−2 instead of n−1. Count the steps from term 1.',
        'Your value may omit the first term. Add a₁ to (n−1)d.',
    ),
    '_geometric': (
        'You may have used exponent n rather than n−1. The first term has exponent zero.',
        'You may have treated multiplying by a ratio like adding a common difference.',
        'You may have used exponent n−2 rather than n−1.',
    ),
    '_functions': (
        'You may have found the slope instead of the intercept. f(0) equals the intercept.',
        'You may have substituted a given point without solving for f(0).',
        'You may have added the slope to the intercept, despite x being zero.',
    ),
    '_percent': (
        'The selected result appears to add percentage changes. Each percentage applies to a different base.',
        'Check whether the second change was mistakenly treated as another increase.',
        'Check the direction of the first change: the prompt specifies an increase.',
    ),
    '_physics_freefall': (
        'You may have used gravity as a constant speed rather than constant acceleration.',
        'You may have omitted the ½ factor in the acceleration term.',
        'You may have used t rather than t² in the acceleration term.',
    ),
    '_physics_projectile': (
        'You may have computed vertical drop instead of horizontal displacement.',
        'Horizontal displacement is speed × time, not speed + time.',
        'You may have multiplied by t² as though horizontal acceleration were nonzero.',
    ),
    '_rational_equation': (
        'You selected the excluded denominator value. Division by zero is not allowed.',
        'You may have extracted a numerator value without solving the equation.',
        'Check the distribution when multiplying both sides by the denominator.',
    ),
    '_conditional_drawing': (
        'The denominator may be the original bag total. One blue counter has already been removed.',
        'You may have removed the green counters despite no such restriction in the condition.',
        'The number of red counters does not change when the first counter was blue.',
    ),
    '_velocity_two_segments': (
        'You may have used the magnitude of the negative-velocity segment. Signed displacement can cancel.',
        'A single trapezoid across a discontinuous velocity graph may give the wrong area.',
        'You may have counted only the first part of the journey.',
    ),
}


def diagnose(problem_metadata: dict | None, selected_letter: str, skill: str) -> dict:
    """Return bounded evidence, never claim a student's private reasoning is known."""
    meta = problem_metadata or {}
    index = (meta.get('distractor_index') or {}).get(selected_letter.upper())
    family = meta.get('family')
    patterns = PATTERNS.get(family, ())
    if not isinstance(index, int) or index < 0 or index >= len(patterns):
        hypothesis = ('Your choice alone does not identify the exact reasoning error. '
                      'Compare your method with the worked solution, then test a different problem.')
        evidence = 'insufficient'
    else:
        hypothesis = patterns[index]
        evidence = 'constructed_distractor'
    return {
        'hypothesis': hypothesis,
        'evidence': evidence,
        'certainty': 'possible, not confirmed',
        'verification': f'Try a fresh problem involving {skill}. Explain the rule before calculating.',
        'offline': True,
    }
