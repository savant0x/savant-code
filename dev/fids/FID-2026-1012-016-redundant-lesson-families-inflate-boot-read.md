# FID: Redundant lesson families inflate the boot read

**Filename:** `FID-2026-1012-016-redundant-lesson-families-inflate-boot-read.md`
**ID:** FID-2026-1012-016
**Severity:** medium
**Status:** converged
**Created:** 2026-10-12 19:05
**Automation level:** 3
**YAGNI-Compliance:** Verified
**Master FID:** FID-2026-1012-022 (The failure-class remediation program)
**Depends On:** FID-2026-1012-010, FID-2026-1012-012, FID-2026-1012-013, FID-2026-1012-014

---

## Summary

`dev/LEARNINGS.md` is boot-read 0-EOF in every session, so every line in it is context the
agent pays for before it does anything. Eighteen of its 34 governed lessons are not 18
distinct findings: they are five families that each restate one durable invariant across
several incidents, one entry per recurrence. The ledger records the INCIDENT, and each
incident gets its own entry even when the invariant it proves is one the ledger has already
stated — so a known class reproduced five times costs the boot read roughly five times
instead of extending the evidence of a rule that already exists. This record enumerates the
five families (matrix row C3 of
`docs/design/learnings-boot-loading-and-lifecycle-review.md`), nominates one canonical rule
per family, and consolidates them under the EXISTING supersession machinery — never by
deleting text — with the line reduction measured before and after. The consolidation is
operator-approved because the ledger is the boot-read artifact.

## Environment

- **OS:** Windows 11 (win32), Git Bash
- **Language/Runtime:** TypeScript 5.5.4, Bun 1.3.14
- **Tool Versions:** `scripts/learnings-validation.ts`, `scripts/learnings-schema.ts`,
  `scripts/learnings-references.ts` at `HEAD`
- **Commit/State:** `main` @ `14d48820`

## Detailed Description

### Problem

The ledger is 77,195 chars / 1,174 lines and holds 37 `## Lesson:` headings — 34 governed
plus 3 legacy narrative below the boundary. Reading the entries by their invariant rather
than their incident shows that **18 of the 34 governed entries restate one invariant across
several incidents, in five families**. The cost is paid at boot, by every session: the
`Failure` paragraph is the audit record of what happened once, and it is the dominant part of
the ~31 average lines per entry, but no consumer at boot reads an incident report to know what
to do. Meanwhile the retirement cap (`scripts/learnings-retire.ts:29`, `DEFAULT_LINE_CAP =
1200`) leaves 26 lines of headroom, so a recurrence that could have been one evidence line
under an existing rule instead consumes the remaining budget and pushes a whole entry out of
the file into `dev/LEARNINGS-RETIRED.md` — where the reachability of the information drops for
boot and for every by-title consumer.

### Expected Behavior

A durable invariant appears in the ledger once, with the incidents that established it as its
evidence. A new occurrence of a known class extends an existing entry's evidence rather than
creating a new entry, and the supersession and canonical-rule machinery — not deletion, not a
manual rewrite — is what records that an old entry is now evidence for a surviving rule.

### Root Cause

The ledger's unit of record is the incident, and nothing in the write path asks whether the
invariant is already stated. `learnings-schema.ts` requires `Failure`, `Invariant`, `Guard`
and `Verification` per entry, so the same invariant written per incident is schema-valid every
time; uniqueness is enforced only on the entry TITLE, never on the invariant. There is also no
step that measures the ledger's growth in the units that matter (lines and chars per class),
so restatement is invisible until the cap is hit and retirement moves something out. The
supersession machinery can already express the consolidation — `Superseded by` plus a
`Canonical rule`, checked by `supersessionIssues` in `scripts/learnings-validation.ts` for a
distinct, non-superseded, acyclic target — it has simply never been applied to this class.

### Evidence

The five families, with the entry titles as they appear in the ledger and the FID that owns
each incident:

```text
F1 shared-state / test isolation — 5 entries (FID-2026-1007-001, -002, -006)
   A process-lifetime registry plus a reused fixture key is deterministic test-order dependence
   A leak class is enumerated, not inferred from the instance that hurt
   A reset has no value until a preload calls it, and a boundary has two levels
   Opt-in isolation is not isolation, and a reset is not an authority
   Removing shared-state noise is the start of the diagnosis, not the end of the repair

F2 register-and-contract shape parsing — 4 entries (all FID-2026-1009-001)
   A machine-readable register entry is a parsed artifact, not prose
   A register target line whose globs all sit on continuation lines contributes nothing
   Verification gates inside a code fence are invisible to fid:verify
   A repair script that slices on a re-run is a data-loss script

F3 consumer / wiring proof — 4 entries (FID-2026-1006-003, FID-2026-1007-007)
   A library-complete hand-off needs a named consumer, not a readiness note
   Law 4 is satisfied by the caller, not by the test that imports the module
   A health breaker may throttle background traffic but must never deny a user action
   Removing a gate from its only caller leaves production-dead code behind

F4 three-state verdicts / absence is not zero — 4 entries
   (FID-2026-1007-008, -009, FID-2026-1012-002, FID-2026-1012-009)
   A control that fails is not a control that disagrees
   A telemetry value's absence and its zero are different facts
   An unavailable tool needs a different recovery policy from incomplete arguments
   (FID-2026-1012-009, closed + archived) the truncation-versus-ill-typed classification
   recorded in that record's Lessons Learned

F5 per-member reporting for a collection — 2 entries (FID-2026-1007-008)
   A failing part is not a failing whole
   (and its sibling above, which is the same invariant applied to a comparison baseline)

Counts: 18 of 34 governed entries cluster into 5 families.
Ledger total: 77,195 chars / 1,174 lines / 26 lines of headroom to the 1,200-line cap.
```

The reduction this could recover is an ESTIMATE from entry counts, not a measurement: five
surviving entries plus their evidence lines, against eighteen entries today.

## Impact Assessment

### Affected Components

- `dev/LEARNINGS.md` (the consolidated entries and their evidence)
- `dev/LEARNING-RULES.md` (the nominated rule per family must exist there)
- `dev/LEARNINGS-RETIRED.md` (unchanged — move-only; consolidation supersedes, it never moves)
- Every boot-read consumer: `agents/savant/system-prompt.ts`, `protocol.config.yaml`
- `scripts/lesson-feature-pipeline.ts` and `scripts/lessons-to-skills.ts`, which resolve
  entries by TITLE and therefore must be re-pointed when a title is superseded

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

Medium: the ledger is well-formed today (`learnings:check` PASS) and nothing is lost by
leaving it; the cost is boot context and the growing risk of pushing entries out of the
boot-read file. The change touches the boot-read artifact, which is why it is
operator-approved rather than autonomous despite automation level 3.

## Proposed Solution

### Approach

Loop 2 and `docs/design/perfection-loop-2026-10-12.md` govern implementation where
they correct the original plan. No age-based class disposition or repair is implied.

Consolidate by SUPERSESSION, not by rewriting history: each family keeps one surviving entry
carrying the invariant, the guard and the canonical rule, with the incidents it subsumes
recorded as evidence lines naming their owning FIDs. The superseded titles are retained by the
existing `Superseded by` field so a by-title reference still reaches the surviving rule.

### Steps

1. Enumerate the five families IN THE LEDGER itself (a comment or a consolidated entry's
   evidence list) so the clustering is checkable rather than asserted in this record only.
2. For each family, nominate ONE canonical rule from `dev/LEARNING-RULES.md`. Two already
   exist and are named by entries in these families — `call-graph-proof-asserts-the-caller`
   and `library-complete-needs-a-named-consumer` (both F3) — so F3 is the worked example;
   the remaining four families need either an existing rule or a new one.
3. Consolidate under the machinery that already enforces correctness: the surviving entry
   names the rule via `Canonical rule`, and each superseded entry carries `Superseded by:` the
   surviving title with `Status: superseded`, validated by `supersessionIssues`
   (`scripts/learnings-validation.ts`) for a valid, distinct, non-superseded target and no
   cycle.
4. Keep every incident as an evidence line under the surviving entry — the operator verbatim,
   the measurement and the owning FID all survive; nothing is deleted and
   `dev/LEARNINGS-RETIRED.md` is not written to by this record.
5. Re-point the by-title consumers: `scripts/lessons-to-skills.ts` (`parseLessons` /
   `findCandidates`) and `scripts/lesson-feature-pipeline.ts` (candidate `lessons[]`), so a
   consolidation does not strand their references — the failure mode recorded as matrix row D1.
6. MEASURE the reduction: lines and chars before and after, per family and in total, pasted
   into this record. Report the delta as measured, never as the estimate above.
7. Operator approval before the ledger edit lands: the boot-read artifact's contents are
   operator-relevant, and the consolidation changes what every session reads.

### Verification

- `bun run learnings:check` PASS over the consolidated ledger (all required fields, unique
  titles, supersession targets valid, evidence references resolving).
- The measured before/after line and char counts, pasted into this record, with the boot-read
  share of the ledger stated.
- The by-title consumers still resolve: `bun run lessons:features --check` and the
  `lessons:to-skills` candidate scan show no new admission issue caused by the consolidation
  (their PRE-EXISTING seven issues belong to FID-2026-1012-012).
- A pin asserting each consolidated family keeps exactly one surviving entry naming its
  canonical rule.

## Verification Gates

This record is `converged` — pre-implementation — so **no gate bullets are declared here**.
Gates are declared when the artifacts exist, per the contract (mandatory once the status flips
to `fixed`/`verified`), and the natural shapes for this record are the learnings validator
suite, a probe for the consolidation's measurement, and the repo-wide `quality` gate.

## Perfection Loop

### Loop 1 — RED (2026-10-12)

- **RED:** 18 of 34 governed lessons cluster into five families that restate one invariant
  across incidents (list in Evidence), while the ledger sits 26 lines under its retirement cap
  — so restatement is the mechanism that pushes entries out of the boot-read file.
- **GREEN:** nominate one canonical rule per family and consolidate through the existing
  `Superseded by` + `Canonical rule` machinery, keeping every incident as an evidence line and
  measuring the delta.
- **AUDIT:** the family membership, the counts and the ledger size are read from the ledger at
  `HEAD` `14d48820`; the supersession rules cited are the ones `supersessionIssues` enforces;
  the two existing rule names come from `dev/LEARNING-RULES.md`. The reduction figure is
  marked as an estimate and is not claimed as measured.
- **ADVERSARIAL:** (a) Does consolidation lose an incident? No — `Superseded by` keeps the
  title resolvable and the incidents survive as evidence lines; nothing is deleted, and
  retirement is untouched. (b) Does it weaken the boot read? That is the risk, and it is
  answered by keeping `Guard` and `Canonical rule` intact on the survivor: what is removed is
  per-incident narrative, not the rule. (c) Is the clustering an artifact of reading titles?
  It is a reading — hence step 1 writes the enumeration into the ledger so it is checkable,
  and step 6 measures the outcome. (d) Does it collide with the rule-tiering work? No — the
  survivor's canonical rule is exactly what FID-2026-1012-014 needs to promote; this record
  supplies the consolidated set it selects from.
- **CHANGE DELTA:** ~0% of code. The record's own delta is the enumeration plus the
  nomination; the ledger edit is step 7's approved pass.

### Loop 2 — Current-tree review and self-correction (2026-10-12)

- **RED:** All 37 lessons were read. The proposed family list repeats members and
  includes a FID's lesson outside the governed ledger; 18 unique mergeable entries
  are not established. Caller proof, breaker policy and hand-off ownership differ.
- **GREEN:** Apply `docs/design/perfection-loop-2026-10-12.md`: produce a unique
  title/invariant/evidence inventory, consolidate only proven identical invariants,
  and preserve full incidents. Measure selected-digest reduction separately from ledger
  growth. Consume 012's locator and 013's reference reconciliation before consolidation.
- **AUDIT:** Existing supersession validation requires a distinct non-superseded target.
  Keeping bodies and adding metadata cannot promise to reduce ledger lines.
- **ADVERSARIAL / missed question:** Can a family label justify removing a guard?
  No. Present the concrete mapping for the recorded level-1 consolidation ruling.
  All unresolved classes stay owned; planned measurement/tests are in the shared table.
- **CHANGE DELTA:** Planning correction only; no consolidation or retirement occurred.

### Missed Questions

1. Should consolidation happen before or after rule tiering? → After the rule catalogue agrees
   with the ledger (FID-2026-1012-014), because the survivor must name a rule that exists and
   has a tier; consolidating first would pick rule names the catalogue does not carry.
2. Is whole-entry retirement the right tool for redundancy? → No. Retirement moves a lesson
   out of the boot-read file and out of by-title reach; redundancy is a supersession problem,
   and the two must not be conflated.
3. What if a family's members are not actually the same invariant? → Then they are separate
   entries and step 1's enumeration is what says so. The family is a claim to be checked
   entry-by-entry during the pass, not a count to act on blindly.

### Code Verification Evidence

> Pre-implementation record: `Status: converged` (FID-2026-0915-004). Nothing in this
> record has been implemented, so what follows records what was CHECKED at the cited
> `HEAD` — not what was built.

- [x] Every cited path exists at `main` @ `14d48820`, read directly at review time; the raw
      measurements live in `docs/design/learnings-boot-loading-and-lifecycle-review.md` §2/§3,
      which this record expands.
- [x] Measurements re-checked: the five families were enumerated by reading all 37
      `## Lesson:` headings: 18 of the 34 governed entries listed with their owning FIDs in
      this record's own Evidence block; the ledger totals 77,195 chars / 1,174 lines; the
      reduction figure in this record is labelled an estimate, not a measurement.
- [x] **Not yet true, and deliberately not claimed:** the repair itself, its gates and its
      receipt. Gates are declared when the status flips to `fixed`/`verified` and the
      artifacts exist; declaring them now would be a false declaration.

## Boundaries

- The family membership above is a reading of the entries, with titles and owning FIDs listed
  so it can be checked; no automatic clustering was run, and the ~35% line share quoted in the
  review is an estimate derived from entry counts.
- Nothing in this record edits the ledger: it is `converged` and pre-implementation. The
  consolidation is step 7's operator-approved pass, and its delta is measured there.
- This record does not fix the pre-existing `lessons:features --check` failure; that belongs
  to FID-2026-1012-012, and this record only undertakes not to add to it.
- Dependencies recorded: FID-2026-1012-010 (the boot digest decides how much consolidation is
  needed at all) and FID-2026-1012-014 (rules must be the promotion target).

## Resolution

**Not implemented — `Status: converged` (pre-implementation, FID-2026-0915-004).**

This record exists so the finding has an owner, a converged design and a register item with
write authority; it made no source change. The work described above is implemented by
whichever pass flips the record to `fixed`, at which point this section is rewritten in the
closure format (Closed Date / Fix Description / Tests Added / Verification Evidence /
Archived) and the declared gates are added under `## Verification Gates`.

- **Authorised write surface:** `SCOPE.md` → machine-readable scope targets → this record's
  line (registered 2026-10-12 with the review).
- **Design record:** `docs/design/learnings-boot-loading-and-lifecycle-review.md` §3 row C3,
  §4 features F4 and F1.
- **Ordering:** Follows FID-2026-1012-010 (the boot digest decides how much consolidation is
  needed) and FID-2026-1012-014 (rules must be the promotion target); the consolidation step
  itself is operator-approved (automation level 1).
