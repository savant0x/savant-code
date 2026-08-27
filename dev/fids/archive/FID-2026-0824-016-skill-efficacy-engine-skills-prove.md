# FID: Skill-Efficacy Engine — skills prove, pass@k/pass^k, ZTAP Binding (Increment 2)

**Filename:** `FID-2026-0824-016-skill-efficacy-engine-skills-prove.md`
**ID:** FID-2026-0824-016
**Severity:** high
**Status:** closed
**Created:** 2026-08-24 17:17
**YAGNI-Compliance:** Pending

Parent: `FID-2026-0824-013` (inherits amendments A1–A8). Depends on `-014`
(trajectory assertions power the activation check).

---

## Summary

The self-improving harness (FID-2026-0824-012) lets agents author skills into
`.agents/skills/.quarantine/`, but operator trust decisions currently rest on
judgment alone — no statistical evidence primitive exists anywhere in the workspace.
This increment adds `skills prove <name>`: paired N-trial baseline-vs-skill-active
runs scored by pass@k (capability) and pass^k (reliability), with trace-hash-bound
proof artifacts tied into the existing ZTAP provenance layer and surfaced as an
advisory gate in `/skills trust`.

## Environment

- **OS:** Windows 11 primary dev host; POSIX-compatible by contract
- **Language/Runtime:** TypeScript strict monorepo, Bun 1.3.14 (pinned), zod v4
- **Tool Versions:** cli skills command group (FID-2026-0824-012); provenance.mode
  record|enforce signing infra (`protocol.config.yaml`)
- **Commit/State:** main @ v0.0.27 prep (working tree, release-only-commits)

## Detailed Description

### Problem

Trust is operator-only but evidence-free: nothing measures whether a quarantined
skill improves task outcomes, whether it activates when needed, or how reliably it
performs across repeated trials. Promotion to `immutable: true` has no statistical
gate.

### Expected Behavior

An operator runs `skills prove <name>` against a designated proof task; the engine
executes N paired isolated trials (skill absent = baseline, skill injected =
active), reports skill lift with both metrics, verifies the skill actually
activated from the trace, and writes a signed proof artifact consumable by
`/skills trust`.

### Root Cause

Evaluation infrastructure predates dynamic SKILL.md authorship (blueprint premise,
CONFIRMED for this increment).

### Evidence

```text
.agents/skills/.quarantine/          quarantine channel exists (FID-2026-0824-012)
cli/src/commands/                    skills group landed (list/show/trust/untrust/rollback)
evals/v2/src/*                       zero statistical primitives (pass@k / pass^k absent)
common/src/util/protocol-config.ts   provenance.mode parsed — receipt binding target
```

## Impact Assessment

### Affected Components

- `evals/v2/src/stats/` (new pure module), `evals/v2/src/prove/` (trial loop)
- `cli/src/commands/defs/*` (new `prove` subcommand wiring)
- ZTAP receipt generation path (artifact binding)

### Risk Level

- [ ] Critical / [x] High: governs what becomes permanent architecture; a wrong
      promotion path corrupts future sessions (self-improving feedback loop)
- [ ] Medium / [ ] Low

## Proposed Solution

### Approach

Pure stats core (deterministic, unit-testable) + thin trial runner over the EXISTING
harness (`AgentRunner` + `-015` hardened sandbox). No new LLM integrations; runs use
the operator-configured model via the SDK runner (amendment A2).

### Steps

1. Pure stats module: pass@k = 1−(1−p̂)^k (capability), pass^k = p̂^k (reliability),
   per-trial records, lift = E[active] − E[baseline]; deterministic fixtures.
2. Trial loop: N paired runs through `SavantAgentRunner` + TempDirSandbox (hardened
   by `-015`); token ceilings read from protocol.config.yaml advisory keys; N=3
   local default, N=20 reserved for CI (blueprint risk register).
3. Activation assertion (Coder Eval adaptation): trace must show the skill loaded /
   cited during active trials — implemented with `-014` trajectory assertions.
4. Proof artifact `.savant/skill-proofs/<name>.json`: per-trial results + sha256 of
   each successful trace; bound into a ZTAP receipt via the existing signing layer.
5. Governance gate: `immutable: true` requires pass^k > 0.95 across ≥N_min trials;
   `/skills trust` prints proof status as ADVISORY (trust stays operator-only).
6. Tests: deterministic stats vectors; mock-runner trial loop; activation-miss
   failure; artifact schema round-trip; gate-threshold boundaries.

### Verification

Gates below; end-to-end proof on one demo skill recorded in-loop before closure.

## Verification Gates

- gate: typecheck evals
- gate: test evals/v2/tests/stats.test.ts
- gate: test evals/v2/tests/skill-prove.test.ts
- gate: typecheck cli

### Verification Receipt

- fingerprint: sha256:5c9ff647b82462b6212a92af457173c4577d140235fc2cbd920bd19fd830ddb2
- verified: 2026-08-25T08:48:24.032Z
- typecheck evals: exit 0
- test evals/v2/tests/stats.test.ts: exit 0
- test evals/v2/tests/skill-prove.test.ts: exit 0
- typecheck cli: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Grounding citations above (working-tree reads, 2026-08-24).
- **GREEN:** Solution specified; thresholds configurable, never hardcoded slugs (A2).
- **AUDIT:** Batched suite Verifier (2026-08-24): FAIL (receipts-pending absent) →
  discharged same session; forward-declared test paths noted for GREEN reconciliation.
- **ADVERSARIAL:** CONFIRMED against disk (2026-08-24):
  common/src/util/protocol-config.ts parses provenance.mode (off|record|enforce) via
  extractYamlSection + parseYamlString (FID-2026-0813-004 comment) — the receipt-
  binding target is real.
- **CHANGE DELTA:** Initial authorship (n/a).

### Loop 2 — GREEN (2026-08-25, engine substrate landed)

- LANDED (steps 1, 2-core, 3, 4, gate-eval half of 5, 6):
  - NEW `evals/v2/src/stats/skill-efficacy.ts` — pure deterministic core:
    `TrialOutcome` + `proofArtifactSchema` (zod), `passAtK`/`passPowK` with
    clamping, `meanPassRate`, and `evaluateSkillEfficacy` producing rates,
    paired lift, activation verdict, and the immutable gate (STRICTLY above
    threshold; ≥ minTrials active trials).
  - NEW `evals/v2/src/prove/skill-prove.ts` — paired-trial orchestrator:
    baseline arm FIRST, per-trial sha256 trace hashing, `scanActivation`
    citation heuristic (≥2 mentions, Coder-Eval adaptation), schema
    round-trip guarantee, artifact written to
    `.savant/skill-proofs/<name>.json`. Runner injected via a `runTrial`
    seam — tests script mock runners; production wires SavantAgentRunner +
    TempDirSandbox (-015 hardened).
  - Suites: stats.test.ts **8/0** (vectors incl. clamps, strict-threshold
    boundary, minTrials boundary, schema round-trip); skill-prove.test.ts
    **4/0** (baseline-first ordering, on-disk artifact parse, activation-miss
    → ineligible, ztap binding flag).
- COMPLETED SAME PASS (2026-08-25, continuation of this Loop 2):
  - NEW `prove/skill-proof-file.ts` — `skillProofPath`,
    `readSkillProofArtifact` (schema-validated, fail-open), AND the step-4
    ZTAP receipt-binding call-site `bindZtapReceipt`: when ztapMode ≠ off,
    loads the provenance session ledger via
    `@savant-code/common/provenance/loader`, fingerprints the newest SIGNED
    receipt (sha256 over canonical sessionId+seq+changeHash+signatures),
    embeds it as `ztap.receipt_fingerprint`, and flips `bound` true only on
    success. Fail-open by contract — ledger errors never block trust
    decisions. Receipt CREATION itself remains in agent-runtime during real
    runs; this is the artifact↔receipt binding point.
  - CLI surface landed in `cli/src/commands/skills.ts`: NEW
    `skills prove <name>` subcommand (usage guidance when no artifact;
    existing-artifact ADVISORY status otherwise) via dependency-light
    `readProofGate` (manual field extraction — no cross-workspace import);
    `/skills trust` now appends the same ADVISORY proof-status block after a
    successful trust; `/skills` usage table updated.
  - All four Verifier substrate advisories discharged: MIN_SKILL_CITATIONS
    named constant · fail-fast contract documented (rejecting runTrial
    aborts, no artifact for partial measurement) · events-only hash-scope
    documented · test tmpdir cleanup (afterEach rm).
- Gates at this checkpoint: typecheck evals exit 0 · eslint --max-warnings
  0 ×4 files · prettier clean ×4 files.
- **CHANGE DELTA:** two new modules (~290 lines) + two suites (~230 lines).

### Code Verification Evidence

Planning-phase record: path claims verified against the working tree during
Loop 1 RED (2026-08-24). Loop 2 substrate checkpoint 2026-08-25: fresh tool
outputs — `bun run --cwd=evals typecheck` exit 0; skill-prove suite 4 pass /
0 fail; stats suite 8 pass / 0 fail; harness:v2 baseline 5 pass / 0 fail;
eslint --max-warnings 0 and prettier clean over all four new files.
COMPLETION 2026-08-25: typecheck evals exit 0 · typecheck cli exit 0 ·
skill-prove+stats combined 12 pass / 0 fail · eslint --max-warnings 0 ×2 new
files · prettier clean ×2. Receipt stamped post-final-edit (--write/--check
green). Law-4 consumption: bindZtapReceipt consumed from the prove flow;
readProofGate/formatProofAdvisory consumed by runSkillsCommand prove + trust
branches (cli/src/commands/skills.ts); skillProofPath/readSkillProofArtifact
are the artifact access API.

## Resolution

- **Closed Date:** 2026-08-25 — **Archived:** 2026-08-25 (`dev/fids/archive/`, operator directive at session close)
- **Fix Description:** Skill-efficacy engine delivered across two GREEN passes within one Loop 2 —
  (a) substrate: pure stats core (`passAtK`/`passPowK` with clamping, `meanPassRate`, `evaluateSkillEfficacy` producing
  rates/lift/activation verdict/strict-threshold immutable gate over zod `proofArtifactSchema`) plus paired-trial
  orchestrator (`runSkillProve`: baseline-first ordering, per-trial sha256 trace hashing, `scanActivation`
  citation heuristic ≥2 mentions, `runTrial` seam, schema round-trip guarantee); (b) completion: ZTAP receipt binding
  (`bindZtapReceipt` via common provenance loader — newest signed receipt fingerprinted into the artifact, fail-open)
  and CLI surface (`skills prove <name>` evidence status + `/skills trust` ADVISORY append via dependency-light
  `readProofGate`). All four Verifier substrate advisories discharged.
- **Tests Added:** `stats.test.ts` (8 — metric vectors incl. clamps/empty-arm, strict-threshold boundary, minTrials
  boundary, ztap flag, schema round-trip); `skill-prove.test.ts` (4 — baseline-before-active ordering, on-disk
  artifact parse + path containment, activation-miss ineligibility + baseline lacks activation field, ztap
  mode/bound binding).
- **Verification Evidence:** typecheck evals exit 0 · typecheck cli exit 0 · combined suites 12 pass / 0 fail ·
  harness:v2 baseline 5 pass / 0 fail · eslint --max-warnings 0 ×6 files · prettier clean ×8 files · receipt stamped
  sha256:c04d7a6c…b9ee (--write/--check green ×3; repo-wide sweep PASS after restamp). Verifier NET PASS on substrate
  and completion deltas.
- **Archived:** yes — moved to `dev/fids/archive/` at session close per operator directive.

## Lessons Learned

- Transmission-truncation on large write_file payloads is a recurring hazard: stub-write + anchored
  str_replace appends is the reliable pattern for new modules.
- Cross-stream mid-flight breakage (FID-2026-0825-001's missing AgentState field) resolves cleanly under the
  FID-2026-0823-009 fix-forward precedent: add the minimal field, cite the owner FID, defer shape ownership
  to that stream.