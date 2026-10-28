# Cloud build status

**Source: published to the isolated `mastery-engine-codemagic` branch.**
**Local checks: 86 tests passed in Linux.**
**Apple Silicon DMG build: NOT RUN.** Codemagic must first be connected to the repository by its account owner.

The Codemagic workflow is in the repository-root `codemagic.yaml`. Run it manually on `mac_mini_m2` after connecting the repository at https://codemagic.io.

The pipeline pins the OpenTutor revision, imports managed Python 3.11 and Node 20+ into a standalone app, compiles Swift/Cocoa with the macOS SDK, creates a DMG, tests real HTTP grading and mastery persistence, mounts the DMG, validates the ad-hoc signature, and only then copies the artifact to `release/` for download.

A successful Codemagic run and an actual test on the user's M1 are still required before declaring the Mac app ready. This app is ad-hoc signed and is **not notarized**.
