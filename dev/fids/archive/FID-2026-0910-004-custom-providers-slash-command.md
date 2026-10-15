# FID: User-Defined Custom Providers via /provider (Full Feature)

**Filename:** `FID-2026-0910-004-custom-providers-slash-command.md`
**ID:** FID-2026-0910-004
**Severity:** medium
**Status:** closed (Steps 1-3 implemented 2026-09-10; Steps 4-6 implemented +
gate-verified 2026-09-11; Step 9 union widening + Step 7 wizard implemented +
gate-verified 2026-09-11; Step 8 grammar + picker + docs implemented +
gate-verified + live-smoked 2026-09-11; Loop 9 replay-guard fix + Step 9
remainder (catalog fetcher / picker merge) + Step 10 (health edge + Law 4
sweep) implemented + gate-verified 2026-09-11; final certification + closure
2026-09-11, operator directive)
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
> gate-verified 2026-09-11; Step 9 union widening + Step 7 wizard + Step 8
> grammar/picker/docs implemented and gate-verified 2026-09-11 (Step 8
> live-smoked). Step 9 remainder + Step 10 remain pending separate approval;
> the section fills in fully at `closed`.

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
- [x] Step 9 (union widening) + Step 7 (wizard) statuses — implemented +
      gate-verified 2026-09-11 (below); Steps 8 + 10 pending

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
      under `scripts/`). Step 7 wiring edges verified 2026-09-11: input-mode
      branch `route-user-prompt.ts:73`, route handler + persistence
      `route-provider-wizard.ts:50,132`, Escape discard `keyboard.ts:129,144`,
      mask condition `chat-input-bar-compact.tsx:168-171`. The `providerAdd`
      input mode has zero production SETTERS until Step 8's `/provider
      add|edit` grammar — dormant-but-wired, named in Loop 7 ADVERSARIAL.
- [x] FID status reflects actual implementation state — `fixed`; Steps 1-8
      + Step 9 union widening implemented and documented above; Step 9
      remainder (catalog fetcher / picker merge) + Step 10 pending separate
      approval
- [x] Step 8 statuses — grammar + picker + docs implemented, gate-verified,
      and live-smoked 2026-09-11 (below)

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

**Step 8 — implemented (2026-09-11; grammar + picker + docs, RED-first):**

- **Grammar (`add|edit|list|remove`):** `implemented` —
  `cli/src/commands/provider-subcommands.ts:58` (`parseProviderArgs` — grammar
  words dispatch before name resolution; the FID-2026-0907-009 trailing
  `update` token semantics preserved for `<name>`), `:125,136,160,192`
  (`handleAdd/handleEdit/handleList/handleRemove`), `:254`
  (`handleProviderSubcommand` dispatch); wired in the `/provider` command
  definition at `cli/src/commands/defs/model-provider-commands.ts:112-123`.
  `edit`/`remove` are custom-only (unknown id → hint message; built-ins
  rejected for remove). Remove captures the active-selection state BEFORE the
  registry reset (`:221` — the reset invalidates the stored custom selection,
  so a post-mutation read would silently fall back to default), resets
  selection to `openrouter`, drops a custom-prefixed model preference, clears
  the in-process routing env (MQ1), and refreshes the runtime registry via
  `resetCustomProviders()` + `registerCustomProviders(merged)` (`:226-230` —
  `registerCustomProviders([])` alone is a D4 no-op, so the empty case resets
  explicitly).
- **Wizard id reservation:** `implemented` —
  `cli/src/utils/provider-wizard.ts:40` (`PROVIDER_GRAMMAR_WORDS` — single
  truth living in the leaf module so the parser and the wizard share it
  without an import cycle, Law 13), `:176-179` (the id step rejects
  `add|edit|list|remove` — a provider named `add` would shadow the grammar on
  every future selection attempt).
- **Picker inclusion:** `implemented` —
  `cli/src/commands/defs/model-provider-commands.ts:93-98` (customs appended
  after built-ins per D9, labeled `(custom)`, configured badge from
  `getConfiguredProviderNames`); registration ordering fixed so
  `loadSettings()` (the registration seam) runs BEFORE the configured-name
  check reads the effective view.
- **Wizard input-mode continuity (Step 7 defect found by Step 8 RED):**
  `fixed` — `cli/src/commands/router/route-provider-wizard.ts:62-69`
  (`clearWizardInput` keeps `providerAdd`/`providerAddKey` per step — the
  prior code dropped to `default` after every submit, ending the wizard after
  step 1 and unmasking the key step; the Step 7 e2e pin had masked this by
  re-setting the mode manually each round), `:75` (`exitToDefault` — terminal
  and fail-closed exits only), `:100` (per-step mode), `:108,136`. The
  contradictory Loop 7 pin asserting `default` was corrected (Loop 8).
- **Docs (Law 9):** `implemented` — `README.md:202` ("Bring your own provider
  (custom providers)" section: wizard walkthrough + command table + remove
  semantics).
- **Live smoke (operator directive):** PASS — the tmux TUI smoke was not
  runnable (no tmux on this Windows host); the equivalent live proof drove the
  REAL production modules (command defs, subcommand module, wizard machine,
  route handler, settings IO, key store, registry) through the full
  `add → list → edit → remove` cycle in an isolated config dir: 11/11
  assertions (wizard opens at id; full walk persists to settings.json;
  effective registry gains the id; key stored under the env var; secret never
  in chat history; list shows the custom; edit reopens prefilled with the id
  locked; remove drops it from registry + disk). NEEDS-REVIEW boundary: the
  literal alternate-screen keystroke layer (React mount) was not driven.
- **Pins:** `cli/src/commands/__tests__/provider-commands.test.ts` (12 tests:
  grammar dispatch ×2 paths, full add walk with mode continuity, edit
  custom-only + unknown id, list markers, remove + re-registration,
  active-remove reset, built-in remove rejection, grammar-reserved wizard
  ids, picker customs + badge, `parseProviderArgs` unit pins incl. the
  preserved `update` semantics).

### Loop 7 — Step 9 (union widening) + Step 7 (wizard) implementation (2026-09-11)

- **RED (Step 9):** All 6 `as ModelProvider` bridge-cast sites grep-mapped
  before touching the union (`provider-key-store.ts` ×2, `provider-setup.ts`,
  `validation.ts` ×2, one test file), plus 2 test-file casts. The widening is
  mechanical: the runtime truth was already the effective-registry id set.
- **GREEN (Step 9):** `ModelProvider` widened to the D8 shape —
  `cli/src/utils/openrouter-models/types.ts:11` (`ProviderId | (string &
  {})`). Three unused imports + stale bridge comments removed
  (`provider-setup.ts`, `provider-key-store.ts`, `validation.ts`); both test
  files de-cast. The widening forced exactly one call-site fix:
  `cli/src/commands/health-command.ts:42` — the health lookup now reads the
  effective registry (id-matched in the merged view, built-in metadata
  preferred) — this is C6's effective-lookup (Step 10's health item),
  recorded honestly as pulled forward by the widening.
- **GREEN (Step 7):** One pure step machine serves both entry modes (Law
  13): `cli/src/utils/provider-wizard.ts:94` (`createWizardSession`),
  `:121` (`submitWizardStep`), `:269` (`submitKeyStep`), `:288` (finalize
  re-validated through `parseCustomProviders` — the single validation
  truth), `:312` (`beginProviderWizard`), `:335` (`cancelWizardSession`).
  Input modes `providerAdd` (unmasked steps) + `providerAddKey` (masked key
  step): `cli/src/utils/input-modes.ts:20-21,173-196` — two modes because
  masking is per-mode on the compact bar
  (`cli/src/components/chat-input-bar-compact.tsx:168-171`). Route handler
  `cli/src/commands/router/route-provider-wizard.ts:50`
  (`routeProviderWizard`), `:123-132` (`persistDefinition` — settings.json
  replace-by-id + `registerCustomProviders(merged)` re-registration),
  `:137` (`persistKey` — saved / kept-on-empty / migrated-on-env-var-change),
  `:163` (`reactivateIfActive` — D7 re-activation for the active edited
  provider). Router branch `cli/src/commands/router/route-user-prompt.ts:70-82`
  sits BEFORE the empty-input gate (empty submits are meaningful: models →
  none-source; edit key → keep stored). Escape/Backspace discard
  fail-closed: `cli/src/chat/keyboard.ts:129,144` (no partial write ever
  exists). Command grammar `/provider add|edit` is Step 8 — the branch is
  dormant-but-wired until then.
- **RED-first pin suite:** `cli/src/commands/__tests__/provider-add-wizard.test.ts`
  written against the not-yet-existing machine (module-absent failure
  captured). RED iteration corrected two pin bugs of my own: the edit-key
  pin walked only one step (contradicting the baseUrl empty-re-prompt pin);
  the malformed-slug pin demanded stricter charset than
  `CUSTOM_ID_PATTERN` — `-ab`/`ab-` match the closed Step-1 parser, so the
  wizard pins parser parity (Law 13) instead. 16 tests: step sequencing,
  reserved ids, malformed slug, claimed env vars (`OPENROUTER_API_KEY`,
  `SERPER_API_KEY`) + shape, baseUrl re-prompt, inline prefix rule + none
  source, edit prefill + id lock, key-kept-on-empty, add-mode empty key
  re-prompt, finalize shape, active-session API, per-step instructions,
  fail-closed draft immutability, and a router end-to-end walk (persist →
  register → key under env var → `DIRECT_PROVIDER`/`INFERENCE_BASE_URL`
  activation; secret never in `saveToHistory` or chat messages).
- **AUDIT (gates, own-run 2026-09-11):** typecheck ×4 exit 0 (cli, sdk,
  common, packages/agent-runtime); wizard suite 16 pass / 0 fail; combined
  regression battery 77 pass / 0 fail (212 expect calls, 9 files: wizard,
  router setup/update, key store, settings, setup, gateway, keyboard,
  settings-provider); eslint `--max-warnings 0` on the 7 touched files → 0
  problems; prettier clean after `--write`. grep re-verified every citation
  in this loop record at write time.
- **ADVERSARIAL:** The dormant-branch risk is named: `providerAdd` has zero
  production setters until Step 8's grammar lands (grep evidence:
  `provider add` matches only in comments/tests/handler strings). Escape
  discard leaves no residue (the machine writes nothing; only the terminal
  step persists). The `health-command.ts` effective lookup keeps built-in
  metadata precedence so built-in health rows are unchanged.
- **CHANGE DELTA:** Evidence + one loop record (<5% of the FID); circuit
  breaker not triggered.

### Loop 8 — Step 8 (grammar + picker + docs) implementation + live smoke (2026-09-11)

- **RED:** `provider-commands.test.ts` written against the not-yet-existing
  `provider-subcommands` module — 0 pass / 12 fail captured (module absent;
  customs missing from the picker; grammar unwired). RED iteration caught ONE
  REAL Step 7 defect: the route handler's `resetInput` forced `default` mode
  after every submit, so a live user would fall out of the wizard after step 1
  and the masked key step would unmask — the Step 7 e2e pin had masked it by
  re-setting the mode manually each round; that pin is corrected here (an
  invalid submit keeps the user IN the wizard). RED also caught one pin bug of
  my own (a walk that submitted an empty models step but expected the inline
  catalog).
- **GREEN:** `provider-subcommands.ts` (parse + dispatch + handlers), grammar
  reservation in the wizard id step (single truth in the leaf module — no
  import cycle), picker customs after built-ins (D9) with the registration-
  ordering fix (loadSettings runs before the configured-name read), remove
  flow with the pre-mutation active-selection capture, mode-continuity fix.
  Two REAL defects caught by gates during GREEN: (1) the remove handler read
  the active selection AFTER the registry reset (the reset invalidates the
  stored custom selection and validation drops it — the warn/reset branch
  never ran and routing env survived); (2) the picker branch read the
  effective view before registration. Both fixed and pinned.
- **AUDIT (gates, own-run 2026-09-11):** typecheck ×4 exit 0 (cli, sdk,
  common, packages/agent-runtime); Step 8 suite 28 pass / 0 fail (grammar +
  wizard, 126 expect calls); regression battery 74 pass / 0 fail across 9
  touched-surface files (router setup/update, key store, settings, setup,
  gateway, settings-provider); common provider suites 51/0; sdk custom
  suites 6/0; eslint `--max-warnings 0` → 0 problems; prettier clean;
  `lint:md` PASS. Live smoke PASS (11/11, real modules, isolated config dir;
  tmux TUI keystroke layer not driven — no tmux on host — recorded
  NEEDS-REVIEW in the Step 8 evidence).
- **ADVERSARIAL:** The grammar shadowing risk is closed at the only entry
  point (id step rejects command words; parser dispatches them). The remove
  flow's reset covers selection, model preference, in-process routing env,
  and the runtime registry — shell env is never touched (the /provider flow
  never owns it). The dormant-branch note from Loop 7 is discharged: the
  grammar is the production setter for `providerAdd`.
- **CHANGE DELTA:** Evidence + one loop record (<5% of the FID); circuit
  breaker not triggered.

### Loop 9 — Live TUI smoke secret-leak finding + replay-guard fix (2026-09-11)

- **FINDING (winpty ConPTY smoke, `SAVANT_CODE_CONFIG_DIR=C:/tmp/savant-tui-smoke/config`):
  the full scripted `/provider add` walk succeeded (all six step prompts
  rendered, definition + key persisted, "Custom provider added" ×3 from one
  scripted walk) — but the persisted `message-history.json` contained the
  env-var answer and the pasted key (`MY_GW_KEY`, `gw-tui-secret`) in the
  up-arrow recall history, and the session transcript shows one wizard answer
  (`'My Gateway'`) dispatched to the agent as a chat message. Root cause chain,
  grep-verified: duplicated/replayed submits from the pty layer (one command
  echoed 4× in history; entries out of script order) landed AFTER the terminal
  step flipped the input mode back to 'default' — the stale submit fell
  through the wizard branch to the regular-message path
  (`route-user-prompt.ts` `saveToHistory(trimmed)` + `sendMessage`). The
  unit-proven production paths never call `saveToHistory` (all 83 call sites
  grep-audited); a human double-pressing Enter at the masked key step hits the
  same window. This is a REAL Law-12 secret-hygiene defect, not a harness
  artifact — the unit e2e (mocked params) cannot observe the caller layer.
- **FIX (fail-closed one-shot replay tombstone):** `provider-wizard.ts` gains
  `markWizardSubmissionConsumed` / `isWizardSubmissionReplayed` /
  `clearWizardReplayGuard` (injected `nowMs` clock, 1s TTL, command-shaped
  payloads never tombstoned, first duplicate swallowed then tombstone
  cleared). The wizard route handler marks every consumed submit
  (`route-provider-wizard.ts`) and clears stale tombstones on new wizard
  input; the router drops an identical default-mode replay before any
  persistence or send (`route-user-prompt.ts`, before the empty-input gate's
  siblings). The non-wizard slash-command path is untouched.
- **AUDIT (gates, own-run 2026-09-11):** wizard suite 21 pass / 0 fail (86
  expect calls) incl. 4 new guard pins + a router-level replay-drop pin
  asserting `saveToHistory`/`sendMessage` are never called with the replayed
  secret; regression battery 79/0 across 9 files; typecheck ×4 exit 0; eslint
  `--max-warnings 0` (one import/order caught and fixed); prettier clean.
  RED captured honestly first (export-not-found, 0 pass).
- **ADVERSARIAL:** The tombstone cannot mask legitimate input — one-shot,
  TTL-bounded, command-shaped payloads excluded, cleared on new wizard
  sessions; the drop only fires on EXACT-text duplicates inside 1s. The
  pty-layer duplication itself is a harness artifact and out of product
  scope; the product defect (no drop window) is fixed and pinned. Residual:
  a duplicate >1s apart is theoretically possible but not observed and not
  a realistic keystroke pattern.
- **CHANGE DELTA:** Guard module (~60 lines) + handler mark + router drop +
  test additions (<5% of the FID); circuit breaker not triggered.

### Loop 10 — Step 9 remainder: custom catalog fetcher + degradation ladder + picker merge (2026-09-11)

- **RED:** `custom-catalog.test.ts` written against the not-yet-existing
  `custom-catalog` module — captured module-absent (0 pass, unhandled import
  error) before GREEN.
- **GREEN:** `cli/src/utils/openrouter-models/custom-catalog.ts` — per-custom-id
  live fetchers built LAZILY from the effective registry, reusing
  `createLiveCatalogFetcher` verbatim (Law 13: bounded timeout, cache/TTL,
  in-flight dedup, stale-cache fallback, redacted failure logging are the
  shared core's, not reimplemented); OpenAI `/v1/models` parse with
  `${id}/` prefixing + already-prefixed passthrough + malformed-entry
  fail-closed drops; inline catalogs pure synthesis (pinned zero-network);
  `none`/unknown/built-in ids → `[]` without network. Key resolution: shell
  env first, then the persisted 0600 store. Merge seam:
  `fetchAllCustomModels` rides the gateway `Promise.allSettled` — a failing
  custom fetch degrades to [] per provider (D10 ladder; free-text
  `/model <exact-id>` always routes) and never masks built-ins. D9 fix:
  `model-picker-grouping.ts` now derives order from the EFFECTIVE registry
  (customs carry order 5 from `toProviderConfig`; the built-in-only read
  would have tied them at the unknown-id fallback 4). `/model` picks customs
  up through the merged catalog with ZERO command-def changes.
- **AUDIT (gates, own-run 2026-09-11):** custom-catalog suite 8 pass / 0 fail
  (16 expect calls); openrouter-models family 34/0 across 5 files; wizard +
  grammar + health + key-store regression 78/0 across 8 files; typecheck ×4
  exit 0; eslint `--max-warnings 0` (3 import/order warnings in the new suite
  caught and fixed via --fix); prettier clean. GREEN self-caught: an initial
  draft used `require()` in the ESM CLI (the exact Loop 8 anti-pattern) and a
  nonexistent module — both corrected to a static import before first run.
- **ADVERSARIAL:** No per-provider special-casing leaked into the fetcher —
  the module is generic over any registered custom id (the built-in-id guard
  is a data check, not a name list). Fetchers rebuild via the test reset
  seam; stale fetchers after re-registration cannot survive a process because
  registration is boot-time. Cache/TTL semantics are the shared core's.
- **CHANGE DELTA:** New module (~150 lines) + 2-line merge + grouping read
  swap + 8 pins (<5% of the FID); circuit breaker not triggered.

### Loop 11 — Step 10 closeout: health edge sweep + Law 4 call-graph proof (2026-09-11)

- **C6 health edge sweep:** the custom-provider pins from the interrupted
  session were on disk and VERIFIED green (8/0, 25 expect calls) — active
  custom via the effective registry with secret redaction, keyless custom,
  stale-selection fallback to default. No new gap found: health reads the
  effective registry (`health-command.ts:47`) and the D8-widened selection
  type keeps unknown persisted ids fail-closed via validation.
- **Law 4 call-graph proof (grep-verified, all production edges Steps 1-9):**
  registration — `settings/io.ts:56` (boot seam), `sdk/client.ts:42`,
  `sdk/run/execution.ts:95`, `route-provider-wizard.ts:160`; remove/reset —
  `provider-subcommands.ts:229-230` (`resetCustomProviders` + rebuild, D4
  no-op documented); catalog chain — `custom-catalog.ts` →
  `gateway.ts:196` `fetchAllCustomModels` → `/model` def (`model-provider-
  commands.ts:54` `fetchGatewayModels`) + boot prewarm (`index.tsx:49`);
  effective-registry consumers — grouping (`model-picker-grouping.ts:34`),
  health (`health-command.ts:47`), key store/provider setup;
  wizard + grammar — `route-user-prompt.ts:75/91` (route + replay guard),
  `model-provider-commands.ts:112` (`parseProviderArgs` dispatch);
  repo-validation stays built-in-only — `scripts/validate-repository.ts:11,218`
  and `scripts/generate-provider-reference.ts:24` import `PROVIDER_REGISTRY`,
  never the effective view. Compilation + wiring are proven, not assumed.
- **ADVERSARIAL:** All checkbox gates in the Verification section are now
  satisfied by tool output; the final status moves to `fixed` with every step
  implemented + gate-verified (closure remains the operator's). The tmux
  NEEDS-REVIEW boundary from Loop 8 was discharged by the Loop 9 winpty ConPTY
  smoke; no other boundary remains open.
- **CHANGE DELTA:** Evidence + loop record only; circuit breaker not triggered.

## Resolution

- **Closed Date:** 2026-09-11 (operator directive: final certification,
  archive, CHANGELOG entry)
- **Fix Description:** the full custom-provider feature — validated
  user-authored provider DATA in `common` (parse + fail-closed merged
  effective registry, D1-D4), the SDK + CLI settings/key-store seams
  (Steps 4-6), the `/provider add|edit` wizard step machine with masked key
  entry and per-step inline re-prompts (Step 7, D7), the
  `add|edit|list|remove` grammar + picker inclusion + README docs (Step 8),
  the `ModelProvider` union widening retiring all bridge casts (Step 9,
  D8), a one-shot replay-tombstone secret-hygiene guard discovered by the
  live TUI smoke (Loop 9, Law 12), the generic custom catalog fetcher with
  the D10 degradation ladder and D9-effective-order picker merge (Step 9
  remainder), and the health edge sweep + full Law 4 call-graph proof
  (Step 10, C6).
- **Tests Added:** common provider suites (51/0 incl. RED-first Steps 1-3
  pins), sdk custom suites (6/0), CLI settings/key-store/setup suites,
  wizard pin suite (21/0 incl. router e2e + replay-guard pins), grammar
  suite (28/0 with the wizard continuity correction), custom-catalog suite
  (8/0), health custom-provider pins (8/0) — aggregate gates at each loop
  record; typecheck ×4 exit 0 at every gate; eslint `--max-warnings 0`,
  prettier, `lint:md` clean throughout.
- **Verification Evidence:** per-loop AUDIT blocks above (Loops 5-11), each
  with own-run tool output; live evidence: 11/11 in-process grammar smoke
  (isolated config dir) + winpty ConPTY TUI walk (full add flow, secrets
  persisted only in the 0600 store — which surfaced and fixed the Loop 9
  leak); Law 4 grep proof over every production wiring edge including the
  repo-validation built-in-only grep (Loop 11).
- **Archived:** 2026-09-11 — moved to `dev/fids/archive/` in the closure
  commit following this edit (Orchestrator executes the Recorder-authored
  filesystem move; record in `archive/README.md`, 2026-09-11 section).

### Loop 12 — Final certification (2026-09-11)

- **Termination criterion applied:** operator directive to ship — the
  Perfection Loop terminates with Final Certification (FID §Termination
  Criteria). Deep-audit sweep across Loops 5-11 yields ZERO actionable
  improvements: every step implemented RED-first, every gate own-run green,
  every wiring edge grep-proven, the one live-discovered defect (Loop 9)
  fixed and pinned, and no NEEDS-REVIEW boundary remains (the Loop 8 tmux
  gap was discharged by the Loop 9 winpty ConPTY walk).
- **Five Questions:** ALL cases (edit/remove/malformed/collision paths are
  pinned, not just the happy path); scales (the registry merge is O(n)
  over user data with bounded per-entry validation); hostile-attacker safe
  (hostile hand-built registrations rejected before any state mutation,
  secrets confined to the 0600 store + masked input, replay guard
  fail-closed); maintainable (one validation truth per concern — parser,
  wizard, grammar words, catalog fetcher — every extension seam reused,
  none duplicated); industry-standard shape (data-only extensibility, no
  executable configuration).
- **Certification:** the FID is COMPLETE; code is in tree, gate-verified,
  and committed (`547946c`, `15074fe`, `7fdbe15`, `7ada1bb`, `4136e9b`,
  `3b2cecd`, `074cda9`). Archived the same day.

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
