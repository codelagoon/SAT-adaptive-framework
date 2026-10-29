# Mastery Engine 2.0 — Independent learning foundations handoff

**Source:** v0.9 offline core source snapshot in Library, following the `mastery-engine-codemagic` branch. The current working Codex branch `codex/mac-release-foundation` has different Git blob hashes for the edited engine, router, and page, so **do not assume a blind patch applies**. Reconcile the diffs on a new feature branch; do not overwrite Codex's Mac release changes.

## Completed in this source handoff

- New immutable first-attempt **event-level** SQLite ledger with first independent / assisted / repeated / legacy-unknown classification, skill and date cohort metrics, solve-time medians, sparse-sample disclosure and recommendation.
- Conservative **legacy migration** so previously answered questions cannot be reclassified as first attempts after upgrade. Current data remains intact, with historical help status unknown.
- Assisted correct answers no longer raise BKT or discharge due review debt. Existing original BKT and scheduled review persisted.
- New authenticated API routes for skill-based curriculum, diagnostics without answer keys, safe question browsing/solving, content audit, user-scoped bookmarks, answer draft recovery, analytics, and study plan.
- Curriculum domain/skill map for all **eight existing practice tracks**; all currently produced skill labels have lessons (original existing 48, five added lessons); prerequisites where supportable. This does **not** claim complete official exam syllabus coverage.
- Bounded study plan: prioritize scheduled review, then observed independently evidenced errors, then unmeasured skills; explicitly not a score forecast.
- Deterministic source-only content audit over all installed generated pack families. Structural validity is not independent human editorial review or exam psychometrics.
- Isolated interactive reference design matching the separate Home, Learn, Bank, Solve, Tests, and Analytics workflow; browser QA and screenshots at multiple widths.

## Verification

- `python -m pytest tests -q`: **run locally before handoff**; check the included report and repeat after reconciliation.
- `python scripts/audit_curriculum_content.py docs/CONTENT_AUDIT.json`: dataset coverage and deduplicated structural audit.
- `python -m compileall -q overlay/apps/api/mastery_ext`: Python syntax check.
- `tests/test_curriculum_analytics_quality.py` covers repeat/non-inflation, assisted BKT gate, migration, deletion, course/user separation, drafts/bookmarks, all eight skill maps, synthetic invalid MC items, study plan selection, timing and diagnostics without answer leaks.
- `visual_tests/test_visual_reference.py` covers browser-level *reference* navigation. Requires installed Chromium and Playwright. For offline CI, keep this test in a separately provisioned visual-test job rather than breaking Mac build on absent Chromium.

## Known gaps / no false completion claims

- **Not integrated** in current `codex/mac-release-foundation` branch; supplied patch is reviewed/tested against snapshot and needs reconciliation.
- A new source-level Next workspace with separate Home/Learn/Bank/Solve/Tests/Analytics routes was added; old combined UI remains at /mastery/legacy. The illustrative HTML preview and TSX source have NOT been run together inside the actual bundled Mac application. Desmos iframe rendering/permissions remain unverified, and its online-only limitations must be enforced.
- Existing data collection cannot reconstruct historical hints, reasons or first-attempt event ordering when timestamps collide; migration records such evidence as legacy-unverified.
- No full React/Next build or authenticated FastAPI HTTP integration test was possible without the pinned full upstream checkout/dependencies. Existing source unit/contract test suite passes in Linux; actual Mac end-to-end remains Codex's work.
- **No** independently validated SAT/ACT score prediction, full exam adaptive blueprint, complete editorially reviewed item bank, or measurable learning-effectiveness trial. Detailed content authoring and expert review remain expensive, independent work.
- Not yet integrated or tested with Sparkle, signing/notarization, Gatekeeper, production Desmos, physical offline mode or actual native WebKit.

## Handoff order

1. Apply/reconcile source patch onto a branch created from current `codex/mac-release-foundation`; inspect `git diff` rather than wholesale copying older files.
2. Run existing tests plus new tests with *Python 3.11* and normal OpenTutor dependencies. Add Playwright to a visual-test CI job, keep screenshots as review evidence.
3. Add API integration tests for authenticated owner/non-owner scenarios and question-bank queries, with disposal test DB. Verify hints/prepare/submit flags and restart data.
4. Port the distinct workspace reference to real Next routes and wire actual endpoints. Preserve Debate Prep legacy route and upstream worksheets.
5. Run a macOS build/launch, Playwright through the actual app, external network blocking, and migration/recovery tests.
6. After all green, gate default navigation switch; no release-ready label until signed/notarized and installer/update proof.

**Principle:** This is tested incremental software, not a claim that the entire Mastery Engine product is 100% finished.

## Production study workspace update

See `docs/PRODUCTION_UI_HANDOFF.md` for new route ownership, source-only checks, and the exact native/Next acceptance work required before merge.
