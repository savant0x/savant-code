# FID: Verification-Contract Widening + Explicit Enforcement Reporting

**Filename:** `FID-2026-0919-021-fid-contract-widening-and-enforcement-report.md`
**ID:** FID-2026-0919-021
**Severity:** medium
**Status:** closed
**Created:** 2026-09-19 13:20
**YAGNI-Compliance:** Confirmed (widens an existing detector and makes an
existing skip explicit — no new capability, no new dependency, no new file
format; the only new module is the single truth for a decision that was
previously duplicated in three places)

---

## Summary

Auditing FID-2026-0918-007 against its own verification contract exposed two
holes in that contract, not in that FID. The FID-2026-0918-006 sweep reported
**0 errors / 0 warnings** over a document whose two new test suites were
covered by no declared gate: its promise pattern only matched the literal
wording "new (runtime) test", and it read only the `### Verification`
section, while the record names both artifacts in its Steps, Implementation
Evidence, and Resolution sections. Separately, the receipt contract skips
every status outside `fixed`/`verified` **silently**, which is how 284 of 315
archived `closed` records came to carry receipts whose fingerprint no longer
matches their content. Operator rulings (2026-09-19): widen the sweep so the
gap cannot recur silently, and treat the closed-record behavior as by-design
while stating it explicitly instead of skipping it.

## Environment

- **OS:** win32 (Git Bash)
- **Language/Runtime:** TypeScript, Bun 1.3.14
- **Tool Versions:** `fid:verify` / `fid-check` (FID-2026-0823-009,
  FID-2026-0918-006 lineage), `agent-runtime` echo contract modules
- **Commit/State:** branch `main`, working tree carries the change; the
  audited record FID-2026-0918-007 is archived at commit `0e0ffcd9`

## Detailed Description

### Problem

Two independent defects in the verification contract's mechanical layer:

1. **The promise detector was too narrow in two dimensions.** Pattern
   `/\bnew\s+(?:runtime\s+)?test\b/i` plus a scope of `### Verification`
   means a covered-only-by-luck artifact passes. FID-2026-0918-007 says
   "New/updated `<path>` suites green" (wording miss) and names its two new
   suites in `### Implementation Evidence` / Resolution (scope miss). Result:
   the contract reported clean over two ungated test artifacts — deleting
   either suite would have gone unnoticed by the gate battery.
2. **A skipped contract looked identical to a satisfied one.**
   `validateFidVerification` returns `[]` for any status outside
   `{fixed, verified}`, and `fid:verify --check` prints a flat PASS line. An
   operator cannot distinguish "checked and clean" from "not checked at all".
   The silent skip is how the 284-record drift accumulated unremarked.

### Expected Behavior

- A line that promises a test artifact — in any section, in either word
  order ("New/updated `<path>`", "`<path>` (new)", "Tests Added: `<path>`") —
  must name a repo-relative path covered by a declared `- gate: test`.
- A record the contract does not enforce must be reported as such, with the
  reason, and the report must never change the exit code.

### Root Cause

1. The FID-2026-0918-006 design was deliberately narrow as a *floor*: it
   documented that "anything the pattern misses remains covered by the manual
   double-audit checklist (single-agent protocol, method 2)". That fallback is
   a human role, and in single-agent operation the same agent that wrote the
   gaps performs the audit — the floor had no floor.
2. `validateFidVerification`'s early return conflated two distinct outcomes:
   "not applicable" and "clean". Both produced `[]`, and nothing downstream
   had a channel to report the difference.

### Evidence

```text
Before (narrow rule) — the real archived record, live:
  bun dev/scratchpad/active/fid-contract-check.ts \
      dev/fids/archive/FID-2026-0918-007-ripgrep-vendor-gap-no-path-fallback.md
  narrow sweep errors:   0
  narrow sweep warnings: 0

After (widened rule) — the SAME document, unchanged, before the amendment:
  narrow sweep errors:   3
    - verification-contract gap: promised test artifact
      "sdk/src/__tests__/ripgrep-path-fallback.test.ts" is not covered by a
      declared '- gate: test <path>' (FID-2026-0918-006)
    - verification-contract gap: promised test artifact
      "sdk/src/__tests__/ensure-ripgrep-vendor.test.ts" is not covered by a
      declared '- gate: test <path>' (FID-2026-0918-006)
    - (first artifact repeated from the Resolution "Tests Added" bullet)

After the FID-2026-0918-007 amendment (both suites declared as gates):
  declared gates (5); fingerprint match: true
  narrow sweep errors:   0
  narrow sweep warnings: 0

Drift measurement (dev/scratchpad/active/fid-receipt-staleness-audit.ts):
  scanned 405 FID files under dev/fids/
  closed: 315 file(s), 284 fingerprint mismatch
  31 match — the records re-stamped at the archived path in the
  2026-09-16/17 closure ceremonies

Causal proof for one record (git blobs, not inference):
  6e816902  Status: verified  stored sha256:3817c5e2… == fresh sha256:3817c5e2…
  3a0fe8dd  Status: closed    stored sha256:3817c5e2… != fresh sha256:2df003ba…
  (working-tree copy is byte-identical to the 3a0fe8dd blob)

Structured skip, before and after (validateFidVerification on a closed doc):
  before: []            — indistinguishable from a clean enforced record
  after:  []            — unchanged behavior …
  describeVerificationEnforcement(closed doc):
          { enforced: false, reason: 'status "closed" is outside
            {fixed, verified} — no live fingerprint guarantee: … '
```

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/echo/fid-verification-contract-sweep.ts`
  (promise rule)
- `packages/agent-runtime/src/echo/fid-verification-enforcement.ts` (new —
  the single enforcement authority)
- `packages/agent-runtime/src/echo/fid-verification-gates.ts` (consumes it;
  validator behavior unchanged)
- `scripts/fid-check.ts` (`--check` information tier)
- `scripts/fid-gates.ts` (status set de-duplicated, Law 13)
- `dev/echo-v0.1.2-single-agent.md` (closure receipt semantics documented)
- `dev/fids/archive/FID-2026-0918-007-…md` (amended: 2 gates + re-stamp)

### Risk Level

- [x] Medium: governance-integrity defect with a workaround (a record can be
  audited by hand), no runtime impact, no data loss. The widening does make
  the pre-write tripwire stricter: a FID flipping to `fixed`/`verified` now
  must gate every test artifact it promises *anywhere* in its own text.

## Proposed Solution

### Approach

1. **Widen the promise rule** (one rule, deterministic, still a floor): a
   promise is any line that names a repo-relative `*.test.ts(x)` path AND
   carries a novelty marker (`new`, `added`) on that same line, in either
   order, in any section; a bare filename (no directory separator) is a
   mention, not a commitment; the original `new (runtime) test` shape still
   reports a promise that names no path at all.
2. **Report the skip explicitly.** New pure module
   `echo/fid-verification-enforcement` owns the status parser and the
   enforced-status set. `validateFidVerification` asks it whether to enforce
   (single truth, so report and skip cannot disagree) and still returns `[]`
   for a skipped record — the pre-write tripwire and `--check` must not treat
   by-design drift as a structural failure. `fid:verify --check` gains an
   informational tier naming each active record outside the contract and why.
3. **Document the closure semantics** in the single-agent protocol.
4. **Amend FID-2026-0918-007** so the record that exposed the gap satisfies
   the widened contract.

### Steps

1. [x] `implemented` — RED pins for the widened rule (10 cases at RED incl.
   two false-positive guards; 12 after the Loop 2 audit) + the
   enforcement-report API (8 cases) → observed **5 fail** before the change.
2. [x] `implemented` — sweep widened; new enforcement module added; validator
   rewired through it; `--check` information tier added. The widened live
   tier pin was split into its own suite at audit when the sweep suite
   reached 304 lines (300 ceiling — see Loop 2 finding d).
3. [x] `implemented` — Law 13 consolidation: `scripts/fid-gates.ts` no longer
   defines its own status set/status parser (three copies existed).
4. [x] `implemented` — closure receipt semantics documented in
   `dev/echo-v0.1.2-single-agent.md` (FID Auto-Archive section).
5. [x] `implemented` — FID-2026-0918-007 amended with the two gates and
   re-stamped from a live five-gate run.

### Verification

- New suites: `scripts/__tests__/fid-contract-sweep-widened.test.ts` (11
  pins), `scripts/__tests__/fid-check-enforcement-tier.test.ts` (1 pin), and
  `packages/agent-runtime/src/echo/__tests__/fid-verification-enforcement.test.ts`
  (8 pins) — all three declared as gates below.
- Regression: `scripts/__tests__/fid-contract-sweep.test.ts`,
  `scripts/__tests__/fid-verify.test.ts`, `scripts/__tests__/fid-gates.test.ts`,
  `scripts/__tests__/fid-ledger-vocab.test.ts`, and
  `packages/agent-runtime/src/echo/__tests__/fid-verification-gates.test.ts`
  re-run green (declared below).
- Live: the widened sweep catches the real FID-2026-0918-007 gap (0 → 3
  violations) and reports 0 after the amendment; `fid:verify --check` PASSes
  repo-wide with the enforcement tier stated.

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: test scripts/__tests__/fid-contract-sweep-widened.test.ts
- gate: test scripts/__tests__/fid-check-enforcement-tier.test.ts
- gate: test packages/agent-runtime/src/echo/__tests__/fid-verification-enforcement.test.ts
- gate: test scripts/__tests__/fid-contract-sweep.test.ts
- gate: test scripts/__tests__/fid-verify.test.ts
- gate: test scripts/__tests__/fid-gates.test.ts
- gate: test scripts/__tests__/fid-ledger-vocab.test.ts
- gate: test packages/agent-runtime/src/echo/__tests__/fid-verification-gates.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:4a6dadaaa1aa0dc9d2b7d2f11eb8dfe249905ed6fa93fdeb7d0893e1a118408c
- verified: 2026-09-19T17:59:12.174Z
- typecheck packages/agent-runtime: exit 0
- test scripts/__tests__/fid-contract-sweep-widened.test.ts: exit 0
- test scripts/__tests__/fid-check-enforcement-tier.test.ts: exit 0
- test packages/agent-runtime/src/echo/__tests__/fid-verification-enforcement.test.ts: exit 0
- test scripts/__tests__/fid-contract-sweep.test.ts: exit 0
- test scripts/__tests__/fid-verify.test.ts: exit 0
- test scripts/__tests__/fid-gates.test.ts: exit 0
- test scripts/__tests__/fid-ledger-vocab.test.ts: exit 0
- test packages/agent-runtime/src/echo/__tests__/fid-verification-gates.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Both contract holes cataloged with live evidence, not inspection:
  the narrow sweep's 0-over-2-ungated-artifacts result, and the 284/315
  archived drift with one record causally attributed to a closure commit.
  RED pins written first and observed failing (5 fail / 5 pass in the widened
  suite; 1 error — module missing — in the enforcement suite).
- **GREEN:** Widened rule, enforcement module, `--check` tier, protocol
  documentation, and the FID-2026-0918-007 amendment.
- **AUDIT:** Pins 8/0 and 10/0 after the change; pre-existing contract,
  executor, gates, vocab, and validator suites green; live before/after
  evidence on the real archived record.
- **ADVERSARIAL:** See Loop 2.
- **CHANGE DELTA:** n/a (document creation).

### Missed Questions

1. Should the widened rule also demand the promised artifact EXIST on disk?
   → It already is enforced: a `gate: test` declaration is rejected by
   `safeRepoPath` at execution time when the path is missing, so an existing
   gate implies an existing artifact. Existence for *uncovered* artifacts is
   exactly what the sweep now surfaces by demanding coverage.
2. Should the widening apply to ARCHIVED records too? → No. The T69 ruling
   accepted the closed-record semantics as by-design, and `--check` reads the
   active queue only. Archived records are audited by the tooling in
   `dev/scratchpad/active/` on demand, which is how this FID's evidence was
   produced.
3. Does the widened rule make historical records fail retroactively? → It
   cannot: the sweep only runs over active records (`--check`) and over the
   proposed content of a write (pre-write tripwire). Archived records are
   pulled in only by an explicit path argument — which is how the 3 violations
   on FID-2026-0918-007 were measured.
4. Was the same status-set duplication really in scope? → Yes, by Law 13: this
   change made the set the single authority, and leaving two further copies in
   `scripts/fid-gates.ts` would have re-created the divergence the change
   exists to prevent.

### Implementation Evidence (REQUIRED for `closed`)

- [ ] **Commit SHA:** NOT YET ASSIGNED — G2 commit authorization is withheld
  by the operator (2026-09-19). Closure evidence is therefore the file:line
  ranges plus the grep match below, which the FID Lifecycle rule admits for
  `closed` ("commit SHA **or** file:line ranges + grep match"). The SHA is
  filled in here when the operator executes the commit.
- [x] **File:line ranges:** `packages/agent-runtime/src/echo/fid-verification-enforcement.ts`
  (new; `parseFidStatus`, `describeVerificationEnforcement`),
  `packages/agent-runtime/src/echo/fid-verification-contract-sweep.ts`
  (NOVELTY_MARKER / TEST_PATH rule, whole-document scan, PROMISE_SECTIONS
  pathless scoping),
  `scripts/__tests__/fid-check-enforcement-tier.test.ts` (new — ceiling split),
  `packages/agent-runtime/src/echo/fid-verification-gates.ts` (validator
  rewired through the enforcement authority),
  `scripts/fid-check.ts` (information tier in `checkAll`),
  `scripts/fid-gates.ts` (`VERIFIED_STATUSES` re-exported),
  `dev/echo-v0.1.2-single-agent.md` (FID Auto-Archive semantics),
  `dev/fids/archive/FID-2026-0918-007-ripgrep-vendor-gap-no-path-fallback.md`
  (gates + Loop 4 amendment + re-stamp)
- [x] **Gate output:** receipt below — all nine declared gates exit 0
- [x] **Reproducibility:** the three new suites exist at their declared
  paths; `grep -rn "describeVerificationEnforcement" packages scripts` finds
  the definition, the validator consumption, and the `--check` report
- [x] **Step statuses:** steps 1-5 all `implemented` (no silent deferral; the
  commit is the only outstanding item and it is operator-held, not dropped)

### Code Verification Evidence

- [x] Files referenced in Affected Components exist and contain the described
  code (verified by read + grep in this session)
- [x] Implementation matches the Proposed Solution (all five steps)
- [x] Typecheck/tests/lint pass with pasted output (receipt below)
- [x] Call-graph evidence: `describeVerificationEnforcement` ←
  `validateFidVerification` (`fid-verification-gates.ts`) ←
  `pre-write-gates-fid.ts` + `scripts/fid-check.ts` + `scripts/fid-gates.ts`
- [x] FID status reflects the actual implementation state (`verified` — the
  code exists and every declared gate passes; closure awaits the commit)

### Loop 2 — Independent audit and self-correction

- **RED:** Challenge the widening for false positives before trusting it.
  Three were found and closed by rule rather than by exception: (a) a bare
  filename on a novelty line (FID-2026-0918-007's Resolution says
  "`ripgrep.test.ts` exhaustion suite") would have been read as a promise for
  a path that no gate could name — the rule now requires a directory
  separator; (b) scanning the whole document means the gates section and the
  receipt are in scope — neither can produce a promise, since neither carries
  a novelty marker, and both are pinned; (c) **found by running the new rule
  against this very FID**, which it correctly rejected: whole-document scope
  let the preserved pathless branch fire on a descriptive Summary sentence
  ("a document whose two new test suites were covered by no declared gate").
  That is narration, not a commitment to produce a file, so the pathless
  branch is now restricted to the two sections whose prose actually promises
  an artifact (`### Verification`, `### Implementation Evidence`) while the
  path-requiring branch keeps whole-document reach. Both halves are pinned.
- **GREEN:** Corrections applied per the audit findings above: directory
  separator required for a path, and the pathless branch scoped to the
  promise sections. Pins: `ignores a bare filename on a novelty line`,
  `ignores gate declarations and receipt result lines`, `ignores a pathless
  "new test suites" mention in narrative prose`, `still reports a pathless
  promise inside ### Verification (original guard)`.
- **AUDIT:** Static: `typecheck packages/agent-runtime` exit 0; both new
  suites 8/0 and 12/0; five pre-existing suites green (30/0 for the two
  contract files, 12/0 for the gates + vocab pair). Manual re-read of the
  sweep's line loop confirmed the pathless branch is now reachable only from
  a promise section. The strongest audit signal was the new rule rejecting
  this record's own prose before the fix, then accepting it after — the
  detector was exercised against a real, adversarial input rather than
  fixtures alone.
- **ADVERSARIAL:** Does the explicit `--check` tier collide with the
  pre-existing warning tier's output assertions? No — the warning-tier test
  asserts that no `✗`-prefixed line names its fixture, and the new tier prints
  under its own header with `ℹ`. Pinned directly (the live tier test asserts
  both the presence of the reason and the absence of a `✗` attribution).
  Finding d: the widened sweep suite reached **304 lines** against the 300
  ceiling, so the live `--check` tier pin was split into
  `scripts/__tests__/fid-check-enforcement-tier.test.ts` (65 lines) on the
  FID-2026-0913-002 discipline — the `quality` gate caught this (exit 1), not
  review, which is why the gate was run before trusting the stamp.
- **CHANGE DELTA:** New module + 3 new suites + 4 edited files + 1 protocol
  paragraph + 1 archived-record amendment.

### Loop 3 — Final convergence

- **RED:** Converged — both contract holes are now mechanically detectable,
  proven on the real record that exposed them (0 → 3 → 0 across the
  amendment).
- **GREEN:** Converged — no further changes after the receipt stamp.
- **AUDIT:** Converged — ten declared gates exit 0 live; repo-wide
  `fid:verify --check` PASS with the enforcement tier stated; `quality:report`
  PASS; eslint, lint:md, and prettier clean on the touched files.
- **ADVERSARIAL:** Residual honest boundaries: (1) the enforcement tier
  reports active records only — archived drift stays visible only to the
  on-demand tooling, per the T69 ruling; (2) the widened rule remains a floor,
  not a proof: wording that never says "new"/"added" still relies on the manual
  double-audit; (3) the harness-side governance documents (`ECHO.md`,
  `templates/FID-TEMPLATE.md`) were deliberately not edited — the template is
  an embedded grounding file, so a change there obliges a protocol-bundle
  regeneration, which is a separate operator decision and is presented as
  such rather than silently absorbed.
- **CHANGE DELTA:** None after the stamp.

## Resolution

- **Closed Date:** 2026-09-19 17:58 UTC (closed with the commit SHA pending
  operator git execution, G2 withheld; file:line + grep evidence recorded
  instead, per the FID Lifecycle rule for `closed`)
- **Fix Description:** The verification contract now detects promised test
  artifacts by meaning rather than by one wording in one section, and states
  which records it does not enforce instead of returning an indistinguishable
  clean result.
- **Tests Added:** Yes — 20 new pins across three new suites (widened sweep
  semantics incl. false-positive guards; the live `--check` tier; enforcement
  reporting incl. the validator's unchanged non-blocking behavior).
- **Verification Evidence:** receipt below (ten gates, live); before/after
  evidence on the archived record in the Evidence section above; full
  transcript in `dev/session-summaries/2026-09-19-1330-fid-021-contract-widening.md`.
- **Archived:** 2026-09-19 17:58 UTC — moved to `dev/fids/archive/`; receipt
  re-stamped live at the archived path (10/10 gates)

## Lessons Learned

A verification contract that reports "no findings" is only as trustworthy as
its detector's reach. When a detector is deliberately narrow, the narrowness is
itself unaudited — and in single-agent operation the manual fallback it relies
on is performed by the same agent whose gaps it would catch. Two habits follow:
make the detector's rule explicit enough to test with the real document that
exposed it, and make "not checked" a visible outcome rather than a shape that
looks exactly like "checked and clean".
