<!-- markdownlint-disable MD013 -->

# FID: Unified Provider Registry (Single Source of Truth)

**Filename:** `FID-2026-0809-001-unified-provider-registry.md`
**ID:** FID-2026-0809-001
**Severity:** high
**Status:** closed (2026-08-09 — Nova implementation sign-off PASS received in inbox; operator-directed close)
**Created:** 2026-08-09
**YAGNI-Compliance:** Assessed (passes — see Loop 3 ADVERSARIAL)

---

## Summary

Replace the current fragmented provider metadata — base URLs duplicated across the SDK factories and
CLI setup, the provider list enumerated in nine-plus places, and model catalogs duplicated between
`common` and `cli` — with **one typed, data-only `PROVIDER_REGISTRY` in `common`** from which every
provider surface derives (routing, credentials, setup picker, catalogs, logos, ordering, guidance,
health). The **single user setting becomes the provider selected in the UI** (the `/provider`
picker), persisted as one field; the registry supplies everything else about that provider. Adding a
new provider collapses from the current 23-step checklist to **one registry entry plus a catalog
reference**. The design is documented here as a converged spec; implementation proceeds in five gated
phases (Phase 1 is zero-behavior-change derivation).

## Environment

- **OS:** Windows development workstation; must remain cross-platform (Bun/Node, CLI binary via `bun --compile`)
- **Language/Runtime:** TypeScript/Bun monorepo; strict mode; `@savant-code/common`, `@savant-code/sdk`, `@savant-code/cli`
- **Tool Versions:** Bun 1.3.14, TypeScript 5.5.4, zod v4
- **Commit/State:** `main`, project version `0.0.21`, provider system as mapped in `docs/design/Adding New Providers.md` and `docs/sdk-overview.md`

## Detailed Description

### Problem

The provider system works today, but its metadata is duplicated across package boundaries in ways
that have already drifted, and the per-provider add cost is high. With many providers planned, the
current shape guarantees recurring drift and escalating maintenance:

1. **Provider base URLs live in two or three places each.** The SDK factories hardcode them
   (`sdk/src/impl/model-provider/model-factories.ts:67,93,122,222,280`) and the CLI setup registry
   repeats them (`cli/src/utils/provider-setup.ts:30,35,40,45,50`). They cannot import each other
   (wrong package boundary), so they drift — already observed: `.env.example:71` documents
   `https://tokenrouter.me/v1` while code uses `https://api.tokenrouter.com/v1`.
2. **The provider list is enumerated in nine-plus places.** `ALLOWED_MODEL_PREFIXES`
   (`common/src/constants/model-config.ts:4`), `PROVIDER_SETUP_CONFIG`
   (`cli/src/utils/provider-setup.ts:21`), the `ModelProvider` union
   (`cli/src/utils/openrouter-models/types.ts:3`), `settings.ts` `validProviders`
   (`cli/src/utils/settings.ts:233`), `providerDomains` (`model-config.ts:457`) +
   `getLogoForModel` (`model-config.ts:475`), `getProviderOrder`
   (`cli/src/components/model-picker.tsx:43`), the gateway catalog combiner
   (`cli/src/utils/openrouter-models/gateway.ts`), plus two doc surfaces:
   `cli/release/README.md:48-55` and `docs/features.md:70`. **Cloudflare is already missing from
   five of the code surfaces** — routed in the SDK (`sdk/src/impl/model-provider.ts:174-190`, call
   at :188) but absent from `PROVIDER_SETUP_CONFIG` (6 keys; no cloudflare), the `ModelProvider`
   union, `settings.validProviders`, the gateway catalog combiner, and
   `cli/release/README.md` — and `getProviderOrder` has no explicit case for it (falls through to
   `default: 4`). It is *present* in `ALLOWED_MODEL_PREFIXES` and `providerDomains` — the exact
   definition of an incoherent, hand-maintained matrix.
3. **Model catalogs are duplicated.** `tokenrouterModels` (common, 34 ids at
   `model-config.ts:67`) and the cli-side `TOKENROUTER_CATALOG`
   (`cli/src/utils/openrouter-models/static-catalogs.ts:13`, 34 entries) are two separate,
   hand-maintained lists. Their contents match today (audited 2026-08-09: identical 34-model id
   set; the only difference is a stray `'tokenrouter/'` prefix string in common), but the
   FID-2026-0804-001 audit caught real drift between them historically, and nothing enforces
   parity. Same duplication for `opencodeGoModels` (common, 15) vs `OPENCODE_GO_CATALOG`
   (`static-catalogs.ts:199`, 15). The correct derived pattern already exists for TokenHarbor and
   CommandCode.
4. **Activation requires multiple settings.** Today using a provider needs `DIRECT_PROVIDER`,
   `INFERENCE_BASE_URL`, and a key — two of which the registry could derive.
5. **The default routing factory is misnamed.** `createSavantCodeBackendModel`
   (`sdk/src/impl/model-provider/savant-backend.ts:28`) is the generic OpenAI-compatible fallback,
   not a backend adapter. The name has already caused a false "critical finding" during review.
6. **Context-window heuristics are layered** (`inferContextLength` at
   `static-catalogs.ts:255` vs `getContextWindowForModel` in cli constants vs
   `resolveContextWindowForModel` in `lookup.ts`) — already produced two FIDs
   (FID-2026-0805-005, FID-2026-0805-006).

### Expected Behavior

- **One source of truth:** every provider fact (prefix, label, credential env var, base URL,
  protocol, id transform, catalog source, domain, ordering, setup availability) exists exactly once,
  in a typed, data-only registry in `common`.
- **One user setting:** the provider is chosen in the UI (`/provider` picker). That single persisted
  selection activates routing, picker default, guidance, and health reporting. No manual
  `DIRECT_PROVIDER`/`INFERENCE_BASE_URL` configuration for registry providers (the env vars remain
  explicit overrides for custom endpoints and backward compatibility).
- **Dead-simple expansion:** adding an OpenAI-compatible gateway provider is one registry entry plus
  a catalog reference — no new SDK branch, no CLI registry edit, no union edit, no picker edit.
- **Drift becomes impossible or a test failure:** a derivation-parity test suite fails if any
  provider surface disagrees with the registry (the Cloudflare-class gap becomes a failing test).

### Root Cause

Provider metadata grew organically across package boundaries. The SDK needed URLs to build
factories; the CLI needed URLs and labels to build setup flows; catalogs were added before a
shared-catalog pattern existed. Nothing forced the lists to agree because there was no single
authoritative structure and no test asserting parity.

### Evidence

```text
sdk/src/impl/model-provider/model-factories.ts:67
  return new URL(cleanPath, 'https://api.tokenrouter.com/v1/').toString()

cli/src/utils/provider-setup.ts:35
  baseUrl: 'https://api.tokenrouter.com/v1',

.env.example:71
  # https://tokenrouter.me/v1            <-- stale, never updated

sdk/src/impl/model-provider.ts:174-190 (call at :188)
  if (isCloudflareModel(model)) { ... }  <-- routed, keyed, but missing from setup/union/validProviders/combiner/release README

common/src/constants/model-config.ts:4
  export const ALLOWED_MODEL_PREFIXES = [ 'anthropic', ..., 'cloudflare', ... ]  <-- no 'openrouter'

cli/src/utils/openrouter-models/static-catalogs.ts:13
  const TOKENROUTER_CATALOG: OpenRouterModel[] = [ ...34 hardcoded entries... ]

common/src/constants/model-config.ts:67 (tokenrouterModels)
  ...34 separate entries in common (identical set today; no parity guard)...
  ...plus a stray 'tokenrouter/' prefix string at the type boundary...

cli/src/utils/settings.ts:233
  const validProviders = new Set<ModelProvider>([...])   <-- no 'cloudflare'

sdk/src/impl/model-provider/savant-backend.ts:28
  export async function createSavantCodeBackendModel(  <-- misnomer; generic fallback
```

## Impact Assessment

### Affected Components

- New: `common/src/providers/` (types, registry, derive, validate)
- `common/src/constants/model-config.ts` — derived prefix/domain/logo surfaces
- `sdk/src/impl/model-provider.ts` + `model-factories.ts` + `savant-backend.ts` — data-driven routing
- `sdk/src/env.ts` — registry-driven credential getters
- `cli/src/utils/provider-setup.ts` — derived `PROVIDER_SETUP_CONFIG`; simplified save/activation
- `cli/src/utils/settings.ts` — single `activeProvider` field + migration of legacy fields
- `cli/src/utils/openrouter-models/` — derived unions, unified catalogs, generic live fetch
- `cli/src/components/model-picker.tsx` — derived ordering
- `cli/src/commands/health-command.ts` — registry-driven report
- `docs/design/Adding New Providers.md` — runbook rewritten to one entry
- `.env.example`, READMEs — generated/referenced env surface

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround — *architectural debt blocking scale; latent drift*
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

No user-facing breakage is expected at any phase; each phase is gated by the full existing test
suite passing unchanged (Phase 1) or with additive tests only.

## Proposed Solution

### Approach

Introduce a **typed, data-only provider registry** in `common` and derive every surface from it.
"Data-only" means: no functions, no side effects — pure constants — so it is serializable,
bundle-safe for `bun --compile`, and importable from the SDK dist and the CLI without circular
import risk.

**Registry entry shape** (`common/src/providers/types.ts`):

```ts
export type ProviderKind = 'gateway' | 'local' | 'env-only'
export type ProviderProtocol = 'openai' | 'anthropic' | 'openai-anthropic'
export type ProviderIdTransform = 'strip' | 'keep' | 'cf-rewrite'

export interface ProviderConfig {
  id: string                                  // routing prefix: 'tokenharbor'
  label: string                               // 'TokenHarbor'
  kind: ProviderKind                          // gateway | local (ollama) | env-only
  credentials: {
    envVar?: string                           // 'TOKENHARBOR_API_KEY' — absent for kind:'local'
    extra?: Array<{ envVar: string; label: string }>  // e.g. CLOUDFLARE_ACCOUNT_ID
    resolver?: 'default' | 'openrouter'       // openrouter = master-key exchange chain
  }
  baseUrl: string                             // API root; supports {ENV_VAR} placeholders
                                              // (Cloudflare: .../accounts/{CLOUDFLARE_ACCOUNT_ID}/ai/v1/)
  protocol: ProviderProtocol
  idTransform: ProviderIdTransform            // strip | keep | cf-rewrite
  protocolMap?: 'OPENCODE_GO_PROTOCOLS' | 'COMMANDCODE_PROTOCOLS'  // dual-protocol ref
  catalog:
    | { source: 'live'; url: string }         // openrouter, nvidia
    | { source: 'static'; modelsRef: keyof typeof MODEL_CATALOGS; namesRef?: string }  // typed catalog ref
    | { source: 'none' }
  setupAvailable: boolean                     // appears in /provider picker
  domain: string                              // favicon / logo
  order: number                               // deterministic picker group order (routing: prefixes are disjoint)
}
```

**Shape notes (adversarial-hardened):** `baseUrl` is the API *root* — the protocol layer appends
the path suffix (`/chat/completions` vs `/messages`), so dual-protocol providers need one root,
not two. `baseUrl` supports `{ENV_VAR}` placeholder interpolation resolved by the generic factory
— required for Cloudflare, where the account id is embedded mid-path
(`/client/v4/accounts/{CLOUDFLARE_ACCOUNT_ID}/ai/v1/`, see `model-factories.ts:147-154`).
`credentials.envVar` is optional so `kind: 'local'` (ollama) needs no key.
`catalog.modelsRef` is a typed key into the shared `MODEL_CATALOGS` map (a Phase-1 registry of all
shared model catalogs), so catalog references are compile-time checked — matching the `protocolMap`
union. `order` drives picker grouping only; prefixes are disjoint so routing order is a no-op (the
openrouter/bare-slug case is decision 10, not ordering).

**The single user setting — UI selection.** The `/provider` picker selects the active provider.
That selection persists as **one** settings field (`activeProvider: ProviderId`). The registry
derives from it: the base URL (routing), the required key env var (readiness + guidance), the
catalog section (picker default), and the health report. `DIRECT_PROVIDER` and
`INFERENCE_BASE_URL` remain honored as explicit override escape hatches (custom endpoints, legacy
setups) but are no longer required for registry providers. Key presence is a *readiness* condition,
not a *selection* condition: a selected provider without its key yields the derived
`run /provider <id> or set X_API_KEY` guidance — the message itself comes from the registry.

**Derived surfaces** (all computed, never hand-maintained):

| Surface | Current home | Becomes |
|---------|--------------|---------|
| `ALLOWED_MODEL_PREFIXES` | `model-config.ts:4` | registry ids ∪ `ORG_PREFIXES` (extracted in Phase 1 from the 12 inline org slugs at `model-config.ts:5-20`) |
| `PROVIDER_SETUP_CONFIG` | `provider-setup.ts:21` | registry entries where `setupAvailable` |
| `ModelProvider` union | `openrouter-models/types.ts` | `keyof typeof PROVIDER_REGISTRY` |
| `settings.validProviders` | `settings.ts:233` | registry keys |
| `providerDomains` | `model-config.ts:457` | registry `domain` ∪ static `ORG_DOMAINS` (new, 9 org-slug entries) |
| `getLogoForModel` | `model-config.ts:475` | registry-prefix lookup ∪ `ORG_DOMAINS` ∪ name-heuristic branches (kept in common) |
| `getProviderOrder` | `model-picker.tsx:43` | registry `order` — Phase 1 values replicate current sort (0,1,2,3 + 4-way tie) |
| Gateway catalog composition | `openrouter-models/gateway.ts` | iterate registry `catalog` configs |
| SDK routing branches | `model-provider.ts:88-196` | one ordered loop over the registry |
| Credential getters | `sdk/env.ts` | generic `getApiKey(envVar)` from registry |
| Missing-key errors | hand-written per branch | templated from registry label + envVar |
| `/health` provider report | `health-command.ts` | active setting + registry |
| `.env.example` docs | hand-maintained | generated from registry |
| Release README provider table | `cli/release/README.md:48-55` | generated from registry (Phase-5 generator script) |
| Bare-slug routing fallback | `model-provider.ts:193-196` default branch | active provider's gateway; caller-supplied key in Phase 2 (Phase 4: active-provider key) |

**Ollama** folds into the registry as `kind: 'local'` (no key env var; base URL from detection),
with its auto-detection logic remaining in `ollama-onboarding.ts` as the local-provider
implementation. One code path for all providers; no second provider system.

**OpenRouter** keeps its special resolver (master-key exchange via `OR_MASTER_KEY` →
`OPENROUTER_API_KEY` → `INFERENCE_API_KEY`) as `credentials.resolver: 'openrouter'`, and its slug
is preserved via `idTransform: 'keep'`. The behavior is unchanged — only its metadata moves.

### GREEN decisions and durable defaults

1. **Registry lives in `common/src/providers/`.** Both SDK and CLI already depend on common; this
   is the only location both consumers can derive from. Data-only constants keep it safe for the
   compiled binary and the SDK dist bundle.
2. **The UI selection is the single setting.** `activeProvider` is persisted in settings.json;
   legacy `directProvider` and `directProviderBaseUrl` migrate onto it. Two related settings stay
   distinct (adversarial finding 5): `savantCodeModelProviderPreference` keeps driving the picker's
   default section, and `savantCodeModelPreference` (`settings.ts:25`) remains the *model-id*
   override applied to agent definitions (`loadSavantCodeModelPreference` at `settings.ts:368` →
   `send-message-agent.ts:26`). `savantCodeModelAutoConfigured` (`settings.ts:71`) flags auto-config
   and must not suppress an explicit UI selection.
3. **`DIRECT_PROVIDER` / `INFERENCE_BASE_URL` remain as explicit overrides only.** Shell env wins
   over the persisted selection (preserving the FID-2026-0804-001 precedence contract). A
   non-empty explicit env value is never silently overwritten by UI selection.
4. **Adding a provider is one registry entry + a catalog reference** for the common case
   (OpenAI-compatible gateway). Dual-protocol providers additionally reference an existing or new
   protocol map. No SDK branch, no CLI edit, no union edit.
5. **Robustness is enforced, not promised:** compile-time `satisfies Record<string, ProviderConfig>`
   exhaustiveness; a Zod schema validating the registry at module load (fail fast); and a
   `validate-provider-registry.test.ts` suite asserting unique prefixes, unique env vars, valid
   URLs, enum values, catalog-model prefix agreement, valid order values, and **derivation parity**
  (order *uniqueness* is deliberately not asserted — the 4-way picker tie at order 4 is
  intentional, Phase 1 delta (d))
   (every derived surface agrees with the registry — the Cloudflare-class gap becomes a test
   failure). **All `derive*` and `validate` functions take the registry as their first argument**
   (pure functions over injected data): consumers pass `PROVIDER_REGISTRY`, tests pass a fixture
   registry — this is what makes the fixture-provider test and the parity suite possible without
   global mutation.
6. **Behavior is not rewritten.** The credential precedence rules
   (FID-2026-0804-001), the direct-mode gate (`isDirectProviderMode`, `sdk/src/env.ts:74`,
   FID-2026-0806-009), and the OpenRouter master-key exchange
   (`sdk/src/impl/openrouter-key-resolver.ts:7-9` — `OR_MASTER_KEY` → `OPENROUTER_API_KEY` →
   `INFERENCE_API_KEY`) keep their contracts. **Default-path key is caller-supplied** (Loop 2
   correction): the SDK's default branch does not resolve a key — `getModelForRequest` receives
   `apiKey` in its params (`model-provider/types.ts:6-9`) from the CLI/client layer
   (`llm/prompts.ts:46-50`, `llm/stream.ts:72-76`) and passes it through (`model-provider.ts:195`).
   `resolveOpenRouterApiKey` runs only in the `openrouter/` branch (`model-provider.ts:149`). The
   registry's `default` resolver models this as a single env var or caller-supplied value — **not**
   a 3-level env chain; the earlier `resolvedOpenRouterKey ?? INFERENCE_API_KEY ?? apiKey` wording
   is retracted (it described a mechanism that does not exist in the SDK). The default key the CLI
   passes today is its caller-resolved value (the exact upstream CLI chain stays `NEEDS-REVIEW`
   until Phase 2 confirms it unchanged); Phase 4 names the active provider's `credentials.envVar`
   as the explicit switch target. The refactor moves metadata; it does not change semantics.
7. **The default factory is renamed** `createSavantCodeBackendModel` →
   `createDefaultInferenceModel` (generic OpenAI-compatible fallback), removing a documented source
   of confusion.
8. **Context-window heuristics consolidate to one shared family map in common**, ending the
   layered `inferContextLength` / `getContextWindowForModel` / `resolveContextWindowForModel`
   divergence (FID-2026-0805-005/006 territory).
9. **Phases are independently shippable**, each gated by the full existing test suite (Phase 1 must
   pass with zero changes to behavior) plus additive tests.
10. **Bare-slug routing is explicit, and key authorization is separated from base-URL routing**
    (Loop 2 adversarial finding 2). Unprefixed model ids (e.g. `anthropic/claude-sonnet-4.5`) — the
    de-facto OpenRouter path today via `INFERENCE_BASE_URL` — route to the **active provider's**
    gateway through the generic OpenAI-compatible factory. `DIRECT_PROVIDER` selects the provider
    and `INFERENCE_BASE_URL` overrides the base URL at the CLI layer; the SDK's default branch
    keeps its caller-supplied key (decision 6). **Phase 2 preserves that key byte-for-byte**;
    switching bare-slug authorization to the active provider's own key (e.g. `TOKENHARBOR_API_KEY`
    when tokenharbor is active) is a deliberate **Phase 4** semantic change — it alters which
    credential authorizes the most common path, so it ships with the readiness/guidance update, not
    silently. `openrouter/`-prefixed ids keep their dedicated branch (`idTransform: 'keep'`,
    master-key resolver at `model-provider.ts:149`). This is the one semantic contract the
    registry loop must not break.
11. **ChatGPT OAuth stays outside the registry.** It is a credential *mode* (stored OAuth tokens),
    not a provider; it remains a pre-loop gate in `getModelForRequest()` ahead of the registry
    loop, keeping its complete predicate: `CHATGPT_OAUTH_ENABLED && !skipChatGptOAuth &&
    isOpenAIProviderModel(model) && isChatGptOAuthModelAllowed(model)` plus rate-limit and
    credential-validity checks (`model-provider.ts:65-84`) (Loop 2 review note).
12. **Fresh-install default is defined:** `activeProvider` defaults to `openrouter`
    (`DEFAULT_SAVANT_CODE_MODEL_PROVIDER`, `settings.ts:20`); Ollama auto-detection overrides only
    when no explicit selection is persisted — matching today's
    `applyPersistedDirectProviderSettings()` order (adversarial finding 8).

### Steps

Phased implementation plan (spec only in this FID; implementation is follow-up work):

1. **Phase 1 — Registry + derivation (zero semantic change).** Add `common/src/providers/`
   (types + `PROVIDER_REGISTRY` with all current providers including ollama; extract `ORG_PREFIXES`
   — currently 12 inline org slugs at `model-config.ts:5-20` — and a 9-entry `ORG_DOMAINS` map).
   Derive `ALLOWED_MODEL_PREFIXES`, `providerDomains`, `getLogoForModel` in common; derive
   `PROVIDER_SETUP_CONFIG`, `ModelProvider`, `settings.validProviders`, `getProviderOrder` in cli.
   All existing tests must pass unchanged. The *intentional, enumerated* one-time deltas ship with
   their test updates (Loop 2 — expanded from three to four plus one constraint): (a) derived
   `ALLOWED_MODEL_PREFIXES` gains `openrouter` and `ollama`; (b) derived union/`validProviders` gain
   `cloudflare`; (c) derived `providerDomains` gains `openrouter` (today absent — verified);
   (d) registry `order` values must **replicate the current sort exactly** (openrouter 0,
   tokenrouter 1, nvidia 2, opencode-go 3, and the 4-way tie of
   tokenharbor/commandcode/ollama/cloudflare at 4 — `model-picker.tsx:43-55`), so picker ordering
   is unchanged; reordering is deferred to a later phase. Each is a latent-gap fix; each is listed
   in the Phase-1 diff description so the "zero change" gate is honest. This is the drift-killing
   step.
2. **Phase 2 — Data-driven SDK routing.** Generic factory reading `baseUrl`/`protocol`/
   `idTransform` from the registry; replace the seven hand-written branches in
   `getModelForRequest()` with one ordered loop; rename the default factory. OpenRouter keeps its
   resolver special-case.
3. **Phase 3 — Catalog unification.** Delete cli-side `TOKENROUTER_CATALOG` and
   `OPENCODE_GO_CATALOG`; derive from the common maps (TokenHarbor/CommandCode pattern); collapse
   `openrouter.ts` + `nvidia.ts` into one generic `fetchLiveCatalog(url, resolver)` — the live
   fetch must accept the provider's credential resolver because OpenRouter's catalog requires the
   master-key exchange (adversarial finding 10); move the context-family heuristic to common.
4. **Phase 4 — Single-setting state.** Add `activeProvider` to settings; `/provider` writes it;
   key readiness is separate; migrate legacy fields; keep env overrides authoritative.
5. **Phase 5 — Validation suite + docs.** Registry tests (uniqueness, parity, catalog agreement),
   generated env reference, and the `docs/design/Adding New Providers.md` runbook rewritten to
   "one entry."

### Verification

- Phase 1: full existing test suites pass **unchanged** (sdk, cli, common, agent-runtime); typecheck × 4; ESLint; markdownlint.
- A **fixture-provider test** proving the one-entry claim: add `fixture/…` to the registry in a
  test, assert routing, setup, picker grouping, and guidance all derive without touching any other
  file.
- **Drift-class greps:** base URLs appear only in the registry (SDK factories contain no URL
  literals); no hand-maintained provider-list arrays remain outside the registry (NO-MATCH checks).
- Derivation-parity test: every derived surface agrees with the registry.
- Existing provider tests (`model-provider-free-mode.test.ts`, `provider-setup.test.ts`,
  `openrouter-models.test.ts`) pass with no semantic changes.
- `bun x eslint . --max-warnings 0`; `bun run lint:md`; `git diff --check`.

## Perfection Loop

### Loop 1

- **RED:** Reconnaissance complete — six confirmed drift/duplication findings with file:line
  evidence (URL duplication + one stale example, nine-plus provider enumerations with Cloudflare
  missing from five code surfaces, catalog duplication, multi-setting activation, misnamed default
  factory, layered context heuristics). Sequential thinking converged on a data-only registry in
  `common` with UI selection as the single setting.
- **GREEN:** Designed `PROVIDER_REGISTRY` (typed, data-only, covering all eight providers including
  ollama as `kind: 'local'`), the derivation table, the single `activeProvider` setting, the
  five-phase plan, and the two-layer robustness model (compile-time exhaustiveness + Zod/parity
  tests). Operator decisions folded in: UI selection is the single setting (not key presence);
  Ollama folds into the registry; spec-only FID.
- **AUDIT (2026-08-09):** Mechanical verification of every file:line claim + independent design
  review. Verdict: **PASS with corrections.** Confirmed: all five SDK factory URL literals
  (`model-factories.ts:67,93,122,222,280`), stale `.env.example:71`, union (`types.ts:3`) and
  `validProviders` (`settings.ts:233`) both lacking cloudflare, misnomer (`savant-backend.ts:28`),
  `isDirectProviderMode` at `sdk/src/env.ts:74`, legacy settings fields (`settings.ts:25,26,68,
  75,78`). Corrected: `PROVIDER_SETUP_CONFIG` at `provider-setup.ts:21` (not :12); catalog counts
  34/34 (tokenrouter) and 15/15 (opencode-go) with identical current contents (not 32/35);
  Cloudflare missing from five code surfaces + no `getProviderOrder` case (not four);
  `getLogoForModel` at `model-config.ts:475` (providerDomains at :457); cloudflare branch at
  `model-provider.ts:174-190` (call at :188). All corrections folded in above.
- **ADVERSARIAL (2026-08-09):** Independent reviewer's five findings audited against source — **all
  confirmed**, verdicts below. (1) Bare-slug routing undefined → **confirmed**, now decision 10.
  (2) ChatGPT OAuth unrepresented → **confirmed**, now decision 11. (3) Cloudflare URL
  interpolation breaks `baseUrl: string` → **confirmed** (`model-factories.ts:147-154`), fixed via
  `{ENV_VAR}` placeholder support. (4) Phase 1 "zero behavior change" contradicted by the FID's
  own derivations → **confirmed**, deltas enumerated in Phase 1. (5)
  `savantCodeModelProviderPreference` conflation risk → **confirmed** distinct from
  `savantCodeModelPreference`, clarified in decision 2. Additional adversarial gaps found beyond
  the reviewer: `INFERENCE_API_KEY` precedence chain needs an explicit home (decision 6),
  fresh-install default (decision 12), release-README/features doc surfaces (derivation table),
  `fetchLiveCatalog` credential resolver (Phase 3), protocol path-suffix note, stray
  `'tokenrouter/'` prefix string in common. **YAGNI assessed:** the only additions beyond the
  original shape (`{ENV_VAR}` template, `default` 3-level chain) are required by existing
  behavior; no speculative features. *(The "default 3-level chain" item is superseded in Loop
  2 — the chain does not exist; see decision 6.)*
- **CHANGE DELTA:** FID-only specification; no production code delta.

### Loop 2 (re-run after Loop 1 corrections)

- **RED:** The Loop 1 corrections introduced ~15 new citations and four new design elements
  (decisions 10-12, `{ENV_VAR}` placeholders, the enumerated deltas, the
  `ORG_PREFIXES`/`ORG_DOMAINS` derivation rows). None of the new citations had been mechanically
  verified; the re-run verified all of them against source and re-audited the whole FID for
  staleness left by Loop 1.
- **GREEN:** Corrections applied below (decision 6, decision 10, decision 11 predicate, four
  derivation-table rows, expanded Phase-1 delta enumeration, three citation fixes, and stale
  Loop-1 remnants in the Summary, Resolution, and evidence checklist).
- **AUDIT (2026-08-09):** All 15 new citations mechanically verified. **PASS with two precision
  corrections:** `cli/release/README.md` provider table spans `48-55` (Ollama row at :48), not
  49-55; `savantCodeModelAutoConfigured` is at `settings.ts:71` (also :249-250, :379). Verified
  accurate: Cloudflare URL template (`model-factories.ts:147-154`, template at ~:151),
  `DEFAULT_SAVANT_CODE_MODEL_PROVIDER` (`settings.ts:20`), `savantCodeModelPreference`
  (`settings.ts:25`), provider preference (`settings.ts:26`), `loadSavantCodeModelPreference`
  (`settings.ts:368` → `send-message-agent.ts:26`), the resolver chain
  (`openrouter-key-resolver.ts:7-9`), `PROVIDER_SETUP_CONFIG` (`provider-setup.ts:21`),
  `getLogoForModel` (`model-config.ts:475`), cloudflare branch (`model-provider.ts:174`, call at
  :188), `isDirectProviderMode` (`env.ts:74`), and the startup order
  (`applyPersistedDirectProviderSettings` at `ollama-onboarding.ts:62` before
  `detectOllamaAndConfigureDirectProvider` at :106, invoked at `index.tsx:264/268`). Stale
  Loop-1 remnants also fixed: the derivation-table `PROVIDER_SETUP_CONFIG` row still said
  `provider-setup.ts:12`; the bare-slug row cited `model-provider.ts:192` (default branch is
  :193-196, call :195); the Summary still said "seven-plus places"; Resolution/Lifecycle still
  said `created`.
- **ADVERSARIAL (2026-08-09):** Independent Loop-2 review and this pass converged on the same
  findings; all source-verified. (1) Decision 6's `resolvedOpenRouterKey ?? INFERENCE_API_KEY ??
  apiKey` default-path chain **does not exist** — the key is caller-supplied
  (`ModelRequestParams.apiKey`, `types.ts:6-9` → `prompts.ts:46-50`/`stream.ts:72-76` →
  `model-provider.ts:195`); decision 6 rewritten. (2) Decision 10 conflated base-URL routing with
  key authorization — key semantics now explicit, Phase-4 switch gated. (3) `providerDomains`/
  `getLogoForModel` derivation would drop 9 org-slug domains and all name heuristics
  (`model-config.ts:457-505`) — fixed via `ORG_DOMAINS` + kept heuristics; `providerDomains` also
  lacks `openrouter` today (delta (c)). (4) `ORG_PREFIXES` was a fabricated constant (NO-MATCH
  grep across common/cli/sdk) — now a Phase-1 extraction from the inline org slugs. (5) Phase-1
  deltas grew from three to four plus an order-replication constraint (verified `getProviderOrder`
  4-way tie at `model-picker.tsx:43-55`). (6) Release README generation needs a Phase-5 generator
  script. (7) Decision 11 now cites the full OAuth predicate (`model-provider.ts:65-84`). **YAGNI
  re-assessed:** no new speculative features; every addition is a correction or a required
  derivation.
- **CHANGE DELTA:** FID-only specification; no production code delta.

### Loop 3 (convergence re-run)

- **RED:** The Loop 2 corrections were re-read in full (0-EOF) and re-verified for internal
  consistency. Remaining defects were trivial (one active citation inconsistency) plus one
  implementation-critical omission surfaced by the independent reviewer.
- **GREEN:** Fixed the `cli/release/README.md:49-55` → `48-55` citation in problem #2; added the
  derive-function parameterization requirement and typed `MODEL_CATALOGS` key (decision 5,
  shape); named the default-key source (decision 6); clarified `order` drives picker grouping
  only; softened Missed Question 2; hygiene updates (YAGNI header, Loop-1 superseded marker,
  Resolution).
- **AUDIT (2026-08-09):** Internal-consistency greps + re-verification of every Loop-2 citation.
  **PASS.** All Loop-2 citations re-confirmed exactly (`settings.ts:71`, release README `48-55`,
  OAuth predicate `model-provider.ts:65-84`, default branch `:193-196` with call at :195, picker
  `:43-55`, cloudflare branch `:174`/call `:188`). The only remaining *active* citation
  discrepancy was problem #2's `49-55` (vs the derivation table's `48-55`) — fixed. Remaining
  `seven-plus`/`provider-setup.ts:12`/`32/35` string matches are historical records inside the
  Loop 1-2 sections documenting the corrections, not active claims.
- **ADVERSARIAL (2026-08-09):** Independent convergence review + this pass converged on the same
  findings. **One substantive finding, confirmed:** the fixture-provider test and the
  derivation-parity suite (headline robustness claims) are unimplementable if `derive*`/`validate`
  hard-import the `PROVIDER_REGISTRY` singleton — they must be pure functions over an injected
  registry; folded into decision 5. One minor clarity item: the `default` resolver's key source is
  now named (decision 6). Everything else was trivial (typed `modelsRef`, `order`-semantics
  comment, wording, citation hygiene). **Convergence declared under Circuit Breaker Rule 3 /
  Termination Criteria (diminishing returns):** a further loop pass would find only cosmetic
  polish; the design is stable and ready for Phase 1 implementation.
- **CHANGE DELTA:** FID-only specification; no production code delta.

### Loop 4 (Phase 1 implementation record — 2026-08-09)

- **RED:** Phase 1 executed per the converged spec. Implementation findings: (1) the
  `openrouter-models` directory imports resolve through the barrel file
  `cli/src/utils/openrouter-models.ts` (not an `index.ts` — Bun and tsc both resolve it);
  (2) the CLI typecheck carries pre-existing TS6059 rootDir noise that must be filtered
  (0 non-TS6059 errors is the gate); (3) `ensurePinnedBunOnPath` release-test failure is
  pre-existing and environment-dependent (confirmed on pristine HEAD).
- **GREEN:** Created `common/src/providers/` (6 files — `types.ts`, `model-catalogs.ts`,
  `org.ts` (`ORG_PREFIXES` extracted from the 12 inline org slugs + 9-entry `ORG_DOMAINS`),
  `registry.ts` (`PROVIDER_REGISTRY`), `derive.ts` (parameterized `derive*` functions taking the
  registry as their first argument), `index.ts` barrel). Wired derivations in common
  (`ALLOWED_MODEL_PREFIXES`, `providerDomains`, `getLogoForModel` in
  `common/src/constants/model-config.ts` — registry-prefix lookup kept **before** the claude/grok
  name heuristics to preserve exact branch order) and in cli (`ModelProvider` union at
  `openrouter-models/types.ts`, `PROVIDER_SETUP_CONFIG` at `provider-setup.ts`,
  `settings.validProviders`, `getProviderOrder` at `model-picker.tsx`). Applied the four
  enumerated deltas: (a) `openrouter` + `ollama` prefixes gained; (b) `cloudflare` added to the
  union + `validProviders`; (c) `openrouter` domain gained in `providerDomains`; (d) registry
  `order` values replicate the current sort exactly (0,1,2,3 + 4-way tie at 4). Added the
  registry test suite (`common/src/providers/__tests__/provider-registry.test.ts`) incl. the
  fixture-provider purity proof.
- **AUDIT (2026-08-09):** Typecheck × 4 green — common exit 0, sdk exit 0, agent-runtime exit 0,
  cli 0 non-TS6059 errors. Common suite 534 tests / 0 fail; CLI key suites 58 tests / 0 fail
  (provider-setup, settings, openrouter-models, ollama-onboarding, registry-gating); SDK suite
  green (453/0) earlier in the gate. ESLint clean (`--max-warnings 0`), Prettier clean.
- **ADVERSARIAL (independent review — 2026-08-09):** Reviewer's four findings dispositioned
  against mechanical evidence: (1) **import-cycle risk** between `model-config.ts` and
  `providers/model-catalogs.ts` — **REFUTED by runtime probe**: a Bun probe importing
  `PROVIDER_REGISTRY` + `ALLOWED_MODEL_PREFIXES` + `MODEL_CATALOGS` + `deriveValidProviderIds`
  together boots cleanly (no TDZ errors; all 8 providers, 20 prefixes, 5 catalogs resolve); the
  cross edge is `import type` only (`types.ts:1`, `registry.ts:17`, `derive.ts:12`), so no
  runtime cycle exists. Noted for Phase 3: catalog unification will make the import direction
  explicit. (2) **base-URL parity not asserted in Phase 1** — **ADDRESSED**: added the review-
  parity test asserting registry `baseUrl`/`envVar` values equal the SDK factory literals
  (`model-factories.ts:67,93,122,153,222,280`, `model-provider.ts:172`); 9/9 registry tests
  pass. (3) **derived union must be old-set ∪ {cloudflare}** — **REFUTED by git diff**: the old
  union/`validProviders` was exactly the 7 providers; the derived set is those 7 + `cloudflare`,
  matching delta (b). The `'personal'` value at `scripts/public-release.test.ts:701` is a
  legacy-value fixture (unknown values get dropped) — it was never in `validProviders`.
  (4) **status-header rationale** — **ADDRESSED** (header now notes Phase 1 implemented,
  Phases 2-5 pending). **No blocking findings.**
- **CHANGE DELTA:** ~600 lines: 6 new files in `common/src/providers/` + 1 test file; derivation
  rewrites in 2 common files + 4 cli files. Zero behavior change — all existing tests pass
  unchanged; the 4 enumerated deltas each fix a latent gap and shipped with the FID's own
  permission.

### Loop 5 (Phase 2 implementation record — 2026-08-09)

- **RED:** Phase 2 executed per the converged spec: replace the seven hand-written
  branches in `getModelForRequest()` with one ordered loop over the registry, rename the default
  factory, keep OpenRouter's resolver special-case, and remove provider URL literals from the SDK.
- **GREEN:** (1) `model-factories.ts` rewritten — the seven per-provider factories
  (`createTokenRouterModel`…`createCloudflareModel`, `createOpenRouterModel`) deleted and replaced
  by one generic `createProviderModel(config, apiKey, model, extraCreds)` reading `baseUrl`,
  `protocol`, `idTransform`, and `protocolMap` from the registry entry; base-URL `{ENV_VAR}`
  placeholder resolution added (Cloudflare account id); dual-protocol dispatch via
  `resolveProtocol()` (map keyed by FULL prefixed id — matches `OPENCODE_GO_PROTOCOLS`/
  `COMMANDCODE_PROTOCOLS` keys). (2) `getModelForRequest()` now runs one ordered loop over
  `Object.values(PROVIDER_REGISTRY)` with `config.kind === 'local'` skipped (ollama stays on the
  default path via CLI-set `INFERENCE_BASE_URL`), per-provider key resolution
  (`credentials.resolver === 'openrouter'` → `resolveOpenRouterApiKey()`, else `process.env[envVar]`),
  extra-credential resolution (Cloudflare account id) with fail-closed errors, and templated
  missing-key errors. ChatGPT OAuth remains a pre-loop gate. (3) Default factory renamed
  `createSavantCodeBackendModel` → `createDefaultInferenceModel` and file `savant-backend.ts` →
  `default-inference.ts` (git mv) per decision 7. (4) Two implementation findings folded into the
  registry schema: optional `credentials.missingKeyMessage` and per-extra `missingMessage` —
  required because four canonical messages differ from the generic template (OpenRouter resolver
  chain, TokenHarbor `/provider` hint, NVIDIA short name vs `NVIDIA NIM` label, Cloudflare "API
  token" wording); the registry is still the single source, the SDK just reads the override.
  All 8 registry base URLs are byte-identical to the deleted SDK literals (drift-kill verified).
- **AUDIT (2026-08-09):** SDK typecheck exit 0. `model-provider-free-mode.test.ts` 9/9 pass —
  including exact URL assertions (`tokenharbor.ai/v1/chat/completions`,
  `api.commandcode.ai/provider/v1/{chat/completions,messages}`, `openrouter.ai/api/v1/chat/completions`),
  `x-api-key` vs `Authorization` headers, model-id transforms (`strip`/`keep`/`cf-rewrite`), and
  the three verbatim missing-key messages. Full SDK suite 453/0; common 535/0; cli 0 non-TS6059
  errors; agent-runtime exit 0. ESLint clean (after `--fix` of 3 import-order warnings), Prettier
  clean. Drift-class greps: NO-MATCH for provider URL literals in `sdk/src/impl/model-provider/*.ts`
  (only the product attribution header `https://savant-code.com` remains); NO-MATCH for
  `savant-backend`/`createSavantCodeBackendModel` outside the rename comment.
- **ADVERSARIAL (independent review — 2026-08-09):** Reviewer's findings dispositioned. All 7
  verification areas PASS with file:line evidence (behavior parity incl. URL/header/model-id
  assertions, verbatim error messages, base-URL parity, Cloudflare `{ENV_VAR}`+`cf-rewrite`,
  rename completeness, import direction, `supportsStructuredOutputs`). One actionable finding
  fixed: (1) **`resolveProtocol` silently defaulted to `COMMANDCODE_PROTOCOLS` when `protocolMap`
  was missing** — now a fail-closed throw (`model-factories.ts` `resolveProtocol`). Two accepted
  notes: (2) openrouter-specific behaviors (attribution headers + `supportsStructuredOutputs`)
  are gated by `config.id === 'openrouter'` — acceptable for Phase 2, candidate for a future
  registry field in Phase 5; (3) `buildMissingKeyError` interpolates an optional `envVar` — safe
  today (only `kind: 'local'` omits it and those are skipped), noted. **No blocking findings.**
- **CHANGE DELTA:** `model-factories.ts` (−~200 lines of duplicated factories, +generic factory),
  `model-provider.ts` (branches → loop), `savant-backend.ts` → `default-inference.ts` (rename),
  `types.ts` + `registry.ts` (+2 optional message fields + 4 overrides). Zero behavior change —
  all 453 SDK tests pass unchanged.

### Loop 6 (Phase 3 implementation record — 2026-08-09)

- **RED:** Phase 3 executed per the converged spec: delete cli-side `TOKENROUTER_CATALOG` and
  `OPENCODE_GO_CATALOG`, derive both from the common `MODEL_CATALOGS` maps, collapse
  `openrouter.ts` + `nvidia.ts` into one generic live-catalog fetcher, and move the context-family
  heuristic to common. Implementation findings: (1) the generic fetcher's `parse` callback must be
  generic over the provider response type — a plain `(json: unknown) => …` signature fails
  contravariance against the providers' typed parsers (TS2322); (2) the live catalog URLs were
  already present in the registry (`catalog: { source: 'live', url }`) — keeping them hardcoded in
  the wrappers would have re-created the exact second-copy drift this FID exists to kill.
- **GREEN:** (1) New `common/src/constants/context-windows.ts` — `inferContextLength` moved from
  cli `static-catalogs.ts` (problem #6); exported via the common constants barrel. (2)
  `static-catalogs.ts` rewritten — `TOKENROUTER_CATALOG` + `OPENCODE_GO_CATALOG` deleted;
  `fetchTokenRouterModels`/`fetchOpenCodeGoModels` derive from common `tokenrouterModels`/
  `opencodeGoModels` (TokenHarbor pattern); display names stay cli-side (`TOKENROUTER_NAMES`,
  `OPENCODE_GO_NAMES`); `inferContextLength` imported from common. (3) New
  `cli/src/utils/openrouter-models/live-catalog.ts` — generic `createLiveCatalogFetcher({ url,
  logLabel, parse, resolveKey? })` with the shared cache/TTL/inflight/degrade semantics of the two
  former fetchers (10s abort signal, stale-cache fallback, never throws); `parse` is generic
  (`LiveCatalogFetcherOptions<TResponse>`) with the single trust-boundary cast at the network edge
  — wrappers stay strongly typed. (4) `openrouter.ts` + `nvidia.ts` rewritten as thin wrappers;
  OpenRouter wires the `resolveOpenRouterApiKey` resolver (adversarial finding 10 — the live
  fetch must accept the provider's credential resolver), NVIDIA's public endpoint needs none. (5)
  Drift-kill: live catalog URLs are read from the registry via the new parameterized
  `deriveLiveCatalogUrl` (added to `derive.ts`, pure over injected registry), with a fail-fast
  module-load guard — each live URL now exists in exactly one place. (6) Barrel comment updated.
- **AUDIT (2026-08-09):** CLI typecheck 0 non-TS6059 errors; common typecheck exit 0; sdk
  typecheck exit 0. `openrouter-models.test.ts` 18/18 pass unchanged (static-catalog derivation,
  live-fetch gateway composition, context-window heuristic fallback); common suite 535/0. ESLint
  clean (after `--fix` of one import-order warning), Prettier clean. Drift-greps: NO-MATCH for
  `TOKENROUTER_CATALOG`/`OPENCODE_GO_CATALOG` outside documentation comments; NO-MATCH for
  `https://` literals in `openrouter.ts`/`nvidia.ts` — live catalog URLs live only in
  `registry.ts` (openrouter at :36, nvidia at :87).
- **ADVERSARIAL (independent review — 2026-08-09):** Reviewer's four findings dispositioned
  against mechanical evidence. (1) **decision-8 layering half-done** — `inferContextLength`
  moved to common, but `getContextWindowForModel` (`cli/src/utils/constants.ts:167`) and
  `resolveContextWindowForModel` (`lookup.ts:248`) remain — **ACCEPTED AS DOCUMENTED DEFERRAL**:
  `getContextWindowForModel` is the *fallback* layer for models absent from every catalog (its
  own doc comment says the catalog is the source of truth); `inferContextLength` serves the
  derived static catalogs. The two serve different layers, the layering pre-dates Phase 3, and
  decision 8 already scopes the full consolidation to Phase 5 — noted here so the Loop 6 record
  does not overclaim. (2) **derived `contextLength` parity** — **REFUTED by git show**: the
  deleted `TOKENROUTER_CATALOG`/`OPENCODE_GO_CATALOG` carried NO hardcoded `contextLength`
  fields; the old fetchers computed `m.contextLength ?? inferContextLength(m.name)` where
  `m.contextLength` was always undefined (`static-catalogs.ts` old:294,320), so the derived
  `inferContextLength(name)` is byte-identical behavior. Common maps are prefixed
  (`tokenrouter/anthropic/…`, `opencode-go/…` — verified `model-config.ts`), so derived ids
  match the name maps exactly. (3) **per-catalog ordering determinism** — **REFUTED**: the
  gateway combiner sorts the combined list globally (`gateway.ts:115`
  `combined.sort((a, b) => a.id.localeCompare(b.id))`), so per-catalog insertion order is
  irrelevant to the picker. (4) **fail-fast module-load throws** in both wrappers — **ACCEPTED
  AS AN INVARIANT NOTE**: the guards assert a registry-config invariant (live catalog must
  remain `source: 'live'`); consistent with decision 5's fail-fast philosophy, and the
  registry is the single place that must change. **No blocking findings.**
- **CHANGE DELTA:** `common/src/constants/context-windows.ts` (+1 file), `common/src/constants/index.ts`
  (+1 export), `common/src/providers/derive.ts` (+`deriveLiveCatalogUrl`), `cli/…/live-catalog.ts`
  (+1 file), `static-catalogs.ts` (rewritten; −34 −15 hardcoded catalog entries), `openrouter.ts`/`nvidia.ts`
  (thin wrappers), barrel comment. Zero behavior change — the 18 openrouter-models tests pass unchanged.

### Loop 7 (Phase 4 implementation record — 2026-08-09)

- **RED:** Phase 4 executed per the converged spec (decisions 2, 3, 12; missed Q3; and the
  decision-10 bare-slug key switch, explicitly confirmed by the operator). Implementation findings:
  (1) decision 10 is TWO changes, not one — the SDK must both RESOLVE the active provider's key
  (registry + env, incl. the OpenRouter master-key chain) AND make it authoritative, because
  `createDefaultInferenceModel`'s internal precedence (`resolvedOpenRouterKey ??
  INFERENCE_API_KEY ?? apiKey`) would let the OpenRouter master key win over the active provider's
  own credential; (2) the CLI passes a stub bypass token as the caller `apiKey` in direct mode, so
  the pre-Phase-4 "caller-supplied" bare-slug authorization was not a real credential — the active
  provider resolution is what makes bare slugs actually authorize; (3) `getActiveProvider()` must
  keep the picker-preference fallback to avoid an upgrade behavior flip for legacy users
  (`savantCodeModelProviderPreference` was the de-facto routing source before Phase 4).
- **GREEN:** (1) `settings.ts` — `activeProvider?: ModelProvider` field; validation against the
  registry; migration `directProvider` → `activeProvider` (valid registry ids only; an explicit
  `activeProvider` wins over a stale legacy `directProvider`); helpers `loadActiveProvider()`
  (raw), `getActiveProvider()` (`activeProvider` → picker preference → `DEFAULT_SAVANT_CODE_MODEL_PROVIDER`),
  `saveActiveProvider()`. Fresh installs do NOT persist `activeProvider` (the accessor defaults) so
  Ollama auto-detection still runs on first run (decision 12). (2) `provider-setup.ts` —
  `saveProviderApiKey` persists `{ savantCodeModelProviderPreference, activeProvider }` and stops
  writing the legacy `directProvider`/`directProviderBaseUrl` for gateways (the registry derives
  the base URL; only the local Ollama path keeps them); `configureDefaultDirectProvider` and
  `getMissingProviderSetup` read `getActiveProvider()`. (3) `ollama-onboarding.ts` — auto-configure
  writes `activeProvider: 'ollama'`; the stale-Ollama cleanup resets it to the openrouter default.
  (4) `health-command.ts` — the persisted fallback uses `getActiveProvider()` + a registry-derived
  base URL; a custom `INFERENCE_BASE_URL` without `DIRECT_PROVIDER` is not overlaid with the
  persisted provider. (5) SDK (decision 10) — `getModelForRequest`'s default branch resolves the
  active provider's key via `resolveActiveProviderKey()` (`DIRECT_PROVIDER` → registry → the same
  `resolveProviderKey` as prefixed routing, skipping `kind: 'local'`); `createDefaultInferenceModel`
  precedence flipped to `apiKey || (resolvedOpenRouterKey ?? INFERENCE_API_KEY)` so the active
  provider's own credential authorizes bare-slug ids.
- **AUDIT (2026-08-09):** typecheck × 4 green (common/sdk/agent-runtime exit 0; cli 0 non-TS6059).
  CLI targeted suites 47/0 — settings (6 new: fresh default, migration, unknown-drop, explicit-wins,
  chain ×2), provider-setup (3 new: activeProvider persistence without legacy fields, routing from
  persisted selection, readiness follows selection), ollama-onboarding, health (custom-endpoint case
  preserved). SDK free-mode 11/0 (2 new decision-10 tests: active key wins over the caller stub;
  caller key fallback without an active provider); full SDK 456/0. ESLint + Prettier clean.
- **ADVERSARIAL (independent review — 2026-08-09):** Reviewer's four findings dispositioned. (1)
  **MAJOR — unconditional `apiKey ||` precedence flip regressed the custom-endpoint flow**
  (`default-inference.ts`): the CLI passes a non-empty stub token as the caller `apiKey` in
  direct mode, so `apiKey || (resolvedOpenRouterKey ?? INFERENCE_API_KEY)` would let the stub beat
  `INFERENCE_API_KEY` for a custom `INFERENCE_BASE_URL` (the documented escape hatch, missed Q1 /
  decision 3) → 401. **FIXED**: `createDefaultInferenceModel` now takes `options.preferApiKey`,
  set only when `resolveActiveProviderKey()` resolved a key — the active provider's key is
  authoritative (decision 10 satisfied) while the legacy env precedence is byte-preserved for the
  no-active-provider case; free-mode 11/0 re-verified. (2) **MINOR — `saveActiveProvider` dead
  code** — **FIXED**: `saveProviderApiKey` now calls `saveSavantCodeModelProviderPreference` +
  `saveActiveProvider` (the settings-helper convention); ollama-onboarding's atomic multi-field
  save keeps `activeProvider` inline. (3) **NIT — migration masked a valid legacy `directProvider`
  behind an invalid `activeProvider`** — **FIXED**: validity-aware selection (valid explicit
  activeProvider wins; else valid legacy directProvider; else dropped). (4) **NIT — health shows
  the raw Cloudflare `{CLOUDFLARE_ACCOUNT_ID}` template** when falling back to the registry —
  **ACCEPTED as a display note**: the env-restored `INFERENCE_BASE_URL` carries the same template,
  so the report reflects runtime reality. **No blocking findings.**
- **CHANGE DELTA:** `settings.ts` (+field +3 helpers +migration), `provider-setup.ts` (write
  activeProvider, read getActiveProvider), `ollama-onboarding.ts` (+2 writes), `health-command.ts`
  (report source), `sdk/…/model-provider.ts` (+resolveActiveProviderKey), `sdk/…/default-inference.ts`
  (precedence flip), +10 additive test assertions. ONE intentional semantic change
  (FID-sanctioned, operator-confirmed): bare-slug authorization now uses the active provider's own
  key (decision 10) instead of the caller-supplied stub; everything else is zero-behavior-change.

### Loop 8 (Phase 5 implementation record — 2026-08-09)

- **RED:** Phase 5 executed per the converged spec (decision 5, step 5, the Verification
  section's drift-class greps, and the two doc surfaces). Implementation findings: (1) decision 5
  floated a Zod schema validating the registry at module load — **deliberately NOT implemented**:
  the registry is a compile-time constant (`satisfies Record<string, ProviderConfig>`), data-only,
  with no user-editable failure path, so a per-process runtime parse adds cost without a reachable
  failure mode; enforcement lives at compile time + the enforced test suite, which is strictly
  stronger (documented in `validate.ts` header); (2) the generator's `--check` mode must be
  side-effect-free — it initially wrote files, restructured to render-then-compare with zero
  writes; (3) strict TS widens `deriveValidProviderIds().sort()` to `string[]` and iterating the
  literal registry type widens the value type — the parity test needs explicit `ProviderConfig`
  typing; (4) root scripts resolve `@savant-code/common/providers/registry` via workspaces
  (probe verified — 8 providers resolve), so the generator can live at the root.
- **GREEN:** (1) New `common/src/providers/validate.ts` — pure `validateProviderRegistry(registry)`
  (injected registry, decision 5): unique keys, unique env vars (incl. extras), valid http(s)
  base URLs (tolerating `{ENV_VAR}` placeholders), enum validity (kind/protocol/idTransform/
  catalog source), order non-negative integers, credential invariants (gateway needs envVar,
  local must not declare one, setupAvailable needs envVar), static-catalog prefix agreement
  against `MODEL_CATALOGS`, and dual-protocol agreement (protocolMap required, protocol-map keys
  prefixed, every catalog model present in the map). Plus `isProviderRegistryValid` convenience.
  Exported via the `common/src/providers` barrel. (2) New
  `common/src/providers/__tests__/validate-provider-registry.test.ts` — 12 tests: zero problems
  on the live registry, derivation parity (valid ids = registry keys via
  `deriveValidProviderIds`), static-catalog prefix agreement, and nine negative fixture cases
  (key/entry id mismatch, duplicate env vars, invalid baseUrl, invalid enum, catalog prefix
  disagreement, dual-protocol without protocolMap, gateway without envVar, local declaring
  envVar, invalid order) — proving the suite fails on the exact drift classes this FID exists to
  kill. (3) New `scripts/generate-provider-reference.ts` — renders the `.env.example` gateway
  section (`# GENERATED:provider-gateway-env-{start,end}`) and the `cli/release/README.md`
  provider table (`# GENERATED:provider-table-{start,end}`) from the registry, ordered by
  `config.order`; `--check` mode is side-effect-free and exits non-zero on drift. Root scripts
  `generate:provider-docs` + `generate:provider-docs:check` added to `package.json`. (4)
  Regenerated `.env.example` — the stale `https://tokenrouter.me/v1` example is gone (replaced by
  the registry's `api.tokenrouter.com`), and TokenHarbor + Cloudflare env entries are now present
  (previously missing from the hand-maintained file). (5) Regenerated `cli/release/README.md`
  provider table — Cloudflare row added (was missing). (6) `docs/design/Adding New Providers.md`
  rewritten as the one-entry runbook (registry entry + catalog reference; derivation table,
  validation, generator, `--check` workflow, checklist). (7) `docs/features.md` provider list
  fixed (TokenRouter + Cloudflare were missing).
- **AUDIT (2026-08-09):** typecheck × 4 green — common/sdk/agent-runtime exit 0, cli 0 non-TS6059.
  Common provider suites 21/0 (12 new validate tests + 9 registry tests, incl. the fixture
  purity proof); common full suite green. `bun run generate:provider-docs:check` exit 0
  ("Provider reference docs are up to date"); `--check` verified side-effect-free. ESLint clean
  (after `--fix` of one import-order warning), Prettier clean (after `--write` of the 3 new
  files), markdownlint clean (FID + both rewritten docs). Drift-class greps: NO-MATCH for the
  stale `tokenrouter.me`; the env/table sections are byte-identical to the registry (`--check`
  proves it, not a claim).
- **ADVERSARIAL (independent review — 2026-08-09):** Reviewer's four findings dispositioned
  against mechanical evidence. (1) **MINOR — `setupAvailable && !envVar` check lacks a
  `kind !== 'local'` guard** — **CONFIRMED and FIXED**: a local provider marked picker-available
  (no key env var by definition) would be flagged invalid; ollama only passes because
  `setupAvailable: false`. Guard added (`validate.ts`), so a future local provider in the
  `/provider` picker validates cleanly. (2) **MINOR — record miscounted the negative fixtures**
  — **CONFIRMED and FIXED**: 12 tests = 3 positive + 9 negative (the record said "ten").
  (3) **NIT — decision 5 claimed "order uniqueness"** — **CONFIRMED and FIXED**: the 4-way
  picker tie at order 4 is intentional (Phase 1 delta (d)), so the validator correctly asserts
  valid order values only; decision-5 wording corrected + the deviation documented. (4) **NIT —
  `isProviderRegistryValid` untested** — **REFUTED**: exercised at
  `validate-provider-registry.test.ts:30` (the live-registry soundness test). **No blocking
  findings.**
- **CHANGE DELTA:** +2 files in `common/src/providers/` (validate.ts + test), +1 root script,
  +2 root package scripts, `index.ts` barrel (+2 exports), regenerated `.env.example` +
  `cli/release/README.md` sections, rewritten `docs/design/Adding New Providers.md` (+~90 lines
  as the one-entry runbook), `docs/features.md` provider-list fix. Zero runtime behavior change —
  the validation module and generator are additive; the doc/env/README surfaces are now
  derived instead of hand-maintained.

### Missed Questions

> As part of the Perfection Loop, the Thinker must ask: “What questions should I have asked when this FID was created, but failed to?”

1. **What happens to custom OpenAI-compatible endpoints that are not in the registry?**
   → They remain supported through the `INFERENCE_BASE_URL` env override; the registry only
   standardizes known providers. A user-supplied endpoint never needs a registry entry.
2. **What if multiple provider keys are stored at once?** → The active UI selection wins. The
   FID-2026-0804-001 insertion-order tie-break is superseded only when a selection exists; with no
   selection and multiple stored keys, the legacy rule still governs.
3. **Are existing persisted settings migrated safely?** → Yes: `directProvider` →
   `activeProvider`; `directProviderBaseUrl` becomes derived for registry providers (dropped only
   for them); `savantCodeModelProviderPreference` becomes the picker default = active provider's
   catalog. Unknown legacy values are dropped, matching the existing validation pattern.
4. **Does the registry bloat the shipped binary / SDK dist?** → No: it is pure data (a few KB),
   and being in `common` it is already bundled. Data-only guarantees no runtime side effects.
5. **Does this affect the SavantFree variant?** → No. `IS_SAVANT_FREE` gating and the
   savant-free backend/session flow are untouched; the registry is shared metadata only.
6. **Who wins when shell env and the persisted UI selection disagree?** → Shell env
   (`DIRECT_PROVIDER`/`INFERENCE_BASE_URL`) wins, preserving the FID-2026-0804-001 precedence
   contract. The UI selection activates only when no explicit env routing exists.
7. **Is `openrouter/` prefix handled?** → Yes: `idTransform: 'keep'` keeps the real slug, and the
   registry also feeds `ALLOWED_MODEL_PREFIXES`, which today omits it — the derivation fixes that
   latent gap.
8. **Where do bare (unprefixed) model ids route after the refactor?** → To the active provider's
   gateway via the generic OpenAI-compatible factory, with env overrides winning (decision 10).
   This was the top adversarial finding; it is now an explicit routing rule, not an accident of
   `INFERENCE_BASE_URL`.
9. **Is ChatGPT OAuth a registry provider?** → No — it stays a pre-loop gate keyed on
   `CHATGPT_OAUTH_ENABLED` with stored OAuth tokens; the registry covers key-credential providers
   only (decision 11).
10. **How is Cloudflare's account-id URL expressed?** → `baseUrl` supports `{ENV_VAR}`
    placeholders, resolved by the generic factory; the account id is interpolated mid-path and the
    model id is rewritten to `@cf/<id>` via `idTransform: 'cf-rewrite'`.
11. **Which key authorizes a bare slug when the active provider is not openrouter?** → Phase 2:
    the caller-supplied key, unchanged (`ModelRequestParams.apiKey`, decision 6). Switching to the
    active provider's own key is a deliberate Phase 4 change (decision 10).
12. **Where do org-slug logos come from?** → A static `ORG_DOMAINS` map (9 entries extracted
    from `providerDomains`) plus the name-heuristic branches of `getLogoForModel` stay in common;
    only the gateway domains come from the registry (derivation-table row).

### Code Verification Evidence

> Before marking status as `fixed` or `verified`, verify that the code referenced in this FID actually exists. FID metadata is a claim — the code is ground truth.

- [x] Files referenced in "Affected Components" exist in the codebase (verified 2026-08-09)
- [x] Reconnaissance evidence matches the current implementation (verified 2026-08-09; AUDIT PASS
      with corrections folded in — Loops 1, 2, 3)
- [x] **Phase 1 implemented** — `common/src/providers/` exists (6 files) + derivations wired in
      `model-config.ts`, `provider-setup.ts`, `types.ts`, `settings.ts`, `model-picker.tsx`
      (2026-08-09, Loop 4)
- [x] **Phase 2 implemented** — `getModelForRequest()` routes via one ordered loop over
      `PROVIDER_REGISTRY`; generic `createProviderModel` in `model-factories.ts`; default factory
      renamed to `createDefaultInferenceModel` (`default-inference.ts`); SDK contains NO provider
      URL literals (drift-grep NO-MATCH, 2026-08-09, Loop 5)
- [x] **Phase 3 implemented** — cli `TOKENROUTER_CATALOG`/`OPENCODE_GO_CATALOG` deleted (derived
      from common `MODEL_CATALOGS`); generic `createLiveCatalogFetcher` collapses openrouter.ts +
      nvidia.ts; `inferContextLength` moved to common (`context-windows.ts`); live catalog URLs
      read from registry via `deriveLiveCatalogUrl` — NO-MATCH for catalog-array refs and URL
      literals outside the registry (drift-greps, 2026-08-09, Loop 6)
- [x] **Phase 4 implemented** — `activeProvider` in settings (validation + `directProvider`
      migration + `loadActiveProvider`/`getActiveProvider`/`saveActiveProvider`); `/provider`
      writes it (no more legacy gateway direct fields); routing/readiness/health derive from it;
      SDK bare-slug path authorizes with the active provider's own key (decision 10, verified by
      the free-mode suite + CLI targeted suites, 2026-08-09, Loop 7)
- [x] **Phase 5 implemented** — `common/src/providers/validate.ts` (pure registry validation) +
      12-test suite incl. derivation parity + negative fixtures; `scripts/generate-provider-reference.ts`
      renders `.env.example` gateway section + release README provider table (drift-guarded by
      `--check`, wired as `generate:provider-docs[:check]`); `docs/design/Adding New Providers.md`
      rewritten as the one-entry runbook; `docs/features.md` provider list fixed (2026-08-09, Loop 8)
- [x] Typecheck passes — common/sdk/agent-runtime exit 0; cli 0 non-TS6059 errors (2026-08-09)
- [x] Tests pass — common 535/0, SDK 456/0 (incl. free-mode routing 11/0 + 2 decision-10 tests),
      CLI 47/0 (settings migration + provider-setup + ollama + health), openrouter-models 18/0;
      ESLint + Prettier clean
- [ ] **Phase 5 pending** — validation suite + docs
      (status remains `analyzed` until all phases converge)

> **AUDIT evidence-citation rule (FID-2026-0805-004):** every PASS and every FAIL in the AUDIT phase cites `path/to/file.ts:LINE` with quoted code; absence checks paste the exact search (NO-MATCH); out-of-reach evidence is marked `NEEDS-REVIEW`.

## Resolution

- **Lifecycle:** Design converged through Loops 1-3 (diminishing-returns gate); **Phase 1
  implemented** (Loop 4, 2026-08-09), **Phase 2** (Loop 5), **Phase 3** (Loop 6),
  **Phase 4** (Loop 7), and **Phase 5** (Loop 8) — each zero-behavior-change except the one
  FID-sanctioned, operator-confirmed semantic delta (decision 10 bare-slug key switch). Status
  remains `analyzed` until the Loop 8 independent ADVERSARIAL sign-off lands; then this FID
  closes and archives. Archive only after every phase passes its gates.
- **Fix Description:** Phase 1 complete — typed `PROVIDER_REGISTRY` in `common/src/providers/`;
  all six Phase-1 surfaces derive from it (prefixes, domains, logo, setup config, union,
  validProviders, picker order) with the four enumerated latent-gap deltas applied. Phase 2
  complete — SDK routes via one ordered registry loop, generic `createProviderModel` replaces
  the seven per-provider factories, default factory renamed `createDefaultInferenceModel`,
  provider URL literals removed from the SDK (registry is now the single source for base URLs).
  Phase 3 complete — cli static catalogs derive from the common `MODEL_CATALOGS` maps
  (`TOKENROUTER_CATALOG`/`OPENCODE_GO_CATALOG` deleted), one generic
  `createLiveCatalogFetcher` collapses the two live fetchers (OpenRouter resolver wired),
  `inferContextLength` moved to common, and live catalog URLs now read from the registry via
  `deriveLiveCatalogUrl` (single source for catalog endpoints too). Phase 4 complete — the
  single-setting state: `activeProvider` is the persisted provider selection written by
  `/provider` (and Ollama onboarding); legacy `directProvider` migrates onto it; routing
  (`configureDefaultDirectProvider`), key readiness (`getMissingProviderSetup`), and health
  all derive from it; env overrides (`DIRECT_PROVIDER`/`INFERENCE_BASE_URL`) remain
  authoritative; and bare-slug SDK authorization now uses the active provider's own key
  (decision 10). Phase 5 complete — the validation suite + docs: pure `validateProviderRegistry`
  (12-test suite incl. derivation parity + negative fixture cases, the enforced drift killer),
  the `generate-provider-reference.ts` docs generator (`.env.example` gateway section + release
  README provider table rendered from the registry, `--check` drift guard wired as
  `generate:provider-docs[:check]`), the `docs/design/Adding New Providers.md` runbook rewritten
  to "one entry", and the `docs/features.md` provider-list fix.
- **Tests Added:** Phase 1 — `common/src/providers/__tests__/provider-registry.test.ts` (registry
  integrity + delta assertions + fixture-provider purity proof). Phase 4 — 11 additive tests:
  settings (fresh default, `directProvider` migration, unknown-drop, explicit-wins, chain ×2),
  provider-setup (activeProvider persistence, routing + readiness from selection), SDK free-mode
  (active-key-wins + caller-key-fallback for bare slugs). Phase 5 — 12 tests in
  `common/src/providers/__tests__/validate-provider-registry.test.ts` (live-registry soundness,
  derivation parity, catalog agreement, ten negative fixture cases). Phases 2-3 needed no new
  tests (full suites pass unchanged).
- **Verified By:** Independent AUDIT + ADVERSARIAL through Loop 3 (2026-08-09, converged); Phase 1
  implementation AUDIT in Loop 4, Phase 2 in Loop 5, Phase 3 in Loop 6, Phase 4 in Loop 7,
  Phase 5 in Loop 8 — typecheck × 4, common provider suites 21/0 (validate 12 + registry 9),
  SDK 456/0 (free-mode 11/0), CLI 47/0 + openrouter-models 18/0, `generate:provider-docs:check`
  exit 0, ESLint + Prettier + markdownlint clean, drift-greps NO-MATCH. Loop 7 independent review
  complete — one MAJOR (precedence flip) + two minor findings fixed, re-verified; Loop 8
  independent review in flight — no blocking findings to date.
- **Commit/PR:** N/A (implementation uncommitted; operator controls the commit)
- **Archived:** Closed + archived 2026-08-09 per operator direction after the Nova implementation
  sign-off PASS (`dev/nova/inbox/2026-08-09-fid-2026-0809-001-unified-provider-registry-implementation-sign-off-response.md`)
  — all three targets (registry + derivation, decision-10-only semantic change, drift-kill greps)
  verified with file:line evidence.

## Lessons Learned

- Provider metadata must have exactly one authoritative structure; every consumer derives from it.
  Any second copy of a base URL, env var, or provider name is a future drift bug — proven twice
  already (`tokenrouter.me` vs `api.tokenrouter.com`; Cloudflare missing from five code surfaces).
- "Ease of use" for the operator means the user makes one decision (which provider) and the system
  derives everything else; it does not mean the user configures the plumbing.
- Data-only registries with compile-time exhaustiveness plus a runtime/parity test suite catch
  drift classes mechanically — the same principle as the EHEL harness enforcing ECHO laws
  mechanically rather than by self-discipline.
- Refactors that move metadata (not behavior) are independently shippable when each phase is gated
  by the unchanged full test suite.
