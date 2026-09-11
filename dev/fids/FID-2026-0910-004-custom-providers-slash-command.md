# FID: User-Defined Custom Providers via /provider (Full Feature)

**Filename:** `FID-2026-0910-004-custom-providers-slash-command.md`
**ID:** FID-2026-0910-004
**Severity:** medium
**Status:** fixed (Steps 1-3 implemented 2026-09-10; Steps 4-6 implemented +
gate-verified 2026-09-11; Steps 7-10 pending separate approval)
**Created:** 2026-09-10 23:30 (converged 2026-09-10, Loops 1-4 recorded)
**YAGNI-Compliance:** Verified — every step maps to a user-facing
requirement of the full feature; no speculative abstraction beyond the
`CustomProviderConfig` record itself. YAGNI ledger entry at implementation.

---

## Summary

Users cannot add their own LLM providers at will. `PROVIDER_REGISTRY`
(`common/src/providers/registry.ts:20-261`) is a compile-time constant — adding
a provider requires a code change and a release. The only custom-endpoint
escape hatch is an undocumented env-var pair (`INFERENCE_BASE_URL` +
`INFERENCE_API_KEY`, `sdk/src/impl/model-provider/default-inference.ts:27-35`)
with no picker entry, no catalog, no prefix routing, and OpenRouter attribution
headers sent to arbitrary endpoints. This FID specifies the full feature:
users define custom providers through CLI slash commands
(`/provider add|list|remove`), custom entries become first-class registry
entries at runtime (prefix routing `custom-id/model`, live or inline catalogs,
stored keys), and every consumer surface — CLI and SDK — reads the merged
effective registry. No phased rollout: the whole feature, first build.

## Environment

- **OS:** Windows (win32, bash shell)
- **Language/Runtime:** TypeScript (strict) monorepo, Bun ≥ 1.3.14
- **Tool Versions:** `@ai-sdk/provider` v2 family, zustand stores in CLI
- **Commit/State:** `7442e05` (FID-2026-0909-008 Step 5 landed; working tree)

## Detailed Description

### Problem

The provider system is robust and centralized (FID-2026-0809-001) but
closed: the set of providers is fixed at compile time. Three concrete gaps:

1. **No user extension surface.** `PROVIDER_REGISTRY` is
   `as const satisfies Record<string, ProviderConfig>` (`registry.ts:261`);
   every surface derives from it at module load. A user wanting their company
   gateway, a self-hosted vLLM, or a niche reseller cannot add it without
   forking the CLI.
2. **The informal escape hatch is second-class.** Bare-slug model ids route to
   `INFERENCE_BASE_URL` with `INFERENCE_API_KEY` fallback authorization
   (`default-inference.ts:50-55`) — but there is no `/provider` entry, no
   catalog, no logo, no prefix routing, and when no `providerId` is threaded
   the request carries OpenRouter attribution headers
   (`default-inference.ts:73-82`).
3. **Any naive extension will drift.** The registry feeds 10+ consumer
   clusters (grep catalog in Evidence below). The "Cloudflare-class drift
   gap" — a provider present in one surface, absent in another — is exactly
   what `validate.ts:5-8` documents as the failure mode of hand-maintained
   matrices.

### Expected Behavior

A user runs `/provider add`, completes a short wizard (id, label, base URL,
optional model list, API key entered masked), and from then on:

- The custom provider appears in `/provider` (picker + list) alongside
  built-ins, clearly marked as custom.
- `/provider <custom-id>` selects it; `/provider <custom-id> update` replaces
  its key — identical UX to built-ins.
- Its models appear in the `/model` picker (fetched from
  `{baseUrl}/models` when the endpoint serves one, else from the inline list
  captured in the wizard) and `/model <exact-id>` free-text always works.
- Model ids route with a real prefix (`custom-id/model`) through the same
  registry loop as built-ins.
- The key is stored in the existing 0600 credentials file; env vars are never
  something the user has to configure (the CLI sets routing state
  in-process, as it already does for built-ins).
- `/provider edit <custom-id>` reopens the wizard pre-filled with the
  current definition (label, base URL, models, key); the id is immutable in
  edit mode.
- `/provider remove <custom-id>` deletes it; built-ins cannot be removed.
- Embedded SDK consumers can pass the same definitions via
  `SavantCodeClient({ customProviders })`.

### Root Cause

Not a defect — an architectural boundary. The registry was intentionally made
compile-time-only for bundle safety and validation strength
(`types.ts:6-8`: "data-only… serializable, bundle-safe for `bun --compile`").
That constraint is correct and is preserved here: user extensions are **data
(validated JSON), never code**. What is missing is the runtime half: a
validated merge of user-authored provider records into the same typed,
validated, derived pipeline.

### Evidence

**Consumer catalog (grep-verified 2026-09-10, this session):**

| # | Cluster | Sites |
|---|---------|-------|
| C1 | SDK routing | `sdk/src/impl/model-provider.ts:17,87,116,165` (import, prefix loop, active-config lookup, active-key lookup) |
| C2 | Setup derivation | `cli/src/utils/provider-key-store.ts:27` (`PROVIDER_SETUP_CONFIG = deriveSetupConfig(...)`), `:29` (`ProviderSetupName = keyof typeof …`), `:40,56,74-77,128,200-202` |
| C3 | Settings validation | `cli/src/utils/settings/validation.ts:3,125-126,130,149,152,156` (`validProviders` Set from `deriveValidProviderIds`) |
| C4 | Picker + grouping | `cli/src/commands/defs/model-provider-commands.ts:14,70-80,107`; `cli/src/state/provider-picker-store.ts:14-18` (typed on `ProviderSetupName`); `cli/src/components/model-picker-grouping.ts:2,30` |
| C5 | Catalog fetchers | `cli/src/utils/openrouter-models/{openrouter,nvidia,nous,kiosapi,apinex,opencode-zen}.ts` (module-level `deriveLiveCatalogUrl(PROVIDER_REGISTRY, …)` consts) |
| C6 | Health | `cli/src/commands/health-command.ts:1,42` |
| C7 | Model-prefix derivation | `common/src/constants/model-config/aggregate.ts:34-37` (`ALLOWED_MODEL_PREFIXES = deriveAllowedModelPrefixes(PROVIDER_REGISTRY, ORG_PREFIXES)`), re-exported `model-config.ts:5` → `old-constants.ts:12` chain |
| C8 | Model validation | `common/src/types/dynamic-agent-template.ts:3,12` (filters built-in `models` by prefixes at module load) |
| C9 | Registry internals | `common/src/providers/{types,derive,validate,audit,org}.ts` — all derive/validate functions are pure over an injected registry (the designed extension seam) |
| C10 | Type coupling | `cli/src/utils/openrouter-models/types.ts:11` (`ModelProvider = ProviderId` literal union); consumed by `settings/types.ts:33,42` |

**Cross-workspace check:** `desktop/` and `savant-free/` have zero registry
consumers (grep: 0 matches). `evals/v2/src/runners/savant.ts:42` constructs
`SavantCodeClient` directly — it inherits the registration seam automatically.

**Key-flow verification (bare-slug path):** CLI builds `SavantCodeClient` with
an apiKey (`cli/src/utils/savant-code-client.ts:53-80`) → SDK
`prepareLlmStreamRequest` → `getModelForRequest` (`stream-request-setup.ts:50-56`)
→ registry loop or bare-slug fallback (`model-provider.ts:87-141`). When
`DIRECT_PROVIDER` names an unknown id, the active-provider lookup misses and
the request falls to `createDefaultInferenceModel` — this is today's entire
custom-endpoint story.

**Collision surface:** `ORG_PREFIXES` (`common/src/providers/org.ts:13-27`)
holds 12 org slugs (anthropic, openai, …) that are routing prefixes but not
registry entries — a custom id colliding with one of these would be shadowed
by bare-slug org routing. Built-in env vars are claimed via `claimEnvVar`
(`validate.ts:73-92`) — reusable to stop a custom entry claiming
`OPENROUTER_API_KEY`.

**Interactive machinery already provider-agnostic:** `/provider <name>` →
`beginProviderSetup` → `getProviderSetupInfo` → masked key prompt
(`inputMode: 'providerSetup'`, `input-modes.ts:16`) →
`route-user-prompt.ts:129-146` → `saveProviderApiKey` → credentials.json.
The wizard extends this pattern; it does not replace it.

## Impact Assessment

### Affected Components

- `common/src/providers/` — new `custom.ts` (type + validation) and `merged.ts`
  (registration + effective registry); `types.ts` gains an `inline` catalog
  variant; `derive.ts`/`validate.ts` unchanged (already injected-pure)
- `common/src/types/dynamic-agent-template.ts` — model-prefix seam (audit
  item A3 decides the exact shape)
- `sdk/src/client.ts` — constructor option + registration
- `sdk/src/impl/model-provider.ts` — three registry reads → effective view
- `cli/src/utils/settings/{types,validation}.ts` — `customProviders` field,
  widened provider-id validation
- `cli/src/utils/provider-key-store.ts`, `provider-setup.ts` — effective setup
  view, key application, activation
- `cli/src/utils/input-modes.ts`, `chat-store`, `route-user-prompt.ts` —
  `providerAdd` wizard mode + step machine
- `cli/src/commands/defs/model-provider-commands.ts` — `add|list|remove`
  grammar + picker inclusion
- `cli/src/utils/openrouter-models/` — `ModelProvider` widening, custom
  catalog fetcher, picker merge
- `cli/src/components/model-picker-grouping.ts`, `health-command.ts` —
  effective registry reads

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists (env-var pair works today,
      undocumented; the risk here is refactor blast radius across C1–C10)
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

**Core move:** user-defined providers become first-class registry entries at
runtime. A pure merge in common, a registration seam on the SDK client, and a
CLI wizard — with built-ins always winning on collision.

```text
/provider add wizard (CLI)
  └→ settings.json customProviders[] + credentials.json key (0600)
       └→ CLI boot: load + validateCustomProviders (fail-closed)
            └→ registerCustomProviders(list)          ← common/src/providers/merged.ts
                 └→ getEffectiveProviderRegistry()     ← pure merge, cached
                      ├→ CLI surfaces (C2-C6, C9): picker, list, keys,
                      │   settings validation, health, grouping, catalogs
                      └→ SDK (C1): getModelForRequest prefix loop,
                          active-provider lookups via SavantCodeClient
                           constructor registration
```

**Design decisions (converged with operator, 2026-09-10):**

- **D1 — Declarative only.** Custom providers are `CustomProviderConfig`
  data: `{ id, label, baseUrl, apiKeyEnvVar, catalog }`. No JS plugin loading
  (arbitrary-code-execution surface; breaks bundle safety). Constrained
  shape for custom entries: `kind: 'gateway'`, `protocol: 'openai'`,
  `idTransform: 'strip'`, no `resolver` (their own env var only), no
  `protocolMap`.
- **D2 — Built-ins win.** A custom id colliding with a registry id or an
  `ORG_PREFIXES` slug is rejected at validation, never silently shadowed.
  `apiKeyEnvVar` must not collide with any built-in claimed env var or the
  research BYOK env vars.
- **D3 — New catalog variant.** `ProviderConfig.catalog` gains
  `{ source: 'inline'; models: Record<string, string> }` (model ids carry the
  custom prefix, mirroring the static-catalog invariant at
  `validate.ts:166-175`). Custom providers use live (`{baseUrl}/models` or an
  explicit catalog URL), inline, or none.
- **D4 — Effective registry in common.** `registerCustomProviders(list)`
  validates the whole merged view with the existing `validateProviderRegistry`
  (env-var claims, URL parsing, catalog invariants — all reused, zero new
  validation logic) and caches the merge; `getEffectiveProviderRegistry()`
  returns it; `resetCustomProviders()` is the test seam. Registration is
  fail-closed: an invalid list throws at registration, never at request time.
  Lifecycle rule (Loop 3): registration is an idempotent **replace** — a
  registration call with a valid list always replaces the current custom set;
  a `SavantCodeClient` constructed *without* `customProviders` (e.g. evals'
  direct construction at `evals/v2/src/runners/savant.ts:42`) must never
  clear a previously registered set.
- **D5 — SDK seam.** `SavantCodeClient` constructor gains
  `customProviders?: CustomProviderConfig[]`; construction registers them
  before any run. Module-level set-once state — the same communication
  pattern the CLI already uses for routing (`DIRECT_PROVIDER` et al.), and
  the only seam that works for both the CLI and embedded SDK consumers.
- **D6 — Key storage reuses everything.** Custom keys live in the existing
  credentials store under `apiKeyEnvVar`; `applyPersistedProviderApiKeys`
  extended to the effective setup view; `resolveProviderKey` unchanged (reads
  `process.env[envVar]`).
- **D7 — Wizard.** New `providerAdd` input mode with a step machine
  (id → label → base URL → optional models → masked key), mirroring the
  `providerSetup` single-field pattern; per-step validation with inline
  re-prompt; Escape exits; final step writes settings + key and activates.
  The same step machine serves `/provider edit <id>` pre-filled with the
  current definition (one state machine, two entry modes — Law 13): the id
  step is locked in edit mode (identity + routing prefix; rename is remove
  + re-add by design), the key step keeps the stored key when submitted
  empty, saves are fail-closed (validation on the edited definition; an
  invalid edit leaves the stored one untouched), and if the edited provider
  is active with a changed baseUrl, activation state re-applies so routing
  picks the change up immediately.
- **D8 — Type widening.** `ModelProvider = ProviderId | (string & {})` and
  `ProviderSetupName` similarly — autocomplete preserved for built-ins,
  custom ids legal as strings, runtime truth always the effective-registry
  id set.
- **D9 — Logo/order defaults.** Custom providers carry no `domain` (default
  logo; `deriveProviderOrder`-style lookups return their `order: 5`, grouping
  them after built-ins in pickers).
- **D10 — Runtime degradation is not phasing.** Live catalog fetch fails or
  shape unrecognized → inline list → free-text `/model`. All error paths
  handled (Law 14); nothing silently absent.

### Steps

1. **common — custom provider type + validation.** `CustomProviderConfig`,
   `validateCustomProviders(parsed: JSONValue): CustomProviderConfig[]`
   (id slug `[a-z0-9-]{2,32}`, label, http(s) baseUrl reusing the
   `parseRegistryUrl` pattern, env-var shape + collision set, catalog
   variant), `inline` catalog variant in `ProviderConfig`, extension of
   `validateProviderRegistry` for inline catalogs + order-5 customs. RED-first
   pin suite.
2. **common — merged registry.** `merged.ts`: registration, cached effective
   view, reset seam; conversion of custom entries to full `ProviderConfig`;
   merged-view validation; prefix list recomputation
   (`deriveAllowedModelPrefixes(effective, ORG_PREFIXES)`). Pin suite: merge
   rules, collision fail-closed, env-var claims.
3. **common — model-validation seam.** Investigate how
   `dynamic-agent-template.ts:3,12` consumes `ALLOWED_MODEL_PREFIXES`
   (a module-load filter over the static `models` map): determine whether a
   custom-prefixed model id is validated against the prefix list at
   template-validation time, and make the seam consult the effective
   registry's prefix list (registered before any template validation runs).
   Pin: a custom-prefixed model passes template validation when its provider
   is registered, and fails when it is not.
4. **SDK — registration + routing.** `client.ts` option + registration
   (respecting the D4 lifecycle rule); `model-provider.ts` C1 sites →
   `getEffectiveProviderRegistry()`. Pins: prefixed custom model routes via
   `createProviderModel`; active custom provider authorizes bare slugs with
   its own key; invalid registration throws at construction; construction
   without the option preserves an existing registration. Repo-validation
   note: `scripts/validate-repository.ts:218-222` audits the **built-in**
   registry against the exception manifest — it keeps auditing built-ins
   only; custom providers are user data, not shipped surface, and must not
   enter the manifest/URL-ownership audits.
5. **CLI — settings.** `customProviders` in `Settings` + validation (C3) with
   widened ids; loader wiring.
6. **CLI — key store + setup.** Effective setup view (C2), custom env-var
   application, `saveProviderApiKey`/`activateConfiguredProvider`/
   `getConfiguredProviderNames`/`configureDefaultDirectProvider` through the
   effective view; research-env-var collision guard. Pins per function.
7. **CLI — wizard.** `providerAdd` input mode + config, step-machine state
   (add + pre-filled edit modes per D7), `route-user-prompt.ts` handlers,
   writes on completion. Pin suite for the step machine: add paths, edit
   prefill, id immutability, fail-closed save on invalid edit, key-kept-on-
   empty, re-activation on baseUrl change, invalid re-prompts, escape.
8. **CLI — commands + picker + docs.** `add|list|edit|remove` grammar (C4;
    `edit <id>` and `remove <id>` are custom-only), remove warns when
    removing the active provider and resets selection to default; picker
    includes customs with configured badge; user-facing docs for the feature
    (provider section of the README/docs) — Law 9.
9. **CLI — model picker.** `ModelProvider` widening (C10), generic custom
   catalog fetcher with degradation ladder (D10), grouping via effective
   order (D9), picker merge. Pins for merge + degradation.
10. **CLI — health + Law 4.** Health command effective lookup (C6); grep
    call-graph proof for every new wiring edge (registration → merge → each
    consumer), including a grep proving the repo-validation scripts still
    reference the built-in registry only.

### Verification

- Typecheck ×4: `common`, `sdk`, `packages/agent-runtime`, `cli` (repo hard
  gate; agent-runtime included though unchanged).
- New pin suites per step (RED-first), existing suites green:
  common providers suite, sdk model-provider suite, cli settings/provider
  suites (incl. `provider-setup-gateway/-research/-update` regressions),
  model-picker grouping suite.
- `bun x eslint . --max-warnings 0`, prettier, `lint:md` on touched files.
- Law 4: every new wiring edge grep-verified (registration call site →
  effective-registry consumers).
- Security pins: built-in-id collision rejected; `OPENROUTER_API_KEY` claim
  by a custom entry rejected; key material never logged (existing sanitizer
  suite stays green).

## Verification Gates

> Declared per FID-2026-0823-009 (planning record — stamped with
> `bun run fid:verify <fid-path> --write` at implementation time).

- gate: typecheck common
- gate: typecheck sdk
- gate: typecheck packages/agent-runtime
- gate: typecheck cli
- gate: test common/src/providers/__tests__/custom-providers.test.ts
- gate: test sdk/src/impl/__tests__/model-provider-custom.test.ts
- gate: test cli/src/utils/__tests__/provider-key-store-custom.test.ts
- gate: test cli/src/commands/__tests__/provider-add-wizard.test.ts

## Perfection Loop

### Loop 1 — RED

- **RED:** Gaps cataloged (Problem 1-3) with the 10-cluster consumer map
  (C1-C10), cross-workspace coverage (desktop/savant-free zero consumers;
  evals inherits the seam), collision surfaces (registry ids +
  `ORG_PREFIXES` + env-var claims), type couplings (`ModelProvider`,
  `ProviderSetupName` literal unions), and the existing key-flow trace.
  Design converged with the operator over three rounds: feasibility →
  slash-command UX (not env config) → full feature, no phased rollout.
- **GREEN:** Approach D1-D10 + Steps 1-10 above. Key insights the design
  exploits: every derive/validate function is already pure-over-injected
  registry (`derive.ts:4-9`, `validate.ts:4-8`) — the extension seam was
  designed in at FID-2026-0809-001; the bare-slug custom-endpoint path
  proves arbitrary OpenAI-compatible transport works today.
- **AUDIT:** pending — runs after authoring; results recorded below before
  status moves.
- **ADVERSARIAL:** pending.
- **CHANGE DELTA:** n/a (initial authorship).

### Missed Questions

> Surfaced and answered with the most robust default derivable from
> inspection; folded into the sections above.

1. **What if a custom provider is removed while it is the active provider?**
   Next prompt would fail routing. Remove flow warns and resets
   `activeProvider` to the default (Step 8) — no silent broken state.
2. **Could a custom entry exfiltrate a built-in's key?** No — it declares its
   own `apiKeyEnvVar`; `resolveProviderKey` reads only that var; collision
   with claimed built-in vars is rejected (D2, reusing `claimEnvVar`).
   Research BYOK vars are added to the claimed set (Step 6).
3. **Do OpenRouter attribution headers leak onto custom endpoints?** No —
   prefix path sends them only for `config.id === 'openrouter'`
   (`model-factories.ts:134-140`); active-provider threading makes
   `isOpenRouterCompatible` false for custom ids (`default-inference.ts:57-58`).
4. **Bundle safety after this change?** Unaffected — user providers are data
   read from settings.json; no dynamic imports; the built-in registry stays
   compile-time.
5. **Retries/sanitization for custom endpoints?** Inherited —
   `createProviderModel` wraps fetch with `createSanitizingFetch` +
   `fetchWithRetryableNetworkErrors` (`model-factories.ts:77-79`).
6. **Cost/usage metadata for customs?** Same as built-in non-OpenRouter
   gateways today (no usage extractor) — parity, not a regression.
7. **Concurrent CLI instances writing settings.json?** `writeFileAtomic`
   last-wins — the existing behavior for all settings; documented.
8. **Do subagents inherit custom models?** Yes — `withParentModel`
   (`spawn-agent-utils.ts:257`) unconditionally overrides the child's model
   with the parent's on both spawn paths, so a custom-prefixed id propagates;
   the child's request resolves through the same process's effective registry
   (registration already done at client construction).
9. **What does the wizard do about models when the endpoint has no
   `/models`?** The models step is optional; the degradation ladder (D10)
   makes the picker functional with zero catalog.
10. **Windows paths/permissions for the new artifacts?** No new artifacts —
    settings.json and credentials.json IO is existing, platform-tested code.
11. **Do the repo-validation scripts break when customs exist?**
    `scripts/validate-repository.ts:218-222` (`validateProviderAudit` +
    `validateProviderUrlOwnership`) must keep auditing the built-in registry
    only — custom providers are user data, not shipped surface. Entering the
    merged view into those audits would produce false drift signals. Folded
    into Step 4 + Step 10.
12. **How is a custom provider's definition edited?** Via
    `/provider edit <id>` — the same `providerAdd` step machine pre-filled
    with current values (D7). The id is immutable in edit mode: it is the
    routing prefix and identity; renaming is remove + re-add by design, so
    no shadowed-prefix or stale-catalog cleanup problem can arise. Saves are
    fail-closed; an active provider whose baseUrl changed re-applies
    activation so routing updates immediately. Folded into Steps 7-8.

### Implementation Evidence (REQUIRED for `closed`)

> Partial — Steps 1-3 (common layer) implemented and verified 2026-09-10;
> Steps 4-6 (SDK seam, CLI settings, CLI key store/setup) implemented and
> gate-verified 2026-09-11. Steps 7-10 remain pending separate approval; the
> section fills in fully at `closed`.

**Steps 1-3 — implemented (RED-first):**

- **Step 1 (`CustomProviderConfig` + parser/validator):** `implemented` —
  `common/src/providers/types.ts:111-142` (`CustomProviderConfig` record,
  flat JSON-shaped subset of `ProviderConfig`),
  `common/src/providers/custom-providers.ts` `parseCustomProviders` /
  `parseCustomCatalog` (returns `{ configs, problems }`, never throws),
  `common/src/providers/validate.ts` (`'inline'` added to `CATALOG_SOURCES`,
  `validateCustomProviders` extends the existing registry validator — one
  validation truth). Fail-closed per entry.
- **Step 2 (merged effective registry):** `implemented` —
  `common/src/providers/custom-providers.ts` `registerCustomProviders` /
  `getEffectiveProviderRegistry` / `resetCustomProviders`; built-ins win by
  construction (merge is a spread where customs are applied first, then
  shadow-guarded: a custom id colliding with a built-in id **throws**);
  `toProviderConfig` lifts a custom record into a full `ProviderConfig`;
  effective view re-validates via `validateProviderRegistry`.
- **Step 3 (template seam):** `implemented` as **dead-code removal** — the
  FID's own Step 3 premise was falsified during RED investigation: no model
  validation ever ran at template-validation time, and `filteredModels` was
  computed, guarded, and never consumed. Removed from
  `common/src/types/dynamic-agent-template.ts` and pinned by a test asserting
  the module no longer computes it. Per the FID's own "pin either way"
  clause; operator-visible in Loop 1 findings.

**Gates (pasted in session transcript):** typecheck ×4 exit 0 (sdk, common,
agent-runtime, cli); provider suites 51 pass / 0 fail (334 expect calls) —
new pin suite `custom-providers.test.ts` RED-first (module absent, then
failing pins, then green); full common suite 686 pass / 4 skip / 0 fail;
eslint 0 problems; prettier clean. RED process caught a real D2 gap: the
id-shadowing guard was added after the pin suite exposed silent built-in
overwrite.

- [x] File:line ranges (Steps 1-3)
- [x] Gate output (Steps 1-3)
- [x] Commit SHA — implementation `7f95b38f` (source, 5 files) + governance
      record `abbcc7b3` (FID + ledger + SCOPE), landed 2026-09-10
- [x] Steps 4-6 statuses — implemented + gate-verified 2026-09-11 (below)
- [ ] Steps 7-10 statuses — pending implementation (separate approval)

**Steps 4-6 — implemented (2026-09-10, crashed session) + re-grounded and
gate-verified (2026-09-11 fix pass):**

- **Step 4 (SDK registration + routing):** `implemented` —
  `sdk/src/client.ts:2,42` (constructor registers `options.customProviders`
  via `registerCustomProviders`, honoring the D4 idempotent-replace
  lifecycle), `sdk/src/run/execution.ts:3,95` (standalone `run()` seam),
  `sdk/src/impl/model-provider.ts:18,91,120,170` (the C1 registry reads →
  `getEffectiveProviderRegistry()`). Pins:
  `sdk/src/__tests__/client-custom-providers.test.ts` (replace semantics,
  no-op without the option, built-ins preserved) and
  `sdk/src/impl/__tests__/model-provider-custom.test.ts` (prefixed routing
  via the effective view, active-custom key authorization,
  invalid-registration throw at construction).
- **Step 5 (CLI settings):** `implemented` —
  `cli/src/utils/settings/types.ts:77` (`customProviders?:
  CustomProviderConfig[]`), `cli/src/utils/settings/validation.ts:131-136`
  (`validProviders` union of built-ins + effective registry), `:190-196`
  (per-entry fail-closed preservation via `parseCustomProviders` — the save
  round-trip never erases user data), `cli/src/utils/settings/io.ts:50-58`
  (register-before-validate in `loadSettings`, fail-closed to `{}`). Pins:
  `cli/src/utils/settings/__tests__/settings-custom-providers.test.ts`
  (preservation, per-entry drop, round-trip, effective-view acceptance).
- **Step 6 (CLI key store + setup):** `implemented` —
  `cli/src/utils/provider-key-store.ts:57-62`
  (`getEffectiveProviderSetupConfig` — the same `deriveSetupConfig` over the
  effective registry, Law 13), `:42-45` (`ProviderSetupName` D8 widening),
  `:64-73` (`getProviderSetupInfo` through the effective view), `:147-210`
  (`saveProviderApiKey` accepts custom ids), `:118-145`
  (`configureDefaultDirectProvider`), `:226-231` (`getConfiguredProviderKey`),
  `:232-240` (`getConfiguredProviderNames`); `cli/src/utils/provider-setup.ts:52,96`
  (activation through the effective view). Pins:
  `cli/src/utils/__tests__/provider-key-store-custom.test.ts` (6 tests — key
  store, names, activation, shell precedence).
- **Law 4 call-graph evidence (grep-verified 2026-09-11):** the Step 2 common
  module is now production-reachable. Registration sites: `client.ts:42`,
  `execution.ts:95`, `io.ts:56`. Effective-view consumers:
  `model-provider.ts:91,120,170` (C1), `validation.ts:134` (C3),
  `provider-key-store.ts:61` (C2 → every setup surface), `provider-setup.ts`
  (activation). Repo-validation stays built-in-only per MQ11:
  `scripts/validate-repository.ts:11,218,222` imports and audits
  `PROVIDER_REGISTRY`; `getEffectiveProviderRegistry` has zero matches under
  `scripts/`.
- **Known deviation (recorded):** the settings type seams
  (`saveSavantCodeModelProviderPreference` / `saveActiveProvider` call sites
  in `saveProviderApiKey` and one test assertion) take a runtime-validated
  cast on `ModelProvider` until Step 9's union widening — the documented
  validation.ts-precedent stopgap, not a silent shortcut.
- **Gates (2026-09-11, own-run — full output in the session summary):**
  typecheck ×4 exit 0 (cli, sdk, common, packages/agent-runtime); cli
  provider/settings suites 60 pass / 0 fail (141 expect calls, 8 files); sdk
  client/model-provider suites 51 pass / 0 fail (95 expect calls, 12 files);
  common provider suites 51 pass / 0 fail (334 expect calls, 4 files); eslint
  `--max-warnings 0` on the 12 touched files → 0 problems; prettier
  `--check` → clean. The fix pass itself (wrong-module import,
  env-override self-delete harness bug, delete-narrowing, D8 widening +
  bridge casts, import-order) is recorded in
  `dev/session-summaries/2026-09-11-1038-custom-providers-steps-4-6-session-docs.md`.

### Code Verification Evidence

- [x] Files referenced in Affected Components exist — verified for the
      current-state citations during RED (grep catalog above)
- [x] Implementation matches the Proposed Solution for Steps 1-3 — Step 3
      deviation (dead-code removal instead of seam validation) documented
      above with the falsifying evidence
- [x] Typecheck/tests/lint pass with pasted tool output (Steps 1-3)
- [x] Production call-graph evidence for new wiring — Steps 4-6 edges
      grep-verified 2026-09-11 (registration: `client.ts:42`, `execution.ts:95`,
      `io.ts:56`; consumers: `model-provider.ts:91,120,170`,
      `validation.ts:134`, `provider-key-store.ts:61`; repo-validation
      built-in-only confirmed — zero `getEffectiveProviderRegistry` matches
      under `scripts/`)
- [ ] FID status reflects actual implementation state — `fixed`, Steps 7-10
      pending (Steps 4-6 documented above)

### Loop 5 — Steps 1-3 implementation (RED-first)

- **RED:** Pin suite written against the not-yet-existing module — failing
  output captured (module absent; then two pin corrections of my own contract
  ambiguity, re-captured before GREEN; then failing behavior pins). RED
  investigation falsified Step 3's premise: no template-time model validation
  exists, and `filteredModels` was dead code — implemented as removal, per
  the step's "pin either way" clause.
- **GREEN:** The pin process caught a real D2 gap — `registerCustomProviders`
  silently overwrote a built-in id ('openrouter') — fixed with a fail-closed
  throw. Typechecker caught a second real defect: `PROVIDER_REGISTRY`'s
  heterogeneous entry types didn't carry `extra` through `Object.values` —
  fixed by typing the helper input structurally. Final: 51/0 provider
  suites, 686/4/0 full common, typecheck ×4 exit 0, eslint/prettier clean.
- **Self-correction honesty:** one Law 1 slip (cited `ProviderId`'s location
  from the wrong file) caught and corrected by re-grepping before edit.

- **RED:** Fresh-evidence audit against the authored document — every
  load-bearing citation re-grepped. Findings: (F1) Step 3 referenced a
  dangling "audit item A3" label — no such item existed; rewritten as a
  self-contained step. (F2) Missed surface: `scripts/validate-repository.ts`
  (lines 218-222) audits the built-in registry against the provider exception
  manifest and URL ownership — the FID never stated how the merged view
  interacts with it; resolved: repo-validation audits stay built-in-only
  (customs are user data, not shipped surface), recorded in D4-adjacent Step
  4/10 notes + MQ11. (F3) Registration lifecycle underspecified: repeated
  client construction (evals constructs `SavantCodeClient` directly at
  `evals/v2/src/runners/savant.ts:42`) could clear a valid registration;
  resolved: idempotent-replace semantics with no-op-when-absent
  (D4 amendment). (F4) MQ8's inheritance claim lacked its citation; verified
  on disk (`withParentModel` override documented at CHANGELOG:1107-1108,
  helper at `spawn-agent-utils.ts:257`) and added. (F5) Docs deliverable
  missing from Steps (Law 9); folded into Step 8.
- **GREEN:** All five findings corrected in-place (Steps 3/4/8/10, D4,
  MQ8, MQ11). No design-level changes required — the corrections narrow
  scope precisely (repo-validation exclusion) or remove ambiguity
  (lifecycle rule).
- **AUDIT:** Corrections verified by re-read of the amended sections;
  `AGENTS.md` validation block re-checked — typecheck ×4 (sdk, common,
  agent-runtime, cli) confirmed as the repo hard gate; the FID's declared
  gates match it plus the four new pin suites. Citation spot-checks passed:
  `aggregate.ts:34-37` (prefix derivation), `default-inference.ts:51-58`
  (key chain + `isOpenRouterCompatible`), `org.ts:13-27` (ORG_PREFIXES),
  `input-modes.ts:8-20` (InputMode union).
- **ADVERSARIAL:** Residual challenge: is the D5 module-level set-once
  registration state acceptable given the SDK is embeddable? Answer on
  record: it is the same process-global communication pattern the CLI
  already uses for routing (`DIRECT_PROVIDER`/`INFERENCE_BASE_URL` env
  vars read by the SDK), it is set-once at construction, and the alternative
  (threading the registry through every stream-param chain) touches dozens
  of call sites for zero additional isolation — module-level state is the
  honest existing idiom of this codebase. Second challenge: could the
  `deriveSetupConfig` literal-type machinery break at runtime? No — type
  erasure affects only compile-time unions; the runtime values derive from
  whatever record is passed; D8 widens the *types*, not the runtime logic.
- **CHANGE DELTA:** ~6% (corrections within an unchanged architecture;
  below the 10% circuit breaker).

### Loop 3 — Final convergence

- **RED:** Re-read of the full document post-corrections. Remaining risks
  are implementation-phase unknowns (exact `dynamic-agent-template` seam
  shape is an investigation with a pinned answer required either way; wizard
  UX details are specified but unexercised) — these are Step-level work, not
  design gaps. No unresolved contradictions found.
- **GREEN:** Status set to `converged`. Perfection-loop termination
  criterion met: the deep audit yields no further actionable design
  improvements; remaining items are enumerated implementation steps with
  declared gates.
- **AUDIT:** Termination evidence: Missed Questions answered 11/11 with
  disk-verified citations; consumer catalog complete (10 clusters,
  cross-workspace checked); collision surfaces enumerated (registry ids,
  ORG_PREFIXES, claimed env vars, research BYOK vars); repo-validation
  interaction resolved; lifecycle rule recorded; docs deliverable in scope.
- **ADVERSARIAL:** Final position: the design is implementable as written;
  the one genuinely novel decision (D5 registration seam) carries a recorded
  justification and a named alternative that was rejected for cause. No
  unevidenced PASS claims in this document — implementation evidence remains
  explicitly unclaimed (status `converged`, not `fixed`).
- **CHANGE DELTA:** ~3% (Loop 3 polish). Convergence: Loop 2 ~6%, Loop 3
  ~3% — delta < 2% threshold not required to trigger; convergence detected
  by zero actionable improvements across two consecutive passes.

### Loop 4 — Post-convergence amendment (operator directive)

- **RED:** Operator question — "is there a way to edit/remove a custom
  provider?" — exposed a gap: remove and key replacement were specified,
  but definition editing (label, base URL, models) existed only as an
  implicit remove + re-add, which loses the stored key and replays the
  wizard. Operator approved folding an explicit edit flow in.
- **GREEN:** `/provider edit <id>` added — same `providerAdd` step machine
  pre-filled (one state machine, two entry modes; Law 13), id immutable in
  edit mode, key step keeps the stored key on empty entry, fail-closed save,
  re-activation on baseUrl change. Also caught during this pass: D1 carried
  "v1" terminology residue from the rejected phased proposal — reworded
  (the constraint is a shape constraint, not a version). Expected Behavior,
  Steps 7-8, D7, and MQ12 updated.
- **AUDIT:** Amendment verified by re-read; delta ~2% (below the 10%
  circuit breaker). Declared gates unchanged — the wizard pin suite now
  covers edit paths (prefill, immutability, fail-closed save,
  re-activation). Markdown gates re-run clean.
- **ADVERSARIAL:** Challenge: does edit mode undermine id-based routing
  integrity? No — the id field is locked; only mutable metadata changes,
  and re-activation re-applies routing state in-process (the same mechanism
  built-in selection uses). Second challenge: is prefill a second code
  path? No — same step machine, different initial state; the pin suite
  proves both entry modes.
- **CHANGE DELTA:** ~2%. Status re-affirmed `converged`.

### Loop 6 — Steps 4-6 implementation evidence (2026-09-11)

- **RED:** The crashed prior session implemented Steps 4-6 but never ran
  gates; this pass re-grounded and ran the full battery first: 10 TS errors,
  8 eslint import/order warnings, 2 failing tests, and a harness defect (the
  new key-store suite's `beforeEach` deleted its own
  `SAVANT_CODE_CONFIG_DIR` override, polluting the real config dir) — all
  captured before fixing.
- **GREEN:** Fix pass (~50 lines): wrong-module import corrected,
  `SAVANT_CODE_CONFIG_DIR` removed from the harness clear-list, two
  delete-narrowed env reads fixed, `ProviderSetupName` widened to the D8
  shape with the validation.ts-precedent bridge casts at four settings-save
  sites, import-order across 5 files. Battery re-run fully green (evidence
  above).
- **AUDIT:** Every Steps 4-6 citation in this section grep-verified on disk
  at write time (registration sites, effective-view consumers, test files,
  line ranges). MQ11 re-verified: `scripts/validate-repository.ts` imports
  and audits `PROVIDER_REGISTRY` only (`:11,:218,:222`).
- **ADVERSARIAL:** The casts are the honest residue: they are runtime-
  validated (the effective-setup lookup precedes every save) and are retired
  by Step 9. Status remains `fixed`, not `closed` — Steps 7-10 are pending
  separate operator approval.
- **CHANGE DELTA:** <5% of the FID (evidence + status lines); circuit
  breaker not triggered.

## Resolution

- **Closed Date:** —
- **Fix Description:** —
- **Tests Added:** —
- **Verification Evidence:** —
- **Archived:** —

## Lessons Learned

- The FID-2026-0809-001 decision to make every registry consumer pure-over-
  injected-registry is what makes this feature cheap: no validation logic is
  rewritten, only re-pointed at a merged view. Designing extension seams in
  up front pays for itself.
- "Data-only" registries and user extensibility are not in tension — the
  resolution is validated data (JSON) with fail-closed merge rules, never
  executable configuration.
- The informal escape hatch (env-var pair) was simultaneously proof the
  transport layer worked and a trap (undiscoverable, header-leaking,
  prefix-less). Formalizing an escape hatch is cheaper than leaving it
  half-documented.
