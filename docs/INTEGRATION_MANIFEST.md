# Integration Inventory — Mastery Engine Learning Foundations

This source bundle is based on a Library v0.9 snapshot, *not* a clean clone of the current Codex branch. Merge by intent/diff, not wholesale copying. Codex's native Mac fixes take precedence if a file overlaps.

## New files (straightforward to add unless existing in target)
- `overlay/apps/api/mastery_ext/analytics.py` — independent attempt ledger and report
- `overlay/apps/api/mastery_ext/curriculum.py` — lessons, prerequisite graph, initial diagnostic
- `overlay/apps/api/mastery_ext/question_audit.py` — technical question validation
- `overlay/apps/api/mastery_ext/study_planner.py` — bounded review-first study plan
- `overlay/apps/api/mastery_ext/workspace.py` — bookmark/draft persistence
- `overlay/apps/web/src/app/mastery/workspace-ui.tsx` and `.module.css` — real API-connected UI
- `overlay/apps/web/src/app/mastery/{learn,bank,solve,tests,analytics}/page.tsx` — individual routes
- `overlay/apps/web/src/app/mastery/legacy/page.tsx` — old all-in-one Debate Prep UI
- `scripts/audit_curriculum_content.py` and test files — reproducible audits
- `design/mastery_reference.html`, `visual_tests/` — UI reference and test harness

## Existing files needing manual three-way reconciliation
- `engine.py`: event recording, legacy migration, BKT assistance guards, persisted hint-exposure table, deletion.
- `router.py`: authenticated learning APIs, safe question metadata, hint-exposure recording.
- `mastery/page.tsx`: replace previous combined page with Home entry only **after** moving existing legacy implementation to `/mastery/legacy`.
- Old unit tests reading `mastery/page.tsx`: update their pointers to `legacy/page.tsx` and add new UI API/route checks; do not delete their assertions.

## Acceptance steps
1. Verify original Mac release branch untouched, and new feature branch created.
2. Migrations: old SQLite retained; fresh empty DB builds; cross-user/course isolation; no data-loss.
3. Python unit/contract suite, content audit, full TypeScript typecheck and Next build.
4. Disposably authenticated browser screenshots and interactions (mobile/desktop).
5. Real Cocoa launch and offline operations, installation and updates, then release.

### Not a complete product
- The `tests` navigation view deliberately does *not* invent an official exam simulation.
- Desmos iframe must pass real browser/WebKit embed and network tests.
- No official exam content or scored predictions were imported.
- The reference screenshots are illustrative only.
