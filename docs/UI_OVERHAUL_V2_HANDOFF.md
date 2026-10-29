# Mastery Engine — UI overhaul v2 (2026-10-28)

## Status
A substantial original UI replacement is implemented in the feature branch **source snapshot** at `overlay/apps/web/src/app/mastery/workspace-ui.tsx` and `.module.css`. It has **not** been merged into `codex/mac-release-foundation`, run in the authenticated upstream Next app, or verified in the native Mac window. Do not present the preview as an actual connected application.

## Changes implemented in actual Next source
- **Original visual system:** light navigation shell, compact course selector, disciplined typography, lower card clutter, responsive layouts and semantic icons.
- **Home:** actionable next block from real `/study-plan` response, real plan steps/durations, clear destinations. No fake metrics.
- **Learn:** chapter/skill navigation remains separate from solved questions; worked examples, prerequisites, and checks retain live `/curriculum` data.
- **Question Bank:** denser indexed results, skill/difficulty/status filters, direct ID-driven handoff to Solve.
- **Solve:** full-screen focused exam-style environment with navigation rail hidden; larger readable question and answers, retained Desmos-on-demand, bookmark, help, grading, draft autosave and error flows.
- **Analytics:** live event-derived independent first-attempt metrics, skill-level accuracy and trend SVG based only on available recorded daily series; no invented score predictions.
- **Tests:** clear distinction between independent practice and unvalidated full SAT/ACT exam simulations.
- **A11y:** preserved keyboard-focus states, fieldsets/labels/radio inputs, current page indicator, and responsive mobile navigation.

## Independently verified in this container
- Existing source suite + new preview tests: **152 passed** (`python -m pytest tests visual_tests/test_overhaul_preview.py -q`).
- TypeScript TSX `transpileModule` **syntax**: pass (not full upstream typecheck).
- PostCSS parse on redesigned stylesheet: pass.
- `git apply --check MasteryEngine_UI_Overhaul_v2.patch` against the exact **Learning Workspaces Feature Kit baseline**: pass.
- Chromium preview screenshots at 1440px and 390px, all key screens; no horizontal overflow observed. Navigation, focus mode, question choice, and answer feedback verified in the preview test. The preview contains sample data and is not a live authenticated app.

## Critical integration instructions
1. First integrate `MasteryEngine2_Learning_Workspaces_Feature_Kit.zip` against the newer Codex branch, as documented in `HANDOFF_REPORT.md`; reconcile backend engine/router changes carefully and preserve native build CI.
2. Then apply `MasteryEngine_UI_Overhaul_v2.patch` **only after** the feature kit's UI source files are present. Do not apply it blindly to the old single-page `mastery-engine-codemagic` source.
3. Run full upstream TypeScript typecheck and `next build`; run live authenticated Playwright tests, and inspect the actual Cocoa/WebKit app with disposable learner state. Test Desmos behavior and offline fallbacks.
4. Verify real accessible focus, navigation, and data behavior before merging. Do not claim release readiness from source-only and static-browser evidence.

## Reference status
OnePrep's separate Masterclass, Question Bank, Practice, Tests, and Analytics workflows guided the IA. Refero live library search remains blocked by an inactive subscription, so no claims are made of successfully retrieved Refero screens. No OnePrep branding or proprietary content was copied. Visual preview data is explicitly illustrative.
