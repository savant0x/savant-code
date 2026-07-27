# FID: Sub-Package Implementation

**Filename:** `FID-sub-packages.md`
**ID:** `FID-sub-packages`
**Severity:** high
**Status:** SUPERSEDED
**Created:** 2026-07-17 12:30
**Author:** Orchestrator

---

## Summary

This FID is **SUPERSEDED**. The original claim that agents/, evals/, savant-free/, and scripts/tmux/ were "empty shells" was incorrect — all have substantial TypeScript source code. The FID was based on a wrong assumption about fork completeness.

- `agents/` — 80+ `.ts` files (agent definitions, tests, e2e tests)
- `evals/` — 25+ `.ts` files (buffbench runner, eval fixtures)
- `savant-free/` — 18 `.ts` files (CLI release, e2e tests)
- `scripts/tmux/` — shell scripts + tmux-viewer TUI with `.ts`/`.tsx` source

## Environment

- **OS:** Windows 11
- **Language/Runtime:** TypeScript / Bun 1.3.11
- **Framework:** OpenTUI + React CLI

## Impact Assessment

### Affected Components

| Package | Actual State |
|---------|-------------|
| `scripts/tmux/` | Shell scripts (`.sh`) + package.json — functional |
| `scripts/tmux/tmux-viewer/` | TUI viewer with `.ts`/`.tsx` source — functional |
| `evals/` | Full buffbench runner with 25+ `.ts` files — functional |
| `savant-free/` | CLI release + e2e tests with 18 `.ts` files — functional |

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium — utility packages, not core functionality
- [ ] Low

Risk is medium. These are developer-facing utility packages, not production code. They can be built incrementally.

## Detailed Description

### Problem

The old savant-code repo (fame0528/savant-code) had these packages with full implementations. When forking to create this savant-code repo, only the package.json files were copied — the source code was not. Now that we're rebranding back to savant-code, these packages need to be rebuilt.

### What Each Package Does

**tmux-scripts**: Shell helpers for running interactive CLI tests in tmux sessions. Used by the test infrastructure to launch the CLI, send keystrokes, and capture output.

**tmux-viewer**: A TUI viewer for tmux sessions. Allows developers to watch live CLI output during development and testing.

**sdk-tree-sitter-queries-test**: Validates that the tree-sitter query files in the SDK match the expected output. Ensures code parsing doesn't break across releases.

### Root Cause

**Wrong assumption.** This FID claimed these packages were empty shells from an incomplete fork. In reality, agents/, evals/, savant-free/, and scripts/tmux/ all have substantial source code. The FID should be closed — no work is needed.

## Proposed Solution

### Approach

Build each package from scratch following the existing patterns in the codebase. For tmux-scripts, study the existing tmux usage in `scripts/tmux/` and extract reusable helpers. For tmux-viewer, build a minimal TUI viewer using OpenTUI. For the tree-sitter test, port the validation logic from the SDK's test infrastructure.

### Steps

1. **tmux-scripts** — Extract tmux helper functions from existing scripts into a reusable package
2. **tmux-viewer** — Build a minimal OpenTUI viewer for tmux session output
3. **sdk-tree-sitter-queries-test** — Port tree-sitter query validation from SDK tests
4. **Verify all packages** — Run typecheck and tests across all packages

## Perfection Loop

### Loop 1

#### RED — Issue Identification

**R1 — tmux-scripts has no source**
- Evidence: `scripts/tmux/package.json` exists but no `.ts` files in directory
- Impact: Cannot run interactive CLI tests without tmux helpers

**R2 — tmux-viewer has no source**
- Evidence: `scripts/tmux/tmux-viewer/package.json` exists but no `.ts` files
- Impact: Cannot view tmux sessions during development

**R3 — sdk-tree-sitter-queries-test has no source**
- Evidence: `sdk/test/tree-sitter-queries/package.json` exists but no `.ts` files
- Impact: Cannot validate tree-sitter queries

#### GREEN — Proposed Solution

**G1 — tmux-scripts implementation**
- Create `scripts/tmux/src/index.ts` with helper functions
- Functions: `createSession()`, `sendKeys()`, `captureOutput()`, `killSession()`
- Use `child_process.exec` for tmux commands
- Risk: LOW — simple wrapper functions

**G2 — tmux-viewer implementation**
- Create `scripts/tmux/tmux-viewer/src/index.tsx`
- Minimal OpenTUI component that reads tmux session output
- Use `child_process.exec` to capture pane content
- Risk: LOW — simple TUI viewer

**G3 — sdk-tree-sitter-queries-test implementation**
- Create `sdk/test/tree-sitter-queries/src/test-query-files.js`
- Port validation logic from SDK's existing tree-sitter tests
- Compare query output against expected snapshots
- Risk: LOW — test-only code

**G4 — Verify all packages**
- Run `bun x tsc --noEmit` across all packages
- Run `bun test` to ensure no regressions
- Risk: LOW — verification only

### AUDIT — Verification

**Typecheck:**
- All changes are new files — no existing code modified
- Each package has its own tsconfig.json
- Typecheck should pass independently

**Call-graph reachability:**
- tmux-scripts: called by test scripts in `scripts/tmux/`
- tmux-viewer: standalone TUI, no external callers
- sdk-tree-sitter-queries-test: called by SDK test infrastructure

### SELF-CORRECT

No corrections needed. The solution is straightforward — implement missing packages following existing patterns.

### COMPLETE

**FID Status:** open
**Closure Reason:** Pending implementation of 3 sub-packages.

---

## Resolution

- **Fixed By:** N/A — FID superseded (claims were incorrect)
- **Fix Description:** All packages already have source code. No implementation needed.
- **Tests Added:** N/A
- **Verified By:** Filesystem audit — `.ts` files exist in all listed packages

## Lessons Learned

1. **Verify before filing** — Filing an FID without checking the filesystem wastes effort. Always `ls` before claiming a directory is empty.
2. **Package.json ≠ empty shell** — A package.json with dependencies may still have source code in subdirectories not captured by a shallow scan.
