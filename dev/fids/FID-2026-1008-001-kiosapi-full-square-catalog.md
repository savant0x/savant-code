# FID-2026-1008-001 — KiosAPI picker catalog: key-scoped subset → public full square

**Filename:** `FID-2026-1008-001-kiosapi-full-square-catalog.md`
**ID:** FID-2026-1008-001
**Severity:** medium
**Status:** fixed
**Created:** 2026-10-08
**Automation level:** 2
**YAGNI-Compliance:** Verified

---

## Summary

The `/model` picker's KiosAPI group showed **36 models** while the vendor's own
site publishes **80**. The operator reported it as "old/outdated": every
flagship on kiosapi.com is missing from our list.

Root cause: the registry declares the catalog as
`https://kiosapi.com/v1/models`, which per KiosAPI's own docs returns "the list
of models available for **your API key**". The stored key is a `Free`-group key
(verified live 2026-10-08: its response's 36 ids are exactly the square's 36
`enable_groups`-includes-`Free` rows), so the picker inherits the Free group's
view of the catalog. Nothing in our pipeline is stale — caches, snapshots and
the endpoint all agree at 36 — the SOURCE is key-scoped.

Fix: point the kiosapi catalog at the vendor's **public, unauthenticated**
`https://kiosapi.com/api/pricing` (HTTP 200, no key; `data[]` of 80 rows with
`model_name`, `description`, `enable_groups`, `billing_mode`) — the same feed
the Models & Pricing page renders from — so the picker shows the full Model
Square, always current, with no key dependency for listing.

## Environment

- Date: 2026-10-08
- Operator report: "the models list … is old/outdated" (provider before
  `nous` A→Z = `kiosapi`), with a current portal listing pasted as reference.
- Live probes (2026-10-08, read-only):
  - `GET https://kiosapi.com/v1/models` keyless → 401 (authenticated).
  - `GET https://kiosapi.com/v1/models` with the stored key → 200, 36 rows.
  - `GET https://kiosapi.com/api/pricing` keyless → 200, 80 rows,
    `pricing_version: a42d372c…`.
  - Diff: 44 square ids absent from our picker, including `gpt-5.6-sol`,
    `gpt-6-astra`, `claude-opus-5-5`, `claude-sonnet-5-5`, `gemini-3.8-flash`,
    `grok-4.7`, `glm-5.3`, `deepseek-v4-pro-0813`. The 36 key rows ⊆ the 80
    square rows (36 = rows with `Free` in `enable_groups`).

## Detailed Description

### Problem

The picker's KiosAPI group is the Free key's subset, not the catalog the
vendor publishes. Visibly old/odd rows (`llama-3.2-11b-vision-instruct`,
`gpt-oss-20b`, stealth ids) sit next to nothing modern, while the site's
square lists the current flagships.

### Expected Behavior

The picker's KiosAPI group matches the vendor's published Model Square
(80 rows at time of writing) — the same list an unauthenticated visitor sees
on kiosapi.com/pricing — independent of which token group the stored key
belongs to.

### Root Cause

Registry seam: `common/src/providers/registry-partitioned.ts:29` declares
`catalog: { source: 'live', url: 'https://kiosapi.com/v1/models' }`, and
`cli/src/utils/openrouter-models/kiosapi.ts` sends the resolved key as Bearer.
That endpoint is documented by the vendor as key-scoped
(`docs.kiosapi.com/api-reference/models/list-models.md` — "List all models
available for your API key. Different token groups may have access to
different models."). The key's group is `Free`.

### Evidence

```text
$ curl https://kiosapi.com/v1/models            → 401
$ curl https://kiosapi.com/api/pricing          → 200, 80 rows
$ (stored key) GET /v1/models                   → 200, 36 rows
  36 == square rows with "Free" in enable_groups (exact set equality)
  44 square ids missing from the picker, all flagships named above
$ ~/.savant-code(-dev)/gateway-catalog.json     → kiosapi rows: 36 (fresh,
  saved minutes earlier — the snapshot matches the endpoint; no cache staleness)
```

## Impact Assessment

### Affected Components

- `common/src/providers/registry-partitioned.ts` (catalog URL)
- `cli/src/utils/openrouter-models/kiosapi.ts` (parser + auth decision)
- `cli/src/utils/__tests__/openrouter-models-gateway.test.ts` (parse pins)
- `cli/src/utils/__tests__/openrouter-models-gateway-providers.test.ts`
  (Bearer-header pin + response shape)
- `common/src/constants/context-window-table-kiosapi.ts` (delta noted below)

### Risk Level

Low. Listing is read-only discovery; chat routing (`idTransform: 'strip'`,
credentials, protocol) is untouched. Rows for models outside the stored key's
group can fail vendor-side on selection — the vendor's canonical error, same
as selecting any model the account cannot call today.

## Proposed Solution

### Approach

1. Registry: kiosapi `catalog.url` → `https://kiosapi.com/api/pricing`.
2. Parser: read `data[].model_name` (+ `description`); prefix `kiosapi/`;
   sort A→Z; no Bearer (public feed — stop resolving the key for listing).
3. Keep window behavior: the pricing feed publishes no window fields (neither
   did `/v1/models` — FID-2026-1003-008 header), so the checked-in fallback
   table + 200k default stand unchanged.
4. Tests: re-pin parser + fetcher contract to the pricing shape and the
   no-auth listing.

### Steps

1. FID + SCOPE registration + CHANGELOG entry (this record).
2. Registry URL swap.
3. Parser rewrite in `kiosapi.ts` (300-line cap respected).
4. Test re-pins.
5. Window-table header note for ids with deliberately no row.
6. Gates + receipt + commit.

### Verification

- Unit: parser contract tests over a pricing-shaped fixture (80-row subset
  with `Free`/`Codex-Pro` groups), fetcher test asserts NO Authorization.
- Live: keyless `api/pricing` probe returns the rows the parser emits.
- Repo-wide: typecheck, eslint, prettier, lint:md, validate:repository,
  scope-register-check, `fid:verify --write`.

## Verification Gates

- gate: test cli/src/utils/__tests__/openrouter-models-gateway.test.ts
- gate: test cli/src/utils/__tests__/openrouter-models-gateway-providers.test.ts
- gate: typecheck cli
- gate: quality

### Verification Receipt

- fingerprint: sha256:adae74c72f64257ab49d8fe33692a63b3dabb72f0676632b60fc1a1ee50cefc9
- verified: 2026-10-08T15:52:14.818Z
- test cli/src/utils/__tests__/openrouter-models-gateway.test.ts: exit 0
- test cli/src/utils/__tests__/openrouter-models-gateway-providers.test.ts: exit 0
- typecheck cli: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** (1) The picker's KiosAPI group shows 36 Free-group rows while the
  vendor publishes 80 — proven by the Evidence probes above, with exact set
  equality between the key response and the square's Free rows. (2) The
  existing test pins ENCODE the defect: the fetcher test asserts the Bearer
  header is sent for the catalog request and feeds the old `data[].id`
  shape — the contract itself must change.

### Missed Questions

- Does any other surface read the kiosapi catalog URL?
  — `deriveLiveCatalogUrl` is the only reader (grep); docs table shows
  baseUrl, not catalog URL. Does the docs-counts gate pin a kiosapi number?
  — no: it recomputes `static <N>-model` claims; kiosapi is documented
  `live`. Is the pricing feed stable? — it carries `pricing_version` and is
  the source the vendor's own page renders.

### Code Verification Evidence

- `bun test` (cli, `openrouter-models-gateway.test.ts`): 8 pass, 0 fail.
- `bun test` (cli, `openrouter-models-gateway-providers.test.ts`): 6 pass, 0 fail.
- `bun run typecheck`: exit 0.
- `eslint --max-warnings 0` on the four changed source files: exit 0.
- `prettier --check` on the four changed source files: exit 0.
- `scripts/scope-register-check.ts`: PASS (0 issues).
- `markdownlint .`: exit 0.
- `validate:repository`: FAILED before this pass on FID metadata/headings and
  the 300-line cap in `registry-partitioned.ts`; both repaired, re-run PASS
  (`validation: PASS`, `lint:md` exit 0).

### Loop 2 — RED re-check and GREEN revision (2026-10-08)

- **RED re-check, readers:** the kiosapi catalog URL has one reader
  (`deriveLiveCatalogUrl(PROVIDER_REGISTRY, 'kiosapi')` in
  `openrouter-models/kiosapi.ts`). The gateway consumers
  (`gateway-live-results.ts`, `openrouter-models.ts`) call the fetcher and cache
  accessors only. No other surface reads the old `/v1/models` URL.
- **RED re-check, window coverage (new finding):** live feed `GET
  https://kiosapi.com/api/pricing` = 80 ids; fallback table
  `KIOSAPI_CONTEXT_WINDOW_FALLBACKS` = 69 rows; **18 feed ids have no row**
  (probe, read-only, 2026-10-08). Eight are documented as deliberate defaults in
  the table header (`fledge-alpha`, `big-pickle`, `kilo-auto`,
  `longcat-2.5-preview`, `gpt-image-2`, `gpt-image-2.5`, `gpt-image-2.5-flare`,
  `gpt-image-2.5-sunburst`). Ten are **undocumented**:
  `grok-imagine-image`, `grok-imagine-image-edit`,
  `grok-imagine-image-quality`, `grok-imagine-image-2.0` (image models),
  `llama-3.2-11b-vision-instruct`, `gpt-oss-20b`,
  `claude-haiku-4-5-20251001`, `deepseek-v4-pro-0813`, `codex-auto-review`,
  `openrouter/free` (router).
- **GREEN decision:** a row is added only from a verified published window.
  Unverified ids keep the 200k default and are documented in the table header
  by name. Public sources (search, 2026-10-08) report a 1M-token window for
  DeepSeek V4 Pro, but none confirms it for the KiosAPI id `deepseek-v4-pro-0813`,
  so no row is added for it yet.
- **Blocker (open, not dropped):** verified windows for `claude-haiku-4-5-20251001`,
  `gpt-oss-20b`, `llama-3.2-11b-vision-instruct`, `deepseek-v4-pro-0813`,
  `codex-auto-review`. Blocker: vendor-published window values per id; the
  search above does not supply them. Image models and the `openrouter/free`
  router have no single window and stay on the default.

### Resolution

- **Closed Date:** not closed. Closure needs a commit hash and operator
  authorization for the closing commit.
- **Status:** fixed. The catalog source change is committed (`4e1ab59b`). The
  window-coverage gap below remains open.
- **Fix Description:** registry catalog URL set to `https://kiosapi.com/api/pricing`;
  parser reads `data[].model_name` with no auth header for listing.
- **Tests Added:** parser and no-auth fetcher pins in
  `openrouter-models-gateway.test.ts` and `openrouter-models-gateway-providers.test.ts`.
- **Verification Evidence:** `fid:verify` on this FID exits 0 (both gate tests,
  `typecheck cli`, `quality`). Live probe: 80 rows, all unique, five flagships
  present. `validate:repository` and `lint:md` pass.
- **Open item (blocked):** 10 feed ids with no window row (see Loop 2). Blocker:
  vendor-published window values per id.
- **Archived:** pending commit authorization.

## Lessons Learned

**A "live" catalog source can be live and still be the wrong lens.** Freshness
checks (TTL, snapshots, endpoint probes) all passed while the list was wrong,
because the defect was SCOPE (key-group-filtered), not staleness. When a
vendor list looks wrong, diff the source against the vendor's public page
before suspecting the cache.
