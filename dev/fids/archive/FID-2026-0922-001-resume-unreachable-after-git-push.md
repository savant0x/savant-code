# FID: `--resume` is unreachable for any release failure after `GIT_PUSH`

**Filename:** `FID-2026-0922-001-resume-unreachable-after-git-push.md`
**ID:** FID-2026-0922-001
**Severity:** high
**Status:** closed (commit d31de31b)
**Created:** 2026-09-22 18:40
**Automation level:** 1
> (The remedy is a change to a fail-closed release guard, so it is
> approval-gated. Operator ruling 2026-09-22: **document only** that session.
> **Operator authorization 2026-09-24: implement it** — RED-first pins, the
> `resume` tolerance, and the npm retry window, which is what this record now
> carries.)
**YAGNI-Compliance:** Pass

---

## Summary

The public-release pipeline advertises `--resume` as the recovery path for a
failed cut, and its own post-release code anticipates the exact transient that
failed the v0.0.33 run ("transient npm registry propagation",
`scripts/public-release/stages-verify.ts:121`). But `--resume` could not complete
any release whose failure happened **after `GIT_PUSH`**. Three independent
constraints composed into a deadlock: (1) the pre-audit's `stale-tag-absent` check
returned `severity: block` whenever the tag exists on origin — in **every** mode,
including `resume`, because `resume` only altered the *local-only* tag branch
(`scripts/public-release/pre-audit-local.ts:174-196`), and the orchestrator fails on
any block outside `preview` (`scripts/public-release/transaction.ts:256`); (2) the
receipt is HEAD-bound, so the fix commit itself changes HEAD and the transaction
refuses (`scripts/public-release/transaction.ts:139`, `:144`); and (3) post-release
verification requires the tag to exist and resolve to release HEAD, so deleting the
tag or the release to satisfy (1) fails (2)'s sibling assertion
(`scripts/public-release/stages-verify.ts:96-101`). The block's own message told the
operator to "use --resume", which is the command that just failed. This was a
recovery-path defect only: the release itself shipped correctly and completely.

**Resolved 2026-09-24:** (1) and the npm read-after-write are fixed. Constraint
(2) is by design and remains: the v0.0.33 receipt is still unreachable by any
repair, and its completion stays recorded as the hand-verified erratum.

## Environment

- **OS:** Windows 11 (win32), bash via Git Bash
- **Language/Runtime:** TypeScript / Bun 1.3.14
- **Tool Versions:** npm (registry client), git, `gh`
- **Commit/State:** release HEAD `8f40f6f2945e56fa7edaff92d1da3986ba090a5b`
  (`v0.0.33`, pushed; `origin/main` == `main`); receipt
  `%TEMP%/savant-public-release-0.0.33.json`, `mode: publish`,
  `restored: true`, `failedStage: "Post-release verification failed for
  savant-code@0.0.33."`, `completedStages` = AUTHENTICATION, PREFLIGHT,
  CONFIRMATION, PUBLIC_PROFILE, GATES_AND_PACKAGE_DRY_RUNS, TAG, GIT_PUSH,
  BACKUP_BUNDLE, GITHUB_RELEASE, NPM_PUBLISH_CLI (POST_RELEASE_VERIFY absent)

## Detailed Description

### Problem

The v0.0.33 cut published successfully — tag pushed, GitHub release created with
all five binary assets, npm package published — and then exited 1 in
`POST_RELEASE_VERIFY` because the immediate read-after-write check on npm lost a
registry-propagation race. That much is a benign, self-correcting failure. The
defect is what happened next: the documented recovery was unusable.

### Expected Behavior

`bun run release:public:resume` should re-run only the incomplete stage
(`POST_RELEASE_VERIFY` here) and finalize the receipt. That is precisely what the
codebase intends: `stages-verify.ts:121-123` clears a prior `failedStage` explicitly
because "a resumed release may carry a historical failedStage from an earlier
attempt (for example, transient npm registry propagation)", and every other stage is
`isStageComplete`-gated so a resume cannot re-tag, re-push, or re-publish.

### Root Cause

`checkStaleTag(root, version, mode === 'resume')` (`pre-audit.ts:29`) was invoked in
all modes, but the `resume` argument was consulted **only** on the local-only-tag
path. The on-origin path returned a block unconditionally:

```ts
// scripts/public-release/pre-audit-local.ts:173-185 (pre-fix)
const onRemote = Boolean(remote.stdout.trim())
if (onRemote) {
  return {
    findings: [
      {
        check: 'stale-tag-absent',
        severity: 'block',
        message: `tag ${tag} already exists on origin — the release already shipped; use --resume or delete the release`,
      },
    ],
    fixes: [],
  }
}
```

The orchestrator then made that block fatal for resume as well:

```ts
// scripts/public-release/transaction.ts:256-258
if (preAudit.blocked && preAuditMode !== 'preview') {
  fail('Release pre-audit found blocking preconditions (see above).')
}
```

Per `FID-2026-0913-004` (`dev/fids/archive/FID-2026-0913-004-release-pre-audit.md:91`)
blocking on origin is the deliberate shipped-version guard for a **re-cut**. The
oversight was that the same guard also refused **resume**, which is not a re-cut —
and which the guard's own remediation text recommends. The `resume`-tolerance that
existed for a local-only tag was simply never extended to the on-origin tag.

The other two constraints then closed every remaining exit:

- Committing the fix changes HEAD → `receipt.headSha !== preflight.headSha` →
  `fail('Release HEAD changed …; refusing to resume.')` (`transaction.ts:139`,
  `:144`).
- Deleting the release or the tag to clear the pre-audit → `GH release view`
  fails, or `git rev-list -1 v0.0.33` returns non-zero / a different commit →
  post-release verification fails (`stages-verify.ts:85-101`).

### Evidence

Live reproduction against the shipped v0.0.33 (read-only: no fix in this state can
mutate — `checkWorktreeClean` and both config checks stage no fixes, and the
on-origin branch returns `fixes: []`):

```text
$ bun run release:public:resume
$ bun run scripts/public-release.ts --resume
  [pre-audit BLOCK] tag v0.0.33 already exists on origin — the release already shipped; use --resume or delete the release
Release pre-audit found blocking preconditions (see above).
error: script "release:public:resume" exited with code 1

$ git status --short
(empty — the attempt mutated nothing)
```

Direct call proving `resume=true` changed nothing on the on-origin path:

```text
$ bun -e "import { checkStaleTag } from './scripts/public-release/pre-audit-local.ts'; console.log(JSON.stringify(checkStaleTag(process.cwd(), '0.0.33', true), null, 2))"
{
  "findings": [
    {
      "check": "stale-tag-absent",
      "severity": "block",
      "message": "tag v0.0.33 already exists on origin — the release already shipped; use --resume or delete the release"
    }
  ],
  "fixes": []
}
```

The uncovered test gap (the suite covered only the local-only branch):

```text
$ grep -n "stale\|resume" scripts/__tests__/pre-audit.test.ts
161:  test('local-only tag is kept in resume mode', () => {
```

The benign primary failure — npm lost a read-after-write race, and the verifier had
no retry while its sibling does:

```text
$ npm view savant-code@0.0.33 version     # moments later
0.0.33
```

```text
packageIsPublished (npm-guards.ts:70-83)  — a single `npm view`, then return
verifyReleaseAssets (assets.ts:108-126)   — bounded retry window (45 min / 30 s poll)
```

## Impact Assessment

### Affected Components

- `scripts/public-release/pre-audit-local.ts` — `checkStaleTag`
- `scripts/public-release/pre-audit.ts` — check composition
- `scripts/public-release/transaction.ts` — `main()` pre-audit verdict, HEAD binding
- `scripts/public-release/stages-verify.ts` — `POST_RELEASE_VERIFY`
- `scripts/public-release/npm-guards.ts` — retry window over the npm read-after-write
- `scripts/public-release/env-ms.ts` — shared retry-window parse (new)
- `scripts/public-release/receipts.ts` — receipt lifecycle
- `scripts/__tests__/pre-audit.test.ts` — the previously uncovered case
- `scripts/__tests__/public-release-npm-guards.test.ts` — the retry legs (new)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

No workaround existed for a release failure after `GIT_PUSH` (npm publish, desktop
stages, asset-retry exhaustion, post-release verification): every one left its
receipt permanently `failedStage`-marked, with no path to the terminal
`POST_RELEASE_VERIFY` mark. Note that a `restored: true` receipt does **not** block
the next release (`local-state.ts` keys the next-cut guard to `restored`, not to
`failedStage`), so the damage is confined to the affected cut's own record.

## Proposed Solution

### Approach

Extend the existing `resume` tolerance from the local-only tag branch to the
on-origin branch, and give the npm read-after-write check the same bounded retry its
sibling already has. Both are fail-closed with retry, not fail-open.

For the guard, the minimal correct change is to return a `warn` (kept) instead of a
`block` when `resume` is true and the tag is on origin — mirroring the semantics
already stated for the local-only case ("resume mode never deletes … a legitimately
re-created tag is part of resume's contract"). The tag↔HEAD binding is **not** lost:
`verifyPreflight` already receives `allowExistingTag = options.resume ||
isStageComplete('TAG') || isStageComplete('GIT_PUSH')` (`transaction.ts:116-124`),
and it dereferences the existing tag and fails unless it points at release HEAD
(`preflight.ts:126-141`); `runPostReleaseVerifyStage` independently asserts
`git rev-list -1 v<version> === preflight.headSha` (`stages-verify.ts:96-101`). No
second, drifting implementation of annotated-tag dereferencing was written into the
pre-audit — `FID-2026-0913-004`'s own Missed Question 2 records why a parallel
implementation is the wrong shape here.

### Steps

1. [x] **RED:** added the missing pin to `scripts/__tests__/pre-audit.test.ts` for
       "tag on origin is kept in resume mode" (real temp git repo + bare origin,
       matching the existing harness at `pre-audit.test.ts:54`), and proved it fails
       against the pre-fix tree first: `Expected: "warn" / Received: "block"`
       (`pre-audit.test.ts:195`).
2. [x] **GREEN:** `checkStaleTag` now branches on `resume` inside the `onRemote`
       case: `block` in mutation mode (the shipped-version re-cut guard, unchanged
       and still pinned), `warn` (kept) in resume mode, with a message naming why
       resume is allowed to keep it.
3. [x] **GREEN:** `verifyPublishedPackage` waits on a bounded retry over
       `packageIsPublished` (`awaitPublishedPackage`, `npm-guards.ts:127-146`),
       mirroring the `assets.ts` pattern: `positiveEnvMs` (now shared at
       `scripts/public-release/env-ms.ts`, whose two production readers are the
       asset window and the npm window) + env-overridable
       `SAVANT_RELEASE_NPM_TIMEOUT_MS` / `SAVANT_RELEASE_NPM_POLL_MS` so tests can
       shrink the wait, then fails closed with the resume remediation.
4. [x] **VERIFY:** the npm-guards suite carries the RED-first legs — a transient
       404 is absorbed (probe false, false, true ⇒ resolves on the third read) and
       an expired window fails closed (`/release:public:resume/`); the pre-audit
       suite is green with both tag-on-origin modes pinned.
5. [x] **GOVERNANCE:** this record is updated to `verified` with a live
       three-gate receipt; the outcome is in the session summary.

**Deliberately not done:** re-running or re-finalizing the v0.0.33 receipt. Its HEAD
binding makes that impossible by construction (see Root Cause), and manually writing
a `POST_RELEASE_VERIFY` mark would fabricate pipeline evidence for a stage the
pipeline did not complete. The release's completion is instead recorded as
hand-verified evidence in the 2026-09-22 erratum (`dev/fids/README.md`).

### Verification

Proven by the new pin in `scripts/__tests__/pre-audit.test.ts` (tag-on-origin +
resume ⇒ no block, tag still present) and the retry legs in
`scripts/__tests__/public-release-npm-guards.test.ts`, with the `quality` gate as the
surrounding check.

Contract note: the promised test artifacts are
`scripts/__tests__/pre-audit.test.ts` (the missing pin) and
`scripts/__tests__/public-release-npm-guards.test.ts` (the retry legs). Both exist on
disk and appear in the gate declaration list below.

## Verification Gates

- gate: test scripts/__tests__/pre-audit.test.ts
- gate: test scripts/__tests__/public-release-npm-guards.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:a3fe41e41b26967325f17260cef122d1cc23e95b35fc30caeeac44efa0196de6
- verified: 2026-09-24T15:21:06.674Z
- test scripts/__tests__/pre-audit.test.ts: exit 0
- test scripts/__tests__/public-release-npm-guards.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** the v0.0.33 run exited 1 on a benign npm propagation race, and the
  documented remedy (`--resume`, named by both the failure's own source comment and
  the pre-audit's own message) fails at its first step.
- **GREEN:** diagnosis only, per the operator's recorded ruling (SCOPE.md T83-C:
  document only, change no guard code that session). The three constraints and
  every exit are established with file:line citations and a live reproduction.
- **AUDIT:** `bun run release:public:resume` reproduced live (exit 1, tree
  untouched); `checkStaleTag(..., resume=true)` called directly and shown to return
  `severity: "block"`; the on-origin branch read at
  `pre-audit-local.ts:174-185`; the fatal verdict read at `transaction.ts:256`; the
  suite searched and shown to cover only the local-only branch
  (`pre-audit.test.ts:161`). The release's own completion was independently
  verified, so the defect is isolated to the recovery path and not to the artifact.
- **ADVERSARIAL:** "is the block working as designed?" — partly yes, and that is
  why this was recorded rather than silently patched. `FID-2026-0913-004:91`
  specifies `block if on origin` for the re-cut guard, and the same FID's
  post-shipment note reads the identical v0.0.31 finding as the guard "doing its
  fail-closed job" (`:187-191`). The defect is the *unqualified* application: the
  file's own message routes the operator to `--resume`, and no test pinned the
  tag-on-origin + resume case, so a mode-blind block was indistinguishable from a
  mode-aware one. Second challenge: "could the operator just delete the release?"
  — no; that fails post-release verification (`stages-verify.ts:85-101`), which is
  why the remediation text was itself defective.
- **CHANGE DELTA:** initial authoring (100%).

### Loop 2 — RED / GREEN / AUDIT / ADVERSARIAL (implementation, 2026-09-24)

**RED — both pins failed against the unmodified tree, in different ways:**

```text
$ bun test scripts/__tests__/pre-audit.test.ts scripts/__tests__/public-release-npm-guards.test.ts
(fail) checkStaleTag > tag on origin is kept in resume mode (finishing the shipped release) [1414.91ms]
error: expect(received).toBe(expected)
Expected: "warn"
Received: "block"
      at <anonymous> (scripts/__tests__/pre-audit.test.ts:195:42)
# Unhandled error between tests
SyntaxError: Export named 'npmVerifyPollIntervalMs' not found in module
'C:\Users\spenc\dev\savant-code\scripts\public-release\npm-guards.ts'.
 13 pass
 2 fail
 1 error
```

The two failures are the two halves of the defect: the guard ignores its own `resume`
parameter (an assertion failure), and no bounded npm window exists at all (the
capability is absent).

**GREEN — five files, minimal:**

| File | Change |
| --- | --- |
| `scripts/public-release/pre-audit-local.ts` | `onRemote` + `resume` ⇒ `warn` (kept); mutation mode still blocks |
| `scripts/public-release/npm-guards.ts` | `npmVerifyTimeoutMs` / `npmVerifyPollIntervalMs` + `awaitPublishedPackage`; `verifyPublishedPackage` awaits it |
| `scripts/public-release/env-ms.ts` (new) | `positiveEnvMs` extracted so both windows share one parse (Law 13) |
| `scripts/public-release/assets.ts` | imports the shared parse (private copy removed; no behavior change) |
| `scripts/public-release/stages-verify.ts` | awaits `verifyPublishedPackage` |

**AUDIT — gates, live (2026-09-24):**

```text
$ bun test scripts/__tests__/pre-audit.test.ts scripts/__tests__/public-release-npm-guards.test.ts
 17 pass / 0 fail   (44 expect() calls)
$ bun test scripts/public-release*.test.ts scripts/__tests__/pre-audit.test.ts \
      scripts/__tests__/public-release-npm-guards.test.ts scripts/__tests__/validation-manifest.test.ts
 138 pass / 0 fail  (413 expect() calls, 22 files)
$ bun test <67 scripts test files, excluding the two process-spawning e2e suites>
 523 pass / 1 fail → the one failure was this session's OWN probe artifact
   (dev/scratchpad/tsconfig-…json tripping scratchpad-root hygiene); removed, then
 scripts/hygiene.test.ts 6 pass / 0 fail
$ bun run typecheck            exit 0 (12 workspaces)
$ bun x eslint . --max-warnings 0   exit 0
$ bun x prettier --check .     All matched files use Prettier code style
$ bun run lint:md              exit 0
$ bun run quality:report       PASS (1498 baselined files)
$ bun run validate:repository  PASS
$ bun run version:check        PASS (enforced surfaces synchronized)
```

**Call-graph reachability (Law 4) — the production path, not the declaration:**

```text
main()                                  scripts/public-release/transaction.ts
  → runPreAudit(root, version, preAuditMode)          :245   [fatal verdict :256]
    → checkStaleTag(root, version, mode === 'resume') pre-audit.ts:29
      → on-origin + resume ⇒ warn                     pre-audit-local.ts (new branch)
  → runPostReleaseVerifyStage(ctx)                    transaction.ts:214
    → await verifyPublishedPackage(root, target, version)   stages-verify.ts:113
      → awaitPublishedPackage(...)                    npm-guards.ts:154 → :127
positiveEnvMs readers: assets.ts:28, :39 · npm-guards.ts:102, :113
```

Every declared surface has a production caller; the two new exported npm helpers have
their production readers inside `awaitPublishedPackage` and their pins in the new
suite.

**ADVERSARIAL — four challenges, each answered with live evidence:**

1. *Does the `warn` weaken the shipped-version re-cut guard?* **No.** The mutation
   path still returns `block` (kept and still pinned by
   `pre-audit.test.ts:181`), and a re-cut that reaches `--resume` fails
   independently at `preflight.ts:126-141`, which dereferences the existing tag
   (`refs/tags/v<version>^{}`) and fails unless it equals release HEAD — plus the
   receipt HEAD binding at `transaction.ts:139`. The tolerance is scoped to the mode
   that finishes an already-shipped release, exactly as the local-only branch always
   was.
2. *Is the npm retry fail-open?* **No.** Only the not-found class is retried:
   `packageIsPublished` returns `false` solely for `isNotFoundResult` and calls
   `fail()` on every other npm outcome (auth, network, malformed output), so a broken
   environment still dies on the first read. On window expiry the stage fails closed
   with the resume remediation — pinned by the second leg.
3. *Are the pins tautological?* **Proven not to be, by trying to break them.**
   Collapsing the window to single-shot (temporary `Date.now() - 1`) makes the
   "absorbs a transient 404" pin fail in 0.73 ms, and the pre-audit pin's failure
   against the pre-fix guard is transcribed above. Both sources were restored; the
   suites are green again afterwards.
4. *Is the pin hermetic, and is it at the right boundary?* **Corrected mid-loop.**
   The first version of the absorb leg drove the whole `verifyPublishedPackage`,
   whose next step is the real, network-bound `npm pack` inspection — it failed for
   a reason unrelated to the retry. The retry is now pinned at its own boundary
   (`awaitPublishedPackage`), which is hermetic; the stage-level wiring is proven by
   the call-graph census instead of by a networked assertion.

**CHANGE DELTA:** implementation pass (~55 changed lines across 5 files + 2 test
artifacts).

### Missed Questions

1. *Why not fix it now, since the diagnosis is complete and the change is small?* —
   It is a change to a fail-closed release guard, and the operator ruled "document
   only" for that session. The fix landed the next session, as a unit: RED-first
   pins, the guard change, the retry and the full gate battery together.
2. *Does fixing the guard rescue the v0.0.33 receipt?* — No, by construction. The
   receipt is HEAD-bound (`transaction.ts:139`, `:144`) and post-release verification
   requires the tag to resolve to release HEAD (`stages-verify.ts:96-101`). Any fix
   commit moves HEAD; any workaround that keeps HEAD fixed leaves the tree dirty or
   the code unpatched. The forward fix and the v0.0.33 record are deliberately
   separate actions.
3. *Is the npm propagation failure itself a second bug?* — Yes, a lesser one: the
   verifier did an unretried read-after-write (`npm-guards.ts:70-83`) while its
   sibling in the same stage retried for 45 minutes (`assets.ts:14-15`, `:108-123`).
   Folded into this record rather than split, because both defects are the same
   recovery-path problem observed in one run.
4. *Would raising the pre-audit's block to a warn in all modes be simpler?* — No. It
   would delete the shipped-version guard that refuses a genuine re-cut. The
   tolerance must be scoped to `resume`, which is what the local-only branch already
   did.
5. *Should the receipt have been finalized by hand to clear the failure?* — No.
   Writing a `POST_RELEASE_VERIFY` mark would assert a stage that did not run. The
   honest record is the failed receipt plus a hand-verified erratum.
6. *(2026-09-24) Why is the retry not inside `packageIsPublished` itself?* — Because
   that function is also the pre-publish **decision** probe
   (`stages.ts:288`: `if (options.resume && packageIsPublished(...))` skip the
   publish). A bounded wait there would change stage selection for a case that is not
   a verification, and the observed race is in the verification. The retry belongs to
   the verifier.
7. *(2026-09-24) Does the artifact inspection (`npm pack`) after the presence check
   need the same retry?* — Not on the evidence available. The observed and
   receipt-recorded failure was the version-presence read; a "version resolvable but
   tarball briefly unavailable" state is theoretically possible on the same CDN but
   has never been observed in this repo's receipts or transcripts. Recorded here as
   the known unproven edge rather than pre-emptively retried, so the next operator
   sees the boundary of what this fix covers.
8. *(2026-09-24) Is the changed surface covered by a standing type check?* — Not by
   a broad one: `scripts/` carries no tsconfig and the root `typecheck` chain covers
   the 12 workspaces only. This session verified the changed scripts surface with a
   scratch `tsc --noEmit` probe over those files (strict, exit 0), then removed the
   probe (live probes belong in `/tmp`); the standing-gate question is registered as
   its own scope item rather than folded in here.

### Code Verification Evidence

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution — the guard's on-origin branch
      branches on `resume`; the npm presence read polls a bounded, env-overridable
      window; both fail closed.
- [x] Typecheck/tests/lint pass with pasted tool output — see Loop 2 AUDIT above
      (12/12 typecheck, 138/0 on the release suites, eslint 0, prettier clean,
      `lint:md` 0, `quality: PASS`, `validate:repository` PASS, `version:check`
      PASS) plus the live three-gate receipt below.
- [x] Production call-graph evidence: `main()` → `runPreAudit` (`transaction.ts:245`)
      → `checkStaleTag(..., mode === 'resume')` (`pre-audit.ts:29`); `main()` →
      `runPostReleaseVerifyStage` (`transaction.ts:214`) →
      `verifyPublishedPackage` (`stages-verify.ts:113`) → `awaitPublishedPackage`
      (`npm-guards.ts:154`, `:127`).
- [x] FID status reflects the actual implementation state — `closed` on the
      operator's closure directive, after the implementation existed in the
      worktree and all three declared gates passed live. The work is committed locally
      as `d31de31b`, with the push withheld by the operator.

## Resolution

- **Closed Date:** 2026-09-24
- **Fix Description:** **(A)** `checkStaleTag` now consults its `resume` parameter on
  the on-origin path too: mutation mode still blocks a re-cut (the shipped-version
  guard), while resume returns a `warn` and keeps the tag, because the tag on origin
  *is* the release being finished and its HEAD binding is verified downstream by
  `verifyPreflight` (`preflight.ts:126-141`) and re-asserted by
  `runPostReleaseVerifyStage` (`stages-verify.ts:96-101`). **(B)** The npm
  read-after-write in `POST_RELEASE_VERIFY` now polls a bounded window
  (`awaitPublishedPackage`, `npm-guards.ts:127-146`) with the same env-overridable
  shape as the asset retry, retrying only the not-found class and failing closed on
  expiry with the `--resume` remediation. **(C)** `positiveEnvMs` was extracted to
  `scripts/public-release/env-ms.ts` so the two retry windows share one parse, and
  `verifyPublishedPackage` became async with its single caller awaited
  (`stages-verify.ts:113`).
- **Tests Added:** Yes — 4 pins, and the first one closes the exact gap the previous
  session could only describe. `scripts/__tests__/pre-audit.test.ts`: "tag on origin
  is kept in resume mode (finishing the shipped release)" (severity `warn`, message
  names resume, no fixes, tag still present), alongside the retained
  mutation-mode block pin. `scripts/__tests__/public-release-npm-guards.test.ts`
  (new): transient 404 absorbed with the probe count asserted, expiry fails closed
  with the resume remediation, and the timing helpers honor env overrides and reject
  invalid values.
- **Verification Evidence:** receipt below (three gates, live) plus the Loop 2 AUDIT
  battery and the four adversarial challenges. Negative legs: the pre-fix guard
  failed the new pre-audit pin (`Expected: "warn" / Received: "block"`), and a
  temporary single-shot window failed the absorb pin in 0.73 ms (both restored).
  Committed as `d31de31b`; push withheld by the operator.
- **Archived:** 2026-09-24 — moved to `dev/fids/archive/`, and the receipt was
  re-stamped LIVE at the archived path (three gates, exit 0) so the closed record
  is byte-consistent with its final content. The work is committed locally as `d31de31b`,
  with the push withheld by the operator. The implementation evidence is the file:line
  ranges in this record plus the live receipt, which the FID Lifecycle rule admits
  for `closed`.

## Lessons Learned

A recovery path is itself a feature, and it needs a test for every state it will be
invoked in. This guard was authored with a `resume` parameter, a resume-specific
branch, and a message recommending `--resume` — every signal that resume was
considered — yet the on-origin path ignored the parameter and no test pinned the
combination. The failure is invisible until a release fails *after* its tag is
pushed, which is exactly when recovery matters most and exactly the class the same
module's comments anticipate. The general rule: when a mode parameter selects
between branches, pin the parameter's effect on **each** branch that returns a
verdict, not just the branch that was top-of-mind. A second rule follows from the
compounding: when recovery is constrained by a binding (here, the receipt's HEAD
binding), record what recovery *cannot* reach, so the next operator does not spend a
release night discovering that three individually-reasonable guards have no
intersection.

Two rules were added by the implementation pass. **(1) Pin the behavior at the
boundary that owns it.** The retry could not be pinned through the whole stage
function, because the step after the presence check is a real, network-bound
`npm pack` inspection — the first attempt at the pin failed for a reason unrelated to
the retry. Extracting the retrying seam (`awaitPublishedPackage`) made the pin
hermetic; the stage-level wiring is proven by a call-graph census instead of by a
networked assertion. **(2) A verification session's own scaffolding is part of the
tree.** The scratch tsconfig used to type-check the changed surface tripped the
repository's scratchpad-root hygiene gate — a self-inflicted red in a run whose
subject was elsewhere, caught only because the whole tree was re-run rather than the
touched files alone.
