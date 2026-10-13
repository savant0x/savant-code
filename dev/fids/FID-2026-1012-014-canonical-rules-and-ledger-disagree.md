# FID: The canonical rule catalogue and the ledger disagree about what a rule is

**Filename:** `FID-2026-1012-014-canonical-rules-and-ledger-disagree.md`
**ID:** FID-2026-1012-014
**Severity:** high
**Status:** verified
**Created:** 2026-10-12 19:05
**Automation level:** 3
**YAGNI-Compliance:** Verified
**Master FID:** FID-2026-1012-022 (The failure-class remediation program)

---

## Summary

`dev/LEARNING-RULES.md` defines 32 canonical rules; the ledger references eight of them, so 24
named rules are cited by nothing. Three further legacy rule references have no catalogue heading;
26 of the 34 governed lessons name no rule at all. The
validator only asks whether a *named* rule has exactly one catalogue heading, so it is blind to
both directions of the disagreement. Every governed lesson is `Scope: internal`, which leaves
the schema's other two scope values unused and makes the shipped subset
`docs/embedded-learnings.md` a hand-curated file frozen at 2026-08-11 (4 lessons) rather than a
promotion target — 34 lessons have been written since with no path into it. The catalogue that
names durable rules and the file that carries them are not kept in step by anything, which is
why no loader can select "the rules that apply" (review §3 B2, B3, C1, C2, E2; feature F2).

## Environment

- **OS:** Windows 11 (win32), Git Bash
- **Language/Runtime:** TypeScript 5.5.4, Bun 1.3.14
- **Tool Versions:** `bun 1.3.14`; validators `scripts/learnings*.ts`
- **Commit/State:** `main` @ `14d48820`

## Detailed Description

### Problem

The rule catalogue and the ledger describe the same rules and agree about almost none of them.

- The catalogue is 193 lines defining **32** `## Rule:` headings, each carrying an
  `**Authority:**` (the module that owns the behaviour) and a `**Validation:**` (the check that
  proves it).
- The ledger carries **11** rule references: **8** name catalogue rules in governed space;
  the **3** legacy-only names are absent from the catalogue. **24 catalogue rules have no lesson.**
- Symmetrically, **26 of the 34 governed lessons carry no `Canonical rule`** — so most lessons
  assert an invariant that belongs to no named authority.
- `validateCanonicalRuleCatalog` (`scripts/learnings-references.ts`) checks one property only:
  that a rule *named by a lesson* has exactly one catalogue heading. An unused rule and an
  unruled lesson are both invisible to it, and `learnings:check` reports PASS
  (34 structured entries; 3 narrative entries below boundary — unvalidated by design).

The consequence is a promotion dead end. All 34 governed lessons are `Scope: internal`; the
schema's `embedded` and `release` scopes appear nowhere in the ledger. The one shipped learning
artifact, `docs/embedded-learnings.md`, is a 3 KB hand-curated file holding **4 lessons, all
dated 2026-08-11**, all `Scope: embedded`. It is not generated from the ledger and nothing
drift-checks it: `scripts/generate-protocol-bundle.ts:86` only aliases the bundle key so that an
embedded request for `dev/learnings.md` is served that curated file
(`common/src/util/embedded-protocol.ts:37`). The 34 lessons written since have had no route into
it, so the shipped guidance ages while the internal ledger grows.

The same gap limits the skills bridge: eligibility requires a `Canonical rule` matched to a
≥3-distinct-session raw-trace recurrence (`scripts/lessons-to-skills.ts:findCandidates`), which
is why `.agents/skills/.quarantine/` holds only 4 drafts from 34 lessons. And because a lesson
carries both the rule and the incident that produced it — roughly 31 lines / ~2 KB each,
dominated by narrative `Failure` prose — the boot read pays for the incident to receive the
rule (review §3 C1, C2; FID-2026-1012-010).

### Expected Behavior

A named rule is the durable artifact and a lesson is the evidence for it. Every governed lesson
either names an existing rule or is explicitly marked historical; every rule in the catalogue is
either selected for the boot tier or marked reference/historical with a reason; and the shipped
subset is a generated projection of the boot tier that a drift check keeps honest.

### Root Cause

The ledger is the only artifact with a schema, so it carries the rule and the incident together,
while the catalogue that names rules is a passive vocabulary that nothing keeps in step. Nothing
in the contract asks a rule to be *used* or a lesson to be *ruled*; the validator was written to
catch a dangling reference, not a disagreement.

### Evidence

```text
$ wc -l dev/LEARNING-RULES.md
193 dev/LEARNING-RULES.md
$ grep -c '^## Rule:' dev/LEARNING-RULES.md
32
$ grep -c '^- \*\*Canonical rule:' dev/LEARNINGS.md
11
$ sed -n '1,1085p' dev/LEARNINGS.md | grep -c '^- \*\*Canonical rule:'
8
$ sed -n '1086,$p' dev/LEARNINGS.md | grep -c '^- \*\*Canonical rule:'
3
$ sed -n '1,1085p' dev/LEARNINGS.md | grep -c '^## Lesson:'
34
$ grep -h '^- \*\*Scope:\*\*' dev/LEARNINGS.md | sort | uniq -c
      1 - **Scope:** cli, performance
      1 - **Scope:** cli, TUI
      1 - **Scope:** harness, skills
     34 - **Scope:** internal
$ ls -l docs/embedded-learnings.md
3088 bytes (4 lessons, all dated 2026-08-11, all Scope: embedded)
$ bun run learnings:check
learnings: PASS (34 structured entries; 3 narrative entries below boundary — unvalidated by design)
```

Catalogue shape (`dev/LEARNING-RULES.md:1-13`): `## Rule: generated-artifact-drift` /
`- **Authority:** scripts/generate-protocol-bundle.ts` /
`- **Validation:** bun run generate:protocol-bundle:check`.

Validator scope (`scripts/learnings-references.ts:validateCanonicalRuleCatalog`): duplicate
`## Rule:` headings fail; a rule named by a lesson must have exactly one heading; nothing
examines a rule no lesson names, and nothing examines a lesson with no rule.

## Impact Assessment

### Affected Components

- `dev/LEARNING-RULES.md` (the rule vocabulary)
- `dev/LEARNINGS.md` (governed lessons and their `Canonical rule` fields)
- `scripts/learnings-references.ts`, `scripts/learnings-validation.ts`, `scripts/learnings.ts`
  (`learnings:check`, wired into `validate:repository`)
- `docs/embedded-learnings.md` (the shipped subset) and
  `scripts/generate-protocol-bundle.ts` (the bundle that serves it)
- `scripts/lessons-to-skills.ts` (bridge eligibility) and `FID-2026-1012-010` (the boot digest
  that needs a tier to select from)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Loop 2 and `docs/design/perfection-loop-2026-10-12.md` govern implementation where
they correct the original plan. No age-based class disposition or repair is implied.

Make the rule — not the lesson — the loadable unit, and keep the two artifacts in step in both
directions.

### Steps

1. Give each catalogue rule an explicit tier (`boot` | `reference` | `historical`) with a
   one-line reason, and make the `boot` tier the set a loader selects. `FID-2026-1012-010`
   consumes this tier to generate the bounded boot digest; this record defines it.
2. Require every governed lesson to either name an existing rule or be explicitly `historical`,
   and extend `learnings:check` to enforce **both** directions: no orphan rule (a rule no lesson
   and no tier claims) and no unruled governed lesson. Keep the existing dangling-reference
   check unchanged.
3. Turn `docs/embedded-learnings.md` into a generated projection of the boot tier with a drift
   check, in the same shape every other generated artifact in this repository uses — regenerate,
   compare, fail on divergence — rather than a hand-edited file whose currency nothing tests.
4. Give `Scope: embedded` and `Scope: release` their real meaning as promotion targets: a lesson
   promoted into the shipped subset says so, and the projection is built from the rules those
   lessons name.
5. Keep the incident under the rule: the narrative `Failure` prose stays in the ledger as
   evidence, but the boot tier carries the rule, its guard and its validation command — so
   shrinking the boot payload (review §3 C1) does not cost the audit trail.

### Verification

This record is pre-implementation: the checks below are the plan, and the covering gates are
declared (with their receipts) when the artifacts exist.

- Catalogue tiering: every `## Rule:` heading carries a tier, the tiers are closed-set, and a
  rule with no tier fails.
- Bidirectional consistency: a seed ledger with an unused rule fails, a seed ledger with an
  unruled governed lesson fails, and the real repository passes with 32 rules and 34 lessons
  after the reconciliation pass.
- Projection: regenerating the shipped subset twice is byte-identical, and an edit to the
  projection without regenerating fails the drift check.
- Scope promotion: a lesson marked for the shipped subset reaches it through the pipeline, with
  the projection naming the rule it came from.
- No regression in the existing contract: `bun run learnings:check` and
  `bun run validate:repository` stay green, and `lessons:features --check` is unaffected
  (`FID-2026-1012-015` owns that failure).

## Verification Gates

- gate: typecheck common
- gate: typecheck packages/agent-runtime
- gate: test scripts/__tests__/learnings-rule-tiers.test.ts
- gate: test scripts/__tests__/learnings-projection.test.ts
- gate: test scripts/__tests__/learnings-boot-digest.test.ts
- gate: test scripts/learnings.test.ts
- gate: test scripts/__tests__/lessons-to-skills.test.ts
- gate: test scripts/__tests__/lessons-to-skills-drafting.test.ts
- gate: probe scripts/learnings-projection-check.ts
- gate: probe scripts/protocol-bundle-check.ts
- gate: probe scripts/scripts-typecheck-check.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:5e0a7adad85a672a7782e3d36a9a49a5516b83af76f06149a00ed41a4a22cc9d
- verified: 2026-10-13T15:03:04.834Z
- typecheck common: exit 0
- typecheck packages/agent-runtime: exit 0
- test scripts/__tests__/learnings-rule-tiers.test.ts: exit 0
- test scripts/__tests__/learnings-projection.test.ts: exit 0
- test scripts/__tests__/learnings-boot-digest.test.ts: exit 0
- test scripts/learnings.test.ts: exit 0
- test scripts/__tests__/lessons-to-skills.test.ts: exit 0
- test scripts/__tests__/lessons-to-skills-drafting.test.ts: exit 0
- probe scripts/learnings-projection-check.ts: exit 0
- probe scripts/protocol-bundle-check.ts: exit 0
- probe scripts/scripts-typecheck-check.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED (2026-10-12)

- **RED:** 32 rules defined, 11 referenced (8 governed + 3 legacy), 21 cited by nothing; 26 of
  34 governed lessons name no rule; all 34 governed lessons `Scope: internal`; the shipped
  subset is a 4-lesson hand-curated file frozen at 2026-08-11 with no generation and no drift
  check; the skills bridge reaches 4 drafts because eligibility requires a canonical rule. The
  validator named above cannot see any of it: `learnings:check` reports PASS over this state.
- **GREEN:** give rules a tier and make the boot tier the selectable set; require a governed
  lesson to name a rule or be `historical`; enforce both directions in `learnings:check`;
  generate and drift-check the shipped subset from the boot tier; give the unused scopes their
  meaning as promotion targets.
- **AUDIT:** each count above is re-measurable with the commands in `### Evidence`; the
  catalogue and ledger censuses were taken at `HEAD` `14d48820`; the validator's actual scope
  was read from `scripts/learnings-references.ts` rather than assumed from its name.
- **ADVERSARIAL:** (a) does tiering duplicate the ledger's `Status` field? No — `Status`
  describes an entry's own lifecycle (`active`/`superseded`/`historical`/`needs-review`);
  a rule's tier describes whether a *loader* wants it. One lesson can be `active` while its rule
  is `reference`. (b) Is enforcing "no orphan rule" going to force 21 synthetic lessons? No —
  a rule may be `reference`/`historical` with a reason; the requirement is that every rule is
  *classified*, not that every rule has a lesson. (c) Does generating the shipped subset leak
  internal content into a published bundle? The projection is built from explicitly promoted
  rules, and `validateEmbeddedLearningSource` already refuses email, credential-shaped tokens
  and protocol-variant wording on that path. (d) Can this shrink the boot payload on its own?
  No — it defines the tier; `FID-2026-1012-010` performs the selection.
- **CHANGE DELTA:** ~0% of implementation. This record is authoring-only (converged RED/GREEN
  plan); the change delta applies in the implementation pass.

### Loop 2 — Current-tree review and self-correction (2026-10-12)

- **RED:** Catalogue/lesson mismatch persists. A direct `findCandidates` probe returns
  18 candidates linked to ONE unrelated rule: `library-complete-needs-a-named-consumer`.
  `lessons-to-skills.ts:146` includes each lesson's own title in its matching input.
  Exact join: eight of 32 catalogue rules referenced, three absent legacy names, 24 unused.
- **GREEN:** Apply `docs/design/perfection-loop-2026-10-12.md`: investigate authority,
  invariant, guard and validation for every rule before tier assignment; never demote
  unresolved guidance by default. Public projection requires explicit public promotion.
  Replace self-matching with evidence-backed class/rule links shared with FID-021.
- **AUDIT:** The real candidate scan proves the targeting defect without drafting or
  trusting a skill. Catalogue validation still checks named headings only.
- **ADVERSARIAL / missed question:** Can a matching title prove relevance to a failure?
  No. Pin unrelated-failure rejection and positive explicit links. Preserve all incident
  evidence; exact tier/projection test paths are in the shared artifact table.
- **CHANGE DELTA:** Planning correction only; no skill release or catalogue edit occurred.

### Loop 3 — Implementation plan (2026-10-13)

- **RED:** The converged design names a rule tier but the current parser exposes neither tier nor
  class links; `validateCanonicalRuleCatalog` checks only duplicate headings and named targets.
  `docs/embedded-learnings.md` is hand-curated, and `lessons-to-skills.ts:139-154` chooses a
  lesson by token overlap after appending the lesson title to the failure text, so the first rule
  can self-match an unrelated recurring class.
- **GREEN:** Add a closed-set `Tier` plus non-empty `Tier reason` to every catalogue rule and an
  optional exact `Failure classes` list for evidence-backed class-to-rule links. Require every
  non-historical governed lesson to name one catalogue rule; preserve incident prose by marking
  the 26 current entries with no authoritative rule as `Status: historical` rather than assigning
  them a false rule. Render `docs/embedded-learnings.md` deterministically from the boot-tier rule
  projection, validate it for drift and privacy, and make skill eligibility require an exact class
  link from the catalogue. No token-overlap fallback remains.
- **AUDIT:** The new rule-tier test covers duplicate/missing/invalid tiers, unruled lessons,
  historical lessons, exact class-link matching and unrelated-class rejection. The projection probe
  covers byte drift and a boot-tier output; protocol-bundle and scripts-typecheck probes cover the
  generated/runtime surfaces.
- **ADVERSARIAL:** A reference-tier rule remains available to future explicit promotion without
  entering the boot payload; a historical lesson remains in the append-only ledger but cannot enter
  boot or skill promotion; a recurring class with no explicit link produces no candidate rather than
  inheriting a coincidental rule. The projection is rule metadata, not a second hand-edited lesson
  list, so the four existing public rules remain the boot set without copying incident prose.
- **CHANGE DELTA:** Implementation pass; source changes begin only after this recorded plan.

### Missed Questions

### Loop 4 — Long-token projection correction (2026-10-13)

- **RED:** Combined verification stopped at the synthetic overbudget boot-rule
  test. The shared Markdown wrapper could select only indentation as its split
  prefix, then recreate the same remaining string indefinitely.
- **GREEN:** Refuse a split that consumes only whitespace; preserve unbreakable
  tokens without inventing spaces inside them. The existing budget test must
  return an overflow issue without replacing destination bytes. Avoid quadratic
  email scanning on long non-email tokens by testing the final local character
  before `@`, which preserves the existing substring-detection semantics.
- **AUDIT:** Add a direct long-token wrapping regression to the boot-digest suite;
  rerun that suite, existing privacy tests and the full combined learning battery.
- **ADVERSARIAL:** Termination cannot depend on the caller supplying spaced prose.
  Overflow remains a failure, never a partial projection or omitted boot rule.
- **CHANGE DELTA:** Correction of the generated-artifact path, before re-stamping.

1. Should the rule live in the catalogue or in the lesson? → In the catalogue, with the lesson
   as evidence. The catalogue already carries the two fields a loader needs (`Authority`,
   `Validation`); duplicating them per lesson is what produced the current 26/34 gap.
2. Is `embedded` the right promotion target for internal lessons, or a separate artifact? →
   Keep one shipped artifact and make it a projection of the boot tier, so "what ships" and
   "what boots" cannot drift apart; a second curated list would recreate exactly the
   hand-maintained-file problem this record is about.
3. Who decides a rule's tier? → The record that promotes it, at promotion time (automation
   level 3 for a mechanical tier assignment; an operator ruling when a rule's tier changes
   after publication, because the shipped subset changes with it).

### Code Verification Evidence

Current implementation evidence (2026-10-13) supersedes the historical measurements below.

- [x] `scripts/learnings-rules.ts` parses tier/reason/authority/validation and exact class
      links; `scripts/learnings-references.ts:validateCanonicalRuleCatalog` requires a
      non-historical lesson to name exactly one catalog target, including duplicate refusal.
- [x] `scripts/learnings-projection.ts` renders only boot rules, refuses invalid/private
      sources and writes idempotently. `scripts/learnings.ts` and
      `scripts/validate-repository.ts` call `collectEmbeddedProjectionIssues`.
- [x] `scripts/lessons-to-skills.ts:findCandidates` joins recurrence digest to stable class
      identity and exact catalog links; invalid catalogs and historical rules cannot promote.
- [x] Focused combined tier/projection/validator/skill battery: 35 pass, 0 fail. Root
      typecheck and ESLint exit 0; quality PASS (1,502 baselined files); projection and
      protocol bundle checks PASS. Initial two-file formatting drift corrected.
- [ ] Formal closure: blocked by the explicit operator hold on local commits (ECHO G2).

- [x] Every cited path exists at `main` @ `14d48820`, read directly at review time; the raw
      measurements live in `docs/design/learnings-boot-loading-and-lifecycle-review.md` §2/§3,
      which this record expands.
- [x] Measurements re-checked: `dev/LEARNING-RULES.md` is 193 lines with 32 `## Rule:`
      headings; only 11 are referenced by a lesson (8 governed + 3 legacy), leaving 21 rules
      with no lesson and 26 of 34 governed lessons with no rule; all 34 governed entries read
      `Scope: internal`; `docs/embedded-learnings.md` holds 4 lessons all dated 2026-08-11
      and nothing drift-checks it against the ledger (`scripts/generate-protocol-bundle.ts:86`,
      `common/src/util/embedded-protocol.ts:37`); `.agents/skills/.quarantine/` holds 4 drafts.

## Boundaries

- No ledger or catalogue content was changed by this record; the counts are a measurement of the
  state at `HEAD` `14d48820`.
- The 21-unused-rule figure counts rules cited by no *lesson*; a rule may be legitimately
  unhoused (a forward-looking name), which is why step 1 asks for a tier and a reason rather
  than deletion.
- The shipped subset's currency is asserted from its recorded dates and the absence of a
  generation path, not from a live embedded boot read — that belongs to the harness boundary.
- This record does not address retirement, size ceilings or evidence rot; `FID-2026-1012-011`,
  `-012` and `-013` own those, and `-015` owns the pipeline state this record's step 2 will
  have to keep green.

## Resolution

**Implemented — `Status: verified`; closure blocked by the operator's no-commit hold.**

The catalog now classifies all 35 rules after FID-013's legacy reconciliation.
All 37 governed lessons satisfy the exact-target
contract; historical entries retain their incident bodies. Four explicitly public boot
rules generate the shipped guidance deterministically. Exact class links replace token
overlap in skill eligibility, with invalid catalogs and ambiguous classes refused.
Tests are the rule-tier, projection, learning validator and two skill suites declared
above. Verification evidence is recorded in this section and the live receipt.
No commit, push, release or archive move is performed.

- **Authorised write surface:** `SCOPE.md` → machine-readable scope targets → this record's
  line (registered 2026-10-12 with the review).
- **Design record:** `docs/design/learnings-boot-loading-and-lifecycle-review.md` §3 rows
  B2, B3, C1, C2 and E2, §4 feature F2.
- **Ordering:** Defines the boot tier FID-2026-1012-010 consumes and the rule target
  FID-2026-1012-016 consolidates onto.
