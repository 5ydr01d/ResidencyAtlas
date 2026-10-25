# Residency Atlas — Offline Android Residency Question Bank

Residency Atlas is an independent Android study app built around the supplied **Residency Part 1 — Questions with High-Yield Topic Coverage** source. It does not depend on or modify another repository.

## Features

- 764 source question records, organized by source subject and subtopic.
- Combined filters for year, exam session, subject, topic, question type and study status, plus full-text search.
- Interactive True/False and Single Best Answer practice, source-key reveal, bookmarks, mistake review and flagged questions.
- Local progress analytics, adjustable text size, dark mode, progress backup/restore and JSON export.
- Offline access to all bundled questions and explanations.
- Optional Google, Google Scholar, PubMed and guideline-oriented web searches for verification.
- GitHub Actions builds a downloadable Android debug APK.

## Answer provenance

Question wording, supplied answer annotations, appearances and topic coverage are retained from the Markdown bank. The parser only structures source information; a parsed key is **not** independently medically verified. Questions without complete machine-readable answer annotations are marked for review. Online verification opens external searches and does not automatically certify a result.

## Build from GitHub

Open Actions → Build Residency Atlas APK → Run workflow, or push a commit to the default branch.

The workflow assembles the imported Markdown parts into the source file in data/, runs the parser and integrity checks, removes temporary transfer files, commits the normalized source and generated question index, then builds and uploads app-debug.apk as artifact residency-atlas-debug-apk (30-day retention).

On the first run, allow time for Gradle and the Android SDK to install. View the current run at the repository's Actions tab. When successful, open the run, find Artifacts, and download the APK ZIP. Extract it on Android and install the APK after granting permission to install from that source.

## Local build

Requirements: JDK 17, Gradle 8.9, Android SDK platform 35 and build-tools 35.0.0.

Run these commands from the repository root:

    python3 scripts/parse_bank.py data/Residency_Part_1_Questions_With_High_Yield_Topic_Coverage.md app/src/main/assets/questions.js --js
    python3 scripts/validate_bank.py app/src/main/assets/questions.js
    gradle --no-daemon clean assembleDebug

Output: app/build/outputs/apk/debug/app-debug.apk.

## Project layout

- app/src/main/assets/: offline UI and generated question index
- app/src/main/java/com/residencyatlas/MainActivity.java: Android WebView shell, external reference launcher and progress export bridge
- data/: preserved source Markdown
- scripts/: source parser and structural validator
- .github/workflows/build-apk.yml: CI validation and APK packaging

The app needs no user account or network connection for normal study. Internet is only used when a user deliberately opens an external verification search.
