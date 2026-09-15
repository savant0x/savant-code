# FID: Bazaarlink gateway provider — qwen3.7-flash:free only

**Filename:** `FID-2026-0915-006-bazaarlink-gateway-provider.md`
**ID:** FID-2026-0915-006
**Severity:** low
**Status:** fixed
**Created:** 2026-09-15 (operator: "Author the FID for the bazaarlink registry
integration"; model-set ruling via ask_user: "Qwen free only")

## Summary

Integrate BazaarLink as a gateway provider: registry entry + STATIC catalog of
exactly one model — `qwen/qwen3.7-flash:free` (context 1,000,000) — after the
keyed identity-audit gauntlet (Task 51) cleared that channel and disqualified
the platform's other free channels. Base URL `https://api.bazaarlink.ai/v1`
(vendor quickstart; two aliases verified equivalent LIVE), env var
`BAZAARLINK_API_KEY` (operator's existing key name; matches registry grammar).
`idTransform: 'keep'` — the model id is already gateway-exact. Static catalog
per the hcnsec/TokenBom precedent (the audit IS the catalog): a live
`/v1/models` catalog would re-expose the substituted channels the audit
rejected.

## Problem Statement

The operator wants the one verified-genuine free channel integrated. The
identity-audit gauntlet (15 keyed cells, 2026-09-15) measured:

- `qwen/qwen3.7-flash:free` — GENUINE: consistent self-ID EN ("I am Qwen…
  Alibaba Group's Tongyi Lab") and ZH ("我是通义千问（Qwen）…阿里云通义实验室"),
  cleanest fingerprint of any audited gateway (prompt_tokens 23–37 on the
  fixed string — zero injection class), 1.5–2.4s latency, 1M window,
  vendor-published `context_length` in the keyed `/v1/models` payload.
- `deepseek/deepseek-v4-flash-0731free:free` (+ the bare `deepseek-v4-flash-0731free`
  alias) — FAILS the identity bar: EN self-IDs claim "OpenAI's GPT-4" and
  "Claude Opus 4.1" (two flat contradictions), ZH claims DeepSeek, ~60–70
  tokens of hidden injected prompt, 13.6k hidden reasoning tokens on a
  10-word prompt. hcnsec precedent: a single lie disqualifies the channel.
- `auto:free` — excluded operationally: 3/5 calls returned 429
  ("site-wide free-model capacity is currently full"), successful calls took
  120–265s, and it routes INTO the disqualified deepseek channel.

Integration surfaces follow the established gateway pattern (FID-2026-0913-001
hcnsec/TokenBom, FID-2026-0914-001 Infron/UnoRouter): registry partition entry,
gateway static-catalog map, model-config shim wiring, picker derivation,
docs regeneration, closed-world pin widening.

## Scope Boundary

Operator ruling (2026-09-15, ask_user): **Qwen free only.** The catalog is
exactly one entry. The deepseek free channels and `auto:free` are excluded BY
RULING with audit evidence recorded above — they are not "to be added later";
adding them would require a new operator decision plus a gauntlet re-run.

## Perfection Loop

### Missed Questions

- **MQ1 — static vs live catalog:** STATIC. Task 45 precedent; the audit is
  the catalog; a live catalog would re-expose the two substituted free
  channels alongside the genuine one.
- **MQ2 — context window source:** the vendor's OWN keyed `/v1/models`
  payload publishes `context_length: 1000000` for
  `qwen/qwen3.7-flash:free` (captured 2026-09-15). Never from the discovery
  feed (the feed's "5 free models†" includes the disqualified channels).
  The pin test cites this value.
- **MQ3 — idTransform:** `strip` (amended at implementation, evidence-based:
  the FID draft said `keep`, but ALL five static/curated gateway entries
  — hcnsec, tokenbom, infron, unorouter, plus the live-catalog apinex —
  use `strip` with the internal routing prefix; infron carries vendor
  slashes + `:free` under the same transform. The production wire id
  `bazaarlink/qwen/qwen3.7-flash:free` strips to `qwen/qwen3.7-flash:free`
  — exactly the keyed-verified upstream id. `keep` would break the
  internal routing grammar.)
- **MQ4 — env var:** `BAZAARLINK_API_KEY` — the operator's actual key name
  in `.env.local`; provider id `bazaarlink` makes the registry grammar
  `{PROVIDERID}_API_KEY` match exactly. No canonicalization needed.
- **MQ5 — include `auto:free` as a convenience router:** NO. Unreliable
  (429 storm, 120–265s) and routes into the disqualified channel; a catalog
  entry must be individually trustworthy.
- **MQ6 — free-tier limits in docs:** the vendor's live config (10 req/min ·
  50 req/day, ×2 with credit, no card/expiry) goes in the docs blurb; the
  stale blog value (150/day) is not cited anywhere.
- **MQ7 — ordinal claims:** the FID asserts no "Nth provider" ordinal; the
  closed-world registry-key pin is widened by exactly +1 and the widened
  list is the assertion.

### Code Verification Evidence

Ground truth verified BEFORE this FID (keyed, 2026-09-15; scaffold:
`dev/scratchpad/archive/2026-09-15-provider-proposals/bazaarlink-ai-2026-09-15.md`):

- Keyed `GET https://api.bazaarlink.ai/v1/models` → HTTP 200, 174 models;
  aliases `bazaarlink.ai/v1` and `bazaarlink.ai/api/v1` byte-equivalent.
- Keyed chat `auto:free` → HTTP 200, `"cost": 0` (gateway works, zero-cost
  path real — channel itself excluded per MQ5).
- Gauntlet table (Task 51): qwen channel 4/4 cells clean; deepseek channels
  substituted; variance ×3 recorded.
- Privacy policy (effective 2026-07-21): prompts never stored/trained on/
  shared beyond routing; keys SHA-256-hashed; upstream-training caveat
  explicit.

### Implementation (2026-09-15)

RED-first: the widened closed-world pins (19 providers, 17 setup, order-4
family) captured 2 failing before GREEN (the order-4 loop pin passed even RED
because unknown providers default to order 4 — noted; the full-entry pin in
provider-registry-gateways.test.ts is the exact-shape guard).

GREEN surfaces (all precedent-pattern, zero new mechanisms):

- `common/src/providers/registry-partitioned.ts` — `bazaarlink` entry
  (baseUrl `https://api.bazaarlink.ai/v1`, openai, strip, static modelsRef,
  env `BAZAARLINK_API_KEY`, domain `bazaarlink.ai`, order 4).
- `common/src/constants/model-config/gateway-catalogs.ts` —
  `bazaarlinkModels` (ONE id: `bazaarlink/qwen/qwen3.7-flash:free`) +
  exclusion provenance in the doc comment.
- `common/src/providers/model-catalogs.ts` — `MODEL_CATALOGS.bazaarlink`.
- `common/src/constants/model-config.ts` — shim export + type.
- `common/src/constants/context-windows.ts` — vendor-published fallback
  entry (1,000,000) + NAME_CATALOG union.
- `cli/src/utils/openrouter-models/static-catalogs-gateways.ts` —
  `fetchBazaarlinkModels()` + display name + pinned window.
- `cli/src/utils/openrouter-models/gateway.ts` — merge into the combined
  gateway catalog.
- Docs: all 8 hand-maintained surfaces synced (`generate:provider-docs:check`
  exit 0 after generator normalization of the 3 generated blocks).

### Step-5 LIVE Round-Trip (production chain, keyed)

`getModelForRequest({ model: 'bazaarlink/qwen/qwen3.7-flash:free' })` via
`sdk/src/impl/model-provider.ts` (registry loop → generic OpenAI-compatible
factory, strip transform, registry-resolved `BAZAARLINK_API_KEY`): finishReason
`stop`, text exactly `"BAZAARLINK-STEP5-OK"`, usage 26 input / 9 output tokens,
zero reasoning tokens — clean channel, no injection class. Key never printed
(Law 12).

## Verification Gates

- gate: typecheck sdk
- gate: typecheck common
- gate: typecheck packages/agent-runtime
- gate: typecheck cli
- gate: test common/src/providers/__tests__/provider-registry.test.ts

### Verification Receipt

- fingerprint: sha256:0fa1a011f2e6f9ee61bda22f27171005f5bb76c22684894406840231c9b768a8
- verified: 2026-09-15T23:31:47.874Z
- typecheck sdk: exit 0
- typecheck common: exit 0
- typecheck packages/agent-runtime: exit 0
- typecheck cli: exit 0
- test common/src/providers/__tests__/provider-registry.test.ts: exit 0

## Resolution

Implemented per the operator's "Qwen free only" ruling; MQ3 amended to
`strip` with evidence (all five prior static/curated gateways use strip; the
wire id `bazaarlink/qwen/qwen3.7-flash:free` strips to the keyed-verified
upstream id). Gates: typecheck ×4 exit 0; root test chain 12 workspaces
0 fail (common suite includes the 3 widened closed-world pins + the
full-entry pin; cli suite includes the 2 new catalog pins); eslint
`--max-warnings 0`, prettier, lint:md, docs-check, quality:report PASS.
Status `fixed` — archive awaits operator closure (G2).

## Lessons Learned

- The order-4 family pin (loop over provider ids asserting order 4) cannot
  serve as a RED witness — `deriveProviderOrder` defaults unknown ids to 4.
  Exact-shape full-entry pins are the real closed-world guard.
- `bun test <dir>` filters are substring-matched against vendored copies
  (`resources/freebuff-main/...`) — scope suite runs by workspace script,
  not path filter, when vendored trees exist.
