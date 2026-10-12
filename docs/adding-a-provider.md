# Adding a provider

The runbook for adding a built-in provider to the unified registry.

This document is written against the **live** enforcing modules. Where it
disagrees with `docs/archive/design/Adding New Providers.md` (the archived
runbook), **this document is the contract** — the archived file is a dated
record of a past contract, and `dev/LEARNINGS.md` →
`archived-runbook-is-claim-not-contract` is the standing rule that says so.

Every claim below names the module that enforces it. If a step here and the
code disagree, the code is right and this document is a bug: fix the document.

## The one-sentence version

Add one typed entry to `PROVIDER_REGISTRY`, register the exceptions its shape
*implies* in the manifest, declare how its model ids acquire a context window,
and wire a live-catalog wrapper if — and only if — its catalog is `live`.
Routing, the picker, credential readiness, favicons, ordering, and the generated
docs all derive.

## Before you start: three ways to add a provider

Adding a *built-in* provider is not always the right move. Pick deliberately:

| Path | Use when | Touches the registry? |
|---|---|---|
| `/provider add <host>` | A user-defined OpenAI-compatible endpoint. No code. | No — stored in settings as a custom provider |
| `bun run providers:harvest` | Discovering free-tier candidates (daily pipeline) | No — proposes, never auto-merges |
| **This document** | A provider the *product* ships: audited roster, curated catalog, documented contract | Yes |

Custom providers are a deliberately constrained subset
(`CustomProviderConfig` in `common/src/providers/types.ts`): gateway kind,
`openai` or `anthropic` protocol, `strip` id transform, no resolver, no
protocol map, and a `live` / `inline` / `none` catalog. They are parsed and
validated by `common/src/providers/custom-providers-parse.ts` and are
re-validated against the *same* `validateProviderRegistry` gate when merged
into the effective view (`common/src/providers/custom-providers.ts`). A built-in
provider gets none of those constraints.

If you only need a user's own endpoint, stop here — `/provider add` already
does it with no code.

## What the registry entry derives automatically

`PROVIDER_REGISTRY` is the single source of truth. These surfaces are
**derived**; hand-editing any of them is the drift this architecture exists to
prevent.

| Derived surface | Produced by |
|---|---|
| Routing prefix + credential resolution | `deriveValidProviderIds`, the SDK registry loop in `sdk/src/impl/model-provider.ts` |
| Model prefixes | `deriveAllowedModelPrefixes` (set union with org slugs, deduped) |
| Favicon / logo domains | `deriveProviderDomains`, `deriveLogoDomain` |
| Live catalog URL | `deriveLiveCatalogUrl` |
| Picker group ordering | `deriveProviderOrder` (unknown providers sort at 4) |
| Valid persisted provider ids | `deriveValidProviderIds` |
| `/provider` picker + readiness + extra credentials | `deriveSetupConfig` (carries `extraEnvVars`) |
| Generic request factory | `createProviderModel` in `sdk/src/impl/model-provider/model-factories.ts` |
| `.env.example` + `README.md` + `cli/release/README.md` tables | `bun run generate:provider-docs` |

Every function in `common/src/providers/derive.ts` takes the registry as its
**first argument** and never imports the singleton. That is deliberate: it is
what lets the test suites pass a fixture registry and assert derivation parity
without global mutation. Keep any new derivation shaped this way.

## The registry entry

`PROVIDER_REGISTRY` is composed in `common/src/providers/registry.ts` from an
inline object plus spreads of `registry-partitioned.ts` and
`registry-partitioned-2.ts` (the 300-line file cap forced those splits). Each
partition is `as const satisfies Record<string, ProviderConfig>`, so a missing
field or a typo is a **compile error**, not a runtime surprise.

**Where to put a new entry:** if `registry-partitioned-2.ts` has room under 300
lines, put it there; otherwise create the next partition and spread it. Do not
grow a partition past the cap — the quality gate is zero-tolerance.

The complete field set, from `ProviderConfig` in
`common/src/providers/types.ts`:

```ts
myprovider: {
  // MUST equal the object key — validateProviderRegistry enforces this.
  id: 'myprovider',
  label: 'My Provider',
  kind: 'gateway',              // 'gateway' | 'local' | 'env-only'
  credentials: {
    envVar: 'MYPROVIDER_API_KEY',
    // resolver: 'openrouter'   — master-key exchange chain
    // extra: [{ envVar, label, missingMessage? }]  — second credential
    // missingKeyMessage        — only when the canonical wording differs
  },
  // API ROOT, not the endpoint. The protocol layer appends
  // /chat/completions | /messages | /responses. May embed {ENV_VAR}
  // placeholders resolved from credentials.extra (Cloudflare's account id
  // is mid-path).
  baseUrl: 'https://api.myprovider.example/v1',
  protocol: 'openai',           // 'openai' | 'anthropic' | 'responses'
                                 //   | 'openai-anthropic' | 'multi'
  idTransform: 'strip',         // 'strip' | 'keep' | 'cf-rewrite'
  // catalog: ...                // see "Choose a catalog source"
  // quota: { url, valuePath, unit?, note, auth?, limitPath?, resetPath? }
  //                                 — only where the vendor documents it
  setupAvailable: true,         // appears in the /provider picker
  domain: 'myprovider.example', // favicon; omit for providers with no logo
  order: 4,                     // picker group; unknown sorts at 4
}
```

Field semantics worth stating precisely:

- **`idTransform`** — `strip` removes the internal `{provider}/` routing prefix
  before the request. `keep` sends the id unchanged (only `openrouter/`, where
  the prefix is part of the real slug). `cf-rewrite` strips `cloudflare/` and
  prepends `@cf/`.
- **`baseUrl`** is the API **root**. Supplying a full endpoint here produces a
  doubled path segment.
- **`quota`** is optional and data-only (FID-2026-0919-026): the request path
  never reads it — the health report renders it and a quota-class refusal
  quotes its `note`. Declare it **only** where the vendor documents such an
  endpoint; `provider-contract-pins.test.ts` asserts that no provider declares a
  quota endpoint without one.
- **`missingKeyMessage`** exists because the default is
  `` `${label} API key not set. Set ${envVar} environment variable.` `` and
  several providers legitimately differ (short names, "API token" wording,
  resolver chains, a `/provider <id>` hint). Only override when the canonical
  form is wrong.

### Hard rules the validator enforces

`validateProviderRegistry` in `common/src/providers/validate.ts` is the gate.
It runs over the shipped registry in the test suite, so every one of these is a
**test failure**, not a runtime surprise:

| Rule | Enforced by |
|---|---|
| `config.id` must equal the registry key | `config.id !== key` check |
| `kind`, `protocol`, `idTransform`, `catalog.source` must be in their allowed sets | `KINDS` / `PROTOCOLS` / `ID_TRANSFORMS` / `CATALOG_SOURCES` |
| `order` must be a non-negative integer | `Number.isInteger` check |
| `baseUrl` (and a live `catalog.url`) must parse as http(s) | `parseRegistryUrl`, which tolerates `{ENV_VAR}` |
| A `gateway` **must** declare `credentials.envVar` | credential invariants |
| A `local` **must not** declare `credentials.envVar` | credential invariants |
| `setupAvailable` (non-local) **must** have an `envVar` — the picker needs one | credential invariants |
| Every env var must be **unique** across entries — unless two entries share the *same named* resolver, which is intentional credential sharing | `claimEnvVar` |
| Every static/inline catalog model id must start with `{id}/` | prefix invariants |
| A `multi` / `openai-anthropic` entry **must** declare a `protocolMap` | map-dispatch invariants |
| Every protocol-map key must start with `{id}/` | map-dispatch invariants |
| Every static catalog model must resolve in the protocol map | `resolveMappedModelProtocol` — routing fails closed otherwise |

The prefix invariants are the ones people hit: a model id in a static catalog
without the routing prefix makes the picker and the router disagree with the
registry.

### Also enforced elsewhere

Two more exported checks in `common/src/providers/audit.ts` run in the suite:

- **`validateProviderUrlOwnership`** — no two providers may own the same
  `baseUrl` or the same live catalog `url`. A shared root is how two entries
  silently become one.
- **`validateProviderSurfaceSnapshot`** — the materialized surfaces (valid
  provider ids, setup ids, routed ids, documented ids) must agree with the
  registry exactly: no duplicates, no unknown ids, no missing ids, no stale ids.
  `kind: 'local'` is expected to be absent from the routed surface.

## Choose a catalog source

### `source: 'static'`

A checked-in, audited model set.

1. Add the model map to `common/src/constants/model-config.ts` (or its
   partitions). **Every id carries the `{provider}/` prefix** — e.g.
   `'myprovider/acme/model-1'`.
2. Register it in `common/src/providers/model-catalogs.ts` as
   `MODEL_CATALOGS = { ..., myprovider: myproviderModels }`. `modelsRef` is
   typed as `keyof typeof MODEL_CATALOGS`, so this reference is compile-checked.
3. Reference it: `catalog: { source: 'static', modelsRef: 'myprovider' }`.
4. Friendly display names: add a `X_NAMES` map in
   `cli/src/utils/openrouter-models/static-catalogs.ts` (the TokenHarbor
   pattern).

The CLI picker derives the catalog from `MODEL_CATALOGS`.

### `source: 'live'`

The provider exposes a model-list API. **This is the only path with real
manual wiring.**

```ts
catalog: { source: 'live', url: 'https://api.myprovider.example/v1/models' }
```

Then four things, all mandatory:

1. **A wrapper module** at
   `cli/src/utils/openrouter-models/myprovider.ts`, built on
   `createLiveCatalogFetcher`. Get the URL through `deriveLiveCatalogUrl` so
   there is never a second copy of it:

   ```ts
   import { deriveLiveCatalogUrl } from '@savant-code/common/providers/derive'
   import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'

   import { resolveProviderApiKey } from '../provider-credentials'

   import { createLiveCatalogFetcher } from './live-catalog'

   const url = deriveLiveCatalogUrl(PROVIDER_REGISTRY, 'myprovider')
   if (!url) throw new Error('myprovider catalog url missing from the registry')

   const fetcher = createLiveCatalogFetcher<MyProviderModelsResponse>({
     url,
     logLabel: 'MyProvider',
     parse: (json) => normalize(json),
     // Only for an AUTHENTICATED catalog. Never read `process.env` (and never
     // `.env.local`) here: `resolveProviderApiKey(providerId)` is the seam that
     // ALSO sees a key entered through `/provider` (the registry-driven
     // env-var-then-stored-key precedence, FID-2026-1006-001), and it never
     // logs key material. Reading the env var directly silently 401s every
     // user who configured the provider through the wizard — the drift this
     // runbook carried until 2026-10-12.
     resolveKey: () => resolveProviderApiKey('myprovider'),
   })

   export const fetchMyProviderModels = fetcher.fetchModels
   export const getCachedMyProviderModels = fetcher.getCachedModels
   export const __resetMyProviderCacheForTest = fetcher.resetForTest
   ```

   `createLiveCatalogFetcher` options are exactly: `url`, `logLabel`, `parse`,
   `resolveKey`. It gives you bounded timeout (10s), in-flight dedup, TTL
   caching, and degrade-to-cache-or-empty semantics for free. It never throws.

   **Probe the response shape before writing the parser.** Reuse an existing
   parser only for a *measured* compatible schema — the archived runbook's
   "reuse parsers" advice is exactly how the Vercel catalog was mis-parsed
   (it publishes `context_window`/`max_tokens` and a numeric `created`, not
   `context_length`/`max_completion_tokens` and a string `created`).

2. **Wire the fan-out** in `cli/src/utils/openrouter-models/gateway.ts`:
   add the fetch to the `Promise.allSettled` array, and add the cache reset to
   `__resetOpenRouterModelsCacheForTest`.

3. **Extend the settled ladder** in
   `cli/src/utils/openrouter-models/gateway-live-results.ts`. This module is a
   **positional contract**: `restResults` is destructured by index, in the same
   order the fetchers appear in `gateway.ts`. Adding a new entry in the middle
   shifts every subsequent slot — the catalogs still populate, but under the
   wrong provider's name, and no test fails. If your provider's catalog is
   live, it also needs a `getCachedXModels` degrade path here.

   **Safe rule: insert immediately before the custom-catalogs tail**, which
   must stay last. Custom catalogs merge after the built-ins by design.

4. **Register a `live-catalog` exception owner** in
   `common/src/providers/provider-exception-manifest.ts` (next section).

### `source: 'inline'`

A user-supplied model list, carried in the config itself (FID-2026-0910-004
D3). Keys are full model ids carrying the routing prefix. This exists for
custom providers; a built-in provider should prefer `static` or `live`.

### `source: 'none'`

No catalog section in the picker. The local-runtime template (Ollama).

## Register the exceptions your entry implies

This is the step most often missed, and it is **not free-form**. The set of
exception kinds your provider needs is *derived from its own config shape* by
`requiredExceptionKinds` in `common/src/providers/audit.ts`:

| Your entry has… | Required exception kind |
|---|---|
| `credentials.resolver` defined | `credential-resolver` |
| `catalog.source === 'live'` | `live-catalog` |
| `protocol === 'openai-anthropic'` | `dual-protocol` |
| `protocol === 'multi'` | `multi-protocol` |
| `credentials.extra` non-empty | `extra-credentials` |
| `idTransform === 'cf-rewrite'` | `id-rewrite` |
| `kind === 'local'` | `local-runtime` |
| `setupAvailable === false` | `setup-exclusion` |

Add one entry to `PROVIDER_EXCEPTION_MANIFEST` in
`common/src/providers/provider-exception-manifest.ts`:

```ts
{
  providerId: 'myprovider',
  kinds: ['live-catalog'],
  owner: 'cli/src/utils/openrouter-models/myprovider.ts',
  evidence: [
    'cli/src/utils/openrouter-models/myprovider.ts',
    'cli/src/utils/openrouter-models/gateway.ts',
  ],
},
```

`validateProviderAudit` fails closed on all of these, in both directions:

- A provider with required kinds and **no** manifest entry → `has unowned
  provider exceptions`.
- A **missing** required kind → `is missing required exception kind`.
- A **stale** kind your config does not imply → `declares stale exception kind`.
- A manifest entry for an id **not in the registry** → flagged.
- A **duplicate** entry for one provider → flagged. Consolidate into one.
- An empty `owner`, or an owner/evidence path that **does not exist on disk**
  → flagged.

`owner` names the file that owns the exceptional behavior. `evidence` is every
path that demonstrates it. Both are existence-checked against the real tree, so
a typo here is a test failure with the exact path named.

## Declare the context-window coverage

**This gate was added on 2026-10-04 (FID-2026-1004-002) and is fail-closed.**
`cli/src/utils/openrouter-models/__tests__/window-coverage-register.test.ts`
asserts that **every** provider in `PROVIDER_REGISTRY` has an entry in
`WINDOW_COVERAGE_REGISTER` (`common/src/constants/window-coverage-register.ts`).
A new provider without one fails the suite. The same test asserts there are no
stale entries for providers no longer in the registry.

Pick a disposition honestly — the register is what a future census is compared
against:

| Disposition | Meaning |
|---|---|
| `table-section` | The gateway publishes no window fields; a fallback-table section is the source of truth |
| `runtime-published` | The live catalog carries `context_length` per id; rows self-correct at runtime |
| `runtime-partial` | Some live rows publish windows; the silent gap subset is registered |
| `no-runtime-rows` | Zero rows observed (usually key-gated or account-scoped) — **not** "dead" |
| `local` | Local daemon; no gateway catalog |

Two further assertions ride on the same test: a `table-section` provider must
have fallback-table rows, and a `no-runtime-rows` provider must have **none**.
The `note` field carries the measurement that justifies the choice — state the
observed counts and the date you probed.

## Mixed protocols

If some models speak `/v1/chat/completions` and others `/v1/messages`
(CommandCode, TokenRouter, xKiro):

1. Add a `Record<string, ProviderModelProtocol>` map in
   `common/src/constants/model-config/provider-protocols.ts` and register it in
   `PROVIDER_PROTOCOL_MAPS`.
2. Extend the `ProviderProtocolMap` union in `common/src/providers/types.ts`
   with the new key, and re-export it through the model-config barrels.
3. Map keys carry the **full provider prefix**.
4. Set `protocol: 'openai-anthropic'` (dual) or `'multi'` (three or more
   dialects), plus the named `protocolMap` on the registry entry.
5. Register the `dual-protocol` / `multi-protocol` exception kind.

`resolveMappedModelProtocol` resolves an exact id first, then the **longest**
declared terminal `/*` prefix. That is how xKiro declares
`xkiro/anthropic/*` → Messages while `xkiro/*` stays on chat. Providers without
prefix rules keep exact-map unknown-id rejection — never add a default protocol
implicitly, and never derive endpoint restrictions from model names.

A **single-protocol `responses`** entry (the OpenAI platform provider,
FID-2026-1001-001) needs no map at all: `resolveEntryProtocol`
(`sdk/src/impl/model-provider/model-factories.ts`) returns the entry's own
protocol, and the generic factory's `responses` branch serves it via a
`createOpenAI(...)` client built from the registry `baseUrl`. Map dispatch
remains mandatory for *mixed* rosters — a bare `responses` protocol on a
provider that also speaks chat/completions or Gemini per model is a routing
defect.

## Regenerate the generated surfaces

```bash
bun run generate:provider-docs
```

This rewrites the `.env.example` gateway section and the provider tables in
`README.md` and `cli/release/README.md`, all from the registry.

The same script runs a second, separate check:
`handSurfaceDrift()` in `scripts/provider-docs-drift.ts` asserts your provider
appears in every **hand-maintained** surface — the root README's provider-flexibility
bullet, quick-start command list, dispatch prefix list, env-var reference, the
dotenv release template, and the Chinese (`README.zh-CN.md`) mirrors. Each miss
names the file, the surface, and the provider id.

```bash
bun run generate:provider-docs:check   # CI's drift guard
```

Update `docs/providers.md` (the human-facing provider reference) by hand as
well; it is not generated.

## Verification

```bash
# 1. The registry gates (this is where a malformed entry fails first)
cd common && bun test src/providers/__tests__/ && cd ..

# 2. The CLI catalog seams
cd cli && bun test src/utils/openrouter-models/__tests__/ \
  src/utils/__tests__/provider-setup.test.ts \
  src/utils/__tests__/openrouter-models.test.ts && cd ..

# 3. The SDK routing leg
cd sdk && bun test src/impl/__tests__/model-provider-free-mode.test.ts && cd ..

# 4. Docs drift
bun run generate:provider-docs:check

# 5. Typecheck every affected workspace
bun run --cwd=common typecheck && bun run --cwd=sdk typecheck \
  && bun run --cwd=packages/agent-runtime typecheck && bun run --cwd=cli typecheck

# 6. Lint
bun x eslint . --max-warnings 0
bun run lint:md
bunx prettier --check .
```

### What "wired" actually means

A provider is wired when an id of the form `myprovider/<id>` round-trips the
**whole** chain:

```text
catalog fetch → /model selection → persisted activeProvider
  → SDK registry loop → generic factory → correct base URL + auth header
  → a real completion from the vendor
```

**Compilation is not verification.** A green typecheck proves the entry is
well-shaped; it proves nothing about whether the vendor answers. Assert the
final leg with a real request against the provider, and record the observed
status code and model count in the registry comment or the exception note.

Two claims that are routinely overstated, both with a lesson behind them:

- **"The catalog lists N models"** does not mean inference works. Nous served a
  424-row catalog while `/v1/chat/completions`, `/v1/responses`, and
  `/v1/completions` all returned 404. Treat catalog reachability and inference
  reachability as two separate acceptance checks.
- **"The endpoint is keyless"** is not the same as "the catalog populates." An
  authenticated catalog probed keyless returns 401 and yields zero rows — that
  is a `no-runtime-rows` provider, not a dead one.

### Tests to add

Three small additive files, following existing patterns:

- `common/src/providers/__tests__/validate-provider-registry.test.ts` — the
  fixture entry is the `fixture` / `FIXTURE_API_KEY` base provider defined in
  that file's `base()` helper. Extend it to assert that your entry's
  derivation (routing, setup, picker grouping, guidance) follows from the
  registry alone, without touching another file.
- `sdk/src/impl/__tests__/model-provider-free-mode.test.ts` — key present routes
  to the generic factory; key missing throws the templated error.
- `cli/src/utils/__tests__/provider-setup.test.ts` — the `saveProviderApiKey()`
  contract for the new provider.

If your provider is live-catalog, add the reset seam to the existing
`__resetOpenRouterModelsCacheForTest` path and pin the positional-ladder
contract — a test that asserts your catalog resolves under *your* provider name
catches the silent slot-shift described above.

## Do not hand-edit the derived surfaces

Editing any of these by hand reintroduces the drift the registry architecture
exists to kill:

- `ALLOWED_MODEL_PREFIXES`, `providerDomains`, `getLogoForModel`
- `PROVIDER_SETUP_CONFIG`
- The `ModelProvider` union and `settings.validProviders`
- `getProviderOrder()`
- `getModelForRequest()` per-provider SDK branches — one registry loop; nothing
  to add
- Per-provider SDK factories — the generic `createProviderModel()` reads
  `baseUrl` / `protocol` / `idTransform` / `protocolMap` off the entry
- The `.env.example` gateway vars and the README provider tables — generated

## Known asymmetries — decide deliberately, do not inherit

- **OpenRouter attribution headers and structured outputs** are still gated on
  `config.id === 'openrouter'` inside the generic factory. A candidate for a
  future registry field, not a per-provider factory.
- **Cloudflare's two credentials** are carried by `credentials.extra`; both
  participate in readiness checks and both are prompted by the wizard.
- **The picker `order: 4` tie** is intentional — several providers sort last,
  replicating the historical default.
- **Bare slugs** (e.g. `anthropic/claude-sonnet-4.5`) route to the active
  provider's gateway, set via `/provider`, using that provider's own key.

## Related documents

- `docs/providers.md` — the user-facing provider and model reference
- `docs/archive/design/Adding New Providers.md` — the archived runbook
  (superseded; historical record)
- `dev/LEARNINGS.md` → `archived-runbook-is-claim-not-contract` — why this
  document re-grounds every claim in code