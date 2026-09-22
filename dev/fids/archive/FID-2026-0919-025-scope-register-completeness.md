# FID: A register line for every tracked item — scope register-completeness check

**Filename:** `FID-2026-0919-025-scope-register-completeness.md`
**ID:** FID-2026-0919-025
**Severity:** high
**Status:** closed
**Created:** 2026-09-19 21:30
**Automation level:** 3
**YAGNI-Compliance:** Confirmed (no new capability or dependency: the check reuses
the existing `SCOPE.md` register grammar and the effective-date constant the
scope-disposition guard already publishes, and follows the established
`probe`-gate pattern for repo-gate checks)

---

## Summary

The operator asked for the quiet half of the scope guard: *"Add a
register-completeness check: flag approved items that appear in FIDs or session
summaries but never got a SCOPE.md line."*

FID-2026-0919-024 removed the *label* an agent used to trim scope — the
`[OUT-OF-SCOPE]`-family tokens now fail the repository gate and are blocked at
write time. It could not remove the quiet path: **an item with no line in
`SCOPE.md` is invisible in the register**, so it can be dropped with no operator
decision and with no forbidden token to grep for. Same failure (a Law 2 scope
reduction with no approval), nothing to detect.

This record closes that half with a decidable check in two legs:

1. **FID coverage** — every record in the active queue must be named in
   `SCOPE.md`. A FID is a work item by definition, so a FID the register has
   never heard of is unreachable policy.
2. **Task coverage** — every task cited by an active FID or a current session
   summary (`Task NN`, `TNN-X`) must exist in the register as a `## Task NN`
   section or a `TNN-X` item id.

Enforced as `scope.unregistered-item` in `validate:repository`, and as the
`scripts/scope-register-check.ts` probe so a record can prove it on its own
receipt. **The check ran against this record's own author before it was
registered** — the RED evidence below is real, not a fixture.

## Environment

- **OS:** Windows (win32), bash shell
- **Language/Runtime:** TypeScript (strict), Bun 1.3.14
- **Commit/State:** `main`; the 0.0.33 working tree; nothing committed (G2 withheld)

## Detailed Description

### Problem

An item that never reaches `SCOPE.md` is absent from the only surface the
operator audits. Nothing in the gate chain notices: the disposition guard sees no
token, the FID ledger validates metadata and dependencies, and the register
cannot report a line that was never written.

### Expected Behavior

Every tracked item is reachable from the register. A FID in the active queue has
a register line naming it; a task number or item id cited anywhere in the active
queue or in a current session summary exists in the register. Where the register
is silent, the gate fails and names the gap.

### Root Cause

The register was never checked for *coverage*, only for content. FID-2026-0919-024
made the disposition tokens mechanical; the omission itself had no authority.

### Evidence

- `SCOPE.md` grammar (the register's own lines): `## Task NN — …` headings and
  `- [x] **TNN-X. …**` items — 12 headings and 33 item ids registered at the time
  of writing.
- The gap class is real: before the fix, `dev/session-summaries/2026-09-19-0445-*`
  cites `T65-D` (registered), while several pre-window summaries cite `Task 51`
  and `Task 55` with no register section — the historical shape of the omission.
- Live RED evidence (this record's own author, before registration): the probe
  failed with **8 gaps** — the active FID `FID-2026-0919-025` unnamed in
  `SCOPE.md`, the record's own `Task 75` / `T75-A…E` citations unregistered, and
  two historical ids quoted in this Evidence section. Making the scan
  inline-code aware (the rule the disposition guard already applies) took those
  two quotations out: **8 → 4**. Writing the register line below took out the
  rest: **4 → 0**. Every step ran on the real tree, not a fixture.

## Impact Assessment

### Affected Components

- **New authority:** `packages/agent-runtime/src/echo/scope-register-completeness.ts`
  (`collectRegisteredTasks`, `scanUnregisteredTaskReferences`,
  `collectRegisterCompletenessIssues`).
- **Wiring:** `scripts/validate-repository.ts` (`validateRegisterCompleteness` →
  `scope.unregistered-item`); new `scripts/scope-register-check.ts` probe.
- **Register:** `SCOPE.md` gains this record's own register line.

### Risk Level

**High.** A dropped item leaves no trace to review; the register is the operator's
only complete view of approved work.

## Proposed Solution

### Approach

Make coverage decidable rather than encouraged, using the register's own grammar,
and reuse the effective date the disposition guard already defines so both halves
of the scope guard agree on what counts as history.

### Steps

1. [x] `implemented` — `collectRegisteredTasks`: parse `## Task NN` headings and
   `**TNN-X.` item ids; an item id is itself a register line for its task.
2. [x] `implemented` — `scanUnregisteredTaskReferences`: line-level scan for
   `Task NN` and `TNN-X`; a reference is satisfied by the task number or the item
   id; lookalike identifiers (`UTF-8`, `GPT-4`, `HTTP-2`) are not references.
3. [x] `implemented` — L1 in `collectRegisterCompletenessIssues`: every active
   `dev/fids/FID-*.md` must be named in `SCOPE.md`, reported at its `**ID:**` line.
   The ledger and the archive are deliberately out of the active queue.
4. [x] `implemented` — windowed narrative: session summaries dated on/after
   `SCOPE_GUARD_EFFECTIVE_DATE` (2026-09-19) are scanned; earlier records are
   history and are not rewritten.
5. [x] `implemented` — wired as `scope.unregistered-item` in
   `validate:repository`, plus the standalone `scripts/scope-register-check.ts`
   probe (exit 0/1), matching the `audit-gate-env-parity.ts` /
   `scope-guard-check.ts` pattern.
6. [x] `implemented` — the register line this record needs, written because the
   check demanded it (Task 75, T75-A…E).

### Verification

- The new suite: 15 pins, 24 expectations, 0 fail.
- Live RED → GREEN on the real tree: probe FAIL (2 gaps, both this record's) →
  register line written → probe PASS (0 issues).
- `validate:repository` PASS; `fid:verify --check` PASS; full battery green
  (recorded in the Resolution).

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: test packages/agent-runtime/src/echo/__tests__/scope-register-completeness.test.ts
- gate: test packages/agent-runtime/src/echo/__tests__/scope-disposition-guard.test.ts
- gate: probe scripts/scope-register-check.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:dd7cd79fa597c7667b4fd53fd5e10df4e30cc790daf95a79e82d6271df1f847a
- verified: 2026-09-19T20:14:28.892Z
- typecheck packages/agent-runtime: exit 0
- test packages/agent-runtime/src/echo/__tests__/scope-register-completeness.test.ts: exit 0
- test packages/agent-runtime/src/echo/__tests__/scope-disposition-guard.test.ts: exit 0
- probe scripts/scope-register-check.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** The operator's request was taken as the specification of what the
  existing guard cannot see. Reading FID-2026-0919-024's authority module showed
  the boundary precisely: it detects the token, and an omission writes no token.
  The failure mode was then reproduced on the real tree — the check was pointed at
  the repo while this record was unregistered and reported both gaps.
- **GREEN:** Two decidable legs, one register grammar, one shared effective date.
  Nothing new was invented: the register already had the grammar, and the probe
  pattern already existed for repo-gate checks.

### Missed Questions

- *Should the check cover archived FIDs?* — No. Archived records are history whose
  register sections may legitimately have been drained; only the active queue is
  a claim on current scope.
- *Should a FID be required to cite a task number?* — No. The register line is
  what makes an item visible; requiring a citation style as well would gate on
  prose formatting rather than on coverage.
- *Can this be a write-time block?* — No, and it should not be. A new FID is
  created and registered in two writes; blocking the first would deadlock
  registration, which is the Law 3 deadlock class already recorded for the docs
  gate (FID-2026-0917-002). The repository gate and the probe are the right
  surfaces.
- *What about a session that files neither a FID nor a task reference?* — Not
  decidable from text: there is nothing to match. Recorded as the boundary of
  this check rather than papered over; the register discipline is what covers it,
  and the disposition guard's measured-history practice shows the honest answer
  is to state the limit.
- *Can a record dodge the check by backticking every citation?* — Yes, and that
  is the same escape valve the disposition guard has, for the same reason: a
  quoted id must be sayable (this record quotes two historical ones). The rule
  the protocol states is the obligation; the scan is the mechanism for the bare
  claim, and backticking a live citation to hide it is a Law 2 violation whether
  or not the gate sees it.
- *Does the ledger (`dev/fids/README.md`) belong in the scan?* — No. It is
  narrative history whose entries are dated to their own closure; scanning it
  would flag drained historical tasks and train the operator to ignore the gate.

### Implementation Evidence (REQUIRED for `closed`)

- `packages/agent-runtime/src/echo/scope-register-completeness.ts` — the authority
  (`collectRegisteredTasks`, `scanUnregisteredTaskReferences`,
  `collectRegisterCompletenessIssues`).
- `scripts/validate-repository.ts` — `validateRegisterCompleteness()` and the
  `scope.unregistered-item` code in the issues array.
- `packages/agent-runtime/src/echo/scope-disposition-guard.ts` —
  `withoutInlineCode` exported and shared (the quotation-vs-claim rule), so both
  halves of the scope guard apply one rule rather than two.
- `scripts/scope-register-check.ts` — the runnable probe.
- `dev/echo-v0.1.2-single-agent.md` — Scope Boundary carries the register-line
  requirement ("Every tracked item has a register line").
- `SCOPE.md` — Task 75 section naming this FID (the register line).

### Code Verification Evidence

- `packages/agent-runtime/src/echo/__tests__/scope-register-completeness.test.ts`
  — 15 pins: register-grammar extraction, item-id-implies-task, an unregistered
  task reference, an unregistered item reference, a registered number covering
  its items, mixed known/unknown on one line, the quotation-vs-claim rule,
  lookalike-identifier precision, an unnamed active FID, a named FID, ledger +
  archive exclusion, the pre-window summary exclusion, a windowed summary hit, a
  missing register, and the live repository leg.
- Regression: the disposition guard suite (10 pins) still green, since the
  register-completeness authority imports its effective-date constant.

### Loop 2 — Independent audit and self-correction

- **AUDIT finding (self-corrected):** the first run of the new suite failed one
  pin — the diagnostic line expectation (`5`) was wrong; the implementation
  reports the `**ID:**` line (`3`). Running the suite is what exposed it; the
  expectation was corrected, not the implementation.
- **AUDIT finding (self-corrected):** the suite imported `node:fs` twice (named
  plus default), which the repo lints as a duplicate import; merged into one
  import before the gates.
- **AUDIT finding (live, and the point of the record):** pointed at the real
  repository while this FID existed but was unregistered, the check reported the
  gap in its own author. The register line was then written, making the RED → GREEN
  transition a real event on the real tree rather than a fixture.
- **AUDIT finding (design, from the live RED run):** the first scan flagged this
  record's *quotations* of historical task ids alongside its real claims. Exempting
  by location would have opened a hole; applying the disposition guard's existing
  rule — a reference in inline code is a quotation, a bare one is the claim — was
  the consistent answer, and `withoutInlineCode` is now shared by both halves
  rather than duplicated. The residual escape (a fully backticked citation) is
  recorded as a boundary below.
- **AUDIT finding (usability):** the L1 diagnostic initially reported line 1; it
  now reports the record's `**ID:**` line so the message lands on the metadata
  that must be matched.

### Loop 3 — Final convergence

- All declared gates re-run live after the final edit; the receipt is stamped from
  that run. Each iteration removed a measured defect and none was reintroduced.

## Resolution

- **Closed Date:** 2026-09-19 23:40 UTC (closed with the commit SHA pending
  operator git execution, G2 withheld; file:line + grep evidence recorded
  instead, per the FID Lifecycle rule for `closed`)
- **Fix Description:** Register coverage is decidable and enforced. Two legs from
  one authority (`packages/agent-runtime/src/echo/scope-register-completeness.ts`):
  every active `dev/fids/FID-*.md` must be named in `SCOPE.md` (reported at its
  `**ID:**` line), and every task cited by an active FID or a current session
  summary must exist there as a `## Task NN` section or a `TNN-X` item. Enforced as
  `scope.unregistered-item` in `validate:repository` and as the standalone
  `scripts/scope-register-check.ts` probe. A reference in inline code is a
  quotation and a bare one is the claim — the rule the disposition guard already
  applied, now shared through one exported helper rather than restated. The
  requirement is stated in the protocol's Scope Boundary and the register
  preamble. Not a write-time block by design: a FID is created and registered in
  two writes, so blocking the first is the FID-2026-0917-002 deadlock class.
- **Tests Added:** Yes — 15 pins in
  `packages/agent-runtime/src/echo/__tests__/scope-register-completeness.test.ts`
  (register-grammar extraction, item-id-implies-task, unregistered task and item
  references, a registered number covering its items, mixed known/unknown on one
  line, the quotation-vs-claim rule, lookalike-identifier precision, unnamed vs
  named active FID, ledger + archive exclusion, the pre-window summary exclusion,
  a windowed summary hit, a missing register, and the live repository leg). The
  disposition guard suite (10 pins) stays green, since the shared effective-date
  constant and helper are reused rather than duplicated.
- **Verification Evidence:** receipt below (five gates, live). Live RED → GREEN on
  the real tree: **8 gaps in this record's own author** → 4 after the inline-code
  rule → 0 after the register line the check demanded. `validate:repository` PASS;
  both scope probes PASS; `bun run test` exit 0 / 0 fail across 12/12 workspaces.
- **Archived:** 2026-09-19 23:40 UTC — moved to `dev/fids/archive/`; receipt
  re-stamped live at the archived path (5/5 gates)

## Lessons Learned

- **Removing a mechanism is half the work; the omission it permitted is the other
  half.** FID-2026-0919-024 made the label mechanical, which made the silence the
  remaining path — and silence is the harder half, because the failure produces no
  artifact to detect.
- **Coverage is decidable when the target has a grammar.** The register's
  `## Task NN` sections and `TNN-X` items are enough to decide whether a cited item
  exists, with no model judgment involved.
- **A check earns trust by catching its author first.** The live RED run against
  this record's own unregistered state is stronger evidence than any fixture: the
  gate fired on the person who wrote it.
- **Do not scan the narrative you have already annotated.** Windowed scanning of
  session summaries keeps historical records honest without rewriting them — the
  same rule the disposition guard already applies, which is why the two halves
  share one effective date.
