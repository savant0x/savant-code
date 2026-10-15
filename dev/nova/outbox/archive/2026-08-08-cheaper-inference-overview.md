# Cheaper Inference — Overview & Comparison

**Date:** 2026-08-08
**Source:** https://cheaperinference.com
**Purpose:** Provider comparison for Savant Inference routing

---

## What Is Cheaper Inference?

A marketplace-style inference proxy that routes requests to multiple providers at **15-45% below list price**. Built by Keak. OpenAI-compatible API — just swap the base URL and API key.

**Base URL:** `https://api.cheaperinference.com/v1`
**Auth:** Bearer token (starts with `ir_live_`)
**Model catalog:** 40+ text models, 2 image models

---

## Key Features

| Feature | Details |
|---------|---------|
| **Pricing** | 15-45% below list price, usage-based, no monthly commitment |
| **Minimum fund** | $5 (first $10 bonus after first payment) |
| **API compatibility** | OpenAI-compatible + Anthropic Messages compatible |
| **Streaming** | Yes |
| **Vision input** | Yes (up to 10 images, 5MB each) |
| **Video input** | Yes (MP4, MPEG, MOV, WebM) |
| **Image generation** | Yes (nano-banana, grok-imagine) |
| **Prompt caching** | Yes (cache reads at 10% of input rate) |
| **Auto-retry** | Yes (retries on 404, 408, 429, 5xx) |
| **Fallback** | Routes to next cheapest provider on failure |
| **Pricing history** | 24h and 30-day price tracking per model |
| **Daily spend API** | Usage/daily endpoint for billing integration |

---

## Price Comparison: Cheaper Inference vs OpenRouter

### Key Models (per 1M tokens)

| Model | Cheaper Inference | OpenRouter | Savings |
|-------|-------------------|------------|---------|
| **claude-opus-5** | $3.50 in / $17.50 out | $5.00 in / $25.00 out | **30%** |
| **glm-5.2** | $0.77 in / $2.42 out | $1.40 in / $4.40 out | **45%** |
| **gpt-5.6-sol** | $3.50 in / $21.00 out | $5.00 in / $30.00 out | **30%** |
| **claude-fable-5** | $7.00 in / $35.00 out | $10.00 in / $50.00 out | **30%** |
| **kimi-k3** | $2.10 in / $10.50 out | $3.00 in / $15.00 out | **30%** |
| **gpt-5.6-luna** | $0.12 in / $0.74 out | $0.20 in / $1.20 out | **23%** |
| **deepseek-v4-flash** | $0.10 in / $0.20 out | $0.09 in / $0.18 out | **~same** |
| **deepseek-v4-pro** | $0.30 in / $0.61 out | $0.44 in / $0.87 out | **30%** |
| **claude-sonnet-5** | $1.40 in / $7.00 out | $2.00 in / $10.00 out | **30%** |
| **grok-4.5** | $1.40 in / $4.20 out | $2.00 in / $6.00 out | **30%** |

### Cheaper Inference Wins on:
- **GLM 5.2:** 45% cheaper (best discount)
- **All Anthropic models:** 30% cheaper
- **All OpenAI models:** 23-30% cheaper
- **Kimi K3:** 30% cheaper

### OpenRouter Wins on:
- **DeepSeek V4 Flash:** Slightly cheaper ($0.09 vs $0.10 input)
- **Free tier:** DeepSeek V4 Flash free on FreeBuff
- **Broader model catalog:** More niche models

---

## Pricing History Feature

Cheaper Inference has a **24-hour and 30-day pricing history** per model. This is unique — you can see when prices dip and schedule batch jobs during off-peak hours.

**Example from the data:**
- GLM 5.2: Average 40.7% savings, best at 7:00 AM
- Claude Opus 5: Average 30.0% savings, best at 4:00 AM
- DeepSeek V4 Flash: Average 21.6% savings, best at 4:00 AM

**The timing signal:** 6:00 PM–3:00 PM ET has the best average savings across all models.

---

## API Compatibility

**OpenAI-compatible:**
```
base_url = "https://api.cheaperinference.com/v1"
model = "claude-opus-4.6"  # or any model ID
```

**Anthropic-compatible:**
```
base_url = "https://api.cheaperinference.com"
# SDKs append /v1/messages automatically
```

**Works with:**
- Codex (Responses API)
- Cursor (OpenAI base URL override)
- Claude Code (Anthropic Messages API)
- Any OpenAI SDK (JS/Python)
- Any Anthropic SDK

---

## Comparison to Other Providers

| Feature | Cheaper Inference | OpenRouter | Together AI | Fireworks AI |
|---------|-------------------|------------|-------------|--------------|
| **Discount** | 15-45% off | Varies | Startup credits | Varies |
| **Model count** | 40+ | 200+ | 50+ | 50+ |
| **Free tier** | No ($5 min) | Yes (some models) | No | No |
| **Pricing history** | Yes (24h/30d) | No | No | No |
| **Auto-fallback** | Yes | Yes | Yes | Yes |
| **Streaming** | Yes | Yes | Yes | Yes |
| **Vision** | Yes | Yes | Yes | Yes |
| **Video** | Yes | No | No | No |
| **Image gen** | Yes | Yes | No | No |
| **Prompt caching** | Yes | Yes | Yes | Yes |

---

## Relevance to Savant Inference

**As a routing target:** Cheaper Inference could be a primary provider for Savant Inference — 30% cheaper than OpenRouter for most models.

**The pricing history feature** is unique and could be a selling point for Savant Inference users: "Route to the cheapest provider at any given time."

**The API compatibility** means zero code changes for users switching from OpenRouter — just swap the base URL.

**Concern:** No free tier. Users who want free inference would still use FreeBuff/OpenRouter. Cheaper Inference is for users who are already paying but want to pay less.

---

## Recommendation

**For Savant Inference routing:**
1. **Add Cheaper Inference as a primary provider** — 30% cheaper for most models
2. **Use pricing history** to implement time-based routing (cheapest provider at any given time)
3. **Keep OpenRouter** for free-tier users and niche models
4. **Keep Together AI** for the partnership and startup credits

**The play:** Savant Inference routes to whichever provider is cheapest at the moment. Cheaper Inference's pricing history API makes this possible.

---

*Overview written 2026-08-08 by Nova.*
