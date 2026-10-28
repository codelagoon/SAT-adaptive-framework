# Status — 2026-10-28

Branch: `codex/mac-release-foundation`, based on inspected `mastery-engine-codemagic` at `f78e756968b8f70ddbdbaac24024265f0144cafa`.
Checkpoint commit: this file is committed with the release slice; resolve with `git log -1 --format=%H`.
Scope: bounded Phase 0/1 release-foundation slice. Consolidated scope not attached; supplied execution brief governs. Product remains integration alpha.

## Verified baseline
- Manually dispatched actual Apple Silicon GitHub Actions run [40783839892](https://github.com/codelagoon/SAT-adaptive-framework/actions/runs/40783839892), conclusion **success** at original branch SHA.
- Its Python suite reported **88 passed, 2 skipped**. Its unit/contract checks, production Next.js build, bundled Python imports, arm64 Swift compilation, DMG build and existing real grading smoke all passed; downloadable artifact `12858003538` (350,320,870 bytes).
- Baseline smoke launched the shell/services from the build directory; it did not exercise native UI, relocated install, full restart or physical network disconnection.
- Local shell initially resolved an incompatible Python (collection error). Explicit Python 3.11 venv is at `../release-venv`; use its absolute interpreter or `../release-venv/bin/python`.

## Local validation on working branch
- `../release-venv/bin/python -m pytest tests/ -q`: **86 passed, 4 skipped**. Two synthetic Linux-only tests skip on macOS; two port-dependent tests skip because local service ports are occupied. No existing application/process was disturbed.
- `for script in scripts/*.sh; do bash -n "$script" || exit; done`: pass; `git diff --check`: pass.
- `xcrun swiftc -parse-as-library -O -target arm64-apple-macos13 -framework Cocoa -framework WebKit macos/MasteryApp.swift -o ../MasteryEngine2-native-check`: pass, one existing unused-result warning. Full Xcode is absent, but Command Line Tools include a working native SDK/compiler.

## Current changes
- Both CI providers now use one stronger smoke gate. It mounts the DMG, copies to a different path containing spaces, verifies signature/arm64 and launches bundled services with no system Python/Node.
- Test data uses a new disposable directory through `MASTERY_DATA_DIR`; ordinary learner databases are untouched. Relative data paths fail closed.
- Real SAT/Physics wrong answers must produce history, diagnosis and targeted repair; service stop/restart must preserve exact rows, review dates and queued question; deleting SAT must preserve Physics.
- Dead external HTTP proxies exercise the local-only path but are **not** physical/OS network isolation. Native Cocoa interaction is explicitly not claimed.
- Added concise architecture map in AGENTS.md and ignored generated caches/builds.

## Acceptance inventory / gap ledger
| Gate | Existing implementation | Required proof / current gap |
|---|---|---|
| Standalone arm64 DMG | Python/Node/Next + Swift bundle | Baseline CI passes; rerun strengthened gate on this branch |
| Startup/quit/restart | Shell owns services, SQLite outside app | New relocated-service/restart gate; Cocoa quit and clean M1 install still pending |
| Learning / repair / review | Offline banks, deterministic grade, repair/transfer, heuristic review, diagnosis hypotheses | Existing unit checks + real wrong-answer smoke; withheld intervention evaluation pending |
| Migration and deletion | Legacy extension migration, course/user-scoped purge | Existing regression tests; native saved-data migration and user-deletion workflow still pending |
| Tracks | Eight named SAT/ACT/Algebra/Physics tracks | Unit isolation + strengthened real SAT/Physics check; full track blueprints pending |
| Home/Learn/Bank/Solve/Tests/Analytics | Single combined `/mastery` page; SVG graph | Distinct routes, lessons, Solve autosave/bookmark/keys, Desmos and timed tests missing |
| Attempt integrity / analytics | Result IDs, confidence/reasoning/timing, BKT aggregate | Immutable first/repeat/assistance/version events and trusted deep analytics missing |
| Content | Original authored/generated families, independent numeric oracles | Full license/version/validation schema, editorial review and calibration pending |
| Worksheets / Debate Prep | Preserve pinned upstream document routes; no dedicated Debate Prep files in overlay inventory | Inspect upstream feature before changing; not verified here |
| UI / accessibility | No redesign attempted in release slice | Refero research, Playwright journeys and real-window screenshots not run |
| Updates / distribution | Ad-hoc signature only | Sparkle integration, signed feed, Developer ID/notarization credentials and end-to-end update/rollback unverified |

## Next single action
Finish local regression, push isolated working branch and dispatch `build-mac-dmg.yml` on it. Record exact results here before starting any UI slice.

Commands: `../release-venv/bin/python -m pytest tests/ -q`; `gh workflow run build-mac-dmg.yml --ref codex/mac-release-foundation --repo codelagoon/SAT-adaptive-framework`.
