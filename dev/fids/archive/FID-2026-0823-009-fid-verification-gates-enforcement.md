# FID: FID verification gates — make skipped/forgotten verification mechanically impossible

**Filename:** `FID-2026-0823-009-fid-verification-gates-enforcement.md`
**ID:** FID-2026-0823-009
**Severity:** high
**Status:** closed
**Created:** 2026-08-23 16:05
**YAGNI-Compliance:** Verified

---

## Summary

A FID can reach status `fixed` (or `verified`) on the strength of **prose in a markdown
document** — the only machine check today is a regex over words (`/PASS|pass|✓|0 fail|exit 0/`
in `validateFidPhaseEvidence`), which a model satisfies by *writing those words*, not by running
anything. The live failure: FID-2026-0823-004 was recorded `fixed` with claimed gate evidence,
yet the follow-up session reported "zero gates executed — nothing has run." Only a human asking
for a re-run caught it. This FID makes that class of skip structurally impossible with three
mechanical layers: (1) a machine-parseable `## Verification Gates` declaration + machine-generated
`

### Verification Receipt

- fingerprint: sha256:def289b91009da10e2c191731be59b204494d2513fb1afabf50596fbb2cc8b97
- verified: 2026-08-23T23:08:15.517Z
- typecheck packages/agent-runtime: exit 0
- test packages/agent-runtime/src/echo/__tests__/fid-verification-gates.test.ts: exit 0
- test packages/agent-runtime/src/echo/__tests__/pre-write-gates.test.ts: exit 0
- test scripts/__tests__/fid-verify.test.ts: exit 0
- test scripts/__tests__/fid-gates.test.ts: exit 0

## Environment

- **OS:** Windows (Git Bash / MSYS)
- **Language/Runtime:** TypeScript strict monorepo, Bun 1.3.14
- **Tool Versions:** bun test 1.3.14, eslint 9.x, prettier 3.x, markdownlint
- **Commit/State:** working tree on `main` @ v0.0.27 + unreleased hardening
  (release-only-commits convention); this FID is uncommitted

## Detailed Description

### Problem

The FID lifecycle's terminal statuses are self-asserted. Concretely:

1. **Status transitions are prose.** `fid-ledger.ts:19-23` allows `created | analyzed | fixed |
   verified` for active FIDs but never checks *why* a FID claims `fixed`.
2. **Gate evidence is prose.** `validateFidPhaseEvidence('audit')`
   (`packages/agent-runtime/src/echo/fid-validator.ts:230-235`) passes the AUDIT gate when the
   `### Code Verification Evidence` section matches `/PASS|pass|✓|0 fail|exit 0/` — keyword
   presence, not execution. The instruction "paste the output as evidence" has no mechanical
   enforcement; a model can paste words.
3. **Nothing re-runs at the boundary.** `validate:repository` (`scripts/validate-repository.ts`)
   runs `validateActiveFidLedger` (structural scan) plus other static validators — it executes no
   gate commands and checks no receipts. The release gate contract
   (`validation-manifest.ts` `repositoryValidationGates`, run by `public-release.ts:459`) includes
   repo-wide typecheck/test/eslint but nothing tied to any specific FID's claims.

Observed failure (2026-08-23): FID-2026-0823-004 sits at `fixed`. Its Perfection Loop records
claim "typecheck exit 0 · focused suite 3 pass/0 fail · probe PASS" — yet the immediately
following session's own report states "you interrupted before any gate ran; zero of these have
been executed." The two records cannot both be true; the FID metadata carried unexecuted claims,
and no tool existed to distinguish them. The defect is not the specific FID — it is that the
process *permits* the divergence.

### Expected Behavior

- A FID may only be `fixed`/`verified` when its declared verification gates demonstrably pass
  against the current tree, and that fact must be checkable by a machine without trusting prose.
- The claim "gates passed" must be re-verifiable at every enforcement boundary (write, push,
  release) without a human prompt.
- A FID whose code regressed after verification must fail validation, not silently remain `fixed`.

### Root Cause

The single source of truth for "was this verified?" is the FID's own markdown prose. All
existing checks (`fid-ledger.ts`, `fid-validator.ts` phase evidence, `fid-ledger-steps.ts`
anti-deferral) validate **structure of the document**, never **state of the tree**. There is no
machine-readable, tree-anchored artifact that a validator can recompute independently.

### Evidence

Absence checks (executed 2026-08-23):

```text
grep -rln "Verification Gates" dev/fids/ dev/fids/archive/   → 2 archived FIDs (0813-001, 0822-009),
  both PROSE sections ("- cli typecheck exit 0 (every round)") — no machine-parseable declaration
grep -rn "fid:verify|runFidVerification|validateFidVerification" --include="*.ts" --include="*.json"
  → 0 matches (no verification runner exists)
ls dev/fids/ dev/fids/archive/ | grep -c "0823-009"          → 0 (number free)
```

Active `fixed` FIDs that the new gate must migrate (executed 2026-08-23):
`FID-2026-0820-009` (tauri shell), `FID-2026-0822-014` (structured output cards),
`FID-2026-0823-004` (process-agent-defs), `FID-2026-0823-007` (laws 1-4 universal block) —
each has documented gates in prose; migration = declare them in the structured format and stamp
receipts.

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/echo/fid-validator.ts` (or a new sibling `fid-verification-gates.ts`)
  — pure parsers/validators for the gate declaration + receipt
- `packages/agent-runtime/src/echo/pre-write-gates.ts` — write-time tripwire (L3), FID branch
- `scripts/validate-repository.ts` — wire the live re-run (L2) into the issues list
- NEW `scripts/fid-verify.ts` — CLI executor (parse → allowlist-map → run → stamp receipt)
- `templates/FID-TEMPLATE.md` — document the `## Verification Gates` + receipt contract
- `.githooks/pre-push` — optional fast structural gate (C1+C2) before push
- Migration: 4 active `fixed` FIDs (see Evidence)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Governance integrity defect — unverified work can silently ship as "verified"
- [ ] Medium
- [ ] Low

## Proposed Solution

### Approach

Three mechanical layers, each catching the skip at a different boundary. The **receipt + live
re-run** are the truth layer; the **write-time tripwire** is the earliest fail-fast.

**L1 — Machine-parseable declaration + receipt (in-FID).** Reuse the existing `## Verification
Gates` heading (pattern precedent: archived FID-2026-0813-001, FID-2026-0822-009) with a strict
bullet grammar, plus a machine-generated receipt sub-block:

```markdown
## Verification Gates

- gate: typecheck sdk
- gate: test sdk/src/__tests__/process-definitions.test.ts
- gate: probe dev/scratchpad/process-defs-probe.ts

### Verification Receipt

- fingerprint: sha256:<hex of FID content minus receipt>
- verified: 2026-08-23T15:04:00Z
- typecheck sdk: exit 0
- test sdk/src/__tests__/process-definitions.test.ts: exit 0
- probe dev/scratchpad/process-defs-probe.ts: exit 0
```

Grammar: `^- gate: (typecheck|test|probe) <arg>$`. `typecheck` takes a workspace name; `test` /
`probe` take a repo-relative path. Anything else is a validation issue (`fid.gates.malformed`),
never executed. The receipt's `fingerprint` is sha256 over the FID content with the receipt block
stripped — so any edit to the FID after verification invalidates the receipt (freshness), and the
exit-code lines must exactly cover the declared gates.

**L2 — Live re-run at `validate:repository` (authoritative).** A new `scripts/fid-gates.ts`
validator is wired into `validate-repository.ts`. For every active FID with status
`fixed`/`verified`: (C1) require a valid `## Verification Gates` section; (C2) require a matching
`### Verification Receipt` whose fingerprint matches the current content and whose exit lines are
all `exit 0`; (C3) **execute** each declared gate against the current tree via an allowlisted
command mapper — `typecheck <ws>` → `bun run --cwd=<ws> typecheck` (workspace must be in
`VALIDATION_WORKSPACE_POLICY`), `test <path>` → `bun test <path>` (path must exist under repo,
`.test.ts`/`.tsx`), `probe <path>` → `bun run <path>` (path must exist under repo). Non-zero exit
→ `fid.gates.red`. Identical commands across FIDs execute once (dedupe). This runs inside the
existing `repository-validation` release gate and (optionally) pre-push, so a `fixed` FID whose
code is currently red cannot pass the repo gate.

**L3 — Write-time tripwire (EHEL pre-write gates).** Extend the FID branch of
`runPreWriteGates` (`pre-write-gates.ts`, alongside the existing anti-deferral step-status gate):
a FID write whose proposed content declares `**Status:** closed` or `verified` must already pass
C1+C2 on that content (valid gates + receipt + fingerprint match + exit 0). Otherwise block with:
`FID gate: verification receipt required — run bun run fid:verify <fid> before flipping status`.

**`fid:verify` CLI** (`scripts/fid-verify.ts`, root script `"fid:verify"`): parses the FID's
declared gates, runs them, and either prints the receipt block (`--print`) or stamps it into the
FID (`--write`); exits non-zero on any red gate. One command — the agent/operator runs it, the
receipt it produces is what the tripwire and the re-run accept.

### Steps

1. Add pure gate-declaration + receipt parsers/validators (C1/C2 grammar, fingerprint) in
   `packages/agent-runtime/src/echo/` (fid-validator sibling or extension), with unit tests.
2. Add `scripts/fid-verify.ts` (allowlisted command mapper + executor + receipt printer/writer),
   root `fid:verify` script, and executor tests (fixture FID with a real trivial gate, e.g.
   `probe scripts/__tests__/fixtures/echo.ts`).
3. Add `scripts/fid-gates.ts` `validateFidVerification(root)` (C1+C2 structural + C3 live
   re-run, deduped) and wire it into `validate-repository.ts` issue list.
4. Extend `pre-write-gates.ts` FID branch with the L3 tripwire + tests (flip to fixed without
   receipt blocked; with valid receipt allowed; non-FID paths unaffected).
5. Update `templates/FID-TEMPLATE.md` with the section + receipt contract.
6. Wire optional fast structural gate into `.githooks/pre-push` (C1+C2 only, no execution).
7. Migrate the 4 active `fixed` FIDs (0820-009, 0822-014, 0823-004, 0823-007): declare their
   documented gates in the structured format, run `fid:verify --write`. Any FID that cannot
   produce a green receipt is **downgraded to `analyzed` honestly** rather than exempted.
8. Gate sweep: `validate:repository` PASS with migrated FIDs; focused suites green; eslint
   `--max-warnings 0`; prettier clean; lint:md clean.

### Verification

- Unit: parser/validator tests (valid grammar, malformed, hostile args — path escape, unknown
  kind, non-existent workspace) — the hostile-attacker surface.
- Executor: fixture FID with a passing probe → receipt stamped, `exit 0`; a failing probe →
  `fid.gates.red`, non-zero exit.
- Ledger integration: a `fixed` FID without receipt → `fid.gates.*` issues in
  `validate:repository`; with valid receipt → PASS; with stale fingerprint → `fid.gates.stale`.
- Write-time: pre-write-gates tests per L3.
- End-to-end: migrate the 4 real `fixed` FIDs and run `validate:repository` clean.
- Law 4 reachability: grep production entry points — `validate-repository.ts` calls
  `validateFidVerification`; `pre-write-gates.ts` calls the receipt check; `fid:verify` script
  exists in root package.json.

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: test packages/agent-runtime/src/echo/__tests__/fid-verification-gates.test.ts
- gate: test packages/agent-runtime/src/echo/__tests__/pre-write-gates.test.ts
- gate: test scripts/__tests__/fid-verify.test.ts
- gate: test scripts/__tests__/fid-gates.test.ts

## Perfection Loop

### Loop 1 — RED

- **RED:** (a) FID status is prose-asserted — `fid-ledger.ts:19-23` never checks *why*;
  (b) phase evidence is keyword regex — `fid-validator.ts:230-235` `/PASS|pass|✓|0 fail|exit 0/`;
  (c) no receipt/runner exists anywhere (grep evidence above); (d) live failure documented:
  FID-2026-0823-004 `fixed` with unexecuted claimed gates.
- **GREEN:** Three-layer design above — declaration+receipt (L1), live re-run in the release gate
  (L2), write-time tripwire (L3); allowlisted command shapes (hostile-attacker safe); migration
  path with honest downgrade rule; `fid:verify` single-command UX.
- **AUDIT:** Method 1 (static) — read 0-EOF: `fid-ledger.ts`, `fid-validator.ts`,
  `pre-write-gates.ts`, `fid-ledger-steps.ts`, `validate-repository.ts`, `validation-manifest.ts`,
  `public-release.ts:459`, `.githooks/pre-push`, `protocol.config.yaml`, FID template. Every
  wiring point named above exists and matches. Method 2 (behavioral) — absence greps executed
  (no runner, number 009 free, 2 prose precedent sections found); the 4 active `fixed` FIDs
  enumerated on disk. Design answers the Five Questions (see below).
- **ADVERSARIAL:** Challenge "a model can forge the receipt block." Response: the fingerprint is
  sha256 over content-minus-receipt — a forged receipt must match the exact content being
  written, and the L2 live re-run at `validate:repository` re-executes the gates against the
  tree, so a forged `exit 0` line is caught by the actual exit code at release time. The receipt
  is a tripwire; the re-run is the truth layer. Residual: pre-push execution cost (mitigated:
  pre-push runs C1+C2 structural only, full execution lives at the release gate).
- **CHANGE DELTA:** n/a — new document (Loop 1).

### Missed Questions

1. *What about archived FIDs (248) that already claim `closed` without receipts?* → Exempt.
   Enforcement is forward-only: C1/C2/C3 apply to **active** `fixed`/`verified` FIDs. Archived
   records are history; retro-enforcement would falsify their closure. Documented in L1 design.
2. *Can a hostile FID execute arbitrary commands via the gate grammar?* → No. Kinds are
   allowlisted (`typecheck|test|probe`); `typecheck` args must be a known workspace
   (`VALIDATION_WORKSPACE_POLICY`), `test`/`probe` args must resolve under the repo with a
   `.test.ts/.tsx` / `.ts` extension; commands are built as argv arrays (no shell interpolation).
   Malformed args fail validation, never execute. Folded into Steps 1-2 + Verification.
3. *Does `test` gate need to know which file the FID touches?* → No — the FID declares its own
   focused gate file; the executor just runs it. The FID author chooses the minimal verifiable
   surface; repo-wide gates already run in the release contract independently.
4. *What if a `fixed` FID legitimately cannot be re-run (e.g. needs a restarted harness)?* →
   Honest downgrade: the FID is demoted to `analyzed` until its gates can produce a green
   receipt. This is the ground-truth rule (FID metadata is a claim; the tree is truth), not a
   punishment. Folded into Step 7.
5. *Should `closed` (active) also be blocked by the tripwire?* → The ledger already rejects
   active `closed`; archived `closed` is exempt per Q1. The tripwire covers `fixed`/`verified`
   writes, which is the transition that matters.
6. *Why not just re-run the repo-wide gates instead of per-FID?* → Repo-wide gates already run
   at release; per-FID gates catch the *specific* claimed verification (focused test file, probe)
   that the FID asserts — that is what was skipped in the observed failure. Both layers coexist;
   per-FID is the FID's own contract, repo-wide is the floor.
7. *Does the receipt fingerprint break when the agent edits the FID (e.g. adds evidence)?* → Yes,
   by design: any post-verification edit invalidates the receipt, forcing a re-run of `fid:verify`
   before the status flip. This is the freshness property the operator asked for ("skip/forget
   must be impossible"), with the one-command `fid:verify --write` making the re-stamp cheap.

### Implementation Evidence (REQUIRED for `closed`)

> A FID **cannot** be set to `closed` without this section filled. No silent deferrals.

- [x] **Commit SHA:** Uncommitted working tree (release-only-commits convention; next release
      sweep carries it)
- [x] **File:line ranges:** `packages/agent-runtime/src/echo/fid-verification-gates.ts:1-238`
      (pure contract); `packages/agent-runtime/src/echo/pre-write-gates.ts:190-213` (L3
      tripwire); `scripts/fid-verify.ts:1-260` (executor); `scripts/fid-gates.ts:1-137`
      (validate-repository wiring at `scripts/validate-repository.ts:231`); root
      `package.json:39` (`fid:verify` script); `.githooks/pre-push:74-82`; template section
      `templates/FID-TEMPLATE.md` (after `### Verification`)
- [x] **Gate output:** Pasted in T12 scope record — agent-runtime typecheck exit 0; full
      agent-runtime suite 1253/0; echo suites 134/0; scripts 24/0; ledger 9/0; manifest 8/0;
      eslint --max-warnings 0 on all touched files; prettier clean; lint:md clean;
      `fid:verify --check` PASS on all 5 active fixed FIDs
- [x] **Reproducibility:** grep hits in working tree — `validateFidVerificationGates`
      (`validate-repository.ts:13,231`), `validateFidVerification`
      (`pre-write-gates.ts:25,205`), `"fid:verify"` (`package.json:39`), `fid:verify --check`
      (`.githooks/pre-push:76-77`)
- [x] **Step statuses:** all 8 steps `implemented` (see `## Step Status` below)

### Code Verification Evidence

- [x] Files referenced in Affected Components exist (verified on disk)
- [x] Implementation matches the Proposed Solution
- [x] Typecheck/tests/lint pass with pasted tool output (see Implementation Evidence)
- [x] Production call-graph evidence present: `validate-repository.ts:231` →
      `validateFidVerificationGates` → `fid-verify.ts` `runGates`; `pre-write-gates.ts:205` →
      `validateFidVerification`; root `package.json:39` `fid:verify`; `.githooks/pre-push:77`
- [x] FID status reflects the actual implementation state: `fixed` with stamped green receipt
      (regenerated after the status flip — the freshness property fired and was re-verified)

### Loop 2 — Independent audit and self-correction

- **RED:** None — no new issues surfaced from the Loop 1 audit of this planning document.
- **GREEN:** n/a.
- **AUDIT:** Design cross-checked against every named file 0-EOF (fid-ledger.ts, fid-validator.ts,
  pre-write-gates.ts, validation-manifest.ts, validate-repository.ts, .githooks/pre-push,
  protocol.config.yaml, FID template); precedent `## Verification Gates` sections read from
  archived FIDs 0813-001 and 0822-009; active fixed-FID inventory enumerated on disk.
  Convergence satisfied (delta < 2% after Loop 1 corrections; no oscillation).
- **ADVERSARIAL:** Stands — the only residual challenge (forged receipt) is answered by the
  fingerprint + live re-run pair; documented under Loop 1.
- **CHANGE DELTA:** ~0% (no material changes in Loop 2).

### Loop 3 — Final convergence

- **RED:** Execution cost of C3 in `validate:repository` (per-FID typechecks). Mitigation:
  dedupe identical commands; `typecheck <ws>` commands are bounded by workspace count, not FID
  count; release-gate budget already includes repo-wide typecheck, so per-FID adds marginal
  minutes at most. Accepted.
- **GREEN:** n/a (no changes).
- **AUDIT:** Design complete; operator presentation is the gate. Status stays `analyzed` until
  operator approval, then implementation per Steps 1-8.
- **ADVERSARIAL:** Stands.
- **CHANGE DELTA:** 0%.

## Resolution

- **Closed Date:** 2026-08-23 (operator-approved closure; working-tree closure,
      release-only-commits convention)
- **Fix Description:** Three-layer mechanical verification enforcement for FID terminal
      statuses: declarative gates + fingerprint-pinned receipts (L1), live re-run in
      validate:repository (L2/C3), write-time tripwire in pre-write-gates (L3); `fid:verify`
      one-command executor; template + pre-push wiring; all active fixed FIDs migrated
- **Tests Added:** Yes — fid-verification-gates 20, fid-verify 16, fid-gates 8, pre-write
      tripwire 5 (49 new); full suites re-run green
- **Verification Evidence:** See Implementation Evidence — typecheck 0, agent-runtime 1253/0,
      echo 134/0, scripts 24/0, eslint/prettier/lint:md clean, `fid:verify --check` PASS
- **Archived:** 2026-08-23 (moved to `dev/fids/archive/`)

> When status is set to **closed**, move this file to `dev/fids/archive/` and append an entry to
> `CHANGELOG.md`.

## Step Status

- [x] 1. Pure gate-declaration + receipt validators (C1/C2) with unit tests — implemented
      (fid-verification-gates.ts, 20 tests)
- [x] 2. `scripts/fid-verify.ts` allowlisted executor + `fid:verify` root script + tests —
      implemented (16 tests)
- [x] 3. `scripts/fid-gates.ts` `validateFidVerification` (C1+C2+C3) wired into
      `validate-repository.ts` + ledger integration tests — implemented (8 tests; 0 fid.gates
      issues in validate:repository)
- [x] 4. `pre-write-gates.ts` L3 tripwire + tests — implemented (5 tests; echo suite 134/0)
- [x] 5. `templates/FID-TEMPLATE.md` contract documentation — implemented
- [x] 6. `.githooks/pre-push` optional structural gate (C1+C2) — implemented
- [x] 7. Migrate 4 active `fixed` FIDs (declare gates + stamp receipts; honest downgrade
      fallback) — implemented; all 4 stamped green (one re-stamp cycle after the concurrent
      stream's typecheck regression was resolved); `fid:verify --check` PASS on all 5 active
      fixed FIDs incl. this record
- [x] 8. Full gate sweep: agent-runtime typecheck exit 0; full suite 1253/0; echo 134/0;
      scripts 24/0; ledger 9/0; manifest 8/0; eslint --max-warnings 0 on all touched files;
      prettier clean; lint:md clean; validate:repository shows zero fid.gates issues —
      implemented

## Lessons Learned

- A verification system whose only check is "did the document say verified" verifies nothing.
  Machine-checkable claims must be recomputable from the tree, not restated in prose.
- The observed failure mode (recorded-but-unexecuted gates) was caught only by a human asking
  for a re-run. Any process that depends on a human prompting re-verification will eventually
  ship an unverified claim. Put the re-run at the existing release boundary instead.
- Follow existing conventions: the `## Verification Gates` heading already existed in archived
  FIDs — the missing piece was structure + execution, not a new heading.
- Honest downgrade beats silent exemption: a FID that can't prove `fixed` today is `analyzed`
  until it can. Metadata is a claim; the tree is truth.
