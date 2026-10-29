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

## Implementation checkpoint
`06b58c1` pushed; Apple Silicon run [40863435034](https://github.com/codelagoon/SAT-adaptive-framework/actions/runs/40863435034) in progress.

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

## Current verification diagnostics
- Actual foundation-engine DB seeded with two users/three courses, copied using SQLite backup, migrated twice: legacy attempts/mastery/notes/queues and pending contexts preserved; migrated events remain legacy-unverified. Original file SHA unchanged. Command `../release-venv/bin/python ../tenet-handoff/verify_foundation_copy.py`; output `../tenet-migration.log`.
- Fresh local build reached pinned upstream/overlay then managed Python download failed after 3 retries/415s (external timeout). Python Playwright wheel failed after 6 attempts (18.9/43.2 MB). No unproductive repeat of either download.
- Local recovery uses read-only existing relocatable Python 3.11.18/pylibs/official Node caches from installed app in a separate build folder, followed by the original production Next/Swift/DMG steps. Script `../tenet-resume-build.sh`; log `../tenet-local-build.log`. Fresh CI executes original full build independently.
- Native preflight: `sandbox-exec` profile with external egress denied/loopback allowed parses successfully. Full network-isolation/GUI test remains pending. Accessibility permission false; screen capture true.

## CI and environment blockers (observed)
- CI [40863435034](https://github.com/codelagoon/SAT-adaptive-framework/actions/runs/40863435034), code `06b58c1`: **190 passed, 2 skipped**, complete Next/TypeScript and native DMG build passed; relocated runtime/restart/deletion smoke passed. Browser harness failed because it counted Next's hidden route-announcer `role=alert` as a Tenet error. Confirmed in installed Next `app-router-announcer.js`; scope narrowed to application `main`, not coverage removed.
- Checkpoint `f9567bc`, CI [40867596121](https://github.com/codelagoon/SAT-adaptive-framework/actions/runs/40867596121) running; added selected-plan-block navigation check and failure screenshot/HTML/accessibility capture.
- Local npm bootstrap ended `Exit handler never called` after network failures. Recovery copying known cached modules then failed **No space left on device**. `df -h .`: **131 MiB available, 100% capacity**. Removing only this task's generated app and incomplete node_modules; no installed app, learner data or protected source removed. Full local bundled build/DMG is blocked by capacity and download reliability; fresh CI remains available.

## Second live failure / repairs
- CI `40867596121` at `f9567bc`: source suite and full native build passed again; real browser failed on console HTTP 500. Downloaded runtime log shows Next proxy `read ECONNRESET` for `/api/courses/overview`, followed by successful client retry. User-facing interaction recovered but zero-console-error gate correctly failed.
- Next's installed config type confirms `httpAgentOptions.keepAlive`; patch now disables upstream keep-alive for loopback uvicorn rather than hiding HTTP failures. Browser harness now logs failing response URLs and explicitly exercises idle/reload.
- Source inspection: Solve dereferenced a missing NAV entry (`Solve` intentionally absent from five-item dock); fixed separate section label without adding a sixth dock icon. Home selected-block action always followed the first plan stage; now maps selected Learn/Solve/review block to Learn/Solve/Analytics. Existing real journey assertions verify both.
- Native title updated to Tenet; explicit MASTERY_DATA_DIR is honored while default learner location and bundle identity remain unchanged. Ruling: did not reproduce old native override failure by launching against ordinary user data; safety takes priority, actual isolated native startup remains the verification gate.
- OS sandbox external connect returned EPERM. Real isolated API graded SAT/Physics, produced repair/diagnosis, restarted preserving exact records, and passed deletion isolation under that same policy. This is backend-only offline proof, not native WebKit interaction.
