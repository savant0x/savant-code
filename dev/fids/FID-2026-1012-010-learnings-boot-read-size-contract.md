# FID: The boot read loads the entire lessons ledger with no size contract

**Filename:** `FID-2026-1012-010-learnings-boot-read-size-contract.md`
**ID:** FID-2026-1012-010
**Severity:** critical
**Status:** converged
**Created:** 2026-10-12 19:05
**Automation level:** 3
**YAGNI-Compliance:** Verified
**Master FID:** FID-2026-1012-022 (The failure-class remediation program)
**Depends On:** FID-2026-1012-011, FID-2026-1012-014

---

## Summary

`dev/LEARNINGS.md` is a **boot-read artifact**, not a notes file: the session-init contract
requires every session, in every mode, to read it 0-EOF before any non-read tool call, and the
harness blocks other tools until that read completes (`agents/savant/system-prompt.ts:117`).
The read boundary silently truncates anything past `READ_FILES_MAX_CHARS = 100_000`
(`common/src/constants/read-files.ts:18`). Measured today the ledger is 77,195 chars / 1,174
lines — 22,805 chars (23%) of headroom — and it has already crossed that boundary once:
`CHANGELOG.md:3464` records the file at 1,610 lines / 102,520 chars **truncating at boot**
before the FID-2026-0916-007 "Safe Core" restructure. Nothing measures the boot payload,
nothing asserts a bound, and one flat file serves the boot read, the Scribe's write surface,
the skills bridge and the feature pipeline alike (review §3 A1, A2).

## Environment

- **OS:** Windows 11 (win32), Git Bash
- **Language/Runtime:** TypeScript 5.5.4, Bun 1.3.14
- **Tool Versions:** `bun run learnings:check`; `bun run generate:protocol-bundle:check`
- **Commit/State:** `main` @ `14d48820`

## Detailed Description

### Problem

The boot ritual is a hard contract, and it reads one unbounded file. Three facts combine into
an unguarded failure mode:

1. The read is mandatory and blocking — `agents/savant/system-prompt.ts:117` names
   `dev/LEARNINGS.md` among the boot reads "in every mode", before any non-read tool call.
2. The read is capped by a boundary that **truncates rather than fails**
   (`read-files.ts:18`, `READ_FILES_MAX_CHARS = 100_000`). An over-long ledger therefore boots
   with the tail missing and no error anywhere.
3. The ledger's growth is one-way: 34 governed lessons were added between 2026-09-27 and
   2026-10-12. Every lesson an incident adds is paid for by every session thereafter.

The combination has already fired: the file was measured at 102,520 chars and was being
truncated at boot (`CHANGELOG.md:3464`). Today it sits at 23% of headroom with no instrument
watching the number.

### Expected Behavior

The boot read has a declared budget it cannot exceed, the audit record can grow without
silently degrading what the agent boots with, and a re-breach is announced rather than
discovered. Concretely: the artifact the session-init contract reads is a generated selection
that is asserted at or under the budget, while `dev/LEARNINGS.md` remains the append-only
source of truth, read on demand.

### Root Cause

One artifact serves two jobs with opposite cost profiles. An audit record wants completeness
and history; a boot-loaded context payload wants to be small, current and rule-shaped. With no
generated selection layer between them, the boot read *is* the ledger, so the only control on
the boot payload is the operator-run retirement tool (FID-2026-1012-011), which removes whole
entries — and nothing in the repository asserts a size for what is booted at all.

### Evidence

```text
$ wc -c < dev/LEARNINGS.md
77195
$ wc -l < dev/LEARNINGS.md
1174
$ grep -n 'READ_FILES_MAX_CHARS' common/src/constants/read-files.ts
18:export const READ_FILES_MAX_CHARS = 100_000

$ grep -n 'dev/LEARNINGS.md' agents/savant/system-prompt.ts
117: **Session init (FID-2026-0810-002):** your first actions on a fresh (or resumed)
     session are the boot reads, in every mode — read `${PLACEHOLDER.PROTOCOL_FILE}`
     0-EOF, plus `ARCHITECTURE.md`, `protocol.config.yaml`, and `dev/LEARNINGS.md`,
     before any non-read tool call. The harness blocks other tools and ungrounded
     final answers until the protocol read completes.

$ grep -n '1,610 lines / 102,520 chars' CHANGELOG.md
3464: - `dev/LEARNINGS.md` no longer truncates at boot: **1,610 lines / 102,520 chars

$ grep -n 'learnings:' protocol.config.yaml
49:  learnings: 'dev/LEARNINGS.md'

Headroom to the boundary: 100,000 - 77,195 = 22,805 chars (23%)
```

The 1,200-line ceiling and the 16,384-token recent-tail constraint the boot read presses
against are stated in `docs/design/Savant Self-Improving Architecture Plan.md:23,42,154`.

## Impact Assessment

### Affected Components

- `dev/LEARNINGS.md` — the boot-loaded artifact itself
- `agents/savant/system-prompt.ts` — the session-init contract that mandates the 0-EOF read
- `common/src/constants/read-files.ts` — the truncating boundary
- `protocol.config.yaml:49` — the knowledge-pipeline surface for the same file
- Every session in every mode, plus the other consumers that read the whole file: the Scribe
  write surface, the skills bridge and the feature pipeline (review §3 A2)

### Risk Level

- [x] Critical: the agent boots with silently missing guidance, and no gate can notice
- [ ] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Insert a generated selection layer between the audit record and the boot read, and assert its
size. The boot ritual keeps reading exactly one lessons file; that file becomes a **generated
boot digest** holding rules and guards — not incident narrative — with a size assertion
(feature F1). The measurement that prevents a silent re-breach is emitted as telemetry
(feature F5).

### Steps

1. Define the boot budget as a named constant with a test that pins it, so the number is a
   contract rather than a comment.
2. Generate the boot digest from `dev/LEARNINGS.md` (rules and guards only), asserted at or
   under the budget and byte-reproducible from the ledger — the same shape as the existing
   generated-protocol-bundle route, which already proves reproducibility by regenerating and
   comparing.
3. Point the session-init contract at the digest while `dev/LEARNINGS.md` stays the source of
   truth, read on demand through an index (title → line range) instead of 0-EOF.
4. Emit the boot payload's size as telemetry each session, so growth is visible before it
   breaches.
5. Gate the budget so it cannot regress, and fail the gate with the headroom and the command
   that restores it.

### Verification

How the fix will be confirmed, all of it at implementation time:

- A pin asserting the generated digest is at or under the budget and byte-reproducible from the
  ledger (regenerate twice, compare).
- A pin asserting the digest contains only rule/guard-shaped content, never incident narrative.
- A probe or pin that fails when the ledger exceeds the budget without a digest rebuild — the
  synthetic-over-budget case, so the guard is proven in both directions.
- The boot contract text and its test updated together, so the read the harness mandates and
  the read the test asserts cannot drift.

Exact artifact paths and their `- gate:` declarations are recorded when the artifacts exist.

## Verification Gates

This record is **pre-implementation** (`Status: converged`), so no gates are declared yet and
none are claimed as passing. Gates are declared in this section at implementation time, when
the artifacts exist — the contract requires `fixed`/`verified` records to carry them, and this
record deliberately does not pretend to a receipt it has not earned.

## Perfection Loop

### Loop 1 — RED (2026-10-12)

- **RED:** the boot read is mandated 0-EOF in every mode with no budget, no measurement and a
  boundary that truncates silently at 100,000 chars; the ledger is at 77,195 chars (23% of
  headroom) and was already truncating at boot at 102,520 chars, per `CHANGELOG.md:3464`.
- **GREEN:** generate a bounded boot digest (rules and guards) with an asserted size; keep the
  ledger as the append-only source read on demand via an index; emit the payload size as
  telemetry; gate the budget.
- **AUDIT:** every number above is reproduced from `wc -c`, `wc -l` and `grep -n` on the current
  tree; the two constants (`READ_FILES_MAX_CHARS`, the 1,200-line ceiling) are cited at their
  defining lines, and the truncation precedent is cited from the changelog entry that recorded
  it rather than restated from memory.
- **ADVERSARIAL:** (a) Does the digest hide a lesson the agent needs? It cannot hide a rule —
  the digest is generated from the rule-bearing fields, and the ledger remains fully
  reachable by index; what it drops is incident narrative, which no boot decision consumes.
  (b) Is a generated artifact another drift surface? It is the same shape as the existing
  protocol bundle, whose `:check` route already fails on drift; the digest inherits that
  pattern rather than inventing one. (c) Does this need FID-2026-1012-014 first? Partly — the
  digest must select on a tier that record introduces, so the ordering is recorded in the
  review (§5).
- **CHANGE DELTA:** n/a — pre-implementation record; no ledger content was edited by this pass.

### Missed Questions

1. Should the digest be a separate file or a generated section inside the ledger? → Separate
   file. A generated section inside the boot-read file would preserve the defect (the read
   still costs the whole file) and would make the ledger a partly-generated artifact with two
   writers.
2. What is the right budget? → Not decided here. The record's acceptance is that a budget
   exists, is pinned by a test, and is asserted against the generated artifact; the number
   itself is a separate, measurable decision once the tiered selection (FID-2026-1012-014)
   fixes what "rule-shaped" contains.
3. Does truncation ever degrade gracefully today? → No. The boundary truncates without a
   marker at the point of loss, so a truncated boot read is indistinguishable from a complete
   one; the boot contract asserts the read completed, not that it returned the whole file.

### Code Verification Evidence

> Pre-implementation record: `Status: converged` (FID-2026-0915-004). Nothing in this
> record has been implemented, so what follows records what was CHECKED at the cited
> `HEAD` — not what was built.

- [x] Every cited path exists at `main` @ `14d48820`, read directly at review time; the raw
      measurements live in `docs/design/learnings-boot-loading-and-lifecycle-review.md` §2/§3,
      which this record expands.
- [x] Measurements re-checked: `wc -c dev/LEARNINGS.md` → 77,195 chars and `wc -l` → 1,174
      lines (22,805 chars / 23% under the read boundary); `READ_FILES_MAX_CHARS = 100_000` at
      `common/src/constants/read-files.ts:18`; the boot-read contract at
      `agents/savant/system-prompt.ts:117`; the truncation precedent at `CHANGELOG.md:3464`
      (1,610 lines / 102,520 chars).
- [x] **Not yet true, and deliberately not claimed:** the repair itself, its gates and its
      receipt. Gates are declared when the status flips to `fixed`/`verified` and the
      artifacts exist; declaring them now would be a false declaration.

## Boundaries

- No boot read was executed under a live harness in this pass. The mechanism is cited from the
  session-init contract and the boundary constant; it is not observed in a running session.
- This record does not set the budget, does not design the digest format, and does not claim
  the ledger is over a limit today — it is inside both limits with 23% and 2% of headroom.
- Nothing in the ledger was edited. The sibling records that carry adjacent work are
  FID-2026-1012-011 (the unenforced ceiling), -012 (references stranded by retirement) and
  -014 (rule tiering, which this record's selection depends on).

## Resolution

**Not implemented — `Status: converged` (pre-implementation, FID-2026-0915-004).**

This record exists so the finding has an owner, a converged design and a register item with
write authority; it made no source change. The work described above is implemented by
whichever pass flips the record to `fixed`, at which point this section is rewritten in the
closure format (Closed Date / Fix Description / Tests Added / Verification Evidence /
Archived) and the declared gates are added under `## Verification Gates`.

- **Authorised write surface:** `SCOPE.md` → machine-readable scope targets → this record's
  line (registered 2026-10-12 with the review).
- **Design record:** `docs/design/learnings-boot-loading-and-lifecycle-review.md` §3 rows A1
  and A2, §4 features F1 and F5.
- **Ordering:** Consumes the boot tier defined by FID-2026-1012-014; consumes the ceiling that
  FID-2026-1012-011 makes enforceable; scopes what FID-2026-1012-016 needs to consolidate.
