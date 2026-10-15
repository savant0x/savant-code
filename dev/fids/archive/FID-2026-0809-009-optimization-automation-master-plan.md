<!-- markdownlint-disable MD013 -->

# FID: Optimization and Automation Program Master Plan

**Filename:** `FID-2026-0809-009-optimization-automation-master-plan.md`
**ID:** FID-2026-0809-009
**Severity:** critical
**Status:** closed (2026-08-09 — implementation independently signed off)
**Created:** 2026-08-09
**YAGNI-Compliance:** Verified for planning scope

> **Planning-only boundary:** This master FID and its child FIDs define and converge a future
> implementation program. They do not authorize production implementation. No production code,
> package script, configuration, release workflow, provider behavior, runtime state contract, or
> documentation generator may be changed under this program until final operator approval and an
> independent Nova sign-off are both explicitly recorded. No Nova sign-off is present in this session,
> and none is inferred or manufactured.

---

## Summary

The repository's six observed issues form one optimization and automation program: canonical metadata,
validation coverage, runtime observability, state ownership, subagent propagation, and provider-registry
exception control. A program-wide bootup prerequisite, `FID-2026-0809-010-single-agent-bootup-healing.md`,
ensures the selected single-agent protocol is resolved before those optimization contracts are implemented. The program must reduce synchronization burden without replacing working systems
prematurely. Its governing strategy is to establish one machine-checkable source of truth for each
invariant, instrument before refactoring, classify state before changing serialization, make child
propagation explicit, preserve the completed provider-registry work, and make every required gate
fail closed when coverage drifts.

This master FID orders the six optimization child FIDs, records the program-wide bootup prerequisite,
defines dependency and handoff contracts, identifies cross-FID invariants, and establishes the later
implementation sequence. It is a planning artifact
only. A converged plan is not a green light to implement; unresolved design choices remain explicit
decision gates for the approval review.

## Environment

- **OS:** Windows (`win32`)
- **Language/Runtime:** TypeScript monorepo; Bun; strict TypeScript; React/OpenTUI CLI; SDK
- **Tool Versions:** Bun project contract `1.3.14`; repository validation commands from `protocol.config.yaml`
- **Commit/State:** `main`; six child FIDs newly created in `dev/fids/`; no production changes authorized
- **Protocol:** Single-agent ECHO adaptation `dev/echo-v0.1.2-single-agent.md` governs this session
- **Approval state:** Operator final approval pending; Nova sign-off pending; implementation blocked

## Program Objectives

1. Make metadata relationships explicit and machine-checked.
2. Make validation coverage discoverable, deterministic, and fail-closed.
3. Reduce runtime uncertainty through bounded, redacted observability before extraction or optimization.
4. Make durable, ephemeral, UI, and transport state ownership explicit and testable.
5. Make subagent propagation typed, bounded, authorization-safe, and replayable.
6. Preserve the unified provider registry as the canonical source while automating its remaining exceptions.
7. Ensure every new workspace, provider, state field, event, and runtime boundary has an automated alignment check.

## Non-Goals and Hard Boundaries

- No production implementation in this planning session.
- No provider rewrite; the archived unified-registry FID remains historical ground truth for completed work.
- No wholesale agent-loop rewrite before runtime measurements identify a specific bottleneck or correctness seam.
- No forced collapse of runtime state, persistence state, transport events, and UI projections into one type.
- No automatic rewriting of stale metadata, settings, release receipts, or historical records.
- No assumption that convergence equals closure, implementation readiness, or approval.
- No claim of Nova review or sign-off unless an actual independent sign-off artifact is supplied.

## Program-Wide Bootup Prerequisite

| FID | Responsibility | Required before |
|---|---|---|
| `FID-2026-0809-010-single-agent-bootup-healing.md` | Resolve the active single-agent marker, protocol file, configuration, enforcement path, generated prompt, and boot tests into one fail-closed contract | All implementation FIDs in this program |

This prerequisite is a planning dependency, not a production implementation authorization. It must be
approved and independently signed off together with every child FID selected for implementation.

## Ordered Child FIDs

| Order | FID | Planning responsibility | Depends on | Handoff output |
|---:|---|---|---|---|
| 1 | `FID-2026-0809-003-canonical-metadata-authority.md` | Define version domains, authorities, and allowed relationships | None | Approved metadata-policy contract |
| 2 | `FID-2026-0809-004-validation-manifest-command-parity.md` | Define workspace/category gate coverage and command parity | 003 | Validation-manifest schema and gate-level contract |
| 3 | `FID-2026-0809-005-runtime-execution-boundaries.md` | Instrument and measure runtime phases and terminal paths | 003, 004 | Bounded trace and lifecycle evidence contract |
| 4 | `FID-2026-0809-006-state-ownership-schema-convergence.md` | Classify state and define serialization/replay boundaries | 004, 005 | Durable-field and event/state conversion contract |
| 5 | `FID-2026-0809-007-subagent-propagation-contract.md` | Define child inheritance, overrides, exclusions, limits, and replay | 004, 005, 006 | Typed child propagation and fan-out contract |
| 6 | `FID-2026-0809-008-provider-registry-completion-audit.md` | Automate provider exceptions, generated surfaces, and migration safety | 003, 004; historical FID-0809-001 | Provider exception and drift-test contract |

The numerical ordering is the proposed implementation ordering after the bootup prerequisite. A later
FID may refine an earlier contract only through an explicit cross-FID correction; it may not silently
create a second source of truth.

## Cross-FID Invariants

### Invariant 1 — One authority per domain

Every metadata, command, state, provider, and propagation rule identifies its authority. Derived
surfaces are generated or parity-checked. Intentional independence is represented as policy, not
left as an undocumented exception.

### Invariant 2 — Read-only validation before mutation

All new validators and parity checks fail with actionable evidence. They do not silently rewrite
source files, settings, release receipts, generated output, or historical FIDs.

### Invariant 3 — Bounded and redacted evidence

Runtime traces, gate output, propagation snapshots, and provider diagnostics are bounded and must not
capture credentials, full prompts, unrestricted message histories, or sensitive tool inputs.

### Invariant 4 — Durable state survives its declared boundary

Any field classified as durable has schema, round-trip, resume/cancellation, and relevant event/replay
coverage. Ephemeral and UI-only data is not accidentally persisted.

### Invariant 5 — Authorization is enforced at execution

Model-visible tools and executor-authorized tools must agree, with the executor remaining the security
boundary. Parent tool visibility is never treated as child authorization.

### Invariant 6 — Every required gate is discoverable

A workspace, provider, event, state field, or runtime path cannot become unvalidated merely because a
new contributor forgot to update a manually maintained list.

### Invariant 7 — Existing behavior is preserved until evidence justifies change

Instrumentation and parity checks precede structural refactors. Any behavior change requires its own
scope, tests, approval, and convergence evidence.

### Invariant 8 — Approval gates are independent of planning convergence

All child and master FIDs may reach planning convergence while implementation remains blocked. Final
operator approval and Nova sign-off are separate required conditions.

## Implementation Sequence After Approval

This sequence is intentionally not executable in the current session.

1. **Approval gate:** Obtain explicit operator approval for the master, the bootup prerequisite, and
   every child FID intended for implementation, then obtain an independent Nova sign-off covering that
   same scope. Record both in the appropriate review artifact without agent attribution or fabricated
   signatures. Partial approval does not authorize unapproved FIDs.
2. **Bootup foundation:** Implement and verify FID-010 first. Resolve the selected single-agent protocol
   from one existing source, fail closed on missing files, and prove harness/single-agent separation.
3. **Metadata foundation:** Implement and verify FID-003. Resolve the known policy decision for
   `VERSION` versus `protocol.config.yaml` rather than hard-coding equality without rationale.
4. **Validation foundation:** Implement and verify FID-004 against the metadata policy. Establish
   fast/full/release gate levels and structured evidence.
5. **Runtime evidence:** Implement and verify FID-005. Instrument existing boundaries, prove cleanup,
   and establish performance baselines before proposing extractions.
6. **State contract:** Implement and verify FID-006 using runtime evidence. Add schema, conversion,
   round-trip, resume, cancellation, and replay coverage without collapsing representations.
7. **Child contract:** Implement and verify FID-007 using the state and validation contracts. Prove
   authorization parity, propagation, event identity, cancellation, cost handling, and limits.
8. **Provider completion:** Implement and verify FID-008 using metadata and validation foundations,
   preserving the archived registry implementation and testing only remaining exceptions/drift edges.
9. **Program audit:** Re-run all root typechecks, tests, lint, Markdownlint, formatting checks,
   call-graph scans, generated-surface checks, and release diagnostics. Resolve any new FID rather than
   silently expanding scope.

## Gate Matrix

| Gate | Required before next child | Evidence required |
|---|---|---|
| FID convergence | Yes | RED/GREEN/AUDIT record, including an optional adversarial challenge within AUDIT, or SELF-CORRECT record with citations |
| Approval | Before implementation only | Explicit operator approval plus independent Nova sign-off |
| Static validation | After each implementation | Exact typecheck/lint output with zero errors/warnings |
| Runtime validation | After behavior changes | Deterministic targeted tests and relevant full suites |
| Reachability | After wiring | Production call-graph search with matches or explicit NEEDS-REVIEW |
| Drift validation | Before program completion | Metadata, manifest, provider, generated-surface, and release checks |
| Documentation | Before closure | Updated docs/changelog only after verified implementation |

## Rollback and Stop Conditions

- Stop if an implementation changes behavior outside the approved child FID.
- Stop if a validator cannot distinguish intentional independence from drift.
- Stop if runtime instrumentation introduces unbounded memory, sensitive data, or semantic changes.
- Stop if a state conversion loses a durable field or makes resume behavior ambiguous.
- Stop if child authorization differs between model-visible and executor-available tools.
- Stop if a provider exception cannot be represented without duplicating registry truth.
- Stop if any required command or workspace is omitted from the manifest.
- Create or update a separate FID for newly discovered issues; do not hide them in a green pass.

## Perfection Loop

### Loop 1 — RED

- **RED:** The six issues share synchronization and boundary risk but have different safe change
  surfaces. Child documents existed without a single dependency graph, common acceptance gates, or a
  formal implementation stop condition. The provider registry also has completed historical work that
  must not be reopened.
- **GREEN:** Ordered six-FID program established: metadata, validation, runtime, state, subagent,
  provider. Cross-FID invariants, handoffs, gate matrix, approval boundary, and rollback conditions
  are defined. Instrumentation-first and parity-first strategies prevent premature rewrites.
- **AUDIT:** The six child FIDs, the FID template, active-FID guidance, the single-agent protocol, and
  the archived provider-registry FID were inspected. Exact source-boundary evidence is cited in the
  child FIDs: metadata (`protocol.config.yaml:11`, package manifest version lines), commands
  (`package.json:36-37`, `evals/package.json:9`, `protocol.config.yaml:21,25`), runtime
  (`packages/agent-runtime/src/run-agent-step/loop.ts:29`, `loop-iteration.ts:59`,
  `packages/agent-runtime/src/tools/stream-parser.ts:38`, `packages/agent-runtime/src/tools/tool-executor/native.ts:65`),
  state (`common/src/types/session-state.ts:87,222`, `sdk/src/run-state/types.ts:11`), subagents
  (`spawn-agent-utils.ts:67,296`, `spawn-agents.ts:93,160`), and providers
  (`common/src/providers/registry.ts:19`, `validate.ts:71`, `sdk/src/impl/model-provider.ts:109-140`).
  No production implementation is claimed or authorized.
- **AUDIT ADVERSARIAL CHECK:** The plan was challenged for circular dependencies, hidden implementation
  authority, forced type unification, provider-registry scope creep, unbounded tracing, unsupported
  verification claims, and fabricated Nova status. The sequence breaks the dependency cycle by making
  validation the contract boundary, keeps runtime/state ordering explicit, and marks approval as pending.
- **CHANGE DELTA:** New master planning document only; no production code or package behavior changed.

### Loop 2 — Final Cross-FID Re-Audit

- **RED:** The post-010 audit found one missing program dependency: the six optimization FIDs did not each state that bootup healing must precede implementation. It also found that single-agent config selection needed an explicit variant-precedence rule.
- **GREEN:** Added FID-010 as the program-wide prerequisite, updated child dependency records, and required explicit `harness | single-agent` selection so `single_agent.protocol` cannot be overridden by generic `savant.protocol` precedence.
- **AUDIT:** All nine planning documents were read and cross-referenced. FID metadata/status lines are present in each document; the master prerequisite table is `:68-75`; child order is `:80-85`; FID-010's explicit selector and precedence contract is documented in its Expected Behavior and Proposed Solution sections. No production implementation was performed.
- **AUDIT ADVERSARIAL CHECK:** The program remains planning-only, the no-signature rule is honored, historical documents are not rewritten, harness behavior remains separately scoped, and operator approval plus Nova sign-off remain independent gates.
- **CHANGE DELTA:** Cross-FID dependency and bootup-selection corrections only.

### Missed Questions

1. **Why is metadata before validation?** → Validation needs an explicit authority/relationship policy;
   otherwise it merely automates an ambiguous list.
2. **Why is runtime before state?** → State and snapshot optimization must be informed by actual phase,
   cleanup, and performance evidence rather than assumptions.
3. **Why is provider work last?** → The registry is mostly consolidated and should consume the shared
   metadata/validation machinery rather than create another gate system.
4. **Can all six FIDs be implemented in parallel?** → No. Contract dependencies and shared invariants
   require ordered foundations; only isolated tests/documentation can be parallelized after contracts exist.
5. **What authorizes implementation?** → Both explicit final operator approval and an actual independent
   Nova sign-off; neither is present here.
6. **What does “fully converged” mean in this planning session?** → The documents have no known
   actionable planning contradiction, their dependencies and acceptance criteria are explicit, and all
   unresolved implementation/approval items are honestly marked pending. It does not mean code is fixed.
7. **What happens if Nova disagrees?** → Return the affected FID(s) to RED/SELF-CORRECT, record the
   objection and revised contract, then re-run the cross-FID audit. Do not implement around a disagreement.
8. **What if the first implementation reveals a broader issue?** → Stop, create a scoped FID, and
   re-run the affected dependency and master audits before proceeding.

### Code Verification Evidence

- [x] Six optimization child FIDs and the program-wide bootup prerequisite exist in `dev/fids/`.
- [x] FID-010 is referenced as the program-wide prerequisite and is not hidden as an untracked dependency.
- [x] Child dependencies, implementation boundaries, and approval restrictions are explicit.
- [x] Single-agent no-attribution rule overrides the generic template's Author field and is honored;
  no `Author`, `Fixed By`, `Verified By`, or signature field is added.
- [x] No production code, package metadata, scripts, or configuration changed in this planning pass.
- [ ] Operator final approval — pending.
- [ ] Nova sign-off — pending; no sign-off inferred.
- [ ] Implementation and runtime verification — intentionally pending.

## Resolution

- **Status:** Closed and archived on 2026-08-09.
- **Implementation result:** Master plan is a completed governance artifact; it does not itself add runtime behavior.
- **Operator approval:** Build approval supplied in-session.
- **Independent audit:** PASS recorded in `dev/nova/inbox/2026-08-09-fid-2026-0809-003-010-optimization-automation-implementation-sign-off-response.md`.
- **Release state:** Included in pending unreleased `0.0.23`; no tag, push, publication, or deployment was performed.
- **Historical scope:** Prior planning and convergence evidence is retained; no historical FID archives were rewritten.

## Lessons Learned

Optimization is primarily an invariant-management problem. The durable improvement is not merely a
faster runtime; it is a repository in which metadata, validation, state, propagation, providers, and
release evidence cannot silently diverge.

## Closure Evidence

- **FID:** FID-2026-0809-009
- **Implementation audit:** PASS; independent response cited above.
- **Cross-cutting checks:** no credentials used; no provider routing changes; RunState backward compatibility preserved; bounded propagation verified; no-signature policy followed.
- **Environment note:** release validation still requires pinned Bun `1.3.14`; the prior host ran Bun `1.3.11`, an environment-only publication blocker.
