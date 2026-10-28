# Status — 2026-10-28

Branch: `codex/mac-release-foundation`, based on inspected `mastery-engine-codemagic` at `f78e756968b8f70ddbdbaac24024265f0144cafa`.
Implementation checkpoint: `73156bb50b88679afeb2d4d6b68405217ba806d4` (pushed). Subsequent evidence-only checkpoint: `git log -1 --format=%H`.
Scope: bounded Phase 0/1 release-foundation slice. Consolidated scope not attached; supplied execution brief governs. Product remains integration alpha.

## Verified baseline
- Manually dispatched actual Apple Silicon GitHub Actions run [40783839892](https://github.com/codelagoon/SAT-adaptive-framework/actions/runs/40783839892), conclusion **success** at original branch SHA.
- Its Python suite reported **88 passed, 2 skipped**. Its unit/contract checks, production Next.js build (including `Running TypeScript` / `Finished TypeScript in 8.9s`), bundled Python imports, arm64 Swift compilation, DMG build and existing real grading smoke all passed; downloadable artifact `12858003538` (350,320,870 bytes).
- Baseline smoke launched the shell/services from the build directory; it did not exercise native UI, relocated install, full restart or physical network disconnection.
- Local shell initially resolved an incompatible Python (collection error). Explicit Python 3.11 venv is at `../release-venv`; use its absolute interpreter or `../release-venv/bin/python`.

## Local validation on working branch
- `../release-venv/bin/python -m pytest tests/ -q`: **86 passed, 4 skipped**. Two synthetic Linux-only tests skip on macOS; two port-dependent tests skip because local service ports are occupied. No existing application/process was disturbed.
- Release verifier read-only DB guard executed directly: missing DB raises `sqlite3.OperationalError` and no empty DB is created.
- `for script in scripts/*.sh; do bash -n "$script" || exit; done`: pass; `git diff --check`: pass.
- `xcrun swiftc -parse-as-library -O -target arm64-apple-macos13 -framework Cocoa -framework WebKit macos/MasteryApp.swift -o ../MasteryEngine2-native-check`: pass, one existing unused-result warning. Full Xcode is absent, but Command Line Tools include a working native SDK/compiler.

## Current changes
- Both CI providers now use one stronger smoke gate. It mounts the DMG, copies to a different path containing spaces, verifies signature/arm64 and launches bundled services with no system Python/Node.
- Test data uses a new disposable directory through `MASTERY_DATA_DIR`; ordinary learner databases are untouched. Relative data paths fail closed.
- Real SAT/Physics wrong answers must produce history, diagnosis and targeted repair; service stop/restart must preserve exact rows, review dates and queued question; deleting SAT must preserve Physics.
- Dead external HTTP proxies exercise the local-only path but are **not** physical/OS network isolation. Native Cocoa interaction is explicitly not claimed.
- Added concise architecture map in AGENTS.md and ignored generated caches/builds.

## Strengthened native CI — passed
- Run [40785221543](https://github.com/codelagoon/SAT-adaptive-framework/actions/runs/40785221543), exact code SHA `73156bb50b88679afeb2d4d6b68405217ba806d4`, **success**, 6m06s, `macos-15-arm64` runner.
- `uv run --with pytest --python 3.11 python -m pytest tests/ -q`: **88 passed, 2 skipped in 37.33s**. Remaining skips are the two explicitly Linux-only fake-runtime fixtures.
- `bash scripts/build_portable_macos.sh`: **pass**. Bundled Python imports, production Next.js/TypeScript (10.4s), Swift arm64 compilation and standalone DMG all completed.
- `bash scripts/codemagic_smoke.sh`: **pass**. Real DMG mounted, app relocated to a path containing spaces, deep strict ad-hoc signature verified, bundled Python/Node used, actual learner page rendered over HTTP.
- `verify_bundled_runtime.py exercise/recover/cleanup`: **pass**. Real SAT/Physics courses, wrong-answer grading and diagnosis, new repair question, exact SQLite/API snapshots across full service stop/restart, review dates and repair queue preserved, SAT deletion preserves Physics, test history purged. Both shutdowns left no service listeners.
- This tests the bundled service launcher, **not** the Cocoa/WebKit application launch/quit path. Dead proxies are not OS-enforced offline isolation.
- Download [MasteryEngine2-Standalone-M1-DMG artifact](https://github.com/codelagoon/SAT-adaptive-framework/actions/runs/40785221543/artifacts/12859187841), archive 350,905,211 bytes; CI retention 14 days. Extract DMG, open it, drag app to Applications, eject image, open app. Ad-hoc signed; Gatekeeper/clean M1 install still needs verification. No public release published.
- Nonblocking CI annotations: older action versions are running through GitHub's Node 24 compatibility path; uv has no matching cache-dependency manifest. Dependency locking/security maintenance remains future work; no action upgrade attempted in this slice.

## Acceptance inventory / gap ledger
| Gate | Existing implementation | Required proof / current gap |
|---|---|---|
| Standalone arm64 DMG | Python/Node/Next + Swift bundle | Both baseline and strengthened native CI pass; clean M1/Gatekeeper install pending |
| Startup/quit/restart | Shell owns services, SQLite outside app | Relocated-service/restart gate passes; Cocoa quit and clean M1 install still pending |
| Learning / repair / review | Offline banks, deterministic grade, repair/transfer, heuristic review, diagnosis hypotheses | Existing unit checks + real wrong-answer smoke; withheld intervention evaluation pending |
| Migration and deletion | Legacy extension migration, course/user-scoped purge | Existing regression tests; native saved-data migration and user-deletion workflow still pending |
| Tracks | Eight named SAT/ACT/Algebra/Physics tracks | Unit isolation + passing real SAT/Physics check; full track blueprints pending |
| Home/Learn/Bank/Solve/Tests/Analytics | Single combined `/mastery` page; SVG graph | Distinct routes, lessons, Solve autosave/bookmark/keys, Desmos and timed tests missing |
| Attempt integrity / analytics | Result IDs, confidence/reasoning/timing, BKT aggregate | Immutable first/repeat/assistance/version events and trusted deep analytics missing |
| Content | Original authored/generated families, independent numeric oracles | Full license/version/validation schema, editorial review and calibration pending |
| Worksheets / Debate Prep | Preserve pinned upstream document routes; no dedicated Debate Prep files in overlay inventory | Inspect upstream feature before changing; not verified here |
| UI / accessibility | No redesign attempted in release slice | Refero research, Playwright journeys and real-window screenshots not run |
| Updates / distribution | Ad-hoc signature only | Sparkle integration, signed feed, Developer ID/notarization credentials and end-to-end update/rollback unverified |

## Update/distribution evaluation
- Read [Sparkle basic setup](https://sparkle-project.org/documentation/) and [current customization/security settings](https://sparkle-project.org/documentation/customization/). Suitable for the existing Cocoa shell: embed framework, instantiate `SPUStandardUpdaterController`, provide HTTPS `SUFeedURL` and `SUPublicEDKey`, sign update archives with Ed25519. For authenticated appcasts, evaluate `SURequireSignedFeed` together with `SUVerifyUpdateBeforeExtraction` on a pinned supported Sparkle release.
- `security find-identity -p codesigning -v`: **0 valid identities found** on this Mac. Developer ID signing/notarization needs an Apple Developer account and provisioned credentials; CI secret availability was not assumed. No private keys or paid services were created.
- Migration/rollback design still needed: snapshot both SQLite stores safely before additive/versioned migrations, test older/current data, failed-update recovery and downgrade compatibility; do not imply that replacing an app automatically rolls its data back. Keep updater integration deferred until native launch/data recovery gates pass. No auto-update verification claimed.

## Next single action
On a clean Apple Silicon test account/runner with free ports 18765/18766, verify the **native Cocoa/WebKit** launch/quit path using the tested artifact and disposable data. Then test with OS-enforced external-network blocking (or physical disconnection), answer a real question in the UI, quit/reopen and confirm session/progress recovery. Do this before the Phase 2 redesign. Current local ports are occupied; do not terminate an unrelated application to free them.

Commands: `../release-venv/bin/python -m pytest tests/ -q`; `gh workflow run build-mac-dmg.yml --ref codex/mac-release-foundation --repo codelagoon/SAT-adaptive-framework`.

Artifact retrieval: `gh run download 40785221543 --repo codelagoon/SAT-adaptive-framework -n MasteryEngine2-Standalone-M1-DMG -D ../native-installer`.
