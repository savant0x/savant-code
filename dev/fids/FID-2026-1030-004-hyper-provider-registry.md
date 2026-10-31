# FID: Hyper (Charm) built-in provider registry entry

**Filename:** `FID-2026-1030-004-hyper-provider-registry.md`
**ID:** FID-2026-1030-004
**Severity:** low
**Status:** converged
**Created:** 2026-10-30 00:00
**Automation level:** 3
**YAGNI-Compliance:** Verified

---

## Summary

The operator asked for Charm's Hyper inference gateway
(`https://hyper.charm.land`) to be available as a built-in provider. Hyper is not
a user-defined endpoint: the product should ship it with an audited registry
entry, a live catalog, window coverage, exception ownership, picker placement,
and the hand-maintained documentation surfaces the drift gates pin. The change is
additive: one registry entry plus the derivations it implies.

## Environment

- **OS:** Windows (win32 x64)
- **Language/Runtime:** TypeScript (strict), Bun 1.3.x
- **Tool Versions:** repo pins per `protocol.config.yaml`
- **Commit/State:** working tree at `0340260c` (branch `main`), clean at intake

## Detailed Description

### Problem

No `hyper` entry exists in `PROVIDER_REGISTRY`, so model ids prefixed `hyper/`
cannot route, the `/provider` picker does not offer the service, and the vendor's
curated coding roster is unreachable from the product.

### Expected Behavior

`/provider hyper` accepts `HYPER_API_KEY`; `/model` lists the vendor's live
roster with vendor-published context windows; a `hyper/<id>` selection routes
through the generic registry factory to `https://hyper.charm.land/v1` with
`Authorization: Bearer <key>`; every existing fail-closed gate (registry
validation, exception audit, window coverage, docs drift, pinned setup/order
lists) stays green with the new entry included.

### Root Cause

Absent feature, not a defect. The registry is the single source of truth
(`common/src/providers/registry.ts`), so a provider that is not an entry does not
exist for any derived surface.

### Evidence

Vendor contract, read 2026-10-30:

- `https://hyper.charm.land/docs/` — base URL `https://hyper.charm.land/v1`,
  env var `HYPER_API_KEY`, OpenAI-compatible `/v1/chat/completions`.
- `https://hyper.charm.land/docs/api/list-models.html` — `GET /v1/models`
  returns the OpenAI model list with `id`, `display_name`, `context_window`,
  `max_output_tokens`, `capabilities.vision`, `reasoning`, `pricing`. "No
  authentication required."
- `https://hyper.charm.land/docs/api/authentication.html` — `Authorization:
  Bearer sk-hyper-…`; `/v1/messages` also accepts `X-Api-Key`.
- `https://hyper.charm.land/docs/api/openai-responses.html` and
  `.../anthropic-messages.html` — Responses and Messages pass-throughs exist for
  the same roster, so protocol choice is a product choice, not a routing
  constraint; chat/completions serves every model.

Live probe, `GET https://hyper.charm.land/v1/models`, 2026-10-30 (keyless, HTTP
200), 23 rows:

```text
prism, deepseek-v4.1-flash-1017, deepseek-v4.1-flash, deepseek-v4-pro-0813,
deepseek-v4-flash-0731, kimi-k3, kimi-k2.7-code, kimi-k2-thinking, glm-5.3,
glm-5.3-flash, glm-5.2, minimax-m3, minimax-m2.7, inkling, qwen3.8-max,
qwen3.8-flash, qwen3.8-27b, qwen3.8-2.4t-a95b, qwen3.7-max, qwen3.7-plus,
qwen3.7-flash, gpt-oss-120b, gemma-4-26b-a4b-it
```

All 23 rows publish a positive `context_window` (1,000,000-1,048,576 except
`kimi-k2.7-code` 256,000, `kimi-k2-thinking` 262,144, `gpt-oss-120b` 131,072,
`gemma-4-26b-a4b-it` 256,000, `minimax-m3` 512,000, `minimax-m2.7` 262,100).
Rows carry no slash, so upstream ids are bare and `idTransform: 'strip'` is
correct.

## Impact Assessment

### Affected Components

- `common/src/providers/registry-partitioned-5.ts` — the `hyper` entry
- `cli/src/utils/openrouter-models/hyper.ts` — live catalog wrapper (new)
- `cli/src/utils/openrouter-models/gateway-live-results.ts` — fan-out + ladder
- `cli/src/utils/openrouter-models/gateway-catalog-merge.ts` — merge order
- `cli/src/utils/openrouter-models/gateway.ts` — reset seam + provider comment
- `common/src/providers/provider-exception-manifest.ts` — `live-catalog` owner
- `common/src/constants/window-coverage-register.ts` — `runtime-published`
- Pinned contract tests + `docs/providers.md` and the hand-maintained doc
  surfaces the drift gate names

### Risk Level

- [x] Low: additive registry entry; all gates fail closed if any derivation is
  incomplete

## Proposed Solution

### Approach

Follow `docs/adding-a-provider.md` exactly: one typed registry entry, one
`createLiveCatalogFetcher` wrapper (public catalog, no resolver), fan-out entry
immediately before the custom-catalogs tail, ladder slot in the same position,
merge order appended after the newest built-in live leg, one exception-manifest
entry, one window-coverage disposition, regenerated + hand-updated docs.

### Steps

1. Add the `hyper` entry: gateway, `HYPER_API_KEY`, base
   `https://hyper.charm.land/v1`, protocol `openai`, `idTransform: 'strip'`,
   `catalog: { source: 'live', url: 'https://hyper.charm.land/v1/models' }`,
   `domain: 'charm.land'`, `order: 4`.
2. Add `cli/src/utils/openrouter-models/hyper.ts` (dedicated parser mapping
   `display_name` → `name`, `context_window` → `contextLength`,
   `max_output_tokens` → `maxCompletionTokens`, `capabilities.vision` →
   `capabilities`).
3. Wire the fan-out array, the positional ladder, the merge order, and the
   credential-mutation cache reset.
4. Register `live-catalog` in the exception manifest and
   `runtime-published` in the window-coverage register with the probe counts.
5. Extend the pinned registry/setup/order lists, add the catalog parser test and
   the SDK key-present/key-missing routing case.
6. Regenerate `generate:provider-docs` and update the hand-maintained surfaces.
7. Run the gates and record the evidence.

### Verification

- `common/src/providers/__tests__/provider-registry.test.ts` (keys, order)
- `common/src/providers/__tests__/provider-registry-setup.test.ts` (setup keys)
- `common/src/providers/__tests__/validate-provider-registry.test.ts` (derivation)
- `cli/src/utils/openrouter-models/__tests__/window-coverage-register.test.ts`
- `cli/src/utils/openrouter-models/__tests__/hyper-catalog.test.ts` (new parser)
- `sdk/src/impl/__tests__/model-provider-free-mode.test.ts` (routing leg)
- `cli/src/utils/__tests__/provider-setup.test.ts` (key persistence)
- `bun run generate:provider-docs:check`, `bun run typecheck`, eslint, markdown lint
- Live acceptance (separate from code closure): an authenticated completion from
  the vendor is an observation recorded in the changelog note, never inferred
  from a green typecheck.

## Verification Gates

- gate: typecheck common
- gate: typecheck cli
- gate: typecheck sdk
- gate: test common/src/providers/__tests__/provider-registry.test.ts
- gate: test common/src/providers/__tests__/provider-registry-setup.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/hyper-catalog.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/window-coverage-register.test.ts
- gate: test sdk/src/impl/__tests__/model-provider-free-mode.test.ts
- gate: test cli/src/utils/__tests__/provider-setup.test.ts
- gate: quality

## Perfection Loop

### Loop 1 — RED

- **RED:** Registry has no `hyper` entry; no live catalog wrapper; no exception
  owner; no window disposition; pinned lists omit the id.
- **GREEN:** Entries and wiring added per the steps above.
- **AUDIT:** Gate output pasted below.
- **ADVERSARIAL:** Checked that Hyper's roster publishes windows on every row
  (no fallback table owed) and that no model id collides with an existing
  provider prefix.
- **CHANGE DELTA:** N/A (new record).

### Missed Questions

1. Is a protocol map needed? No — every roster model is served by
   `/v1/chat/completions`; Responses and Messages are vendor pass-throughs for
   the same ids, not a mixed roster. `protocol: 'openai'` is the minimal truthful
   entry; a map would add an exception kind with no routing difference.
2. Is the catalog keyless? Yes — measured HTTP 200 with no credential, so no
   `resolveKey` and no `credential-resolver` exception.
3. Does the roster need media filtering? No — the vendor hand-picks coding
   models; no image/video/audio rows appear in the measured roster.

### Implementation Evidence (REQUIRED for `closed`)

- [ ] **Commit SHA:** pending
- [ ] **File:line ranges:** pending
- [ ] **Gate output:** pending
- [ ] **Reproducibility:** `rg -n "hyper" common/src/providers cli/src/utils/openrouter-models common/src/constants/window-coverage-register.ts`
- [ ] **Step statuses:** pending

### Code Verification Evidence

- [ ] Files referenced in Affected Components exist
- [ ] Implementation matches the Proposed Solution
- [ ] Typecheck/tests/lint pass with pasted tool output
- [ ] Production call-graph evidence is present for new or repaired wiring
- [ ] FID status reflects the actual implementation state

## Resolution

Pending implementation and gate evidence.
