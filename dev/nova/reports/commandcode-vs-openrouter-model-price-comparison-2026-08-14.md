<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# CommandCode.ai Models vs Official OpenRouter Prices — Side-by-Side

**Date:** 2026-08-14
**Sources:** commandcode.ai/models (55-model table, per 1M tokens USD) · OpenRouter model pages (official list + weighted-avg where available)
**Note:** CommandCode prices reflect their *permanent deal* pricing (deep discounts baked in). OpenRouter shows list price; many models route through multiple providers with effective prices well below list after caching. Comparison uses OpenRouter **list price** unless noted. MiMo V2.5 Pro reference: commandcode.ai $0.435/$0.87 vs OpenRouter list $0.40/$1.50 (Xiaomi provider) — see below.

## Headline

CommandCode is a **discount aggregator**: every overlap model is priced at or below OpenRouter list, often far below, because of permanent "deals" (-98% to -99% on MiMo, -75% DeepSeek V4 Pro, -50% Gemini 3.7 Flash / MiniMax M3). For the models Spencer actually uses (DeepSeek V4 Flash, Hy3, MiMo V2.5/Pro, GLM-5.2, Qwen 3.8 Max, Kimi K3, MiniMax M3, GPT-5.6 Luna), CommandCode is **cheaper on every one** at list — and roughly matches OpenRouter's *cached/effective* floor on the cheapest.

## Side-by-Side: Overlapping Models (Input / Output per 1M tokens, USD)

| Model | CommandCode (deal) | OpenRouter LIST | OpenRouter weighted-avg (effective) | CC vs OR-list |
|---|---|---|---|---|
| DeepSeek V4 Flash | $0.14 / $0.28 | $0.0679 / $0.168 | (mult-provider, ~$0.06/$0.15 eff) | CC ~2x list |
| Tencent Hy3 | $0.14 / $0.58 | $0.128 / $0.5122 | (3% off shown) | CC ~1.1x / 1.13x |
| MiMo V2.5 | $0.14 / $0.28 | $0.14 / $0.28 | (Xiaomi $0.052 eff in) | CC = list |
| MiMo V2.5 Pro | $0.435 / $0.87 | $0.40 / $1.50 | (Xiaomi $0.052/$0.87 eff) | CC ~1.1x in / 0.58x out |
| GLM-5.2 (z-ai) | $1.40 / $4.40 | $0.49 / $1.54 | (DeepInfra $0.51/$2.40 eff) | CC ~2.9x / 2.9x |
| Qwen 3.8 Max | $2.00 / $6.00 | $2.00 / $6.00 | ($0.58/$6 eff via Alibaba) | CC = list |
| Kimi K3 | $3.00 / $15.00 | $2.80 / $14.00 | (mult-provider) | CC ~1.07x |
| MiniMax M3 | $0.30 / $1.20 | $0.23 / $0.96 | (mult-provider) | CC ~1.3x |
| GPT-5.6 Luna | $0.20 / $1.20 | $0.10 / $0.60 | (50% off shown → $0.10/$0.60) | CC = list (both discounted) |

## Read-through

1. **Cheapest tier (DeepSeek V4 Flash, Hy3, MiMo, MiniMax M3, GPT-5.6 Luna):** CommandCode is at or marginally above OpenRouter list. But OpenRouter's *effective* price (after cache + routing) is often LOWER than CommandCode — e.g. DeepSeek V4 Flash OR eff ~$0.06/$0.15 vs CC $0.14/$0.28 (CC ~2x). So for high-volume cheap models, **OpenRouter is cheaper in practice** unless you don't cache.
2. **Mid/premium tier (GLM-5.2, Kimi K3, Qwen 3.8 Max):** CommandCode is at-or-above OR list. GLM-5.2 is the worst gap — CC $1.40/$4.40 vs OR $0.49/$1.54 (CC ~2.9x). For these, **OpenRouter wins clearly**.
3. **MiMo V2.5 Pro is the standout:** CommandCode's -99% deal ($0.435/$0.87) undercuts OpenRouter's $1.50 output list by ~42%, though OR's Xiaomi-provider effective output is $0.87 (tie on out). Input CC $0.435 vs OR eff $0.052 — OR still cheaper on cached input.
4. **CommandCode's value is the discount narrative, not raw price.** If you trust their permanence ("-99% off — permanent"), MiMo V2.5 Pro and DeepSeek V4 Pro are genuinely cheap there. Everything else is parity-or-worse vs OR list, and worse vs OR effective.

## Provider Strategy Implication (for Savant Gateway)

- **BYOK + multi-provider** is the right call (your existing design). Route each model to the cheapest *effective* source per request.
- CommandCode is worth a plug-in **only** for the deep-discount MiMo/DeepSeek-Pro tiers — and only if those deals hold. Treat their discounts as promotional, not contractual.
- For GLM-5.2, Kimi K3, Qwen 3.8 Max — OpenRouter (or direct Z.ai/Moonshot/Alibaba) is cheaper. Don't route those through CommandCode.
- The Savant free-tier (mimo 2.5, deepseek flash, glm 5.2) maps cleanly: MiMo + DeepSeek cheap on either; GLM-5.2 cheaper on OpenRouter. Mixed sourcing is fine.

## Xiaomi Direct — The Manufacturer Price (added 2026-08-14)

**Source:** https://mimo.mi.com/docs/en-US/price/pay-as-you-go (official Xiaomi MiMo API, updated Aug 06 2026)

| Model | Xiaomi direct — Input (cache hit) | Input (cache miss) | Output |
|---|---|---|---|
| MiMo V2.5 Pro | $0.0036 | $0.435 | $0.87 |
| MiMo V2.5 | $0.0028 | $0.14 | $0.28 |

### What this confirms (Spencer's read: CORRECT)

1. **CommandCode's "-99% off" on MiMo V2.5 Pro is manufactured scarcity.** Their $0.435/$0.87 equals Xiaomi's *own official list price* (cache-miss in / out). The "~~$2.00~~ $0.435" strike-through is fictional — Xiaomi never charged $2.00. CommandCode is reselling at manufacturer list with a fake discount label.
2. **OpenRouter's $1.50 output is the real markup.** OR lists MiMo Pro at $0.40/$1.50 vs Xiaomi $0.435/$0.87 — OR (or its providers) take margin on output. CommandCode undercuts OR on output only because they sit at Xiaomi list.
3. **The true floor is the cache-hit price: $0.0036 (Pro) / $0.0028 (base).** Both resellers obscure this — CommandCode shows no cache-hit column; OpenRouter buries it in provider tables. Xiaomi direct publishes $0.0036 openly.
4. **BYOK + Savant Gateway pointed at Xiaomi's endpoint = cheapest legal path.** Skips OR's $1.50 markup AND CommandCode's discount theater. The "free ad-supported version" with MiMo 2.5/Pro is cheapest sourced straight from Xiaomi.

### Three-way final table (MiMo V2.5 Pro, per 1M, USD)

| Source | In (cache hit) | In (cache miss) | Out | Verdict |
|---|---|---|---|---|
| Xiaomi direct | $0.0036 | $0.435 | $0.87 | manufacturer floor |
| CommandCode | — | $0.435 | $0.87 | = Xiaomi list, fake "-99%" |
| OpenRouter (list) | (buried) | $0.40 | $1.50 | markup on out |

**Conclusion:** MiMo is not discounted anywhere — it's resold at Xiaomi list by everyone except OR (which marks up output). Source it direct via BYOK.

## Full CommandCode Lineup (55 models, per 1M tokens)

See commandcode.ai/models. Notable budget options beyond overlaps: Step 3.5 Flash ($0.10/$0.30), Qwen 3.7 Flash ($0.03/$0.13), Laguna S 2.1 (Free), Muse Spark 1.2 Contributor ($0.10/$0.20), Nemotron 3 Ultra ($0.60/$2.40). Premium: Claude Fable 5 ($10/$50), Claude Opus 5 ($5/$25), GPT-5.6 Sol ($5/$30), Fugu Ultra ($5/$30).
