# FID: A fixed record's receipts prove the gates it chose, not the surfaces it touched

**Filename:** `FID-2026-1012-027-gate-coverage-of-a-fixed-records-surfaces.md`
**ID:** FID-2026-1012-027
**Severity:** high
**Status:** converged
**Created:** 2026-10-13 04:20
**Automation level:** 3
**YAGNI-Compliance:** Verified
**Master FID:** FID-2026-1012-022 (The failure-class remediation program)
**Depends On:** FID-2026-1012-021

---

## Summary

`fid:verify` runs the gates a record declares and stamps a receipt when they pass. Nothing checks
that the declared set **covers the surfaces the fix touched**, so a record can be stamped `fixed`
while an enforced gate over its own files is red. That happened on 2026-10-13: `FID-2026-1012-021`
stamped a receipt on three gates while `scripts/__tests__/experiences-coverage.test.ts` carried
`triggerType: 'tool-failure'` — a type error that the root `typecheck`'s 14th leg (the `scripts`
tree) rejects. The leg's declarable form already existed and was already registered as such
(`scripts/scripts-typecheck-check.ts`, paired with the root `typecheck` gate in
`scripts/gate-declarability-registry.ts`); the record simply did not declare it, and no check
noticed. The repository audits whether every **enforced gate** is *declarable*; it does not audit
whether a **record's declarations** are *sufficient*.

## Environment

- **OS:** Windows 11 (win32), Git Bash
- **Language/Runtime:** TypeScript 5.5.4, Bun 1.3.14
- **Tool Versions:** `bun run fid:verify <record> [--write|--check]`, `bun run validate:repository`
- **Commit/State:** `main` @ `3e0fab27`

## Detailed Description

### Problem

A receipt is evidence about the gates a record chose, and a record chooses its own gates. Two
consequences, both measured:

1. **A red enforced gate can coexist with a green receipt.** At `a827de8d`, `FID-2026-1012-021`'s
   receipt read 3/3 PASS while `bun run typecheck` (root, including `scripts/tsconfig.json`) exited
   2 on a file the record's own authorised write surface names.
2. **The omission is invisible to the repository gate.** `validate:repository` → `collectGateDeclarabilityIssues`
   proves the *vocabulary* admits every enforced gate; a record that omits a declarable gate is not a
   finding anywhere.

### Expected Behavior

A record that flips to `fixed` declares a gate set whose union covers every surface its fix touched:
the typecheck leg of each tree it edited, the scripts-tree leg when it edits `scripts/**`, and the
repo-wide quality gate. A missing declaration is a repository-gate failure named with the record, the
missing declaration and the surface that demands it — so the failure is fixed by declaring the gate or
by narrowing the write surface, never by adding prose.

### Root Cause

The declarability audit was built to make a gate *expressible* (`FID-2026-0823-009`) and it does that
well; it is a property of the gate. Coverage is a property of the **record** — a relation between a
declared gate set and a set of touched paths — and no artifact holds that relation. The gate set is
hand-written in the record's `## Verification Gates` block, the touched paths are hand-written in
`SCOPE.md`'s machine-readable scope-targets section, and nothing joins them.

### Evidence

```text
# 2026-10-13, FID-2026-1012-021 (a827de8d): the receipt's own gate list
$ sed -n '/## Verification Gates/,/^$/p' dev/fids/FID-2026-1012-021-recurrence-to-fix-loop.md
- gate: test scripts/__tests__/experiences-coverage.test.ts
- gate: probe scripts/experiences-recurrence.ts
- gate: quality
# ^ no scripts-tree typecheck leg, though the record edits scripts/**

$ bun run fid:verify dev/fids/FID-2026-1012-021-recurrence-to-fix-loop.md --write
[PASS] test scripts/__tests__/experiences-coverage.test.ts (exit 0)
[PASS] probe scripts/experiences-recurrence.ts (exit 0)
[PASS] quality (exit 0)
fid:verify: receipt stamped            # stamped while the leg below was RED

# the enforced leg, over the same tree, at the same state
$ bun run typecheck            # includes: tsc --noEmit -p scripts/tsconfig.json
scripts/__tests__/experiences-coverage.test.ts(29,5): error TS2820:
  Type '"tool-failure"' is not assignable to type '"tool_failure" | ...'
$ echo $?
2

# the declarable form already existed, and was already registered as the leg's
$ ls scripts/scripts-typecheck-check.ts && bun run scripts/scripts-typecheck-check.ts; echo $?
scripts-typecheck-check PASS — the scripts tree typechecks.
0
$ sed -n '106,112p' scripts/gate-declarability-registry.ts
      // The chain's 14th leg: `scripts` is not a bun workspace, so it has no
      // `typecheck <workspace>` form.
      probe('scripts/scripts-typecheck-check.ts'),

# and the surface that demanded it is already machine-readable
$ grep -n 'FID-2026-1012-021:' SCOPE.md
- FID-2026-1012-021: `scripts/experiences-coverage.ts`, `scripts/hygiene.ts`, …
```

## Impact Assessment

### Affected Components

- `scripts/fid-verify.ts` / `scripts/fid-receipt-stamp.ts` — where a receipt is produced
- `scripts/gate-declarability.ts` + `scripts/gate-declarability-registry.ts` — the existing audit this
  extends (or its sibling)
- `scripts/validate-repository.ts` — where the new check is surfaced
- `SCOPE.md` → machine-readable scope targets — the authoritative touched-surface list per record
- Every active `fixed` record's `## Verification Gates` block

### Risk Level

- [x] High: a receipt is the repository's evidence of a verified fix; a receipt that can omit a red
      gate over its own files weakens every `fixed` claim in the tree, not just this one.

## Proposed Solution

### Approach

Make coverage a checked relation, not a habit, and take the two inputs from surfaces that already
exist: the record's declarations (`## Verification Gates`) and its authorised write surface
(`SCOPE.md` → machine-readable scope targets). No new metadata, no prose parsing, no per-record
configuration.

**Options considered, with their trade-offs:**

| # | Option | What it costs | Why it is or is not recommended |
|---|---|---|---|
| A | **Surface → declaration coverage in `validate:repository`** (recommended): for each active `fixed` record, map its SCOPE path list to the enforced legs it implies and require each to be declared | one new collector + fixtures; a conservative mapping table (tree → leg) that starts small and grows by evidence | Directly produces the missing relation; the inputs are machine-readable today; the check is repo-wide, so it protects records nobody is currently reading. |
| B | `fid:verify` refuses a `--write` whose declared set omits the leg implied by the record's own touched paths | same mapping, enforced at stamp time (earlier feedback) | Complementary to A, but it needs A's mapping anyway; doing B first means every historical record fails at stamp time with no repo-wide view. Do B **after** A, reusing its collector. |
| C | Require a fixed record to declare the *whole* repo battery (`typecheck scripts` + every workspace + `quality`) | no mapping to maintain | Guarantees coverage by brute force, at a large cost per receipt (a full repo typecheck per record) and it makes the receipt uninformative about what the fix actually touched. Rejected. |
| D | Extend `gate-declarability-registry` with a per-record entry | an audit entry per record | Duplicates the record's own gate block into a second place that can drift; the registry is the right home for *gate* metadata, not for record decisions. Rejected. |
| E | Leave it to review discipline (do nothing) | nothing | This defect was produced by a plausible-sounding reason for an omission, so review is exactly the control that failed. Rejected. |

### Steps

1. Add `scripts/fid-surface-coverage.ts`: `collectRecordCoverageIssues(root)` reads `SCOPE.md`'s
   scope-targets section and each active `fixed` record's declared gates, applies the mapping, and
   returns issues naming the record, the missing declaration and the demanding surface.
2. Mapping v1 (conservative, documented, extensible): any path under `scripts/**` ⇒
   `probe scripts/scripts-typecheck-check.ts`; any path under a workspace whose
   `VALIDATION_WORKSPACE_POLICY.requiredTypecheck` is true ⇒ `typecheck <workspace>`; every record ⇒
   `quality`. A `fixed` record with no SCOPE entry is its own issue (the surface is unknown, so
   coverage cannot be claimed).
3. Wire it into `validate:repository` (as a new `FID-…`-named import beside the other collectors).
4. Fixture tests: a record whose surface names `scripts/**` without the probe fails; with it passes;
   a workspace surface without that workspace's typecheck fails; a record with no SCOPE entry fails;
   an unfixed record is not gated.
5. Only then (option B): make `fid:verify --write` refuse to stamp when the same collector reports a
   missing declaration for that record — reusing step 1's mapping so the two cannot disagree.

### Verification

Planned, not yet run: the collector fails on a fixture whose surface demands a declaration it does
not carry and passes on the repaired records (this one and `-011`/`-021`); `bun run
validate:repository` fails with a fixture record and passes on the real tree; and the repaired
`-021` declares the leg it was missing — proven by the leg being **red** when the type error is
reintroduced and **green** with it fixed, with the receipt re-stamped in between.

## Verification Gates

This record is **pre-implementation** (`Status: converged`, FID-2026-0915-004), so no gates are
declared and none are claimed as passing. Gates are added when the status flips to
`fixed`/`verified`, from the artifacts step 1 creates.

## Perfection Loop

### Loop 1 — RED (2026-10-13)

- **RED:** a receipt proves the gates a record *chose*; nothing proves the set covers the surfaces the
  fix touched. Measured: `-021`'s stamped receipt (3/3 PASS) coexisted with a red enforced
  `scripts`-tree typecheck over a file inside its own write surface, and the declarable form of that
  leg (`scripts/scripts-typecheck-check.ts`) already existed and was already registered as such.
- **GREEN:** make coverage a checked relation between the record's declarations and its SCOPE-path
  surface, enforced in `validate:repository`, with the mapping conservative and extensible by evidence.
- **AUDIT:** every figure above is a command over the real tree at `3e0fab27` (the record's own gate
  block, the stamped receipt, the failing typecheck and its exit code, the probe's existence and exit
  code, the declarability-registry entry, the SCOPE line).
- **ADVERSARIAL:** (a) *Is this the same defect as `-021`'s own missing gate?* No — that was one
  omission, corrected in `-011`/`-021`; this is the missing check that makes omissions visible.
  (b) *Would option A have caught it?* Yes, on both inputs: the record's surface names `scripts/**`
  and its declaration list lacks the probe. (c) *Does a coarse mapping produce false failures?* It
  can: a record touching `scripts/**` only in a comment would be asked for the leg. That is cheap to
  satisfy (one declaration) and always true of the tree, so the mapping stays conservative rather
  than clever. (d) *Can a record satisfy the check with a gate that proves nothing?* Yes — the check
  is about coverage, not about the gate's strength; strength stays the subject of the declared gate's
  own artifact.
- **CHANGE DELTA:** 0% implementation — this record is the design plus the measured incident; the
  immediate omissions in `-011` and `-021` were corrected in their own records in the same pass.

### Missed Questions

1. **Should the mapping come from `git diff` of the implementation commit instead of `SCOPE.md`?**
   Deriving it from the commit is stronger (it is the actual change), but it needs the commit to be a
   machine-readable field on the record and it fails on uncommitted work. `SCOPE.md` is authoritative,
   already structured, and available at gate time; a later revision can join both.
2. **Is `quality` really required of every record?** It is repo-wide, so a record whose change cannot
   affect quality still pays one run. Keep it in v1 (it is the repo's own repo-wide gate) and drop it
   per record only if its cost is measured to matter.
3. **What about a `fixed` record whose SCOPE line names no paths?** That is not a coverage question
   but a register-completeness one — `collectRegisterCompletenessIssues` already fails an active FID
   `SCOPE.md` does not name; the new collector treats a named-but-pathless entry as its own issue.

### Code Verification Evidence

> Pre-implementation record. Nothing here is implemented; what follows records what was CHECKED at
> `3e0fab27`.

- [x] `-021`'s declared gate block, its stamped receipt, and the failing root `typecheck` were all read
      at `a827de8d`/`3e0fab27` and are quoted verbatim above.
- [x] `scripts/scripts-typecheck-check.ts` exists, is the declarable `probe` form, exits 0, and is
      registered as the root `typecheck` gate's 14th-leg declaration
      (`scripts/gate-declarability-registry.ts:106-112`).
- [x] The scope-targets section of `SCOPE.md` carries a per-FID path list, so the demanded surface is
      machine-readable without new metadata.
- [x] **Not yet true, and deliberately not claimed:** the collector, its fixtures, its wiring and its
      receipt. Gates are declared when those artifacts exist.

## Boundaries

- This record makes no source change; the immediate omissions it documents were corrected inside
  `FID-2026-1012-011` and `FID-2026-1012-021` (their gate blocks and receipts), not here.
- The mapping is deliberately coarse in v1: it proves a leg is *declared*, never that the declaration
  is the strongest gate available for that surface.
- It does not re-open any closed record: coverage is checked going forward, and a record whose surface
  was already accepted keeps its receipt until the check lands.

## Resolution

**Not implemented — `Status: converged` (pre-implementation, FID-2026-0915-004).**

This record exists so the finding has an owner, a converged design and a register item with write
authority; it made no source change. The implementation pass rewrites this section in the closure
format and declares its gates.

- **Authorised write surface:** `SCOPE.md` → machine-readable scope targets → this record's line.
- **Design input:** `scripts/gate-declarability.ts` (the audited-gate guard this sits beside),
  `scripts/fid-verify.ts` (option B's enforcement point), `scripts/validate-repository.ts`.
- **Ordering:** consumes `FID-2026-1012-021`'s pass (the incident) and precedes any attempt to make
  `fid:verify --write` coverage-aware (step 5, option B).
