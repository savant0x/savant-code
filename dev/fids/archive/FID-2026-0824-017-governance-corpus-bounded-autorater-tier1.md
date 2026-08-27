# FID: Governance Task Corpus + Bounded Autorater + Tier-1 Pre-Push Smoke (Increment 3)

**Filename:** `FID-2026-0824-017-governance-corpus-bounded-autorater-tier1.md`
**ID:** FID-2026-0824-017
**Severity:** medium
**Status:** closed
**Created:** 2026-08-24 17:18
**YAGNI-Compliance:** Pending

Parent: `FID-2026-0824-013` (inherits amendments A1–A8).

---

## Summary

The corpus measures what the agent CAN do; nothing measures what it REFUSES to do.
This increment adds a governance task suite (role-boundary refusals, Law-1 traps,
FSM-legality replays), the tripartite grading pipeline with strict stage ordering,
a bounded out-of-process autorater behind forced-choice rubrics for qualitative
checks only, and wires a zero-token Tier-1 smoke into `.githooks/pre-push`
(operator decision 2026-08-24) inside a <30s budget.

## Environment

- **OS:** Windows 11 primary dev host; POSIX-compatible by contract
- **Language/Runtime:** TypeScript strict monorepo, Bun 1.3.14 (pinned), zod v4
- **Tool Versions:** `.githooks/pre-push` (existing gate chain); benchmark v2 runner
- **Commit/State:** main @ v0.0.27 prep (working tree, release-only-commits)

## Detailed Description

### Problem

1. No governance tasks exist — SoD refusals, Law-1 read-completeness, and FSM
   legality are enforced at runtime (EHEL) but never verified at eval time.
2. No autorater infrastructure exists for qualitative checks that lack
   deterministic signatures.
3. No cheap smoke tier guards protocol compliance on every push.

### Expected Behavior

Tier 1 runs five deterministic governance tasks against scripted/mock runners in
under 30 seconds at zero token cost; qualitative-only assertions route through an
origin-masked, forced-choice autorater invoked strictly after deterministic and
trajectory stages pass.

### Root Cause

Corpus and grading pipeline predate governed multi-agent behavior (blueprint ADR 4/5,
CONFIRMED for this increment; A8 narrows the scoring work already done).

### Evidence

```text
evals/v2/tasks/                    4 tasks — all capability, zero governance
.githooks/pre-push                 bundle + fid:verify + typecheck gates; no eval smoke
desktop/src/floor/__tests__/       PrintModeEvent scripting precedent (replay fixtures)
```

## Impact Assessment

### Affected Components

- `evals/v2/tasks/governance/` (new suite), `evals/v2/src/verify.ts` (pipeline order)
- `evals/v2/src/raters/` (new bounded autorater module)
- `.githooks/pre-push` (+ root `package.json` `evals:smoke` script)

### Risk Level

- [ ] Critical / [ ] High / [x] Medium: compliance blind spot — governed behavior is
      unverifiable today; push latency budget must be respected or the gate gets bypassed
- [ ] Low

## Proposed Solution

### Approach

Deterministic-first ordering is absolute: deterministic → trajectory → autorater;
the autorater NEVER salvages a mechanically failed run (ADR 1). Tier 1 uses mocked
runners replaying recorded PrintModeEvent scripts — zero tokens, zero network.

### Steps

1. Five Tier-1 governance tasks under `tasks/governance/`: FSM transition legality
   replay, Law-1 hidden-tail trap, Verifier write-refusal, provenance-enforce write
   block, anti-deferral step-status refusal.
2. Mock/scripted AgentRunner replay mode reusing the fixture-scripting precedent
   above; tasks declare expected traces, no live model calls.
3. Grading pipeline: enforce stage order + halt-on-failure semantics in verify.ts.
4. Bounded autorater module: out-of-process judge via operator-configured endpoint
   (A2/A5), forced-choice permutation-invariant rubric templates, origin masking,
   categorical output parsing.
5. Wire `bun run evals:smoke` into `.githooks/pre-push` after existing gates;
   timing-budget probe proves <30s cumulative.
6. Tests: stage-ordering violations fail loudly; rubric parser vectors; hook
   budget probe; each governance task's expected-failure path.

### Verification

Gates below plus one real pre-push run recording wall-clock evidence.

## Verification Gates

- gate: typecheck evals
- gate: test evals/v2/tests/verify.test.ts
- gate: test evals/v2/tests/governance-smoke.test.ts
- gate: test evals/v2/tests/rubric.test.ts

### Verification Receipt

- fingerprint: sha256:4133bbca20b74d42a6b590125910f7b2c9d09d61b0aa5121c8a564f5c85f5466
- verified: 2026-08-26T01:01:10.770Z
- typecheck evals: exit 0
- test evals/v2/tests/verify.test.ts: exit 0
- test evals/v2/tests/governance-smoke.test.ts: exit 0
- test evals/v2/tests/rubric.test.ts: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Grounding citations above (working-tree reads, 2026-08-24).
- **GREEN:** Solution specified; Tier-1 placement = pre-push per operator decision
  2026-08-24; autorater scope limited to qualitative-only checks with no
  deterministic signature (A5).
- **AUDIT:** Batched suite Verifier (2026-08-24): FAIL (receipts-pending absent) →
  discharged same session; forward-declared test paths noted for GREEN reconciliation.
- **ADVERSARIAL:** Clean (2026-08-24): no citation adjustments; pre-push gate chain
  and floor-fixture PrintModeEvent replay precedent corroborated; existing-substrate
  gate target verify.test.ts confirmed on disk.
- **CHANGE DELTA:** Initial authorship (n/a).

### Loop 2 — Deterministic Governance Corpus and Pipeline (2026-08-25)

- **IMPLEMENTED:** Added five deterministic governance replay tasks covering FSM
  transition legality, Law-1 read completeness, Verifier write refusal,
  provenance-denied writes, and anti-deferral refusal. Replays use typed
  `PrintModeEvent` traces and no model, token, or network access.
- **IMPLEMENTED:** Added `governance_replay` task metadata and the additive
  `governance` category to the v2 schemas. The Tier-1 CLI smoke loads all five
  manifests and fails closed on count, category, or replay-ID drift.
- **IMPLEMENTED:** Added the deterministic-first governance pipeline with explicit
  `deterministic → trajectory → autorater` stage order and halt-on-failure
  semantics, plus a bounded forced-choice autorater adapter with origin masking,
  timeout enforcement, and strict A/B parsing.
- **TESTS/GATES:** Eval typecheck passes; eval v2 suite **114 pass / 0 fail**
  across 16 files; focused governance/pipeline/rubric tests pass; ESLint
  zero-warning and Prettier pass; `bun run evals:smoke` passes all five tasks in
  under 30 seconds.
- **HONEST BOUNDARY (superseded by Loop 3):** endpoint configuration and full
  pre-push evidence were open at Loop 2 close.

### Loop 3 — Endpoint contract + closure evidence (2026-08-25)

- **DISCOVERED AHEAD OF HANDOFF:** the working tree already carried the
  operator-owned endpoint contract (`evals/v2/src/raters/endpoint.ts`, Loop-3
  annotations incl. a discharged Verifier finding) plus
  `evals/v2/tests/raters-endpoint.test.ts` — further than the prior session's
  handoff notes recorded. This loop verified rather than reimplemented.
- **ENDPOINT CONTRACT:** env-var-only configuration
  (`SAVANT_CODE_AUTORATER_URL/_KEY/_TIMEOUT_MS`); URL absence disables the
  adapter (`configured: false`); present-but-invalid values fail closed naming
  the variable, never its value; embedded URL credentials rejected; bearer key
  never echoed into errors/logs; `redirect: 'error'` blocks cross-origin
  Authorization relay; origin masking applied before any payload leaves the
  process.
- **TIER-1 ISOLATION:** the governance smoke constructs no HTTP transport —
  zero-token, zero-network by construction; the production endpoint stays
  unconfigured BY DESIGN (opt-in via env vars).
- **TESTS/GATES (this session):** raters-endpoint suite green within eval v2
  **133 pass / 0 fail** across 17 files · eval typecheck exit 0 · smoke **5/5**
  under budget · root typecheck chain ×12 exit 0 · eslint --max-warnings 0
  exit 0 · `bun run test` chain exit 0 · protocol bundle regenerated + drift
  check PASS · `fid:verify --check` PASS.
- **CROSS-STREAM FLAG:** desktop `src/hooks/use-gateway.ts:31` carried TS2206
  (inline `type` modifier inside an `import type` statement) blocking the
  shared gate — repaired out of scope (one line); chain green after.
- **PUSH-GATE EVIDENCE SHAPE:** gates were executed individually in parallel
  rather than as one sequential hook invocation (the operator interrupted the
  monolithic run twice). The credential scan is push-context-gated:
  `scripts/pre-push-scan.ts` parses hook stdin refs and fails closed without
  them (verified by source read); a live manual invocation awaits stdin and can
  never produce a verdict outside `git push`. Repo-wide prettier/markdownlint
  carry pre-existing cross-session drift OUTSIDE this FID's surface (59 files;
  docs/design + ledger prose) — preserved untouched per the handoff directive
  and owned by the upcoming tree-drain migration.

### Code Verification Evidence

Loop 3 verified against the working tree: `endpoint.ts` exports
(`resolveAutoraterEndpoint` / `httpAutoraterProcess` /
`makeEndpointGovernanceAutorater`) are exercised end-to-end by
`raters-endpoint.test.ts`; scoped grep shows no other consumers — the seam is
injectable-by-design and Tier 1 constructs no transport. Every gate command
above ran live this session with exit codes recorded in-line.

## Resolution

- **Closed Date:** 2026-08-25 — **Archived:** 2026-08-25 → `dev/fids/archive/`
- **Fix Description:** increment 3 complete — governance corpus (five zero-token
  replay tasks), deterministic-first pipeline, bounded forced-choice autorater,
  Tier-1 `evals:smoke` wired into `.githooks/pre-push`, and the operator-
  configured out-of-process endpoint contract.
- **Tests Added:** `raters-endpoint.test.ts`, `governance-pipeline.test.ts`,
  `governance-smoke.test.ts`, `rubric.test.ts` (inside the 133-test v2 suite).
- **Verification Evidence:** see Loop 3 gates; receipt stamped at the archived
  path per FID-2026-0823-009 mechanics.
- **Carried (never claimed passed):** single-shot sequential pre-push invocation
  evidence replaced by parallel per-gate evidence (operator-interrupted twice);
  repo-wide prettier/markdownlint drift owned outside this record.

## Lessons Learned

(pending — captured at closure)