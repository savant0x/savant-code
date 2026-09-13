# FID: Release pre-audit — final-stage precondition sweep (release-night failure classes)

**Filename:** `FID-2026-0913-004-release-pre-audit.md`
**ID:** FID-2026-0913-004
**Severity:** medium
**Status:** fixed
**Created:** 2026-09-13
**YAGNI-Compliance:** Verified — six named checks, each mapping 1:1 to a
failure class actually observed on v0.0.31 release night; no speculative
checks, no new config surface. Reuses the real pre-push scan (in-process),
the existing lock path helper, and the existing isolation canary.
**Related:** FID-2026-0913-003 (test isolation — check 6 guards its
regression); FID-2026-0905-007 (release decomposition — the transaction
this wires into); FID-2026-0819-005 (the credential-scan cap semantics).

---

## Summary

The v0.0.31 cut failed four consecutive times, each a different
**precondition** discovered only after the operator confirmed RELEASE —
telemetry churn, a zombie lock, an over-cap blob in the pushed range, and
the profile-defeated test isolation (FID-2026-0913-003). The preview
validated the plan but nothing audited the precondition surface. This FID
adds `runPreAudit`: six named checks run in `main()` before the lock is
acquired, safe classes self-heal (logged), unsafe classes block with exact
remediation, and `bun run release:preaudit [--check]` exposes the sweep
standalone.

## Environment

- **OS:** Windows 11 (win32, Git Bash); Bun 1.3.14; release night 2026-09-13.
- **RED evidence (the four release attempts):**
  1. `Mutation mode requires a clean worktree. M dev/experiences/raw-traces.jsonl`
  2. `Another release process owns the release lock … .lock` (zombie from a
     dead-TTY attempt; PID alive, parked at the confirmation prompt)
  3. `pre-push: pushed blob(s) exceed the 2MB credential-scan cap … docs/lastsession.md — refusing to push`
  4. `Gate repository-validation failed` (deterministic; FID-2026-0913-003)

## Detailed Description

### Problem

Every precondition failure surfaced post-confirmation, costing an hour of
operator time and (in class 4) real credential damage. The failure modes
are known, enumerable, and cheap to detect — they were just never checked
up front.

### Expected Behavior

`bun run release:public` refuses (or self-heals) in seconds when a known
precondition is unmet, with an actionable message — never after the
operator typed `RELEASE`.

### Root Cause

The release pipeline validated its plan (versions, remotes, changelog) but
never its preconditions (worktree, lock, push range, config-dir integrity,
isolation canary, stale tag).

## Impact Assessment

### Affected Components

- NEW `scripts/public-release/audit-types.ts` (26), `pre-audit.ts` (56,
  orchestrator), `pre-audit-local.ts` (221), `pre-audit-push.ts` (111),
  `pre-audit-config.ts` (81) — all under the 300 cap
- NEW `scripts/release-preaudit.ts` (52) standalone CLI
- `scripts/public-release/transaction.ts` — pre-audit invoked in `main()`
  BEFORE `acquireReleaseLock` (inside the transaction the audit would see
  its own lock as alive — placement matters)
- `package.json` — `release:preaudit` / `release:preaudit:check` scripts

### Risk Level

- [ ] Critical
- [x] Medium: read-mostly guards + two narrow fixes (telemetry-only churn
      commit; dead-owner lock removal); tag deletion only for locally-born,
      ls-remote-verified-absent tags, never in resume mode, never on
      ls-remote failure.
- [ ] Low

## Proposed Solution

### Approach

| # | Check | Class | Outcome |
|---|---|---|---|
| 1 | `worktree-clean` | telemetry churn / real dirt | auto-commit churn-only; block otherwise |
| 2 | `release-lock-free` | zombie / live lock | remove dead-owner lock; block live |
| 3 | `stale-tag-absent` | unpushed leftover tag | delete (mutation, verified unpushed); warn on resume or unverifiable; block if on origin |
| 4 | `push-range-scannable` + `push-range-credential-clean` | over-cap blob / credential-shaped content | block with remediation (dry-runs the REAL scan) |
| 5 | `config-dir-unpolluted` | test fakes in real credentials | block (restore keys first) |
| 6 | `config-dir-isolation` | canary regression | block |

### Steps

1. [x] **RED:** the four release-night failures (above).
2. [x] **GREEN:** check families + orchestrator + CLI + transaction wiring.
3. [x] **VERIFY:** 13/0 new unit tests (real temp git repos with a separate
       bare origin); full scripts suite; validator; live `preaudit --check`.
4. [x] **GOVERNANCE:** receipt, ledger row, CHANGELOG entry.

### Verification

Method 2 runtime: unit tests against real git state; the sweep run live on
the release repo. Method 1 static: caps, eslint, prettier, lint:md,
validator.

## Verification Gates

- gate: test scripts/__tests__/pre-audit.test.ts
- gate: test scripts/__tests__/fid-verify.test.ts
- gate: probe scripts/probes/release-gate-isolation-probe.ts

### Verification Receipt

### Perfection Loop

### Loop 1 — Authoring (2026-09-13)

- **RED:** four post-confirmation precondition failures in one hour.
- **GREEN:** six checks, two safe fixes, fail-closed blockers, standalone CLI.
- **ADVERSARIAL:** (a) *Self-lock false positive* — avoided by running
  before `acquireReleaseLock`. (b) *Tag deletion danger* — only
  ls-remote-verified unpushed tags, never on ls-remote failure, never in
  resume. (c) *Fix-then-block ordering* — fixes apply before blocking so a
  churn commit + a blocker in one sweep still ends blocked, not half-fixed
  silently. (d) *Preview honesty* — preview never mutates; it lists
  auto-fixables.
- **CHANGE DELTA:** initial authoring.

## Resolution

Implemented 2026-09-13 after the fourth release attempt. Status `fixed`;
kept active until the v0.0.31 cut completes green through the new sweep.

## Lessons Learned

A release pipeline must audit its own preconditions as a stage, not
discover them as failures. Every post-confirmation abort is a stage that
should have run before the prompt.
