<!-- markdownlint-disable MD013 -->

# FID: Nous Research Direct Provider Integration

**Filename:** `FID-2026-0812-003-nous-research-provider-integration.md`
**ID:** FID-2026-0812-003
**Severity:** medium
**Status:** closed
**Created:** 2026-08-12
**YAGNI-Compliance:** Verified

---

## Summary

Nous Research is now integrated as a first-class, opt-in provider throughout Savant-Code's registry-derived system. The local integration surfaces and the configured direct inference path are operator-confirmed complete; this archived FID records evidence reconciliation and final local lifecycle disposition. The implemented local path includes `/provider`, masked `NOUS_API_KEY` setup, active-provider persistence, `/health`, `/model` catalog/selection, generic SDK routing, exact namespace stripping, cache/degrade behavior, and generated/provider/privacy documentation. The first scope targets the direct Bearer-token API contract documented or confirmed for Nous; operator-confirmed live inference resolves the release-scope remote acceptance boundary. Portal OAuth remains explicitly out of scope. Nous Portal browser OAuth, refresh-token storage, short-lived token minting, token quarantine, and re-authentication are explicitly out of scope and require a separate FID.

No release, tag, push, publication, deployment, credential collection, or unrelated provider refactor is included.

## Current Status Reconciliation (2026-08-12)

- **Landed:** Registry registration, `/provider` setup, stored-key precedence, active-provider persistence, `/health`, authenticated `/v1/models` catalog, `/model` selection, generic SDK routing, exact namespace stripping, provider audit ownership, generated docs, and privacy/setup documentation.
- **Operator-confirmed:** Nous is present as a provider and `/model` correctly selects the model option.
- **Operator-confirmed:** Nous is present, `/model` selects correctly, and a live inference request completed successfully using the configured provider/key.
- **Resolved:** The direct Nous inference path is accepted for this operator-controlled smoke test. No second transport, Portal OAuth flow, or credential-bearing artifact is added.
- **Closure decision:** Treat the earlier sampled HTTP 404s as historical endpoint/model samples, not as an unresolved product blocker; preserve the redacted evidence and close through the normal local implementation-audit/lifecycle process.
- **Historical boundary:** Earlier RED/GREEN/implementation-plan sections preserve the original integration plan; they are not a current request to reimplement the already-landed local provider chain.

## Environment

- **OS:** Windows development workstation; cross-platform CLI behavior required
- **Language/Runtime:** TypeScript monorepo, Bun runtime, React/OpenTUI CLI, Vercel AI SDK provider contracts
- **Tool Versions:** Repository-pinned Bun `1.3.14`; ECHO Protocol v0.2.0; single-agent ECHO adaptation v0.1.2; strict mode enabled
- **Commit/State:** `main`, dirty working tree containing pending v0.0.23 work; implementation and operator-confirmed inference are present, with local lifecycle closure completed
- **Governance:** `ECHO-single-agent.md` and `dev/echo-v0.1.2-single-agent.md` were read 0-EOF before authoring this FID
- **External sources reviewed:**
  - `https://portal.nousresearch.com/api-docs`
  - `https://hermes-agent.nousresearch.com/docs/integrations/nous-portal`
  - `https://hermes-agent.nousresearch.com/docs/user-guide/features/subscription-proxy`

## Detailed Description

### Problem

The local Nous provider path is present and operator-confirmed as selectable through `/provider` and `/model`. The operator also confirmed a successful live inference request using the configured provider/key. Earlier sampled HTTP 404s remain historical route/model evidence and do not block this operator-confirmed release-scope acceptance.

The existing architecture intentionally makes the registry the canonical provider source. A Nous integration is incomplete if it only adds a URL or SDK branch. The provider must round-trip all of these surfaces:

```text
PROVIDER_REGISTRY
  → derived provider/setup/settings IDs
  → /provider command and masked key flow
  → persisted activeProvider and providerApiKeys
  → /model catalog and exact free-text model selection
  → SDK registry loop
  → generic OpenAI-compatible factory
  → Nous chat-completions endpoint
  → /health and generated provider documentation
```

### Expected Behavior

#### Provider identity and setup

1. `nous` is a typed entry in `common/src/providers/registry.ts`.
2. `/provider nous` is recognized by the CLI because `setupAvailable: true` derives it into `PROVIDER_SETUP_CONFIG`.
3. `/provider` lists Nous with the canonical display label `Nous Research`, used consistently in setup, `/health`, generated docs, privacy text, and model-picker surfaces. The label must not imply that this FID implements Nous Portal OAuth.
4. The setup flow accepts a masked, non-empty credential and stores it in the existing provider-key record under `NOUS_API_KEY`.
5. Whitespace is trimmed; empty values are rejected; explicit shell `NOUS_API_KEY` remains higher precedence than a stored key.
6. The key never appears in chat history, rendered setup messages, logs, error text, generated docs, test output, or model metadata.
7. Saving the key activates Nous when no conflicting explicit provider/base-url environment configuration exists, persisting the canonical `activeProvider` and existing provider preference fields through the established settings path.
8. `DIRECT_PROVIDER=nous` and the registry-derived Nous base URL work without backend credentials, matching the existing direct-provider boot contract. The implementation must explicitly test whether bare-slug requests under `DIRECT_PROVIDER=nous` use the generic fallback path; if that path emits OpenRouter-specific headers or structured-output assumptions, either constrain this FID's supported Nous requests to `nous/<id>` or correct the shared fallback generically without introducing a Nous-only branch.
9. Missing-key guidance names both `NOUS_API_KEY` and `/provider nous`.

#### Model selection and catalog

10. Nous appears in the provider/model surfaces rather than only accepting hidden free-text IDs.
11. The provider exposes a live `/v1/models` catalog through the existing generic live-catalog fetcher, authenticated with the configured Nous key when available.
12. The catalog parser accepts the OpenAI-compatible `{ data: [{ id, ... }] }` shape, prefixes each returned upstream ID exactly once with `nous/`, preserves the remainder byte-for-byte, and produces the shared `OpenRouterModel` representation.
13. Catalog fetches use the existing bounded timeout, in-flight deduplication, TTL cache, stale-cache fallback, empty-catalog degradation, and non-secret warning behavior. A catalog outage must not make `/model` unusable; exact free-text model selection remains available.
14. No model IDs are hardcoded as availability guarantees unless authoritative Nous documentation or an operator-provided catalog snapshot establishes them. The documentation examples `Hermes-4-70B`, `Hermes-4-405B`, and other listed models may be used in tests or docs only when their exact API IDs are confirmed; capitalization and punctuation must not be guessed.
15. A selected model uses the internal form `nous/<upstream-id>`. The internal namespace is routing metadata and is not sent to Nous.
16. A bare upstream model ID does not silently hijack another provider's route. Users select `nous/<upstream-id>` or explicitly set Nous as the active provider for the existing bare-slug behavior.

#### SDK routing and request contract

17. `getModelForRequest()` routes every `nous/` model through the registry loop; no Nous-specific routing branch or duplicate URL literal is added.
18. The generic factory strips only the leading `nous/` segment:

```text
nous/hermes-4-70b → hermes-4-70b
nous/anthropic/claude-sonnet-4.6 → anthropic/claude-sonnet-4.6
nous/openai/gpt-5.5-pro → openai/gpt-5.5-pro
```

19. Subject to external contract confirmation, requests use the registry base URL `https://inference-api.nousresearch.com/v1` and resolve to `https://inference-api.nousresearch.com/v1/chat/completions`. If the official API docs or redacted credentialed smoke test establish a different direct base URL, update the registry and this FID before implementation; do not preserve an unverified URL by assumption.
20. Subject to external contract confirmation, requests send `Authorization: Bearer <credential>` and `Content-Type: application/json` through the existing OpenAI-compatible adapter. A Portal refresh token must not be accepted or documented as a permanent `NOUS_API_KEY`.
21. Streaming SSE, non-streaming completions, tool definitions, tool calls, finish reasons, cancellation, usage handling, and retryable network errors remain on the existing adapter path; no second HTTP client or Nous-specific transport is introduced without failing contract evidence.
22. Nous-specific OpenRouter attribution headers are not sent. Nous-specific steering, cache, session, or routing extensions are not sent by default.
23. `supportsStructuredOutputs` remains conservative unless the Nous contract and a representative credentialed smoke test prove that the selected model supports the exact structured-output behavior Savant requests. A mocked request proves serialization only, not remote capability.
24. HTTP `401`, `429`, `5xx`, malformed response, timeout, and network errors remain visible through existing provider error/retry behavior without leaking credentials.

#### Operational and documentation surfaces

25. `/health` identifies direct Nous mode, its registry-derived base URL, and whether the required key is configured, without printing the key.
26. `settings.validProviders`, `activeProvider`, provider logo/domain lookup, allowed provider prefixes, picker ordering, and model-provider types derive from the registry and include Nous without hand-maintained duplicate lists.
27. The provider audit manifest owns any Nous exceptional behavior. A live catalog requires an explicit `live-catalog` manifest entry with existing owner/evidence paths.
28. `bun run generate:provider-docs` adds the safe dummy `NOUS_API_KEY` entry to `.env.example` and the Nous row to `cli/release/README.md`; generated sections are not hand-edited.
29. Provider setup, direct-mode, privacy, installation, SDK/provider, and release documentation explain the direct Nous API boundary and the `NOUS_API_KEY` setup flow without claiming Portal OAuth support.
30. `CHANGELOG.md` receives a closure entry only after implementation, independent audit, and FID closure; no release claim is made by this FID.

### Root Cause

The historical remaining work was local lifecycle closure, not registry wiring or a second transport. The registry-driven integration and generic OpenAI-compatible path are implemented, and the operator-confirmed live inference request accepts the configured direct provider path. Historical route/model-specific 404 samples remain qualified evidence rather than a current product blocker.

The detailed implementation map below is retained as historical evidence of the completed local chain; final local lifecycle disposition is recorded below.

The Nous documentation describes two related credential experiences:

- A direct OpenAI-compatible inference API using a Bearer credential at `https://inference-api.nousresearch.com/v1`.
- Nous Portal OAuth used by Hermes Agent, with a stored refresh token, short-lived inference JWTs, automatic refresh, and re-authentication/quarantine behavior.

This FID targets only the first contract. Treating a Portal refresh token as a permanent `NOUS_API_KEY`, or claiming that `/provider nous` implements browser OAuth, would be a security and product-contract error.

### Evidence

#### Official Nous evidence

The official Hermes Nous Portal documentation states:

```text
Base URL: https://inference-api.nousresearch.com/v1
Configuration example: provider: nous
OpenAI-compatible model selection examples include:
anthropic/claude-sonnet-4.6
openai/gpt-5.5-pro
google/gemini-3-pro-preview
deepseek/deepseek-v4-pro
```

These sources establish the documented Nous Portal/OpenAI-compatible shape. The operator-controlled live inference smoke test confirms the configured direct credential path for this release scope; Hermes Portal's refresh-token flow remains separate and is not treated as a permanent `NOUS_API_KEY`.

The official subscription-proxy documentation states that the OpenAI-compatible surface includes:

```text
/v1/chat/completions — streaming and non-streaming chat completions
/v1/completions — legacy text completions
/v1/embeddings — embeddings
/v1/models — model list
```

The same documentation states that the proxy forwards the request body and preserves SSE, while subscription RPM/TPM limits apply. It also warns that the Portal routes models across different upstream providers, so OpenRouter-specific extensions are not part of the Nous contract.

#### Existing repository evidence

The unified registry establishes the canonical entry seam:

```text
common/src/providers/registry.ts:19
export const PROVIDER_REGISTRY = {
```

The provider setup surface is registry-derived:

```text
cli/src/utils/provider-setup.ts:29
export const PROVIDER_SETUP_CONFIG = deriveSetupConfig(PROVIDER_REGISTRY)
```

The setup flow is reachable through the `/provider` command and picker:

```text
cli/src/commands/defs/modes.ts:187-215
Object.entries(PROVIDER_SETUP_CONFIG)
beginProviderSetup(trimmedArgs)
```

```text
cli/src/chat/use-chat-pickers.ts:152
beginProviderSetup(provider)
```

Credential persistence and active-provider activation are centralized:

```text
cli/src/utils/provider-setup.ts:197-249
saveProviderApiKey(provider, apiKey)
```

The SDK uses one registry loop rather than per-provider routing branches:

```text
sdk/src/impl/model-provider.ts:86-103
for (const config of Object.values(PROVIDER_REGISTRY)) {
  if (config.kind === 'local') continue
  if (!model.startsWith(`${config.id}/`)) continue
```

The generic OpenAI-compatible factory derives URL, model transform, headers, and retry behavior:

```text
sdk/src/impl/model-provider/model-factories.ts:53-112
createProviderModel(config, apiKey, model, extraCreds)
```

The generic live catalog already supports optional authenticated Bearer requests:

```text
cli/src/utils/openrouter-models/live-catalog.ts:49-88
createLiveCatalogFetcher({ url, parse, resolveKey })
headers.Authorization = `Bearer ${key}`
```

The combined picker catalog is the production consumption point:

```text
cli/src/utils/openrouter-models/gateway.ts:77-115
fetchGatewayModels()
```

The provider audit requires live-catalog exceptions to be owned:

```text
common/src/providers/audit.ts:27-49,72-79
PROVIDER_EXCEPTION_MANIFEST
requiredExceptionKinds(config)
```

Generated documentation is registry-derived:

```text
scripts/generate-provider-reference.ts:1-12,24-40
PROVIDER_REGISTRY
bun run generate:provider-docs:check
```

### Impact Assessment

#### Affected Components

Only the following surfaces remain in scope for this active FID:

- remote endpoint/credential contract evidence and redacted operator smoke testing;
- `common/src/providers/registry.ts` only if authoritative evidence requires a URL or contract correction;
- SDK/provider tests only if that contract correction changes the shared request path;
- FID resolution, changelog, and archive records after final disposition.

The following local surfaces are already implemented and are not pending work: registry derivation, `/provider`, stored-key precedence, `/health`, `/model` catalog/selection, generic routing, provider audit ownership, generated docs, and privacy/setup documentation.

Expected implementation files and test surfaces (historical implementation map):

- `common/src/providers/registry.ts` — add the typed `nous` provider entry with the externally confirmed direct base URL
- `common/src/providers/__tests__/provider-registry.test.ts` — provider count, setup derivation, URL/domain/order parity
- `common/src/providers/__tests__/validate-provider-registry.test.ts` — registry and derived-surface parity
- `common/src/providers/__tests__/provider-audit.test.ts` — Nous live-catalog ownership and surface coverage
- `cli/src/utils/openrouter-models/nous.ts` — thin Nous live-catalog wrapper and OpenAI-compatible response parser, if the existing wrapper shape is retained
- `cli/src/utils/openrouter-models/gateway.ts` — include Nous live results in the combined catalog and reset path
- `cli/src/utils/openrouter-models/types.ts` — only if the shared catalog response type needs a safe extension; do not add a duplicate provider union because `ModelProvider` derives from `ProviderId`
- `cli/src/utils/__tests__/openrouter-models.test.ts` — authenticated Nous catalog parsing, prefix preservation, cache/degrade behavior, combined picker inclusion
- `cli/src/utils/__tests__/provider-setup.test.ts` — `/provider nous` metadata, key trim/persistence, shell precedence, active-provider activation, no-secret output
- `cli/src/commands/__tests__/router-provider-setup.test.ts` — command/picker recognition of Nous
- `cli/src/commands/__tests__/health-command.test.ts` — direct Nous health output and redaction
- `sdk/src/impl/__tests__/model-provider-free-mode.test.ts` — missing-key failure, URL/model/header/SSE/tool contract
- `scripts/generate-provider-reference.ts` — add the explicit data-driven Nous table note/selection behavior and direct-API wording as a mandatory documentation-generation change; keep the registry as the source of identity and run the generator afterward
- `.env.example` — generated output only
- `cli/release/README.md` — generated provider table only
- `docs/design/Adding New Providers.md` — add the Nous one-entry example, `/provider nous` flow, live-catalog fallback, and direct-API/OAuth boundary
- `docs/privacy.md`, `docs/installation.md`, `docs/sdk-overview.md`, `docs/features.md`, `README.md`, `README.zh-CN.md` — direct Nous data-boundary/setup documentation where provider lists are intentionally user-facing
- `CHANGELOG.md` — closure entry after the FID is closed

Potentially affected files must be confirmed by call-graph search before implementation. Files that are fully derived must not be hand-edited merely to repeat the registry entry.

#### Out of Scope

- Nous Portal browser OAuth, loopback callback, refresh-token storage, short-lived inference-token minting, token quarantine, automatic re-authentication, and headless/SSH OAuth setup
- A new OAuth credential-resolver abstraction
- Native Anthropic `/messages` transport for Nous
- A second HTTP client, provider SDK, or custom stream parser
- OpenRouter attribution/routing/session/cache headers
- Provider-specific steering or prompt rewriting
- A hardcoded 300+ model catalog without authoritative exact IDs
- Making Nous the default provider or changing the OpenRouter-first boot policy
- Changes to other providers' routing, catalog, credential precedence, or model defaults
- Live credential use in CI, source code, logs, snapshots, or generated artifacts
- Release, tag, push, publication, deployment, or unrelated cleanup

#### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: New provider unavailable or misrouted; existing providers and custom endpoints remain available
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Implement Nous as a standard registry gateway with a live authenticated catalog, reusing all existing provider-derived surfaces and the generic OpenAI-compatible factory. The registry remains the only source for provider identity, base URL, credential env var, protocol, namespace transform, catalog URL, setup availability, domain, and ordering.

The proposed registry contract is:

```ts
nous: {
  id: 'nous',
  label: 'Nous Research',
  kind: 'gateway',
  credentials: { envVar: 'NOUS_API_KEY' },
  baseUrl: 'https://inference-api.nousresearch.com/v1',
  protocol: 'openai',
  idTransform: 'strip',
  catalog: {
    source: 'live',
    url: 'https://inference-api.nousresearch.com/v1/models',
  },
  setupAvailable: true,
  domain: 'nousresearch.com',
  order: 4,
},
```

The canonical display label is `Nous Research`; it must not be changed to `Nous Portal` in this direct-credential FID. The operator-confirmed smoke test resolves the configured direct inference path for this release scope; Portal OAuth and unsupported all-model/tool claims remain outside the evidence boundary.

### Implementation steps

1. Confirm the direct Nous base URL, credential/authentication contract, catalog URL, and exact model-ID response shape from the official API docs or a redacted credentialed smoke test. Then add the `nous` registry entry with the confirmed HTTPS base URL and catalog URL, unique `NOUS_API_KEY`, OpenAI protocol, `strip` transform, `setupAvailable: true`, domain, and deterministic picker order. Do not implement an unverified URL or credential assumption.
2. Confirm through compile-time and registry tests that `nous` derives into allowed model prefixes, valid provider IDs, provider domains, setup metadata, picker ordering, and model-provider types.
3. Add the Nous live-catalog wrapper using `createLiveCatalogFetcher`, `resolveKey: () => process.env.NOUS_API_KEY`, a safe OpenAI-compatible response parser, exact one-prefix normalization, stable sort, timeout, cache, stale-cache fallback, and no-secret logging.
4. Add Nous to the combined gateway catalog and test reset/listener behavior. If a catalog fetch fails or the credential is absent, preserve exact free-text model selection rather than blocking the picker.
5. Verify `/provider nous` end-to-end through the existing command and picker call graph: recognition, masked input, trimming, credentials-file persistence, process environment application, active-provider persistence, and explicit shell precedence.
6. Verify `/health` reports direct Nous mode, registry-derived base URL, required key variable, and configured/not-configured status without exposing key material.
7. Verify SDK routing through `getModelForRequest()` and `createProviderModel()` using mocked fetch: missing-key failure, exact URL, Bearer header, post-prefix model ID, SSE path, tools pass-through, and no OpenRouter-only headers.
8. Add the Nous `live-catalog` provider-audit manifest entry with existing evidence paths and verify URL ownership has no collision.
9. Add the mandatory `Nous Research` generator note/selection behavior, run the provider docs generator, and update only generated sections automatically. Add the mandatory Nous section to `docs/design/Adding New Providers.md` plus direct Nous setup/privacy/data-boundary documentation, explicitly stating that Portal OAuth is not implemented by this FID.
10. Run the complete targeted and repository hard gates. Do not close this FID until independent implementation audit, adversarial review, the operator-confirmed `/provider`/inference evidence, and all documentation/drift checks are recorded. Preserve the direct API/OAuth boundary and do not expand the smoke-test result into unsupported all-model or tool claims.

### Verification plan

#### Static and focused tests

```text
cd common && bun run typecheck
cd common && bun test src/providers/__tests__/
cd sdk && bun run typecheck
cd sdk && bun test src/impl/__tests__/model-provider-free-mode.test.ts
cd cli && bun run typecheck
cd cli && bun test src/utils/__tests__/provider-setup.test.ts src/utils/__tests__/openrouter-models.test.ts
cd cli && bun test src/commands/__tests__/router-provider-setup.test.ts src/commands/__tests__/health-command.test.ts
bun run generate:provider-docs:check
bun x eslint <changed-files> --max-warnings 0
bunx prettier --check <changed-files>
bun run lint:md
```

#### Contract evidence

The implementation audit must quote tool output proving:

- `PROVIDER_REGISTRY.nous` exists and validates cleanly.
- `deriveSetupConfig(PROVIDER_REGISTRY).nous` is present with `NOUS_API_KEY` and the Nous base URL.
- `/provider nous` is reachable through `beginProviderSetup()` and the command/picker call sites.
- `saveProviderApiKey('nous', '  test-key  ')` persists the trimmed key, activates/persists Nous under the existing conditions, and does not render the key.
- `nous/<id>` is accepted by the model/provider vocabulary and appears in the combined model picker when the catalog is available.
- The catalog request uses `Authorization: Bearer <test-key>` only when a key is configured, never prints it, and prefixes returned IDs exactly once.
- Nous model routing reaches `https://inference-api.nousresearch.com/v1/chat/completions`, sends the exact post-prefix model ID, uses Bearer authentication, and does not send OpenRouter-only headers.
- The existing SSE/tool request path remains intact under the shared adapter.
- Missing-key output names `NOUS_API_KEY` and `/provider nous` and contains no credential.
- Generated provider docs and privacy/setup documentation contain Nous consistently and no stale generated sections remain.
- Provider audit, URL ownership, registry validation, and generated-doc drift checks pass.

#### Live operator evidence

A credentialed live smoke test is optional for normal CI and must never print the key. When an operator supplies a local Nous credential, run directly in the harness/CLI:

```text
/provider nous
/health
/model nous/<exact-model-id-from-the-picker>
Send a minimal prompt that exercises a normal response, streaming, and one tool call if the selected model supports tools.
```

Record only redacted outcomes, HTTP status/error class, selected model ID, and endpoint behavior. If no credential is available, the implementation may pass mocked contract tests but live inference/catalog acceptance remains `NEEDS-REVIEW` and the FID cannot claim full remote verification.

#### Call-graph requirement

Law 4 evidence must show production reachability for the new provider wrapper, registry setup entry, combined catalog inclusion, and all new test-covered integrations. Zero production callers for any newly introduced production function is a rejection condition.

## Perfection Loop

> The loop entries below preserve the original planning/convergence/audit trail. Their early “Nous is absent” wording describes the pre-implementation state. The current implementation state and narrowed pending scope are authoritative in **Current Status Reconciliation** and **Resolution** above/below.

### Loop 1 — RED

- **RED:** Nous is absent from the canonical provider registry, derived `/provider` setup, credential persistence surface, active-provider settings, model-picker catalog, SDK routing namespace, provider audit manifest, generated provider docs, privacy/setup docs, and focused regression tests. The existing architecture provides a generic OpenAI-compatible gateway factory and an authenticated live-catalog fetcher, so a new transport is not justified by the documented direct API contract. Nous Portal OAuth is a separate credential lifecycle and cannot be represented honestly by a plain environment API-key field.
- **GREEN:** Add one typed registry entry plus a thin authenticated live-catalog wrapper and combined-catalog inclusion, only after the direct base URL and credential contract are externally confirmed. Rely on registry derivation for `/provider`, settings, valid IDs, logo/domain, routing, health metadata, and generated docs. Use the confirmed `NOUS_API_KEY` contract, OpenAI protocol, one-prefix stripping, conservative capability defaults, free-text catalog fallback, and explicit direct-API-only documentation. Require tests for the complete `/provider` → credential → active-provider → `/model` → SDK request chain.
- **AUDIT:** Pending FID convergence and operator approval. No production implementation is authorized at this stage.
- **ADVERSARIAL:** Pending independent FID review. The audit must challenge whether `/provider` is genuinely reachable, whether live catalog authentication leaks secrets, whether model IDs are transformed exactly once, whether generated docs are drift-checked, and whether Portal OAuth has been incorrectly implied.
- **CHANGE DELTA:** New planning document only; no production files changed.

### Loop 1 evidence boundary — historical pre-implementation record

The direct API base URL, permanent API-key format, and direct authorization lifecycle were historical planning prerequisites. The operator-controlled live inference smoke test resolves the configured direct credential path for this release scope. Nous Portal refresh-token behavior remains a separate, out-of-scope contract.

### Missed Questions

1. **Does “add Nous” mean only a registry entry?** → No. Completion requires `/provider`, masked key setup, persistence, active-provider settings, `/model` visibility, SDK routing, `/health`, generated docs, privacy/setup docs, validation, audit, and tests.
2. **What exact credential does this FID support?** → A direct Nous Bearer credential stored as `NOUS_API_KEY`. Portal OAuth refresh-token behavior is excluded and must not be implied.
3. **Should Nous be visible in `/provider` even without a key?** → Yes. `setupAvailable: true` is required so users can reach the masked setup flow; missing credentials fail closed only when a request is attempted.
4. **Should Nous become the default provider?** → No. It is opt-in; existing OpenRouter-first default behavior remains unchanged.
5. **Should the picker use a static 300+ model list?** → No. Use authenticated live `/v1/models` discovery with bounded cache/degrade and exact free-text fallback; do not invent availability claims.
6. **What if `/v1/models` needs authentication?** → The live fetcher supports an optional Bearer resolver. If the endpoint's response shape or auth behavior differs, update the thin wrapper or keep the catalog degraded without blocking exact model entry; do not bypass credential boundaries.
7. **Should API model IDs include `nous/`?** → No. Strip only the first internal prefix and preserve all nested upstream segments.
8. **Should the provider send OpenRouter headers because Nous may route through OpenRouter?** → No. Nous's routing is its contract; OpenRouter extensions are not guaranteed and are intentionally omitted.
9. **Should structured outputs be enabled?** → Not by assumption. Keep the conservative shared default until Nous/model-specific evidence proves compatibility.
10. **Should Nous Portal tool gateway be integrated?** → No. Portal-managed external tools are separate from model inference and outside this provider FID.
11. **Should live credentials be required in CI?** → No. Use mocked fetch and redacted operator smoke tests; never commit or print a real key.
12. **What happens when a live catalog is empty or unavailable?** → Keep the last good cache, otherwise show no catalog entries while preserving exact free-text model selection and actionable setup guidance.
13. **Does `/health` need a hand-written Nous branch?** → No if registry-derived setup metadata is sufficient; only add code if a test proves an explicit provider enumeration gap.
14. **Do derived surfaces permit manual duplicate lists?** → No. Update the registry and generic catalog aggregation only where required; do not hand-edit `ModelProvider`, `PROVIDER_SETUP_CONFIG`, valid provider IDs, or generated sections.
15. **What proves the provider is fully wired?** → A model ID must round-trip from `/model` selection and persisted `activeProvider` through registry lookup, key resolution, generic factory, correct URL/auth/model transformation, and response streaming.

### Code Verification Evidence

- [x] Single-agent ECHO protocol read 0-EOF before authoring.
- [x] Existing provider FID and unified registry runbook inspected.
- [x] Official Nous documentation reviewed and direct API versus Portal OAuth boundary recorded; operator-confirmed live inference resolves the configured direct credential path for this release scope.
- [x] `/provider` derivation, masked setup, persistence, active-provider, model catalog, SDK routing, health, audit, and generated-doc seams mapped.
- [x] Production implementation matches this FID: registry, derived `/provider` setup, persistence, catalog, SDK routing, health, audit ownership, generated docs, and direct-provider safety guard are implemented.
- [x] Typecheck/tests/lint pass for the changed provider surfaces: common 27/27, SDK 14/14, CLI 49/49; all three workspace typechecks, ESLint, Prettier, and provider-doc drift check pass.
- [x] Production call-graph evidence is present: `PROVIDER_REGISTRY` → `deriveSetupConfig` → `/provider` command/picker; `fetchNousModels` → `fetchGatewayModels`; registry loop → generic factory; health reads registry-derived setup metadata.
- [x] Credential-safe live catalog verification: local `NOUS_API_KEY` was present; `GET https://inference-api.nousresearch.com/v1/models` returned HTTP 200 with a valid data array and 362 string model IDs. No key, model ID, response body, or header was recorded.
- [x] Credential-safe live inference verification — operator-confirmed successful live inference using the configured Nous provider/key; no credential or response content is recorded.
- [x] FID status reflects implementation ground truth: local provider integration and operator inference acceptance are complete; the FID completed local lifecycle closure.

### Loop 2 — GREEN convergence, AUDIT, and ADVERSARIAL

- **RED:** Independent review identified four planning gaps: the provider label was ambiguous; the direct API-key contract was stated too strongly from Portal/proxy evidence; generated-provider-note/runbook scope was conditional; and bare-slug active-provider behavior could inherit OpenRouter-specific fallback semantics.
- **GREEN:** Corrected the FID to use the canonical label `Nous Research`, made direct base URL/credential/endpoint claims conditional on authoritative confirmation, added explicit generator-note and `docs/design/Adding New Providers.md` requirements, and required a bare-slug acceptance test with a constrained prefixed-model fallback or generic correction if OpenRouter-only behavior is observed.
- **AUDIT:** PASS for planning completeness after correction. The FID covers `/provider` recognition, masked setup, persistence, active-provider state, `/model` live catalog and free-text fallback, SDK routing, health, audit ownership, generated docs, runbook/privacy docs, and the direct-API/OAuth security boundary. The later operator-confirmed inference result resolves the configured direct credential path for this release scope.
- **ADVERSARIAL:** PASS — no unresolved planning contradiction remains. The direct provider label cannot imply OAuth, generated documentation cannot silently omit the provider note, bare-slug routing cannot be accepted without checking shared fallback headers/capabilities, and unverified direct credential claims are explicitly gated rather than presented as facts.
- **CHANGE DELTA:** FID-only self-correction after independent review; no production files changed.

### Loop 3 — Final convergence

- **RED:** Fresh repository review confirmed all required implementation seams: `/provider` command and picker recognition, registry-derived setup metadata, credential persistence, `activeProvider`, `/health`, combined model catalog, generic SDK registry loop/factory, generated docs, and provider audit. The remaining risk was evidence classification for the direct Nous credential contract.
- **GREEN:** Preserved the direct API/OAuth boundary, made external confirmation a prerequisite before registry implementation, kept the canonical label `Nous Research`, required the live catalog's authenticated bounded fallback, required the generator note and provider runbook update, and constrained bare-slug acceptance around shared OpenRouter-specific fallback behavior.
- **AUDIT:** PASS for FID planning convergence. Evidence: `cli/src/utils/provider-setup.ts:29` derives setup from `PROVIDER_REGISTRY`; `cli/src/commands/defs/modes.ts:187-215` consumes `PROVIDER_SETUP_CONFIG` and calls `beginProviderSetup`; `cli/src/chat/use-chat-pickers.ts:152` reaches setup from the picker; `cli/src/utils/provider-setup.ts:197-266` persists provider keys, applies the process key, and calls `saveActiveProvider`; `cli/src/commands/health-command.ts:28-79` builds direct-provider health output from the active provider, registry base URL, setup metadata, and redacted key state; `sdk/src/impl/model-provider.ts:86-103` routes registry prefixes through the generic loop; `sdk/src/impl/model-provider/model-factories.ts:53-112` constructs the generic provider request; `cli/src/utils/openrouter-models/live-catalog.ts:49-88` supports authenticated bounded catalog fetching; `cli/src/utils/openrouter-models/gateway.ts:77-115` consumes the combined picker catalog; `scripts/generate-provider-reference.ts:1-12,24-40` provides generated documentation and drift checking; `common/src/providers/audit.ts:27-49,72-79` owns live-catalog exceptions; `docs/design/Adding New Providers.md:1-42` establishes the one-entry provider/runbook contract; `docs/privacy.md:42-62` establishes BYOK storage and provider-key privacy rules; `cli/release/README.md:42-62` establishes the user-facing provider setup table and credential-storage documentation.
- **ADVERSARIAL:** PASS. The FID requires `/provider` visibility rather than merely registry presence, does not invent model availability, does not claim Portal OAuth, does not permit credential leakage, requires exact namespace stripping, checks bare-slug fallback semantics, and requires the health/privacy/runbook documentation seams to be updated. The operator-confirmed inference evidence resolves the release-scope remote boundary without claiming every model, tool call, or OAuth mode. No unresolved actionable planning gap remains.
- **CHANGE DELTA:** Final FID-only convergence pass; no production implementation, credentials, or unrelated files changed.

### Loop 4 — Current-scope convergence under master FID-2026-0812-006

- **RED:** Re-audited the current record against operator confirmation that Nous is present, selectable, and usable through `/model`, including a successful live inference request. The local registry/setup/catalog/routing/documentation chain is not pending.
- **GREEN:** Accepted the configured direct inference path at the level tested, while preserving the Portal OAuth boundary, redaction rules, and no-second-transport invariant.
- **AUDIT:** PASS — the current reconciliation and implementation addendum record authenticated `/v1/models` discovery and the operator-confirmed successful inference result; earlier sampled 404s remain qualified historical evidence.
- **ADVERSARIAL:** PASS — provider selectability is not the sole basis for acceptance, no credential-bearing evidence is recorded, and no unsupported OAuth or all-model claim is made.
- **CHANGE DELTA:** Current-scope reconciliation only; no production implementation changed.

### Loop 6 — Operator inference closure reconciliation

- **RED:** Reconciled the prior catalog/inference discrepancy against the operator's confirmation that live Nous inference now succeeds. The prior 404 samples remain historical evidence for specific routes/models and do not override the successful accepted smoke test.
- **GREEN:** Closed the remote contract boundary at the level actually tested: configured direct provider, authenticated request, successful response. Preserved the Portal OAuth exclusion, redaction rule, generic registry routing, and no-second-transport invariant.
- **AUDIT:** PASS — registry/setup/routing/catalog seams are cited at `dev/fids/FID-2026-0812-003-nous-research-provider-integration.md:445`, the combined catalog path is `cli/src/utils/openrouter-models/gateway.ts:83-112`, and the operator supplied the missing live inference result. No credential-bearing evidence is persisted.
- **ADVERSARIAL:** PASS — the successful smoke test is not expanded into unsupported claims about every model, tool call, or OAuth mode; the historical 404s are not misrepresented as current failure; and no remote or GitHub operation is performed.
- **CHANGE DELTA:** Operator-confirmed inference closure; documentation only.

### Loop 7 — Operator-confirmed inference closure reconciliation

- **RED:** Reconciled the prior catalog/inference discrepancy against the operator's confirmation that live Nous inference now succeeds. The prior 404 samples remain historical evidence for specific routes/models and do not override the successful accepted smoke test.
- **GREEN:** Closed the remote contract boundary at the level actually tested: configured direct provider, authenticated request, successful response. Preserved the Portal OAuth exclusion, redaction rule, generic registry routing, and no-second-transport invariant.
- **AUDIT:** PASS — registry/setup/routing/catalog seams are cited at `dev/fids/FID-2026-0812-003-nous-research-provider-integration.md:445`; the combined catalog path is `cli/src/utils/openrouter-models/gateway.ts:83-112`; and the operator supplied the missing live inference result. No credential-bearing evidence is persisted.
- **ADVERSARIAL:** PASS — the successful smoke test is not expanded into unsupported claims about every model, tool call, or OAuth mode; historical 404s are not represented as current failure; and no remote or GitHub operation is performed.
- **CHANGE DELTA:** Operator-confirmed inference closure; documentation only.

### Loop 8 — Local lifecycle closure

- **RED:** Reconciled the operator-confirmed direct Nous inference with the implemented registry-derived provider chain and focused provider evidence. The release-scope direct inference boundary is resolved; Portal OAuth remains explicitly out of scope.
- **GREEN:** Closed the direct provider integration at the tested contract level only. Preserved redaction, generic routing, historical 404 qualification, and the no-second-transport invariant.
- **AUDIT:** PASS — provider-focused validation passed 90/90 tests across 7 files; common, SDK, and CLI typechecks passed; provider reference drift check passed. Nova's planning re-sign-off is preserved as planning evidence, while the operator-confirmed live inference is recorded separately above.
- **ADVERSARIAL:** PASS — closure does not claim every Nous model, tool capability, Portal OAuth, or remote contract beyond the tested smoke path. No credential-bearing material, release action, or GitHub operation is included.
- **CHANGE DELTA:** Lifecycle closure only; no production implementation change.

## Resolution

- **Closed Date:** 2026-08-12
- **Fix Description:** Local provider integration and the configured direct Nous inference path are complete and operator-confirmed through `/provider`, `/model`, and a successful live inference request. Portal OAuth remains out of scope.
- **Tests Added:** Local common, CLI, and SDK provider suites plus typecheck, provider-doc drift, Prettier, and ESLint evidence are recorded below.
- **Verification Evidence:** Operator confirmed successful live Nous inference; earlier sampled HTTP 404s remain retained as route/model-specific historical evidence. No secret-bearing material was recorded.
- **Archived:** Moved to `dev/fids/archive/` after closure; no remote or GitHub operation is involved.

## Implementation Resolution Addendum (2026-08-12)

- **Implementation status:** Complete for the local product contract. The registry entry, registry-derived `/provider` setup, masked persistence, active-provider activation, authenticated live catalog, combined catalog isolation, `/health` reporting/redaction, provider audit manifest, generated provider docs, user-facing documentation, generic SDK routing, and active-gateway bare-slug fail-closed guard are implemented.
- **Focused evidence:** common provider/audit suites 27/27; CLI provider/setup/catalog/health/router suites 49/49; SDK provider-routing suite 14/14; common, SDK, and CLI typechecks exit 0; provider-doc drift check, Prettier, and ESLint exit 0.
- **Independent review:** Local implementation review found no critical/high local defect after the active-gateway safety guard and regression coverage were added. The review retained the remote inference boundary below.
- **Credential-safe remote evidence:** `GET /v1/models` returned HTTP 200 with a valid data array and 362 model IDs using the operator's local key. Eight sampled requests each returned HTTP 404 from `/v1/chat/completions`; the same sampled requests returned HTTP 404 from `/v1/responses` and `/v1/completions`. No secret-bearing material was recorded.
- **Resolution:** Local implementation and operator-confirmed direct inference acceptance are complete. The historical sampled 404s remain retained as route/model-specific evidence; they no longer block closure. Portal OAuth and the local Hermes API server remain separate contracts and are not silently substituted.

## Lessons Learned

- A registry-derived provider architecture reduces integration work only when every derived surface is tested as a chain, not when a registry entry is treated as completion.
- A successful authenticated model catalog does not prove that the same public endpoint accepts inference; catalog and inference acceptance must be recorded separately.
- `/provider` visibility, credential persistence, active-provider state, `/model` catalog availability, and SDK routing are one user journey and must be accepted together.
- OAuth-backed subscription gateways and direct API-key gateways can share an inference protocol while requiring different credential lifecycles; the integration must not collapse those security boundaries.
- Live model catalogs need authenticated, bounded, redacted failure behavior and exact free-text fallback because provider availability changes independently of the CLI release cycle.
