# FID: Recorder read-but-no-write stall → write-required relay guard

**Filename:** `FID-2026-0823-008-recorder-write-required-relay-guard.md`
**ID:** FID-2026-0823-008
**Severity:** medium
**Status:** closed
**Created:** 2026-08-23
**YAGNI-Compliance:** Verified

---

## Summary

The Recorder stalled twice today with a "read-but-no-write" outcome: it read a
FID, returned a text turn, and the run ended without any `write_file` — the
exact behavior its prompt forbids ("NEVER return without calling write_file").
The harness has **no mechanical enforcement**: the loop terminates on any text
turn, `getAgentOutput` relays a `lastMessage` result, and `spawn-agents.ts`
wraps it into a normal-looking report. The Orchestrator receives a silent
pass, and the missing FID is only caught by the operator's post-hoc
ground-truth check ("handoff rhythm"). Fix: a **write-required relay guard**
at the subagent-finish boundary — for a `recorder` run, if it ended without a
successful `write_file` to its allowed paths and without a `set_output`
(scaffold-seal), the relayed report becomes a visible `errorMessage`
("Recorder stalled: read without write") so the Orchestrator sees a retryable
failure instead of a silent stall. Mirrors the FID-2026-0821-005 A10
relay-digest defense pattern (state-checked at a relay boundary).

## Environment

- **OS:** win32 (Windows, Git Bash shell)
- **Language/Runtime:** TypeScript strict monorepo, Bun ≥ 1.3.11
- **Tool Versions:** `@savant-code/common` message types; agent-runtime
- **Commit/State:** working tree, 2026-08-23 (report from the main agent:
  "the Recorder agents stalled twice today (read-but-no-write, plus a
  Detective relay validation error) — both are known harness failure
  classes; edits were ground-truth verified on disk after every relay per
  the handoff rhythm.")

## Detailed Description

### Problem

A Recorder run can legitimately terminate with reads but no writes. Nothing
in the loop or the spawn relay checks the outcome against the Recorder's
contract (write a FID, or seal via `set_output`).

### Expected Behavior

- A `recorder` subagent run that finishes **without** a successful
  `write_file` to its allowed paths (`dev/fids/**`, `CHANGELOG.md`) **and
  without** `set_output` must not relay as a silent pass — the report carries
  an actionable `errorMessage` so the Orchestrator can re-spawn.
- Legitimate terminals stay untouched: FID create/update/archive writes, and
  the scaffold-seal path (`set_output` only, from `handleSteps`'s
  `scaffoldCompleteSignal` branch).

### Root Cause

1. `agents/recorder/recorder.ts` — `handleSteps` yields `'STEP'`; the
   write requirement exists only as prompt text ("NEVER return without
   calling write_file").
2. `packages/agent-runtime/src/util/agent-output.ts` — `outputMode:
   'last_message'` relays the last turn regardless of its tool content.
3. `packages/agent-runtime/src/tools/handlers/tool/spawn-agents.ts` — builds
   the `reports` array from `getAgentOutput` output with no outcome
   validation; only *rejected* spawns (thrown errors) get an `errorMessage`.

### Evidence

```text
Main-agent report (2026-08-23): "the Recorder agents stalled twice today
(read-but-no-write, ...) — both are known harness failure classes; edits
were ground-truth verified on disk after every relay per the handoff rhythm."

Code paths (grep-verified):
  agents/recorder/recorder.ts:116-140  handleSteps — yields 'STEP' only
  packages/agent-runtime/src/util/agent-output.ts:80-93
    last_message → relays the last turn verbatim
  packages/agent-runtime/src/tools/handlers/tool/spawn-agents.ts:239-262
    reports built from output; errorMessage only on rejected spawns
```

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/tools/handlers/tool/spawn-agents.ts` — report
  build site (guard wiring)
- NEW `packages/agent-runtime/src/tools/handlers/tool/recorder-stall-check.ts`
  — pure outcome checker (testable)
- NEW `packages/agent-runtime/src/__tests__/recorder-stall-check.test.ts` +
  spawn-agents integration case
- CLI display: already handles `errorMessage` reports (spawn-results.ts
  `hasError` → visible text in the agent block) — no CLI change needed

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists (operator ground-truth
      checks catch it; guard converts silent → visible)
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Mirror the A10 relay-digest discipline (FID-2026-0821-005): a small pure
checker over the child's `messageHistory` at the subagent-finish boundary,
fail-closed on the Recorder's own contract.

1. **NEW pure module** `recorder-stall-check.ts`:
   - `checkRecorderOutcome(messageHistory)` → `{ ok: true } | { ok: false;
     reason: string }`.
   - `ok` when the run contains a successful `write_file` whose `input.path`
     matches the Recorder's allowed targets (`dev/fids/**` incl. archive,
     or `CHANGELOG.md`), **or** a `set_output` call (scaffold-seal path).
   - "Successful" = a matching tool result whose JSON value carries no
     `errorMessage`.
2. **Wire in `spawn-agents.ts`** report build: for `agentType === 'recorder'`
   with a fulfilled result, run the check; on failure, report
   `value: { errorMessage: 'Recorder stalled: read without write — no
   write_file to dev/fids/**/CHANGELOG.md and no set_output before the run
   ended.' }` (replacing the silent `lastMessage` relay).
3. `spawn_agent_inline` stays out of scope for this FID (the recorder is
   spawned via `spawn_agents` fan-out; inline path noted as follow-up).

### Steps

1. Create `recorder-stall-check.ts` (pure; no runtime deps beyond message
   types).
2. Wire the check into `spawn-agents.ts`'s fulfilled-report branch.
3. Unit tests for the checker (write-success / write-error / set_output-only
   / read-only stall / CHANGELOG-only write / archive-path write).
4. Integration case at the spawn-agents level (mock `executeSubagent`,
   assert report `errorMessage` for a no-write recorder run and normal
   report for a write run).
5. Gates: agent-runtime typecheck + suite, eslint, prettier.

### Verification

- Unit: every checker branch pinned with constructed histories.
- Integration: recorder-no-write → report `errorMessage`; recorder-with-write
  → unchanged report; recorder-set_output → unchanged report.
- `grep -rn "checkRecorderOutcome"` finds the single production call site
  (Law 4 reachability).

## Perfection Loop

### Loop 1 — RED

- **RED:** (1) Recorder can end a run with reads and no write
  (`agent-output.ts` last_message relay; no outcome check in
  `spawn-agents.ts` reports); (2) the failure is silent to the Orchestrator —
  only post-hoc disk checks catch it; (3) prompt-level contract ("NEVER
  return without calling write_file") is unenforced mechanically.
- **GREEN:** Write-required relay guard — pure checker over the child
  messageHistory at the report boundary; fail-closed errorMessage relay;
  legitimate seal path (`set_output`) and FID/CHANGELOG writes exempt.
- **AUDIT (design):** Message shapes verified — assistant tool-call parts
  `{type:'tool-call', toolCallId, toolName, input}` and tool results
  `{role:'tool', toolCallId, content:[{type:'json', value}]}`
  (`common/src/types/messages/`); recorder's allowed write targets verified
  from its rules (`agents/recorder/recorder.ts`: FIDs, archive, CHANGELOG);
  CLI already renders `errorMessage` reports visibly
  (`spawn-results.ts` `hasError`), so the guard needs no CLI change. A10
  precedent (`step.ts:141-160`) proves the relay-boundary-check pattern.
- **ADVERSARIAL:** Attack — "false positive: a recorder run that correctly
  decides no FID change is needed." Answer: the recorder's own rules forbid
  that ("NEVER return without calling write_file. Your job is to write FID
  files."); a no-write finish is by contract a violation. Attack —
  "`set_output` with an error payload would pass." Answer: acceptable —
  the seal path is the legitimate non-write terminal; the guard targets the
  silent read-only stall. Attack — "recorder writes to a path outside the
  allowed set (e.g. dev/scratchpad)." Answer: out of its rules; a write
  outside the allowed set does not satisfy the guard (correct — it wrote
  where it must not).
- **CHANGE DELTA:** n/a (new FID, first loop).

### Missed Questions

1. **Should the guard count an *attempted* (but failed) `write_file`?** →
   No — a failed write means the FID did not land; the stall is accurate.
   The tool result already carries the failure for diagnosis.
2. **Is `set_output` enough to clear the guard?** → Yes — the only
   legitimate non-write terminal is the scaffold-seal path
   (`handleSteps` `scaffoldCompleteSignal` branch calls `set_output` only).
3. **What about `write_file` to `dev/fids/archive/`?** → Counts as a write —
   the Recorder's archival duty is a write to its allowed set.
4. **Does the CLI need changes?** → No — `handleToolResult`/`spawn-results`
   already surface `errorMessage` reports as visible error text.
5. **Inline spawns?** → Out of scope (recorder is fan-out spawned); noted as
   a follow-up for `spawn-agent-inline.ts` if ever needed.

## Resolution

- **Closed Date:** 2026-08-23
- **Fix Description:** See Implementation Evidence below.
- **Tests Added:** Yes — pure checker unit suite + spawn-agents integration
  case.
- **Verification Evidence:** See Implementation Evidence below.
- **Archived:** 2026-08-23 (when moved to `dev/fids/archive/`)

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** working-tree closure (release-only-commits convention);
      implementation present in the working tree at close.
- [x] **File:line ranges:**
      `packages/agent-runtime/src/tools/handlers/tool/recorder-stall-check.ts`
      (new, 97 lines — `checkRecorderOutcome` at :55);
      `packages/agent-runtime/src/tools/handlers/tool/spawn-agents.ts:5,315-327`
      (import + guard wiring in the fulfilled-report branch);
      `packages/agent-runtime/src/tools/handlers/tool/__tests__/recorder-stall-check.test.ts`
      (new, 131 lines, 8 cases);
      `packages/agent-runtime/src/__tests__/spawn-agents-recorder-stall.test.ts`
      (new, 182 lines, 2 integration cases).
- [x] **Gate output:**
      ```text
      agent-runtime typecheck: TSC_EXIT=0
      checker unit + spawn integration: 10 pass / 0 fail
      spawn-family regression (7 suites): 61 pass / 0 fail
      FULL agent-runtime suite: 1210 pass / 0 fail (3 runs;
        one transient 1-fail/1-error run, clean on re-run ×2)
      eslint --max-warnings 0 on 4 touched files: clean
      prettier: clean (after --write)
      ```
- [x] **Reproducibility:** `grep -rn "checkRecorderOutcome"
      packages/agent-runtime/src` → recorder-stall-check.ts:55 (definition)
      + spawn-agents.ts:317 (the single production call site).
- [x] **Step statuses:** all steps `implemented` — see Step Status.

### Step Status

- [x] Step 1 (recorder-stall-check.ts) — `implemented`
      (recorder-stall-check.ts:1-97)
- [x] Step 2 (spawn-agents.ts wiring) — `implemented` (spawn-agents.ts:315-327)
- [x] Step 3 (unit tests) — `implemented` (recorder-stall-check.test.ts, 8 cases)
- [x] Step 4 (integration case) — `implemented`
      (spawn-agents-recorder-stall.test.ts, 2 cases)
- [x] Step 5 (gates) — `implemented` (see Gate output above)

### Code Verification Evidence

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution
- [x] Typecheck/tests/lint pass with pasted tool output (see Gate output)
- [x] Production call-graph evidence present (spawn-agents.ts:317 is the only
      production caller of the checker)
- [x] FID status reflects the actual implementation state (`closed`,
      working-tree closure)

## Lessons Learned

A subagent's contract lives in its prompt until something checks it at a
boundary. The A10 relay-digest pattern (park evidence, validate at the relay
edge, fail visibly) converts silent model-behavior failures into retryable
outcomes — apply it to any agent whose job is *to do a thing*, not just to
*answer*. Also note: the companion Detective relay validation error could not
be reproduced from this report (no error text available); root-cause deferred,
flagged in SCOPE.md.
