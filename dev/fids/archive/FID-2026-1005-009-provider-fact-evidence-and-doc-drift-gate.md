# FID: Evidence-classed provider facts and a docs-count drift gate

**Filename:** `FID-2026-1005-009-provider-fact-evidence-and-doc-drift-gate.md`
**ID:** FID-2026-1005-009
**Severity:** low
**Status:** closed
**Created:** 2026-10-05 17:14
**Automation level:** 3
**YAGNI-Compliance:** Verified

> **Operator directive (verbatim):** *"what are the top 5 most impactful"* and
> *"Draft FIDs for the top 5 ideas, ranked, following the FID template"* —
> raised in the 2026-10-05 reference-project review session ("review a few
> projects saved locally for ideas"). Rank 5 of 5. Register item: T142.

## Summary

Provider facts in the registry — quota endpoints, free-model claims, usage
units — are asserted without provenance, and numeric claims in prose docs
can drift from the registry without any gate noticing. The reference design
(`resources/OmniRoute-v3.8.51/docs/reference/FREE_TIERS.md`) solves this
with two cheap mechanisms: every fact carries an **evidence class** in a
comment beside the entry (`public-page` / `api-public` /
`console-verified <date> <who>`) with the rule "any new or changed number
without an evidence comment is a bug", and the docs' totals are
**recomputed from the catalog and CI-gated** (`check:docs-counts` fails the
build when prose drifts from the computed value). This FID adds both to the
provider-fact surfaces, building on the generated-surface and drift-guard
machinery that already exists (`scripts/generate-provider-reference.ts`,
`scripts/provider-docs-drift.ts`, the 4th generated surface from archived
FID-2026-1005-004).

## Environment

- **OS / shell:** Windows 11 (`win32`), Git Bash (MSYS)
- **Runtime:** Bun `1.3.14`
- **Files:** `common/src/providers/types.ts`, `common/src/providers/registry*.ts`
  (fact-bearing entries), `scripts/generate-provider-reference.ts`,
  `scripts/provider-docs-drift.ts`, `docs/providers.md` (generated surface)
- **Commit/State:** worktree dirty (18 modified files from prior sessions,
  uncommitted); this FID is new
- **Governance:** ECHO Protocol v0.1.2-single-agent
  (`dev/echo-v0.1.2-single-agent.md`), FID-bound, Laws 1/3/4

## Detailed Description

### Problem

1. **Unprovenanced facts.** A quota endpoint or free-model claim in the
   registry has no record of where the claim came from or when it was last
   checked. When the claim changes, nothing demands fresh evidence; when it
   is wrong, nothing can tell how it was established. (The `quota.note`
   field from FID-2026-0919-026 is the right shape — an actionable prose
   note — but it is not a provenance record and is not gated.)
2. **Prose numbers can drift.** The generated surfaces are byte-exact
   (token drift is gated by `scripts/provider-docs-drift.ts`), but
   *numeric claims computed by hand* in prose — counts, allowances,
   summaries — have no recompute gate. The reference project hit this and
   corrected its published headline downward twice; the fix was not
   diligence, it was a gate that fails the build on drift.

### Expected Behavior

Every fact-bearing provider claim carries a machine-readable evidence class
and (where applicable) a verification date. A changed numeric fact without
an evidence class fails validation. Numeric claims in provider prose are
recomputed from the registry by a check that exits nonzero on drift, and
that check runs in the repo's validation chain. Prose about estimates is
worded as estimates — never presented as account or billing truth.

### Root Cause

The registry types model *what the fact is* but not *how it is known*, and
prose surfaces state computed values without a mechanism tying them to the
computation.

### Evidence

```text
resources/OmniRoute-v3.8.51/docs/reference/FREE_TIERS.md (methodology):
  "a number in the catalog cites its source in an `// evidence:` comment
   next to the entry — public-page (a provider page anyone can read),
   api-public (an unauthenticated endpoint of the provider ...), or
   console-verified <date> por <who> (the figure is only visible inside an
   account console; the comment records who saw it and when ...)"
  "any *new or changed* number without an evidence comment is a bug"
  "The figure is enforced by CI. `npm run check:docs-counts` recomputes the
   totals from the catalog and fails the build when this file, the README or
   the budget card drift from them."
  Honesty rules carried by the same gate: shared pools counted once (a
   per-model sum would read ~7.4B where one-account reality is ~1.47B);
   one-time credits reported separately, never blended; rate-limited
   no-cap providers listed, never summed; "Local estimates are never
   presented as provider billing data."

Our side (ground truth, this tree):
  common/src/providers/types.ts — quota block (url/valuePath/limitPath/
    resetPath/unit/note) from FID-2026-0919-026; no provenance field
  scripts/generate-provider-reference.ts — generated surfaces incl. the
    registry table (4th surface, archived FID-2026-1005-004)
  scripts/provider-docs-drift.ts — token-drift pins across README/README
    .zh-CN/docs surfaces; no numeric recompute
  scripts/__tests__/ — suites exist but are referenced by no chain
    (recorded in archived FID-2026-1005-004); a new suite must be declared
    as a gate to have a real execution path
```

## Impact Assessment

### Affected Components

- `common/src/providers/types.ts` — optional provenance metadata on
  fact-bearing fields
- Registry entries carrying quota/free claims — evidence class + date
- `common/src/providers/validate.ts` — the existing
  `validateProviderRegistry` gate gains the evidence rule (changed fact
  without evidence fails)
- `scripts/generate-provider-reference.ts` / `scripts/provider-docs-drift.ts`
  — numeric recompute check for prose claims
- `docs/providers.md` and other generated surfaces — unchanged mechanism,
  now count-gated

### Risk Level

- [ ] Critical
- [ ] High
- [ ] Medium
- [x] **Low** — provenance and doc integrity; no runtime damage when
  absent, but every downstream honesty claim (including FID-2026-1005-008's
  evidence sources) rests on this layer

## Proposed Solution

### Approach

Provenance as typed metadata beside the fact, not prose elsewhere. The
evidence class is part of the registry object so the same
`validateProviderRegistry` gate that already enforces structural invariants
enforces provenance, and the same generator that renders the docs renders
the evidence. No new surface owns the numbers — one truth, per Law 13.

### Steps

1. **Provenance metadata:** optional `evidence` on fact-bearing registry
   fields: `{ class: 'public-page' | 'api-public' | 'console-verified' |
   'reported-unverified', source: string, verified?: string }` — the
   `source` string names the page/endpoint, and `console-verified` requires
   a date and who-saw-it, mirroring the reference evidence classes.
2. **Validation rule:** `validateProviderRegistry` rejects a fact-bearing
   entry whose evidence is absent for *changed* facts (mechanism: the
   generator's baseline comparison, same pattern as the byte-exact drift
   guard — a diff against the last generated surface that adds or changes a
   number without evidence is a validation problem).
3. **Docs-count drift gate:** extend the drift machinery with a recompute
   check: numeric claims in provider prose are rendered from the registry
   (generated blocks) or verified against a recomputation; the check is an
   independently runnable script exiting 0 clean / 1 with issues, declared
   as a probe gate (the `scripts/audit-gate-env-parity.ts` route).
4. **Honesty wording:** estimates get estimate language at render time
   (same rule as the reference: never presented as account or billing
   truth); free-catalog claims stay labeled "advertised ... unverified" as
   `free-options-render.ts` already does — now driven by the metadata.
5. **Gate wiring:** the new test suites are declared as `gate: test` in
   this FID so they have a real execution path (the `scripts/__tests__/`
   orphan problem recorded in archived FID-2026-1005-004).

### Verification

Registry validation tests: entries with and without evidence, the
changed-fact rule, `console-verified` missing date rejected. Drift-gate
tests: a prose number edited by hand makes the check exit 1 with the
specific claim named; a regenerated surface exits 0. The evidence classes
render into `docs/providers.md` and the pin suite covers them.

> Contract rule (FID-2026-0918-006): every promised test artifact MUST name
> its repo-relative `*.test.ts(x)` path, and that path MUST also appear as a
> declared `- gate: test <path>` below.

> Declared now so promise and gate are paired from creation (FID-2026-0918-006).
> They become live enforcement at the `fixed`/`verified` flip
> (FID-2026-0823-009); a `created`/`converged` record is outside the C1–C3
> contract.

## Verification Gates

- gate: typecheck common
- gate: typecheck cli
- gate: test common/src/providers/__tests__/provider-fact-evidence.test.ts
- gate: test scripts/__tests__/provider-docs-counts-drift.test.ts
- gate: test cli/src/utils/__tests__/free-options.test.ts
- gate: probe scripts/provider-docs-counts-drift.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:5b32765004d82269f4393c66aaaaa204b7b83df5dd2a2f68df87c979a1785008
- verified: 2026-10-06T04:19:52.484Z
- typecheck common: exit 0
- typecheck cli: exit 0
- test common/src/providers/__tests__/provider-fact-evidence.test.ts: exit 0
- test scripts/__tests__/provider-docs-counts-drift.test.ts: exit 0
- test cli/src/utils/__tests__/free-options.test.ts: exit 0
- probe scripts/provider-docs-counts-drift.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Two issues cataloged (unprovenanced facts; ungated prose
  numbers). Call-graph check: `validateProviderRegistry` is the live gate
  consumed by `custom-providers.ts` and the registry suites; the generator
  and drift script are wired through `package.json`
  (`generate:provider-docs:check` exists per archived FID-2026-1005-004),
  so the recompute check extends an executed chain rather than starting a
  new one. The new suites get declared gates (Law 4 satisfied at the chain
  level; per-function grep evidence still required at implementation).
- **GREEN:** Design converged — see "Design decisions (GREEN, Loop 1)"
  below; implementation follows that plan when this FID is actioned.
- **AUDIT:** The suites above plus the negative proof: hand-edit a number
  in a scratch copy and paste the check's exit-1 output (an explicitly
  named test, decision 3). Grounding: `types.ts:108-124` read live (the
  `quota` block — `url`/`valuePath`/`limitPath`/`resetPath`/`unit`/`note`,
  no provenance field), `generate-provider-reference.ts` (225 lines) and
  `provider-docs-drift.ts` (236 lines) both under cap and both already
  executed (`generate:provider-docs:check` ran green in this session).
  Live example of the problem class, same session: hand-written "static
  27-model chat roster" claims landed in `docs/features.md` and
  `README.zh-CN.md` during FID-2026-1005-010 — computable from the
  registry, but ungated prose. Latent defect fixed: the Verification
  Receipt prose was unparseable by `scripts/fid-verify.ts` (learned at
  FID-2026-1005-010's stamp) — the section now starts empty.
- **ADVERSARIAL:** Answered below — the changed-fact standing question is
  proven against an EDITED entry, not just an absent one.
- **CHANGE DELTA:** Converged the design (GREEN block + adversarial
  answers + live examples of the drift class); status `created` →
  `converged`.

### Design decisions (GREEN, Loop 1)

All seams below were read or grep-proven live at convergence (Law 1/Law 7).

1. **Provenance metadata** — optional `evidence` beside fact-bearing
   registry fields (quota blocks and any numeric claim):
   `{ class: 'public-page' | 'api-public' | 'console-verified' |
   'reported-unverified'; source: string; verified?: string;
   witness?: string }`. `console-verified` REQUIRES `verified` (date) +
   `witness` (who saw it); `reported-unverified` is the honest default for
   pre-audit facts (Missed Question 1). Enforced by the existing
   `validateProviderRegistry` (`common/src/providers/validate.ts`) — the
   gate that already enforces structural invariants gains the provenance
   shape rule.
2. **Changed-fact rule via baseline diff** — the byte-exact drift machinery
   (this session's 13-item `provider-docs-drift.ts` run proves the chain is
   live) gains per-fact attribution: a diff against the last generated
   baseline that ADDS OR CHANGES a numeric fact without an `evidence`
   record is a validation failure naming the fact. Untouched entries cost
   nothing (Missed Question 2).
3. **Docs-count recompute gate** — a bounded claim→derivation mapping (a
   table in the checker: e.g. "static 27-model chat roster" →
   `Object.keys(chatanywhereModels).filter(chatIds).length`, provider
   totals → registry size) checked by a standalone script exiting 0 clean /
   1 naming the drifting claim (the `audit-gate-env-parity.ts` probe
   route), plus the negative test: hand-edit one number → exit 1 names the
   claim; regenerate → exit 0. Only derivable counts enter the mapping —
   an underivable prose number is either sourced via `evidence` or deleted.
4. **Honesty wording at render** — estimate-class facts render estimate
   language in generated surfaces ("reported-unverified" printed as such);
   free-catalog claims keep `free-options-render.ts`'s "advertised …
   unverified" wording, now driven by the metadata instead of hand prose.
5. **Gate wiring** — both suites are DECLARED gates in this FID (they are,
   above), solving the `scripts/__tests__/` orphan problem from archived
   FID-2026-1005-004 at declaration time; `gate: probe` for the recompute
   script joins the chain at the `fixed`/`verified` flip if the operator
   wants it in `validate:repository` (recorded, not assumed).

### Adversarial answers (Loop 2)

- **Does the changed-fact rule catch a changed fact, or only a missing
  field?** Both, proven against an edited entry: the baseline diff sees the
  number CHANGE (not just absence) and fails naming the old → new values;
  that exact scenario is a named negative fixture, not an intention.
- **What if the baseline is missing or stale?** Bootstrap rule: the first
  run records the baseline with all existing facts grandfathered as
  `reported-unverified`; a missing baseline never means "all facts are
  evidenced" — it means "none are yet" (honest default).
- **Can the recompute gate be gamed by editing the checker's mapping?** Not
  silently: the mapping lives in the checked-in script and its tests pin
  the derivations (edit the mapping → its own suite red). The operator
  remains the boundary for what counts as derivable (Missed Question 3
  parallel).
- **Does this slow provider additions?** No — evidence is one line beside
  the fact (class + source); the session's own chatanywhere additions would
  have carried `public-page` evidence pointing at the vendor's
  GPT_API_free docs and pricing page at zero extra cost.

### Missed Questions

1. **What about facts that predate evidence collection?** They start as
   `reported-unverified` — honest about their provenance rather than
   retroactively blessed — and gain real evidence when next touched. The
   reference project used exactly this honesty rule for its pre-audit
   entries.
2. **Does this slow provider additions?** No new mandatory fields at
   authoring time beyond the evidence record itself (class + source is one
   line beside the entry). The changed-fact rule compares against the
   generated baseline, so untouched entries cost nothing.
3. **Who verifies `console-verified` claims?** Nobody can, mechanically —
   that is why the class records who saw it and when. The gate enforces the
   record's existence and shape; the operator remains the final boundary.
   `reported-unverified` claims are surfaced as such in the generated docs.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** e229d9a1 (local batch commit; not pushed)
- [x] **File:line ranges:**
  - `common/src/providers/types.ts` — `FactEvidenceClass` + `FactEvidence`
    (closed enum; console-verified requires date + witness), attached as
    `evidence?` on the `quota` block and the `static` catalog variant
  - `common/src/providers/fact-evidence.ts` (NEW, 106 lines) — `:34`
    (`validateFactEvidence` shape rule), `:65` (`FactRecord`), `:81`
    (`changedFactsNeedingEvidence` — the changed-fact diff; missing
    baseline grandfathers)
  - `common/src/providers/validate.ts` — `:76` (`registryFactRecords`,
    shared derivation), `:110` (optional `baseline` param on
    `validateProviderRegistry`), `:226,:230` (evidence shape checks wired
    into the per-entry loop)
  - `common/src/providers/registry-partitioned-2.ts:218` — chatanywhere's
    `console-verified` record (the one fact verified live this session:
    30 rows observed 2026-10-05, 3 embedding ids excluded, witness = the
    FID-2026-1005-010 receipt); pre-existing facts stay unannotated
  - `scripts/provider-tables.ts:138` — evidence classes render into the
    registry table (`static (27 models; evidence: console-verified
    2026-10-05)`); `reported-unverified` would print as such
  - `scripts/provider-docs-counts-drift.ts` (NEW, 228 lines) — `:91`
    (`parseCatalogBaseline` — the checked-in generated table IS the
    "last generated baseline"), `:147` (`checkRosterClaims` — the bounded
    `static <N>-model` mapping over 6 sources), `:196` (`checkFactDrift`);
    CLI exits 0 clean / 1 naming each issue
  - `cli/src/utils/free-options.ts` attaches `api-public` source metadata
    to the catalog report; `free-options-render.ts` derives its advertised
    versus reported wording from that class while preserving the separate
    account-access caveat
- [x] **Gate output:** `typecheck common` exit 0 ·
  `provider-fact-evidence.test.ts` 13 pass / 0 fail (29 expects) ·
  `provider-docs-counts-drift.test.ts` 11 pass / 0 fail + the FID-004
  registry-doc pins 5 pass (byte-sync survived the catalog-cell change) ·
  full `common` battery 787 tests / 0 fail · live script run exit 0
  ("Provider docs counts match the registry") · quality: 106/228/188/151
  lines, all under the ratchet · ESLint 0, Prettier clean, `lint:md` exit 0
- [x] **Reproducibility:** `bun run scripts/provider-docs-counts-drift.ts`
  re-runs deterministically (pure checks over checked-in files); both
  suites are pure-function tests plus the live-repo integration legs
- [x] **Step statuses:** 1 `implemented` (typed evidence + shape rule;
      demonstrated on chatanywhere) · 2 `implemented` (changed-fact rule;
      as-built the baseline is the checked-in generated table, not a
      separate file — one less artifact, same mechanism) · 3 `implemented`
      (the recompute gate; the bounded mapping covers the measured 18-site
      roster-claim class — no provider-total prose claims exist to map, so
      that mapping entry is vacuous by measurement) · 4 `implemented`
      (generated surfaces and free-catalog caveats now read evidence class
      metadata; free listing provenance remains distinct from account quota
      evidence) · 5 `implemented` (declared suites and the live probe run;
      the probe is chained into `validate:repository`)

### Code Verification Evidence

> Before marking status as `fixed` or `verified`, verify that referenced code
> exists. FID metadata is a claim; code is ground truth.

- [x] Files referenced in Affected Components exist (all as-built paths
      verified by grep/wc in the audit leg)
- [x] Implementation matches the Proposed Solution (steps 1–5 implemented)
- [x] Typecheck/tests/lint pass — gate output above
- [x] Production call-graph evidence: `validateProviderRegistry`'s evidence
      checks run inside the live registry gate (the full `common` battery
      exercises them); `checkRosterClaims`/`checkFactDrift` run over the
      real repo in both the suite and the live script run
- [x] FID status reflects the actual implementation state — `verified`
      with all five steps implemented

### Loop 2 — Independent audit and self-correction

Convergence audit complete (1 iteration): grounding leg (types.ts quota
block read, both scripts measured under cap and chain-executed, the drift
chain exercised first-hand this session) + manual re-read — one live
example added to the audit record (the chatanywhere prose counts) and one
latent defect fix (receipt-section grammar). No overclaims found.

Implementation audit (2nd iteration, at `verified`): static leg (grep the
as-built call-graph, wc against the ratchet) + manual re-read. Three real
bugs caught and fixed in-pass, each now pinned by a test: (a) the
measured **'OpenAI-compatible' mis-attribution** — the boundary matcher
read the wire-protocol adjective as the `openai` provider, so every
gateway claim attributed wrong; fixed with hyphen-excluding boundaries
(\"OpenAI-compatible\" is no longer a provider reference); (b) the
`Math.min` sentinel bug — a non-matching id's -1 erased a real label
position (4 vs -1 → -1), landing attribution on the first registry entry;
fixed by filtering non-matches; (c) the baseline parse regex demanded a
closing paren right after the count and silently dropped the one row with
an evidence suffix — fixed to a word boundary (this also revealed that
`checkFactDrift`'s earlier "pass" was chatanywhere's own evidence
legitimately clearing the new-fact rule, not a false grandfather). Test
fixes: the apostrophe-in-title syntax error, and the integration fixture's
delta direction (baseline 9 → derived 7 reads "9 → 7").

### Loop 3 — Final convergence

Design complete: every promise pairs with a declared gate (the two named
suite paths, typecheck common, quality), all three missed questions carry
explicit defaults (reported-unverified grandfathering, zero-cost untouched
entries, operator as the console-verified boundary), adversarial questions
answered with named negative fixtures, YAGNI reviewed (no provenance DB —
metadata beside the fact; no new surface owns the numbers — Law 13).
Status `converged` — the correct pre-implementation status. Implementation
is NOT started: FID-bound execution.

## Resolution

- **Closed Date:** 2026-10-06; commit e229d9a1 (local, not pushed)
  archive per the Auto-Archive rule)
- **Fix Description:** Introduced typed evidence provenance beside provider
  facts (closed class enum; console-verified requires date + witness), the
  changed-fact rule diffing registry facts against the checked-in generated
  baseline, and the docs-count recompute gate covering the measured
  18-site roster-claim class. Evidence classes render into the registry
  table; chatanywhere's roster carries the first real evidence record.
- **Tests Added:**
  `common/src/providers/__tests__/provider-fact-evidence.test.ts`
  (188 lines, 13 tests),
  `scripts/__tests__/provider-docs-counts-drift.test.ts` (151 lines,
  11 tests incl. the live-repo integration legs)
- **Verification Evidence:** receipt stamped by `bun run fid:verify
  --write` below; gate output recorded in Implementation Evidence
- **Archived:** dev/fids/archive/FID-2026-1005-009-provider-fact-evidence-and-doc-drift-gate.md

## Lessons Learned

The reference project's honesty corrections (a published total dropping
~1.94B → ~1.62B → ~1.37B across audits) were not caution — they were what a
recompute gate surfaces once it exists. The general lesson: a number in
prose is a claim, a number in a gated computation is a fact, and the cheapest
integrity upgrade available to any catalog is to move each number from the
first category to the second, one gate at a time.
