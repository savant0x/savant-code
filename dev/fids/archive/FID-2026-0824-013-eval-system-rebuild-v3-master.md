# FID: Eval System Rebuild v3 — Master Architecture

**Filename:** `FID-2026-0824-013-eval-system-rebuild-v3-master.md`
**ID:** FID-2026-0824-013
**Severity:** high
**Status:** closed
**Created:** 2026-08-24 17:15
**YAGNI-Compliance:** Pending

---

## Summary

Master architecture FID for rebuilding `@savant-code/evals` from benchmark v2 into
v3 per `docs/design/Savant Eval System Rebuild.md` (operator-directed planning read,
2026-08-24). Six increments implemented strictly in sequence (operator directive:
blueprint order). The v2 core is RETAINED per the blueprint's own verdict: the
`AgentRunner` interface, deterministic-first grading rule, task registry, and YAML
schema survive every phase behind additive extensions. Canonical source: the design
doc above — binding only as amended by A1–A8 below.

## Environment

- **OS:** Windows 11 primary dev host; POSIX-compatible by contract
- **Language/Runtime:** TypeScript strict monorepo, Bun 1.3.14 (pinned), zod v4
- **Tool Versions:** `@savant-code/evals` 0.0.27 (benchmark v2); `@savant-code/code-map`
  workspace dep already declared in `evals/package.json`
- **Commit/State:** main @ v0.0.27 prep (working tree, release-only-commits)

## Detailed Description

Coordination record: per-increment Problem/Root-Cause/Evidence detail lives in each
child (-014..-019), not duplicated here (Law 13). The blueprint's landscape analysis
and ADRs 1–8 are adopted as amended below.

## Impact Assessment

### Affected Components

- `evals/v2/src/**`, `evals/v2/tasks/**`, `evals/v2/schema/task.schema.json`
- `evals/package.json`, `.githooks/pre-push`, root release scripts

### Risk Level

- [ ] Critical: —
- [x] High: program-coordination risk — six sequential increments extend the
      regression gate; sequencing or back-compat failures corrupt quality signal
- [ ] Medium / Low

## Proposed Solution

### Approach

Six additive increments extending v2 without replacing it (manifest below); strict
sequence per operator directive 2026-08-24.

### Steps

1. Converge each child FID (-014..-019) through its own Perfection Loop, in order.
2. Implement increment-by-increment; stamp verification receipts at each flip.
3. Close this master when the last child closes.

### Verification

Each child's own Verification Gates; the master gate below re-runs at closure.

## Binding Amendments to the Blueprint

Ground-truth pass 2026-08-24 (working-tree reads cited in Loop 1). The report seeds
the plan ONLY as corrected here. Each child inherits all eight.

| # | Blueprint claim | Corrected position |
|---|---|---|
| A1 | v2 isolation is a "Linux-only Docker stub"; Phase 1 builds Bun-native sandboxing | `TempDirSandbox` (`evals/v2/src/sandboxes/tempdir.ts`) is ALREADY the default everywhere (mkdtemp + async streaming); `DockerSandbox` is an explicit throw-stub. Increment 1 NARROWS to process-tree teardown, env allowlist, safe-mode injection |
| A2 | Tier 2 runs "OpenRouter openrouter/free or paid tier" | REJECTED — hard project invariant: the operator-configured model is the only model; tier configs reference the run config model, never a slug |
| A3 | Tier 1 triggers on "pre-commit hook" | This repo gates on PRE-PUSH (`.githooks/pre-push`); the smoke tier appends there (operator decision 2026-08-24) |
| A4 | "Scribe agent proposes promotion" of skills | Per FID-2026-0824-012 flow: drafts land via lessons-to-skills → `.quarantine/`; trust is OPERATOR-ONLY via `/skills trust`. The regression guard gates the trust/evolve boundary, not a Scribe decision |
| A5 | LLM autorater design | Out-of-process judge ONLY, forced-choice permutation-invariant rubrics, origin-masked; never a second in-process LLM |
| A6 | (unstated) | Quality ceilings bind: `max_file_lines` 300 / `max_function_lines` 50 — stats, sandbox, and ingestion modules decompose accordingly at GREEN |
| A7 | License compliance (ADR 8) | License audit is a RED-phase HARD GATE before adapting any external methodology; NOTICE attribution required (ideas-not-ports discipline) |
| A8 | v2 FSM scoring is "rudimentary parsing" | REFUTED — `metrics-fsm.ts` enforces transition legality, write-phase violations, terminal-command phases, sequentialthinking agent checks. Increment 0 is an ALIGNMENT gap (missing `adversarial` phase + per-agent SoD assertions), not greenfield replacement |

## Suite Manifest

| Child | Increment | Scope | Hard gate |
|---|---|---|---|
| `-014` | 0 | FSM alignment + trajectory assertions | baseline `harness:v2` stays green |
| `-015` | 1 | Sandbox hardening (process tree, env allowlist, safe mode) | live orphan-process teardown proof on Windows |
| `-016` | 2 | Skill-efficacy engine (`skills prove`, pass@k / pass^k, ZTAP binding) | depends on `-014` assertions for activation checks |
| `-017` | 3 | Governance corpus + bounded autorater + Tier-1 pre-push smoke | `<30s` budget probe on pre-push |
| `-018` | 4 | Regression guard (erosion metrics via code-map) | depends on `-016` paired-run artifacts |
| `-019` | 5 | Capability ingestion + Tier-3 release pipeline | license audit (A7) before any parser port |

## Resolution Policy

- Master STAYS `created`→`analyzed` until ALL children close; closes when the last
  child closes.
- STRICT sequence `-014` → `-015` → `-016` → `-017` → `-018` → `-019` (operator
  directive 2026-08-24: blueprint order). No parallel implementation across children;
  later increments consume earlier ones' artifacts.
- Every child declares Verification Gates and stamps receipts per FID-2026-0823-009
  when it reaches `fixed`/`verified`; statuses stay active-vocabulary until then.
- All new schema fields are ADDITIVE to `taskDefinitionSchema` (schema_version stays
  `"2.0"`) so existing tasks keep parsing unchanged (back-compat boundary).

Master is coordination-only: its gate proves the suite substrate stays green while
children land; the receipt was stamped at last-child close via
`bun run fid:verify <fid> --write`.

## Verification Gates

- gate: typecheck evals
- gate: test evals/v2/tests/harness.test.ts

### Verification Receipt

- fingerprint: sha256:960b2f73e7d1cae2470647ac44a39b698064702260484c512d0d9d391a90a495
- verified: 2026-08-26T03:42:11.545Z
- typecheck evals: exit 0
- test evals/v2/tests/harness.test.ts: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Ground-truth pass over the blueprint against the working tree (this
  session): `runner.ts` EchoPhase union omits `adversarial`; `metrics-fsm.ts`
  VALID_TRANSITIONS lacks adversarial edges while the runtime FSM has had the
  Adversarial role since FID-2026-0805-004 — adversarial-loop traces mis-score today.
  `tempdir.ts` timeout kill() terminates only the shell (orphaned grandchildren,
  admitted in-code); `buildEnv` spreads full host `process.env`. Corpus = 4 tasks;
  zero statistical primitives; code-map already available to evals.
- **GREEN:** Amendments A1–A8 folded; six-child suite authored; operator decisions
  recorded (blueprint order; master+children now; Tier 1 into pre-push).
- **AUDIT:** Batched suite Verifier (2026-08-24): six mechanical FAILs — this record
  lacked Detailed Description / Impact Assessment / Proposed Solution / Verification
  Gates; children -015..-019 lacked receipts-pending declarations. Citation accuracy,
  cross-references, amendment propagation (A1–A8), status honesty: PASS.
- **ADVERSARIAL:** STANDS AS CORRECTED (2026-08-24): all Verifier FAILs discharged on
  disk re-audit (-018's receipt line added post-verdict, before flip); 5 citations
  CONFIRMED against the working tree, 1 ADJUSTED (-015 RunnerConfig
  definition/consumer relabel); zero Author/attribution fields suite-wide;
  manifest↔child cross-references consistent; gate shapes allowlist-conformant;
  existing-substrate gate targets verified on disk.
- **CHANGE DELTA:** Post-audit revision ~+45 lines (four compact sections + receipt
  notes + verdict folds).

### Loop 2 — Resumption (2026-08-25)

- **PARK/RESUME:** Suite parked mid-session 2026-08-24 for the compaction-integrity
  emergency (FID-2026-0824-022..-027, closed + archived); resumed by operator
  directive 2026-08-25 00:25 EDT.
- **RE-CONFIRM:** Increment-0 anchors re-grepped on resume — `EchoPhase`
  (runner.ts:14) still lacks `adversarial`; `VALID_TRANSITIONS` (metrics-fsm.ts:4)
  still seven keys; `normalizePhase` (:39) unchanged. Zero drift vs Loop 1 RED.
- **SUBSTRATE DELTA SCAN:** Compaction-rebuild substrates landed meanwhile
  (`.savant/evidence/` spill/splice/inventory ledger) are ORTHOGONAL to the eval
  trace substrate — `evals/v2/src` contains ZERO `.savant/evidence` references,
  and its trace contract is in-code (`trace.ts` `TraceDocument`, runner-typed),
  with any directory convention living at design-doc level rather than as a src
  constant. No child spec deltas required; amendments A1–A8 stand unamended.
  [Corrected on audit discharge: an earlier draft implied a `.savant/traces/`
  literal in src — greps show neither path appears literally; see below.]
- **STATUS:** All six children remain `analyzed`; strict sequence unchanged; next
  action = `-014` GREEN (FSM alignment + additive `trajectory_assertions`).
- **AUDIT DISCHARGE (Verifier NET NEEDS-REVIEW → grounded, fresh greps pasted):**
  `grep -n adversarial evals/v2/src/runner.ts` → 0 matches;
  VALID_TRANSITIONS body (metrics-fsm.ts :4–16) = exactly seven keys
  idle/red/green/audit/self_correct/complete/unknown, none adversarial;
  `grep .savant/evidence evals/v2/src` → 0 matches; child status sweep
  `**Status:**` across `-014`…`-019` → six × `analyzed` (corrects the
  first sweep attempt that used a bare `^Status:` pattern plus a typo'd -016
  filename — skills-prove, not skills-probe).
- **CHANGE DELTA:** This entry plus discharge block (~26 lines).

### Loop 3 — Closure (2026-08-25)

- **ALL CHILDREN CLOSED:** `-014`…`-019` reached `closed` and were archived to
  `dev/fids/archive/` in strict blueprint order, each with a stamped verification
  receipt per FID-2026-0823-009 (`ls dev/fids/archive/ | grep 'FID-2026-0824-01[4-9]'
  → four of six visible in the -016..-019 window; -014/-015 archived earlier the
  same day). Per Resolution Policy, "master closes when the last child closes" —
  that condition is now met.
- **MASTER GATE LIVE AT CLOSURE:** `bun run --cwd=evals typecheck` exit 0 ·
  `bun test v2/tests/harness.test.ts` PASS (suite substrate green while children
  landed, as this record's gate requires).
- **CLOSURE:** status `analyzed` → `closed`; Resolution + Lessons Learned filled;
  record moved to `dev/fids/archive/`; receipt stamped at the archived path via
  `bun run fid:verify <fid> --write` (declared gates re-run live); repo-wide
  `bun run fid:verify --check` sweep PASS; CHANGELOG entry added.
- **CHANGE DELTA:** Status flip + Resolution/Lessons fill + this entry (~45 lines,
  within the markdown circuit-breaker heuristic).

### Missed Questions

1. Does v3 replace v2? → No — additive extension; v2 registry/schema/tests remain the
   substrate (A8, back-compat boundary).
2. Who allocates trial counts/budgets? → protocol.config.yaml advisory keys added at
   GREEN; defaults N=3 local / N=20 CI per the blueprint risk register.
3. What happens to existing 4 tasks? → They migrate untouched; governance/capability
   tasks are new siblings under the same loader.

### Code Verification Evidence

Planning-phase master: no implementation exists yet; evidence intentionally pending.
All repo-path claims above were read from the working tree during Loop 1 RED
(2026-08-24). Per-child verification gates are declared on each child and will be
receipt-stamped per FID-2026-0823-009 as each reaches fixed/verified.

## Resolution

- **Closed Date:** 2026-08-25
- **Fix Description:** All six increments implemented additively over the retained
  v2 core, strictly in blueprint order: `-014` FSM alignment (`adversarial` phase,
  additive `trajectory_assertions` channel) · `-015` sandbox hardening
  (process-tree teardown, deny-by-default env allowlist, safe-mode injection,
  bounded log capture) · `-016` skill-efficacy engine (paired-trial `runSkillProve`,
  pass@k/pass^k stats, ZTAP receipt binding, `prove` CLI wired end-to-end) ·
  `-017` governance corpus + out-of-process forced-choice autorater + Tier-1
  pre-push smoke (`evals:smoke`) · `-018` regression guard (erosion metrics,
  delta engine, threshold BLOCK gate at the trust/evolve boundary) · `-019`
  capability ingestion (windowed issue parser, A7 license audit as RED hard gate,
  NOTICE attribution) + Tier-3 release pipeline (deterministic rotation registry,
  token ceiling, fail-closed release gate). Amendments A1–A8 held throughout;
  schema_version stayed `"2.0"` (tasks) / `"1.0"` (proof artifacts) — back-compat
  boundary intact, proven by round-trip tests in each child.
- **Tests Added:** per child, cumulative across the program: metrics-fsm 14/0 ·
  trace/sibling suites 29/0 + 44/0 · tempdir-sandbox 11/0 incl. live Windows
  orphan-process proof · skill-efficacy 8/0 · skill-prove 4/0 · harness baseline
  5/0 · v2 governance suite 114/0 · erosion 21/0 · ingest 8/0 · public-release
  contract suite 56/0 · prove-cli orchestration suite (with erosion+skill-prove
  combined run 29/0). Zero failures at every child close.
- **Verification Evidence:** every child receipt-stamped with declared gates run
  live (`fid:verify <fid> --write`), repo-wide `fid:verify --check` sweep PASS at
  each close AND re-run PASS immediately before this master's stamp; master gates
  (`typecheck evals` exit 0 · `harness.test.ts` PASS) executed live at closure.
- **Archived:** yes → `dev/fids/archive/FID-2026-0824-013-eval-system-rebuild-v3-master.md`
  (receipt stamped at the archived path).

## Lessons Learned

- **Additive-only extension works under pressure:** six increments landed without
  a single breaking schema change because every field was optional-with-default and
  round-trip-tested against pre-change payloads. The v2 core never had to be
  frozen or forked.
- **License audit as a RED hard gate (A7) earned its place:** it caught a real
  attribution error before any code moved (SWE-rebench is Nebius, not JetBrains;
  dataset is CC-BY-4.0, not MIT) — ideas-not-ports discipline plus NOTICE entries
  recorded under `-019` (A7).
- **Deterministic-first grading made zero-token governance viable:** the Tier-1
  pre-push smoke runs in seconds with no LLM calls because replay tasks are
  deterministic by construction; the autorater only enters where determinism
  cannot reach, out-of-process and origin-masked (A5).
- **Cross-stream conflicts are resolved by keeping the landed definition:** twice
  during the program (-015 vs FID-2026-0825-001's `compactAndStop`; -018's
  concurrent sessions) duplicate writers collided; fix-forward-by-adopting-the-
  landed-copy beat both rollback and merge-tooling approaches.
- **Honest boundaries stay honest:** operator-waived live smokes (real TUI runs,
  interactive visual passes) were recorded as waived-not-passed in every child —
  the audit trail distinguishes evidence from intent throughout.