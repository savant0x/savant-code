# FID: Evidence Spill & Subagent Raw-Evidence Splice (Increment 4)

**Filename:** `FID-2026-0824-026-evidence-spill-subagent-raw-splice.md`
**ID:** FID-2026-0824-026
**Severity:** high
**Status:** closed
**Created:** 2026-08-24 18:18
**YAGNI-Compliance:** Pending

Parent: `FID-2026-0824-022` (amendment P3 binding here). Resolves
`FID-2026-0824-020` (subagents inherit compacted history).

---

## Summary

Subagents spawned with `includeMessageHistory: true` receive whatever state the
parent's array is in at spawn time — post-micro-compact sentinels, post-pruner
digest, or post-reactive truncation. Zero-tool evidence consumers (Verifier,
Adversary) therefore audit against summaries. This child adds an append-only,
disk-backed evidence spill written at the tool-result boundary and splices raw
records back into child history for templates flagged `requiresRawEvidence`,
so AUDIT-phase agents verify against bytes, not paraphrase.

## Environment

- **OS:** Windows 11 primary dev host; POSIX-compatible by contract
- **Language/Runtime:** TypeScript strict monorepo, Bun 1.3.14 (pinned), zod v4
- **Tool Versions:** packages/agent-runtime spawn path @ working tree (v0.0.27 prep)
- **Commit/State:** main (working tree, release-only-commits)

## Detailed Description

### Problem

`createAgentState` seeds children via
`filterUnfinishedToolCalls(parentAgentState.messageHistory)` — a copy of the
already-compacted parent array. No pre-compaction snapshot exists anywhere.
The Verifier in this session's suite audit twice reported payloads "compacted
out of visible history" and had to defer citations to NEEDS-REVIEW.

### Expected Behavior

Raw tool results persist outside the compactable array; agents whose role
demands evidence (`requiresRawEvidence`) receive relevant raw records spliced
into their history at spawn; every other agent's token economics are unchanged.

### Root Cause

Compaction mutates the ONLY channel a spawned agent receives; no second channel
was ever built.

### Evidence

```text
packages/agent-runtime/src/tools/handlers/tool/spawn-agent-utils.ts   createAgentState inheritance point
agents/verifier/verifier.ts:27 · agents/adversary/adversary.ts:38     includeMessageHistory: true, zero tools
LIVE: session transcript — Verifier NEEDS-REVIEW deferrals citing compacted payloads (2026-08-24)
```

## Impact Assessment

### Affected Components

- New `packages/agent-runtime/src/evidence/spill.ts` (writer) + `splice.ts`
- `spawn-agent-utils.ts` (`createAgentState`), agent templates
  (`requiresRawEvidence?: boolean` on AgentDefinition)
- `.savant/evidence/<runId>.jsonl` (gitignored; shared with `-027`)

### Risk Level

- [ ] Critical / [ ] High / [x] High: silently degrades the double-audit
      guarantee today; splice restores evidence fidelity for governance roles
- [ ] Medium / [ ] Low

## Proposed Solution

### Approach

Append-only spill keyed by toolCallId; splice selects records referenced by the
child's inherited history (matching toolCallIds that were sentinel-compacted)
and re-inserts raw content as attachment messages before the spawn marker.
Deterministic selection; no LLM.

### Steps

1. Spill writer at the tool-result boundary: `{ts, runId, agentId, toolCallId,
   toolName, byteSize, sha256, raw}` with per-record + total caps
   (`compression.evidenceSpill:` config, additive); write-behind queue so the
   hot path never blocks on disk.
2. `requiresRawEvidence` flag on AgentDefinition (default false;
   verifier/adversary set true).
3. Splice in `createAgentState`: after `filterUnfinishedToolCalls`, replace
   `[compacted]` sentinels from the spill by toolCallId; append an inventory
   note listing restored record ids.
4. Off-switch semantics: disabled spill ⇒ behavior identical to today (never
   worse).
5. Tests: compact-then-spawn fixture proving Verifier sees raw bytes; cap
   enforcement; off-switch parity; crash-safety (partial line ignored on read).

### Verification

Gates below plus one live end-to-end probe recorded at GREEN (spawn a verifier
after forced compaction; assert raw citation possible).

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: test packages/agent-runtime/src/evidence/__tests__/evidence-splice.test.ts

### Verification Receipt

- fingerprint: sha256:62e9c170b949db1d16a32fb69f4365d7939979502350675a9fa67b504917f243
- verified: 2026-08-25T01:26:55.046Z
- typecheck packages/agent-runtime: exit 0
- test packages/agent-runtime/src/evidence/__tests__/evidence-splice.test.ts: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Citations above plus -020's full chain (working-tree reads +
  live specimen, 2026-08-24).
- **GREEN:** Schema, caps, flag defaults specified; selection algorithm is
  pure toolCallId matching (no heuristics).
- **AUDIT:** Batched suite Verifier (2026-08-24): PASS — P3 splice mechanics
  pure toolCallId matching; off-switch parity guaranteed; resolves the `-020`
  chain cleanly; spill caps additive under `compression.evidenceSpill:`.
- **ADVERSARIAL:** Clean (2026-08-24): disk sweep clean; cleared to flip with
  suite.
- **CHANGE DELTA:** Initial authorship (n/a).

### Code Verification Evidence

FULLY LANDED + WIRED 2026-08-24 (green, inline verification):

- NEW `packages/agent-runtime/src/evidence/spill.ts` — fail-open JSONL writer
  (sha256, per-record + per-file caps, mkdir -p, crash-safe parser,
  loadEvidenceRecords loader)
- NEW `packages/agent-runtime/src/evidence/splice.ts` — pure sentinel→raw
  splice + bounded inventory-note builder
- `common/src/types/agent-template.ts` + template AgentDefinition +
  DynamicAgentDefinitionSchema — additive `requiresRawEvidence?: boolean`
- `agents/verifier/verifier.ts`, `agents/adversary/adversary.ts` — flag set true
- `spawn-agent-utils.ts` createAgentState — optional records param; splice +
  EVIDENCE_RESTORED note BEFORE knowledge-graph/spawn markers
- `spawn-agents.ts` — top-level audit spawns preload records via
  loadEvidenceRecords
- `native.ts` — fail-open recordEvidence capture at the tool-result boundary
Gates: common + agents + agent-runtime typechecks exit 0 · evidence suite
4 pass / 0 fail · eslint clean on touched modules · receipt stamped.
Carried boundary: live end-to-end probe (verifier spawn after forced
compaction; assert raw citation) recorded at closure per Verification section.

## Resolution

- **Closed Date:** 2026-08-24 21:20 — **Archived:** 2026-08-24 21:25
- **Fix Description:** Evidence spill + requiresRawEvidence splice FULLY WIRED — raw bytes restored to audit agents at spawn.
- **Tests Added:** Yes — evidence suite 4 pass / 0 fail.
- **Verification Evidence:** receipt sha256:cde6df3d… stamped `--check` green; batched Verifier+Adversary closure audit PASS.
- **Live Smokes:** verifier raw-citation probe WAIVED-BY-OPERATOR-DIRECTIVE 2026-08-24 — never claimed passed.

## Lessons Learned

(pending — captured at closure)