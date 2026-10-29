# Tenet — Neutral Ink / UI implementation

**Decision (October 29, 2026):** Neutral Ink is the final user-selected palette, superseding Graphite + Steel Blue and Obsidian + Sage. Product name is Tenet (private app); Mastery Engine refers to the adaptive teaching technology.

## Intent and hierarchy

Faithfully borrow Linear's *spatial patterns* for a premium personal Mac application: quiet, fixed sidebar, a slim breadcrumb/toolbar, dense lists rather than oversized cards, a contextual inspector, limited decorative effects, and one screen-height app shell. Do not import Linear's artwork or proprietary visual resources. Keep the OnePrep-inspired learning IA.

## Design token map

| Token | Value | Usage |
| --- | --- | --- |
| `--tenet-bg` | `#131415` | surrounding shell |
| `--tenet-sidebar` | `#101113` | fixed navigation rail |
| `--tenet-panel` | `#1c1e20` | toolbar and panel transition |
| `--tenet-surface` | `#1b1c1f` | active workspace |
| `--tenet-surface-raised` | `#27292d` | menus, selected controls |
| `--tenet-stroke` | `#34363a` | panel separators |
| `--tenet-text` | `#e6ebf1` | primary text |
| `--tenet-muted` | `#a5a7ae` | secondary text |
| `--tenet-faint` | `#83868c` | metadata |
| `--tenet-accent` | `#b2b8c2` | intentional highlights |
| `--tenet-accent-strong` | `#9299a4` | darker accents |
| `--tenet-accent-muted` | `#31353b` | selected UI tint |

## Shared spatial specification

- **App shell:** `100dvh`, `overflow:hidden` (no document-level vertical scrolling).
- **Sidebar:** 230px desktop, narrower on sub-1200px windows; navigation items 31px tall.
- **Toolbar:** 43px desktop. Course control on right.
- **Home:** intrinsic height workspace; recommendation rows about 38px; inspector 315px; each pane independently scrollable. Show real lesson-step and question data only. No synthesized mastery percentages.
- **Learn:** curriculum pane 232px plus reading area; both scroll inside a framed, height-bounded two-column workspace.
- **Question Bank:** dense question rows, two text inputs, two app-styled dropdowns. Filtered set scrolls inside workspace; page remains fixed.
- **Solve:** independent focus screen, sidebar hidden; one-question-at-a-time answer controls, optional hint, scratch reasoning, bookmark, optional external Desmos panel with appropriate online disclosure.
- **Tests:** truthful capability status and independent practice links; no fake official SAT/ACT simulation.
- **Analytics:** compact first/assisted/timing metrics, skill table and trends sourced from recorded attempts. No synthetic values or scaled score estimates.
- **Mobile:** app shell still height-limited. Navigation is horizontally scrollable, information panels stack inside the view.

## Premium interaction specification

The course, difficulty, and completion-status selectors in the active study workspace are **custom `PremiumSelect` listboxes**, rather than native HTML `select` elements. The implementation supports focused selection, ArrowUp/ArrowDown, Home/End, Enter/Space, Escape, Tab, and outside click. Menus use application-owned backgrounds, corners, hover states, borders, animation, and keyboard focus. Answer inputs remain native accessible form controls but are fully restyled within Tenet, not rendered as OS widgets.

Treat the `Tenet_UI_Preview.html` file as **visual QA with illustrative records**. The Next.js source is authoritative, and the screenshots are not screenshots of the installed Mac app.

## Verification completed on this source snapshot

- Python source/regression tests: **155 passed** (fresh local run, including five design-contract assertions).
- Browser static reference: six pages at 1440×900, 1280×800, and 390×844; checked fixed outer viewport with no document overflow, custom dropdown selection/filtering, answer selection and feedback; no page JavaScript errors.
- TSX parsed by TypeScript `transpileModule`; stylesheet parsed by PostCSS.

## Release gates not yet met

1. No full bundled Next.js build of the production app was possible in this environment because upstream React/Next dependencies are absent.
2. No authenticated end-to-end browser session against the live learner API was run; the preview contains sample data.
3. No Cocoa/WebKit native app interaction, physical M1 testing, macOS Gatekeeper, signing/notarization, or OS-level offline enforcement was performed here.
4. Current code is an isolated feature-source branch, not yet merged into the `codex/mac-release-foundation` native-Mac branch.
5. Material gaps in actual app functionality (official practice test blueprints, offline calculator, and editorial content calibration) remain separate from this UI workstream.

Do not claim release readiness or production UI parity until gates 1–4 are verified. These source changes deliberately do not touch the Mac packaging scripts or installer.

## Legacy route replacement

The old /mastery/legacy UI is no longer reachable. It redirects to /mastery,
which renders the new Tenet Home. The old Debate Prep source is kept in
`docs/archive/mastery-v09-debate-page.tsx.txt` for later porting; learner records
and backend endpoints are not removed. **This means the legacy Debate Prep UX
is temporarily not exposed**, pending a premium Tenet-native version.
