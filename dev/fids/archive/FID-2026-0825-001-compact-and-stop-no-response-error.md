# FID: /compact errors with "No response from agent" after a prior compaction

**Filename:** `FID-2026-0825-001-compact-and-stop-no-response-error.md`
**ID:** FID-2026-0825-001
**Severity:** high
**Status:** closed
**Created:** 2026-08-25 02:10
**Author:** Orchestrator (operator bug report, hybrid mode)
**YAGNI-Compliance:** Verified

---

## Summary

Running `/compact` a second time in a session (specifically: any `/compact` issued when the
compacted history contains no surviving assistant-role messages) deterministically fails with
`error, No response from agent` instead of completing silently. The manual compact-and-stop
run intentionally ends without an LLM turn, and `getAgentOutput` treats a zero-assistant
history as a run error.

## Environment

- **OS:** Windows (Git Bash), win32
- **Language/Runtime:** TypeScript strict monorepo, Bun 1.3.14
- **Tool Versions:** bun run typecheck (tsc --noEmit ×12 workspaces)
- **Commit/State:** working tree (uncommitted); fix applied 2026-08-25 ~02:15 EDT

## Detailed Description

### Problem

Operator reports: typing `/compact` yields `error, no response from agent`.

### Expected Behavior

`/compact` replaces the message history via the context-pruner and ends quietly. The
CompactionSignal panel surfaces the outcome (`pruned` / `ineffective`). The chat run itself
completes successfully with no new assistant content.

### Root Cause

Chain of evidence:

1. `cli/src/commands/defs/chat.ts:239` — `/compact` sends the literal prompt to the agent.
2. `agents/savant/handle-steps-factory.ts` (serialized interceptor) — detects `/compact`,
   force-spawns the context-pruner, then **compact-and-stop**: `return` with no LLM step.
   No assistant message is ever generated for this run.
3. The spawn boundary (`packages/agent-runtime/src/tools/handlers/tool/spawn-agent-inline.ts`)
   swaps in the compacted history and pushes a USER-role COMPACTION_NOTICE — still no
   assistant message.
4. Run completes → `packages/agent-runtime/src/run-agent-step/loop.ts` assembles output via
   `getAgentOutput(initialAgentState, agentTemplate)` (`util/agent-output.ts`, `last_message`
   mode): walking backwards finds **zero assistant-role messages** → returns
   `{ type: 'error', message: 'No response from agent' }`.
5. CLI `cli/src/hooks/helpers/send-message/run-results.ts` renders error-type output through
   `setError(...)` → UserErrorBanner shows the failure even though compaction succeeded.

Trigger condition: post-compaction histories legitimately contain zero assistant messages
(full-sweep summary absorbs every turn; protected tail may hold none). Therefore every
`/compact` issued right after a previous successful one errors. Secondary defect: when older
assistant turns DO survive, `getAgentOutput` returned that stale pre-compaction turn as the
"/compact response".

### Evidence

- Live reproduction: second consecutive `/compact` in this session errored; first succeeded
  (assistant greeting existed pre-compaction).
- `grep -n "No response from agent"` → single production site,
  `packages/agent-runtime/src/util/agent-output.ts:87`.
- Error-output fall-through path confirmed at `run-results.ts:95-127`.

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/run-agent-step/loop.ts` (output assembly)
- `agents/savant/handle-steps-factory.ts` → serialized savant handleSteps (all variants)
- `common/src/types/session-state.ts` (AgentState flag)
- `cli/src/agents/bundled-agents.generated-data/*` (regenerated artifact)

### Risk Level

- [x] High: Major feature broken (manual compaction unusable after auto-compaction), no
      workaround short of sending a normal message first.

## Proposed Solution

### Approach

One-shot coordination flag, consumed at the single output-assembly site:

1. `session-state.ts`: add optional `compactAndStop?: boolean` to AgentState (plain boolean;
   survives the SDK JSON snapshot boundary).
2. `handle-steps-factory.ts`: stamp `agentState.compactAndStop = true` in the manual-compact
   branch before the spawn yield + stop return.
3. `loop.ts`: wipe any stale value at loop start; at success-return, if the flag is set,
   consume it and return `{ type: 'lastMessage', value: [] }` instead of calling
   `getAgentOutput` — intentional silence is SUCCESS.
4. Regenerate the bundled agents (`cli: bun run prebuild:agents`).

### Steps

1. [x] Type field added (`common/src/types/session-state.ts`)
2. [x] Interceptor stamp (`agents/savant/handle-steps-factory.ts`)
3. [x] Loop consume + benign empty output (`packages/agent-runtime/src/run-agent-step/loop.ts`)
4. [x] Bundle regenerated; all 13 savant chunks carry the stamp

### Verification

Typecheck (root, ×12 workspaces) exit 0 · eslint --max-warnings 0 ×3 touched files ·
prettier --check ×3 · bundle grep proof. Live TUI smoke was RESTART-GATED at fix time
(running process predated the fix); the operator confirmed the fix on 2026-08-25 and
directed closure.

## Verification Gates

- gate: typecheck common
- gate: typecheck packages/agent-runtime
- gate: typecheck cli

### Verification Receipt

- fingerprint: sha256:8f4b14bac6552faa04d9e41fa48e8f7b7a9d85bb6ceb5633634c315ac6143ea6
- verified: 2026-08-25T06:55:18.716Z
- typecheck common: exit 0
- typecheck packages/agent-runtime: exit 0
- typecheck cli: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Operator-reported symptom root-caused across five sites with file:line evidence
  (see Root Cause chain). RED satisfied by direct investigation evidence; formal RED phase
  skipped per small-change rules.
- **GREEN:** Three-file fix (~30 lines) + bundle regeneration. Inline verification green.
- **AUDIT:** Independent Verifier audit PASS — wiring verified at all three sites; edges
  cleared (subagent states never carry the flag; resumed-session staleness handled by the
  loop-start wipe; reactive-compact unreachable for manual /compact; non-interceptor agents
  byte-identical via the `=== true` guard). Both NEEDS-REVIEW residuals discharged with tool
  evidence post-audit: `grep -rn compactAndStop sdk/src desktop evals savant-free scripts`
  → 0 matches (no string-keyed readers outside audited dirs); `cli/src/headless-run.ts`
  non-error branch routes through extractFinalAnswer, which tolerates an empty lastMessage
  value (prints nothing, exit OK; /compact is a chat-surface command).
- **ADVERSARIAL:** N/A for hybrid-mode small fix unless Verifier escalates.
- **CHANGE DELTA:** ~8%

### Missed Questions

1. *What if a crash persists the flag across runs?* → loop start wipes it unconditionally
   before any step, so a stale persisted value can never mask a genuine error later.
2. *Does the reactive-compact path need the same treatment?* → No: manual `/compact` makes
   zero LLM calls, so prompt-too-long retry paths are unreachable for it.
3. *Subagent leak?* → The flag is stamped/consumed on the main savant state only; subagent
   states never inherit it mid-run.

### Implementation Evidence (REQUIRED for `closed`)

- [x] Commit SHA: none yet — closed from the uncommitted working tree per operator
      directive 2026-08-25 (commit remains a separate operator action; changes reproducible
      via the greps below)
- [x] File:line ranges: `session-state.ts` (AgentState.compactAndStop);
      `handle-steps-factory.ts` (manual-compact branch); `loop.ts` (loop-start wipe +
      success-return consume)
- [x] Gate output: typecheck exit 0 (×12 workspaces) · eslint/prettier clean ×3
- [x] Reproducibility: `grep -rn compactAndStop common/src packages/agent-runtime/src agents`
- [x] Step statuses: all four Proposed Solution steps implemented

### Code Verification Evidence

- [x] Files referenced exist; implementation matches Proposed Solution
- [x] Typecheck/tests/lint pass with pasted tool output (see Verification Gates receipt)
- [x] Call-graph proof: `grep -l compactAndStop cli/src/agents/bundled-agents.generated-data/*.ts`
      → 13 savant chunks post-regen
- [x] FID status reflects actual implementation state (`closed` 2026-08-25 on the
      operator's confirmation of the live fix)

## Resolution

- **Closed Date:** 2026-08-25 02:52 EDT (operator confirmed the live fix)
- **Fix Description:** Compact-and-stop runs now report explicit empty output instead of the
  false "No response from agent" error or a stale-turn echo.
- **Tests Added:** No new test harness (loop-level integration cost outweighs a 3-line
  behavioral flag; covered by typecheck + wiring greps).
- **Verification Evidence:** typecheck common / packages/agent-runtime / cli all exit 0 ·
  eslint/prettier clean · Verifier audit PASS (residuals discharged) · receipt stamped,
  `--check` PASS · operator live confirmation received
- **Archived:** 2026-08-25 02:52 EDT (moved to `dev/fids/archive/`)

## Lessons Learned

Serialized-generator changes are invisible to tsc/eslint/prettier (template-literal string
bodies) — the only compile-time safety net is the bundle regeneration step, which must be
treated as part of every factory edit, not an afterthought. Also: concurrent streams editing
the same hot file (session-state.ts) can strand duplicate declarations; re-read the exact
region immediately before each dedup attempt rather than trusting a cached read.