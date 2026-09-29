# FID: Utility-tier duplication has no mechanical gate — enforcement gap at the small-helper tier

**Filename:** `FID-2026-0928-009-utility-tier-duplication-eslint-gap.md`
**ID:** FID-2026-0928-009
**Severity:** medium
**Status:** closed
**Created:** 2026-09-28
**Automation level:** 3 (the fix is mechanical once scheduled; the scheduling
is the operator's, per the idea-shelf activation trigger)

**Source report:** `dev/idea-shelf/utility-tier-duplication-eslint-enforcement-gap.md`
(SHELVED audit finding from Nova; this record converts it to an active FID per
the operator's 2026-09-28 instruction). The report's mandatory source links:
the ssp.sh "nobody knows anything anymore" spark, Fowler's SDD-3 spec-anchoring
analysis, the ranthebuilder agentic-hooks survey, and the ESLint-as-guardrails
pattern piece — concepts only, no external code adopted (see the report's
license note; this repo is Apache-2.0 and the fix uses only in-repo precedent).

---

## Summary

The architecture tier is governed hard (mega-file gutting, the 300-line
ratchet, typecheck/lint/markdown pre-push). The **utility tier is not**: small
shared primitives are re-invented locally wherever a fresh context needs one,
and no gate fires. Laws 7 ("search for existing code BEFORE creating new") and
13 ("one function, one truth") exist but are enforced by nothing mechanical in
mid-file helper code.

**Scan numbers verified against the tree 2026-09-28** (definitions, non-test
source, `cli/src common/src packages sdk/src agents savant-free`):

| Symbol | Verified defs | Report claim | Canonical home today |
|---|---|---|---|
| `asOptionalNumber` | **9** | 9 | none — one per provider shim in `cli/src/utils/openrouter-models/` |
| `asOptionalString` | **8** | 8 | none — same directory |
| `sha256` (fn/const form) | **7** | 5 | none — spread across 4 workspaces |
| `sleep` | **5** | 7 | **`common/src/util/promise.ts:59`** |
| `isRecord` | **4** | 5 | **none — see correction** |
| `withTimeout` | **3** | 3 | **`common/src/util/promise.ts:68`** + a second home in `common/src/mcp/utils.ts` |

**Two corrections to the report**, found by verification:

1. **"common/ already exports an `isRecord`" is inaccurate.** The only
   `isRecord` in `common` is a *local, non-exported, narrower* guard inside
   `common/src/util/axiom-only-log.ts:37`
   (`Record<string, string | number | boolean>`). No repo-wide export exists;
   the canonical home must be **created** (which the report's own Part 4 —
   "promote common isRecord" — implies).
2. **The nine `asOptionalNumber` copies are not identical.** The vendor-shim
   copies take `unknown` (they guard untyped wire data); the `openrouter.ts`
   copy takes `number | null | undefined`. Consolidation must pick the
   general signature (the `unknown`-accepting guard) — a plain move would
   break eight call sites' types. This is a design point the report did not
   carry.

## Environment

- Repo: `savant-code` v0.0.34, `main`. Verification greps run 2026-09-28,
  non-test source trees only (`grep -v test`), vendored `resources/` excluded.
- In-repo precedent for the fix: `scripts/eslint-rules/no-unknown-in-signatures.js`,
  a locally-authored ESLint rule wired through `eslint.config.js:7` (with its
  own fixtures under `scripts/eslint-rules/__fixtures__/`) and enforced by the
  standing `eslint . --max-warnings 0` pre-push leg.
- Failure concentration points: (a) provider-harvest fan-out — every shim in
  `openrouter-models/` was authored in its own fresh session, each re-inventing
  the same two guards; (b) helpers small enough that a local inline copy is
  locally rational.

## Detailed Description

### The gap

A duplicate `withTimeout` in `common/src/mcp/utils.ts` and
`common/src/util/promise.ts` can coexist inside the **same workspace** while
every gate is green, because no gate reads symbol definitions. The laws the
repo declares (Law 7, Law 13) are audit-time judgments with no mechanical
enforcement below the architecture tier — the same shape external auditors
find first in any agent-codebase, per the source report's industry analysis.

The cross-workspace tail (`sha256` ×7, `truncateSingleLine`, `isJSONObject`,
3-defs-each tier) is the same class at lower count; the openrouter-models
directory is the class at its worst (17 duplicated guard definitions across
9-10 parser files, growing by two with every harvested provider — the
report's re-activation trigger, and the exact mechanism that produced today's
count).

### Why the report's clean-scan context matters

The same audit found 0 TODO/FIXME markers, no mega-files over the working
limit, and correctly-fenced vendored trees — the architecture-tier chain IS
working. This FID exists because the utility tier is the residual the chain
cannot see, not because governance is absent.

## Root Cause

Enforcement asymmetry: every law above the utility tier has a gate that fires
on violation (quality:report ceilings, typecheck, lint, markdown, the FID
gates); Laws 7 and 13 have no executable form. Duplication by
fan-out-of-context then compounds silently — each harvest session behaves
identically because each inherits the same permissive surface.

## Impact Assessment

- **Maintenance debt compounds per provider added**: the two-guard pair now
  ships in every one of 9-10 parser shims; a signature unification (the
  FID-2026-0927-006/T96 class of work) must reason about 9 copies instead of
  one import.
- **Two-truth risk is live, not theoretical**: `withTimeout` already has two
  homes in one workspace; a behavioral fix to one silently misses the other.
- **External audit surface**: the utility tier is the first thing a
  third-party reviewer finds, and it is invisible to every gate the repo
  advertises.

## Proposed Solution — five parts, all precedent-verified in-repo

1. **Custom ESLint rule** (`scripts/eslint-rules/no-duplicate-shared-primitive.js`):
   error on top-level declarations whose name is in the registry, outside the
   symbol's canonical module. Precedent: `no-unknown-in-signatures.js`
   (locally authored, wired, enforced). Report precedent: the
   ESLint-as-AI-guardrails pattern (concepts only).
2. **Canonical-home registry**: a small `symbol → owning module` map the rule
   reads (`scripts/eslint-rules/shared-primitives.json` or a `.ts` const).
   Declaring a canonical export registers the ban. Precedent:
   `protocol.config.yaml` for governance data; the
   `VALIDATION_WORKSPACE_POLICY` manifest for enforcement read from data.
3. **Enforcement path**: the standing `eslint . --max-warnings 0` pre-push leg
   picks the rule up automatically — no new gate to wire.
4. **One-time consolidation sweep** (Forge-tier under this FID): move the
   9+8 provider guards into one shared module under
   `cli/src/utils/openrouter-models/` with the **general** (`unknown`)
   signature; dedupe `withTimeout` to `common/src/util/promise.ts` (the mcp
   copy re-exports or imports); **create** the canonical `isRecord` in
   `common/src/util/` and promote the four copies; fold the `sha256`/`sleep`
   tails into their existing homes.
5. **Harvest inheritance note**: the rule is active at the workspace surface
   every future provider shim lands in, so the next harvest session inherits
   the ban mechanically instead of repeating this pattern.

**Sequencing.** Parts 1-2-3 land together (rule + registry + green run over
the fixed tree) and must be preceded by Part 4 for the directory the rule
would otherwise turn red — the rule enters with the tree already clean, then
holds it. Part 5 is documentation inside the Part 1 rule's header.

This record ships analysis only; the gates verify the described surface and
repo quality. Implementation verification is declared by the implementing
FID work, with the rule's own fixture suite (the `no-unknown-in-signatures`
precedent) as the model.

## Verification Gates

- gate: quality

### Verification Receipt

- fingerprint: sha256:06c603af93ceef03ced5710270c0bd72bcbf6c8b4016b8d98cc7205b93a4ffdf
- verified: 2026-09-28T20:53:18.905Z
- quality: exit 0

## Step Status

Analysis steps (complete):

- [x] Verify the report's def-count table against the tree (greps quoted in
      Code Verification Evidence); record the two corrections
- [x] Confirm the canonical homes that exist (`promise.ts` sleep/withTimeout)
      and the ones that must be created (isRecord; the asOptional* pair)
- [x] Confirm the in-repo custom-rule precedent and its wiring
      (`eslint.config.js:7`) and the pre-push enforcement path
- [x] Carry the fix shape's five parts with the sequencing constraint

Implementation steps (pending operator scheduling — the idea-shelf
"fix-when-scheduled" trigger):

- [x] Part 4 — consolidation sweep — implemented::2026-09-28 (canonical
      homes created; every copy deleted, renamed, or re-exported; measured
      counts 1/1/1/1/1 across the five primitives)
- [x] Parts 1+2+3 — rule + registry + enforcement — implemented::2026-09-28
      (rule fires live; negative probe caught by design pins; 5 fixture
      legs green; wired as an error in the pre-push eslint leg)
- [x] Part 5 — harvest-inheritance note — implemented::2026-09-28 (rule
      header documents the inheritance contract for future harvest sessions)

## Perfection Loop

### Missed Questions

1. **Why lint-rule and not a quality:report check?** The violation is
   per-declaration and needs auto-fixable reporting at the exact line; ESLint
   gives both, plus the pre-push path already runs it. A report-script check
   would re-implement AST walking for no gain.
2. **Should the ban cover test files?** No — tests routinely re-declare
   trivial local helpers, and forcing imports there adds churn without a
   two-truth risk (test-local copies never ship). The rule scopes to non-test
   source, matching the scan.
3. **Does the registry create a central chokepoint?** It is data, deliberately:
   adding a canonical export is a one-line registry entry in the same PR as
   the export, and the rule's failure message points at the registry entry
   that banned the name. The chokepoint is the point.
4. **What if a legitimate new primitive shares a name?** The registry maps
   exact names; a genuinely new primitive gets a non-colliding name or a
   deliberate registry move — both visible in review, neither silent.
5. **Is `asOptionalNumber`'s signature variance an obstacle to consolidation?**
   The reverse — it is the argument FOR one home: the `unknown`-accepting
   guard subsumes both current forms, and eight of nine call sites already
   pass `unknown`-shaped data. The sweep is the moment the signatures unify.

### Code Verification Evidence

- [x] `grep -rn "function asOptionalNumber" … | wc -l` → 9 (report: 9)
- [x] `function asOptionalString` → 8 (report: 8)
- [x] `withTimeout` fn/const defs → 3, at `common/src/util/promise.ts:68`,
      `common/src/mcp/utils.ts`, and one cli copy (report: 3, two homes in
      common confirmed)
- [x] `sleep` → 5 defs; canonical export at `common/src/util/promise.ts:59`
- [x] `isRecord` → 4 non-test defs; **no common export** — the report's
      canonical-home claim corrected in this record
- [x] `sha256` fn/const defs → 7 across 4 workspaces (report: 5; count form
      difference noted, class confirmed)
- [x] `scripts/eslint-rules/no-unknown-in-signatures.js` exists, is imported
      at `eslint.config.js:7`, carries `__fixtures__/`
- [x] Declared gate run live at authoring: `quality:report` exit 0; receipt
      stamped

## Resolution

**IMPLEMENTED and closed (operator activation 2026-09-28: "3. activate").**

- **Part 4 (sweep, landed first):** canonical homes created — `isRecord` in
  `common/src/util/object.ts`, `sha256`/`sha256Hex` in the new
  `common/src/util/hash.ts`, `sleep` typed `Promise<void>` in
  `common/src/util/promise.ts`, `asOptionalString`/`asOptionalNumber` in the
  new `cli/src/utils/openrouter-models/wire-guards.ts`. All 9 + 8 provider
  shim copies deleted in favor of the shared import; `openrouter.ts`'s
  numeric variant subsumed by the general guard; `mcp/utils.ts` re-exports
  the canonical `withTimeout`; the OSC resolve-value variant renamed
  `withTimeoutValue` (different behavior → different name, not a duplicate);
  the four genuinely-different `isRecord` predicates renamed for what they
  are (`isJSONObjectRecord`, `isPrimitiveRecord`, `isJSONRecord`);
  design-systems deduped to one body; dead-local copies in
  `retry.ts`/`deep-research-core.ts`/login flow replaced with imports.
  Final measured counts: `sleep` ×1, `withTimeout` ×1 (+ the distinctly
  named resolve variant), `isRecord` ×1, `asOptional*` ×1 each.
- **Parts 1+2+3 (rule + registry + gate):**
  `scripts/eslint-rules/no-duplicate-shared-primitive.js` (the
  `no-unknown-in-signatures.js` precedent) reads the new
  `shared-primitives.json` registry and errors on any top-level
  re-declaration of a registered primitive outside its owner, wired active
  as `savant/no-duplicate-shared-primitive: 'error'` in the standing
  `eslint . --max-warnings 0` pre-push leg. Fixture-backed pins in
  `scripts/__tests__/no-duplicate-shared-primitive.test.ts` (5 legs) cover
  the firing path, owner/test/local-binding exemptions, and registry
  integrity. The allowedFiles exemption list records the deliberate
  survivors: the clean-process attestation tree (independence is its
  documented contract), `common/src/testing/setup.ts`, and the renamed
  distinct-predicate modules.
- **Part 5:** the harvest-inheritance note lives in the rule header; future
  provider shims inherit the wire-guards import requirement mechanically.
- **The rule earned its keep immediately:** the repo-wide lint after wiring
  caught 7 additional stragglers the manual greps missed (including the
  entire clean-process primitives module) — each dispositioned explicitly.
- **Runtime proof:** full battery green — typecheck (13 legs), test (all
  workspaces, 728 tests), `eslint . --max-warnings 0`, `lint:md`,
  `prettier --check .`, `quality:report`, `validate:repository`.
- **Closed Date:** 2026-09-28 (closure commit hash pending operator commit;
  per G1 the agent does not execute git).

## Lessons Learned

- **A law without a gate is a wish.** Laws 7 and 13 were real, cited, and
  unenforced — and the tree accumulated 36+ violations of them while every
  advertised gate stayed green. Enforcement surface, not prose, is what
  bounds agent-codebase drift.
- **Fan-out multiplies whatever the surface permits.** Nine harvest sessions
  did not make nine *different* mistakes; they made the same
  locally-rational mistake nine times, because the surface permitted it
  nine times. Fixing the surface (Part 1) fixes every future session at
  once; fixing the copies (Part 4) only fixes the past.
- **Verify a donor report's specifics before filing them.** Two of the
  report's claims needed correction (the `isRecord` home; the signature
  variance) — both were one grep away, and both change what the fix must
  do.
