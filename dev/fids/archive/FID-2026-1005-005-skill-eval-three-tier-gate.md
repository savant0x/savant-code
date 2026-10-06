# FID: Three-tier evals for the skill catalog — structural, trigger-routing, behavioral

**Filename:** `FID-2026-1005-005-skill-eval-three-tier-gate.md`
**ID:** FID-2026-1005-005
**Severity:** high
**Status:** closed
**Created:** 2026-10-05 17:14
**Automation level:** 3
**YAGNI-Compliance:** Verified — extends the existing skills-check
 discovery, the existing proposal gate, and the existing `runSkillProve`
 A/B path; adds small focused modules and no new dependency.

> **Status note:** implementation and offline gates are verified. Live,
> token-costed Tier-3 trials remain operator-invoked by design.

> **Operator directive (verbatim):** *"what are the top 5 most impactful"* and
> *"Draft FIDs for the top 5 ideas, ranked, following the FID template"* —
> raised in the 2026-10-05 reference-project review session ("review a few
> projects saved locally for ideas"). Rank 1 of 5. Register item: T138.

## Summary

The self-improving harness authors and patches skills (`skill_manage`,
`lessons:to-skills`) and gates them on structure plus operator trust, but
nothing measures whether a skill's description actually routes to it or
whether following it changes behavior for the better. Skill changes are
approved on prose alone. This FID ports the three-tier skill-eval design from
`resources/agent-skills-main/evals/README.md`: Tier 1 structural checks (CI,
free), Tier 2 deterministic trigger/routing evals over descriptions (CI,
free), Tier 3 behavioral runs graded against per-skill `expectations[]` (on
demand, token-costed), plus an append-only rejected-changes ledger so refused
proposals are never re-attempted blind.

## Environment

- **OS / shell:** Windows 11 (`win32`), Git Bash (MSYS)
- **Runtime:** Bun `1.3.14`
- **Files:** `evals/` workspace (`@savant-code/evals`, existing
  `evals/v2/tests/` surface), `scripts/skills-check` (existing structural
  checker, 27 skills), `docs/self-improving-harness.md`
- **Commit/State:** worktree dirty (18 modified files from prior sessions,
  uncommitted); this FID is new
- **Governance:** ECHO Protocol v0.1.2-single-agent
  (`dev/echo-v0.1.2-single-agent.md`), FID-bound, Laws 1/3/4

## Detailed Description

### Problem

Skill quality is asserted, never measured. Three concrete gaps:

1. **Trigger accuracy is unmeasured.** Whether a skill's `description` fires
   on the phrasing users actually type is unknown. The reference repo
   measured that a single description clause moved one skill's fire rate from
   7/27 to 21/27 while keeping must-not-fire prompts at 0/27 — the
   description is the routing API, and ours are patched without measurement.
2. **No collision detection.** Two skills with overlapping descriptions
   silently outrank each other; nothing checks the catalog as a whole.
3. **No behavior proof.** A quarantined draft earns trust on review prose;
   nothing runs the workflow it encodes and grades the outcome.

### Expected Behavior

Every trusted skill carries structural validation, positive and negative
trigger prompts, and an expectations rubric graded on demand. Description
hashes bind cases to current routing text, and `/skills trust` rejects stale
cases. Rejected proposals append to the pattern wiki and the skill-impact
ledger, with paired scores when a proof exists.

### Root Cause

`skills:check` validates structure only, and the `evals/` workspace has no
skill-efficacy tier. The trust gate (quarantine → operator review) answers
"is this safe to load", not "does this help" — the second question has no
mechanism at all.

### Evidence

```text
resources/agent-skills-main/evals/README.md (three tiers):
  "Tier 2 ... does each skill's description carry the vocabulary users
   actually say, and do two skills' descriptions collide?"
  "A Tier-2 failure usually means *fix the description*, not the eval."
  Tier 2 = "stemmed TF-IDF over descriptions" — deterministic, CI-safe.
  Tier 3 = headless run in a throwaway git repo, fixtures materialized from
   evals/fixtures/, grader over expectations[]; "Traces are fenced as
   untrusted data in the grader prompt"; execution vs dialogue kinds.
  "Discipline skills also include pressure cases for time pressure, sunk
   cost, and authority pressure."

resources/agent-skills-main/evals/skill-impact.md (rejected ledger):
  "This append-only ledger records skill and description changes rejected on
   eval evidence so contributors can review prior attempts before proposing
   overlapping work."

Our side (ground truth, this tree):
  bun run skills:check — 27 skills, 0 errors (structural only)
  evals/v2/tests/skill-proof-label.test.ts — an eval surface exists
  docs/self-improving-harness.md — quarantine -> trust lifecycle; skill
   patches capped at a 10% Levenshtein change ratio; no efficacy check
```

## Impact Assessment

### Affected Components

- `evals/` workspace — new skill-efficacy tier (cases, fixtures, runner)
- `scripts/skills-check` — Tier 1 structural alignment
- `common/src/util/skill-management/mutations.ts` — `skill_manage` patches
  that change a `description` should require a trigger fixture
- `scripts/lessons-to-skills.ts` — drafts gain expectations rubrics
- `cli/src/commands/skills.ts` — `/skills show <name> --review` can surface
  eval status alongside the quarantined bytes

### Risk Level

- [ ] Critical
- [x] **High** — every skill change the harness proposes or the operator
  approves today ships unmeasured; a harmful or non-triggering skill passes
  the current gates cleanly
- [ ] Medium
- [ ] Low

## Proposed Solution

### Approach

Add three tiers to the `evals/` workspace, cheapest first, none blocking the
others. Tier 2 is the keystone: a deterministic, token-free routing check
that can gate CI. Borrow the reference repo's division of labor exactly —
Tier 2 is a lexical approximation that catches the two dominant trigger bugs
(description missing user vocabulary; description too broad), while semantics
stay Tier 3's job.

### Steps

1. **Tier 1 — structural:** extend the existing structural checker with
   frontmatter/naming/required-section parity and command parity pins.
2. **Tier 2 — trigger and routing:** per-skill case file
   (`evals/.../cases/<skill>.json`) with positive prompts (must rank the
   skill top-k) and negative prompts (must not); stemmed TF-IDF over
   descriptions; a rank-1 floor enforced in CI (`--min-rank1` style
   threshold, measured first, ratcheted, never invented).
3. **Tier 3 — behavioral:** paired headless runs in isolated temporary
   workspaces with fixtures from `evals/v2/tasks/`, grader over
   `expectations[]`; execution and dialogue artifact kinds; traces fenced as
   untrusted grader input; timeouts on agent and judge calls; results written
   outside the tracked tree.
4. **Pressure cases** for discipline-shaped skills (time pressure, sunk
   cost, authority pressure) proving the workflow holds when the prompt
   argues for skipping it.
5. **Rejected-changes ledger** — append-only `evals/skill-impact.md`
   recording refusals with before/after scores so overlapping proposals are
   informed by prior attempts.

### Tier-2 design decisions (GREEN, Loop 1)

**Catalog source and scope.** Tier 2 evaluates the project-scoped catalog
(`.agents/skills/` trusted + `.quarantine/` drafts, `.claude/skills/` when
present) through the existing `discoverSkillDirs` /
`checkAllSkills` discovery (`scripts/skills-check.ts`), with the same
repo-gate policy as the checker (FID-2026-0824-012): project-scoped skills
can fail the build, home-root skills are advisory only. Per-skill routing
vector = frontmatter `name` tokens (weight x2) + `description` tokens —
exactly the metadata the loader exposes per turn.

**Case files.** `evals/v2/skill-cases/<skill-name>.json`, validated by a
zod schema in the new module. Shape: `skillName` (must equal dir name),
`trigger.positive[]` (>= 3: `{ prompt, topK? }`, `topK` default 3, `1` for
a signature ask), `trigger.negative[]` (>= 2: `{ prompt, owner? }`). A
negative WITH `owner` asserts the owner skill outranks this one (pairwise,
non-vacuous); `owner` must name a skill present in the catalog and must
not equal `skillName` — the schema rejects both (an unknown owner makes the
pairwise assertion vacuous, the exact failure the field exists to
prevent). Without `owner` the assertion is only "not rank-1". Prompt
authoring rule adopted from the reference: paraphrase user language, never
paste the description — a realistic prompt that cannot rank exposes a
description vocabulary gap, and the fix is the description, not the prompt.

**Ranking (deterministic, zero model calls).** Normalize: lowercase, split
on non-alphanumerics and camelCase boundaries, drop a fixed stopword list,
strip crude suffixes (-s, -ing, -ed) — a documented lexical approximation;
semantics belong to the behavioral tier. Vector = TF-IDF over the prompt
against the skill-metadata corpus; ranking = cosine similarity; ties break
by skill name so runs are reproducible. Law 7 search (2026-10-05): the tree
has no stemmer/vectorizer (`tokenize` hits are token counting —
`token-counter.ts`, `context-tokens.ts`), so this is a new, small, pure
module; Levenshtein (`common/src/util/skill-management/helpers.ts`) is not
reused — edit distance answers a different question. No new dependency.

**Metrics and thresholds.** Primary: catalog and per-skill **rank-1 rate**
(positives ranking their skill first); top-k secondary. Collision check:
pairwise cosine between skill description vectors — error at >= 0.75,
warn at >= 0.50 (reference-measured defaults). Floor: checked-in
`evals/v2/skill-cases/floor.json` (`rank1Floor`, `measuredAt`); the suite
fails when the current rate is under the floor and when a change lowers the
floor below the committed value (ratchet guard) — raise as routing
improves; lowering requires an operator ruling.

**Case coverage rules.** Trusted skill without a case file = CI error
(`trigger-cases-missing`). Quarantined draft without complete cases is NOT
a CI error (the draft is inert and loader-invisible) but is refused at
trust time via the existing proposal gate
(`evals/v2/src/prove/proposal-gate-bridge.ts`): >= 3 positive + >= 2
negative required before trust.

**Wiring.** Module `evals/v2/src/skill-evals/` (trigger-cases.ts schema,
rank.ts tokenizer+TF-IDF+cosine, run.ts catalog loop) with the two suites
declared as this FID's gates (`evals/v2/tests/skill-trigger-routing.test.ts`,
`evals/v2/tests/skill-structural-tier.test.ts`), executed by the existing
`bun test v2/tests` chain (`test:v2`). The behavioral tier stays the
existing A/B path `runSkillProve` (`evals/v2/src/prove/skill-prove.ts`,
`TrialArm` baseline/active + `scanActivation`); Tier 2 is the free pre-gate
that must pass before a token-costed trial run is worth spending.

**Description-change contract.** Each case file records
`descriptionSha256`. The trigger suite fails when it does not match the
trusted skill's current description, and `/skills trust` refuses a draft
whose case hash does not match its frontmatter. This covers `skill_manage`
patches and `lessons:to-skills` drafts at the trust boundary. The description
is the routing API; every change to it is measured by the
rank-1 rate before and after (reference measurement: one clause moved a
skill 7/27 -> 21/27 fires with must-not-fire held at 0/27).

### Verification

Tier 1 and Tier 2 run offline in CI; Tier 3 is on-demand only (it spends
tokens) and never gates CI. Success is measured, not asserted: the rank-1
floor is established from a first measured run and ratcheted upward.

> Contract rule (FID-2026-0918-006): every promised test artifact MUST name
> its repo-relative `*.test.ts(x)` path, and that path MUST also appear as a
> declared `- gate: test <path>` below.

> Declared now so promise and gate are paired from creation (FID-2026-0918-006).
> They become live enforcement at the `fixed`/`verified` flip
> (FID-2026-0823-009); a `created` record is outside the C1–C3 contract.

## Verification Gates

- gate: typecheck evals
- gate: typecheck common
- gate: typecheck cli
- gate: test evals/v2/tests/skill-structural-tier.test.ts
- gate: test evals/v2/tests/skill-trigger-routing.test.ts
- gate: test evals/v2/tests/skill-behavioral-arm.test.ts
- gate: test evals/v2/tests/skill-behavioral-grading.test.ts
- gate: test evals/v2/tests/skill-prove.test.ts
- gate: test cli/src/commands/__tests__/skills-command.test.ts
- gate: probe evals/v2/src/skill-evals/run.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:b43d8782923c31024f4e14921b7f1299eed751a549424471e8005f5b540c24d8
- verified: 2026-10-06T04:18:56.212Z
- typecheck evals: exit 0
- typecheck common: exit 0
- typecheck cli: exit 0
- test evals/v2/tests/skill-structural-tier.test.ts: exit 0
- test evals/v2/tests/skill-trigger-routing.test.ts: exit 0
- test evals/v2/tests/skill-behavioral-arm.test.ts: exit 0
- test evals/v2/tests/skill-behavioral-grading.test.ts: exit 0
- test evals/v2/tests/skill-prove.test.ts: exit 0
- test cli/src/commands/__tests__/skills-command.test.ts: exit 0
- probe evals/v2/src/skill-evals/run.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Issues cataloged above (three gaps: unmeasured trigger accuracy,
  no collision detection, no behavior proof). Call-graph check for the
  proposed wiring: `evals/v2/tests/` is an existing executed surface
  (`evals` workspace tests run per-workspace); `skill_manage` validation
  lives at `common/src/util/skill-management/mutations.ts`; the structural
  checker is `scripts/skills-check`. No orphaned-new-surface risk if the
  suites are declared as gates — `scripts/__tests__/` suites are otherwise
  unreferenced by any chain (recorded in archived FID-2026-1005-004).
- **GREEN:** Design recorded under "Tier-2 design decisions (GREEN,
  Loop 1)" — catalog scope, case-file schema, deterministic TF-IDF/cosine
  ranking, rank-1 metric + ratchet floor, collision thresholds, coverage
  rules (trusted = CI, drafts = trust gate), wiring into the existing
  `test:v2` chain and `runSkillProve`, and the description-change contract.
  Implementation evidence and the revised call graph are recorded below.
- **AUDIT:** Design-level double audit, two independent methods. (1) Tree
  grounding — every cited path verified to exist this session:
  `scripts/skills-check.ts` discovery decomposition, `evals/v2/src/prove/`
  (`skill-prove.ts`, `proposal-gate-bridge.ts`),
  `common/src/util/skill-management/helpers.ts`, and the Law 7 search
  result (no existing vectorizer; tokenize hits are token counting).
  (2) Contract re-read — the two suites promised in the design are exactly
  the two declared `gate: test` paths (FID-2026-0918-006 pairing holds),
  and no second behavioral mechanism was invented (Tier 3 is the existing
  `runSkillProve` A/B path). Behavioral determinism (same input, same
  ranking) and the full `evals` suite are audited at implementation, where
  they can be executed rather than asserted.
- **ADVERSARIAL:** Standing question — "can Tier 2 pass while routing is
  actually broken?" Answered structurally: owner-anchored negatives are
  pairwise and non-vacuous, the metric is rank-1 (not top-k), and the
  collision check catches description drift. Named residual: a lexical
  tier cannot judge semantics — that limit is explicit and routed to
  `runSkillProve`, not hidden behind the score.
- **CHANGE DELTA:** Added the Tier-2 design block (GREEN fill of a created
  record — additive, no rework; house delta convention is descriptive, cf.
  archived 2026-10-04/10-05 records).

### Missed Questions

1. **Does Tier 3 run in CI?** No. It spends tokens on every run and its
   output is stochastic; the deterministic Tier 2 is the CI gate. Default:
   Tier 3 on demand only, results recorded per run with the model and
   harness version pinned (the reference repo changed default models twice
   in one day).
2. **What about the 27 existing skills without fixtures?** Ratchet, not
   retrofit: new and patched skills require fixtures; the existing set is
   the measured baseline the floor is raised from. Nothing blocks on a
   missing fixture for untouched skills.
3. **Where does the ledger live?** `evals/skill-impact.md`, in the tracked
   tree next to the cases — it must be reviewable in the diff, and it never
   enters the loader's context path.
4. **How are same-name skills across the four roots handled?** Loader
   precedence wins (the `getDefaultSkillsRoots` order, later overriding
   earlier); the eval ranks the effective copy once, and the structural
   tier flags cross-root name collisions as findings so precedence never
   silently decides a routing question.
5. **What runs on day one, before any case files exist?** The implementation
   ships with cases for all 11 currently discovered trusted skills —
   authored prompts are content, not scaffolding — and the floor is
   bootstrapped from that first measured run. A trusted skill without cases
   fails the suite by design; that failure list is the work list.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** e229d9a1 (local batch commit; not pushed)
- [x] **File:line ranges:** Tier 1/2 `evals/v2/src/skill-evals/run.ts`;
      cases `evals/v2/skill-cases/*.json`; proof runner
      `evals/v2/src/prove/production-trial-runner.ts`;
      tool restriction `evals/v2/src/prove/restricted-execution-agent.ts`;
      trust binding `common/src/util/skill-management/trust.ts`;
      rejection ledger `cli/src/commands/skills-impact-ledger.ts`.
- [x] **Gate output:** stamped below by `bun run fid:verify`.
- [x] **Reproducibility:** `bun run fid:verify dev/fids/FID-2026-1005-005-skill-eval-three-tier-gate.md --write`.
- [x] **Step statuses:** steps 1–5 `implemented`; Tier 3 is operator-invoked
      to avoid spending tokens in CI.

### Code Verification Evidence

> Before marking status as `fixed` or `verified`, verify that referenced code
> exists. FID metadata is a claim; code is ground truth.

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution; execution proofs expose
      only temp-workspace file tools and run deterministic verification.
- [x] Typecheck, focused tests, lint, Markdown lint, and quality report pass.
- [x] Production call graph: `prove-cli.ts` selects the per-skill case and
      `production-trial-runner.ts` prepares paired arms, runs the SDK,
      captures trace plus output files, applies deterministic checks, grades
      expectations, then `skill-prove.ts` persists results in each trial.
      `/skills trust` validates description hashes; `/skills reject` appends
      the paired evidence to the ledger.
- [x] FID status reflects the verified offline implementation; live model
      trials remain an on-demand proof command.

### Loop 2 — Independent audit and self-correction

- **RED:** Audit findings on the design: (a) `owner` is author-controlled —
  an owner naming a skill that does not exist makes the pairwise assertion
  vacuous (the exact failure the field exists to prevent), and
  `owner === skillName` would assert a skill outranks itself; (b) the
  "no new dependency" claim re-checked against `evals/package.json`
  (deps: diff, p-limit, yaml, zod — zod covers the schema; no NLP dep
  required); (c) the draft/CI split re-read to confirm a quarantined draft
  can neither fail nor pass the trusted tier's CI.
- **GREEN:** Corrections applied — schema hardening folded into the Case
  files paragraph: `owner` must reference a catalog-present skill and must
  not equal `skillName`; self-owner is rejected by schema validation and an
  unknown catalog owner is rejected by the routing eval. (b) and (c)
  confirmed as already correct; no change needed.
- **AUDIT:** Re-read after correction, exact character match verified on
  the edited region; promise↔gate pairing unchanged; delta small and
  additive (Loop 2).
- **ADVERSARIAL:** Residual — Git history is required for the floor lowering
  check; when no committed floor exists, first-run measurement establishes
  the baseline. The live catalog floor and git-backed ratchet are tested.
- **CHANGE DELTA:** Added description hash validation at CI and trust time,
  and retained the owner-schema corrections.

### Loop 3 — Final convergence

- **RED:** Final risks — live model output remains stochastic and token-costed;
  offline tests cover rubric parsing, paired fixtures, constrained execution,
  deterministic verification, and artifact persistence.
- **GREEN:** Final corrections — all five steps implemented, including
  pressure cases for time, sunk cost, and authority; no CI model calls added.
- **AUDIT:** Final evidence — declared gates cover typechecks, routing,
  behavioral case coverage, paired artifact persistence, operator trust,
  the live offline probe, and quality report. Tier-3 execution still requires
  operator credentials and explicit invocation.
- **ADVERSARIAL:** Final challenge — is any claim here unverifiable at
  implementation? The lexical tier is explicitly a proxy; its
  falsification path is the behavioral tier (`runSkillProve` A/B arms).
  No claim survives on intention alone.
- **CHANGE DELTA:** Record updated from converged design to verified
  implementation; no claim of live model execution added.

## Resolution

- **Closed Date:** 2026-10-06; commit e229d9a1 (local, not pushed)
- **Fix Description:** implemented three-tier validation, case coverage for
  all 11 discovered trusted skills, description-hash trust enforcement,
  pressure rubrics, constrained execution trials, deterministic checks,
  persisted expectation evidence, and idempotent rejection ledger rows.
- **Tests Added:** structural, routing, behavioral arm/grading, paired proof,
  and operator trust/rejection suites (all declared above).
- **Verification Evidence:** all declared `fid:verify` gates pass; receipt
  fingerprint stamped above. Live token-costed trials remain on demand.
- **Archived:** dev/fids/archive/FID-2026-1005-005-skill-eval-three-tier-gate.md

## Lessons Learned

Port the mechanism, not the volume: the reference catalog carries 25 skills
with per-skill eval cases because its authors accepted the fixture cost up
front. For a self-improving harness the cheaper order is inverted — gate new
skills on fixtures from day one (cost near zero, since drafts are born in
quarantine), then ratchet the baseline. The measurable-lever lesson stands
regardless of scale: the description is the routing API, and an unmeasured
description change is the highest-leverage blind edit in the system.
