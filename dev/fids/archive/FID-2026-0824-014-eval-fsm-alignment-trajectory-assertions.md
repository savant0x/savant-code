# FID: Eval FSM Alignment + Trajectory Assertions (Increment 0)

**Filename:** `FID-2026-0824-014-eval-fsm-alignment-trajectory-assertions.md`
**ID:** FID-2026-0824-014
**Severity:** medium
**Status:** fixed
**Created:** 2026-08-24 17:15
**YAGNI-Compliance:** Pending

Parent: `FID-2026-0824-013` (inherits amendments A1–A8).

---

## Summary

The eval harness cannot represent the runtime's `adversarial` FSM phase, and its FSM
scoring has no per-agent separation-of-duties assertions. Every trace that traverses
the Adversarial phase (live since FID-2026-0805-004) scores against an incomplete
state graph, and tasks cannot assert Forge-no-bash / Verifier-no-write even though
EHEL enforces those exclusions at runtime. Increment 0 aligns the harness with the
runtime FSM and adds a `trajectory_assertions` array — the substrate increments 2–3
build on.

## Environment

- **OS:** Windows 11 primary dev host; POSIX-compatible by contract
- **Language/Runtime:** TypeScript strict monorepo, Bun 1.3.14 (pinned), zod v4
- **Tool Versions:** `@savant-code/evals` 0.0.27 (benchmark v2)
- **Commit/State:** main @ v0.0.27 prep (working tree, release-only-commits)

## Detailed Description

### Problem

`EchoPhase` in `evals/v2/src/runner.ts` is
`idle|red|green|audit|self_correct|complete|unknown` — no `adversarial`.
`VALID_TRANSITIONS` in `evals/v2/src/metrics-fsm.ts` likewise has seven keys with no
adversarial entry. The runtime FSM gained `adversarial` (audit→adversarial,
adversarial→complete/self_correct) via FID-2026-0805-004, so real traces carry
transitions the scorer classifies as invalid or unknown. Separately,
`fsmAssertionSchema` (`schema.ts`) offers only phase-order flags; the sole agent-aware
check is `sequentialthinking_violations`.

### Expected Behavior

Adversarial traversals score legally; a task can declare per-agent tool denials and
requirements (e.g. agent_type `forge` denies `run_terminal_command`; `verifier`
denies `write_file`/`str_replace`) evaluated from the trace's subagent map.

### Root Cause

Harness types predate the runtime roster change; scoring grew one special case
(sequentialthinking) instead of a general assertion channel.

### Evidence

```text
evals/v2/src/runner.ts        EchoPhase union — no 'adversarial' member
evals/v2/src/metrics-fsm.ts   VALID_TRANSITIONS — 7 keys, none adversarial
evals/v2/src/metrics-fsm.ts   checkToolPermission — agentType used ONLY for sequentialthinking
```

## Impact Assessment

### Affected Components

- `evals/v2/src/runner.ts` (EchoPhase), `trace.ts` (phase normalization)
- `evals/v2/src/metrics-fsm.ts` (transition map + permission checks)
- `evals/v2/src/schema.ts` (+ `schema/task.schema.json` mirror)

### Risk Level

- [ ] Critical / [ ] High / [x] Medium: mis-scores governed traces (false
      violations), blocks honest governance metrics; workaround exists (ignore FSM
      metrics) but defeats the purpose
- [ ] Low

## Proposed Solution

### Approach

Align types with the runtime FSM, then add one general assertion channel instead of a
second special case (Law 13).

### Steps

1. Extend `EchoPhase` with `'adversarial'`; extend `VALID_TRANSITIONS`
   (audit→adversarial; adversarial→complete/self_correct/idle) and trace
   normalization in `trace.ts`.
2. Add additive `trajectory_assertions` to `validation`: array of
   `{ agent_type, denied_tools[], required_tools[] }`; mirror in
   `schema/task.schema.json`.
3. Apply denials/requirements in `computeFsmMetrics` via the existing
   `agentTypeById` subagent map; emit violation counters.
4. Tests: adversarial traversal legality; forge-bash and verifier-write violations;
   required-tool absence; expected-sequence interplay; registry round-trip.
5. Baseline `harness:v2` green; typecheck evals exit 0.

### Verification

Gates below; plus Law-4 grep proving the new assertion key is consumed by the
metrics engine, not merely parsed.

## Verification Gates

- gate: typecheck evals
- gate: test evals/v2/tests/metrics.test.ts
- gate: test evals/v2/tests/metrics-fsm.test.ts

### Verification Receipt

- fingerprint: sha256:e981ef18585ae68c9fbe9046492173e9a633ecca71da7ea91bc04fc1f37013d3
- verified: 2026-08-25T05:23:49.421Z
- typecheck evals: exit 0
- test evals/v2/tests/metrics.test.ts: exit 0
- test evals/v2/tests/metrics-fsm.test.ts: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Grounding citations above (working-tree reads, 2026-08-24).
- **GREEN:** Solution specified above; no questions left blank.
- **AUDIT:** Batched suite Verifier (2026-08-24): PASS with notes — receipts-pending
  present; planned `metrics-fsm.test.ts` gate is a forward declaration to reconcile
  at GREEN before receipt stamping.
- **ADVERSARIAL:** CONFIRMED ×3 against disk (2026-08-24): `EchoPhase` in runner.ts
  is exactly idle|red|green|audit|self_correct|complete|unknown (no adversarial);
  VALID_TRANSITIONS has seven keys, none adversarial, and normalizePhase also rejects
  it; checkToolPermission consults agentType only in the sequentialthinking branch.
- **CHANGE DELTA:** Initial authorship (n/a).

### Loop 2 — GREEN (2026-08-25)

- Implementation landed per Proposed Solution steps 1–4: `runner.ts`
  EchoPhase += `'adversarial'`; VALID_TRANSITIONS gains audit→adversarial and
  adversarial→{complete, self_correct, idle}; `normalizePhase` accepts it;
  `trace.ts` VALID_PHASES widens so the collector records adversarial
  transition_phase calls. `schema.ts` adds additive
  `trajectoryAssertionSchema` (`{agent_type, denied_tools[], required_tools[]}`)
  wired into validation + mirrored in `schema/task.schema.json`
  (schema_version stays `"2.0"`). `metrics-fsm.ts` enforces denials per
  agent_type (role channel — orthogonal to phase) and required_tools at
  end-of-run via a toolsByAgentType map; new counters
  `denied_tool_violations` / `required_tool_missing` join the
  MetricAggregator pass gate in `metrics.ts`.
- NEW `tests/metrics-fsm.test.ts` (14 tests): adversarial legality incl.
  retreat-to-self_correct recovery + illegal-edge rejection; forge-no-terminal;
  verifier-no-write isolated from the phase write counter; required-tool
  missing/satisfied; expected-sequence interplay with adversarial; aggregate
  pass-gate wiring; zod round-trip incl. back-compat (channel omitted parses
  unchanged).
- Loop-1 audit note reconciled: the forward-declared `metrics-fsm.test.ts`
  gate now targets a real file — all three declared gates run live.
- **CHANGE DELTA:** five src files ~+90 lines, JSON mirror, new suite ~230 lines.

### Code Verification Evidence

Implemented 2026-08-25 (Loop 2). Fresh tool outputs at flip: `bun run
--cwd=evals typecheck` exit 0; `bun test evals/v2/tests/metrics-fsm.test.ts`
14 pass / 0 fail; metrics+trace+schema suites 29/0; harness baseline 5/0;
eslint --max-warnings 0 ×6 files; prettier clean ×7 files (incl. JSON mirror).
Law-4: `trajectory_assertions` is CONSUMED by computeFsmMetrics
(denial/requirement loops over toolsByAgentType) and feeds the metrics.ts pass
gate — not merely parsed.

## Resolution

- **Closed Date:** (pending) — **Archived:** (pending)

## Lessons Learned

(pending — captured at closure)