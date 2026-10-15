<!-- markdownlint-disable MD013 -->

# FID: Adaptive Session Grounding Refresh and Resume Persistence

**Filename:** `FID-2026-0812-005-adaptive-session-grounding-refresh.md`
**ID:** FID-2026-0812-005
**Severity:** high
**Status:** closed
**Created:** 2026-08-12
**YAGNI-Compliance:** Verified

> This FID contains no author or agent attribution, per the single-agent ECHO signing policy. The grounding-refresh implementation and operator-confirmed live behavior are present in the working tree; this archived FID completed local lifecycle closure. No release, commit, push, publication, or deployment is authorized by this record.

---

## Summary

The harness previously treated resumed user turns as fresh grounding sessions in some execution paths. The implemented fix persists enforcement/checkpoint state, uses logical-user-turn cadence, tracks the complete grounding set, stages ungrounded output, and deduplicates internal refresh delivery. This FID records that implemented contract and its operator-confirmed live behavior: full grounding once per valid logical session, a lightweight refresh approximately every five completed user turns, event-triggered refreshes, bounded safety backstops, and no visible prompt churn.

No change to the mandatory first-session grounding requirement is proposed. No weakening of tool gating, protocol selection, embedded fallback, subagent inheritance, or single-agent protocol boundaries is authorized.

## Current Status Reconciliation (2026-08-12)

- **Landed:** Serializable grounding checkpoints, adaptive logical-turn cadence, internal-step/time backstops, complete grounding-set tracking, history-replacement refresh handling, staged ungrounded output, refresh deduplication, and durable RunState validation are present in the working tree.
- **Validation already recorded:** Focused runtime/SDK tests, common/agent-runtime/SDK typechecks, ESLint, Prettier, and diff checks passed during implementation.
- **Operator-confirmed:** The live grounding session passed: the required boot reads occurred before the response and the observed session behaved correctly. The operator also confirmed the grounding behavior passed in the harness.
- **Resolved:** The implementation, checkpoint/resume path, adaptive cadence, grounding-set behavior, and operator-observed grounding flow are accepted for this release scope. No repeated-grounding regression remains reported; local lifecycle closure is complete.
- **Closure requirements:** local implementation audit and lifecycle reconciliation only; no grounding redesign is reopened.
- **Historical boundary:** The planning/root-cause/implementation-plan text below records the original design problem and is not a claim that production implementation is absent today.

## Environment

- **OS:** Windows workstation; cross-platform runtime behavior required
- **Language/Runtime:** TypeScript strict monorepo, Bun 1.3.14, React/OpenTUI CLI, SDK and agent-runtime workspaces
- **Protocol:** Harness ECHO Protocol v0.2.0; single-agent ECHO adaptation v0.1.2 was read 0-EOF before authoring this FID and governs this planning ceremony
- **Commit/State:** `main`, dirty working tree containing pre-existing v0.0.23 work; implementation changes and operator-confirmed live grounding evidence are present and remain uncommitted
- **Related queue records:** This record was coordinated under master FID-2026-0812-006; the later archive disposition of sibling records and the remaining active forensic child are tracked by the master and active index.
- **Governance boundary:** implementation and operator live evidence are present; local lifecycle closure is separate from release authorization

## Detailed Description

### Problem

The operator observed that the agent appears to re-ground on literally every user turn. The trace also shows an ordinary response to a minimal `hy3` message followed by grounding instructions and boot reads. Source inspection identifies several related defects:

1. **Resume identity loss:** `EchoEnforcement` instances are cached by `WeakMap<object, EchoEnforcement>` (`packages/agent-runtime/src/echo/enforcement.ts:23`). The enforcement state is private to the instance, including `protocolRead` and `turnCount` (`packages/agent-runtime/src/echo/enforcement-state.ts:27-29`). SDK resume clones the prior session with `applyOverridesToSessionState` (`sdk/src/run/execution/session-state.ts:72-83`; `sdk/src/run-state/mutations.ts:102-169`), changing the `AgentState` identity and causing a fresh enforcement instance on the next run.
2. **Wrong cadence unit:** `onStepBoundary()` increments `turnCount` on every main-agent loop iteration and refreshes every `PROTOCOL_REFRESH_INTERVAL` internal steps (`packages/agent-runtime/src/echo/enforcement.ts:397-405`; `packages/agent-runtime/src/echo/protocol-summary.ts:17-28`). Tool-heavy requests therefore refresh faster than simple requests, and the value cannot represent “every five user turns.”
3. **Incomplete grounding evidence:** `isProtocolReadCall()` clears the session-init gate when the configured protocol file is read (`packages/agent-runtime/src/echo/enforcement.ts:152-162`, `:508-520`), while the required boot message names `ECHO.md`, `ARCHITECTURE.md`, `protocol.config.yaml`, and `dev/LEARNINGS.md`. The runtime needs a complete, persisted grounding-set checkpoint rather than a single-file boolean.
4. **Late completion correction:** streaming forwards text chunks immediately (`packages/agent-runtime/src/tools/stream-parser.ts:293-305`), while `applyUngroundedCompletionGate()` runs after the step returns (`packages/agent-runtime/src/run-agent-step/loop-iteration.ts:314-325`). The gate can prevent final turn completion but cannot retract text already sent to the UI, producing visible response-then-reground churn.
5. **Transcript pollution and refresh accumulation:** grounding/compliance messages are appended as user messages with `keepDuringTruncation` (`packages/agent-runtime/src/run-agent-step/loop-iteration.ts:74-83`, `:448-459`). Repeated refreshes can accumulate in history and appear as if the user requested grounding, while preserved messages can increase context pressure.

### Expected Behavior

1. A fresh harness session performs the complete resolved grounding ritual exactly once before its first non-read tool call or final answer.
2. A resumed session does not repeat full grounding merely because its serialized `AgentState` has a new object identity.
3. Grounding completion is valid only when every required grounding path for the resolved contract has been successfully read or served through the approved local/embedded read path. A single `ECHO.md` read is insufficient evidence by itself.
4. The generated condensed protocol refresh is scheduled by completed logical user turns, with a default target of five turns, not raw internal loop steps.
5. The refresh scheduler is adaptive and event-aware:
   - refresh at the normal cadence after approximately five completed user turns;
   - refresh immediately after compaction if the critical grounding sentinel/checkpoint is absent;
   - refresh immediately after a protocol variant/source/version/fingerprint change;
   - refresh on explicit governance requests to re-read or verify protocol;
   - use a bounded internal-step/time backstop for unusually long tool-heavy turns, without making that backstop the normal cadence.
6. Refreshes are deduplicated or replaced rather than appended without bound. The latest valid refresh remains available to compaction protection, while obsolete refresh copies do not flood the transcript.
7. Internal enforcement context is not rendered as an ordinary user request in the normal chat transcript. Trace/audit output may retain a typed internal event or explicitly tagged hidden message.
8. The implementation must either buffer the first assistant response until grounding is complete or make the first response non-user-visible until the completion gate resolves. A late gate must not present an ungrounded answer and then visibly self-correct.
9. The retry cap remains bounded. A non-compliant model cannot cause perpetual full grounding or an infinite steering loop.
10. SDK embedders without a resolved boot contract retain their documented legacy no-gate behavior; harness sessions remain fully gated. The single-agent protocol remains local-only and outside the harness embedded bundle.

## Root Cause — historical pre-fix state

The original universal-grounding work correctly made the gate universal and eagerly created enforcement for the main agent, but its lifecycle state remained process-local. The runtime's persisted `AgentState` schema did not contain a serializable grounding checkpoint, and the `WeakMap` could not survive `cloneDeep`, JSON transport, or a new process. The refresh implementation was also designed around loop iterations, which was appropriate as a safety backstop but not as a user-facing cadence. Finally, the enforcement layer operated after stream emission and used generic user-message objects for internal steering, creating an observable ordering and transcript problem. The implemented checkpoint/cadence/buffering changes address this historical state.

## Evidence

### State lifetime and resume

- `packages/agent-runtime/src/echo/enforcement.ts:23` — `const enforcementInstances = new WeakMap<object, EchoEnforcement>()`.
- `packages/agent-runtime/src/echo/enforcement-state.ts:27-29` — new state starts with `protocolRead: false` and `turnCount: 0`.
- `sdk/src/run/execution/session-state.ts:72-83` — resumed sessions call `applyOverridesToSessionState` before each run.
- `sdk/src/run-state/mutations.ts:102-112` — `applyOverridesToSessionState` deep-clones the base session state.
- `sdk/src/run/types.ts:218-232` — checkpoint cloning also creates a new `mainAgentState` object.

### Cadence and refresh injection

- `packages/agent-runtime/src/echo/enforcement.ts:397-405` — refresh is emitted from `onStepBoundary()` based on `state.turnCount`.
- `packages/agent-runtime/src/echo/protocol-summary.ts:17` — `PROTOCOL_REFRESH_INTERVAL = 15` is defined as an internal loop cadence.
- `packages/agent-runtime/src/run-agent-step/loop-iteration.ts:445-459` — the refresh is called after a loop step and appended to message history with `ECHO_REFRESH`.
- `packages/agent-runtime/src/echo/__tests__/enforcement.test.ts:295-318` — current tests cover fifteen internal boundaries, not multi-run logical user-turn persistence.

### Grounding and late correction

- `packages/agent-runtime/src/echo/enforcement.ts:152-162` — only a matching protocol-file read clears the gate.
- `packages/agent-runtime/src/echo/enforcement.ts:508-520` — `isProtocolReadCall()` compares the requested path to the single configured protocol path.
- `packages/agent-runtime/src/tools/stream-parser.ts:293-305` — streamed text is sent to `onResponseChunk` as it arrives.
- `packages/agent-runtime/src/run-agent-step/loop-iteration.ts:59-83` — completion steering is injected after a would-end-turn decision.

## Impact Assessment

### Affected Components

Expected implementation and test seams, to be confirmed by call-graph search before coding:

- `common/src/types/session-state.ts` — serializable grounding checkpoint type on `AgentState` or an explicitly owned session-state field
- `packages/agent-runtime/src/echo/types.ts` and `enforcement-state.ts` — runtime state projection and persisted checkpoint synchronization
- `packages/agent-runtime/src/echo/enforcement.ts` — restoration, complete grounding-set tracking, adaptive refresh decision, and event APIs
- `packages/agent-runtime/src/echo/protocol-summary.ts` — cadence constants and generated refresh composition; preserve generated content as the source of protocol text
- `packages/agent-runtime/src/run-agent-step/loop.ts` and `loop-iteration.ts` — logical user-turn boundaries, compaction/event refresh triggers, deduplicated internal injection, and completion ordering
- `packages/agent-runtime/src/tools/stream-parser.ts` or stream handler boundary — buffering/suppression contract for an ungrounded first completion
- `packages/agent-runtime/src/context-compactor/` — explicit post-compaction checkpoint/sentinel validation hook
- `sdk/src/run/execution/session-state.ts`, `sdk/src/run-state/mutations.ts`, `sdk/src/run/types.ts` — backward-compatible persistence and resume behavior
- `packages/agent-runtime/src/echo/__tests__/enforcement.test.ts` — unit cadence/checkpoint tests
- agent-runtime loop, stream, compaction, and resume suites — end-to-end ordering and regression coverage
- SDK resume/serialization suites — round-trip preservation and legacy-state migration
- CLI/headless live-session tests — operator-visible behavior and hidden internal-message rendering
- `agents/savant/system-prompt.ts` and generated agent artifacts only if wording or message visibility contracts require updates
- documentation and CHANGELOG only at implementation closure, not during this planning FID

### Out of Scope

- Removing the mandatory first-session grounding ritual
- Weakening the universal harness gate when a harness boot contract is resolved
- Changing the harness versus single-agent protocol boundary
- Changing embedded bundle contents or generated protocol wording except where implementation requires a separately reviewed refresh-delivery correction
- Rewriting the context compactor or replacing the generated protocol-summary source
- Adding a new provider, model, credential system, UI redesign, or unrelated transcript feature
- Making full protocol reads happen every five turns; the five-turn cadence is for the condensed refresh only
- Release, tag, push, publication, deployment, or archive movement

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Governance behavior is repeatedly noisy and can expose an ungrounded response before correction; resume semantics and cross-layer message handling require careful compatibility work
- [ ] Medium
- [ ] Low

## Proposed Solution

### Approach

**Historical converged approach:** Introduce a serializable grounding checkpoint as the source of truth for logical-session freshness, while retaining the in-memory `EchoEnforcement` object as a runtime adapter.

**Current closure scope:** Do not reimplement the converged architecture. Audit the existing implementation against the remaining mutation-boundary, harness-path, live cadence, transcript, and resume evidence requirements. Restore the checkpoint when a resumed `AgentState` is cloned; invalidate it when the resolved contract identity changes. Track the required grounding set as a normalized path-keyed set or bitset with a contract fingerprint, rather than a single `protocolRead` boolean. Maintain a logical user-turn counter at the host/run boundary and pass explicit lifecycle events into enforcement. Use event-triggered refreshes plus a five-user-turn baseline and bounded internal-step/time backstops. Deliver refreshes as a typed internal compliance event or replaceable hidden message so only one current refresh is retained and ordinary chat rendering does not show synthetic user prompts.

The implementation must preserve backward compatibility: old serialized states lacking the new optional checkpoint are treated as ungrounded for the first resumed run, then receive one full grounding ritual and persist the new checkpoint. SDK sessions without a boot contract do not become gated merely because they receive a new state field.

### Authoritative checkpoint contract

The checkpoint is an optional, JSON-safe `groundingCheckpoint` field on the serializable main-agent/session state. The runtime `EchoEnforcement` object remains a `WeakMap` cache and projection only; it is never authoritative. The implementation must use this exact versioned shape (additional future fields may be ignored, but required fields may not be omitted):

```ts
{
  schemaVersion: 1,
  gateArmed: boolean,
  protocolVariant: 'harness' | 'single-agent',
  protocolFile: string,
  protocolSource: 'local' | 'embedded',
  protocolVersion: string,
  groundingSetFingerprint: string,
  requiredPaths: string[],
  completedPaths: string[],
  fullGroundingCompleted: boolean,
  logicalUserTurnCount: number,
  lastFullGroundingTurn: number | null,
  lastRefreshTurn: number | null,
  lastRefreshReason: 'initial' | 'cadence' | 'compaction' | 'contract-change' | 'explicit' | 'backstop' | null,
  lastRefreshEpoch: string | null,
  completionGateRetries: number,
  completionGateDisarmed: boolean
}
```

Serialization rules are normative:

- `requiredPaths` and `completedPaths` are normalized, project-relative, lowercase path keys sorted lexicographically; duplicates are rejected during validation.
- `groundingSetFingerprint` is a deterministic SHA-256 over the canonical tuple `(protocolVariant, protocolFile, protocolSource, protocolVersion, requiredPaths)`; document content is not copied into the checkpoint.
- `lastRefreshEpoch` is a deterministic refresh identity derived from `(groundingSetFingerprint, logicalUserTurnCount, lastRefreshReason)`; it is not a timestamp and cannot cause repeated refreshes by itself.
- `fullGroundingCompleted` is true only when `gateArmed === true`, the checkpoint identity matches the current boot contract, and `completedPaths` exactly covers `requiredPaths`.
- Missing, malformed, unknown-schema, stale, or mismatched checkpoints are treated as ungrounded and trigger one full ritual. They do not cause a crash and do not arm SDK sessions whose current run has no resolved boot contract.
- If the current run omits `protocolVariant`, the effective gate is `false` regardless of stale persisted `protocolFile` or checkpoint fields; the stale fields are ignored and cleared from the next serialized state. A resolved harness/single-agent variant recomputes identity and validates the checkpoint.
- `cloneDeep`, JSON transport, cancellation snapshots, and `previousRun` must preserve the optional field exactly.

### Adaptive refresh policy

The implementation must define and use these named constants:

```text
CONDENSED_REFRESH_USER_TURNS = 5
MIN_REFRESH_TURN_GAP = 2
MAX_INTERNAL_STEPS_WITHOUT_REFRESH = 12
MAX_ACTIVE_MS_WITHOUT_REFRESH = 10 minutes
```

The policy is deterministic:

```text
full grounding:
  fresh session, missing/invalid checkpoint, or any contract identity change

condensed refresh:
  explicit governance request
  OR compaction removes the current critical sentinel/checkpoint evidence
  OR completed logical user turns since last refresh >= 5
  OR internal steps since last refresh >= 12
  OR active time since last refresh >= 10 minutes

anti-churn:
  never emit if lastRefreshEpoch equals the proposed epoch
  never emit a normal/backstop refresh when logicalUserTurnCount - lastRefreshTurn < 2
  compaction may request at most one refresh per compaction epoch
  contract changes invalidate full grounding and are not downgraded to a condensed refresh
  replace the previous refresh block instead of appending another copy
```

Logical-turn semantics are normative: increment `logicalUserTurnCount` exactly once when the shared host/run boundary classifies a submitted user prompt as completed, including a normal successful response and a response that ends with a handled model/tool error; do not increment for a cancelled/aborted run, a retry within the same submitted prompt, `/compact` internals, tool calls, subagent work, or internal compliance steering. A resumed run uses the persisted count and never derives it from message-array length.

### Required ordering and first-response contract

1. Resolve or restore the checkpoint before the first model call.
2. Complete the full grounding ritual before non-read tools or final user-visible completion.
3. Mark the checkpoint only after all required grounding reads/served reads succeed.
4. Evaluate compaction and contract-change triggers before the normal cadence decision.
5. **First-response safety is fixed to buffering:** while the main-agent gate is unresolved, assistant text chunks are accumulated in a non-rendered per-step buffer; the stream handler must not forward them to the CLI/UI. Once complete grounding is confirmed, normal streaming resumes for subsequent model output. If the model ends ungrounded, discard the staged text, inject one bounded internal steering message, and continue. No hidden-renderer alternative is permitted as an implementation substitute in this FID.
6. Deliver at most one current condensed refresh block through a typed internal channel or a message class that the CLI/headless renderer explicitly excludes from ordinary user transcript output. Replace the previous refresh block and preserve only the latest one for compaction protection.
7. Count and persist the logical turn only at the shared host/run boundary after the run classification described above.
8. The completion retry cap remains session-wide and bounded; it must not reset merely because a resumed `AgentState` object has a new identity.

### Implementation Steps

1. Define the serializable checkpoint and version/migration behavior in the common session-state contract; preserve optionality for legacy states.
2. Restore and validate the checkpoint in SDK resume, cancellation, snapshot, and JSON/clone paths; add invalid/missing/fingerprint-mismatch tests.
3. Refactor enforcement state so the `WeakMap` is only a runtime cache and cannot be the sole source of grounding truth.
4. Track all required grounding paths and mark completion only after the complete set succeeds through local or embedded read handling.
5. Establish explicit logical user-turn lifecycle events at the shared run boundary; keep internal loop steps separate.
6. Replace the fixed fifteen-step normal refresh behavior with the adaptive policy, retaining a bounded internal-step/time safety backstop.
7. Add compaction, protocol-contract-change, and explicit-governance refresh triggers with dedupe/replacement.
8. Implement the fixed buffering contract: stage ungrounded text in a non-rendered buffer, discard it on a blocked completion, and resume normal streaming only after grounding resolves; add a renderer/stream test proving no staged text reaches the CLI/UI.
9. Introduce a typed internal delivery path (preferred) for `ECHO_COMPLIANCE` and `ECHO_REFRESH`; the compatibility fallback must be a message class with explicit CLI/headless filtering. Replace, rather than append, retained refresh blocks.
10. Update runtime and loop tests, SDK resume tests, compaction tests, and CLI/headless rendering tests; search all exported symbol callers before changing public types.
11. Run focused verification, then the relevant workspace gates and full repository gates. Record operator live-session evidence separately because source tests cannot prove visual transcript behavior.
12. Update docs, LEARNINGS, and CHANGELOG only after implementation independently passes audit and the FID is closed.

## Verification Plan

### Static and focused tests

```text
cd common && bun run typecheck
cd packages/agent-runtime && bun run typecheck
cd sdk && bun run typecheck
cd cli && bun run typecheck

cd packages/agent-runtime && bun test src/echo/ src/__tests__/loop-agent-steps-part-a.test.ts src/__tests__/loop-agent-steps-part-d.test.ts
cd sdk && bun test src/__tests__/clone-session-state.test.ts src/__tests__/apply-overrides-resume.test.ts src/__tests__/run.integration.test.ts
cd cli && bun test src/__tests__/integration/usage-refresh-on-completion.test.ts

bunx eslint <changed-files> --max-warnings 0
bunx prettier --check <changed-files>
bun run lint:md
```

### Required behavioral evidence

The implementation audit must provide exact output proving:

- A fresh harness session performs the complete grounding set before a final answer or non-read tool.
- A resumed serialized/cloned state does not trigger full grounding solely because `AgentState` identity changed.
- A missing or invalid checkpoint re-grounding is bounded to one full ritual and does not recur on every later user turn.
- A read of only `ECHO.md` does not falsely mark the four-file grounding set complete.
- The fifth completed logical user turn causes one condensed refresh; internal tool steps alone do not consume user-turn budget.
- Compaction without the sentinel/checkpoint causes one immediate refresh, with dedupe on repeated compaction signals.
- Contract fingerprint/source/version changes invalidate the checkpoint and trigger full grounding or the explicitly defined safe refresh path.
- Refresh blocks are replaced/deduplicated and do not grow without bound in serialized message history.
- Compliance/refresh messages are hidden from ordinary user transcript rendering or emitted through a typed internal channel.
- An ungrounded first assistant response is not visibly rendered before the gate resolves.
- Harness sessions remain gated; SDK sessions without a boot contract retain legacy behavior; subagent pre-seeding remains unchanged.
- No credential, protocol content beyond intended grounding, or sensitive state is logged unexpectedly.

### Live operator evidence — operator-confirmed

The operator ran the live `bun dev` grounding session and confirmed that the grounding behavior passed, including the required boot-read behavior and the expected non-repeating session behavior. This is operator evidence rather than a durable repository transcript artifact; it is recorded separately from static implementation-audit output. No repeated-grounding regression remains reported. The confirmation resolves the live evidence boundary for this release scope; it does not represent a release or remote-operation approval.

## Perfection Loop

> The loop entries below preserve the original planning/convergence trail. Their planning-only claims describe the pre-implementation state. The current implementation state and narrowed pending scope are authoritative in **Current Status Reconciliation** and **Resolution** above/below.

### Loop 1 — RED

- **RED:** Identified five coupled defects: in-memory `WeakMap` state is lost across SDK clone/resume; refresh cadence counts internal loop steps rather than logical user turns; only one protocol path clears a four-file grounding contract; stream text is visible before completion enforcement; and synthetic refresh/compliance messages can pollute history and accumulate.
- **GREEN:** Proposed a serializable checkpoint, complete grounding-set evidence, five-user-turn adaptive refresh with compaction/contract-change/event triggers, bounded internal step/time backstops, deduplicated internal delivery, and first-response staging. Preserved mandatory first boot grounding, harness gating, SDK legacy no-gate behavior without a boot contract, and subagent inheritance.
- **AUDIT:** PASS — each issue has an in-tree source seam and a named implementation/test boundary: `enforcement.ts:23`, `enforcement-state.ts:27-29`, SDK resume clone at `session-state.ts:72-83` / `mutations.ts:102-112`, cadence at `enforcement.ts:397-405`, single-path completion at `enforcement.ts:152-162`, stream emission at `stream-parser.ts:293-305`, and late completion gate at `loop-iteration.ts:314-325`.
- **ADVERSARIAL:** FAIL — initial design review identified that “five turns” was ambiguous, checkpoint migration was unspecified, compaction could duplicate refreshes, stream buffering could accidentally regress normal streaming, and the first draft had not selected an authoritative checkpoint schema. These are explicitly corrected in Loop 2.
- **CHANGE DELTA:** New planning record plus first independent challenge; no production code changed.

### Loop 2 — SELF-CORRECT → GREEN → AUDIT

- **RED:** Residual risks were user-turn boundary ownership, legacy-state migration, checkpoint invalidation, complete read-set semantics, and the possibility of hidden compliance messages still being counted as user turns.
- **GREEN:** Defined the authoritative versioned checkpoint schema, deterministic fingerprint inputs, missing/invalid/unknown migration behavior, stale-contract gate predicate, exact logical-turn classification, complete grounding-set completion rule, named cadence/backstop constants, compaction epoch dedupe, explicit typed internal delivery, and fixed first-response buffering.
- **AUDIT:** PASS — the corrected plan names serialization surfaces (`applyOverridesToSessionState`, `cloneSessionState`, cancellation snapshots), separates logical turns from `onStepBoundary` loop steps, preserves the generated refresh body, and fixes first-response safety to a non-rendered buffer rather than leaving two competing implementations open.
- **ADVERSARIAL:** FAIL — a fresh challenge found that the exact checkpoint schema, deterministic anti-thrash constants, stale-contract behavior, and first-response architecture needed to be normative rather than deferred. These are resolved in Loop 3.
- **CHANGE DELTA:** Self-correction of planning semantics; no production code changed.

### Loop 3 — Final convergence

- **RED:** Remaining ambiguity concerned refresh anti-thrash, contract-change severity, and UI proof for internal messages and staged text.
- **GREEN:** Added `CONDENSED_REFRESH_USER_TURNS = 5`, `MIN_REFRESH_TURN_GAP = 2`, `MAX_INTERNAL_STEPS_WITHOUT_REFRESH = 12`, and `MAX_ACTIVE_MS_WITHOUT_REFRESH = 600000`; classified contract identity changes as full-grounding invalidation; fixed first-response safety to non-rendered buffering; required typed internal delivery or explicit renderer filtering; and defined stale-field clearing when the current run has no boot contract.
- **AUDIT:** PASS — the FID now separates full grounding from condensed refresh, persisted truth from runtime cache, logical turns from internal steps, contract-change invalidation from ordinary refresh, and static evidence from operator-only live evidence. Every proposed cross-layer change has a named file family, compatibility rule, deterministic state rule, and verification artifact.
- **ADVERSARIAL:** PASS — no unresolved planning contradiction remains. The design does not weaken boot safety, does not force full reads every five turns, does not count retries as user turns, does not allow a checkpoint to survive a contract identity change, does not permit repeated same-epoch compaction refreshes, and does not claim live cadence/UI behavior can be proven without direct operator evidence.
- **CHANGE DELTA:** Final self-correction/convergence pass; no production code changed.

## Missed Questions

1. **Does “re-ground every five turns” mean four full-file reads every five turns?** → No. Full grounding is session-init/invalidation behavior; the five-turn baseline is only for the generated condensed refresh.
2. **Who owns the logical user-turn counter?** → The shared run/session boundary, not the inner loop. Tool calls, retries, subagent steps, and internal compliance steering do not count as user turns.
3. **Can `protocolRead` remain only in `EchoEnforcement`?** → No. It may remain as a runtime projection, but a serializable checkpoint must be authoritative across clone/resume.
4. **Should a missing checkpoint be trusted for compatibility?** → No. Treat it as ungrounded once, perform the ritual, then persist a valid checkpoint.
5. **What invalidates a checkpoint?** → Variant, resolved protocol path, source mode, protocol version, grounding-set fingerprint, or required-path set changes; malformed or unknown incompatible versions also invalidate it.
6. **What if compaction removes only the refresh but not the checkpoint?** → The checkpoint may remain valid, but the next context must receive one deduplicated condensed refresh because critical context is absent.
7. **What if compaction removes the checkpoint evidence and the refresh?** → Re-ground according to the defined safe path; do not claim the old checkpoint is enough without a current in-context sentinel/evidence rule.
8. **Can a first response be streamed before grounding and corrected later?** → No. The fixed implementation contract is a non-rendered per-step buffer; the hidden-renderer alternative is not an allowed substitute in this FID.
9. **Should compliance messages be user-role messages?** → No new implementation may rely on ordinary visible user-role messages. Use a typed internal event; a compatibility message class is acceptable only with explicit CLI/headless filtering and replacement semantics.
10. **What happens for SDK users without `protocolVariant`?** → The effective gate is false even if stale checkpoint fields exist; stale protocol/checkpoint fields are ignored and cleared on the next serialized state. The optional checkpoint field never arms the gate by itself.
11. **Does subagent pre-seeding change?** → No. Subagents inherit the parent's compliant context and are exempt from main-agent boot refresh accounting.
12. **Does the existing generated refresh content need a new source of truth?** → No new protocol-content generator is authorized here; preserve the generated bundle and only change cadence/delivery mechanics unless a separate FID is opened.
13. **What was the operator-only boundary?** → Visual transcript suppression, absence of first-answer flash, and actual cadence in `bun dev` required direct harness evidence. The operator has since confirmed the live grounding behavior passed for this release scope; the confirmation remains operator evidence rather than a durable transcript artifact.

## Code Verification Evidence

- [x] Single-agent ECHO protocol read 0-EOF before authoring.
- [x] Existing grounding FID, session-state, enforcement, stream, compaction, and Nova conventions inspected.
- [x] Active FID number availability checked: 0812-001 through 0812-004 are allocated; 0812-005 is unused.
- [x] Grounding checkpoint, adaptive cadence/backstops, history-replacement refresh, stream staging, and durable validation implementation are present in the working tree.
- [x] Proposed solution's authoritative schema, migration, deterministic cadence/anti-thrash constants, invalidation, buffering, internal delivery, and visibility rules are represented in code.
- [x] Focused runtime/SDK validation and workspace typechecks/lint/format evidence were recorded during implementation.
- [x] Direct mutation-boundary and context-pruner coverage — implementation evidence and operator validation accepted for this release scope.
- [x] Harness four-file/legacy-path behavior — operator-confirmed grounding session passed with the required boot-read behavior.
- [x] Direct `bun dev` grounding evidence — operator confirmed the live grounding behavior passed; no repeated-grounding regression remains reported.
- [x] FID status reflects the current implementation state: `fixed`; implementation, focused validation, and operator live evidence are complete.

### Loop 4 — Current-scope convergence under master FID-2026-0812-006

- **RED:** Re-audited the current record against the implemented checkpoint, adaptive cadence, buffering, deduplication, and resume behavior. The remaining work is evidence and lifecycle closure, not a reimplementation of the grounding architecture.
- **GREEN:** Restricted execution to implementation-audit evidence, direct `set_messages`/context-pruner mutation coverage, harness four-file and legacy-state coverage, and direct `bun dev` cadence/transcript/compaction/resume checks. Preserved universal first-session gating, SDK no-contract legacy behavior, and subagent boundaries.
- **AUDIT:** PASS — the current reconciliation and code-verification section distinguished landed implementation from then-unchecked closure evidence; the master register recorded the same cross-layer evidence boundary.
- **ADVERSARIAL:** PASS — no unresolved planning issue remained at that historical stage. The later operator confirmation is authoritative for the current live grounding boundary.
- **CHANGE DELTA:** Current-scope reconciliation only; no production implementation changed.

### Loop 6 — Operator grounding closure reconciliation

- **RED:** Reconciled the remaining grounding boundary against the operator's successful live session and confirmation that grounding behavior passed.
- **GREEN:** Accepted the live session as operator evidence for this release scope while preserving the mandatory first-session ritual, five-turn refresh contract, complete grounding set, checkpoint persistence, buffering, deduplication, and SDK legacy boundary.
- **AUDIT:** PASS — checkpoint schema and restoration remain at `common/src/types/session-state.ts:207` and `packages/agent-runtime/src/echo/enforcement.ts:147-162`; cadence remains at `packages/agent-runtime/src/echo/enforcement.ts:453`; the live harness result is operator-confirmed and no credential or sensitive transcript is persisted.
- **ADVERSARIAL:** PASS — the operator result is not inflated into claims about untested providers or release infrastructure; no gate weakening, protocol-boundary change, credential exposure, remote/GitHub action, or unrelated redesign is introduced.
- **CHANGE DELTA:** Operator-confirmed grounding closure; documentation only.

### Loop 7 — Operator-confirmed grounding closure reconciliation

- **RED:** Reconciled the remaining grounding evidence boundary against the operator's successful live grounding session and confirmation that grounding behavior passed.
- **GREEN:** Accepted the live session as operator evidence while preserving the mandatory first-session ritual, five-turn refresh contract, complete grounding set, checkpoint persistence, buffering, deduplication, and SDK legacy boundary.
- **AUDIT:** PASS — the checkpoint schema/restoration remains at `common/src/types/session-state.ts:207` and `packages/agent-runtime/src/echo/enforcement.ts:147-162`; the five-turn cadence remains at `packages/agent-runtime/src/echo/enforcement.ts:453`; and the operator-confirmed live result is recorded without persisting credentials or sensitive transcript content.
- **ADVERSARIAL:** PASS — the operator result is not inflated into claims about unrelated providers or release infrastructure; no gate weakening, protocol-boundary change, credential exposure, remote/GitHub action, or redesign is introduced.
- **CHANGE DELTA:** Operator-confirmed grounding closure; documentation only.

### Loop 8 — Local lifecycle closure

- **RED:** Reconciled the implemented checkpoint, adaptive cadence, buffering, deduplication, resume behavior, and operator-confirmed live grounding result. No grounding behavior remains pending in this release scope.
- **GREEN:** Closed only the adaptive grounding scope. Preserved mandatory first-session grounding, complete grounding-set enforcement, five-turn refresh semantics, SDK no-boot-contract behavior, subagent boundaries, and the no-release boundary.
- **AUDIT:** PASS — agent-runtime enforcement tests passed 27/27; loop tests passed 16/16; common, agent-runtime, and SDK typechecks passed. The SDK multi-file run also encountered unrelated module-resolution errors from `resources/freebuff-main`; those are not counted as grounding failures, and the focused checkpoint/enforcement suites passed. The local FID ledger and documentation gates are run after the archive move.
- **ADVERSARIAL:** PASS — closure does not fabricate additional cadence/compaction evidence, weaken grounding, expose protocol or credentials, or authorize release/GitHub operations.
- **CHANGE DELTA:** Lifecycle closure only; no production implementation change.

## Resolution

- **Closed Date:** 2026-08-12
- **Fix Description:** The persisted adaptive grounding-refresh implementation is present: serializable checkpoints, logical-turn cadence, internal-step/time backstops, complete grounding-set tracking, history-replacement refreshes, staged ungrounded output, and durable checkpoint validation. Operator confirmation resolves the previously open live grounding evidence boundary.
- **Tests Added:** Runtime enforcement/loop/stream regressions and SDK RunState serialization coverage are present in the working tree.
- **Verification Evidence:** Prior focused validation recorded 46 runtime tests and 6 SDK tests passing, plus common/agent-runtime/SDK typechecks, ESLint, Prettier, and clean diff checks. The operator confirmed the live grounding behavior passed; no repeated-grounding regression remains reported.
- **Archived:** Moved to `dev/fids/archive/` after closure; no remote or GitHub operation is involved.

## Lessons Learned

- Runtime enforcement objects cached by object identity cannot be the sole source of truth for resumable session contracts.
- A cadence described in user turns must be measured at the user-turn boundary, not inferred from model/tool loop iterations.
- A post-stream completion gate cannot undo a response already rendered to the operator; safety ordering must be visible in the delivery architecture.
- Internal compliance context needs its own lifecycle and rendering semantics instead of accumulating as synthetic user transcript content.
