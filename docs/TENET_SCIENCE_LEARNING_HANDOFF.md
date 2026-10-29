# Tenet — Science-based Learning Engine: Implementation Handoff

**Scope:** Additive, deterministic, offline-only changes to the existing Tenet source snapshot. Native Mac bundling is not changed. Target branch: integrate with the existing Tenet UI feature stack first, then the Mac release branch in a separate integration branch.

## Five delivered mechanisms

1. **Retrieval-first learning:** The Learn screen shows the check prompt before the worked example, and requires an explicit action to reveal the example. Solve prompts learners to attempt independently; hints remain optional and server-logged as assisted. The actual question answer remains hidden until grade. On difficulty, a separate (optional) skill-level worked example becomes available after an opt-in hint. A correct assisted answer cannot raise mastery.
2. **Spaced retrieval:** `review_progress` stores confirmed delayed review successes, lapses, and last independent exposure per learner/course/skill. One-day initial review, followed by 3/7/14/30/60-day heuristic intervals **only** after a fresh, unaided review that is overdue and >=20 hours after prior independent exposure. Same-day, repeated and hinted answers cannot extend intervals. Failures schedule a 15-minute repair; foundation repair cannot erase review debt; verified transfer still gets a 30-minute follow-up, not a retention award. All timestamps use UTC.
3. **Adaptive scaffolding:** The server returns an inspectable learning-guidance policy. Two or more recent independently incorrect answers expose a worked-example option, which fades after three recent independent successes. Existing fail -> simpler prerequisite -> fresh transfer loop remains intact.
4. **Interleaving:** Without explicit focus, due review or repair, the selector rotates to a different established skill if at least two have at least three independent challenge observations, at least two of the last three correct. The rotation uses available unseen questions and never overrides a student's explicitly requested skill.
5. **Defensible mastery evidence:** Analytics now distinguishes first unassisted acquisition, delayed unassisted retrieval (new question, >=20h since last exposure), and fresh independent tutor-tagged transfer. Each skill's evidence has a provisional indicator until >=10 independent and >=3 delayed reviews. Legacy attempts remain excluded from independent evidence. All figures are descriptive and NOT scaled scores, validated retention predictions, calibrated difficulty, or proof of causality.

## Key integration locations

- `overlay/apps/api/mastery_ext/science_policy.py` — pure deterministic functions for review intervals, hint fading, delay threshold.
- `overlay/apps/api/mastery_ext/engine.py` — durable review state and selectors, course deletion, guidance payload.
- `overlay/apps/api/mastery_ext/analytics.py` — exposure-aware retention and independently answered transfer counts.
- `overlay/apps/web/src/app/mastery/workspace-ui.tsx` — Learn reveal; adaptive Solve query/mode; retention and transfer presentation.
- `tests/test_science_learning.py`, `tests/test_science_ui_contract.py` — science-specific contract/regression tests.
- `tests/test_learning_loop.py` — now correctly tests initial one-day retrieval, not three immediate acquisitions mistaken for seven-day review eligibility.

## Constraints and limits

- Existing Mac production branch has not been modified or merged.
- Frontend syntax is verified locally; the complete Next.js build, authenticated browser app, and real native Cocoa window are NOT verified by this handoff.
- The source snapshot itself predates the latest Mac release branch. Resolve changes in an isolated integration branch and run its complete CI and native smoke tests.
- Retention intervals are **heuristics**, not calibrated individual forgetting curves. Improve only through held-out experiments that compare independent delayed recall, not on immediate practice accuracy alone.
- Interleaving uses skill tags. Its effect depends on genuine, editorially distinct item families; the current question bank has structural tests, not full psychometric calibration.
- Tutor-tagged transfer is not proof of far transfer to unseen domains or official exam scores.

## Release gate

On the merged build, use a disposable learner/course: complete unaided new question, request hint on second, verify assisted event cannot raise mastery, finish first-day review, test 3-day spacing, trigger a wrong answer, verify repair -> transfer -> delayed review, compare analytics numbers to the event log, quit/reopen without losing data, run native offline smoke and full web tests.

**Final tests to run in this source:** `python -m pytest -q tests/`; `python -m compileall -q overlay/apps/api/mastery_ext`; TSX parser/transpile + full Next build when dependencies are available.
