# Mastery Engine — production study workspace integration

**Status: source implementation, awaiting upstream runtime and actual Mac GUI validation.**

## Routes

- `/mastery` — Home and study planner
- `/mastery/learn` — dedicated lesson/curriculum browser
- `/mastery/bank` — searchable/filterable question bank; no answers sent
- `/mastery/solve` — one-question-at-a-time authenticated quiz flow, optional hints, autosaved answer/reasoning, bookmarks, feedback and prerequisite probe
- `/mastery/tests` — dedicated exam-prep area; real adaptive/exam-calibrated test deliberately not offered until validated
- `/mastery/analytics` — real event-level independent-vs-assisted-vs-repeated metrics and per-skill counts
- `/mastery/legacy` — preserve the existing combined quiz/offline-help tools until the replacement routes are validated. This Codex source branch does not contain the separate Debate Prep extension from the later local v0.9 archive.

The new screens share a single React client component and CSS module. Each route renders only its own workspace. The original large page was relocated, not deleted. Course IDs are scoped to the user's existing authenticated courses; the frontend uses OpenTutor's existing API client and does not store answer keys.

## Verification performed here

- 148 Python tests on extracted v0.9 source (includes seven new static production route contract tests, not full Next runtime tests).
- Six independent browser checks of the HTML visual reference at desktop/tablet/mobile sizes (illustrative reference, not an authenticated Next runtime).
- TypeScript/TSX syntax transpilation for eight newly routed source files; full upstream TypeScript typecheck and production build **not executed**.
- Native release validation from Codex remains separate and was not changed.

## Must run before merge

1. Apply this branch atop the Codex native foundation without removing newer Mac/Cocoa/Swift work; preserve Codex's latest legacy React page content, not the old snapshot.
2. With the fully installed/pinned OpenTutor dependencies, run all Python tests, full `next build`/TypeScript typecheck, and check each route via authenticated browser.
3. Seed a track, Learn → Question Bank filter → Solve → wrong answer → prerequisite probe → bookmark/draft → reopen → Analytics. Verify ownership isolation and failure states.
4. Test real macOS 13+ Apple Silicon GUI, network-offline backend and restart persistence; no uncontrolled port conflict process kills.
5. Verify embedded Desmos web calculator actually displays within the deployed WebKit shell and respects licensing/online limitations; otherwise disable and provide a supported alternative, not a fake calculator.
6. Check accessibility, mobile menu, CSS module production styles, native navigation, route transitions and scroll boundaries using screenshot QA.
7. Read actual user-derived scores and compare API event counts to UI; never manufacture official scaled scores.

## Not implemented or not validated

- Official/licensed College Board or ACT bank; independent psychometric calibration; full-length adaptive test simulations.
- Full editorial review of every question and complete in-depth, video-backed curriculum.
- Mac production auto-update signing/notarization and Sparkle feed validation.
- Refero MCP live reference collection remains unavailable because its subscription has expired.

**QA principle:** An actual working native feature is complete only when its real application flow has been tested—not because its React source compiles or an illustrative reference screenshot looks good.
