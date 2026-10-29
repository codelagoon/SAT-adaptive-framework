# Tenet integration — verified checkpoint, 2026-10-29

**INCOMPLETE / NOT RELEASE-READY.** This is a verified integration milestone, not completion of the complete handoff.

## Source and recovery
- Repository: codelagoon/SAT-adaptive-framework. Feature branch: `codex/tenet-integrated`.
- Protected foundation: `6cb852c588c13c707b9bcc1e2971aa07d118ee25`; remote rechecked unchanged.
- Application code tested: `eabf06fcd849550b17dc3e10c292cf45009edd47`. Configuration follow-up: `94f2b16d3d311239718806c8146706308e78aba2` (Codemagic only; same application code).
- Governing inputs: attached complete handoff dated 2026-10-29 and GitHub issue #2. Inner ZIP SHA-256 `b587011df54dea8b3e9d53c44518fee7131b9b42d98a5d0712f6f379caabcf31`; CRC verified.
- Local isolated worktree: `/Users/george/Documents/Codex/2026-10-28/x20/work/tenet-integrated`, currently at eabf06f. Local disk exhaustion prevents writes/fetch/checkpoint; configuration and this ledger were saved directly to the isolated GitHub branch. After freeing storage, inspect local changes and fast-forward to the remote branch. No force push, merge, public release or paid Codemagic run.
- Preserve existing installed app and ordinary learner databases. All runtime tests used disposable identities/data.

## Implemented and exercised
Neutral Ink Home/Learn/Bank/Solve/Tests/Analytics actual Next routes, five-icon rail/mobile dock, focus Solve, legacy redirect; deterministic curriculum/learning policy and analytics; server-logged hints, fresh/repeat/assisted provenance, bookmarks, draft persistence and course isolation. Mac installer/runtime infrastructure retained.

Independent whole-branch review found seven Important and two Minor defects. One repair pass addressed all nine: raw hint leakage; late draft resurrection; wrong-runtime native readiness; repeats falsely establishing interleaving/transfer; stale Back/query state; invented default confidence; unsubmitted hints omitted from exposure; bookmark status beyond first 120 items; overlapping attempt totals. Six backend regressions were observed failing before repair, then passing; real delayed-save race and Back navigation run in browser CI. Native ownership changes compile, but actual Cocoa behavior remains unverified.

## Release gates
| Gate | Actual evidence | Result / remaining requirement |
|---|---|---|
| Protected base / reconciliation | Base 88 passed, 2 skipped; isolated branch starts at exact protected SHA; native build retained | PASS for this integration slice |
| Complete source suite | [CI 40902264623](https://github.com/codelagoon/SAT-adaptive-framework/actions/runs/40902264623), eabf06f: 196 passed, 2 skipped; remaining skips are Linux-only runtime fixtures | PASS on clean Apple Silicon runner |
| Full Next/TypeScript + lint | Same run: actual production build and full eslint exit status 0 | PASS |
| Real production web interactions | Same run: disposable authenticated owner; Home action, keyboard filters, Learn recall/reveal, bookmarks, drafts/reload, held-save submit race, server hints, correct/wrong answers, prerequisite diagnosis/repair, independent analytics, Back navigation, SAT/Physics isolation, legacy redirect | PASS for exercised journeys |
| Responsive visual/console evidence | 18 actual route screenshots + accessibility trees at 1440x900, 1280x800, 390x844; no document overflow or captured console errors; representative screenshots inspected across all six routes | PASS for exercised states; not full accessibility certification |
| Legacy migration | Real foundation engine DB created for two users/three courses; SQLite backup copied; new migrations run twice, legacy rows/notes/pending contexts preserved; original byte SHA unchanged; legacy events excluded from independent evidence | PASS disposable migration; installed learner-data migration still requires native acceptance |
| Content structure / track boundaries | Audit all eight academic tracks: zero structural failures after deduplication; independent numeric-oracle tests; real SAT/Physics grading/history isolated | PASS technical checks; human editorial review/full blueprint coverage NOT established |
| Native arm64 build / bundled DMG | Same CI: Swift arm64 compile, self-contained Python/Node/Next DMG; mounted, relocated into path containing spaces; ad-hoc signature verified | PASS build and service smoke; candidate artifact only |
| Runtime stop/restart / deletion | Real bundled HTTP grade, diagnosis/repair; exact attempts/review dates/queue preserved across full service restart; deleting SAT preserves Physics; no listeners after shutdown | PASS service path; Cocoa quit/reopen not proven |
| OS-enforced offline | Local sandbox denies external socket with EPERM; real isolated API grades/repairs/restarts under same policy | PASS backend only; full native WebKit offline gate NOT RUN |
| Actual Cocoa/WebKit | No captured native window. LaunchServices returned -10810 during exhausted storage; Accessibility preflight false, screen capture true | BLOCKED by host/storage/automation access; complete native course→hint/unaided answer→diagnosis→analytics→quit/reopen still required |
| Clean account / physical M1 / Gatekeeper | CI mounted/relocated candidate only | NOT RUN; must install and open actual candidate in a clean test account |
| Signing / notarization / updater | `security find-identity -v -p codesigning`: 0 valid identities. Sparkle 2 evaluation retained from foundation ledger history | BLOCKED on Developer ID/notarization credentials and implemented/tested signed feed, update, migration/rollback recovery |
| Manual Codemagic compatibility | 94f2b16 adds Python/Node Playwright, real UI smoke, full lint gate and evidence artifacts; manual M2 workflow preserved. YAML parsed and all six script blocks passed bash syntax. Existing config checks 2 passed using no disk capture/cache | Configuration checked; Codemagic runner NOT EXECUTED (no paid run) |

Fresh full Apple Silicon recheck [40905363795](https://github.com/codelagoon/SAT-adaptive-framework/actions/runs/40905363795) at 94f2b16 is IN PROGRESS. Do not treat an unfinished run as passing.

## Candidate and evidence
- [Installable candidate DMG artifact](https://github.com/codelagoon/SAT-adaptive-framework/actions/runs/40902264623/artifacts/12909878231), archive 349,617,909 bytes, 14-day CI retention. Ad-hoc signed; not approved for release.
- [Browser evidence](https://github.com/codelagoon/SAT-adaptive-framework/actions/runs/40902264623/artifacts/12909608786), result.json reports pass, 3 viewports, 18 screenshots, consoleErrors=[].
- [Production web verification assets](https://github.com/codelagoon/SAT-adaptive-framework/actions/runs/40902264623/artifacts/12910007969).
- Local scratch evidence under parent work/: tenet-ci-5.log/browser; tenet-migration.log; tenet-content-audit.json (audit stdout, not JSON); tenet-review-red.log/all.log; tenet-api-smoke/.
- Local deliverable export into outputs is BLOCKED: a ten-byte write fails with OSError errno 28. Do not mistake existing Oct 28 outputs/STATUS.md for this current checkpoint.

## Unresolved product gaps — must not be described as completed
1. Tests route currently launches unseen independent practice; **no full timed SAT/ACT exam engine**, pacing/break/resume or withheld-feedback timed block. No official score prediction or calibration.
2. **Desmos** is an unverified online iframe/link. Embedding/licensing, network policy, allowed-mode restrictions and meaningful offline calculator behavior require implementation/verification. SVG question graphs are not a calculator.
3. Curriculum maps current installed families; **full exam/subject coverage, editorial quality, source/license/version/distractor-rationale schema and revision provenance** need completion. Technical structure/numeric checks do not prove editorial correctness or official coverage.
4. **Debate** code/data/endpoints retained and archived, but no usable entry in the new academic course selector/flows. Restore an accessible separate workflow without deleting records.
5. **Diagnostic onboarding**, complete configured sets/Solve keyboard and scratchpad acceptance, and deeper difficulty/subskill/error analytics still need explicit implementation/acceptance beyond the tested journeys.
6. **Crash/fault recovery, backup/restore, corruption/port/startup failures, real installed-data migration**, clean-user Gatekeeper installation, native OS-offline interaction and signed updater/rollback remain unproven. Graceful service restart is narrower evidence.
7. Learning policies and review intervals are heuristics; withheld-question intervention effectiveness, psychometric calibration, far-transfer validity and learning gains are not established.

## Observed failures and bounded repairs
- 40863435034: source/build/DMG services pass; hidden Next route-announcer miscounted as alert. Harness scoped to Tenet main.
- 40867596121: actual Next→uvicorn proxy ECONNRESET/HTTP500; disabled loopback upstream keep-alive. Later live journey passes without suppressing errors.
- 40869518241: harness SQLite oracle assumed compact UUIDs; actual DB uses hyphenated UUIDs. Fixed lookup. Three Tenet lint errors and hook warning repaired.
- 40893508874: 195 passed, 2 skipped, one tooltip sampled before hover transition; added bounded visibility wait. Clean run 40902264623 passes.
- Local download failures: managed Python 3 retries/415s; Python Playwright 6 retries/partial download; npm bootstrap incomplete. No unproductive repeat.
- Local later regression: 185 passed, 2 skipped, two temporary SQLite disk-I/O failures. Subsequent pytest capture cannot create any temporary directory. Historical 187/2 local pass is not substituted for those failures.
- Storage: APFS container 99.9% used, ~115 MiB reported; ten-byte file creation and configuration save return ENOSPC. Removed only task-generated build/cache/extracted copies; did not delete ordinary user files or installed app. No native proof fabricated from HTTP or Playwright.

## Rulings made
- Use an ordinary isolated Git worktree when native worktree tool rejected nested sourceRoot; cost: app attachment not automatically managed.
- Mac branch owns runtime/installer and course-slash patch; full ZIP owns intended new learning/UI; never apply historical patches. Cost: reconciliation must be verified by full build/runtime checks.
- Use supplied Neutral Ink source/screenshots as visual lock; no design re-selection. Cost: live Refero research was not repeated.
- Keep STATUS.md as sole continuing ledger and treat supplied science plan as source evidence, not a second execution system. Cost: historical checkpoints live in Git history.
- Treat unknown-skill legacy help conservatively as owner/course exposure when computing delayed retention. Cost: some historical retention excluded until fresh delayed checks.
- Treat overlapping attempt totals as Important rather than cosmetic; fix bookmark pagination in same integrity pass. Cost: both included in regression/CI scope; no deferred cosmetic minors.
- Preserve verified application milestone rather than start a large new feature while storage prevents builds/tests; full handoff remains incomplete.

## Next single action
Free at least 5 GB on the Mac and enable Accessibility for the app controlling native verification. Then fast-forward this isolated worktree from origin (it currently remains eabf06f), retrieve the candidate DMG, and verify actual installed Cocoa/WebKit journey with a disposable data folder under OS-level external-network blocking. Confirm quit/reopen persistence and installed-data migration before any release decision. Continue outstanding product slices only with their own complete build/test gates.

Candidate retrieval after storage is available:
`gh run download 40902264623 --repo codelagoon/SAT-adaptive-framework -n MasteryEngine2-Standalone-M1-DMG -D ../tenet-native-installer`
