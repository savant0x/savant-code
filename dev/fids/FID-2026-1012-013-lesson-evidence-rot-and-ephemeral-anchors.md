# FID: Lesson evidence rots silently and reproduction points at ephemeral paths

**Filename:** `FID-2026-1012-013-lesson-evidence-rot-and-ephemeral-anchors.md`
**ID:** FID-2026-1012-013
**Severity:** high
**Status:** converged
**Created:** 2026-10-12 19:05
**Automation level:** 3
**YAGNI-Compliance:** Verified

---

## Summary

The ledger carries two kinds of reference with one validation tier between them. `**Evidence:**`
items are resolved by `scripts/learnings-references.ts` — the path must be a file inside the repo
and the target token must appear **exactly once** — while `**Verification:**` is free prose that
nothing checks. That single tier fails in both directions: reproduction claims are unverified, so
two lessons still pin their reproduction to `dev/scratchpad/active/*.ts` probes that the managed
scratchpad now expires after 24 idle hours (FID-2026-1012-006); and a *structural* claim must
resolve exactly once **today**, so an ordinary module split reds a lesson describing last month's
code. Separately, the 3 entries below the legacy boundary are permanently unvalidated and
un-promotable. This record splits the tiers and pins each leg (review §3 D2, D3, D4; feature F4).

## Environment

- **OS:** Windows 11 (win32), Git Bash
- **Language/Runtime:** TypeScript 5.5.4, Bun 1.3.14
- **Tool Versions:** repo scripts as of `main` @ `14d48820`
- **Commit/State:** `main` @ `14d48820`

## Detailed Description

### Problem

Evidence that cannot rot and evidence that has rotted look identical in the ledger, because
neither is checked.

- **Reproduction references are unvalidated.** `**Verification:**` is prose. Two lessons point
  at ephemeral probes: `dev/LEARNINGS.md:453` says
  ``bun run dev/scratchpad/active/cache-prefix-ratio-measure.ts`` reproduces the step-10 table,
  and `dev/LEARNINGS.md:648` records that
  `dev/scratchpad/active/step3-truncation-audit.ts` drove the shipped truncation functions over
  their payload shapes. The scratchpad is now managed temporary storage that expires idle files
  after 24 hours by design (FID-2026-1012-006, closed 2026-10-12), so those pointers are dead by
  construction rather than by accident — and nothing reported it.
- **Structural references are over-coupled to the live tree.** A `path → symbol` entry must
  resolve to exactly one match *now*. A module split, extraction or rename is an ordinary
  refactor that reds a historical entry whose subject was last month's code, so the ledger's
  history has to be defended against changes it is not about.
- **The legacy tail is outside every tier.** `structuredBlocks` in `scripts/learnings-schema.ts`
  stops at the legacy boundary, so the 3 entries below it are never parsed, never validated and
  never eligible for promotion; they carry scopes the schema does not accept
  (`cli, performance`, `cli, TUI`, `harness, skills`), and `lessons:features` reads them as
  `historical`.

### Expected Behavior

A reference says which kind of claim it is. A **structural** reference is resolved against the
tree and pinned. A **reproduction** reference is resolved for durability: an ephemeral path is
rejected outright and must be replaced by a committed probe or a reproducible command, so a
reader can always re-measure what the lesson claims to have measured. A historical entry may
pin an `as-of` commit so a later refactor degrades it to a warning instead of reding it. Every
entry in the file belongs to a tier — including the legacy tail, whose disposition is decided
and recorded rather than left implicit.

### Root Cause

One validation tier serves two kinds of reference. `resolves()` answers "does this token exist
exactly once in this file right now", which is the right question for a structural claim and the
wrong question for a reproduction claim and for any claim about history. Because the
reproduction kind is not modelled at all, it is not merely loosely checked — it is unchecked.

### Evidence

```text
# what is resolved: **Evidence:** only, existence + uniqueness + line range
$ sed -n '/export function validateStableReferences/,/^}/p' scripts/learnings-references.ts
  for (const entry of entries)
    for (const reference of entry.evidence) {
      if (!resolves(root, reference)) issues.push({ code: 'learning.evidence.unresolved', ... })
      if (reference.line !== undefined) { ... line range check ... }
    }
# resolves(): the path must be a file inside the repo, and
#   targetCount(content, reference) === 1     ← exactly once, TODAY

# reproduction pinned to a surface that expires by design
$ grep -n 'dev/scratchpad' dev/LEARNINGS.md
453:  text; `bun run dev/scratchpad/active/cache-prefix-ratio-measure.ts` reproduces the
648:- **Verification:** `dev/scratchpad/active/step3-truncation-audit.ts` drove the

# the tier boundary
$ sed -n '/export function structuredBlocks/,/^}/p' scripts/learnings-schema.ts
  const boundary = content.indexOf(LEGACY_BOUNDARY)
  const governed = boundary < 0 ? content : content.slice(0, boundary)   ← tail is invisible
$ grep -h '^- \*\*Scope:\*\*' dev/LEARNINGS.md | sort | uniq -c
      1 - **Scope:** cli, performance
      1 - **Scope:** cli, TUI
      1 - **Scope:** harness, skills
     34 - **Scope:** internal
```

## Impact Assessment

### Affected Components

- `dev/LEARNINGS.md` (the two ephemeral reproduction pointers; the 3 legacy entries)
- `scripts/learnings-references.ts` (`resolves`, `validateStableReferences`)
- `scripts/learnings-schema.ts` (`structuredBlocks`, `LEGACY_BOUNDARY`, the scope enum)
- `scripts/lessons-to-skills.ts` and `scripts/lesson-feature-pipeline.ts` (readers of the tail)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

The ledger's whole purpose is that a claim can be re-checked later. Two entries now assert a
re-measurement that cannot be performed, and nothing distinguishes them from the 32 that can —
which is worse than a red gate, because it reads as verified.

## Proposed Solution

### Approach

Model the two reference kinds explicitly and give each the validation it deserves, then decide
the legacy tail's disposition instead of letting it sit outside every tier.

### Steps

1. Classify references in the schema as **structural** (`path → symbol|heading|test`, resolved
   live and pinned) or **reproduction** (how a claim was measured). The schema already carries
   the kinds; the change is to say which validation a reference takes.
2. Reject ephemeral roots in reproduction references — `dev/scratchpad/**`, temporary
   directories, gitignored paths — and require either a committed probe under `scripts/` or an
   exact reproducible command, so a reader can re-measure the claim from the entry alone.
3. Allow a historical entry to pin an `as-of` commit for its structural references, so a moved
   symbol degrades the entry to a warning naming the move instead of reding history.
4. Decide the legacy tail's disposition — validate the 3 entries (giving them schema scopes) or
   retire them move-only to `dev/LEARNINGS-RETIRED.md` — and record which was chosen and why,
   so the tail stops being neither.
5. Pin each leg: an ephemeral reproduction reference fails; a committed probe passes; a moved
   symbol on an `as-of` entry warns; the tail's disposition is asserted by a test rather than
   described in prose.

### Verification

- A pin asserts a reproduction reference to `dev/scratchpad/**` (or another ephemeral root)
  fails with a message naming the path, and that a committed `scripts/` probe passes.
- A pin asserts a structural reference whose symbol no longer exists on an `as-of` entry
  produces a warning, not a failure, and that a live entry with a missing symbol still fails.
- A pin asserts the legacy tail's recorded disposition: either its 3 entries parse under the
  schema, or the tail is gone from the live file and present in the archive.
- `bun run learnings:check` and `validate:repository` stay green over the repaired ledger, and
  the two entries at `dev/LEARNINGS.md:453,648` cite a durable anchor.
- Test artifacts (paths and gates) are named when this record's repair lands.

## Verification Gates

This record is **pre-implementation** (`converged`, per FID-2026-0915-004), so it declares **no
gates**: the artifacts its steps create do not exist yet, and a gate that cannot execute is a
false declaration. Gates are declared here when the implementation lands and the status flips to
`fixed`/`verified` — at which point `quality` is mandatory and each promised test path above
becomes a `- gate: test <path>` bullet. `fid:verify --check` reports this record as outside the
verification contract, by design.

## Perfection Loop

### Loop 1 — RED (2026-10-12)

- **RED:** `**Verification:**` prose is validated by nothing, and two lessons pin reproduction to
  `dev/scratchpad/active/*.ts` (`dev/LEARNINGS.md:453,648`) on a surface that expires idle files
  after 24 hours (FID-2026-1012-006); a structural reference must resolve exactly once today, so
  a refactor reds history; the 3 entries below the legacy boundary are unvalidated and
  un-promotable.
- **GREEN:** reference kinds modelled separately; ephemeral roots rejected in reproduction
  references with a committed probe or command required; `as-of` commits allowed for historical
  structural references; the legacy tail's disposition decided and pinned.
- **AUDIT:** the validator's scope was read from `validateStableReferences` and `resolves`
  (existence, exactly-once, line range) rather than assumed; both ephemeral pointers were read
  from the ledger at the cited lines; the tail's invisibility was read from `structuredBlocks`
  and confirmed against the ledger's scope census.
- **ADVERSARIAL:** (a) Does rejecting ephemeral paths break entries that legitimately cite a
  temporary measurement? It *names* them for repair, which is the point — an unrepeatable
  measurement cannot be checked by the next reader. (b) Does `as-of` let a stale claim hide as
  history? The entry must still state the commit and the pin asserts the warning path, so the
  reference is visibly historical rather than silently valid. (c) Is the tail a real defect or
  archaeology? It is 3 of 37 entries, permanently outside validation and promotion while
  consumers still read them as `historical`, so leaving it undecided is the defect.
- **CHANGE DELTA:** ~0%. This record adds a FID and no code; the reviewed artifacts are
  untouched.

### Missed Questions

1. Should the `Verification` field be structured rather than prose? → Yes, and that is
   effectively what step 1 does: a reproduction reference acquires the same
   `path → kind:target` shape the evidence field already has, which is what makes it checkable.
2. Could the fix silently delete the two historical pointers? → No. They are repaired to a
   durable anchor or explicitly reported as unrepairable; deletion of ledger content is
   retirement's exclusive, move-only path (`FID-2026-1012-011`).
3. Does this overlap `FID-2026-1012-016` (redundant families)? → No, they are complementary:
   016 removes duplicated invariants from the boot read, this record makes each surviving claim
   re-measurable. Consolidation without reference integrity would move rot rather than remove it.
4. Does the `as-of` mechanism conflict with `learnings:check`'s existing green state? → No. Only
   historical entries may use it, and the pins assert the live path still fails on a missing
   symbol, so the strictness that exists today is preserved where it belongs.

### Code Verification Evidence

> Pre-implementation record: `Status: converged` (FID-2026-0915-004). Nothing in this
> record has been implemented, so what follows records what was CHECKED at the cited
> `HEAD` — not what was built.

- [x] Every cited path exists at `main` @ `14d48820`, read directly at review time; the raw
      measurements live in `docs/design/learnings-boot-loading-and-lifecycle-review.md` §2/§3,
      which this record expands.
- [x] Measurements re-checked: the two ephemeral anchors at `dev/LEARNINGS.md:453` and `:648`
      read directly; `validateStableReferences`/`resolves` in `scripts/learnings-references.ts`
      (existence, exactly-once, line range — `**Evidence:**` only); the 3 legacy entries below
      the boundary via `structuredBlocks` in `scripts/learnings-schema.ts`; the 24-hour
      scratchpad expiry from FID-2026-1012-006.
- [x] **Not yet true, and deliberately not claimed:** the repair itself, its gates and its
      receipt. Gates are declared when the status flips to `fixed`/`verified` and the
      artifacts exist; declaring them now would be a false declaration.

## Boundaries

- No ephemeral path is currently reding a gate: `Verification` prose is unchecked, and that is
  the defect rather than evidence of damage. Nothing in this record claims a failing gate today.
- This record does not repair the ledger, relocate the two pointers, or decide the tail — it
  owns the schema and validation change that makes those repairs checkable.
- It makes no claim about the boot-read budget (`FID-2026-1012-010`) or the size ceiling
  (`FID-2026-1012-011`), and it does not change the retirement mechanism
  (`FID-2026-1012-012`), whose index it assumes.

## Resolution

**Not implemented — `Status: converged` (pre-implementation, FID-2026-0915-004).**

This record exists so the finding has an owner, a converged design and a register item with
write authority; it made no source change. The work described above is implemented by
whichever pass flips the record to `fixed`, at which point this section is rewritten in the
closure format (Closed Date / Fix Description / Tests Added / Verification Evidence /
Archived) and the declared gates are added under `## Verification Gates`.

- **Authorised write surface:** `SCOPE.md` → machine-readable scope targets → this record's
  line (registered 2026-10-12 with the review).
- **Design record:** `docs/design/learnings-boot-loading-and-lifecycle-review.md` §3 rows D2, D3 and D4,
  §4 feature F4.
- **Ordering:** Depends on FID-2026-1012-011's retirement record for the `as-of` history
  rule; shares the ledger schema changes with FID-2026-1012-014.
