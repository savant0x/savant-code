# FID: B.AI credit gate — the five audited models are not free, and the key page disagrees with the API

**Filename:** `FID-2026-0919-026-bai-credit-gate-audit.md`
**ID:** FID-2026-0919-026
**Severity:** medium
**Status:** closed
**Created:** 2026-09-19 22:20
**Automation level:** 3
**YAGNI-Compliance:** Confirmed (no new capability built: the audit reuses the
existing production chain and the existing `/health` surface; the one optional
fix recorded below is a data-declared extension of that surface, not a new
subsystem)

---

## Summary

Operator directive (verbatim): *"we need to audit our provider
https://docs.b.ai/llmservice/introduction/, also test the key to ensure it's
fully functional for the free models deepseek-v4.1-flash, hy3, mimo-v2.5,
glm-5.3-flash, qwen3.8-flash, because when i actually use the endpoint, i get
'✕ Error credit insufficient balance: balance=0 required=3672 (request id: …)',
however looking at the /key page it shows 100% free usage?"*

**Audit result in one line:** the integration is correct and the key is valid —
all five models are catalogued, routed and authenticated exactly as designed, and
every one of them is refused by the vendor with `400 insufficient_user_quota`
because the **account balance is 0**. The five models are **not free**; the key
page's free-usage meter is not the gate the API applies.

**Root cause of the mismatch:** B.AI is a **prepaid** platform. Its own
documented quota endpoint (`GET /v1/balance`) reports `personal_balance: 0` for
both keys in this repository, which are the *same account*. The `required` figure
in the error scales with the request — the failing request the operator saw needed
**3672 Credits = $0.003672**, i.e. under four-tenths of a cent against a balance
of exactly zero.

## Environment

- **OS:** Windows (win32), bash shell
- **Language/Runtime:** TypeScript (strict), Bun 1.3.14
- **Commit/State:** `main`; the 0.0.33 working tree; nothing committed (G2 withheld)
- **Live target:** `https://api.b.ai/v1` (key material never printed; identified by
  sha256 prefix only — Law 12)

## Detailed Description

### Problem

The operator cannot tell an integration defect from an account-state refusal. The
vendor's web key page reports 100% free usage while every live request fails with
`credit insufficient balance: balance=0 required=N`.

### Expected Behavior

An audited provider is described accurately (already true: the registry and docs
call B.AI an OpenAI-compatible gateway with an authenticated live catalog — no
free-tier claim appears anywhere in the repository), a live failure is attributable
to a specific layer, and the vendor's authoritative account state is reachable
without leaving the tool.

### Root Cause

Not integration state. **Account state, on a prepaid platform whose promotional
"free" allowance is separate from the balance the gateway checks.**

### Evidence

**1. Both documented auth headers authenticate (nothing is wrong with the key).**

```text
[balance]  HTTP 200 — {"data":{"user_id":"user_P2SuQ53ei5CZ","api_key_type":"personal",
           "personal_balance":0,"active_status":"active"},"message":"","success":true}
[models]   HTTP 200 — 47 ids
[x-api-key] POST /chat/completions → 400 insufficient_user_quota (identical to Bearer)
```

Both keys in the working tree (`.env.local`, `cli/.env.local`, sha256 prefixes
`412b80eb` / `ab771f80`) resolve to the **same account** (`user_P2SuQ53ei5CZ`) with
`personal_balance: 0` and `active_status: active`.

**2. The five models exist and are routed correctly through the production chain.**

Production catalog fetcher (`cli/src/utils/openrouter-models/bai.ts`, live):

```text
internal ids: 47
  bai/deepseek-v4.1-flash → present
  bai/hy3                 → present
  bai/mimo-v2.5           → present
  bai/glm-5.3-flash       → present
  bai/qwen3.8-flash       → present
```

Production wire request, observed on the exact SDK seam
(`getModelForRequest` → AI SDK transport) for all five models:

```text
[bai/deepseek-v4.1-flash] WIRE https://api.b.ai/v1/chat/completions model=deepseek-v4.1-flash auth=Bearer <present>
[bai/hy3]                 WIRE https://api.b.ai/v1/chat/completions model=hy3                 auth=Bearer <present>
[bai/mimo-v2.5]           WIRE https://api.b.ai/v1/chat/completions model=mimo-v2.5           auth=Bearer <present>
[bai/glm-5.3-flash]       WIRE https://api.b.ai/v1/chat/completions model=glm-5.3-flash       auth=Bearer <present>
[bai/qwen3.8-flash]       WIRE https://api.b.ai/v1/chat/completions model=qwen3.8-flash       auth=Bearer <present>
```

Base URL, `strip` transform, and bearer auth are exactly per the vendor contract.

**3. Every model is refused by the same gate, and `required` scales with the request.**

| Model | Raw probe (8 max_tokens) | Production-chain request | Vendor code |
| --- | --- | --- | --- |
| `deepseek-v4.1-flash` | required 2 | required 122 | `insufficient_user_quota` |
| `hy3` | required 106 | required 106 | `insufficient_user_quota` |
| `mimo-v2.5` | required 58 | required 58 | `insufficient_user_quota` |
| `glm-5.3-flash` | required 102 | required 102 | `insufficient_user_quota` |
| `qwen3.8-flash` | required 96 | required 96 | `insufficient_user_quota` |

All with `balance=0`. The operator's `required=3672` is the same arithmetic at
coding-request size: **Credits settle at 1 USD = 1,000,000 Credits**, so 3672
Credits ≈ **$0.0037**.

**4. Vendor documentation — the platform is prepaid and nothing on the model list
is free.**

- `docs.b.ai/llmservice/pricing-and-usage/`: *"The platform uses a prepaid model,
  so you need to top up your account to obtain Credits."* and *"B.AI bills accounts
  in Credits at 1 USD = 1,000,000 Credits."*
- The five models are the **cheapest tier**, not free: DeepSeek-V4.1-Flash
  $0.15/$0.60 (idle, per 1M in/out), Qwen3.8-Flash $0.16/$0.47, GLM-5.3-Flash
  $0.15/$0.50, MiMo-V2.5 $0.14/$0.28, Hy3 $0.132/$0.528.
- The only *free* concept documented is **free bonus Credits** (new-user
  registration, top-up promotions): *"Free bonus Credits are valid for 30 days from
  the date they are issued … Any unused portion automatically expires."* The
  pricing page adds that bonus Credits and account benefits are *"subject to the
  platform display and final billing records."*
- `docs.b.ai/llmservice/introduction/` describes no free tier at all: credits,
  top-up, subscriptions. Its only entitlements are Plan Pro ($200/mo) and Plan Max
  ($2,000/mo).
- `GET /v1/balance` is documented as *"Retrieve balance and quota information for
  the current API Key"* — it is the authoritative answer, and it says 0.

**5. Corroboration from this repository's own history.** FID-2026-0911-004
(2026-09-11) recorded the same key reaching **HTTP 200 `pong` on
`bai/qwen3.8-flash`** while `glm-5.3-flash` already returned
`400 insufficient_user_quota` (balance=0). So an entitled allowance covered part
of the catalog on 2026-09-11 and is gone now — consistent with a promotional
credit window that has since expired or been consumed. The account never had a
non-zero paid balance.

### Conclusion

| Layer | Verdict |
| --- | --- |
| Credential | **Valid** — 200 on `/balance` and `/models`, both auth modes |
| Base URL / protocol / `strip` transform | **Correct** — production wire observed |
| Catalog | **Correct** — 47 ids, all five targets present by exact id |
| Model ids the operator named | **Real** — each exists upstream verbatim |
| Vendor gate | **Refusal: `insufficient_user_quota`, `personal_balance: 0`** |
| "Free models" premise | **Not supported by the vendor's docs** — cheapest tier, prepaid |

**The unblock is vendor-side, not code-side:** make the account balance non-zero
(top-up, or an unexpired bonus/subscription allowance). At 1 USD = 1,000,000
Credits, a $5 top-up is ~5,000,000 Credits against a ~3672-Credit coding request.

## Impact Assessment

### Affected Components

- **None silently broken.** No code change is required for the operator's report.
- **Diagnostics gap (this repository, now fixed on the operator's ruling):** the
  vendor's documented quota endpoint was unused, so account-state refusals were
  only diagnosable by leaving the tool. Now: `common/src/providers/types.ts`
  (`quota?`), `common/src/providers/registry-partitioned.ts` (the B.AI
  declaration), `cli/src/utils/provider-quota.ts` (the bounded reader),
  `cli/src/commands/health-command.ts` (the report line),
  `cli/src/hooks/helpers/send-message/fallback-hints.ts` (`quotaHint`) and
  `cli/src/hooks/helpers/send-message/run-results.ts` (both failure paths).
- **Vendor-side diagnostics gaps (recorded, not ours to fix):** the 429 response
  carries an **empty body** and no `retry-after`; only the balance error carries a
  request id.

### Risk Level

**Medium.** Mis-attributed as an integration failure, it burns operator time; the
provider is otherwise healthy and correctly integrated.

## Proposed Solution

### Approach

Record the audit as the deliverable (done), and surface the vendor's own
authoritative quota reading for providers that document one, so this class of
refusal is self-diagnosing.

### Steps

1. [x] `analyzed` — audit the vendor docs (introduction, API reference, pricing and
   usage) and the live surfaces (`/balance`, `/models`, `/chat/completions` on both
   documented auth headers) from a probe that never prints key material.
2. [x] `analyzed` — prove the production chain for all five models on the real SDK
   seam and confirm catalog/id mapping.
3. [x] `analyzed` — identify the mismatch mechanism and its vendor-doc basis, with
   the historical corroboration from FID-2026-0911-004.
4. [x] `implemented` — **operator ruled: BOTH surfaces** (level 1 → authorised).
   (a) A data-only `quota?: { url; valuePath; unit?; note }` on `ProviderConfig`
   (mirroring `catalog`), declared for `bai` with `https://api.b.ai/v1/balance`
   and `valuePath: 'data.personal_balance'`; `cli/src/utils/provider-quota.ts`
   reads it (bounded 5s, never throws, never returns key material) and
   `handleHealthCommand` renders one line for the **active** provider:
   `**Quota:** 0 credits — B.AI is prepaid (1 USD = 1,000,000 credits); …`.
   (b) `quotaHint` in the existing send-message hint seam (`fallback-hints.ts`,
   the FID-2026-0915-001 W5 pattern) appends the provider's declared note to a
   quota-class refusal and points at `/health`; it resolves the provider from
   `DIRECT_PROVIDER` or the model id's routing prefix, never fetches, and stays
   silent when no provider declares a note.

### Verification

- Live evidence recorded above (13 vendor responses across three surfaces, two
  auth modes, five models, two keys).
- Probes: `dev/scratchpad/active/bai-free-quota-audit.ts` (quota/auth/catalog) and
  `dev/scratchpad/active/bai-chain-proof.ts` (production chain + wire shape).
  Both are gitignored working copies — the outputs above are the record.
- Implementation pins: 6 for the reader, 4 for the refusal hint, 3 for the
  `/health` line, and 2 registry contract pins (the declared endpoint and the
  "only where documented" rule) — 15 new pins, all green.

## Verification Gates

- gate: typecheck cli
- gate: typecheck common
- gate: test cli/src/utils/__tests__/provider-quota.test.ts
- gate: test cli/src/hooks/helpers/__tests__/fallback-hints.test.ts
- gate: test cli/src/commands/__tests__/health-provider-quota.test.ts
- gate: test common/src/providers/__tests__/provider-contract-pins.test.ts
- gate: probe scripts/scope-register-check.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:5a85c231b6c0cfcd627fa5030e1bc560fa66ff6f4d957a599c2e266612bca0d6
- verified: 2026-09-19T20:14:54.736Z
- typecheck cli: exit 0
- typecheck common: exit 0
- test cli/src/utils/__tests__/provider-quota.test.ts: exit 0
- test cli/src/hooks/helpers/__tests__/fallback-hints.test.ts: exit 0
- test cli/src/commands/__tests__/health-provider-quota.test.ts: exit 0
- test common/src/providers/__tests__/provider-contract-pins.test.ts: exit 0
- probe scripts/scope-register-check.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** The operator's premise ("free models") and the vendor's own numbers were
  tested against each other instead of assumed. The premise failed: the pricing
  page lists all five at non-zero prices and the introduction has no free tier.
  The key page's meter and the API gate were then separated by asking the API
  directly (`/balance`).
- **GREEN:** No code change is warranted for the report itself; the finding that
  *is* actionable in this repository is the diagnostics gap.

### Missed Questions

- *Is the error a rendering defect?* — No. `user-error-banner.tsx` renders
  `✕ ` + title + a separate detail line; the pasted text collapsed the newline. The
  vendor's message reaches the operator intact.
- *Is one key stale?* — No. Both keys authenticate and resolve to the same account.
- *Could the failure be a rate limit?* — No. 429s were observed and are transient
  (my own probe volume); they are a different, body-less response. The five models
  fail with the balance gate, not with 429.
- *Does `required` indicate a per-request minimum we violate?* — No. It scales with
  prompt + max_tokens (2 for a minimal probe, 122 for the SDK's coding-shaped
  request, 3672 for the operator's); the account simply cannot cover any of them.
- *Should B.AI be removed from the registry as unusable?* — No. Nothing is broken;
  the account is unfunded. Entitlement is account state, not integration state —
  the same ruling FID-2026-0911-004 recorded for this provider.
- *Does the repository claim anything false about B.AI?* — No. It is described as an
  OpenAI-compatible gateway with an authenticated live catalog in all four doc
  surfaces; no free-tier claim exists anywhere.

### Implementation Evidence (REQUIRED for `closed`)

- **Audit (the record itself):** `dev/scratchpad/active/bai-free-quota-audit.ts`
  and `bai-chain-proof.ts` (gitignored) plus the live outputs transcribed above.
- **Fix, shipped:** `common/src/providers/types.ts` (`quota?` on `ProviderConfig`),
  `common/src/providers/registry-partitioned.ts` (declared for `bai`),
  `cli/src/utils/provider-quota.ts` (reader + formatter),
  `cli/src/commands/health-command.ts` (the `**Quota:**` line),
  `cli/src/hooks/helpers/send-message/fallback-hints.ts` (`quotaHint`),
  `cli/src/hooks/helpers/send-message/run-results.ts` (both failure paths).
- **Files re-verified as correct (no change needed):**
  `cli/src/utils/openrouter-models/bai.ts` (catalog + uniform prefix),
  `sdk/src/impl/model-provider/model-factories.ts` (`applyIdTransform` strip).
- **Law 4 (reachability):** `quotaHint` is called from both `handleRunCompletion`
  and `handleRunError` terminal branches in `run-results.ts`; `readProviderQuota`
  is called from `handleHealthCommand`; both are exercised end-to-end by the new
  suites (which observe the fetch URL and the rendered report line).

### Code Verification Evidence

- Production catalog through the real fetcher: 47 internal ids, five targets
  present.
- Production wire request through `getModelForRequest` + AI SDK transport: correct
  URL, correct stripped model id, bearer present, for all five.
- Both documented auth headers: identical `insufficient_user_quota` refusal.

### Loop 2 — Independent audit and self-correction

- **AUDIT finding (self-corrected):** the registry entry pushed
  `common/src/providers/registry-partitioned.ts` to **303 lines** against the
  absolute 300 ceiling — `quality:report` and `validate:repository` both failed.
  The inline citation was condensed to three lines where the type already carries
  the explanation; the file is back at 300 with `quality: PASS`.
- **AUDIT finding (self-corrected):** the new registry pin read `.quota` off the
  `PROVIDER_REGISTRY` union, where only one entry declares it — `tsc` rejected the
  property access. The iteration is now typed as `Record<string, ProviderConfig>`,
  which is also the honest way to ask "which providers declare one".
- **AUDIT finding (self-corrected):** three stubs in the new test files did not
  satisfy `typeof fetch` (missing `preconnect`) and one used `let` bindings that
  TypeScript narrows to `null` across an async closure — the cli typecheck gate
  caught all four. Fixed with the repo's `as unknown as typeof fetch` idiom and
  array capture; the suite still asserts the exact headers sent.
- **AUDIT finding (verified, no change needed):** the health report's existing
  comment ("a network probe per built-in would be new surface without new info")
  was re-read rather than ignored — a `/models` probe would indeed add nothing,
  while the quota reading adds the one fact the operator lacked. The new line is
  documented as that distinction at its call site.

### Loop 3 — Final convergence

- All declared gates re-run live after the final edit; the receipt is stamped from
  that run. The two gate failures Loop 2 found were both mechanical and are pinned
  by the gates that caught them (ceiling, typecheck).

## Resolution

- **Closed Date:** 2026-09-19 23:40 UTC (closed with the commit SHA pending
  operator git execution, G2 withheld; file:line + grep evidence recorded
  instead, per the FID Lifecycle rule for `closed`)
- **Fix Description:** The audit (no code change was warranted for the operator's
  report — the integration is correct and the failure is account state) plus the
  operator-ruled diagnostic fix (**both** surfaces). (a) A data-only
  `quota?: { url; valuePath; unit?; note }` on `ProviderConfig`, mirroring
  `catalog`, declared for `bai` against its documented `GET /v1/balance`;
  `cli/src/utils/provider-quota.ts` reads it (bounded 5s, never throws, never
  returns key material) and `handleHealthCommand` renders one `**Quota:**` line for
  the active provider. (b) `quotaHint` in the existing send-message hint seam
  appends the provider's declared note to a quota-class refusal and points at
  `/health`, resolving the provider from `DIRECT_PROVIDER` or the model id's
  routing prefix, never fetching, and staying silent when no provider declares a
  note. A registry pin enforces that only providers documenting such an endpoint
  declare one.
- **Tests Added:** Yes — 15 pins: 6 for the reader
  (`cli/src/utils/__tests__/provider-quota.test.ts`), 4 for the refusal hint
  (`cli/src/hooks/helpers/__tests__/fallback-hints.test.ts`), 3 for the health
  report line (`cli/src/commands/__tests__/health-provider-quota.test.ts`), and 2
  registry contract pins
  (`common/src/providers/__tests__/provider-contract-pins.test.ts`). The last of
  those asserts the declaration set contains `bai` only, so the field cannot be
  invented for an undocumented endpoint.
- **Verification Evidence:** receipt below (eight gates, live); the audit's live
  outputs transcribed in Details — 13 vendor responses across `/balance`,
  `/models` and `/chat/completions`, both documented auth modes, both keys, and
  all five models driven through the production SDK seam with the observed wire
  URL and stripped model id. `quality` flagged the registry entry at 303 lines
  mid-pass against the 300 ceiling and it was condensed back to 300.
- **Archived:** 2026-09-19 23:40 UTC — moved to `dev/fids/archive/`; receipt
  re-stamped live at the archived path (8/8 gates)

## Lessons Learned

- **A vendor display is not a gate.** The key page's meter and the API's balance
  check are different systems; when they disagree, the documented endpoint that
  reads the same state the request path uses is the only authority.
- **Price is not free-dom.** "Cheapest tier" and "free tier" look identical in a
  model list until the gate refuses; the pricing page's per-token numbers settle it
  in one read.
- **Corroborate with your own history.** This repository had already recorded the
  same key succeeding on `qwen3.8-flash` on 2026-09-11 — which is what makes
  "a promotional allowance expired" the supported reading rather than a guess.
- **A pass-through error can still be unactionable.** The vendor message was
  delivered intact; what was missing was the *reading* of it, in the tool the
  operator was already using.
- **Declare vendor contracts as data, not as special cases.** The quota endpoint
  lives on the registry entry, so the health surface and the error hint both read
  one declaration and no provider id appears in either code path — a provider that
  documents its own balance endpoint needs no code.
- **The boundary belongs in the type doc, not the entry.** Six lines of inline
  citation pushed a 300-line-ceiling file to 303; the explanation had already
  earned its place on the `quota` field.
