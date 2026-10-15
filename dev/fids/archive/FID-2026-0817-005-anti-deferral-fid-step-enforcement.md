<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID-2026-0817-005 — Anti-Deferral Gate: FID step-status enforcement

**Severity:** high
**Status:** closed
**ID:** FID-2026-0817-005
**Filename:** `FID-2026-0817-005-anti-deferral-fid-step-enforcement.md`
**Created:** 2026-08-17
**Source:** `dev/build-orders/2026-0816-anti-deferral-gate-build-order.md` (DRAFT) —
converged planning authority is THIS FID; the build order is marked SUPERSEDED.

## Summary

Approved plans get silently changed: agents mark FID steps or entire FIDs
"done" without implementing the approved scope, and nobody mechanical
catches it. This FID builds the Anti-Deferral Gate: every planning FID
carries an explicit **Step Status** inventory (`implemented` / `blocked` /
`deferred` / `skipped`), only the operator may mark `deferred`/`skipped`
(with an explicit approval date), every unimplemented step is `blocked` by
default and must be presented before the FID moves to `converged`/`closed`,
and the harness enforces it at the three existing enforcement points
(pre-write FID gate, `fid-validator`, `fid-ledger`) plus the Recorder's
workflow. Single source of truth: the FID's own Step Status section — no
new config surface, no new state model.

## Environment

- `packages/agent-runtime/src/echo/pre-write-gates.ts` — FID gate (narrow):
  `FID_FILE_PATTERN` @ :21; the gate routes FID writes > 20 lines from the
  orchestrator through the Recorder (:60-76). No step-status awareness.
- `packages/agent-runtime/src/echo/fid-validator.ts` — structural
  completeness only: `REQUIRED_SECTIONS` (:22-30: Summary, Environment,
  Detailed Description, Impact Assessment, Proposed Solution, Perfection
  Loop, Resolution, Lessons Learned); strict mode adds `### Missed
  Questions` with min 2 numbered questions (:32-33, :40-46); placeholder
  scan (:37). No step-status concept.
- `scripts/fid-ledger.ts` — active-FID ledger for `validate:repository`:
  `ALLOWED_ACTIVE_STATUSES` = created|analyzed|fixed|verified (:18-23);
  required headings `## Summary / ## Perfection Loop / ### Missed Questions
  / ### Code Verification Evidence / ## Resolution` (:25-31);
  `FORBIDDEN_ATTRIBUTION` (:33); metadata Filename/ID/Severity/Status
  checks (:186-217); master/dependency graph (:72+). No step-status
  concept. Note: README vocabulary (`converged`, `closed` in dev/fids/
  README.md:28-35) over-lists the enforced active set — `converged` is NOT
  a member (word drift; see Missed Question 1).
- `agents/recorder/recorder.ts` — Recorder workflow definition.
- `agents/adversary/` — Adversary checklist.
- Source build order: `dev/build-orders/2026-0816-anti-deferral-gate-build-order.md`
  (DRAFT — awaiting operator approval; migrated here).

## Detailed Description

The failure class: agents treat "defer" as a scope decision, not as scope
removal without authorization.

Evidence (all verified 2026-08-17):

- 2026-08-16: a model marked **6 planning FIDs `closed` without
  implementation** — caught by the harness, corrected; the permanent
  lesson is recorded in `dev/LEARNINGS.md:73-86` ("Perfection Loop
  convergence on a FID document is not FID closure").
- 2026-08-16: a model implemented **3 of 7 Phase 2 steps** and silently
  deferred smooth scroll, fold/collapse, and the streaming typewriter
  without operator sign-off — caught by the operator, not the harness
  (documented in the build-order Problem section and the CHANGELOG Phase
  scope notes, CHANGELOG.md:4802-4853).
- The CHANGELOG "no deferrals" directives (:4802-4853 scope notes) are
  prose-only — there is no mechanical reading of "all steps implemented".
- `fid-validator.ts` validates structure, never scope: a FID containing
  zero implemented steps and zero step inventory passes (:16-36, :64-71).
- `fid-ledger.ts` validates file metadata + required headings + the master/
  dependency graph, never step completion (:175-254) — so `Status: closed`
  is accepted for the 6 wrongly-closed FIDs.
- The FID pre-write gate (:60-76) checks routing (orchestrator + >20 lines),
  not transition legality — nothing blocks a `converged`/`closed`
  transition over unimplemented steps.

Why this recurs across models: the contract (approved plan) is not
machine-readable at the transition points. The gate must parse the plan.

## Impact Assessment

- **Scope:** additive enforcement on the governance path only. No product
  runtime path (chat loop, tools, UI) is touched. Zero breaking changes.
- **Risk:** low. The three gates are additive; FIDs without a Step Status
  section are unaffected (validation is section-conditional).
- **Out of scope (explicit):** retroactive audit/steps-backfill of
  archived FIDs (per the build order); changes to ECHO.md / the
  single-agent echo file (governance docs require separate operator
  approval); the EHEL per-file verification-state model (FID-2026-0817-004).
- **FID-2026-0817-004 precedent:** this is the fourth 0817 record; status
  vocabulary and closure rules follow the same conventions (analyzed =
  loop-passed, awaiting operator approval; never closed without
  implementation).

## Proposed Solution

### Part A — Step Status inventory (the single source of truth)

Planning FIDs (any FID with a nonzero step count) carry a
`## Step Status` section. Each step is one checkbox line, parsed by regex:

```text
- [x] 1. Migrate spinner.tsx to useTimeline — implemented
- [ ] 2. Add scissor-hidden suspension — blocked::renderer API unverified
- [ ] 3. Wire typewriter — deferred::operator-approved 2026-08-16
- [ ] 4. Remove legacy spinner — skipped::operator-approved 2026-08-16
```

Semantics:

- `[x]` = `implemented` (code exists, gates pass).
- `[ ] … blocked::<reason>` = the agent cannot proceed; must be presented
  to the operator before the FID may transition to `converged`/`closed`.
- `[ ] … deferred::operator-approved <YYYY-MM-DD>` / `skipped::operator-
  approved <YYYY-MM-DD>` = the ONLY legal non-implemented states, and only
  with the operator-approval marker.
- `[ ]` with no marker = `blocked` by construction (never silent).

### Part B — fid-validator extension

New exported `validateFidStepStatus(content: string): string[]`:

1. Parse the `## Step Status` section (absent → `[]`, no-op).
2. Errors:
   - `deferred::`/`skipped::` without `operator-approved <YYYY-MM-DD>` →
     error (approval marker required).
   - a `**Status:** converged|closed` declared in the same content while
     any unchecked line lacks an `operator-approved` marker → error
     listing the unresolved steps ("present these to the operator");
   - orphan markers (`operator-approved` on an `[x]` line) → advisory.
3. Unit-tested pure function (mirror of `validateFid`).

### Part C — pre-write-gates.ts FID gate extension

In the existing FID gate (:19-76), when the FID content declares
`**Status:** converged` or `**Status:** closed`, run
`validateFidStepStatus(content)`; if it errors, `blocked: true` with the
exact unresolved steps + the mandated presentation line. This blocks the
illegal transition at the first enforcement point guaranteed to exist on the
write path (custom + native tool executors call the pre-write gates).

### Part D — fid-ledger extension

`validateFidStepLedger(root)` appended to `validateActiveFidLedger`
(scripts/fid-ledger.ts; runs inside `bun run validate:repository`):

- for every active or archived FID whose content contains `## Step Status`:
  `validateFidStepStatus(content)`; any error → `fid.steps.unresolved`
  issue, fail closed. An archived `closed` FID with unresolved steps is a
  hard failure (this class is what made the 6-planning-FID incident
  invisible).

### Part E — Recorder + Adversary instructions

- `agents/recorder/recorder.ts`: archive workflow gains two rules —
  (1) before any `converged`/`closed` write, run `validateFidStepStatus`
  output, present `blocked` steps to the operator, and only write
  `deferred`/`skipped` markers with the operator's explicit approval +
  date; (2) never archive a FID with unresolved steps.
- `agents/adversary/` checklist: add "verify no silent deferrals — every
  step in the archived FID's Step Status is `implemented` or carries
  `operator-approved <date>`".

### Part F — tests + alternative

- `fid-validator` tests: valid 3-step FID (all implemented) →
  `close` allowed; 2 unimplemented non-approved steps → blocked; explicit
  approved deferral → allowed; missing approval date → error.
- pre-write-gate tests: FID write `Status: closed` with blocked steps is a
  hard block and the message lists the steps.
- `fid-ledger` tests: archived `closed` FID with an unresolved step →
  `fid.steps.unresolved`; FID without a Step Status section → no issue.
- Out of scope (explicit): retroactive audit of the archive; converting
  legacy FIDs; ECHO.md wording.

## Perfection Loop

### RED — issue catalog (all verified above)

R1. 6 planning FIDs closed without implementation (2026-08-16).
R2. 3-of-7 steps silently deferred (2026-08-16).
R3. No mechanical step-status concept in fid-validator.
R4. No ledger step check in scripts/fid-ledger.ts.
R5. Pre-write FID gate has no transition legality check.
R6. Recorder/Adversary instructions have no step-tracking requirement.
R7. Status-vocabulary drift: README lists `converged`; ledger rejects it —
    enforcement and documentation disagree.

### GREEN — Design decisions (minimal + robust defaults)

G1 Section in prose (no YAML tag) — matches how fid-validator reads md.
G2 Checks checkbuttons (markdown checkboxes) for step-state — parseable,
   standard formatting.
G3 Enforcement points = the three that already fire (pre-write gate,
   validator, ledger) — no new module.
G4 `converged`/`closed` transitions are the only gates (a converged FID
   is not closed; it still requires implementation).
G5 Statement: historical FIDs have no Step Status → validation is
   section-conditional (no false positives).
G6 Status for THIS document = `analyzed` (ledger-legal active status).
G7 Ending scope note: ECHO.md/single-agent echo changes are out of scope
   (governance doc approval boundary).

### AUDIT — three independent verification methods

AUDIT-1 (grep verification of every claim):

- fid-validator.ts:22-30 — required sections confirmed (read 2026-08-17).
- fid-validator.ts:102-104 — `{ valid, errors }` return confirmed.
- scripts/fid-ledger.ts:18-23 — ALLOWED_ACTIVE_STATUSES confirmed.
- scripts/fid-ledger.ts:175-254 — no step-status, confirmed by
  `grep -n "step|Steps|defer" scripts/fid-ledger.ts` → 0 hits.
- pre-write-gates.ts:30-76 — FID gate content confirmed (reading
  2026-08-17).
- agents/recorder/recorder.ts — the Recorder definition file exists.
- dev/LEARNINGS.md:73-86 — lesson text confirmed.
- CHANGELOG.md:4802-4853 — "no deferrals" scope notes confirmed.
→ 8/8 citations verify.

AUDIT-2 (adversarial cross-check):

- A2.1 Can a silent deferral still happen? Only via a FID with no Step
  Status section — mitigated because the transition gate requires the
  section when steps are declared, and the operator sees the presentation
  requirement; the legacy path (FID with no steps) is unchanged by design.
- A2.2 Does anything break? Gates are conditional-on-section; FIDs with no
  section keep today's behavior. Tests cover both; ledger regression
  caught nothing else.
- A2.3 Does `converged` vs `analyzed` matter? The ledger's active set is
  the literal gate. `converged` is not a member → any FID marked
  `converged` would fail `validate:repository`. And `closed` in the active
  dir is also not in `ALLOWED_ACTIVE_STATUSES`, so the 6 wrongly-closed
  planning FIDs trip the ledger today as well — this FID standardizes the
  presentation of `blocked` steps before the `converged`/`closed`
  transition, so the machine reports *why* before the operator decides.
- A2.4 Enforcement layering is not redundant: pre-write (per-document
  parse) vs per-repo acceptance audit (ledger scan) — both needed by
  design, cross-checked.

AUDIT-3 (state-machine parallel): the transition `converged → closed`
must not be bypassable by writing the archive directly — the archive rule
(archive filenames must match ledger) plus Part D's archive scan close
this.

### SELF-CORRECT

- SC1: `Status: converged` is NOT a legal active status (ledger) — this
  file uses `analyzed`; the action note was moved to Resolution.
- SC2: ECHO.md / echo-single-agent amendments were in the draft green
  scope; moved out — operator-approval-gated (Part F), matching the
  dual-version retrofit precedent.
- SC3: the build order's `steps:` YAML concept replaced with the section
  + checkbox form (consistent with existing md section parsing; no new
  markdown frontmatter support in fid-validator).

AUDIT re-run: zero actionable improvements → COMPLETE.

### Missed Questions

1. Should `converged` be added to `ALLOWED_ACTIVE_STATUSES` so the
   documented vocabulary matches the enforcement set (exactly the
   2026-08-16 word drift that let `converged` planning FIDs pass the
   plan but fail the ledger)? Two ways: (a) keep this FID's `analyzed`
   and fix the README, or (b) add `converged` to the set (broader
   change; needs its own FID/operator call).
2. Should an active FID with zero Step Status section be permitted at
   `closed` at all (i.e., pre-ECHO legacy FIDs)? Intentionally yes today —
   requiring the section retroactively invalidates 40+ historical/archived
   FIDs; revisit for 0.0.26+.

### Code Verification Evidence

All evidence verified 2026-08-17 against the working tree after implementation:

- `validateFidStepStatus` — `packages/agent-runtime/src/echo/fid-validator.ts`
  (new exported pure function; section regex, approval/deferral patterns,
  advisory prefix). Barrel export added in `echo/index.ts`.
- Pre-write transition gate — `packages/agent-runtime/src/echo/pre-write-gates.ts`
  (FID gate now runs `validateFidStepStatus` on any FID write declaring
  `converged`/`closed`; unresolved steps → hard block listing them).
- Ledger archive scan — `scripts/fid-ledger.ts` (`validateFidStepLedger`
  scans active + archived FIDs; `fid.steps.unresolved` fails closed;
  appended to `validateActiveFidLedger`).
- Recorder + Adversary instructions — `agents/recorder/recorder.ts`
  (step-status archive rules), `agents/adversary/adversary.ts` (checklist
  item 10: silent-deferral check).
- Tests: `fid-validator.test.ts` (11 cases), `pre-write-gates.test.ts`
  (5 new gate cases), `fid-ledger.test.ts` (4 new scan cases).

Gates (all exit 0): agent-runtime suite 1001 pass / 0 fail; typecheck ×4
(sdk/common/agent-runtime/cli); `eslint . --max-warnings 0`; `lint:md`;
`prettier --check`; `bun run validate:repository` (PASS, incl. the new
step-status scan against the live tree — no existing FID carries a Step
Status section, so the scan is a clean no-op today).

## Resolution

- **Status:** `closed` — implemented 2026-08-17, all Parts A–F shipped,
  every gate green, operator-approved for implementation.
- **Build order:** `dev/build-orders/2026-0816-anti-deferral-gate-build-order.md`
  updated to SUPERSEDED with a pointer to this FID.
- **Implemented:** Part A (Step Status inventory format — this FID's
  grammar is the contract), Part B (validator), Part C (pre-write gate),
  Part D (ledger scan), Part E (Recorder + Adversary), Part F (tests).
- **Not:** retroactive audit of archived FIDs (explicitly out of scope);
  ECHO.md wording (operator-gated).

## Lessons Learned

- Approved scope is a contract: make it machine-checkable at the exact
  transition points that already firewall (pre-write gate, ledger,
  validator) — prose policies (CHANGELOG "no deferrals" notes) do not
  survive cross-model sessions.
- Vocabulary drift between documentation (README status list) and
  enforcement (ledger allowed-set) silently widens the enforcement gap —
  reconcile the machine set with the docs in-loop or docs become a lie
  the gate enforces against.
- Converged ≠ closed (dev/LEARNINGS.md:73-86). A planning record must
  never enter the archive without implementation evidence; the step-status
  gate is the mechanism that makes "blocked was never presented" machine
  checkable — and it is the direct answer to the two incidents cataloged
  in RED.