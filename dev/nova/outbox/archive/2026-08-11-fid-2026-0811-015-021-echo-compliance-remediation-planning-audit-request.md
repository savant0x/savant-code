<!-- markdownlint-disable MD013 -->

# Nova Audit Request — ECHO Compliance Remediation FID Package

**Date:** 2026-08-11
**To:** Nova — independent third-party ECHO auditor
**Scope:** Planning-phase audit of six remediation child FIDs and their master organization FID
**Status:** AWAITING NOVA REVIEW
**Priority:** High — implementation remains blocked until this review and separate operator approval are complete
**Method requested:** Read every listed document 0-EOF, independently verify material claims against the current working tree, and return PASS, FAIL, or NEEDS-REVIEW with exact `path:line` evidence. Do not modify source files, FIDs, protocol configuration, release artifacts, or any other repository files during the review.

> **Planning-only boundary:** This request asks for an independent review of planning artifacts. It does not authorize implementation, cleanup, deletion, archival movement, commits, release operations, publication, deployment, credential use, or remote-state changes.
>
> **Document policy:** The current single-agent protocol requires no signatures, no author attribution, and no agent names in authored repository artifacts. This request intentionally contains no attribution field or signature.

---

## Approval Boundary

Nova is asked to assess whether the seven FIDs are internally coherent, evidence-grounded, correctly scoped, and ready for an operator approval decision.

A Nova planning verdict does **not** authorize production implementation. Any implementation requires all of the following, separately:

1. explicit operator approval of this master and the selected child scopes;
2. an independent Nova verdict covering the same planning scope; and
3. a later implementation audit with runtime, static, and repository-gate evidence.

A PASS may mean only that the planning package is ready for operator decision. A partial or conditional verdict authorizes no work beyond the conditions explicitly stated in Nova's response. The FIDs must remain active with `Status: analyzed` unless and until implementation and closure evidence independently justify a later status transition.

---

## Documents Under Review

### Governing protocol and channel documents

1. `ECHO-single-agent.md`
2. `dev/echo-v0.1.2-single-agent.md`
3. `protocol.config.yaml`
4. `dev/nova/README.md`
5. `templates/FID-TEMPLATE.md`
6. `scripts/fid-ledger.ts`

### Active FID package

7. `dev/fids/FID-2026-0811-021-echo-compliance-remediation-master.md`
8. `dev/fids/FID-2026-0811-015-ehel-turn-end-and-scanner-lifecycle.md`
9. `dev/fids/FID-2026-0811-016-devmode-ehel-bypass.md`
10. `dev/fids/FID-2026-0811-017-fid-governance-and-attribution-schema.md`
11. `dev/fids/FID-2026-0811-018-production-type-and-error-boundaries.md`
12. `dev/fids/FID-2026-0811-019-active-reference-and-placeholder-hygiene.md`
13. `dev/fids/FID-2026-0811-020-audit-evidence-and-closure-reconciliation.md`

### Source evidence to inspect where needed

Nova may inspect additional current source files required to verify a claim. The initial evidence anchors include:

- `packages/agent-runtime/src/echo/enforcement.ts`
- `packages/agent-runtime/src/echo/post-write-scanners.ts`
- `packages/agent-runtime/src/tools/tool-executor/native.ts`
- `packages/agent-runtime/src/tools/tool-executor/custom.ts`
- `packages/agent-runtime/src/tools/handlers/tool/transition-phase.ts`
- `packages/agent-runtime/src/run-agent-step/loop.ts`
- `packages/agent-runtime/src/run-agent-step/loop-iteration.ts`
- `sdk/src/run/execution/session-state.ts`
- `sdk/src/run-state/serialization.ts`
- `sdk/src/run/execution/snapshot.ts`
- `cli/src/commands/init.ts`
- `templates/FID-TEMPLATE.md`
- `scripts/fid-ledger.ts`
- `scripts/validate-repository.ts`
- `dev/session-summaries/`
- `dev/nova/outbox/`
- `dev/fids/archive/`

If an evidence claim cannot be reached or independently reproduced, mark it `NEEDS-REVIEW`; do not convert an unreachable check into PASS.

---

## Review Targets

### Target 1 — Master organization and coverage

Review `dev/fids/FID-2026-0811-021-echo-compliance-remediation-master.md` for:

- complete and non-overlapping ownership of the confirmed findings;
- accurate registration of exactly six children plus the master;
- explicit installation order and approval gates;
- an acyclic dependency graph whose edge list matches the narrative and child metadata;
- correct sequencing of FID-015, FID-016, FID-017, FID-018, FID-019, and FID-020;
- explicit boundaries around source changes, historical records, untracked artifacts, releases, and closure;
- no implicit authorization hidden in the installation plan;
- honest distinction between planning convergence and implementation closure.

**Expected verdict:** PASS only if the master covers the current findings without silently expanding scope, has a coherent dependency graph, and keeps implementation blocked pending the stated approvals.

### Target 2 — FID-015: EHEL turn-end and scanner lifecycle

Review `FID-2026-0811-015-ehel-turn-end-and-scanner-lifecycle.md` for:

- exact evidence that `evaluateTurnEnd()` lacks a production caller;
- exact evidence that the scanner receives `getWrittenFileContent: () => undefined`;
- correct treatment of unavailable content versus valid empty-file content;
- a single shared production lifecycle boundary covering all relevant main-agent completion paths;
- bounded post-write content handling that does not reread unrelated user changes from disk;
- explicit strict/hybrid/subagent compatibility boundaries;
- production call-graph, scanner, failure-path, and turn-state verification requirements;
- no claim that isolated class tests prove production reachability.

**Expected verdict:** PASS only if the proposed lifecycle repair is specific, content-complete, bounded, and independently verifiable.

### Target 3 — FID-016: `devMode` EHEL bypass

Review `FID-2026-0811-016-devmode-ehel-bypass.md` for:

- exact reachability of the native EHEL bypass and custom-tool restriction bypass;
- complete producer/consumer scope for `devMode` across CLI, SDK, native, custom, programmatic, subagent, sandbox, and FSM paths;
- separation of protocol enforcement from capability, sandbox, and debugging policy;
- fail-closed behavior for absent, malformed, persisted, or user-controlled policy values;
- strict-session negative tests and explicitly bounded non-strict development behavior;
- no assumption that logging a bypass is equivalent to enforcing the protocol.

**Expected verdict:** PASS only if the plan preserves immutable protocol gates in strict sessions and does not replace one broad boolean with another implicit policy.

### Target 4 — FID-017: FID governance and no-attribution schema

Review `FID-2026-0811-017-fid-governance-and-attribution-schema.md` for:

- the contradiction between the current template's attribution fields and the active no-attribution policy;
- provenance-aware scope for active documents versus immutable historical artifacts;
- correct treatment of active session summaries and current outbox documents;
- filename, ID, status, relationship, dependency, cycle, and tracked-state validation;
- rejection or downgrade of untracked closure claims;
- preservation of historical records without mass rewriting;
- consistency with the actual `scripts/fid-ledger.ts` behavior and its required headings/statuses.

**Expected verdict:** PASS only if the proposed schema is enforceable for current artifacts while preserving historical evidence and refusing to treat untracked files as authoritative closure records.

### Target 5 — FID-018: Production type and error boundaries

Review `FID-2026-0811-018-production-type-and-error-boundaries.md` for:

- exact production evidence for each representative cast or suppression;
- a complete production-only inventory rather than a raw lexical-count claim;
- classification of legitimate platform adapters, compatibility shims, validated boundaries, and real unsafe assertions;
- production caller/reachability evidence for every proposed change;
- explicit handling of fallible operations and bounded, non-sensitive diagnostics;
- malformed-input, thrown-error, redaction, and compatibility test requirements;
- exclusion of tests, fixtures, and generated output unless they affect shipped behavior.

**Expected verdict:** PASS only if the plan avoids a blanket cast/catch rewrite and defines evidence that can distinguish a real Law 6 or Law 14 defect from a safe adapter.

### Target 6 — FID-019: Active references and placeholder hygiene

Review `FID-2026-0811-019-active-reference-and-placeholder-hygiene.md` for:

- distinction between current actionable references and historical quotations;
- correct classification of removed-path references in changelog, archives, scratchpad, Nova correspondence, active docs, source, and tests;
- provenance-aware handling of `TODO`, `placeholder`, development defaults, UI placeholders, and substitution markers;
- inclusion of shipped generated artifacts only when they are runtime inputs and exclusion when regeneration is authoritative;
- current boot/test references resolving to existing canonical paths;
- explicit FID linkage for unresolved production placeholders;
- no zero-match claim that would destroy useful historical evidence.

**Expected verdict:** PASS only if the plan corrects actionable current truth while preserving historical records and legitimate runtime vocabulary.

### Target 7 — FID-020: Audit evidence and closure reconciliation

Review `FID-2026-0811-020-audit-evidence-and-closure-reconciliation.md` for:

- exact tracked/untracked, index, history, and live-call-graph evidence underlying the false-closure finding;
- distinct evidence classes for working-tree, tracked-dirty, clean-candidate, and release-certified states;
- deterministic manifest identity, bounded redacted transcripts, command identity, exit codes, baseline, and scope;
- rejection or downgrade of closed claims that lack tracked-state or live implementation proof;
- correct handling of the untracked archived-looking 2026-0811 records;
- no rewriting, deletion, archival movement, or disposition without explicit operator approval;
- a final independent reconciliation step after the child implementations.

**Expected verdict:** PASS only if the evidence contract proves provenance and does not confuse a checksum, green dirty-tree command, or FID prose with implementation authority.

### Target 8 — Cross-FID perfection-loop convergence

For all seven FIDs, verify that the documents contain and use:

- a specific RED issue catalog;
- a concrete GREEN proposal with scope and tradeoffs;
- citation-based AUDIT evidence, including exact absence-shaped commands where relevant;
- an adversarial challenge that tests the proposed plan rather than merely restating it;
- final convergence or self-correction evidence after independent review;
- missed questions with answers folded into the plan;
- explicit implementation-pending status;
- no unsupported test, build, closure, or Nova-verdict claims;
- no forbidden attribution fields or signatures;
- no contradiction between child metadata and the master's register/order/dependency graph.

**Expected verdict:** PASS only if all seven records are mutually consistent and approval-ready without claiming implementation closure.

### Target 9 — Historical false-closure and stale-record boundary

Independently assess whether the package correctly distinguishes the untracked archived-looking 2026-0811 records and older historical records from current active planning artifacts.

Verify:

- whether the cited untracked files are actually untracked in the current working tree;
- whether any current FID, changelog, session summary, Nova message, or validator treats those files as authoritative closure evidence;
- whether the package makes any unsupported claim about historical records;
- whether the requested remediation could accidentally rewrite immutable history or silently dispose of unrelated working-tree files.

**Expected verdict:** PASS only if the package reports the evidence gap honestly and leaves disposition to explicit operator decision.

---

## Required Independent Checks

Please perform these checks or equivalent independent checks and include the exact command, relevant output, and exit code:

1. Read each document under review 0-EOF.
2. Verify each cited source path and line against the current working tree.
3. Re-run the production search for `evaluateTurnEnd(` excluding tests and report the complete result.
4. Re-run the production search for `runPostWriteScanners` and `getWrittenFileContent` and verify the callback behavior.
5. Verify native and custom `devMode` bypass paths and their callers.
6. Verify active FID inventory, metadata, relationships, dependency cycles, and forbidden attribution fields.
7. Verify the template/policy contradiction and classify active versus historical attribution matches.
8. Verify the tracked/untracked status of the archived-looking 2026-0811 artifacts without modifying them.
9. Distinguish repository validation/format results from runtime implementation evidence.
10. Confirm that no production implementation or artifact disposition was authorized by this request.

If a command cannot run because of environment limitations, report the exact limitation and mark the affected claim `NEEDS-REVIEW`.

---

## Requested Nova Response Format

Please return a new response in `dev/nova/inbox/` containing:

1. **Target 1–9:** one of `PASS`, `FAIL`, or `NEEDS-REVIEW` for each target.
2. Exact `path:line` evidence for every material PASS, FAIL, and unresolved contradiction.
3. The exact commands and exit codes used for absence-shaped or repository-state claims.
4. A list of unsupported claims, stale evidence, scope overlap, missing acceptance criteria, or dependency errors.
5. Any smallest required FID corrections, without redesigning the program without evidence.
6. Confirmation that all seven active FIDs and the governing documents were reviewed 0-EOF.
7. Confirmation that implementation, deletion, archival movement, commit, release, publication, deployment, credential use, and remote-state mutation were not performed.
8. Confirmation that no signatures, attribution fields, or agent names were added to the reviewed planning artifacts.
9. Overall verdict using exactly one of:
   - `PASS — planning approved for operator decision`
   - `FAIL — planning revision required`
   - `NEEDS-REVIEW — named evidence remains unavailable`
10. Explicit statement that any planning verdict is not final operator approval and does not authorize implementation or closure.

Do not modify any repository file while reviewing. If a finding is conditional on a current working-tree fact, identify the baseline and classify the evidence as working-tree evidence rather than clean or release certification.
