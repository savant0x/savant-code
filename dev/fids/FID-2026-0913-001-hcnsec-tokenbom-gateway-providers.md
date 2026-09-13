# FID: hcnsec + TokenBom gateway providers (audited 14-model allowlist)

**Filename:** `FID-2026-0913-001-hcnsec-tokenbom-gateway-providers.md`
**ID:** FID-2026-0913-001
**Severity:** low
**Status:** fixed
**Created:** 2026-09-13 (operator directive: "add those 2 providers and those
14 models, follow the same convention as other providers, make sure you update
the selection panel, etc. … make a fid for these 2 providers and the models
then run the full perfection loop on it then present for finial approval")
**YAGNI-Compliance:** Verified — two registry entries per the one-entry
runbook (`docs/archive/design/Adding New Providers.md`), two STATIC model
catalogs (TokenHarbor/CommandCode pattern: no wrapper file, no audit-manifest
entry, no new fetcher machinery), one new common constants module (the
300-line cap forces it), two picker catalog functions + gateway merge, and
the runbook's additive Step-5 test legs. Everything else derives.
**Related:** FID-2026-0809-001 (registry single source of truth);
FID-2026-0911-002 (OrcaRouter — the most recent gateway precedent);
FID-2026-0907-008 (APInex — static-vs-live catalog discipline);
`docs/archive/design/Adding New Providers.md` (authoritative runbook);
Tasks 43-E / 44-C in `SCOPE.md` (the identity audits that produced the
allowlist); `docs/provider-identity-audit-2026-09-13.md` (full audit report)

---

## Summary

Add **HCNSec** (`hcnsec.cn`) and **TokenBom** (`tokenbom.com`) as built-in
providers in `PROVIDER_REGISTRY`: two OpenAI-compatible credit-based
gateways (Bearer auth, `/chat/completions`, internal `hcnsec/` and
`tokenbom/` routing prefixes stripped). Both carry **static catalogs of
exactly the 14 models the operator's identity audits confirmed genuine**
(7 per gateway) — deliberately NOT a live `/v1/models` fetch, because the
audits (Tasks 43-E, 44-C) proved both gateways' live listings include
substituted, prompt-injected, and dead models the operator rejected. The
providers surface in `/provider` and `/model` like every other gateway;
context windows derive from `inferContextLength`; docs regenerate from the
registry. Implementation follows the FID after operator approval (Law 2).

## Environment

- **OS:** Windows 11 host (win32, Git Bash); Bun 1.3.14-pinned
- **State:** 14 providers in the registry (openrouter, tokenrouter,
  tokenharbor, nvidia, opencode-go, commandcode, nous, cloudflare, ollama,
  kiosapi, apinex, orcarouter, bai, opencode-zen); 12 setup-available
- **Evidence base (prior sessions, live probes — full report:
  `docs/provider-identity-audit-2026-09-13.md`):**
  - **HCNSec** (`https://api.hcnsec.cn/v1`): new-api (QuantumNous) gateway;
    keyed `/v1/models` → 18 models (keyless 401 fail-closed); streaming +
    tool-calls verified (`glm-5.3-flash`, `step-3.7-flash`); paid account
    (operator holds 30k credits). Identity audit: 7 confirmed-genuine
    channels, 3 dead listings, substitutions (`deepseek-v4-pro` served by
    nvidia/nemotron-3-ultra), injected system prompts on 5+ channels, a
    hidden meta-router (`auto`) — all excluded here.
  - **TokenBom** (`https://tokenbom.com/v1`): quota-resale marketplace;
    keyed gauntlet on the top-15 coding listings: 7 genuine channels here
    (incl. the two operator-approved Microsoft M365 Copilot channels),
    substitutions and no-supply listings excluded. Three protocol surfaces
    exist (OpenAI/Anthropic/Gemini) — the OpenAI surface is the documented
    default and the only one wired.
  - Both keys verified fail-closed keyless; keys held in `.env.local` under
    `HCNSEC_API_KEY` and `TOKENBOM_API_KEY` (canonicalized this session per
    operator permission; values never printed — Law 12).

## Detailed Description

### Problem

The operator wants both audited gateways selectable as providers. The
registry has no `hcnsec` or `tokenbom` entries: no routing prefixes, no
credential slots, no catalogs, no picker wiring.

### Expected Behavior

- `/provider hcnsec` and `/provider tokenbom` list in the picker, accept
  their keys (`HCNSEC_API_KEY`, `TOKENBOM_API_KEY`), persist, self-select.
- `/model` lists exactly the audited allowlist — 7 chat models per
  gateway (14 total), with friendly display names and context windows
  inferred by the shared heuristic. Everything the audits excluded stays
  excluded: `auto`, both `deepseek-v4-pro` listings, `longcat-2.0`,
  `spark-x2.5`, `gemini-3.1-pro`, `qwen3.8-max`, TokenBom `glm-5.3`, the
  dead 404 listings, and hcnsec's `Qwen3-Embedding-8B` (an embeddings
  model, not a chat surface).
- Chat round-trips POST `{baseUrl}/chat/completions` with the internal
  prefix stripped (`hcnsec/glm-5.3-flash` → `glm-5.3-flash`) and the key
  as Bearer.
- Missing key fails closed with the templated message naming the env var
  and the `/provider` hint.
- Trust posture is preserved: the registry entry carries the allowlist;
  it does NOT vouch for anything beyond it (see Trust Provenance).

### Root Cause

New providers; nothing existed to integrate.

### Evidence

- Audit report with the per-model evidence matrix:
  `docs/provider-identity-audit-2026-09-13.md` (§3 hcnsec, §5 TokenBom,
  §7.1 the confirmed allowlist this FID encodes).
- Registry precedent for static-catalog gateways: `tokenharbor`
  (`catalog: { source: 'static', modelsRef: 'tokenharbor' }`) and
  `commandcode` — neither has a wrapper file nor a manifest entry; both
  surface in `/model` through `cli/src/utils/openrouter-models/
  static-catalogs.ts` and the `fetchGatewayModels` merge.
- Live-catalog machinery (wrappers + `live-catalog` manifest exceptions) is
  required only for `catalog.source: 'live'` — deliberately not used here
  (Missed Question 1).
- Structural caps measured this session: `model-config/providers.ts` is at
  exactly 300 lines (the repo hard cap) — the new model maps need a new
  module; `static-catalogs.ts` (175) and `gateway.ts` (263) have headroom.

### Trust Provenance (deliberate, operator-approved)

Both gateways are **untrusted-context resellers** (anonymous/rotating
upstreams, no SLA, no Western accountability surface). Integration scope is
personal use under the operator's ruling — NOT a community-release default
and NOT a partnership. The static allowlist is the integration's core safety
property: the picker can only offer what the audit verified, and every
excluded listing (`auto`, both `deepseek-v4-pro`s, `longcat-2.0`,
`spark-x2.5`, `gemini-3.1-pro`, `qwen3.8-max`, TokenBom `glm-5.3`,
`gpt-5.6-luna`-sibling substitutions, all dead ids) stays excluded. This
provenance is recorded in registry comments and here, not enforced by code —
the code cannot verify supplier behavior, only refuse to advertise it.

## Impact Assessment

### Affected Components

- `common/src/constants/model-config/gateway-catalogs.ts` (NEW — the two
  model maps + types; keeps `model-config/providers.ts` at its 300-line cap)
- `common/src/constants/model-config.ts` (shim: re-export the two maps)
- `common/src/providers/model-catalogs.ts` (+2 typed refs)
- `common/src/providers/registry-partitioned.ts` (+2 entries — follows its
  documented "new gateways land here" pattern; registry.ts at 200 lines is
  untouched)
- `cli/src/utils/openrouter-models/static-catalogs.ts` (+2 name maps, +2
  fetch functions)
- `cli/src/utils/openrouter-models/gateway.ts` (+2 merge legs + header
  comment)
- `cli/src/utils/openrouter-models/__tests__/static-catalogs.test.ts`
  (+2 count/name suites)
- `common/src/providers/__tests__/provider-registry.test.ts` (closed-world
  lists widened 14→16 providers, 12→14 setup, order-4 family +2; entry
  contract pins)
- `sdk/src/impl/__tests__/model-provider-free-mode.test.ts` (+2 key-missing
  legs, +2 routing legs)
- `sdk/src/impl/__tests__/model-provider-free-mode-test-setup.ts` (+2 env
  save/restore, +2 model constants)
- `cli/src/utils/__tests__/provider-setup.test.ts` (+2 `saveProviderApiKey`
  contract legs)
- Regenerated docs: `.env.example` gateway section + `cli/release/README.md`
  provider table (`bun run generate:provider-docs`)

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium: additive integration, but the trust posture is unusual —
      untrusted gateways with per-supplier rotation behind an audited
      static allowlist. Mitigations: allowlist-only picker, fail-closed
      key handling, provenance recorded, live unknowns parked at Step 5.
- [ ] Low

## Proposed Solution

### Approach

Two registry entries in the partitioned file (TokenHarbor template,
static catalogs), one new constants module, picker derivation, additive
test legs, docs regen.

```ts
// common/src/providers/registry-partitioned.ts (appended entries)
hcnsec: {
  id: 'hcnsec',
  label: 'HCNSec',
  kind: 'gateway',
  credentials: {
    envVar: 'HCNSEC_API_KEY',
    missingKeyMessage:
      'HCNSec API key not set. Set HCNSEC_API_KEY environment variable or run /provider hcnsec.',
  },
  // api. subdomain is authoritative (apex host is the marketing site);
  // OpenAI surface only — the /v1/messages Anthropic shim is lossy
  // (audit T43-B: burns max_tokens on invisible reasoning).
  baseUrl: 'https://api.hcnsec.cn/v1',
  protocol: 'openai',
  idTransform: 'strip',
  // STATIC audited allowlist (identity audit T43-E): live /v1/models
  // re-exposes substituted + injected + dead listings the operator
  // rejected. Catalog = exactly the confirmed set.
  catalog: { source: 'static', modelsRef: 'hcnsec' },
  setupAvailable: true,
  domain: 'hcnsec.cn',
  order: 4,
},
tokenbom: {
  id: 'tokenbom',
  label: 'TokenBom',
  kind: 'gateway',
  credentials: {
    envVar: 'TOKENBOM_API_KEY',
    missingKeyMessage:
      'TokenBom API key not set. Set TOKENBOM_API_KEY environment variable or run /provider tokenbom.',
  },
  // Same host serves site + API (verified live); sk-sub- virtual keys are
  // Bearer-opaque (factory sends the stored value verbatim).
  baseUrl: 'https://tokenbom.com/v1',
  protocol: 'openai',
  idTransform: 'strip',
  // STATIC audited allowlist (identity gauntlet T44-C): marketplace
  // telemetry measures availability, NOT identity integrity — top-15
  // gauntlet found substitutions on flagship listings, so only verified
  // channels are cataloged. The two Microsoft M365 Copilot channels are
  // operator-approved (arbitrage provenance recorded).
  catalog: { source: 'static', modelsRef: 'tokenbom' },
  setupAvailable: true,
  domain: 'tokenbom.com',
  order: 4,
},
```

```ts
// common/src/constants/model-config/gateway-catalogs.ts (NEW module)
// Audited-allowlist model maps for the hcnsec + tokenbom gateways
// (FID-2026-0913-001). Ids are the UPSTREAM ids verbatim (case-exact —
// hcnsec serves mixed-case ids), prefixed with the internal routing
// prefix. Static by design: see registry comments.
export const hcnsecModels = {
  hcnsec_glm_5_3_flash: 'hcnsec/glm-5.3-flash',
  hcnsec_deepseek_v4_flash: 'hcnsec/DeepSeek-V4-Flash',
  hcnsec_deepseek_v4_flash_vision_exp:
    'hcnsec/deepseek-v4-flash-vision-exp',
  hcnsec_qwen_3_6_35b_a3b: 'hcnsec/Qwen3.6-35B-A3B',
  hcnsec_qwen_3_8_flash_next: 'hcnsec/Qwen3.8-Flash-Next',
  hcnsec_step_3_7_flash: 'hcnsec/step-3.7-flash',
  hcnsec_kimi_k3: 'hcnsec/kimi-k3',
} as const
export type HcnsecModel = (typeof hcnsecModels)[keyof typeof hcnsecModels]

export const tokenbomModels = {
  tokenbom_gpt_5_3_codex: 'tokenbom/gpt-5.3-codex',
  tokenbom_grok_4_6: 'tokenbom/grok-4.6',
  tokenbom_kimi_k3: 'tokenbom/kimi-k3',
  tokenbom_minimax_m3: 'tokenbom/minimax-m3',
  tokenbom_doubao_seed_2_1_pro: 'tokenbom/doubao-seed-2.1-pro',
  // Operator-approved M365 Copilot channels (audit T44-C): Microsoft
  // GPT lineage behind a subscription-arbitrage supplier; ~46 tokens of
  // hidden M365 system prompt ride every request.
  tokenbom_gpt_5_6_luna: 'tokenbom/gpt-5.6-luna',
  tokenbom_gpt_5_5: 'tokenbom/gpt-5.5',
} as const
export type TokenbomModel =
  (typeof tokenbomModels)[keyof typeof tokenbomModels]
```

Picker side (`cli/src/utils/openrouter-models/static-catalogs.ts`) gains
`HCNSEC_NAMES` / `TOKENBOM_NAMES` maps, `HCNSEC_CONTEXT_WINDOWS` /
`TOKENBOM_CONTEXT_WINDOWS` maps, and `fetchHcnsecModels()` /
`fetchTokenBomModels()`, merged in `gateway.ts` after `commandCodeModels`.
Context windows are PINNED PER MODEL (operator-ruled 2026-09-13: "simply
hit openrouter for the numbers") — not the family heuristic, which the
OpenRouter catalog (fetched 2026-09-13, `openrouter.ai/api/v1/models`)
proved wrong on 9 of 14 (kimi/minimax/deepseek all really ≥1M; the grok
family rule even overshoots — grok-4.6 is 500k, not 1M). Pinned values
(OR `context_length`, model's advertised max — NOT the per-supplier cap,
per the operator's "the rest use the real windows"):

| Model | Pinned ctx | OR source id | Note |
|---|---|---|---|
| `hcnsec/glm-5.3-flash` | 1,310,720 | `z-ai/glm-5.3-flash` | |
| `hcnsec/DeepSeek-V4-Flash` | 1,310,720 | `deepseek/deepseek-v4-flash` | |
| `hcnsec/deepseek-v4-flash-vision-exp` | 1,048,576 | `deepseek/deepseek-v4-flash-vision-exp` | |
| `hcnsec/Qwen3.6-35B-A3B` | 262,144 | `qwen/qwen3.6-35b-a3b` | |
| `hcnsec/Qwen3.8-Flash-Next` | 1,000,000 | `qwen/qwen3.8-flash` (nearest family) | NEEDS-REVIEW — hcnsec id is a self-deployed channel variant |
| `hcnsec/step-3.7-flash` | 262,144 | `stepfun/step-3.7-flash` | |
| `hcnsec/kimi-k3` | 1,048,576 | `moonshotai/kimi-k3` | |
| `tokenbom/gpt-5.3-codex` | 400,000 | `openai/gpt-5.3-codex` | |
| `tokenbom/grok-4.6` | 500,000 | `x-ai/grok-4.6` | |
| `tokenbom/kimi-k3` | 1,048,576 | `moonshotai/kimi-k3` | |
| `tokenbom/minimax-m3` | 1,048,576 | `minimax/minimax-m3` | OR top-provider cap is 524,288 — recorded in the map comment |
| `tokenbom/doubao-seed-2.1-pro` | 200,000 (conservative default) | — no OR listing | NEEDS-REVIEW — ByteDance Seed is not published on OpenRouter; honest default until a vendor number exists |
| `tokenbom/gpt-5.6-luna` | 1,050,000 | `openai/gpt-5.6-luna` | |
| `tokenbom/gpt-5.5` | 1,050,000 | `openai/gpt-5.5` | |

13 of 14 pinned from OpenRouter; 1 conservative default, flagged. The
shared `inferContextLength` heuristic is NOT modified (Missed Question
10); these maps take its place for these two catalogs only
(`inferContextLength` remains the fallback for any unmapped id).

### Steps

1. [x] **RED (implemented 2026-09-13):** 10 failing legs captured across
       4 files before GREEN — `provider-registry.test.ts` 3 fail (16-key
       closed world, 14-setup list, full-entry contract pins);
       `model-provider-free-mode.test.ts` 4 fail (2 key-missing + 2
       routing legs); `provider-setup.test.ts` 2 fail (save-contract
       legs); `static-catalogs.test.ts` module-absent import error (the
       two fetchers did not exist). Harness env save/restore for both new
       vars added. One self-caught defect fixed pre-run (stray `n`
       character in a comment line of the sdk pin — would have been a
       parse error).
2. [x] **GREEN (implemented 2026-09-13):** `hcnsec` + `tokenbom` entries
       in `registry-partitioned.ts` (194/300 lines); NEW
       `common/src/constants/model-config/gateway-catalogs.ts` (the two
       maps + types, with M365 provenance comment); shim re-exports;
       `MODEL_CATALOGS` +2 refs; picker `HCNSEC_NAMES`/
       `TOKENBOM_NAMES`/`HCNSEC_CONTEXT_WINDOWS`/`TOKENBOM_CONTEXT_WINDOWS`
       maps + `fetchHcnsecModels()`/`fetchTokenBomModels()`;
       `gateway.ts` merge + header; barrel export. GREEN run: 11/0, 12/0,
       6/0, 18/0 across the four pin suites.
3. [x] **VERIFY (runbook hard gates):** regression battery 59/0 (common
       providers, 6 files) + 35/0 (sdk free-mode family, 7 files) + 48/0
       (cli catalog family, 5 files); typecheck ×4 exit 0; eslint
       `--max-warnings 0` on all 12 touched files; prettier clean;
       `lint:md` PASS; file caps respected (largest touched file 298/300).
4. [x] **DOCS:** `generate:provider-docs` updated `.env.example` (both
       env vars, :99/:114) + release README provider table (:57/:63);
       `generate:provider-docs:check` exit 0.
5. [x] **LIVE (closure gate, keyed) — PASS 2026-09-13:** probe
       `dev/scratchpad/active/hcnsec-tokenbom-acceptance-probe.ts` (keys
       from `.env.local`, never printed — Law 12): catalog via the REAL
       production chain (`fetchGatewayModels(true)` → 1,378 combined
       models) surfaces `hcnsec` 7/7 + `tokenbom` 7/7 with pinned windows
       (`hcnsec/kimi-k3` 1,048,576; `tokenbom/gpt-5.6-luna` 1,050,000);
       keyed chat round-trips HTTP 200 on BOTH gateways
       (`hcnsec/glm-5.3-flash` → "OK", 17 prompt tokens — clean, no
       injected content on this channel, matching the audit;
       `tokenbom/gpt-5.5` → "OK", 11 prompt tokens). VERDICT
       hcnsec=PASS tokenbom=PASS.

### Verification

RED→GREEN per step; the receipt binds the gate results; Step 5's live
round-trip is the closure gate (OrcaRouter precedent: compilation alone is
not verification — a gateway must prove it serves chat through the wired
path).

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

- fingerprint: sha256:2cc759ff63bb8dd95b97356c265a3e77579428dfa46284e6c2e7c914bb511013
- verified: 2026-09-13T06:10:07.862Z
- typecheck common: exit 0
- typecheck sdk: exit 0
- typecheck packages/agent-runtime: exit 0
- typecheck cli: exit 0
- test common/src/providers/__tests__/provider-registry.test.ts: exit 0
- test sdk/src/impl/__tests__/model-provider-free-mode.test.ts: exit 0
- test cli/src/utils/openrouter-models/__tests__/static-catalogs.test.ts: exit 0
- test cli/src/utils/__tests__/provider-setup.test.ts: exit 0

## Perfection Loop

### Loop 1 — Authoring (2026-09-13, post-grounding)

- **RED:** no `hcnsec`/`tokenbom` surface exists. Closed-world assertions
  pin the current world: `provider-registry.test.ts` asserts exactly 14
  registry keys and 12 setup ids; `static-catalogs.test.ts` asserts
  TokenRouter's count; the SDK free-mode family asserts per-provider
  routing contracts. Widening these lists + adding the entry pins IS the
  RED surface. Live evidence is already in hand from the audits — the
  remaining unknowns are keyed round-trips through the WIRED path,
  parked for Step 5 (no PASS claimed without evidence).
- **GREEN (planned):** as in Proposed Solution; the plan's structural
  facts were verified this session (partition-file placement pattern;
  providers.ts at the exact 300-line cap → new module; static providers
  need no wrapper/manifest; aggregate `models` spread NOT extended —
  commandcode precedent).
- **AUDIT (planned):** the runbook hard-gate battery + Law 4 grep proof
  (routing edge via the generic factory loop; picker edge via
  static-catalogs + gateway merge; setup edge via deriveSetupConfig;
  prefix edge via ALLOWED_MODEL_PREFIXES derivation parity).
- **ADVERSARIAL (planned):** every citation re-resolved against the tree;
  no keyed PASS claimed before Step 5; trust provenance re-checked against
  the audit report so no marketing claim leaks into the registry.
- **CHANGE DELTA:** initial authoring (~0% — no prior document).

### Missed Questions

1. *Why static catalogs when both gateways expose `/v1/models`?* — The
   audits proved the live listings contain substituted models
   (`deepseek-v4-pro` on both gateways), injected channels (`auto`, the
   M365 signature, the phantom-tool harness), and dead 404 listings. A
   live fetch would re-advertise exactly what the operator rejected.
   Static is the only catalog that equals the audited set. Trade-off:
   new upstream models require a catalog edit (FID-scoped) — deliberate
   friction, documented in Trust Provenance.
2. *Are the Microsoft M365 Copilot channels eligible?* — Yes, by explicit
   operator ruling ("i think the microsoft ones are fine to like the luna
   one"). Included with provenance recorded in the catalog comment; the
   ~46-token hidden M365 system prompt is a known, accepted property.
3. *Why no audit-manifest entries?* — `requiredExceptionKinds` derives
   zero kinds for static-catalog/openai/strip/setup-available gateways;
   the manifest is live-catalog/resolver/protocol machinery. Structure and
   prefix invariants are still enforced by `validateProviderRegistry`.
4. *Does the hcnsec Anthropic shim get wired?* — No. The audit showed it
   lossy (empty text at 60 tokens; `max_tokens` burned on invisible
   reasoning). `protocol: 'openai'` only.
5. *Free-text `/model hcnsec/step-explore` (a dead id)?* — Routes (free-
   text exact ids always route to the active provider's gateway; the
   allowlist constrains the PICKER, not routing) and fails at the vendor
   with a 404 — fail-closed degradation at the boundary that knows the
   truth. Accepted; no client-side denylist.
6. *Routing-prefix collisions?* — None: `hcnsec/` and `tokenbom/` are
   disjoint from all 14 existing prefixes and the org slugs;
   `ALLOWED_MODEL_PREFIXES` derives them automatically (parity-pinned).
   Bare-slug routing semantics are unchanged.
7. *Supplier rotation making the audit stale?* — Honest yes: "confirmed"
   is a per-audit snapshot. The gauntlet scripts remain in the gitignored
   scratchpad as a cheap re-verification path; rotation is vendor
   behavior, not an integration defect, and Step 5 re-proves the wired
   path at closure.
8. *Why the partition file and not inline `registry.ts`?* — The partition
   module documents itself as the landing zone for later gateway entries
   (kiosapi/apinex/orcarouter/bai/opencode-zen live there); registry.ts's
   header pins `Object.keys` ordering semantics, which the spread
   preserves. No ordering or derivation change.
9. *Why `order: 4` for both?* — House convention: the order-4 family is
   the documented tier for later gateway additions (FID-2026-0911-003's
   per-provider family); picker groups sort alphabetically within the
   tie — no ordering surprise for existing groups.
10. *Why pin per-model context maps instead of fixing the shared
    `inferContextLength` heuristic?* — The heuristic is family-level and
    SHARED: TokenRouter/OpenCode Go display values would shift as
    collateral (out of scope, and their gateways may cap differently —
    TokenHarbor's 256k cap is the operator-cited example of a gateway
    cap being the honest number). Per-model maps are precise,
    gateway-scoped, and leave the heuristic untouched as fallback.
    Source + date are recorded above; a stale pin is a one-line edit,
    and Step 5's live smoke is the natural re-check point.

### Loop 2 — Independent audit and self-correction (2026-09-13)

- **RED:** one self-caught defect: the Expected Behavior section contained
  a garbled, self-contradictory sentence ("8 `hcnsec/…` entries are NOT
  included — 7 chat models each") — a composition artifact from the
  Missed-Question fold-back. Corrected to a clean allowlist statement.
- **GREEN:** no further corrections required.
- **AUDIT (fresh greps, this loop):** (1) closed-world lists confirmed —
  `provider-registry.test.ts` pins exactly 14 registry keys and 12 setup
  ids (both widened in Step 1); (2) `provider-audit.test.ts` has NO
  closed manifest list — `requiredExceptionKinds` (audit.ts) derives zero
  kinds for a static/openai/strip/setup-available gateway, so no manifest
  edit is needed (claim verified, Missed Question 3 stands); (3)
  `generate-provider-reference.ts` iterates registry entries'
  `credentials.envVar` directly (ENV markers at :30-31) — both env vars
  flow into `.env.example` with zero generator changes; (4) file-cap
  measurements re-confirmed: `model-config/providers.ts` = 300/300 (new
  module mandatory), `static-catalogs.ts` = 175, `gateway.ts` = 263; (5)
  audit report exists as cited
  (`docs/provider-identity-audit-2026-09-13.md`, this session).
- **ADVERSARIAL:** trust provenance re-checked against the operator
  rulings in SCOPE (T43-F skip ruling, T44-C personal-use ruling, and
  this session's reversal + Microsoft approval) — the FID claims no
  trust beyond the allowlist and claims no keyed PASS (Step 5 open).
  The allowlist matches the audit report's §7.1 table cell-for-cell.
- **CHANGE DELTA:** ~2% (one sentence corrected; all other claims
  verified unchanged).

### Loop 3 — Final convergence (2026-09-13, operator-prompted)

- **RED:** operator caught a real metadata defect: the planned context
  windows leaned on the family heuristic, and kimi/minimax really have
  ≥1M windows ("aren't those windows larger than 200k?"). Ground-truthed
  against the OpenRouter catalog (probed 2026-09-13, 445 models, evidence
  in `dev/scratchpad/active/or-models.json`): the heuristic is wrong on
  9 of 14 models (kimi-k3 1,048,576 vs 256k; minimax-m3 1,048,576 vs
  256k; deepseek-v4-flash 1,310,720 vs 131k; qwen3.6 262,144 vs 128k;
  glm-5.3-flash 1,310,720 vs 1M; step-3.7-flash 262,144 vs 200k default;
  gpt-5.5/luna 1,050,000 and gpt-5.3-codex 400,000 vs 256k) and
  OVERSHOOTS grok-4.6 (1M rule vs 500k real).
- **GREEN:** Approach amended — per-model pinned `CONTEXT_WINDOWS` maps
  (cli-side, beside the NAMES maps; TokenRouter-names precedent), 13/14
  OpenRouter-sourced with the source id per row, doubao conservatively
  defaulted + flagged, heuristic untouched as fallback. Missed Question
  10 added (why not fix the shared heuristic).
- **AUDIT:** pinned values re-checked against the probe output above,
  cell-for-cell. `static-catalogs.ts` headroom re-measured: 175 + ~60
  projected = ~235, under the 300 cap.
- **ADVERSARIAL:** gateway caps vs model maxima — the pinned numbers are
  the MODEL's advertised max; a reseller gateway may still cap lower
  (TokenHarbor-256k pattern). Accepted per operator ruling; overflow
  surfaces as a vendor 400, not silent truncation. The
  `Qwen3.8-Flash-Next` pin is a nearest-family inference and is flagged
  NEEDS-REVIEW rather than passed off as authoritative.
- **CHANGE DELTA:** ~8% (Approach table + MQ10 + this loop record).

### Loop 4 — Implementation (2026-09-13)

- **RED:** 10 failing legs captured across 4 files (3 common + 4 sdk +
  2 cli setup + 1 module-absent import) — see Step 1.
- **GREEN:** wiring as in Proposed Solution; GREEN caught two more
  self-inflicted composition defects, both fixed before any green run:
  (1) the shim edit initially duplicated the type re-exports with the
  wrong source module (rewritten cleanly via full-file write); (2) a
  pointless `modelsRefTokenbom()` indirection briefly appeared in
  `MODEL_CATALOGS` and was removed in favor of the direct reference.
- **AUDIT:** gates as in Step 3; Law 4 call-graph proof below.
- **ADVERSARIAL:** the allowlist in code matches the audit report §7.1
  cell-for-cell (7 hcnsec ids case-exact as served; 7 tokenbom ids); no
  keyed PASS was claimed before Step 5 ran; the M365 provenance comment
  ships in `gateway-catalogs.ts` so the trust record lives next to the
  data it governs.
- **CHANGE DELTA:** ~35% (Steps 1-5 evidence, Loop 4, Code Verification,
  Resolution — the Solution itself changed 0%).

### Code Verification Evidence

- **Files referenced in Affected Components exist:** all 12 verified in
  the tree (11 edited + 1 created); greps below.
- **Implementation matches the Proposed Solution:** yes — registry
  literals pinned by `provider-registry.test.ts` full-entry `toEqual`
  pins; catalogs pinned by `static-catalogs.test.ts` count + window +
  name pins.
- **Typecheck/tests/lint pass:** typecheck ×4 exit 0; 59/0 + 35/0 +
  48/0 regression battery; eslint 0 problems (12 files);
  `generate:provider-docs:check` exit 0; lint:md PASS.
- **Production call-graph evidence (grep, fresh):** routing —
  `hcnsec`/`tokenbom` entries consume the generic factory loop via
  `getModelForRequest` (pinned by the sdk routing tests asserting
  `https://api.hcnsec.cn/v1/chat/completions` + Bearer + stripped wire
  id, and the tokenbom equivalent); catalog — `fetchHcnsecModels` /
  `fetchTokenBomModels` called in `gateway.ts` allSettled-adjacent merge
  (the function `/model` invokes; proven live at Step 5: 7/7 + 7/7 in
  the 1,378-model combined catalog); setup — `deriveSetupConfig`
  derives both (pinned by the 14-id setup list + save-contract legs);
  prefix — `ALLOWED_MODEL_PREFIXES` parity pinned (16-key closed world).
- **FID status reflects the implementation state:** `fixed` — all five
  steps implemented and passing; keyed live acceptance PASSED (no
  NEEDS-REVIEW boundary on the integration itself; the model-level
  flags — doubao window, Qwen3.8-Flash-Next inference — are recorded in
  the catalogs and unchanged).

## Resolution

Implemented 2026-09-13 per operator approval: all five steps complete,
both gateways live-verified end-to-end (Step 5 PASS on both). Status
`fixed`; closure (archive + CHANGELOG) follows the operator commit (G2),
per the standing git rule. Trust provenance unchanged: personal-use
static allowlists; excluded listings stay excluded.

## Lessons Learned

- Static-catalog gateway onboarding is the cheapest integration class in
  the repo: no wrapper file, no manifest entry, no fetcher machinery —
  the entire delta is data (two maps, two entries) plus derivation.
  The runbook's "one entry" claim is exactly true for this class; the
  live-catalog wrapper caveat (FID-2026-0911-002) does not apply.
- The 300-line cap shapes architecture: a new module
  (`gateway-catalogs.ts`) was forced where a fourth map in
  `providers.ts` would have been the lazier path — and the split is the
  better structure anyway (audited-allowlist data is a distinct concern
  with its own provenance comments).
- Family-level context heuristics are convenient and wrong often enough
  to matter (9 of 14 here). When a vendor's catalog exposes no metadata,
  OpenRouter is a reliable authoritative mirror for underlying-model
  windows — but only for models it publishes (doubao has no listing;
  flag rather than fabricate).
