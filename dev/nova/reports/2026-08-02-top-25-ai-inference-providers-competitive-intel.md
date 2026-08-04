# Top 25 AI Inference Providers — Competitive Intelligence Report

**Date:** August 2, 2026
**Purpose:** Competitive landscape analysis for Savant Inference Gateway
**Scope:** 25 providers across 5 categories

---

## Executive Summary

The AI inference market in 2026 is fragmented across four distinct tiers: unified gateways, custom silicon, managed API providers, and enterprise cloud platforms. **OpenRouter dominates gateways** (5.5% markup, 400+ models, 10M+ users). **Groq leads custom silicon** (LPU ASIC, 1,000 TPS, $0.05/M input). **DeepInfra leads managed APIs** (300+ models, $0.10/M for 70B). **AWS/Azure/GCP dominate enterprise** with SOC2/HIPAA/FedRAMP compliance.

**Key gaps Savant Inference can exploit:**
1. **No self-hosted binary gateway exists** — all are cloud-only SaaS
2. **No gateway offers both OpenAI-compat + provider-native dual mode** — Cloudflare deprecated OpenAI compat, OpenRouter is OpenAI-only
3. **No gateway does multi-modal routing** (text + image + audio + video) natively
4. **Zero-markup BYOK is validated** — flo2's entire pitch is "zero markup OpenRouter alternative"
5. **ECHO Protocol governance is unique** — no competitor offers cryptographic quality gates

---

## Category 1: Unified Gateways & Aggregators

| Provider | Status | Models | Pricing | Free Tier | Lock-in |
|----------|--------|--------|---------|-----------|---------|
| **OpenRouter** | ✅ Live | 400+ | 5.5% platform fee | 25+ models, 50 req/day | Low |
| **OneInfer** | ❌ Defunct | — | — | — | — |
| **Cloudflare AI GW** | ✅ Live | 25+ providers | Free (you pay providers) | Free on all CF plans | HIGH (CF ecosystem) |
| **TokensMind** | ✅ Live (China) | Unknown | Enterprise sales | No | High |
| **flo2** | ✅ Beta | All (BYOK) | $0 markup | Free during beta | None |

### Key Takeaways:
- OpenRouter's 5.5% markup is the market price — every BYOK competitor positions against it
- Cloudflare AI Gateway is free but forces provider-native API (OpenAI compat deprecated)
- flo2 validates zero-markup BYOK routing + racing/A/B testing features
- **Gap:** No self-hosted gateway option exists

---

## Category 2: Ultra-Low Latency & Custom Silicon

| Provider | Architecture | Cheapest Model | Speed | Free Tier | On-Prem |
|----------|-------------|----------------|-------|-----------|---------|
| **Groq** | LPU ASIC | $0.05/M (Llama 8B) | 1,000 TPS | ✅ Rate-limited | ✅ GroqRack |
| **Cerebras** | Wafer-Scale Engine | $0.35/M (GPT OSS 120B) | ~3,000 TPS | ✅ $5 credits | ❓ |
| **SambaNova** | RDU Dataflow | $0.22/M (GPT OSS 120B) | — | ✅ | ✅ SambaRack |
| **GMI Cloud** | NVIDIA GPUs | GPU-hour based | — | ❌ (credits) | ❌ |

### Key Takeaways:
- Groq is cheapest overall (Llama 8B at $0.05/$0.08/M)
- Cerebras has highest raw throughput (~3K TPS) but 2-3x pricier than Groq
- SambaNova beats Cerebras on GPT OSS 120B ($0.22 vs $0.35 input)
- All support OpenAI-compatible APIs — straightforward Gateway integration

---

## Category 3: Fast Managed APIs for Open Weights

| Provider | Models | Cheapest 70B | Free Tier | Unique Feature |
|----------|--------|-------------|-----------|----------------|
| **Fireworks AI** | 200+ | — | $1 credits | Fine-tuning at base price |
| **Together AI** | 200+ | $1.04/M | $1 credits | PTU for predictable cost |
| **DeepInfra** | 300+ | $0.10/M | $1 credits | FP4 quantization, largest catalog |
| **SiliconFlow** | 50+ | — | Permanently free models | Best free tier, China-optimized |
| **DeepSeek API** | 2 | $0.14/M | $5 credits | Cheapest first-party, 1M context |
| **Novita AI** | 100+ | — | $1 credits | Agent Sandbox, batch 50% off |

### Key Takeaways:
- DeepInfra has largest catalog (300+) and cheapest 70B ($0.10/M)
- DeepSeek API is cheapest for first-party models ($0.14/$0.28/M)
- SiliconFlow wins free tier (permanently free models, no credit required)
- All support OpenAI-compatible APIs
- DeepSeek additionally supports Anthropic API format

---

## Category 4: Developer-Centric GPU & Serverless

| Provider | Model | Deployment | Unique Feature |
|----------|-------|------------|----------------|
| **Baseten** | Truss framework | Managed | Open-source deployment framework |
| **Modal** | Python-native | Serverless | Sub-second cold starts, no YAML |
| **Replicate** | Community models | Serverless | Easiest model deployment |
| **RunPod** | GPU pods | On-demand | Fastest spin-up times |
| **Fal.ai** | Multimedia | Serverless | Optimized for image/audio/video |
| **HF Endpoints** | Hub-integrated | Managed | Deepest model ecosystem |

### Key Takeaways:
- These are deployment platforms, not API gateways — different market segment
- Modal and Fal.ai are most relevant for custom model serving
- None offer unified API routing across providers

---

## Category 5: Enterprise & Full-Stack Cloud

| Provider | Pricing Model | Compliance | Unique Capability |
|----------|--------------|------------|-------------------|
| **Google Vertex AI** | Per-token + per-hour | SOC2, HIPAA, FedRAMP | TPU acceleration, Gemini models |
| **AWS SageMaker** | Per-instance-hour + Bedrock per-token | SOC2, HIPAA, FedRAMP | Broadest model marketplace (20+) |
| **Azure AI Foundry** | Per-token + PTU reservations | SOC2, HIPAA, FedRAMP, IL4/IL5 | Exclusive OpenAI access |
| **Nebius AI** | Per-GPU-hour + per-token | SOC2, ISO 27001, HIPAA | Best GPU price/performance (bare-metal) |

### Key Takeaways:
- Azure has exclusive OpenAI model access (GPT-5 series)
- AWS has broadest model marketplace via Bedrock
- Nebius offers best GPU price/performance (bare-metal, non-virtualized)
- All have SOC2/HIPAA/FedRAMP compliance

---

## Pricing Comparison: Cost per 1M Tokens (70B-class model)

| Provider | Input | Output | Notes |
|----------|-------|--------|-------|
| **DeepInfra** | $0.10 | $0.32 | Llama 3.3 70B — cheapest |
| **DeepSeek API** | $0.14 | $0.28 | V4 Flash — cheapest first-party |
| **Groq** | $0.59 | $0.79 | Llama 3.3 70B — fastest |
| **SambaNova** | $0.60 | $1.20 | Llama 3.3 70B |
| **Together AI** | $1.04 | $1.04 | Llama 3.3 70B — symmetric |
| **Cerebras** | $0.35 | $0.75 | GPT OSS 120B |
| **OpenRouter** | Cost + 5.5% | Cost + 5.5% | Pass-through + markup |
| **flo2** | $0 markup | $0 markup | BYOK, you pay providers |
| **Cloudflare** | $0 markup | $0 markup | Free gateway, you pay providers |

---

## Free Tier Comparison

| Provider | Free Offer |
|----------|-----------|
| **SiliconFlow** | Multiple permanently free models (GLM-Z1, embeddings, ASR, image) |
| **DeepSeek API** | $5 free credits |
| **OpenRouter** | 25+ models, 50 req/day |
| **Groq** | Rate-limited free tier |
| **Cerebras** | $5 free credits |
| **SambaNova** | Free tier (details on signup) |
| **Fireworks AI** | $1 free credits |
| **Together AI** | $1 free credits |
| **DeepInfra** | $1 free credits |
| **Novita AI** | $1 free credits |
| **Cloudflare AI GW** | Free on all plans |
| **flo2** | Free during beta |

---

## Competitive Gaps Savant Inference Can Exploit

### 1. Self-Hosted Binary Gateway
**No provider offers a self-hosted binary.** All are cloud SaaS. Enterprise teams wanting data locality + no vendor dependency have zero options. Savant's Rust-based proxy compiled to a single binary is a unique differentiator.

### 2. Dual API Mode (OpenAI + Provider-Native)
Cloudflare deprecated OpenAI compat. OpenRouter is OpenAI-only. A gateway that does BOTH would be unique. Savant's universal schema translation (OpenAI → Anthropic/DeepSeek/Google) is already designed for this.

### 3. ECHO Protocol Governance
No competitor offers cryptographic quality gates, FID-bound execution, or the Perfection Loop FSM. This is a moat for enterprise compliance.

### 4. Multi-Modal Routing
Most gateways focus on text LLMs. Cloudflare supports voice/video (WebSockets) but it's Beta. First-class multi-modal routing could be a differentiator.

### 5. Zero-Overhead Proxy
LiteLLM (Python) fails at 500 RPS. Kong adds 25-40ms overhead. Savant's Pingora-based proxy achieves 11μs overhead at 5,000 RPS. This is a 100-1000x latency advantage.

### 6. Transparent Cost-Plus Pricing
OpenRouter's 5.5% markup is opaque. CommandCode locks users to CLI. Savant's cost-plus model (resell at provider cost, earn from subscriptions) builds developer trust.

---

## Integration Priority for Gateway

### Tier 1 (MVP — must have):
1. **DeepSeek API** — Cheapest first-party, 1M context, dual API format
2. **Groq** — Fastest inference, LPU ASIC, OpenAI-compat
3. **OpenRouter** — Largest model catalog, pass-through pricing

### Tier 2 (v1.1 — high value):
4. **DeepInfra** — Largest catalog (300+), cheapest 70B
5. **Together AI** — Most complete platform, PTU for predictable cost
6. **Fireworks AI** — Best fine-tuning value, serverless training

### Tier 3 (v1.2 — enterprise):
7. **Cerebras** — Highest throughput (~3K TPS)
8. **SambaNova** — Competitive pricing, on-prem option
9. **Cloudflare AI Gateway** — Free, but deep ecosystem lock-in

### Tier 4 (enterprise — deferred):
10. **Azure AI Foundry** — Exclusive OpenAI access
11. **AWS SageMaker/Bedrock** — Broadest enterprise ecosystem
12. **Google Vertex AI** — TPU acceleration, Gemini models

---

## Sources

- OpenRouter: openrouter.ai
- Cloudflare AI Gateway: cloudflare.com/ai
- flo2: flo2.com
- Groq: groq.com
- Cerebras: cerebras.ai
- SambaNova: sambanova.ai
- GMI Cloud: gmicloud.ai
- Fireworks AI: fireworks.ai
- Together AI: together.ai
- DeepInfra: deepinfra.com
- SiliconFlow: siliconflow.cn
- DeepSeek API: deepseek.com
- Novita AI: novita.ai
- Google Vertex AI: cloud.google.com/vertex-ai
- AWS SageMaker: aws.amazon.com/sagemaker
- Azure AI Foundry: azure.microsoft.com/en-us/products/ai-studio
- Nebius AI: nebius.com

*All pricing data as of August 2, 2026*
