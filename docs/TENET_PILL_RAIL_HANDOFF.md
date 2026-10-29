# Tenet · Neutral Ink Pill Navigation (UI iteration)

## Change

- Retired 230px desktop sidebar and the workspace footer in favor of a 56px floating, vertically centered icon-only pill inside a 76px layout rail.
- Dedicated five navigation glyphs, rendered as consistent inline SVG strokes. No icon font, remote assets, or new runtime dependency.
- Active navigation marker, 40x40px touch/click targets, custom accessible tooltips on hover/focus, keyboard navigation by native links, `aria-label`, `aria-current=page`.
- Retained the Tenet monogram at the top of the dock. Mobile rail becomes a fixed bottom pill with the same icon-only navigation.
- Preserved existing sections: Home, Learn, Question Bank, Practice Tests, Analytics. Solve remains a focus mode without the navigation rail. Routes and backend APIs are unchanged.

## Files changed

- `overlay/apps/web/src/app/mastery/workspace-ui.tsx`: shared navigation JSX, icon paths and navigation semantics.
- `overlay/apps/web/src/app/mastery/workspace-ui.module.css`: new rail geometry and tooltip/mobile styles appended at end to supersede previous layout rules.
- `design/tenet-neutral-ink-ui-preview.html`: self-contained reference preview, same dock icons / sizing, illustrative data only.
- `tests/test_tenet_pill_rail.py` / `tests/test_pill_browser.py`: structural and Chromium browser regression tests.

## Verification (October 29, 2026)

- Source tests: `pytest -q tests/` → **172 passed** (including 9 new browser checks).
- Chromium viewport tests: 1440×900, 1280×800 and 390×844; one-viewport app shell and navigation, tooltip, keyboard Enter, no JS errors; rendered screenshot examples included.
- `typescript.transpileModule` TSX syntax diagnostics: zero errors.
- PostCSS parse: stylesheet parsed cleanly.

## Boundaries

- Tested the standalone **design reference**, not the authenticated Next.js app against the API.
- This is a local source kit, **not merged** with `codex/mac-release-foundation`.
- No full Next.js production compilation, Mac/Cocoa rendering, app signing, or Gatekeeper verification is claimed.
- The existing preview uses representative study records. Do not use it to infer real user performance.

## Integration

Use the existing Tenet Neutral Ink source kit as the base. Replace the shared workspace TSX and CSS with the files in this package. The UI references the same existing route/page components and APIs; no route changes or new packages are required. Integrate on a separate branch, run full Next.js build, then authenticated browser and physical Mac tests before merging to release.
