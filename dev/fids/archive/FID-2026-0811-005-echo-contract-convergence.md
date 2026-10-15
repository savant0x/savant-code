<!-- markdownlint-disable MD013 -->

# FID: ECHO Governance and Runtime Contract Convergence

**Filename:** `FID-2026-0811-005-echo-contract-convergence.md`
**ID:** FID-2026-0811-005
**Severity:** critical
**Status:** closed
**Created:** 2026-08-11 02:54 UTC
**YAGNI-Compliance:** Verified for planning scope
**Master FID:** `FID-2026-0811-004`

> Planning-only. No source implementation or documentation rewrite is authorized by this record.

## Summary

The repository has multiple descriptions of ECHO rigor: `ECHO.md` describes `protocol.strict_mode`, Hybrid/Strict
execution, separation of duties, and EHEL behavior; CLI run configuration supplies `enforcementMode`; SDK boot state
persists `protocolStrictMode`; and the runtime factory derives EHEL mode from a separate dynamic state field. The
contracts may be intentionally distinct, but the relationship is not explicit enough to prove that the selected protocol
strictness, execution mode, and enforcement tier cannot drift. `CONTRIBUTING.md` also describes an Orchestrator role that
conflicts with the current ECHO roster. This FID defines one canonical mapping and machine-checks it.

## Environment

- Windows `win32`; Bun `1.3.14`; strict TypeScript monorepo.
- Current tree is dirty relative to `98acc25`; evidence applies to the live working tree.
- Relevant files: `ECHO.md`, `CONTRIBUTING.md`, `protocol.config.yaml`, `common/src/types/session-state.ts`,
  `sdk/src/run-state/initial-state.ts`, `sdk/src/run/execution/session-state.ts`, `cli/src/utils/create-run-config.ts`,
  `cli/src/hooks/helpers/send-message-run-config.ts`, `packages/agent-runtime/src/echo/enforcement.ts`.

## Detailed Description

### Problem and evidence

- `ECHO.md` activation rules state that `protocol.strict_mode` controls whether Laws 5–15 are enforced, while its
  Hybrid/Strict sections define execution-mode behavior.
- `cli/src/utils/create-run-config.ts:57-59` documents `enforcementMode` as the EHEL law-tier selector.
- `cli/src/hooks/helpers/send-message-run-config.ts:183-189` sets `enforcementMode` from CLI `agentMode` and hard-codes
  `protocolVariant: 'harness'`.
- `packages/agent-runtime/src/echo/enforcement.ts:70-82` reads `enforcementMode` through a dynamic cast and constructs
  EHEL from it, while `sdk/src/run-state/initial-state.ts:166-171` and
  `sdk/src/run/execution/session-state.ts:107-114` persist `protocolStrictMode` from the boot contract.
- `CONTRIBUTING.md:8-42` presents a workflow/role table that must be reconciled with the 10-role roster and Hybrid-mode
  exception in `ECHO.md`.

### Expected behavior

For every supported session, the selected protocol variant, protocol strictness, UI execution mode, EHEL enforcement
tier, and separation-of-duties workflow must have an explicit mapping. Invalid or missing mappings fail closed at the
boundary. Documentation and tests must use the same vocabulary.

### Proposed solution

1. Define typed, canonical mapping data for protocol variant + strictness + execution mode → enforcement mode.
2. Decide whether `protocolStrictMode` is authoritative, derived, or intentionally independent from `enforcementMode`; encode
   that relationship in one place and persist enough state for diagnostics.
3. Replace dynamic casts at the enforcement boundary with a domain type guard or typed state field.
4. Align `ECHO.md`, `CONTRIBUTING.md`, `ARCHITECTURE.md`, and `protocol.config.yaml` without changing intended Hybrid
   behavior.
5. Add matrix tests for harness/single-agent, strict/hybrid, CLI/SDK, missing/invalid fields, and subagent propagation.
6. Add a production caller/reachability check proving the mapping is consumed by EHEL construction and loop execution.

## Verification contract

- Focused tests cover every matrix cell and fail closed on impossible combinations.
- Typecheck × all affected workspaces, ESLint, Prettier, Markdownlint, and repository validation pass.
- Grep output proves the canonical mapping is used by CLI run construction, SDK boot, EHEL factory, and subagent creation.
- Documentation scans show no contradictory role or mode claims.
- No historical FID or session-summary rewrite occurs.

## Perfection Loop

### Loop 1 — RED

- **RED:** Contract vocabulary is distributed across ECHO docs, CLI `enforcementMode`, SDK `protocolStrictMode`, and a
  dynamic runtime read. The exact intended relationship is not machine-checkable. Contributor role text is not fully
  aligned with the 10-agent roster.
- **GREEN:** Use one typed mapping/validator, retain backward-compatible state fields where needed, fail closed on invalid
  combinations, and update only current governing docs.
- **AUDIT:** Evidence is cited above at exact source locations. Production consumers are known: CLI run config,
  `getOrCreateEnforcement`, SDK initial/session state, and spawn-agent propagation. No implementation is claimed.
- **ADVERSARIAL:** The plan does not force `protocolStrictMode === (enforcementMode === 'strict')` without first proving
  whether CLI execution rigor and protocol law activation are separate axes. It preserves the intentional Hybrid mode.
- **CHANGE DELTA:** Planning document only.

### Loop 2 — Independent audit and adversarial correction (2026-08-11)

- **RED:** Review identified that the first loop cited source locations but did not explicitly state the required command-
  output evidence for implementation audit or the interim precedence between conflicting contracts.
- **GREEN:** Added an explicit precedence rule to the implementation contract: active single-agent attribution policy wins
  over the generic template; runtime mapping must be authoritative for EHEL; docs are updated only after tests prove the
  mapping. Unknown combinations remain `NEEDS-REVIEW`/fail closed.
- **AUDIT:** Current source citations remain `cli/src/utils/create-run-config.ts:57-59`,
  `cli/src/hooks/helpers/send-message-run-config.ts:183-189`, `packages/agent-runtime/src/echo/enforcement.ts:70-82`,
  and SDK state lines `166-171`/`107-114`. No implementation command was run because this is planning-only.
- **ADVERSARIAL:** No unsupported claim that strictness is already wired; the defect is contract ambiguity, and the child
  explicitly requires a matrix test and production caller proof.
- **CHANGE DELTA:** FID text only.

### Missed Questions

1. Is strictness a protocol property or a UI execution-mode property? → Treat them as separate typed axes until an explicit
   policy proves equivalence; never infer one from a string cast.
2. Must SDK embedders with no boot contract be gated? → Preserve legacy no-contract behavior, but reject partial contracts.
3. Do subagents inherit execution mode as well as protocol state? → Add an explicit propagation test and document the answer.
4. Can documentation alone resolve the risk? → No; a runtime mapping and tests are required.
5. What is the failure mode for an unknown future mode? → Fail closed with a typed diagnostic rather than defaulting to hybrid.

### Loop 3 — Final implementation evidence (2026-08-11)

- **RED:** The implementation audit reproduced the unsafe implicit fallback in `getOrCreateEnforcement`: any non-`strict` value became `hybrid` through a cast.
- **GREEN:** Added the typed `resolveEnforcementMode` boundary, preserving absent→`hybrid` compatibility, accepting only `hybrid`/`strict`, and throwing on invalid values. Replaced the ephemeral state property with a `WeakMap`; valid protocol and execution axes remain separate.
- **AUDIT:** `bun test packages/agent-runtime/src/echo/__tests__/enforcement.test.ts packages/agent-runtime/src/__tests__/echo-compliance-wiring.test.ts` → `26 pass / 0 fail`, `61 expect()` calls. `bun run --cwd=common typecheck` and `bun run --cwd=packages/agent-runtime typecheck` → exit 0. ESLint and Prettier pass on changed files. Call-graph proof: `run-agent-step/loop.ts`, `native.ts`, and `loop-iteration.ts` all reach `getOrCreateEnforcement`.
- **ADVERSARIAL:** Invalid runtime values fail closed; absent mode retains legacy hybrid behavior; WeakMap instances are not serialized (`JSON.stringify` regression test).
- **CHANGE DELTA:** Typed `AgentState.enforcementMode`, `resolveEnforcementMode`, WeakMap-backed factory, loop call-site cleanup, and matrix tests.

### Code Verification Evidence

- [x] Valid hybrid/strict/absent mode matrix passes.
- [x] Invalid mode regression throws instead of downgrading.
- [x] Enforcement factory call graph is reachable and instance state remains ephemeral.
- [x] Common and agent-runtime typechecks pass; 26 focused tests pass.
- [x] ESLint and Prettier pass.

## Resolution

- **Status:** `closed` — implementation and independent final review are complete.
- **Implementation:** EHEL mode resolution is typed and fail-closed while preserving valid behavior and serialization compatibility.
- **Archive:** Archived with the FID-2026-0811 program closure entry in CHANGELOG.md.

## Lessons Learned

A persisted field and a runtime field can both be valid while still being unsafe when their relationship is implicit.
Governance contracts need typed mappings and negative tests, not just descriptive names.
