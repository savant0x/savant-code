# FID: Bazaarlink gateway provider — qwen3.7-flash:free only

**Filename:** `FID-2026-0915-006-bazaarlink-gateway-provider.md`
**ID:** FID-2026-0915-006
**Severity:** low
**Status:** created
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
- **MQ3 — idTransform:** `keep`. The id `qwen/qwen3.7-flash:free` is sent
  upstream verbatim — verified by the keyed round-trip (served `model`
  echoed the same id family).
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

## Verification Gates

- gate: typecheck sdk
- gate: typecheck common
- gate: typecheck packages/agent-runtime
- gate: typecheck cli
- gate: test cli/src/utils/__tests__/provider-registry.test.ts

## Resolution

(filled at closure)

## Lessons Learned

(filled at closure)
