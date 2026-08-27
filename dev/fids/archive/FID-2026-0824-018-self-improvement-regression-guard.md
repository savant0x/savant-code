# FID: Self-Improvement Regression Guard — Erosion Metrics via code-map (Increment 4)

**Filename:** `FID-2026-0824-018-self-improvement-regression-guard.md`
**ID:** FID-2026-0824-018
**Severity:** medium
**Status:** closed
**Created:** 2026-08-24 17:19
**YAGNI-Compliance:** Pending

Parent: `FID-2026-0824-013` (inherits amendments A1–A8). Depends on `-016`
(consumes its paired-run artifacts as baseline/active sources).

---

## Summary

Long-horizon self-improvement risks structural decay even when functional pass rates
hold (SlopCodeBench finding): verbosity bloat and complexity concentration. This
increment adds erosion metrics computed from the EXISTING `@savant-code/code-map`
tree-sitter index (already declared in `evals/package.json` — Law 7 reuse, zero new
AST machinery) and gates skill promotion on them: a skill whose application raises
structural erosion beyond threshold, or degrades reliability, is blocked from
immutable promotion.

## Environment

- **OS:** Windows 11 primary dev host; POSIX-compatible by contract
- **Language/Runtime:** TypeScript strict monorepo, Bun 1.3.14 (pinned)
- **Tool Versions:** `@savant-code/code-map` workspace package; skills prove (`-016`)
- **Commit/State:** main @ v0.0.27 prep (working tree, release-only-commits)

## Detailed Description

### Problem

The evolve/trust flow has no structural signal. A quarantined skill can pass trials
while teaching patterns that bloat verbosity or concentrate complexity into
monolithic functions across future sessions — damage that surfaces months later.

### Expected Behavior

During paired prove runs, artifacts from baseline vs skill-active executions are
compared on Verbosity Delta (generated volume vs functional complexity added) and
Structural Erosion (cyclomatic complexity, cross-module coupling concentration).
Threshold breaches surface at `/skills trust` and feed the operator-run
`skills:evolve` ritual (amendment A4 — advisory to the operator decision, never an
automatic promotion path).

### Root Cause

Self-improving harness landed (FID-2026-0824-012) before any quality-delta guard
existed; blueprint ADR 6 CONFIRMED with the A4 retargeting.

### Evidence

```text
evals/package.json                  @savant-code/code-map already a dependency (reuse target)
.agents/skills/.quarantine/         promotion boundary exists, unguarded structurally
scripts/evolve-skills.ts            operator ritual — consumption point for reports
```

## Impact Assessment

### Affected Components

- `evals/v2/src/erosion/` (new metrics module over code-map output)
- `-016` proof artifact schema (extends with erosion block — additive)
- `/skills trust` advisory rendering; `scripts/evolve-skills.ts` report input

### Risk Level

- [ ] Critical / [ ] High / [x] Medium: slow-burn architectural debt; heuristic
      metrics can mislead if treated as infallible (blueprint Honest Boundaries —
      directional vectors only, operator remains final arbiter)
- [ ] Low

## Proposed Solution

### Approach

Pure metric functions over code-map AST output; thresholds configurable via
protocol.config.yaml advisory keys; results rendered as advisories bound to the
operator decision, never auto-blocking writes (A4 keeps trust human).

### Steps

1. Metric module: per-artifact cyclomatic complexity, fan-in/out coupling, and
   volume ratios computed from code-map symbols; pure + deterministic fixtures.
2. Delta engine: baseline-vs-active artifact comparison producing Verbosity Delta
   and Structural Erosion percentages over the changed set.
3. Gate logic: >5% structural-erosion increase or pass^k degradation flags BLOCK
   in the proof artifact; `/skills trust` renders it prominently; evolve-skills
   ingests the same report.
4. Config keys added additively (thresholds, enabled flag) with documented defaults.
5. Tests: synthetic AST fixtures (known complexity), delta math boundaries,
   threshold gate matrix, artifact schema round-trip.

### Verification

Gates below plus one worked example: a deliberately bloated demo skill flagged.

## Verification Gates

- gate: typecheck evals
- gate: test evals/v2/tests/erosion.test.ts
- gate: test evals/v2/tests/skill-prove.test.ts

### Verification Receipt

- fingerprint: sha256:6573f920861e68dc2d1a359e6ea2a388f6e3b32c976cf5a0b615e59b01f966fd
- verified: 2026-08-26T01:49:44.581Z
- typecheck evals: exit 0
- test evals/v2/tests/erosion.test.ts: exit 0
- test evals/v2/tests/skill-prove.test.ts: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Grounding citations above (working-tree reads, 2026-08-24).
- **GREEN:** Solution specified; code-map reuse confirmed (Law 7); A4 boundary held
  (advisory at operator boundary — no EHEL write-block on skills themselves).
- **AUDIT:** Batched suite Verifier (2026-08-24): FAIL (receipts-pending absent).
- **ADVERSARIAL:** CONFIRMED against disk (2026-08-24): @savant-code/code-map
  workspace:* present in evals/package.json dependencies — the Law-7 reuse claim is
  real; receipts-pending line ADDED post-verdict before flip — Verifier FAIL
  discharged at flip.
- **CHANGE DELTA:** Initial authorship (n/a).

### Loop 2 — Implementation (2026-08-25)

- **IMPLEMENTED:** NEW `evals/v2/src/erosion/` — `metrics.ts`
  (`volumeRatio` = lines/(identifiers+1); `cyclomaticEstimate` =
  decisionCount+1, documented as a deterministic text-based estimate;
  `couplingConcentration` = maxFanIn/(meanFanIn+1); `snapshotErosion`
  aggregation), `delta.ts` (pctChange with zero-baseline guards; composite
  `structuralScore` = maxCC × (1+coupling); `compareErosion`), and `gate.ts`
  (thresholds 5% structural / 25% verbosity per spec + defaults, enabled
  flag, pass^k degradation check).
- **REUSE BOUNDARY (recorded amendment):** metrics consume code-map-SHAPED
  data (`FileStat` mirrors `ParsedTokens` counts + `TokenCallerMap` fan-in)
  WITHOUT importing the wasm-loading package — the evals runtime stays
  hermetic and a runner-level adapter feeds real code-map output where the
  package is already loaded. The Law-7 dependency claim stands; consumption
  is by shape.
- **WIRING:** `proofArtifactSchema` gains an ADDITIVE optional `erosion`
  block (schema_version stays '1.0' — pre-guard artifacts parse unchanged);
  `runSkillProve` gains an injectable `measureErosion` seam (+ gate
  overrides), attaching the block before the zod round-trip only when BOTH
  arms are measured; `/skills trust` + prove surfaces render a prominent
  EROSION BLOCK advisory with reasons; `evolve-skills` forces HIGH risk on
  erosion-blocked proofs (fail-open shape guards, no casts).
- **CONFIG:** protocol.config.yaml ADVISORY `erosion:` block documents the
  module-owned defaults (enabled / 5% / 25%).
- **TESTS/GATES:** NEW `tests/erosion.test.ts` (17 tests: hand-computed
  metric fixtures, delta boundaries incl. zero/negative baselines, gate
  threshold matrix, schema round-trip of old shape + full block);
  `skill-prove.test.ts` carries the WORKED EXAMPLE — a deliberately bloated
  fixture breaches thresholds and flags BLOCK — plus the absent-seam
  byte-compat case. Battery this session: eval typecheck exit 0 · suites
  **21 pass / 0 fail** across both files · eslint --max-warnings 0 ×8
  touched files · prettier clean ×9 · config YAML parses + formats.

### Code Verification Evidence

Loop 2 verified against the working tree: all three erosion modules export
the pure functions exercised end-to-end by `erosion.test.ts`; the seam is
injectable and prove runs without it stay byte-compatible (the existing
-016 suite passes untouched); `skills.ts` renders the block at BOTH trust
and prove surfaces; `evolve-skills.ts` ingests blocked proofs. Every gate
command above ran live this session with exit codes recorded in-line.

## Resolution

- **Closed Date:** 2026-08-25 — **Archived:** 2026-08-25 →
  `dev/fids/archive/`
- **Fix Description:** increment 4 complete — erosion metrics, delta
  engine, threshold gate with pass^k degradation, additive artifact block,
  trust-surface rendering, evolve ingestion, documented config defaults.
- **Tests Added:** `erosion.test.ts` (17) + seam/worked-example coverage in
  `skill-prove.test.ts` (21 combined pass).
- **Verification Evidence:** see Loop 2 gates; receipt stamped at the
  archived path per FID-2026-0823-009 mechanics.
- **Honest boundary:** metrics are directional ESTIMATES (text-based CC
  proxy, not tree-sitter-exact); amendment A4 holds — trust remains human.

## Lessons Learned

(pending — captured at closure)