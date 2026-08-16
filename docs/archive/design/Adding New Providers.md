# Adding a New LLM Provider

**One registry entry + a catalog reference. Everything else derives.**

This is the entire runbook. Since FID-2026-0809-001, every provider surface
(routing, credentials, `/provider` setup, picker sections, logos, ordering,
key-readiness guidance, env reference, release README) derives from one typed,
data-only registry in `common`. Adding a provider is no longer a 23-step
checklist across six files — it is one entry plus (for cataloged providers) one
model map, then regenerate the docs.

## How the system is organized

| Source | Location | Role |
|--------|----------|------|
| `PROVIDER_REGISTRY` | `common/src/providers/registry.ts` | **The single source of truth** — one typed entry per provider |
| `MODEL_CATALOGS` | `common/src/providers/model-catalogs.ts` | Static model maps (typed keys referenced by registry entries) |
| Protocol maps | `common/src/constants/model-config.ts` | Per-model wire protocol for dual-protocol providers |
| Derivation | `common/src/providers/derive.ts` | Pure `derive*` functions over an injected registry |
| Validation | `common/src/providers/validate.ts` + `__tests__/validate-provider-registry.test.ts` | Structural checks + derivation parity (the drift killer) |
| Docs generator | `scripts/generate-provider-reference.ts` | Renders `.env.example` gateway section + `cli/release/README.md` provider table |

**What the registry entry automatically derives** (do not hand-edit any of these):

| Surface | Consumer |
|---------|----------|
| Routing prefix + key resolution | `getModelForRequest()` SDK loop (`sdk/src/impl/model-provider.ts`) — one ordered loop, no branches to add |
| Generic factory behavior (base URL, protocol, id transform) | `createProviderModel()` (`sdk/src/impl/model-provider/model-factories.ts`) |
| `/provider` picker + key persistence + readiness guidance | `cli/src/utils/provider-setup.ts` (`deriveSetupConfig`, `getMissingProviderSetup`) |
| `settings.validProviders` + `activeProvider` validation | `cli/src/utils/settings.ts` (`deriveValidProviderIds`) |
| `ModelProvider` union | `cli/src/utils/openrouter-models/types.ts` |
| `ALLOWED_MODEL_PREFIXES` | `common/src/constants/model-config.ts` (`deriveAllowedModelPrefixes`) |
| `providerDomains` + picker favicon | `common/src/constants/model-config.ts` (`deriveProviderDomains`, `deriveLogoDomain`) |
| Picker group ordering | `getProviderOrder()` (`deriveProviderOrder`) |
| Key-readiness guidance text | `getProviderSetupGuidance()` — templated from the registry label + env var |
| `.env.example` + release README provider table | `bun run generate:provider-docs` |

## The one-entry recipe

### Step 1 — Add the registry entry

Edit `common/src/providers/registry.ts`. Every field is required and the object
is `satisfies Record<string, ProviderConfig>`, so a typo or missing field is a
compile error. The **OpenAI-compatible gateway** is the common case — TokenHarbor
is the canonical template:

```ts  tokenharbor: {
  id: 'tokenharbor',                       // routing prefix — must match the key
  label: 'TokenHarbor',                    // display label
  kind: 'gateway',                         // 'gateway' | 'local' | 'env-only'
  credentials: {
    envVar: 'TOKENHARBOR_API_KEY',         // primary API key env var
    // optional: resolver: 'openrouter'    // master-key exchange chain
    // optional: extra: [{ envVar, label, missingMessage? }]  // e.g. CLOUDFLARE_ACCOUNT_ID
    // optional: missingKeyMessage        // only when the canonical message differs
  },
  baseUrl: 'https://tokenharbor.ai/v1',    // API root; protocol layer appends the path
  protocol: 'openai',                      // 'openai' | 'anthropic' | 'openai-anthropic'
  idTransform: 'strip',                    // 'strip' | 'keep' | 'cf-rewrite'
  catalog: { source: 'static', modelsRef: 'tokenharbor' },  // see Step 2
  setupAvailable: true,                    // appears in /provider picker
  domain: 'tokenharbor.ai',                // favicon / logo
  order: 4,                                // picker group; unknown providers sort at 4
},
```

Field semantics:

- `idTransform` — `strip` removes the `{provider}/` routing prefix before the
  request; `keep` sends the id unchanged (only `openrouter/` — it is part of the
  real slug); `cf-rewrite` strips `cloudflare/` and prepends `@cf/`.
- `baseUrl` is the API **root**, not the endpoint — the factory appends
  `/chat/completions` (openai) or `/messages` (anthropic). It may contain
  `{ENV_VAR}` placeholders (Cloudflare's account id is mid-path), resolved from
  `credentials.extra`.
- `kind: 'local'` — no `envVar` (Ollama is the template; base URL is detected at
  startup, the registry holds the canonical default).
- `setupAvailable: false` — env-only provider: routed + keyed but absent from
  the `/provider` picker (Cloudflare is this today, by design).

### Step 2 — Add the model catalog

Pick the catalog source in the registry entry:

- **`source: 'static'`** — a known, checked-in model set. Add the map to
  `common/src/constants/model-config.ts` (ids must be prefixed, e.g.
  `'x/upstream/id'`), then register it in `common/src/providers/model-catalogs.ts`
  (`MODEL_CATALOGS = { ..., x: xModels }`) and reference it with
  `catalog: { source: 'static', modelsRef: 'x' }`. The CLI picker derives the
  catalog automatically; if you want friendly display names, add a `X_NAMES`
  map in `cli/src/utils/openrouter-models/static-catalogs.ts` (TokenHarbor
  pattern).
- **`source: 'live'`** — the provider exposes a model-list API (OpenRouter,
  NVIDIA, Nous Research). Put the endpoint in the entry:
  `catalog: { source: 'live', url: '…' }`. The generic fetcher
  (`cli/src/utils/openrouter-models/live-catalog.ts`) handles cache/TTL/degrade.
  If the catalog endpoint is authenticated, wire a provider-specific resolver
  such as Nous's `resolveKey: () => process.env.NOUS_API_KEY`; never read
  `.env.local` directly from a catalog wrapper.

### Nous Research direct-provider example

Nous is a standard OpenAI-compatible gateway when configured with a direct
`NOUS_API_KEY`:

```text
/provider nous
/health
/model nous/<exact-id-from-the-live-catalog>
```

The registry base URL is `https://inference-api.nousresearch.com/v1`; the
catalog is fetched from `/v1/models` with `Authorization: Bearer <key>`, and
`nous/` is an internal picker namespace removed before chat requests. Catalog
failure does not disable exact free-text model selection. Shell keys take
precedence over keys stored by the masked `/provider` flow.

This integration is direct API-key-only. Nous Portal browser OAuth, refresh
tokens, short-lived inference JWTs, and re-authentication are a separate
credential lifecycle and are not implemented by the direct provider entry.
The operator's current credential-safe probe authenticated `/v1/models`, but
sampled public inference requests returned HTTP 404 across `/v1/chat/completions`,
`/v1/responses`, and `/v1/completions`. Treat the catalog and inference contracts
as separate acceptance checks; do not claim end-to-end inference until Nous
confirms the public endpoint and credential lifecycle. The local Hermes API
server and subscription proxy documented by Nous are separate endpoints and are
not silently substituted here.

- **`source: 'none'`** — no catalog section in the picker (Ollama).

### Step 3 — Dual-protocol only: protocol map

If some models speak `/v1/chat/completions` and others `/v1/messages`
(OpenCode Go, CommandCode):

1. Add an `X_PROTOCOLS: Record<string, 'openai' | 'anthropic'>` in
   `common/src/constants/model-config.ts` — keyed by the **full prefixed id**.
2. Set `protocol: 'openai-anthropic'` and `protocolMap: 'X_PROTOCOLS'` on the
   registry entry.

The validator enforces that every catalog model appears in the protocol map —
routing fails closed otherwise.

### Step 4 — Regenerate the docs

```bash
bun run generate:provider-docs
```

This regenerates the `.env.example` gateway section and the release README
provider table from the registry. Run `bun run generate:provider-docs:check` in
CI — it fails when the docs drift from the registry.

### Step 5 — Add tests (additive, three small files)

- `common/src/providers/__tests__/validate-provider-registry.test.ts` — a
  fixture entry proving the one-entry claim: add `fixture/…` to a test registry
  and assert routing, setup, picker grouping, and guidance all derive without
  touching any other file (the existing `acme` fixture is the template).
- `sdk/src/impl/__tests__/model-provider-free-mode.test.ts` — key present routes
  to the generic factory; key missing throws the templated error.
- `cli/src/utils/__tests__/provider-setup.test.ts` — `saveProviderApiKey()`
  contract for the new provider.

## What you do NOT touch anymore

Everything below is derived from the registry. Hand-editing these is the
drift this FID exists to kill:

- `ALLOWED_MODEL_PREFIXES`, `providerDomains`, `getLogoForModel` — derived.
- `PROVIDER_SETUP_CONFIG` — derived (`deriveSetupConfig`).
- `ModelProvider` union + `settings.validProviders` — derived.
- `getProviderOrder()` — derived (`deriveProviderOrder`).
- `getModelForRequest()` SDK branches — one registry loop; nothing to add.
- SDK per-provider factories — the generic `createProviderModel()` reads
  `baseUrl`/`protocol`/`idTransform`/`protocolMap` from the entry.
- CLI static catalogs — derived from `MODEL_CATALOGS` (Phase 3).
- `.env.example` gateway vars + release README table — generated.

## Known asymmetries (decide deliberately, don't inherit)

- **OpenRouter attribution headers + structured outputs** are still gated on
  `config.id === 'openrouter'` in the generic factory — a candidate for a future
  registry field, not a per-provider factory.
- **Cloudflare is env-only by design** (`setupAvailable: false`): routed and
  keyed, but absent from the `/provider` picker (needs two credentials).
- **Picker order tie at 4** is intentional: tokenharbor/commandcode/ollama/cloudflare
  all sort last, replicating the historical `default: 4`.
- **Bare slugs** (e.g. `anthropic/claude-sonnet-4.5`) route to the active
  provider's gateway (set via `/provider`) with that provider's own key.

## Verification (hard gates)

```bash
# Typecheck the four affected workspaces
cd common && bun run typecheck && cd ../sdk && bun run typecheck && \
cd ../packages/agent-runtime && bun run typecheck && cd ../../cli && bun run typecheck

# Targeted suites
cd common && bun test src/providers/__tests__/ && cd ../sdk && bun test src/impl/__tests__/model-provider-free-mode.test.ts && \
cd ../cli && bun test src/utils/__tests__/provider-setup.test.ts src/utils/__tests__/openrouter-models.test.ts

# Doc drift guard + full gates
bun run generate:provider-docs:check
bun x eslint . --max-warnings 0
bun run lint:md
```

A provider is "wired" when a model id of the form `x/<id>` round-trips the whole
chain: catalog → `/model` selection → persisted `activeProvider` → SDK registry
loop → generic factory → correct base URL and auth header. Compilation alone is
not verification; the validation suite plus the end-to-end routing tests are.

## Reference FIDs

| FID | Topic |
|-----|-------|
| FID-2026-0809-001 | Unified provider registry — this runbook's source (Phases 1-5) |
| FID-2026-0807-025 | TokenHarbor provider integration — the canonical full-provider example |
| FID-2026-0806-010 | OpenRouter-first boot default (`openrouter/` slug preserved) |
| FID-2026-0804-001 | Provider key management — CLI/SDK credential precedence contract |
