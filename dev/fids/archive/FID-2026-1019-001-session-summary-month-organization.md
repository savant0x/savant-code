# FID: Automatic month grouping for session summaries

**Filename:** `FID-2026-1019-001-session-summary-month-organization.md`
**ID:** FID-2026-1019-001
**Severity:** low
**Status:** closed
**Created:** 2026-10-19 02:55
**Automation level:** 3
**YAGNI-Compliance:** Verified

## Summary

`dev/session-summaries/` accumulated 368 entries in one flat directory (367
dated artifacts across four months plus `README.md` and `.gitkeep`). Nothing
organized them, so every new session summary deepened a chronological pile that
could only be read by listing it. The SessionEnd review now groups dated files
into `YYYY-MM/` buckets, and stored references to the old flat paths keep
resolving.

## Environment

- **OS:** Windows
- **Language/Runtime:** Bun 1.3.14, TypeScript 5.5.4
- **Commit/State:** `97f51cca` plus the organizer implementation.

## Detailed Description

### Problem

- 367 dated files lived at the directory root: 22 in 2026-07, 93 in 2026-08,
  78 in 2026-09 and 174 in 2026-10. Navigation cost grew with every session.
- Two name shapes coexisted: canonical `2026-10-18-<what>.md` and the
  pre-convention `2026-0823-2328-<what>.md` (year-monthday).
- 27 dated non-markdown artifacts (26 `.log`, one `.png`) shared the directory,
  so an organizer that only understood `*.md` would strand a quarter of the
  newest evidence.
- 12 summaries were force-tracked in git from earlier closures; a naive move
  would have committed deletions rather than renames.
- Stored references cite summaries by their old flat path:
  `dev/tracking/internal-followups.json` (LIVE-003 evidence), the canonical
  learning rules, the lesson feature catalog (LF-005) and two live docs.

### Expected Behavior

New and existing dated artifacts land in `YYYY-MM/` without renaming, rewriting
or losing one. Nothing is overwritten; a destination collision is reported and
left in place. Running twice changes nothing. Historical citations keep
resolving after the move. Undated notes stay at the root and are reported.

### Root Cause

The summaries directory was append-only by convention with no lifecycle step
that reorganized it, and its name prefixes were treated as documentation for
humans rather than as keys the tooling could use.

### Evidence

Baseline census (before): 368 entries, 0 subdirectories. `git ls-files
dev/session-summaries` = 12 tracked files. After a trial move,
`bun run validate:repository` failed with 6 issues: one
`learning.rules.reference.stale`, one `learning.features.admission` (LF-005) and
four `tracking.internal` LIVE-003 references.

## Impact Assessment

Repo tooling, the SessionEnd review path, three validators and one documentation
link. No product runtime behavior changes; no session content is edited. The
monthly buckets are untracked like the rest of `/dev`, except the 12 summaries
that were already tracked, which move as git renames.

## Proposed Solution

1. Add `scripts/session-summaries-organize.ts`: plan (pure) then apply, with
   `--check` and `--dry-run`; bucket key from the filename date, extension
   preserved; `README.md`, dotfiles, directories and undated files untouched;
   collisions reported and never overwritten.
2. Add `sessionSummaryReference(root, reference)`: resolve a cited flat
   `dev/session-summaries/<name>` path to its bucket when the flat file is gone
   and the bucketed file exists, refusing nested or traversing names.
3. Use that resolver in the three validators that admitted the old paths:
   `internal-followups`, `learnings-staleness`, `lesson-feature-admission`.
4. Call the organizer from the SessionEnd review's main block (fail-open,
   outside the pure review function so temp-root tests never move files).
5. Document the shape and commands in `dev/session-summaries/README.md`, expose
   `bun run session-summaries:organize`, and follow the moved ignore/doc paths.

### Verification

Unit tests cover the parser (canonical, legacy, impossible dates, non-markdown),
planning without mutation, collision refusal, idempotency, dry runs, missing
directories and the reference resolver. Integration: a probe summary written at
the root was grouped by a real `bun run session-end:review` run. Repository
validation re-ran after the move, and the tracked summaries moved as renames.

## Verification Gates

- gate: typecheck cli
- gate: probe scripts/scripts-typecheck-check.ts
- gate: test scripts/__tests__/session-summaries-organize.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:b1b3533abd6a6e670c5680836d937686d8e532911bbb705eda9fc11277f1d9da
- verified: 2026-10-19T06:46:12.014Z
- typecheck cli: exit 0
- probe scripts/scripts-typecheck-check.ts: exit 0
- test scripts/__tests__/session-summaries-organize.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED / GREEN

- RED: the flat directory, its four month prefixes, the two legacy name shapes
  and the 27 non-markdown artifacts were counted; a trial move produced six
  validation failures, which are the real regression surface.
- GREEN: one planner/applier, one reference resolver, three validator call
  sites, one SessionEnd call, tests and docs.
- AUDIT: grouping by filename (never mtime) is the only stable key — a copy or
  export rewrites timestamps. Tracked summaries must move as renames, so the
  pushed history keeps their bytes.
- ADVERSARIAL: the first design grouped only `*.md`; the census proved 27 dated
  artifacts would be stranded. The resolver is scoped to one directory prefix
  and rejects nested/traversing names so it cannot escape the tree or mask a
  genuinely missing file.

### Missed Questions

1. Does an interrupted organize run corrupt the directory? No — each step is one
   `mkdirSync` plus one `renameSync`; a failure leaves that file at the root and
   the next run retries it.
2. Should historical citations be rewritten instead? No. Rewriting archived and
   changelog paths would edit historical records; the resolver is the compatible
   fix and also covers future citations.
3. Does the summary README's own name need a bucket? No — `README.md` is the
   directory's documentation and stays at the root, as does `.gitkeep`.

## Resolution

### Code Verification Evidence

Implementation `53c270da`. Grouping applied to the live directory: 367 files
moved into 4 buckets (`2026-07` 22, `2026-08` 93, `2026-09` 78, `2026-10` 174);
root now holds `.gitkeep`, `README.md` and the four month directories;
`--check` exits 0 afterwards. The 12 tracked summaries moved as 100% renames,
and `validate:repository` returns `PASS` (the six pre-fix issues gone) with the
historical citations left unedited.

Tests: 13 pass / 0 fail, 39 assertions. Scripts suite: 1,135 pass / 0 fail
across 141 files. Scripts typecheck probe: exit 0. ESLint
`--max-warnings 0`: exit 0. Markdown lint: exit 0. `validate:repository`: PASS.
End-to-end: a new root summary was grouped by the SessionEnd review
(`session-summaries: 1 summary file(s) grouped into 1 month bucket(s).`).

**Closed:** 2026-10-19
**Archived:** 2026-10-19

## Lessons Learned

A dated filename is a machine-readable key, not just a human label: using it as
the bucket key made the move deterministic, reversible by inspection and
independent of timestamps. Any move also has to move its references — the
resolver is what keeps historical evidence honest without rewriting it.
