# FID: Capability Ingestion + Tier-3 Release Pipeline (Increment 5)

**Filename:** `FID-2026-0824-019-capability-ingestion-release-tier.md`
**ID:** FID-2026-0824-019
**Severity:** medium
**Status:** closed
**Created:** 2026-08-24 17:20
**YAGNI-Compliance:** Pending

Parent: `FID-2026-0824-013` (inherits amendments A1–A8). Consumes `-016`/`-018`
artifacts at the release gate.

---

## Summary

The 4-task curated corpus invites memorization/contamination, and the release
pipeline has no capability gate. This increment adds a SWE-rebench-style ingestion
pipeline (time-windowed closed issues converted into the extended v3 YAML), a
CodeScaleBench-style taxonomy classifier (additive categories), a task-rotation
registry for Tier 3, and wires the full-corpus capability + erosion run into the
`release:public` preflight with hard token ceilings. License audit (A7) is a RED-
phase hard gate before any parser logic is adapted.

## Environment

- **OS:** Windows 11 primary dev host; POSIX-compatible by contract
- **Language/Runtime:** TypeScript strict monorepo, Bun 1.3.14 (pinned), zod v4
- **Tool Versions:** `scripts/public-release.ts` (release preflight contract);
  benchmark v2 registry/loader
- **Commit/State:** main @ v0.0.27 prep (working tree, release-only-commits)

## Detailed Description

### Problem

1. A tiny static corpus is trivially memorizable; scores stop measuring ability.
2. No complexity stratification exists — all tasks are small single-file fixtures.
3. `release:public` verifies build/publish integrity but never agent capability or
   long-horizon erosion before distribution.

### Expected Behavior

Operators ingest recent closed issues into stratified tasks; Tier 3 rotates a fresh
capability set per release, executes it through the proven harness with erosion
metrics attached, and the release engine blocks on failure.

### Root Cause

Corpus strategy predates contamination awareness and the self-improving loop that
makes erosion dangerous (blueprint ADR 4 / Phase 5, CONFIRMED).

### Evidence

```text
evals/v2/tasks/                     4 curated tasks only
schema.ts taskCategorySchema        no cross-repo/dependency/comprehension/security classes
scripts/public-release.ts           gate manifest — no eval tier today
```

## Impact Assessment

### Affected Components

- `evals/v2/src/ingest/` (new), `schema.ts` (additive category values)
- `scripts/public-release.ts` (new optional eval tier in the gate manifest)
- NOTICE (attribution per A7)

### Risk Level

- [ ] Critical / [ ] High / [x] Medium: release latency + token cost (~2M tokens/
      run) demand ceilings and an opt-in posture; wrong taxonomy breaks nothing but
      misreports
- [ ] Low

## Proposed Solution

### Approach

Ingestion is additive and offline-first: parsers produce plain YAML files reviewed
into the registry like any hand-written task; the release tier reuses the SAME
harness entry points (no parallel runner). Rotation is deterministic from the
release version to keep runs reproducible.

### Steps

1. RED license audit of every adapted methodology source (SWE-rebench pipeline,
   CodeScaleBench taxonomy) — MIT/Apache-2.0 verified before porting ideas (A7);
   NOTICE entries recorded.
2. Ingestion parser: time-windowed closed issues → v3 YAML with provenance
   metadata (source, window, hash); operator-curated allowlist of repositories.
3. Taxonomy classifier extending `taskCategorySchema` additively:
   `cross_repo_navigation`, `dependency_tracing`, `codebase_comprehension`,
   `security_remediation`; old enum values parse unchanged.
4. Rotation registry: deterministic per-version selection across strata;
   contamination note per blueprint Honest Boundaries.
5. Release wiring: optional Tier-3 stage in the public-release preflight executing
   the rotated corpus with pass@k + `-018` erosion reporting and a hard token
   ceiling; failure blocks the version bump.
6. Tests: ingestion fixture round-trip, classifier mapping table, rotation
   determinism, ceiling enforcement, release-gate fail path.

### Verification

Gates below plus one dry-run Tier-3 execution against the mock runner.

## Verification Gates

- gate: typecheck evals
- gate: test evals/v2/tests/ingest.test.ts
- gate: test scripts/public-release.test.ts

### Verification Receipt

- fingerprint: sha256:1ee62c59d68d2ff839dbbae79425db99b125915191846d86578c63140e918480
- verified: 2026-08-26T03:26:41.104Z
- typecheck evals: exit 0
- test evals/v2/tests/ingest.test.ts: exit 0
- test scripts/public-release.test.ts: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Grounding citations above (working-tree reads, 2026-08-24).
- **GREEN:** Solution specified; license audit ordered FIRST (A7); additive schema
  discipline held (back-compat boundary on the master).
- **AUDIT:** Batched suite Verifier (2026-08-24): FAIL (receipts-pending absent) →
  discharged same session; scripts/public-release.test.ts gate target confirmed on disk.
- **ADVERSARIAL:** Clean (2026-08-24): no citation adjustments; public-release.ts /
  evolve-skills.ts existence corroborated; license-first ordering (A7 step 1) intact;
  additive-category plan consistent with the master back-compat boundary.
- **CHANGE DELTA:** Initial authorship (n/a).

### Loop 2 — Implementation (2026-08-25)

- **A7 LICENSE AUDIT (hard gate, executed FIRST):** SWE-rebench code = MIT
  (`SWE-rebench/SWE-rebench-V2`, copyright "2026 SWE-rebench"); its harness
  fork = MIT retaining the upstream SWE-bench copyright line (Jimenez et al.
  2023); dataset = CC-BY-4.0 (Badertdinov et al., Nebius). CodeScaleBench
  eval-kit = Apache-2.0 (Sourcegraph); its dataset carries per-task mixed
  upstream licenses. Both sources pass the MIT/Apache-2.0 bar; NOTICE
  attribution entries recorded verbatim.
- **IMPLEMENTED:** NEW `evals/v2/src/ingest/issues.ts` — time-windowed
  closed-issue ingestion (inclusive bounds), operator repo allowlist,
  keyword classifier mapping onto the four additive categories (first-match,
  security first), sha256 content provenance, YAML emission via the yaml
  package. Curated/draft split: items without deterministic checks land in
  `drafts` whose YAML intentionally fails `taskDefinitionSchema` until an
  operator completes them — drafts can never silently enter the registry.
  NEW `ingest/rotation.ts` — deterministic per-version selection across
  category/difficulty strata (sha256(version::task_id), task_id tiebreak) +
  fail-closed token ceiling enforcement.
- **SCHEMA (additive):** taskCategorySchema += cross_repo_navigation /
  dependency_tracing / codebase_comprehension / security_remediation (old
  values parse unchanged); optional `ingest_provenance` block follows the
  governance_replay precedent (schema_version stays "2.0").
- **RELEASE WIRING:** validation-manifest.ts gains opt-in
  `releaseEvalTierGate(root)` — inactive unless
  SAVANT_CODE_RELEASE_EVAL_TIER=full; active, it joins the SAME gate
  manifest public-release.ts already spreads at its preflight (grep:
  repositoryValidationGates consumed at scripts/public-release.ts:24,459)
  — zero touches to the 3064-line release engine. The gate command runs
  the evals CLI structural rehearsal, failing closed on ceiling breach or
  empty rotation.
- **CLI:** `--release-tier [<version>]` mode — deterministic rotation plan
  across category/difficulty strata + hard ceiling check; baseline-only by
  design (live evaluate-mode runs stay operator-keyed).
- **TESTS/GATES:** NEW tests/ingest.test.ts (8 tests: inclusive window
  bounds, allowlist rejection with reasons, classifier mapping table incl.
  pure_coding fallback, curated YAML round-trip validating against
  taskDefinitionSchema with provenance hash equality, draft
  schema-invalid-by-design, rotation determinism + cross-version rotation +
  per-stratum cap + canonical order, ceiling fail-closed matrix);
  public-release.test.ts 56/0 unchanged. Battery: eval typecheck exit 0 ·
  eslint --max-warnings 0 ×6 touched files · prettier clean ×7 · DRY-RUN
  executed live: `--release-tier` selected 7 tasks across governance/
  error_recovery/multi_agent/pure_coding strata, estimated 700k tokens vs
  the 2M ceiling, exit 0.

### Code Verification Evidence

Loop 2 verified against the working tree: both ingest modules export the
pure functions exercised end-to-end by ingest.test.ts (YAML parse-back
through the real zod schema); the classifier table covers every additive
category plus the fallback; rotation is byte-deterministic across repeated
invocations; validation-manifest.ts spreads the optional gate into the
manifest public-release.ts consumes. Every gate command above ran live
this session with exit codes recorded in-line.

## Resolution

- **Closed Date:** 2026-08-25 — **Archived:** 2026-08-25 →
  `dev/fids/archive/`
- **Fix Description:** increment 5 complete — ingestion parser with
  provenance, additive taxonomy, deterministic rotation registry, hard
  token ceiling, opt-in Tier-3 release gate, NOTICE attributions.
- **Tests Added:** ingest.test.ts (8 tests) alongside the unchanged
  56-test public-release contract suite.
- **Verification Evidence:** see Loop 2 gates; receipt stamped at the
  archived path per FID-2026-0823-009 mechanics.
- **Honest boundary:** the rehearsal is baseline-only (zero tokens); live
  capability runs require an operator-supplied key and stay outside
  automated gates by design.

## Lessons Learned

(pending — captured at closure)