# FID: Local Commit Authority; Push Requires Operator Authorization

**Filename:** `FID-2026-1011-001-local-commit-authority-push-gated.md`
**ID:** FID-2026-1011-001
**Severity:** medium
**Status:** verified
**Created:** 2026-10-11
**Automation level:** 3
**YAGNI-Compliance:** Verified

---

## Summary

The version-control rules contradict themselves about who may commit and
whether local commits require operator authorization. The operator has ruled:
"LOCAL commits do not need authorization, only push does." Make local,
path-scoped commits permissible within already-approved work without a second
per-commit approval. A push to any remote/ref remains explicitly approval-gated.
Keep FID closure's local-commit evidence requirement, preserve the existing
path-scoping and atomicity rules, and honor narrower task-specific prohibitions.

## Environment

- **OS:** Windows 11
- **Language/Runtime:** Markdown governance and generated TypeScript protocol bundle
- **Tool Versions:** Bun 1.3.14
- **Commit/State:** Existing working tree contains unrelated operator work; no
  commit or push is part of this FID.

## Detailed Description

### Problem

`ECHO.md` G1 currently permits agents to stage, commit, and push, while the
single-agent adaptation says the agent never executes Git and forbids commits
without operator authorization. G2 requires a local commit hash for FID
closure, and the Automation Levels section separately says no level authorizes
a commit. Active FIDs consequently remain `verified` while describing local
commit authorization as an operator blocker.

### Expected Behavior

- Work already approved in `SCOPE.md` may be staged and committed locally
  without separate operator approval, using explicit paths and a coherent
  commit.
- Any `git push` requires explicit operator authorization. Autonomy level,
  approved scope, or a local commit does not imply push authorization.
- G2 continues to require the local commit hash as evidence before FID closure.
- Explicit task-specific prohibitions remain effective until the operator
  changes them. This FID itself performs no commit or push.

### Root Cause

The 2026-09-05 G1 amendment granted agents stage/commit/push authority, but
later single-agent text still treats all Git mutation as operator-only and
Automation Levels treats commits as separately gated. G1/G2 and their solo
adaptation therefore encode incompatible authorization boundaries.

### Evidence

- `ECHO.md:467` G1 permits agents to stage, commit, and push.
- `ECHO.md:468` G2 requires a local commit for FID closure.
- `ECHO.md:774` says automation levels do not authorize commits or pushes.
- `dev/echo-v0.1.2-single-agent.md:197` separately gates commits on operator
  authorization and forbids pushes at every level.
- `dev/echo-v0.1.2-single-agent.md:564-568` says the agent never executes Git
  and the operator executes or approves commits.
- `SCOPE.md` and active FIDs 1009-004 through 1009-007 and 1010-003 name
  operator commit authorization as their current closure blocker.
- `T184` is a narrower exception: it explicitly prohibits Git operations
  for the release-readiness repair and remains in force.

## Impact Assessment

### Affected Components

- `ECHO.md` — G1/G2 and Automation Levels wording.
- `dev/echo-v0.1.2-single-agent.md` — invariants and version-control summary.
- `common/src/constants/protocol-bundle.generated.ts` — regenerated protocol
  copy if the generator embeds the changed governance.
- `SCOPE.md` and active FIDs whose blocker text is superseded.

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Amend G1 to distinguish local commits from remote publication: local
path-scoped commits are authorized by the approved work item and need no
separate approval; pushes require explicit operator authorization. Preserve
G2's committed-hash closure requirement, G3/G4 atomicity and path-scoping,
release authority, and existing prohibitions on force-push/history rewriting
and release mutations. State that explicit task-level vetoes remain in force.
Align the single-agent text and generated protocol bundle, then remove the
obsolete commit-authorization blockers from active FID/SCOPE descriptions.

### Steps

1. Update `ECHO.md` G1/G2 framing and Automation Levels so local commits need
   no per-action authorization while pushes remain explicitly gated.
2. Align the single-agent invariants and version-control quick reference.
3. Regenerate and check the generated protocol bundle.
4. Reconcile active FID/SCOPE text that treats operator commit authorization
   as the blocker, preserving pending local-commit work and the T184-specific
   no-Git-operation restriction.
5. Run documentation lint, protocol-bundle drift check, scope registration,
   and archived-closure guard; manually reread all changed files.

### Verification

- `bun run generate:protocol-bundle:check` passes after regeneration.
- `bun run lint:md` passes.
- `bun scripts/scope-register-check.ts` passes.
- `bun scripts/audit-fid-archived-closures.ts` passes.
- Grep confirms no current normative text says local commits require separate
  operator authorization or that the single agent never executes Git; push
  authorization and the G2 commit-evidence requirement remain explicit.
- No push is performed. Any explicit task-specific commit prohibition remains
  intact.

## Verification Gates

- gate: probe scripts/scope-register-check.ts
- gate: probe scripts/audit-fid-archived-closures.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:b73ea0e88a192c0346861a62fe388e5699ebad322c71917632d790f662e423b4
- verified: 2026-10-11T04:30:53.594Z
- probe scripts/scope-register-check.ts: exit 0
- probe scripts/audit-fid-archived-closures.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **R1:** G1's 2026-09-05 amendment allows agent pushes, while single-agent
  rules prohibit pushes at every autonomy level.
- **R2:** G1 allows agent commits, while single-agent G2 and Automation Levels
  require operator commit authorization.
- **R3:** G2 requires committed evidence to close FIDs, making the authorization
  conflict a queue-wide blocker for verified records.
- **R4:** A task-specific no-commit instruction exists in T184 and must not be
  silently erased by changing the general rule.

### Loop 1 — GREEN

- **G1:** Local staging/committing is permitted only within already-approved
  scope; it requires no separate per-commit approval.
- **G2:** Push remains gated by explicit operator authorization for the
  specific push. Scope or autonomy does not imply permission.
- **G3:** Keep local commit hash as G2 FID-closure evidence, and retain G3/G4
  atomic commit and explicit-path staging constraints.
- **G4:** Keep explicit task-specific prohibitions, including T184's current
  no-commit/no-Git-operation restriction, unless explicitly changed by the
  operator.

### Loop 1 — AUDIT

- Confirmed directly against current ECHO, single-agent protocol, SCOPE, and
  the five active FID records named in T186.
- The change does not grant push permission, release authority, or permission
  to stage unrelated work.
- Bundle generator/check and repository scope/closure probes are identified
  as implementation verification.

### Loop 1 — SELF-CORRECT

- Initial wording could have implied local commits are permitted regardless of
  task scope. Corrected: the work item must already be approved, and narrower
  explicit holds remain effective.
- Initial note could have implied FID closure no longer requires a commit.
  Corrected: G2 continues to require a local commit hash; only separate
  operator authorization for that local commit is removed.

### Loop 2 — Final Convergence

- **RED:** No unresolved authorization ambiguity in the proposed rule.
- **GREEN:** G1/G2, single-agent rules, active status descriptions, and
  generated protocol copy are covered by the five implementation steps.
- **AUDIT:** The operator's exact boundary is preserved: local commits need no
  separate authorization; pushes do.
- **ADVERSARIAL:** A user-approved scope item remains necessary; an explicit
  task-specific prohibition remains in force; neither authorizes a push.
- **CHANGE DELTA:** Governance text only; no runtime API or behavior change.

## Resolution

- **Closed Date:** Pending local commit evidence (G2)
- **Fix Description:** ECHO G1/G2, single-agent protocol, generated bundle,
  scope register, and affected FID blocker text now distinguish local
  path-scoped commits from approval-gated pushes. T184's explicit no-Git
  hold remains intact.
- **Tests Added:** No — governance-only change; generated-bundle and repository
  probes verify the contract.
- **Verification Evidence:** Gates below passed; generated protocol drift
  check, Markdown lint, and scope-register check also passed manually.
- **Archived:** Pending

## Lessons Learned

Permission to commit locally and permission to publish remotely are separate
boundaries and must be stated separately in both multi-agent and single-agent
governance.
