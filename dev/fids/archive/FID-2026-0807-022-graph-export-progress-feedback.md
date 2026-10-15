# FID: Visible Graph Export Progress Feedback

**Filename:** `FID-2026-0807-022-graph-export-progress-feedback.md`
**ID:** FID-2026-0807-022
**Severity:** medium
**Status:** closed
**Created:** 2026-08-07 00:00
**Author:** Buffy / Savant
**YAGNI-Compliance:** Verified

---

## Summary

`/graph-export` can spend several seconds indexing, laying out, serializing, compressing, and writing a large offline HTML artifact without any visible feedback. Add a command-owned transient progress message that appears before heavy work, advances through meaningful export stages, and is replaced by exactly one final success or failure message. Do not reuse the global LLM streaming indicator, because slash-command export is local work and is not part of the agent streaming lifecycle.

## Environment

- **OS:** Windows development environment
- **Language/Runtime:** TypeScript, Bun, React/OpenTUI CLI
- **Tool Versions:** Existing repository versions from `package.json` and `bun.lock`
- **Commit/State:** Working tree at FID-2026-0807-022 analysis

## Detailed Description

### Problem

The command clears the input and then enters the expensive `buildGraphExportHtml` pipeline. The user sees no processing state during the 2–5 second interval and may reasonably assume the command froze or failed.

### Expected Behavior

Immediately after `/graph-export` is submitted, the chat shows a visible status such as `⠋ Preparing graph export…`. The status progresses through stable stages (preparing, laying out, embedding documents, writing the HTML), then disappears as a transient item when the final success or failure message is shown. No orphaned loading message may remain after any return or thrown error.

### Root Cause

`handleGraphExportCommand` only emits a message after `buildGraphExportHtml` resolves or rejects. The builder has no progress callback, so the command cannot report phase transitions. A message update also needs one event-loop yield before the synchronous portions of export work, otherwise the renderer may not paint the initial status.

### Evidence

Current command lifecycle evidence:

```text
cli/src/commands/graph-export.ts:42
export async function handleGraphExportCommand(...)

cli/src/commands/graph-export.ts:86
const html = await buildGraphExportHtml({ ... })

cli/src/commands/graph-export.ts:96-113
The first setMessages call occurs only after HTML generation/write completes, while the catch path emits only a final failure message.

cli/src/commands/graph-export/template.ts:63
export async function buildGraphExportHtml(...): Promise<string>

cli/src/commands/graph-export/template.ts:74-106
The builder performs initial serialization, asynchronous layout, final document serialization, gzip payload construction, and HTML assembly without a progress hook.
```

## Impact Assessment

### Affected Components

- `cli/src/commands/graph-export.ts`
- `cli/src/commands/graph-export/template.ts`
- `cli/src/commands/__tests__/graph-export.test.ts`

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Use one command-owned transient `ChatMessage` with a stable runtime ID. Append it before export work, yield one macrotask to allow rendering, and update its text through an optional `onProgress(stage)` callback passed to `buildGraphExportHtml`. Replace that same message with the final success or failure message rather than appending a second status. Keep the global stream/thinking state untouched.

The callback is optional so existing direct callers of `buildGraphExportHtml` retain behavior, and accepts either synchronous or asynchronous notifiers. Stage notifications are coarse-grained and deterministic; they are not fake percentage estimates. The command owns message lifecycle and the builder only reports phase boundaries. Concurrent invocations get independent chat progress IDs; they retain the pre-existing last-writer-wins behavior if they target the same output path.

### Steps

1. Add the FID-bound progress lifecycle and stage contract.
2. Add progress callback calls around initial graph serialization, layout, document serialization, payload compression, and HTML assembly.
3. Add a browser-paint yield after inserting the initial progress message.
4. Replace the transient message with success or failure in all command paths.
5. Add focused tests for stage ordering, final-message replacement, failure cleanup, and callback reachability.

### Verification

- Focused graph-export tests verify the transient message lifecycle and callback stage order.
- CLI typecheck passes.
- Focused graph-export test suite passes.
- ESLint and Prettier pass on changed files.
- Production call-graph search confirms `handleGraphExportCommand` remains registered and `onProgress` reaches the builder.
- AUDIT must distinguish source/test evidence from a human visual paint check; no unsupported browser claim.

## Perfection Loop

### Loop 1

- **RED:** Confirmed the user-visible gap, command-only lifecycle, builder phase boundaries, and that global streaming status is unrelated. Identified event-loop paint timing and failure cleanup as risks.
- **GREEN:** Converged on a single transient message plus optional builder progress callback. Rejected global stream-state coupling, fake percentage progress, and a second independent status source.
- **AUDIT:** Independent verification passed: CLI typecheck exited 0; focused graph-export tests passed; ESLint passed with zero warnings; Prettier passed. Browser paint remains an event-loop design claim, not a browser visual PASS.
- **CHANGE DELTA:** Scoped implementation touched the command, builder callback contract, focused tests, and this FID.

### Missed Questions

1. **Should the progress be a fake percentage?** No. The exporter has meaningful phase boundaries but no reliable total-cost model; stage labels are more honest and resilient.
2. **Should the existing LLM thinking bar be reused?** No. It is tied to streaming/agent lifecycle and could incorrectly imply an inference request or interfere with queue state.
3. **Can the UI render before synchronous export work begins?** Only if the command yields a macrotask after inserting the status; a microtask is insufficient protection for the renderer.
4. **What happens when the graph database is missing?** Preserve the existing immediate error path; do not show a progress message for a preflight failure that does not enter export work.
5. **What happens if a stage callback itself fails?** Progress rendering is best-effort and must not break export; the builder should invoke it through a safe local notifier or the command callback must be non-throwing.
6. **What happens when output writing fails after HTML generation?** Replace the transient message with the existing sanitized failure message; never leave `EXPORTING` visible.
7. **What is the minimal API surface?** One optional callback with a finite string-literal stage type; no new store, global state, or progress percentage protocol.

### Code Verification Evidence

- [x] Files referenced in "Affected Components" exist in the codebase
- [x] Implementation matches the proposed solution
- [x] Typecheck passes: `cd cli && bun run typecheck` → exit 0
- [x] Focused tests pass: `cd cli && NODE_ENV=production bun test src/commands/__tests__/graph-export.test.ts` → 40 pass, 0 fail
- [x] FID status updated to reflect actual implementation state after adversarial correction

> **AUDIT evidence-citation rule (FID-2026-0805-004):** every PASS and every FAIL in the AUDIT phase cites `path/to/file.ts:LINE` with the quoted code that justifies it; absence-shaped checks paste the exact search (NO-MATCH). Out-of-reach evidence is marked `NEEDS-REVIEW` naming the screen/system a human must check — never converted to PASS.

### Loop 2

- **RED:** Adversarial review identified four omissions: synchronous stage callbacks may batch until completion; file writing occurs outside the builder; `getSystemMessage()` supplies a timestamp-based ID; and concurrent exports need independent progress identities. It also required a concrete best-effort callback contract.
- **GREEN:** Revised design: use an explicit unique progress-message ID per invocation; use an async progress notifier whose callback yields a macrotask at each meaningful boundary; report `Writing HTML…` from the command immediately before the synchronous filesystem write; replace only the matching progress message while preserving unrelated history; catch notifier/UI update failures so they cannot abort export; and keep each invocation isolated so concurrent calls cannot overwrite one another.
- **AUDIT:** Independent verification passed: CLI typecheck exited 0; focused graph-export tests passed; ESLint passed with zero warnings; Prettier passed. Browser paint remains an event-loop design claim, not a browser visual PASS.
- **CHANGE DELTA:** Scoped implementation touched the command, builder callback contract, focused tests, and this FID.

### Adversarial Findings

1. **ADJUSTED — render timing:** `template.ts:73-113` contains synchronous serialization/compression/assembly around the layout await. Stage notifications must be awaitable and yield, not merely call `setMessages`.
2. **ADJUSTED — write stage ownership:** `graph-export.ts:93-94` performs `mkdirSync`/`writeFileSync`; the command must emit the writing stage there.
3. **ADJUSTED — message identity:** `message-history.ts:getSystemMessage` uses `sys-${Date.now()}`. Progress replacement must use an explicit collision-resistant ID created by the command, never array position.
4. **ADJUSTED — concurrency:** each invocation gets its own progress ID; functional updates must match only that ID.
5. **CONFIRMED — global thinking bar remains out of scope:** current command parameters expose streaming state for routing/re-entrancy, not a local export lifecycle; reusing it would create a second source of truth.
6. **ADJUSTED — callback failures:** the notifier catches UI update errors and continues export; genuine builder/write errors still replace the progress item with failure output.

### Loop 2 Audit Evidence

- `cli/src/commands/graph-export.ts:86-112` — current implementation emits only terminal success/error messages; no progress lifecycle exists.
- `cli/src/commands/graph-export.ts:93-94` — output directory creation and file write are command-owned synchronous work.
- `cli/src/commands/graph-export/template.ts:73-113` — builder phase boundaries include synchronous serialization and payload preparation around layout.
- `cli/src/commands/defs/core.ts:131` — production registration remains `handler: handleGraphExportCommand`.
- `cli/src/utils/message-history.ts:48-64` — `getSystemMessage()` creates `sys-${Date.now()}` IDs, so it is unsuitable as the sole progress identity mechanism.

- **Loop 2 verdict:** CONVERGED — implementation completed with the corrected notifier, explicit IDs, command-owned writing stage, and progress-message concurrency isolation. Same-output-path concurrent exports retain the documented pre-existing last-writer-wins behavior.

## Resolution

- **Fixed By:** Savant
- **Fixed Date:** 2026-08-07
- **Fix Description:** Added command-owned transient progress messaging with a unique UUID per invocation, an event-loop paint yield before heavy work, ordered progress stages from graph serialization through HTML writing, best-effort notifier isolation, and replacement of the progress item with exactly one final success/error message.
- **Tests Added:** Yes — ordered stage lifecycle, terminal cleanup on write failure, and progress-update failure isolation in `cli/src/commands/__tests__/graph-export.test.ts`.
- **Verified By:** Independent basher runs: CLI typecheck exit 0; focused graph-export tests 40 pass / 0 fail; ESLint 0 warnings/errors; Prettier clean; final adversarial review found no critical runtime findings.
- **Commit/PR:** Not committed
- **Archived:** 2026-08-08

## Lessons Learned

For local CLI work that can block for seconds, progress must be modeled as an explicit lifecycle owned by the command. Existing agent-thinking UI should not be repurposed for unrelated synchronous filesystem and serialization work.
