# Build Order — Release Gate-Chain Hardening (FIDs -0909-001/-002/-003)

**Date:** 2026-09-09
**Status:** EXECUTED 2026-09-09 — operator approved ("Approve the full
001→003→002 program and implement all three sequentially"); all three FIDs
closed + archived, receipts re-stamped, program battery green. See
`dev/fids/archive/README.md` (2026-09-09 closure) and the CHANGELOG
`Unreleased` entries.
**Scope sources:** `dev/fids/FID-2026-0909-001-clean-checkout-gate-orphaned-temp-dir.md`,
`dev/fids/FID-2026-0909-002-release-gate-environment-parity.md`,
`dev/fids/FID-2026-0909-003-verify-clean-sdk-declaration-gate.md` — all
Perfection-Looped to `analyzed` 2026-09-09 (single-agent ECHO v0.1.2;
codebase-grounded; statuses honest in `dev/fids/README.md`).

---

## 1. Why these three FIDs are one program

All three were born from the same event: the v0.0.30 release cut (2026-09-09)
burned **three failed release round-trips** on defects that every local gate
(typecheck ×12, full test battery, eslint, `verify:clean`) passed. The class:
**surfaces that only the release pipeline exercises are ungated locally.**

| # | FID | Incident | Fix surface |
|---|---|---|---|
| 1 | `-0909-001` (low) | Orphaned `%TEMP%\savant-release-checkout-v0.0.30` blocked every post-failure re-run; manual `rm -rf` was the only recovery | `scripts/public-release/provenance.ts` — the shared clean-checkout lifecycle |
| 2 | `-0909-002` (medium) | Three environment-dependent defects (Bun-only `import.meta.dir` in the dts program, bare `'bun'` spawns under the sanitized gate env, Windows `Path`/`PATH` casing) surfaced only inside the release gates | New audit gate wired into `validate:repository` |
| 3 | `-0909-003` (medium) | `verify:clean`'s committed-tree proof never compiles the SDK dts declaration surface; the TS2339 shipped to release night | Same shared lifecycle in `provenance.ts` — parameterized gate list |

FIDs 001 and 003 target the **same function** (`assertCleanCheckoutCompiles`).
FID 002's guard would have caught every defect that started this cascade.
One sequencing decision dominates the whole plan (§2).

## 2. The sequencing decision (mandatory order)

**The implementation order is: 001 → 003 → 002.**

### Step 1 — FID-2026-0909-001 (orphaned Temp worktree) — FIRST

**Why first:** it owns the shared lifecycle's correctness. Both other FIDs
build directly on it:

- FID-003's RED pin (Step 4.3 of that FID) deliberately plants a failing
  gate at the shared versioned Temp path — running it before 001 means the
  pin itself can orphan the checkout directory it needs to keep using.
- FID-003's audit leg requires running `verify:clean` twice (RED pin +
  restore-and-pass) against the **same versioned path**. With 001 unfixed,
  a single forgotten cleanup turns the second run into the
  `already exists` abort that started this program.
- 001's self-healing pre-create guard is what makes FID-003's RED pin safe
  to run at all.

**Scope (per the looped FID):** pre-create remove-if-exists guard
(git removal + filesystem `rmSync` fallback, each best-effort + logged);
`finally`-removal result capture with a loud warning; filesystem fallback
after the git removal; injected fs adapter (`existsSync`/`rmSync`) so every
command + filesystem surface stays injectable (repo DI convention, no
module mocking). One live probe confirms git's internal ordering of failed
worktree removals (constraint, not an open design question — the fix is
robust to either ordering).

**Files touched:** `scripts/public-release/provenance.ts` (212 lines —
addition must stay under the 300 ceiling), RED pins in
`scripts/public-release-provenance.test.ts` (existing injectable-runner
convention).

### Step 2 — FID-2026-0909-003 (verify:clean + build:sdk) — SECOND

**Why second (not third):** it extends the exact lifecycle Step 1 just
repaired, and its verification legs (the RED pin + live `verify:clean`
runs) are the first real exercise of the self-healing lifecycle. Doing it
here means any residual 001 defect surfaces in a controlled context with
fresh context on the code, not on a release night. Its output is also the
committed-tree proof that later guards (and the next cut) rely on.

**Scope (per the looped FID):** parameterize `assertCleanCheckoutCompiles`
with a post-install gate list (default byte-identical to today — the
release GATES stage must not run `build:sdk` twice); `runVerifyClean` opts
in to `build:sdk` appended after the typecheck chain; RED pin = planted
`import.meta.dir` in `common/src/env.ts` on a scratch worktree fails the
extended `verify:clean` with the TS2339 shape, restore + pass; contract
docs (`verify-clean.ts` header + HELP_TEXT, FID-2026-0907-002 record) and
receipt stamping.

**Files touched:** `scripts/public-release/provenance.ts`,
`scripts/verify-clean.ts` (+ docs), pins in the two existing test files.
Watch the 300-line ceiling in `provenance.ts` — if Steps 1 + 2 together
push it over, split per the quality policy (single seam, e.g. the gate-list
runner into `scripts/public-release/clean-checkout-gates.ts`).

### Step 3 — FID-2026-0909-002 (gate-environment parity guard) — THIRD

**Why last:** its Step-1 inventory ran at loop time and is green-ish (one
reasoned exemption), so its remaining work is the largest NEW artifact of
the program (a new audit module + suite + wiring) and it is independent of
the lifecycle work. It also benefits from both prior steps: the FID-003 RED
pin exercise has just proven the harness for planted-violation drills, and
the parity guard's prove-the-guard leg reuses the same scratch-worktree
technique.

**Scope (per the looped FID):** new `scripts/` audit gate — pure detector
with a git-ls-files collector and `validate:repository` wiring as
`audit.gate-env-parity` (the exit-code-masking template). Classes 1-2 are
mechanical: bare-runtime test spawns (one reasoned exemption: the
pinned-bun contract probe in `scripts/public-release-pinned-bun.test.ts`),
and `import.meta.dir` scoped to `common/src` non-test production files.
Class 3 (`process.env` shape dependence) is NOT greppable — the minimal
gate documents it as behaviorally pinned by the env-bootstrap suite; the
sanitized-env behavioral probe is an optional larger-scope alternative.
**Operator decision at GREEN (RESOLVED 2026-09-09): minimal gate** —
classes 1–2 mechanical, class 3 behaviorally pinned.

**Files touched:** new `scripts/audit-gate-env-parity.ts` + suite,
`scripts/validate-repository.ts` (one import + one issues-array spread).

## 3. Program-level verification battery (run once at program end)

Per workspace touched (scripts only — no runtime code changes in this
program):

```bash
bun test scripts/                       # provenance + verify-clean + new audit suite
bun run lint:md                         # docs + FID edits
bun run validate:repository             # includes the new audit gate once wired
bun run quality:report                  # 300-line ceiling on provenance.ts
bun x eslint . --max-warnings 0
```

Per-FID receipts via `bun run fid:verify <fid> --write` after each FID's
gates go green (existing repo convention; receipts are machine-stamped
only after gates run).

Program-level acceptance:

1. FID-001 unit pins green (stale-dir self-heal, removal-failure warning,
   parity) + the operator live recovery drill at the next cut (operator
   boundary — never claimed locally).
2. FID-003: extended `verify:clean` PASS on the committed tree; RED pin
   catches the planted TS2339; release-path parity pins green.
3. FID-002: guard detects planted violations with file:line precision,
   honors the exemption, `validate:repository` PASSes end-to-end; the
   prove-the-guard leg (planted violation on a scratch worktree → red →
   restore → green).

## 4. Boundaries and non-goals

- **No runtime code** — all three fixes live in `scripts/` (release
  tooling). No CLI/SDK/package source changes.
- **No release authorization** — the next cut is the operator's; this
  program only hardens the gates the cut will run.
- **Live boundaries stay operator-owned:** FID-001's recovery drill and
  the parity guard's real-environment leg are recorded as operator-assisted
  boundaries, never claimed from local runs (repo convention).
- **`build:savant-free` is out of scope** (FID-003 Loop 1 evidence: Bun
  compile target — no type checking, minutes per run; wrong failure
  class).
- **Sequencing is mandatory** — the 001 → 003 → 002 order is not a
  preference. 001's self-healing is what makes 003's RED pin safe; 002's
  prove-the-guard leg reuses 003's planted-violation harness.

## 5. Commit plan (G1/G3/G4/G8 — path-scoped, agent commits allowed per the 2026-09-05 G1 amendment)

| # | Commit | Paths | Message |
|---|---|---|---|
| 1 | FID-001 implementation + pins | `scripts/public-release/provenance.ts`, `scripts/public-release-provenance.test.ts` | `fix(release): self-healing clean-checkout lifecycle (FID-2026-0909-001)` |
| 2 | FID-003 implementation + pins | `scripts/public-release/provenance.ts`, `scripts/verify-clean.ts`, test files, contract docs | `feat(verify): cover the SDK declaration surface in verify:clean (FID-2026-0909-003)` |
| 3 | FID-002 guard + wiring | `scripts/audit-gate-env-parity.ts` (+ suite), `scripts/validate-repository.ts` | `feat(audit): gate-environment parity guard (FID-2026-0909-002)` |
| 4 | Governance | `dev/fids/*`, `CHANGELOG.md`, `SCOPE.md` | `docs(governance): close + archive release-gate FIDs (FID-2026-0909-001..003)` |

---

> Single-agent ECHO v0.1.2: this document is the presented plan. Per Law 2,
> implementation begins only on operator approval. No signatures, no
> attribution fields.
