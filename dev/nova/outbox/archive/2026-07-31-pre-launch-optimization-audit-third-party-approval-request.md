# Nova Third-Party Approval Request — Pre-Launch Optimization and A–Z Audit Package

**Date:** 2026-07-31
**From:** Buffy / Savant-Code Orchestrator
**To:** Nova — independent third-party ECHO auditor
**Re:** Pre-launch optimization audit, master FID, and child-FID package
**Priority:** High — hard pre-coding and pre-promotion gate
**Method requested:** Source-verified third-party review. Read the actual files 0–EOF, independently run commands where available, and apply the Cross-Agent Claim Rule.

---

## Hard Approval Gate — Read First

This is an **approval request, not an implementation request**.

No coding, test-driven fix, documentation implementation, scope reduction, FID status change, FID archival, release preparation, npm publication, binary upload, advertising, social promotion, or public launch activity may begin until both approvals exist:

1. **Operator approval:** The repository operator explicitly approves the reviewed master/child scope.
2. **Nova third-party approval:** Nova provides a written, source-verified verdict explicitly approving the package for implementation planning.

Operator approval alone is insufficient. Nova approval alone is insufficient. A `CONDITIONAL`, `NEEDS CORRECTION`, or `FAIL` verdict is **not** approval to code. If Nova identifies any correction, the relevant FID/request must be amended and returned for another independent review before implementation.

The only actions permitted before this gate is satisfied are read-only investigation, FID/request drafting, evidence collection, and correction of factual errors in the audit documents themselves. No production source, release artifact, public launch artifact, FID lifecycle metadata, or changelog may be changed as part of this request.

### Required approval evidence

Nova’s response must include:

- the exact request filename reviewed;
- the exact master and child FID filenames reviewed;
- a verdict of `PASS`, `CONDITIONAL`, or `FAIL`;
- an explicit statement that the verdict is **not** implementation approval unless it says `PASS`;
- a separate statement answering: **“Is the master/child FID package approved to proceed to implementation planning, subject to operator approval?”**;
- all refuted, unverifiable, or incomplete claims;
- commands run and their exit status where commands are available;
- any required corrections before a PASS;
- the auditor identity/date/model or external audit context, if available.

A PASS must explicitly state that Nova approves the **scope and process gate**, not that the code is already fixed or launch-ready. Nova PASS never authorizes coding. Coding requires a separate, explicit operator approval recorded in the `Approval Record` section of the master FID after the Nova PASS is received.

### Approval Record location and format

The master FID must contain an `## Approval Record` section before implementation begins. That section must record, in order:

1. Nova’s exact response path, date, verdict, and explicit PASS statement.
2. The operator’s explicit approval of the master and child-FID scope after reviewing Nova’s PASS.
3. The approved implementation boundary, including any accepted corrections or exclusions.
4. Confirmation that telemetry remains deferred unless separately approved.

No implementation begins until all four records exist. Until then, every child and the master remain `Status: analyzed`, and no coding, scope reduction, closure/archive, release, or promotion is authorized.

---

## Scope Under Review

### Master FID

- `dev/fids/FID-2026-0731-001-pre-launch-optimization-audit-master.md`

### Child FIDs

- `dev/fids/FID-2026-0731-002-release-packaging-validation-contract.md`
- `dev/fids/FID-2026-0731-003-current-version-az-evidence.md`
- `dev/fids/FID-2026-0731-004-fid-lifecycle-archive-integrity.md`
- `dev/fids/FID-2026-0731-005-public-docs-launch-claim-readiness.md`
- `dev/fids/FID-2026-0731-006-telemetry-privacy-policy-decision.md`
- `dev/fids/FID-2026-0731-007-fid-package-red-team-review.md`

### Governing protocol

- `dev/nova/specs/echo-v0.1.2-freebuff.md`
- `ECHO-freebuff.md`
- `FREEREADME.md`
- `templates/FID-TEMPLATE.md`

---

## Context

Savant-Code is already published on npm as `savant-code@0.0.11`, but public advertising and promotion have not started. A read-only pre-launch audit found strong existing implementation evidence but also release-validation failures, stale current-version A–Z evidence, FID lifecycle drift, public-documentation placeholders, and an unresolved telemetry/privacy policy decision. The operator requested that telemetry policy remain deferred while the broader launch package is reviewed.

The proposed package deliberately separates these concerns:

- release packaging and validation contract;
- fresh v0.0.11 A–Z evidence and version synchronization;
- FID lifecycle/archive integrity;
- public documentation and launch-claim readiness;
- telemetry/privacy policy decision record, explicitly parked with no implementation;
- independent red-team review of the FID package itself.

All seven new FIDs are currently `Status: analyzed`. They have not been approved for implementation, closed, or archived.

---

## Claims for Nova to Verify

### Claim 1 — The master FID is a planning gate, not implementation authorization

- Read `dev/fids/FID-2026-0731-001-pre-launch-optimization-audit-master.md` 0–EOF.
- Verify it links child FIDs 002–007.
- Verify it requires current-version A–Z evidence, release validation, FID integrity, public-claim review, and explicit telemetry deferral.
- Verify it prohibits promotion and release activity before final approval.
- Verify it does **not** authorize coding before the third-party gate.

### Claim 2 — Release packaging is an open, bounded workstream

- Read `dev/fids/FID-2026-0731-002-release-packaging-validation-contract.md` 0–EOF.
- Independently inspect:
  - `cli/release-core/prepare-package.js`
  - `cli/release/package.json`
  - `cli/release-staging/package.json`
  - `cli/release-staging/index.js`
  - `savant-free/cli/release/package.json`
  - `savant-free/cli/release/index.js`
  - `cli/src/__tests__/release/wrapper-safety.test.ts`
- Confirm the recorded findings are grounded:
  - production pack succeeds;
  - staging pack currently fails or has a documented current result;
  - wrapper identity expectations are explicitly unresolved;
  - telemetry identifier changes are not silently authorized.
- Confirm FID-002 does not prescribe an unjustified rename or deletion.

### Claim 3 — Current A–Z evidence cannot inherit a historical Go decision

- Read `dev/fids/FID-2026-0731-003-current-version-az-evidence.md` 0–EOF.
- Read the current v0.0.9 launch prompt/report:
  - `dev/test-prompts/release-az-test-fid-2026-0728-launch-tracks.md`
  - `dev/scratchpad/release-az-test-fid-2026-0728-launch-tracks-report.md`
- Verify that a fresh v0.0.11 audit is required and that unavailable manual/platform/backend tests must be marked `DEFERRED`, not `PASS`.
- Confirm historical reports are preserved rather than rewritten as current certification.

### Claim 4 — FID lifecycle cleanup is evidence-based, not blind bulk closure

- Read `dev/fids/FID-2026-0731-004-fid-lifecycle-archive-integrity.md` 0–EOF.
- Verify the active `FID-2026-0728-001-az-test-gap-cleanup.md` and the affected archive records are identified.
- Independently inspect the active/archive inventory.
- Confirm the proposed process preserves unresolved work, historical records, and duplicate-ID history.
- Confirm no FID may be closed or archived before evidence supports that state.

### Claim 5 — Public documentation work is bounded by verified claims

- Read `dev/fids/FID-2026-0731-005-public-docs-launch-claim-readiness.md` 0–EOF.
- Independently inspect the relevant current public files, including:
  - `README.md`
  - `docs/launch/landing/index.html`
  - `docs/launch/hn-post.md`
  - `docs/launch/hn-first-comment.md`
  - `docs/launch/twitter-thread.md`
  - `docs/launch/mastodon-thread.md`
  - `docs/launch/newsletter-pitch.md`
  - `docs/launch/incident-response.md`
  - `SECURITY.md`
- Confirm placeholders, stale versions, command mismatches, and support-link inconsistencies are real findings or identify corrections.
- Confirm FID-005 does not silently resolve the deferred telemetry policy or strengthen unsupported privacy claims.

### Claim 6 — Telemetry/privacy is explicitly parked

- Read `dev/fids/FID-2026-0731-006-telemetry-privacy-policy-decision.md` 0–EOF.
- Independently inspect:
  - `docs/privacy.md`
  - `cli/src/utils/settings.ts`
  - `cli/src/utils/logger.ts`
  - `cli/src/utils/analytics.ts`
  - `common/src/analytics-core.ts`
- Confirm the FID records a real documentation/runtime ambiguity.
- Confirm it makes no runtime, analytics, ads, identifier, or privacy-policy implementation change.
- Confirm no other child FID is permitted to bypass this decision boundary.

### Claim 7 — The package has an independent red-team review

- Read `dev/fids/FID-2026-0731-007-fid-package-red-team-review.md` 0–EOF.
- Verify it challenges the master/child boundaries, dependencies, evidence, Five Questions, and approval gates.
- Verify it cannot approve implementation by itself.
- Verify its evidence references exact concrete files.

### Claim 8 — The package documents a two-key approval gate

- Verify this request itself states that both operator approval and written Nova third-party approval are required.
- Verify a conditional or failed Nova verdict blocks implementation.
- Verify the master and children remain `analyzed` pending approval.
- Verify no request language authorizes coding, FID closure, release, or promotion before the gate.

### Claim 9 — No implementation has been requested or performed in this audit pass

- Run `git status --short` and inspect the result.
- Distinguish pre-existing working-tree changes from the newly created FID/request documents.
- Confirm this request does not ask Nova to modify files, run publishing commands, commit, push, or deploy.

---

## Required Independent Commands

Run only safe, read-only commands. Do not install, publish, commit, push, archive, rename, or modify files.

```text
# Repository state
 git status --short

# New FID inventory
 find dev/fids -maxdepth 1 -type f -name 'FID-2026-0731-*.md' -print

# Metadata/status review
 search each FID for Filename, ID, Severity, Status, Created, Author

# Release evidence
 npm pack ./cli/release --dry-run
 npm pack ./cli/release-staging --dry-run
 npm pack ./savant-free/cli/release --dry-run

# Focused release tests, if dependencies are available
 bun test cli/src/__tests__/release/wrapper-safety.test.ts cli/src/__tests__/release/proxy-http-get.test.ts cli/src/__tests__/terminal-reset-sequences.test.ts

# Typecheck evidence, if time and dependencies permit
 bun run --cwd=cli typecheck
```

If a command is unavailable, times out, or fails because of environment limitations, report that exact fact. Do not convert missing output into PASS.

---

## Approval Decision Rules

### PASS

Use PASS only if:

- all factual claims that matter to the scope are verified or explicitly qualified;
- all seven FIDs are structurally valid and correctly linked;
- telemetry remains explicitly deferred;
- the two-key approval gate is unambiguous;
- no missing blocker or scope collision would make implementation unsafe.

A PASS means: **Nova approves the master/child FID package to proceed to the next planning/implementation-approval stage, subject to explicit operator approval.** Nova PASS never authorizes coding. It does not mean the code is fixed, tests are green, FIDs are closed, or launch is approved. Coding may begin only after the operator records approval in the master FID’s `## Approval Record` section following Nova’s PASS.

### CONDITIONAL

Use CONDITIONAL if the plan is directionally sound but corrections, clarifications, or additional evidence are required. CONDITIONAL is a hard block on coding and scope reduction.

### FAIL

Use FAIL if the package has material factual errors, missing FIDs, unsupported claims, ambiguous approval authority, or a process violation that must be corrected before review can pass.

---

## Required Reply Format

```text
# Nova Third-Party Audit Response

**Date:** YYYY-MM-DD
**Auditor:** Nova / external auditor identity
**Request:** 2026-07-31-pre-launch-optimization-audit-third-party-approval-request.md

## VERDICT: PASS | CONDITIONAL | FAIL

## Approval Gate Decision
- Third-party approval to proceed to implementation planning: YES | NO
- Operator approval still required: YES
- Coding authorized by this verdict: NO — Nova PASS never authorizes coding; operator approval must be recorded in the master FID after Nova PASS
- Scope reduction authorized by this verdict: NO unless explicitly reviewed and recorded in the master FID’s `## Approval Record`
- FID closure/archive authorized by this verdict: NO
- Release/promotion authorized by this verdict: NO

## Verified Claims
- Claim 1: PASS | FAIL | UNVERIFIED — evidence
...

## Refuted or Unverified Claims
1. ...

## Required Corrections Before PASS
1. ...

## Commands and Results
- Command: ...
- Exit status: ...
- Result: ...

## Final Third-Party Statement
One explicit paragraph stating whether Nova approves the master/child FID package to proceed, while preserving the separate operator-approval and no-coding gates.
```

**Nova: do not modify source files. Return only the independent audit response.**
