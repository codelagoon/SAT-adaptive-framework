# Mastery Engine 2.0 — release gates (v0.6 assessment)

## Product contract

- One-tap practice and immediate, deterministic offline grading.
- A wrong answer initiates the repair → hard transfer → later retention loop.
- Due review receives protected capacity even with a large unseen bank.
- Explanations distinguish known correctness from speculative reasons for mistakes.
- Normal use must not require Internet, AI inference, a Python package installer, or a development server.
- Worksheet support stays in OpenTutor; don't spend feature work on it.

## Verified here

- [x] Deterministic offline questions with independent answer checks for selected mathematical families.
- [x] 78 automated Python tests, including adversarial core learning-loop scenarios.
- [x] Older local mastery SQLite schema migrates in place without dropping records.
- [x] Offline diagnosis is gated on a submitted attempt and labels its conclusions as hypotheses.
- [x] Course deletion purges separate extension data per user and per course; regression tests verify unrelated courses/users survive.
- [x] Upstream integration anchors checked at pinned OpenTutor commit; new installs check out that commit.
- [x] Launcher production-health checks, child process lifecycle, localhost collisions, and data-only `.env` parsing verified against fake local services on Linux.
- [x] Mac-only full API smoke test script prepared (not yet executed on M1).
- [x] Native launcher script uses local dependencies and `next start` instead of `next dev`, tested by source assertions and shell syntax.
- [x] TSX source parses with the available TypeScript parser.
- [x] Unrecognized OpenTutor courses no longer silently receive SAT Math questions.
- [x] Offline practice only selects the vetted local bank; it cannot silently route a wrong answer to OpenTutor’s AI-generated-question classifier.

## Release blockers (not passed)

- [ ] Clone the exact compatible upstream OpenTutor commit and run the full API/frontend build on M1 macOS.
- [ ] Prove a fresh install, cold start, disconnect network, practice, close/reopen, and persistence on Apple Silicon.
- [ ] Run `bash scripts/mac_e2e_smoke.sh` with the actual native app on M1; verify grade, diagnosis and deletion cleanup.
- [ ] Run real frontend typechecking and browser-driven workflows with OpenTutor running.
- [ ] Perform independent expert review of question stems, difficulty, plausible distractors, and feedback; improve limited reading bank.
- [ ] Verify native installer experience without manual Python or Node dependencies if shipping to others.
- [ ] Implement and validate full-length digital SAT/ACT exam simulations and calibration before score claims.
- [ ] Benchmark learning outcomes; mastery probabilities and review intervals are currently heuristics.

**Status: integration alpha. Do not market as finished or exam-calibrated.**
