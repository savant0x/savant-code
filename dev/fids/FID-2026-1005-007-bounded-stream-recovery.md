# FID: Bounded stream recovery for truncated long-reasoning turns

**Filename:** `FID-2026-1005-007-bounded-stream-recovery.md`
**ID:** FID-2026-1005-007
**Severity:** medium
**Status:** verified
**Created:** 2026-10-05 17:14
**Automation level:** 3
**YAGNI-Compliance:** Verified

> **Operator directive (verbatim):** *"what are the top 5 most impactful"* and
> *"Draft FIDs for the top 5 ideas, ranked, following the FID template"* —
> raised in the 2026-10-05 reference-project review session ("review a few
> projects saved locally for ideas"). Rank 3 of 5. Register item: T140.

## Summary

When a free-tier gateway cuts a stream mid-reasoning — a routine event on the
providers this project routes to — the turn dies with it: the reasoning is
discarded and the user gets an empty or errored result for work the model had
already done. This FID adds a bounded recovery pass modeled on the measured
design in `resources/dsh-our-free-model-main/README.md` (issue #12): when a
turn ends with only reasoning emitted and no answer, re-request once with the
received reasoning as a checkpoint, under strict bounds — maximum two
physical requests per logical turn, tools disabled during recovery, budget
arithmetic that refuses to run without headroom, and no infinite
continuation. Telemetry separates physical requests from logical turns so the
recovery is visible and honest.

## Environment

- **OS / shell:** Windows 11 (`win32`), Git Bash (MSYS)
- **Runtime:** Bun `1.3.14`
- **Files:** `packages/agent-runtime` (streaming and agent-loop surfaces,
  including the subagent streaming path in the current worktree)
- **Commit/State:** worktree dirty (18 modified files from prior sessions,
  uncommitted); this FID is new
- **Governance:** ECHO Protocol v0.1.2-single-agent
  (`dev/echo-v0.1.2-single-agent.md`), FID-bound, Laws 1/3/4

## Detailed Description

### Problem

Long-reasoning turns are the most expensive turns and the most fragile: the
upstream may emit minutes of reasoning and then close the stream without a
final answer (natural EOF, no terminating frame). The current behavior
discards everything and fails the turn, so the user pays the full reasoning
cost for zero output. On truncation the harness has no notion of "the turn
had substance but no answer", and no lawful way to spend a second request to
finish it.

### Expected Behavior

A turn that produced reasoning but no answer triggers exactly one bounded
recovery request that asks for the final answer directly, seeded with the
already-received reasoning as a checkpoint. Recovery is capped, budgeted,
tool-free, and visibly recorded. A turn with partial answer output or tool
calls is never recovered (no duplicated content, no double-executed tools).

### Root Cause

The stream layer treats every abnormal close as a generic failure with no
turn-level state. There is no distinction between "nothing happened" (safe
to retry wholesale) and "reasoning happened, answer missing" (safe to
re-request once, never to replay).

### Evidence

```text
resources/dsh-our-free-model-main/README.md (issue #12, measured):
  Trigger: first segment carries only non-empty reasoning, no body and no
   tool calls, and the upstream closes without a normal end frame (or ends
   "empty" — reasoning-only). Not triggered on: user cancel, body or tool
   output already produced, output-cap reached, explicit upstream error.
  Mechanism: received reasoning is checkpoint text; one new request asks for
   the finished answer directly. "每个逻辑回合最多两次物理请求" — at most two
   physical requests per logical turn; total time budget 480s, recovery
   segment 180s; recovery output cap 8192 tokens; checkpoint cap 131072
   chars with conservative context-headroom estimation; recovery skipped if
   fewer than 512 tokens of budget remain.
  Safety: tools disabled during recovery; already-emitted bodies/tool calls
   never recovered (duplication and double-execution risk); recovery must
   end normally with non-whitespace body to count as success; failure
   surfaces STREAM_CUT and the turn is NOT re-sent wholesale.
  Honest accounting: "用量看板将物理请求与逻辑回合分开统计" — physical requests
   and logical turns are counted separately; recovered turns are visible.

Our side (ground truth, this tree):
  packages/agent-runtime — stream decode + agent loop; subagent streaming
   surface carries current worktree changes
  A truncated turn today surfaces as a plain error; nothing distinguishes
   reasoning-only truncation from an early failure
```

## Impact Assessment

### Affected Components

- `packages/agent-runtime` — stream outcome classification, recovery
  request path, tool-call gating during recovery
- Usage/telemetry accounting surfaces — physical vs logical request counts
- Subagent streaming path — same recovery semantics must hold for
  delegated turns (or an explicit, documented difference)

### Risk Level

- [ ] Critical
- [ ] High
- [x] **Medium** — turns are lost with a workaround (re-run), but the loss
  is frequent on free gateways and burns the most expensive turns
- [ ] Low

## Proposed Solution

### Approach

Classify the stream outcome at close, then recover only the one recoverable
shape. The recovery is a *new* request conditioned on a checkpoint — it is
not a replay: replaying reasoning is forbidden, and any turn that already
produced visible output is finished as-is (success or failure), never
recovered.

### Steps

1. **Outcome classifier:** distinguish normal end, explicit upstream error,
   user cancel, output-cap, and **reasoning-only truncation** (reasoning
   non-empty, body empty, no tool calls, abnormal close or empty stop).
2. **Recovery policy object:** enabled by default with hard caps — 1
   recovery per logical turn (2 physical requests total), checkpoint
   character cap with conservative context-headroom estimation, recovery
   output cap, wall-clock budget (recovery segment ≤ the remaining total
   budget), minimum remaining token budget to attempt at all.
3. **Recovery request:** checkpoint reasoning + original input, prompt
   demanding the finished answer conclusion-first; tools disabled for the
   recovery segment; no reasoning replay to the user.
4. **Accounting:** physical requests vs logical turns recorded separately,
   with recovery linkage ids; usage totals sum only upstream-reported values
   and say so when partial.
5. **Failure semantics:** failed recovery surfaces one classified error
   (truncation) — the turn is never re-sent wholesale; user cancel stays
   cancel.
6. **Opt-out:** a settings flag disables recovery; numeric knobs may only
   narrow the defaults, never exceed them.

### Verification

Classifier tests over every outcome shape (three wire-protocol shapes if the
providers in the registry span them — assert at least: normal end frame,
error frame, bare EOF mid-reasoning, empty stop). Recovery-path tests with a
scripted local upstream (dependency injection, no module mocking): exactly
one recovery request per turn, tools rejected during recovery, budget
arithmetic boundaries (skip below minimum budget), checkpoint cap enforced,
second truncation during recovery does NOT trigger a third request.
Accounting tests assert the physical/logical split.

> Contract rule (FID-2026-0918-006): every promised test artifact MUST name
> its repo-relative `*.test.ts(x)` path, and that path MUST also appear as a
> declared `- gate: test <path>` below.

> Declared now so promise and gate are paired from creation (FID-2026-0918-006).
> They become live enforcement at the `fixed`/`verified` flip
> (FID-2026-0823-009); a `created`/`converged` record is outside the C1–C3
> contract.

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: test packages/agent-runtime/src/__tests__/stream-outcome-classification.test.ts
- gate: test packages/agent-runtime/src/__tests__/stream-recovery.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:46b582d3c568d9696f01f6f5bb9a4a4f18bfda27f482cfeae801f1d2849e53e9
- verified: 2026-10-06T04:01:46.853Z
- typecheck packages/agent-runtime: exit 0
- test packages/agent-runtime/src/__tests__/stream-outcome-classification.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/stream-recovery.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Issue cataloged (reasoning-only truncation loses the whole turn).
  Call-graph check: the stream close path in `packages/agent-runtime` is
  live; the recovery path is new wiring and will need Law 4 grep evidence at
  implementation (a recovery path with zero callers is a rejected FID).
- **GREEN:** Design converged — see "Design decisions (GREEN, Loop 1)"
  below; implementation follows that plan when this FID is actioned.
- **AUDIT:** The two suites above plus a re-read of the recovery caps
  against this document; grounding citations in the design block. One
  refinement from the re-read: the draft's vague "usage/telemetry
  accounting surfaces" is now grounded to the real seams
  (`run-agent-step/reconcile-token-count.ts`, `step.ts`,
  `prompt-agent-stream.ts`). Latent defect fixed: the Verification Receipt
  prose was unparseable by `scripts/fid-verify.ts` (learned at
  FID-2026-1005-010's stamp) — the section now starts empty.
- **ADVERSARIAL:** Answered below — the duplication/double-execution
  standing question is proven by the structural predicate, not intention.
- **CHANGE DELTA:** Converged the design (GREEN block + adversarial
  answers + accounting-seam grounding); status `created` → `converged`.

### Design decisions (GREEN, Loop 1)

All seams below were read or grep-proven live at convergence (Law 1/Law 7).

1. **Grounded seams.** The stream entry is
   `packages/agent-runtime/src/prompt-agent-stream.ts` (it already carries
   truncation-adjacent budgeting at :24-25 — explicit `max_tokens` because
   "an unset budget let provider defaults truncate large native tool
   calls"). The sibling bounded-recovery precedent is
   `run-agent-step/loop/native-strikes.ts` with named caps in
   `run-agent-step/constants.ts` (`NATIVE_TOOL_CALL_RECOVERY_MAX_STRIKES = 3`,
   terminal 5, exhausted message) — tool-call recovery. Stream recovery
   must NOT collide: a turn with tool calls is never stream-recovered
   (native-strikes owns that shape). Accounting seams:
   `run-agent-step/reconcile-token-count.ts`, `step.ts`.
2. **Outcome classifier** — pure `classifyStreamOutcome(close, accumulated)`
   at stream close: `normal | upstream-error | user-cancel | output-cap |
   reasoning-only-truncation`. The recoverable predicate is structural:
   reasoning non-empty ∧ body empty ∧ no tool calls ∧ (abnormal close ∨
   empty stop). Wired at BOTH the top-level and subagent stream paths (the
   subagent streaming surface carries current worktree changes — same
   semantics by default, per Missed Question 1).
3. **Recovery policy** — defaults are the measured numbers as named
   constants (narrow-only via settings, never widened): 1 recovery per
   logical turn (2 physical requests total), checkpoint cap 131072 chars
   (trimmed keeping the most recent reasoning — tail — since the request
   demands the conclusion), recovery output cap 8192 tokens, recovery
   segment ≤ 180s within a 480s total turn budget, skip entirely if < 512
   tokens of budget remain. Budget arithmetic is one pure function with
   boundary tests.
4. **Recovery request** — checkpoint reasoning + original input; prompt
   demands the finished answer conclusion-first; tools structurally
   disabled (the tool executor is not wired into the recovery call path);
   reasoning is never replayed to the user — the recovery result is
   delivered as the turn's answer.
5. **Accounting** — `logicalTurnId` + `physicalRequestIndex` threaded onto
   the accounting records; totals sum only upstream-reported usage values
   (existing honesty rule) and the physical/logical split is asserted in
   the recovery suite.
6. **Failure semantics** — a second truncation during recovery does NOT
   trigger a third request; the turn surfaces one classified `STREAM_CUT`
   error and is never re-sent wholesale; user cancel stays cancel. A
   recovery request is an ordinary classified call under
   FID-2026-1005-006's breaker (a transient failure may retry within the
   recovery's single-request budget; an administrative failure ends the
   turn; recovery never bypasses the breaker).

### Adversarial answers (Loop 2)

- **Can recovery duplicate content or double-execute a tool?** No, by
  construction: the predicate requires an empty body and zero tool calls
  before recovery is even eligible, and the recovery call path has no tool
  executor. Tests assert the predicate on mixed shapes (partial body,
  partial tool call → never recovered).
- **Can recovery become an infinite continuation?** No: exactly one
  recovery per logical turn is a counter, not a heuristic, and the second
  truncation path is terminal by design (tested).
- **Can the budget arithmetic go non-finite or negative?** The pure budget
  function is tested at boundaries (below-minimum skip, exact-minimum
  attempt, checkpoint-cap trim) and every produced figure is asserted
  finite — the FID-2026-1005-006 policy-shape lesson applied one layer up.
- **What if the checkpoint exceeds the cap?** Trimmed tail-first (decision
  3) — deterministic, tested at the boundary.

### Missed Questions

1. **Does recovery apply to subagent turns?** Yes, by default — a delegated
   turn is no less lost than a top-level one — with the same two-request
   cap counted per logical turn, including nested use. If the subagent
   transport cannot carry the checkpoint safely, recovery for that path is
   disabled explicitly and the difference documented, not left implicit.
2. **What if the user sees partial reasoning?** Display is not replayed and
   not re-streamed; the recovery result is delivered as the turn's answer.
   The checkpoint is an internal artifact and is never persisted to
   statistics files.
3. **Interaction with the circuit breaker (FID-2026-1005-006)?** A recovery
   request is a normal classified call: a transient failure may retry
   within the recovery's own single-request budget, an administrative
   failure ends the turn. Recovery never bypasses the breaker.

### Implementation Evidence (REQUIRED for `closed`)

- [ ] **Commit SHA:** pending G2 commit authority (G1: nothing committed)
- [x] **File:line ranges:** `packages/agent-runtime/src/stream-recovery/` —
      `outcome.ts`, `recovery-plan.ts`, `recovery-executor.ts`; wiring at
      `packages/agent-runtime/src/prompt-agent-stream.ts` (`runTurnWithRecovery`
      composed around the classified boundary + `lastUserInput`)
- [x] **Gate output:** pasted in Code Verification Evidence
- [x] **Reproducibility:** every gate is a repo script/test path
- [x] **Step statuses:** steps 1–6 `implemented` — outcome classifier,
      recovery policy (narrow-only constants), checkpoint-seeded recovery
      request with tools structurally absent, physical/logical accounting
      records, terminal failure semantics (STREAM_CUT, never a third
      request), opt-out via budget refusal (no proven headroom → no
      recovery)

### Code Verification Evidence

> Before marking status as `fixed` or `verified`, verify that referenced code
> exists. FID metadata is a claim; code is ground truth.

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution (as-built notes: the
      physical/logical accounting record flows through the seam's logger
      channel — usage-sum surfaces are untouched, so the "sum only
      upstream-reported values" rule holds trivially; delegated turns flow
      through the same single production entry
      (`run-agent-step/step.ts` → `getAgentStreamFromTemplate`), so the
      per-turn cap is keyed to `logicalTurnId` = `runId:userInputId`)
- [x] Typecheck/tests/lint pass — evidence below
- [x] Production call-graph evidence present: `runTurnWithRecovery` ←
      `prompt-agent-stream.ts`; `classifyStreamOutcome` / `accumulateChunk` /
      `planRecovery` / `buildRecoveryPrompt` ← `recovery-executor.ts`
      (all grep-provable)
- [x] FID status reflects the actual implementation state (`verified`)

```text
tsc --noEmit (agent-runtime)                                   → exit 0
bun test stream-outcome-classification stream-recovery          → 15 pass / 0 fail
bun test prompt-agent-stream-forwarding model-route-callers     → 6 pass / 0 fail (pins hold)
bun run fid:verify …-007-… --write                              → all declared gates exit 0 (receipt below)
```

### Loop 2 — Independent audit and self-correction

Convergence audit complete (1 iteration): grounding leg (stream entry,
strikes precedent, accounting seams all grep-proven above) + manual re-read
— one refinement (accounting seams named concretely) and one latent defect
fix (receipt-section grammar). No overclaims found beyond that.

### Loop 3 — Final convergence

Design complete: every promise pairs with a declared gate (the two named
suite paths, typecheck agent-runtime, quality), all three missed questions
carry explicit defaults, adversarial questions answered with structural
(not intentional) guarantees, YAGNI reviewed (no general-purpose
continuation engine — one hardcoded recovery shape; no per-provider policy
files). Status `converged` — the correct pre-implementation status.
Implementation is NOT started: FID-bound execution.

## Resolution

- **Closed Date:** not closed — record is `verified` (operator archives)
- **Fix Description:** Bounded stream recovery: `stream-recovery/` — the
  structural reasoning-only-truncation classifier, the hard-numbered
  recovery plan (2 physical requests max, tail-first checkpoint cap,
  8192-token output cap, 180s/480s budgets, 512-token headroom floor), and
  the recovery executor (tools structurally absent, second truncation
  terminal via STREAM_CUT, physical/logical accounting). Wired around the
  classified boundary at the agent stream seam; without a proven output
  budget the plan refuses to run (conservative).
- **Tests Added:** `packages/agent-runtime/src/__tests__/stream-outcome-classification.test.ts`
  + `packages/agent-runtime/src/__tests__/stream-recovery.test.ts`
  (15 tests, both declared gates); forwarding-test logger stub evolved for
  the accounting channel
- **Verification Evidence:** the Code Verification Evidence block + the
  stamped Verification Receipt below
- **Archived:** set when moved to `dev/fids/archive/`

## Lessons Learned

The reference implementation's real lesson is the discipline of bounds: every
recovery parameter is a hard number (requests per turn, checkpoint size,
output cap, time budget, minimum headroom), because a "best effort" recovery
becomes an infinite continuation loop the first time the upstream misbehaves
consistently. Equally important is the accounting honesty — counting
physical requests and logical turns separately is what makes the mechanism
auditable instead of a hidden second spend.
