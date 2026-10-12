# Lesson-driven feature pipeline

The lesson ledger remains the evidence source. The feature pipeline records
which current product gaps are supported by those lessons, which remedies still
need investigation, and which FID owns accepted implementation work.

It extends the existing experience capture, recurrence analysis, wiki, lesson
parser and SessionEnd review. It does not change lesson-to-skill eligibility or
operator-only skill trust. A historical lesson's active flag is a dated claim,
not proof that the original defect still exists.

## Operating loop

1. Read the lesson and its evidence. Check the current production caller and
   existing tests before proposing a feature.
2. Add a stable candidate to `dev/feature-pipeline/candidates.json`: user-visible
   outcome, linked lesson titles, measured gap, priority and acceptance criteria.
3. Keep an unverified remedy in `draft`. Use `ready` only for an observed gap
   reviewed against the current ledger and source snapshots.
4. Converge a FID under the current ECHO contract. Record its ID and change the
   candidate to `routed`; this preserves ownership without creating a duplicate.
5. Implement and verify through the owning FID. Record its real commit and
   closed implementation evidence before using `implemented`. The original gap's
   source snapshot may change during the fix; completion uses the FID proof.
6. Review subsequent failures against the implemented feature. A regression
   requires fresh evidence and a new repair record, not an automatic status flip.

Candidate readiness is not an execution authorization. FID convergence, scope,
automation level and explicit publication authority remain the governing gates.
The pipeline never invokes a stored command, writes a FID, rewrites a lesson,
retires evidence, trusts a skill or deploys a change.

## Commands

```powershell
bun run lessons:features
bun run lessons:features --check
bun run lessons:features --write
```

The default command is read-only. `--check` validates admission and exits nonzero
for stale or malformed records. `--write` generates the inventory and candidate
report at `dev/feature-pipeline/report.md` only when admission succeeds. Repeating
it over unchanged inputs produces identical bytes.

SessionEnd presents up to three valid ready features in the existing routing
output. Invalid feature input emits a bounded review notice while the existing
recurrence, wiki and operator-decision review continues. Foreign repositories
without a candidate store receive no feature notices.

## Review evidence

`catalogHash` is SHA-256 of the exact UTF-8 lesson source. Each ready candidate
also records SHA-256 for every referenced source file. A changed source pauses
readiness until it is reviewed again. Preserve candidate IDs when updating
evidence; update hashes only after checking the gap still exists.

Evidence paths must resolve to files inside the repository, including symlink
resolution. Unknown lesson titles, duplicate IDs, ambiguous FID ownership,
speculative readiness and implementation claims without a real recorded commit
fail admission. Source freshness does not prove a gap by itself: the reviewer
must explain the observed behavior and the acceptance test that would fix it.

The generated inventory includes schema-governed and historical lessons.
Unlinked entries retain their documented guards; the pipeline does not infer a
new defect from their presence. Unheaded legacy incidents remain in the ledger
and require explicit review before becoming their own candidate.

## First reviewed candidates

| Candidate | Outcome | Current state |
|---|---|---|
| LF-001 | Read large files through true paginated windows | Ready: cap currently precedes line slicing |
| LF-002 | Preserve compression policy and context in child agents | Ready: child extraction omits both |
| LF-003 | Prove save/resume reliability with nested runtime state | Draft: identify the actual cycle |
| LF-004 | Recover retained scholarly evidence on demand | Draft: reuse spill/inventory after policy repair |
| LF-005 | Separate production acceptance from tool-call success | Draft: define run-bound observations |
| LF-006 | Surface stale lesson guidance against live authority | Draft: extend existing validation |

The original lesson file remains unchanged. The scholarly run review is in
`dev/session-summaries/2026-10-12-scholarly-review-and-feature-pipeline.md`.
