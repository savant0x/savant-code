# FID: Compaction Core Defects — Summary Drop-List Data Loss + Invisible Layers

**Filename:** `FID-2026-0824-021-compaction-summary-dataloss-invisible-layers.md`
**ID:** FID-2026-0824-021
**Severity:** high
**Status:** closed
**Created:** 2026-08-24 18:01
**YAGNI-Compliance:** Pending

Sibling: `FID-2026-0824-020` (subagents inherit compacted history — downstream
consequence of D1/D2 here). Operator directive 2026-08-24: dig into the WHOLE
compact system; compare against `resources/hermes-agent` +
`resources/openclaw`; report what summaries actually produce.

---

## Summary

Three coupled defects in the compaction core, beyond the -020 inheritance bug:

- **D1 — The auto-compact "summary" is a deterministic digest that drops the
  data class a coding agent needs most.** `summarizeMessages`
  (agents/context-pruner/summarize-messages.ts) preserves only: user text
  (truncated), assistant prose as "Progress note:" (think-stripped,
  truncated), tool ERRORS (100 chars), non-zero exit codes, ask_user answers,
  write/str_replace results (2000 chars), and filtered spawn_agents results.
  **read_files contents, code_search/web/glob/deep_research results are dropped
  entirely** — they survive only if the assistant paraphrased them into visible
  prose. There is no preservation contract (hermes demands "relevant data,
  file names, values, or outputs" in its summary prompt; we have none).
- **D2 — Micro-compact is invisible to the operator.** Its module logs
  debug-only; `prepareStepContext` sets `compactionStatus.phase='compacted'`,
  but `CompactionSignal` (cli/src/components/compaction-signal.tsx) renders
  only compacting/blocked/warning + last compactionEvent (pruned/ineffective).
  Micro-compact never appends a compactionEvent → pure micro-compact passes
  render `null`. Zero user-visible trace of destroyed tool results.
- **D3 — Nobody ever sees WHAT was compacted.** The inline pruner's stream is
  suppressed (`spawn-agent-inline.ts`: `if (agentType !== 'context-pruner')
  writeToClient(chunk)`); the digest replaces history wholesale
  (`parentAgentState.messageHistory = result.agentState.messageHistory`); no
  record of removed regions or dropped payloads is surfaced to the user, the
  transcript, or any audit channel — only "✓ Compaction complete (−N tokens)"
  after the fact.

## Environment

- **OS:** Windows 11 primary dev host
- **Language/Runtime:** TypeScript strict monorepo, Bun 1.3.14 (pinned)
- **Tool Versions:** packages/agent-runtime @ working tree (v0.0.27 prep)
- **Commit/State:** main (working tree, release-only-commits)

## Detailed Description

### Problem

Compaction optimizes token economics with no fidelity floor. After Layer 3
fires, the session's knowledge of "what did the reads say?" collapses to
assistant paraphrase. After Layer 2 fires, individual results become
`'[compacted]'`. Neither event is reliably visible to the operator (D2) nor
itemized anywhere (D3), so the loss is undetectable until an agent contradicts
earlier findings — exactly the persistent symptom reported.

### Expected Behavior

hermes trajectory_compressor.py (read 0-EOF, resources/) disciplines we lack:
protected head turns (system/first-human/first-gpt/first-tool) + last-N tail;
compress ONLY as much as needed (accumulate-until-target, keep remainder
verbatim); `_snap_boundary` never splits a tool_call/tool_response pair;
summary prompt CONTRACT requiring actions/results/decisions/data/values;
system-message notice that responses were summarized; per-compression metrics
persisted to disk; honest failure-marker fallback.

### Root Cause

The v0.0.x port adopted openclaw/openclaude layer mechanics (thresholds,
sentinels) but skipped the reference designs' preservation guarantees: no
protect-list, no minimal-surgery budgeting, no summary-content contract, no
removed-content ledger, and a UI that renders pruner lifecycle but not
micro-compact outcomes.

### Evidence

```text
agents/context-pruner/summarize-messages.ts       role-tagged digest; read/search/web results unmatched by any branch -> dropped
cli/src/components/compaction-signal.tsx          phase branches: compacting|blocked|warning; else last compactionEvents entry; no 'compacted' handling
packages/agent-runtime/src/tools/handlers/tool/spawn-agent-inline.ts
  onResponseChunk suppressed for context-pruner; messageHistory replaced wholesale
packages/agent-runtime/src/run-agent-step/context-tokens.ts
  micro-compact sets phase:'compacted'; logger.info line only; no compactionEvent append
resources/hermes-agent/trajectory_compressor.py   _find_protected_indices / _snap_boundary / summary-prompt contract / metrics persistence
LIVE: operator reports zero visibility of compaction firing across sessions.
```

## Impact Assessment

### Affected Components

- `agents/context-pruner/*` (summarize-messages, summary-assembly, main)
- `packages/agent-runtime/src/context-compactor/*`, `run-agent-step/context-tokens.ts`
- `packages/agent-runtime/src/tools/handlers/tool/spawn-agent-inline.ts`
- `cli/src/components/compaction-signal.tsx` + chat-store compaction wiring

### Risk Level

- [x] High: systematic, silent destruction of read/search evidence in a coding
      agent; compounds -020 into corrupted multi-agent reasoning; operator
      cannot detect when it happened (no ledger, no signal)
- [ ] Critical: (arguable — upgrade at GREEN if spill-less digest confirmed as
      sole post-compact knowledge source in practice)

## Proposed Solution

### Approach

Adopt the hermes preservation disciplines onto our online pruner; make every
layer observable. Direction only — converge at GREEN.

### Steps

1. Preservation contract: extend the digest to retain per-tool result DIGESTS
   for read-class tools (path + shape/key list + size, or head/tail slices),
   plus hermes-style protected head/tail and minimal-surgery budgeting
   (compress until under trigger, not whole history).
2. Removed-content ledger: append removed-region inventory (toolCallId, tool,
   sizes, digest-ref) to `.savant/evidence/<runId>.jsonl` (shared with -020
   spill) — the audit channel for "what was dropped."
3. Visibility: CompactionSignal renders micro-compact ('compacted') phases and
   appends compactionEvents; pruner completion surfaces removed-region counts +
   ledger pointer; optional `/compact --show` to print the last digest.
4. Model-facing notice injected post-replacement (hermes summary_notice_text
   analog) so agents know earlier tool responses are digested.
5. Tests: digest preservation fixtures per tool class; boundary/pair safety;
   signal rendering for all phases; ledger round-trip.

### Verification

Gates below; receipt stamped at fixed-flip per FID-2026-0823-009.

## Verification Gates

```markdown
- gate: typecheck packages/agent-runtime
- gate: typecheck cli
- gate: test packages/agent-runtime/src/__tests__/context-compactor.test.ts
- gate: test cli/src/components/__tests__/compaction-signal.test.tsx
```

(Receipt stamped via `bun run fid:verify <fid> --write` at status flip.)

## Perfection Loop

### Loop 1 — RED

- **RED:** Five working-tree files read 0-EOF + hermes compressor read 0-EOF;
  citations above (2026-08-24). openclaw src/context-engine surfaced as
  registry/host-compat plumbing — deeper comparison queued (honest boundary),
  its autoCompact/microCompact mechanics were already adopted per FID-085.
- **GREEN:** CONVERGED 2026-08-24 — implementation decomposed onto rebuild
  suite master `FID-2026-0824-022`: D1 → `-024` preservation contract
  (`ResultDigest` zod schema `{toolName, toolCallId, kind, identity, byteSize,
  sha256, head?, tail?}`; per-class recipes; unknown tools get identity-only
  fallback digest — never silence); D2 → `-023` renders 'compacted' phase +
  appends a compactionEvent per micro pass (hysteresis keeps steady state
  quiet); D3 → `-023` routes pruner stream into the collapsible
  TrafficLightPanel lifecycle + expandable summary viewer; hermes disciplines
  (protected head/tail, accumulate-until-target, pair-boundary snapping) →
  `-025`; removed-region ledger + metrics + model notice → `-027` sharing the
  `-026` spill channel (one writer, two record kinds). Steps below are the
  accepted plan; file-level decomposition lives in each child.
- **AUDIT:** Batched suite Verifier (2026-08-24): PASS — GREEN decomposition
  onto the `-022` suite verified; Missed Questions present.
- **ADVERSARIAL:** Clean (2026-08-24): disk sweep clean (statuses / attribution /
  gate shapes / config disjointness); cleared to flip.
- **CHANGE DELTA:** Initial authorship (n/a).

### Missed Questions

1. Why did the digest drop reads silently? → Built as cost hygiene before the
   self-improving harness existed; no consumer contract existed. Now zero-tool
   agents (Verifier) depend on exactly the dropped classes — the flaw became
   load-bearing when governance started consuming inherited history.
2. Is the 'compacted' phase reachable with an empty compactionEvents array?
   → Yes — the micro pass sets compactionStatus but never appends an event;
   that is precisely D2's rendering hole (status unhandled AND no fallback
   entry exists).
3. Does un-suppressing pruner output flood the transcript? → No — `-023`
   routes it into the collapsible TrafficLightPanel lifecycle (in-flight glow,
   collapsed terminal line, expander for detail), matching
   TerminalCommandDisplay precedent rather than raw chat streaming.

### Code Verification Evidence

Planning-phase record: implementation pending; all path claims read from the
working tree during Loop 1 RED (2026-08-24).

## Resolution

- **Closed Date:** 2026-08-25 — **Archived:** 2026-08-25
- **Disposition:** Resolved by compaction integrity rebuild suite `FID-2026-0824-022` and children `FID-2026-023` through `FID-2026-027`; no duplicate implementation is required here.
- **Verification Evidence:** Suite-level typechecks, focused tests, Verifier and Adversary closure audit PASS. Carried TUI phase-rendering, `/compact`, and verifier raw-citation live smokes were explicitly waived by the operator in the suite closure record and are not claimed passed.

## Lessons Learned

Compaction must preserve and expose an auditable record of removed content rather than relying on prose summaries alone.