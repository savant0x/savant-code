# FID: B.AI gateway provider integration

**Filename:** `FID-2026-0911-004-bai-gateway-provider.md`
**ID:** FID-2026-0911-004
**Severity:** low
**Status:** closed (2026-09-12 — keyed live acceptance PASSED:
catalog 47/47 via the production chain, chat 200 `pong` on
`qwen3.8-flash`, fail-closed 401 verified; Loop 3 recorded)
**Created:** 2026-09-12 (operator directive: "make a new fid, i want to
add this provider as well https://docs.b.ai/llmservice/introduction/")
**YAGNI-Compliance:** Verified — one registry entry per the one-entry
runbook (`docs/archive/design/Adding New Providers.md`) plus the house
thin-wrapper pattern for live-catalog providers (FID-2026-0911-002
precedent), three Step-5 test legs, docs regen. No new transport
machinery: the OpenAI factory (or the FID-2026-0911-003 protocol field
for the `/messages` outlier path) already covers the wire protocols.
**Related:** FID-2026-0809-001 (registry single source of truth);
FID-2026-0911-002 (OrcaRouter — the wrapper pattern this inherits);
FID-2026-0911-003 (custom protocol field — if it lands first, a B.AI
`/messages`-outlier entry could alternatively be a custom provider;
a built-in is still preferred for the derived `/provider` UX)

---

## Summary

Add **B.AI** (`b.ai`, "LLM Service") as a built-in provider in
`PROVIDER_REGISTRY`: a unified API at `https://api.b.ai/v1` compatible
with **OpenAI Chat Completions** (`/v1/chat/completions`), **OpenAI
Responses** (`/v1/responses`), and **Anthropic Messages**
(`/v1/messages`) protocols, authenticated by one platform key
(`BAI_API_KEY`, `sk-…`) via `Authorization: Bearer` or `x-api-key`.
`GET /v1/models` lists the models associated with the credential. The
registry entry ships as `protocol: 'openai'` (the chat-completions
surface is the CLI's default path); the `/messages` surface makes B.AI
also a concrete instance of the Anthropic-outlier case that
FID-2026-0911-003 hardens. A keyed live acceptance (catalog via the
production chain + chat round-trip) is the closure gate.

## Environment

- **OS:** Windows 11 host (win32, Git Bash); Bun 1.3.14-pinned
- **Evidence gathered 2026-09-12 (this session, tool output):**
  - `https://docs.b.ai/llmservice/api/` (HTTP 200): "unified large
    language model API compatible with the OpenAI Chat Completions,
    OpenAI Responses, and Anthropic Messages protocols"; Production
    Base URL **`https://api.b.ai/v1`**; auth `Authorization: Bearer
    <BAI_API_KEY>` **or** `x-api-key` (equivalent); endpoints
    `GET /v1/models` (auth), `POST /v1/responses`, `POST
    /v1/chat/completions`, `POST /v1/messages` (Anthropic-compatible,
    Claude SDK/Claude Code use case); SSE streaming on all three.
  - Keyless probes (this session): `GET /v1/models` → **401**
    OpenAI-shaped `{"error":{…,"type":"api_error"}}` — the catalog is
    **authenticated** (unlike OrcaRouter's) → the wrapper needs the
    Nous-style `resolveKey` wire-in; `POST /v1/chat/completions` `{}` →
    **401** `"未提供 Authorization 或 x-api-key 请求头"` ("no
    Authorization or x-api-key header provided") — endpoint exists,
    fails closed on missing auth.
  - Responses-API quirks (documented): `max_tokens`/`max_completion_tokens`
    → 400 on `/responses` (use `max_output_tokens`); DeepSeek models do
    not support web search there. Not relevant to the CLI's
    chat-completions path — recorded for the closure-gate probe design.
  - Payment: credit-based (Stripe cards, WeChat Pay, Alipay, UnionPay,
    on-chain tokens). Login: Google sign-in or Web3 wallet. The
    blockchain framing is account/settlement plumbing only — the API
    surface is plain HTTP with Bearer keys.
  - Precedent: FID-2026-0911-002 (OrcaRouter) — wrapper pattern, uniform
    prefixing discipline, keyed-acceptance gate.

## Detailed Description

### Problem

The operator wants B.AI selectable as a provider. The registry has no
`bai` entry, so no routing prefix, credential slot, catalog source, or
picker wiring exists.

### Expected Behavior

- `/provider bai` lists the provider, accepts a key (`BAI_API_KEY`),
  persists it, and self-selects.
- `/model` lists B.AI models (internal ids `bai/<model-id>`) from the
  **authenticated** live catalog (`resolveKey` wire-in, Nous pattern).
- Chat round-trip sends `POST https://api.b.ai/v1/chat/completions`
  with the internal `bai/` prefix stripped and the key as Bearer.
- Missing key fails closed with the templated message naming the env
  var and the `/provider` hint.

### Root Cause

New provider; nothing existed to integrate.

### Evidence

- Docs contract quoted above (base URL, three protocols, key shape,
  auth headers, `/models` authenticated).
- Keyless probes: `/v1/models` 401 (authed catalog), `/chat/completions`
  401 fail-closed (pasted this session).
- Wrapper + manifest precedents: `orcarouter.ts` (FID-2026-0911-002),
  `apinex.ts` (FID-2026-0907-008 — authed catalog with resolveKey is the
  exact template here).

## Impact Assessment

### Affected Components

- `common/src/providers/registry.ts` (+~17 lines — the `bai` entry)
- `common/src/providers/provider-exception-manifest.ts` (+1 `live-catalog`
  entry with `credential-resolver` if a resolveKey seam is wired)
- `cli/src/utils/openrouter-models/bai.ts` (new thin wrapper — authed
  catalog, uniform prefixing, shared fetcher)
- `cli/src/utils/openrouter-models/gateway.ts` (merge + reset seam)
- `common/src/providers/__tests__/provider-registry.test.ts` (contract
  pin + count-parity 13→14, 11→12)
- `sdk/src/impl/__tests__/model-provider-free-mode.test.ts` (routing +
  templated error) + harness env save/restore
- `cli/src/utils/__tests__/provider-setup.test.ts` (`saveProviderApiKey`)
- `cli/src/utils/__tests__/openrouter-models-bai.test.ts` (parser pins)
- Regenerated docs (`generate:provider-docs`)

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium: additive registry entry; keyless probes prove endpoints
      exist and fail closed, but the keyed paths (catalog shape, chat
      round-trip) cannot be proven without a key — keyed live acceptance
      remains the closure gate (FID-2026-0906-008 lesson)
- [ ] Low

## Proposed Solution

### Approach

```ts
bai: {
  id: 'bai',
  label: 'B.AI',
  kind: 'gateway',
  credentials: {
    envVar: 'BAI_API_KEY',
    missingKeyMessage:
      'B.AI API key not set. Set BAI_API_KEY environment variable or run /provider bai.',
  },
  // docs.b.ai/llmservice/api/: "Production Base URL: https://api.b.ai/v1".
  baseUrl: 'https://api.b.ai/v1',
  protocol: 'openai',
  // Upstream ids are bare model ids (docs examples use "your-model-id");
  // `strip` removes the internal `bai/` routing prefix.
  idTransform: 'strip',
  // AUTHENTICATED live catalog (keyless /v1/models → 401, probed) — the
  // Nous/apinex resolveKey pattern, NOT the OrcaRouter keyless pattern.
  catalog: { source: 'live', url: 'https://api.b.ai/v1/models' },
  setupAvailable: true,
  domain: 'b.ai',
  order: 4,
}
```

`bai.ts` wrapper: apinex.ts template (authed catalog) + OrcaRouter's
uniform-prefixing lesson (prefix every id uniformly — already-prefixed
`bai/` upstream ids, if any, get double-prefixed so `strip` recovers the
exact upstream id; the parser pin proves the round-trip).

If FID-2026-0911-003 (protocol field) lands first, the FID gains an
optional follow-up: an `anthropic`-protocol path for the `/messages`
surface — but the built-in entry itself stays `openai` (the CLI's chat
path), and this follow-up is NOT required for closure.

### Steps

1. [x] **RED:** registry contract pin + count-parity 13→14 / 11→12;
   sdk free-mode routing leg + templated-error leg; cli
   `saveProviderApiKey` leg; wrapper parser pins (uniform prefixing,
   round-trip through `strip`, malformed-row tolerance). Capture
   failing.
2. [x] **GREEN:** registry entry + `bai.ts` wrapper (resolveKey via the
   shared fetcher's `resolveKey` option reading `BAI_API_KEY`) + gateway
   merge + audit-manifest entry + `generate:provider-docs`.
3. [x] **VERIFY:** typecheck ×4; targeted suites; docs-check; eslint
   `--max-warnings 0`; prettier; lint:md; validate:repository parity.
4. [x] **LIVE (closure gate, keyed) — PASSED 2026-09-12.** Probe:
   `dev/scratchpad/active/bai-acceptance-probe.ts` (key loaded from
   `.env.local` as `BAI_API_KEY`, never printed, Law 12). Results:
   (a) catalog via `fetchGatewayModels(true)` — 1,363 combined models,
   **47 `bai/…` entries** through the exact production chain `/model`
   uses; bare upstream ids (`claude-opus-5`, `qwen3.8-flash`,
   `gpt-5.6-sol`) confirm the uniform-prefix parser was the right
   shape-proofing call; (b) keyed chat round-trip on
   `bai/qwen3.8-flash` → **HTTP 200, content `pong`**; (c) missing-key
   chat → 401 fail-closed.
   - Model-family behavior map (keyed diagnostics, 2026-09-12):
     premium family (`claude-*`, `gpt-5.6-*`, `gpt-5-nano`,
     `gemini-3.5-flash-lite`) → 403 `access_denied` "Deposit required
     to unlock premium models"; mid-tier (`deepseek-v4.1-flash`,
     `glm-5.3-flash`) → 400 `insufficient_user_quota`
     (balance=0, required=2/102 credits); **`qwen3.8-flash` → 200**
     (account-entitled). One callable model is sufficient acceptance —
     the integration (auth, parsing, routing, transform) is fully
     proven; model entitlement is account state, not integration state.

### Live Unknowns (keyless-unverifiable; resolved at Step 4)

1. **`/v1/models` response shape keyed** — docs show OpenAI shape with a
   nonstandard `"success": true` extra field; the parser tolerates extra
   fields, but the real payload is only observable with a key.
2. **Model-id shape** — docs only say "your-model-id"; vendor-namespacing
   (OpenAI-style `gpt-…` vs `openai/gpt-…`) is resolved by the first
   keyed catalog listing; the parser's uniform-prefixing is shape-proof.
3. **Chat round-trip + streaming** — minimum acceptance is a
   non-streaming 200; streaming observed in normal use.

## Verification Gates

- gate: typecheck common / sdk / packages/agent-runtime / cli
- gate: test common/src/providers/__tests__/
- gate: test sdk/src/impl/__tests__/model-provider-free-mode.test.ts
- gate: test cli/src/utils/__tests__/provider-setup.test.ts
- gate: test cli/src/utils/__tests__/openrouter-models-bai.test.ts
- gate: run generate:provider-docs:check
- gate: eslint --max-warnings 0 · prettier · lint:md ·
  validate:repository parity

## Perfection Loop

### Loop 1 — Authoring (2026-09-12, post-grounding)

- **RED:** no `bai` surface exists; registry-derived unions and
  count-parity tests assert the closed 13-provider world. Keyless
  probes already ran (models 401 / chat 401, pasted) — the catalog is
  authenticated, so the wrapper plan differs from OrcaRouter's
  (resolveKey wire-in, apinex template) and the audit manifest needs a
  `credential-resolver` kind alongside `live-catalog`.
- **GREEN (initial):** one registry entry + thin authed-catalog wrapper
  + three Step-5 test legs + docs regen.
- **Grounding note (FID-2026-0907-008 Loop-2 discipline):** base URL is
  the documented `https://api.b.ai/v1`; catalog architecture is the
  generic fetcher + resolveKey (no new per-provider machinery — Law
  13); the uniform-prefixing parser pin is mandatory (the
  FID-2026-0911-002 lesson — a mixed or already-prefixed id shape would
  otherwise misround-trip).
- **CHANGE DELTA:** initial authoring.

### Loop 2 — Implementation (2026-09-12, autonomous mode 3)

- **RED captured failing before GREEN** (all four legs):
  - `common/src/providers/__tests__/provider-registry.test.ts` — 3 fail
    (count-parity 13→14 / 11→12 asserted; `bai` contract pin fails on
    the missing entry).
  - `sdk/src/impl/__tests__/model-provider-free-mode.test.ts` — 2 fail
    (templated missing-key error + routing with `strip` normalization).
  - `cli/src/utils/__tests__/provider-setup.test.ts` — 1 fail
    (`saveProviderApiKey('bai', …)` unknown setup name).
  - `cli/src/utils/__tests__/openrouter-models-bai.test.ts` — module
    absent (wrapper not yet written).
- **GREEN:**
  1. `common/src/providers/registry.ts` + NEW `registry-partitioned.ts`
     — the `bai` entry (see Approach); the five partitioned entries
     spread in preserving `Object.keys` order.
  2. `cli/src/utils/openrouter-models/bai.ts` — NEW thin wrapper on the
     shared fetcher with `resolveKey: () => process.env.BAI_API_KEY`
     (authenticated catalog) and uniform prefixing (OrcaRouter lesson;
     parser pin proves bare / vendor-namespaced / already-prefixed
     upstream ids all round-trip through `strip`).
  3. `gateway.ts` merge + `__resetBaiCacheForTest` in the test reset.
  4. `provider-exception-manifest.ts` — `bai` live-catalog entry.
  5. Docs regenerated (`generate:provider-docs` — `.env.example` +
     `cli/release/README.md`).
- **File-cap discipline (files I pushed over get real splits, not
  baseline bumps):**
  - `registry.ts` 322→200 via NEW `registry-partitioned.ts` (143 lines;
    kiosapi/apinex/orcarouter/bai/opencode-zen entries, spread in —
    key order preserved, derivation-parity tests unchanged and green).
  - `provider-registry.test.ts` 326→253 via NEW
    `provider-contract-pins.test.ts` (84 lines; apinex/orcarouter/bai
    contract pins moved verbatim).
  - `gateway.ts` 310→262 via NEW `gateway-disk-cache.ts` (63 lines; the
    FID-2026-0815-007 warm-start persistence boundary extracted).
- **AUDIT evidence (own-run, this session):**
  - typecheck × 4 — exit 0 each.
  - common providers 58/0 (6 files) · sdk free-mode + custom suites
    15/0 (3 files) · cli gateway/bai/setup/lookup 24/0 + 21/0 + 37/0
    across re-runs — 0 fail everywhere.
  - eslint `--max-warnings 0` on all 12 touched files — exit 0 ·
    prettier clean · lint:md exit 0 · docs-check exit 0.
  - `validate:repository` hard-cap parity: **8 = 8** (the three files
    this FID pushed over the cap were each brought back by real
    splits; no baseline bumps).
- **Law 4 call-graph (production reachability, grep-proven):**
  - `fetchBaiModels` ← `gateway.ts` `fetchGatewayModels` allSettled
    chain ← `/model` command + picker ( Law-4 grep: gateway.ts import
    + merge line).
  - Routing ← `PROVIDER_REGISTRY.bai` → derived unions →
    `model-factories.ts` openai factory (`strip` transform) — pinned
    e2e in the sdk suite asserts URL, Bearer header, and wire id.
  - `/provider bai` setup ← `deriveSetupConfig` →
    `provider-key-store.ts` (count-parity 11→12 pin).
- **Live unknowns deferred to Step 4 (keyed acceptance, closure
  gate):** keyed `/v1/models` payload shape, real model-id namespace,
  chat 200 round-trip. Keyless probes already prove endpoints exist
  and fail closed (401).
- **Verdict:** all keyless gates pass; loop converges pending the
  keyed closure gate.

### Loop 3 — Keyed live acceptance (2026-09-12, closure gate)

- Operator supplied the key (stored as `B_AI` in `.env.local` —
  renamed to the registry's `BAI_API_KEY` before probing; value never
  echoed). All three arms passed (results quoted at Step 4).
- **Live Unknowns resolved:** (1) keyed `/v1/models` is the OpenAI
  shape, 47 entries, parser handles it (the `success` extra field
  did not appear keyed); (2) upstream ids are BARE (`claude-opus-5`,
  not `anthropic/claude-opus-5`) — uniform prefixing round-trips
  exactly; (3) chat round-trip 200 with content — `pong` on
  `qwen3.8-flash`.
- **Verdict:** closure gate satisfied → `closed`.

## Lessons Learned

- Providers increasingly expose multiple wire protocols behind one key
  (B.AI: three; OrcaRouter: four). The registry's per-entry protocol
  handles the default path, but the outlier surface keeps motivating
  FID-2026-0911-003's per-model/protocol story.
