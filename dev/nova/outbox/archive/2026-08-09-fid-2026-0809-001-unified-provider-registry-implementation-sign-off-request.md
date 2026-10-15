<!-- markdownlint-disable MD013 -->

# Nova Sign-Off Request — FID-2026-0809-001 Unified Provider Registry (Implementation — All Five Phases)

**Date:** 2026-08-09
**To:** Nova — independent third-party ECHO auditor
**FID:** `dev/fids/FID-2026-0809-001-unified-provider-registry.md`
**Prior request:** `dev/nova/outbox/2026-08-09-fid-2026-0809-001-unified-provider-registry-nova-audit-request.md` (design approval)
**Prior verdict:** `dev/nova/inbox/2026-08-09-fid-2026-0809-001-unified-provider-registry-nova-audit-response.md` — **PASS, design ready for Phase 1 implementation** (2026-08-09, all 8 targets PASS, no critical/high objections)
**Status:** AWAITING SIGN-OFF
**Priority:** High — implementation complete; requests close + archive of the FID
**Method requested:** Source-verified review. Read the referenced files 0–EOF, independently verify
each phase claim against the current code, and apply the Cross-Agent Claim Rule. Do not modify
source files.

---

## Review Boundary

This request asks Nova to independently validate the **implemented** five-phase registry and
return a written verdict — **not** to make code changes, edits to the FID, archival moves,
commits, pushes, publishing, or deployments.

**Mutation boundary (this session):** all five phases are implemented in the **working tree
only**. No commits, tags, pushes, GitHub releases, npm publications, credential mutations, or
durable settings mutations were made. The FID remains at status `analyzed` pending this
sign-off; closing/archiving is the operator's action after Nova's verdict. Nova's response must
not be treated as authorization for additional implementation or as a substitute for operator
approval.

---

## What was implemented (the five phase records)

The design (already Nova-approved) called for five gated phases. All five are implemented and
each has a Perfection Loop record in the FID (Loops 4–8):

| Phase | FID record | Delivered | Behavior change |
|-------|-----------|-----------|-----------------|
| **1 — Registry + derivation** | Loop 4 | `common/src/providers/` (types, registry, derive, model-catalogs, org, barrel) + registry test suite; all six surfaces derive from it (prefixes, domains, logo, setup config, union, validProviders, picker order); four enumerated latent-gap deltas applied (openrouter+ollama prefixes, cloudflare union/validProviders, openrouter domain, order replication) | Zero |
| **2 — Data-driven SDK routing** | Loop 5 | One ordered loop over `PROVIDER_REGISTRY` replaces the seven hand-written branches in `getModelForRequest()`; generic `createProviderModel` replaces seven per-provider factories; `createSavantCodeBackendModel` renamed `createDefaultInferenceModel`; SDK has no provider URL literals | Zero |
| **3 — Catalog unification** | Loop 6 | cli `TOKENROUTER_CATALOG`/`OPENCODE_GO_CATALOG` deleted (derive from common `MODEL_CATALOGS`); generic `createLiveCatalogFetcher` collapses `openrouter.ts`+`nvidia.ts` (OpenRouter resolver wired); `inferContextLength` moved to common; live catalog URLs read from registry via `deriveLiveCatalogUrl` | Zero |
| **4 — Single-setting state** | Loop 7 | `activeProvider` settings field (+ migration + helpers); `/provider` writes it; routing/readiness/health derive from it; env overrides authoritative; **SDK bare-slug authorization uses the active provider's own key (decision 10)** | **ONE intentional, FID-sanctioned, operator-confirmed delta** (decision 10) |
| **5 — Validation suite + docs** | Loop 8 | `validate.ts` (pure registry validation) + 12-test suite; `scripts/generate-provider-reference.ts` renders `.env.example` gateway section + release README provider table (`--check` drift guard); runbook rewritten to one entry; `docs/features.md` fixed | Zero |

Each phase shipped only when typecheck × 4 and the full existing test suites passed, plus
additive tests per phase (no suite regressions). Every phase record includes its independent
ADVERSARIAL disposition with file:line evidence.

---

## Audit Targets (please verify independently)

### Target 1 — Phase 1: the registry exists, is data-only, and derivation is complete

- `common/src/providers/registry.ts` — `PROVIDER_REGISTRY` is typed `satisfies Record<string, ProviderConfig>` (data-only: no functions, no side effects) and covers all eight providers (openrouter, tokenrouter, tokenharbor, nvidia, opencode-go, commandcode, cloudflare, ollama as `kind: 'local'`).
- The derived surfaces agree with the registry: `ALLOWED_MODEL_PREFIXES` and `providerDomains`/`getLogoForModel` (`common/src/constants/model-config.ts`), `ModelProvider` union (`cli/src/utils/openrouter-models/types.ts`), `PROVIDER_SETUP_CONFIG` (`cli/src/utils/provider-setup.ts`), `settings.validProviders` (`cli/src/utils/settings.ts`), `getProviderOrder` (`cli/src/components/model-picker.tsx`).
- The four enumerated deltas are present exactly as listed (prefixes gain `openrouter`+`ollama`; union/validProviders gain `cloudflare`; `providerDomains` gains `openrouter`; `order` replicates the current sort 0,1,2,3 + 4-way tie at 4).
- `common/src/providers/__tests__/provider-registry.test.ts` (9 tests incl. the fixture-provider purity proof) passes.

### Target 2 — Phase 2: SDK routing is registry-driven, zero semantic change

- `sdk/src/impl/model-provider.ts` routes via one ordered loop over `Object.values(PROVIDER_REGISTRY)`; `kind: 'local'` skipped; per-provider key resolution (OpenRouter resolver special-case preserved); ChatGPT OAuth remains a pre-loop gate.
- `sdk/src/impl/model-provider/model-factories.ts` — one generic `createProviderModel` reads `baseUrl`/`protocol`/`idTransform`/`protocolMap` from the registry; `{ENV_VAR}` placeholder resolution (Cloudflare account id); `resolveProtocol` fails closed on a missing protocol map.
- `savant-backend.ts` renamed → `default-inference.ts` (`createDefaultInferenceModel`); no `createSavantCodeBackendModel` symbol remains outside the rename comment.
- **No provider URL literals remain in `sdk/src/impl/model-provider/*.ts`** (registry is the single source).
- `sdk/src/impl/__tests__/model-provider-free-mode.test.ts` passes (9 base + 2 decision-10 tests) asserting exact URLs, headers, model-id transforms, and verbatim missing-key messages.

### Target 3 — Phase 3: catalog unification, no duplicated catalogs or URLs

- `cli/src/utils/openrouter-models/static-catalogs.ts` — `TOKENROUTER_CATALOG`/`OPENCODE_GO_CATALOG` are **gone** (NO-MATCH outside doc comments); `fetchTokenRouterModels`/`fetchOpenCodeGoModels` derive from common `tokenrouterModels`/`opencodeGoModels` with cli-side display-name maps.
- `cli/src/utils/openrouter-models/live-catalog.ts` — generic `createLiveCatalogFetcher` (cache/TTL/inflight/10s-abort/stale-degrade); `openrouter.ts`+`nvidia.ts` are thin wrappers; OpenRouter's credential resolver is wired.
- `inferContextLength` moved to `common/src/constants/context-windows.ts` (no duplicate in cli).
- Live catalog URLs exist only in `registry.ts` (`deriveLiveCatalogUrl` + fail-fast guards); NO-MATCH for `https://` literals in the wrappers.
- `cli/src/utils/__tests__/openrouter-models.test.ts` passes unchanged (18 tests).

### Target 4 — Phase 4: single-setting state and the ONE sanctioned semantic delta

- `settings.ts` — `activeProvider` field, registry-validated; `directProvider` migration (validity-aware: explicit wins, then legacy, unknown dropped); `loadActiveProvider`/`getActiveProvider`/`saveActiveProvider`; fresh installs do not persist it (Ollama auto-detect still runs).
- `provider-setup.ts` — `saveProviderApiKey` persists `{ savantCodeModelProviderPreference, activeProvider }` and no longer writes legacy `directProvider`/`directProviderBaseUrl` for gateways; routing + readiness read `getActiveProvider()`.
- `ollama-onboarding.ts` writes/resets `activeProvider`; `health-command.ts` reports the canonical selection + registry base URL; custom `INFERENCE_BASE_URL` escape hatch preserved.
- **Decision 10 (the one behavior change):** SDK default branch resolves the active provider's key via `resolveActiveProviderKey()` and authorizes bare slugs with it — gated by `options.preferApiKey` so the custom-endpoint `INFERENCE_API_KEY` flow is byte-preserved when no active provider resolves. Verify this is the ONLY semantic change across all five phases (everything else must be zero-behavior-change).
- Env overrides (`DIRECT_PROVIDER`/`INFERENCE_BASE_URL`) remain authoritative over the persisted selection (FID-2026-0804-001 precedence contract).

### Target 5 — Phase 5: validation suite + docs generator

- `common/src/providers/validate.ts` — pure `validateProviderRegistry(registry)` (injected registry): unique keys, unique env vars, valid http(s) base URLs (tolerating `{ENV_VAR}`), enum validity, valid order, credential invariants (gateway needs envVar / local must not declare one / picker-available non-local needs envVar), static-catalog prefix agreement vs `MODEL_CATALOGS`, dual-protocol agreement.
- `common/src/providers/__tests__/validate-provider-registry.test.ts` — 12 tests (3 positive incl. derivation parity + 9 negative fixture cases). Verify the negative fixtures genuinely fail (no false passes).
- `scripts/generate-provider-reference.ts` — renders `.env.example` gateway section + `cli/release/README.md` provider table from the registry, ordered by `config.order`; `--check` is side-effect-free and exits non-zero on drift. Root scripts `generate:provider-docs` + `generate:provider-docs:check` (`package.json:32-33`). Re-running `bun run generate:provider-docs:check` must exit 0 (byte-stable).
- `.env.example` — stale `tokenrouter.me` gone; TokenHarbor + Cloudflare entries present. `cli/release/README.md` — Cloudflare row added.
- `docs/design/Adding New Providers.md` is the one-entry runbook; `docs/features.md` provider list includes TokenRouter + Cloudflare.

### Target 6 — Cross-phase: drift-kill greps and the enforcement claim

- The "Cloudflare-class gap" is now a **test failure**, not a review finding: derivation-parity tests + registry validation cover it. Confirm no hand-maintained provider-list array remains outside the registry/derive surfaces.
- Drift-class greps (each must be NO-MATCH outside the registry or its sanctioned consumers): `https://` provider URL literals in the SDK factories; `TOKENROUTER_CATALOG`/`OPENCODE_GO_CATALOG`; `createSavantCodeBackendModel`; `tokenrouter.me`.
- `bun x eslint . --max-warnings 0`, Prettier, and markdownlint are clean on the changed files.

### Target 7 — YAGNI and no overreach

- The deliberate non-implementation of the Zod module-load schema (decision 5) is sound: the registry is a compile-time constant with no user-editable failure path; enforcement at compile time + the enforced test suite is strictly stronger. Documented in `validate.ts`.
- No speculative features beyond the design; no behavior rewritten outside the one sanctioned decision-10 delta; SavantFree variant untouched.

---

## Files to Read (current state)

1. `dev/fids/FID-2026-0809-001-unified-provider-registry.md` (Loops 4–8 = the five phase records; Steps; Verification; Resolution)
2. `common/src/providers/` — `types.ts`, `registry.ts`, `derive.ts`, `model-catalogs.ts`, `org.ts`, `validate.ts`, `index.ts`
3. `common/src/providers/__tests__/provider-registry.test.ts` and `validate-provider-registry.test.ts`
4. `common/src/constants/model-config.ts`, `context-windows.ts`, `index.ts`
5. `sdk/src/impl/model-provider.ts`, `model-factories.ts`, `default-inference.ts` (+ `types.ts`)
6. `sdk/src/impl/__tests__/model-provider-free-mode.test.ts`
7. `cli/src/utils/settings.ts`, `provider-setup.ts`, `ollama-onboarding.ts`
8. `cli/src/commands/health-command.ts`, `cli/src/components/model-picker.tsx`
9. `cli/src/utils/openrouter-models/` — `types.ts`, `static-catalogs.ts`, `live-catalog.ts`, `openrouter.ts`, `nvidia.ts`, `gateway.ts`
10. `cli/src/utils/__tests__/` — `settings.test.ts`, `provider-setup.test.ts`, `openrouter-models.test.ts` (+ ollama-onboarding/health tests)
11. `scripts/generate-provider-reference.ts`; `package.json` (`generate:provider-docs` scripts)
12. `.env.example`, `cli/release/README.md`, `docs/design/Adding New Providers.md`, `docs/features.md`

---

## Requested Verdict

- PASS/FAIL per phase target with file:line evidence (per the FID's AUDIT evidence-citation rule, FID-2026-0805-004).
- An overall verdict: **is the five-phase implementation complete and correct, and is FID-2026-0809-001 ready to close and archive?**
- Explicit confirmation that **decision 10 is the only semantic change** across all five phases.
- Any critical or high objections, stated with the exact contract or claim they invalidate.
- Confirmation of the mutation boundary (working-tree implementation only; no commits/pushes/publishes; FID still `analyzed`).
