# FID: Thinker State Accumulation and Non-Null Final Output Rebuild

**Filename:** `FID-2026-0801-012-thinker-state-output-rebuild.md`
**ID:** FID-2026-0801-012
**Severity:** critical
**Status:** closed
**Created:** 2026-08-01
**Closed:** 2026-08-01
**Author:** Buffy (FreeBuff orchestrator) + independent Thinker architecture review

---

## Summary

The Thinker can execute `sequentialthinking` calls, but its final result can still be
`structuredOutput: null`, and individual thoughts do not reliably stack into the
result. The current design stores thought history inside a per-run
`SequentialThinkingServer`, returns only counters from the tool handler, and
finalizes via a programmatic `handleSteps` generator that reads the last assistant
message's text instead of the accumulated thought state. `getAgentOutput()`
correctly returns `null` when `agentState.output` was never set — so a valid
reasoning run can silently produce a successful-looking null result.

This FID rebuilds the Thinker completion contract using an operator-approved,
lightweight design:

1. **A strict `ThoughtSession`** — append-only typed thought log + derived snapshot
   + explicit lifecycle (`begin → append → converge → finalize → cleanup`). No
   event bus, no CQRS/event sourcing framework, no new dependency, no database.
2. **Permissive input coercion** — stringified numbers/booleans are coerced
   (matching the MCP reference) before strict Zod validation, eliminating the
   well-documented "models emit `"1"` for `thoughtNumber`" rejection class.
3. **A rich `FinalArtifact` + thought stack** — the parent receives a typed
   artifact (`status`, `synthesis`, `payload`, `metrics`, `thoughts[]`, `error?`)
   where a successful status is structurally impossible with a null payload.
4. **A runtime convergence gate** — after the final tool result
   (`nextThoughtNeeded: false`), the runtime builds output from the session
   snapshot; the fragile `handleSteps` text-parsing finalizer is removed.

The thought stream remains visible in the CLI as tool-call blocks; only the final
parent artifact carries the typed non-null contract. Provider streaming, tool
authorization, legacy XML filtering, and model selection are unchanged.

---

## Environment

- **OS:** Windows host (`win32`), WSL2/tmux available for CLI verification
- **Language/Runtime:** TypeScript, Bun 1.3.x
- **Packages:** `@savant-code/common`, `@savant-code/agent-runtime`, `@savant-code/sdk`
- **Agent:** `agents/thinker/thinker.ts`
- **Tool:** `sequentialthinking`
- **Protocol:** FreeBuff ECHO Protocol `0.1.2-freebuff`, strict mode enabled
- **Related FIDs:** FID-2026-0801-005, FID-2026-0801-006, FID-2026-0801-007, FID-2026-0801-008, FID-2026-0801-009, FID-2026-0801-010
- **Current state:** Working tree contains the prior native tool-call continuation work; this FID is a separate final-state and thought-accumulation boundary

---

## Detailed Description

### Problem

The operator reports that the Thinker's final result returns null and that
thoughts do not stack. Source inspection confirms the two symptoms occur even when
an individual native tool call succeeds:

1. `getAgentOutput()` returns `{ type: 'structuredOutput', value: null }` whenever
   `agentState.output` is unset.
2. `agents/thinker/thinker.ts` declares `outputMode: 'structured_output'` and an
   output schema requiring `{ message: string }`, but its `handleSteps` finalizer
   reads only the last assistant message's text content. Native
   `sequentialthinking` results are tool messages, not ordinary assistant text.
3. `packages/agent-runtime/src/tools/handlers/tool/sequential-thinking.ts` keeps a
   `SequentialThinkingServer` per `runId`, but exposes only summary counters; the
   finalizer cannot retrieve the typed `ThoughtData[]` or branch map.
4. `common/src/tools/sequential-thinking.ts` already stacks thoughts internally,
   but the stack is not part of the Thinker output contract and is not copied into
   `AgentState` or a typed final-output object.
5. The Thinker has only `sequentialthinking` in `toolNames`; `set_output` is
   emitted by `handleSteps` through the programmatic `fromHandleSteps` path rather
   than being a model-visible capability. Finalization is therefore coupled to the
   generator's message-history assumptions.
6. A successful tool result does not itself guarantee a non-null parent result:
   tool-execution state and structured-output state are separate stores with no
   explicit handoff.

### Expected Behavior

1. Each Thinker child run receives exactly its permitted `sequentialthinking` tool.
2. Each accepted native call is appended to one isolated `ThoughtSession` keyed by
   the child run; concurrent Thinker runs cannot share history or branches.
3. The session preserves complete typed thought records (including revision and
   branch metadata) in insertion order, as immutable events.
4. Permissive coercion normalizes stringified numbers/booleans before strict
   validation, matching the MCP reference behavior.
5. The tool result reports concise session metadata for model continuation
   without exposing sensitive data or requiring raw XML.
6. When the final call sets `nextThoughtNeeded: false`, the runtime convergence
   gate builds the `FinalArtifact` from the session snapshot — not from assistant
   text.
7. A successful artifact is structurally impossible to be null: `status: 'success'`
   requires a validated non-null `payload` (the convergence invariant).
8. Bounded non-convergence (budget exhausted) produces `status: 'exhausted'` with
   partial synthesis and a clear error; cancellation produces
   `status: 'cancelled'`. Neither is a fake success.
9. No valid thought is lost, duplicated, reordered, or cross-contaminated; a
   failed call is never appended as a valid thought.
10. The child's turn ends through the normal native loop (no more tool calls →
    `shouldEndTurn`); the convergence gate runs at the runtime boundary, not via
    `handleSteps` text parsing.
11. Cleanup runs exactly once per session on success, failure, and abort.

---

## Root Cause

### 1. Thought state is trapped behind the tool handler

`SequentialThinkingServer` maintains `thoughtHistory` and `branches`, but
`handleSequentialThinking` returns only:

```text
thoughtNumber, totalThoughts, nextThoughtNeeded, branches, thoughtHistoryLength
```

The runtime and Thinker finalizer cannot retrieve the accepted `ThoughtData[]`.
The per-run map protects concurrent sessions, but it is not a complete state
contract for the agent lifecycle and has no explicit cleanup boundary.

### 2. Structured output is a separate, unset state field

`getAgentOutput()` intentionally returns `agentState.output ?? null` for
`structured_output`. The Thinker only receives a populated output when the
programmatic `set_output` finalizer successfully runs. Native sequential-thinking
results do not automatically populate `agentState.output`.

### 3. The finalizer reads the wrong representation

The current Thinker `handleSteps` searches for the last assistant message and
concatenates only text parts. A native tool-call turn may contain no text part at
all, while its useful content lives in the tool-result state and the session's
thought history. The result is empty, invalid, or null despite valid thought calls
having executed.

### 4. Completion is not coupled to session convergence

The model's `nextThoughtNeeded` flag is processed by the server, but the final
output path does not use that state as its completion oracle. The generator and
outer loop can therefore disagree about whether the Thinker has a meaningful
result to return.

### 5. Strict-only validation rejects common model output

The current Zod schema is strict-only. Public MCP issue evidence (issue #2473,
#2792) shows models emit stringified integers for `thoughtNumber`/`totalThoughts`
and stringified booleans, which strict schemas reject, causing loop crashes. The
MCP reference solves this with `z.coerce` + boolean preprocessing; we do not.

---

## Evidence

### Source evidence

- `agents/thinker/thinker.ts` — `outputMode: 'structured_output'`, output schema
  `{ message: string }`, and a `handleSteps` finalizer that reads only the last
  assistant text message.
- `packages/agent-runtime/src/util/agent-output.ts` — structured output returns
  `agentState.output ?? null`.
- `packages/agent-runtime/src/tools/handlers/tool/sequential-thinking.ts` —
  per-run server map exists, but only summary metadata is returned and no public
  session retrieval/cleanup contract is exposed.
- `common/src/tools/sequential-thinking.ts` — `thoughtHistory` and `branches` are
  stored privately; `processThought()` mutates/records accepted inputs.
- `packages/agent-runtime/src/run-programmatic-step.ts` — programmatic tool calls
  run through a separate path with `fromHandleSteps: true`; this is the current
  bridge used by the Thinker finalizer.
- `packages/agent-runtime/src/run-agent-step.ts` — programmatic steps run before
  the native model step on each loop iteration, and structured output is checked
  through `agentState.output` before completion.
- `common/src/tools/params/tool/sequential-thinking.ts` — strict Zod schema with
  no coercion layer.

### Research evidence

- **Format Tax (arXiv 2604.03616):** forcing LLMs to emit highly constrained JSON
  during reasoning measurably degrades comprehensiveness. The primary `thought`
  field must remain free-form; strict structure is reserved for the final artifact.
- **MCP issue #2473 / #2792:** models emit stringified integers/booleans for
  sequential-thinking fields; strict schemas reject them and crash the loop. The
  reference server uses permissive coercion before validation.
- **Structured-output + tools interop (mastra #7662, adk-python #701, anthropic
  SDK #1204):** combining output schemas with native tool loops breaks calls;
  intermediate reasoning must use standard tool calling, with structured output
  reserved for the final synthesis step.
- **Abort lifecycle (openai-agents-js #729):** aborting mid-tool-call corrupts
  state without explicit cancellation handling; partial calls must be discarded
  and the snapshot kept pure.
- **CoT leakage loops (gemini-cli #18520):** agents repeat analysis and leak raw
  chain-of-thought; a hard iteration cap plus a consecutive-error cap is required.

---

## Impact Assessment

### Affected Components

- `common/src/tools/sequential-thinking.ts` — evolve into/expose the strict `ThoughtSession` contract (append, snapshot, converge, cleanup) while keeping `processThought` semantics.
- `common/src/tools/params/tool/sequential-thinking.ts` — add permissive coercion (number/boolean) before strict validation.
- `packages/agent-runtime/src/tools/handlers/tool/sequential-thinking.ts` — route calls through the session, return metadata, wire cleanup.
- `agents/thinker/thinker.ts` — remove the text-parsing `handleSteps` finalizer; declare the new output contract.
- `agents/savant/savant.ts` — parent orchestrator consumption of the Thinker artifact (`synthesis`, `payload.message`); instructions update only, no runtime change to spawn handling.
- `packages/agent-runtime/src/run-agent-step.ts` (or a focused Thinker seam) — runtime convergence gate that builds the `FinalArtifact` from the session snapshot after the final tool result, sets `agentState.output` for every terminal status, and owns cleanup on abort.
- `packages/agent-runtime/src/util/agent-output.ts` — only if a typed completion invariant requires a guard; otherwise unchanged.
- `cli/src/components/blocks/tool-branch.tsx` and `cli/src/components/blocks/agent-branch-wrapper.tsx` — regression-check only: the Thinker no longer emits `set_output`; verify generic tool-block rendering is unaffected and implementor-selection UI still works.
- Common and agent-runtime tests for session state, coercion, convergence, cleanup, and output.
- Live CLI Thinker regression prompt and evidence report.

### Risk Level

- [x] Critical: the core Thinker path can report successful work as null
- [ ] High: major feature broken, no workaround
- [ ] Medium: feature degraded, workaround exists
- [ ] Low: minor cosmetic or edge case

---

## Proposed Solution

### Approach

A lightweight, strict `ThoughtSession` replaces the implicit message-history
source of truth for Thinker state, with a runtime convergence gate producing a
non-null `FinalArtifact`.

#### 1. `ThoughtSession` (state core, in `common`)

- Append-only typed thought log. Each entry is immutable: `thoughtId`,
  `sequenceId` (monotonic), `thoughtText` (free-form), `thoughtNumber`,
  `totalThoughts` (mutable estimate, adjusted when exceeded), `isRevision?`,
  `revisesThought?`, `branchFromThought?`, `branchId?`, `nextThoughtNeeded`,
  `timestamp`.
- Derived snapshot (read model) computed by folding the log: ordered thoughts,
  active branches, current total, convergence flag, length.
- Lifecycle states: `created → running → converged → finalized | failed |
  cancelled`; every transition validated by an invariant.
- **Convergence invariant (the null-killer):** `finalize()` requires at least one
  accepted thought AND `nextThoughtNeeded === false` AND a validated non-null
  payload. Any missing piece throws a typed `SessionStateError` and leaves the
  session `running`/`failed` — never a successful null.
- `cleanup()` is idempotent and runs exactly once (success/failure/abort).

#### 2. Permissive coercion (tool boundary)

- Add `z.coerce.number().int().min(1)` for `thoughtNumber`/`totalThoughts`,
  boolean preprocessing for `nextThoughtNeeded`/`isRevision`/`needsMoreThoughts`,
  and `z.coerce.number()` for `revisesThought`/`branchFromThought` — matching the
  MCP reference (`index.ts`).
- Strict Zod validation still runs after coercion; the executor remains the
  authorization and validation boundary.

#### 3. Runtime convergence gate (finalizer replacement)

- After `processStream` completes a step and the final tool result is in history,
  the Thinker-specific gate checks the session snapshot:
  - `nextThoughtNeeded === true` → keep looping (normal native continuation).
  - `nextThoughtNeeded === false` with a valid conclusion in the last thought →
    build `FinalArtifact` from the snapshot and set `agentState.output` once.
  - no accepted thoughts / missing conclusion → append a typed retry message with
    a consecutive-error counter; after 3 consecutive failures → `status: 'failed'`.
  - **Model ends turn without a terminal `nextThoughtNeeded: false` call** (the
    plausible real-world null path: thoughts accepted with `nextThoughtNeeded:
    true`, then the model writes its conclusion as plain text and stops): the
    session never converged. The gate treats this as non-convergence — it does
    NOT fabricate success. It appends one typed retry message asking for a final
    `nextThoughtNeeded: false` thought carrying the conclusion; after the
    consecutive-error cap (3) it returns `status: 'exhausted'` with partial
    synthesis and the captured text. It is never a successful result.
- **The gate always sets `agentState.output` for every terminal status**
  (success, exhausted, cancelled, failed) and does so BEFORE the existing
  `output === undefined && shouldEndTurn` restart check in `run-agent-step.ts`.
  This is mandatory: once `handleSteps`/`set_output` are removed (and `set_output`
  is not in `toolNames`), that check would otherwise fire the "You must use
  set_output…" reminder, restart once, then break with output still undefined —
  reintroducing `structuredOutput: null` by construction.
- The `handleSteps` text-parsing finalizer in `agents/thinker/thinker.ts` is
  removed; the child ends through the ordinary native loop.

#### 4. Output contract: rich `FinalArtifact` + thought stack

The success invariant is enforced at the type level with a discriminated union —
not a nullable field that could be misused:

```ts
type ThinkerFinalArtifact =
  | {
      status: 'success'
      synthesis: string
      payload: { message: string }
      metrics: { totalThoughts: number; durationMs: number; branches: string[] }
      thoughts: ThoughtSnapshot[]
    }
  | {
      status: 'exhausted' | 'cancelled' | 'failed'
      synthesis: string
      payload: null
      metrics: { totalThoughts: number; durationMs: number; branches: string[] }
      thoughts: ThoughtSnapshot[]
      error: string
    }
```

- `status: 'success'` structurally requires a non-null `payload` — the null bug
  is impossible at compile time, not just by convention.
- **Parent consumer compatibility:** the parent orchestrator
  (`agents/savant/savant.ts` via `spawn_agents` reports) and the CLI receive the
  artifact generically. The FID requires the parent's Thinker instructions to
  read `synthesis` and `payload.message` (documented in the implementation step),
  and requires a CLI regression check that the Thinker's thought blocks still
  render (tool-block rendering is generic via `tool-branch.tsx`; only the
  implementor-selection UI special-cases `set_output`, which the Thinker no
  longer uses — that code path must be verified unaffected).
- The CLI continues to render each `sequentialthinking` call as a visible tool
  block (unchanged streaming UX); the artifact is the parent-facing result.

#### 5. Bounded termination and cleanup

- Reuse the existing agent step budget as the outer bound.
- Add a session-level consecutive-error cap (3) for convergence validation
  failures to prevent token-burning loops.
- `cleanup()` runs on: success (after artifact built), failure, exhaustion,
  cancellation, and abort — idempotent, keyed by run.

### Explicit Non-Goals

- No event bus, CQRS framework, event-sourced database, or new dependency.
- No change to Thinker model, provider, or parent-tool inheritance.
- No weakening of `toolNames` authorization; no new model-visible tools.
- No rewriting of OpenAI-compatible streaming accumulation or legacy XML parsing.
- No change to general `getAgentOutput()` semantics for unrelated agents.
- No exposing of raw hidden prompt context beyond the approved thought stack;
  the artifact's `thoughts` field is the deliberate parent-visible contract.
- No shadow-engine migration phase; single converged implementation + tests.

---

## Verification Matrix

| Case | Required evidence |
|---|---|
| One valid thought, `nextThoughtNeeded: false` | `status: success`, non-null `payload`, 1 thought in stack |
| Three sequential valid thoughts | Stack length 3, deterministic order, metrics.totalThoughts ≥ 3 |
| Stringified number/bool input | Coerced then accepted; no invalid-parameter error |
| Revision | Original + revision records present with metadata |
| Two branches | Both branch IDs present and isolated |
| `thoughtNumber` exceeds estimate | Snapshot total adjusts upward |
| Two concurrent run IDs | Histories/branches never cross-contaminate |
| Final result after native tool call | Gate builds from session snapshot, not assistant text |
| Empty assistant text + valid tool results | Non-null artifact still produced |
| No accepted thoughts | `status: failed` (or exhausted), never successful null |
| `nextThoughtNeeded: false` without conclusion | Retry message + counter; 3 consecutive → failed |
| Thoughts accepted, model ends turn in text without terminal tool call | Non-convergence: one retry message, then `exhausted` with partial synthesis; never success; never the outputSchema restart-null path |
| Gate ordering vs outputSchema restart check | `agentState.output` set for every terminal status BEFORE the `output === undefined && shouldEndTurn` branch; no "set_output reminder" restart for the Thinker |
| Parent consumes artifact | `spawn_agents` report contains non-null `synthesis`/`payload.message` on success; CLI thought blocks still render; implementor-selection unaffected |
| Bounded non-convergence | `status: exhausted` with partial synthesis, no infinite loop |
| Abort mid-tool-call | Partial call discarded; `status: cancelled`; cleanup ran |
| Duplicate/invalid tool-call ID | Idempotent drop; no double append |
| Late-arriving tool result after cancel | Rejected by lifecycle guard; no state mutation |
| Unauthorized tool attempt | Existing executor rejection; no permission change |
| Provider emits `{}` before real args | FID-010 continuation behavior unchanged; no false append |
| Existing provider regression | FID-010 continuation tests remain passing |
| Live CLI | Child starts; multiple structured calls/results visible; final result non-null with stacked outcome; no raw XML/unavailable-tool/invalid-parameter errors |

---

## Perfection Loop

### Loop 1 — RED — COMPLETE

- Read the FreeBuff ECHO Protocol `0.1.2-freebuff` from 0-end.
- Read `templates/FID-TEMPLATE.md` from 0-end.
- Reviewed the current Thinker definition, common server, native handler, tool
  schema, runtime programmatic-step path, output resolver, and prior FIDs
  (005–010).
- Reviewed the local MCP Sequential Thinking reference implementation and tests.
- Reviewed the operator-provided Gemini Deep Research report and public evidence
  (Format Tax, MCP issues #2473/#2792, structured-output interop issues, abort
  lifecycle, CoT-leak loops).
- Confirmed `structuredOutput: null` is the direct result of
  `agentState.output` remaining unset.
- Confirmed the Thinker finalizer reads latest assistant text instead of the
  native tool-result/session state.
- Confirmed the per-run server map stores history but exposes no typed snapshot
  or terminal cleanup contract.
- Confirmed strict-only Zod rejects stringified numbers/booleans.

### Loop 1 — GREEN — CONVERGED DESIGN (operator-approved decisions)

The following decisions were presented to and approved by the operator before
this FID was rewritten:

1. **Architecture:** Lightweight `ThoughtSession` (append-only log + snapshot +
   lifecycle). Rejected full CQRS/event sourcing as over-engineered for a single
   child agent; rejected message-history and tool-result-only sources of truth.
2. **Tool contract:** Keep `thought`/`thoughtNumber`/`totalThoughts`/
   `nextThoughtNeeded` semantics, add permissive coercion before strict
   validation (Format Tax mitigation; MCP-reference parity).
3. **Output shape:** Rich `FinalArtifact` + thought stack. The parent receives
   status/synthesis/payload/metrics and the stacked thoughts; the CLI keeps
   streaming thought blocks visible.
4. **Finalizer:** Runtime convergence gate. `handleSteps` text parsing is
   removed; output is built from the session snapshot after the final tool
   result.

Design choices with rationale:

- **Session over message history:** message history is an audit trail, not
  structured state; deriving thoughts from text lost the stack.
- **Coercion over strict-only:** public evidence (MCP #2473/#2792) shows
  stringified primitives are common and strict-only rejection crashes loops.
- **Artifact gate over implicit success:** `status: 'success'` requires a
  validated non-null payload — the null bug becomes structurally impossible.
- **Runtime gate over handleSteps:** the generator's last-message read is
  timing-sensitive and format-sensitive; the runtime gate is deterministic.
- **No new dependency:** existing Zod, executor, and loop boundaries suffice.

### Loop 1 — AUDIT — COMPLETE

Independent audit of the rewritten FID against current source and the research
report found:

- The convergence invariant (success requires non-null validated payload) is
  correctly placed at the finalize transition and cannot be bypassed by the
  output adapter because the adapter consumes only the snapshot.
- Permissive coercion is scoped to the tool boundary; the executor's strict
  Zod validation and authorization remain the final gate.
- The runtime gate ordering (final tool result committed → snapshot read →
  artifact built → `agentState.output` set once) resolves the prior
  ordering-race concern.
- The 18 adversarial scenarios from the research were mapped to the verification
  matrix; scenarios already handled by `tool-executor.ts` (unauthorized tools,
  duplicate IDs, late results) are retained as regression gates, not new work.
- No critical/high issues remain; no over-engineering was introduced.

### Loop 1 — SELF-CORRECT — COMPLETE

Corrections folded into the design before presentation:

1. **No shadow-engine migration:** a single converged implementation replaces the
   research's phased shadow/cutover plan (overkill for one child agent).
2. **No raw `ThoughtData[]` handoff:** the artifact carries an immutable snapshot;
   the session never returns its live internal arrays.
3. **Consecutive-error cap:** 3 convergence-validation failures force `failed`
   (prevents null-payload token-burning loops).
4. **UI contract preserved:** thoughts stay visible as streaming tool blocks;
   only the parent artifact carries the typed non-null contract.
5. **Cleanup ordering:** snapshot consumed first; cleanup runs once after.
6. **No broad `getAgentOutput()` change:** the null guard is scoped to the
   Thinker completion contract.
7. **Gate always sets output before the restart check:** the audit found that
   removing `handleSteps`/`set_output` would otherwise trigger the loop's
   `output === undefined && shouldEndTurn` "You must use set_output" branch,
   restart once, then break with null. The corrected design requires the gate to
   set `agentState.output` for every terminal status before that check.
8. **Text-conclusion scenario specified:** thoughts accepted with
   `nextThoughtNeeded: true` followed by a plain-text conclusion and a stopped
   turn is now an explicit non-convergence path (retry → exhausted), never a
   fake success.
9. **Parent consumer contract added:** the parent reads `synthesis`/
   `payload.message`; the CLI implementor-selection path that special-cases
   `set_output` is regression-checked since the Thinker no longer emits it.
10. **Discriminated union output type:** `payload` cannot be null on success at
    compile time — the null invariant is enforced by the type system.
11. **`totalThoughts` adjustment is append-time normalization:** the stored
    thought record is immutable with the adjusted value; the caller's input
    object is never mutated or aliased (the current server mutates
    `input.totalThoughts` directly, which is fixed by the session contract).

### Loop 2 — AUDIT — COMPLETE

A second pass re-read `agents/thinker/thinker.ts`, `runAgentStep` ordering,
`runProgrammaticStep`, `handleSetOutput`, `getAgentOutput`, the tool schema, the
MCP reference, the parent orchestrator, and the CLI rendering layer. The audit
raised three high and one medium finding, all folded into the design above:

- **High — parent consumer compatibility:** the artifact shape change is now
  reflected in `agents/savant/savant.ts` instructions and a CLI regression check.
- **High — text-conclusion-without-terminal-call path:** now an explicit
  non-convergence path (retry → exhausted), never a fake success.
- **High — gate must always set `agentState.output` before the outputSchema
  restart check:** mandatory ordering added to the gate spec; otherwise the
  null bug is reintroduced by construction.
- **Medium — discriminated union instead of nullable payload:** the success
  invariant is now compile-time enforced.

Confirmed: the session lifecycle fits the existing per-run handler map, the
runtime gate fits the existing loop's `shouldEndTurn` decision point, and no
architectural blocker remains. Implementation evidence still to be produced
after approval: typed session/gate tests, coercion tests, loop-order tests,
four-workspace verification, and a live CLI capture.

### Missed Questions

1. **Can a valid native tool result exist while structured output remains null?**
   → Yes. Native tool results and `agentState.output` are separate stores; the
   runtime gate must explicitly bridge them.
2. **Why not concatenate the latest assistant message?** → Native tool calls may
   contain no ordinary text; message parsing loses structured thought metadata.
3. **Does the artifact expose private chain-of-thought?** → Deliberately yes, in
   a controlled way: the approved `thoughts[]` stack is parent-visible; hidden
   prompt internals and provider metadata are excluded.
4. **Can returning a live `ThoughtData[]` leak mutable state?** → No live mutable
   arrays cross the boundary; the artifact carries an immutable snapshot.
5. **What if `nextThoughtNeeded` is false on thought 1?** → Valid one-thought
   converged session; must produce a non-null success artifact.
6. **What if a revision references a missing thought?** → Preserve the validated
   record; surface a typed session validation error; do not silently discard.
7. **What if a branch never converges?** → Kept in the snapshot; the active
   sequence's terminal state governs finalization; outer budget bounds it.
8. **Who cleans up when the child fails before finalization?** → The runtime
   terminal path owns idempotent cleanup; success path cleans up after the
   artifact is committed.
9. **Can a second run reuse a stale run ID?** → Session creation resets/rejects a
   terminal session; tests prove no stale history reuse.
10. **Can finalization run before the tool promise resolves?** → No; the gate
    runs only after the tool promise chain and history commit complete.
11. **Does this reopen FID-010?** → No; FID-010 owns provider incomplete-call
    continuation; this FID consumes the valid-call path.
12. **What is the failure contract for null?** → No valid converged session →
    explicit `failed`/`exhausted`/`cancelled`; never successful with null.
13. **Why keep `totalThoughts` if the session owns state?** → The model uses it
    as an adaptive estimate; the session adjusts it upward when exceeded
    (reference parity) and reports the effective value.
14. **Does permissive coercion weaken security?** → No; coercion normalizes
    serialization quirks before strict semantic validation; nothing is invented.

### Code Verification Evidence

- [x] FreeBuff ECHO specification read 0-end.
- [x] FID template read 0-end.
- [x] Current Thinker definition read 0-end.
- [x] Common sequential-thinking core and tool schema read 0-end.
- [x] Native handler and per-run state ownership read.
- [x] Programmatic step and native run ordering read.
- [x] Structured output resolver and set-output handler read.
- [x] MCP reference implementation and tests read 0-end.
- [x] Operator-provided research report and cited public evidence reviewed.
- [x] FID-010 and prior Thinker regression evidence reviewed.
- [x] RED/GREEN/AUDIT/SELF-CORRECT loop completed with operator decisions.
- [x] Loop 2 audit completed.
- [x] Operator approval of this rewritten FID.
- [x] Implementation and code verification.
- [x] Live CLI confirmation.

---

## Resolution

- **Fixed By:** Buffy (FreeBuff orchestrator) implementing FID-2026-0801-012
- **Fixed Date:** 2026-08-01
- **Fix Description:** Rebuilt the Thinker completion contract around a strict `ThoughtSession` (append-only typed thought log + derived snapshot + `begin → append → converge → finalize → cleanup` lifecycle) in `common/src/tools/sequential-thinking.ts`. Added permissive coercion (`z.coerce.number().int().min(1)` for numbers, `coercedBoolean` preprocessing for booleans — MCP-reference parity) to the tool schema before strict Zod validation. Added a per-run `thought-session-store` and routed the native `sequentialthinking` handler through it. Replaced the removed `handleSteps` text-parsing finalizer with a runtime convergence gate (`thinker-convergence-gate.ts`) wired into `loopAgentSteps` AFTER the native step and BEFORE the `output === undefined && shouldEndTurn` restart check: converged sessions build the non-null `FinalArtifact` from the session snapshot and always set `agentState.output` for every terminal status (success/exhausted/failed); non-convergence appends a typed retry message with a 3-turn consecutive cap; the `set_output`-restart null path is structurally impossible. Cleanup is idempotent and runs on success, failure, exhaustion, and abort (`finally`). Updated `agents/thinker/thinker.ts` (removed `handleSteps`, new output contract, `toolNames: ['sequentialthinking', 'end_turn']`) and `agents/savant/savant.ts` parent consumption instructions (also escaped a pre-existing backtick pair in `buildDefaultSystemPrompt`'s Response Formatting block that broke Prettier/Bun transpilation).
- **Tests Added:** `common/src/tools/__tests__/thought-session.test.ts` (11 tests), `common/src/tools/params/__tests__/sequential-thinking-coercion.test.ts` (7 tests), `packages/agent-runtime/src/__tests__/thinker-convergence-gate.test.ts` (7 tests), and two `loopAgentSteps`-level integration tests in `packages/agent-runtime/src/__tests__/loop-agent-steps.test.ts` exercising the real handler → session → gate → output ordering through `processStream`.
- **Verified By:** All four workspace typechecks pass (common, agent-runtime, sdk, cli); 60 focused tests pass / 0 fail (21 common + 39 agent-runtime, 217 expect() calls); ESLint on all 12 changed files passes with zero warnings; Prettier --check passes on all 12 changed files; independent code-reviewer-glm reviewed twice — PASS with no critical/high findings (the medium toolNames-alignment finding was resolved by adding `end_turn` to `agents/thinker/thinker.ts`).
- **Commit/PR:** Not created (pending operator release workflow)
- **Archived:** 2026-08-01 (live behavioral verification: FID_2026_0801_012_BEHAVIORAL_RESULT: PASS — 4 stacked sequentialthinking calls with increasing thoughtNumber, non-null FinalArtifact with status/synthesis/payload/metrics/thoughts, no set_output restart, no parameter errors, no parent-tool leakage)

## Lessons Learned

1. A successful tool call does not automatically become an agent's structured
   output; state promotion must be explicit.
2. A stateful reasoning engine needs a typed terminal snapshot, a convergence
   gate, and a cleanup lifecycle — not only a per-call counter response.
3. Message history is an audit trail, not a reliable source for reconstructing
   structured tool state.
4. Strict-only schemas reject common model serialization quirks; permissive
   coercion before strict validation is the reference-proven pattern.
5. A null structured result after apparent success is a contract violation that
   must be tested directly at the parent/child boundary.
6. The Format Tax is real: keep intermediate reasoning free-form and reserve
   strict structure for the final artifact.
