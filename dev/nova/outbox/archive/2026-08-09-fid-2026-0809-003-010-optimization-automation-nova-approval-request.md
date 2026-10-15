<!-- markdownlint-disable MD013 -->

# Nova Approval Request — Optimization, Automation, and Single-Agent Bootup Planning Program

**Date:** 2026-08-09
**To:** Nova — independent third-party ECHO auditor
**Scope:** Planning convergence and implementation-readiness review for the master FID, the single-agent bootup prerequisite, and six ordered optimization FIDs.
**Status:** AWAITING NOVA REVIEW
**Priority:** High — implementation remains blocked until this review and separate operator approval are complete.
**Method requested:** Read the referenced FIDs and active protocol marker/specification 0-EOF. Independently verify the claims against the current working tree. Return PASS/FAIL/NEEDS-REVIEW per target with exact `path:line` evidence, an overall verdict, and any critical/high objections. Do not modify source files, FIDs, configuration, or release artifacts.

> **Active protocol rule:** The current single-agent protocol is `dev/echo-v0.1.2-single-agent.md`,
> selected by `single_agent.protocol` in `protocol.config.yaml`. It requires no signatures, no author
> attribution, and no agent names in authored documents. This request intentionally contains no signature
> or attribution field.

---

## Approval Boundary

This request asks Nova to independently review the **planning documents**, not to approve or perform
production implementation automatically.

Implementation requires both:

1. explicit final operator approval for the master, FID-010, and each child FID selected for implementation; and
2. an independent Nova approval covering that same scope.

A Nova PASS on planning readiness does not itself authorize code changes unless the operator also gives
final approval. A partial or conditional PASS authorizes only the explicitly approved scope, subject to
its conditions. No implementation, commit, release, push, publish, or deployment is requested here.

**Mutation boundary for this request:** working-tree planning artifacts only. No production code,
package scripts, protocol configuration, generated prompts, runtime behavior, release files, tags,
remote services, credentials, or durable settings may be changed during Nova review.

---

## Documents Under Review

### Governing protocol and marker

1. `ECHO-single-agent.md`
2. `dev/echo-v0.1.2-single-agent.md`
3. `protocol.config.yaml`
4. `dev/nova/README.md`

### Master and prerequisite

5. `dev/fids/FID-2026-0809-009-optimization-automation-master-plan.md`
6. `dev/fids/FID-2026-0809-010-single-agent-bootup-healing.md`

### Ordered optimization FIDs

7. `dev/fids/FID-2026-0809-003-canonical-metadata-authority.md`
8. `dev/fids/FID-2026-0809-004-validation-manifest-command-parity.md`
9. `dev/fids/FID-2026-0809-005-runtime-execution-boundaries.md`
10. `dev/fids/FID-2026-0809-006-state-ownership-schema-convergence.md`
11. `dev/fids/FID-2026-0809-007-subagent-propagation-contract.md`
12. `dev/fids/FID-2026-0809-008-provider-registry-completion-audit.md`

### Relevant implementation evidence for planning verification

13. `common/src/util/protocol-config.ts`
14. `packages/agent-runtime/src/echo/enforcement.ts`
15. `packages/agent-runtime/src/tools/tool-executor/native.ts`
16. `agents/savant/system-prompt.ts`
17. `packages/agent-runtime/src/echo/__tests__/enforcement.test.ts`
18. `common/src/util/__tests__/protocol-config.test.ts`
19. `package.json`
20. `evals/package.json`
21. `common/src/types/session-state.ts`
22. `sdk/src/run-state/types.ts`
23. `sdk/src/run-state/mutations.ts`
24. `packages/agent-runtime/src/tools/handlers/tool/spawn-agent-utils.ts`
25. `packages/agent-runtime/src/tools/handlers/tool/spawn-agents.ts`
26. `common/src/providers/registry.ts`
27. `common/src/providers/validate.ts`
28. `scripts/generate-provider-reference.ts`
29. `cli/src/utils/settings.ts`
30. `sdk/src/impl/model-provider.ts`

---

## Planning Program

### Target 1 — Master orchestration and dependency order

Review `FID-2026-0809-009` for:

- explicit planning-only and approval boundaries;
- FID-010 as the program-wide prerequisite;
- ordered FIDs 003 → 004 → 005 → 006 → 007 → 008;
- handoff outputs and cross-FID invariants;
- implementation sequence and stop conditions;
- separation between planning convergence, operator approval, Nova approval, implementation, and closure;
- no fabricated Nova status or document attribution.

**Expected verdict:** PASS if the program is acyclic, bounded, implementation-ready as a plan, and does
not authorize work before both approvals.

### Target 2 — Single-agent bootup prerequisite

Review `FID-2026-0809-010` and the marker/spec for:

- corrected marker path `dev/echo-v0.1.2-single-agent.md`;
- removal of absent `FREEREADME.md` from active marker requirements;
- no-signature/no-attribution policy;
- explicit `harness | single-agent` session-variant selector;
- explicit precedence: single-agent selects `single_agent.protocol`, harness selects top-level `protocol`;
- no silent fallback from a missing single-agent protocol to `ECHO.md`;
- production enforcement, generated prompt, active test, and CLI smoke-test scope;
- child propagation of protocol identity versus a bare boolean read flag;
- fail-closed behavior and active-reference drift checks.

**Expected verdict:** PASS if the plan heals the split-brain boot contract without duplicating protocol
files or changing harness behavior implicitly.

### Target 3 — Canonical metadata authority (FID-003)

Verify that the plan:

- distinguishes product, synchronized package, harness, single-agent, schema, agent-template, and toolchain versions;
- does not force independent protocol/schema versions to equal the product release version;
- fails read-only on malformed/missing/drifted metadata;
- binds release/resume identity only where policy requires it;
- does not rewrite historical records.

**Expected verdict:** PASS if the authority/relationship model is explicit and machine-checkable without
creating a second ambiguous source of truth.

### Target 4 — Validation manifest and command parity (FID-004)

Verify that the plan:

- detects omitted workspaces and gate categories;
- preserves specialized commands such as `evals` `test:v2` where semantically meaningful;
- separates fast, full, release, unit, integration, E2E, browser, docs, and generated-surface gates;
- does not make credential/network-dependent tests silently part of deterministic unit validation;
- prefers a parity checker over an unnecessary orchestration rewrite when sufficient;
- consumes the bootup and metadata foundations.

**Expected verdict:** PASS if new workspace/gate omissions fail before merge or release.

### Target 5 — Runtime execution boundaries (FID-005)

Verify that the plan:

- instruments before refactoring;
- covers normal, abort, provider/tool error, retry exhaustion, payment error, setup cancellation, and stream failure;
- bounds and redacts trace data;
- proves cleanup and terminal outcomes;
- avoids full prompt/history/credential capture;
- preserves semantics until measurements justify extraction;
- observes explicit protocol identity.

**Expected verdict:** PASS if the plan can improve performance visibility without introducing trace-driven
security, memory, or semantic regressions.

### Target 6 — State ownership and schema convergence (FID-006)

Verify that the plan:

- keeps runtime, persistence, transport, and UI representations distinct where appropriate;
- classifies fields as durable, ephemeral, UI projection, or transport;
- requires durable-field round-trip, resume, cancellation, and event/replay coverage;
- treats selected protocol identity deliberately rather than serializing protocol documents accidentally;
- measures snapshot cost before changing clone strategy.

**Expected verdict:** PASS if state drift becomes mechanically detectable without a risky total rewrite.

### Target 7 — Subagent propagation contract (FID-007)

Verify that the plan:

- separates inherited, overridden, and excluded child fields;
- propagates resolved protocol identity, state, model/provider, tools, events, costs, cancellation, and cleanup safely;
- preserves normal versus inline-agent distinctions;
- proves model-visible tool filtering equals executor authorization;
- bounds fan-out, depth, concurrency, and total budget;
- preserves deterministic parent report ordering while correlating concurrent events by IDs.

**Expected verdict:** PASS if child correctness, authorization, cost, and event-tree invariants are explicit.

### Target 8 — Provider registry completion audit (FID-008)

Verify that the plan:

- preserves archived unified-registry implementation as historical ground truth;
- enumerates intentional exceptions rather than duplicating registry metadata;
- checks generated provider references, URLs, IDs, catalogs, setup, migration, removal, and fallback;
- consumes metadata, validation, and bootup foundations;
- does not change provider behavior under a planning-only FID.

**Expected verdict:** PASS if future provider additions cannot silently reintroduce fragmented metadata.

### Target 9 — Cross-FID Perfection Loop convergence

Verify that every FID 003–010 and master FID 009 contains:

- initial RED issue catalog;
- GREEN proposal and tradeoffs;
- citation-based AUDIT evidence;
- adversarial challenge recorded inside or alongside AUDIT where applicable;
- a second cross-program re-audit after FID-010/master dependency changes;
- missed questions and answers;
- explicit implementation-pending status;
- no unsupported test/pass claims;
- no signatures or agent-attribution fields.

**Expected verdict:** PASS if the whole set is mutually consistent and no FID is claimed `fixed`, `verified`,
or `closed`.

---

## Convergence Evidence Matrix

The following matrix is a navigation aid for Nova's independent 0-EOF review. It records the second
cross-program pass already present in each planning artifact; it is not a Nova verdict and does not
substitute for Nova's independent evidence review.

| Target | Artifact | Initial loop | Final re-audit | Current boundary |
|---|---|---|---|---|
| Master | `dev/fids/FID-2026-0809-009-optimization-automation-master-plan.md` | `:183-208` | `:210-216` | `:252-255`; analyzed, blocked |
| Bootup | `dev/fids/FID-2026-0809-010-single-agent-bootup-healing.md` | `:175-193` | `:195-201` | `:230-237`; analyzed, blocked |
| Metadata | `dev/fids/FID-2026-0809-003-canonical-metadata-authority.md` | `:134-150` | `:152-158` | `:185-188`; analyzed, blocked |
| Validation | `dev/fids/FID-2026-0809-004-validation-manifest-command-parity.md` | `:128-142` | `:144-150` | `:177-180`; analyzed, blocked |
| Runtime | `dev/fids/FID-2026-0809-005-runtime-execution-boundaries.md` | `:122-137` | `:139-145` | `:171-174`; analyzed, blocked |
| State | `dev/fids/FID-2026-0809-006-state-ownership-schema-convergence.md` | `:122-136` | `:138-144` | `:170-173`; analyzed, blocked |
| Subagent | `dev/fids/FID-2026-0809-007-subagent-propagation-contract.md` | `:129-143` | `:145-151` | `:177-180`; analyzed, blocked |
| Providers | `dev/fids/FID-2026-0809-008-provider-registry-completion-audit.md` | `:132-147` | `:149-155` | `:182-185`; analyzed, blocked |

Every listed loop contains RED, GREEN, citation-based AUDIT, and an adversarial check. The final
re-audit entries record the FID-010 dependency and the cross-FID correction specific to that artifact.
No artifact is marked `fixed`, `verified`, `closed`, or archived. This matrix is planning evidence
only; implementation remains prohibited pending both approvals stated above.

## Requested Nova Response Format

Please return a new response in the inbox with:

1. **Target 1–9:** PASS, FAIL, or NEEDS-REVIEW.
2. Exact `path:line` evidence for every PASS and FAIL.
3. Any unresolved contradiction, missing acceptance criterion, unsupported claim, or scope overlap.
4. Confirmation that all nine planning artifacts were reviewed 0-EOF.
5. Confirmation that no production implementation is authorized by this request.
6. Confirmation that the no-signature/no-attribution policy is followed.
7. Overall verdict:
   - `PASS — planning approved for operator decision`, or
   - `FAIL — planning revision required`, or
   - `NEEDS-REVIEW — named evidence remains unavailable`.
8. Explicit statement that Nova's verdict is planning approval only and does not replace final operator approval.

Do not create or modify production files while reviewing. If a target fails, identify the smallest FID
revision required; do not redesign the entire program without evidence.
