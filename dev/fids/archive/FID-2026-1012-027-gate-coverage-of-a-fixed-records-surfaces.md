# FID: A fixed record's receipts prove the gates it chose, not the surfaces it touched

**Filename:** `FID-2026-1012-027-gate-coverage-of-a-fixed-records-surfaces.md`
**ID:** FID-2026-1012-027
**Severity:** high
**Status:** closed
**Created:** 2026-10-13 04:20
**Closed:** 2026-10-13
**Commit:** 5144615bcb674c7dab1e8e92b46c5b4e1b020a39
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

1. **implemented** — `scripts/fid-surface-coverage.ts`: `collectRecordCoverageIssues(root)` reads
   `SCOPE.md`'s scope-targets section (through the same parser the Law 2 write gate uses) and each
   active `fixed`/`verified` record's declared gates (through the same parser `fid:verify` uses),
   applies the mapping, and returns issues naming the record, the missing declaration and the
   demanding surface.
2. **implemented** — mapping v1 as designed: any path under `scripts/**` ⇒
   `probe scripts/scripts-typecheck-check.ts`; any path under a workspace whose
   `VALIDATION_WORKSPACE_POLICY.requiredTypecheck` is true ⇒ `typecheck <workspace>`; every record
   with a known surface ⇒ `quality`. A record with no SCOPE entry, or a line naming no paths, is
   its own issue (the surface is unknown, so coverage cannot be claimed).
3. **implemented** — wired into `validate:repository`'s collector array.
4. **implemented** — `scripts/__tests__/fid-surface-coverage.test.ts`: 13 pins over temp roots
   (scripts surface without/with the probe, workspace legs, package-root resolution, unregistered,
   pathless, pre-implementation record not gated, section absent ⇒ inert, and the option-B refusal).
5. **implemented (option B)** — `fid:verify --write` refuses to stamp when
   `coverageStampBlockers(root, recordName)` reports an uncovered declaration, reusing step 1's
   collector so the stamp and the repo gate cannot disagree. Only active enforced records are
   enumerated, so an archived or pre-implementation record is never blocked.

### Verification

Run, all measured on the implementation tree:

- The collector **fails on a fixture** whose surface demands a declaration it does not carry
  (`fid.coverage.missing-gate`, naming the record, the demanding glob and the declaration) and
  **passes** once the declaration is added (13/13 fixture pins).
- The collector **fails on the real tree** with one line removed from `-018`'s gate block, and
  prints **0 issues** with it restored — the same record, same tree, both directions.
- It found **two real omissions** this record was written to make visible:
  `-018` (surface `common/src/tools/params/tool/**`, no `typecheck common`) and `-020` (surface
  `sdk/src/run/**`, no `typecheck sdk`). Both declared the leg and re-stamped their receipts
  (all gates green).
- Option B refuses a `--write` on the same mutated `-018` before running any gate, and stamps the
  clean record normally.
- The Law 2 parser move is behavior-preserving: `law2-scope-gate.test.ts` 16/16 green, and the
  shared module adds `sectionPresent` so a coverage consumer can tell "no section" from "no item".

## Verification Gates

- gate: test scripts/__tests__/fid-surface-coverage.test.ts
- gate: test packages/agent-runtime/src/echo/__tests__/scope-targets.test.ts
- gate: test packages/agent-runtime/src/echo/__tests__/law2-scope-gate.test.ts
- gate: probe scripts/scripts-typecheck-check.ts
- gate: typecheck packages/agent-runtime
- gate: quality

### Verification Receipt

- fingerprint: sha256:2278b87dc6c0dd2de098b10fc5eb028b2c8551433b7fcf28b57317dfd45a1517
- verified: 2026-10-13T06:15:52.598Z
- test scripts/__tests__/fid-surface-coverage.test.ts: exit 0
- test packages/agent-runtime/src/echo/__tests__/scope-targets.test.ts: exit 0
- test packages/agent-runtime/src/echo/__tests__/law2-scope-gate.test.ts: exit 0
- probe scripts/scripts-typecheck-check.ts: exit 0
- typecheck packages/agent-runtime: exit 0
- quality: exit 0

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

### Loop 2 — Independent audit and self-correction (2026-10-13)

- **RED:** the first wiring attempt failed its own subject: adding the collector to
  `scripts/validate-repository.ts` pushed the file to 305 lines and the `quality` gate (absolute
  maximum 300) went red — an under-declared surface, caught by a gate the change itself had to keep
  green.
- **GREEN:** the wiring was reduced to the import plus one array entry and two redundant blank
  separators were dropped; the file is 299 lines and `quality:report` PASSes.
- **AUDIT:** the collector run on the real tree printed exactly **two** findings, both real and both
  the class this record names (`-018` missing `typecheck common`, `-020` missing `typecheck sdk`);
  after declaring the legs and re-stamping, the collector prints **0 issues** and both receipts are
  green. The negative direction was then re-proven on the real tree by removing the line and
  restoring it byte-for-byte.
- **ADVERSARIAL:** (a) *Does the parser move risk the write gate?* `law2-scope-gate.test.ts` is
  16/16 green and the module gained `sectionPresent` rather than changing any parse rule. (b) *Is the
  option-B refusal circular?* No: it enumerates only active enforced records, so archived and
  pre-implementation records are never blocked. (c) *Could the audit be satisfied by declaring a gate
  the record does not need?* Yes — coverage is a lower bound on the declared set, never a strength
  measure; that limit is stated in Boundaries. (d) *Does the check rest on a second parser that can
  drift?* No: both inputs come from the authorities that already own them (`parseVerificationGates`,
  `gateLabel`, `loadScopeTargetsByItem`).
- **CHANGE DELTA:** ~30% of this record's text (Steps marked implemented, Verification rewritten with
  measured results, Loop 2, evidence, Boundaries, Resolution).

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
4. **What if the collector's own wiring must fit inside a file already at its ceiling?** Measured
   during implementation: `scripts/validate-repository.ts` sits at the 300-line absolute ceiling, so
   wiring the audit cost two lines the file did not have. The fix was to keep the wiring minimal (an
   import and one array entry) and drop two redundant blank separators — not to relax the ceiling, and
   not to move the check out of the repository gate.

### Code Verification Evidence

- [x] `-021`'s declared gate block, its stamped receipt, and the failing root `typecheck` were read at
      `a827de8d`/`3e0fab27` and are quoted verbatim above.
- [x] `scripts/scripts-typecheck-check.ts` exists, is the declarable `probe` form, exits 0, and is
      registered as the root `typecheck` gate's 14th-leg declaration
      (`scripts/gate-declarability-registry.ts:106-112`).
- [x] `scripts/fid-surface-coverage.ts` implements `collectRecordCoverageIssues` (the collector) and
      `scripts/validate-repository.ts` calls it inside its collector array; `scripts/fid-verify.ts`
      holds `coverageStampBlockers`, called from `main()` before any gate runs (option B).
- [x] `packages/agent-runtime/src/echo/scope-targets.ts` is the ONE parser (`loadScopeTargetsByItem`
      + `loadScopeArtifact`), re-exported from `pre-write-gates-law2.ts` so existing importers are
      unchanged; `scope-targets.test.ts` pins both shapes and the `sectionPresent` flag.
- [x] Root `typecheck` (14 legs) exit 0; `scripts`-tree typecheck exit 0; the collector prints 0
      issues on the real tree; `quality:report` PASS; receipt stamped below with every gate exit 0.

## Boundaries

- The mapping is deliberately coarse in v1: it proves a leg is *declared*, never that the declaration
  is the strongest gate available for that surface — a record can satisfy it with a gate that proves
  little. Strength remains the subject of the declared gate's own artifact.
- Only active `fixed`/`verified` records are covered; `converged` records are pre-implementation and
  declare no gates by construction.
- A missing register, or a register without the machine-readable section, is inert here: that is
  `scope.unregistered-item`'s question (FID-2026-0919-025), and reporting it once per record would turn
  one register fix into N findings.
- The collector reads the register line-oriented, exactly as the Law 2 write gate does, so an item
  line under any heading parses. Fencing it to the section would change the write gate's authority and
  is explicitly not done (`scope-targets.test.ts` pins the line-oriented behaviour).
- It does not re-open any closed record: archived records are outside the enforced status set, and
  coverage is checked going forward.

### Implementation Evidence

- [x] **Commit SHA:** `5144615b` — implementation, tests, wiring and this record's closure edits
- [x] **File:line ranges:** `scripts/fid-surface-coverage.ts` (collector), `scripts/fid-verify.ts`
      (`coverageStampBlockers` + `main()` call), `scripts/validate-repository.ts` (collector array),
      `packages/agent-runtime/src/echo/scope-targets.ts` (shared parser)
- [x] **Gate output:** the receipt below — every declared gate exit 0
- [x] **Reproducibility:** `grep -rn "fid-surface-coverage" --include=*.ts` finds the module, its test,
      its wiring and the `fid:verify` caller
- [x] **Step statuses:** steps 1-5 `implemented`

## Resolution

**Implemented; closed 2026-10-13 at `5144615bcb674c7dab1e8e92b46c5b4e1b020a39`, once all 6 declared gates re-ran green.**

- **Fix Description:** coverage is now a checked relation. `scripts/fid-surface-coverage.ts` joins
  each active `fixed`/`verified` record's declared gates (parsed by `fid:verify`'s own
  `parseVerificationGates`) to its `SCOPE.md` write surface (read by the Law 2 gate's own
  `loadScopeTargetsByItem`), and `validate:repository` fails naming the record, the missing
  declaration and the demanding glob. Option B makes `fid:verify --write` refuse the same stamp first,
  through the same collector.
- **Tests Added:** Yes — `scripts/__tests__/fid-surface-coverage.test.ts` (13 pins, including the
  stamp refusal) and `packages/agent-runtime/src/echo/__tests__/scope-targets.test.ts`.
- **Verification Evidence:** two real omissions found and repaired (`-018` declared `typecheck common`,
  `-020` declared `typecheck sdk`, both re-stamped green); the real tree then reports 0 coverage
  issues; mutation in both directions re-proven; root `typecheck` exit 0; `quality:report` PASS.
- **Archived:** 2026-10-13 — all 6 declared gates re-ran green on the closure tree before closure; the implementation commit is recorded in the metadata above.

- **Authorised write surface:** `SCOPE.md` → machine-readable scope targets → this record's line.
- **Design input:** `scripts/gate-declarability.ts` (the audited-gate guard this sits beside),
  `scripts/fid-verify.ts` (option B's enforcement point), `scripts/validate-repository.ts`.
- **Ordering:** consumes `FID-2026-1012-021`'s pass (the incident); option B (step 5) is implemented
  here, so no later revision is needed to make the stamp coverage-aware.
