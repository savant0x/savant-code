<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: Agent-Steering Teacher — Homegrown Master Plan

**Filename:** `FID-2026-0813-011-agent-steering-teacher-master.md`
**ID:** FID-2026-0813-011
**Severity:** critical
**Status:** closed
**Created:** 2026-08-13
**YAGNI-Compliance:** Verified — integration-ready scope with explicit gates
**Depends On:** none

---

## Summary

This master FID defines the complete, homegrown Agent-Steering Teacher for Savant-Code. The teacher trains developers to direct and evaluate AI coding agents through a headless exercise engine, a fail-closed capability-based sandbox, behavior-first grading, deterministic mutation contracts, a read-only `/learn` overlay, local progression, and an honest ZTAP process-evidence adapter. The plan deliberately rejects freeCodeCamp extraction, worker-only sandbox claims, single-corpus trust domains, AST-only correctness, unconstrained LLM grading, and “proof-of-skill” marketing.

The feature is implemented, independently audited by Nova (**PASS**), and operator-closed on 2026-08-13; archived with the child set.

## Environment

- **OS:** Windows target; cross-platform support only where capability evidence exists
- **Language/Runtime:** TypeScript/Bun 1.3.14; React/OpenTUI 0.2.2; ECHO v0.2.0
- **Tool Versions:** Existing ZTAP implementation, SQLite conventions, agent runtime
- **Commit/State:** Working-tree planning state; ZTAP is complete and archived, not an active parallel run

## Detailed Description

### Problem

The exploratory teacher plan had a strong product thesis but started with corpus scale and UI before resolving arbitrary-code execution, private answer isolation, learner target, grading validity, and progression claim boundaries. The companion architecture documents also remained fCC-centered after the homegrown pivot.

### Expected Behavior

A learner can complete a local exercise without touching the project repository: write constraints, observe Forge output, receive deterministic sandbox evidence, review a controlled mutation, submit a critique, receive bounded grading, and record a versioned local result. The system remains honest when a sandbox or grader is unavailable.

### Root Cause

Pedagogy, execution trust, grading authority, and presentation had been conflated into one exploratory flow.

### Evidence

- `dev/build-orders/2026-08-13-agent-steering-teacher-build-order.md` now defines the resolved decisions, phase gates, integration map, schemas, and child registry.
- `docs/design/Agent-Steering Teacher Homegrown Architecture.md` is the authoritative architecture.
- `docs/design/Agent-Steering Teacher Architecture.md` and `docs/design/Agent-Literacy Teacher Deep Research.md` are explicitly marked superseded historical fCC research.
- `ECHO.md` defines Law 12 as sensitive-data protection; it does not define “no telemetry” as the entire law.
- `dev/fids/archive/FID-2026-0813-001-ztap-provenance-master.md` records completed ZTAP and Nova implementation PASS; the teacher consumes it through an adapter.

## Impact Assessment

### Affected Components

- `common/` teacher contracts and validation
- `packages/agent-runtime/src/teacher/` exercise engine, sandbox API, and graders
- dedicated sandbox backend and hostile-code fixtures
- `cli/src/commands/learn/` and presentation-only OpenTUI components
- `.savant/teacher/` generated packs and local progression DB
- `protocol.config.yaml` namespaced teacher settings
- ZTAP adapter and documentation

### Risk Level

- [x] Critical: arbitrary code execution, false grading, or private-answer leakage are security/trust failures
- [ ] High: major feature broken with workaround
- [ ] Medium: feature degraded
- [ ] Low: cosmetic

## Proposed Solution

### Approach

Implement in dependency order:

1. pedagogy, schemas, and threat model;
2. sandbox capability runner and escape suite;
3. one complete headless vertical slice;
4. build-time corpus authoring and validation;
5. equivalence grader;
6. mutation/detection grader;
7. headless-to-OpenTUI `/learn` surface;
8. local progression and ZTAP adapter; and
9. final integration/security/adversarial audit.

The operator owns learning objectives and acceptance contracts. Agents propose
content; independent validation and operator approval are required. Public
challenge packs and private answer packs are separate trust domains.

### Child FID registry

| FID | Scope | Depends on |
| --- | --- | --- |
| `FID-2026-0813-012` | Pedagogy, contracts, threat model | — |
| `FID-2026-0813-013` | Capability-based sandbox runner | 012 |
| `FID-2026-0813-014` | Headless vertical-slice exercise | 012, 013 |
| `FID-2026-0813-015` | Homegrown corpus authoring/validation | 012, 014 |
| `FID-2026-0813-016` | Equivalence grader | 014, 015 |
| `FID-2026-0813-017` | Mutation/detection grader | 014, 015 |
| `FID-2026-0813-018` | `/learn` read-only overlay | 016, 017 |
| `FID-2026-0813-019` | Progression and ZTAP adapter | 018 |
| `FID-2026-0813-020` | Integration/security/adversarial audit | 013, 016, 017, 018, 019 |

### Verification

Before implementation approval:

- active FID ledger is valid with one master, complete child register, resolved dependencies, and no cycles;
- targeted documentation passes Markdownlint and Prettier;
- each child has a complete planning Perfection Loop and unanswered questions;
- no teacher production code exists;
- ZTAP status is accurately described as complete and independently audited.

Before feature closure:

- sandbox escape matrix and platform capability report pass;
- vertical slice passes end to end;
- corpus validation and private-answer reachability pass;
- equivalence and detection calibration/held-out gates pass;
- exercise FSM and cancellation/cleanup tests pass;
- overlay zero-authority tests pass;
- progression privacy/migration/no-network tests pass;
- full repository gates pass; and
- Nova independently audits implementation before operator closure.

## Perfection Loop

### Loop 1 — RED

- **RED:** The initial plan had four architectural blockers: worker-only isolation was treated as a security boundary; generated known-good/tests were treated as authoritative; AST comparison and binary LLM grading were over-relied upon; and fCC research remained the companion source after the homegrown pivot. The coordination note also described ZTAP as active even though it is complete and archived.
- **GREEN:** Replaced the design with a capability-based sandbox, fail-closed unavailable state, human-owned pedagogy, public/private packs, build-time authoring, behavior-first grading, deterministic mutation contracts, headless engine before UI, honest ZTAP adapter, and superseded-document markers.
- **AUDIT:** Direct reads of `ECHO.md`, current protocol configuration, existing SQLite/CLI patterns, archived ZTAP FIDs, the exploratory build order, and companion research support the corrected boundaries. The new build order and architecture cross-reference the same decisions.
- **ADVERSARIAL:** The concept may still fail if steering literacy does not transfer or if sandbox guarantees cannot be proven. The vertical slice and hard platform escape gate are explicit stop conditions, not deferred risks.
- **CHANGE DELTA:** Large by design: architecture corrected before FID implementation.

### Missed Questions

1. **Is the target learner a beginner?** → No implicit beginner promise; V1 targets developers/reviewers who can read basic JavaScript.
2. **Can a worker thread safely run hostile code?** → Not as a security claim; use a capability backend and fail closed.
3. **Who owns known-good solutions and tests?** → Operator-owned objective, agent-assisted proposal, independent validation, operator approval.
4. **Can Forge access the private pack through errors or imports?** → No; separate trust domains and reachability tests cover non-obvious paths.
5. **Can one green run prove learner mastery?** → No; record attempt evidence and require repeated/held-out transfer for stronger progression.
6. **Can the Adversary be the sole grading oracle?** → No; deterministic contracts and prechecks bound semantic adjudication.
7. **What does ZTAP certify?** → Process integrity for an attempt, not identity, independence, or universal skill.
8. **Does “no telemetry” come from Law 12?** → No; teacher privacy is an explicit product policy layered with Law 12 sensitive-data protection.
9. **What happens when a backend is unsupported?** → The exercise is unavailable and no code is executed or credit awarded.
10. **Does `/learn` own execution?** → No; the headless engine owns lifecycle and the overlay renders state.

### Code Verification Evidence

- [x] All referenced current documents exist and were read in full before planning edits.
- [x] Existing ZTAP records are archived and Nova implementation sign-off is present.
- [x] Existing SQLite and CLI patterns were inspected before proposing reuse.
- [x] No teacher production implementation code was written.
- [x] Child FID files 012–020 exist with required metadata, dependencies, and planning loops.
- [ ] Sandbox, grader, UI, and progression implementation evidence — intentionally pending; no production code is authorized by this planning loop.

### Loop 2 — Independent audit and self-correction

- **RED:** Re-read found two residual integration risks: the build order could still be interpreted as authorizing corpus-scale work before the vertical slice, and the FID registry needed a terminal cross-cutting audit child.
- **GREEN:** The build order now makes the vertical slice a mandatory P2 gate and adds FID-020 as the final integration/security audit with dependencies on all trust-sensitive children.
- **AUDIT:** `scripts/fid-ledger.ts` requirements were checked: one master, all active children listed by the master, child master references, dependency resolution, required headings, active statuses, and no forbidden attribution metadata.
- **ADVERSARIAL:** A valid ledger proves document topology, not architecture. The final audit FID therefore requires runtime sandbox, grading calibration, privacy, and call-graph evidence before implementation closure.
- **CHANGE DELTA:** <10% after the major Loop-1 correction.

### Loop 3 — Final convergence

- **RED:** No remaining architecture-blocking question. Platform capabilities, grading thresholds, and corpus approvals are explicitly implementation gates.
- **GREEN:** The plan is fully integratable through existing common/runtime/CLI/SQLite/ZTAP boundaries without changing ECHO laws or duplicating crypto/database infrastructure.
- **AUDIT:** The build order, authoritative architecture, child registry, dependency graph, and trust-domain model agree. No implementation code is present.
- **ADVERSARIAL:** The strongest residual challenge is that the product could teach recognition without transferable judgment. Held-out transfer evidence is now required before progression claims are strengthened.
- **CHANGE DELTA:** <2% from Loop 2.

- **POST-PERFECTION-LOOP VERDICT:** Planning architecture is fully integratable and verified. Implementation remains gated on operator approval, child execution order, sandbox capability evidence, and Nova implementation audit.

### Loop 4 — Full FID-set re-run — 2026-08-13

- **RED:** Re-reading all children found qualitative gates but no shared default thresholds for sandbox repeatability, escape testing, or critique calibration. The prior master was already the organizing FID; creating a second master would add graph ambiguity.
- **GREEN:** Kept `FID-2026-0813-011` as the single master/organizing FID, added default quantitative gates to the build order and architecture, and propagated the gate ownership to FIDs 012, 013, 016, and 017.
- **AUDIT:** `bun test scripts/fid-ledger.test.ts` → 5 pass / 0 fail; 10 active FIDs all report `verified`; targeted Markdownlint and Prettier pass; no production teacher code exists.
- **ADVERSARIAL:** These thresholds are policy gates, not evidence. Nova must reject any implementation claim that reports the thresholds as passed without runtime output, and any sandbox escape must block the feature.
- **CHANGE DELTA:** <10% from the previous master record.

### Loop 5 — ZTAP refactor re-convergence — 2026-08-13

- **RED:** Since Loop 4, the working tree decomposed the ZTAP provenance
  modules (`common/src/provenance.ts` → `common/src/provenance/`;
  `packages/agent-runtime/src/provenance/session.ts` split into `registry.ts`,
  `receipt.ts`, and `verdict.ts`; the clean-process validator moved under
  `cli/src/commands/attest/clean-process/`) and bumped the repository version
  `0.0.23 → 0.0.24`. Because FID-019 consumes ZTAP through an adapter, this
  re-opened the question of whether any converged teacher assumption changed.
- **GREEN:** Re-read the master, build order, and child set and verified the
  ZTAP public surface is unchanged. `@savant-code/common/provenance` (now with
  an explicit `./provenance` export entry) and the
  `packages/agent-runtime/src/provenance` index still export the same symbols.
  The clean-process validator keeps its `clean-process-validator.ts` barrel and
  its FID-008 independence invariant (its purity test now covers the whole
  module tree). No teacher FID, build order, or architecture document
  references a changed ZTAP path; the build order's only ZTAP path reference
  (`packages/agent-runtime/src/provenance/`) is unchanged, and no teacher
  artifact pins the old `0.0.23` version.
- **AUDIT:** `bun test scripts/fid-ledger.test.ts` → 5 pass / 0 fail; grep
  confirmed zero stale ZTAP-path or version references across the teacher FIDs,
  build order, and homegrown architecture; the refactored ZTAP surface is
  pinned by new direct unit tests (common 13, agent-runtime pure helpers 5)
  plus the existing provenance (23) and /attest + clean-process (15) suites,
  and typecheck ×4 passes.
- **ADVERSARIAL:** Unchanged export names are not proof of unchanged semantics.
  The added unit tests and re-run integration suites are the evidence the
  surface is behaviorally stable. FID-019 must still consume ZTAP through the
  public index exports, never the internal submodules.
- **CHANGE DELTA:** 0% to the plan — a verification pass, not a design
  correction.

- **POST-PERFECTION-LOOP VERDICT:** The converged teacher plan stands
  unchanged. Implementation remains gated on operator approval; the next
  implementation step is P0 / FID-2026-0813-012 (pedagogy and contracts).

### Loop 6 — Full implementation — 2026-08-13

- **RED:** Planning converged but no production teacher code existed; every
  child remained `verified` (planning-only) and the build order still carried
  its "IMPLEMENTATION NOT APPROVED" header.
- **GREEN:** Implemented the complete teacher in dependency order 012 → 020,
  each child consuming only the converged contracts:
  `common/src/teacher/` (contracts, zod, `./teacher` export), the capability
  sandbox (`sandbox/`), the headless exercise engine (`exercise/`), corpus
  authoring/validation (`corpus/`), the equivalence + detection graders
  (`grading/`), the read-only `/learn` overlay + command, and the local
  progression store + ZTAP adapter (`progression/`). The ZTAP adapter reuses
  the existing `signPayload`/JCS primitives — no duplicate crypto.
- **AUDIT:** Every child's acceptance gate is covered by focused tests: sandbox
  escape containment + deterministic fixtures (12), engine lifecycle +
  cancellation/retry/timeout/redaction (11), corpus repeatability (20 runs),
  mutation witness and isolation scans (12), equivalence alternate/hardcode
  classification (5), detection calibration thresholds (6), overlay
  zero-authority + lifecycle (12), progression migration/idempotency/
  corruption/downgrade/privacy/no-network (10), and the cross-cutting
  integration + call-graph audit (5). The end-to-end integration test drives
  corpus → sandbox → engine → real graders → progression → ZTAP signing.
- **ADVERSARIAL:** Green local tests are not a release claim. The sandbox is a
  restricted `node:vm` subprocess whose OS-boundary dimensions are honestly
  reported `not_enforced` and fail closed to `unavailable`; the 100-case
  detection calibration gate is demonstrated on a labeled set, not the full
  100-case corpus; and progression records are `local-unverified` unless a
  ZTAP key signs them. Nova independent audit and operator closure remain
  required before any release.
- **CHANGE DELTA:** Implementation phase; the converged plan itself is
  unchanged (0% design delta).

## Implementation Closure — COMPLETE

- **Implemented:** 2026-08-13 under the operator's automation level 3 grant, in dependency order 012 → 020 (plus the standalone 021), after Nova planning PASS and operator go.
- **Delivered:** Nine children (012–020) implement the complete homegrown teacher: shared contracts, capability sandbox, headless exercise engine, corpus authoring/validation, equivalence + detection graders, the live `/learn` command + read-only overlay, local progression + ZTAP adapter, and the integration/security audit. Follow-ups wired the `/learn` command to the live Forge+sandbox+graders, added a per-attempt signed ZTAP receipt, and persisted completed attempts to the progression store.
- **Independent review:** Nova's implementation audit response at `dev/nova/inbox/2026-08-13-fid-2026-0813-011-teacher-implementation-audit-response.md` returned **PASS — implementation independently verified; eligible for operator closure** over the complete scope (base implementation + live `/learn` wiring, per-attempt ZTAP receipt, progression persistence, and `/learn progress`), reproducing 100 focused teacher tests plus full common 612 and agent-runtime 891 suites with no blocking findings. Operator closure granted 2026-08-13. This working-tree closure is not a commit, push, publication, deployment, or release authorization.

## Resolution

- **Closed Date:** 2026-08-13.
- **Fix Description:** All nine children (012–020) implemented end to end under this master: shared contracts, capability sandbox, headless exercise engine, corpus authoring/validation, equivalence + detection graders, live `/learn` command + read-only overlay, local progression + ZTAP adapter, and the integration/security audit.
- **Tests Added:** 100 focused teacher tests (common 5, agent-runtime 65, cli 30) including the integration audit suite (5).
- **Verification Evidence:** typecheck ×4 PASS; `bun run validate:repository` PASS; full suites common 612 and agent-runtime 891 green; ESLint zero warnings; Prettier clean; `lint:md` clean; fid-ledger 5/5; Nova implementation audit **PASS**. No release authorization is implied.
- **Archived:** Yes — moved to `dev/fids/archive/` after closure evidence was recorded.

## Lessons Learned

Security boundaries, grading validity, and honest product claims must be designed before curriculum scale or UI polish. A generated corpus is a release artifact, not a source of truth, and a signed local process record is not automatically a credential.
