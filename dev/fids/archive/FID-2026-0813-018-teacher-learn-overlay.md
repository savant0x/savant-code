<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: Agent-Steering Teacher — `/learn` Overlay

**Filename:** `FID-2026-0813-018-teacher-learn-overlay.md`
**ID:** FID-2026-0813-018
**Severity:** medium
**Status:** closed
**Created:** 2026-08-13
**YAGNI-Compliance:** Verified — headless engine precedes UI
**Master FID:** FID-2026-0813-011
**Depends On:** FID-2026-0813-016, FID-2026-0813-017

---

## Summary

Present the validated headless exercise engine through `/learn` as a read-only OpenTUI surface. The overlay renders public challenge context, steering/critique input, structured execution evidence, and grade state while owning no tools, files, corpus, grader, or progression authority.

## Environment

- **OS:** Windows terminal; short and resized terminals are supported targets
- **Language/Runtime:** TypeScript/React/OpenTUI 0.2.2
- **Tool Versions:** Existing CLI chat store and event conventions
- **Commit/State:** Planning-only working tree

## Detailed Description

### Problem

The exploratory plan placed a three-pane UI before proving the exercise lifecycle and described “suspending chat” without defining restoration or authority boundaries.

### Expected Behavior

The overlay subscribes before execution, displays bounded events, accepts learner input, supports cancel/retry/exit, and restores ordinary chat without mutating the repository.

### Root Cause

Presentation, execution, and grading responsibilities were not separated.

## Impact Assessment

### Affected Components

- `cli/src/commands/learn/`
- `cli/src/components/savant-ui/`
- chat/event state integration

### Risk Level

- [ ] Critical: no execution authority
- [x] Medium: UI can misrepresent evidence or trap chat state
- [ ] High: major feature broken
- [ ] Low: cosmetic

## Proposed Solution

### Approach

Keep the exercise engine headless. Build a presentation-only component using existing event/state patterns and static zero-authority tests like the Trust Matrix.

### Steps

1. Define command lifecycle and state subscription.
2. Render objective, input, evidence, and result panes.
3. Add cancellation, retry, exit, resize, and short-terminal behavior.
4. Static-scan imports and runtime-test no tool/control paths.

### Verification

Component tests prove event subscription ordering, no control imports, chat restoration, unavailable sandbox, cancellation, and bounded output.

## Perfection Loop

### Loop 1 — RED

- **RED:** UI-first sequencing risked embedding execution and grading in OpenTUI state.
- **GREEN:** Headless engine is a dependency; overlay is a consumer.
- **AUDIT:** Architecture restricts overlay imports and authority.
- **ADVERSARIAL:** A callback or dynamic import can reintroduce control authority; static scans reject both.
- **CHANGE DELTA:** Converged planning revision.

### Missed Questions

1. **Does “suspend chat” discard messages?** → No; exercise state is separate and previous chat resumes unchanged.
2. **What if the terminal is too small?** → Render a bounded fallback and preserve cancellation/exit.
3. **Can the overlay inspect private grader data?** → No; only rubric-safe events cross the API.

### Code Verification Evidence

- [x] Zero-authority overlay boundary documented.
- [ ] Overlay implementation and tests — pending.

### Loop 2 — Independent audit and self-correction

- **RED:** Existing CLI state can make a presentation component accidentally dispatch actions.
- **GREEN:** Use a narrow read-only event selector and explicit input command boundary.
- **AUDIT:** Architecture and build order define the separation.
- **ADVERSARIAL:** Runtime tests must inspect behavior, not only import text.
- **CHANGE DELTA:** <10%.

### Loop 3 — Final convergence

- **RED:** No remaining planning contradiction.
- **GREEN:** UI is after grading calibration.
- **AUDIT:** Dependencies are ordered after both graders.
- **ADVERSARIAL:** A beautiful overlay cannot compensate for an unavailable or untrusted engine; unavailable state is first-class.
- **CHANGE DELTA:** <2%.

### Loop 4 — Full FID-set re-run — 2026-08-13

- **RED:** The overlay boundary was clear, but its unavailable and uncalibrated states were not named as first-class render states.
- **GREEN:** The UI must display unavailable, cancelled, and uncalibrated outcomes without awarding credit or exposing private evidence.
- **AUDIT:** The overlay remains downstream of both graders and consumes only the headless event contract.
- **ADVERSARIAL:** Static import scans alone cannot prove no authority; runtime tests must exercise cancellation, exit, and restoration.
- **CHANGE DELTA:** <10%.

## Resolution

- **Closed Date:** 2026-08-13.
- **Fix Description:** Implemented the read-only `/learn` overlay (`LearnOverlay` + pure reducer) and `/learn` command, wired into slash commands and core defs. Follow-up: wired the command to the live runtime so an exercise actually runs Forge + sandbox + graders in the CLI — `cli/src/teacher/{seed,forge,runtime}.ts` (seed corpus, a read-only tool-less `teacher-forge` agent driving the live Forge via the SDK client, and a DI-seamed session manager for start/critique/cancel/exit). The overlay remains read-only; the command is now the authority that drives the headless engine.
- **Tests Added:** `cli/src/components/savant-ui/teacher/__tests__/learn-overlay.test.ts` + `cli/src/commands/__tests__/learn.test.ts` — 12 tests. Follow-up added `cli/src/teacher/__tests__/runtime.test.ts` (forge adapter + live lifecycle) and extended `learn.test.ts` — 18 tests.
- **Verification Evidence:** 12/12 pass incl. zero-authority static scan, event ordering, unavailable/cancelled, bounded output, chat restoration. Follow-up: 18/18 pass incl. extractor/prompt/parseCritique units and a full Forge→sandbox→graders lifecycle through the real subprocess sandbox; CLI typecheck + ESLint + Prettier clean.
- **Archived:** Yes — moved to `dev/fids/archive/`.

## Lessons Learned

Structured exercise state must survive without a UI; otherwise the UI becomes an accidental runtime authority.
