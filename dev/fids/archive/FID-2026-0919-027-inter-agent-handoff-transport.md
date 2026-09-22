# FID: Inter-agent handoff transport — everything agent B needs from agent A now crosses the boundary

**Filename:** `FID-2026-0919-027-inter-agent-handoff-transport.md`
**ID:** FID-2026-0919-027
**Severity:** critical
**Status:** closed
**Created:** 2026-09-19 23:10
**Automation level:** 3
**YAGNI-Compliance:** Confirmed (no new capability or dependency: every fix
threads a value that already exists on the root state, reuses an authority the
codebase already had — `createAgentState`, `loadEvidenceRecords`,
`applyVerdictReceipts` — or refuses a call that could only be a no-op. The one
new module pair exists because three touched files stood at 297–309 lines
against the 300-line ceiling)

---

## Summary

The operator asked for a whole-system review of information flow between agents:
*"anything that agent B needs from agent A, but it doesnt properly transport…
We need to ensure all the info/packages flow flawlessly through the entire
system."*

The spawn boundary is where that flow is decided, and it had a systematic hole:
`createAgentState` copied **identity, ancestry, protocol variant, FSM phase,
`echoCompliance` and `provenance`** into every child — and dropped the run's
resolved **governance configuration** (`enforcementMode`, `designContract`,
`protocolSource`, `provenanceMode`). Those four are read back from `agentState`
at the point of use, so every subagent ran under **defaults instead of the
contract its parent resolved**: a strict EHEL run silently relaxed to the hybrid
tier in every child (`all_15` → `core_4`, 11 of 15 Laws ungated), the design
write gate saw no contract on the writes that Forge — always a child — performs,
embedded installs re-resolved the protocol as `local`, and a child could open a
second ZTAP session in `record` when the operator had set `off`.

Three further transport defects sat in the same boundary: raw evidence was
skipped on two of three audit-spawn paths, the context-pruner was batch-spawnable
as an expensive no-op, and the inline relay dropped a `structured_output`
child's artifact while the batch path relayed it.

All seven defects are fixed, contract-enforced, and pinned. A live probe
(`scripts/handoff-transport-check.ts`) now reports the boundary on demand, and
its negative leg was proven by reverting the fix (exit 1, naming the four
fields).

## Environment

- **OS:** Windows (win32), bash shell
- **Language/Runtime:** TypeScript (strict), Bun 1.3.14
- **Tool Versions:** eslint (0 warnings), markdownlint, prettier
- **Commit/State:** `main`; the 0.0.33 working tree; nothing committed (G2 withheld)

## Detailed Description

### Problem

A child agent state is built by `createAgentState` from the spawning parent. Any
field not copied there is absent for the child's entire run, and several of those
fields are read from `agentState` inside the child's own tool path:

| Field | Read by | Effect when absent on a child |
|---|---|---|
| `enforcementMode` | `echo/enforcement/factory.ts:46` → `getTier` | strict collapses to hybrid in every child |
| `designContract` | same factory (`:51`) → design write gate | child writes are never design-gated |
| `protocolSource` | `echo/grounding.ts:65` | embedded protocol re-resolves as `local` |
| `provenanceMode` | `provenance/registry.ts:19` | child defaults to `record`; a divergent session is possible |

Three secondary defects share the boundary:

- **Raw evidence (FID-2026-0824-026) was transported on one path of three.**
  The batch path required a ROOT parent (`!parentAgentState.parentId`), so a
  nested spawn restored nothing; the inline path never loaded records at all, so
  an inline-spawned Verifier/Adversary audited compaction sentinels.
- **The context-pruner was batch-spawnable.** It is in the Orchestrator's
  `spawnableAgents` (it must be — the inline path validates through the same
  allowlist), so `spawn_agents` accepted `agent_type: context-pruner`, and the
  batch path performs none of the wiring that makes a prune land. The child
  pruned its own discarded copy; the parent's compaction status never advanced.
  The call succeeded, billed its run, and changed nothing.
- **The inline relay was a constant.** `spawn_agent_inline` returned
  `{ message: 'Agent spawned.' }` regardless of the child's output, while
  `spawn_agents` relayed `safeToJSONValue(output)` — the same child informed its
  parent on one path and not the other.

### Expected Behavior

A spawned child is part of the SAME run, not a detached agent with some fields
copied onto it. Every run-level value the child reads back must cross the
boundary, and the boundary must **verify** what it transported rather than assume
it. A call that cannot have an effect must fail loudly instead of succeeding
silently.

### Root Cause

Per-field threading by accretion. `echoCompliance` (FID-2026-0804-009) and
`provenance` (FID-2026-0813-004) were each added to `createAgentState` when their
features landed; the governance configuration added later by
FID-2026-0804-009 / FID-2026-0810-002 / FID-2026-0813-004 was never added, and
nothing in the contract checked for it — the propagation snapshot carried the
fields someone remembered to list.

### Evidence

**RED — live probe over a fully-configured root state, before the fix:**

```text
== parent -> child field transport ==
MISSING       enforcementMode        parent=strict child=undefined
MISSING       designContract         parent=<Object> child=undefined
MISSING       protocolSource         parent=embedded child=undefined
MISSING       provenanceMode         parent=off child=undefined
MISSING       maxContextLength       parent=400000 child=undefined
MISSING       digestCaps             parent=<Object> child=undefined
ok            echoCompliance         parent=<EchoComplianceTracker> child=<EchoComplianceTracker>
ok            provenance             parent=<ProvenanceSession> child=<ProvenanceSession>

== resolved consequence at each reader ==
enforcement tier   parent=all_15 child=core_4
provenance mode    parent=off child=record
grounding identity parent=f6915b9e7da7 child=c56d305b24a6 DIVERGED
```

`maxContextLength`/`digestCaps` are **not** defects: `createLoopContext`
re-stamps both for every run (`loop-context.ts:252`, `:261`), so the child gets
its own before any read. The other four are read from `agentState` with no
re-stamp, and are the finding. `createAgentState` is the only child-state
constructor in the runtime (`grep -rn "parentId:\s*[a-zA-Z]"` → one hit), so the
hole was total, not per-caller.

**GREEN — same probe after the fix:**

```text
ok  enforcementMode  strict -> strict
ok  designContract   <Object> -> <Object>
ok  protocolSource   embedded -> embedded
ok  provenanceMode   off -> off
== consequence at each reader ==
EHEL tier          all_15 -> all_15
ZTAP mode          off -> off
grounding identity f6915b9e7da7 -> f6915b9e7da7

handoff-transport: PASS — every governance field crosses the boundary
```

**Negative leg — the probe is not vacuous.** With the inheritance spread removed
from `spawn-child-state.ts` (source restored immediately after):

```text
EHEL tier          all_15 -> core_4
ZTAP mode          off -> record
grounding identity f6915b9e7da7 -> c56d305b24a6

handoff-transport: FAIL — enforcementMode, designContract, protocolSource,
provenanceMode did not cross the boundary
probe exit=1
```

**Reachability of the two "not today" paths** (stated so the fix is not
overclaimed):

- The inline path is a `PROGRAMMATIC_PRIMITIVE` (common/tools/constants.ts) —
  only a `handleSteps` generator may call it. The shipped generator passes
  `agent_type: 'context-pruner'` at all five call sites, and the pruner does not
  set `requiresRawEvidence`, so the inline evidence loader is a no-op for the
  harness as shipped. It is live for any other inline child — a user-authored
  `handleSteps` agent, or a future generator — which is exactly the class that
  had no coverage.
- The nested case needs a child that can spawn (`spawn_agents` is on the
  Orchestrator and base-chat only) at depth ≤ `MAX_SUBAGENT_DEPTH` (8). Same
  shape: reachable by authoring, not by the shipped roster. Both were fixed
  because a boundary that is correct only for today's callers is the defect this
  FID is about.

## Impact Assessment

### Affected Components

- **New authority:** `packages/agent-runtime/src/tools/handlers/tool/spawn-child-state.ts`
  (`createAgentState` moved verbatim + `inheritRunGovernance` /
  `RunGovernance`), `packages/agent-runtime/src/evidence/spawn-evidence.ts`
  (`loadRawEvidenceForSpawn`),
  `packages/agent-runtime/src/tools/handlers/tool/spawn-inline-only.ts`
  (`INLINE_ONLY_AGENT_TYPES`, `batchSpawnRejectionMessage`,
  `buildInlineSpawnRelay`).
- **Contract:** `execute-subagent.ts` — `SubagentPropagationSnapshot` extended
  with the four governance fields and **both** validations now compare them.
- **Sites:** `spawn-agent-utils.ts` (snapshot build; `createAgentState`
  re-exported), `spawn-agents-child-run.ts` (evidence loader, inline-only
  rejection, verdict binding via the shared authority),
  `spawn-agent-inline.ts` (evidence loader, real relay),
  `spawn-agents.ts` + `tool-executor/spawn-validation.ts` (batch rejection).
- **Probe:** `scripts/handoff-transport-check.ts` (repo-visible, declarable
  gate). Audit run + RED/GREEN transcript: `dev/scratchpad/active/handoff-transport-audit.ts`.

### Risk Level

- [x] Critical: a strict-governance run was silently hybrid in every subagent,
      and the design gate could not fire on the roster's only writer.
- [ ] High
- [ ] Medium
- [ ] Low

## Proposed Solution

### Approach

Thread the run configuration once, at the single construction point, and make the
boundary prove it: extend the propagation snapshot so a child missing any
governance field is rejected before its loop starts. Transport the spill the same
way on both spawn sites (union over the run chain, which is what the per-run
keying actually requires). Replace "succeeds silently" with "fails with the
reason" for a spawn the harness owns.

### Steps

1. `spawn-child-state.ts` — `createAgentState` moved verbatim (kept
   `spawn-agent-utils.ts` under the ceiling) and returns
   `...inheritRunGovernance(parentAgentState)`. `groundingCheckpoint` is
   deliberately excluded, with the reason in the doc comment.
2. `spawn-agent-utils.ts` — snapshot carries `...inheritRunGovernance(...)`;
   `createAgentState` re-exported so both spawn sites keep one import surface.
3. `execute-subagent.ts` — snapshot type + both validations compare the four
   fields (`enforcementMode`, `protocolSource`, `provenanceMode`,
   `designContract`).
4. `evidence/spawn-evidence.ts` — `loadRawEvidenceForSpawn` returns `undefined`
   immediately for a non-audit agent (no IO), else unions
   `[...ancestorRunIds, runId]` with the spawning run winning on duplicate
   `toolCallId`.
5. `spawn-agents-child-run.ts` / `spawn-agent-inline.ts` — both call the loader;
   the depth guard is gone from the batch path.
6. `spawn-inline-only.ts` + `spawn-validation.ts` + `spawn-agents.ts` — reject
   inline-only agents with a mechanism-naming reason; keep the constant relay for
   harness-owned inline agents, relay `structured_output` otherwise.
7. `spawn-agents-child-run.ts` — verdict binding routed through
   `applyVerdictReceipts`, the authority the inline path already used.

### Accepted Risk

- `designContract` is compared by reference. It is copied by reference and is
  read-only during a run, so identity is the correct predicate; a caller that
  clones a contract per spawn would now be rejected by the contract.
- Both new rejections are user-visible errors. A caller that legitimately wanted
  a batch-spawned pruner is out of options — by design, since that path could
  not compact anything.

## Verification

- New pins: `spawn-handoff-transport.test.ts` (11) — governance inheritance,
  legacy-host parity, snapshot mismatch rejected, child mismatch rejected,
  inline-only rejection at the handler, non-audit agent still accepted, three
  relay cases; `spawn-evidence.test.ts` (4) — audit-only (no IO), union across
  the run chain, own run wins, empty chain; `subagent-propagation-contract.test.ts`
  +2 assertions in the contract test.
- Live RED → GREEN, and the negative leg, exactly as recorded under Evidence.
- `agent-runtime` package run: **1462 pass, 0 fail**.
- Full chain: `bun run test` **exit 0, 0 fail (7545 pass)**.

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: test packages/agent-runtime/src/__tests__/spawn-handoff-transport.test.ts
- gate: test packages/agent-runtime/src/evidence/__tests__/spawn-evidence.test.ts
- gate: test packages/agent-runtime/src/__tests__/subagent-propagation-contract.test.ts
- gate: probe scripts/handoff-transport-check.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:c705a8552e50ddb52f74b3c1529935a5b8f5cdc87d664af7b4f85361b0269636
- verified: 2026-09-19T21:10:35.171Z
- typecheck packages/agent-runtime: exit 0
- test packages/agent-runtime/src/__tests__/spawn-handoff-transport.test.ts: exit 0
- test packages/agent-runtime/src/evidence/__tests__/spawn-evidence.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/subagent-propagation-contract.test.ts: exit 0
- probe scripts/handoff-transport-check.ts: exit 0
- quality: exit 0

## Perfection Loop

### Iteration 1 — RED

Live probe over a fully-configured root state, `createAgentState` inspected as the
only child-state constructor: six fields absent, four of them read back by the
child's own path, with the consequence lines (`all_15 → core_4`, `off → record`,
diverged grounding identity). Adjacent boundary defects confirmed by reading the
three spawn call sites against each other.

### Iteration 2 — GREEN

`inheritRunGovernance` at the construction point, the contract extended to prove
it, the evidence loader shared by both sites, the inline-only rejection added at
both seams, the relay made conditional, the verdict block collapsed into the
authority the inline path already used. Probe GREEN; 1462/0 on the package.

### Iteration 3 — AUDIT / self-correction

- **Caught by the gates:** the first GREEN left `spawn-agents-child-run.ts` at
  309 lines (ceiling 300) and produced 5 `import/order` warnings. Fixed by
  routing the verdict binding through `applyVerdictReceipts` — a real
  unification, not a line-count trick — and by reordering imports.
- **Caught by the boundary itself:** a first attempt to type the inherited
  governance as a `Pick<...>` left the keys optional and failed the snapshot
  type; the explicit `RunGovernance` record (required keys, `undefined` values)
  satisfies both `AgentState` and the snapshot without a cast.
- **Scope discipline:** the probe's verdict line originally counted
  `maxContextLength`/`digestCaps` as missing. Reading `createLoopContext` proved
  they are re-stamped per run, so the probe now lists them as designed absences
  with the reason — a false finding removed rather than shipped.

### Missed Questions

1. **`AgentState.subagents` is never populated.** The field is declared
   (`subagents: AgentState[]`), initialized to `[]` by `createAgentState`, and
   validated by the SDK serializer, but no runtime code ever appends to it —
   `childRunIds` is the live transport (`execute-subagent.ts` pushes the child's
   `runId`). Left unchanged: populating it would serialize full child states into
   the parent, and nothing reads it. Recorded as a follow-up candidate rather
   than a silent edit.
2. **`SubagentStop` carries no outcome.** The hook payload builder supports
   `toolResult`/`errorMessage`, but the subagent lifecycle fires with type and
   session only, so an operator hook cannot distinguish a child that finished
   from one that failed. It is a governance/observability boundary rather than an
   agent→agent one, and changing an operator-facing payload contract deserves its
   own decision; recorded, not changed.
3. **Nothing checks that a new `AgentState` field is transported.** This FID
   fixes the fields that exist and makes the four governance fields
   contract-enforced, but the next added field has the same failure mode: a
   `Pick`/required-fields list derived from `AgentState` would make the omission
   a type error instead of a review finding.

### Code Verification Evidence

- [x] **Files referenced in Affected Components exist.**
      `packages/agent-runtime/src/tools/handlers/tool/spawn-child-state.ts`,
      `packages/agent-runtime/src/evidence/spawn-evidence.ts`,
      `packages/agent-runtime/src/tools/handlers/tool/spawn-inline-only.ts`,
      `scripts/handoff-transport-check.ts` (all new this session).
- [x] **Implementation matches the Proposed Solution.** Steps 1–7 are all in the
      tree: `grep -n "inheritRunGovernance" spawn-child-state.ts` → the
      definition plus the return spread; `execute-subagent.ts` compares
      `enforcementMode`/`protocolSource`/`provenanceMode`/`designContract` in
      **both** validations; `grep -rn "loadRawEvidenceForSpawn"` → the loader in
      `evidence/spawn-evidence.ts` and both spawn sites;
      `grep -rn "batchSpawnRejectionMessage"` → the definition,
      `spawn-validation.ts`, `spawn-agents.ts`, `spawn-agents-child-run.ts`.
- [x] **Typecheck/tests/lint pass with pasted tool output.** Receipt below;
      pasted in full under Evidence and in the session summary
      (`typecheck` 12/12 exit 0, `bun run test` exit 0 with 7545 pass / 0 fail,
      eslint 0 warnings, lint:md exit 0, `quality: PASS (1498 baselined files)`).
- [x] **Production call-graph evidence is present for new or repaired wiring.**
      `createAgentState` → `spawn-child-state.ts:88`, with the inherited spread
      at `:180`; both call sites
      (`spawn-agents-child-run.ts`, `spawn-agent-inline.ts`) and the snapshot
      build in `spawn-agent-utils.ts` reference `inheritRunGovernance`; the
      probe executes that same call graph and reports it green, and the negative
      leg (spread removed) reports the four fields by name. `AgentState` has one
      child-state constructor in the runtime —
      `grep -rn "parentId:\s*[a-zA-Z]" packages/agent-runtime/src` →
      `spawn-child-state.ts:169` only.
- [x] **FID status reflects the actual implementation state.** `verified`: all
      seven work items implemented, 27 pins green, receipt 6/6 LIVE below. The
      fingerprint is stamped in the receipt section rather than restated here —
      a record that quotes its own digest invalidates itself on every re-stamp
      (the closure-churn class of FID-2026-0919-024).

## Resolution

- **Closed Date:** 2026-09-19 21:09 UTC (closed with the commit SHA pending
  operator git execution, G2 withheld; file:line + grep evidence recorded
  instead, per the FID Lifecycle rule for `closed`)
- **Fix Description:** the spawn boundary now transports the run's governance
  configuration (`inheritRunGovernance` at the single child-state constructor)
  and proves it (the propagation snapshot carries the four fields; both
  `executeSubagent` validations compare them); raw evidence is loaded for audit
  agents on both spawn sites by one loader that unions the run chain;
  harness-owned inline agents are refused by `spawn_agents` at both seams; the
  inline relay carries a child's structured output; and both spawn sites bind
  ZTAP verdicts through the single `applyVerdictReceipts` authority.
  Implementation is guarded twice over: the boundary verifies what it
  transported (`SubagentPropagationSnapshot` + both `executeSubagent`
  validations), and FID-2026-0919-028 makes the *set* of transported fields a
  compile-time object so a future `AgentState` field cannot be silently dropped
  the way these four were.
- **Tests Added:** Yes — 27 new pins across
  `packages/agent-runtime/src/__tests__/spawn-handoff-transport.test.ts` (11),
  `packages/agent-runtime/src/evidence/__tests__/spawn-evidence.test.ts` (4), and
  two extended assertions in
  `packages/agent-runtime/src/__tests__/subagent-propagation-contract.test.ts`.
  (Paths are repo-relative — the verification-contract check matches a promised
  artifact against a declared gate by path, FID-2026-0918-006.)
- **Verification Evidence:** receipt below (six gates, live) plus the RED →
  GREEN → negative-leg transcript under Evidence, produced by
  `bun run scripts/handoff-transport-check.ts`. RED: 6 fields missing,
  `all_15 → core_4`, `off → record`, grounding identity DIVERGED. GREEN: 0
  missing, `all_15 → all_15`, `off → off`, identity MATCH. Negative leg:
  inheritance spread removed → probe exit 1 naming the four fields. Chain:
  `typecheck` 12/12 exit 0; `bun run test` exit 0 / 0 fail (7545 pass at the
  time of this record's own work); `agent-runtime` 1462/0; eslint 0; `lint:md`
  exit 0; `prettier --check .` PASS; `quality: PASS (1498 baselined files)`.
- **Archived:** 2026-09-19 21:09 UTC — moved to `dev/fids/archive/`; receipt
  re-stamped live at the archived path (6/6 gates)
