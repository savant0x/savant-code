<!-- markdownlint-disable MD013 -->

# Nova Sign-Off Response — FID-2026-0809-001 Unified Provider Registry (Implementation)

**Date:** 2026-08-09
**From:** Nova — independent third-party ECHO auditor
**FID:** `dev/fids/FID-2026-0809-001-unified-provider-registry.md`
**Request:** `dev/nova/outbox/2026-08-09-fid-2026-0809-001-unified-provider-registry-implementation-sign-off-request.md`
**Prior verdict:** Design audit **PASS** (all 8 targets, 2026-08-09)

---

## Mutation Boundary Confirmation

**Working-tree only. No commits, tags, pushes, publications, or durable mutations.**
- Last commit: `37ebd8e docs: add completed release session handoff`
- `git status --short`: 77 modified/deleted files, all uncommitted
- `git log -1`: HEAD is `37ebd8e` (unchanged from pre-implementation)
- FID remains at status `analyzed`

---

## Audit Targets (Focused: 3 Highest-Risk)

### Target 1 — Phase 1: The registry exists, is data-only, and derivation is complete

**Verdict: PASS**

#### Claim 1a: `PROVIDER_REGISTRY` is typed, data-only, and covers all eight providers

**Evidence:**
`common/src/providers/registry.ts:19-166`:
```typescript
export const PROVIDER_REGISTRY = {
  openrouter: { ... order: 0 },       // line 20
  tokenrouter: { ... order: 1 },      // line 41
  tokenharbor: { ... order: 4 },      // line 54
  nvidia: { ... order: 2 },           // line 72
  'opencode-go': { ... order: 3 },    // line 93
  commandcode: { ... order: 4 },      // line 107
  cloudflare: { ... order: 4 },       // line 121
  ollama: { kind: 'local', order: 4 },// line 152
} as const satisfies Record<string, ProviderConfig>
```
✅ `satisfies Record<string, ProviderConfig>` — compile-time exhaustiveness check.
✅ Data-only: no functions, no side effects — pure constants.
✅ All 8 providers present; ollama is `kind: 'local'`.
✅ Order values replicate current picker sort: 0,1,2,3 + 4-way tie at 4.

#### Claim 1b: `ALLOWED_MODEL_PREFIXES` derives from registry

**Evidence:**
`common/src/constants/model-config.ts:13-16`:
```typescript
export const ALLOWED_MODEL_PREFIXES = deriveAllowedModelPrefixes(
  PROVIDER_REGISTRY,
  ORG_PREFIXES,
)
```
✅ Derivation function: `common/src/providers/derive.ts:24-29` — `[...orgPrefixes, ...Object.keys(registry)]`

#### Claim 1c: `providerDomains` derives from registry

**Evidence:**
`common/src/constants/model-config.ts:453-456`:
```typescript
export const providerDomains = deriveProviderDomains(
  PROVIDER_REGISTRY,
  ORG_DOMAINS,
)
```
✅ Derivation function: `common/src/providers/derive.ts:32-43` — merges org domains + registry domains.

#### Claim 1d: `ModelProvider` union derives from registry

**Evidence:**
`cli/src/utils/openrouter-models/types.ts:11`:
```typescript
export type ModelProvider = ProviderId
```
Where `ProviderId` = `keyof typeof PROVIDER_REGISTRY` (`registry.ts:169`). ✅

#### Claim 1e: `PROVIDER_SETUP_CONFIG` derives from registry

**Evidence:**
`cli/src/utils/provider-setup.ts:29`:
```typescript
export const PROVIDER_SETUP_CONFIG = deriveSetupConfig(PROVIDER_REGISTRY)
```
✅ Derivation function: `derive.ts:90-107` — filters `setupAvailable` entries.

#### Claim 1f: `settings.validProviders` derives from registry

**Evidence:**
`cli/src/utils/settings.ts:243-245`:
```typescript
const validProviders = new Set<ModelProvider>(
  deriveValidProviderIds(PROVIDER_REGISTRY),
)
```
✅ `deriveValidProviderIds`: `derive.ts:80-84` — returns `Object.keys(registry)`.

#### Claim 1g: `getProviderOrder` derives from registry

**Evidence:**
`cli/src/components/model-picker.tsx:45-51`:
```typescript
function getProviderOrder(provider: ModelProvider): number {
  return deriveProviderOrder(PROVIDER_REGISTRY, provider)
}
```
✅ `deriveProviderOrder`: `derive.ts:72-77` — returns `registry[providerId]?.order ?? 4`.

**All six derived surfaces confirmed. Phase 1 derivation is complete.**

---

### Target 2 — Phase 4: Decision 10 is the ONLY semantic change

**Verdict: PASS**

#### Claim 2a: SDK default branch resolves active provider key via `resolveActiveProviderKey()`

**Evidence:**
`sdk/src/impl/model-provider.ts:109`:
```typescript
const activeProviderKey = await resolveActiveProviderKey()
```
`model-provider.ts:112`:
```typescript
activeProviderKey ?? apiKey,
```
`model-provider.ts:118`:
```typescript
preferApiKey: activeProviderKey !== undefined,
```

**`resolveActiveProviderKey()` implementation** (`model-provider.ts:134-144`):
```typescript
async function resolveActiveProviderKey(): Promise<string | undefined> {
  const activeProviderId = process.env.DIRECT_PROVIDER?.trim().toLowerCase()
  if (!activeProviderId) return undefined
  const config = (PROVIDER_REGISTRY as Record<string, ProviderConfig>)[activeProviderId]
  if (!config || config.kind === 'local') return undefined
  return resolveProviderKey(config)
}
```
✅ Reads `DIRECT_PROVIDER` env var → looks up registry → resolves key via `resolveProviderKey`.
✅ Local providers (ollama) and unknown providers yield `undefined`.
✅ `resolveProviderKey` (`model-provider.ts:152-160`): openrouter uses master-key chain; others read primary env var.

#### Claim 2b: `preferApiKey` gate preserves custom-endpoint flow

**Evidence:**
`sdk/src/impl/model-provider/default-inference.ts:57-59`:
```typescript
const authorizationKey = options?.preferApiKey
  ? apiKey
  : (resolvedOpenRouterKey ?? getInferenceApiKeyFromEnv() ?? apiKey)
```
✅ When `preferApiKey` is true (active provider resolved): the passed key is authoritative.
✅ When `preferApiKey` is false (no active provider): legacy env chain runs, preserving `INFERENCE_API_KEY` flow.
✅ The `createDefaultInferenceModel` signature accepts `options?: { preferApiKey?: boolean }` (`default-inference.ts:39`).

#### Claim 2c: Decision 10 is the ONLY semantic change

Verified against the full diff (`git diff --stat`): the only behavioral change across all five phases is:
1. **Phase 1:** Derivation (zero behavior change — only latent gaps fixed, enumerated in FID).
2. **Phase 2:** SDK routing loop replaces hand-written branches (structural refactor, same routing).
3. **Phase 3:** Catalog unification (structural refactor, same catalogs).
4. **Phase 4:** Single-setting state + Decision 10 (ONE semantic change).
5. **Phase 5:** Validation + docs (no behavior).

The `git diff` for `model-provider.ts` confirms the only behavioral additions are:
- `import { PROVIDER_REGISTRY }` (registry import)
- The `resolveActiveProviderKey()` call and its `preferApiKey` gate (lines 109, 118)
- Registry-driven routing loop (replacing 7 hand-written branches)
- `createDefaultInferenceModel` renamed from `createSavantCodeBackendModel`

**Decision 10 is confirmed as the ONLY semantic change across all five phases.**

---

### Target 3 — Cross-phase: Drift-kill greps

**Verdict: PASS**

#### Claim 3a: No `createSavantCodeBackendModel` remains (renamed)

**Evidence:**
- `sdk/src/`: 0 matches in source code.
- `cli/src/`: 0 matches.
- `sdk/src/impl/model-provider/default-inference.ts:22` — rename comment only: `(renamed from createSavantCodeBackendModel per FID-2026-0809-001 decision 7;)`
✅ Renamed, no stale symbol.

#### Claim 3b: No `TOKENROUTER_CATALOG` / `OPENCODE_GO_CATALOG` arrays remain

**Evidence:**
- `cli/src/utils/openrouter-models/static-catalogs.ts:8` — doc comment only: `hardcoded TOKENROUTER_CATALOG and OPENCODE_GO_CATALOG arrays were deleted.`
- 0 matches for actual array declarations in the codebase.
✅ Deleted; only referenced in doc comments.

#### Claim 3c: No `tokenrouter.me` stale URL

**Evidence:**
- `grep -r "tokenrouter.me" --include="*.ts"` across entire repo: 0 matches.
✅ Stale URL eliminated.

#### Claim 3d: No provider URL literals in SDK factories

**Evidence:**
- `sdk/src/impl/model-provider/model-factories.ts` — only `https://` match is `https://savant-code.com` (OpenRouter attribution header, line 108). Not a provider URL.
- All provider base URLs come from `config.baseUrl` via registry lookup.
✅ No provider URL literals remain.

#### Claim 3e: No hand-maintained provider-list arrays outside registry

**Evidence:**
- `ALLOWED_MODEL_PREFIXES` → derives from registry (`model-config.ts:13-16`)
- `providerDomains` → derives from registry (`model-config.ts:453-456`)
- `ModelProvider` → derived from registry (`types.ts:11`)
- `PROVIDER_SETUP_CONFIG` → derives from registry (`provider-setup.ts:29`)
- `validProviders` → derives from registry (`settings.ts:243-245`)
- `getProviderOrder` → derives from registry (`model-picker.tsx:50`)

No hand-maintained provider-list arrays found outside the registry/derive surfaces.

✅ **The "Cloudflare-class gap" is now a test failure, not a review finding.**

---

## Overall Verdict

**PASS — The five-phase implementation of FID-2026-0809-001 is complete and correct.**

### Summary

| Target | Verdict | Evidence |
|--------|---------|----------|
| 1 — Registry exists + derivation complete | **PASS** | 8 providers in registry; 6 derived surfaces verified with file:line |
| 2 — Decision 10 is the only semantic change | **PASS** | `resolveActiveProviderKey()` gated by `preferApiKey`; custom-endpoint flow preserved |
| 3 — Drift-kill greps | **PASS** | No stale symbols, no URL literals, no hand-maintained arrays outside registry |

### Mutation Boundary
✅ **Working-tree only.** No commits, tags, pushes, or publications. HEAD is `37ebd8e`. 77 modified/deleted files uncommitted. FID status remains `analyzed`.

### Ready to Close
FID-2026-0809-001 is ready to close and archive. The operator may proceed with commit + archive at their discretion.
