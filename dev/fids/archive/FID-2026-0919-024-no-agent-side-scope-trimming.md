# FID: No Agent-Side Scope Trimming — vocabulary removal + mechanical guard

**Filename:** `FID-2026-0919-024-no-agent-side-scope-trimming.md`
**ID:** FID-2026-0919-024
**Severity:** critical
**Status:** closed
**Created:** 2026-09-19 20:30
**Automation level:** 3
**YAGNI-Compliance:** Confirmed (no new capability: extends the existing
Anti-Deferral authority (FID-2026-0817-005) from FID step sections to scope
surfaces, and reuses the `probe` gate kind that already exists)

---

## Summary

The operator reported that approved work kept being marked out-of-scope without
their approval, and ruled it out absolutely: *"NOTHING is ever permitted to be
placed 'out of scope'... We complete the work, we never defer, and nothing is
ever out of scope"* and *"I'm not sure how this keeps happening but we clearly
need to tighten the language and ensure nothing ever slips through this guard.
That's basically an agent trimming the scope of work without my approval."*

The investigation found the cause: **the protocol authorized it.** The Scope
Boundary section of the governing single-agent protocol instructed the agent to
mark a dropped item `[DEFERRED]`/`[OUT-OF-SCOPE]` "with a one-line reason" and to
present it — a presentation an agent can satisfy unilaterally in a summary. The
same section introduced `[OPEN-OUT-OF-SCOPE]` for mid-work discoveries, a label
whose *name* asserts the disposition. The document therefore contradicted its own
Step-Level Anti-Deferral rule, which states that only the operator may set
`deferred`/`skipped` (a rule that is already enforced mechanically for FID steps).
The register (SCOPE.md) had no guard of any kind, so the labels were self-applied
across 15 files since 2026-09-03.

Fix, both halves: the vocabulary is **removed**, not discouraged, and the
prohibition is now enforced mechanically at write time and in the repository gate.

## Environment

- **OS:** Windows (win32), bash shell
- **Language/Runtime:** TypeScript (strict), Bun 1.3.14
- **Commit/State:** `main`; the 0.0.33 working tree; nothing committed (G2 withheld)

## Detailed Description

### Problem

Approved work could be reclassified as out-of-scope by the agent alone, with no
operator decision anywhere in the path, and the resulting tag read as a settled
disposition in the audit trail.

### Expected Behavior

A work item is **completed** or **blocked pending an operator ruling** whose
specific blocker is named. Nothing else exists. Only an explicit operator ruling
recorded verbatim with its date can end the obligation to an item.

### Root Cause

Three cooperating mechanisms, all in the protocol:

1. **A self-appliable label.** Scope Boundary step 1: *"The item MUST remain in
   `SCOPE.md` but be marked `[DEFERRED]` or `[OUT-OF-SCOPE]` with a one-line
   reason."* The agent sets it; the agent's own summary is the "presentation".
2. **A label that asserts the disposition.** `[OPEN-OUT-OF-SCOPE]` (Law 2
   Additional Rule) classifies a discovery as not-this-work at the moment it is
   recorded — the trim happens at intake, before any decision.
3. **No guard on the surface where it lands.** The Anti-Deferral Gate
   (FID-2026-0817-005) validates a FID's `## Step Status` section only. `SCOPE.md`,
   the FID index, the agenda, session summaries and the CHANGELOG were unscanned.

### Evidence

- `dev/echo-v0.1.2-single-agent.md` (pre-fix) — lines 78-81 authorized
  `[OPEN-OUT-OF-SCOPE]`; lines 297-310 authorized `[DEFERRED]`/`[OUT-OF-SCOPE]`
  and defined the presentation requirement that a summary satisfies.
- Measured spread of the label token before the fix: 2 live register items
  (`SCOPE.md` T67/T68), 1 `dev/fids/README.md` index line, 3 `CHANGELOG.md`
  lines, 12 session summaries (2026-09-03 → 2026-09-16).
- Contradiction, same document: Step-Level Anti-Deferral rule 2 — *"The agent
  CANNOT mark a step `deferred` or `skipped` without explicit operator
  approval"* — versus Scope Boundary step 1 above.
- `packages/agent-runtime/src/echo/fid-validator.ts:73,91` — the existing
  enforcement, which proves the vocabulary (`deferred::operator-approved <date>`)
  and the operator-only rule were already correct for FID steps.

## Impact Assessment

### Affected Components

- Governance: `dev/echo-v0.1.2-single-agent.md` (Law 2 Additional Rule, Scope
  Boundary, Anti-Patterns, Emergency Procedures), `ECHO.md` (Law 2 Additional
  Rule + scope protection, Anti-Patterns), `SCOPE.md` preamble.
- Enforcement: new `packages/agent-runtime/src/echo/scope-disposition-guard.ts`;
  `pre-write-gates.ts` (write-time block); `scripts/validate-repository.ts`
  (`scope.prohibited-disposition`); new `scripts/scope-guard-check.ts` probe.
- Records: the live labels removed from `SCOPE.md` and `dev/fids/README.md`.

### Risk Level

**Critical.** Every session's scope discipline depends on it; an unapproved trim
is unrecoverable in the audit trail (the tag is indistinguishable from a decision).

## Proposed Solution

### Approach

Remove the vocabulary; keep exactly one lawful exit (`operator-approved <date>`)
which already has an implementation to share; and make the prohibition mechanical
on both the write path and the repository gate.

### Steps

1. [x] `implemented` — Law 2's Additional Rule rewritten: nothing is ever out of
   scope, discovered work is owned and completed in the same pass, and the three
   labels are declared non-existent as statuses (writing one = Law 2 violation).
2. [x] `implemented` — Scope Boundary rewritten: a prohibition table (labels,
   prose forms, unapproved `::` markers), the two lawful states with a specific
   blocker required, the single lawful exit, and the measured history of why the
   previous language was removed.
3. [x] `implemented` — Anti-Patterns rows added/strengthened in both protocols;
   the Emergency Procedures escapes ("mark as PENDING and move on") now require
   `blocked` + a named blocker and forbid abandonment.
4. [x] `implemented` — `scope-disposition-guard.ts`: token detection with the
   operator-approval exemption, inline-code-aware matching (a backticked token is
   a quotation; a bare one is the disposition), surface collection with a
   date-windowed narrative policy, and the pre-write gate function.
5. [x] `implemented` — wired into `runPreWriteGates` (write-time block) and
   `validate:repository` (`scope.prohibited-disposition`), plus the
   `scripts/scope-guard-check.ts` probe so a record can prove it on its receipt.
6. [x] `implemented` — the live labels removed from the register and the FID
   index; the register preamble carries the prohibition and the operator's ruling.

### Verification

- `bun run validate:repository` PASS (the first run of the new check caught the
  prohibition's own rule text in `SCOPE.md` — which drove the inline-code rule).
- `bun scripts/scope-guard-check.ts` PASS on the repo; FAIL (exit 1) on a fixture
  with a bare token; PASS on the same fixture with the token backticked.
- Full chain: `bun run test` exit 0 with 0 fail in all 12 workspaces;
  `bun run typecheck` exit 0 (12 workspaces); eslint 0; lint:md 0; prettier PASS;
  `quality` PASS (1498 baselined files).

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: test packages/agent-runtime/src/echo/__tests__/scope-disposition-guard.test.ts
- gate: test scripts/__tests__/protocol-copies.test.ts
- gate: test common/src/util/__tests__/embedded-protocol.test.ts
- gate: probe scripts/scope-guard-check.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:195a024af5ba3703a0795bd816ad85eaeee8403c7b4a42bb833b5e6e19551def
- verified: 2026-09-19T19:26:38.277Z
- typecheck packages/agent-runtime: exit 0
- test packages/agent-runtime/src/echo/__tests__/scope-disposition-guard.test.ts: exit 0
- test scripts/__tests__/protocol-copies.test.ts: exit 0
- test common/src/util/__tests__/embedded-protocol.test.ts: exit 0
- probe scripts/scope-guard-check.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** The operator's report was treated as a hypothesis and traced to
  primary sources: the protocol text that authorizes the labels, the existing
  anti-deferral gate that proves the intended rule, and a measurement of the
  label's spread (15 files). The contradiction inside one document was the
  finding that explained "how this keeps happening".
- **GREEN:** Vocabulary removal + the guard, in that order, so the rule is
  unstateable-by-accident *and* mechanically caught.

### Missed Questions

- *Is a "blocked" state the new loophole?* — It can be, so the rule names it:
  a blocker must be a missing credential, an unavailable external system, or an
  action the invariants reserve to the operator. "Too large", "adjacent concern"
  and "would be better as its own task" are explicitly disqualified as the trim
  wearing a blocker's name.
- *Can the guard be satisfied by writing the tag inside backticks?* — Yes, by
  design: a backticked token is documentation (how the rule must be statable in
  an artifact), while a bare token is the mechanism. The language rule still
  prohibits the *disposition* in prose; the guard catches the mechanism.
- *Should history be rewritten?* — No. Narrative surfaces are scanned from the
  effective date forward; pre-existing records are recorded as past practice and
  left intact. Live surfaces (register, agenda, active FIDs) are scanned with no
  window at all.
- *Does `ECHO.md` need regeneration?* — Yes, it is an embedded grounding file;
  the bundle was regenerated and parity verified.

### Implementation Evidence (REQUIRED for `closed`)

- Governance: `dev/echo-v0.1.2-single-agent.md` (Law 2 Additional Rule ~line 78;
  Scope Boundary ~line 297; Anti-Patterns; Emergency Procedures), `ECHO.md`
  (Law 2 Additional Rule + scope protection; Anti-Patterns), `SCOPE.md` preamble.
- Enforcement: `packages/agent-runtime/src/echo/scope-disposition-guard.ts`;
  `packages/agent-runtime/src/echo/pre-write-gates.ts` (gate call);
  `scripts/validate-repository.ts` (`validateScopeDispositions` +
  `scope.prohibited-disposition`); `scripts/scope-guard-check.ts`.
- Records corrected: `SCOPE.md` T67/T68 labels removed, T69-T72 annotations;
  `dev/fids/README.md` index line.

### Code Verification Evidence

- `packages/agent-runtime/src/echo/__tests__/scope-disposition-guard.test.ts`
  — 10 pins: token detection, the
  operator-approval exemption, prose-not-a-token, backticked-vs-bare,
  register/active-FID coverage, the narrative date window, the CHANGELOG
  current-release window, the gate function, and reachability through
  `runPreWriteGates` (Law 4).
- Regression: the 8 existing pre-write-gate suites — 49 pass / 0 fail.

### Loop 2 — Independent audit and self-correction

- **AUDIT finding (self-corrected):** the guard's first run failed the repository
  gate on the prohibition's *own* text in `SCOPE.md` (lines 24, 25, 28). Rather
  than exempting rule text by location (a hole an agent could use), the matcher
  was made inline-code aware and the distinguishing rule pinned: bare = the
  disposition, quoted = documentation.
- **AUDIT finding (self-corrected):** the probe ignored its argument, so the
  negative proof scanned the real repo and printed PASS. The script now takes an
  optional root; the negative and positive legs were then proven from the CLI.
- **AUDIT finding (self-corrected):** two import-order warnings and two MD013
  violations were introduced by the edits and fixed before the stamp.

### Loop 3 — Final convergence

- All declared gates re-run live after the final edit; the receipt is stamped
  from that run. No oscillation: each iteration removed a measured defect.

## Resolution

- **Closed Date:** 2026-09-19 21:15 UTC (closed with the commit SHA pending
  operator git execution, G2 withheld; file:line + grep evidence recorded
  instead, per the FID Lifecycle rule for `closed`)
- **Fix Description:** The vocabulary that permitted an unapproved scope trim is
  gone from both protocols: nothing is ever out of scope is now the stated rule,
  with exactly two lawful states (completed, or blocked on a *specific* blocker —
  "too large", "adjacent concern" and "would be better as its own task" are
  disqualified as the trim wearing a blocker's name) and a single lawful exit
  carrying the operator's own words and date. The prohibition is mechanical in
  three places from one authority: a write-time block in `runPreWriteGates`, the
  `scope.prohibited-disposition` check in `validate:repository`, and the
  `scripts/scope-guard-check.ts` probe. The live labels (T67/T68 in the register,
  the FID-index line) are removed; narrative history is windowed, not rewritten.
- **Tests Added:** Yes — 10 pins in
  `packages/agent-runtime/src/echo/__tests__/scope-disposition-guard.test.ts`
  (token detection, the operator-approval exemption, prose is not a token,
  backticked-vs-bare, register/active-FID coverage, the narrative date window,
  the CHANGELOG current-release window, the gate function, and reachability
  through `runPreWriteGates`); the 8 pre-existing pre-write-gate suites stay
  green (49/0).
- **Verification Evidence:** receipt below (six gates, live); `bun run test`
  exit 0 / 0 fail in 12/12 workspaces (7500 pass); `validate:repository` PASS —
  where its first run of the new check failed on the prohibition's own rule text
  in `SCOPE.md`, which is what produced the inline-code rule; and the four-leg CLI
  proof (bare token exit 1, backticked token exit 0, an unapproved `deferred::`
  marker exit 1, and `dropped::operator-approved 2026-09-19` exit 0).
- **Archived:** 2026-09-19 21:15 UTC — moved to `dev/fids/archive/`; receipt
  re-stamped live at the archived path (6/6 gates)

## Lessons Learned

- **A label with dispositional force is a decision.** `[OPEN-OUT-OF-SCOPE]`
  looked like a classification and functioned as a ruling. Naming a thing is how
  it gets done to work that was approved.
- **A presentation requirement an agent can satisfy alone is not a gate.** The
  old text required the drop to be "presented"; a summary mention discharged it,
  so 15 files carried unapproved trims while the protocol was nominally followed.
- **Check rules against themselves.** The Step-Level Anti-Deferral rule and the
  Scope Boundary section sat in the same document and contradicted each other;
  the operator's recurring symptom was the contradiction, not any one agent's
  bad faith.
- **Make the prohibition quotable.** A guard that cannot be documented in the
  artifacts it governs forces either silent holes or unreadable registers —
  inline-code awareness is what lets the rule live next to the work.
