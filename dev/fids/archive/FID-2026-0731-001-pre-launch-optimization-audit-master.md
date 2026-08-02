# FID: Pre-Launch Optimization and A–Z Audit Master

**Filename:** `FID-2026-0731-001-pre-launch-optimization-audit-master.md`
**ID:** FID-2026-0731-001
**Severity:** high
**Status:** analyzed
**Created:** 2026-07-31 00:00
**Author:** Buffy

<!-- prettier-ignore -->

---

## Summary

Savant-Code is already published on npm as `savant-code@0.0.11`, but public
promotion has not started. This master FID coordinates the pre-launch
optimization audit requested before advertising or broad public amplification.
It consolidates release validation, fresh current-version A–Z evidence,
FID/archive integrity, public documentation and launch-claim consistency, and
the separately recorded telemetry-policy decision. This immediate gate applies
to the Savant-Code local/BYOK release. A future free product may be built
later, after Savant-Code gains users, with a backend designed, owned, and operated
by our team; that future first-party backend/auth/model-selection/recurrence work
is explicitly post-launch and is not an immediate release dependency. Before approval, this master authorized no
implementation or promotion. Nova’s upgraded PASS and the recorded
operator approval subsequently authorized the bounded FID-002–005 execution
scope; telemetry-policy changes, publishing, promotion, commits, and pushes
remain excluded.

## Environment

- **OS:** Windows (`win32`)
- **Language/Runtime:** TypeScript monorepo, Bun 1.3.14, Node-compatible npm
  wrapper
- **Tool Versions:** Published `savant-code@0.0.11`; FreeBuff ECHO v0.1.2
- **Commit/State:** Existing working-tree changes and approved audit changes are
  uncommitted; no commit/push is authorized

## Detailed Description

### Problem

The repository has strong implementation evidence, including passing workspace
typechecks, green package dry-runs, and a published npm artifact. The
current-version A–Z package now targets v0.0.11, and the release-wrapper/staging
identity failures have been remediated. FID lifecycle work eliminated duplicate
explicit IDs and the active fixed-record anomaly, while preserving a documented
historical metadata backlog rather than performing blind closure. Public docs
have been reconciled against current evidence, with targeted claim checks green
and repository markdownlint now green. The telemetry policy decision
is now closed with verified runtime controls; promotion remains gated by
unresolved environment, historical lifecycle-backlog, and final operator-decision
items. Future first-party backend/auth/model-selection/recurrence evidence
for the later free product is not part of those immediate Savant-Code gates and
is tracked as post-launch work. No external FreeBuff hosting, partnership, or
service dependency is assumed.

### Expected Behavior

Before public promotion:

1. Production and supported release validation has a documented, reproducible
   green path.
2. A fresh A–Z audit targets v0.0.11 and distinguishes verified results from
   deferred manual tests.
3. Every FID has ground-truth lifecycle metadata, unique identity, and evidence
   appropriate to its status.
4. Public install, version, feature, privacy, support, and rollback claims match
   verified behavior.
5. Telemetry policy is explicitly approved and verified, while no broader
   promotion follows automatically from that child decision.
6. The operator receives a final Go/No-Go package for approval before
   implementation or promotion.

### Root Cause

The project moved rapidly through multiple release and rebrand cycles.
Historical FIDs, release drafts, and launch artifacts were created at different
versions and were not all reconciled after v0.0.11. The result is documentation
and process drift rather than one isolated defect.

### Evidence

```text
Published registry evidence:
- npm view savant-code version -> 0.0.11
- npm latest dist-tag -> 0.0.11
- npm pack savant-code@latest --dry-run -> 5 files, exit 0

Workspace evidence:
- common typecheck -> exit 0
- agents typecheck -> exit 0
- sdk typecheck -> exit 0
- cli typecheck -> exit 0
- agent-runtime typecheck -> exit 0
- code-map typecheck -> exit 0
- database typecheck -> exit 0
- llm-providers typecheck -> exit 0

Current bounded findings:
- Fresh v0.0.11 A–Z evidence passes release sources, npm version, all three package dry-runs, five workspace typechecks, and 29 focused tests.
- Savant-Code local/BYOK interactive and cross-platform checks remain DEFERRED in the fresh report.
- Future first-party backend/auth/model-selection/recurrence checks for the later free product are explicitly post-launch and are not Savant-Code promotion gates; no external FreeBuff hosting or partnership is assumed.
- FID-004 removed duplicate explicit IDs and active fixed/verified anomalies, while 60 older archive records retain legacy/missing metadata as an explicit compatibility backlog.
- FID-005 bounded public-claim scans and repository markdownlint pass; its remaining Savant-Code launch gate is local interactive/cross-platform evidence, while future first-party free-product backend evidence is explicitly deferred.
- FID-006 is now closed with an active-by-default, user-disableable telemetry policy and verified runtime controls; broader promotion remains gated by the master record.
- Final promotion remains No-Go until all remaining launch gates and the final operator decision are green.
```

## Impact Assessment

### Affected Components

- `dev/fids/` and `dev/fids/archive/`
- `cli/release-core/`, `cli/release/`, `cli/release-staging/`,
  `savant-free/cli/release/`
- `cli/src/__tests__/release/`
- `protocol.config.yaml`, `VERSION`, package manifests
- `dev/test-prompts/`, `dev/scratchpad/`
- `README.md`, `docs/privacy.md`, `docs/launch/`

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Child FIDs and Dependencies

<!-- markdownlint-disable MD013 MD060 -->

| FID               | Workstream                                      | Gate                                                               | Dependency                        |
| ----------------- | ----------------------------------------------- | ------------------------------------------------------------------ | --------------------------------- |
| FID-2026-0731-002 | Release packaging and validation contract       | Required for release confidence                                    | None                              |
| FID-2026-0731-003 | Current v0.0.11 A–Z evidence and version sync   | Required for Go/No-Go                                              | Release contract informs commands |
| FID-2026-0731-004 | FID lifecycle and archive integrity             | Closed and archived                                                | None                              |
| FID-2026-0731-005 | Public documentation and launch claim readiness | Required before promotion                                          | Current A–Z evidence              |
| FID-2026-0731-006 | Telemetry/privacy policy decision record        | Closed and archived; broader promotion remains subject to the master | None                              |
| FID-2026-0731-007 | FID package red-team review                     | Closed and archived                                                | All child FIDs drafted            |

<!-- markdownlint-enable MD013 -->

## Proposed Solution

### Approach

Run the Perfection Loop on this master FID and each child FID as documentation
and audit work first. After Nova’s PASS and the operator’s recorded approval,
execute children in dependency order, re-audit each implementation, and update
each child only to the evidence-supported status. Keep the master at `analyzed` while any Savant-Code launch gate or final
promotion decision remains unresolved. Deferred future first-party free-product
backend evidence does not keep the immediate Savant-Code gate open.

### Steps

1. Approve or amend this master and child-FID scope.
2. Converge and implement FID-002 release validation fixes or explicit
   test-contract decisions.
3. Create and execute a fresh v0.0.11 A–Z test prompt/report under FID-003.
4. Normalize FID metadata and identity under FID-004 without erasing historical
   evidence.
5. Reconcile public docs and launch artifacts under FID-005.
6. Record and re-audit the separately approved telemetry-policy decision under
   FID-006.
7. Run the independent package red-team review under FID-2026-0731-007.
8. Run the master gate: all required child evidence green, no unexplained launch
   blockers, and operator Go approval.

### Verification

- Every child FID has a completed RED/GREEN/AUDIT section and missed-question
  answers.
- All changed files are read 0–EOF after implementation.
- Configured typechecks, focused tests, lint, packaging dry-runs, and fresh A–Z
  tests have tool-output evidence.
- FID IDs are unique and status/location rules are satisfied.
- Public claims are traceable to code, tests, or explicitly qualified as
  limitations.
- No ads, promotion, npm publishing, release upload, commit, or push occurs
  without a separate final Go decision; the current evidence package recommends
  No-Go.

## Perfection Loop

### Loop 1 — Master Planning Audit

- **RED:** Identified five independent launch workstreams plus one separately
  recorded policy decision and one cross-cutting red-team review. Found
  current-version evidence drift, release-wrapper failures, FID lifecycle drift,
  stale public claims/placeholders, and telemetry-policy ambiguity.
- **GREEN:** Split work into five bounded workstream FIDs, one separately
  approved telemetry-policy decision, and one cross-cutting red-team review.
  Established dependency order and a hard approval gate.
- **AUDIT:** Nova’s upgraded third-party review is `PASS`, and operator approval
  is recorded. Child execution produced green release/package/typecheck
  evidence, fresh v0.0.11 A–Z evidence, bounded lifecycle remediation, targeted
  public-claim reconciliation, and a closed telemetry policy decision. Remaining
  gates are explicitly documented rather than hidden: historical lifecycle
  compatibility backlog, deferred Savant-Code local interactive/cross-platform
  checks, and final promotion Go/No-Go. Future first-party free-product
  backend/auth/model-selection/recurrence checks were explicitly reclassified
  as post-launch work and are not included in the current Go/No-Go gate. No
  external FreeBuff hosting or partnership is part of the plan.
- **CHANGE DELTA:** Documentation/config plus bounded release-wrapper and
  public-doc changes; no telemetry runtime or promotion behavior changed.
- **Result:** Master remains `analyzed`; implementation scope is executed, but
  final Savant-Code promotion is No-Go pending local interactive/cross-platform
  evidence and the final Go decision. The future first-party free-product
  backend remains a post-launch track.

### Missed Questions

1. **Does “public” mean npm availability or promotion?** → npm publication
   already exists; this audit gates advertising, social amplification, and broad
   promotion.
2. **Should the staging package be deleted instead of fixed?** → Not assumed.
   FID-002 must compare removal versus a coherent staging contract; the default
   is to preserve it only if it can pass validation without confusing users.
3. **Can historical FIDs simply be marked closed?** → No. FID-004 must verify
   evidence and preserve unresolved/superseded history rather than mass-editing
   statuses.
4. **Is telemetry policy part of this implementation pass?** → The separately
   approved FID-006 decision is complete and verified; no broader promotion
   approval follows from that child closure.
5. **Can a v0.0.9 A–Z “Go” report certify v0.0.11?** → No. FID-003 requires
   fresh current-version evidence.
6. **What stops launch while work is incomplete?** → Savant-Code local/BYOK
   interactive or cross-platform evidence and the final operator decision remain
   current gates; master status remains `analyzed` until an explicit Go.
7. **Does a future free-product backend block the Savant-Code release?** → No.
   Savant-Code launches first. After user adoption, our team may build and operate
   its own backend for the free product; that backend, auth/model selection, and
   recurring-goal evidence are explicitly post-launch requirements. No external
   FreeBuff hosting or partnership is assumed.

### Code Verification Evidence

- [x] All child FID paths are planned under `dev/fids/` and use unique 2026-0731
      IDs.
- [x] Canonical FreeBuff ECHO v0.1.2 was read 0–EOF before authoring.
- [x] Existing active FID and working-tree changes were inspected.
- [x] Child FIDs approved by operator after Nova PASS.
- [~] Child implementation/evidence passes collected for FID-002, FID-003, and
  FID-005; FID-004, FID-006, and FID-007 are closed and archived; the remaining
  active child gates are explicitly documented.
- [x] Master final evidence package records a current No-Go recommendation for
      Savant-Code promotion; final operator Go decision is not granted.
- [x] Future first-party free-product backend/auth/model-selection/recurrence
      work is explicitly classified as post-launch and excluded from the
      immediate Savant-Code gate; no external FreeBuff hosting or partnership is
      assumed.

## Approval Record

- **Nova third-party approval:** PASS,
  `dev/nova/outbox/2026-07-31-third-party-audit-response-upgraded.md`, dated
  2026-07-31.
- **Operator approval:** Approved by the operator’s explicit instruction to
  “proceed to complete all pending FIDs in full with automation level 3,”
  received after the upgraded Nova PASS.
- **Approval date:** 2026-07-31.
- **Authorized scope:** Execute the approved implementation/documentation work
  in FIDs 002–005; perform evidence-based lifecycle remediation under FID-004;
  record and re-audit the separately approved FID-006 telemetry/privacy policy
  decision; re-audit all work.
- **Explicit exclusions:** No additional telemetry policy expansion, npm
  publication, release upload, social promotion, advertising, commit, or push is
  authorized by this record.
- **Gate condition:** Each child requires independent verification before status
  advancement. Scope reduction, closure/archive, release, or promotion requires
  separate evidence and approval where required by the child FID and ECHO
  protocol.

## Resolution

- **Fixed By:** Buffy with Nova third-party review and operator-approved child
  execution
- **Fixed Date:** 2026-07-31
- **Fix Description:** Executed the approved pre-launch audit package, collected
  current release/A–Z evidence, reconciled public claims, bounded lifecycle
  remediation, and completed the approved telemetry policy child. Re-scoped the
  gate so Savant-Code promotion is evaluated against local/BYOK and cross-platform
  evidence; future first-party free-product backend/auth/model-selection/
  recurrence work is explicitly post-launch, with no external FreeBuff hosting
  or partnership assumed. The master remains a No-Go gate until the current
  Savant-Code evidence and final operator decision are resolved.
- **Tests Added:** Fresh v0.0.11 A–Z prompt/report; focused release/settings
  evidence; documentation claim scans.
- **Verified By:** Nova PASS, independent basher outputs, child-FID evidence,
  and final cross-FID re-audit.
- **Commit/PR:** Working tree only; no commit or push authorized
- **Archived:** Pending final promotion gate and historical lifecycle backlog
  resolution

## Lessons Learned

- A published npm package does not prove the repository’s release process is
  reproducible.
- Current-version evidence must be regenerated after each release; historical
  A–Z reports are not reusable certification.
- FID lifecycle hygiene is a release-quality signal, not merely documentation
  polish.
- Policy decisions must be represented explicitly, and a verified child decision
  must not be mistaken for a final promotion approval.
