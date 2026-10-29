# Tenet — Neutral Ink / Old-page replacement checkpoint

## Intent
- The existing **/mastery** route is the new Tenet Home workspace.
- **/mastery/learn, /mastery/bank, /mastery/solve, /mastery/tests, and /mastery/analytics** are the only new primary screens.
- The old **/mastery/legacy** UI does not render. It redirects to /mastery.
- The old all-in-one implementation is archived at `docs/archive/mastery-v09-debate-page.tsx.txt` for future selective porting.
- No destructive database migrations or learner-data clearing are performed by this UI change.
- **Caveat:** Legacy Debate Prep controls aren't yet rebuilt into the new Tenet UX. The source archive preserves the implementation, not an active functional route.
- **Palette:** 03 Neutral Ink (most recent choice), not earlier Graphite + Steel Blue.
- All normal form pickers in new screens use Tenet's custom `PremiumSelect`; keyboard semantics still need integrated accessibility review.

## Verification (source snapshot, not native Mac app)
- `python -m pytest -q`: 167 passed / 3 skipped on the packaged source after updates.
- Nine TSX files transpiled without diagnostics; CSS parsed using PostCSS.
- 18 visual reference page×viewport checks at 1440x900, 1280x800 and 390x844 passed via Chromium `set_content` (the sandbox blocks file:// navigation).
- The visual reference uses illustrative records; screenshots are **not evidence of working live-data Next.js routes**.

## Unfinished gates
1. Integrate this bundle into the actual `codex/mac-release-foundation` branch. This local source is based on an older feature kit; do not overwrite newer native Mac build scripts with its bundled copies.
2. Run a **complete upstream Next.js production build and typecheck** with pinned dependencies.
3. End-to-end tests against real authenticated API: question submission, bookmarks, drafts, study planner, analytics, non-destructive updates.
4. Real native Cocoa/WebKit install, offline and quit/reopen validation. Signing and automatic updates remain separate.
5. Rebuild Debate Prep (if needed) in Tenet's new workspace rather than exposing the retired UI.

## Integration guidelines
Bring in `overlay/apps/api/mastery_ext`, `overlay/apps/web/src/app/mastery`, and necessary existing `scripts/apply_overlay.py` **only with review and three-way diff** against current branch. Keep native `macos/` and `.github/` files from the Codex Mac branch.
Do not count source contract tests or standalone preview checks as full release verification.
