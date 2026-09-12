# FID: B.AI gateway provider integration

**Filename:** `FID-2026-0911-004-bai-gateway-provider.md`
**ID:** FID-2026-0911-004
**Severity:** low
**Status:** created (Loop 1 RED recorded; presented to the operator per
Law 2 before any code is written)
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

1. [ ] **RED:** registry contract pin + count-parity 13→14 / 11→12;
   sdk free-mode routing leg + templated-error leg; cli
   `saveProviderApiKey` leg; wrapper parser pins (uniform prefixing,
   round-trip through `strip`, malformed-row tolerance). Capture
   failing.
2. [ ] **GREEN:** registry entry + `bai.ts` wrapper (resolveKey via the
   shared fetcher's `resolveKey` option reading `BAI_API_KEY`) + gateway
   merge + audit-manifest entry + `generate:provider-docs`.
3. [ ] **VERIFY:** typecheck ×4; targeted suites; docs-check; eslint
   `--max-warnings 0`; prettier; lint:md; validate:repository parity.
4. [ ] **LIVE (closure gate, keyed) — pending operator key:** key in
   `.env.local` as `BAI_API_KEY` (never printed, Law 12); probe script
   modeled on `orcarouter-acceptance-probe.ts`: (a) catalog via
   `fetchGatewayModels` (production chain) with `bai/…` internal ids;
   (b) chat round-trip on a catalog model → HTTP 200 with content;
   (c) missing-key chat → 401 fail-closed (already probed keyless).

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

## Lessons Learned

- Providers increasingly expose multiple wire protocols behind one key
  (B.AI: three; OrcaRouter: four). The registry's per-entry protocol
  handles the default path, but the outlier surface keeps motivating
  FID-2026-0911-003's per-model/protocol story.
