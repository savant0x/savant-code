# FID: no agent may be attributed — one rule, three enforcement points, no exception

**Filename:** `FID-2026-1014-003-no-agent-attribution-enforcement.md`
**ID:** FID-2026-1014-003
**Severity:** high
**Status:** verified
**Created:** 2026-10-14
**Automation level:** 3
**Yagni-Compliance:** Verified

## Summary

Operator directive, verbatim: *"the rule is firm. NEVER allow co-attribution,
there should not even be an escape hatch"* … *"it's 100% forbidden from any
coding agent to tag my repo"*.

Measured state before this record: the rule existed in **two divergent copies**
(a bash `grep` inside `.githooks/commit-msg` and `WATERMARK_PATTERNS` in
`scripts/pre-push-scan.ts`), both naming only two identities and refusing only
`generated with codebuff` verbatim; the hook **advertised the bypass** it was
meant to close (*"can be bypassed with --no-verify only when explicitly
authorized"*); one session summary invited footer removal *"per the operator's
own co-author policy"*; and **no CI layer existed at all**, so a bypassed local
hook reached the remote unchallenged. Now: one rule, three enforcement points,
and a whole-history scan that is clean.

## Environment

- **OS:** Windows (bash/Git Bash)
- **Runtime:** Bun 1.3.14, TypeScript 5.5.4
- **Commit/State:** `2aa5bab4`; local commits only (no push, no release)

## Detailed Description

### Problem

1. **Two truths.** The hook's bash pattern and the pre-push scanner's regex list
   were separate copies of the same policy — the drift class that produced the
   SEC-3 regression in `FID-2026-1014-001`.
2. **A denylist of two names.** Only `codebuff`/`commandcode` were blocked, and
   only as trailers or the raw phrase `generated with codebuff`.
3. **The escape hatch was documented.** The hook's own error output told the
   reader the guard "can be bypassed with --no-verify only when explicitly
   authorized" — an invitation, in the failure path, to the exact bypass the
   operator forbids.
4. **A doc asserting latitude.** `dev/session-summaries/2026-10-02-0223-…md`
   carried the footer text plus *"(Operator may edit the footer per their own
   co-author policy.)"* — a future agent could read that as authorization.
5. **No server-side layer.** `.github/workflows/` held three workflows; none
   scanned commit messages. `git commit --no-verify` and `git push --no-verify`
   both skipped every local check.

### Expected Behavior

One rule, stated once, enforced where it cannot be skipped; fail-closed
everywhere (an unreadable message file, a missing `bun`, an unresolvable range,
or a git failure must never read as *clean*); and no text anywhere implying an
exception.

### Root Cause

The guard was authored as a local convenience (2026-08-12 / 2026-08-17
incidents) and grew by patching the two copies; the enforcement *layers* were
never enumerated, so the only un-skippable layer was never built, and the
bypass was written down instead of closed.

### Evidence

Rule module and layers, live:

```text
$ git config --get core.hooksPath
.githooks
$ bash .githooks/commit-msg /tmp/tagged.txt      # Co-Authored-By: Codebuff
   ❌ agent-attribution guard: a coding agent is credited in this repository.
   (this commit)  Co-Authored-By: Codebuff <noreply@codebuff.com>
HOOK_TAGGED_EXIT:1
$ bash .githooks/commit-msg /tmp/clean.txt
HOOK_CLEAN_EXIT:0
$ bash .githooks/commit-msg /tmp/nope-missing.txt
HOOK_MISSING_EXIT:2        # fail-closed
$ bun scripts/attribution-guard.ts --all
REPO_SCAN_EXIT:0           # every commit, every ref: clean
```

Two defects found by running it, both fixed rather than tolerated:

```text
# (a) the rule flagged PROSE that quotes the watermark:
5067dd99c739  agent plus 'Generated with/by Codebuff' watermark lines (legitimate
# (b) the emoji branch was inert without the `u` flag:
🤖 Generated with Codebuff   (was passing silently)
```

## Impact Assessment

### Affected Components

- `scripts/attribution-guard.ts` (new — the single source)
- `scripts/pre-push-scan.ts` (re-exports it; its own copy deleted)
- `.githooks/commit-msg` (delegates; invitation removed)
- `.github/workflows/attribution-guard.yml` (new — the un-skippable layer)
- `dev/session-summaries/2026-10-02-0223-fid-003-batch1-implementation.md`
  (amended, not silently rewritten)

### Risk Level

- [x] High: an unattributed-agent rule with a documented bypass and no
  server-side layer is worse than no rule — it reads as enforcement.

## Proposed Solution

### Approach

1. Move the rule to one module with a CLI for every caller (Law 13).
2. Broaden it past two names — vendor identities plus self-declaring trailer
   words — while anchoring watermarks to line start so prose is never flagged.
3. Delete the second copy; keep `WATERMARK_PATTERNS`/`commitWatermarkLines` as
   re-exports so existing consumers and suites keep their surface.
4. Add the CI layer, and **tell the operator it must be marked required** —
   a red check blocks a merge only when branch protection requires it.
5. Strike the two texts implying latitude; record the doc edit as a dated
   amendment rather than a silent rewrite.

### Steps

1. `implemented` — `scripts/attribution-guard.ts:36-51` (`VENDOR`, anchored
   `WATERMARK`), `:52-106` (`AGENT_ATTRIBUTION_PATTERNS`,
   `commitWatermarkLines`), `:114-152` (`scanRevisions`), `:154-201` (CLI,
   fail-closed `2` on every unusable input).
2. `implemented` — `scripts/pre-push-scan.ts:131-134` re-export only.
3. `implemented` — `.githooks/commit-msg:36` delegates to the module, checks
   `bun` exists (else exit 2), and no longer names a bypass.
4. `implemented` — `.github/workflows/attribution-guard.yml` scans `--all` with
   `fetch-depth: 0`.
5. `implemented` — 2026-10-02 amendment block.
6. `blocked (operator)` — **branch protection**: the CI job must be marked a
   required status check, and only the operator can do that. Until then the
   layer exists but does not block a merge.

### Verification

Named artifacts: `scripts/__tests__/attribution-guard.test.ts` (rule + CLI +
temp-repo range e2e) and `scripts/pre-push-scan-watermark.test.ts` (the pre-push
layer, unchanged behaviour after the re-export).

```text
attribution suite                                 7 pass / 0 fail   exit 0
pre-push scan suites (watermark + scan)           4 pass / 0 fail   exit 0
bun scripts/scripts-typecheck-check.ts   PASS — the scripts tree typechecks.
bun run typecheck:scripts                                           exit 0
bun run quality:report                    PASS (1502 baselined files)  exit 0
bun run lint:md                                                     exit 0
eslint --max-warnings 0 (3 files)                                   exit 0
prettier --check (3 files)                       All matched files use Prettier
bun scripts/attribution-guard.ts --all                              exit 0
```

## Verification Gates

- gate: test scripts/__tests__/attribution-guard.test.ts
- gate: test scripts/pre-push-scan-watermark.test.ts
- gate: probe scripts/scripts-typecheck-check.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:9361df687350ddc1164894f40646296ae2bef2dcb52f79179b244c9e55713664
- verified: 2026-10-14T16:42:16.057Z
- test scripts/__tests__/attribution-guard.test.ts: exit 0
- test scripts/pre-push-scan-watermark.test.ts: exit 0
- probe scripts/scripts-typecheck-check.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** first `--all` run over real history failed the repo on **prose**
  (`5067dd99c739`), and the emoji watermark passed silently — a rule that blocks
  the guard's own explanatory commit and misses the canonical footer shape.
- **GREEN:** watermarks anchored to line start with an explicit `u`-flag; the
  bypass invitation and the latitude sentence removed; CI layer added.
- **AUDIT:** whole-history scan exit 0; tagged message file exit 1; clean exit 0;
  unreadable file exit 2; unresolvable range exit 2; temp-repo tagged range exit
  1; suites and gates as pasted above.
- **ADVERSARIAL:** *did the agent itself ever use the hatch?* One commit attempt
  carried the Codebuff footer and was **rejected by the hook** (no commit object
  created); the retry omitted it, and no commit in any ref carries a trailer.
  *Does the rule block legitimate work?* A human co-author and four prose shapes
  are pinned as allowed. *Was the agent's own test harness forced through a
  hole?* No `--no-verify` is used anywhere; the range e2e empties
  `core.hooksPath` in a throwaway temp repo instead.
- **CHANGE DELTA:** first pass.

### Missed Questions

1. **Can any local hook be made un-skippable?** No — `--no-verify` is git's, so
   the only un-skippable layer is server-side. That is why this record adds CI
   and flags branch protection instead of claiming the hatch is gone.
2. **Should unknown future agents be caught?** Partly: vendor names plus the
   self-declaring words `bot`/`agent`/`assistant`/`llm` inside trailers cover the
   shapes agents actually emit; the operator owns widening the list.
3. **Why not block all co-authors?** Attribution *of a human* is legitimate
   tooling, and GitHub credit for a human is not the harm the rule exists to
   prevent. The rule judges the line, not the commit's origin.

### Implementation Evidence

- [ ] **Commit SHA:** pending (operator holds the commit)
- [x] **File:line ranges:** cited in Steps
- [x] **Gate output:** pasted in Verification
- [x] **Reproducibility:** `bun scripts/attribution-guard.ts --all`
- [x] **Step statuses:** 1-5 `implemented`; 6 `blocked (operator)`

### Code Verification Evidence

- [x] Files referenced in Affected Components exist (all six paths listed there)
- [x] Implementation matches the Proposed Solution (one rule, delegated hook,
  re-exported push layer, CI job, amended summary, registered gate)
- [x] Typecheck/tests/lint pass with pasted tool output (see Verification)
- [x] Production call-graph evidence: `commitWatermarkLines` ← the hook
  (`.githooks/commit-msg:36`), the pre-push range scan
  (`scripts/pre-push-scan.ts:131-134` re-export plus its in-scan use) and
  `collectAttributionIssues` ← `scripts/validate-repository.ts:299`
- [x] FID status reflects the actual implementation state (`verified`; the CI
  job is live but not yet a required check — operator-owned)

## Resolution

- **Closed Date:** —
- **Fix Description:** one rule, three enforcement points, no written exception
- **Tests Added:** Yes — 7 pins in the new suite
- **Verification Evidence:** see Verification
- **Archived:** —

## Lessons Learned

- **A documented bypass is a bypass.** The hook's failure message taught the
  reader how to skip it; the fix was to delete the sentence and add a layer that
  cannot be skipped.
- **Run a guard against real history before trusting it.** This one flagged its
  own explanatory commit — the false positive that gets guards disabled.
- **Delete the second copy when you find it.** The two divergent patterns were
  the same drift class as `FID-2026-1014-001`'s SEC-3 regression.
