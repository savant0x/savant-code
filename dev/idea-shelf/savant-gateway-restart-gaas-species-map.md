<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Idea-Farm — Savant Gateway restart (the GaaS species map + NaraRouter dossier)

**Logged:** 2026-09-28
**Status:** SHELVED — Spencer: "i have this idea sitting in my mental 'shelf', so, i started building a gateway, however i never followed through with it. Im thinking about starting it over." Research done same session; NOT a commitment to restart. Re-activation triggers at bottom.
**Source (verify + link — MANDATORY per standing rule):**

- The spark: https://router.bynara.id/ (Spencer linked, asked if its Alibaba "collaboration" was official — answered below)
- Nara partnership page: https://router.bynara.id/partners/alibaba-cloud
- Nara Publisher (resale) docs: https://router.bynara.id/docs/publisher
- Nara parent company: https://bynara.id/ (Indonesian startup, bilingual ID/EN)
- Alibaba Cloud press room (absence evidence): https://www.alibabacloud.com/en/press-room
- The old gateway's business context lives in skill `nova-compute-stack` ("Business model flywheel", "Savant Gateway should route to Chinese providers first")

## What was asked, and the verdict

1. **"Is there gateway-as-a-service?"** — Yes, three species (map below).
2. **"router.bynara.id shows collaboration w/ Alibaba Cloud — but it looks like they're just telling us their infrastructure"** — **Spencer's read is CORRECT.** Evidence: (a) the partner page's "Supported Alibaba Cloud Models" list headlines Zhipu GLM, DeepSeek, Kimi, MiniMax — Alibaba's competitors; only Qwen + HappyHorse are Alibaba's. The list is really "models hosted on Alibaba Cloud Model Studio," relabeled. (b) Alibaba's press room press-releases every real partnership (CapitaLand, HashKey, NVIDIA, UNESCO, miHoYo) — zero NaraRouter mentions on Alibaba's side. One-sided "STRATEGIC COLLABORATION ×". (c) the supporting copy is generic infra talking points = "we run on Alibaba."

## The GaaS species map (for a potential restart)

| Species | Examples | Cost | Verdict for us |
|---|---|---|---|
| Self-host OSS plumbing | LiteLLM proxy, Bifrost (Machinet), Arch (Portkey), OneAPI/NewAPI, Higress (Alibaba OSS), Kong AI Gateway core | Free | **The plumbing layer — adopt/copy, don't rebuild.** Routing, fallback, key management, spend caps, observability are solved OSS. |
| Hosted GaaS | OpenRouter, Portkey Cloud, Helicone, Vercel AI Gateway, Cloudflare AI Gateway | Paid/credits | Don't need; OpenRouter already serves as one more upstream. |
| Resale routers (business, not plumbing) | **NaraRouter** (dossier below), the AntSeed gray board | Retail margins | The species a restarted Savant Gateway competes with — on TRANSPARENCY, not price. |

**Restart shape if revived:** boring OSS plumbing + the differentiated layer Savant already owns — BYOK discovery (`/provider free`, FID-2026-0928-012), ECHO-governed routing, x402 payment rail, and the "we don't lie about what model you're using" pitch. Don't rebuild LiteLLM; build what LiteLLM can't.

## NaraRouter dossier (competitive intel, probed 2026-09-28)

- **What it claims:** affordable multi-model AI gateway, OpenAI + Anthropic compatible (`https://router.bynara.id/v1`), "15+ providers", free plan 7M tokens/day @ 15rpm (Laguna S 2.1, Ling 3.0 Flash, Agnes 2.5/3 Flash, Jev, +7), paid plans in IDR (Freemium Rp 5K/day ≈ $0.30 for 25M tok; GPT Fams Rp 20K/day ≈ $1.30 for 25M tok of GPT-5.6 Luna/Sol/Terra; Mimo Rp 18K/day).
- **What it actually is:** a **subscription-resale retail router.** Publisher program = connect idle Claude/OpenAI subscription accounts → network routes other people's traffic through them → owner earns. Docs explicitly: "No protection against provider enforcement"; owner bears all ToS risk; capacity/quota/reputation-based dynamic routing (the AntSeed peer model, minus receipts). Pricing math impossible at official rates confirms the supply class.
- **Tells:** unknown rebadge of "Jev" (still unidentified — provenance fog; the hcnsec/rebadge lesson — "the UI lies; the model weights don't") — Agnes was initially suspicious too but code-level findings below identified it as a real SG/ID startup, so it's a supplier, not a rebadge; IDR/WIB/Telegram localization (Indonesian market); zero real reviews — only Instagram/Threads referral-farm spam (one carrying Bengali "Scam Risk" text); landing stats are "0+" placeholders; lists **Hermes Agent + OpenClaw** in its compatibility row (courting our ecosystem).
- **ZDR claim:** "Zero Data Retention by default" but content passes through publisher accounts (third-party retention applies) — transit, not storage.

### Code-level findings (HTML + JS pulled 2026-09-28 — the "one layer deeper")

- **The Alibaba "partnership" is upstream access dressed as collaboration.** `/ai-models` catalog contains SKUs `deepseek-v4-flash-alibaba` / `deepseek-v4-pro-alibaba` described verbatim: *"DeepSeek's V4 Flash model hosted and served through Alibaba Cloud's platform, a regional-hosting variant..."* / *"This 'Alibaba' variant is the same model served via Alibaba Cloud's hosting platform."* Badge tooltip i18n: `alibabaBadgeHint: "Powered by our Alibaba Cloud partnership."` They consume Alibaba Cloud's hosted-model platform (which hosts Qwen AND DeepSeek/Kimi/MiniMax/GLM — competitors, which is why the partner page's "Alibaba models" list looked wrong) and wear it as a partnership badge. Alibaba press room: zero mentions. Verdict: **customer wearing the partner badge.**
- **Pricing story is OpenRouter-synced.** Shipped admin bundle exposes `/api/admin/costs/sync-openrouter`, `/api/admin/costs/openrouter-quote?model=`, `/api/admin/compare-pricing/openrouter-catalog`, tables `officialModelPrices` + `officialOpenRouterCatalog`. The official-price → savings columns compute against OpenRouter's live catalog.
- **Refined structure (Spencer's hypothesis, corrected):** they BUILT the storefront (original NaraUI design system, Next.js + admin backend — not a white-label) but BOUGHT all three supply legs: (a) Alibaba Model Studio capacity, (b) Publisher subscription resale (gray), (c) Agnes AI bulk — Agnes is a real SG/ID frontier startup (trains own text/image/video models, ships AgnesCode CLI) — their flagship free models are a regional supplier's cheap output.
- **Infra:** Cloudflare front, `via: 1.1 Caddy` origin (a VPS — their own site does NOT run on Alibaba), `api-images.bynara.id`, GTM+NEL analytics. Admin surface fully mapped in public JS (plans, users, fx-rate, user-alias-overrides, menu-access rules) — indie-scale backend.
- **Fair-use text admits the game:** *"a model whose comparable upstream or official price is $10 may temporarily be offered through NaraRouter at a substantial [discount]."*
- Catalog mechanics: weight multipliers (Agnes free at 0.1x per their IG), "Free · Hold above {amount}" balance-hold promos, shared daily allowance across free-for-paid models.
- **Use if revived:** (a) competitive baseline for the transparency pitch (they are the counterexample), (b) disposable free-lane test candidate (7M tok/day) — same fingerprint gauntlet as any provider feed, (c) proof that price-sensitive-market demand for cheap multi-model access exists NOW.

## Re-activation trigger

File/restart when: (a) Spencer reopens the gateway build explicitly, (b) Savant needs a unified ops proxy before a partnership (then evaluate LiteLLM/Bifrost against BYOK config instead of building), or (c) Savant Inference's transparency pitch needs a live negative example + a documented cheap-lane trial. Until then: shelf, no build.
