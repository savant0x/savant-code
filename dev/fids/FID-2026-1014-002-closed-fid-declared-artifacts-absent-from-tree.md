# FID: a closed FID's declared implementation and promised suite were never in the tree

**Filename:** `FID-2026-1014-002-closed-fid-declared-artifacts-absent-from-tree.md`
**ID:** FID-2026-1014-002
**Severity:** medium
**Status:** fixed
**Created:** 2026-10-14
**Automation level:** 2
**Yagni-Compliance:** Verified

## Summary

Archived `FID-2026-0919-010` (SEC-3, "`2>&1` anywhere waives the whole
metacharacter scan") closes with steps 1 and 2 marked `DONE`, a 4/4 receipt, and
a promised standalone suite `run-readonly-redirect-waiver.test.ts`. Measured
against the tree: the fix was not present at HEAD (the vulnerable waiver was
live — see `FID-2026-1014-001` finding B, which had to re-land it), and the
promised suite exists in **no commit**. A census over all 569 FID records finds
33 records naming at least one test path that does not resolve (49 distinct
paths) — a lead, not a verdict, because a rename looks like an absence.

## Environment

- **OS:** Windows (bash/Git Bash shell)
- **Language/Runtime:** TypeScript 5.5.4, Bun 1.3.14
- **Commit/State:** `33f5c2f2`, active census and read-only archive audit implemented

## Detailed Description

### Problem

The FID contract's promise rule (FID-2026-0918-006) requires a promised test
artifact to be named with its repo-relative path **and** declared as a gate.
The SEC-3 record names its suite in `### Steps` prose, not in
`### Verification`, so the rule never fired; the receipt's test gates name the
two suites that do exist; and the record was closed + archived with a `closed`
status that is outside the receipt contract by design (FID-2026-0919-021).

Net effect: a **closed security record with a passing receipt asserts a fix
and a test that the repository does not contain**, and nothing in the gates
notices. It surfaced only because an unrelated audit edited that exact branch.

### Expected Behavior

An artifact a record declares as its evidence must exist in the tree, or the
record must say it does not. Absence should be decidable mechanically, at the
plane the record lives on (its own named paths), not by trusting prose.

### Root Cause

Two contract gaps, one measurement:

1. The promise rule reads the verification section (and, per FID-2026-0919-021,
   the whole document for novelty markers) but a suite named only inside a
   *step's* prose has no gate, and a gate is what the receipt checks.
2. No gate asks the inverse question — "does every test path this record names
   exist?" — so a rename, a deletion, or an artifact that was never written are
   indistinguishable from a satisfied promise.

### Evidence

Confirmed instance, from history rather than reading:

```text
$ git log --all --name-status --pretty=format:'--- %h %ad %s' --date=short -- '*redirect-waiver*'
--- 407527b2 2026-09-19 docs(protocol): close + archive 13-FID closure batch…
R097  dev/fids/FID-2026-0919-010-…md  dev/fids/archive/FID-2026-0919-010-…md
--- e6d06fe7 2026-09-19 docs(protocol): FID records 005-017 + security audit report…
A     dev/fids/FID-2026-0919-010-…md

$ git log --oneline -S "WINDOWS_STDERR_REDIRECT_REGEX.test(segment)" --all -- …/readonly-command-validation.ts
4d89d27d checkpoint: quality-ratchet decompositions + documentation sync + harness fixes
```

No implementation commit for SEC-3 exists; the module at HEAD carried the
pre-fix line (probe output in `FID-2026-1014-001`).

Census over `dev/fids/**` (569 records, probe:
`dev/scratchpad/active/fid-artifact-census.ts`):

```text
records scanned: 569
named test paths (occurrences): 1429
distinct missing paths: 49
records naming >=1 missing path: 33
```

`NEEDS-REVIEW` — this is a heuristic. Sample rows show mixed causes: real
renames (`tool-validation-error.test.ts` → `tool-validation-error-part-d.test.ts`,
`context-pruner-phase3.test.ts`), suites moved out of the naming convention, and
at least one artifact that was never written. No row is claimed as a defect
without a history check, and no archived record is rewritten.

## Impact Assessment

### Affected Components

- `dev/fids/**` (569 records) and their declared artifacts
- The FID verification contract (`scripts/fid-verify.ts`, `validate:repository`)
- Trust in archived `closed` receipts

### Risk Level

- [x] Medium: a closed security fix was absent for a month while the record
  asserted otherwise; the class may extend to 33 records, triage unstarted.

## Proposed Solution

### Approach

1. `implemented (this session)` — re-land the SEC-3 fix and deliver its promised
   suite under `FID-2026-1014-001`, so no archived claim points at a fix that is
   not in the tree.
2. `implemented` — make the census a declared probe gate: every test path named
   anywhere in an active record must exist, or the record must carry an explicit
   `artifact::absent <path>` marker. Fenced examples are ignored, and archived
   records are available through the probe's informational `--all` mode.
3. `implemented` — Q24 authorizes a read-only Git-history audit in a separate
   session record while archived FIDs and receipts remain immutable. The active
   gate remains the only fail-closed enforcement surface.

### Steps

1. `implemented` — see `FID-2026-1014-001`.
2. `implemented` — `scripts/fid-artifact-census.ts` and its test provide the
   active-record gate and explicit absence marker contract.
3. `implemented` — the Q24 history audit is recorded in
   `dev/session-summaries/2026-10-14-fid-1014-002-q24-history-audit.md`.

### Verification

Gate re-run of the affected suites and the corpus probe is recorded in
`FID-2026-1014-001`; this record's own claim is the census count and the history
output above, both reproducible with the two commands pasted.

The implementation gate is `bun run scripts/fid-artifact-census.ts`; its focused
test is `scripts/__tests__/fid-artifact-census.test.ts`. The default probe scans
all active records, while `--all` reproduces the historical census without
turning archived history into a live closure claim.

Implementation commit: `1d60b9a8` (`scripts/fid-artifact-census.ts` and
`scripts/__tests__/fid-artifact-census.test.ts`).

The informational archive audit correction is committed as `33f5c2f2`. Its
read-only findings are recorded in
`dev/session-summaries/2026-10-14-fid-1014-002-q24-history-audit.md`.

## Verification Gates

- gate: test scripts/__tests__/fid-artifact-census.test.ts
- gate: probe scripts/fid-artifact-census.ts
- gate: probe scripts/scripts-typecheck-check.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:cb812ffda702f3c8778de293f6efb869061d6d2cc70c5e117122391f1e53c8a4
- verified: 2026-10-15T00:11:04.908Z
- test scripts/__tests__/fid-artifact-census.test.ts: exit 0
- probe scripts/fid-artifact-census.ts: exit 0
- probe scripts/scripts-typecheck-check.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** the SEC-3 promise was already broken before this record existed; the
  census then measured the blast radius (33/569).
- **GREEN:** the specific break is repaired by `FID-2026-1014-001`; the class is
  registered here rather than silently absorbed into that repair.
- **AUDIT:** history commands and census output pasted; `NEEDS-REVIEW` marked on
  the 33-row triage, which this pass did **not** do.
- **ADVERSARIAL:** the census counts *named* paths, so a record quoting a path it
  is discussing (a rename it performed) counts as a miss — which is why the
  headline is 33 *records to triage*, never 33 failures. Counter-check on the one
  record that mattered confirmed it by history, independently of the census.
- **CHANGE DELTA:** first pass.

### Loop 2 — Q24 audit and informational archive mode (2026-10-14)

- **RED:** the record documented `--all` as informational, but the probe failed
  whenever archived records named missing paths, making the accepted read-only
  historical audit unusable.
- **GREEN:** active-record misses remain fail-closed; archive findings are
  printed for audit and do not fail the active gate. A focused test proves an
  archived finding is ignored while an active finding fails.
- **AUDIT:** active census `7` records / `34` named paths / `0` missing; archive
  census `572` records / `1,392` named paths / `44` missing paths / `28`
  records affected; Git history found `29` paths and no history for `15`.
  Focused tests, default probe, informational probe, scripts typecheck, ESLint
  and Prettier all pass.
- **ADVERSARIAL:** the informational branch filters only by the active-record
  set, so `--all` cannot hide a current missing artifact. Archived documents,
  receipts and historical capture remain unchanged.
- **CHANGE DELTA:** one probe helper, one CLI branch and one focused test;
  no archived FID or historical receipt was rewritten.

### Missed Questions

1. **Do the other 32 rows share the cause?** Not established — no row was
   history-checked. Registered as triage (Q24) rather than assumed.
2. **Was this record's own claim ever verified by a second agent?** The archived
   receipt shows gate executions, not an independent audit of the *steps*. The
   step-prose gap is the actionable part.

### Code Verification Evidence

- [x] Files referenced in Affected Components exist (`dev/fids/**`, this record)
- [x] Implementation matches the Proposed Solution (step 1 landed in
  `FID-2026-1014-001`; steps 2-3 are registered decisions, not silent work)
- [x] Implementation commit `1d60b9a8` contains the active-record census and
  focused test named by this record.
- [x] Typecheck/tests/lint pass with pasted tool output (the affected suites are
  pasted in `FID-2026-1014-001`; this record's own evidence is the history dump
  and the census count in Evidence)
- [ ] Production call-graph evidence: not applicable — no production code path
- [x] FID status reflects the actual implementation state (`fixed`: the active
  contract and Q24 audit are implemented; no historical FID was rewritten)

## Resolution

- **Closed Date:** —
- **Fix Description:** the specific break is repaired under `FID-2026-1014-001`;
  the contract gap and the census triage remain open.
- **Tests Added:** No (this is a governance record; its evidence is the census)
- **Verification Evidence:** history + census output above
- **Archived:** —

## Lessons Learned

- **A receipt proves the gates ran, not that the steps happened.** The two are
  different claims and only one was mechanised.
- **Prose-declared artifacts escape the promise rule.** A path is a declaration
  wherever it appears; the rule should not depend on which heading it sits under.
- **Absence needs its own check.** Every gate in the battery asks whether
  something is *correct*; none asked whether a named thing *exists*.
