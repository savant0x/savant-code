# FID: Complete the operator-answered register

**Filename:** `FID-2026-1015-002-complete-operator-answered-register.md`
**ID:** FID-2026-1015-002
**Severity:** medium
**Status:** converged
**Created:** 2026-10-15
**Automation level:** 3
**Parent:** FID-2026-1012-022
**Master FID:** FID-2026-1012-022
**Depends On:** none
**YAGNI-Compliance:** Verified

## Summary

Apply the operator's answers in `dev/fids/answers.md`: remove Savant-Free,
finish registered-workspace gate coverage, version the six coding skills,
and prepare a concrete provider comparison reference table for review.

## Operator decisions

Source: `dev/fids/answers.md`, supplied by the operator on 2026-10-15.

- T122: "-remove savant-free". Removal is authorized now, including its
  workspace, CLI feature, release tooling and dedicated e2e tests.
- T186 follows the approved removal-first order: add scripts/tmux coverage.
- T187: "agree" to version frontmatter on the remaining six coding skills.
- T171: dropped::operator-approved 2026-10-15 — "keep as is".
- T173: accept current conservative defaults: "its fine, close it as done".
  No vendor window measurement is claimed.
- T62 followups: dropped::operator-approved 2026-10-15 — "no need to check".
  No new credit or availability probe is claimed.
- T175: "agree" to drafting the reference table for review and the proposed
  distinction between missing references and inconclusive comparisons, with
  credential-change invalidation. No new paid probing budget is supplied.
- Release publication does not gate closure: "no need to gate". The standing
  keep-local instruction remains effective.
- Q23 routing ruling and required CI branch-protection action:
  dropped::operator-approved 2026-10-15 — "disregard these, im not doing ci".
  This records the pending actions' disposition; it does not remove existing guards.

## RED evidence and impact

Root package.json registers Savant-Free, exposes development/build commands,
and includes its build in `ci`. Shared CLI files select free-mode branches
through `IS_SAVANT_FREE`; dedicated session/ad/referral UI and runtime helpers
extend beyond the workspace directory. The ordinary Savant-Code model store
currently has a Savant-Free name but is used by the regular model picker and
provider routes. Preserve those consumers while removing free-product behavior.
Free provider catalogs and BYOK routes remain ordinary Savant-Code functionality.

The newly enabled tmux typecheck found six JSX call sites rejecting
`React.FC`'s asynchronous ReactNode return signature. Use inferred synchronous
component returns with explicit prop types; do not disable strict checking.

The remaining scripts/tmux workspace has a single view-session script and
no typecheck/test scripts. All six coding skills lack version frontmatter.

## Plan and Perfection Loop

1. Map live callers and read every file before editing it. Converge the
   removal plan before implementation, including settings compatibility and
   ordinary model routing, authentication, ads and session boundaries.
2. Remove the free-product workspace and runtime branches; retire build/release
   registrations and update current documentation. Historical audit records
   retain their original evidence.
3. Add scripts/tmux typecheck and meaningful offline tests; wire both ordinary
   and release gate chains to cover every registered workspace.
4. Add only `version: 0.1.0` to the six operator-approved coding skills.
5. Draft the provider reference table with explicit candidates, verdict labels,
   credential invalidation and zero newly authorized paid/network calls.
6. Verify affected tests, all-workspace typecheck, lint, build, repository and
   lifecycle checks; re-read the implementation against this plan. Commit only
   owned paths, archive completed FIDs and record remaining review honestly.

## Gates

Run the repository's configured root typecheck, test, lint, markdown lint,
format check, SDK build and repository validation. Run version:check,
skills:check and FID lifecycle checks. Dedicated removal tests must establish
that SAVANT_FREE_MODE cannot re-enable the removed product and normal model
selection and BYOK still work. scripts/tmux tests must run without tmux or
an interactive terminal.

## Verification Gates

- gate: typecheck cli
- gate: typecheck agents
- gate: typecheck common
- gate: typecheck scripts/tmux
- gate: test cli/src/__tests__/cli-args.test.ts
- gate: test cli/src/__tests__/unit/build-binary-env.test.ts
- gate: test cli/src/commands/__tests__/registry-gating.test.ts
- gate: test cli/src/state/__tests__/savant-free-model-store.test.ts
- gate: test scripts/tmux/tmux-viewer/__tests__/session-loader.test.ts
- gate: probe scripts/ci-build-check.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:c6a75682932c577abde520855152e0dad1032ada46daa2351e311a9be141b095
- verified: 2026-10-16T03:01:59.530Z
- typecheck cli: exit 0
- typecheck agents: exit 0
- typecheck common: exit 0
- typecheck scripts/tmux: exit 0
- test cli/src/__tests__/cli-args.test.ts: exit 0
- test cli/src/__tests__/unit/build-binary-env.test.ts: exit 0
- test cli/src/commands/__tests__/registry-gating.test.ts: exit 0
- test cli/src/state/__tests__/savant-free-model-store.test.ts: exit 0
- test scripts/tmux/tmux-viewer/__tests__/session-loader.test.ts: exit 0
- probe scripts/ci-build-check.ts: exit 0
- quality: exit 0

## Perfection Loop

### Missed Questions

1. Does removal include free provider inference? No: the operator-selected
   provider/model routes and generic SDK billing/legacy wire types are shared
   compatibility surfaces. Dedicated Savant-Free agents, session admission,
   product UI, mode flag, build, release wrapper and e2e suites are retired.
2. Can a shell variable revive the product? No: remove its CLI environment
   declaration, parser branch, build injection and all runtime flag consumers.
3. What should an ordinary provider's session-shaped error do? Display the
   provider error and settle the queue; never switch to a retired landing UI.
4. Can external CI settings block this removal? The operator explicitly
   dropped the requested branch-protection action; local gates still apply.

### Code Verification Evidence

- scripts/tmux typecheck: exit 0 after correcting React.FC return annotations.
- scripts/tmux offline session-loader tests: 4 PASS, zero FAIL.
- skills:check: 28 skills scanned, zero repository errors, 24 warnings.
- Root typecheck passes and the full root test suite passes 9,162/23 skipped/0
  failed with a 10-minute execution budget. Commit `dea54d85` stages the eleven approved deleted
  Savant-Free test paths that the validator initially saw as stale indexed
  sources. The current repository validator reports only the separately locked
  clean-Linux scratch artifact.
- The first CLI suite identified retired wrapper fixtures; those registrations
  were removed with the wrapper. No surviving product tests were suppressed.

## Resolution

Implementation and verification in progress. Do not archive or claim master
closure until the completed source is committed and the final gates pass.

## Double audit and convergence

Loop 1 checked live entry points (`cli-args.ts`, binary build environment,
`app-authed-surface.tsx` and model-store consumers). Loop 2 rejected deleting
the shared model store or generic free-provider support. Ordinary model route
selection and persisted Savant-Code preferences must survive removal. Delete
product-specific code only after its callers are disconnected; do not retain
an environment switch that can resurrect the free product. The root `ci`
command retains the SDK build after the retired build is removed. Existing
guards and historical records remain effective. No new runtime API is needed.

The controls table is an offline review artifact; the operator has not supplied
a spending ceiling or released the operator-owned manifest for live use.
Only explicitly supplied answers close the listed external checks. Both
audits agree on this contract; implementation is authorized by the standing
level-3 directive and the supplied answers.

## Step status

- Step 1: implemented; caller mapping and both plan audits complete.
- Steps 2–6: implementation in progress under the converged contract.
