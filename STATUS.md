# Tenet integration — 2026-10-29

Branch `codex/tenet-integrated`; protected base `6cb852c588c13c707b9bcc1e2971aa07d118ee25`.
Spec: supplied `TENET_CODEX_HANDOFF_2026-10-29.md` and GitHub issue #2.
Input SHA-256 verified `b587011df54dea8b3e9d53c44518fee7131b9b42d98a5d0712f6f379caabcf31`; CRC passed.

## Integration plan / ledger
1. Verify input/base and reconcile complete feature tree with Mac foundation.
2. Pass imported suite, migration/data isolation tests and curriculum audit.
3. Full production Next build, typecheck/lint; real disposable-user browser journeys and visual QA at 1440x900, 1280x800 and 390x844.
4. Rebuild DMG, shared service smoke, native Cocoa/WebKit launch and offline/restart verification.
5. Independent whole-branch review, bounded fixes and release gate evidence.

## Decisions
- Ruling: native worktree tool rejected this nested repository as sourceRoot; used an ordinary Git worktree at `work/tenet-integrated` instead. Protected base remains untouched; new branch starts at exact requested SHA.
- Ruling: keep foundation scripts/workflows/Swift shell and Mac regression tests; import ZIP overlay, semantic learning tests and audits. Keep foundation patcher's course-slash rewrite (missing from old ZIP). Never apply included historical patches.
- Ruling: use this STATUS ledger, per repository instructions; supplied science implementation plan is already implemented inside ZIP and is not an integration plan. No duplicate plan system.
- Visual lock: supplied Neutral Ink source and neutral-ink screenshots; fixed viewport, 76px rail / 56px dock, five nav destinations, separate focus Solve, custom accessible filters. Existing product decisions authorize direct implementation, no design re-selection.

## Evidence
- Protected base rechecked: **88 passed, 2 skipped** (`../tenet-foundation-baseline.log`); imported feature tests before implementation fail because workspace and analytics modules are missing.
- Feature tree copied: **181 passed, 2 skipped** excluding browser preview tests. Full suite collection awaits Playwright download. Browser fixture paths updated for managed Chromium or explicit local browser.
- Production browser harness added; CI will run real disposable-identity interactions and capture 18 screenshots/accessibility trees. Existing smoke checks retained; old SSR heading assertion adapted to the new loading shell.
- One packaging contract failed because it only recognized a single-line workflow command; updated discovery to recognize the same smoke invocation inside a multiline command, preserving every release assertion.
- Native automation preflight: screen recording allowed; macOS Accessibility permission **false**. Actual native interaction through accessibility is blocked until granted; no permission dialog or unrelated application was touched.
- Local actual Apple Silicon portable build started, with an existing official standalone Node executable read-only from installed app; user installation/data unchanged. Exact production script retained.

## Open release gates
All integration, browser, native and distribution gates remain pending until actually executed. Official exam simulation/calibration/editorial quality, Debate Prep UX, OS-enforced offline, Gatekeeper and signing/updater constraints must be reported individually.

## Next action
Read full source-suite and production-build output; repair observed failures before proceeding to real-browser journeys.
