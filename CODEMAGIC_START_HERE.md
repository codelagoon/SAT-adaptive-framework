# Build Mastery Engine 2 on Codemagic — no Terminal

This branch contains the complete Mastery Engine source and the `codemagic.yaml` cloud build.

1. Sign in at https://codemagic.io with your GitHub account.
2. Choose **Add application** and select the GitHub repository **codelagoon/SAT-adaptive-framework**.
3. For YAML builds, select branch **mastery-engine-codemagic** (NOT `main`) when scanning for `codemagic.yaml`.
4. Click **Start new build**, choose `mastery-engine-codemagic`, and select workflow **Mastery Engine 2 — standalone Apple Silicon DMG**.
5. When the build is **successful**, open its **Artifacts** section and download `MasteryEngine2-AppleSilicon-Standalone.dmg`.
6. Open the DMG, drag **Mastery Engine 2.app** into **Applications**, and launch it. It includes Python, Node, the frontend, and the offline practice engine.

The build runs on Codemagic's **M2 Mac mini** and compiles an **arm64** app compatible with an M1 Mac. It requires no developer tools or Terminal on the end-user Mac.

**Not yet built or verified:** the first Codemagic run is still required. Cloud build failures may reveal runtime/compiler issues we cannot reproduce on Linux. The app is ad-hoc signed, **not Apple notarized**; macOS may require **System Settings → Privacy & Security → Open Anyway**.

The workflow has **no automatic triggers**, preventing unintended paid build minutes. It publishes a DMG only after passing tests, actual HTTP grading, and DMG mounting/code-signature checks.

The `main` branch is an unrelated Precision SAT project and is not modified by this build.
