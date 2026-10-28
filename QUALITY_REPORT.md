# Offline Core v0.6 — question bank and learning-loop QA report

## Reproducible volume audit

The generator was run locally for each deterministic pack from `pack-0` through `pack-20` (160 requested per pack). Question strings were deduplicated **across all 21 packs**; repeats are not counted in the unique column.

| Track | Distinct mathematical/science questions across packs | Notes |
| --- | ---: | --- |
| SAT Math | 2,886 | Parameterized original math families |
| ACT Math | 2,871 | Parameterized original math families |
| Algebra 2 | 2,878 | Parameterized original math families |
| Physics | 2,128 | Math and physics, with plotted graph exercises |
| ACT Science | 3,015 | Data-interpretation and graph families |
| SAT Reading & Writing | 1,143 | Rule-driven grammar prompts **only**; 102 separate authored questions in starter set |
| ACT English | 1,141 | Rule-driven grammar prompts **only**; 40 separate authored questions in starter set |
| ACT Reading | 62 | Finite original authored question pool, not generative |

These totals measure distinct text strings across parameter configurations, **not** independent exam-quality passage ideas or standardized-test equivalence. Some packs fall below 160 additional unseen questions as the finite parameter space becomes saturated. The UI may offer 20 expansion packs per track; the generator intentionally filters repeat prompts.

## Checks performed

- `python3 -m pytest tests/ -q`: **79 passed** on Linux.
- `bash -n scripts/*.sh`: success; the production launcher avoids npm/pip/git/network operations at app startup.
- Additional regression tests cover repair → transfer → challenge; due review against 2,000 unseen problems; database migration; repeated-question scheduling; explicit user skipping; and conservative distractor diagnosis.
- `python3 -m compileall -q overlay scripts`: success.
- Both new TSX modules parsed using TypeScript `transpileModule` with no syntax diagnostics (this is **not** a full `tsc` against the upstream workspace).
- Generated questions were checked for distinct multiple-choice options, correct-answer membership, nonblank worked explanations, topic metadata, and repeat filtering.
- Selected mathematical families had their answers independently recomputed from stem parameters, rather than simply trusting the generating answer key.
- A no-network generation test ensures the offline bank itself does not fetch remote content.
- The **real production Bash launcher** was run with mock OpenTutor and Next.js child HTTP services: startup returned healthy only after both endpoints responded, cleanup terminated them, occupied ports refused startup, and `.env` shell metacharacters could not execute. This is not an end-to-end Mac test.
- Regression tests confirm deleting one course removes only that user's extension records, retaining other courses and users; the upstream deletion patch remains idempotent.
- Seven actual OpenTutor integration anchor files were checked in the **pinned commit** through the GitHub connector. This is a source compatibility check, not a build.
- The M1-only end-to-end smoke script was authored but **not executed on M1**, so it remains a release gate.

## Remaining gaps

- The bank has not had independent expert editorial review of every generated question or distractor; algorithmic correctness tests do not prove pedagogy quality.
- Reading and science passages are not an official, calibrated SAT or ACT bank; ACT Reading has only 62 curated questions.
- No full native M1 integration or cold/offline start test was possible on Linux. Installation downloads and builds dependencies up front; normal launch does not run installers. A real disconnected M1 cold-boot test has NOT been performed.
- The BKT skill estimates and graduated review intervals are uncalibrated; they are **not** predictions of official exam scores or validated memory models.
- The answer-specific feedback is constrained to common distractor patterns and gives only tentative hypotheses; it cannot inspect the learner’s unrecorded reasoning.
- The native `.dmg` is not self-contained: the locally built launcher refers to installed OpenTutor dependencies.
- DeepTutor remains an optional external dependency. OpenTutor document features are preserved and unmodified.

The counts above were generated with `PYTHONPATH=overlay/apps/api python3` importing `mastery_ext.practice_bank.generate_verified` and `mastery_ext.grammar_drills.generate_grammar_drills`, iterating 21 pack seeds and counting distinct `question` strings.

## v0.6.1 installer fix

Fixed an extra `fi` in `scripts/install_mac.sh`, which made the v0.6.0 installer fail to parse. Added a regression test that invokes `bash -n` on all installation and launch scripts.
