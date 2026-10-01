# FID: First-class OpenAI platform provider + /provider picker ordering

**Filename:** `FID-2026-1001-001-openai-platform-provider.md`
**ID:** FID-2026-1001-001
**Severity:** high
**Status:** closed
**Created:** 2026-10-01
**Automation level:** 2
> (Within approved scope once the operator approves this FID; the session
> ceiling governs. No level lifts the G-laws, Law 3, or the
> project-directory boundary.)
**YAGNI-Compliance:** Resolved at implementation — no speculative
provider abstraction beyond the entry + total no-map resolver; the
OAuth lane is reused, not duplicated; the picker sort is two
`localeCompare` calls; the catalog wrapper is the shared fetcher (the
Nous/apinex pattern) rather than bespoke plumbing.

---

## Summary

Savant's OpenAI support is subscription-only: the sole transport is
`createOpenAIOAuthModel` (`sdk/src/impl/model-provider/model-factories.ts:33`,
ChatGPT-backend Codex OAuth, gated on `CHATGPT_OAUTH_ENABLED` +
`getValidChatGptOAuthCredentials()`), and `PROVIDER_REGISTRY`
(`common/src/providers/registry*.ts`) carries **no `openai` entry** — a
platform `sk-` key has no consumer anywhere in the tree (grep for
`OPENAI_API_KEY` in production source: zero hits). The operator holds a
platform key, `/provider` never lists OpenAI, and a bare-slug GPT request
with only that key present routes to `createDefaultInferenceModel` with an
empty credential. Fix: add the **first-class platform provider** through the
project's own one-entry recipe (`docs/archive/design/Adding New Providers.md`
— FID-2026-0809-001), and fix the `/provider` picker ordering (renders
`Object.entries(PROVIDER_SETUP_CONFIG)` — registry insertion order, never
sorted). The existing Codex/OAuth lane is untouched and remains the
subscription path; the two are separate credential classes
(platform key → platform billing; ChatGPT Pro → Codex OAuth), exactly the
two-lane shape this codebase already applies elsewhere.

## Environment

- **OS:** Windows (win32, bash)
- **Language/Runtime:** TypeScript 5.5.4, Bun 1.3.14
- **Commit/State:** `main` @ `e02c15b7` (T107 closure); provider runbook
  `docs/archive/design/Adding New Providers.md`; no code changes yet.

## Detailed Description

### Problem

1. **No platform lane.** `createProviderModel()` can serve OpenAI today
   only if a registry entry exists — none does. The runbook's own
   acceptance rule ("a provider is wired when `x/<id>` round-trips the
   whole chain") is unmeetable for the most-wanted provider.
2. **Picker ordering.** The `/provider` list is registry insertion order
   (`cli/src/commands/defs/model-provider-commands.ts:83`), not
   alphabetical; the `order` field only groups `/model`
   (`cli/src/components/model-picker-grouping.ts:34`). Operator-reported.
3. **Protocol reachability.** The factory's `responses` branch
   (`model-factories.ts:98-109`) is reachable ONLY through a protocol map
   (`resolveProtocol` fails closed without one for non-`openai`/`anthropic`
   entry protocols). `ProviderConfig.protocol` type
   (`common/src/providers/types.ts:20-21`) admits only
   `'openai' | 'anthropic' | 'openai-anthropic' | 'multi'` — a
   single-protocol Responses entry is not expressible. Two shapes exist:
   (a) type-widen `ProviderProtocol` with `'responses'` and return it from
   `resolveProtocol`'s no-map path, or (b) `protocol: 'multi'` +
   `OPENAI_PROTOCOLS` map. **Chosen: (a)** — one type member, no catalog
   duplication, the entry stays data-only; the factory branch already
   exists (Law 13 — extend, don't add).

### Expected Behavior

After implementation:

- `/provider` lists `OpenAI` (alphabetically), accepts a platform key via
  the standard masked flow, persists to `credentials.json` under
  `OPENAI_API_KEY`, and activates direct-provider routing.
- `openai/<model>` ids route through the registry loop to
  `createProviderModel` → Responses API at `https://api.openai.com/v1`
  with `Authorization: Bearer <platform key>`.
- The Codex/OAuth subscription lane is unchanged; with OAuth credentials
  present and an allowlisted model, `getModelForRequest` still prefers it
  (loop order: OAuth check precedes the registry loop — OAuth wins for
  allowlisted models, platform key serves the rest).
- The picker is alphabetically sorted (label compare); `/model` grouping
  order is untouched.
- `.env.example` gateway section + release README provider table
  regenerate from the registry.

### Root Cause

Not a regression — a coverage gap. The 20+ provider program
(FID-2026-0809-001 + the free-compute pipeline) grew gateway/local
providers; OpenAI direct predates the registry (`openaiModels` in
`providers.ts` is a legacy catalog fragment wired to the OAuth lane) and
was never carried over as a registry entry. The picker ordering gap rode
along since the picker was built (FID-2026-0911-001 D2 kept insertion
order; D9 appended customs after built-ins; no sort was ever specified).

### Evidence

```text
common/src/providers/registry.ts + registry-partitioned{,-2}.ts — no openai entry
  (ids: openrouter, tokenrouter, tokenharbor, nvidia, commandcode, nous,
   cloudflare, ollama, kiosapi, apinex, orcarouter, bai, hcnsec, tokenbom,
   infron, unorouter, bazaarlink, atria, vercel, cleanapis)
sdk/src/impl/model-provider/model-factories.ts:33-58 — createOpenAIOAuthModel
  (Codex OAuth; the only OpenAI transport)
sdk/src/impl/model-provider.ts:59-77 — OAuth gate precedes the registry loop
sdk/src/impl/model-provider/model-factories.ts:98-109 — responses branch
  (createOpenAI().responses(id)) — reachable only via protocolMap today
common/src/providers/types.ts:20-21 — ProviderProtocol lacks 'responses'
common/src/constants/chatgpt-oauth.ts:41-56 — OPENAI_MODEL_ALLOWLIST (OAuth lane)
cli/src/utils/provider-key-store.ts:20 — PROVIDER_SETUP_CONFIG = deriveSetupConfig
cli/src/commands/defs/model-provider-commands.ts:83-100 — picker built from
  Object.entries(PROVIDER_SETUP_CONFIG), no sort
cli/src/utils/openrouter-models/live-catalog.ts:34 — resolveKey seam
  (authenticated live catalogs; apinex.ts:65 is the pattern)
common/src/providers/validate.ts:139-158,195-219 — entry contract the new
  entry must satisfy
```

## Impact Assessment

### Affected Components

- `common/src/providers/types.ts` — `ProviderProtocol` += `'responses'`
- `common/src/providers/registry-partitioned-2.ts` — the `openai` entry
- `common/src/providers/derive.ts` — none (order derives already)
- `sdk/src/impl/model-provider/model-factories.ts` — `resolveProtocol`
  returns `'responses'` from the no-map path (type widening only)
- `cli/src/commands/defs/model-provider-commands.ts` — picker sort
  (one line)
- `cli/src/utils/openrouter-models/live-catalog.ts` (+ new
  `openai-live.ts`) — authenticated live catalog wrapper
  (`https://api.openai.com/v1/models`, Bearer `OPENAI_API_KEY`)
- `.env.example` + `cli/release/README.md` — regenerated
- No changes: OAuth lane, Codex endpoint, credentials store, key
  precedence (env > stored), `applyPersistedProviderApiKeys` (it derives
  from the setup config automatically)

### Risk Level

- [ ] Critical
- [x] Medium: new credential surface + wire protocol reachable from the
      model path; mitigated by the registry's compile-time entry contract,
      the validator's structural checks, fail-closed routing, and the
      OAuth lane being untouched (its gate precedes the loop).
- [ ] Low

## Proposed Solution

### Approach

The one-entry recipe, verbatim. Step 1: registry entry. Step 2: **live**
catalog (`source: 'live'` + authenticated resolver — OpenAI's
`/v1/models` is public-read but Bearer'd; the Nous pattern applies;
static-catalog staleness is exactly what we don't want for a vendor whose
roster moves weekly). Step 4: regenerate docs. Step 5: the three additive
test files + a picker-order pin. The `responses` protocol type-widening
is the single non-data edit, justified under Law 13 (the factory branch
exists; the type is the missing joint).

Catalog failure handling follows the established contract: the live
fetcher degrades (picker falls back to free-text `/model openai/<id>`);
exact-id selection never depends on the catalog. The OAuth allowlist
(`OPENROUTER_TO_OPENAI_MODEL_MAP`) stays the subscription lane's
allowlist; the platform lane needs no allowlist — the provider's own
roster (live catalog) + exact free-text ids govern it. Bare-slug `gpt-*`
ids route to the active provider when OpenAI is active (Phase 4
bare-slug path, already generic).

### Steps

1. **common: types + validator + entry.** `ProviderProtocol` +=
   `'responses'` (`types.ts`) AND `validate.ts:20-25` `PROTOCOLS` Set
   gains `'responses'` (typed from the config type — the two move in the
   same change set or the validator rejects the entry). Registry entry in
   `registry-partitioned-2.ts`:
   `id: 'openai'`, `label: 'OpenAI'`, `kind: 'gateway'`,
   `credentials: { envVar: 'OPENAI_API_KEY', missingKeyMessage: 'OpenAI
   API key not set. Set OPENAI_API_KEY or run /provider openai.' }`,
   `baseUrl: 'https://api.openai.com/v1'`, `protocol: 'responses'`,
   `idTransform: 'strip'`, `catalog: { source: 'live', url:
   'https://api.openai.com/v1/models' }`, `setupAvailable: true`,
   `domain: 'openai.com'`, `order: 0` (frontier tier with
   openrouter/tokenrouter). The validator's envVar-uniqueness,
   gateway-needs-key invariants apply mechanically; the entry is NOT
   map-dispatched (`protocolMap` absent, single protocol), so the :195
   map-enforcement does not apply; live sources are exempt from the
   static-catalog prefix checks by design.
2. **sdk: protocol resolution, both paths.** (a) `resolveProtocol`
   (`model-factories.ts`) accepts `'responses'` in the no-map path — the
   existing `createOpenAI().responses(apiModelId)` branch serves it.
   (b) **Bare-slug dispatch (Loop-2 finding 2):**
   `createDefaultInferenceModel` gains `options.protocol`;
   `getModelForRequest` passes `resolveProtocol(activeConfig, model)`
   when an active gateway is resolved (undefined otherwise);
   `'responses'` constructs `createOpenAI({ baseURL: inferenceBaseUrl,
   apiKey, fetch: fetchWithRetryableNetworkErrors }).responses(model)`.
   Every existing provider's bare-slug construction is byte-identical
   (no protocol → the current chat-format model). This is what makes an
   ACTIVE OpenAI provider legally serve bare `gpt-…` ids instead of
   400-ing on chat/completions.
3. **cli: picker order + live catalog + aggregation.** Sort the picker
   list by label (`localeCompare`) before `open(providers)` — customs +
   the add-row keep their D9 positions (sort within segments, segment
   order preserved). New `openai.ts` wrapper beside `apinex.ts`
   (`deriveLiveCatalogUrl(PROVIDER_REGISTRY, 'openai')` — the URL lives
   in the registry, one truth; `resolveKey: () =>
   process.env.OPENAI_API_KEY`; parser mirrors apinex's wire-guards
   shape). `gateway.ts` joins the fan-out: `fetchOpenAiModels` in the
   allSettled list, the fulfilled/cache ladder, `...openaiModels` in the
   combined list, `__resetOpenAiCacheForTest` in the test reset, and the
   roster comment gains the OpenAI line.
4. **Docs.** `bun run generate:provider-docs` (regenerates `.env.example`
   + release README table). Runbook addendum: the Step-1 template notes
   `protocol: 'responses'` is now legal for single-protocol entries
   (the doc's `'openai' | 'anthropic' | 'openai-anthropic'` enumeration
   is stale after this FID).
5. **Tests (declared gates):**
   - `common/src/providers/__tests__/validate-provider-registry.test.ts`
     — extend: the real `openai` entry passes validation (protocol
     `'responses'` accepted, no protocolMap required, no
     map-dispatch failure).
   - `sdk/src/impl/__tests__/model-provider-free-mode-openai.test.ts`
     (new) — key present → `createProviderModel` returns a model whose
     URL is `https://api.openai.com/v1/responses` with Bearer auth;
     key missing → the templated missing-key error; OAuth precedence:
     with fake OAuth creds + allowlisted model, OAuth still wins; with
     `skipChatGptOAuth`, the platform lane serves; bare-slug with OpenAI
     active → Responses-URL construction; bare-slug with a non-OpenAI
     active provider → unchanged chat-format construction (regression
     pin).
   - `cli/src/utils/__tests__/provider-setup-openai.test.ts` (new) —
     `saveProviderApiKey('openai', …)` persists under `OPENAI_API_KEY`,
     activates routing, appears in the picker alphabetically.
   - `cli/src/utils/__tests__/openrouter-models-gateway-providers.test.ts`
     — extend: the OpenAI catalog joins the combined fetch (fan-out +
     reset + degrade), per the existing per-provider pin pattern.
6. **Docs ledger.** No PORT-NOTES (no vendored code). Runbook addendum
   per step 4; session summary at close.

### Verification

- All new suites pass offline (fetch mocked; no network in CI).
- `bun run typecheck` root chain green (common + sdk + cli legs prove the
  type-widening + entry + picker changes compose).
- `bun run generate:provider-docs:check` green (docs in sync).
- `bun x eslint . --max-warnings 0`; `bun run lint:md`; `quality` PASS.
- Reachability (Law 4): registry entry → `deriveSetupConfig` puts OpenAI
  in `PROVIDER_SETUP_CONFIG` (picker) — grep; `getModelForRequest` loop
  matches `openai/` prefix → `createProviderModel` — proven by the sdk
  suite, not grep alone; end-to-end live probe (keyed `/v1/models` +
  one `/v1/responses` call) is operator-run with their key (recorded
  NEEDS-REVIEW, like the T98/T99 probes).

> Contract rule (FID-2026-0918-006): every promised test artifact names its
> repo-relative `*.test.ts` path, and each appears as a declared
> `- gate: test <path>` below.
>
> (FID-authoring note: the original list declared the pre-split suites and
> a `generate:provider-docs:check` shape that is not in fid:verify's
> allowlisted command shapes. Reconciled at implementation: the OpenAI
> pins landed in dedicated suite files (validate-provider-registry-openai,
> openai-models), and the provider-docs freshness is enforced by
> `validate:repository` + the closure gates recorded in Implementation
> Evidence.)

## Verification Gates

- gate: typecheck common
- gate: typecheck sdk
- gate: typecheck cli
- gate: test common/src/providers/__tests__/validate-provider-registry-openai.test.ts
- gate: test sdk/src/impl/__tests__/model-provider-free-mode-openai.test.ts
- gate: test cli/src/utils/__tests__/provider-setup-openai.test.ts
- gate: test cli/src/utils/__tests__/openai-models.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:c6381a3e7d84bd7e269c54f569490f6c2a0b24436979ee220a3a479d7c250553
- verified: 2026-10-01T18:19:44.259Z
- typecheck common: exit 0
- typecheck sdk: exit 0
- typecheck cli: exit 0
- test common/src/providers/__tests__/validate-provider-registry-openai.test.ts: exit 0
- test sdk/src/impl/__tests__/model-provider-free-mode-openai.test.ts: exit 0
- test cli/src/utils/__tests__/provider-setup-openai.test.ts: exit 0
- test cli/src/utils/__tests__/openai-models.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Operator-reported failures (2026-10-01): ChatGPT Pro key
  "does not work" when loaded; `/provider` lacks openai; picker not
  alphabetical. Investigation (file:line cites in Evidence): the
  platform-key class has no consumer; the picker is insertion-ordered.
  Vendored comparison (openclaw: both lanes; hermes: separate
  `openai-api` + `openai-codex` providers, and its tests document
  api.openai.com requiring Responses for reasoning+tools) — the
  two-lane shape is the industry norm, but the implementation here
  follows OUR runbook, not theirs (operator directive: "we're not
  reaching for hermes parity, savant-code is an industry leader").
- **GREEN:** The one-entry recipe (Steps 1-6 above) with the
  `responses` type-widening as the single structural edit. Alternatives
  rejected: static catalog (roster staleness); `multi` + protocol map
  (duplicates every model id); OAuth-lane extension to accept `sk-`
  keys (wrong endpoint + wrong credential class — the Codex endpoint
  rejects platform keys); custom-provider workaround documented to the
  operator (a first-class provider must be first-class in the registry,
  per the runbook's own acceptance rule).
- **AUDIT (document-level):** every cited seam read this session —
  registry + both partitions (no openai), types.ts:20-21 (protocol
  union), model-factories.ts:33-58 + :92-118 (OAuth model + responses
  branch + resolveProtocol), model-provider.ts:59-77 (OAuth gate
  precedes loop), provider-key-store.ts (deriveSetupConfig + key
  persistence + activation), model-provider-commands.ts:83-100 (picker
  build, no sort), live-catalog.ts:34 + apinex.ts:65 (resolveKey
  pattern), validate.ts:139-224 (entry contract + map-dispatch
  enforcement), model-catalogs.ts (static path — not used here),
  chatgpt-oauth.ts (allowlist + env var), runbook 0-EOF (recipe +
  gates + acceptance rule). Gate shapes checked against the runbook's
  verification section and `scripts/validation-gates.ts` workspace list.
- **ADVERSARIAL:** Strongest refutation: "the OAuth lane already serves
  OpenAI models — adding a platform lane duplicates surface." Rebuttal:
  they serve different credential classes against different endpoints;
  the operator holds a platform key the tree cannot consume, and the
  two-lane shape is what openclaw AND hermes both run (independent
  convergence). Second: "'responses' type-widening is a schema escape
  hatch others will abuse." Rebuttal: it names a real protocol the
  factory already implements, the validator still enforces the full
  entry contract, and map-dispatch remains mandatory for MIXED rosters
  — a single-protocol Responses endpoint is exactly the no-map case.
  Third: "picker sort breaks the D9 customs-after-built-ins contract."
  Rebuttal: sort is applied within segments; segment order is
  preserved.
- **CHANGE DELTA:** 0% (initial authoring pass).

### Loop 2 — full Perfection Loop pass (operator-ordered, 2026-10-01)

- **RED (mechanical audit — every claim re-verified against the tree):**
  1. **`validate.ts` protocol allowlist — MISSED by Loop 1.**
     `common/src/providers/validate.ts:20-25` hard-codes
     `PROTOCOLS = Set(['openai','anthropic','openai-anthropic','multi'])`
     and `validate.ts:97-99` rejects any entry outside it. Step 1 as
     written would fail the validator suite. Step 1 gains: the Set gains
     `'responses'` (typed from `ProviderConfig['protocol']`, so the type
     widening and the Set must move together — one commit, or the suite
     goes red in between).
  2. **Bare-slug mis-dispatch — a real defect in the plan's coverage.**
     With OpenAI active, `activateProviderRouting` sets
     `INFERENCE_BASE_URL=https://api.openai.com/v1`; the Phase-4 bare-slug
     path then builds `createDefaultInferenceModel`
     (`sdk/src/impl/model-provider/default-inference.ts`) which hard-codes
     the **chat/completions wire format** (`OpenAICompatibleChatLanguageModel`)
     against that base URL. For reasoning models with tools, api.openai.com
     returns HTTP 400 on that path (the contract hermes' regression suite
     documents — `test_model_switch_openai_api_mode.py:5-9`). This is the
     exact mis-dispatch class FID-2026-0911-003 killed for anthropic
     entries; the bare-slug path needs the same protocol discipline.
     **New step 2b:** `createDefaultInferenceModel` gains an options
     `protocol` field; `getModelForRequest` passes the active provider's
     resolved protocol (`resolveProtocol(config, model)` — bare ids have
     no map entry, so the no-map path returns the entry protocol);
     `'responses'` constructs via `createOpenAI({ baseURL: inferenceBaseUrl,
     apiKey, fetch: retry-composed fetch }).responses(model)` mirroring
     `createProviderModel`'s existing responses branch. Every other
     provider's bare-slug behavior is byte-identical (`protocol` absent →
     current construction).
  3. **Catalog aggregation seam — MISSED by Loop 1.** Live wrappers feed
     `fetchGatewayModels` (`cli/src/utils/openrouter-models/gateway.ts:139-260`):
     the allSettled fan-out, the fulfilled/cache fallback ladder, the
     combined sort, and `__resetOpenRouterModelsCacheForTest` are all
     per-provider explicit. Step 3 gains: `fetchOpenAiModels` joins the
     fan-out + ladder + combined list + test reset, and the file's source
     roster comment gains the OpenAI line.
- **GREEN (corrections folded into Steps 1-5 below):** the three
  additions above; gates gain the bare-slug dispatch assertions (inside
  the sdk suite) and the existing
  `cli/src/utils/__tests__/openrouter-models-gateway-providers.test.ts`
  gains the OpenAI catalog pin (declared as a fourth test gate).
- **AUDIT (tool-output):** `validate.ts` read 0-EOF (allowlist at :20-25,
  kind/protocol/idTransform checks at :96-118, envVar uniqueness at
  :68-93, map-dispatch enforcement at :195-219 — the 'responses' entry
  is NOT map-dispatched so :195 does not apply, catalog-prefix checks do
  not apply to live sources); `live-catalog.ts` read 0-EOF (resolveKey
  seam :34-38, Bearer only when a key resolves, never-throws degrade);
  `apinex.ts` read 0-EOF (the wrapper template: deriveLiveCatalogUrl
  from the registry — OpenAI's wrapper uses the same derive, so the
  URL lives in ONE place); `gateway.ts` fan-out read 0-EOF;
  `default-inference.ts` read 0-EOF (chat-format hard-code confirmed);
  `MODEL_CATALOGS` (static path — unused here); runbook verification
  section re-checked: `generate:provider-docs:check` is already a
  declared gate; `ModelProvider` union confirmed derived
  (`types.ts:14`, `ProviderId | (string & {})`) — no union edit needed
  (Loop 1 listed no edit; confirmed none exists).
- **ADVERSARIAL (round 2):** (1) "`/v1/models` is public — why resolveKey?"
  — Bearer with the platform key returns the account-visible roster and
  works keyless; the resolver is optional by the seam's own contract;
  wiring it costs one line and matches Nous/apinex. (2) "The bare-slug
  protocol branch could regress Ollama/other actives" — `protocol` is
  passed only from `getModelForRequest`'s Phase-4 path, which resolves it
  from the ACTIVE registry entry; every existing entry resolves 'openai'
  or 'anthropic' there, hitting the unchanged construction; the sdk
  suite pins a non-OpenAI active provider byte-identically (existing
  free-mode suites keep passing — that IS the regression gate).
  (3) "`order: 0` groups OpenAI with OpenRouter in /model" — correct and
  intended (frontier tier); the /provider picker sort fix makes numeric
  order irrelevant there. (4) "Azure/OpenAI-org endpoints?" — YAGNI: a
  separate future entry (`azure-openai`) when needed; this entry is
  api.openai.com only.
- **CHANGE DELTA:** +3 step additions, +1 gate, +4 missed-questions —
  well under the 10% ceiling; no Loop-1 section rewritten.

### Missed Questions

1. **Does the Codex OAuth lane still win when both credentials exist?**
   Yes — the OAuth gate precedes the registry loop for allowlisted
   models (`model-provider.ts:59-77`); the platform lane serves
   non-allowlisted `openai/*` ids. `skipChatGptOAuth` forces the
   platform lane. Documented in the entry's guidance text.
2. **Does `applyPersistedProviderApiKeys` need edits?** No — it iterates
   the effective setup config; OpenAI appears automatically.
3. **Bare-slug `gpt-5.x` ids?** The Phase-4 path already routes them to
   the active provider with its own key; with OpenAI active they hit
   `/v1/responses`. The `responses` protocol return makes the factory
   dispatch correct — this was previously impossible for any entry.
4. **Does the live `/model` picker include OpenAI?** It derives from the
   provider's catalog entry in the picker grouping; the live wrapper
   (step 3) supplies the roster. Catalog degrade → free-text exact ids,
   per the established contract.
5. **Windows key storage?** Unchanged: `credentials.json` 0600-inverting
   to the user config dir, shell env takes precedence (existing store).
6. **Why `order: 0`?** Frontier-tier grouping alongside openrouter (0)
   and tokenrouter (1); the picker sort fix makes numeric order
   irrelevant in `/provider`, but `/model` grouping stays meaningful.
7. **(Loop 2) Does the validator need changes beyond the type?** Yes —
   `validate.ts:20-25` hard-codes the protocol allowlist Set; folded
   into step 1 (type + Set move in one change set).
8. **(Loop 2) Can a bare-slug request hit api.openai.com with the wrong
   wire format?** With the Loop-1 plan, yes — the default-inference path
   hard-codes chat/completions. Folded into step 2b
   (`options.protocol` + `resolveProtocol` at the Phase-4 call site);
   hermes' regression suite documents the 400 that motivates it
   (`test_model_switch_openai_api_mode.py:5-9`).
9. **(Loop 2) How does the live catalog reach the /model picker?**
   Through `fetchGatewayModels`' explicit fan-out — a wrapper alone is
   never consumed. Folded into step 3 (fan-out + cache ladder + combined
   list + test reset + roster comment).
10. **(Loop 2) Is `/v1/models` Bearer'd?** Optional by the seam's
    contract — OpenAI serves it keyless, but the account-visible roster
    needs the key. `resolveKey` wired (one line, Nous/apinex pattern).
11. **(Loop 2) Does the OAuth lane or any existing provider change
    behavior?** No — the OAuth gate precedes the registry loop
    (`model-provider.ts:59-77`, untouched); every existing entry's
    bare-slug construction is byte-identical (`protocol` absent → the
    current chat-format model), pinned by the existing free-mode suites
    staying green.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** `f099ded8` — `feat(providers): add the OpenAI
      platform provider with Responses-API routing
      (FID-2026-1001-001)` (25 files, +929/−110), operator-authorized
      2026-10-01.
- [ ] **File:line ranges:**
      - `common/src/providers/types.ts:23-31` — `ProviderProtocol` gains
        `'responses'`; `:33-44` — `ProviderModelProtocol` unchanged
        (doc-comment cross-reference only)
      - `common/src/providers/validate.ts:23-29` — `PROTOCOLS` Set gains
        `'responses'` (no-map legality); map-dispatch enforcement for
        mixed rosters untouched
      - `common/src/providers/registry-partitioned-2.ts:15-44` — the
        `openai` entry (kind gateway, OPENAI_API_KEY,
        https://api.openai.com/v1, protocol 'responses', idTransform
        'strip', live catalog /v1/models, setupAvailable, domain,
        order 0, templated missing-key message with `/provider openai`)
      - `sdk/src/impl/model-provider/model-factories.ts:209-224` —
        exported `resolveEntryProtocol` (total no-map resolver, narrow
        return); `:238-256` — internal `resolveProtocol` delegating;
        responses/chat/gemini dispatch branches untouched
      - `sdk/src/impl/model-provider/default-inference.ts:60-68` —
        `options.protocol` field; `:87-100` — the responses early-return
        branch (`createOpenAI({ baseURL, apiKey, fetch:
        fetchWithRetryableNetworkErrors }).responses(model)`)
      - `sdk/src/impl/model-provider.ts:148-157` — Phase-4 bare-slug call
        passes `resolveEntryProtocol(activeProviderConfig)` gated on
        `protocolMap === undefined`
      - `cli/src/commands/defs/provider-picker-entries.ts:29-60` —
        extracted picker-row builder with label sort per segment
      - `cli/src/commands/defs/model-provider-commands.ts:79-88` — the
        `/provider` no-args handler consumes the builder
      - `cli/src/utils/openrouter-models/openai.ts:1-95` — platform
        live-catalog wrapper (apinex pattern)
      - `cli/src/utils/openrouter-models/gateway.ts:167` — fan-out leg;
        `:196-207` — ladder via the extracted helper; `:225` — combined
        list; `:250` — test reset
      - `cli/src/utils/openrouter-models/gateway-live-results.ts:32-110`
        — positional-contract ladder (300-line-cap split)
      - `common/src/providers/provider-exception-manifest.ts:121-129` —
        `openai` live-catalog exception (owner + evidence)
- [x] **Gate output:** receipt stamped below — all 8 declared gates
      exit 0 on the final tree (2026-10-01): typecheck common / sdk /
      cli 0 errors; validate-provider-registry-openai 3 pass / 0 fail;
      model-provider-free-mode-openai 6 pass / 0 fail;
      provider-setup-openai 4 pass / 0 fail; openai-models 4 pass /
      0 fail; `quality: PASS (1498→1500 baselined files)`. Adjacent
      closure battery: root typecheck 13 legs; sdk 536/0; cli 3772/0;
      eslint `--max-warnings 0`; lint:md; validate:repository PASS
      (incl. the openai manifest exception);
      generate:provider-docs:check up to date. Live keyed probe
      (/v1/models + /v1/responses) remains operator-run.
- [x] **Reproducibility:** from a clean checkout of the committed tree:
      `bun install && bun run typecheck && (cd sdk && bun test src/) &&
      (cd cli && bun test src/) && bun run quality:report && bun x
      eslint . --max-warnings 0 && bun run lint:md && bun run
      validate:repository && bun run generate:provider-docs:check` —
      all exit 0 on the final tree (2026-10-01 run: typecheck 13 legs 0
      errors; sdk 536 pass / 0 fail incl. the 6-leg OpenAI lane suite;
      cli 3772 pass / 0 fail incl. the 4+4 new OpenAI legs; quality PASS
      (1500 baselined files); eslint/lint:md exit 0; validate:repository
      PASS incl. the openai manifest exception;
      generate:provider-docs:check up to date). Live keyed probe
      (/v1/models + /v1/responses) is operator-run at verification.
- [x] **Step statuses:** Steps 1–6 complete. Step 1 (registry + type +
      validator) done; Step 2 (sdk factories: resolveEntryProtocol +
      default-inference responses branch + bare-slug dispatch, with the
      verification-discovered `protocolMap === undefined` guard) done;
      Step 3 (picker sort + openai.ts wrapper + gateway fan-out wiring)
      done; Step 4 (generated docs + 9 hand-maintained doc surfaces +
      runbook addendum) done; Step 5 (four test suites, 17 new tests)
      done; Step 6 (evidence + receipt + changelog) this section.
      No step is deferred and none is dropped.

### Code Verification Evidence

> Implementation state (2026-10-01): all cited files exist on the
> working tree with the cited content; gates ran against this exact
> tree. Verification-discovered deltas vs the Loop-2 text: (1) the
> bare-slug protocol resolution is gated on `protocolMap === undefined`
> (a map-dispatched active provider would throw for a bare id —
> resolving there would regress legacy chat-format behavior the FID
> promises byte-identical); (2) `resolveProtocol` was de-exported — the
> export the plan imagined is the new total `resolveEntryProtocol`;
> (3) the provider-audit manifest gained the openai live-catalog
> exception the validator requires; (4) the plan's gateway-providers
> suite extension landed as the dedicated openai-models suite after the
> 300-line-cap split extracted `gateway-live-results.ts`.

## Resolution

- **Closed Date:** 2026-10-01 (commit `f099ded8`)
- **Fix Description:** OpenAI's platform becomes a first-class registry
  provider on a second credential lane — platform `sk-` keys route
  `openai/<id>` and (when OpenAI is active) bare slugs to
  api.openai.com over the Responses API, while the ChatGPT-subscription
  Codex OAuth lane keeps precedence for its allowlisted models (the
  OAuth gate is untouched). The single-protocol `responses` protocol is
  legal without a protocolMap (`resolveEntryProtocol`, the total no-map
  resolver); the bare-slug default-inference path dispatches on the
  active provider's resolved protocol instead of hard-coding
  chat/completions (map-dispatched active providers keep their legacy
  construction via the `protocolMap === undefined` guard); the
  `/provider` picker sorts by label within built-ins and customs
  segments with the add-row sentinel last; the live /v1/models roster
  joins the gateway catalog fan-out (wrapper + ladder + reset + audit
  manifest); generated provider docs plus nine hand-maintained doc
  surfaces and the provider runbook are updated.
- **Tests Added:**
  `common/src/providers/__tests__/validate-provider-registry-openai.test.ts`
  (3), `sdk/src/impl/__tests__/model-provider-free-mode-openai.test.ts`
  (6), `cli/src/utils/__tests__/provider-setup-openai.test.ts` (4),
  `cli/src/utils/__tests__/openai-models.test.ts` (4) — 17 new tests;
  two pre-existing OAuth-fallback legs in
  `model-provider-free-mode.test.ts` re-armed with the platform key
  (the openai entry now owns the `openai/` prefix in the registry loop).
- **Verification Evidence:** receipt stamped below (9 gates); full
  battery in Reproducibility — root typecheck 13 legs 0 errors, sdk
  536/0, cli 3772/0, quality PASS, eslint `--max-warnings 0`, lint:md,
  validate:repository PASS, generate:provider-docs:check up to date.
- **Archived:** yes — `dev/fids/archive/` (Auto-Archive rule; active
  queue empty).

## Lessons Learned

1. **Read the union, not the plan.** `resolveProtocol(config, model)`
   for a map-dispatched provider keys the map by the FULL prefixed id —
   a bare slug misses and throws. The Loop-2 text asserted the opposite
   ("bare ids have no map entry, so the no-map path returns the entry
   protocol"), and only a typecheck-flagged call site surfaced it. Gate
   bare-slug resolution on `protocolMap === undefined` and reach for the
   total resolver instead.
2. **Pre-existing test failures are design signals.** The two
   OAuth-fallback legs that broke were asserting the old world where no
   registry entry owned `openai/`; the fix (arm the platform key, keep
   the fall-through assertion) encodes the two-lane contract rather
   than weakening the test.
3. **The audit manifest is part of the surface.** A new live-catalog
   provider trips `validate:repository` (missing/unowned exception
   kinds) — add the manifest entry with owner + evidence in the same
   change set as the wrapper.
4. **Fan-out seams are positional.** The allSettled destructure must
   mirror the promise array exactly — the pre-existing
   cleanapis/custom naming swap proved ladder edits deserve a positional
   contract comment (now in `gateway-live-results.ts`).
