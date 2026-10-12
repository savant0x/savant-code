# FID: Failure classes have no horizon — a fixed class keeps ranking as if it were live

**Filename:** `FID-2026-1012-024-failure-class-taxonomy-and-horizon.md`
**ID:** FID-2026-1012-024
**Severity:** high
**Status:** converged
**Created:** 2026-10-12 23:10
**Automation level:** 3
**YAGNI-Compliance:** Verified
**Master FID:** FID-2026-1012-022 (The failure-class remediation program)

---

## Summary

The census that drives this whole program cannot tell a **fixed** class from a **live** one. Seven
classes — **36 records** of `tool result contains an error` across six tools — rank in the master's
census with no owner, and every one of them was last seen on or before **2026-09-09**, the date of
`FID-2026-0909-005`, the record that made the capture extract a tool's real error line instead of the
wrapper. There has not been a single wrapper record in the **33 days** since. The classes are almost
certainly fixed; the repository cannot say so, because a class has no **fix boundary** and no last-seen
horizon in its identity — so a fossil ranks beside a defect, a child can never close on evidence, and
the operator's census reads as if 36 open defects were unowned. The same identity is the one the
detector keys on, which is why it is both over-merged (everything collapsed into the wrapper string) and
over-fragmented (payload-embedded paths and timestamps make every record unique), a tension already
documented in `docs/design/SkillOpt Integration into Savant.md:62`. This lane fixes the measuring
instrument: a class must carry what it is, when it was last seen, and what fixed it.

## Environment

- **OS:** Windows 11 (win32), Git Bash
- **Language/Runtime:** TypeScript 5.5.4, Bun 1.3.14
- **Tool Versions:** `ai` 5.0.122
- **Commit/State:** `main` @ `6e37aa15`

## Detailed Description

### Problem

Three defects in the class identity, all of which land on the master's closure condition:

1. **No horizon.** `FID-2026-1012-022` ranks classes by volume with a last-seen date and nothing else.
   The seven wrapper classes (36 records, all dated 2026-08-25 → 2026-09-09) therefore sit in the census
   exactly as the live ones do. A child whose class is already fixed cannot close — it has no way to
   assert "no recurrence" against a class that is *only* residue, and it cannot honestly propose a fix
   for a defect that stopped.
2. **A wrapper can still be the class name.** The capture's error line is produced by
   `extractToolResultError(content) || 'tool result contains an error'`
   (`packages/agent-runtime/src/tools/tool-executor/tool-result-errors.ts:73`), so when extraction finds
   nothing the class name becomes a constant. 36 records share it, across `str_replace` (14),
   `read_url` (8), `code_search` (5), `run_readonly_command` (3), `skill_manage` (3),
   `run_terminal_command` (2) and `write_file` (1) — six unrelated mechanisms, one name.
3. **The identity is a substring.** Classes are `toolName` + the first 70 characters of one line, and the
   instrument's own sensitivity (`FID-2026-1012-022`'s table: 64 / 66 / 68 / 82 classes at 40 / 60 / 70 /
   full-line slices) shows the count moves with the slice. The capture stores no error class, no
   expected/unexpected flag, and no fix boundary, so neither a coarser nor a finer slice can be
   justified from the record. `FID-2026-1012-009`, on closing, recorded exactly this as its follow-up:
   store `errorClass` and the truncation flag on the capture record.

### Expected Behavior

A class identity that carries (a) **what it is** — a stable class key, not a sliced message, with the
expected/unexpected distinction preserved, (b) **when it was last seen**, and (c) **what fixed it**, once
anything did. With that, the census separates live classes from fossils, a child can close a class that
stopped recurring **without a code change**, and the master's closure pass has something to assert
against. A wrapper name means the capture could not classify the failure, which is itself a class — "the
cause was not recorded" — never a name shared by six unrelated mechanisms.

### Root Cause

**The class is a rendering of a record, not a property of it.** Everything the detector needs
(`triggerType`, `toolName`, `errorFirstLine`, `contextHash`, `sessionId` —
`common/src/types/experience.ts:27` and the record schema beside it) is *about the occurrence*, and
nothing is *about the class*: there is no key derived from the cause, no first/last-seen bookkeeping at
the class level, and no place to record that a class was repaired. `scripts/experiences-dedup.ts`
therefore keys on a normalized message line (`normalizeErrorFirstLine`, pinned by
`scripts/__tests__/experiences-dedup.test.ts:77`) and `dev/agenda.md` publishes "recurrences" for a
string. The archived history shows both failure directions of that choice: `FID-2026-0909-005` had to
make the line *more* specific (it was the constant), and `FID-2026-0909-006` had to fight the opposite
(embedded payload making every failure unique). Neither record could introduce the missing layer,
because the missing layer is a class, not a line.

### Evidence

Measured at `6e37aa15` from `dev/experiences/raw-traces.jsonl` with the master's instrument
(`toolName` + first 70 characters of the error line); rows 12, 16, 24, 32, 33, 36 and 46 of the master's
census.

```text
$ bun -e '<aggregate the capture by toolName + errorFirstLine.slice(0,70)>'   # this lane only
str_replace         — tool result contains an error    14 hits / 11 sessions / last 2026-09-09
read_url            — tool result contains an error     8 /  2 / 2026-08-26
code_search         — tool result contains an error     5 /  4 / 2026-09-02
run_readonly_command— tool result contains an error     3 /  2 / 2026-09-07
skill_manage        — tool result contains an error     3 /  2 / 2026-09-08
run_terminal_command— tool result contains an error     2 /  2 / 2026-09-07
write_file          — tool result contains an error     1 /  1 / 2026-08-25
                                7 classes / 36 records — newest 2026-09-09, none in the 33 days since

$ grep -n "tool result contains an error" packages/agent-runtime/src/tools/tool-executor/tool-result-errors.ts
73:   return extractToolResultError(content) || 'tool result contains an error'
```

The date is the finding: the last wrapper record and the record that removed the wrapper
(`FID-2026-0909-005`) share 2026-09-09, and the class has been silent since — but the census reports it
as seven unowned classes, so "fixed" and "abandoned" look identical.

## Impact Assessment

### Affected Components

- `common/src/types/experience.ts` (the capture record schema — where a class key would live)
- `packages/agent-runtime/src/hooks/experience-capture.ts` (the writer)
- `packages/agent-runtime/src/tools/tool-executor/tool-result-errors.ts:73` (the wrapper string)
- `scripts/experiences-dedup.ts` and `common/src/util/experiences.ts` (the class key and recurrence)
- `scripts/session-end-review.ts` / `dev/agenda.md` (what the operator sees)
- `dev/fids/FID-2026-1012-022` (the census and its closure condition)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround — without a horizon, every child either stays open
  forever or closes on a test suite that cannot speak about production, which is the exact failure this
  program exists to end. The master's closure condition is currently unenforceable.
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Make the class a first-class, derivable object: a stable class key with an explicit
**expected/unexpected** dimension; class-level first/last-seen bookkeeping; and a **fix boundary** —
the commit or date at which a class was repaired, so a class whose newest record precedes its boundary
is *closed as fixed* with the silent window as its assertion. Keep the existing pipeline in place
(the hook, `experiences:dedup`, the agenda, the two producers all stay); this lane adds the layer they
key on. Then use it to close this lane's own seven classes honestly, which is the acceptance test: a
fossil must be closable **without a code change**.

### Steps

1. Re-measure this lane at implementation time with the master's instrument and record the numbers
   verbatim (the RED above is the baseline).
2. Add the class key to the capture record: a derived, stable identity for the failure's cause, plus the
   **expected/unexpected** flag — `FID-2026-1012-009`'s `errorClass` follow-up is the vehicle.
3. Give a class a **horizon**: first seen, last seen, count, and (when it exists) the **fix boundary** —
   the commit that was supposed to end it.
4. State the wrapper's new meaning: an unclassifiable failure is its own class ("cause not recorded"),
   never a name shared across tools, so the extractor's fallback becomes a signal rather than a label.
5. Make the census and the agenda report live classes and **fossils with a boundary** separately, and
   re-derive the master's census from it.
6. Close this lane's seven classes on evidence: 36 records, newest 2026-09-09 against a fix boundary at
   `FID-2026-0909-005`, no recurrence in the silent window — and if a wrapper record appears again,
   reopen the lane instead of closing it.
7. Only then write the lesson, against the instrument.

### Verification

Planned: a test for the class key (expected/unexpected preserved; the wrapper maps to the "cause not
recorded" class and never merges two tools into one class); a test for the horizon (a class whose newest
record precedes its fix boundary reports as closed, one that follows reports as live); and a probe that
recomputes the census over the real capture, exiting 1 when a class above the bar has no owner or a
closure claim contradicts the records. The recurrence assertion for this lane is the silent window: no
`tool result contains an error` record after the declared boundary.

## Verification Gates

This record is **pre-implementation** (`Status: converged`), so **no gates are declared yet**: a
declared gate must point at an artifact that exists, and declaring one now would be a false declaration.
Gates are added under this heading when the status flips to `fixed`/`verified` — the class-key test, the
horizon test, the census probe, the `scripts`/`common`/`agent-runtime` typechecks and `quality`.

## Perfection Loop

### Loop 1 — RED (2026-10-12)

- **RED:** seven classes / 36 records rank in the master's census with no owner while their newest record
  is **2026-09-09** — the date of the fix that removed the wrapper — with 33 silent days since. Nothing
  in the record distinguishes them from the live classes, the class name is a constant shared by six
  unrelated tools, and the class count itself moves with the instrument's slice length (64/66/68/82).
- **GREEN:** give the class a stable key with an expected/unexpected dimension, class-level first/last
  seen, and a **fix boundary**; make an unclassifiable failure its own class; report fossils separately;
  then close this lane's classes on the silent window.
- **AUDIT:** the seven classes and 36 records are enumerated from the capture in the Evidence block; the
  wrapper site was read and quoted with `file:line`; the 2026-09-09 date is the maximum last-seen of the
  lane against a fix record of the same date; the instrument's sensitivity is the master's four-slice
  table.
- **ADVERSARIAL:** (a) *Are these classes really fixed, or just not hit?* Unknown, and the record does not
  claim it — that is precisely why the horizon needs a fix boundary plus the silent window, and why a
  single new wrapper record reopens the lane. (b) *Does a class key duplicate `contextHash`?* No:
  `contextHash` identifies an occurrence's context; the key must identify a cause and stay stable across
  sessions, which is why the expected/unexpected flag and the cause belong in it. (c) *Is `FID-2026-0909-005`
  already the fix, making this record redundant?* It fixed the *line*; the class still has no horizon, and
  the census produced by `FID-2026-1012-022` proves it — seven unowned classes that no child can close.
  (d) *Could a fix boundary be gamed by dating a class after its records?* A boundary is a commit or
  date, and the probe compares it against records rather than trusting it, so the failure mode is a
  reopened lane, not a false closure.
- **CHANGE DELTA:** 0% source — this record made no code change; it is a converged pre-implementation
  design and one lane of the master's allocation.

### Missed Questions

1. **Should the class key be stored at capture time or derived at read time?** Stored, from the
   `FID-2026-1012-009` `errorClass` follow-up: deriving it at read time cannot recover the cause from a
   line that never carried one, and the 36 wrapper records are the proof.
2. **What happens to the 559 existing records when the key changes?** They are re-derived on read
   (unknown causes become the "cause not recorded" class, with their date range as the horizon), so the
   historical capture is not rewritten — it is re-read through the new identity, and the master's census
   is regenerated from it.
3. **Does a fossil need a lesson?** No — a lesson is earned by a class that stopped recurring because of
   a fix this repository made. A fossil's evidence is the fix boundary and the silent window, recorded in
   the census.
4. **Is the lane's own class set the acceptance test?** Yes, deliberately: if the layer cannot close
   these seven honestly, it cannot be trusted to close any other lane, and the master's closure condition
   stays unenforceable.
5. **Should the master's ranking change?** Yes — it must rank live classes by volume and fossils
   separately; the master's closure pass re-runs the allocation on the then-current capture (its own
   Boundaries already say a class that appeared since the census must be owned first).

### Code Verification Evidence

> Pre-implementation record: `Status: converged` (FID-2026-0915-004). Nothing here is implemented;
> what follows records what was CHECKED at the cited state.

- [x] Measured at `6e37aa15`: the seven classes / 36 records above, from the capture aggregation,
      matching rows 12, 16, 24, 32, 33, 36 and 46 of `FID-2026-1012-022`'s census.
- [x] The wrapper site was read and quoted with `file:line`:
      `packages/agent-runtime/src/tools/tool-executor/tool-result-errors.ts:73`
      (`extractToolResultError(content) || 'tool result contains an error'`).
- [x] The capture schema and its fields were read at `common/src/types/experience.ts:27`
      (`RAW_TRACES_FILE_NAME`) and the record shape was read from the capture itself
      (`ts`, `triggerType`, `toolName`, `errorFirstLine`, `contextHash`, `sessionId`).
- [x] The archived predecessors were located and read: `dev/fids/archive/FID-2026-0909-005-experience-capture-generic-error-line.md`
      (the constant line) and `dev/fids/archive/FID-2026-0909-006-error-line-payload-fragmentation.md`
      (the over-fragmentation), with the over-merge/over-fragment tension in
      `docs/design/SkillOpt Integration into Savant.md:62`.
- [x] The dedup key's normalization is pinned by `scripts/__tests__/experiences-dedup.test.ts:77`
      (`normalizeErrorFirstLine('tool result contains an error')`).
- [x] **Not yet true, and deliberately not claimed:** the class key, the horizon, the wrapper's new
      meaning, the census probe, this lane's closures, the gates and this record's receipt.

## Boundaries

- The seven classes' closure is **contingent on the horizon existing**: until it does, this record
  asserts only that they are unclosable, not that they are fixed. A new wrapper record after the
  declared boundary reopens the lane.
- No change is proposed to the capture hook's fail-open behaviour, to `experiences:dedup`'s
  recurrence threshold, or to the two downstream producers as part of this lane.
- The 559 historical records are re-read, never rewritten; the capture stays append-only and immutable.
- Nothing was pushed.

## Resolution

**Not implemented — `Status: converged` (pre-implementation, FID-2026-0915-004).**

This record exists so the measuring instrument has an owner, a converged design and a register item with
write authority; it made no source change. Whichever pass flips it to `fixed` rewrites this section in
the closure format and adds the declared gates.

- **Authorised write surface:** `SCOPE.md` → machine-readable scope targets → this record's line.
- **Master program:** `FID-2026-1012-022` (census rows 12, 16, 24, 32, 33, 36, 46).
- **Design record:** `docs/design/learnings-root-cause-matrix.md` — RC7 and feature E7.
- **Ordering:** worked first, with `FID-2026-1012-023`, because every other lane's recurrence assertion
  is stated in the terms this record defines; a horizon that arrives last would invalidate each earlier
  closure.

## Lessons Learned

Written when the class stops recurring. The subject will be the difference between a record and a class:
this repository captured 36 failures of six unrelated mechanisms under one name, and could not tell that
the name had not appeared in 33 days.
