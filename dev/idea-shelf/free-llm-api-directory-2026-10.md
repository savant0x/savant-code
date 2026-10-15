# Free-LLM-API Provider Landscape — 2026-10 Directory Sweep

**Logged:** 2026-10-07
**Status:** SHELVED — reference directory + 3 signals (aggregator meta-lists are winning; APInex gambling red flag; stealth shelf rotation speed). No build action until a trigger fires.
**Source:** Spencer's curated 72-item list (pasted in DM, 2026-10-07) + ~35 Nova web-search verifications same day. Meta-lists discovered during verification:
- https://github.com/mvalentsev/awesome-free-ai-coding (probe-verified 2x/week)
- https://freellmapihub.com (github.com/pacocartones/free-llm-api-hub — machine-readable dataset)
- https://freellm.net (299+ models, live-API verified)

## What it is

Verified URL directory for Spencer's free-LLM-API list (72 entries), plus status deltas.
Every URL below was found in a live search result — none constructed from the name.

### VERIFIED — official / first-party
| Provider | URL | Notes |
|---|---|---|
| AMD Token Factory | developer.amd.com.cn/radeon/tokenfactory | base: developer.amd.com.cn/radeon/api/v1; $10/day equiv; DeepSeek-V4-Flash-0731, Qwen3.8-Flash-Next, MiniCPM |
| OpenCode Zen | opencode.ai | in-client /connect; free lanes rotate weekly (Fledge Alpha, MiMo-V2.6 Flash, Ling 3.x, Nemotron 3 Ultra, LongCat 2.5) |
| Ollama Cloud | ollama.com | `:cloud` tags; session limits |
| SiliconFlow | siliconflow.com (global) / siliconflow.cn | Qwen/DeepSeek-class free tier |
| Chutes | chutes.ai | Llama free |
| NVIDIA NIM | build.nvidia.com | ~40 RPM |
| Groq | groq.com | GPT-OSS no longer free (list claim confirmed stale) |
| Verdent | verdent.ai | desktop harness, $19/mo — NOT free; list's "desktop harness only" checks out |

### VERIFIED — gateways / credits
| Provider | URL | Notes |
|---|---|---|
| TokenRouter | tokenrouter.com | api.tokenrouter.com/v1, glm-5.3-free |
| TokenForge | tokenforge.ai.studio | signup credits |
| UnoRouter | unorouter.ai | 330+ models, 240 free |
| HCNSEC | api.hcnsec.cn | Xinjiang "public-welfare" relay; console 404 at check time — flaky |
| Token Harbor | tokenharbor.ai | DeepSeek V4.1, Qwen 3.8, MiMo |
| Routeway | routeway.ai | deepseek-v4-flash:free, 20 RPM/200 RPD, 42K ctx (well below native 1M) |
| APMIX | apmix.ai | 3M free tokens, no expiry |
| Experiential Labs | experientiallabs.ai | YC S26; 500cr/mo; hosts glm-5.3-flash-abliterated |
| BazaarLink | bazaarlink.ai | auto:free router; 10 RPM/150 RPD; agent self-registration API (POST /api/v1/agents/register) |
| KiosAPI | kiosapi.com | 51 models; "30+ free" claim unverified |
| ZansLab | zanslab.id | Indonesian gateway |
| VyceAI | vyceai.com | $50 signup credits + circulating redeem codes |
| ModelRouter | modelrouter.id | QRIS from Rp 5.000; "Bansos AI" 100-request grant; supports Hermes Agent explicitly |
| Gonka | gonkabroker.com | 1M free tokens/MONTH (recurring, not one-time — bigger than list implied); no card; Anthropic-compatible |
| Antseed | antseed.com | P2P, no signup; NOT "new project" — $2.4M raised, Spark Capital led |
| B.AI | chat.b.ai / api.b.ai/v1 | six $0 models: glm-5.3-flash, deepseek-v4-flash(+vision-exp), qwen3.8-flash, mimo-v2.5, hy3; 1 USD = 1M credits |
| ShareLLM | sharellm.net | free route 120 req/5h, 600 req/wk |
| TokenTable | tokentable.asia | flat-rate from $19/mo — no longer meaningfully "free" |
| WorkBuddy | workbuddy.ai | APP not API; DeepSeek V4.1 Flash zero-credit promo (Sep 11–25) OVER |
| CodeCraft | codecraftapi.com | DEVWEEK + yearly-Basic trick; surrounded by affiliate-farm links — unverified |
| Cavoti | cavoti.com | $200/mo credits promo; "ended Sep 25" note plausible |
| Agentik | agentikapi.com | free tier, no card (medium confidence = the "$5" entry) |
| ZyloAI | zyloai.net | ~10 RPM |
| Zydit | zydit.in | api.zydit.in/v1, free models 10 RPM |
| ElectronHub | electronhub.ai | small weekly credit |
| FreeInference | freeinference.org | research/education framing |

### STEALTH (as of 2026-10-07)
| Model | URL | Status |
|---|---|---|
| Union Alpha | openrouter.ai/stealth/union-alpha | REVEALED = Pareto by Unbiased; stealth ended |
| Space Bunny Alpha | openrouter.ai/stealth/space-bunny-alpha | WITHDRAWN from OpenRouter 2026-10-05 (verified live 10-07: no stealth/* ids remain in OR catalog). BUT OpenCode Zen's `space-bunny-free` still live 10-07 (verified via /zen/v1/models) — zero-retention policy, ~9-10T tokens/day, MiniMax M3.1 suspected but unconfirmed |
| Pixel Canary | vercel.com/ai-gateway/models/pixel-canary | LIVE, free during stealth; ties GPT-6 Astra at 90.3% on Vercel Next.js eval (96.8% w/ AGENTS.md); Cline-supported |
| Apodex 1.1 Mini | openrouter.ai/apodex/apodex-1.1-mini:free | Live, reasoning-first, 262K ctx |

### TOOLS
| Tool | URL |
|---|---|
| free-claude-code | github.com/Alishahryar1/free-claude-code (50 ToS-friendly providers, 1.3B+ free tokens/mo, supports fcc-hermes + fcc-dsh launchers) |
| itsfree.ai | itsfree.ai |
| freellm.net | freellm.net |

### NOT FOUND (searched, zero confident hits)
xKiro, CleanAPIs, GreenPower, Tiarina ("Tiarina Cloud" exists only as Twitter mentions), MiniMax Code official download page.

## Portable patterns (idea-level only)
| # | Pattern | From | Maps to Savant-Code | Portable? |
|---|---|---|---|---|
| 1 | Two-stage image-scam cascade (PDQ-style cheap filter → frequency/vector matching on survivors) defeats monitor-photo scam images that beat pHash | abigail.sh Scrump writeup (8% of all Discord images are scams; 7.75% after 2M scans) | None today; could inform a future community-safety lane | YES (concept; their impl is closed) |
| 2 | Agent self-registration API for API keys (BazaarLink POST /api/v1/agents/register, per-key spend caps via management key) | BazaarLink | Free-compute pool provisioning: Nova mints per-agent keys with caps mechanically | YES |
| 3 | Machine-readable, probe-verified provider directories (freellmapihub JSON endpoint `freellmapihub.com/api/v1/no-card.json`) | pacocartones/free-llm-api-hub | free-compute-discovery pipeline: replace hand-curated feeds with a probe dataset + freshness badge | YES |
| 4 | Flat-credit "Main quota + unlimited Sides" billing shape | TokenTable | Billing UX idea only; nothing to build | YES (idea) |

## Explicitly NOT portable
- Scrump Anti-scam internals (security-by-obscurity, no OSS, hosted-only).
- Cloudflare/Worker-hosted relays' infra lock-in.
- Anything behind WeChat/Alipay/QRIS settlement — payment rails don't translate.

## Flags (from verification pass)
1. **APInex (apinex.bond) is gambling-adjacent**: its wallet layer markets "MEGA POT, roulette, subscriptions, Passes." Same monetization pattern as scam-adjacent resellers. Treat as throwaway-credential-only; never a real card.
2. **Auray (auray.ai) does NOT match the list's "$20 first 300" claim** — actual: Free 100cr/mo, Pro $50/2000cr, Max $150/7000cr, Ultimate $500/25000cr. List entry stale/wrong.
3. **Stealth shelf rotated hard in one week**: Space Bunny withdrawn Oct 5, Union Alpha revealed as Pareto. Currently-live free stealth lane = Pixel Canary (Vercel/Cline). Stealth windows are ~1-2 weeks; the list's "about 1 week" estimates are accurate.
4. **Directory-layer winners**: mvalentsev/awesome-free-ai-coding + freellmapihub + freellm.net already automate what this hand-curated list does manually. The curation moat has moved to probe-verification, not list-keeping.

## Re-activation trigger
- Spencer picks up free-compute pool work for Savant-Code/Nova (pattern #3: swap hand-curated feeds for freellmapihub's machine-readable dataset with a freshness probe).
- Any new stealth model lands on OpenRouter/Vercel/Cline (pattern: check Vercel AI Gateway changelog + openrouter.ai/stealth weekly).
- Next DM blast: "find these urls" round 2 — extend this file instead of re-searching from scratch.
- If APInex or CodeCraft-style promo ever looks attractive for real work: re-verify terms directly on the provider's own page first (affiliate-farm contamination).

## Reference links
- Spencer's source list: DM paste 2026-10-07 (doc: hermes/cache/documents — this shelf note is the canonical copy of its verified URLs)
- Meta-directories: https://github.com/mvalentsev/awesome-free-ai-coding · https://freellmapihub.com · https://freellm.net
- Stealth pages: https://openrouter.ai/stealth · https://vercel.com/ai-gateway/models/pixel-canary · https://openrouter.ai/apodex/apodex-1.1-mini:free
- Scam-context companion: abigail.sh/blog/detecting-and-stopping-mr-beast-scams-discord (7.75% of Discord images are scams; pHash fails on monitor-photo scams)
## STEALTH SHELL UPDATE (2026-10-07 evening, live-verified)

New stealth: **Exo Free** (`opencode/exo-free`) appeared 2026-10-06 22:54 UTC (ArtificialWatch
first-sweep; PR #53620 merged 22:27). 1M ctx / 131K out, image+tool calls, single forced-high
reasoning level, $0/$0. Community consensus: frontier-level — won the horse-galloping CSS
benchmark (~2M tokens vs Space Bunny's 35M failure). Identity: UNKNOWN, no credible
fingerprint published yet (the doc's "Claude 5.5" claim is speculation, not verified).
Instability: "Upstream request failed" errors within hours of launch; heavy rate limits.

Zen free-tier census (live /zen/v1/models, 10-07): 87 models; free/stealth lane =
big-pickle, space-bunny-free, fledge-alpha-free, exo-free, mimo-v2.6-flash-free,
mimo-v2.5-free, longcat-2.5-preview-free, ling-3.0-flash-fin-free, ling-3.1-flash-free,
nemotron-3-ultra-free, nemotron-3.5-lightning-free, muse-spark-{1.2,1.3}-contributor-free,
deepseek-v4-flash-free, qwen3.8-flash (listed free elsewhere).

Stealth-shelf state 10-07: OpenRouter stealth/* = EMPTY (first time in months).
OpenCode Zen = the stealth launch platform now. Three-prices-of-free taxonomy:
zero-retention (Space Bunny) / data-for-training (Big Pickle, Exo, Fledge, MiMo) /
contributor-discount (Muse Spark).
