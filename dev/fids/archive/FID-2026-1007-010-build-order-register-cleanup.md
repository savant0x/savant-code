# FID: Build-order register cleanup — five terminal records archived, four restated

**Filename:** `FID-2026-1007-010-build-order-register-cleanup.md`
**ID:** FID-2026-1007-010
**Severity:** low
**Status:** closed
**Created:** 2026-10-07
**Automation level:** 2
**YAGNI-Compliance:** Verified

---

## Summary

`dev/build-orders/` held nine records with no index, no stated lifecycle, and
no `SCOPE.md` registration, so delivered work was indistinguishable from open
work: five of the nine carried terminal status (resolved, superseded, or
executed) while sitting in the live directory beside four genuine proposals.
This FID is the record the cleanup pass owed and did not write at the time —
the work was performed at session level 3 as a complex change (14 files, 129
insertions, 880 deletions, edits to two `.ts` files in a fail-closed tooling
path) with no FID, which the routing rules required.

Five terminal records moved to `dev/build-orders/archive/`; four stay live with
status restated against the codebase. One moved record had claimed
`status: planning` and a "child emitter ABSENT" state for work that shipped as
five closed FIDs — corrected before archiving rather than filed as-is.

## Environment

- **OS:** Windows (win32), PowerShell 7
- **Language/Runtime:** TypeScript, Bun 1.3.14
- **Tool Versions:** `tsc --noEmit`, `eslint` (`--max-warnings 0`), `markdownlint`, `prettier --check`
- **Commit/State:** uncommitted working tree; `main` 123 commits ahead of `origin/main` at session start

## Detailed Description

### Problem

Nine build orders, no lifecycle statement, nothing indexed. A reader could not
tell which records were live proposals without opening each one and trusting
its own header — and one header was demonstrably wrong.

### Expected Behavior

Terminal records leave the live directory; live records state their real
status; the directory states its lifecycle so the condition cannot silently
recur.

### Root Cause

The directory predates the idea-shelf's closure ceremony and never adopted it.
Status headers were written once and never re-verified against the tree.

### Evidence

Stale metadata in `BO-2026-09-07-ndjson-phase-b-emitter.md` (corrected during
this pass before archiving):

```text
status: planning
requested_by: Spencer (via Savant DelegationEngine, FID-067)

| Child emitter (this repo) | ABSENT — no commit, no CHANGELOG entry, no frame logic
                            | in `headless-run.ts` (verified 2026-09-07 on main, all branches) |
```

Ground truth at review time:

```text
cli/src/headless-run.ts:9-13   import { createNdjsonEmitter } from './headless-ndjson'
                               import { createHeadlessEventTap } from './headless-ndjson-tap'
cli/src/headless-run.ts:112    ? createNdjsonEmitter({
cli/src/headless-run.ts:281    jsonEmitter?.emitArtifact(finalAnswer)
dev/fids/archive/              FID-2026-0907-003..-007 (frame module, handleEvent tap,
                               artifact/error + stdout purity, stdin control reader,
                               live handoff matrix)
```

Unimplemented surfaces, confirmed absent (the basis for leaving two orders open):

```text
common/src/types/telemetry.ts   ABSENT
dev/telemetry/                  ABSENT
compliance.jsonl                ABSENT (repo-wide search)
evals/v2/src/runner.ts          RunnerConfig: no `model`, no `onUsage`
evals/v2/src/trace.ts           no `usage` / `model` fields
common/src/types/print-mode.ts  no `usage` member (union runs start → compliance_warning)
```

## Impact Assessment

### Affected Components

- `dev/build-orders/` (9 records + new `README.md`), `dev/build-orders/archive/` (12 records)
- `scripts/tree-drain-manifest/records.ts`, `scripts/tree-drain-manifest/foundations.ts`
- `cli/src/headless-ndjson.ts` (comment only)
- `dev/fids/README.md` (one relative link), `SCOPE.md`, `CHANGELOG.md`

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [x] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Move the five terminal records to `archive/`; correct the four live records'
status against code; add a `README.md` stating the lifecycle; repair the three
references to moved paths in the same pass.

### Steps

1. Archive `2026-08-16-ehel-verification-state-tracking-build-order.md`,
   `2026-0816-anti-deferral-gate-build-order.md`,
   `BO-2026-09-07-ndjson-phase-b-emitter.md`,
   `BO-2026-09-09-gate-chain-hardening.md`,
   `BO-2026-09-22-pre-push-rewrite.md` — all `implemented`.
2. Correct `BO-2026-09-07`'s `status` and its "ABSENT" state row before archiving.
3. Restate status on `BO-2026-08-23` (PARTIALLY EXECUTED), `BO-2026-08-24`
   (OPEN 0/7), `BO-2026-09-08` (OPEN 0/7), `BO-2026-09-16` (HANDOFF; P6 fixed,
   P1/P5 live).
4. Add `dev/build-orders/README.md` with the lifecycle, mirroring
   `dev/idea-shelf/README.md`.
5. Repair references: `cli/src/headless-ndjson.ts:4` (comment path),
   `dev/fids/README.md` (relative link), and the drain manifest (the
   fail-closed coverage this FID depends on — see FID-2026-1007-011 for the
   standing fix).
6. Write the `CHANGELOG.md` entry.

### Verification

```bash
bun scripts/tree-drain.ts          # coverage; UNCOVERED PATHS back to baseline 4
bun run typecheck:scripts         # manifest + tooling typecheck
bun run --cwd=cli typecheck       # headless-ndjson.ts compiles
bun x eslint scripts/tree-drain-manifest/records.ts \
  scripts/tree-drain-manifest/foundations.ts \
  cli/src/headless-ndjson.ts --max-warnings 0
bun run lint:md
bunx prettier --check dev/build-orders/ dev/fids/README.md SCOPE.md \
  CHANGELOG.md scripts/tree-drain-manifest/ cli/src/headless-ndjson.ts
bun run validate:repository
```

This change moves records and repairs paths. It adds no behavior, so there is
no test artifact to declare and `gate: test` has no subject. The missing
regression coverage for the manifest is tracked separately as
FID-2026-1007-011 rather than promised here.

## Verification Gates

- gate: typecheck cli
- gate: quality

### Verification Receipt

- fingerprint: sha256:2bfdc97a5450c75ca7e9ad2ff8d5822160f42a6addc4ddbcc52c2625c5573d80
- verified: 2026-10-08T03:21:47.312Z
- typecheck cli: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Nine records, no index, no lifecycle, no register line. Five
  terminal. One (`BO-2026-09-07`) asserted `status: planning` and "child
  emitter ABSENT" against five archived FIDs and existing source files.
- **GREEN:** Archive the five; correct the four; add the README; repair three
  references.
- **AUDIT:** Every disposition checked against the codebase before the move,
  not from headers. Hashes compared pre/post move.
- **ADVERSARIAL:** Two claims from the implementing session were checked and
  **corrected** — see "Corrections to the implementing session's account" below.
- **CHANGE DELTA:** n/a (single-pass execution; the FID documents work already
  performed rather than converging a plan first — the process defect this FID
  also records).

### Missed Questions

1. **Should the NDJSON order's stale status have been corrected before or after
   archiving?** → Before. An archive is a terminal record; filing a
   demonstrably false status into it would have preserved the defect as
   historical fact.
2. **Should `BO-2026-08-23` and `BO-2026-08-24` have been archived as
   "planning, never executed"?** → No. Both have real remaining work
   (FID 4's G2/G5 audit; 0/7 telemetry FIDs). Archiving them would have been a
   scope reduction without approval.
3. **Is a build order approved scope?** → No, mechanically: `SCOPE.md` is the
   register and named none of them. That is why this cleanup could proceed
   without an approval round at the time, and also why the four live records
   are now formalized as FIDs and registered.

### Corrections to the implementing session's account

Two statements made in the implementing session were wrong and are corrected
here rather than carried forward:

1. **The `OVERLAP` abort was self-inflicted, not a pre-existing latent defect.**
   The session added a broad `dev/build-orders` directory pattern while
   `foundations.ts` still held the specific `BO-2026-08-23` path, which created
   the overlap; it then removed the specific line. The fail-closed tool caught
   the error mid-pass. The real, pre-existing problem was narrower: the
   manifest named exact paths inside a directory whose contents move.
2. **The manifest fix was not fully verified by the gate run.** The pass
   recorded `typecheck:scripts` and the other gates before the final manifest
   edit landed; the later run covered them, and the receipt below reflects the
   post-edit state.

### Implementation Evidence

- [x] **Commit SHA:** `63db5305` (build-order archive + restatements),
      `a3384883` (NDJSON citation repair), `a58472da` (drain-manifest coverage),
      `6888cf74` (this record + `SCOPE.md`/`CHANGELOG.md` registration). G2
      satisfied: the changes are committed locally on `main`.
- [x] **File:line ranges:**
      - `dev/build-orders/archive/` — 5 records moved (SHA256 IDENTICAL pre/post move)
      - `dev/build-orders/BO-2026-08-23-git-workflow-enforcement.md:5` + `## Progress` section
      - `dev/build-orders/BO-2026-08-24-model-compliance-telemetry.md:5` + `## Progress` section
      - `dev/build-orders/BO-2026-09-08-eval-runner-model-override-and-usage-telemetry.md:5` + `## Progress` section
      - `dev/build-orders/BO-2026-09-16-atria-friction.md:5` + `## Current State` rewrite
      - `dev/build-orders/README.md` — new, lifecycle + current contents
      - `cli/src/headless-ndjson.ts:4` — comment path repointed
      - `dev/fids/README.md:871` — relative link repointed
      - `scripts/tree-drain-manifest/records.ts:40,90` — directory coverage + group for the comment repair
      - `scripts/tree-drain-manifest/foundations.ts:27` — overlapping exact path removed
      - `CHANGELOG.md` — `0.0.35` → `### Changed` entry
- [x] **Gate output:** pasted below.
- [x] **Reproducibility:** `Select-String` for a moved filename under
      `dev/build-orders/*.md`, `cli/src/*.ts`, `dev/fids/README.md`, and
      `scripts/tree-drain-manifest/*.ts` returns only the manifest commit
      message that describes the move (no dangling citation).
- [x] **Step statuses:** 1–6 all `implemented`.

### Code Verification Evidence

```text
$ bun scripts/tree-drain.ts | Select-String "UNCOVERED PATHS"
error: UNCOVERED PATHS (4):          <- baseline = operator's 4 untracked docs; unchanged

$ bun run typecheck:scripts ; echo exit=$LASTEXITCODE
$ tsc --noEmit -p scripts/tsconfig.json
exit=0

$ bun run --cwd=cli typecheck ; echo exit=$LASTEXITCODE
$ tsc --noEmit -p .
exit=0

$ bun x eslint scripts/tree-drain-manifest/records.ts \
    scripts/tree-drain-manifest/foundations.ts \
    cli/src/headless-ndjson.ts --max-warnings 0 ; echo exit=$LASTEXITCODE
exit=0

$ bun run lint:md ; echo exit=$LASTEXITCODE
$ markdownlint .
exit=0

$ bunx prettier --check dev/build-orders/ dev/fids/README.md SCOPE.md \
    CHANGELOG.md scripts/tree-drain-manifest/ cli/src/headless-ndjson.ts
Checking formatting...
All matched files use Prettier code style!
exit=0

$ bun run validate:repository ; echo exit=$LASTEXITCODE
Provider docs counts match the registry; no unevidenced fact drift.
validation: PASS
exit=0
```

Move integrity (SHA256, per file, before and after `Move-Item`):

```text
2026-08-16-ehel-verification-state-tracking-build-order.md -> archived/ [IDENTICAL]
2026-0816-anti-deferral-gate-build-order.md                  -> archived/ [IDENTICAL]
BO-2026-09-07-ndjson-phase-b-emitter.md                      -> archived/ [IDENTICAL]
BO-2026-09-09-gate-chain-hardening.md                        -> archived/ [IDENTICAL]
BO-2026-09-22-pre-push-rewrite.md                            -> archived/ [IDENTICAL]
```

## Resolution

- **Closed Date:** 2026-10-07
- **Fix Description:** Five terminal build orders archived with verified
  disposition; four live orders restated against the codebase; directory
  lifecycle documented; three moved-path references repaired; drain manifest
  given directory coverage.
- **Tests Added:** No — no behavior changed. The manifest's missing regression
  coverage is FID-2026-1007-011.
- **Verification Evidence:** gate output above.
- **Follow-on FIDs:** FID-2026-1007-011 (manifest move safety), -012 (telemetry),
  -013 (eval runner), -014 (G2/G5 preflight), -015 (Atria P1/P5).
- **Archived:** 2026-10-07 — `dev/fids/archive/FID-2026-1007-010-build-order-register-cleanup.md`

## Lessons Learned

**A fail-closed tool catches the agent's own error, which is not the same as
the agent having found a defect.** The `OVERLAP` abort was reported mid-pass as
a pre-existing latent bug and, on inspection, was created by the pass that hit
it. The correct reading of a gate firing on your own change is "verify whether
you caused this before claiming you found it."

**A status header written once is a claim with no expiry.** The NDJSON order
asserted absence for four weeks after the work shipped. Statuses that describe a
moving codebase need the same re-verification discipline as code.