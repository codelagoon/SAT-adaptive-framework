# Mastery Engine 2.0 — Learning Foundations + Workspace Implementation

**Status:** Fully packaged source handoff on the Library v0.9 snapshot; **NOT merged into** `codex/mac-release-foundation`, NOT a Mac release. This is real code with passing local tests, not a claim of complete verified product operation.

**GitHub reconciliation checkpoint:** The Codex branch `codex/mac-release-foundation` and baseline `mastery-engine-codemagic` both have the same remote file hashes for the core API/old UI, but those hashes differ from the older Library ZIP from which this work was developed. Do not overwrite newer release code blindly. Current validated Mac build pipeline must be preserved unchanged.

## Implemented

- Independent first-attempt SQLite event ledger, guided/repeated/legacy separation, per-skill accuracy, question timings, 7-day cohorts, weak-skill suggestions and explicit small-sample warnings. No scaled SAT/ACT score forecasts.
- Legacy attempt migration preserving unknown provenance as unverified; course-specific deletion and user isolation.
- **Sticky server-side hint exposure** records. A help request permanently marks that question as assisted for that learner/course, even if the client reloads or submits `assisted:false`; assisted correctness cannot inflate BKT or clear repair debt.
- Authenticated course curriculum, diagnostics without answer keys, safe question listing, a selected-question endpoint, bookmarks, autosaved answer drafts, content audits, recommended study steps and post-mistake probes.
- Skill/lesson maps across all eight supported *existing offline bank* tracks. These are **not** a full official SAT/ACT curriculum or editorially verified exam questions.
- Original offline question-pack technical audit with deduplication and provenance warnings. Randomized question variants are not independent authored questions.
- **Real Next source routes**: `/mastery` Home, `/mastery/learn`, `/mastery/bank`, `/mastery/solve`, `/mastery/tests`, and `/mastery/analytics` using API calls instead of fabricated metrics. `/mastery/legacy` preserves Debate Prep and prior UI.
- Bank filters and expansion, exact ID handoff to Solve, scratchpad reasoning/autosave, bookmarking, source-data graphs, answer grading, mistake diagnosis/probe, and separate analytics display. Embedded Desmos iframe exists but is **not verified to render online in the production WebKit build**.
- A visually checked reference HTML and a separate responsive Next CSS component system. Source-level tests plus a conditional real-Next Playwright screenshot test are included.
- Practice Tests section is truthful about missing full exam simulation; no falsely calibrated exam results are displayed.

## Verification executed in this local source environment

- `python -m pytest tests visual_tests -q` → **156 passed, 3 skipped**. Three skipped tests require an authenticated real app and are not credited as passing.
- `python -m compileall -q overlay/apps/api/mastery_ext` → Python syntax PASS.
- TypeScript `transpileModule` parse on 9 TSX page/component files → no parse errors. **Not an upstream TypeScript typecheck**.
- Standalone HTML reference: Chromium/Playwright render and navigation tests at 1440px, 960px and 390px, plus interaction checks → PASS. This is visual *reference* testing, not the live Next UI.
- Existing question audit is structural only, without expert editorial review or calibrated test scoring.

## Open gates that must NOT be misrepresented

1. **Upstream merge:** Reconcile engine/router/legacy UI changes with exact GitHub branch, rather than applying a v0.9 patch blindly.
2. **Real Next compile/run:** Install pinned upstream dependencies, full `next build` + typecheck + browser interaction tests against authenticated live API, verify no answer leaks and errors.
3. **Native macOS:** Genuine Cocoa/WebKit launch, focus, quit, reconnect, physical network isolation, real install/Gatekeeper and data migration/restart validation on an Apple Silicon machine.
4. **Design fidelity:** Live Refero references remain unavailable because the connector's subscription is inactive. Verify actual app screenshots and accessibility; preview screenshots alone cannot prove final UI.
5. **Curriculum/content:** Full SAT/ACT official blueprint coverage, expert editorial validation, psychometric difficulty and learning-effectiveness experiments are **not done**. Existing tracks only cover skills present in the provided question generators.
6. **Tests and distribution:** Authentic timed exam implementation, full score validity, Developer ID signing/notarization, Sparkle secure update channel, rollback safety, and released updater tests remain open. No developer credentials were provisioned.

## Minimal-cost Codex integration route

1. Start an isolated feature branch from **`codex/mac-release-foundation`** at verified checkpoint. Do not touch the current release branch or user's learner data.
2. Extract this source kit and compare `overlay/apps/api/mastery_ext/{engine,router}.py` with that branch before merging. Add the new self-contained modules and routes first. Preserve `scripts/build_portable_macos.sh` and all macOS CI code from the current branch.
3. Merge server code in small logical edits, run Python tests and strict typecheck, then run the full Next app with a disposable test account. Never use real learner credentials in CI.
4. Run `visual_tests/test_live_next_ui.py` with local URL, disposable authenticated storage state, and a seeded academic course. Visually inspect screenshots at three widths and test solving, hint, submit, autosave, and analytics against actual backend.
5. Re-run the native Mac CI/DMG/Gatekeeper gates. Merge only after evidence is available. Keep this as an integration branch until then.

**No one should mark a requirement complete because source exists or a static screenshot looks good.** Only the acceptance evidence can close it.
