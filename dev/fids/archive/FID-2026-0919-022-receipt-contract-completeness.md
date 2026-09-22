# FID: Receipt-Contract Completeness — Repo-Gate Checks + Closed-Record Documentation

**Filename:** `FID-2026-0919-022-receipt-contract-completeness.md`
**ID:** FID-2026-0919-022
**Severity:** medium
**Status:** closed
**Created:** 2026-09-19 14:10
**YAGNI-Compliance:** Confirmed (no new capability: one existing check made
independently runnable so the EXISTING `probe` gate kind can express it; two
one-line spawn fixes; documentation on an already-embedded file)

---

## Summary

`bun run validate:repository` failed with 13 issues discovered while running
the FID-2026-0919-021 battery — and the 2 that mattered were shipping on a
`verified` receipt. FID-2026-0918-007's own part-3 code (commit `0e0ffcd9`)
spawns a bare `'bun'` in two places, which is the exact `v0.0.30` incident
class `audit.gate-env-parity` exists to catch. It escaped because a FID cannot
DECLARE a repo-gate check: the receipt vocabulary covers `typecheck`, `test`,
`probe`, and `quality`, and `validate:repository` itself can never be a gate
(it re-enters FID gate execution, C3 — the self-recursion recorded as a Lesson
under FID-2026-0915-004). This FID fixes the violations, makes the specific
check declarable through the existing `probe` kind, documents that route plus
its recursion boundary, and closes the T69 residual on the template surface.

## Environment

- **OS:** win32 (Git Bash)
- **Language/Runtime:** TypeScript, Bun 1.3.14
- **Tool Versions:** `validate:repository` / `audit.gate-env-parity`
  (FID-2026-0909-002), `fid:verify` (FID-2026-0823-009),
  `generate:protocol-bundle` (FID-2026-0810-003)
- **Commit/State:** branch `main`; the violating files are unmodified since
  `0e0ffcd9` (git status clean for both before this change)

## Detailed Description

### Problem

Two distinct defects, one root:

1. **The violations.** `sdk/scripts/ensure-ripgrep-vendor.ts:114` and
   `sdk/src/__tests__/ensure-ripgrep-vendor.test.ts:39` each call
   `spawnSync('bun', …)`. A bare runtime name resolves on PATH only in a dev
   shell; under the release gate's sanitized spawn environment it dies with
   `uv_spawn ENOENT` — the `v0.0.30` incident. The already-fixed twin sits in
   `scripts/bump-version.ts` (FID-2026-0909-002: spawn `process.execPath`).
2. **The escape route.** FID-2026-0918-007 declared `typecheck sdk` +
   `test …/ripgrep.test.ts` + `quality`. Nothing in that battery could see a
   repo-gate regression, and nothing CAN: the vocabulary has no kind for
   `validate:repository`, and adding one directly is unsafe (see Root Cause).
3. **T69 residual on the template surface.** `templates/FID-TEMPLATE.md`
   states that "any edit after verification invalidates it until re-verified"
   without the closed-record exception, which is the surface every FID author
   actually reads.

### Expected Behavior

A FID must be able to prove that a repo-gate check passed, without the gate
system gaining a self-recursive edge; and the template must state, where
authors read it, that a `closed` record carries no live fingerprint guarantee.

### Root Cause

- **(1)** A copy-paste pattern from before the `v0.0.30` hardening; the
  violation is in a file whose own suite passes because the suite inherits the
  dev shell's PATH — the defect is only visible under the sanitized env, which
  is precisely why the static audit exists.
- **(2)** A structural limit of the gate vocabulary. `validate:repository`
  runs `validateFidVerificationGates`, which LIVE RE-RUNS every active FID's
  declared gates (C3). A FID declaring `validate:repository` as a gate would
  therefore spawn itself — the infinite-recursion Lesson already recorded
  under FID-2026-0915-004 (a self-recursive `probe validate-repository`
  declaration hung the gate). The gap is real, but the naive fix is worse than
  the gap.
- **(3)** The template predates the T69 measurement (284 of 315 archived
  `closed` records carry a drifted fingerprint by construction).

### Evidence

```text
validate:repository BEFORE this FID
  validation: FAIL (13 issues)
  - [audit.gate-env-parity] sdk/scripts/ensure-ripgrep-vendor.ts:114: bare
    runtime-name spawn: `'bun'` is PATH-resolvable only in dev shells …
  - [audit.gate-env-parity] sdk/src/__tests__/ensure-ripgrep-vendor.test.ts:39:
    bare runtime-name spawn: …
  - [hygiene.scratchpad-clutter] × 11 (dev/scratchpad/ root .ts files from the
    FID-2026-0919-018/-019/-020 sessions)

validate:repository AFTER
  validation: PASS

The check becomes declarable (probe entry point)
  BEFORE: `bun scripts/audit-gate-env-parity.ts` — no entry point; the module
          exported functions only, so no gate could name it.
  AFTER:  `bun scripts/audit-gate-env-parity.ts` →
          audit:gate-env-parity PASS (0 issues)                     exit 0
          (declared in this FID as `- gate: probe scripts/audit-gate-env-parity.ts`)

Protocol bundle (embedded grounding file changed)
  bun run generate:protocol-bundle
    protocol bundle: updated (1 file(s)) (5 grounding files, harness v0.2.0)
  bun run generate:protocol-bundle:check
    Embedded protocol bundle + condensed copies are up to date …      exit 0
```

## Impact Assessment

### Affected Components

- `sdk/scripts/ensure-ripgrep-vendor.ts` (spawn fix)
- `sdk/src/__tests__/ensure-ripgrep-vendor.test.ts` (spawn fix)
- `scripts/audit-gate-env-parity.ts` (standalone probe entry point)
- `scripts/__tests__/audit-gate-env-parity.test.ts` (entry-point pins)
- `templates/FID-TEMPLATE.md` (probe route + recursion boundary + closed-record
  semantics)
- `common/src/constants/*.generated.ts` (protocol-bundle regen — generated)
- `dev/scratchpad/` (T72: 11 scratch scripts moved to `archive/`)

### Risk Level

- [x] Medium: a repo gate (`validate:repository`) was failing on a recursive
  defect class; no runtime impact, no data loss, and the fix is mechanical —
  but the vocabulary gap meant it could ride a green receipt.

## Proposed Solution

### Approach

Use the EXISTING `probe` kind as the expressiveness route (Law 5/7/13: no new
grammar, no new machinery): a repo-gate check qualifies as a gate exactly when
it is independently runnable and does NOT re-enter FID verification. The
`audit-gate-env-parity` check satisfies both; `validate:repository` does not
and is documented as permanently non-declarable, with the recursion reason.

### Steps

1. [x] `implemented` — spawn fixes: `process.execPath` at both sites, each with
   the incident-class comment naming the enforcing audit.
2. [x] `implemented` — `scripts/audit-gate-env-parity.ts` gains an
   `import.meta.main` entry point (exit 0 clean / 1 with one line per issue;
   optional explicit root argument) so the check is declarable as a probe.
3. [x] `implemented` — pinned: the entry point exits 0 with `PASS` on a clean
   checkout, and exits 1 with `FAIL` when the audit cannot establish ground
   truth (non-git root). The pin spawns `process.execPath` — the rule the audit
   itself enforces, so the suite cannot smuggle the shape it forbids.
4. [x] `implemented` — `templates/FID-TEMPLATE.md` documents the probe route,
   the recursion boundary, and the closed-record receipt semantics (T69
   residual); protocol bundle regenerated and parity-verified.
5. [x] `implemented` — T72: the 11 scratchpad-root scripts moved to
   `dev/scratchpad/archive/` (operator ruling), taking the hygiene gate green.

### Verification

- `validate:repository` PASS (was FAIL, 13 issues).
- `- gate: probe scripts/audit-gate-env-parity.ts` declared here — the first
  FID in the repo to prove a repo-gate check on its own receipt.
- Regression: the sdk install-hook suite, the audit suite, and both
  protocol-bundle parity suites green (declared below).

## Verification Gates

- gate: typecheck sdk
- gate: typecheck common
- gate: test sdk/src/__tests__/ensure-ripgrep-vendor.test.ts
- gate: test scripts/__tests__/audit-gate-env-parity.test.ts
- gate: test scripts/__tests__/protocol-copies.test.ts
- gate: test common/src/util/__tests__/embedded-protocol.test.ts
- gate: probe scripts/audit-gate-env-parity.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:55b5c4fc5ae0979785e7fbd1c6c44dc5d00156cbc13815d26381e52710e76f74
- verified: 2026-09-19T17:59:37.295Z
- typecheck sdk: exit 0
- typecheck common: exit 0
- test sdk/src/__tests__/ensure-ripgrep-vendor.test.ts: exit 0
- test scripts/__tests__/audit-gate-env-parity.test.ts: exit 0
- test scripts/__tests__/protocol-copies.test.ts: exit 0
- test common/src/util/__tests__/embedded-protocol.test.ts: exit 0
- probe scripts/audit-gate-env-parity.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** `validate:repository` re-run and triaged: 13 issues, provenance
  established by file (none from the FID-2026-0919-021 change) and by git
  (both violating files unmodified since `0e0ffcd9`). Then the escape route
  was diagnosed rather than assumed: the vocabulary gap and the recursion
  constraint were both read out of the code (`fid-gates.ts` C3 re-entry,
  `resolveGate`'s allowlist) and the recursion already existed as a recorded
  Lesson.
- **GREEN:** Spawn fixes + runnable probe entry point + template documentation
  + bundle regen + T72 moves.
- **AUDIT:** `validate:repository` PASS; the probe runs green as a declared
  gate; four regression suites green.
- **ADVERSARIAL:** See Loop 2.
- **CHANGE DELTA:** n/a (document creation).

### Missed Questions

1. Should the vocabulary instead gain an `audit` gate kind? → No (Law 5): the
   `probe` kind already runs an allowlisted repo-relative `.ts` by absolute
   runtime path, and a new kind would add parser + receipt + template + bundle
   surface for zero new capability. Making the check runnable is the smaller
   change with the same proof strength.
2. Can `validate:repository` be declared via a wrapper probe that calls its
   sub-checks? → Only per check, never the umbrella: any wrapper that re-enters
   `validateFidVerificationGates` recurses. The template now states the
   boundary rather than leaving it to be rediscovered.
3. Does moving the T72 scratch files lose anything? → No: `dev/scratchpad/` is
   gitignored, the moves preserve filenames, and the referencing session
   summaries name the old paths (historical text; the files remain readable at
   the archive path).

### Implementation Evidence (REQUIRED for `closed`)

- [ ] **Commit SHA:** NOT YET ASSIGNED — G2 commit authorization is withheld
  by the operator (2026-09-19). Closure evidence is therefore the file:line
  ranges plus the grep match below, which the FID Lifecycle rule admits for
  `closed` ("commit SHA **or** file:line ranges + grep match"). The SHA is
  filled in here when the operator executes the commit.
- [x] **File:line ranges:** `sdk/scripts/ensure-ripgrep-vendor.ts:114`
  (`spawnSync(process.execPath, ['run','fetch-ripgrep'], …)`),
  `sdk/src/__tests__/ensure-ripgrep-vendor.test.ts:39`
  (`spawnSync(process.execPath, [SCRIPT], …)`),
  `scripts/audit-gate-env-parity.ts` (`probeMain()` + `import.meta.main`),
  `scripts/__tests__/audit-gate-env-parity.test.ts` (`standalone probe entry
  point` pins), `templates/FID-TEMPLATE.md` (gate list + receipt note)
- [x] **Gate output:** receipt below — all eight declared gates exit 0
- [x] **Reproducibility:** `bun scripts/audit-gate-env-parity.ts` exits 0 with
  `PASS`; `grep -rn "process.execPath" sdk/scripts sdk/src/__tests__` finds
  both fixes; `bun run validate:repository` prints `validation: PASS`
- [x] **Step statuses:** steps 1-5 all `implemented`

### Code Verification Evidence

- [x] Files referenced in Affected Components exist and contain the described
  code (read + grep this session)
- [x] Implementation matches the Proposed Solution (all five steps)
- [x] Typecheck/tests/lint pass with pasted output (receipt below)
- [x] Production call-graph evidence: `auditGateEnvParity` ←
  `validate-repository.ts:240` (repo gate) and now ← `probeMain` ←
  `import.meta.main` (declarable probe); the sdk script is reachable from the
  root `prepare` hook (`package.json:60`)
- [x] FID status reflects the actual implementation state

### Loop 2 — Independent audit and self-correction

- **RED:** Attack the new entry point: could adding executable code to an audit
  module make the audit flag ITSELF? The detector's class-1 pattern is textual
  and the new code spawns nothing, but that is a claim worth measuring, not
  reasoning about — `bun scripts/audit-gate-env-parity.ts` was run against the
  tree containing the new code: `PASS (0 issues)`. The class-2 pattern is
  scoped to `common/src` production and the file lives in `scripts/`.
- **GREEN:** No correction required. One preventive detail was added anyway:
  the new pins spawn `process.execPath` rather than a bare runtime name, so the
  suite cannot introduce the very shape it exists to prevent (the file's own
  header already warned about literal fixture shapes for the same reason).
- **AUDIT:** Static + live: `validate:repository` PASS; sdk install-hook suite
  4/0; audit suite 13/0 (incl. both new entry-point pins); protocol-copies +
  embedded-protocol 33/0; `generate:protocol-bundle:check` PASS; eslint 0;
  lint:md 0; prettier clean.
- **ADVERSARIAL:** Does the template edit risk the embedded-bundle drift guard?
  Measured, not assumed: the bundle was regenerated (1 file changed) and the
  `:check` mode then reported up-to-date, and both parity suites pass. Could
  the probe gate make the FID's own `--write` slow or recursive? It runs one
  `git ls-files` scan plus a read pass — no FID re-entry; measured inside the
  stamp below.
- **CHANGE DELTA:** 2 spawn lines + 1 entry-point function + 2 pins + 2
  template paragraphs + 1 generated bundle + 11 file moves.

### Loop 3 — Final convergence

- **RED:** Converged — the failing repo gate is the acceptance test, and it
  went FAIL (13) → PASS with the violations fixed rather than suppressed.
- **GREEN:** Converged — no changes after the receipt stamp.
- **AUDIT:** Converged — eight declared gates exit 0 live; `validate:repository`
  PASS; quality PASS; eslint/lint:md/prettier clean.
- **ADVERSARIAL:** Honest boundaries: (1) the probe route proves the SPECIFIC
  check, never `validate:repository` as a whole — by design, with the reason
  documented; (2) moving the T72 scratch files is a working-area tidy, not a
  behavior change, and the old paths remain only in historical prose.
- **CHANGE DELTA:** None after the stamp.

## Resolution

- **Closed Date:** 2026-09-19 17:58 UTC (closed with the commit SHA pending
  operator git execution, G2 withheld; file:line + grep evidence recorded
  instead, per the FID Lifecycle rule for `closed`)
- **Fix Description:** The bare-runtime spawns in FID-2026-0918-007's part-3
  code are fixed by absolute runtime path; the repo-gate check that caught them
  is now independently runnable and thus declarable as a `probe` gate, with the
  recursion boundary and the closed-record receipt semantics documented on the
  template surface.
- **Tests Added:** Yes — 2 entry-point pins (clean → exit 0 / PASS;
  unprovable ground truth → exit 1 / FAIL).
- **Verification Evidence:** receipt below (eight gates, live);
  `validation: PASS` paste in the Evidence section.
- **Archived:** 2026-09-19 17:58 UTC — moved to `dev/fids/archive/`; receipt
  re-stamped live at the archived path (8/8 gates)

## Lessons Learned

A gate a FID cannot declare is a gate that cannot fail a FID's verification —
and the artifact most likely to break such a gate is the FID's own code. The
fix is not to widen the gate vocabulary blindly (the umbrella gate re-enters
FID verification and would recurse) but to make the specific check
independently runnable and prove it through the mechanism that already exists.
The corollary is a habit: when a repo gate goes red, ask which receipt it could
never have failed, not just which line to fix.
