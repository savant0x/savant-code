# FID: Release pre-audit — final-stage precondition sweep (release-night failure classes)

**Filename:** `FID-2026-0913-004-release-pre-audit.md`
**ID:** FID-2026-0913-004
**Severity:** medium
**Status:** closed
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

- fingerprint: sha256:d51bc735e89f94c2c7f26a7c34dafdd2690370fcf6b3b3d180724ac005ff1812
- verified: 2026-09-14T04:17:13.538Z
- test scripts/__tests__/pre-audit.test.ts: exit 0
- test scripts/__tests__/fid-verify.test.ts: exit 0
- probe scripts/probes/release-gate-isolation-probe.ts: exit 0

## Perfection Loop

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

### Missed Questions

1. *Why run the audit in `main()` instead of inside the transaction?* —
   the lock is acquired before `runReleaseTransaction`; audited there, the
   lock check would see the release's own lock as live and block every
   run. Placement is part of the fix.
2. *Why dry-run the real scan instead of reimplementing a lighter blob
   check?* — a parallel implementation drifts; the audit then passes while
   the real scan still refuses. One source of truth (`runPrePushSecretScan`
   + its cap constant) is the whole point.
3. *Why is the telemetry auto-commit safe?* — the automation path already
   commits everything (`commitAllAutomationChanges`); the pre-audit only
   narrows what a manual mutation run will commit to the one churn file
   the harness itself writes.
4. *Why warn rather than block when `ls-remote` fails?* — an offline
   operator must still be able to release; the pre-push scan at push time
   remains the fail-closed backstop for anything the audit could not
   verify.
5. *Does the isolation canary check slow the run?* — one `bun test` spawn
   of a single 39-line file (~2s); it re-proves the FID-2026-0913-003 fix
   on the exact machine the release runs on.

### Code Verification Evidence

- [x] Files referenced in Affected Components exist (five pre-audit
      modules, standalone CLI, transaction wiring, package.json scripts)
- [x] Implementation matches the Proposed Solution (the check table;
      tag-deletion guardrails landed as specified: ls-remote-verified
      absence required, never in resume, never on failure)
- [x] Tests pass with pasted tool output (13/0 pre-audit units; fid-verify
      20/0; isolation probe PASS; receipt stamped live)
- [x] Production call-graph evidence: `runReleaseTransaction.main()` calls
      `runPreAudit` before `acquireReleaseLock`; `release:preaudit:check`
      verified PASS on the live repo
- [x] FID status reflects the actual implementation state (`fixed`)

## Resolution

CLOSED 2026-09-13 (reconciled against git ground truth). The hold —
"kept active until the v0.0.31 cut completes green through the new
sweep" — is discharged: **v0.0.31 shipped** — the tag exists, is pushed
(ls-remote), and VERSION is 0.0.31. `runPreAudit` executes
unconditionally in the release transaction's `main()` BEFORE
`acquireReleaseLock` (transaction wiring per Affected Components), so
the successful cut is itself the runtime proof the six-check sweep ran
green under real release conditions. G2 chain: implementation
`dd40f9c7` (pre-audit stage, six named checks); closure commit
`799dcf0` — receipt stamped live, ledger row, CHANGELOG 0.0.31 entry —
which is the exact commit the v0.0.31 tag points to. Post-shipment
hygiene confirmation: a standalone `release:preaudit --check` run
surfaced one [BLOCK] — "tag v0.0.31 already exists on origin — the
release already shipped" — the sweep correctly refusing a re-cut of a
shipped version (its `stale-tag-absent` check doing its fail-closed
job), with the isolation canary and config-dir pollution checks
re-verified green in the same pass. Receipt re-stamped live at the
archived path at closure-reconciliation time.

## Lessons Learned

A release pipeline must audit its own preconditions as a stage, not
discover them as failures. Every post-confirmation abort is a stage that
should have run before the prompt.

- The pre-audit's own ship-proof came from its first real customer: the
  v0.0.31 cut that landed green on top of this change is stronger
  evidence than any standalone invocation, because `runPreAudit` runs
  unconditionally in `main()` — the release cannot have completed
  without the sweep passing. Design safety stages to be unconditional
  and their success is proven by every subsequent run, not by a
  dedicated demo.
- A blocking finding can be the correct verdict: "tag already exists on
  origin — the release already shipped" looks like a failure in a
  hygiene report but is the sweep's shipped-version guard firing by
  design. Read [BLOCK] findings for what they assert, not just whether
  the run should have been green.
