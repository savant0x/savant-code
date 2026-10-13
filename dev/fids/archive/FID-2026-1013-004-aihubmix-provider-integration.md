# FID: AIHubMix provider integration (built-in registry)

**Filename:** `FID-2026-1013-004-aihubmix-provider-integration.md`
**ID:** FID-2026-1013-004
**Severity:** medium
**Status:** converged
**Created:** 2026-10-13 16:03
**Automation level:** 3
**YAGNI-Compliance:** Verified

---

## Summary

Add AIHubMix as a built-in OpenAI-compatible gateway provider. The measured
contract uses `AIHUBMIX_API_KEY` for inference at `https://aihubmix.com/v1`,
while the richer public model catalog is `GET https://aihubmix.com/api/v1/models`.
The implementation will use the registry as the source of truth, a dedicated
catalog parser, the existing live-catalog cache/fan-out seams, registry-derived
credential and routing surfaces, and the provider runbook's generated and
hand-maintained documentation gates.

## Environment

- **OS:** Windows 11, PowerShell
- **Language/Runtime:** TypeScript, Bun 1.3.14
- **Tool Versions:** TypeScript 5.5.4, strict mode, 300-line file ceiling
- **Commit/State:** `main` at `2eeb100e`; unrelated worktree changes preserved

## Detailed Description

### Problem

AIHubMix is absent from `PROVIDER_REGISTRY`, so users cannot select it through
`/provider` or `/model`, its `AIHUBMIX_API_KEY` is not resolved by the generic
SDK factory, and its live model catalog cannot reach the picker. The provider
has two measured model-list shapes: the OpenAI-shaped `/v1/models` endpoint and
the richer `/api/v1/models` endpoint documented by AIHubMix. The richer endpoint
  publishes model-type metadata and, for a subset of LLM rows, context and
  output limits required by the runtime model metadata surface.

### Expected Behavior

`aihubmix/<upstream-id>` must round-trip the provider chain:

```text
live catalog → /model selection → persisted activeProvider
→ SDK registry loop → generic OpenAI factory
→ https://aihubmix.com/v1/chat/completions
→ Authorization: Bearer AIHUBMIX_API_KEY
→ upstream model id with exactly one internal `aihubmix/` prefix removed
```

The public catalog must populate without a key. A missing inference key must
fail with the registry-derived provider message. Malformed catalog rows must be
ignored without throwing, and every accepted model must carry the provider
prefix, published context window, and published maximum output where present.

### Root Cause

This is a missing built-in provider, not a defect in the generic routing
factory. The contract is already supported by the typed registry and generic
OpenAI-compatible request path; the provider-specific work is the live catalog
normalization and its required wiring/audit surfaces.

### Evidence

The provider documentation identifies the following contracts:

- `https://docs.aihubmix.com/en/api/Models-API` documents
  `GET https://aihubmix.com/api/v1/models` and the rich row fields
  `model_id`, `model_name`, `desc`, `types`, `features`, `pricing`,
  `context_length`, and `max_output`.
- `https://docs.aihubmix.com/en/api/Aihubmix-Integration` documents the
  OpenAI-compatible base `https://aihubmix.com/v1`, bearer authentication, and
  `POST /v1/chat/completions`.
- `https://console.aihubmix.com/developer` returned HTTP 404 during inspection;
  it is not used as contract evidence.

Sanitized live probes on 2026-10-13 (no key material emitted):

```text
GET https://aihubmix.com/api/v1/models
  status=200, rows=869
  first row keys=context_length,desc,developer_id,endpoints,features,
    input_modalities,last_updated,max_output,model_id,model_name,
    output_modalities,pricing,pricing_source,reasoning,release_date,
    retire_stage,schema_checked,tool_call,types
  first model_id=auto

GET https://aihubmix.com/v1/models (keyless)
  status=200, rows=698
  first row keys=created,id,object,owned_by
  first id=auto

GET /api/v1/models model type counts
  698 rows contain the comma-delimited `llm` type token, including mixed rows
  such as image_generation,llm and llm,decision; the remaining rows are
  non-LLM-only types

LLM limit census (same live probe)
  positive finite context_length=358/698
  positive finite max_output=306/698
  empty endpoints=642/698; every non-empty endpoint list includes
  chat_completions

Free catalog rows include:
  coding-glm-5.3-flash-free: types=llm, pricing input/output=0,
    context_length=1000000, max_output=131072,
    features=thinking,tools,function_calling,structured_outputs

POST https://aihubmix.com/v1/chat/completions
  model=coding-glm-5.3-flash-free, status=200
  response content begins with the provider's free-resource policy apology:
  "Sorry, to prevent abuse of free resources, accounts that have not been
  recharged can only try 10 times."
```

The keyless and keyed model-list bodies were byte-identical in the earlier
sanitized probe. Therefore the catalog wrapper will not provide
`resolveKey`; inference remains credential-gated through the generic SDK
factory. The HTTP 200 free-model response is recorded as transport/provider
reachability, not as a substantive completion acceptance.

Existing implementation contracts establish the wiring shape:

- `docs/adding-a-provider.md:186-258` requires a dedicated live wrapper,
  gateway fan-out, positional settled ladder, cache reset, and catalog
  exception owner.
- `common/src/providers/registry-partitioned-3.ts:70-114` is the current
  live-provider partition and has room below the 300-line ceiling.
- `cli/src/utils/openrouter-models/apixo.ts:21-82` is the nearest keyless
  dedicated-parser pattern.
- `cli/src/utils/openrouter-models/mistral.ts:39-79` is the nearest rich
  catalog parser pattern using `catalogRows`, `catalogObject`, and
  `catalogLimit`.
- `cli/src/utils/openrouter-models/gateway-live-results.ts:6-16` defines the
  positional contract; the new leg must be inserted immediately before the
  custom-catalog tail.

## Impact Assessment

### Affected Components

- `common/src/providers/registry-partitioned-3.ts`
- `common/src/providers/provider-exception-manifest.ts`
- `common/src/constants/window-coverage-register.ts`
- `common/src/constants/provider-catalog-census.json`
- `cli/src/utils/openrouter-models/aihubmix.ts` (new)
- `cli/src/utils/openrouter-models/gateway.ts`
- `cli/src/utils/openrouter-models/gateway-live-results.ts`
- `cli/src/utils/openrouter-models/gateway-catalog-merge.ts`
- `common/src/providers/__tests__/provider-registry.test.ts`
- `common/src/providers/__tests__/provider-registry-gateways.test.ts`
- `common/src/providers/__tests__/validate-provider-registry.test.ts`
- `common/src/providers/__tests__/provider-audit.test.ts`
- `cli/src/utils/openrouter-models/__tests__/aihubmix-catalog.test.ts` (new)
- `cli/src/utils/openrouter-models/__tests__/window-coverage-register.test.ts`
- `cli/src/utils/__tests__/provider-setup.test.ts`
- `sdk/src/impl/__tests__/model-provider-free-mode-test-setup.ts`
- `sdk/src/impl/__tests__/model-provider-free-mode-aihubmix.test.ts` (new)
- Generated provider references: `.env.example`, `README.md`,
  `cli/release/README.md`, `docs/providers.md`
- Hand-maintained provider references: `README.md`, `README.zh-CN.md`,
  `docs/index.md`, `docs/sdk-overview.md`, `docs/installation.md`,
  `docs/features.md`
- `CHANGELOG.md`, `SCOPE.md`, and this FID's session records

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] Medium: New outbound provider surface; existing providers remain
      unchanged, but a malformed catalog or wrong positional slot can hide or
      mislabel models.
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Follow `docs/adding-a-provider.md` and reuse the existing generic seams. Add a
single `aihubmix` registry entry with `protocol: 'openai'` and
`idTransform: 'strip'`; do not add a protocol map because the measured product
request is OpenAI Chat Completions. Use the richer `/api/v1/models` endpoint as
the registry-owned live catalog because it publishes the context/output limits
and model-type metadata needed by the picker.

The dedicated parser will:

1. Read the standard `data` envelope through the shared wire guards.
2. Accept rows whose comma-separated `types` include `llm`; exclude image,
   embedding, audio, video, OCR, search-only, moderation, rerank, and other
   non-LLM rows.
3. Require a non-empty string `model_id` and prefix it uniformly as
   `aihubmix/<model_id>`.
4. Map `model_name` to `name`, `desc` to `description`,
   `context_length` to `contextLength`, and `max_output` to
   `maxCompletionTokens`.
5. Preserve only vendor metadata with a measured, unambiguous meaning. Do not
   fabricate creation dates or prices from undocumented units. Map the
   comma-separated `features` field to capabilities only when it is a valid
   non-empty string.
6. Sort by the normalized id and degrade malformed envelopes/rows to an empty
   or partial catalog without throwing.

The `endpoints` field is intentionally not used as an exclusion predicate:
the live probe showed it is sparse even on free LLM rows, so filtering by it
would silently remove models the unified chat surface may serve. The parser
will pin this decision in its contract test.

### Carrier header (operator requirement, received mid-implementation)

The operator supplied AIHubMix's documented carrier code, which grants a
standing 10% discount on every request:

```text
Authorization: Bearer <AIHUBMIX_API_KEY>
APP-Code: MFSO2605
```

No existing seam carries a provider-specific request header, and the codebase
already showed the failure mode this invites: `NOUS_REQUIRED_REQUEST_TAGS` is
hard-coded by provider id in two separate factories. That pattern does not
scale and silently ignores any second provider with the same need.

**Design.** Add one optional registry field, `extraHeaders?:
Record<string, string>`, and let the registry own the value. Apply it in the
generic factory on **all four** protocol branches (anthropic, responses,
gemini, openai) so a declared header can never be dropped because its model
dispatched to a different wire protocol, and plumb it through the bare-slug
path (`createDefaultInferenceModel`) so a `DIRECT_PROVIDER=aihubmix` user
receives the same headers as a prefixed one.

The custom-`INFERENCE_BASE_URL` branch is deliberately excluded: an
operator-owned endpoint is a different target and must never receive a registry
provider's identity headers (FID-2026-1003-006).

**Carrier code vs credential.** `MFSO2605` is a public discount code, not a
secret, so it is registry data and never an env var: no key-management surface,
no `.env.example` row, no `credentials.extra` entry.

**Operator-visible consequence (flagged, not blocking).** Because it is the
operator's own code, every Savant user's AIHubMix request carries it, which
credits the operator. The operator explicitly requested this; the value lives
on one registry line and reverses with a single edit if that is not wanted.

### Steps

1. **Registry and audits:** add `aihubmix` with `AIHUBMIX_API_KEY`,
   `https://aihubmix.com/v1`, live catalog `https://aihubmix.com/api/v1/models`,
   setup enabled, `aihubmix.com` logo domain, and order 4. Add the
   `live-catalog` exception owner and `runtime-partial` window disposition
   with the measured 698 LLM rows, 358/698 positive context windows, and
   306/698 positive output limits. Zero, missing, negative, and non-finite
   values remain unknown; no fallback values are fabricated.
2. **Catalog wrapper:** add `aihubmix.ts` with a dedicated parser built on
   `createLiveCatalogFetcher`; derive the catalog URL from the registry; omit
   `resolveKey`; export fetch, cache, availability, reset, and test-parser
   seams.
3. **Picker wiring:** add the fetcher and cache fallback to the settled ladder
   immediately before custom catalogs, add its merge spread and gateway cache
   reset, and update the load-bearing positional comments/tests.
4. **Tests:** extend registry enumeration/derivation/audit/setup tests; add the
   AIHubMix parser/registry/coverage/manifest/ladder suite; add SDK key-missing
   and bearer-routing coverage plus the shared harness env cleanup.
5. **Documentation/census:** run the provider-doc generator, repair every
   hand-maintained drift surface it reports, update `docs/providers.md` prose,
   and run the provider parity census so the picker row count is recorded.
6. **Verification and closure:** run every declared gate, the configured build,
   typecheck, tests, lint, markdown, format, repository, and reachability
   checks; record the real live response without upgrading the policy apology
   to a substantive completion; create a local path-scoped commit, then close,
   archive, and changelog the FID.
7. **Carrier header (operator requirement, mid-implementation):** add the
   `extraHeaders` field to `ProviderConfig`, populate it for AIHubMix with the
   documented `APP-Code`, apply it on every generic-factory protocol branch
   plus the bare-slug path, and pin it in both registry-entry tests and an SDK
   wire-level assertion that reads the header back off the transport.

### Verification

- `common/src/providers/__tests__/provider-registry.test.ts` — registry key,
  setup-key, order, and derived-prefix enumerations include AIHubMix.
- `common/src/providers/__tests__/provider-registry-gateways.test.ts` — the
  full AIHubMix entry matches the documented/observed contract.
- `common/src/providers/__tests__/validate-provider-registry.test.ts` — live
  registry and derived surfaces validate cleanly; AIHubMix derivation is pinned.
- `common/src/providers/__tests__/provider-audit.test.ts` — the live-catalog
  exception is owned and evidenced.
- `cli/src/utils/openrouter-models/__tests__/aihubmix-catalog.test.ts` — rich
  row parsing, LLM filtering, prefixing, limits, malformed input, coverage,
  manifest ownership, and positional ladder.
- `cli/src/utils/openrouter-models/__tests__/window-coverage-register.test.ts`
  — registry-wide coverage remains closed-world and fail-closed.
- `cli/src/utils/__tests__/provider-setup-aihubmix.test.ts` — stored/env key
  setup and direct-provider activation for `aihubmix`.
- `sdk/src/impl/__tests__/model-provider-free-mode-aihubmix.test.ts` — missing
  key failure, bearer authorization, correct base URL, one-prefix stripping, and
  the registry-declared `APP-Code` read back off the transport.
- `common/src/providers/types.ts` + `sdk/src/impl/model-provider/model-factories.ts`
  + `sdk/src/impl/model-provider/default-inference.ts` + `sdk/src/impl/model-provider.ts`
  — the `extraHeaders` field and its four-branch / bare-slug application.
- `scripts/window-coverage-check.ts` and
  `scripts/provider-catalog-parity.ts` — runtime coverage/census checks.
- `bun --no-env-file` keyless catalog probe — catalog HTTP status and row shape.
- `bun --env-file=.env.local` sanitized inference probe — status and bounded
  response prefix only; no credential output.

The positional ladder must be extended as one contract: after the change,
`restResults[10]` is xKiro, `[11]` is Apixo, `[12]` is AIHubMix, and `[13]` is
custom catalogs. The existing Apixo ladder test must add an explicit AIHubMix
slot and assert all three tail properties. The SDK routing test must use a
typed `globalThis.fetch` transport and direct `doGenerate` invocation; it must
not copy the sibling tests' `@ts-expect-error`/`as unknown as` mock pattern.

## Verification Gates

- gate: typecheck common
- gate: typecheck cli
- gate: typecheck sdk
- gate: test common/src/providers/__tests__/provider-registry.test.ts
- gate: test common/src/providers/__tests__/provider-registry-gateways.test.ts
- gate: test common/src/providers/__tests__/validate-provider-registry.test.ts
- gate: test common/src/providers/__tests__/provider-audit.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/aihubmix-catalog.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/window-coverage-register.test.ts
- gate: test cli/src/utils/__tests__/provider-setup.test.ts
- gate: test cli/src/utils/__tests__/provider-setup-aihubmix.test.ts
- gate: test sdk/src/impl/__tests__/model-provider-free-mode-aihubmix.test.ts
- gate: probe scripts/window-coverage-check.ts
- gate: probe scripts/provider-catalog-parity.ts
- gate: test cli/src/utils/__tests__/openrouter-models-gateway-providers.test.ts
- gate: test cli/src/utils/__tests__/openrouter-models-gateway.test.ts
- gate: probe scripts/provider-parity-check.ts
- gate: quality

### Verification Receipt

The implementation receipt will be written only after the declared gates run
against the implementation tree.

## Perfection Loop

### Loop 1 — RED

- **RED:** AIHubMix has no registry entry, routing prefix, credential
  derivation, live wrapper, picker fan-out, exception owner, window-coverage
  entry, tests, census row, or provider documentation. The vendor's richer
  catalog has mixed model types, sparse endpoint metadata, and documented
  context/output fields. The tested free inference response is HTTP 200 but is
  an account-policy apology rather than a substantive completion.
- **GREEN:** Use one typed registry entry, one dedicated rich-catalog parser,
  one keyless live wrapper, one live-catalog exception owner, one
  runtime-partial coverage entry, one immediately-before-custom positional
  ladder insertion, derived documentation, and additive tests. Preserve the
  inference limitation as evidence rather than inventing success.
- **AUDIT:** The runbook and existing Apixo/Mistral implementations provide
  the required shape. The live keyless probe independently returned 698
  OpenAI-shaped rows and 869 rich rows; 698 rich rows contain the exact `llm`
  type token, 358/698 have a positive context limit, and 306/698 have a
  positive output limit. The parser decision therefore uses the measured
  `types` field, leaves zero limits undefined, and does not use the sparse
  `endpoints` field as an exclusion gate. No production code has been written
  before this convergence.
- **ADVERSARIAL:** A shared OpenRouter parser would discard the rich limits;
  using `/v1/models` would discard the richer type/window metadata; adding a
  catalog resolver would break public catalog population; filtering on
  `endpoints` would drop free LLM rows; declaring `openai-anthropic` would add
  an unneeded protocol-map exception; and treating HTTP 200 policy text as a
  real completion would overstate acceptance. These alternatives are rejected
  by the measured wire shapes and repository contracts.
- **CHANGE DELTA:** Initial FID creation contains the complete RED/GREEN/AUDIT/
  ADVERSARIAL record; no prior AIHubMix FID content existed to oscillate.

### Missed Questions

1. **Which provider id and key name are canonical?** Use `aihubmix` and
   `AIHUBMIX_API_KEY`, exactly matching the operator request and preserving the
   vendor's uppercase acronym in the environment variable.
2. **Which model-list endpoint is the catalog source?** Use the documented
   `/api/v1/models` rich endpoint because it is public, returns 869 rows with
   model type and limits, and contains the 698 LLM rows intended for the
   unified model picker. The OpenAI-shaped `/v1/models` endpoint remains an
   observed compatibility surface, not the source of picker metadata.
3. **Does catalog fetching need the API key?** No. The keyless catalog returned
   HTTP 200 and the earlier keyed/keyless bodies were byte-identical. The
   wrapper therefore omits `resolveKey`; inference still requires the key.
4. **Which rows belong in an OpenAI chat picker?** Include rows whose `types`
   token list contains `llm`. This includes mixed values such as
   `image_generation,llm` and excludes non-LLM-only rows. Do not infer support
   from the sparse `endpoints` field.
5. **Should pricing be mapped?** No until the vendor's unit is established in
   the measured contract. Zero free pricing is useful evidence but an
   undocumented paid-price unit must not be converted into per-token values.
6. **Does the provider need a protocol map?** No. The product integration is
   the measured OpenAI-compatible `/v1/chat/completions` wire. Vendor-native
   endpoints not routed by Savant do not make this roster mixed.
7. **What does HTTP 200 inference prove?** It proves transport and provider
   response reachability only. The policy apology is recorded honestly; a
   future substantive completion would be stronger evidence but is not
   fabricated here.
8. **How are context windows covered?** The rich catalog measured 698 LLM rows,
   but only 358 publish a positive finite context limit and 306 publish a
   positive finite output limit. The disposition is therefore
   `runtime-partial`; rows remain selectable and missing/zero limits remain
   unknown without fallback fabrication.
9. **Where does the provider appear in documentation?** Generated registry
   surfaces come from `PROVIDER_REGISTRY`; the generator's drift list owns the
   hand-maintained README, translation, SDK, installation, feature, and docs
   index mentions.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** `6c324955` (provider integration) + the carrier-header
      follow-up in the same close-out commit recorded in the changelog entry
      above. Nothing was pushed.
- [x] **File:line ranges:**
  - Registry entry + carrier header: `common/src/providers/registry-partitioned-3.ts:114-141`
  - New field: `common/src/providers/types.ts:117-125`
  - Factory application (all four branches):
    `sdk/src/impl/model-provider/model-factories.ts:80`, `:95`, `:108`,
    `:125`, `:154`
  - Bare-slug application: `sdk/src/impl/model-provider/default-inference.ts:67`, `:121`, `:153`
  - Bare-slug plumbing: `sdk/src/impl/model-provider.ts:206-207`
  - Catalog parser: `cli/src/utils/openrouter-models/aihubmix.ts`
  - Picker ladder / merge / cache reset:
    `cli/src/utils/openrouter-models/gateway-live-results.ts:17-19`,
    `gateway-catalog-merge.ts`, `gateway.ts:15-17`
  - Coverage + exception ownership: `common/src/constants/window-coverage-register.ts`, `common/src/providers/provider-exception-manifest.ts`
  - Runbook field docs: `docs/adding-a-provider.md:105-107`, `:129-140`
- [x] **Gate output:** every declared gate passed live — see the table below.
- [x] **Reproducibility:** `bun run typecheck`; `bun test src/` from `common`,
      `cli` and `sdk`; `bun x eslint . --max-warnings 0`;
      `bunx prettier --check` on the touched files; `bun run lint:md`;
      `bun run window-coverage:check`; `bun run providers:parity:check`;
      `bun run generate:provider-docs:check`;
      `bun scripts/provider-parity-check.ts`;
      `bun scripts/provider-docs-counts-drift.ts`.
- [x] **Step statuses:** Steps 1-7 `implemented`.

| Gate | Result |
|---|---|
| `typecheck common` / `cli` / `sdk` (root chain, 13 workspaces + scripts) | pass, 0 errors |
| `provider-registry.test.ts` | pass |
| `provider-registry-gateways.test.ts` | pass |
| `validate-provider-registry.test.ts` | pass |
| `provider-audit.test.ts` | pass |
| `aihubmix-catalog.test.ts` | pass |
| `window-coverage-register.test.ts` | pass |
| `provider-setup.test.ts` | pass |
| `provider-setup-aihubmix.test.ts` | pass |
| `model-provider-free-mode-aihubmix.test.ts` | 2 pass, 5 expect |
| `openrouter-models-gateway-providers.test.ts` | pass |
| `openrouter-models-gateway.test.ts` | pass |
| `scripts/window-coverage-check.ts` | pass |
| `scripts/provider-catalog-parity.ts` | pass |
| `scripts/provider-parity-check.ts` | PASS |
| `quality` (eslint + prettier + lint:md) | eslint 0 problems; prettier clean |

Workspace suites: common 875 pass / 0 fail, cli 4155 pass / 0 fail,
sdk 679 pass / 0 fail.

**Honest limits on the receipt.** Two repository-wide gates do not report clean,
and neither is caused by this FID's diff:

1. `scripts/validate-repository.ts` reports **one** issue — a stray untracked
   `session-ses_ec93.md` at the repository root, flagged as a foreign tree with
   no tracked files and no ignore entry. It is not deleted here because it is
   untracked work this pass does not own.
2. `bun run lint:md` fails on that same stray file and nothing else.

The operator had separately ruled `validate:repository` out of this pass for
wall-clock reasons. The finding above is reported rather than worked around.

### Code Verification Evidence

- [x] **Files referenced in Affected Components exist.** Every path in
      Implementation Evidence resolves; confirmed by the passing typecheck.
- [x] **Implementation matches the Proposed Solution.** Registry-driven
      `extraHeaders` on all four branches plus the bare-slug path; custom
      endpoint branch excluded; carrier code kept out of the env surface.
- [x] **Typecheck/tests/lint pass with pasted tool output.** See the gate table.
- [x] **Production call-graph evidence is present.** `extraHeaders` is declared
      at `types.ts:125`, set at `registry-partitioned-3.ts:139`, resolved at
      `model-factories.ts:80`, and consumed at six points (`:95`, `:108`,
      `:125`, `:154`, `default-inference.ts:121`, `:153`), with the bare-slug
      plumbing at `model-provider.ts:206-207`. Zero reads are unreachable, so
      the field is not dead configuration. The SDK test reads
      `APP-Code: MFSO2605` back off a mocked transport, which is the
      end-to-end leg.
- [x] **FID status reflects the actual implementation state.** The FID is
      being moved to `closed`; the code exists and its gates passed.

## Resolution

- **Closed Date:** 2026-10-13
- **Fix Description:** AIHubMix ships as a built-in gateway provider — one typed
  registry entry, a dedicated parser over the richer keyless `/api/v1/models`
  catalog, positional ladder insertion immediately before custom catalogs, a
  `runtime-partial` window disposition, and registry-derived credential,
  routing, picker and documentation surfaces. The operator's mid-implementation
  carrier-header requirement landed as a general `ProviderConfig.extraHeaders`
  field applied on all four protocol branches and the bare-slug path, rather
  than a provider id hard-coded by name.
- **Tests Added:** registry enumerations and full-entry pins
  (`provider-registry`, `provider-registry-gateways`,
  `validate-provider-registry`, `provider-audit`), the parser/coverage/manifest/
  ladder suite (`aihubmix-catalog`), provider setup, the SDK routing lane
  including a wire-level `APP-Code` assertion, and the gateway suites.
- **Verification Evidence:** all declared gates passed live; the gate table in
  Implementation Evidence carries the results. The free-inference probe is
  recorded as HTTP 200 transport reachability with an account-policy apology —
  **not** as a substantive completion.
- **Known Limitation:** the free-resource policy blocked a substantive free
  completion. Nothing in the implementation depends on it, and no stronger
  claim is made.
- **Archived:** pending this closure commit.

## Lessons Learned

1. A provider can expose a public OpenAI-shaped list and a richer management
   catalog; the picker should use the measured metadata source rather than the
   endpoint that merely resembles the generic parser.
2. Sparse vendor endpoint metadata must not be treated as a complete capability
   declaration without a measured negative contract; the rich model type field
   is the safer observed filter for this provider.
3. HTTP 200 response status is not equivalent to a successful model completion
   and must not be recorded as one.
4. AIHubMix's LLM catalog is runtime-partial: it publishes zero-valued or
   absent limit fields for a substantial subset, so runtime metadata must not
   promote field presence into a false coverage claim.
