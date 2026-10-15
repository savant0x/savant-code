# FID: Law 15 capture refuses its own baseline on a large repository, disarming the backstop

**Filename:** `FID-2026-1006-004-law15-capture-budget-refusal.md`
**ID:** FID-2026-1006-004
**Severity:** high
**Status:** closed
**Created:** 2026-10-06 19:32
**Automation level:** 2
**YAGNI-Compliance:** Verified

---

## Summary

The Law 15 worktree backstop is inert in this repository, and the refusal that disarms it is
produced by a cost model that scales with repository size. `captureWorktreeBaseline`
enumerates the full candidate inventory and content-hashes every path inside
`CAPTURE_BUDGET_MS = 5_000`; a blow is refused by design and stamped
`worktreeBaselineMethod = 'unavailable'`, which `reconcileWorktree` turns into an
unconditional cannot-verify — so no out-of-band mutation is detectable for the life of the
session. Measured on this repository (HEAD `43f436b0`, warm cache): capture costs 956-1,128
ms for 5,454 hashed paths / 27.1 MB, i.e. 19-23% of the budget, so the refusal is a cold or
loaded condition rather than a certainty — which is exactly why it is intermittent and easy
to dismiss. A second size-dependent leg sits behind it: the reconcile deletion scan is one
`statSync` per baseline key (5,459 keys measured at 181 ms, 36% of the 500 ms budget it
shares with a ~110 ms enumeration spawn and the candidate hashing). A third defect is in the
reporting and recovery: the refusal names no leg and no files, both spawn helpers treat any
`spawnSync` error — including a measured spurious immediate `ETIMEDOUT` (13 ms against a
500 ms budget) — as "git failed", and nothing ever retries a refused baseline, so one
transient failure disarms the backstop permanently. This record fixes the cost model in both
legs, replaces the deletion net with a change-bounded source that loses no deletion class,
and makes the refusal specific and recoverable.

## Environment

- **OS:** win32 (Git Bash)
- **Language/Runtime:** TypeScript (strict), Bun 1.3.14
- **Tool Versions:** git, bun test, eslint, markdownlint, prettier (repo-pinned)
- **Commit/State:** HEAD `43f436b0`. The tree carried 3 modified and 3 untracked paths at
  authoring (this record among them), so the inventory figures below are reported for the
  tracked set — which is the clean-tree value: 5,458 enumerated paths today minus the 3
  untracked files = 5,455.

## Detailed Description

### Problem

Every turn end in this repository can emit:

```text
Law 15 worktree reconciliation cannot verify: baseline capture failed or could not
enumerate/hash within its initialization budget — out-of-band mutations are
unverifiable this turn. Run the project verification commands explicitly.
```

The advisory is truthful, and that is the defect. It is not noise to be suppressed: it is
the report of a governance control that has stopped working. The subsystem's stated purpose
is to catch mutations that bypass the tracked write tools — its own header names the case:
"one `run_terminal_command` (`sed -i`, `>`, `git checkout`) mutates the tree with no record
for the Law 15 backstop to find." That detection cannot run. `unavailable` short-circuits
`reconcileWorktree` before any scanning, so the report names no files and the backstop
detects nothing for the remainder of the session, on every session that refuses its
baseline.

### Expected Behavior

Capture cost should be a function of what has to be hashed, not of how many files the
repository contains, so that a first-class repository (a few thousand files) captures its
baseline well inside the one-time budget. Reconciliation should then either verify the turn
or name a specific, actionable degradation (which leg failed, which scan exceeded which
budget, and how many paths went unexamined) — never a blanket "cannot verify" produced
before any scan is attempted, and never a degraded verdict whose cause cannot be read off
the message. A refused baseline must be recoverable rather than terminal for the session.
Fail-closed refusal must be preserved for the genuinely unenumerable cases.

### Root Cause

Three defects, all measured on HEAD `43f436b0`.

1. **Capture cost is a function of repository size.** `captureWorktreeBaseline` enumerates
   candidates with `runGitFileList` (`git ls-files -z --cached --others --exclude-standard`)
   and then runs `hashFile` (stat + full read + SHA-256) over every one of them. The budget
   check fires between files; on a blow the function deliberately refuses the whole capture —
   "half-captured baselines fail open, so a budget blow is refused entirely and recorded as
   `unavailable`" — wipes the map, and stamps the method. The refusal itself is correct; the
   cost that triggers it is not. Measured warm: 956, 1,005, 1,064 and 1,128 ms over four
   captures (one after a 6 s process-age idle) for 5,454 hashed paths, so the blow needs only
   a 4-5x slowdown — which is what a cold first-touch read of 5,454 files under an on-access
   scanner produces, and the refusal has been observed live.
2. **The reconcile deletion leg shares the same cost class.** Reconcile iterates
   `Object.keys(baseline)` and calls `fileExists` (`statSync`) for each, inside
   `RECONCILE_BUDGET_MS = 500`, which it shares with an enumeration spawn (~110 ms measured)
   and the candidate hashing. Measured: 181 ms for 5,459 `statSync` calls (33 us/path) — 36%
   of the budget on its own, with reconcile totalling 289-344 ms warm. This is not a
   standalone blow, and the record does not claim one: it is the largest remaining
   repository-size term in a 500 ms budget, and it is one of the two legs an end-to-end probe
   failed on (see Evidence). The leg exists precisely because the candidate loop swallows
   deletions (`hashFile` returns null for a missing path and the loop `continue`s), so it is
   not optional work that can be dropped to buy budget.
3. **A failed scan cannot say why, and a transient failure is permanent.** The refusal and
   degrade diagnostics name no leg, no count and no files; `runGitFileList` and
   `runGitStatusList` both classify any `spawnSync` `result.error` as "git failed"; and
   `maybeCaptureWorktreeBaseline` returns early whenever `worktreeBaselineCapturedAt != null`,
   so a single refusal is never revisited. Measured: a `spawnSync` with `timeout: 500`
   returned a spurious immediate `ETIMEDOUT` (13 ms) for a command that takes 112 ms, twice in
   the same process, with the immediately following identical spawn succeeding both times —
   i.e. the classification cannot distinguish "git is unavailable" from "this one call
   failed".

Historical note: the same cost class was already corrected once, at reconcile only
(2026-10-02), when turn-end re-hashing of the full inventory "fit the 610-file tree it was
measured on but blew the 500ms budget on a 5,000+-file repo". Capture was left on
full-inventory hashing with a 10x larger budget, and the repository has since grown past even
that budget — the fix was applied to one of the two hashing legs and the other has now been
outgrown for the second time.

### Evidence

Inventory — the original figures reproduce exactly for the tracked set:

```text
$ git ls-files --cached --others --exclude-standard | wc -l
5458                     # minus the 3 untracked files present today = 5455 tracked

$ git ls-files -z --cached --exclude-standard | xargs -0 wc -c | tail -1
27123401 total           # the 27.1 MB figure, tracked only

$ git ls-files -z --cached --others --exclude-standard | xargs -0 wc -c | tail -1
27146472 total           # with the 3 untracked files present today

$ git status --porcelain --untracked-files=all | wc -l
6
```

Capture cost and outcome, measured through the production function (fresh process):

```text
{"captureMs":1128,"method":"git","keyCount":5454}
{"captureMs":956,"method":"git","keyCount":5454}
{"captureMs":1005,"method":"git","keyCount":5454}
{"note":"capture after 6s process age","captureMs":1122,"method":"git",
 "keyCount":5454,"dirtyPaths":7,"skipped":5}
```

Enumeration and deletion-leg cost (the commands the module itself spawns):

```text
{"paths":5459,"statMs":181,"perPathUs":33}                 # statSync per baseline key
{"run":0,"ms":109,"status":0,"err":null,"bytes":240}    # git status --porcelain -z
{"run":1,"ms":104,"status":0,"err":null,"bytes":240}
{"run":2,"ms":112,"status":0,"err":null,"bytes":240}
{"run":0,"kind":"ls-files","ms":149,"status":0,"err":null}
{"run":1,"kind":"ls-files","ms":141,"status":0,"err":null}
{"run":2,"kind":"ls-files","ms":150,"status":0,"err":null}
```

End-to-end `captureWorktreeBaseline` then `reconcileWorktree` in one process — the reconcile
leg reported itself failed, on a git that returns in ~110 ms:

```text
{"captureMs":937,"method":"git","keyCount":5454,"dirtyPaths":7,"skipped":5,
 "reconcile":{"method":"git","degraded":true,"unverifiable":false,
 "changed":0,"deleted":0},
 "diagnostic":"Law 15 worktree reconciliation degraded: git failed at turn end
 (it worked at capture). Cannot verify out-of-band mutations — failing closed."}
```

Warm reconcile runs after a capture, same process shape:

```text
{"reconcileMs":289,"method":"git","degraded":false}
{"reconcileMs":318,"method":"git","degraded":false}
{"reconcileMs":344,"method":"git","degraded":false}
```

The spurious-timeout series — identical command, identical timeout, alternating outcome:

```text
age0ms           {"ms":112,"status":0,"err":null}
age1.2s          {"ms":13,"status":null,"err":"ETIMEDOUT"}
age1.2s-next     {"ms":103,"status":0,"err":null}
age7.2s          {"ms":13,"status":null,"err":"ETIMEDOUT"}
age7.2s-next5000 {"ms":107,"status":0,"err":null}
```

Reproducibility note, stated rather than hidden: the same sequence driven through the
module's own `runGitFileList` / `runGitStatusList` helpers — three iterations with 1.5 s gaps
— did NOT reproduce the anomaly (`ls` 5459 @ 137-143 ms, dirty 7 @ 104-108 ms, reconcile
status 7 @ 101-109 ms, all non-null). The anomaly is real but intermittent, and it is
recorded here as a classification defect to be made honest, not as a deterministic failure.

Call graph at HEAD (`packages/agent-runtime/src/echo/enforcement/`):

```text
REFUSAL / DEGRADE SITES (verified by grep -n at HEAD):
  worktree-reconcile.ts:91   const noVerify = (why: string)
  worktree-reconcile.ts:97   the noVerify diagnostic (names no files)
  worktree-reconcile.ts:102  no-baseline branch
  worktree-reconcile.ts:108  method-unavailable branch (the live symptom)
  worktree-reconcile.ts:142  the reconcile git-failure diagnostic (degraded)
  worktree-reconcile.ts:225  the deletion leg: for (const key of Object.keys(baseline))

SPAWN SITES (production):
tool-pipeline.ts:52    maybeCaptureWorktreeBaseline(...)      <- lazy capture arming
  turn-end.ts:56         reconcileWorktree(...)                 <- the reporting caller
  turn-end.ts:167        advanceWorktreeBaseline(...)           <- verified-batch advance

DEFINITIONS:
  worktree-capture.ts:187  maybeCaptureWorktreeBaseline
  worktree-capture.ts:209  advanceWorktreeBaseline  (creates map keys: baseline[relPath] = hash)
  worktree-reconcile.ts:69 reconcileWorktree

CHECKPOINT FIELDS (declared common/src/types/session-state-records.ts:66-77):
  worktreeBaseline, worktreeBaselineRoot, worktreeBaselineMethod,
  worktreeBaselineCapturedAt, worktreeBaselineSkipped, worktreeBaselineDirtyPaths
  readers: worktree-capture.ts (194,215,216) + worktree-reconcile.ts (101,105,106,113,115,150)
```

Emission chain: `maybeCaptureWorktreeBaseline` arms on the first write tool OR first
terminal call the step-1 classifier marks mutating; capture then either completes or refuses
itself; on a refusal every later `reconcileWorktree` hits the guard and returns the advisory
without scanning. Observed live: the advisory text changed from "no baseline was
captured this session" (the `capturedAt == null` branch, before any mutating call) to
"baseline capture failed ... initialization budget" immediately after a `git add &&
git commit`, which is exactly the lazy-capture arming point.

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/echo/enforcement/worktree-capture.ts`
- `packages/agent-runtime/src/echo/enforcement/worktree-reconcile.ts`
- `packages/agent-runtime/src/echo/enforcement/worktree-walk.ts` (unchanged — the walk
  contract held)
- `packages/agent-runtime/src/echo/enforcement/worktree-git.ts` (new — the two enumeration
  helpers, the shared budgets and the retry-once spawn policy, extracted for the 300-line cap)
- `packages/agent-runtime/src/echo/enforcement/worktree-scan.ts` (new — candidate resolution
  plus the deletion terms, extracted for the 300-line cap)
- `common/src/types/session-state-records.ts`
- `packages/agent-runtime/src/echo/__tests__/worktree-capture.test.ts`
- `packages/agent-runtime/src/echo/__tests__/worktree-reconcile-fixtures.ts`
- `packages/agent-runtime/src/echo/__tests__/worktree-reconcile-deletion.test.ts` (new)
- `packages/agent-runtime/src/echo/__tests__/worktree-capture-scale.test.ts` (new)
- `sdk/src/__tests__/run-state-serialization.test.ts` (step 10's real-serializer round trip)

### Risk Level

- [x] High: Major feature broken, no workaround (the Law 15 backstop is disarmed for the
      life of any session that refuses capture, and the only symptom is an advisory that
      names no files)

## Proposed Solution

### Approach

Generalise the correction already applied to the reconcile leg — "git enumerates candidate
paths cheaply; content hashes decide" — one level deeper. The baseline is currently doing
two jobs with one data structure: it is the **inventory** (needed to notice a file that
vanished) and the **content record** (needed to notice a file that changed). Split them.

The inventory is cheap (`git ls-files`, measured 0.14-0.15 s for 5,459 paths, no per-file
IO). The content record is only load-bearing for the paths the candidate loop must
**exempt**: files that were already dirty at capture, which would otherwise be flagged
unaccounted every turn. Every other detection rides on the change enumeration: a candidate
absent from the content map that arrived from a change enumeration is already treated as
unaccounted, which is the correct verdict for an out-of-band change to a file that was clean
at capture. So the content map shrinks to the initially-dirty set, and capture cost becomes
independent of repository size.

Three further corrections come out of the Loop 2 audit, because the split as first drafted
would have introduced regressions of its own:

- **Walk mode cannot use the split.** Without git there is no oracle that names the dirty
  subset, so the cheap list and the expensive hashes cannot be separated. Walk capture keeps
  hashing its full inventory inside the same one-time budget and refuses if it cannot
  complete. Storing no hashes and reporting "unknown" instead would delete every finding from
  the one branch that runs when git is already lost.
- **The deletion net must not be a status diff.** `git status` emits nothing for an untracked
  file that vanished, and `git ls-files --cached`/`--deleted` read the index, so a tracked
  file removed from the worktree without staging stays listed. A status-only deletion source
  therefore loses classes that today's `Object.keys(baseline)` loop catches. The deletion
  source is a change-bounded three-term set (step 4) that preserves all three classes.
- **A refused baseline must be recoverable.** Making the refusal rare is not the same as
  making it impossible; a bounded retry (step 7) closes the permanent-disarm window.

Rejected alternatives, with reasons: **raise `CAPTURE_BUDGET_MS`** — re-reads 27.1 MB per
session and has now been outgrown twice; **stat-tuple baseline (size:mtimeMs) with hash on
divergence** — a writer that preserves size and mtime (or restores it) escapes, i.e. weaker
under the Five Questions' hostile-actor test, and it silently changes the guarantee the
module documents as "content hashes decide"; **resumable/chunked capture across turns** —
the baseline would be incomplete during exactly the window it exists to cover, and the
module's own rule is that a partial baseline must be refused rather than trusted; **diff a
fresh `git ls-files` for deletions** — `--cached` reads the index, so an unstaged `rm` is
invisible through that net while the candidate loop swallows the same file, which is a
regression in the backstop's core competence; **parse `git status` XY codes for `D`** — it
needs a second spawn (`git ls-files --deleted`, ~150-260 ms of a 500 ms budget) for a strict
subset of what one existence probe already answers, and it would make this fix depend on a
parser that currently discards the codes.

### Steps

1. **Split the baseline.** Add `worktreeBaselinePaths?: string[]` to the durable checkpoint
   type in `common/src/types/session-state-records.ts` (the normalized inventory,
   repo-relative forward-slash form). In the git branch, capture populates it from the
   `runGitFileList` enumeration and content-hashes **only** the initially-dirty set into the
   existing `worktreeBaseline` map. In the walk branch there is no dirty set to consult, so
   capture keeps hashing the full walk inventory (the already-degraded branch) inside the
   same budget and refuses if it cannot complete — the map therefore still covers the
   inventory in walk mode, and "absent implies unaccounted" stays valid there.
2. **Preserve the refusal, and name its leg.** The dirty-set guard already exists at HEAD
   (`runGitStatusList` returning null, or a spent remaining budget, flips
   `method = 'unavailable'`); it must survive the split unchanged, because the reduced map
   makes an undefined dirty set fail **open** (the candidate seed collapses and clean files
   become unexaminable while `method` still reads `'git'`). Add a durable
   `worktreeBaselineFailure?: 'enumerate' | 'dirty-set' | 'hash-budget' | 'walk-budget'` and
   interpolate it into the `noVerify` reason, so the advisory names the failed leg instead of
   the current catch-all sentence.
3. **Redirect every inventory reader, with the legacy case subsumed rather than
   special-cased.** The deletion membership set becomes
   `new Set([...(checkpoint.worktreeBaselinePaths ?? []), ...Object.keys(baseline)])` — a
   union, built in memory, used for **membership only**, never iterated with per-key probes.
   The candidate fallback stays exactly as HEAD has it,
   `checkpoint.worktreeBaselineDirtyPaths ?? Object.keys(baseline)`: a git-method checkpoint
   always defines the dirty set after step 2 (an empty `[]` is defined, so `??` does not fall
   through), a walk checkpoint never evaluates the git branch, and a legacy checkpoint has
   neither field and lands on the map keys — which for a legacy full-inventory map is exactly
   today's behaviour. No back-fill migration is written: fabricating an inventory from a
   legacy map would exclude every file that was clean at the legacy capture, which is worse
   than an absent field. `worktreeBaselineMethod === undefined` keeps short-circuiting to
   cannot-verify ahead of all new logic.
4. **Replace the deletion leg's cost model with a change-bounded, three-term source.** Today's
   leg is one `statSync` per baseline key. The replacement is bounded by changes, and each
   term exists to preserve one class the others cannot see:
   - **(i) clean-at-capture tracked file removed out of band** —
     `statusPaths.filter((p) => inventory.has(p) && !existsSync(join(root, p)))`. One
     existence probe per status path that is actually in the inventory; no XY-code parsing,
     and it covers `D` in either column, a rename source (the old path is emitted and is
     gone) and a typechange-to-missing uniformly.
   - **(ii) untracked-at-capture file removed out of band** — a candidate that carries a
     stored hash whose `hashFile` now returns null is **deleted**, not `continue`d. This is
     the only term that can see this class: git emits no status entry for a vanished
     untracked file, and the path is in the inventory (so term (iii) excludes it).
   - **(iii) a path `advanceWorktreeBaseline` created after capture (session-created file)
     removed out of band** — `Object.keys(baseline) \ inventory`, existence-probed. Git
     reports nothing for it either, and it is not in the frozen inventory.
   The three terms feed one deduped set, so a rename source cannot be reported twice. On
   flag, the path is durably removed from **both** `worktreeBaselinePaths` and the map,
   because the membership set is rebuilt from durable state every turn — that removal is the
   third-livelock guard (today's `delete baseline[key]`), and without it the status entry
   re-fires forever. Deletion stays a distinct outcome: reported, never merged into
   `dirtyFiles`, never blocking on its own. Do not add a second git spawn inside the 500 ms
   reconcile budget.
5. **Scope "absent implies unaccounted" to change-enumerated candidates.** Under the current
   full-coverage baseline, a candidate absent from the map always meant "new". After the
   split it means "was clean at capture", which is not evidence of change. When the candidate
   set comes from `walkCandidates` (the status leg failed at reconcile) over a git-captured
   dirty-set map, that rule would fire once per clean file in the repository — a
   false-positive storm, and one the current code is immune to only by accident. Walk-sourced
   candidates with no stored hash are **unknown**: neither accounted nor flagged, compared by
   hash where a hash is present, and surfaced as an explicit degraded "N paths unexamined"
   verdict. Never a silent pass, and never N findings. (A walk-*captured* checkpoint has full
   coverage by step 1, so the rule does not apply to it.)
6. **Make the spawn classification honest.** Both spawn helpers treat any `spawnSync`
   `result.error` as "git failed". Add one pure predicate (injected elapsed/timeout, no clock
   read) that recognises a provably-spurious timeout — an `ETIMEDOUT` whose elapsed time is a
   small fraction of the timeout it was given, e.g. 13 ms against 500 ms — retry that spawn
   **once**, and only then report the failure. Keep every real failure path fail-closed, and
   carry the elapsed/error evidence into the diagnostic. This does not weaken the backstop:
   it stops a transient spawn error from being reported as "git unavailable".
7. **Make a refused baseline recoverable.** `maybeCaptureWorktreeBaseline` currently returns
   early forever once `capturedAt != null`. Add a bounded recapture: a pure predicate
   (`shouldRetryCapture({ method, retries, lastAttemptAtMs, now, cooldownMs, maxRetries })`)
   gates a retry when `method === 'unavailable'`, `retries < MAX_CAPTURE_RETRIES` (2) and the
   cooldown (60 s) has elapsed; a success promotes the baseline to live, and the failure count
   is durable (`worktreeBaselineRetries?: number`). The predicate is pure so it can be pinned
   without a clock; the caller supplies `now`.
8. **Extend the fixtures and move the broken pin.** `worktree-capture.test.ts` asserts
   `Object.keys(worktreeBaseline) === ['tracked.ts']` on a clean one-file fixture; under the
   split the map is correctly empty, so that pin must be moved deliberately with its new
   contract stated (the inventory covers the file; the map stays empty until something is
   dirty). `worktree-reconcile-fixtures.ts` currently builds one-file repos and cannot express
   the new contract, so the fix must land with an extended fixture surface (N clean + M dirty
   + an out-of-band deletion) or with nothing that could fail. Put the scale and capture-side
   pins in the new `worktree-capture-scale.test.ts` and the deletion-class pins in the new
   `worktree-reconcile-deletion.test.ts`, reusing the shared fixtures — the existing suites
   are 247/248 lines against the 300-line quality ceiling, so they cannot absorb the new legs.
9. **Record what this mechanism does not cover**, as named limits rather than implications:
   `worktreeBaselineSkipped` keeps its units (paths present but not hashed, oversized) but its
   contract must be restated per class — for a clean-at-capture skipped path that is later
   modified out of band, the file arrives as a status candidate absent from the map and is
   flagged unaccounted, which matches HEAD, while the field's comment currently says "never
   flagged" and would tell a reader the opposite. `worktreeBaselineDirtyPaths`'s comment must
   say that post-split it is the only content-hash seed (and the reason deletion class (ii)
   exists). Files over `MAX_HASHABLE_FILE_BYTES` remain content-uncompared;
   `assume-unchanged`/`skip-worktree` paths are invisible to `git status` and so are never
   candidates; mode-only changes and symlink retargeting leave the content hash unchanged;
   the guarantee is "content as captured at the last tool-touch", not "content as committed
   at HEAD".
10. **Prove the new durable field survives persistence.** `worktreeBaselinePaths` and the two
    new optional fields are only useful if they round-trip capture -> persistence -> resume; a
    serializer that drops optional fields would silently re-disarm the deletion leg with both
    suites green. Add an explicit round-trip assertion rather than an inspection.

### Verification

Ten deterministic, timing-free pins (no assertion may reference wall-clock time — a timing
pin here would be flaky by construction; where a budget must be forced, inject it, as
capture already allows, and thread an optional `budgetMs` through `reconcileWorktree` so the
reconcile-side pins can do the same).

- **P1 (the scale pin).** A fixture with N clean tracked files and M dirty files: assert
  `Object.keys(worktreeBaseline).sort()` equals exactly the M dirty paths AND
  `worktreeBaselinePaths.length === N + M`. Fails on the pre-fix implementation (N+M keys).
  This single structural assertion encodes "hash the dirty set, inventory everything" with
  no clock.
- **P2 (fail-closed preserved, leg named).** Inject a tiny `budgetMs`: assert
  `method === 'unavailable'`, the map is wiped, `worktreeBaselineFailure === 'hash-budget'`,
  and reconcile still emits the cannot-verify advisory naming that leg. Proves the fix did
  not trade a refusal for a silent pass, and that the refusal is specific.
- **P3 (deletion fidelity, no status codes).** `rm` a tracked file **without staging** it:
  assert reconcile detects the deletion. Fails on a naive ls-files/status-diff implementation
  and is what forces the existence-probed term (i).
- **P4 (legacy compatibility).** Hand-build a checkpoint holding a full-inventory map with
  `worktreeBaselinePaths` undefined, delete a tracked file out of band: assert detection.
  Forces the union in step 3 and forbids a back-fill migration.
- **P5 (candidate scoping).** Force the reconcile status leg to fail: assert a degraded
  "N paths unexamined" verdict rather than N unaccounted findings. Forces step 5.
- **P6 (dirty-set refusal).** Make the capture dirty-set enumeration fail while the inventory
  enumeration succeeds: assert `method === 'unavailable'` and
  `worktreeBaselineFailure === 'dirty-set'`. Forces step 2.
- **P7 (untracked-at-capture deletion).** Capture with an untracked non-ignored file present,
  then delete it out of band: assert detection. Forces term (ii) — no status-derived source
  can see this class.
- **P8 (advance-added deletion).** Create a file after capture, verify it through the gate so
  `advanceWorktreeBaseline` records it, then delete it out of band: assert detection. Forces
  term (iii) and the union membership.
- **P9 (recapture).** Unit-pin the pure `shouldRetryCapture` predicate (cap, cooldown, method
  gate), then integration: refuse with an injected `budgetMs` of 0, then a later
  `maybeCaptureWorktreeBaseline` with a healthy budget promotes the baseline to `'git'`, and a
  third call does not re-capture. Forces step 7.
- **P10 (spawn classification).** Unit-pin the pure spurious-timeout predicate (a 13 ms
  `ETIMEDOUT` against a 500 ms budget is spurious; a 500 ms `ETIMEDOUT` against a 500 ms
  budget is real), plus one leg asserting the spurious case is retried and a real failure
  still degrades. Forces step 6.

The pre-existing suites (`worktree-capture`, `worktree-reconcile`,
`terminal-bypass-pipeline`) must stay green, with the moved pin's new contract stated in
the same change.

> Contract rule (FID-2026-0918-006): every promised test artifact names its repo-relative
> `*.test.ts` path, and that path also appears as a declared `- gate: test` line below.
>
> Declaration, then execution (FID-2026-0823-009): authored pre-implementation, this record
> first enumerated its gates — `bun run fid:verify <fid> --check` exited 1 because
> `worktree-capture-scale.test.ts` did not exist, the mechanical signature of an unimplemented
> record. Implementation has now landed and the same command is 10/10 exit 0 (two gates were
> added during implementation: `typecheck sdk` and the sdk round-trip leg of step 10, which
> step 10 requires and which the original list did not carry). `bun run validate:repository`
> passes.

## Verification Gates

- gate: typecheck common
- gate: typecheck packages/agent-runtime
- gate: typecheck sdk
- gate: test packages/agent-runtime/src/echo/__tests__/worktree-capture.test.ts
- gate: test packages/agent-runtime/src/echo/__tests__/worktree-reconcile.test.ts
- gate: test packages/agent-runtime/src/echo/__tests__/worktree-reconcile-deletion.test.ts
- gate: test packages/agent-runtime/src/echo/__tests__/worktree-capture-scale.test.ts
- gate: test packages/agent-runtime/src/echo/__tests__/terminal-bypass-pipeline.test.ts
- gate: test sdk/src/__tests__/run-state-serialization.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:9a9b451372e389761f4a045e4a2528b08399f810a5aae79d786c2c2ee75176fe
- verified: 2026-10-07T03:38:03.486Z
- typecheck common: exit 0
- typecheck packages/agent-runtime: exit 0
- typecheck sdk: exit 0
- test packages/agent-runtime/src/echo/__tests__/worktree-capture.test.ts: exit 0
- test packages/agent-runtime/src/echo/__tests__/worktree-reconcile.test.ts: exit 0
- test packages/agent-runtime/src/echo/__tests__/worktree-reconcile-deletion.test.ts: exit 0
- test packages/agent-runtime/src/echo/__tests__/worktree-capture-scale.test.ts: exit 0
- test packages/agent-runtime/src/echo/__tests__/terminal-bypass-pipeline.test.ts: exit 0
- test sdk/src/__tests__/run-state-serialization.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** catalogued the defect with measured evidence (5,455 paths / 27.1 MB hashed inside
  a 5,000 ms budget; 0.258 s to enumerate), located the emission site
  (`reconcileWorktree` -> `noVerify` at the `worktreeBaselineMethod === 'unavailable'`
  guard), and confirmed production reachability through three call sites
  (`tool-pipeline.ts:52`, `turn-end.ts:56`, `turn-end.ts:167`). Found the second budget
  defect behind the first: the reconcile deletion leg is one `statSync` per baseline key
  (5,455 stats) inside a 500 ms budget, so fixing capture alone would convert the advisory
  into a degraded deletion scan rather than restore verification. Traced the historical
  root cause: the identical defect was found and fixed at reconcile on 2026-10-02 and left
  in place at capture.
- **GREEN:** the proposed solution above. The design was challenged before authoring and
  amended on six points: the candidate-fallback redirect (step 3), the presence-scoping of
  "absent implies unaccounted" (step 5), the rejection of a bare ls-files diff in favour of
  a worktree-aware deletion source intersected with the inventory (step 4), the read-site
  legacy shim (step 3), the dirty-set refusal (step 2), and the walk-candidate
  degrade-to-unknown rule (step 5). "Raise the budget" was rejected on the record.
- **AUDIT:** pending — see Loop 2.
- **ADVERSARIAL:** pending — see Loop 2.
- **CHANGE DELTA:** new document.

### Missed Questions

1. **Does the baseline need a content hash for every file, or only for some?** Only for the
   paths the candidate loop must exempt — the initially-dirty set. Detection for everything
   else already rides on the change enumeration, where a candidate absent from the map is
   flagged. Answer folded into the Approach and step 1.
2. **If the hash map stops being the inventory, who else was reading `Object.keys(baseline)`
   as one?** Two readers, not one: the deletion leg AND the `??` candidate fallback on the
   dirtyPaths line. Both are redirected in step 3; redirecting only the deletion leg would
   leave a fail-open fallback whose candidate set collapses to the dirty set.
3. **Can the deletion leg simply diff a fresh `git ls-files`?** No — `--cached` reads the
   index, so an unstaged `rm` stays listed and the deletion becomes invisible, while the
   candidate loop swallows the same file. The deletion source must be worktree-aware and
   intersected with the inventory. Answer folded into step 4.
4. **What happens to a durable checkpoint captured before this change?** It passes both
   noVerify guards and looks healthy, so nothing degrades to an advisory while its deletion
   leg silently detects nothing. It survives on a read-site shim only, never a back-fill
   migration. Answer folded into step 3.
5. **What happens when the reconcile status leg fails after a successful git capture?** The
   candidate set falls back to a full walk, every clean file is absent from the reduced map,
   and "absent implies unaccounted" would fire thousands of times. Today's immunity is
   accidental. Answer: walk-sourced absence is unknown, reported as N unexamined. Folded
   into step 5.
6. **What if the dirty-set enumeration fails at capture while ls-files succeeds?** Under the
   reduced map the candidate set collapses and every clean file becomes unexaminable with
   no advisory, because `method` still reads `'git'`. Capture must refuse itself. Folded
   into step 2.
7. **Why not just raise `CAPTURE_BUDGET_MS`?** It re-reads 27.1 MB per session and this is
   the second time the budget has been outgrown; the requirement is a cost model, not a
   larger constant. Recorded as a rejected alternative.
8. **What does `worktreeBaselineSkipped` mean after the change?** Its units are unchanged,
   but its contract has to be restated per class or its comment misleads. Pinned in step 9
   rather than left to drift.
9. **What does capture hash in walk mode, where no dirty set exists?** The split's
   affordability argument depends on git naming the dirty subset; without git there is no
   oracle, so walk capture keeps hashing its full inventory and refuses if it cannot
   complete. Storing no hashes would replace detection with a blanket "unknown" in the one
   branch that runs when git is already lost. Folded into step 1; the corollary (the unknown
   rule applies only to walk-sourced candidates over a git-captured map) is step 5.
10. **Does a status-derived deletion source lose any deletion class?** Yes, two: an
    untracked-at-capture file that vanishes leaves no status entry, and a session-created path
    that `advanceWorktreeBaseline` added to the map is not in a frozen inventory. Both are
    caught today by the map-key loop, so a status-only source is a regression. Folded into
    step 4 as terms (ii) and (iii).
11. **Is the record's "the budget is blown" claim reproducible?** Not deterministically: four
    warm captures completed in 956-1,128 ms (19-23% of the 5,000 ms budget). The refusal is a
    cold/loaded condition, and the record now says so — an intermittent defect stated as a
    certainty is a defect the next reader cannot reproduce and will dismiss.
12. **Is the deletion leg a standalone budget blow?** Not measured as one: 181 ms for 5,459
    `statSync` calls, in a 500 ms budget shared with a ~110 ms enumeration spawn. It is the
    largest remaining size-dependent term and the leg an end-to-end probe failed on; the
    record states that, not a blow it cannot show.
13. **Why does the reconcile leg report "git failed" when git returns in ~110 ms?** Because
    both spawn helpers classify any `spawnSync` error as unavailable, and a spurious immediate
    `ETIMEDOUT` was measured (13 ms against a 500 ms budget). Folded into step 6.
14. **What happens to the session after a refusal?** Nothing: `capturedAt` is stamped, the
    lazy-capture guard never fires again, and every later turn re-emits cannot-verify. The
    session is disarmed permanently, which is the harm this record names. Folded into step 7
    as a bounded retry.
15. **Is `RECONCILE_BUDGET_MS` injectable?** No — it is a module constant consumed at three
    sites, while capture models the right pattern (`budgetMs: number = CAPTURE_BUDGET_MS`).
    Thread an optional `budgetMs` through `reconcileWorktree` (Law 11: follow the discovered
    pattern exactly) so degrade-vs-detect pins are deterministic instead of racing a clock.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** `ba38c548` — "fix(runtime): stop the Law 15 baseline capture
      refusing itself on a large repo (FID-2026-1006-004)", 13 files (+2400/-260), path-scoped
      to the Law 15 change set on operator G2 authorization. The closure tail itself (this
      record's status flip and archive move, the CHANGELOG entry, the LEARNINGS promotion and
      the register/index updates) lands in a separate follow-on commit, so the change set stays
      separable from the ceremony.
- [x] **File:line ranges:**
  - `worktree-git.ts:1-192` (new) — `isSpuriousTimeout:55`, `attemptGitSpawn:78`,
    `runGitSpawn:102`, `describeGitFailure:125`, `runGitFileList:137`,
    `runGitStatusList:161`
  - `worktree-scan.ts:1-216` (new) — `resolveCandidates:68`, `isWalkVisible:131`,
    `collectDeletions:148`, `dropBaselineKeys:207`
  - `worktree-capture.ts:66` (step 7 predicate), `:91` (steps 1-2 split + leg naming),
    `:199` (step 7 caller), `:233` (advance leaves the inventory frozen)
  - `worktree-reconcile.ts:81` (`budgetMs` seam), `:144` (step 5 candidate resolution),
    `:174` (the unknown rule), `:230` (step 4 terms), `:254` (durable removal),
    `:267` (the unexamined verdict)
  - `common/src/types/session-state-records.ts:76` (`worktreeBaselinePaths`),
    `:90` (`worktreeBaselineFailure`), `:97` (`worktreeBaselineRetries`), `:106` / `:113`
    (the restated `skipped` / `dirtyPaths` contracts, step 9)
  - `worktree-capture.test.ts:36` (the moved pin, new contract stated in the test),
    `:51` (the inventory basis)
  - `worktree-reconcile-fixtures.ts:61` (the N-clean / M-dirty / nested-directory fixture
    surface), `:103`
  - `worktree-capture-scale.test.ts:38` (P1), `:66` (P2), `:92` (P6), `:113` (P9),
    `:164` (P10), `:237` (step 10)
  - `worktree-reconcile-deletion.test.ts:47` (P3), `:81` (P4), `:111` (P5), `:140` (P7),
    `:160` (P8)
  - `sdk/src/__tests__/run-state-serialization.test.ts:94` (step 10 through
    `serializeRunState` / `deserializeRunState`)
- [x] **Gate output:** `bun run fid:verify dev/fids/FID-2026-1006-004-law15-capture-budget-refusal.md
      --check` — 10/10 gates, all exit 0, receipt stamped below at the record's own path.
- [x] **Reproducibility:** `bun dev/scratchpad/active/law15-split-baseline-probe.ts` (gitignored)
      drives the PRODUCTION `captureWorktreeBaseline` / `reconcileWorktree` on this repository.
      Post-fix, two warm runs: capture 244-254 ms with **18** content hashes over a **5,464**-path
      inventory (`method: 'git'`, no refusal, retries 0); reconcile 110-114 ms, second reconcile
      108-114 ms, both `degraded: false`, `unverifiable: false`, `changed: 0`, `deleted: 0`. The
      same probe measures the durable payload: checkpoint JSON 301,304 B against a 663,482 B
      pre-split equivalent (the split makes the checkpoint smaller, not larger).
- [x] **Step statuses:** all ten steps `implemented`; the per-step evidence is in Loop 3.

### Code Verification Evidence

- [x] Files referenced in Affected Components exist — verified by 0-EOF read of all three
      enforcement modules plus the `common` checkpoint type (2026-10-06), and re-verified for
      the two new modules on 0-EOF read at implementation (2026-10-06)
- [x] Implementation matches the Proposed Solution — with three recorded landing differences:
      the two `worktree-*` modules extracted for the 300-line cap (step 8's split was written
      for the suites; the cap forced it on the production side too), the fourth deletion term
      (iv) that the plan's three terms would have left a regression for, and the two extra
      gates (see the declaration note above)
- [x] Typecheck/tests/lint pass with pasted tool output — `fid:verify --check` 10/10 exit 0,
      `bunx eslint --max-warnings 0` on every changed file exit 0, `bunx prettier --check` clean,
      `quality: PASS (1498 baselined files)`, `validate:repository` PASS,
      `scripts/scope-register-check.ts` PASS (0 issues)
- [x] Production call-graph evidence present for the affected wiring — the three original call
      sites still hold (`tool-pipeline.ts:52`, `turn-end.ts:56`, `turn-end.ts:167`) and every new
      export has a production caller outside its own module: `runGitFileList` / `runGitStatusList`
      ← `worktree-capture.ts:107` / `worktree-scan.ts:106`; `shouldRetryCapture` ←
      `worktree-capture.ts:207`; `isSpuriousTimeout` / `attemptGitSpawn` / `describeGitFailure` ←
      `worktree-git.ts:110` / `:106` / `worktree-scan.ts:113`; `resolveCandidates` /
      `collectDeletions` / `dropBaselineKeys` ← `worktree-reconcile.ts:144` / `:230` / `:254`
- [x] FID status reflects the actual implementation state — `closed`: implementation exists,
      gates pass; closure is withheld pending operator G2 (commit authority)
- [x] Measured evidence re-grounded at Loop 2 against the live tree (capture 956-1,128 ms,
      `statSync` 181 ms / 5,459 paths, status spawn ~110 ms, one end-to-end reconcile
      failure, one spurious-`ETIMEDOUT` series) and re-measured POST-fix at Loop 3
- [x] Document gates clean — `bun run validate:repository` PASS, `bun run lint:md` exit 0,
      prettier clean (2026-10-06)

### Loop 2 — Independent audit and self-correction

- **RED:** the audit's first act was to re-measure the record's own causal claims, and two of
  them did not survive. (1) "The budget is blown" is not deterministic: four warm captures
  through the production function completed in 956-1,128 ms with `method = 'git'` and 5,454
  hashed keys, so the refusal is a cold/loaded condition. (2) The deletion leg is not a
  standalone blow: 181 ms for 5,459 `statSync` calls (33 us/path) inside a 500 ms budget it
  shares with a ~110 ms enumeration spawn. (3) A third cause was found that the record did
  not name: an end-to-end `captureWorktreeBaseline` + `reconcileWorktree` probe returned
  `degraded: true` with "git failed at turn end" while the same git command returns in
  ~110 ms, and a raw spawn series showed a spurious immediate `ETIMEDOUT` (13 ms against a
  500 ms budget, twice, with the next identical spawn succeeding both times) — the spawn
  helpers cannot tell a transient failure from "git is unavailable". (4) Nothing retries a
  refused baseline, so the record's own named harm (disarmed for the session) survives the
  proposed fix. (5) The declared gate `worktree-capture-scale.test.ts` does not exist yet, so
  `bun run fid:verify <fid> --check` exits 1 while `validate:repository` passes — expected
  pre-implementation, but it must be stated.
- **GREEN:** the amendments folded in above. Design changes: walk mode keeps full-inventory
  hashing (step 1); the deletion inventory is a **union** for membership only, which subsumes
  the legacy shim instead of adding a read-site special case (step 3); the candidate fallback
  keeps HEAD's exact expression, deleting the dead middle term `?? worktreeBaselinePaths`
  (unreachable in the git branch, and it would have unioned the full inventory into the
  turn-end candidate list if it ever became reachable); the deletion source becomes the
  three-term change-bounded set with durable removal (step 4); the unknown rule is scoped to
  walk-sourced candidates over a git-captured map (step 5); spawn-failure classification
  becomes honest (step 6); a bounded recapture retry is added (step 7); the fixtures split
  across two new suites because of the 300-line ceiling (step 8); the accepted-limits and
  comment contracts are restated (step 9); and the new durable fields get a round-trip
  assertion (step 10). The pin set grew from six to ten because P7/P8 force the two deletion
  classes a status-only source loses, P9 forces the retry, and P10 forces the classification.
- **AUDIT:** the Verifier pass returned PASS on the measured figures (it reconstructed the
  count arithmetic independently: 5,458 enumerated paths today minus the 3 untracked files =
  5,455, and the tracked-only byte total reproduces `27123401 total`), and flagged as
  NEEDS-REVIEW every claim resting on the record's own text or on `worktree-walk.ts`, because
  its context was compacted and the FID body plus two module sources were not visible to it —
  an audit-process limitation recorded here rather than converted into a PASS. Its
  substantive findings are folded in: (a) the record must not describe the refusal as
  deterministic; (b) the gate section must state that `fid:verify --check` fails by design
  pre-implementation; (c) the deletion formula must not depend on a frozen inventory, or a
  session-created file's deletion becomes invisible; (d) the middle fallback term is dead and
  duplicative of existing state; (e) the deletion leg shares one budget with the hash leg, so
  any pin asserting "deletion detected" is timing-dependent unless the budget is injectable —
  hence the pins assert structure and injected budgets, never elapsed time; (f) in hybrid
  mode the restored detection is diagnostic plus merge-into-`dirtyFiles`, with blocking only
  at `tier === 'all_15'`, which the record now states instead of overclaiming "verification
  restored". Its (b)-as-FAIL reading (that step 2 was a behaviour change rather than a
  preserve) was checked against the source and is REFUTED at the capture site: the guard
  `if (method === 'git' && dirtyPaths == null) method = 'unavailable'` already exists at HEAD,
  so step 2 is restated as preserve-and-name rather than add. The Verifier's own reading of
  the reconcile candidate fallback was the site of its error, not the capture guard.
- **ADVERSARIAL:** pending — the Adversary pass runs against this amended record.
- **CHANGE DELTA:** Loop 2 rewrote the diagnosis, the Approach, the Steps (7 -> 10) and the
  Verification section (6 -> 10 pins), and filled this Loop 2 block. This is a re-grounding
  pass rather than an iterative edit: the measured evidence contradicted the record's own
  causal framing, so the amendments are larger than the 10% per-pass heuristic and are
  recorded as one pass rather than disguised as several.

### Loop 3 — Final convergence

- **RED:** the implementation pass opened by re-reading the artifact it was about to change
  (all four enforcement modules plus the `common` checkpoint type, 0-EOF) and by re-measuring
  the live defect instead of trusting the record: on this tree (5,464 enumerated paths, 18
  dirty) the PRE-fix capture content-hashed the full inventory inside a 5,000 ms budget, so
  the refusal is load-dependent exactly as Loop 2 recorded, and `reconcileWorktree` returned
  `method: 'unavailable'` / cannot-verify on every turn of any session that refused. Two
  ORDERING defects that the plan did not name were found before writing: (1) with `budgetMs`
  spent, the pre-fix dirty-set guard (`remainingBudget > 0`) silently skipped the status read
  and named the wrong leg, so the refusal could not distinguish "git did not answer" from "the
  hash leg has no budget" — P2's own "tiny budget" mechanism would have asserted the wrong
  value; (2) with the map reduced to the dirty set, a failed reconcile status leg would have
  fired the absent-implies-unaccounted rule once per clean file. Both were folded into the
  design before the edit (step 2's leg ordering; step 5's unknown rule).
- **GREEN:** the change as landed. Steps 1-10, each with its landing evidence:
  1. + 2. split baseline and leg-named refusal — `worktree-capture.ts:91-186` assigns
     `worktreeBaselinePaths` from the enumeration and content-hashes only the dirty set in git
     mode (walk mode keeps hashing its full inventory), and records `worktreeBaselineFailure`
     (`enumerate` | `dirty-set` | `hash-budget` | `walk-budget`); the dirty-set guard survives
     (a refused capture writes `{}` / `[]`), and reconcile interpolates the leg into the
     cannot-verify advisory (`worktree-reconcile.ts:104-112`).
  3. the membership union (`worktree-reconcile.ts:126-129`) is the coverage set, and the
     candidate fallback keeps HEAD's exact expression (dead middle term deleted).
  4. the change-bounded deletion source (`worktree-scan.ts:148-215`) with durable removal
     (`:207`) — see the fourth-term amendment below.
  5. the unknown rule (`worktree-reconcile.ts:174` + `:196-215`) counts walk-sourced,
     hash-less candidates as `unexamined` and reports a degraded verdict instead of N findings.
  6. the honest spawn classification (`worktree-git.ts:55-175`): one pure predicate, a
     retry-once policy carrying the error code and elapsed time, and the failure evidence in
     the degrade diagnostic (`worktree-scan.ts:110-114`).
  7. bounded recapture (`worktree-capture.ts:66-88` + `:207-215`), pure predicate, durable
     `worktreeBaselineRetries`, cooldown 60 s, cap 2.
  8. the moved pin (`worktree-capture.test.ts:36`) and the extended fixture surface
     (`worktree-reconcile-fixtures.ts:61-108`); the scale/capture pins and the deletion-class
     pins live in the two new suites because the existing suites are 139 / 248 lines of the
     300-line cap.
  9. the accepted-limit contracts restated in place (`session-state-records.ts:100-118`).
  10. the round trip asserted at the transport layer
      (`worktree-capture-scale.test.ts:237`) AND through the real serializer
      (`sdk/src/__tests__/run-state-serialization.test.ts:94`).
- **AUDIT:** Method 1 (static) — `bun run --cwd=common typecheck`, `--cwd=packages/agent-runtime`
  and `--cwd=sdk` all exit 0; `bunx eslint --max-warnings 0` on the ten changed files reports
  0 problems; `bunx prettier --check` is clean on all of them; `bun run quality:report` →
  `quality: PASS (1498 baselined files)` (the four touched source files are 271 / 294 / 192 /
  216 lines, all under the 300-line ceiling); `bun run validate:repository` PASS;
  `bun run scripts/scope-register-check.ts` PASS (0 issues); `bun run fid:verify --check` 10/10.
  Method 2 (manual re-read + runtime) — the ten pins pass as suites (39 tests / 0 fail across
  the five declared agent-runtime gates, six of them new), and the live probe above shows the
  backstop VERIFYING on the real tree instead of refusing it. Independent check of the audit's
  own claims: the pinned P1 assertion was re-run against the pre-fix shape (N+M map keys) and
  fails there by construction, and the P5 leg was confirmed to report `changed: 0` — the
  pre-fix rule would have produced 2 findings.
- **ADVERSARIAL:** three attacks were run against the landed change, each caught before
  closure. (A) "Does the split silently weaken the backstop where it is the ONLY net?" — walk
  mode: yes, a walked inventory minus a walked candidate set was the pre-split deletion net,
  and the plan's three terms do NOT cover it (term (i) needs a status enumeration, term (ii)
  needs the path as a candidate, term (iii) excludes inventory members). Term (iv) was added
  (`worktree-scan.ts:186-195`), a pure set difference restricted by `isWalkVisible` so a
  tracked path under a walk-excluded directory (`resources/`) cannot be reported deleted; P5
  pins the false-positive direction explicitly. (B) "Does `worktreeBaselinePaths` cost more
  than it saves?" — measured rather than assumed: 297,394 B of a 301,304 B checkpoint against a
  663,482 B pre-split equivalent for the same inventory, i.e. the durable payload is roughly
  halved. (C) "Are the new fields actually reachable in production, or library-complete?"
  — every new export has a production caller (Law 4 grep above) and the two entry points keep
  their original call sites. **Stated limit (not a finding):** `walk-budget` (the walk capture's
  hash leg) is reachable in principle but has no deterministic pin — every budget-forcing
  fixture that reaches it would depend on wall-clock elapsed time, which the pin set forbids;
  it is named rather than silently omitted. The `'walk-budget'`-free alternative (a three-member
  union) was rejected because the walk branch genuinely has a distinct leg to name.
- **CHANGE DELTA:** large and recorded as one pass, not disguised as several: two new
  production modules, two rewritten enforcement modules, three new durable fields, one moved
  pin, one extended fixture surface, two new suites plus one sdk leg, and two added gates. The
  plan survived where it was measured (the split, the leg naming, the retry, the unknown rule)
  and was  amended where it was not (the deletion source's fourth term, the leg-naming order at a
  spent budget, the production-module extraction the cap forced).
- **AMENDMENT (post-verification, 2026-10-06):** the deletion suite's pins were hardened
  after this record's first receipt was stamped, and the record is amended rather than
  left claiming a pin set that no longer matches the artifact. `worktree-reconcile-deletion.test.ts`
  called `reconcileWorktree` without `budgetMs`, so its pins inherited the production
  `RECONCILE_BUDGET_MS = 500` and their outcome was a function of machine load. That was
  not hypothetical: a loaded `bun run validate:repository` (which live re-runs this
  record's declared gates) failed this suite while four consecutive unloaded runs and an
  unloaded `fid:verify --check` all passed, and the failure did NOT reproduce under a
  deliberately loaded re-run — the definition of a load-dependent pin. The suite's single
  `reconcile()` helper now injects `PIN_BUDGET_MS = 30_000`, so the pins pin behaviour and
  let a loaded machine take as long as it needs; budget-degradation behaviour stays pinned
  deliberately by the scale suite's explicit small budgets. Re-verified after the change:
  the suite 6/6 twice, this record's ten declared gates 10/10 exit 0, and
  `validate:repository` PASS. The receipt below was re-stamped on these amended bytes.

## Resolution

- **Closed Date:** 2026-10-06 — closed under operator G2 authorization, with the
  implementation landed first as local commit `ba38c548` (the change set is kept separate from
  the closure ceremony so either can be reviewed on its own).
- **Fix Description:** splits the durable worktree baseline into a cheap path inventory plus
  content hashes for the initially-dirty set (walk mode keeps full-inventory hashing), keeps
  and sharpens the capture refusal so it names the failed leg, replaces the deletion leg's
  per-key stat scan with a change-bounded source that preserves every deletion class (four
  terms, not three — see Loop 3 ADVERSARIAL A), scopes "absent implies unaccounted" to
  change-enumerated candidates, makes spawn failure classification honest with a retry-once
  policy for a provably spurious timeout, and makes a refused baseline recoverable through a
  bounded recapture. Landed in two new modules (`worktree-git.ts`, `worktree-scan.ts`) plus
  rewrites of `worktree-capture.ts` and `worktree-reconcile.ts`.
- **Tests Added:** Yes — ten deterministic pins (P1-P10), one moved pin with its new contract
  stated, an extended fixture surface (N clean / M dirty / nested directories), two new suites
  (`worktree-capture-scale.test.ts` 9 tests, `worktree-reconcile-deletion.test.ts` 6 tests) and
  one sdk round-trip leg. 39 tests / 0 fail across the five declared agent-runtime gates; sdk
  suite 8 / 0.
- **Verification Evidence:** `bun run fid:verify <this record> --check` 10/10 exit 0 (receipt
  stamped at this path); `typecheck common` / `typecheck packages/agent-runtime` / `typecheck sdk`
  exit 0; `bunx eslint --max-warnings 0` exit 0; `bunx prettier --check` clean; `quality: PASS
  (1498 baselined files)`; `validate:repository` PASS; `scope-register-check` PASS (0 issues);
  live post-fix probe (capture 244-254 ms / 18 hashes / 5,464-path inventory; reconcile 110-114 ms
  `degraded: false`). Every PRE-fix figure in Evidence was gathered at HEAD `43f436b0`; every
  POST-fix figure in this pass. Re-verified for closure on the amended bytes (Loop 3
  AMENDMENT): the ten declared gates 10/10 exit 0 with the receipt re-stamped before the
  archive move, the deletion suite 6/6 across two consecutive runs, and
  `bun run validate:repository` PASS.
- **Archived:** `dev/fids/archive/FID-2026-1006-004-law15-capture-budget-refusal.md`
  (2026-10-06).

## Lessons Learned

1. **A budget that is outgrown twice is a cost model problem, not a constant problem.** This
   subsystem's own header records the first correction (reconcile, 2026-10-02: 610 files to
   5,000+) and the fix was applied to one of the two hashing legs. The un-fixed leg was then
   outgrown by the same growth. When a class of defect is found, enumerate every site that
   shares the cost model before closing.
2. **A fail-closed refusal is only as good as its report.** Refusing a half-captured baseline
   is the right call, and the resulting advisory was truthful — but it named no files and
   disarmed the control for the session, so the only observable symptom was a line of prose
   that every reader learns to ignore. A governance control that degrades to an advisory
   needs its degradation to be *loud and specific*, or it is indistinguishable from noise.
3. **A structure doing two jobs will be read as both, everywhere.** `Object.keys(baseline)`
   was the deletion inventory AND the candidate fallback. Splitting the structure without
   hunting every reader would have left one of them fail-open, and the second reader was not
   in the original proposal.
4. **The obvious cheap substitute can be a regression.** Diffing a fresh `git ls-files`
   against the inventory looked equivalent and was strictly worse: `--cached` reads the
   index, so the single case the deletion leg exists for (an unstaged removal) became
   undetectable through both nets at once. The cheap substitute must be tested against the
   exact case the expensive scan was written for.
5. **A one-file fixture cannot see a scale defect.** The capture suite pins the enumeration
   *basis* correctly and is blind to scale; the pin it does hold asserts a baseline shape
   this fix changes. Extend the fixture surface in the same change, and make the scale pin
   structural (map size vs inventory size) rather than temporal.
6. **A claim of "the budget is blown" must survive a re-measurement, or it is a story.**
   Four warm captures finished in 19-23% of the budget; the refusal is real but
   load-dependent. An intermittent defect written as a certainty is the kind of claim a
   future reader tries once, fails to reproduce, and dismisses — taking the real defect with
   it. Measure the claim you are about to assert, and state the condition it holds under.
7. **A failed scan that cannot say why is indistinguishable from a broken control.** The
   reconcile leg reported "git failed at turn end" for a git that returns in ~110 ms, and the
   refusal reported one catch-all sentence for three different causes. When a control
   degrades, the degradation path needs the same specificity as the success path: name the
   leg, the budget, the count and the error evidence.
8. **Removing the common cause of a failure is not the same as removing the failure.** The
   split makes refusal rare; it does not make it recoverable. If the named harm is "disarmed
   for the life of the session", the fix must close the recovery path too, or the harm
   survives its own remedy in a rarer form.
9. **A fix that deletes a detection class is worse than the cost it removes.** Two deletion
   classes (an untracked-at-capture file, a session-created file) are invisible to every
   status-derived source and were caught only by the expensive loop being replaced. Enumerate
   what the expensive mechanism is the *only* net for before replacing it with a cheaper one.
10. **The plan's own vocabulary can hide a class.** Step 4 named three terms and called them
    complete; the expensive loop it replaces had a FOURTH net — the walked inventory minus the
    walked candidate set in walk mode — with no term corresponding to it. Reading the plan
    against the code it removes is what surfaced it. A "three-term" enumeration is a claim
    about coverage, and coverage claims are exactly the ones that need the expensive mechanism
    read line by line before it is deleted.
11. **A budget in the wrong place names the wrong leg.** The pre-fix guard skipped the dirty-set
    read when the remaining budget was already spent, then reported the refusal as a generic
    capture failure; the same code path could not tell "git never answered" from "the hash leg
    had no budget", and each of those needs a different operator response. Deciding the leg
    ORDER (which failure wins) is part of naming the failure honestly, not a detail of the
    control flow.
12. **Durable state has a size budget too.** The split adds a path inventory to the session
    checkpoint, which reads like a strict cost increase; measured, it is a ~55% DECREASE
    (301,304 B against a 663,482 B pre-split full-inventory map for the same 5,464 paths) because
    a path is far cheaper on the wire than a path plus a 64-hex digest. Measure the artifact's
    payload before accepting either the cost or the saving — the intuitive direction was wrong
    here, and the earlier sessions' "reduce the hashing" framing had never priced the bytes.