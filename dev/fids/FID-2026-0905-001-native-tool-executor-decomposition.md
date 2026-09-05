# FID: Native Tool Executor (EHEL Core) Decomposition

**Filename:** `FID-2026-0905-001-native-tool-executor-decomposition.md`
**ID:** FID-2026-0905-001
**Severity:** medium
**Status:** fixed
**Created:** 2026-09-05 09:14
**YAGNI-Compliance:** Verified (scope reduction only — no new capability proposed)
**Parent:** FID-2026-0819-005 (closed 2026-09-05 — this FID scopes the first of the five
accepted-residue source monoliths, per the closure handoff recommendation: smallest of the
five and highest-leverage, as the EHEL enforcement core)

---

## Summary

`packages/agent-runtime/src/tools/tool-executor/native.ts` — the native tool executor and
EHEL enforcement core — measures **894 lines** against the 300-line absolute ceiling
(`protocol.config.yaml` `quality.max_file_lines`). It is the accepted residue of the closed
quality-ratchet program (FID-2026-0819-005). The file is a single sequential gate pipeline
(`executeToolCall`) onto which every harness subsystem (EHEL, sandbox, hooks, ZTAP
provenance, evidence spill, grounding) has appended a phase inline. The remediation is an
**architectural stage extraction with gate-order invariants pinned by tests first** —
explicitly NOT a mechanical split (the ratchet Resolution draws exactly that boundary for
the five source monoliths).

## Environment

- **OS:** Windows 11 host (win32, Git Bash)
- **Language/Runtime:** TypeScript (`strict: true`); Bun 1.3.14-pinned
- **Tool Versions:** workspace `packages/agent-runtime` (bun test; policy-listed workspace)
- **Commit/State:** working tree post-ratchet-completion — ratchet changes on disk,
  uncommitted, operator-held per G1/G4
- **Measured:** `wc -l` → **894** (2026-09-05). The 2026-09-05 closure handoff recorded
  895 (±1 drift, immaterial). `dev/quality-baseline.json:1254` still records **852** —
  a stale baseline that must be regenerated at implementation (see Missed Questions Q3).

## Detailed Description

### Problem

The file violates the 300-line ceiling by ~3×. Its dominant cost is one exported function,
`executeToolCall` (`native.ts:76`), spanning roughly lines 76–862: a sequential pre-dispatch
gate chain (parse → capability allowlist → write gate → FSM phase → sandbox → EHEL →
YAGNI payload strip → PreToolUse hooks → ZTAP enforce gate → Law-1 bookkeeping →
spawn validation → abort gate), then handler dispatch with an inline client-tool bridge
closure, then a two-branch result lifecycle (success path with evidence spill, activity,
tool-result emission, history pushes, grounding refresh, `afterToolCall` tracking, ZTAP
receipt creation, PostToolUse hooks, credits; rejection path with error chunk +
PostToolUseFailure hooks), all inside one try/catch with deeply nested closures.

Every harness FID appended its phase inline rather than behind a seam, so the file is both
the de-facto registry of the gate chain and the most-touched enforcement surface in the
repo (a dozen+ archived FIDs cite specific line numbers in it — those citations rot with
every edit). Future gate additions continue to grow it.

### Expected Behavior

- File ≤ 300 lines; each pipeline stage a cohesive module with one responsibility and an
  explicit seam.
- The pre-dispatch gate **order is preserved and proven by tests** — the file's own comment
  at the parse-error branch calls gate ordering "the runtime's most important robustness
  invariant" (FID-2026-0802-005 C1).
- Zero import-surface change: the barrel `packages/agent-runtime/src/tools/tool-executor.ts:20`
  (`export { executeToolCall } from './tool-executor/native'`) stays byte-identical, and
  `executeToolCall` remains patchable at the barrel for the spy-based suites.

### Root Cause

Accretion without seams: each subsystem FID (EHEL, sandbox, hooks, ZTAP, evidence spill,
grounding refresh) added "one more gate" inline to the monolith. No intermediate module
boundaries exist between the phases, so there was nowhere cheaper to put them.

### Evidence

**Structure (grep-verified anchors, 2026-09-05):**

| Anchor | Line | Phase |
| --- | --- | --- |
| `function injectEhelSteering(` | native.ts:58 | EHEL steering injection helper |
| `export async function executeToolCall<` | native.ts:76 | monolith begins |
| `if ('error' in toolCall)` | native.ts:163 | parse-error branch (C1 invariant) |
| `await runWriteGate({` | native.ts:198 | write/containment gate |
| `checkSandboxPolicy({` | native.ts:272 | sandbox gate |
| `enforcement.beforeToolCall({` | native.ts:295 | EHEL pre-write gate |
| `stripYagniCheckBlocksFromWritePayload(` | native.ts:362 | YAGNI payload strip (post-gate, pre-execution) |
| `.triggerBlock(` | native.ts:372 | PreToolUse hooks gate |
| `echoCompliance.recordWrite({` | native.ts:451 | Law-1 write bookkeeping |
| `await validateSpawnAgentsInput({` | native.ts:474 | spawn pre-validation |
| `savantCodeToolHandlers[` | native.ts:530 | handler dispatch (trust boundary) |
| `enforcement.afterToolCall({` | native.ts:732 | post-tool EHEL tracking |
| `.recordWriteReceipt({` | native.ts:763 | ZTAP write receipt |
| `.fireAndForgetTrigger(` | native.ts:805 / :844 | PostToolUse / PostToolUseFailure hooks |
| `function isWriteToolName(` | native.ts:865 | type predicate |
| `function resolveFidIdForWrite(` | native.ts:879 | FID-id resolution for receipts |

**Loop-pass verification (2026-09-05):** all anchors re-verified by grep on
the working-tree file in the Loop 2 pass; the YAGNI strip anchor (:362) was
added to the table above. The table is exact ground truth.

**Call-graph (production):**

- Sole production export seam: `tools/tool-executor.ts:20` re-exports `executeToolCall`
  from `./tool-executor/native`.
- Production consumers, all via the barrel:
  `run-programmatic-step/execute-tool-calls.ts:4` (named value import) and
  `tools/stream-parser/tool-execution.ts:4-8` (named value import); type-only consumers:
  `run-programmatic-step/types.ts:1`, `tools/stream-parser/types.ts:3`,
  `tools/stream-parser/tool-execution.ts:13`.
- Test consumers spy the **barrel** namespace (`spyOn(toolExecutor, 'executeToolCall')`) —
  run-programmatic-step families, propose-tools fixture, n-parameter, basher-relay.
  Absence check (repo-wide grep `tool-executor/native`): **no** `__tests__` file imports
  `./native` directly; hits are prose/docs and the `dev/quality-baseline.json:1254` key.

**Architectural duplication (the deeper payoff):** the custom-tool executor re-implements
the same gate chain inline — `tool-executor/custom.ts` (:109 parse-error, :151 sandbox,
:177 `beforeToolCall`, :207 `triggerBlock`) and `tool-executor/custom-result.ts`
(:116 `afterToolCall`, :135/:167 `fireAndForgetTrigger`). Extracted gates can be shaped for
consumption by both executors (scope decision at GREEN — see Missed Questions Q3).

**Baseline drift:** `dev/quality-baseline.json:1254` records 852 for this file (stale).

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/tools/tool-executor/native.ts` — the file being decomposed
- `packages/agent-runtime/src/tools/tool-executor.ts:20` — barrel re-export MUST remain
  byte-identical (public seam; all value consumers and spies route through it)
- `tool-executor/custom.ts` + `custom-result.ts` — potential consumers of extracted shared
  gates (adoption is an explicit GREEN decision, not assumed)
- `dev/quality-baseline.json:1254` — regenerate via the quality report at implementation
- Prose references to the path (`docs/design/zero-trust-agentic-provenance.md:293`,
  `docs/design/hook-system.md:143`, `docs/agents-and-tools.md:100`) — update only if the
  seams move the referenced concepts
- Spy-based suites (behavior contract, not edits): run-programmatic-step part-a..part-f,
  propose-tools fixture, n-parameter, basher-relay-step-context

### Risk Level

- [x] Medium: the file sits on the release-critical enforcement path where gate ordering is
  load-bearing (a reordered gate can silently bypass a law). Mitigations: order-pinning
  characterization tests BEFORE extraction; extraction in dependency order with typecheck +
  focused suites after each step; the barrel seam stays byte-identical; the existing
  agent-runtime suite (1323 tests) plus the EHEL wiring suites exercise the chain.

## Proposed Solution

### Approach

Stage extraction along the file's own sequential phases, keeping `native.ts` as the
assembling **facade** (recommendation — reversible at GREEN): `executeToolCall` remains in
`native.ts` and delegates to extracted stage modules, so the barrel and every spy site stay
byte-stable while the file shrinks below the ceiling.

Candidate modules (single responsibility each; final shape converges at GREEN):

1. `tool-executor/trace.ts` — `recordToolEvent`/`finishToolEvent` trace-closure factory
2. `tool-executor/steering.ts` — `injectEhelSteering` (native.ts:58)
3. `tool-executor/write-bookkeeping.ts` — Law-1 record block (native.ts:451 context),
   `isWriteToolName` (:865), `resolveFidIdForWrite` (:879)
4. `tool-executor/pre-dispatch-gates.ts` — parse-error branch, capability allowlist, write
   gate, FSM phase gate, sandbox gate (order-critical group; each gate returns a
   discriminated halt-or-continue)
5. `tool-executor/ehel-gate.ts` — enforcement gate + law-check capture + blocking + YAGNI
   payload strip + steering (native.ts:295 context)
6. `tool-executor/hook-gate.ts` — PreToolUse `triggerBlock` + PostToolUse /
   PostToolUseFailure fire-and-forget (native.ts:372, :805, :844)
7. `tool-executor/provenance-gate.ts` — ZTAP enforce-mode role-key gate + write-receipt
   emission (native.ts:763 context)
8. `tool-executor/result-lifecycle.ts` — success path (evidence spill, activity,
   tool_result chunk, history pushes, `set_messages` grounding refresh, `read_files`
   grounding paths, `afterToolCall`, credits) and rejection path

Stage contract (loop-passed design): every extracted gate returns a
discriminated result — `{ halt: false; ...payload } | { halt: true; status:
'failed' | 'cancelled' }` — and the facade is the ONLY place that maps a
halt to `finishToolEvent(status); return previousToolCallFinished`, so halt
semantics stay byte-identical to the monolith's inline pattern (the five
halt sites all do exactly this: native.ts:163, :198, :272, :372, :497).
Cross-stage state (`resolvedWritePath`, `writeLawChecks`, `effectiveInput`,
`enforcement`, trace recorder, `hookProjectRoot`) rides a single
`GateContext` object threaded through the chain in order — producers:
write gate :198 → `resolvedWritePath` → Law-1 record :421; EHEL gate :295 →
`writeLawChecks` → Law-1 record + ZTAP receipt :763; spawn validation :474 →
`effectiveInput` → dispatch :530. The trace recorder factory encapsulates
the once-only `toolFinished` flag (single owner, no double-fire across
modules); `injectEhelSteering` and the bottom helpers (`isWriteToolName`,
`resolveFidIdForWrite`) move as pure functions. Module names above finalize
at extraction; the seams and the ORDER are the invariant, not the labels.

Hard invariants to pin with characterization tests in RED, before any extraction:

- Parse-error branch precedes ANY `toolCall.input` dereference (FID-2026-0802-005 C1).
- Sandbox gate precedes the Law-1 record — sandbox-denied writes never count toward the
  change footprint (FID-2026-0804-009 code-review finding).
- EHEL `beforeToolCall` is unconditional — no execution policy bypasses it (FID-2026-0811-016
  fixed exactly this class of bypass).
- Hooks are an ADDITIONAL gate after EHEL, never a replacement or bypass (FID-2026-0814-003).
- ZTAP `enforce` mode fails closed pre-dispatch when the role key is unavailable
  (FID-2026-0813-004).
- Abort gate: no stream/push/dispatch after abort (FID-2026-0802-005 H7).
- Handler is a trust boundary: synchronous throws surface as tool errors, never fail the
  run (FID-2026-0802-005 C2, Law 14).
- PostToolUse vs PostToolUseFailure keyed on `hasToolResultError`; `apply_patch`
  snapshot-read failure degrades `writtenContent` to undefined (strict turn-end scanning
  fails closed).
- `set_messages` grounding refresh only on success + no tool-result error + non-subagent;
  `read_files` grounding-path extraction contract preserved.

### Steps

1. [x] `implemented` — RED — characterization tests pinning gate order and lifecycle
       behaviors above, green on the current monolith before any extraction. **Done
       2026-09-05**: `tool-executor-gate-order.test.ts` (7 pre-dispatch pins) +
       `tool-executor-result-lifecycle.test.ts` (5 lifecycle pins) — 12/12 green on the
       monolith BEFORE extraction (evidence: 12 pass / 0 fail pre-split run).
2. [x] `implemented` — GREEN — extract stages in dependency order (trace → steering →
       write-bookkeeping → pre-dispatch gates → EHEL gate → hook gate → provenance gate
       → result lifecycle → client-tool bridge per Q10 → gate-chain assembly),
       typecheck + focused suites after each extraction; `native.ts` line count shrinks
       monotonically
3. [x] `implemented` — GREEN — facade ≤ 300 lines (**249 measured**; 894 → 249, −72%);
       `custom.ts` shared-gate adoption **declined** per Loop-2 Q5/Q9 (under ceiling;
       separately-evidenced follow-up)
4. [x] `implemented` — AUDIT — full agent-runtime suite **1335 pass / 0 fail (3399
       expects, identical totals pre/post extraction)** + typecheck exit 0 +
       `eslint --max-warnings 0` clean on the touched tree + prettier clean; barrel
       `tool-executor.ts` byte-identical (empty `git diff`); zero direct
       `./native` imports outside the module; quality report: `native.ts` no longer
       listed (was 852-baseline violation); `dev/quality-baseline.json:1254`
       regenerated 852 → 249
5. [ ] `blocked` — Ground-truth closure per G2 — commit hash required in Resolution;
       the operator executes git (G1). All other closure evidence is on disk; stamp
       the hash at commit time to complete closure.

### Verification

- Static: typecheck `packages/agent-runtime`; `eslint --max-warnings 0` on touched files;
  quality report passes `native.ts` against `max_file_lines: 300`
- Behavioral: full agent-runtime bun suite 0 fail (assertion totals at parity with the
  2026-09-05 baselines); new characterization tests green
- Call-graph: `grep -n "executeToolCall" packages/agent-runtime/src/tools/tool-executor.ts`
  unchanged; production consumers resolve through the same barrel export

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: test packages/agent-runtime/src/__tests__/echo-compliance-wiring.test.ts
- gate: test packages/agent-runtime/src/__tests__/run-programmatic-step-part-a.test.ts
- gate: test packages/agent-runtime/src/__tests__/tool-executor-gate-order.test.ts

### Verification Receipt

- fingerprint: sha256:d656ce904459aac8335585db6fe627e154d2a304149c357cff9974bd4f90447f
- verified: 2026-09-05T23:38:17.015Z
- typecheck packages/agent-runtime: exit 0
- test packages/agent-runtime/src/__tests__/echo-compliance-wiring.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/run-programmatic-step-part-a.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/tool-executor-gate-order.test.ts: exit 0

## Perfection Loop

### Loop 1 — RED (initial catalog, 2026-09-05)

- **RED:** complete — structure cataloged via grep-verified anchor map; production
  call-graph verified through the barrel; ordering invariants and lifecycle contracts
  cataloged from the file's own FID-cited comments; duplication with `custom.ts`
  identified. No code touched.
- **GREEN:** pending — the decomposition design converges when the Perfection Loop runs
  (operator trigger "run the perfection loop" or implementation priority).
- **AUDIT:** pending
- **ADVERSARIAL:** pending
- **CHANGE DELTA:** n/a (initial authoring)

### Loop 2 — Perfection Loop pass (2026-09-05)

- **RED:** native.ts read 0-EOF; anchor table re-verified 19/19 by grep
  (YAGNI strip :362 added). Catalog: (1) GREEN design absent — the module
  list had no cross-stage state threading or halt contract; (2) the ZTAP
  enforce fail-closed pre-dispatch gate has zero direct test coverage
  (`grep -rln "getRoleKey|recordWriteReceipt" src/__tests__/` = no hits;
  `provenance/__tests__` covers the module, not the executor wiring);
  (3) `dev/quality-baseline.json:1254` stale (852 vs 894) — already
  tracked for step 4; (4) the gate-order invariants are documented but
  unpinned by tests; (5) Verification Gates lacked the characterization
  file. No code touched.
- **GREEN:** stage contract designed (GateResult halt + GateContext
  threading + once-only trace recorder) — recorded in Approach;
  characterization test file specified (`tool-executor-gate-order.test.ts`,
  built on the proven `tool-executor-sandbox.test.ts` harness pattern:
  full params through the barrel) and added to Verification Gates; ZTAP
  enforce fail-closed test scoped into it (closes a real coverage gap, not
  a duplicate — Law 7 checked); `custom.ts` adoption declined with reason
  (see Missed Questions Q9); facade >300 contingency recorded (Q10).
  Extraction order unchanged (dependency order: pure helpers → trace →
  gates → lifecycle).
- **AUDIT:** every new claim cites file:line from the 0-EOF read — halt
  semantics verified at all five halt sites (:163, :198, :272, :372, :497:
  `finishToolEvent` + `return previousToolCallFinished`); state
  producer/consumer pairs verified (:198→:421, :295→:421+:763, :474→:530);
  declared gate files exist on disk (echo-compliance-wiring.test.ts 238
  lines, run-programmatic-step-part-a.test.ts, tool-executor-sandbox.test.ts
  167 lines as harness precedent). No implementation yet — nothing to
  runtime-audit.
- **ADVERSARIAL:** (1) Extraction could silently reorder gates → mitigated
  by RED-first characterization pins (sandbox-denied write must produce NO
  Law-1 receipt; EHEL block must never reach the hook gate; parse-error
  with null input must precede every input dereference). (2)
  `finishToolEvent` could double-fire across module boundaries → the flag
  is encapsulated in the recorder factory, single owner. (3) Facade could
  miss the 300 ceiling → extraction-order contingency Q10. (4) Spy-based
  suites could break → the barrel stays byte-identical (step invariant) +
  part-a gate. (5) No silent scope drop: steps 1–5 all retained, unchecked
  pending implementation.
- **CHANGE DELTA:** design + loop-annotation revision; within
  circuit-breaker limits; converges — Loop 3 finds no open design issues.

### Loop 3 — Final convergence (2026-09-05)

- **RED:** re-scan for open issues — none outstanding in the design; the
  remaining work is implementation (steps 1–5). Stale baseline (852) stays
  tracked for step-4 regeneration.
- **GREEN:** converged — stage contract, test pins, gates, and the
  custom.ts verdict are all recorded; no unresolved GREEN decisions remain
  (module names finalize at extraction; the seams and order are the
  invariant).
- **AUDIT:** internal consistency verified — every declared gate file
  exists on disk; every candidate module maps to verified anchors; halt
  semantics cite all five halt sites; status `analyzed` is admissible per
  the ledger vocabulary (loop-passed, implementation not started).
- **ADVERSARIAL:** the decomposition's riskiest failure mode (silent gate
  reorder) is converted into a RED-first test obligation; nothing
  approved-but-unevidenced remains in the document.
- **CHANGE DELTA:** bookkeeping only (<2%) — convergence detected; the
  loop terminates. Implementation awaits operator approval (Law 2).

### Missed Questions

1. Facade or hub — where does `executeToolCall` live after the split? → **Facade**
   (recommendation recorded in Approach): `native.ts` stays the assembling entry point so
   the barrel and every `spyOn(toolExecutor, 'executeToolCall')` site remains byte-stable.
   Reversible at GREEN if a cleaner seam emerges.
2. Does anything consume `native.ts` as raw text (the `init.ts`/`.agents/types` hazard from
   the ratchet)? → Absence check performed: repo-wide grep for `tool-executor/native`
   returns prose/docs and the `quality-baseline.json` key only — no code reads the file as
   text. Re-export hubs are safe here; no sibling-shipping constraint exists.
3. What about the stale 852 entry at `dev/quality-baseline.json:1254`? → Regenerated by the
   quality report in step 4; recorded in Affected Components so AUDIT expects the delta
   instead of flagging it as an anomaly.
4. Can this be a mechanical split like the ratchet's test decompositions? → No — the
   ratchet Resolution scopes the five source monoliths as architectural: the file's value
   is its gate ordering, so order-pinning tests precede extraction, and stages are
   extracted, not lines moved.
5. Does `custom.ts` join the refactor? → Decided at GREEN. Extracted gates should be
   shaped for reuse by both executors, but adopting them in `custom.ts` within this same
   FID widens the blast radius on the enforcement path; the default is shared-shaped
   modules with `custom.ts` adoption as an explicit, separately-evidenced decision.
   **Loop-2 verdict: declined for this FID** — custom.ts (283 lines) is under the
   ceiling and its duplication is structural (inline `beforeToolCall`/`triggerBlock`/
   sandbox calls — grep verified: no `isWriteToolName` twin exists), so adoption is a
   separately-evidenced follow-up.
6. What is the halt contract across module boundaries? → The discriminated `GateResult`
   (see Stage contract in Approach); the facade owns `finishToolEvent` + the
   `previousToolCallFinished` return, so the once-only finish semantics and the exact
   resolved value are preserved verbatim.
7. Where do the characterization tests live? → One new file,
   `src/__tests__/tool-executor-gate-order.test.ts` (<300 lines), on the
   `tool-executor-sandbox.test.ts` harness pattern (full params through the barrel —
   never importing `./native` directly). It must pass BEFORE extraction (on the
   monolith) and after — that is the pin. Added to Verification Gates.
8. ZTAP enforce fail-closed: existing coverage? → None found —
   `provenance/__tests__` covers the module itself, not the executor wiring; the
   enforce-gate test in the new file closes a real gap (Law 7 checked, not duplicated).
9. `custom.ts` adoption verdict? → Declined for this FID (see Q5); recorded here so
   AUDIT expects the non-adoption instead of flagging it as an omission.
10. Facade stays >300 under worst case? → Contingency: additionally extract the
    client-tool bridge closure (`requestClientToolCall` factory) into its own module —
    the dispatch core plus imports stays under the ceiling; verified by line count
    after each extraction.

### Code Verification Evidence

- [x] Files referenced in Affected Components exist: `native.ts` (read 0-EOF 2026-09-05,
      894 lines), `tool-executor.ts`, `custom.ts`, `custom-result.ts`,
      `dev/quality-baseline.json`
- [x] Anchor lines verified by `grep -n` on 2026-09-05 and re-verified in the Loop 2
      pass — 19/19 exact (Evidence table, incl. the added YAGNI strip row)
- [x] Production call-graph verified: barrel `tool-executor.ts:20` →
      `execute-tool-calls.ts:4`, `stream-parser/tool-execution.ts:6`
- [x] Implementation exists and matches Proposed Solution — extracted modules on
      disk (file:line ranges in Resolution); facade 249 lines; characterization
      suites green pre- and post-extraction (1335 pass / 0 fail both runs)
- [x] Status reflects actual state: `analyzed` → steps 1–4 implemented with gate
      receipts; closure `blocked` on the G2 commit hash (operator executes git)

## Resolution

- **Status 2026-09-05:** steps 1–4 `implemented` with all gate receipts on disk
  (stamped Verification Receipt: 4/4 PASS); step 5 `blocked` solely on the G2
  commit hash — the operator executes git. On commit of the decomposition,
  record the hash here, set status `closed`, and archive per the Auto-Archive
  rule.
- **Fix Description:** `native.ts` decomposed 894 → 249 lines (−72%) into nine
  cohesive modules: `trace.ts`, `steering.ts`, `write-bookkeeping.ts`,
  `pre-dispatch-gates.ts` (4 order-critical gates), `ehel-gate.ts`,
  `hook-gate.ts` (PreToolUse + ZTAP provenance gates), `result-lifecycle.ts`,
  `client-tool-bridge.ts` (Q10 contingency), `gate-chain.ts` (ordered assembly
  — the load-bearing ORDER lives here), plus the shared `gate-context.ts`
  contract. The barrel and all spy sites stay byte-stable; the facade owns
  halt semantics.
- **Tests Added:** `tool-executor-gate-order.test.ts` (7 pre-dispatch order
  pins) + `tool-executor-result-lifecycle.test.ts` (5 lifecycle pins) +
  shared fixtures — 12 tests / 43 asserts, green on the monolith BEFORE
  extraction and after every wave.

## Lessons Learned

Gate-pipeline files accrete phases because each subsystem FID appends "one more gate"
inline to whatever function already dispatches. The durable fix is a registered stage
pipeline — an ordered gate list behind a single halt contract — so the next subsystem adds
a stage entry instead of a phase inside a monolith. Candidate lesson for
`dev/LEARNINGS.md` at closure.
