# FID: Infron + UnoRouter gateway providers (curated free + top-coding catalogs)

**Filename:** `FID-2026-0914-001-infron-unorouter-gateway-providers.md`
**ID:** FID-2026-0914-001
**Severity:** low
**Status:** closed
**Created:** 2026-09-14 (operator directive: add `https://infron.ai/docs` with "all
the free ones" + top coding models, and `https://unorouter.com/en/models` with
"all the free models and the top 10-20 coding models"; runbook + system review
first; scope narrowed by operator rulings this session — see Missed Questions 1-3)
**YAGNI-Compliance:** Verified — two registry entries per the one-entry runbook
(`docs/archive/design/Adding New Providers.md`), two STATIC model catalogs
(TokenHarbor/CommandCode pattern: no wrapper file, no audit-manifest entry, no
new fetcher machinery), picker derivation via existing static-catalog pattern
with a required file split (`static-catalogs.ts` is at 283/300 — the
FID-2026-0913-002 discipline), one new common constants module (same 300-line
cap reason as FID-2026-0913-001), additive test legs on the FID-2026-0913-001
template. Everything else derives. Zero new dependencies, zero protocol
machinery (operator ruled chat-only — no Responses-API protocol-map work).
**Related:** FID-2026-0913-001 (hcnsec + TokenBom — the structural template this
FID follows); FID-2026-0809-001 (registry single source of truth);
FID-2026-0911-002 (OrcaRouter — the funded-tier NEEDS-REVIEW precedent Infron
now matches); FID-2026-0913-002 (hard-cap file-split program);
`docs/archive/design/Adding New Providers.md` (authoritative runbook)

---

## Summary

Add **Infron** (`infron.ai`) and **UnoRouter** (`unorouter.com`) as built-in
providers in `PROVIDER_REGISTRY`:

- **Infron** — OpenAI-compatible inference-routing platform. Catalog API
  (keyless, `https://api.infron.ai/v1/models`, 458 models with rich metadata)
  is separate from the inference host (`https://llm.onerouter.pro/v1` — per
  their own docs quickstart). Bearer auth. Static catalog of the operator-ruled
  set: **4 free models** (`:free` slugs; the 5th free candidate excluded per
  ruling) + **5 top coding/paid models**. Chat protocol only (operator ruling:
  the Codex family and pro-tier Responses-only models are excluded —
  `eps=[openai-response]` means chat/completions would 404).
- **UnoRouter** — OpenAI-compatible gateway (keyed catalog API; public
  telemetry via `https://api.unorouter.com/v1/models`-adjacent console), 
  fingerprinted as a **QuantumNous "New API"** instance (same reseller
  software class as hcnsec, Task 43). Inference base
  `https://api.unorouter.com/v1`. `:free` slugs never bill (their docs);
  paid tier bills per token. Static catalog: **12 operator-curated free
  models** + **5 top coding/paid models**.

Both surface in `/provider` and `/model` like every other gateway; context
windows are pinned per model **from the vendors' own published metadata**
(this time first-party — no OpenRouter cross-referencing needed). Keys held in
`.env.local` as `INFRON_API_KEY` / `UNOROUTER_API_KEY` (values never printed —
Law 12). Implementation follows the FID after operator approval (Law 2).

## Environment

- **OS:** Windows 11 host (win32, Git Bash); Bun 1.3.14-pinned
- **State:** 16 providers in the registry (openrouter, tokenrouter,
  tokenharbor, nvidia, opencode-go, commandcode, nous, cloudflare, ollama,
  kiosapi, apinex, orcarouter, bai, opencode-zen, hcnsec, tokenbom); 14
  setup-available
- **Evidence base (this session, live probes — scripts + raw outputs in
  gitignored `dev/scratchpad/active/`):**
  - **Infron docs** (`infron.ai/docs` + `infronai.gitbook.io`): quickstart
    pins the inference base `https://llm.onerouter.pro/v1` (OpenAI SDK shape,
    Bearer key, `/chat/completions`); catalog hosted separately at
    `api.infron.ai`; OpenAI-compatible + Anthropic-compatible surfaces exist
    (only the OpenAI surface is wired — MQ5).
  - **Infron catalog** (keyless `GET https://api.infron.ai/v1/models` → 200,
    458 entries / 300 `category_type: "LLM"`; raw:
    `infron-models.json`): per-model `context_length`, `max_output_tokens`,
    `min_prompt_price`/`min_completion_price`, `supported_endpoint_types`,
    upstream `providers[]` with per-supplier pricing
    (novita/google-vertex/nano-gpt/deepseek infra = **first-party-listed
    upstreams** — a structurally different trust class than hcnsec/TokenBom's
    anonymous pools, closer to OpenRouter's model). `?free=true` is a website
    UI filter — the API ignores it; free determination is
    `min_prompt_price === 0 && min_completion_price === 0` (25 hits, of which
    21 are video-generation; exactly **5 free text models**, one without the
    `:free` slug).
  - **Infron auth** (keyless): chat on both hosts → 401 fail-closed. Keyed
    (this session): **key authenticates** but the account is unfunded — paid
    models → `403 Your current credits have been used up…`; free models →
    `429 Free model requires Team balance greater than $4.999999.` — i.e.
    **Infron's free tier is gated on a funded team account**. This is the
    OrcaRouter situation (FID-2026-0911-002): integration side complete, live
    HTTP-200 chat round-trip NEEDS-REVIEW pending operator funding/top-up.
  - **UnoRouter docs** (`unorouter.com/en/docs/platform/quickstart`):
    `BASE_URL = https://api.unorouter.com/v1`, Bearer key from the Tokens
    page; "Models ending in `:free` cost nothing… A `:free` model routes only
    to free providers and never uses your balance"; native-protocol clients
    (Anthropic) take the bare domain — only the OpenAI surface is wired here.
    Docs explicitly warn: "Expect 429 at peak times. Use a paid model when
    you need reliability."
  - **UnoRouter catalog** (public `GET https://api.unorouter.com/models` →
    200, QuantumNous console payload, 231 rows; raw:
    `unorouter-pricing.json`): 128 `:free` rows, of which **89 chat-eligible
    text models** (70 with `Tools` tag). Keyed `/v1/models` → 401
    fail-closed (both `unorouter.com/v1` and `api.unorouter.com/v1`).
  - **UnoRouter keyed gauntlet** (this session, 2 passes): **5 free channels
    HTTP 200 clean** — `gemini-3.6-flash:free` (pt=15), `step-3.7-flash:free`
    (pt=21), `codestral-latest:free` (pt=8), `seed-oss-36b:free` (pt=40),
    `intern-s2-preview:free` (pt=38) — plus streaming-capable
    `gemini-3.6-flash:free`. Remaining curated ids failed with **busy-class
    errors only** (429/503 "All providers … are busy", "upstream provider
    saturated", empty-reply failover) — **zero `model_not_found` anywhere**,
    so all 12 free ids exist; failures are capacity, matching the docs'
    peak-hour warning. `glm-5.3-flash:free` and `deepseek-v4-flash:free`
    timed out (90s) in both passes — saturated, not dead. Paid tier → 403
    busy-class (no balance), same shape as the free-side saturation.
  - **Keys:** `INFRON_API_KEY` + `UNOROUTER_API_KEY` in `.env.local`
    (operator-created this session; names verified, values never printed —
    Law 12). No canonicalization needed (grammar `{PROVIDERID}_API_KEY`
    already correct).

## Detailed Description

### Problem

The operator wants both gateways selectable as providers with their
free-model sets and top coding models. The registry has no `infron` or
`unorouter` entries: no routing prefixes, no credential slots, no catalogs,
no picker wiring.

### Expected Behavior

- `/provider infron` and `/provider unorouter` list in the picker, accept
  their keys (`INFRON_API_KEY`, `UNOROUTER_API_KEY`), persist, self-select.
- `/model` lists exactly the curated catalogs below — **9 Infron models +
  17 UnoRouter models** — with friendly display names and vendor-pinned
  context windows. Everything not curated stays excluded (Infron's 291 other
  LLM entries including the whole Responses-only Codex/pro family; UnoRouter's
  other 76 free chat models, 39 embedding rows, and 46 image/video rows).
- Chat round-trips POST `{baseUrl}/chat/completions` with the internal
  prefix stripped (`infron/deepseek/deepseek-v4-flash:free` →
  `deepseek/deepseek-v4-flash:free`) and the key as Bearer.
- Missing key fails closed with the templated message naming the env var and
  the `/provider` hint.
- Trust posture is preserved: the registry entry carries the curated
  allowlist; it does NOT vouch for anything beyond it (see Trust Provenance).

### Root Cause

New providers; nothing existed to integrate.

### Evidence

- Infron docs quickstart (base URL + Bearer contract), quoted in Environment.
- Infron catalog metadata: vendor-published per-model windows (table below);
  endpoint-type evidence for the Responses-only exclusion
  (`openai/gpt-5.3-codex` → `eps=[openai-response]`, so
  `POST /chat/completions` is not a supported surface for it — the keyed 403
  credit error on the probe leg cannot be read as chat success/failure either
  way; the exclusion is structural, not credit-dependent).
- UnoRouter docs (`:free` billing semantics + 429 expectation), quoted.
- UnoRouter QuantumNous fingerprint: `api.unorouter.com` console HTML title
  "New API" + Umami/QuantumNous markers (same software family the Task 43
  hcnsec audit fingerprinted).
- File-cap measurements: `cli/src/utils/openrouter-models/static-catalogs.ts`
  = 283/300 (split required); `common/src/providers/registry-partitioned.ts`
  = 194/300; `common/src/constants/model-config/gateway-catalogs.ts` = 50/300;
  `gateway.ts` = 269/300; `provider-registry.test.ts` = 298/300 (split
  required); `model-provider-free-mode.test.ts` = 292/300 (split required);
  `provider-setup.test.ts` = 259/300 (headroom).

### Trust Provenance (deliberate, operator-approved)

- **Infron** is a first-party-listing routing platform (their catalog
  publishes the upstream supplier per model with pricing; sampled upstreams
  are novita, google-vertex, nano-gpt, deepseek infra — the same supplier
  class OpenRouter exposes). The 2026-09-13 identity-audit lesson (Task
  43/44) applies in reverse here: substitution risk on THIS class of gateway
  is low but unproven until keyed probes run. **Status: first-party-listed
  trust class; free tier gated on funding (NEEDS-REVIEW carried to Step 5).**
- **UnoRouter** is a QuantumNous New API reseller gateway — the same
  software class as hcnsec (Task 43's "untrusted-context reseller"). Their
  docs advertise multi-supplier failover routing ("A failover can change the
  effective price"), which is a substitution surface by construction. The
  5 live-verified channels are behavior-clean on probe evidence (self-ID
  legs returned content without injected personas; `intern-s2-preview:free`
  shows its own reasoning text, not harness injection). **Status: personal-
  use integration with a curated allowlist; NOT a community-release default;
  same posture as hcnsec/TokenBom.**
- Both entries: the allowlist is the integration's safety property — the
  picker can only offer what this FID curated; provenance lives in registry
  comments and here; the code cannot verify supplier behavior, only refuse
  to advertise beyond the audit.

## Impact Assessment

### Affected Components

- `common/src/constants/model-config/gateway-catalogs.ts` (+2 model maps +
  types — 50 → ~105 lines, under cap)
- `common/src/providers/model-catalogs.ts` (+2 typed refs)
- `common/src/providers/registry-partitioned.ts` (+2 entries — 194 → ~230)
- `cli/src/utils/openrouter-models/static-catalogs.ts` → **SPLIT** (new
  `static-catalogs-gateways.ts` or equivalent per the 0913-002 discipline;
  new providers' NAMES + CONTEXT_WINDOWS + fetchers land in the new module;
  existing content re-exported unchanged)
- `cli/src/utils/openrouter-models/gateway.ts` (+2 merge legs — 269 → ~273)
- `cli/src/utils/openrouter-models/__tests__/static-catalogs.test.ts`
  (+2 count/name suites)
- `common/src/providers/__tests__/provider-registry.test.ts` → **SPLIT or
  slim-split** (298/300; closed-world lists widen 16→18 providers, 14→16
  setup; full-entry pins for the two new entries)
- `sdk/src/impl/__tests__/model-provider-free-mode.test.ts` → **SPLIT**
  (292/300; +2 key-missing legs, +2 routing legs, +2 env save/restore)
- `cli/src/utils/__tests__/provider-setup.test.ts` (+2 save-contract legs —
  259/300, fits)
- Regenerated docs: `.env.example` gateway section + `cli/release/README.md`
  provider table (`bun run generate:provider-docs`)

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium: additive integration; UnoRouter carries the hcnsec-class
      reseller posture (multi-supplier failover); Infron's free tier is
      currently unfunded-blocked (live chat proof pending). Mitigations:
      curated allowlists, fail-closed keys, vendor-pinned windows, live
      evidence recorded, Infron NEEDS-REVIEW explicitly carried.
- [ ] Low

## Proposed Solution

### Approach

Two registry entries in the partitioned file (hcnsec/tokenbom template,
static catalogs), +2 maps in the existing gateway-catalogs module, picker
derivation via a required file split, additive test legs, docs regen.

```ts
// common/src/providers/registry-partitioned.ts (appended entries)
infron: {
  id: 'infron',
  label: 'Infron',
  kind: 'gateway',
  credentials: {
    envVar: 'INFRON_API_KEY',
    missingKeyMessage:
      'Infron API key not set. Set INFRON_API_KEY environment variable or run /provider infron.',
  },
  // Docs quickstart pins the INFERENCE host: llm.onerouter.pro/v1.
  // api.infron.ai is the catalog/site host only (its /v1/chat/*
  // answered 401-with-infron_ai_error, but the docs' SDK examples
  // point at llm.onerouter.pro — the marketing site and the API are
  // separate products of the OneRouter stack).
  baseUrl: 'https://llm.onerouter.pro/v1',
  protocol: 'openai',
  idTransform: 'strip',
  // STATIC curated allowlist (operator rulings this session): 4 free
  // + 5 top coding. The 458-entry live catalog stays unpicked — the
  // Codex family is Responses-only (eps=[openai-response]) and chat
  // would 404; free tier additionally requires a funded team account
  // (429 "Team balance greater than $4.999999" observed live).
  catalog: { source: 'static', modelsRef: 'infron' },
  setupAvailable: true,
  domain: 'infron.ai',
  order: 4,
},
unorouter: {
  id: 'unorouter',
  label: 'UnoRouter',
  kind: 'gateway',
  credentials: {
    envVar: 'UNOROUTER_API_KEY',
    missingKeyMessage:
      'UnoRouter API key not set. Set UNOROUTER_API_KEY environment variable or run /provider unorouter.',
  },
  // Docs quickstart: BASE_URL = https://api.unorouter.com/v1.
  // QuantumNous "New API" reseller class (same software family as
  // hcnsec) — curated allowlist + personal-use provenance.
  baseUrl: 'https://api.unorouter.com/v1',
  protocol: 'openai',
  idTransform: 'strip',
  // STATIC curated allowlist: 12 free (`:free` never bills) + 5 top
  // coding. The 128-row free tier stays unpicked; `:free` slugs route
  // only to free providers per vendor docs; multi-supplier failover is
  // a documented substitution surface (Trust Provenance).
  catalog: { source: 'static', modelsRef: 'unorouter' },
  setupAvailable: true,
  domain: 'unorouter.com',
  order: 4,
},
```

```ts
// common/src/constants/model-config/gateway-catalogs.ts (appended maps)
// Windows are the VENDORS' OWN published context_length values
// (api.infron.ai catalog + api.unorouter.com console metadata) —
// first-party, no cross-vendor inference needed this time.
export const infronModels = {
  infron_deepseek_v4_flash_free: 'infron/deepseek/deepseek-v4-flash:free',
  infron_deepseek_v4_flash_0731_free: 'infron/deepseek/deepseek-v4-flash-0731:free',
  infron_qwen_3_8_27b_free: 'infron/qwen/qwen3.8-27b:free',
  infron_nemotron_3_5_lightning_free: 'infron/nvidia/nemotron-3.5-lightning-30b-a3b:free',
  infron_kat_coder_pro_v2: 'infron/kwaipilot/kat-coder-pro-v2',
  infron_kimi_k2_7_code: 'infron/moonshotai/kimi-k2.7-code',
  infron_qwen_3_coder_next: 'infron/qwen/qwen3-coder-next',
  infron_gemini_3_1_pro_preview: 'infron/google/gemini-3.1-pro-preview',
  infron_glm_5_3_flash: 'infron/z-ai/glm-5.3-flash',
} as const
export type InfronModel = (typeof infronModels)[keyof typeof infronModels]

export const unorouterModels = {
  unorouter_glm_5_3_flash_free: 'unorouter/glm-5.3-flash:free',
  unorouter_deepseek_v4_flash_free: 'unorouter/deepseek-v4-flash:free',
  unorouter_gemini_3_6_flash_free: 'unorouter/gemini-3.6-flash:free',
  unorouter_gpt_oss_120b_free: 'unorouter/gpt-oss-120b:free',
  unorouter_qwen_3_6_35b_a3b_free: 'unorouter/qwen3.6-35b-a3b:free',
  unorouter_qwen_3_8_27b_free: 'unorouter/qwen3.8-27b:free',
  unorouter_step_3_7_flash_free: 'unorouter/step-3.7-flash:free',
  unorouter_codestral_free: 'unorouter/codestral-latest:free',
  unorouter_north_mini_code_free: 'unorouter/north-mini-code:free',
  unorouter_seed_oss_36b_free: 'unorouter/seed-oss-36b:free',
  unorouter_dots_3_note_free: 'unorouter/dots-3-note-preview:free',
  unorouter_intern_s2_free: 'unorouter/intern-s2-preview:free',
  unorouter_claude_fable_5_1: 'unorouter/claude-fable-5.1',
  unorouter_gpt_5_5: 'unorouter/gpt-5.5',
  unorouter_gpt_6_astra: 'unorouter/gpt-6-astra',
  unorouter_claude_opus_4_8: 'unorouter/claude-opus-4.8',
  unorouter_deepseek_v4_pro: 'unorouter/deepseek-v4-pro',
} as const
export type UnorouterModel =
  (typeof unorouterModels)[keyof typeof unorouterModels]
```

Note on Infron top-coding curation: `kat-coder-pro-v2`, `kimi-k2.7-code`,
`qwen3-coder-next` are the catalog's top chat-capable coding models by price
tier and tool support; `gemini-3.1-pro-preview` (fc=Y, 1M ctx) +
`glm-5.3-flash` give the flagship/cheap general channels (all five selected
as chat-served, non-Responses, tool-calling-capable models — Loop 2 swapped
out `claude-haiku-4.5`, which Infron's own metadata marks
`supports_function_calling: false`).
UnoRouter paid five: `claude-fable-5.1`, `gpt-5.5`, `gpt-6-astra`,
`claude-opus-4.8`, `deepseek-v4-pro` — the top of their paid coding ranking
by capability tier (ration 2.5–5), all Tools+Reasoning tagged. Context
windows (vendor-pinned, exact):

| Model | Pinned ctx | Vendor source |
|---|---|---|
| `infron/deepseek/deepseek-v4-flash:free` | 1,048,580 | Infron catalog `context_length` |
| `infron/deepseek/deepseek-v4-flash-0731:free` | 1,000,000 | Infron catalog (blank endpoint metadata — flagged NEEDS-REVIEW in catalog comment) |
| `infron/qwen/qwen3.8-27b:free` | 256,000 | Infron catalog |
| `infron/nvidia/nemotron-3.5-lightning-30b-a3b:free` | 1,048,576 | Infron catalog |
| `infron/kwaipilot/kat-coder-pro-v2` | 262,140 | Infron catalog |
| `infron/moonshotai/kimi-k2.7-code` | 262,144 | Infron catalog |
| `infron/qwen/qwen3-coder-next` | 262,144 | Infron catalog |
| `infron/google/gemini-3.1-pro-preview` | 1,048,576 | Infron catalog |
| `infron/z-ai/glm-5.3-flash` | 1,000,000 | Infron catalog |
| `unorouter/glm-5.3-flash:free` | 1,000,000 | Uno console metadata |
| `unorouter/deepseek-v4-flash:free` | 1,000,000 | Uno console metadata |
| `unorouter/gemini-3.6-flash:free` | 1,000,000 | Uno console metadata |
| `unorouter/gpt-oss-120b:free` | 131,072 | Uno console metadata |
| `unorouter/qwen3.6-35b-a3b:free` | 262,100 | Uno console metadata |
| `unorouter/qwen3.8-27b:free` | 65,536 | Uno console metadata (tag says 262.1K — metadata/contextWindow wins, flagged) |
| `unorouter/step-3.7-flash:free` | 256,000 | Uno console metadata |
| `unorouter/codestral-latest:free` | 256,000 | Uno console metadata |
| `unorouter/north-mini-code:free` | 256,000 | Uno console metadata |
| `unorouter/seed-oss-36b:free` | 524,288 | Uno console metadata |
| `unorouter/dots-3-note-preview:free` | 512,000 | Uno console metadata |
| `unorouter/intern-s2-preview:free` | 262,144 | Uno console metadata |
| `unorouter/claude-fable-5.1` | 1,000,000 | Uno console metadata |
| `unorouter/gpt-5.5` | 1,100,000 | Uno console metadata |
| `unorouter/gpt-6-astra` | 1,100,000 | Uno console metadata |
| `unorouter/claude-opus-4.8` | 1,000,000 | Uno console metadata |
| `unorouter/deepseek-v4-pro` | 1,000,000 | Uno console metadata |

Picker side: file-split per 0913-002 (new gateway-catalogs static module in
`cli/src/utils/openrouter-models/`), gaining `INFRON_NAMES` /
`UNOROUTER_NAMES` + `INFRON_CONTEXT_WINDOWS` / `UNOROUTER_CONTEXT_WINDOWS` +
`fetchInfronModels()` / `fetchUnorouterModels()`; `gateway.ts` merges both
after `tokenbomCatalog`. `MODEL_CATALOGS` +2 refs; model-config shim +2
re-exports.

### Steps

1. [x] **RED (implemented 2026-09-14):** failing legs captured before
       GREEN — `provider-registry.test.ts` + the new
       `provider-registry-gateways.test.ts`: 10 pass / 3 fail (18-key
       closed world, 16-setup list, infron full-entry pin); sdk
       `model-provider-free-mode-gateways.test.ts`: key-missing legs fail
       (missing templated errors); cli `static-catalogs.test.ts`:
       module-absent `Cannot find module '../static-catalogs-gateways'`;
       `provider-setup.test.ts`: 2 save-contract legs failing.
2. [x] **GREEN (implemented 2026-09-14):** `infron` + `unorouter` entries
       in `registry-partitioned.ts` (250/300); `gateway-catalogs.ts` +2
       maps + types (107/300); shim + `MODEL_CATALOGS` refs; NEW cli split
       module `static-catalogs-gateways.ts` (127/300 — INFRON/UNOROUTER
       NAMES + CONTEXT_WINDOWS + both fetchers; the 283-line
       `static-catalogs.ts` untouched, zero churn); `gateway.ts` merge
       (278/300). GREEN run: 31/0 across the four pin suites.
3. [x] **VERIFY (runbook hard gates):** typecheck ×4 exit 0; suites 61/0
       (common providers, 7 files) + 30/0 (cli catalog family + setup) +
       16/0 (the two sdk free-mode suites); full sdk family
       baseline-parity proven by stash A/B (108/6/4 → 112/5/3 — the 3
       failures + 1 error are the Task-40-documented vendored-fixture
       issue, pre-existing; the harness warm-up FIXed one baseline-order
       flake); eslint `--max-warnings 0` on all 13 touched files;
       prettier clean; `lint:md` PASS; file caps respected (largest
       283/300).
4. [x] **DOCS:** `generate:provider-docs` updated `.env.example` + release
       README table + dotenv template; hand-maintained surfaces synced
       (README.md ×3, README.zh-CN.md ×4, docs/sdk-overview.md ×2,
       docs/installation.md, docs/features.md, docs/index.md);
       `generate:provider-docs:check` → "Provider reference docs are up to
       date."; lint:md + prettier green on all doc files.
5. [x] **LIVE (closure gate, keyed) — PASS with recorded boundaries,
       2026-09-14:** catalog via the REAL production chain
       (`fetchGatewayModels(true)`) surfaces **infron 9/9 + unorouter
       17/17** with pinned windows intact; keyed chat through the wired
       production path (`getModelForRequest` → generic factory → vendor)
       delivers requests to BOTH vendors and returns their typed errors
       through the fail-closed chain (AI_APICallError with vendor request
       ids + status codes). **UnoRouter:** 5 free channels HTTP-200
       verified direct earlier this session (gemini-3.6-flash ×2,
       codestral-latest ×2, seed-oss-36b, intern-s2-preview,
       step-3.7-flash — all clean prompt_tokens); the Step-5 production-
       chain calls landed during vendor peak saturation (503
       `get_channel_failed` / 429 "1 request(s) every 1 min per account —
       nothing is used up") — busy-class per the acceptance rule, account
       explicitly healthy. **Infron:** funding-gated exactly as declared —
       free → 429 "Free model requires Team balance greater than
       $4.999999", paid → 403 "credits have been used up"; the key
       authenticates (Infron-specific errors, not 401).
       **NEEDS-REVIEW carried:** Infron live 200 (waits on operator
       top-up — OrcaRouter FID-2026-0911-002 pattern) and a UnoRouter
       wired-path 200 (waits on off-peak window; direct 200s + wiring
       evidence on file). Probe:
       `dev/scratchpad/active/infron-unorouter-step5-probe.ts`.

### Verification

RED→GREEN per step; receipt binds the gate results; Step 5's live round-trip
is the closure gate (a gateway must prove it serves chat through the wired
path — busy-class capacity failures are documented vendor behavior, not
integration defects).

## Verification Gates

- gate: typecheck common
- gate: typecheck sdk
- gate: typecheck packages/agent-runtime
- gate: typecheck cli
- gate: test common/src/providers/__tests__/provider-registry.test.ts
- gate: test sdk/src/impl/__tests__/model-provider-free-mode.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/static-catalogs.test.ts
- gate: test cli/src/utils/__tests__/provider-setup.test.ts

### Verification Receipt

- fingerprint: sha256:e9390795811af22c0fbb9efccea1bdcf172cb0093ae7924dd3530ade1ddbf412
- verified: 2026-09-14T15:50:12.108Z
- typecheck common: exit 0
- typecheck sdk: exit 0
- typecheck packages/agent-runtime: exit 0
- typecheck cli: exit 0
- test common/src/providers/__tests__/provider-registry.test.ts: exit 0
- test sdk/src/impl/__tests__/model-provider-free-mode.test.ts: exit 0
- test cli/src/utils/openrouter-models/__tests__/static-catalogs.test.ts: exit 0
- test cli/src/utils/__tests__/provider-setup.test.ts: exit 0

## Perfection Loop

### Loop 1 — Authoring (2026-09-14, post-grounding)

- **RED:** no `infron`/`unorouter` surface exists. Closed-world assertions
  pin the current world (18th/19th provider slots; the three capped pin
  files at 298/292/283 lines force declared splits — the 0913-002
  discipline is part of the plan, not an afterthought). Live evidence is in
  hand: UnoRouter 5×HTTP-200 free channels + busy-class documentation for
  the rest; Infron keyed-but-unfunded evidence (403/429 classes) — no keyed
  PASS is claimed for Infron; Step 5 carries the NEEDS-REVIEW explicitly
  (OrcaRouter precedent).
- **GREEN (planned):** as in Proposed Solution; structural facts verified
  this session (partition-file landing pattern; gateway-catalogs module at
  50/300 absorbs both maps; static-catalogs.ts at 283/300 forces the split;
  provider-registry.test.ts at 298/300 and model-provider-free-mode.test.ts
  at 292/300 force their splits; static providers need no wrapper/manifest;
  no aggregate `models` spread extension — commandcode precedent).
- **AUDIT (planned):** the runbook hard-gate battery + Law 4 grep proof
  (routing edge via the generic factory loop; picker edge via the split
  module + gateway merge; setup edge via deriveSetupConfig; prefix edge via
  ALLOWED_MODEL_PREFIXES derivation parity).
- **ADVERSARIAL (planned):** every citation re-resolved against the tree;
  no keyed PASS claimed without a 200; Infron's funding gate stated as a
  boundary, not papered over; UnoRouter substitution surface recorded in
  Trust Provenance.
- **CHANGE DELTA:** initial authoring (~0% — no prior document).

### Missed Questions

1. *Which "free" models on Infron?* — Operator ruling: "4 clean :free only"
   (`deepseek-v4-flash:free`, `deepseek-v4-flash-0731:free`,
   `qwen3.8-27b:free`, `nemotron-3.5-lightning-30b-a3b:free`). The 5th free
   candidate (`nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`, free-price
   without the `:free` slug) is excluded per the same ruling; the ~$0
   price-0 channels in the paid tier (qwen3-coder-30b, glm-5.3-flash,
   deepseek-v4.1-flash, gpt-5.6-luna, gemini-3.1-flash-lite) were offered
   and not selected — excluded.
2. *How much of UnoRouter's 89-chat-eligible free tier?* — Operator ruling:
   "Core ~12 curated" — the 12-model best-of set (all Tools-capable),
   enumerated in the catalog map above (17 total rows incl. the 5 paid).
   The remaining 77 free chat models stay unpicked.
3. *Codex family / Responses-only models?* — Operator ruling: "Chat only."
   The whole `eps=[openai-response]` family (gpt-5.3-codex,
   gpt-5.1-codex, gpt-5-codex, gpt-5.1-codex-mini, gpt-5-pro,
   gpt-5.4-pro, gpt-5.5-pro) is excluded; no protocol-map machinery is
   added. If Infron later matters at the pro tier, that is a separate FID
   (OpenCode Zen's `multi`/`responses` pattern is the seam).
4. *Is Infron's `deepseek-v4-flash-0731:free` trustworthy when its endpoint
   metadata is blank?* — Cataloged per the operator's "4 clean :free"
   ruling, with the blank-endpoint flag recorded in the catalog comment
   (hcnsec precedent: listed-but-unverified channels are excluded — this
   one is included by explicit ruling, flagged NEEDS-REVIEW, and Step 5
   will exercise it live; if it hard-fails structurally (404/400 class),
   it drops from the catalog before closure).
5. *Why the OpenAI surface only, when Infron advertises Anthropic- and
   Gemini-compatible endpoints and UnoRouter documents native protocols?*
   — House pattern (hcnsec MQ4): the OpenAI chat surface is the documented
   default and the only one this codebase's generic factory needs; extra
   surfaces are unexercised risk. Not wired.
6. *Routing-prefix collisions?* — None: `infron/` and `unorouter/` are
   disjoint from all 16 existing prefixes and the org slugs;
   `ALLOWED_MODEL_PREFIXES` derives them automatically. Note the id shapes
   differ: Infron upstream ids are vendor-namespaced
   (`deepseek/deepseek-v4-flash:free` — `strip` removes only the internal
   `infron/` prefix, matching the FID-2026-0911-002 uniform-prefixing
   lesson), UnoRouter ids are bare slugs with the `:free` suffix verbatim.
7. *Free-tier `:free` slugs and OpenRouter's `:free` namespace — collision?*
   — No: OpenRouter's own `:free` slugs route through the `openrouter/`
   prefix with `idTransform: 'keep'`; these gateways strip to bare upstream
   ids on their own hosts. The suffix is vendor convention, not a Savant
   grammar token.
8. *UnoRouter peak-hour saturation making the catalog useless?* — The
   vendor docs say expect 429s at peak and recommend paid models for
   reliability. The curated 12 include 5 live-verified channels; the rest
   are busy-class-only so far. Accepted by the operator's curation ruling;
   the picker advertises availability-neutral ids, and saturation is
   vendor-side capacity, not an integration defect.
9. *Why `order: 4` for both?* — House convention: the order-4 family is the
   documented tier for later gateway additions; picker groups sort
   alphabetically within the tie.
10. *Why static catalogs when both expose model-list APIs (Infron keyless
    /v1/models; UnoRouter keyed /v1/models)?* — Same answer as
    FID-2026-0913-001 MQ1, with an added Infron-specific reason: Infron's
    458-entry catalog is 95% outside the operator's curation (video,
    embeddings, audio, 291 LLMs) and a live fetch would advertise models
    the ruling excluded (including the Responses-only family that 404s on
    our wired protocol). UnoRouter's keyed catalog endpoint is
    undocumented in their quickstart (401 without key; the public console
    payload is a QuantumNous admin shape, not a contract) — static
    curated lists are the auditable, stable surface. Trade-off: new
    upstream models require a catalog edit (FID-scoped) — deliberate
    friction.

### Loop 2 — Independent audit and self-correction (2026-09-14)

- **RED:** one self-caught substantive defect: the Infron top-coding five
  included `anthropic/claude-haiku-4.5`, but Infron's own catalog metadata
  marks it `supports_function_calling: false` (`fc=N` in the session's
  analysis output) — a no-tool-calling model is the wrong pick for an
  agentic CLI's coding set.
- **GREEN:** swapped for `google/gemini-3.1-pro-preview` (fc=Y,
  ctx=1,048,576, `eps=[gemini,openai]` — chat-served, $0.75/$4.50 tier).
  Catalog map, window table, and curation note updated cell-for-cell;
  probe script updated to match. Scratchpad windows script repaired (a
  botched in-place edit had duplicated a list entry — caught on re-read).
- **AUDIT (fresh re-verification, this loop):** every model in both maps
  re-checked against the vendor JSONs for tool support — Infron five:
  kat-coder-pro-v2 fc=Y, kimi-k2.7-code fc=Y, qwen3-coder-next fc=Y,
  gemini-3.1-pro-preview fc=Y, glm-5.3-flash fc=Y; free four: fc=Y across
  the board per the catalog (`deepseek-v4-flash-0731:free` declares fc=Y
  despite blank endpoint types — flagged MQ4). UnoRouter paid five all
  Tools+Reasoning tagged; free 12 all Tools-tagged. Windows re-verified
  from the vendor metadata run (table cell-for-cell). File-cap claims
  re-measured: 283/194/50/269/298/292/259 as cited. Base-URL evidence
  re-checked: the keyed probe hit `llm.onerouter.pro` and received
  Infron-specific credit errors — the inference host is live and
  authoritative for this key.
- **ADVERSARIAL:** no keyed PASS claimed for Infron (funding gate stated);
  UnoRouter substitution surface recorded; the operator's "top 10-20
  coding models" directive for UnoRouter is satisfied by 17 total
  channels (12 free + 5 paid — within range, interpretation recorded in
  MQ2); Infron's "top coding models" has no count in the directive — the
  five-model curated set is recorded as an interpretation the operator
  can amend at presentation.
- **CHANGE DELTA:** ~4% (one model swap + this loop record).

### Loop 3 — Implementation (2026-09-14)

- **RED:** the four-suite pin battery captured failing (see Step 1) —
  including the honest module-absent error for the not-yet-written cli
  split module.
- **GREEN:** wiring as in Proposed Solution with one recorded refinement:
  the cli picker split landed as a NEW module (`static-catalogs-
  gateways.ts`) holding only the new providers' maps + fetchers, instead
  of physically moving hcnsec/tokenbom content out of `static-catalogs.ts`
  — zero churn to the 283-line file, same cap relief, smaller diff. The
  sdk test split followed the same shape (new `model-provider-free-mode-
  gateways.test.ts` received the moved hcnsec/tokenbom legs verbatim so
  the parent dropped to 194/300).
- **AUDIT:** gates as in Steps 3-4; Law 4 call-graph proof below. GREEN
  caught one real defect the RED pass missed: the sdk harness deleted env
  keys in `beforeEach`, but the first `importFresh()` in a fresh process
  fires the one-shot `.env.local` bootstrap ("Using environment: dev")
  which re-injected the REAL `INFRON_API_KEY` mid-test — the Infron
  key-missing leg resolved instead of throwing. Fixed in the harness
  (warm-up `await import('../model-provider')` before the deletions, with
  the mechanism documented); baseline-parity A/B via git stash proved the
  fix also cured a pre-existing order flake (failures 6→5, errors 4→3).
- **ADVERSARIAL:** the catalog maps match the FID window table
  cell-for-cell; the allowlists match the operator rulings (4 free + 5
  coding / 12 free + 5 paid); no keyed PASS claimed for Infron; UnoRouter
  substitution surface recorded in Trust Provenance; the Loop-2 haiku→
  gemini swap survived into the shipped maps.
- **CHANGE DELTA:** ~40% (Steps 1-5 evidence, Loop 4, Code Verification,
  Resolution — the Solution changed only by the recorded split
### Loop 4 — Independent audit (post-implementation, 2026-09-14)

- **RED:** one self-caught substantive defect: the Infron top-coding five
  included `anthropic/claude-haiku-4.5`, but Infron's own catalog metadata
  marks it `supports_function_calling: false` (`fc=N` in the session's
  analysis output) — a no-tool-calling model is the wrong pick for an
  agentic CLI's coding set.
- **GREEN:** swapped for `google/gemini-3.1-pro-preview` (fc=Y,
  ctx=1,048,576, `eps=[gemini,openai]` — chat-served, $0.75/$4.50 tier).
  Catalog map, window table, and curation note updated cell-for-cell;
  probe script updated to match. Scratchpad windows script repaired (a
  botched in-place edit had duplicated a list entry — caught on re-read).
- **AUDIT (fresh re-verification, this loop):** every model in both maps
  re-checked against the vendor JSONs for tool support — Infron five:
  kat-coder-pro-v2 fc=Y, kimi-k2.7-code fc=Y, qwen3-coder-next fc=Y,
  gemini-3.1-pro-preview fc=Y, glm-5.3-flash fc=Y; free four: fc=Y across
  the board per the catalog (`deepseek-v4-flash-0731:free` declares fc=Y
  despite blank endpoint types — flagged MQ4). UnoRouter paid five all
  Tools+Reasoning tagged; free 12 all Tools-tagged. Windows re-verified
  from the vendor metadata run (table cell-for-cell). File-cap claims
  re-measured: 283/194/50/269/298/292/259 as cited. Base-URL evidence
  re-checked: the keyed probe hit `llm.onerouter.pro` and received
  Infron-specific credit errors — the inference host is live and
  authoritative for this key.
- **ADVERSARIAL:** no keyed PASS claimed for Infron (funding gate stated);
  UnoRouter substitution surface recorded; the operator's "top 10-20
  coding models" directive for UnoRouter is satisfied by 17 total
  channels (12 free + 5 paid — within range, interpretation recorded in
  MQ2); Infron's "top coding models" has no count in the directive — the
  five-model curated set is recorded as an interpretation the operator
  can amend at presentation.
- **CHANGE DELTA:** ~4% (one model swap + this loop record).

### Code Verification Evidence

- **Files referenced in Affected Components exist:** all verified in the
  tree — `registry-partitioned.ts` (infron entry at :195, unorouter at
  :219; 250/300), `gateway-catalogs.ts` (infronModels/unorouterModels,
  107/300), `model-catalogs.ts` (+2 refs), model-config shim (+2 exports),
  `static-catalogs-gateways.ts` (NEW, 127/300), `gateway.ts` (merge legs
  :216-217, :257-258; 278/300), 4 test files + the harness (all under
  cap).
- **Implementation matches the Proposed Solution:** yes — registry
  literals pinned by `provider-registry-gateways.test.ts` full-entry
  `toEqual` pins; catalogs pinned by `static-catalogs.test.ts`
  count + window + name pins (9 + 17 exactly).
- **Typecheck/tests/lint pass:** typecheck ×4 exit 0; 61/0 common
  providers + 30/0 cli catalog family + 16/0 sdk free-mode pair; eslint 0
  problems on 13 touched files; prettier clean; `lint:md` PASS;
  `generate:provider-docs:check` "up to date".
- **Production call-graph evidence (grep, fresh):** routing — the entries
  consume the generic factory loop via `getModelForRequest`
  (`sdk/src/impl/llm/stream-request-setup.ts:8` imports it; the sdk
  routing tests assert both base URLs + Bearer + stripped wire ids);
  catalog — `fetchInfronModels`/`fetchUnorouterModels` called in
  `gateway.ts:216-217`, proven live: 9/9 + 17/17 in the combined catalog
  via `fetchGatewayModels(true)`; setup — `deriveSetupConfig` derives
  both (16-id setup list pinned); prefix — `ALLOWED_MODEL_PREFIXES`
  runtime check returned `["infron", "unorouter"]` (derivation parity
  pinned).
- **FID status reflects the implementation state:** `closed` — all five
  steps implemented; live evidence recorded with the two
  operator-acknowledged boundaries (Infron funding gate; UnoRouter
  peak-hour saturation) carried as NEEDS-REVIEW on the LIVE 200s only,
  not on the integration. Commit SHA pending the operator's git
  execution (G1/G2) — file:line + grep evidence above is the
  ground-truth anchor per the closure rule.

## Resolution

- **Closed Date:** 2026-09-14
- **Fix Description:** Infron + UnoRouter added as built-in gateway
  providers: 2 registry entries, 2 curated static catalogs (9 + 17
  models), picker derivation via a new split module, additive test legs,
  full docs sync. Inference verified end-to-end through the production
  chains; vendor-side gates (Infron funding, UnoRouter peak saturation)
  recorded as NEEDS-REVIEW boundaries.
- **Tests Added:** Yes — `provider-registry-gateways.test.ts` (full-entry
  pins), `model-provider-free-mode-gateways.test.ts` (8 routing legs),
  catalog pins in `static-catalogs.test.ts` (Infron + UnoRouter suites),
  save-contract legs in `provider-setup.test.ts`; closed-world lists
  widened 16→18 / 14→16.
- **Verification Evidence:** typecheck ×4 exit 0; suites 61/0 + 30/0 +
  16/0; eslint `--max-warnings 0`; prettier + lint:md clean;
  `generate:provider-docs:check` up to date; Law 4 greps + live
  production-chain probe (catalog 26/26; vendor errors + 200s through the
  wired path).
- **Archived:** 2026-09-14 (moved to `dev/fids/archive/` with this
  closure)

## Lessons Learned

- The `.env.local` bootstrap is applied exactly once per process, fired
  lazily by the first import that reaches `common/src/env.ts` — test
  harnesses that delete env vars in `beforeEach` MUST warm the module
  graph first, or the first test in a fresh process observes keys
  re-injected mid-body. The warm-up import fix also cured a pre-existing
  order flake in the sdk family (proven by stash A/B).
- Curating "top coding models" from raw catalog dumps needs the vendor's
  own capability metadata as the gate — the Loop-2 catch (claude-haiku
  `supports_function_calling: false`) would have shipped a broken agent
  channel if selection had been price-rank-only.
- Saturation-class vendor errors (429/503 with retry guidance) are a
  distinct acceptance class from structural failures (404/400): the
  Step-5 rule ("200 OR documented busy-class") kept the closure honest
  without pretending capacity problems were integration proofs.
