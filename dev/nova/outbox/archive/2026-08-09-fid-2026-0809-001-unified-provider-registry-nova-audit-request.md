<!-- markdownlint-disable MD013 -->

# Nova Audit Request — FID-2026-0809-001 Unified Provider Registry (Design Approval)

**Date:** 2026-08-09
**To:** Nova — independent third-party ECHO auditor
**FID:** `dev/fids/FID-2026-0809-001-unified-provider-registry.md`
**Status:** AWAITING AUDIT
**Priority:** High — independent design approval before Phase 1 implementation begins
**Method requested:** Source-verified review. Read the referenced files 0–EOF, independently
verify each claim against the code, and apply the Cross-Agent Claim Rule. Do not modify source
files.

---

## Review Boundary

This request asks Nova to independently validate a **spec-only design** and return a written
verdict. It does not request coding, scope changes, FID edits, archival changes, commits,
pushes, publishing, or deployment.

**Mutation boundary (this session):** no production code was changed; no commits, tags, pushes,
GitHub releases, npm publications, credential mutations, or durable settings mutations. The only
artifacts created are: the FID, two reference docs
(`docs/design/Adding New Providers.md`, `docs/sdk-overview.md`), and this request. The FID is at
status `analyzed`; implementation has not begun. Nova's response must not be treated as a
substitute for operator approval or as authorization for additional implementation.

---

## What the FID proposes

Replace the current fragmented provider metadata — base URLs duplicated across the SDK factories
and CLI setup, the provider list enumerated in nine-plus places, and model catalogs duplicated
between `common` and `cli` — with **one typed, data-only `PROVIDER_REGISTRY` in `common`** from
which every provider surface derives (routing, credentials, setup picker, catalogs, logos,
ordering, guidance, health). The **single user setting becomes the provider selected in the UI**
(the `/provider` picker), persisted as one `activeProvider` field; the registry supplies
everything else. Adding a new provider collapses from the current 23-step checklist to one
registry entry plus a catalog reference. Implementation proceeds in five gated phases; Phase 1 is
zero-semantic-change derivation gated by the full existing test suite passing unchanged.

The design has been through three Perfection Loop iterations (RED/GREEN/AUDIT/ADVERSARIAL, all
documented in the FID's Perfection Loop section), with two decision-level errors caught and
corrected in Loop 2 and one implementation-critical detail added in Loop 3. It was declared
converged under Circuit Breaker Rule 3 (diminishing returns) at the end of Loop 3.

---

## Audit Targets (please verify independently)

### Target 1 — The drift inventory is accurate

Verify each Problem-section claim with file:line evidence:

- Base URLs exist in both `sdk/src/impl/model-provider/model-factories.ts` (`:67,93,122,222,280`)
  and `cli/src/utils/provider-setup.ts` (`:25,30,35,40,45,50`) and cannot import each other.
- `.env.example:71` documents `https://tokenrouter.me/v1` while code uses
  `https://api.tokenrouter.com/v1` (stale).
- The provider list is enumerated in nine-plus places; `cloudflare` is absent from five code
  surfaces: `PROVIDER_SETUP_CONFIG` (6 keys, `provider-setup.ts:21`), the `ModelProvider` union
  (`cli/src/utils/openrouter-models/types.ts:3`), `settings.validProviders`
  (`cli/src/utils/settings.ts:233`), the gateway catalog combiner
  (`cli/src/utils/openrouter-models/gateway.ts`), and the release README provider table
  (`cli/release/README.md:48-55`); `getProviderOrder` (`cli/src/components/model-picker.tsx:43-55`)
  has no explicit case for it (falls through to `default: 4`). It IS present in
  `ALLOWED_MODEL_PREFIXES` and `providerDomains` — confirming incoherence.
- `ALLOWED_MODEL_PREFIXES` (`common/src/constants/model-config.ts:4`) omits `openrouter` and
  `ollama` even though both route at runtime.
- Catalogs duplicated: `tokenrouterModels` (34 ids, `model-config.ts:67`) vs cli-side
  `TOKENROUTER_CATALOG` (34 entries, `static-catalogs.ts:13`) — identical contents today, no
  parity guard; `opencodeGoModels` (15) vs `OPENCODE_GO_CATALOG` (15, `static-catalogs.ts:199`).
- The default factory is misnamed: `createSavantCodeBackendModel`
  (`sdk/src/impl/model-provider/savant-backend.ts:28`) is the generic OpenAI-compatible fallback.
- Context-window heuristics are layered (`inferContextLength` at `static-catalogs.ts:255`;
  FID-2026-0805-005/006).

### Target 2 — The registry location and data-only constraint are sound

- `common` is the only package both `sdk` and `cli` already depend on; a data-only
  `PROVIDER_REGISTRY` in `common/src/providers/` is serializable, bundle-safe for the
  `bun --compile` binary, and importable from the SDK dist without circular-import risk.
- The entry shape covers all eight providers (openrouter, tokenrouter, tokenharbor, nvidia,
  opencode-go, commandcode, cloudflare, ollama as `kind: 'local'` with optional `envVar`).

### Target 3 — Single user setting + env precedence

- `activeProvider` is the one persisted selection; key presence is readiness, not selection.
- `DIRECT_PROVIDER` / `INFERENCE_BASE_URL` remain explicit overrides; shell env wins over the
  persisted selection, preserving the FID-2026-0804-001 precedence contract
  (`isDirectProviderMode` at `sdk/src/env.ts:74`).

### Target 4 — The four semantic contracts that must not break

1. **Bare-slug routing (decision 10):** unprefixed ids (e.g. `anthropic/claude-sonnet-4.5`)
   route to the active provider's gateway through the generic OpenAI-compatible factory;
   `openrouter/`-prefixed ids keep the dedicated branch (`idTransform: 'keep'`, master-key
   resolver at `model-provider.ts:149`).
2. **Default key is caller-supplied (decision 6):** the SDK's default branch does not resolve a
   key — `apiKey` arrives via `ModelRequestParams` (`model-provider/types.ts:6-9`) from
   `llm/prompts.ts:46-50` / `llm/stream.ts:72-76` and passes through at `model-provider.ts:195`.
   The previously claimed `resolvedOpenRouterKey ?? INFERENCE_API_KEY ?? apiKey` chain does not
   exist and is retracted in the FID. Verify this retraction is correct.
3. **ChatGPT OAuth stays a pre-loop gate (decision 11):** full predicate
   `CHATGPT_OAUTH_ENABLED && !skipChatGptOAuth && isOpenAIProviderModel(model) &&
   isChatGptOAuthModelAllowed(model)` plus rate-limit/credential checks (`model-provider.ts:65-84`);
   stored OAuth tokens, not a registry provider.
4. **Cloudflare URL interpolation:** `baseUrl` supports `{ENV_VAR}` placeholders because the
   account id is embedded mid-path (`model-factories.ts:150-151`); model id rewritten to
   `@cf/<id>` via `idTransform: 'cf-rewrite'`.

### Target 5 — Derivation table completeness

- `ALLOWED_MODEL_PREFIXES` = registry ids ∪ `ORG_PREFIXES` (a Phase-1 extraction of the 12
  inline org slugs at `model-config.ts:5-20` — no such constant exists today; confirm it is
  marked as an extraction, not an existing symbol).
- `providerDomains` = registry `domain` ∪ static `ORG_DOMAINS` (new, 9 org-slug entries) and
  `getLogoForModel` keeps its name-heuristic branches in common — because
  `providerDomains` (`model-config.ts:457-474`) carries 9 org domains and `getLogoForModel`
  (`:475-505`) is a model-name/substring heuristic chain, not a prefix lookup.
- `catalog.modelsRef` is typed `keyof typeof MODEL_CATALOGS` (a Phase-1 shared catalog registry).
- `getProviderOrder` derives from registry `order` but Phase 1 must replicate the current sort
  exactly (0,1,2,3 + the 4-way tie of tokenharbor/commandcode/ollama/cloudflare at 4).

### Target 6 — Phase plan and enumerated one-time deltas

- Phase 1 is zero-semantic-change with four enumerated deltas + one constraint: (a)
  `ALLOWED_MODEL_PREFIXES` gains `openrouter` and `ollama`; (b) union/`validProviders` gain
  `cloudflare`; (c) `providerDomains` gains `openrouter` (absent today); (d) `order` replicates
  the current sort. Each delta ships with its test updates.
- Phases 2-5 (data-driven routing, catalog unification, single-setting state, validation suite +
  docs) are independently shippable, each gated by the full test suite.

### Target 7 — Robustness model

- Compile-time `satisfies Record<string, ProviderConfig>` exhaustiveness; Zod registry validation
  (fail fast); `validate-provider-registry.test.ts` asserting uniqueness, enum values, catalog
  agreement, order uniqueness, and derivation parity.
- **All `derive*` and `validate` functions take the registry as their first argument** (pure
  functions over injected data) so the fixture-provider test and parity suite work without global
  mutation (Loop 3 finding).
- A fixture-provider test proves the one-entry claim: add `fixture/…` in a test, assert routing,
  setup, picker grouping, and guidance all derive without touching any other file.

### Target 8 — YAGNI and no behavior rewrite

- No speculative features: the only shape additions (`{ENV_VAR}` placeholders, typed
  `MODEL_CATALOGS` refs, parameterized derive) are required by existing behavior or testability.
- Behavior contracts are preserved: credential precedence (FID-2026-0804-001), direct-mode gate
  (FID-2026-0806-009), OpenRouter master-key exchange (`openrouter-key-resolver.ts:7-9`),
  SavantFree variant untouched.

---

## Files to Read

1. `dev/fids/FID-2026-0809-001-unified-provider-registry.md`
2. `docs/design/Adding New Providers.md`
3. `docs/sdk-overview.md`
4. `sdk/src/impl/model-provider.ts` (routing branches `:59-196`; OAuth `:65-84`; openrouter
   `:149`; cloudflare `:174-190`; default `:193-196`)
5. `sdk/src/impl/model-provider/model-factories.ts` (URL literals `:67,93,122,222,280`;
   cloudflare factory `:141-160`)
6. `sdk/src/impl/model-provider/savant-backend.ts` (`:28`)
7. `sdk/src/impl/model-provider/types.ts` (`ModelRequestParams` `:6-9`)
8. `sdk/src/impl/llm/prompts.ts` (`:46-50`) and `sdk/src/impl/llm/stream.ts` (`:72-76`)
9. `sdk/src/impl/openrouter-key-resolver.ts` (`:7-9`)
10. `sdk/src/env.ts` (`:74`)
11. `cli/src/utils/provider-setup.ts` (`PROVIDER_SETUP_CONFIG` `:21`)
12. `cli/src/utils/settings.ts` (`validProviders` `:233`; preference fields `:20-26`; auto-config
    `:71`; `loadSavantCodeModelPreference` `:368`)
13. `cli/src/utils/openrouter-models/types.ts` (union `:3`)
14. `cli/src/utils/openrouter-models/static-catalogs.ts` (`:13,199,255`)
15. `cli/src/utils/openrouter-models/gateway.ts`
16. `cli/src/components/model-picker.tsx` (`getProviderOrder` `:43-55`)
17. `cli/src/utils/ollama-onboarding.ts` (`:62,106`) and `cli/src/index.tsx` (`:264,268`)
18. `common/src/constants/model-config.ts` (`ALLOWED_MODEL_PREFIXES` `:4-20`; `tokenrouterModels`
    `:67`; `providerDomains` `:457-474`; `getLogoForModel` `:475-505`)
19. `.env.example` (`:71`)
20. `cli/release/README.md` (`:48-55`)

---

## Requested Verdict

- PASS/FAIL per audit target with file:line evidence (per the FID's AUDIT evidence-citation rule,
  FID-2026-0805-004).
- An overall verdict: **is the design ready for Phase 1 implementation?**
- Any critical or high objections, stated with the exact contract or claim they invalidate.
- Confirmation of the mutation boundary (no production code changed, no public mutations).
