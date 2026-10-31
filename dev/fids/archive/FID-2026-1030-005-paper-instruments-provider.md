# FID: Paper Instruments (Ultramarine) built-in provider

**Filename:** `FID-2026-1030-005-paper-instruments-provider.md`
**ID:** FID-2026-1030-005
**Severity:** medium
**Status:** closed
**Created:** 2026-10-30
**Automation level:** 3
**YAGNI-Compliance:** Verified

---

## Summary

Register Paper Instruments' Ultramarine API as a built-in gateway provider so
`paperinstruments/ultramarine-1-flash` routes through the generic factory with
`PAPERINSTRUMENTS_API_KEY`, the `/provider` picker offers it, and `/model` shows
its single row. The catalog is a one-row key-gated endpoint that publishes no
window fields, so the provider ships as a **static catalog with a
`table-section` coverage disposition**. The context window is 262,144 tokens,
taken from Paper's own statement about the public deployment, not from the base
model's 1,048,576-token architecture ceiling and not from the 200,000 default.

## Environment

- **OS:** Windows 11 (win32)
- **Language/Runtime:** TypeScript 5.x monorepo, Bun 1.3.14
- **Tool Versions:** bun 1.3.14, eslint (repo config), prettier
- **Commit/State:** branch `main` at `d9968408` plus uncommitted `.env.local`
  key entry and `SCOPE.md` register entry

## Detailed Description

### Problem

Savant has no Paper Instruments provider. `paperinstruments/<id>` is not a
valid routing prefix, `PAPERINSTRUMENTS_API_KEY` resolves to nothing, the
`/provider` picker cannot offer it, and `/model` cannot list its row.

### Expected Behavior

A registry entry derives routing prefix, credential readiness, picker grouping,
favicon domain and generated docs. The one audited model appears in `/model`
with its real 262,144-token window, and a request to
`paperinstruments/ultramarine-1-flash` reaches
`https://api.paperinstruments.com/v1/chat/completions` with a Bearer header and
the bare upstream id.

### Root Cause

Nothing in the tree references Paper Instruments (`rg -n
"paperinstruments|PAPER"` returns four unrelated matches: three `PAPER_TOOLS`
test constants and one design-system phrase). This is an additive provider
registration, not a defect.

### Evidence

All probes ran 2026-10-30 with the operator key in `.env.local`. Secrets never
printed.

```text
GET /v1/models -> 200
{"object":"list","data":[{"id":"ultramarine-1-flash","object":"model",
 "created":1790640000,"owned_by":"paper-instruments"}]}

GET /v1/models/ultramarine-1-flash -> 200
{"id":"ultramarine-1-flash","object":"model","created":1790640000,
 "owned_by":"paper-instruments"}

GET /v1/usage -> 200
{"object":"usage_summary","billing_status":"none","available_nanodollars":0,
 "reserved_nanodollars":0,"requests":0,"limits":{"requests_per_minute":60,
 "tokens_per_minute":4000000}}

POST /v1/chat/completions {"model":"ultramarine-1-flash","max_completion_tokens":16}
-> 429 elapsed_ms: 385
x-request-id: req_agqy7tw4jr2lffopl7njhnal54
x-should-retry: false
{"error":{"type":"insufficient_quota","code":"insufficient_quota",
 "message":"Your prepaid balance is too low for this request, which can cost up
 to $0.000218. ..."}}
```

Window evidence, in precedence order:

```text
1. https://raw.githubusercontent.com/paper-instruments/feather-train/main/
   feather-harness/docs/evaluation.md
   "This 131K harness budget deliberately compacts earlier than the public
    deployment's 262,144-token total window."
2. https://www.paperinstruments.com/blog/ultramarine (model card table)
   "Context window 131,072 tokens"  (training configuration)
   "run in Feather with a 262,144-token context window"  (evaluation harness)
3. https://huggingface.co/zai-org/GLM-5.3-Flash/raw/main/config.json
   text_config.max_position_embeddings: 1048576   (architecture ceiling only)
4. docs.paperinstruments.com -> default-sampling-config
   compaction.context_window_tokens: 131072       (their harness budget)
```

Third-party "1.3M" figures (GTN Directory, contextwindows.dev) have no primary
source and are rejected.

## Impact Assessment

### Affected Components

- `common/src/providers/registry-partitioned-5.ts` — the entry
- `common/src/constants/model-config/gateway-catalogs.ts` — static catalog map
- `common/src/constants/model-config.ts` — barrel re-export
- `common/src/providers/model-catalogs.ts` — `MODEL_CATALOGS` key
- `common/src/constants/context-windows.ts` — name-catalog id union
- `common/src/constants/context-window-table.ts` — fallback row
- `common/src/constants/window-coverage-register.ts` — disposition
- `cli/src/utils/openrouter-models/static-catalogs-gateways.ts` — picker rows
- `cli/src/utils/openrouter-models/gateway-catalog-merge.ts` — merge into `/model`
- Generated + hand-maintained doc surfaces

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium — user-visible provider surface, no data path
- [ ] Low

## Proposed Solution

### Approach

Mirror the Atria single-model static gateway path
(`common/src/constants/model-config/gateway-catalogs.ts:157`,
`cli/src/utils/openrouter-models/static-catalogs-gateways.ts:166-188`), not the
Hyper live-catalog path. The measured catalog carries no window fields, so a
live leg would add a fetch and zero information while shifting the positional
ladder in `gateway-live-results.ts`.

Window: **262,144**. Output ceiling: **65,536**, the documented API default
("Omit to use the default output limit of 65,536 tokens").

### Steps

1. **Registry entry** in `registry-partitioned-5.ts` (file is 211 lines, ceiling
   400):

   ```ts
   paperinstruments: {
     id: 'paperinstruments',
     label: 'Paper Instruments',
     kind: 'gateway',
     credentials: { envVar: 'PAPERINSTRUMENTS_API_KEY' },
     // Ultramarine serves OpenAI chat at /v1/chat/completions. Keyed
     // GET /v1/models measured 2026-10-30: one row, no window fields.
     baseUrl: 'https://api.paperinstruments.com/v1',
     protocol: 'openai',
     idTransform: 'strip',
     catalog: { source: 'static', modelsRef: 'paperinstruments' },
     setupAvailable: true,
     domain: 'paperinstruments.com',
     order: 4,
   },
   ```

2. **Static catalog** in `gateway-catalogs.ts` (265 lines, ceiling 400) plus the
   `PaperinstrumentsModel` type; re-export both from `model-config.ts`.

   ```ts
   /** Paper Instruments (Ultramarine) — FID-2026-1030-005. */
   export const paperinstrumentsModels = {
     ultramarine_1_flash: 'paperinstruments/ultramarine-1-flash',
   } as const
   ```

3. **`MODEL_CATALOGS`** in `common/src/providers/model-catalogs.ts`:
   `paperinstruments: paperinstrumentsModels`.

4. **Fallback row** in `context-window-table.ts` (287 lines, ceiling 400):
   `['paperinstruments/ultramarine-1-flash', 262_144]`, with the deployment
   provenance in the comment.

5. **Name-catalog union** in `context-windows.ts`: add
   `...Object.values(paperinstrumentsModels)` to `NAME_CATALOG_MODEL_IDS` so
   `isNameCatalogModelId` (`context-windows.ts:123`) answers true.

6. **Coverage register** entry in `window-coverage-register.ts` (338 lines,
   ceiling 400): `disposition: 'table-section'`, note recording the measured
   keyed catalog shape (1 row, 0 window fields) and the 262,144 provenance.

7. **Picker rows** in `static-catalogs-gateways.ts`: `PAPERINSTRUMENTS_NAMES`
   (`'paperinstruments/ultramarine-1-flash': 'Ultramarine 1 Flash'`) and
   `fetchPaperInstrumentsModels()` returning one row with
   `contextLength: getContextWindowFallback(id).contextWindow`.

8. **Merge** into `assembleGatewayCatalog` in `gateway-catalog-merge.ts`,
   appended after `fetchAtriaModels()` and before `fetchInternModels()`; no
   positional-ladder change because static builders never enter `restResults`.

9. **Generated surfaces**: `bun run generate:provider-docs` (`.env.example`
   gateway block, `README.md` + `cli/release/README.md` tables) and
   `bun run providers:parity` (regenerates
   `common/src/constants/provider-catalog-census.json`).

10. **Hand-maintained surfaces** the drift gate names: `docs/providers.md`
    (table row `static (1 model)` + a prose subsection),
    `docs/features.md`, `docs/index.md` provider list, `docs/installation.md`,
    `docs/sdk-overview.md` prefix + env lists, `README.md`
    provider-flexibility bullet + quick-start list + env reference,
    `README.zh-CN.md` mirrors.

11. **Tests** (all listed under Verification Gates).

### Verification

- `common`: registry gates, derivation, setup derivation, window-coverage lint.
- `cli`: picker catalog row + window, `saveProviderApiKey` contract.
- `sdk`: missing key throws the templated error; key present routes to
  `https://api.paperinstruments.com/v1/chat/completions` with `Bearer` and the
  bare model id.
- Repo gates: parity, docs drift, `validate:repository`, typecheck, eslint,
  lint:md, prettier.
- **Not claimable:** a live completion. The account balance is zero and the
  provider answers `429 insufficient_quota` with `x-should-retry: false`, which
  is a terminal quota error, not a transient one. The FID closes on registry,
  routing, catalog and docs evidence; the inference round-trip stays blocked on
  funding and is recorded as such, not as passed.

## Verification Gates

- gate: typecheck common
- gate: typecheck cli
- gate: typecheck sdk
- gate: test common/src/providers/__tests__/validate-provider-registry.test.ts
- gate: test common/src/providers/__tests__/provider-registry.test.ts
- gate: test common/src/providers/__tests__/provider-registry-setup.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/paperinstruments-catalog.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/window-coverage-register.test.ts
- gate: test cli/src/utils/__tests__/provider-setup.test.ts
- gate: test sdk/src/impl/__tests__/model-provider-free-mode-paperinstruments.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:f738fd014cbad3961a88b508c3bcd7247b76830e264997f19a07771337652d79
- verified: 2026-10-31T02:53:12.531Z
- typecheck common: exit 0
- typecheck cli: exit 0
- typecheck sdk: exit 0
- test common/src/providers/__tests__/validate-provider-registry.test.ts: exit 0
- test common/src/providers/__tests__/provider-registry.test.ts: exit 0
- test common/src/providers/__tests__/provider-registry-setup.test.ts: exit 0
- test cli/src/utils/openrouter-models/__tests__/paperinstruments-catalog.test.ts: exit 0
- test cli/src/utils/openrouter-models/__tests__/window-coverage-register.test.ts: exit 0
- test cli/src/utils/__tests__/provider-setup.test.ts: exit 0
- test sdk/src/impl/__tests__/model-provider-free-mode-paperinstruments.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Ten findings, each evidenced:
  1. No registry entry: `rg -n "paperinstruments|PAPER"` returns only four
     unrelated matches.
  2. Catalog publishes no window field: keyed `GET /v1/models` returns
     `id`/`object`/`created`/`owned_by` only. A `live` source would contribute
     zero window information.
  3. Without an exact fallback row, `CONTEXT_WINDOW_DEFAULT = 200_000`
     (`context-windows.ts:42`) would under-report the real 262,144 by 62,144
     tokens — the exact artificial-restriction failure FID-2026-0914-002 was
     raised to kill.
  4. The architecture ceiling (1,048,576, HF `config.json`) is not the served
     window; using it would over-claim by 4×.
  5. Their 131,072 figure is a harness budget, not the API limit
     (`default-sampling-config` calls it a harness setting).
  6. `window-coverage-register.test.ts:34-39` fails closed on any registry
     provider with no disposition.
  7. `window-coverage-register.test.ts:48-55` fails a `table-section` provider
     with no `CONTEXT_WINDOW_FALLBACKS` prefix — the row is not optional.
  8. `scripts/provider-catalog-parity.ts:86-98` fails any provider declaring
     `catalog.modelsRef` that contributes zero picker rows.
  9. Generated docs drift: `generate:provider-docs:check` plus
     `handSurfaceDrift()` cover `.env.example`, both READMEs, the release
     README, the zh-CN mirrors, the dispatch-prefix list and the env reference.
  10. Inference cannot be verified: balance 0, `429 insufficient_quota`.
- **GREEN:** Steps 1-11 of Proposed Solution.
- **AUDIT:** Every GREEN step names an existing producer:
  `MODEL_CATALOGS` read at `model-catalogs.ts:43` and consumed at
  `types.ts:131` (`modelsRef: keyof typeof MODEL_CATALOGS`) and
  `validate.ts:83,210,263`; `getContextWindowFallback` at
  `context-windows.ts:59`; `assembleGatewayCatalog` static block at
  `gateway-catalog-merge.ts:72-89`; parity probe at
  `scripts/provider-catalog-parity.ts:93-98`.
- **ADVERSARIAL:** Why not `live`? Measured: one row, no window fields, and the
  live ladder in `gateway-live-results.ts` is positional — Hyper's addition
  forced length 20→21 edits in four suites. Static avoids that churn and adds no
  fetch. Rejected.
- **CHANGE DELTA:** n/a (creation).

### Missed Questions

1. *Is the model multimodal?* Yes — HF tags `image-text-to-text`, base
  `Glm5NextForConditionalGeneration`. Savant's chat path already sends
  `image_url` parts and Ultramarine accepts them; no catalog capability field is
  asserted here, so nothing to encode and nothing to claim.
2. *Does mandatory reasoning break streaming?* No —
  `delta.reasoning_content` is already mapped at
  `packages/llm-providers/src/openai-compatible/chat/stream-transform/transform-handler.ts:106`,
  and the stream closes with `[DONE]` as Savant expects.
3. *Does strict field rejection break the request?* No —
  `openai-compatible-chat-args.ts:106-157` emits only `model`, `user`,
  `max_tokens`, `temperature`, `top_p`, `frequency_penalty`,
  `presence_penalty`, `response_format`, `stop`, `seed`, `reasoning_effort`,
  `verbosity`, `messages`, `tools`, `tool_choice`; every one is accepted, and
  unset keys are dropped by JSON serialization. Savant never sets
  `reasoning_effort` itself, so the vendor's `max` default applies.
4. *Should `maxOutputTokens` be 131,072?* No — that is their harness request;
  the API documents 65,536 as the default limit and routes higher limits to a
  vendor request. Pin the documented value.
5. *Does the provider need an exception-manifest entry?* No —
  `requiredExceptionKinds` yields nothing for this shape (no resolver, no live
  catalog, no `extra` credentials, no `cf-rewrite`, not local, `setupAvailable`
  true), and a stale kind fails `validateProviderAudit`.
6. *Which partition?* Partition 5 (211 lines) has room; the 400-line ceiling is
  `protocol.config.yaml:68`.
7. *Duplicate?* No existing Paper Instruments code, catalog, window row or
  credential var.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** commit for this FID on `main` (this record ships with the
      implementation)
- [x] **File:line ranges:**
  - `common/src/providers/registry-partitioned-5.ts:211-234` — entry
  - `common/src/constants/model-config/gateway-catalogs.ts:231-248` — static map
  - `common/src/constants/model-config.ts:64,95` — barrel exports
  - `common/src/providers/model-catalogs.ts:18,58` — `MODEL_CATALOGS` key
  - `common/src/constants/context-windows.ts:34,81` — name-catalog union
  - `common/src/constants/context-window-table.ts:94-101` — 262,144 row
  - `common/src/constants/window-coverage-register.ts:338-346` — `table-section`
  - `cli/src/utils/openrouter-models/static-catalogs-gateways.ts:225-243` — row builder
  - `cli/src/utils/openrouter-models/gateway-catalog-merge.ts:84` — merge
  - `cli/src/utils/openrouter-models/__tests__/paperinstruments-catalog.test.ts:1-104`
  - `sdk/src/impl/__tests__/model-provider-free-mode-paperinstruments.test.ts:1-79`
- [x] **Gate output:** pasted below (all exit 0)
- [x] **Reproducibility:** `rg -n "paperinstruments"` returns the registry
      entry, catalog map, `MODEL_CATALOGS` key, fallback row, coverage entry,
      picker builder and merge line, plus the two paths listed above
- [x] **Step statuses:** steps 1-11 `implemented`

```text
common: bun test src/providers/__tests__/ -> Ran 123 tests across 17 files, 0 failures
cli:    bun test .../paperinstruments-catalog.test.ts -> Ran 5 tests, all (pass)
cli:    bun test .../window-coverage-register.test.ts -> Ran 5 tests, all (pass)
cli:    bun test src/utils/__tests__/provider-setup.test.ts -> Ran 27 tests, all (pass)
sdk:    bun test .../model-provider-free-mode-paperinstruments.test.ts -> Ran 2 tests, all (pass)
providers:parity -> census 3987 rows, paperinstruments: 1
generate:provider-docs:check -> "Provider reference docs are up to date."
typecheck (14 workspaces + scripts) -> exit 0
eslint . --max-warnings 0 -> EXIT=0
lint:md -> EXIT=0
prettier --check (changed files) -> "All matched files use Prettier code style!"
validate:repository -> "validation: PASS"
```

### Code Verification Evidence

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution (static catalog, not live)
- [x] Typecheck/tests/lint pass with pasted tool output
- [x] Production call-graph evidence present: `MODEL_CATALOGS` key read by
      `model-catalogs.ts:58` and validated at `validate.ts:83,210,263`;
      `fetchPaperInstrumentsModels` called at `gateway-catalog-merge.ts:84`;
      fallback row read by `getContextWindowFallback` (`context-windows.ts:59`);
      parity census reports `paperinstruments: 1`
- [x] FID status reflects the actual implementation state

### Loop 2 — Independent audit and self-correction

- **RED:** Plan-level risks not yet closed: (a) generated census drift if
  `providers:parity` is not run; (b) the possibility that `setupAvailable` on a
  one-model provider creates a picker entry with no models if the merge line is
  missed; (c) the `docs/modern` count strings in the setup test
  ("fifty-one") drift silently if not updated.
- **GREEN:** (a) `bun run providers:parity` is an explicit step and the census
  file is committed; (b) `fetchPaperInstrumentsModels()` is added in the same
  change as the registry entry (FID-2026-1007-005 lesson, reaffirmed by
  FID-2026-1012-005) and `providers:parity` proves >0 rows; (c) both
  `provider-registry-setup.test.ts` and `provider-registry.test.ts` are edited in
  the same pass.
- **AUDIT:** Read the window-coverage suite, parity probe, merge-order file and
  registry tests in this session; each assertion above cites a line.
- **ADVERSARIAL:** Static coverage claims a window no endpoint publishes. That
  is exactly what `table-section` means, and the register note carries the
  provenance so a future census can compare. Over-claiming `runtime-published`
  would be the dishonest option.
- **CHANGE DELTA:** 9% (Loop 2 added findings (a)-(c); no structural rewrite).

### Loop 3 — Final convergence

- **RED:** Residual: the 262,144 deployment figure is a vendor statement, not a
  measured 400 boundary.
- **GREEN:** Recorded as the register note with its URL; a funded oversized
  probe is the only way to promote it to measured, and it is named as the
  blocked follow-up rather than silently upgraded.
- **AUDIT:** No actionable improvement remains that does not require the
  operator's money.
- **ADVERSARIAL:** Would a reviewer call this over- or under-claiming? Neither:
  the note states both the number and its source class.
- **CHANGE DELTA:** 2% (convergence threshold reached).

## Resolution

- **Closed Date:** 2026-10-30
- **Fix Description:** Paper Instruments (Ultramarine) registered as a static-catalog
  gateway provider: one audited model, 262,144-token window from the public
  deployment statement, `table-section` window coverage, picker + `/model` row,
  generated and hand-maintained doc surfaces synced.
- **Tests Added:** Yes — `paperinstruments-catalog.test.ts` (5) and
  `model-provider-free-mode-paperinstruments.test.ts` (2), plus extensions to
  the registry, setup-derivation and `saveProviderApiKey` suites.
- **Verification Evidence:** every gate above exited 0; inference remains
  unverified on a zero balance (429 `insufficient_quota`, terminal); tracked as
  OBS-003 in `dev/tracking/internal-followups.json`.
- **Archived:** 2026-10-30 (implementation `42b1a2c9`)

## Lessons Learned

A provider's base-model config is a capability ceiling, not a served limit, and
a vendor's own compaction budget is not its API window either. Three different
numbers were all "true" for this model (1,048,576 architecture, 262,144
deployment, 131,072 training/compaction); only one belongs in the fallback
table, and the register note has to say which and why.
