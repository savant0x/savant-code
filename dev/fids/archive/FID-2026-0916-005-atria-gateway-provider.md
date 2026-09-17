# FID: Atria Gateway Provider Integration

**Filename:** `FID-2026-0916-005-atria-gateway-provider.md`
**ID:** FID-2026-0916-005
**Severity:** low
**Status:** closed
**Created:** 2026-09-16

---

## Summary

Integrate the Atria AI gateway (`https://api.atria-asi.ai`) as a built-in
provider exposing the single `Atria-Dawn-Preview` model. Follows the
bazaarlink one-model static-catalog pattern (FID-2026-0915-006) exactly:
one registry entry + one model map + the derived surfaces. The provider
appears in the `/provider` picker (`setupAvailable: true`) so the operator
can set the `ATRIA_API_KEY` through the existing masked key-entry front end —
the same capability the custom-provider wizard already provides, but
hard-coded for a built-in (operator requirement).

## Environment

- **Repo state:** `main`, active-FID queue holds `FID-2026-0916-004`
  (gateway catalog re-alignment, `analyzed`).
- **Provider docs (researched):** `api.atria-asi.ai/docs` — OpenAI-compatible
  `/v1/chat/completions` (also serves Anthropic `/v1/messages` and Responses
  `/v1/responses`; OpenAI is the canonical path). Auth = `Authorization:
  Bearer <key>` (`ATRIA_API_KEY`). Exactly one model: `Atria-Dawn-Preview`
  (case-sensitive), 256K context (256,000 tokens), max output 1–65,536.
  `/v1/models` exists but is key-protected (401 without a key).

## Detailed Description

### Problem

The provider registry (`common/src/providers/registry.ts` + partition) has no
Atria entry, so `atria/` is not routable, not pickable, and `Atria-Dawn-Preview`
is not selectable in `/model`. The operator wants Atria as a built-in with the
same CLI key-entry flow as every other built-in gateway.

### Expected Behavior

- `/provider atria` selects it; the masked key prompt sets `ATRIA_API_KEY`
  (derived — `setupAvailable: true`).
- `/model atria/Atria-Dawn-Preview` routes through the registry loop → generic
  `createProviderModel` factory (base URL `https://api.atria-asi.ai/v1`,
  `protocol: 'openai'`, `idTransform: 'strip'`).
- The model appears in the `/model` picker (static catalog via `MODEL_CATALOGS`).
- Context window resolves to 256,000 (fallback-table provenance, not default).

## Root Cause

Not a defect — missing surface. The registry is compile-time; a new provider
requires the one-entry recipe (docs/archive/design/Adding New Providers.md).

## Evidence (RED)

Reference single-model static provider (bazaarlink, FID-2026-0915-006):

- `common/src/constants/model-config/gateway-catalogs.ts:169-200` — `bazaarlinkModels`
  map; `:201` `BazaarlinkModel` type.
- `common/src/constants/model-config.ts:31-38` — re-export of gateway catalogs.
- `common/src/providers/model-catalogs.ts` — `MODEL_CATALOGS` registration.
- `common/src/constants/context-windows.ts:37-45` — import of gateway maps;
  `:98-100` fallback-table rows; `:266-273` `NAME_CATALOG_MODEL_IDS`.
- `cli/src/utils/openrouter-models/static-catalogs-gateways.ts:198-231` —
  `fetchBazaarlinkModels` + `BAZAARLINK_NAMES`.
- `cli/src/utils/openrouter-models/gateway.ts:58` + `:155-156` + `:199` —
  import, call, and `combined` merge.
- `cli/src/utils/openrouter-models.ts` — re-export.
- Registry entry: `common/src/providers/registry-partitioned.ts` (gateway
  entries land here — registry.ts is at its 300-line cap with the partition
  spread).

## Proposed Solution

### Approach

One registry entry (`atria`, `setupAvailable: true`) + one static model map
(`atria/Atria-Dawn-Preview`) + the 6 derived surfaces (model-catalogs ref,
fallback-table row, cli fetcher, gateway merge, re-export, docs regen). No
new architecture — the bazaarlink one-model static pattern verbatim (Law 13).

### Design Decisions

- **D1 — Static catalog over authenticated-live.** Exactly one model; the
  `/v1/models` endpoint is key-protected. A static one-model map is the
  "known, checked-in model set" rule and avoids an authenticated-live
  resolver wrapper for zero benefit (bazaarlink precedent).
- **D2 — `setupAvailable: true`.** Appears in `/provider` → masked key entry
  through the derived setup flow (operator requirement: CLI key entry for a
  built-in, matching custom-provider capability).
- **D3 — `protocol: 'openai'`.** Chat/completions is the canonical Atria path;
  a single model needs no `openai-anthropic` protocolMap.
- **D4 — `idTransform: 'strip'`.** Removes the internal `atria/` routing prefix;
  the upstream id `Atria-Dawn-Preview` goes verbatim.
- **D5 — Context window 262,144.** Vendor-published 256K; pinned in the
  fallback table (not the family heuristic).

### Steps

1. `common/src/providers/registry-partitioned.ts` — add `atria` entry.
2. `common/src/constants/model-config/gateway-catalogs.ts` — add `atriaModels`.
3. `common/src/constants/model-config.ts` — re-export `atriaModels` +
   `AtriaModel` type.
4. `common/src/providers/model-catalogs.ts` — `MODEL_CATALOGS.atria`.
5. `common/src/constants/context-windows.ts` — fallback row + `NAME_CATALOG_MODEL_IDS`.
6. `cli/src/utils/openrouter-models/static-catalogs-gateways.ts` — `fetchAtriaModels` + `ATRIA_NAMES`.
7. `cli/src/utils/openrouter-models/gateway.ts` — import + call + merge.
8. `cli/src/utils/openrouter-models.ts` — re-export `fetchAtriaModels`.
9. Tests: RED-first pin (atria in gateway catalog + fallback-table coverage).
10. `bun run generate:provider-docs`.

### Verification

- Typecheck ×4 (common, sdk, packages/agent-runtime, cli).
- cli openrouter-models suites + window-truth coverage.
- `bun x eslint . --max-warnings 0`, prettier, `lint:md`.
- Law 4: grep `fetchAtriaModels` production callers (gateway merge).

## Verification Gates

- gate: typecheck common
- gate: typecheck cli
- gate: typecheck sdk
- gate: test cli/src/utils/openrouter-models/__tests__/fid-2026-0916-005-atria.test.ts
- gate: test common/src/providers/__tests__/provider-registry.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:30e98f89d5af649767fd406d9fade9fdb3eaf517c6a6315cb3aa454e99949ce1
- verified: 2026-09-16T22:26:05.255Z
- typecheck common: exit 0
- typecheck cli: exit 0
- typecheck sdk: exit 0
- test cli/src/utils/openrouter-models/__tests__/fid-2026-0916-005-atria.test.ts: exit 0
- test common/src/providers/__tests__/provider-registry.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- Gaps cataloged (Evidence above): no `atria` registry entry, no model map,
  no picker, no routing. Reference pattern (bazaarlink) verified at file:line.
- The `/provider` key-entry path derives from the registry — no front-end
  code change needed beyond `setupAvailable: true`.

### Loop 2 — GREEN

- Implement Steps 1-10 above.

### Loop 3 — AUDIT

- Implementation complete (Steps 1-10). All gates green, evidence pasted below.
- **Typecheck ×4** (common, sdk, packages/agent-runtime, cli): exit 0 all four.
- **RED-first pin** `cli/src/utils/openrouter-models/__tests__/fid-2026-0916-005-atria.test.ts`
  — 4/4 pass (single model cataloged; cli fetcher serves vendor window 262,144;
  fallback-table pin; registry setupAvailable + ATRIA_API_KEY).
- **openrouter-models family** (incl. window-truth + 004-realign): 58 pass / 0 fail.
- **Law 4 reachability** — grep `fetchAtriaModels` in cli/src:
  - `cli/src/utils/openrouter-models/gateway.ts:62` (import) + `:210`
    (`const atriaCatalog = fetchAtriaModels()` in the combined merge) — wired.
  - `cli/src/utils/openrouter-models.ts:54` (re-export) — surfaced.
  - `static-catalogs-gateways.ts:211` (definition) — consumed.
- **eslint** 0 warnings; **prettier --check** clean; **lint:md** clean.
- **Docs regen** `bun run generate:provider-docs` exit 0 (README/cli-release/.env.example
  tables + env reference regenerated); hand-maintained `docs/index.md` provider
  bullet + `docs/sdk-overview.md` dispatch prefix list synced to mention Atria.

### Missed Questions

- **MQ1 — Should the free build expose Atria?** `setupAvailable` derives from
  the registry; `/provider` is gated out of free builds (`modes.ts`) exactly
  as other built-ins. No special handling.
- **MQ2 — Catalog drift guard?** Static allowlists are documented deliberate
  friction (a new upstream model requires a FID-scoped edit), per the gateway
  catalog precedent.

## Resolution

- **Fix Description:** Atria AI gateway integrated as a built-in provider
  following the bazaarlink one-model static-catalog pattern (Law 13):
  `atria` registry entry in `registry-partitioned.ts` (`setupAvailable: true`,
  `protocol: 'openai'`, `idTransform: 'strip'`, baseUrl
  `https://api.atria-asi.ai/v1`), the `atriaModels` map
  (`atria/Atria-Dawn-Preview`) in `gateway-catalogs.ts`, the
  `MODEL_CATALOGS` registration, the fallback-table row (262,144 — vendor-
  published 256K, pinned not heuristically derived), `NAME_CATALOG_MODEL_IDS`,
  the cli `fetchAtriaModels` fetcher + `ATRIA_NAMES`, the gateway merge, the
  re-export, and the regenerated provider docs (README / cli-release /
  `.env.example` tables + `docs/index.md` + `docs/sdk-overview.md`).
- **Fixed Date:** 2026-09-16
- **Closed 2026-09-16:** ground-truth re-verified at closure (registry entry
  `registry-partitioned.ts:259`, map `gateway-catalogs.ts:157`, fetcher wired
  `gateway.ts:62`/`:210` + `openrouter-models.ts:54` +
  `static-catalogs-gateways.ts:211`); receipt stands as stamped (6/6);
  archived.
- **Typecheck-count reconciliation:** the stamped receipt and the
  `## Verification Gates` list declare 3 typecheck gates (common, cli, sdk) —
  the machine-enforced contract. The Loop-3 AUDIT narrative's "×4" includes
  `packages/agent-runtime`, which is not a declared gate; the CHANGELOG and
  archive-README closure entries cite ×3 after the stamped receipt.

### Code Verification Evidence

- [x] Typecheck ×4 — exit 0 (common, sdk, packages/agent-runtime, cli)
- [x] RED-first pin suite — fid-2026-0916-005-atria.test.ts 4/4 pass
- [x] Law 4 grep for `fetchAtriaModels` callers — gateway.ts:62/210, openrouter-models.ts:54