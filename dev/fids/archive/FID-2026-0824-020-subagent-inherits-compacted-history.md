# FID: Subagents Inherit Compacted History — Inter-Agent Data Loss

**Filename:** `FID-2026-0824-020-subagent-inherits-compacted-history.md`
**ID:** FID-2026-0824-020
**Severity:** high
**Status:** closed
**Created:** 2026-08-24 17:50
**YAGNI-Compliance:** Pending

Sibling: `FID-2026-0824-021` (compactor core defects — upstream cause of the
loss inherited here). Suite member of `FID-2026-0824-022` (resolution owned by
child `-026`).

---

## Summary

Subagents spawned with `includeMessageHistory: true` receive a copy of the parent's
message array AS IT EXISTS AT SPAWN TIME — after any compaction layer has already
rewritten it. Micro-compact replaces stale tool results with `'[compacted]'`
sentinels, auto-compact replaces whole history with an LLM summary via a
context-pruner `set_messages`, and reactive truncation keeps only head+tail.
Zero-tool evidence consumers (Verifier, and partially Adversary) depend entirely on
that inherited history, so once compaction fires they receive summaries instead of
raw tool output — the recurring operator-reported symptom: "data is passed but it's
compacted." Live specimen this session: the batched-suite Verifier twice reported
payloads "compacted out of visible history" and deferred citations to NEEDS-REVIEW.

## Environment

- **OS:** Windows 11 primary dev host
- **Language/Runtime:** TypeScript strict monorepo, Bun 1.3.14 (pinned)
- **Tool Versions:** packages/agent-runtime @ working tree (v0.0.27 prep)
- **Commit/State:** main (working tree, release-only-commits)

## Detailed Description

### Problem

Inter-agent data transfer is lossy whenever a compaction event precedes a spawn:

1. `createAgentState` (spawn-agent-utils.ts) seeds the child with
   `filterUnfinishedToolCalls(parentAgentState.messageHistory)` — a copy of the
   parent's CURRENT array. No pre-compaction snapshot exists anywhere.
2. Layer 2 `runMicroCompact` (context-compactor/micro-compact.ts) overwrites stale
   tool results in place with `'[compacted]'` (stdout/stderr destroyed;
   verification tools keep only `{command, exitCode}`). Default ON at the
   compactor (`microCompactEnabled ?? true`); this repo's protocol.config.yaml
   opts out, other projects do not.
3. Layer 3 auto-compact replaces parent history wholesale through the
   context-pruner pipeline ("context-pruner replaces history through set_messages"
   — spawn-agent-inline.ts:216; mutation boundary native.ts:626).
4. Layer 4 reactive truncation (loop/reactive-compact.ts) keeps first + last ~20%.
5. `verifier.ts:27`, `adversary.ts:38`, `forge.ts:30`, `savant.ts:139`,
   `context-pruner.ts:38` all set `includeMessageHistory: true`.

### Expected Behavior

AUDIT-phase agents verify claims against RAW evidence (ECHO Honest Assessment:
PASS requires file:line + tool output). Evidence must survive compaction.

### Root Cause

The harness optimizes parent-context tokens but has no full-fidelity evidence
channel: the compacted conversation array is the ONLY data channel a spawned agent
receives. Compaction was designed as context-window hygiene; inheritance treats the
mutated array as ground truth.

### Evidence

```text
packages/agent-runtime/src/tools/handlers/tool/spawn-agent-utils.ts
  createAgentState -> filterUnfinishedToolCalls(parentAgentState.messageHistory)
packages/agent-runtime/src/context-compactor/micro-compact.ts
  buildCompactedToolValue -> '[compacted]' sentinel replacement
packages/agent-runtime/src/tools/handlers/tool/spawn-agent-inline.ts:216
  "context-pruner replaces history through set_messages in the child"
packages/agent-runtime/src/tools/tool-executor/native.ts:626
  "set_messages is the mutation boundary used by context-pruner"
LIVE: this session's suite-audit Verifier output — "reads that are compacted out
of visible history"; "the package.json payload is compacted" (twice), forcing
NEEDS-REVIEW deferrals onto the Adversary.
```

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/tools/handlers/tool/spawn-agent-utils.ts`
- `packages/agent-runtime/src/context-compactor/*` (+ loop/reactive-compact.ts)
- `agents/{verifier,adversary,forge,savant}/`, EHEL evidence injection path

### Risk Level

- [ ] Critical / [x] High: silently degrades the double-audit guarantee — Verifier
      verdicts can rest on LLM summaries of evidence rather than evidence; fails
      soft (NEEDS-REVIEW) only when the model notices, which is not guaranteed
- [ ] Medium / [ ] Low

## Proposed Solution

### Approach

Give evidence consumers a channel that survives compaction (direction; converge in
GREEN). Preserve existing token economics for normal agents.

### Steps

1. Append-only evidence spill: raw tool results (keyed by toolCallId) written at
   the result boundary to `.savant/evidence/<runId>.jsonl` (size-capped).
2. `createAgentState`: for `includeMessageHistory` templates flagged
   `requiresRawEvidence` (verifier/adversary), splice relevant raw evidence back
   into the child history (or attach as structured attachment messages).
3. Generalize the existing `keepDuringTruncation` flag so AUDIT-relevant results
   survive micro/reactive passes on the parent side too.
4. Config keys additive under `compression:` (off-switch preserved).
5. Tests: compact-then-spawn fixture proving Verifier sees raw bytes;
   off-switch honored; spill size cap; no regression in compaction savings.

### Verification

Gates declared below; receipt stamped at fixed-flip per FID-2026-0823-009.

## Verification Gates

```markdown
- gate: typecheck packages/agent-runtime
- gate: test packages/agent-runtime/src/__tests__/context-compactor.test.ts
- gate: test packages/agent-runtime/src/context-compactor-micro.test.ts
```

(Receipt stamped via `bun run fid:verify <fid> --write` at status flip.)

## Perfection Loop

### Loop 1 — RED

- **RED:** Operator-reported persistent symptom + live in-session specimen;
  chain traced across five files with citations above (2026-08-24).
- **GREEN:** CONVERGED 2026-08-24 (implementation owned by suite child
  `FID-2026-0824-026`, master `-022`): spill record schema
  `{ts, runId, agentId, toolCallId, toolName, byteSize, sha256, raw}` written
  append-only at the tool-result boundary to `.savant/evidence/<runId>.jsonl`
  with per-record + total caps (`compression.evidenceSpill:` additive config);
  new `AgentDefinition.requiresRawEvidence?: boolean` (default false;
  verifier/adversary true); splice in `createAgentState` AFTER
  `filterUnfinishedToolCalls` — pure toolCallId matching restores raw content
  over `[compacted]` sentinels, plus an inventory note listing restored ids.
  Off-switch ⇒ behavior identical to today. Steps 1–5 below are the accepted
  plan; step ordering delegated to `-026`'s own Proposed Solution.
- **AUDIT:** Batched suite Verifier (2026-08-24): PASS w/ notes — GREEN
  convergence to `-026` verified; gate-path NEEDS-REVIEW raised on
  `context-compactor-micro.test.ts`.
- **ADVERSARIAL:** NEEDS-REVIEW REFUTED against disk (2026-08-24): glob resolves
  that test file at exactly the declared path; sibling pointer added post-audit;
  omission sweep clean; cleared to flip.
- **CHANGE DELTA:** Initial authorship (n/a).

### Missed Questions

1. Why did this surface only recently? → Sessions got longer (self-improving
   harness + big planning docs); auto-compact now fires mid-session routinely,
   so most post-compact spawns inherit summaries.
2. Does the graph-evidence injection help? → Only knowledge-graph facts
   (buildGraphInjectionMessage); it does not restore tool outputs.
3. Is Recorder affected? → No — includeMessageHistory:false since
   FID-2026-0823-011; it reads files itself. The bug class is the inheriting
   agents, exactly the ones forbidden from re-reading (Verifier: zero tools).

### Code Verification Evidence

Planning-phase record: implementation pending; every path claim above was read
from the working tree during Loop 1 RED (2026-08-24); the live Verifier specimen
is quoted from this session's transcript.

## Resolution

- **Closed Date:** 2026-08-25 — **Archived:** 2026-08-25
- **Disposition:** Resolved by compaction integrity rebuild suite `FID-2026-0824-022` and child `FID-2026-0824-026`; no duplicate implementation is required here.
- **Verification Evidence:** Child `-026` receipt `sha256:cde6df3d…`; suite-level Verifier and Adversary closure audit PASS. Carried live verifier raw-citation probe was explicitly waived by the operator in the suite closure record and is not claimed passed.

## Lessons Learned

Raw evidence consumers require an append-only evidence channel independent of compacted message history.