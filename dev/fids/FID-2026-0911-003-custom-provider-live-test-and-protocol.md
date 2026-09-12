# FID: Custom-provider UX hardening — wizard live test + Anthropic protocol option

**Filename:** `FID-2026-0911-003-custom-provider-live-test-and-protocol.md`
**ID:** FID-2026-0911-003
**Severity:** medium
**Status:** created (Loop 1 RED recorded; presented to the operator per
Law 2 before any code is written)
**Created:** 2026-09-12 (operator pre-closure questions on
FID-2026-0911-001: "is there a 'live test' when going through the
wizard?" and "is this only openai or does it support anthropic too? some
outliers may use anthropic too")
**YAGNI-Compliance:** Verified — one optional protocol field on the
existing `CustomProviderConfig` + one verify call in the existing wizard
terminal path. No new modes, no new commands, no new persistence.
**Related:** FID-2026-0910-004 (custom providers — the feature this
hardens); FID-2026-0911-001 (picker add-new entry — the discovery
surface); FID-2026-0911-004 (B.AI — its `/messages` endpoint is a
concrete Anthropic-outlier motivating the protocol field)

---

## Summary

Two gaps in the custom-provider experience, both surfaced by the
operator's pre-closure due diligence:

1. **No live test in the wizard.** A user can complete `/provider add`
   with a wrong key or wrong base URL and get zero feedback — the first
   proof anything is wrong is a failed chat message. Add a lightweight
   live verification at the wizard's terminal step: a GET
   `{baseUrl}/models` (Bearer) with a three-outcome degradation ladder
   (verified / rejected / unverifiable) that NEVER blocks the save.
2. **Customs are OpenAI-only.** `toProviderConfig` hardcodes
   `protocol: 'openai'` and `CustomProviderConfig` has no protocol
   field — an Anthropic-compatible outlier endpoint (`/v1/messages`,
   Claude-style) cannot be used as a custom provider. Add an optional
   `protocol: 'openai' | 'anthropic'` field (wizard prompt, default
   openai) and thread it through validation + lifting.

Includes one **latent routing bug** that must land first (Loop-1
discovery, "flag ANY issue"): `resolveProtocol`'s no-map branch returns
`'openai'` unconditionally.

## Environment

- **OS:** Windows 11 host (win32, Git Bash); Bun 1.3.14-pinned
- **Evidence gathered 2026-09-12 (grep/file:line, this session):**
  - Wizard terminal path does zero network I/O:
    `route-provider-wizard.ts:155-175` — `persistDefinition` (settings
    write + registry refresh) → `persistKey` (`saveProviderApiKey`,
    0600 store) → `reactivateIfActive` → summary. No fetch anywhere in
    the file; nothing in `provider-wizard.ts` either (grep: no
    `fetch`/`probe`/`verify`).
  - `CustomProviderConfig` has no protocol field:
    `common/src/providers/types.ts:118-133` (id, label, baseUrl,
    apiKeyEnvVar, catalog — that is the whole shape).
  - `toProviderConfig` hardcodes the protocol:
    `common/src/providers/custom-providers.ts:313-325`
    (`protocol: 'openai'`, `idTransform: 'strip'`).
  - **LATENT BUG:** `resolveProtocol` no-map branch
    (`sdk/src/impl/model-provider/model-factories.ts:192-201`):
    ```ts
    if (config.protocolMap === undefined) {
      if (config.protocol !== 'openai' && config.protocol !== 'anthropic') {
        throw new Error(...)
      }
      return 'openai'   // ← returns 'openai' even for protocol 'anthropic'
    }
    ```
    No current registry entry has `protocol: 'anthropic'` without a map,
    so nothing misdispatches today — but the first `'anthropic'`-no-map
    entry (exactly what this FID adds for customs) would send
    OpenAI-shaped requests to an Anthropic `/v1/messages` endpoint.
  - The generic anthropic factory exists and is registry-driven:
    `model-factories.ts:81-89` (`createAnthropic` with the entry's
    baseUrl + apiKey) — no new transport machinery needed.
  - Real-world Anthropic-outlier gateways already integrated or probed:
    OrcaRouter (`/v1/messages` documented), B.AI (`/v1/messages`
    documented, FID-2026-0911-004), apinex (`POST /v1/messages` per its
    llms.txt).

## Detailed Description

### Problem

1. A mis-keyed or mis-URL'd custom provider is indistinguishable from a
   working one until a chat fails — violating the spirit of Law 3
   (verify before proceed) at the UX layer.
2. The custom-provider feature's promise is "bring your own provider",
   but the Anthropic-outlier half of the gateway world is excluded by a
   hardcoded protocol.

### Expected Behavior

1. At the wizard's key step (add mode; edit mode only when a NEW key is
   entered), the terminal save path fires GET `{baseUrl}/models` with
   `Authorization: Bearer <key>` and reports one of:
   - **200** → "Key verified live against the provider." (catalog models
     count included when the shape parses)
   - **401/403** → explicit "The provider rejected this key" warning
   - **anything else / timeout / parse failure** → "Could not verify
     (endpoint may not support model listing)" — the save proceeds
   The result NEVER blocks the save (some gateways 404 their `/models`
   or gate it differently); it is evidence, not a gate. The summary
   message carries the outcome.
2. `/provider add` and `/provider edit` gain a protocol question at the
   baseUrl step: default `openai`; `anthropic` for endpoints exposing
   Claude-style `/v1/messages`. Stored on the record; validation accepts
   exactly `openai | anthropic` (anything else fails closed); missing
   field on old records defaults to `openai` (backward compatible).
3. `resolveProtocol`'s no-map branch returns `config.protocol` (fixing
   the latent misdispatch).

### Root Cause

Feature shipped (FID-2026-0910-004) with the operator's own trial key
and an OpenAI-shaped reference endpoint — both gaps invisible in that
configuration.

### Evidence

(see Environment — all file:line, grepped this session)

## Impact Assessment

### Affected Components

- `common/src/providers/types.ts` (+1 optional field on
  `CustomProviderConfig`)
- `common/src/providers/custom-providers.ts` (validation + one line in
  `toProviderConfig`)
- `sdk/src/impl/model-provider/model-factories.ts` (the `resolveProtocol`
  one-line fix + a pin)
- `cli/src/utils/provider-wizard.ts` (step instructions + draft field)
- `cli/src/commands/router/route-provider-wizard.ts` (verify call at the
  terminal path + summary text)
- Suites: custom-providers validation, model-provider-custom, wizard
  e2e (mocked-fetch pins), settings round-trip

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium: the verify call adds one network request to a local-only
      path (timeout-bounded, degradation never blocks); the protocol
      field touches the routing hot path — mitigated by the
      `resolveProtocol` fix landing WITH the field, pinned by tests
- [ ] Low

## Proposed Solution

### Approach

1. **`resolveProtocol` fix first** (one line + pin): no-map branch
   returns `config.protocol as ProviderModelProtocol`. The existing
   throw for map-dispatched protocols without a map is unchanged.
2. **Protocol field:** `protocol?: 'openai' | 'anthropic'` on
   `CustomProviderConfig`; validation restricts to the two values
   (undefined → openai at lift time); `toProviderConfig` passes
   `protocol: custom.protocol ?? 'openai'`. Wizard: one extra question
   after baseUrl ("Protocol — openai (default) or anthropic
   (Claude-style /v1/messages endpoints); press Enter for openai").
   Input-mode continuity follows the existing step machine.
3. **Live test:** a `verifyCustomProviderKey(baseUrl, key)` helper
   (AbortSignal.timeout(8s), no retry, no logging of key material) on
   the terminal path; outcome folded into the existing summary message
   (D9-style single message). Edit mode with kept key → skip (no new
   material to verify).

### Steps

1. [ ] **RED:** pins for the `resolveProtocol` fix (anthropic-no-map →
   'anthropic'), validation protocol pins (valid/invalid/missing),
   `toProviderConfig` lift pin, wizard protocol-step pins, verify-helper
   pins (200/401/403/404/timeout via mocked fetch), e2e summary-text
   pin. Capture failing.
2. [ ] **GREEN:** the three surfaces above, in dependency order
   (model-factories → common → cli).
3. [ ] **VERIFY:** typecheck ×4; suites (common providers, sdk
   model-provider-custom, cli wizard + settings + custom-catalog);
   eslint; prettier; lint:md; validate:repository parity.
4. [ ] **LIVE (operator-assisted):** add a real Anthropic-outlier custom
   provider via the wizard and observe the live-test outcome in the
   summary; a B.AI `/messages` custom entry is the natural candidate
   once FID-2026-0911-004's key exists.

### Live Unknowns

1. Some OpenAI-shape gateways return non-JSON on `/models` or require
   auth headers beyond Bearer — the degradation ladder treats all
   non-200/401/403 outcomes as "unverifiable", so no integration can
   break; only the message text varies.
2. Whether any operator endpoint needs a THIRD protocol (Gemini-native)
   — deliberately out of scope; the two-value field is extensible
   without schema change.

## Verification Gates

- gate: typecheck common / sdk / packages/agent-runtime / cli
- gate: test common/src/providers/__tests__/
- gate: test sdk/src/impl/__tests__/model-provider-custom.test.ts
- gate: test cli/src/commands/__tests__/provider-add-wizard.test.ts
- gate: test cli/src/utils/settings/__tests__/settings-custom-providers.test.ts
- gate: eslint --max-warnings 0 · prettier · lint:md ·
  generate:provider-docs:check · validate:repository parity

## Perfection Loop

### Loop 1 — Authoring (2026-09-12, post-grounding)

- **RED findings:** no network I/O anywhere in the wizard terminal path
  (grep evidence); protocol hardcoded at the lift; `resolveProtocol`
  latent misdispatch for anthropic-no-map (file:line quoted).
- **GREEN (initial):** the three-part plan above; bug fix sequenced
  FIRST because the protocol field depends on it for correctness.
- **CHANGE DELTA:** initial authoring.

## Lessons Learned

- The operator's pre-closure questions were better review than any
  audit pass this session ran: both feature gaps were real, and one
  question ("does it support anthropic too?") flushed out a latent
  routing bug that would have misdispatched the very endpoint the
  question was about.
