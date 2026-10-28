# Mastery Engine 2 — Codemagic build branch

This branch is isolated from the Precision SAT `main` branch.

The `codemagic.yaml` workflow targets the Apple Silicon M2 builder and produces a drag-and-drop Mac DMG **only after** running regression and live backend smoke tests.

**Status: source synchronization required.** The Mastery Engine source kit (`overlay/`, `scripts/`, `macos/`, and `tests/`) must be uploaded into this branch before starting a Codemagic build. Until those directories are present, the workflow deliberately fails its validation step. The ZIP is available in the ChatGPT conversation.

Use `https://codemagic.io/` → Add application → GitHub → `codelagoon/SAT-adaptive-framework` → choose branch `mastery-engine-codemagic` → scan YAML → start workflow `mastery-engine-macos`.

No secrets or signing credentials are stored here. The resulting DMG uses ad-hoc signing, not Apple notarization.
