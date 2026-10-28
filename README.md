# Codemagic drag-and-drop Mac installer

The repository-root `codemagic.yaml` contains the **Mastery Engine 2 — standalone Apple Silicon DMG** workflow. Select `mac_mini_m2`, run the workflow manually, and download the `.dmg` from the build's Artifacts section **only if every step passes**. The resulting app is ad-hoc-signed (not Apple Developer ID-notarized), so macOS may require **System Settings → Privacy & Security → Open Anyway** on first launch.

The YAML uses the complete source tree in this repository. **A bare `codemagic.yaml` is insufficient**: `scripts/`, `overlay/`, `macos/`, and `tests/` must also be present. No API key is needed to compile; model-backed AI features require a separately configured model and are not included in the offline build.

---

# Mastery Engine 2.0 — Standalone Mac cloud-build kit, v0.7.0

**This ZIP is source plus a GitHub Actions builder, NOT an already-compiled Mac installer.** The eventual `MasteryEngine2-AppleSilicon-Standalone.dmg` is created by an Apple Silicon macOS runner and must pass a real runtime smoke test before download. We cannot manufacture an Apple-signed/notarized M1 binary on Linux.

## What changes from v0.6.1

- New `scripts/build_portable_macos.sh` clones the pinned OpenTutor source, patches Mastery Engine, builds the production frontend, downloads a relocatable managed Python runtime, installs Python dependencies into the bundle, copies the native Node binary, compiles the Cocoa/WebKit launcher, and packages a drag-to-Applications DMG.
- `scripts/mastery_portable_launch.sh` starts bundled runtimes only. It never clones repositories or installs packages on the end user's Mac. All local data stays in the user's Library; local servers bind to loopback.
- `.github/workflows/build-mac-dmg.yml` runs on a GitHub-hosted Apple Silicon Mac (`macos-15`), compiles the DMG, tests real HTTP grading/mastery integration using bundled services, and uploads the DMG only if that test passes.
- The build includes no paid signing/notarization. On recent macOS versions, users may need **System Settings → Privacy & Security → Open Anyway** after attempting to open the downloaded app. Do not disable Gatekeeper globally.
- This source package does not include personally uploaded documents or API keys. The workflow should be run in a repository where sharing the code is appropriate; do not upload private files, credentials, or production data.

## Mac installation *after a successful cloud build*

1. Download the DMG artifact from the successful GitHub Actions run.
2. Open the DMG, drag **Mastery Engine 2.app** to Applications, eject the DMG.
3. Open the app. If blocked because the app is unidentified, inspect the warning and use **System Settings → Privacy & Security → Open Anyway** only if you trust this build.
4. The first launch starts internal, local Python and Next.js servers; it does not require Homebrew, Python, Node, Git, or Xcode tools to be installed locally.

## Current verification

This package has local Linux-level unit, contract, bash syntax, and mock-runtime tests. The full M1 `swiftc` build, bundled Python dependencies, Next.js build, real HTTP integration smoke test, and end-user download of a DMG are **not yet verified**. GitHub Actions has to run and pass before we can claim a working drag-and-drop installer. Python target dependencies and third-party runtime requirements may still require adjustments based on actual Mac CI logs.

---

# Mastery Engine 2.0 — Offline-first M1 Mac integration, v0.6.1 integration alpha

**Installer fix (v0.6.1):** Corrected a shell syntax error in `scripts/install_mac.sh`; shell-script syntax is now a regression test.

**Source extension + Mac build kit. This is NOT a precompiled Mac app or a certified native release.**

Mastery Engine builds on real [OpenTutor](https://github.com/zijinz456/OpenTutor) and retains its existing document/worksheet, course, quiz, spaced-repetition, and AI features. **We have not removed worksheet support.** Our development focus is independent offline study, not worksheet generation.

## What works without any AI

Once the initial installation and dependency downloads have finished, the local application, quiz grading, deterministic question generation, offline hints, taught prerequisites, score/progress tracking, reasoning history, graph plotting, and review recommendations do not require internet or a model API. No AI or Ollama process is required for those workflows. Model-backed OpenTutor and DeepTutor functions remain separately optional and are not available offline without a local inference model.

| Track | Offline items installed on creating the track | Further locally generated practice |
|---|---:|---|
| SAT Math | 160 | 160 per additional pack, up to 20 additional packs |
| SAT Reading & Writing | 102 original authored reading/editing questions + 160 controlled grammar drills = **262** | New rule-driven grammar packs; reading passages are finite |
| ACT English | 40 authored editing questions + 160 controlled grammar drills = **200** | New rule-driven grammar packs |
| ACT Math | 160 | 160 per additional pack |
| ACT Reading | **62** original authored reading drills | Finite authored pool; no fake paraphrases |
| ACT Science | 160 | 160 per additional pack (data interpretation + physics graphs) |
| Algebra 2 | 160 | 160 per additional pack |
| Physics | 160 | 160 per additional pack; actual position/velocity graphs |

These are **original, unofficial skill drills**, not replicated official College Board/ACT exams. The numerical engine uses many independent families (including multistep algebra, conditional probability, function composition, rational equations, series, and kinematics) with reproducible answers and worked solutions. A generator produces distinct text for a batch and filters re-used prompts across packs. Grammar drills are constrained by specific grammar rules; the ACT/SAT reading passages are human-authored and finite. Numeric pack expansion is capped to avoid unlimited local data growth; some new packs may contain fewer than 160 genuinely new prompts after deduplication. **No offline AI claims are made.** The written verbal pool is substantially smaller than official exams, and the app is not yet an exam-length CAT simulator.

Offline-first features:

- One-tap answer and immediate grading (tap-to-grade can be switched off to allow deliberation and recorded reasoning).
- Confidence capture, optional reasoning, timed answer logs, and separate per-skill Bayesian estimates (uncalibrated; **not** a predicted SAT/ACT score).
- Hard-first challenges with a protected review allocation: due skills cannot be buried under thousands of new questions.
- Automatic learning loop: wrong answer → simpler repair item → harder transfer item → normal challenge. A failed transfer returns to repair; repairs can be skipped without erasing errors.
- Focused skill drills and optional dedicated retention-review mode.
- Topic-specific hints and worked prerequisite examples **without revealing the current answer before submission**.
- After submission, distractor-specific **possible misconception** feedback for vetted problem families, with explicit warnings that a selected option does not prove the learner’s reasoning.
- Graduated review scheduling (1/3/7/14/30/60 days on consecutive correct responses; 15 minutes after an error); these are heuristics, not validated FSRS.
- Actual plotted graphics for graph questions, not graphs described only in text.
- Persistent local SQLite data and automatic review intervals; OpenTutor's native FSRS progress/reviews remain available.
- Source-aware grading path: the offline practice screen selects only vetted local bank items; those items **skip AI error classification and AI diagnostic generation**, so wrong answers do not launch a hidden LLM call.
- Optional installed DeepTutor CLI for freeform tutoring (model provider or locally installed model required).

## Install/build on an Apple Silicon Mac

**Requirements:** macOS 13+, **Python 3.11** (upstream OpenTutor's quickstart requires exactly 3.11), Node.js 20+, npm, Git, Xcode Command Line Tools. **Internet is required for the FIRST installation** to clone OpenTutor and download Python/Node packages. This archive alone does not contain those dependencies.

From Terminal in the extracted `MasteryEngine2-v0.6.1` folder:

```bash
python3.11 --version
node --version
xcode-select -p
bash scripts/install_mac.sh
```

This checks out OpenTutor at the **pinned commit `dbaab74ffe76d167427ddc4448e4e81dfc38b2a9`** under `~/MasteryEngine2/OpenTutor` (unless a prior checkout already exists), applies fail-closed patches, **installs the Python and Node dependencies, builds the production Next.js frontend,** and compiles an unsigned native `.app` plus a `.dmg` on your Mac. The installer requires internet and can fail if the upstream checkout or dependencies are incompatible. Then open:

```text
MasteryEngine2-v0.6.1/build/Mastery Engine 2.app
```

**Normal app launches perform no dependency installation or downloads.** The Mac app now starts a prebuilt local production frontend and local Python API, rather than `next dev`. Both services bind only to loopback (`127.0.0.1` on ports `18766` and `18765`). The app must still be built and cold-launched on a real Mac to validate this design. The `.dmg` contains a launcher referencing the preinstalled `~/MasteryEngine2/OpenTutor` dependencies; it is **not** a self-contained distributable installer. Startup requires both the actual API health and the Mastery extension health to respond before the interface is shown.

Within the app, visit **Mastery Engine 2.0**, create a track, and answer questions. Existing course and document tools remain at the main OpenTutor workspace. You can create further tracks from the **+ Create another study track** control. Add an offline question pack when you want more practice.

**Optional DeepTutor installation:**

```bash
bash scripts/install_deeptutor.sh
~/MasteryEngine2/deeptutor-venv/bin/deeptutor init
```

The optional installer now fetches the **CLI-only** DeepTutor package at v1.6.15 (not its entire Web application). Configure its model provider separately using the exact `DEEPTUTOR_HOME` shown by the installer. The offline coach does not require it.

## Release smoke test on your M1 Mac

After installation, **open the native app first**, then in a second Terminal window from the extracted source directory run:

```bash
bash scripts/mac_e2e_smoke.sh
```

This deliberately runs against the **real running OpenTutor API**, not mocked services. It creates a temporary SAT Math track, installs its local question bank, selects a question, submits a deliberately wrong test answer, verifies the resulting mastery and prerequisite diagnosis, deletes the temporary track, and verifies that the extension data was deleted. If anything fails, it reports the step. This check has **not** yet been run on an actual Mac by us.

For a full offline cold-start test, after the first installation completes, quit the app, disconnect your Mac from the network, relaunch it, and complete an offline question. Verify progress persists after closing and reopening. Optional DeepTutor/model features are separate from this offline test.

## Storage and security

- OpenTutor's native database: `~/.opentutor/data.db` by default.
- Mastery Engine's additional learning records: `~/Library/Application Support/MasteryEngine2/mastery.sqlite3`.
- Mac startup log: `~/Library/Logs/MasteryEngine2/launch.log`.
- OpenTutor API and built Next.js server bind to `127.0.0.1` in this patched local version. Single-user mode has no authentication; **never expose those ports to the internet**.
- The patcher saves originals as `*.mastery-backup` and refuses unknown upstream code changes instead of blindly modifying them. Deleting a course also removes its Mastery Engine notes, attempts, mastery and diagnostic records. The normal launcher does **not execute the `.env` file as shell code** and refuses to start if its localhost ports are already occupied.
- Upstream packages and installers have their own maintenance/security requirements; review scripts before execution.

## Verify from the source directory

```bash
python3 -m pytest tests/ -q
bash -n scripts/*.sh
```

As of v0.6.1, **79 Python tests pass**, including a live subprocess/HTTP readiness simulation (mock API and web servers, not OpenTutor). The included test suite checks idempotent patching, older-database migration, mastery persistence and user separation, hard-first ranking, automated repair/transfer progression, due-review starvation under a 2,000-question backlog, optional repair skipping, original bank generation, explanation/answer-key consistency, graph data, no-network generator execution, controlled English editing, and independently recomputed numerical answers for multiple question families. TypeScript/TSX parse checks were also performed. **This does not replace full TypeScript typechecking or an actual integration run on a Mac.**

## Integration and limitations

- **OpenTutor:** actual project cloned and patched at the quiz-submission, router-registration, sidebar, and local startup layers. Upstream features remain available.
- **DeepTutor:** real optional CLI adapter, not merged into the native OpenTutor inference path.
- **LearnHarness:** proposition/premise ideas reimplemented independently; no AGPL source reused.
- **OATutor:** traditional BKT approach only; no upstream code or copyrighted questions redistributed.
- **Licensing:** original extension code MIT (see `LICENSE`); OpenTutor MIT; DeepTutor Apache-2.0; LearnHarness AGPL-3.0 remains separate.

**Unverified:** We could not download and run all upstream OpenTutor dependencies or compile the native Apple Silicon `.app` in the current Linux environment. The native runtime script was exercised on Linux with mock API/web processes; this is **not** the same as proving OpenTutor launches on macOS. We have not checked an M1 end-to-end offline launch or benchmarked educational outcomes. The app must be built and smoke-tested on an actual Mac before it can be considered release ready. This remains an **integration alpha**, not a certified or signed production release. Full digital SAT/ACT simulations and independently editorial-reviewed exam-calibrated banks are still missing. Do not use BKT estimates as projected official scores.
