# Mastery Engine

## Architecture
- This repository overlays pinned OpenTutor `dbaab74ffe76d167427ddc4448e4e81dfc38b2a9`; do not replace working upstream infrastructure.
- `scripts/apply_overlay.py`: fail-closed, idempotent integration patches, including course deletion and quiz telemetry.
- `overlay/apps/api/mastery_ext/`: deterministic banks, SQLite history, repair/transfer/review selection, diagnosis and FastAPI routes.
- `overlay/apps/web/src/app/mastery/`: current combined React practice UI and SVG graphs; distinct product spaces are still pending.
- `macos/MasteryApp.swift`: Cocoa/WebKit shell. `build_portable_macos.sh` bundles Python 3.11, Node and production Next.js.
- `mastery_portable_launch.sh`: loopback services, production assets, learner data outside signed app. Never install at launch.

## Checks and standards
- Python 3.11: `python3.11 -m pytest tests/ -q`; shell syntax: `for s in scripts/*.sh; do bash -n "$s" || exit; done`.
- Apple Silicon builder: `bash scripts/build_portable_macos.sh`, then `bash scripts/codemagic_smoke.sh`.
- Both CI providers use the same smoke gate: relocated DMG contents, isolated real HTTP grading, restart persistence, deletion isolation, signature and child cleanup.
- Keep patches focused; preserve worksheets/documents, course/user boundaries, existing records and unofficial-content labels.
- Never equate source assertions with native/UI verification. No official score claims or mastery claims from assisted repeats.
- No paid builds, publishing releases, destructive user-data operations, signing credentials or migrations without the relevant authorization.
- Stop after two inconclusive repairs; diagnose before retrying. Save milestone evidence/blocker/next command only in `STATUS.md`.

## Release gates
- Passing Python tests and production frontend build; actual arm64 Swift compilation and mounted/relocated DMG smoke.
- Pending until demonstrated: Cocoa/WebKit journeys, physically disconnected launch/practice, migration/recovery on real saved data, Gatekeeper install, full browser/accessibility/visual tests, signing/notarization and updates.
- Integration alpha until the product acceptance inventory in `STATUS.md` passes. Ad-hoc signing does not establish notarization.
