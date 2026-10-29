# Tenet Science Learning Implementation Plan

**Goal:** Integrate five auditable learning mechanisms in Tenet's existing local authenticated quiz pipeline without altering the Mac build foundation.

**Platform:** Existing Python SQLite mastery_ext and Next.js Solve/Learn UI, offline-first. No inferred SAT scaled scores, calibrated retention forecasts or unverified learning gains.

**Tasks / test-first acceptance:**

- [x] 1. Retrieval / guidance: new questions reveal answers only on grade, tutoring guidance defaults to attempting recall, scaffold is triggered by prior independent errors then fades after successes. Unit tests show guarded outputs and adaptive choices.
- [x] 2. Spacing: durable per-skill review state, +1d first success, 3/7/14/30/60d after independent, genuinely delayed review passes; same-day unrelated correct responses never extend a due date; missed/assisted work cannot clear review debt; wrong answers schedule corrective recall. Time-travel tests and restart tests.
- [x] 3. Interleave: after foundational evidence across at least two skills, challenge questions rotate learned skill families without deprioritizing due retention or explicit skill focus. Tests prove genuine rotation and user-choice preservation.
- [x] 4. Evidence: analytics reports independent delayed retention, independent novel transfer, sufficient-sample warnings; no duplicates, aided or same-day response counted as delayed proof. Course deletion removes new state. Test tenant isolation.
- [x] 5. UI: solve displays retrieval-first and scaffold instructions using backend response; Learn provides optional self-check before revealing worked example. Preserve styling & one-viewport shell. Static compilation checks where possible.
- [x] 6. QA/package: full Python pytest; syntax/build if dependencies available, patch + source zip, exact limitations and merge instructions; do not touch Codex Mac release branch.

**Decisions:** Uncalibrated deterministic rules (auditable, local) rather than large AI or speculative BKT scoring. Existing `mastery` probability retained for backward compatibility, but only separate independent evidence counts as defensible mastery. All database migrations additive and course deletion complete.

**Status:** Local implementation and TDD checks complete. Release-gate items explicitly not satisfied: Mac integration, full Next build, real authenticated browser, physical offline tests.
