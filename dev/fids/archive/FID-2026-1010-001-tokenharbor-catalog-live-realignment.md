# FID: TokenHarbor catalog live realignment (68-model roster, incl. claude-haiku-5.5)

**Filename:** `FID-2026-1010-001-tokenharbor-catalog-live-realignment.md`
**ID:** FID-2026-1010-001
**Severity:** medium
**Status:** closed
**Created:** 2026-10-10 02:13
**Closed:** 2026-10-11
**Automation level:** 3
**YAGNI-Compliance:** Verified

---

## Summary

Operator directive 2026-10-10, verbatim: *"well, a new model has been released
on tokenharbor, called claude haiku 5.5, however we don't have it in our model
list. We need to add it"*. While grounding that add against the live catalog,
a much larger defect was measured, and on being presented the operator selected
**"Full realignment now"** and **"Paid + free (both)"**.

The add is one model pair; the realignment is the work. TokenHarbor ships a
**static** (checked-in) catalog of 17 ids. The vendor's authenticated
`/v1/models` publishes **68**. Measured set difference: **52 ids missing**, and
**1 shipped id that is no longer callable** (`tokenharbor/th-orchestra`). The
catalog has drifted roughly 4x from the vendor since the FID-2026-0916-004
re-alignment.

The new model is `claude-haiku-5.5` (label "Claude Haiku 5.5") with a campaign
sibling `claude-haiku-5.5:free` (label "Claude Haiku 5.5 (Limited Free)").

## Environment

- **OS / shell:** Windows (Git Bash / MSYS), Bun 1.3.14 (root pins 1.3.14)
- **Language/Runtime:** TypeScript strict monorepo (common / cli / sdk)
- **Commit/State:** `main` @ `5e4de61e` (working tree carries the untracked
  FID-2026-1009-004 icon-program files)
- **Credential:** the operator's active `TOKENHARBOR_API_KEY` in `.env.local`
  (Bun auto-loads it; the value was never printed, logged, or echoed)

## Detailed Description

### Problem

Two defects, one root cause.

1. **Missing model.** `claude-haiku-5.5` is absent from the picker. It is not a
   routing defect — the id is simply not in the checked-in catalog.
2. **Stale catalog.** The static snapshot is 17 ids against a live roster of
   68. Every id the vendor added since 2026-09-16 is unreachable to the user
   even though the vendor serves it: `claude-opus-5.5`, `claude-sonnet-5.5`,
   `claude-fable-5.1`, `claude-opus-4.8`, `grok-4.6`/`4.7`, `glm-5.3`
   (+`-flash`/`-flashx`/`-fast`), `gpt-6-astra`, `gpt-6.1-sol`, the `gpt-6-sol`
   family, the whole `muse-spark` family, `deepseek-v4.1-flash`, `mistral-large-4`
   /`mistral-large-2512`, and every `-fast` variant.

### Expected Behavior

Every id the vendor's `/v1/models` publishes as callable is selectable in
`/model` under the TokenHarbor group, with the vendor's own display label and a
truthful context window; and no id the vendor no longer serves is offered.

### Root Cause

Not a routing defect — a **snapshot-freshness defect**. TokenHarbor is the one
gateway whose catalog is deliberately checked in rather than fetched
(`getTokenHarborModels()` in `cli/src/utils/openrouter-models/static-catalogs.ts`
carries the comment *"refresh this checked-in snapshot when the public models
page changes"*). Nothing enforces that refresh, so the snapshot silently rots
against a vendor that ships weekly. The `docs/providers.md` cell
`static (17 models)` is generated from the same map, so the drift was visible in
shipped documentation and unread.

### Evidence

**Live catalog probe** (authenticated, Bearer, key from `.env.local`, never
echoed), 2026-10-10:

```text
GET https://tokenharbor.ai/v1/models -> HTTP 200
envelope: {"object":"list","data":[...]}
row fields: id, object:"model", created (constant 1700000000),
  owned_by:"tokenharbor", label, blurb, tier, pricing
  {input_usd_per_1m, output_usd_per_1m}, supports_prompt_cache,
  context_length (integer|null), tool_call, function_call
roster: 68 ids
```

**The new model's own rows** (verbatim from the probe):

```text
claude-haiku-5.5       label "Claude Haiku 5.5"               tier mid
                       pricing $0.10 in / $0.50 out per 1M
                       supports_prompt_cache true  context_length 1000000
                       tool_call true  function_call true
claude-haiku-5.5:free  label "Claude Haiku 5.5 (Limited Free)" tier mid
                       pricing $0 / $0  context_length 1000000
                       blurb "Campaign route. Uses a separate campaign
                       allowance and is never billed. Drop the ':free' suffix
                       to use the paid route."
```

**Measured set difference** (static catalog vs live roster, 2026-10-10):

- live `68` / static `17`
- DEAD IN STATIC (absent from the live roster): `tokenharbor/th-orchestra`
- MISSING FROM STATIC: 52 ids (the list above)

**Window-publishing split:** the vendor publishes `context_length` for **51**
of the 68 ids and returns `null` for **17** (mostly the `-fast` siblings' base
models and several Qwen/GPT rows). Every static-catalog id must carry a
fallback-table row (`expectFullTableCoverage` in
`cli/src/utils/openrouter-models/__tests__/window-truth.test.ts` is
fail-closed), so each `null` id needs a corroborated or conservatively pinned
window.

**Corroboration for the 17 null-publishing ids** (from the repository's own
audited fallback table — grep evidence, symbol `CONTEXT_WINDOW_FALLBACKS`):

- `claude-sonnet-4.6` -> `commandcode/claude-sonnet-4-6` = 1,000,000
- `qwen3.7-max` -> `commandcode/Qwen/Qwen3.7-Max` = 1,000,000
- `qwen3.7-flash` -> `commandcode/Qwen/Qwen3.7-Flash` = 1,000,000
- `glm-5.1` -> `tokenrouter/z-ai/glm-5.1` = 204,800
- `claude-opus-4.8` -> `tokenrouter/anthropic/claude-opus-4.8` = 1,000,000
- `gpt-5.5` -> `tokenrouter/openai/gpt-5.5` = 1,050,000
- `deepseek-v3.2` -> `tokenrouter/deepseek/deepseek-v3.2` = 163,840
- `grok-4.7` -> `kiosapi/grok-4.7` = 500,000
- `gpt-6-luna` -> `apinex/gpt-6-luna` + `bai/gpt-6-luna` +
  `chatanywhere/gpt-6-luna` consensus = 1,050,000
- `deepseek-v4-pro`, `qwen3.8-max`, `gpt-5.6-sol`, `gpt-5.6-terra`,
  `gpt-5.6-luna` -> retained `tokenharbor/*` rows already in the table

**Uncorroborated (3 ids, no cross-gateway row exists):** `qwen3.6-27b`,
`qwen3.6-flash`, `qwen3.5-27b`. Per the `th-orchestra` precedent in this same
table, these take a conservative 200,000 pin flagged NEEDS-REVIEW rather than a
family guess. They stay visible and truthful; a vendor-published value is the
only thing that may replace the pin.

**Divergence handling — vendor-aligned; 6 retained rows re-sourced DOWN.** The
vendor publishes `1,000,000` for `deepseek-v4-flash`, `deepseek-v4-flash:free`
and `glm-5.2`, and `1,048,576` for `mimo-v2.5-pro`, `mimo-v2.5` and
`mimo-v2.5:free`, where the prior table pinned `1,048,576` and `1,050,000`
respectively. All six retained rows are re-sourced to the vendor's own
advertisement, each with an inline comment naming the prior value.

Rationale: the static catalog is a snapshot of *this* vendor's publication, and
the project's own precedent (FID-2026-0928-010) makes the gateway's own
advertisement binding — *"a gateway proxies at most the upstream window, so the
gateway's own advertisement is binding and the correction is strictly
conservative."* Every one of the six changes is downward, so none can
over-allocate. Two `window-truth.test.ts` pins that asserted the old `1,048,576`
for `deepseek-v4-flash` moved with the row; the operator-reported 131k defect
stays fixed either way — that pin exists so the family heuristic can never
return, not to freeze a particular number.

**`th-orchestra` removal caveat:** the id is absent from the keyed roster,
which the vendor documents as "the callable model ids". The removal follows the
FID-2026-0916-004 precedent (roster-absent ids removed). Stated limit: a single
key cannot distinguish "withdrawn" from "account-gated", and
`gemini-3.6-flash` is a live counter-example — removed as roster-absent, now
back in the live roster. `gemini-3.6-flash` is therefore **re-added** by this
record.

### Change Delta

**`common/src/constants/model-config/providers.ts`** — `tokenharborModels`:
17 ids -> 68 ids (52 additions, 1 removal `th-orchestra`), in the vendor's own
`/v1/models` roster order so a refresh is a literal re-copy, with a dated
provenance header naming the probe and the live count.

**`common/src/constants/context-window-table.ts`** — the `tokenharbor` section:
68 rows (16 retained + 52 new; 6 of the retained re-sourced to the vendor's own
value), each commented with its source (`vendor-published` / `cross-vote` /
`NEEDS-REVIEW`).

**`cli/src/utils/openrouter-models/__tests__/fid-2026-0916-004-realign.test.ts`**
— the two assertions that `gemini-3.6-flash` is absent are inverted: the id is
callable again, so the record pins its return and keeps `minimax-m3` +
`kimi-k3:free` as the still-removed set. The inversion is deliberate — a
roster-absence removal is a snapshot fact, never a permanent ban.

**`cli/src/utils/openrouter-models/static-catalogs.ts`** — `TOKENHARBOR_NAMES`:
17 -> 68 display entries, using the vendor's own `label` field verbatim (the
free row keeps its "(Limited Free)" suffix). The map is now **exported** so a
test can assert its coverage directly — the same reason `TOKENROUTER_MODEL_IDS`
is exported in this file.

**`cli/src/utils/openrouter-models/__tests__/static-catalogs.test.ts`** — a new
TokenHarbor suite (4 tests) closing a real guard gap the Verifier found: the
names map is cli-side and NOT derived from the common catalog, so nothing
pinned it, and an id added without a name silently falls back to the sliced id
— the exact drift this record exists to prevent. Both directions are asserted
(missing names AND stale keys), plus the haiku rows, the 6 re-sourced windows,
the dead-id removal, and the 3 conservative pins.

**`common/src/__tests__/model-config.test.ts`** — the exact-list pin named
*"defines the complete published 17-model catalog"* becomes the 68-id pin and
is renamed.

**`cli/src/utils/openrouter-models/__tests__/window-truth.test.ts`** — the
`th-orchestra` assertion inside *"orcarouter-free-class ids never enter these
static catalogs"* re-points at a surviving free-class id, because the row it
pinned is removed with the dead id.

**`common/src/constants/window-coverage-register.ts`** — the `tokenharbor`
note is updated to the new measured counts (disposition stays `table-section`:
the catalog is static and table-sourced).

**Generated surface (regenerated, never hand-edited):**
`bun run generate:provider-docs` rewrites the `static (N models)` cell in
`docs/providers.md` from 17 to 68.

## Perfection Loop

### RED

Evidence catalogued above from three independent measurements: the live
`/v1/models` probe, the repository's own fallback table (grep, symbol
`CONTEXT_WINDOW_FALLBACKS`), and the existing test pins that must move. No code
was changed in RED.

### GREEN

Minimal-change fix: the catalog map is the single source of truth, so the
picker, the routing prefix and the generated docs all follow from it. Windows
are added for every id because the coverage invariant is fail-closed; the three
uncorroborated ids take the table's own documented conservative-pin precedent
rather than a guess.

### AUDIT

All gates run live 2026-10-10 after implementation; evidence recorded verbatim.

- **`typecheck common`** — exit 0 (marker `---COMMON-OK---` emitted).
- **`typecheck cli`** — exit 0 (marker `---CLI-OK---` emitted).
- **`test window-truth.test.ts`** — 20 pass / 0 fail.
- **`test window-coverage-register.test.ts`** — 5 pass / 0 fail.
- **`test fid-2026-0916-004-realign.test.ts`** — 12 pass / 0 fail (the two
  `gemini-3.6-flash` assertions above were red before the inversion and green
  after; they were the only failures in the first run).
- **`test common model-config.test.ts` + `common/src/providers/__tests__/`** —
  the 68-id catalog pin passes and every provider registry/audit suite passes.
  The run reports 16 failures in a single unrelated file,
  `resources/code-insights/cli/src/providers/__tests__/cursor.test.ts`, all
  `ERR_DLOPEN_FAILED: 'better-sqlite3' is not yet supported in Bun` thrown in
  the suite's own setup helper before any assertion. That is a vendored tree
  this change does not touch and a pre-existing environment limit, not a
  regression from this record.
- **`generate:provider-docs` / `:check`** — the generator reports the registry
  table in `docs/providers.md` updated and the other three surfaces unchanged;
  the drift check prints "Provider reference docs are up to date" (exit 0).
  The TokenHarbor row now reads `static (68 models)`.
- **`eslint --max-warnings 0`** on the changed files — exit 0, zero warnings.
- **`prettier --check`** on the changed files (incl. `SCOPE.md` and this FID) —
  exit 0, "All matched files use Prettier code style!".

#### Verifier pass (independent) + resolution

The Verifier returned four findings. Three were resolved against live evidence;
one was accepted and fixed.

1. **"`muse-spark-1-3` breaks the naming convention — likely typo" — REFUTED.**
   Re-probed the vendor 2026-10-10: `ids.includes('muse-spark-1-3') === true`
   and `ids.includes('muse-spark-1.3') === false`. The vendor genuinely ships a
   hyphen for this one id while its siblings use dots. The copy is faithful,
   and the new suite now pins the presence of `muse-spark-1-3` **and** the
   absence of `muse-spark-1.3`, so a future "cleanup" that normalises the
   spelling to match its siblings fails loudly instead of silently 404-ing.
2. **"count evidence says 70, not 68" — REFUTED.** Re-probed:
   `ROSTER_COUNT 68`. The "70" was a subagent miscount of a long printed
   array; the catalog map, the exact-list pin, the `docs/providers.md` cell and
   the roster all agree at 68. The new suite's first test asserts
   `models.length === 68`.
3. **"no test pins `TOKENHARBOR_NAMES` against the catalog map" — CONFIRMED,
   fixed.** `static-catalogs.test.ts` had no TokenHarbor section at all and the
   names map was unpinned. Fixed in SELF-CORRECT by exporting the map and
   adding the 4-test suite above. This is the strongest outcome of the pass: it
   closes a silent-drift hole that this record's own premise ("the snapshot
   rots because nothing enforces refresh") predicted.
4. **"non-round `991_808` / `983_616` are unmarked, could be guesses" —
   REFUTED.** Both are the vendor's own published `context_length` values
   (`qwen3.8-27b`, `qwen3.8-flash`), read from the same 68-row probe; the
   window table's section header states the sourcing rule. Not guesses.

Post-fix verification (SELF-CORRECT): `typecheck common` exit 0, `typecheck cli`
exit 0, and the four suites together are **53 pass / 0 fail** (`static-catalogs`
16, `window-truth` 20, `window-coverage-register` 5, `fid-2026-0916-004-realign`
12); prettier clean on every touched file. One intermediate `tsc` failure
(`TS2345` at `static-catalogs.test.ts:290`, `includes(string)` against the
narrow catalog union) was fixed by widening the local to `readonly string[]` —
no cast, no `any`.

Call-graph reachability: the catalog map is the single source of truth —
`getTokenHarborModels()` (`cli/src/utils/openrouter-models/static-catalogs.ts`)
iterates `Object.values(tokenharborModels)`, and `MODEL_CATALOGS.tokenharbor`
(`common/src/providers/model-catalogs.ts`) is the registry's `modelsRef`. Both
were exercised by the suites above; no new function or config field was added,
so no new caller census is owed.

## Verification Gates

- gate: typecheck common
- gate: typecheck cli
- gate: test cli/src/utils/openrouter-models/__tests__/window-truth.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/fid-2026-0916-004-realign.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/window-coverage-register.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/tokenharbor-catalog.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/static-catalogs.test.ts
- gate: test common/src/__tests__/model-config.test.ts
- gate: probe scripts/provider-docs-drift.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:643cd9b8d589a8423f75e1f9867d687ea9bd0ce6639c315a182f6a879f2a3547
- verified: 2026-10-10T19:24:06.035Z
- typecheck common: exit 0
- typecheck cli: exit 0
- test cli/src/utils/openrouter-models/__tests__/window-truth.test.ts: exit 0
- test cli/src/utils/openrouter-models/__tests__/fid-2026-0916-004-realign.test.ts: exit 0
- test cli/src/utils/openrouter-models/__tests__/window-coverage-register.test.ts: exit 0
- test cli/src/utils/openrouter-models/__tests__/tokenharbor-catalog.test.ts: exit 0
- test cli/src/utils/openrouter-models/__tests__/static-catalogs.test.ts: exit 0
- test common/src/__tests__/model-config.test.ts: exit 0
- probe scripts/provider-docs-drift.ts: exit 0
- quality: exit 0

## Completion audit

### Missed Questions

- Does realignment invalidate old gateway isolation fixtures? Yes: six
  expectations still referenced `th-orchestra` or the old 17-id roster.
  FID-2026-1010-002's authorized blocker repair updates those fixtures.
- Do the expanded files satisfy the 300-line ceiling? The original layout
  did not. Move-only sibling splits preserve IDs, names, windows and public
  imports; the dedicated TokenHarbor suite preserves the independent pins.

### Code Verification Evidence

The existing AUDIT section records the original live and code verification.
The completion pass under FID-2026-1010-002 reran seven catalog suites:
62 pass, 0 fail. Repository quality now passes. Full repository gates are
being rerun; no closure or new live vendor probe is claimed by this update.

## Resolution

Closed and archived 2026-10-11 on local commit `f6c2048d` (path-scoped, six
files). No push was performed; every push requires separate operator
authorization under ECHO G1.

The completion pass re-ran all ten declared gates live before the commit:
typecheck `common` and `cli` exit 0; the five cli catalog suites plus
`common/src/__tests__/model-config.test.ts` are 59 pass / 0 fail;
`scripts/provider-docs-drift.ts` exit 0; `quality:report` PASS (1,502
baselined files). A residual-reference sweep found no contradiction: every
surviving `th-orchestra` mention is either a synthetic test fixture (an
arbitrary id exercising grouping/routing mechanics, not a catalog-membership
assertion) or archival/historical prose, and the remaining `static (17 models)`
cell is UnoRouter's own row. The `docs/Model Context Window Review.md` table
row is a point-in-time research record of the pre-realignment heuristic era
and is deliberately left unmodified.

This record preserves all historical findings, the conservative NEEDS-REVIEW
pins and the registered realignment scope.

## Related Documents

- `dev/fids/archive/FID-2026-0916-002-catalog-window-truth.md` — the original
  window-truth program this record realigns
- `dev/fids/archive/FID-2026-0916-004-gateway-catalog-realignment.md` — the
  prior TokenHarbor re-alignment (17 ids) and the roster-absence precedent
- `docs/adding-a-provider.md` — the live runbook (`static` catalog section)
- `dev/fids/archive/FID-2026-0807-025-tokenharbor-provider-integration.md` —
  the provider's original integration

## Lessons Learned

1. **A checked-in snapshot with no enforcing check rots silently.** The root
   cause was never routing — it was a `static` catalog whose refresh comment
   ("refresh this checked-in snapshot when the public models page changes")
   carried no test. The strongest fix was the Verifier's own finding: export
   `TOKENHARBOR_NAMES` and pin it bidirectionally against the catalog map, so
   an id added without a name, or a name left behind, fails loudly. The guard
   now exists because the failure mode it prevents is the record's own premise.
2. **A roster-absence removal is a snapshot fact, never a permanent ban.**
   `gemini-3.6-flash` was removed as roster-absent and is now callable again, so
   this record re-added it and inverted the two assertions that pinned its
   absence. Removing an id is reversible by design; a test that asserts
   absence forever would have blocked the correction.
3. **A machine-readable register entry is a parsed artifact, not prose.** The
   scope-targets entry for this record had to keep at least one backticked glob
   on its head line — continuation lines are additive only, and a head ending
   at the colon contributes zero patterns and fails closed (see
   `dev/LEARNINGS.md`).