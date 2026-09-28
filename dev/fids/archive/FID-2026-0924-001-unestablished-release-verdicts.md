# FID: Release stages report verdicts they have not established — and one poll cadence no path honored

**Filename:** `FID-2026-0924-001-unestablished-release-verdicts.md`
**ID:** FID-2026-0924-001
**Severity:** high
**Status:** closed
**Created:** 2026-09-24 17:10
**Automation level:** 2
> (Operator directive for this session: "audit the rest of the release pipeline
> for the same asymmetry — single-shot reads and mode parameters that only some
> branches honor" — the follow-on to FID-2026-0922-001. Every change below is
> scored level 2 on one property, stated so the operator can overrule it: **not
> one of them changes what the pipeline accepts or rejects.** They change what
> the pipeline *says*, plus one declared constant that no production path
> honored. F-4 is the closest call — it touches a fail-closed preflight guard —
> and it keeps that guard's decision identical (never delete on an unverifiable
> claim); it only stops rendering "unverifiable" as "verified present". The
> level reasoning is recorded under Missed Questions rather than assumed.)
**YAGNI-Compliance:** Pass

---

## Summary

An audit of the public-release pipeline for the asymmetry class FID-2026-0922-001
named — a single-shot read, or a mode/parameter that only some branches honor —
found four live instances and cleared four candidate suspect sites. Each of the
four is a place where the pipeline reported a conclusion it had not established,
or discarded a parameter it declared:

**F-1 — a dead poll cadence.** `runDesktopBundlesStage` injected
`sleepMs: () => new Promise(r => setTimeout(r, 1000))`, a lambda that ignored its
own `ms` argument, while `watchDesktopRun` passed the declared 30 s interval. The
DESKTOP_BUNDLES stage therefore polled GitHub at 1 Hz for up to 45 minutes
(≈2,700 requests) instead of once per 30 s, against `githubApiRequest` — a client
with **no 429 branch**, where any unexpected status calls `fail()` and kills the
cut. The declared cadence existed only in a signature nobody read.

**F-2 — a toolchain failure rendered as a binding verdict.** `validateResumeReceipt`
collapsed three unrelated causes — `git`, `bun` and `npm` failing to run — into the
message `Resume gate evidence is not bound to the current release environment`,
the same text it used for a genuine HEAD mismatch. An unverifiable environment read
as "your receipt does not match this machine" and pointed the operator at the wrong
remediation.

**F-3 — the `gh` requirement skipped in the only mode whose stages need `gh`.** The
command precheck omitted `gh` whenever `automation` was set, because automation's
tag/release work is token-native REST. But the desktop stages are admitted **only**
in automation and shell out to `gh run download` / `gh release upload`. With
`SAVANT_CODE_RELEASE_DESKTOP=1` and no `gh` on PATH, the cut failed *after* the npm
publishes, with `Failed to download desktop artifacts for run N: …` — a
transport-flavoured misattribution of a missing binary.

**F-4 — an unverifiable origin rendered as a verified present tag.**
`pruneLocalOnlyFailedTag` returned the same `false` for "the tag is on origin" and
for "`git ls-remote` failed"; `verifyPreflight` then told the operator
`Tag v<version> already exists; use --resume with its receipt` — a fact it had not
established, routing them at `--resume` for a tag that may never have been pushed.
This is the FID-2026-0922-001 deadlock's own shape, one layer down.

**F-5 — the only bounded wait an operator could not widen.** The asset and npm polls
take their windows from the environment; the desktop poll hardcoded 45 min / 30 s, so
a stuck desktop run was a dead end with no knob.

## Environment

- **OS:** Windows 11 (win32), bash via Git Bash
- **Language/Runtime:** TypeScript / Bun 1.3.14
- **Tool Versions:** git, `gh`, npm (registry client)
- **Commit/State:** release HEAD `8f40f6f2945e56fa7edaff92d1da3986ba090a5b`
  (`v0.0.33`); all changes in this record are **working-tree only** — G2 (commit
  authorization) is withheld, so evidence is file:line plus the live receipt, which
  the FID Lifecycle rule admits for a verified record.

## Detailed Description

### Problem

FID-2026-0922-001 fixed one instance of a pattern: a parameter (`resume`) that a
function accepted but only some branches honored, and a read (the npm
read-after-write) that was single-shot where its sibling retried. The audit asked
whether the same shape exists elsewhere in the pipeline. It does — four more times —
and three of the four share one failure mode: **a verdict the pipeline had not
established.**

That mode is not cosmetic. `verifyPreflight`'s tag message is the operator's only
signal for why a re-cut refused, and `--resume` is the remedy it names; telling them
"the tag already exists" when the truth is "origin was unreachable" is how a
transient becomes a release-night dead end.

### Expected Behavior

- A declared poll interval is the interval actually waited on the production path.
- A command that could not be executed is reported as an unverifiable environment,
  never as a binding mismatch.
- A tool the run needs is required in the mode that needs it — checked *before* the
  cut reaches the point of no return.
- An unverifiable remote says so; "present" and "unknown" are different verdicts.
- Every bounded wait is operator-tunable, as its siblings are.

### Root Cause

Four independent instances of one authoring habit — deriving a verdict from a
convenient proxy (a boolean, a mode flag, a collapsed status) rather than from the
evidence actually read.

**F-1.** `watchDesktopRun` takes a `DesktopRunPoller` with a `sleepMs(ms)` contract.
The production wiring satisfied the shape and discarded the argument:

```ts
// scripts/public-release/desktop-stages.ts (pre-fix)
const completed = await watchDesktopRun(
  {
    listRuns: () => listDesktopRuns(ctx.version, ctx.githubToken),
    nowMs: () => Date.now(),
    sleepMs: () => new Promise((resolve) => setTimeout(resolve, 1000)),
  },
  ctx.version,
)
```

The type says `sleepMs: (ms: number) => Promise<void>`; the lambda declares no
parameters, so the `ms` `watchDesktopRun` passes at
`desktop-workflow.ts:167` is silently dropped. Nothing failed, because a shorter
sleep is not an error — it is 2,700 requests where 90 were intended.

**F-2.** `receipts.ts` ran three version probes and then asked one question:

```ts
// scripts/public-release/receipts.ts (pre-fix, collapsed)
if (
  currentHead.status !== 0 ||
  bun.status !== 0 ||
  npm.status !== 0 ||
  currentHead.stdout.trim() !== parsed.headSha
) {
  fail(`Resume gate evidence is not bound to the current release environment: ${filePath}`)
}
```

The first three are "I could not look"; the fourth is "I looked, and it is wrong."
Only the fourth is a statement about the receipt.

**F-3.** The command precheck reasoned from the mode alone:

```ts
// scripts/public-release/transaction.ts (pre-fix)
const commandWarnings = [
  options.automation || options.preview ? undefined : requireCommand('gh', true),
  requireCommand('npm', !options.preview),
].filter((warning): warning is string => Boolean(warning))
```

The mode is a good proxy for *most* of automation — but not for the desktop stages,
which `assertEnabled` refuses to run outside automation (`desktop-stages.ts:86-96`)
and which call `downloadDesktopArtifacts` / `uploadDesktopAssets`, both `gh`.

**F-4.** `pruneLocalOnlyFailedTag` answers "did I safely recover the tag?", but it
returned a boolean, so its three distinct keep-causes were indistinguishable at the
call site — including the one that is not a cause at all:

```ts
// scripts/public-release/git-publish.ts (pre-fix)
const remote = run('git', ['ls-remote', '--tags', 'origin', `refs/tags/v${version}`], root, true)
if (remote.status !== 0 || remote.stdout.trim()) return false
```

`pre-audit-local.ts:167-176` already had the right pattern in the same repo — a
failed `ls-remote` there warns `cannot verify whether ${tag} exists on origin
(ls-remote failed); keeping the tag`. The prune path had never been taught it.

**F-5.** `assets.ts:27-43` and `npm-guards.ts:102-115` read their windows through
the shared `positiveEnvMs`; `desktop-workflow.ts` hardcoded two constants beside
them.

### Evidence

**F-1 — the constant that no path honored.** `DEFAULT_POLL_INTERVAL_MS` (30 s) is
passed at `desktop-workflow.ts:167` and was discarded by the injected lambda at
`desktop-stages.ts:106`; `DEFAULT_POLL_TIMEOUT_MS` (45 min) bounds the same loop at
`desktop-workflow.ts:143` ⇒ 90 intended requests, ≈2,700 actual. The transport has
no 429 handling and no retry — any unexpected status fails the cut:

```ts
// scripts/public-release/github-api.ts
if (!expected.includes(response.status)) {
  if (response.status === 404 && expected.includes(404)) return { status: response.status, body: undefined }
  fail(`GitHub API request failed with HTTP ${response.status}.`)
}
```

**F-2 — the two causes shared one message.** Post-fix the toolchain leg names the
tool; the binding leg keeps the original text. The pre-fix behaviour is the RED leg
recorded in Loop 2.

**F-3 — `gh` is a hard dependency of an automation-only stage.**
`desktop-workflow.ts:downloadDesktopArtifacts` runs `gh run download <id> …` and
`uploadDesktopAssets` runs `gh release upload …`, both reached only from
`runDesktopReleaseStage`, which `desktop-stages.ts:92-96` refuses to run outside
automation:

```ts
if (!ctx.options.automation) {
  fail('Desktop stages require automation mode (token-native REST dispatch); manual mode is not supported for v1.')
}
```

**F-4 — the operand of the verdict.** The pre-fix call site:

```ts
// scripts/public-release/preflight.ts (pre-fix)
const pruned = mutationMode ? pruneLocalOnlyFailedTag(root, version, headSha) : false
if (!pruned) {
  const message = `Tag v${version} already exists; use --resume with its receipt.`
  if (mutationMode) fail(message)
  warnings.push(message)
}
```

**F-5 — the asymmetry, side by side.**

```text
assets.ts:27   assetRetryTimeoutMs()   positiveEnvMs('SAVANT_RELEASE_ASSET_TIMEOUT_MS', …)
assets.ts:38   assetPollIntervalMs()   positiveEnvMs('SAVANT_RELEASE_ASSET_POLL_MS', …)
npm-guards.ts:102  npmVerifyTimeoutMs()      positiveEnvMs('SAVANT_RELEASE_NPM_TIMEOUT_MS', …)
npm-guards.ts:112  npmVerifyPollIntervalMs() positiveEnvMs('SAVANT_RELEASE_NPM_POLL_MS', …)
desktop-workflow.ts:86/:87   DEFAULT_POLL_TIMEOUT_MS / DEFAULT_POLL_INTERVAL_MS  — constants
```

## Impact Assessment

### Affected Components

- `scripts/public-release/desktop-workflow.ts` — production poller seam; tunable window
- `scripts/public-release/desktop-stages.ts` — the stage's poller wiring
- `scripts/public-release/receipts.ts` — `validateResumeReceipt`
- `scripts/public-release/transaction.ts` — `requiresGhCli` + the command precheck
- `scripts/public-release/git-publish.ts` — `FailedTagPruneOutcome`, `pruneLocalOnlyFailedTag`
- `scripts/public-release/preflight.ts` — `blockedTagMessage` + the tag verdict
- `scripts/public-release-desktop-workflow.test.ts` — F-1, F-5 pins
- `scripts/public-release-desktop.test.ts` — F-3 pin
- `scripts/public-release-tag-hygiene.test.ts` — F-4 pins
- `scripts/public-release-receipts.test.ts` — F-2 pin

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

F-1 is the one with an operational blast radius: a self-inflicted rate limit, at
1 Hz for 45 minutes, on the stage that runs *between* the backup bundle and the
GitHub release — i.e. after the tag is pushed. F-3 fails the cut after the npm
publishes. F-2 and F-4 are misdiagnoses that cost an operator a release night rather
than a release. All four are recovery/diagnosis defects: none of them can corrupt a
published artifact.

## Proposed Solution

### Approach

Restore the evidence-to-verdict relation in each case, and keep every decision
fail-closed. No change relaxes what the pipeline accepts or rejects.

### Steps

1. [x] **F-1 — one production poller, honoring its argument.** New
       `desktopRunPoller(listRuns)` factory (`desktop-workflow.ts:123-135`) is the
       single production seam; it forwards `ms` to `setTimeout`. The stage injects
       `desktopRunPoller(() => listDesktopRuns(...))` (`desktop-stages.ts:105-108`).
2. [x] **F-2 — name the tool that did not run.** `validateResumeReceipt` builds a
       `toolRuns` list, and any non-zero status fails with
       `Resume environment cannot be verified — <tools> did not run in <root>
       (<receipt>); fix the toolchain, then re-run 'bun run release:public:resume'`
       (`receipts.ts:86-98`). The HEAD mismatch keeps its original message
       (`receipts.ts:99-103`).
3. [x] **F-3 — derive the requirement from the mode *and* the desktop flag.**
       `requiresGhCli(options, env)` (`transaction.ts:66-83`) returns true for manual
       runs, false for preview, and for automation it asks
       `isDesktopPackagingEnabled(env)`; the precheck consumes it
       (`transaction.ts:125-128`).
4. [x] **F-4 — make the outcome say which cause it was.**
       `FailedTagPruneOutcome = 'pruned' | 'kept' | 'kept-unverified'`
       (`git-publish.ts:212`); a failed `ls-remote` returns `kept-unverified`
       (`git-publish.ts:250`); `blockedTagMessage(outcome, version)`
       (`preflight.ts:29-42`) owns the verdict text and is consumed at
       `preflight.ts:171-178`. No deletion ever happens on an unverifiable claim —
       the guard's decision is unchanged.
5. [x] **F-5 — route the desktop window through the shared parse.**
       `desktopPollTimeoutMs()` / `desktopPollIntervalMs()`
       (`desktop-workflow.ts:97-113`) via `positiveEnvMs`; consumed at
       `desktop-workflow.ts:143` and `:167`.
6. [x] **VERIFY** — one RED-first pin per finding, a load-bearing negative leg for
       both behavioural pins (F-1, F-4), the release suites green, the changed
       `scripts/` surface type-clean, and the standing battery run.
7. [x] **GOVERNANCE** — registered as SCOPE Task 85; this record carries a live
       receipt.

### Verification

Every promised test artifact, named as its repo-relative path and declared as a gate
below:

- `scripts/public-release-desktop-workflow.test.ts` — F-1 (the poller honors its
  argument) and F-5 (the timing helpers honor env overrides and reject invalid ones).
- `scripts/public-release-desktop.test.ts` — F-3 (`requiresGhCli`, five cases).
- `scripts/public-release-tag-hygiene.test.ts` — F-4 (an unreachable origin is
  `kept-unverified` and the tag survives; the verdict text distinguishes
  unverified from present).
- `scripts/public-release-receipts.test.ts` — F-2 (the failing tool is named).

## Verification Gates

- gate: test scripts/public-release-desktop-workflow.test.ts
- gate: test scripts/public-release-desktop.test.ts
- gate: test scripts/public-release-tag-hygiene.test.ts
- gate: test scripts/public-release-receipts.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:0cbb8d440bff3d771d87451313e037c1612c38942796431b4ae8aebf8c504405
- verified: 2026-09-25T15:31:07.133Z
- test scripts/public-release-desktop-workflow.test.ts: exit 0
- test scripts/public-release-desktop.test.ts: exit 0
- test scripts/public-release-tag-hygiene.test.ts: exit 0
- test scripts/public-release-receipts.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** the audit enumerated the asymmetry class and found four live instances
  (F-1…F-4) plus one consistency gap (F-5), each with a file:line and the evidence
  that the parameter/read was discarded or collapsed. F-1 and F-2 were pinned RED
  against the unmodified tree in this session's first half: the F-2 pin failed with
  the misattribution message (`/cannot be verified/` absent), and the F-1 pin had no
  production seam to test at all until `desktopRunPoller` existed.
- **GREEN:** diagnosis plus the pins, one per finding.
- **AUDIT:** the release suite is green after each change (recorded below); the
  changed `scripts/` surface type-checks clean under a root-inheriting probe.
- **ADVERSARIAL:** see Loop 2 — every "is this actually a defect?" challenge is
  answered, and two candidates were cleared rather than fixed.
- **CHANGE DELTA:** initial authoring (100%).

### Loop 2 — RED / GREEN / AUDIT / ADVERSARIAL (implementation)

**RED — the pins that failed first, and one that could not exist:**

```text
$ bun test scripts/public-release-receipts.test.ts scripts/public-release-desktop-workflow.test.ts
(fail) … > names the failing tool when the resume environment cannot be inspected
  Expected: /cannot be verified/   Received: "Resume gate evidence is not bound to the current release environment: …"
 7 pass / 2 fail   ← both new legs red against the unmodified tree

$ bun test scripts/public-release-tag-hygiene.test.ts   (before the F-4 fix)
  no assertion could pass: pruneLocalOnlyFailedTag returned boolean, so
  `toBe('kept-unverified')` had no possible operand — the capability was absent,
  not merely wrong (same shape as FID-2026-0922-001's missing npm window).
```

**GREEN — six source files, one new type, one new predicate, one new seam:**

| File | Change |
| --- | --- |
| `desktop-workflow.ts` | `desktopRunPoller` (single production seam, honors `ms`); `desktopPollTimeoutMs` / `desktopPollIntervalMs` via `positiveEnvMs` |
| `desktop-stages.ts` | injects `desktopRunPoller(...)` |
| `receipts.ts` | `toolRuns` + named unverifiable-environment failure; HEAD mismatch unchanged |
| `transaction.ts` | `requiresGhCli(options, env)`; precheck consumes it |
| `git-publish.ts` | `FailedTagPruneOutcome`; `kept-unverified` on a failed `ls-remote` |
| `preflight.ts` | `blockedTagMessage(outcome, version)` owns the verdict text |

**AUDIT — gates, live:**

```text
$ bun test scripts/public-release-desktop-workflow.test.ts \
      scripts/public-release-desktop.test.ts scripts/public-release-tag-hygiene.test.ts
 24 pass / 0 fail   (82 expect() calls, 3 files)
$ bun test scripts/public-release scripts/__tests__/pre-audit.test.ts \
      scripts/__tests__/public-release-npm-guards.test.ts
 143 pass / 0 fail   (433 expect() calls, 22 files)   ← was 138/0 before these pins
$ bunx tsc -p <root-inheriting probe over the six changed modules + five test files>
 exit 0  (probe deleted after use — see Missed Questions)
```

**ADVERSARIAL — six challenges, two of which cleared candidates instead of fixing them:**

1. *Is the dead cadence actually harmful, or just untidy?* **Harmful.** 1 Hz for 45
   minutes is ≈2,700 requests against a client that fails the cut on any unexpected
   status, with no 429 branch and no retry — a self-inflicted rate limit on a stage
   that runs after the tag is pushed. The fix is the honest one (honor the
   parameter), not a workaround.
2. *Should the fix instead be a retry/429 branch in `githubApiRequest`?* **No —
   and this is a deliberate non-finding.** The primitive carries non-idempotent
   POSTs: `createGitHubReleaseApi` (`/releases`, expects 201) and
   `dispatchDesktopRelease` (`/actions/workflows/…/dispatches`, expects 204). A
   blind retry there could double-create a release or re-dispatch the desktop
   workflow. The retries that belong at call sites already exist
   (`verifyReleaseAssets`, `awaitPublishedPackage`), because those wait on an
   external system that legitimately lags. F-1's cadence fix removes the
   self-inflicted pressure that made the missing 429 branch dangerous.
3. *Does F-3 make the release stricter in a way that could block a working run?*
   It adds one precheck. A run that would previously have succeeded still succeeds
   (it must have had `gh` to get past the desktop stages); a run that would have
   failed late now fails early, before the npm publishes. Strictly an improvement in
   fail-closed ordering, never a new false negative.
4. *Does F-4 weaken the P2 tag-prune guard?* **No.** The guard's decision is
   unchanged — delete only when ownership is proven *and* origin is reachable and
   does not carry the tag. `kept-unverified` takes the same non-deleting path as
   `kept`; only the message differs. The pre-fix code already refused to delete on a
   failed `ls-remote`; the defect was purely that it said the opposite.
5. *Is the F-4 pin tautological?* **Proven not to be, by trying to break it.**
   Collapsing `blockedTagMessage`'s `kept-unverified` branch back into the generic
   verdict makes the new verdict pin fail; the pre-fix boolean return makes the
   outcome pin structurally impossible. Both were restored.
6. *Is the F-1 pin load-bearing?* **Proven by mutation.** Restoring the
   argument-ignoring lambda (`sleepMs: (_ms) => setTimeout(…, 1000)`) makes exactly
   the cadence pin fail, at 1002.88 ms; restored, the suite is green again.

**Candidates audited and cleared (not defects):**

- `assertNoExistingRelease` (`gh`) vs `assertNoExistingReleaseApi` (REST) —
  mode-consistent: the same `!options.resume` gate (`stages.ts:76-80`), and both
  separate "exists" from "could not verify" (`isNotFoundResult` vs `status !== 404`).
- `verifyGitHubTagHead` (`gh`) vs `verifyGitHubTagHeadApi` (REST) — behaviourally
  equivalent: both accept the lightweight `commit` case, dereference annotated tags
  through `/git/tags/<sha>`, fail closed on the same two conditions, and emit the
  same message text; only the transport-failure wording differs.
- The `GITHUB_RELEASE` automation/manual branches (`stages.ts:227-276`) — complete in
  both modes (create / verify / tag-bind).
- `watchDesktopRun`'s testability — never the problem. The window was injectable and
  the suite used fake clocks; what F-1 broke was the *production* seam alone.

**CHANGE DELTA:** implementation pass (~70 changed lines across 6 source modules + 4
test files + 2 new exports).

### Missed Questions

1. *Why is this level 2 when FID-2026-0922-001's guard change was level 1?* — Because
   the property that made that one level 1 does not hold here: it relaxed a
   fail-closed verdict (`block` → `warn`) and needed a recorded operator
   authorization to land. Nothing here relaxes a verdict. F-4 changes a guard's
   *message*, and the guard still never deletes on an unverifiable claim; F-3 makes
   the pipeline *more* fail-closed, earlier. If the operator reads F-4 as
   guard-adjacent enough to need level-1 treatment, the change is small and isolated
   to `git-publish.ts` + `preflight.ts` and can be reverted on its own.
2. *Does anything here need the `scripts/` type-check surface that Task 84 is blocked
   on?* — Yes, and that is exactly why the probe was used. `scripts/public-release/**`
   is where all six changed modules live, and no standing gate covers it; the changed
   surface was verified with a root-inheriting `tsc --noEmit` probe (strict + the
   root `paths` aliases) at **exit 0**, then the probe was deleted. This is the
   second session in a row where a signature change to a release module had to be
   proven by a hand-built probe — recorded evidence for T84-B's ruling, not a
   substitute for it.
3. *Is `kept-unverified` a new failure mode the caller can now hit?* — No new outcome
   reaches the operator as a *success* or a *refusal that did not exist*: pre-fix, a
   failed `ls-remote` also kept the tag and also failed the mutation run. Only the
   text changed. In preview the outcome is still `kept` (preview never probes the
   remote, because the probe exists inside a function that mutates), so preview
   output is byte-identical.
4. *Why is the poll *interval* env-overridable when tests inject the poller anyway?* —
   For symmetry with the two sibling windows, and because the interval is the value
   F-1 proved could be silently wrong; a knob makes the effective cadence
   observable and tunable without a code change.
5. *Could the F-1 fix mask a genuine need for faster polling?* — No, and the
   direction matters: `watchDesktopRun` polls a *workflow run* whose own duration is
   ~10 minutes at best. 30 s granularity on a 45-minute window is 90 samples; the
   1 Hz cadence bought nothing but load.
6. *Was any instance missed because the audit stopped at `scripts/public-release/`?* —
   Stated boundary: the audit covered the public-release pipeline (the 20 modules and
   5 test files listed in Relevant Files of the session record). The adjacent
   `scripts/` surfaces that shell into the same systems (`pre-push-scan.ts`,
   `release-preaudit.ts`, `bump-version.ts`) were not swept for this same class;
   `release-preaudit.ts` consumes `currentVersion` only. Recorded as the boundary of
   what this record claims.

### Code Verification Evidence

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution — the poller forwards `ms`; the
      resume failure names its tool; the `gh` requirement is mode **and** flag
      derived; the prune outcome distinguishes unverified; the desktop window reads
      the environment.
- [x] Typecheck/tests/lint pass with pasted tool output — see Loop 2 AUDIT (24/0 on
      the three focused suites, 143/0 across the 22-file release set, probe exit 0)
      plus the live receipt below.
- [x] Production call-graph evidence — the census below.
- [x] FID status reflects the actual implementation state — `verified`; the
      implementation exists in the working tree and all five declared gates pass
      live. The commit is withheld (G2), so this record carries file:line + receipt
      evidence rather than a SHA.

**Call-graph reachability (Law 4) — the production path, not the declaration:**

```text
F-1  main() → … → runDesktopBundlesStage        transaction.ts:207 → :211
       → watchDesktopRun(desktopRunPoller(…))   desktop-stages.ts:105-106
         → poller.sleepMs(desktopPollIntervalMs())   desktop-workflow.ts:167
F-2  loadResumeReceipt → validateResumeReceipt  receipts.ts:86-98
F-3  requiresGhCli(options)                     transaction.ts:126
       → isDesktopPackagingEnabled(env)         catalog.ts:232
F-4  verifyPreflight → pruneLocalOnlyFailedTag  preflight.ts:171-172 → git-publish.ts:219
       → blockedTagMessage(outcome, version)    preflight.ts:174 → :29
F-5  desktopPollTimeoutMs / desktopPollIntervalMs   desktop-workflow.ts:97, :108
       readers: :143, :167
positiveEnvMs readers now: assets.ts:28, :39 · npm-guards.ts:102, :113 · desktop-workflow.ts:100, :111
```

## Resolution

- **Closed Date:** 2026-09-25
- **Fix Description:** Four verdict/mode asymmetries repaired and one consistency gap
  closed: **(F-1)** the DESKTOP_BUNDLES poller is a single production seam
  (`desktopRunPoller`) that honors the interval it is passed, restoring the declared
  30 s cadence; **(F-2)** `validateResumeReceipt` names the tool that failed to run
  instead of reporting an unverifiable environment as a HEAD-binding verdict;
  **(F-3)** `requiresGhCli` requires the `gh` CLI for automation runs with desktop
  packaging enabled, so a missing binary fails before the npm publishes instead of
  after; **(F-4)** `pruneLocalOnlyFailedTag` returns `pruned | kept | kept-unverified`
  and `blockedTagMessage` renders each cause distinctly, so an unreachable origin no
  longer reads as "the tag already exists" — the guard still never deletes on an
  unverifiable claim; **(F-5)** the desktop poll window and interval read
  `SAVANT_RELEASE_DESKTOP_TIMEOUT_MS` / `SAVANT_RELEASE_DESKTOP_POLL_MS` through the
  shared `positiveEnvMs`, matching the asset and npm windows.
- **Tests Added:** Yes — 6 new pins across 4 files, closing the exact gaps the audit
  named: `desktopRunPoller` honors its argument (the dead-cadence pin, mutation-proven
  load-bearing at 1002.88 ms); the timing helpers honor env overrides and reject
  invalid values; `requiresGhCli` across five mode/flag combinations; an unreachable
  origin yields `kept-unverified` with the tag left in place; and the verdict text
  never renders unverified as present.
- **Verification Evidence:** receipt below, re-run and re-stamped LIVE at the archived
  path on closure (five gates, all exit 0), plus the Loop 2 AUDIT battery, the six
  adversarial challenges, and the four cleared candidates. The closure session also
  observed that this record had reached `verified` carrying a `pending` receipt — a
  status claim pointing at an artefact that was not there — and stamped it as part of
  closing, so the record's evidence now matches its status. The commit is withheld
  (G2), so the implementation evidence is the file:line ranges in the record, which
  the FID Lifecycle rule admits for `closed`.
- **Archived:** `dev/fids/archive/FID-2026-0924-001-unestablished-release-verdicts.md`
  (2026-09-25)

## Lessons Learned

The asymmetry this audit hunted has one engine: **a verdict was derived from a
convenient proxy instead of the evidence actually read.** `options.automation` is a
fine proxy for "this run is token-native REST" — until one branch of that mode shells
out to `gh`. A `false` return is a fine encoding for "not recovered" — until two of
its causes are "the tag is there" and "I could not look". A 1-second sleep is a fine
implementation of `sleepMs` — until the caller's whole correctness argument was the
value being passed.

The transferable rule: **a collapsed return value is a place where a diagnosis goes
to die.** When a function or a branch has more than one reason to produce the same
answer, and at least one caller turns that answer into an operator-facing sentence,
the reasons must survive the boundary — as an enum, a named outcome, or a message
built where the evidence was read. A boolean is a promise that all its causes are
interchangeable, and that promise is rarely true in a fail-closed pipeline where
every distinct cause has its own remediation.

Two smaller rules follow. **A parameter that no production path honors is worse than
an absent parameter**, because the signature and the declaration advertise a contract
the code does not keep — and a shorter sleep looks like an optimization, not a bug,
so nothing trips. And: **the fix for "this check fires too often" is almost never
"retry harder at the transport"** — `githubApiRequest`'s lack of retry is correct
precisely because it carries non-idempotent POSTs, so the load had to be removed at
the source (the cadence) rather than tolerated downstream.
