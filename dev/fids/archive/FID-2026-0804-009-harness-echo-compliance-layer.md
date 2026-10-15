<!-- markdownlint-disable MD013 -->

# FID: Harness-Side ECHO Compliance Layer (Law 1/3 + Verifier-Criteria Flag)

**Filename:** `FID-2026-0804-009-harness-echo-compliance-layer.md`
**ID:** FID-2026-0804-009
**Severity:** high
**Status:** closed
**Created:** 2026-08-04 20:20
**Author:** Savant

---

## Summary

The ECHO Verifier-trigger criteria and the Law 1 (read-before-write) / Law 3 (verify-before-proceed) requirements exist only as **prompt text** inside the Savant agent definition. The runtime's tool gate checks FSM phase but performs no deterministic enforcement of read-before-write, verify-after-write, or the Verifier-spawn criteria. Production evidence (`savant-gateway/dev/LEARNINGS.md` L-001/L-003/L-004) shows an 8-FID / 2000+ line / 20+ file implementation sprint completed **without a single Verifier spawn**, after which the Verifier immediately found 9 issues (leaked email prefixes in password-reset tokens, a Stripe webhook with no signature verification, floating-point money arithmetic). This FID moves those checks from the model's discretion into the harness: a per-run compliance tracker that records reads/writes/verifications/spawns deterministically, emits non-blocking `compliance_warning` receipts, and feeds corrective steering back into the running agent so it can self-correct.

## Environment

- **OS:** Windows 11 / win32
- **Language/Runtime:** TypeScript, Bun 1.3.14 (pinned in `.bun-version` and `cli/package.json` engines)
- **Tool Versions:** TypeScript 5.5.4, zod v4, OpenTUI 0.2.2
- **Commit/State:** `main` (working tree after FID-2026-0804-001..008 + sidebar FID-tracker fix); next FID number after archive max `FID-2026-0804-008`

## Detailed Description

### Problem

1. **The Verifier never fires.** The objective Verifier-trigger criteria (savant.ts:326: "10+ lines / 2+ files / new API / security-sensitive / user requests / Forge used") and the Hybrid-vs-Full-loop decision rule (savant.ts:595-614) are prompt directives the model must self-administer. Hybrid Mode — the default — instructs the agent to write directly and only escalate to the Perfection Loop for "> 75 lines AND new imports/APIs, OR novel architecture, OR verification fails twice, OR user explicitly requests Forge." In practice the model never escalates, so the Verifier, Recorder ceremony, and Law-4 reachability greps are skipped for virtually every change. This is a **documented-intent vs. implemented-behavior contradiction**: the mode toggle comments claim EDIT is "the default strict ECHO loop," but the prompt it runs is a frictionless hybrid.

2. **No deterministic Law 1.** The write gate in `tool-executor.ts:386-465` blocks write tools unless the FSM phase is `green`/`self_correct` (or the path is exempt), but nothing records whether the target file was ever read in the run. An agent can `write_file` a path it never opened — the exact failure class L-001 documents ("Reading only the affected line").

3. **No deterministic Law 3.** The runtime does not track whether a verification command (typecheck/test/lint) ran after a batch of writes. "cargo check passes" ≠ "code is correct" (L-004) — the runtime can at least assert *some* verification command ran after writes.

4. **FID inventory is rendered but never consumed.** The sidebar fix made `loadFidInventory()` return `{ active, archived }` from both `dev/fids/` and `dev/fids/archive/`, but no harness logic uses it. A write that touches a path referenced by an active FID, or a FID transitioned to `fixed`/`verified` without verification evidence, is invisible to the runtime.

### Expected Behavior

- The runtime deterministically records, per run: every file read (read_files/read_subtree/read_url/list_directory/glob/code_search), every write (write_file/str_replace/apply_patch with path + line delta), every verification command (typecheck/test/lint patterns), and every spawn (verifier/forge/recorder).
- **Law 1 (read-before-write):** a write to a path that was never read this run (and has no content-knowledge signal) emits a non-blocking `compliance_warning` at write time and injects a corrective steering notice the agent can act on (read the file, then write).
- **Law 3 (verify-after-write):** at each step boundary, if writes occurred this step and no verification command ran after them, emit a `compliance_warning`.
- **Mechanical Verifier-criteria flag:** at each step boundary, evaluate the savant.ts:326 criteria deterministically; when any criterion is met and the Verifier was not spawned (and no equivalent verification evidence exists), emit a `compliance_warning` receipt and steer the agent to spawn the Verifier.
- **Archived-FID-aware tracking:** when a write targets a path referenced by an active FID, the Verifier-criteria flag is always emitted (not just advisory); the tracker consumes `loadFidInventory()` so the harness finally uses the FID data it renders.
- All compliance output is **non-blocking** (warning + steering), preserves the hybrid flow, and is disabled-able per run for tests. Hard-block mode is future work, explicitly out of scope.

### Root Cause

The ECHO enforcement contract was shipped entirely inside the agent system prompt (`savant.ts` → `buildImplementationInstructionsPrompt`), i.e. as instructions to the model, with no harness-side deterministic counterpart. The runtime already contains the right architectural seams — the unified tool gate in `tool-executor.ts` and the step loop in `run-agent-step.ts` — but they enforce FSM phase only. The model is the sole judge of whether verification or the Verifier happens, and the Hybrid-Mode default tells it to skip the loop for anything below the "genuinely complex" bar. LEARNINGS.md L-001 proves the model never self-triggers: all objective criteria were met across every FID, and the Verifier still was never spawned.

### Evidence

```text
agents/savant/savant.ts:326 (soft trigger — prompt text only)
  '- **Verifier trigger (objective criteria):** Spawn the Verifier to review code changes when ANY of these apply:
     (1) change is 10+ lines, (2) change touches 2+ files, (3) new function or API added,
     (4) security-sensitive code touched, (5) user explicitly requests review, (6) when Forge was used...'

agents/savant/savant.ts:595-614 (Hybrid Mode default — full loop only when ALL complex criteria apply)
  595  ## Hybrid Mode (Default — use for most tasks)
  606  Use the full Perfection Loop ONLY when ALL of these apply:
  607  - Touches > 75 lines AND requires new imports/APIs, OR
  608  - Novel architecture or patterns not in the codebase, OR
  609  - Verification fails twice with direct fixes, OR
  610  - User explicitly requests Forge

packages/agent-runtime/src/tools/tool-executor.ts:386-465 (write gate — FSM phase only, no Law 1)
  386  // ECHO FSM tool gating: block write tools unless phase is 'green' or path is exempt.
  467  } // ECHO FSM tool gating: block bash/terminal commands unless phase is 'audit' or 'green'.

packages/agent-runtime/src/run-agent-step.ts:719 (loopAgentSteps) / :1228 (shouldEndTurn) / :1388 (drainSteeringMessages)
  — step boundary exists for per-step evaluation; a steering hook already drains at each boundary.

common/src/types/print-mode.ts — PrintModeEvent discriminated union (start|error|finish|text|tool_call|
  tool_result|subagent_start|subagent_finish|reasoning_delta|activity) — NO compliance variant exists.

cli/src/utils/sdk-event-handlers.ts:526 + cli/src/utils/create-run-config.ts:143 (handleEvent) — CLI event
  consumption point where a new event type must be handled.

dev/fids/FID-2026-0804-009 (this FID) — next number; archive holds FID-2026-0804-001..008.

Production evidence — savant-gateway/dev/LEARNINGS.md (independent, authored by the production agent):
  L-001: Verifier Was Never Spawned During Implementation — 8 FIDs, 2000+ lines, 20+ files,
         security-sensitive auth/payment code. Verifier later found 9 issues (3 critical/high):
         password reset token leaked email prefixes; Stripe webhook had no signature verification;
         money arithmetic used floating-point.
  L-003: Law 4 (Call-Graph Reachability) Never Executed — "Compilation is NOT verification."
  L-004: Self-Verification Throughout — "The agent that writes code cannot verify it. Self-reporting is
         prohibited." cargo check ≠ correctness.
```

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/util/echo-compliance.ts` (new — tracker + pure evaluators)
- `packages/agent-runtime/src/tools/tool-executor.ts` (Law 1 read-recording + write-time check)
- `packages/agent-runtime/src/run-agent-step.ts` (Law 3 + Verifier-flag evaluation at step boundary, steering injection)
- `sdk/src/run.ts` (create the per-run tracker at the public `run()` entry `:291`, thread via `agentState`; flows through `main-prompt.ts:115` → `loopAgentSteps`)
- `common/src/types/print-mode.ts` (new `compliance_warning` event variant)
- `common/src/types/session-state.ts` (`AgentState.echoCompliance?: EchoComplianceTracker`, `@internal` non-serialized)
- `cli/src/utils/sdk-event-handlers.ts` (handle + render the new event)
- `cli/src/utils/__tests__/sdk-event-handlers.test.ts`, `packages/agent-runtime/src/__tests__/echo-compliance.test.ts` (new)
- `cli/src/utils/fid-loader.ts` (consumed by the tracker; no change required)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Add a per-run `EchoComplianceTracker` (agent-runtime util, pure + testable evaluators) that records reads, writes, verification commands, and spawns from the existing tool-executor hot path, then evaluates Law 1 at write time and Law 3 + the Verifier criteria at each step boundary. Violations emit a new `compliance_warning` PrintModeEvent and — crucially — inject a **corrective user-role notice into message history** so the running model sees and acts on it (this is what makes enforcement visible to the agent, not just the UI). The tracker consumes `loadFidInventory()` so writes touching active-FID paths upgrade the Verifier flag from advisory to always-on. Default mode is `warn` (non-blocking receipts); `off` per-run opt-out for tests; `block` hard mode is future work.

### Steps

1. **`echo-compliance.ts` (new):** `EchoComplianceTracker` with `recordRead(paths)`, `recordWrite(path, lineDelta, opts)`, `recordVerification(command)`, `recordSpawn(agentType)`, `setActiveFidPaths(Set<string>)`; plus pure functions: `evaluateLaw1({ path, readPaths, hasContentKnowledge })`, `detectsVerificationCommand(command)`, `meetsVerifierCriteria({ linesAdded, filesTouched, newApiHint, securitySensitive, forgeUsed, userRequestedReview })`, `isSecuritySensitivePath(path)`, `countLinesAdded(input)`. Writes: `str_replace` with a non-empty `oldString` counts as content-knowledge (the agent demonstrably knew the content); `write_file` full-file writes carry only a user-prompt path-mention signal (weak, severity `info`).
2. **Law 1 wiring (tool-executor write gate):** after `pathResult.resolved` (post containment, pre-handler), record the write on the tracker; if the path was never read and has no content-knowledge signal, emit `compliance_warning { law: 'law1' }` immediately (info) so the agent can read before finishing.
3. **Read recording (tool-executor):** for `read_files`/`read_subtree`/`read_url`, record input `paths`/`url`; for `list_directory`/`glob`/`code_search`, record the directory/pattern as a prefix read. Runs at the same hot-path seam as the write gate — one module, one hook point.
4. **Law 3 + Verifier flag (loopAgentSteps step boundary):** after `shouldEndTurn` is computed (~:1228), evaluate the finished step: Law 3 (writes without a subsequent verification command) and Verifier criteria (lines ≥ 10, files ≥ 2, new-API heuristic via content regex, security-sensitive path keywords, forge spawned, FID-path touched). On violation: emit `compliance_warning` chunk(s) **and** push a user-role notice into `messageHistory` so the model self-corrects next step. Deduplicate per step to avoid noise.
5. **Event type (print-mode.ts):** add `compliance_warning` to the discriminated union: `{ type: 'compliance_warning', law: 'law1' | 'law3' | 'verifier_criteria' | 'fid', severity: 'info' | 'warning' | 'critical', message, path?, fidId?, stepNumber? }`.
6. **CLI rendering (sdk-event-handlers.ts):** handle the new event as a muted receipt line in the transcript; do not block, do not open a modal.
7. **Run lifecycle (sdk/src/run.ts + session-state.ts):** create the tracker per run at the `run()` entry, attach to `AgentState.echoCompliance` (marked `@internal`, excluded from serialization like `activityIdleTimer`); tool-executor and the step loop read it from `agentState`.
8. **Tests:** unit tests for the pure evaluators (Law 1 prefix matching + content-knowledge, verification-command detection incl. `cargo check`/`tsc`/`eslint`/`bun test`, security-path keywords, criteria thresholds at exactly 10 lines / exactly 2 files, new-API regex false-positive guard) + a wiring test executing a fake run that writes without reading and asserts the `compliance_warning` event fires.
9. **Gates:** `bun run --cwd=packages/agent-runtime typecheck`, `bun run --cwd=cli typecheck`, new test suites, `bun x eslint . --max-warnings 0`, `bun run lint:md`, Law-4 reachability greps (tracker → tool-executor + loopAgentSteps, event type → sdk-event-handlers).

### Verification

- Unit suites for `echo-compliance` evaluators and the tool-executor/step-boundary wiring pass.
- A scripted run that writes `new-file.ts` without reading it produces a `law1` receipt; a run that writes 12 lines across 2 files without spawning Verifier produces a `verifier_criteria` receipt; a run that writes then runs `bun run typecheck` produces no `law3` receipt.
- Call-graph greps: `echoCompliance` reachable from `executeToolCall` and `loopAgentSteps`; `compliance_warning` handled in `sdk-event-handlers.ts`.
- Typecheck ×2 (agent-runtime, cli), ESLint 0 warnings, markdownlint 0 issues.

## Perfection Loop

### Loop 1

- **RED:** Cataloged (a) the prompt-only soft triggers at savant.ts:326/595-614, (b) the FSM-only write gate at tool-executor.ts:386-465 with no read tracking, (c) the step-boundary seams at run-agent-step.ts:1228/1388, (d) the absence of a compliance event type in print-mode.ts, (e) the unused `loadFidInventory()` after the sidebar fix, and (f) production LEARNINGS.md L-001/L-003/L-004 as independent proof of the failure mode.
- **GREEN:** Converged on the per-run `EchoComplianceTracker` design: one hot-path hook (tool-executor) for read/write/spawn/verify recording + Law 1; the step boundary for Law 3 + Verifier-criteria evaluation; a new `compliance_warning` event + a message-history steering notice so the model self-corrects; FID-aware escalation via `loadFidInventory()`. Non-blocking `warn` default; per-run `off` opt-out; hard `block` mode explicitly future work.
- **AUDIT:** Verified every cited file/line exists in the working tree (static analysis — Method 1). Re-derived the design against the FID template and FID authoring rules (Method 2): correct filename/number (`FID-2026-0804-009`), required fields present, status `analyzed`, FID lives only in `dev/fids/`. Design audit findings: (1) read recording must include `list_directory`/`glob`/`code_search` prefix semantics or Law 1 false-positives on directory reads; (2) `str_replace` with exact `oldString` must count as content-knowledge; (3) Law 1 must emit at write time (actionable) while Law 3/Verifier flags batch at step boundary (receipts) to bound noise; (4) the tracker must be excluded from session serialization; (5) the Verifier flag must dedupe per step.
- **CHANGE DELTA:** 0% (design-only FID; no code written yet — FID-bound execution requires convergence + user approval before IMPLEMENT).

### Loop 2 (Implementation — operator-approved 2026-08-04)

- **GREEN (IMPLEMENT):** All 8 design steps implemented and wired through the live seams. New `EchoComplianceTracker` at `packages/agent-runtime/src/util/echo-compliance.ts` (class + pure evaluators `detectsVerificationCommand`, `isSecuritySensitivePath`, `hasNewApiDeclaration`, `userRequestedReview`, `meetsVerifierCriteria`, plus Law-1 prefix/directory-read coverage and steering budget). Recording + Law 1 wired into `tool-executor.ts` (read/write/spawn/verification from the unified hot path; `compliance_warning` emitted at write time for never-read paths). Law 3 + Verifier-criteria + FID escalation evaluated at the `loopAgentSteps` step boundary (`run-agent-step.ts`) with `compliance_warning` chunks AND budgeted corrective steering pushed into `messageHistory` (user role, `ECHO_COMPLIANCE` tag, keep-during-truncation) so the running model self-corrects — non-blocking. New `compliance_warning` variant on the `PrintModeEvent` union (`common/src/types/print-mode.ts`), `AgentState.echoCompliance` marked `@internal`/non-serialized (`session-state.ts`). Per-run tracker created at the SDK `run()` entry (`sdk/src/run.ts` `RunOptions.echoCompliance`), threaded to subagent states (`spawn-agent-utils.ts` `createAgentState`). CLI: `create-run-config.ts` passes active-FID paths from `loadFidInventory()`, `sdk-event-handlers.ts` renders a muted receipt, `FidData` gained an optional `path` (`fid-loader.ts` + `fid-list.tsx`).
- **Tests:** 25 unit tests (`echo-compliance.test.ts` — Law 1 read/prefix/new-file/content-knowledge/prompt-mention/off-mode, Law 3 ending-turn gating, Verifier-criteria thresholds at exactly 10 lines / 2 files + security/Forge/review-request, FID-path escalation, steering budget + dedup), 2 wiring tests (`echo-compliance-wiring.test.ts` — real `write_file` through `processStream` with a live tracker emits the `compliance_warning` chunk on the actual tool-executor hot path), +1 CLI event-handler render test (`sdk-event-handlers.test.ts`).
- **AUDIT (independent code-reviewer-deepseek-flash):** Passed with 3 findings, all fixed: (1) **subagent loops evaluated AND steered** against the shared run tracker — a Forge/basher subagent had a "spawn the Verifier" directive injected into its own history where it can't act; now evaluation + steering are gated to the main loop only (`!currentAgentState.parentId`; `parentId` reliably set at `spawn-agent-utils.ts:334`) while recording stays live for subagents via tool-executor. (2) **Law 1 write-recording ran before the sandbox gate** — a sandbox-denied write inflated `filesTouched`/`linesAdded` and could trigger spurious Law 3/Verifier receipts; the record + emit moved AFTER the sandbox gate (`resolvedWritePath` stash; only dispatched writes count — write tools are `permission: allow` so no sandbox-deny regression case is constructible without changing the registry, verified). (3) **`loadFidInventory()` sync fs IO per message send** — 30s TTL cache + full skip when mode is `off` (`create-run-config.ts` `getActiveFidPaths`). Minor: programmatic-only turns intentionally never evaluate (documented in a comment — handleSteps flows own their own compliance).
- **CHANGE DELTA:** 100%. See Resolution for the full file list and gates.

### Missed Questions

1. **Should compliance be on by default, or opt-in?** → On by default (`warn`). The entire complaint is that enforcement lives in the model's discretion; the harness must own it. Per-run opt-out exists only for tests and deliberate `unsafe` sessions.
2. **Does it apply to subagents?** → Yes, naturally: subagent tool calls pass through the same tool-executor, and the tracker lives on `agentState` shared down the ancestor chain. Criteria are evaluated for the run as a whole, not per subagent, so a run that used Forge without Verifier is flagged once.
3. **Does free mode (savant-free) get it?** → Yes, the cheap core checks (Law 1/3) apply to every mode; the FID-aware component activates only when `dev/fids/` exists and `noFIDPerChange` is false. All warnings stay non-blocking so free-tier UX is unaffected.
4. **False positives when the user pastes the file content into the prompt?** → Bounded: `str_replace` with exact `oldString` is content-knowledge (no warning); `write_file` whose content matches user-prompt text or whose path appears in the user prompt downgrades to severity `info`. Non-blocking anyway, so a residual false positive is a receipt, not a block.
5. **Does the tracker persist across turns?** → No. Per-run only; a fresh turn starts fresh (prior reads live in message history anyway). Persisting would conflate sessions and leak state.
6. **Does emitting a new union member break existing event consumers?** → The CLI handler must add a case (in scope, step 6) and its test is updated; the SDK forwards the event generically. Grep for `event.type` consumers during implementation and update any exhaustive switch.
7. **Interaction with the existing FSM phase gate?** → Orthogonal by design: FSM gating (phase) stays as-is; compliance adds read/verify/criteria checks (content-level). Both active simultaneously; neither replaces the other.
8. **Line counting for "10+ lines"?** → `write_file`: `content.split('\n').length`; `str_replace`: net delta (newString lines − oldString lines); `apply_patch`: hunks' added-line count. Approximation is acceptable for a receipt-level flag; the threshold is deliberately coarse.
9. **Does the "new function/API added" heuristic over-trigger?** → It is one OR'd criterion among several; over-triggering only promotes the advisory flag to warning, which is acceptable and self-limiting (the message names the matched criterion). Guarded regex (`export function|export const .* = \\(|^(async )?function |class \\w+`) keeps false positives rare.
10. **Should the steering notice be a real message the model sees?** → Yes — pushing a `role: 'user'` notice into `messageHistory` is the difference between "harness nags the UI" and "harness steers the agent." It rides the exact seam the runtime already uses for context-pruner/steering.
11. **Where does hard-block mode go?** → Explicitly future work (separate FID). `warn` ships first; `block` reuses the same evaluators behind a `severity: 'critical'` + denial path, so the design cost is already paid.
12. **Does this FID itself require a FID?** → It is the FID. Implementation is FID-bound to this document's convergence + user approval (Law 2 — Present Before Act).

### Code Verification Evidence

- [x] Files referenced in "Affected Components" exist in the codebase — all created/edited during Loop 2 implementation
- [x] Implementation matches the proposed solution — every design step (1-8) landed in the files named in Approach/Steps
- [x] Typecheck passes: all 4 workspaces (common, agent-runtime, sdk, cli) exit 0
- [x] Full suites green after the review fixes: agent-runtime 667/0 (incl. 27 compliance unit + wiring), CLI 2775/0 (18 skip), CLI targeted 60/0 (create-run-config + sdk-event-handlers + fid-loader), ESLint 0 warnings on all changed files, SDK + common suites unchanged green
- [x] Law 4 (call-graph reachability) greps: `echoCompliance` recorded in `tool-executor.ts`, evaluated in `run-agent-step.ts` (main-loop only), tracker created in `sdk/src/run.ts`, `fidPaths` passed in `create-run-config.ts`, `compliance_warning` handled in `sdk-event-handlers.ts`, tracker threaded to subagents in `spawn-agent-utils.ts` — all seams confirmed
- [x] FID status reflects actual state: `closed` — converged Loop 1 + implemented Loop 2 + independent review fixes; archived per Auto-Archive rule

## Resolution

- **Fixed By:** Savant
- **Fixed Date:** 2026-08-04
- **Fix Description:** Per-run `EchoComplianceTracker` in agent-runtime enforcing deterministic Law 1 (read-before-write) at the write gate (post-sandbox, so only dispatched writes count), Law 3 (verify-after-write) + mechanical Verifier-criteria flags + FID-path escalation at the step boundary, and archived-FID-aware tracking via `loadFidInventory()`, with `compliance_warning` PrintModeEvents + budgeted message-history steering so the running agent self-corrects. Non-blocking `warn` default; per-run `off` opt-out; hard `block` mode future work. Files: `common/src/types/echo-compliance.ts` (new), `common/src/types/print-mode.ts`, `common/src/types/session-state.ts`, `packages/agent-runtime/src/util/echo-compliance.ts` (new), `packages/agent-runtime/src/tools/tool-executor.ts`, `packages/agent-runtime/src/run-agent-step.ts`, `packages/agent-runtime/src/tools/handlers/tool/spawn-agent-utils.ts`, `sdk/src/run.ts`, `cli/src/utils/create-run-config.ts`, `cli/src/utils/sdk-event-handlers.ts`, `cli/src/utils/fid-loader.ts`, `cli/src/components/savant-ui/echo/fid-list.tsx`.
- **Tests Added:** 25 unit + 2 wiring (agent-runtime) + 1 CLI render test = 28 new; full suites 667/0 (agent-runtime) + 2775/0 (CLI) green.
- **Verified By:** typecheck ×4 exit 0, full agent-runtime + CLI suites, changed-file ESLint 0 warnings, Law-4 reachability greps, independent code-reviewer-deepseek-flash (3 findings fixed + re-reviewed clean).
- **Commit/PR:** (working tree — pending push with v0.0.19)
- **Archived:** 2026-08-04 — moved to `dev/fids/archive/` per the ECHO Auto-Archive rule; CHANGELOG entry appended.

> When status is set to **Closed**, move this file to `dev/fids/archive/` and append an entry to `CHANGELOG.md`.

## Lessons Learned

Soft triggers are not enforcement. Every ECHO rule that must hold for *every* change — Law 1, Law 3, the Verifier criteria — must have a deterministic harness counterpart, because the model will optimize toward the frictionless default (Hybrid Mode) and the prompt's escalation bar ("> 75 lines AND novel architecture") is effectively unreachable. The production LEARNINGS.md L-001 lesson ("The Verifier is not optional") is exactly the gap this FID closes at the runtime layer. Future rule additions should follow the same pattern: prompt text for the model, deterministic tracker for the harness.
