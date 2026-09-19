# FID: FID Verification Contract Is Prose-Only And Never Mechanically Checked

**Filename:** `FID-2026-0918-006-fid-verification-contract-gap.md`
**ID:** FID-2026-0918-006
**Severity:** medium
**Status:** verified
**The contract applies to its author first:** this FID's own Verification
section promises a new test and therefore declares its gate (`gate: test
scripts/__tests__/fid-contract-sweep.test.ts`) — the sweep validated this
document in the state you are reading (Loop 3 ADVERSARIAL).
**YAGNI-Compliance:** Confirmed (Loop 3 — narrow promise pattern only; no
probe promises, no LLM review)

---

## Summary

A FID's `### Verification` section (under Proposed Solution) is a contract —
it names the test artifacts that must exist before `verified` status is
earned — but nothing mechanical checks it. `fid:verify` executes only the
declared `## Verification Gates`; the prose promises are never cross-checked
against declared gates or files on disk. In FID-2026-0918-004, the
Verification section promised a runtime test that was never written, and the
loop still granted `verified`. It was caught only by the Adversary reading
the FID against the tests — a role that does not exist in single-agent
sessions, where the gap is therefore unclosable by any current mechanism.

## Environment

- **OS:** win32 (Git Bash)
- **Language/Runtime:** TypeScript, Bun 1.3.14
- **Tool Versions:** `scripts/fid-verify.ts` (root script `fid:verify`),
  `@savant-code/agent-runtime/echo/fid-verification-gates`
- **Commit/State:** observed during FID-2026-0918-004 session (branch
  `main`, 4 commits ahead of origin)

## Detailed Description

### Problem

FID-2026-0918-004's Verification section promised: "New runtime test:
micro-compact with `tokensSaved > 0` emits exactly one `compaction_summary`."
Its declared gates were `typecheck cli`, `typecheck packages/agent-runtime`,
`test cli/src/state/__tests__/chat-store-compaction.test.ts`, and `quality`
— none of which executes or even references the promised Part 2 test. The
FID reached `verified` with the promise unfulfilled; the promised test
(`context-tokens-compaction-micro-summary.test.ts`) was written only after
the Adversary flagged the omission. In a single-agent session no Adversary
exists, and the double audit (static analysis + manual re-read) has no
checklist item forcing the Verification-section cross-check.

### Expected Behavior

A FID cannot reach `fixed`/`verified` (or pass `fid:verify --check` /
`validate:repository`) while its Verification section names a test artifact
that no declared `gate: test` covers and that does not exist on disk. The
contract must be machine-checkable, not honor-system.

### Root Cause

1. `fid:verify` (`scripts/fid-verify.ts:1-28` header;
   `parseVerificationGates` / `validateFidVerification` from
   `packages/agent-runtime/src/echo/fid-verification-gates.ts`) parses and
   executes ONLY the `## Verification Gates` declarations. The
   `### Verification` prose is never read by any validator.
2. The template (`templates/FID-TEMPLATE.md:84-99`) documents gates as
   "mandatory once status flips to `fixed`/`verified`" (FID-2026-0823-009)
   but imposes no correspondence between prose promises and declared gates.
3. The protocol's FID Ground-Truth rule and Code Verification Evidence
   checklist are manual disciplines — exactly the steps a hurried loop
   skips, and exactly what the single-agent mode lacks a second reader for.

### Evidence

```text
dev/fids/archive/FID-2026-0918-004-compaction-signal-repin-retirement.md
  ### Verification (excerpt):
    "- New runtime test: micro-compact with `tokensSaved > 0` emits exactly
       one `compaction_summary`."
  ## Verification Gates (full set):
    - gate: typecheck cli
    - gate: typecheck packages/agent-runtime
    - gate: test cli/src/state/__tests__/chat-store-compaction.test.ts
    - gate: quality
  -> no declared gate covers the promised Part 2 test; status reached
     `verified` anyway (ADVERSARIAL loop note confirms the OMISSION finding).

scripts/fid-verify.ts:1-28
  "Reads a FID's `## Verification Gates` declarations, maps each to an
   ALLOWLISTED command shape ... executes them against the current tree"
   — no prose-contract surface exists.

dev/agenda.md — FID verification-contract gap entry:
  "a FID's Verification section named a runtime test that was never written;
   the loop still granted `verified`. Caught only by the Adversary, not by
   any gate." recurrences: 1 (total 1)

dev/session-summaries/2026-09-18-1945-compaction-signal-repin-retirement.md
  Issue 5 (process).
```

## Impact Assessment

### Affected Components

- `scripts/fid-verify.ts` + `scripts/fid-gates.ts` — gate executor
- `packages/agent-runtime/src/echo/fid-verification-gates.ts` — parser /
  validator
- `templates/FID-TEMPLATE.md` — contract surface documentation
- Every future FID closure, and every single-agent session (no Adversary)

### Risk Level

- [x] Medium: verification integrity silently violated; no data loss;
  workaround (manual adversarial review) exists but is exactly the step the
  failure mode skips

## Proposed Solution

### Approach

Make the Verification section machine-checkable with a narrow, deterministic
**contract sweep** in the validator:

1. For FIDs at status `fixed` / `verified` / `closed`, extract test-artifact
   promises from the `### Verification` section using a narrow documented
   pattern: lines matching /\bnew\s+(runtime\s+)?test\b/i (case-insensitive).
2. Require each matched promise to correspond to a declared
   `- gate: test <path>` line whose path exists on disk (path may be named
   in the promise line itself or anywhere in the gates block; the promise
   must name the path to count as covered).
3. Wire the sweep into `validateFidVerification` so both `fid:verify
   --check` (single-file and repo-wide) and `validate:repository` report a
   violation (fail-closed for NEW stamps; existing already-stamped archived
   FIDs are grandfathered and reported as warnings in `--check` sweep output
   until individually re-stamped — mirrors the re-stamp convention used in
   prior closure ceremonies).
4. Update `templates/FID-TEMPLATE.md`: the Verification section must name
   the artifact path for every promised test, and that path must appear as a
   declared `gate: test`.

Why narrow: a broad NL promise-parser would false-positive on ordinary prose
and erode trust in the validator. The chosen pattern matches the exact shape
observed in the wild (FID-2026-0918-004) while leaving general prose alone.
Anything the pattern misses remains covered by the manual checklist item
below.

Complementary process fix (no code): add to the single-agent Double Audit
method-2 checklist — "re-read the FID's Verification section against the
declared gates and the tests on disk" — so solo sessions get the Adversary's
OMISSION check by discipline until the sweep exists.

Alternatives considered and rejected:

- *Rely on the Adversary* — rejected: absent in single-agent mode, which is
  precisely where the failure occurred uncaught.
- *Require every Verification sentence to be a gate* — rejected: makes
  honest prose impossible; over-broad.
- *LLM-based contract review* — rejected: non-deterministic, not
  allowlisted, violates the fid:verify design contract.

### Steps

1. [x] DONE — promise parser + contract sweep in
   `echo/fid-verification-contract-sweep.ts` (own module; gates.ts was at
   286 lines) wired into `validateFidVerification` (error tier on
   receipt-bearing docs); grandfathered warning tier API-visible.
2. [x] DONE — `--check` sweep + warning enumeration in
   `scripts/fid-check.ts` (verbatim `checkAll`/`activeFidFiles` move,
   re-exported from `fid-verify.ts`); `--write` stamp path flows through
   `validateFidVerification`, so a contract gap fails the stamp;
   `validate:repository` flows through the same validator.
3. [x] DONE — `scripts/__tests__/fid-contract-sweep.test.ts` (new file): the
   four fixture shapes plus the live `fid:verify --check` negative proof
   (receipt-bearing fixture FID FAILS the repo-wide sweep; receipt-less
   fixture passes with an enumerated warning; fixtures destroyed after).
4. Update `templates/FID-TEMPLATE.md` (Verification section rule + pointer
   to FID-2026-0918-006) and the single-agent protocol's Double Audit
   checklist line.

### Verification

- New test `scripts/__tests__/fid-contract-sweep.test.ts` green (pasted
  output); `fid:verify --check` repo-wide sweep passes with the grandfather
  warnings expected and enumerated.
- Typecheck of the touched workspace(s); eslint `--max-warnings 0`; quality
  gate.
- Live negative proof: a fixture FID promising a nonexistent test fails
  `--check` with the new violation message; fixture destroyed after.

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: test scripts/__tests__/fid-verify.test.ts
- gate: test scripts/__tests__/fid-contract-sweep.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:e21724aec904fe98319ab884bdd71bb6510548ff7cf0d74e084c3694b3cb5c9b
- verified: 2026-09-19T02:23:13.099Z
- typecheck packages/agent-runtime: exit 0
- test scripts/__tests__/fid-verify.test.ts: exit 0
- test scripts/__tests__/fid-contract-sweep.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Gap cataloged above: prose contract has no mechanical surface;
  real occurrence in FID-2026-0918-004 (status reached `verified` with the
  promise unfulfilled); recurrence 1 on the learning agenda.
- **GREEN:** Contract sweep proposed (see Proposed Solution). Not
  implemented; awaiting operator approval.
- **AUDIT:** Document-level double audit performed in single-agent mode:
  markdownlint clean + manual re-read. No code exists yet to verify.
- **ADVERSARIAL:** Self-challenge: could the narrow pattern be gamed by
  rewording the promise? Yes — the sweep is a floor, not a proof; the manual
  checklist item covers rewording. Could grandfathering hide real gaps in
  archived FIDs? They are historical records of already-accepted evidence;
  warnings keep them visible.
- **CHANGE DELTA:** n/a (document creation).

### Missed Questions

1. Should the sweep also verify `gate: probe` promises? -> Out of scope
   (YAGNI): no observed occurrence; extend the pattern family only on a
   recorded recurrence.
2. What about promises phrased without "new test"? -> Covered by the manual
   checklist item; widening the parser needs evidence of a recurrence first.
3. Does this break the 291 archived FIDs' `--check` sweep? -> No: they are
   grandfathered to warnings, and the repo-wide sweep historically reports
   per-FID results, so the warnings are enumerable, not fatal.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** pending G2 (operator commit authorization; no silent
  deferral — presented at turn end)
- [x] **File:line ranges:** `echo/fid-verification-contract-sweep.ts` (new;
  sweep), `fid-verification-gates.ts` (wiring, sweep errors merged into
  validator output), `scripts/fid-check.ts` (new; warning tier),
  `scripts/fid-verify.ts` (facade), `scripts/__tests__/fid-contract-sweep.test.ts`
  (new; fixture shapes + live --check proof), `templates/FID-TEMPLATE.md`,
  `dev/echo-v0.1.2-single-agent.md`
- [x] **Gate output:** receipt below — typecheck/test/quality all exit 0
- [x] **Reproducibility:** `bun test scripts/__tests__/fid-contract-sweep.test.ts`
  → 7 pass / 0 fail (fixtures destroyed after; deterministic)
- [x] **Step statuses:** all 4 steps `implemented` (operator-approved
  scope, 2026-09-18; no deferrals)

### Code Verification Evidence

- [x] Files referenced in this FID exist; the 004 evidence excerpt verified
  by read 2026-09-18
- [x] Implementation matches Proposed Solution (sweep + wiring; Loop 2
  audit)
- [x] Typecheck/tests/lint pass with pasted output (receipt below; full
  battery transcript in the session summary)
- [x] No production call-graph change proposed (validator-side addition)

### Loop 2 — Independent audit and self-correction

- **RED:** Confirmed mechanically: `parseVerificationGates` consumes only
  the `## Verification Gates` section; the `### Verification` prose had no
  mechanical surface before the sweep.
- **GREEN:** Sweep implemented narrower than the proposal where the
  proposal over-reached: path coverage requires the promise line to NAME
  the path (keeps determinism); grandfathering keys on receipt presence
  (stamped-shape) rather than status text. Warning tier is API-visible,
  enumerated by `--check`, never fatal.
- **AUDIT:** Static: typecheck agent-runtime exit 0; eslint
  `--max-warnings 0`; quality PASS; receipt gates exit 0 ×3. Manual
  re-read of the sweep module, wiring, and fid-check found no drift. The
  step-3 promised tests exist and pass.
- **ADVERSARIAL:** (1) Gaming by rewording? The sweep is a floor — the
  manual checklist line covers rewording (unchanged from Loop 1).
  (2) Self-application: this document itself triggered the contract — its
  Verification prose names the new test file, so its gates must declare
  it (they now do); the sweep validated this exact state. (3) Discovered
  pre-existing ambiguity: gates parser accepts `gate: test <path>` where
  the path need not exist at validation time — `--write` catches it via
  `safeRepoPath` at execution, but `--check`'s structural scan does not
  verify existence. Flagged to the learning agenda as a candidate
  finding (out of scope: existence-checking is a validator-wide concern,
  not contract-sweep scope).
- **CHANGE DELTA:** `fid-verification-contract-sweep.ts` new;
  `fid-verification-gates.ts` wired (under ceiling); `scripts/fid-check.ts`
  new (verbatim move); `scripts/fid-verify.ts` facade (public surface
  unchanged); `scripts/__tests__/fid-contract-sweep.test.ts` new (7
  tests); template + single-agent protocol updated; protocol bundle
  regenerated.

### Loop 3 — Final convergence

- **RED:** Converged — gap proven with the 004 artifact; closed
  mechanically by the sweep (fixture proof green).
- **GREEN:** Converged — sweep live; this document validated under its
  own contract (self-application, Loop 2 ADVERSARIAL 2).
- **AUDIT:** Converged — all declared gates exit 0 (receipt below);
  eslint 0 warnings; lint:md clean.
- **ADVERSARIAL:** Converged — challenges resolved; one pre-existing
  parser ambiguity honestly flagged to the agenda (Loop 2).
- **CHANGE DELTA:** Final: see Loop 2 CHANGE DELTA; none after receipt
  stamp.

## Resolution

- **Closed Date:** pending G2 commit (operator authorization)
- **Fix Description:** Machine-checkable Verification contract: narrow
  "new (runtime )?test" promise pattern must map to a declared
  `gate: test <path>`; receipt-bearing docs fail validation on gaps;
  receipt-less docs warn (grandfathered tier); `--check` enumerates all
  gaps
- **Tests Added:** `scripts/__tests__/fid-contract-sweep.test.ts` (four
  fixture shapes + fenced-example exclusion + live `--check` negative
  proof, 7 pass / 0 fail)
- **Verification Evidence:** receipt below (typecheck/test/quality exit
  0); live negative proof transcript in the session summary
- **Archived:** pending G2 (moves to `dev/fids/archive/` with the commit)

## Lessons Learned

A contract that exists only as prose will be honored exactly as long as
someone remembers to check it. If a section of the FID template promises
artifacts, the validator that owns FID integrity must own that section too —
especially in single-agent operation, where the second reader does not exist.
