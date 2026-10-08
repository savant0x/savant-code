# AI Frontier Snapshot — 2026-10-08 (Revisit: 2026-11-07)

**Logged:** 2026-10-07 18:57 EDT by Nova
**Status:** ACTIONABLE — 30-day progress measurement. This file is the baseline; the 11-07 revisit compares against it.
**Source:** Artificial Analysis Index v4.3.2, Hermes Index (launched 10-06), LMArena, vendor model cards, cross-checked across genaibrief.com / thefrontierwire.com / aichoiceengine.com / flozic.ai (all retrieved 10-07).

## Purpose

Spencer's ask: "mark this date, find the top models of today, their specs, revisit in 30 days and see the progress." This file is the frozen baseline. On 2026-11-07, re-fetch the same fields and diff.

## The Frontier Board — 2026-10-08

### Closed / proprietary

| Model | Lab | Released | AA Index (max) | $/M in/out | Context | Notes |
|---|---|---|---|---|---|---|
| **Claude Opus 5.5** | Anthropic | 2026-09-22 | **58** | $4/$20 (cache $0.20) | 1M/128K | #1 overall; Hermes Index #1 (63.31 @ $4.99/task); DeepSWE 72.3%; TB4 66.4% (xhigh); LMArena 1504 |
| **Claude Sonnet 5.5** | Anthropic | 2026-09-28 | 56 | $2/$10 | 1M/128K | Best agentic-$ : TB4 70.6% vendor claim; LMArena 1471 |
| **Claude Fable 5.1** | Anthropic | ~Sep | (restricted tier) | $10/$50 | — | On some boards above Opus 5.5 (gradually.ai rank #1, 93.5/100); restricted availability |
| **GPT-6 Astra** | OpenAI | 2026-09-03 | 53 | $10/$50 (cache $1; >272K surcharge) | 1.05M/128K | "Hardest reasoning + computer use" pick; TB-Sci $23.21/task on OpenAI's own numbers |
| **GPT-6.1 Sol** | OpenAI | 2026-09-29 | 52 | $2/$10 (cache 5% of input) | 1.05M/128K | **Value king**: $0.72/task; DeepSWE ties Opus 5.5 at 72.3%; LMArena 1483 (above Astra) |
| **GPT-6 Luna** | OpenAI | 2026-09-22 | — | $0.10/$0.50 | 1.05M | Budget tier; Hermes Index $0.141/task |
| **Gemini 3.8 Flash** | Google | 2026-09-02 | 41 | $0.75/$3.75 (intro to 12-31-26, then 2x) | 1.05M/65K | Fastest measured: 249 tok/s; only model with audio+video+PDF input; LMArena 1495 (prelim) |
| **Grok 4.7** | xAI | ~Sep | 46 (xhigh) | $2/$6 (<200K ctx) | 500K | Long-RL self-verification focus; LMArena 1442 |
| **Muse Spark 1.3** | Meta | ~Sep | 48 | $1.25/$4.25 | 1M | Meta's agent model; LMArena 1494 |

### Open weights

| Model | Lab | Released | AA Index | $/M in/out | Params | Licence | Notes |
|---|---|---|---|---|---|---|---|
| **MiMo-V2.6-Pro** | Xiaomi | 2026-09 | **46** (top open) | $0.435/$0.87 | (trillion-class) | **MIT** | Best open weights; omni-modal (text/image/video/audio) |
| **GLM-5.3** | Z.ai | 2026-08-14 | 45 | $1.40/$4.40 | — | custom GLM licence | TB2.1 88.2; text-only; always-reasoning |
| **Kimi K3** | Moonshot | 2026-07-16 | 44 | $3/$15 | 2.8T MoE / 104B active (16 of 896) | Kimi K3 licence (revenue thresholds) | Top open on LMArena (1488); BrowseComp 91.2; slowest (34 tok/s) |
| **Qwen3.8-Max** | Alibaba | 2026-09-02 | 45 (API) / 40 (weights) | $2/$6 | 2.4T MoE / 95B active | Apache-2.0 (Qwen3-Coder-Next for local) | TB2.1 86.6; 262K native ctx on weights |
| **DeepSeek V4 Pro** | DeepSeek | 2026-09-13 | 36 | $1.32/$3.96 peak, $0.66/$1.98 off-peak | 1.6T MoE / 49B active | **MIT** | TB2.1 87.9; cleanest licence; peak/off-peak pricing |
| **DeepSeek V4.1 Flash** | DeepSeek | ~Sep | 39 | ~$0.30/$1.20 peak; cache hits from **$0.003** | 552B CED MoE (8B prefill/16B decode) | MIT | **The cost-disruption story**: Hermes Index $0.259/task; FP4 KV cache 890 bytes/token; 1M ctx/384K out |
| **GLM-5.3-Flash** | Z.ai | 2026-08-26 | ~40 | $0.15/$0.50 | — | open | The Spencer-favorite lane (Ox Alpha reveal) |

### The three structural facts of 2026-10-08

1. **Convergence at the top:** Terminal-Bench 2.1 open-weight scores — Kimi K3 88.3, GLM-5.3 88.2, DeepSeek V4 Pro 87.9, Qwen3.8-Max 86.6 — are within 1.7 points of each other. Raw agentic competence is commoditized; differentiation is now licence, price, modality, and speed.
2. **The $/task era:** Hermes Index (10-06) + Artificial Analysis cost-per-task made cost-per-outcome the headline metric. Opus 5.5 $4.99/task vs DeepSeek V4.1 Flash $0.259/task — a 19x spread at 58-vs-39 quality.
3. **Model loyalty died this week:** Musk's Grok Bot routing announcement (10-07) made "best backend per task" official strategy at the biggest lab-adjacent consumer surface. Routing layers > model loyalty.

### Context of the day (for the revisit to compare against)

- Hermes Index launched 10-06; Nous raised $90M at $1.5B (10-07)
- Teknium's "coding harness for me, not for normies" post (10-07)
- Musk Grok-Bot multi-model routing post (10-07, 54M views)
- OpenAI dropped 722 math manuscripts from an unnamed internal model (10-06/07) incl. Quasi-Riemann + no-Siegel-zeros; Anthropic: Fermat FLT Lean formalization (13M lines, 11 days) + Riemann zeta bound 41.6%→67.2% (10-05)
- OpenClaw postmortems circulating; usage survived via Chinese cloud productization
- Stealth lane status: Pixel Canary (Vercel) live/free; Space Bunny withdrawn 10-05; Union Alpha revealed = Pareto (Unbiased)

## What to re-check on 2026-11-07

1. **AA Index top-10 deltas** — did Opus 5.5 hold #1? Did GPT-6.1 Sol class move?
2. **Open-weight gap** — was "13-22 points below closed frontier" (AA index) narrowed? Watch MiMo-V2.6-Pro / Kimi K4 rumors / DeepSeek V5.
3. **Price moves** — Gemini 3.8 Flash intro pricing expires 12-31; any $/task leader changes?
4. **New model classes** — first GPT-7/Claude 6/Gemini 4-era releases? The OpenAI math model's public name/launch?
5. **Stealth shelf** — Pixel Canary reveal? New stealth windows on OpenRouter/OpenCode/Cline?
6. **The math-race state** — formalization counts (Lean), any Millennium Problem movement, community verdict on the 722 papers.
7. **Hermes Index edition 2** — did the board shift? DeepSeek V4.1 Flash's $0.259 challenged?
8. **Structural questions** — did routing-layer products (Grok Bot, Together Link) change usage share? Did the "coding harness vs assistant" split (Teknium) resolve?

## Re-activation trigger

2026-11-07 (30 days). Load this file, re-fetch AA Index + Hermes Index + LMArena top-10, diff against the tables above, and write the delta report in this same folder as `ai-frontier-snapshot-2026-11-07.md`.

## Reference links

- https://genaibrief.com/models/top-ai-models-october-2026/ (primary cross-check)
- https://thefrontierwire.com/articles/best-ai-models/
- https://aichoiceengine.com/ai-models (dated verification 10-01/02)
- https://www.flozic.ai/blog/best-llms-for-coding (prices read live 10-06)
- https://portal.nousresearch.com/bench (Hermes Index)
- https://artificialanalysis.ai (index source)
- https://lmarena.ai (arena Elo)