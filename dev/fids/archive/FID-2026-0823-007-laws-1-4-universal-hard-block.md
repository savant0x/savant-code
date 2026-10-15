# FID: Laws 1 and 4 gate only in strict mode — elevate to universal hard blocks

**Filename:** `FID-2026-0823-007-laws-1-4-universal-hard-block.md`
**ID:** FID-2026-0823-007
**Severity:** high
**Status:** closed
**Created:** 2026-08-23 14:40
**YAGNI-Compliance:** Verified

> **Numbering note:** originally allocated as FID-2026-0823-005 during drafting; renumbered to -007
> after a concurrent session archived a different FID under -005 and registered -006 active (ID
> collision caught by CHANGELOG cross-check before closure).

---

## Summary

ECHO.md declares Laws 1-4 "Immutable Process Laws - ALWAYS enforced", but the harness gates Law 1
(read-before-write) and Law 4 (call-graph reachability) on the enforcement tier: both hard-block ONLY in
strict mode (`all_15`) and are advisory-or-inert in HYBRID (`core_4`) — the mode users actually run.
Operator directive 2026-08-23: Laws 1-4 must be hard blocks in every mode. Law 3 already blocks
universally (verified); Law 2 is approval semantics with no mechanical tool-gate surface (documented as
such). This FID elevates Laws 1 and 4 to unconditional blocks and locks the new contract with tests,
including the previously untested Law 4 gate.

## Environment

- **OS:** Windows (Git Bash / MSYS)
- **Language/Runtime:** TypeScript strict monorepo, Bun 1.3.14
- **Tool Versions:** bun test 1.3.14, eslint 9.x, prettier 3.x
- **Commit/State:** working tree on `main` @ v0.0.27 + unreleased hardening
  (release-only-commits convention)

## Detailed Description

### Problem

- Law 1: `packages/agent-runtime/src/echo/pre-write-gates.ts` gated the block behind
  `tier === 'all_15'`. In core_4 the write proceeded and only the non-blocking
  `EchoComplianceTracker` emitted a receipt afterward. Operators observe edits proceeding without a
  prior tracked read.
- Law 4: `packages/agent-runtime/src/echo/law4-turn-end.ts` set `blocked = tier === 'all_15'`. In
  core_4 unwired features produced an advisory warning at turn end that nothing enforced.
- The tier system contradicted ECHO.md's own vocabulary: Laws 1-4 are "ALWAYS enforced"; only Laws
  5-15 are `strict_mode`-conditional.

### Expected Behavior

An edit to an existing unread file is BLOCKED in every execution mode until the file is read via a
tracked channel. A turn with wired-but-unverified features cannot end cleanly in any mode (bounded by
the existing turn-end breaker, FID-2026-0822-003 — a hard block, not an infinite hold).

### Root Cause

Tier gating inherited from the original hybrid-mode design (pre-write-gates.test.ts header documented
the inertness as deliberate, deferring to tracker receipts). The operator has overridden that policy:
immutable laws must block, not nag.

### Evidence

Independent Detective RED catalog (14 issues; subset material to this change):

- Law 1 tier gate existed at exactly one site: pre-write-gates.ts (Law 1 condition).
- Law 4 tier decision at law4-turn-end.ts; sole caller enforcement.ts:378; ZERO test coverage of
  evaluateLaw4TurnEnd anywhere (grep across repo: definition + import + call + re-export only).
- Old contract pinned by tests: pre-write-gates.test.ts new-file-hybrid and unread-existing-hybrid
  cases ("does NOT block ... tracker owns the advisory").
- Law 3 confirmed already universal: no tier guard in its pre-write block; tests pin hybrid blocking.
- Known limitation recorded, not fixed here (scope discipline): Law 4 verification credit heuristic
  credits ALL wired features when any command/pattern merely contains 'grep'/'find' — nominal
  guarantee (Detective ECHO-RED-002); priority-bumped follow-up now that Law 4 blocks hard.
- Accepted behavioral consequence (operator-directed strictness): files inspected only via terminal
  channels (cat/grep output) are NOT tracked reads, so editing them hard-blocks until a
  read_files/read_subtree call lands; the block reason is actionable (names the path).

## Impact Assessment

### Affected Components

- packages/agent-runtime/src/echo/pre-write-gates.ts (Law 1 condition + isNewFile probe ungating)
- packages/agent-runtime/src/echo/law4-turn-end.ts (unconditional block)
- packages/agent-runtime/src/echo/violation-handler.ts (disjoint-law invariant doc update)
- packages/agent-runtime/src/echo/__tests__/pre-write-gates.test.ts (contract flip)
- packages/agent-runtime/src/echo/__tests__/law4-turn-end.test.ts (NEW coverage)
- packages/agent-runtime/src/__tests__/echo-compliance-wiring.test.ts (hot-path proof flip)
- Behavior consumers: enforcement.ts evaluateTurnEnd aggregation (already honors blocked from any
  result) and loop-iteration.ts applyTurnEndEnforcement (bounded counters already handle holds)

### Risk Level

- [ ] Critical
- [x] High: changes default enforcement posture for every HYBRID session; false-positive blocks
      possible for terminal-channel-inspected files (accepted by operator directive; actionable message)
- [ ] Medium
- [ ] Low

## Proposed Solution

### Approach

Remove the tier conditions from the two immutable-law gates so they behave identically in core_4 and
all_15. No new machinery; the blocking plumbing (gate -> executor return, evaluateTurnEnd aggregation,
applyTurnEndEnforcement bounded hold) already exists and is exercised in strict mode today.

Law 2 note: present-before-act is approval semantics between agent and operator; there is no mechanical
predicate surface a tool gate can evaluate. Documented as procedural (ask_user / impact-analysis
workflow), unchanged by this FID. Law 3 requires no change (already universal).

### Steps

1. pre-write-gates.ts: Law 1 block becomes tier-independent;
   `targetPath && !filesRead.has(targetPath) && !isNewFile(targetPath)` -> blocked; existsSync probe
   runs in both tiers; comment records operator override, the no-exempt-path-carve-out fact
   (isExemptWritePath stays Law-3-only), and duplicate-receipt safety (recordWrite sits after gates on
   the dispatch path) — implemented
2. law4-turn-end.ts: drop the tier conditional — blocked whenever featuresWired has entries absent
   from featuresVerified; module docstring rewritten incl. bounded-hold semantics — implemented
3. pre-write-gates.test.ts: contract flipped — hybrid BLOCKS unread existing files; hybrid read-first
   passes; new-file exemption preserved both tiers — implemented
4. NEW law4-turn-end.test.ts: both-tier blocks, reason content, clean passes (closes zero-coverage
   finding) — implemented
5. violation-handler.ts: disjoint-law invariant doc updated to "Laws 1/3/4 universal; extended laws
   tier-gated" (Verifier spec-audit condition folded) — implemented
6. echo-compliance-wiring.test.ts: hot-path proof flipped to assert the [ECHO Enforcement] BLOCKED
   error with ZERO duplicate law1 receipts (Verifier spec-audit condition folded) — implemented
7. Battery: agent-runtime typecheck exit 0; focused suites green; eslint --max-warnings 0 on touched
   sources; scoped markdownlint on this FID OK — implemented

### Verification

See Loop 2 AUDIT pastes. Live-confirmation boundary (operator-side): next HYBRID session shows Law 1
blocks instead of advisories on unread edits — NEEDS-REVIEW for closure.

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: test packages/agent-runtime/src/echo/__tests__/pre-write-gates.test.ts
- gate: test packages/agent-runtime/src/echo/__tests__/law4-turn-end.test.ts
- gate: test packages/agent-runtime/src/__tests__/echo-compliance-wiring.test.ts

### Verification Receipt

- fingerprint: sha256:1cbe54c289f236c76131d93a7506184cc67e6443f6abb3e63201d7d9401a3195
- verified: 2026-08-24T00:09:23.470Z
- typecheck packages/agent-runtime: exit 0
- test packages/agent-runtime/src/echo/__tests__/pre-write-gates.test.ts: exit 0
- test packages/agent-runtime/src/echo/__tests__/law4-turn-end.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/echo-compliance-wiring.test.ts: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Detective catalog above (tier sites enumerated exhaustively; test contracts located;
  zero-coverage finding on Law 4; Law 3 universality confirmed).
- **GREEN:** Proposed Solution (two tier-condition removals + doc fixes + contract-flip/new tests).
- **AUDIT:** Independent Verifier spec review: PASS WITH CONDITIONS — conditions: fold
  violation-handler.ts doc-contract update into steps; resolve isExemptWritePath coverage, hidden
  hybrid-inert assertions, runPreWriteGates caller enumeration at implementation time.
- **ADVERSARIAL:** Verifier verdict STANDS with adjustments: violation-handler fix kept in-scope
  (LOW, doc-only); isExemptWritePath RESOLVED (Law-3-only — Law 1 gains NO exempt-path carve-out);
  runPreWriteGates callers RESOLVED (enforcement.ts sole production caller); hidden-assertion sweep
  PARTIAL (cli clean, sdk residual minimal); bounded-hold semantics note and both-tier law4 test
  coverage ordered folded into the spec; out-of-scope flag raised separately (vendored ripgrep missing
  breaks code_search — separate follow-up, not this FID).
- **CHANGE DELTA:** ~12 lines production code; ~120 lines test delta (<10% of touched files).

### Missed Questions

1. *Does universal Law 1 break the Recorder UPDATE workflow?* No — Recorder's contract is "read the
   file, then write_file"; CREATE is exempt via isNewFile.
2. *Can a blocked write double-fire a tracker receipt?* No — recordWrite (native.ts:444) sits AFTER
   the gates on the dispatch path; blocked writes never reach it (proven by the flipped wiring test:
   zero law1 receipts on a never-read write).
3. *Do subagent turns deadlock on Law 4 holds?* applyTurnEndEnforcement applies to main agents only
   and surrenders after bounded consecutive blocks (FID-2026-0822-003).
4. *Why not also fix the grep/find credit heuristic?* Out of scope (minimal-change discipline);
   recorded as ECHO-RED-002 with a priority bump now that Law 4 blocks hard.
5. *Why is Law 2 left code-free?* Its predicate (operator approval) has no tool-call representation;
   gating on ask_user usage would false-positive planning turns. Honest limitation, documented.
6. *Do dev/fids|scratchpad UPDATES bypass Law 1?* No — isExemptWritePath belongs to the Law 3 gate
   only (Adversary-resolved); existing-file updates there require a prior tracked read. CREATEs are
   isNewFile-exempt.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** Uncommitted working tree (release-only-commits convention; next release sweep
      carries it)
- [x] **File:line ranges:** pre-write-gates.ts (Law 1 condition + comments); law4-turn-end.ts
      (unconditional return + docstring); violation-handler.ts (invariant paragraph);
      __tests__/pre-write-gates.test.ts (header + flipped/added cases);
      __tests__/law4-turn-end.test.ts (new, 5 tests); src/__tests__/echo-compliance-wiring.test.ts
      (hot-path proof flip)
- [x] **Gate output:** agent-runtime typecheck exit 0 (TSC_OK); focused battery 65 pass / 0 fail /
      142 expect across 5 suites; eslint --max-warnings 0 ALL_LINT_OK on production+test sources;
      scoped markdownlint on this FID OK
- [x] **Reproducibility:** grep -c "FID-2026-0823-007" over the six touched files matches (comment
      anchors + test titles)
- [x] **Step statuses:** Steps 1-7 implemented; none deferred

### Code Verification Evidence

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution (all six Verifier contract checks PASS)
- [x] Typecheck/tests/lint pass with pasted tool output (Loop 2 AUDIT)
- [x] Production call-graph evidence: runPreWriteGates sole production caller enforcement.ts:256;
      evaluateLaw4TurnEnd sole caller enforcement.ts:378; consumer gate loop-iteration.ts:218;
      deserialization fallback run-programmatic-step.ts:101-104 unaffected
- [x] FID status reflects actual implementation state: `fixed`

Residual (non-blocking): `bunx prettier --check` reports style drift on four touched files —
binary/config mismatch class (cf. LEARNINGS two-prettier-binaries trap); canonical pre-push formatter
settles it before release.

### Loop 2 — Independent audit and self-correction

- **RED:** None — single implementation pass; one expected fallout item (wiring law1-receipt test)
  predicted by the spec AUDIT and flipped in the same pass.
- **GREEN:** Implementation per Steps 1-7 via direct writes + Forge relay where the EHEL write-gate
  tracker deadlocked (documented malfunction class, LEARNINGS kill-proof-probes-and-forge-relay).
- **AUDIT:** Independent Verifier implementation review: PASS WITH CONDITIONS — all six contract
  checks PASS (Law 1 tier-independence proven by hybrid-block/read-first-hybrid passes; Law 4 both-tier
  blocks via new suite; wiring proof asserts zero receipts + [ECHO Enforcement] BLOCKED error matching
  native.ts:310-326 emission path; typecheck/eslint clean). Conditions: prettier resolution pre-push
  (documented residual); this Recorder UPDATE (this document); CHANGELOG entry (landed alongside);
  live HYBRID confirmation post-restart (closure NEEDS-REVIEW). Observations recorded: unused
  mode/tier params in evaluateLaw4TurnEnd signature kept for call-site compat; grep/find credit
  heuristic priority-bumped as follow-up.
- **ADVERSARIAL:** Spec-loop adversarial pass completed pre-implementation (verdict stood); no new
  adversarial findings surfaced post-implementation beyond recorded observations.
- **CHANGE DELTA:** Final code delta ~15 lines production; ~130 lines tests (<10% of touched files).

### Loop 3 — Final convergence

Not entered — converged in two passes (circuit breaker satisfied).

- **Vendored-ripgrep follow-up RESOLVED (2026-08-23):** the out-of-scope flag raised in the Loop 1
  ADVERSARIAL pass ("vendored ripgrep missing breaks code_search") is closed with disk evidence: all five
  platform binaries are present and tracked (`sdk/vendor/ripgrep/`, mirrored to `sdk/dist/vendor/`),
  `rg.exe` executes (14.1.1), the sdk ripgrep suite passes 13 pass / 0 fail including the working-tree
  manifest+pin satisfaction case, and code_search was live-verified in-session.
## Resolution

- **Closed Date:** 2026-08-23 (operator-directed close; the live HYBRID-
  session confirmation boundary waived by the close directive —
  FID-2026-0823-005 waiver precedent)
- **Fix Description:** Tier conditions removed from Law 1 and Law 4 gates; contract-flip + new
  coverage tests; invariant doc updated
- **Tests Added:** Yes — law4-turn-end.test.ts (5 cases); pre-write-gates.test.ts flips + hybrid
  read-first case; echo-compliance-wiring.test.ts hot-path proof flip
- **Verification Evidence:** See Loop 2 AUDIT pastes (TSC_OK; 65/0/142; ALL_LINT_OK; FID_MDLINT_OK)
- **Archived:** Yes — moved to `dev/fids/archive/` 2026-08-23; CHANGELOG
  entry appended same day (working-tree closure, release-only-commits)

> When status is set to **closed**, move this file to `dev/fids/archive/` and append an entry to
> `CHANGELOG.md`.

## Lessons Learned

- Tier-gating immutable rules inside the implementation contradicts the constitution that names them
  immutable — the config axis (`core_4` vs `all_15`) should govern only the extended laws, never the
  process laws.
- A blocking gate with zero test coverage (Law 4) is one refactor away from silently breaking the tool
  executor; coverage is part of the gate, not an accessory.
- Concurrent sessions allocate FID numbers independently — cross-check CHANGELOG AND the archive
  directory before allocating, not just the active queue (this FID collided with an archived -005 and
  was renumbered to -007 pre-closure).