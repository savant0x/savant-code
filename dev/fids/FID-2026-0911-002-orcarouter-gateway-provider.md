# FID: OrcaRouter gateway provider integration

**Filename:** `FID-2026-0911-002-orcarouter-gateway-provider.md`
**ID:** FID-2026-0911-002
**Severity:** low
**Status:** fixed
**Created:** 2026-09-11 (operator directive: "i am interested in adding
support for https://www.orcarouter.ai/ as a provider")
**YAGNI-Compliance:** Verified — one registry entry per the one-entry
runbook (`docs/archive/design/Adding New Providers.md`) plus the house
pattern for live-catalog providers: a thin per-provider catalog wrapper
(`nous.ts`/`apinex.ts` template) around the SHARED fetcher, the gateway
merge + audit-manifest entry, and three Step-5 test legs. No new fetcher
machinery (the generic `live-catalog.ts` core is reused verbatim), no
resolver wire-in (catalog is keyless), no protocol map (OpenAI surface is
the documented default). Everything else derives.
**Related:** FID-2026-0809-001 (registry single source of truth);
FID-2026-0907-008 (APInex — the most recent gateway precedent, whose
Loop-2 re-grounding discipline this FID inherits); FID-2026-0906-008
(withdrawn gateway — keyed live acceptance remains the closure gate);
`docs/archive/design/Adding New Providers.md` (authoritative runbook)

---

## Summary

Add **OrcaRouter** (`orcarouter.ai`) as a built-in provider in
`PROVIDER_REGISTRY`: an OpenAI-compatible gateway at
`https://api.orcarouter.ai/v1` (one key, `sk-orca-…`, Bearer auth) serving
195 models across upstream vendors (OpenAI, Anthropic, Google, DeepSeek,
xAI, Qwen, Kimi, MiniMax, z-ai…) with vendor-prefixed ids
(`openai/gpt-5.5`, `anthropic/claude-opus-5`, `orcarouter/free`,
`orcarouter/fusion`…). The public model catalog is fetched keylessly by the
generic live-catalog fetcher; chat requests go to `/v1/chat/completions`
with the internal `orcarouter/` routing prefix stripped. The provider
surfaces in `/model` and `/provider` like every other gateway; a keyed live
acceptance (catalog via the production chain + chat round-trip) is the
closure gate.

## Environment

- **OS:** Windows 11 host (win32, Git Bash); Bun 1.3.14-pinned
- **Evidence gathered 2026-09-11 (this session, tool output):**
  - `https://docs.orcarouter.ai/introduction` (HTTP 200): "Point your
    existing OpenAI SDK at `https://api.orcarouter.ai/v1` and route
    requests across OpenAI, Anthropic, Google Gemini, DeepSeek, xAI Grok,
    Alibaba Qwen, Moonshot Kimi, MiniMax…". "Every request and response is
    in the OpenAI JSON shape." Also exposes Anthropic (`/v1/messages`) and
    Gemini surfaces natively.
  - `https://docs.orcarouter.ai/getting-started/get-api-key.md` (HTTP 200,
    markdown): keys issued from the dashboard, **prefix `sk-orca-`**, sent
    as `Authorization: Bearer sk-orca-…` — "works for every endpoint".
  - `https://api.orcarouter.ai/v1/models` **keyless probe → HTTP 200**,
    OpenAI shape `{"data":[{"id":…, "object":"model", …}]}` — **195
    models**, ids vendor-prefixed WITH slashes (`orcarouter/free`,
    `orcarouter/fusion`, `anthropic/claude-opus-5`,
    `deepseek/deepseek-v4-flash`, `google/gemini-2.5-flash`, …) — the same
    multi-slash shape OpenRouter and APInex serve. Several models carry
    `supported_endpoint_types: ["openai","openai-response","anthropic",
    "gemini"]` — multi-protocol at the model level, but the OpenAI surface
    is the default path the CLI uses.
  - `POST https://api.orcarouter.ai/v1/chat/completions` with `{}` and no
    key → **HTTP 401**, OpenAI-shaped error
    `{"error":{"message":"Invalid API key …","type":"orcarouter_api_error"}}`
    — the chat endpoint exists and fails closed on missing auth.
  - `common/src/providers/registry.ts` (11 providers, read 0-EOF),
    `docs/archive/design/Adding New Providers.md` (read 0-EOF),
    `dev/fids/archive/FID-2026-0907-008-apinex-gateway-provider.md` (read
    0-EOF — precedent).

## Detailed Description

### Problem

The operator wants OrcaRouter selectable as a provider. The registry has no
`orcarouter` entry, so no routing prefix, credential slot, catalog source,
or picker wiring exists. (A user could hand-roll it as a *custom* provider
via the FID-2026-0910-004 wizard — but a first-class built-in gives the
auto-derived `/provider` setup flow, the env-var credential slot, doc
generation, and registry-validated routing.)

### Expected Behavior

- `/provider orcarouter` lists the provider, accepts a key
  (`ORCAROUTER_API_KEY`), persists it, and self-selects.
- `/model` lists OrcaRouter models (internal ids `orcarouter/free`,
  `orcarouter/anthropic/claude-opus-5`, …) from the **public** live
  catalog — no key needed to browse.
- Chat round-trip sends `POST https://api.orcarouter.ai/v1/chat/
  completions` with the internal `orcarouter/` prefix stripped (sending
  `free`, `fusion`, or a bare vendor id like `anthropic/claude-opus-5`)
  and the key as Bearer.
- Missing key fails closed with the templated message naming the env var
  and the `/provider` hint.
- The new `/provider` picker add-new entry (FID-2026-0911-001) and the
  wizard grammar reservation (`add|edit|list|remove`) are unaffected —
  `orcarouter` collides with no grammar word.

### Root Cause

New provider; nothing existed to integrate.

### Evidence

- Docs: OpenAI-compatible by design; base URL
  `https://api.orcarouter.ai/v1`; Bearer auth; key prefix `sk-orca-`.
- Keyless `/v1/models` → 200 OpenAI-shaped, 195 models (pasted above) —
  the generic live-catalog fetcher consumes this verbatim; **no
  `resolveKey` wire-in needed** (unlike Nous/APInex, whose catalogs are
  authenticated).
- Keyless chat → 401 OpenAI-shaped (pasted) — endpoint exists, fails
  closed.
- Registry precedent for multi-slash vendor ids under `strip`:
  `apinex` (registry.ts) — "strip removes only the internal `apinex/`
  routing prefix; the multi-slash remainder goes verbatim".
- Runbook: live catalog + generic fetcher = registry URL only; tests are
  the three additive Step-5 files; docs are generated.

## Impact Assessment

### Affected Components

- `common/src/providers/registry.ts` (+16 lines — the `orcarouter` entry)
- `common/src/providers/__tests__/validate-provider-registry.test.ts`
  (fixture leg — the runbook's `acme` template)
- `sdk/src/impl/__tests__/model-provider-free-mode.test.ts` (key present →
  generic factory at `api.orcarouter.ai/v1` with Bearer; key missing →
  templated error)
- `cli/src/utils/__tests__/provider-setup.test.ts`
  (`saveProviderApiKey` contract)
- Regenerated docs (`bun run generate:provider-docs` — `.env.example`
  gateway section + release README provider table)
- `dev/quality-baseline.json` (measured bumps, if the ratchet trips)

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium: additive registry entry; the keyless catalog is proven, but
      the **keyed** chat path cannot be proven until the operator supplies
      a key — the FID-2026-0906-008 lesson (a gateway must prove it serves
      chat) keeps keyed live acceptance as the closure gate
- [ ] Low

## Proposed Solution

### Approach

One registry entry per the runbook's one-entry recipe (OpenAI-compatible
gateway, TokenHarbor/APInex template), with a **public** live catalog:

```ts
orcarouter: {
  id: 'orcarouter',
  label: 'OrcaRouter',
  kind: 'gateway',
  credentials: {
    envVar: 'ORCAROUTER_API_KEY',
    missingKeyMessage:
      'OrcaRouter API key not set. Set ORCAROUTER_API_KEY environment variable or run /provider orcarouter.',
  },
  // docs.orcarouter.ai/introduction: "Point your existing OpenAI SDK at
  // https://api.orcarouter.ai/v1". The docs' api. subdomain is
  // authoritative.
  baseUrl: 'https://api.orcarouter.ai/v1',
  protocol: 'openai',
  // Upstream ids are vendor-namespaced WITH slashes (anthropic/
  // claude-opus-5, deepseek/deepseek-v4-flash) plus orcarouter-native
  // routers (free, fusion, fusion-flash, fusion-mini). `strip` removes
  // only the internal `orcarouter/` routing prefix; the multi-slash
  // remainder goes verbatim — the same shape openrouter and apinex serve.
  idTransform: 'strip',
  // Keyless (probed 200 this session): the generic live-catalog fetcher
  // consumes it with no resolver wire-in — unlike nous/apinex.
  catalog: { source: 'live', url: 'https://api.orcarouter.ai/v1/models' },
  setupAvailable: true,
  domain: 'orcarouter.ai',
  order: 4,
}
```

### Steps

1. [x] **RED:** extend the runbook Step-5 tests for `orcarouter`:
       `provider-registry.test.ts` contract pin (12 legs, entry shape +
       documented literals), `model-provider-free-mode.test.ts` (key
       present → generic factory at `api.orcarouter.ai/v1` with Bearer;
       key missing → templated error), `provider-setup.test.ts`
       (`saveProviderApiKey` contract). All four RED legs captured failing
       (registry-contract + both SDK legs + setup leg) before GREEN.
       Harness env save/restore for `ORCAROUTER_API_KEY` added to the
       shared free-mode test setup.
2. [x] **GREEN:** registry entry + `orcarouter.ts` catalog wrapper
       (shared-fetcher reuse, uniform prefixing — see Loop 2 RED
       findings) + gateway merge + audit-manifest entry +
       `bun run generate:provider-docs` (`.env.example` gateway section
       + release README table regenerated; `--check` exit 0).
3. [x] **VERIFY (runbook hard gates):** typecheck × 4 (common, sdk,
       agent-runtime, cli) exit 0; targeted suites green (common 52/0,
       sdk free-mode 6/0, cli setup 15/0, cli catalog family 20/0 +
       parser pins 4/0); `generate:provider-docs:check` exit 0; eslint
       `--max-warnings 0`; prettier clean; `lint:md` PASS;
       quality-ratchet baseline bumps reconciled (22 measured, none from
       this FID's files); `validate:repository` at exact pre-existing-debt
       parity (8 hard-cap violations before and after — none in files
       this FID touches; tracked for a separate refactor FID).
4. [~] **LIVE (closure gate, keyed) — PARTIAL PASS 2026-09-12, one
       NEEDS-REVIEW boundary:** probe at
       `dev/scratchpad/active/orcarouter-acceptance-probe.ts` (key loaded
       from `.env.local`, never printed — Law 12). (a) **Catalog via the
       REAL production chain PASS:** `fetchGatewayModels(true)` → 1,314
       combined models, **195 `orcarouter/…` entries** (vendor-prefixed +
       double-prefixed routers 2/2 exactly as designed) via the same
       function `/model` invokes; (b) **Keyed chat round-trip → HTTP 429,
       key AUTHENTICATED but account-gated:** OpenAI-shaped
       `free_rate_limited` — "Free models are not available to this
       account yet. Link a GitHub account in your profile settings, or
       add credits" — the keyed request passes auth (keyless → 401) and
       reaches an ACCOUNT-level gate, proving endpoint reachability,
       OpenAI-shape parsing, and key validity; the HTTP-200 completion is
       blocked on operator account action (GitHub linkage or credits),
       NOT on integration code; (c) **Missing-key fail-closed PASS:**
       keyless chat → 401. The 200-round-trip remainder of this gate is
       NEEDS-REVIEW: a human must enable free-tier access on the
       OrcaRouter account and re-run the probe — per the Nous precedent,
       end-to-end inference is NOT claimed until then.

### Live Unknowns (keyless-unverifiable; resolved at Step 4)

1. **Keyed chat round-trip — PARTIALLY RESOLVED 2026-09-12.** The keyed
   probe proved: key validity (auth passed), endpoint reachability,
   OpenAI-shaped request/response parsing. Remaining: the HTTP-200
   completion itself — the account returns `free_rate_limited` ("link a
   GitHub account or add credits"). Integration-side work is complete;
   the residue is an operator account action, then re-run the probe
   (`bun dev/scratchpad/active/orcarouter-acceptance-probe.ts` with the
   key in `.env.local`). A paid model (`anthropic/claude-haiku-4.5`)
   would also clear the gate if the operator adds credits.
2. **Account-gate forensics (2026-09-12, second probe + paid diagnostic):**
   the free gate is NOT rate limiting — re-run returned the identical
   `err_free_access_denied` (`retryable: false`), and a paid-model call
   (`deepseek/deepseek-v4-flash`) returned HTTP 402
   `insufficient_user_quota` ("this request needs $0.0003") — i.e. zero
   credits AND no free entitlement on the account. OrcaRouter's X
   account confirms the policy: free-tier users must link a GitHub
   account **at least 30 days old**. **The dashboard exposes no
   GitHub-link control** (operator-checked 2026-09-12) — their error
   message is ahead of their UI. Support channels identified for the
   unlock request: Discord `discord.gg/yAh6Tex6kx`, X `@OrcaRouter`,
   GitHub org `Continuum-AI-Corp`. The operator declines the credits
   route on principle (the free tier IS the trial); the FID therefore
   rests at NEEDS-REVIEW until OrcaRouter ships the control or answers
   support. Integration-side work remains complete — this gate is not
   an integration defect.
3. **Post-unlock verification attempt (2026-09-12, ~02:31-02:38 UTC)** —
   the operator reports completing the GitHub linkage; the unlock is
   NOT yet effective on the API surface: all four free ids
   (`orcarouter/free`, `deepseek/deepseek-v4-flash-free`,
   `deepseek/deepseek-v4-pro-free`, `z-ai/glm-5.3-flash-free` — the
   latter newly appeared in the keyless catalog at 196 models) still
   return 429 `err_free_access_denied`; the paid model still returns
   402 `insufficient_user_quota`; the keyed `/v1/models` still returns
   200 with 196 models (the key itself remains valid). Findings: the
   entitlement likely propagates with delay, requires a page re-auth
   (token minted pre-linkage), or the linkage did not register — the
   operator is re-checking the console. **The probe is re-runnable at
   any time:** `bun dev/scratchpad/active/orcarouter-acceptance-probe.ts`
   (key in `.env.local`). NEEDS-REVIEW stands until a 200 completion
   lands.
4. **Re-probe (2026-09-12, 15:08 UTC, automation-level-3 sweep):**
   catalog via the production chain still PASS (1,364 combined, 195
   `orcarouter/…`, routers 2/2, no-key 401 fail-closed); keyed chat
   STILL 429 `err_free_access_denied` (`retryable: false`) — the
   vendor-side unlock has not landed. FID remains vendor-held; next
   probe on operator signal or vendor announcement.
2. **Auth-header edge** — Bearer is documented with a working contract;
   no alternate header documented, so no fallback is planned.
3. **Multi-protocol surface** — several catalog models advertise
   `anthropic`/`gemini` endpoint types. The CLI's `protocol: 'openai'`
   path is the documented default ("Every request and response is in the
   OpenAI JSON shape"); per-model protocol dispatch (an
   `openai-anthropic`/`multi` entry with a protocol map) is explicitly
   out of scope unless the OpenAI surface proves insufficient at Step 4.

### Missed Questions

1. *Does a vendor 429 account-gate count as integration failure?* —
   No: fail-closed behavior is the contract; a vendor-side entitlement
   gate is an account state, not an integration defect.
2. *What happens when the free tier unlocks?* — one probe re-run
   (catalog + keyed chat) closes Step 4; no code changes expected.
3. *Should the picker hide account-gated providers?* — Out of scope
   here; a future UX FID could surface vendor account state.

### Code Verification Evidence

Planning-stage FID: Steps 1-3 shipped (commit `6a1e5c2f` per Loop 1);
Step 4 probe artifact: catalog 195/195 via the production chain,
keyed chat 429 `err_free_access_denied` (re-probed 2026-09-12,
post vendor GitHub linkage). Live completion is operator-observable
only and remains NEEDS-REVIEW, honestly recorded above.

## Verification Gates

- gate: typecheck common
- gate: typecheck sdk
- gate: typecheck packages/agent-runtime
- gate: typecheck cli
- gate: test common/src/providers/__tests__/provider-registry.test.ts
- gate: test sdk/src/impl/__tests__/model-provider-free-mode.test.ts
- gate: test cli/src/utils/__tests__/provider-setup.test.ts
- gate: test cli/src/utils/__tests__/openrouter-models-orcarouter.test.ts

### Verification Receipt

- fingerprint: sha256:06bbd3491cefdb0a942f5518c315d3c8159e635933191036ec8f71342d6d90aa
- verified: 2026-09-12T17:35:58.381Z
- typecheck common: exit 0
- typecheck sdk: exit 0
- typecheck packages/agent-runtime: exit 0
- typecheck cli: exit 0
- test common/src/providers/__tests__/provider-registry.test.ts: exit 0
- test sdk/src/impl/__tests__/model-provider-free-mode.test.ts: exit 0
- test cli/src/utils/__tests__/provider-setup.test.ts: exit 0
- test cli/src/utils/__tests__/openrouter-models-orcarouter.test.ts: exit 0

## Resolution

Open at Steps 1-3 complete + Step 4 keyed live acceptance run:
catalog + fail-closed PASS, keyed chat authenticated but vendor
account-gated (429 `err_free_access_denied`, re-probed 2026-09-12).
Rests at `fixed`, vendor-held — one probe re-run closes it when the
vendor's free-tier unlock lands. Status is `fixed` (not `closed`) per
the Ground-Truth rule: keyed HTTP-200 completion has never passed.

## Perfection Loop

### Loop 1 — Authoring (2026-09-11, post-grounding)

- **RED:** no `orcarouter` surface exists; registry-derived unions,
  validation fixtures, and setup tests assert the closed 11-provider
  world. Live probes already ran (models 200 / chat 401, pasted) — the
  remaining unknowns are keyed-only and parked for Step 4.
- **Loop 2 mid-GREEN RED finding (wrapper requirement):** every built-in
  live-catalog provider also has a thin per-provider wrapper module in
  `cli/src/utils/openrouter-models/` (`nous.ts`, `apinex.ts`, `kiosapi.ts`,
  `nvidia.ts`): registry-derived URL, response parse, uniform prefixing,
  `createLiveCatalogFetcher` instantiation, gateway merge + cache-reset
  seam. `fetchGatewayModels` enumerates wrappers explicitly — a registry
  entry alone does NOT surface in `/model`. The initial plan's "no wrapper
  file" was wrong; the corrected plan adds `orcarouter.ts` (thin, reusing
  the shared fetcher core — not new machinery).
- **Loop 2 mid-GREEN RED finding (uniform prefixing is load-bearing):**
  OrcaRouter's upstream ids are MIXED: vendor models are vendor-prefixed
  (`anthropic/claude-opus-5`) while OrcaRouter's own routers already carry
  the prefix (`orcarouter/free`, `orcarouter/fusion`). The catalog parser
  must prefix uniformly (`orcarouter/` + upstream id, with
  already-prefixed passthrough so `orcarouter/free` stays single-prefixed
  — the nous.ts precedent). With `idTransform: 'strip'` (one-segment
  removal: `model.slice('orcarouter/'.length)`),
  `orcarouter/orcarouter/free` → upstream `orcarouter/free` and
  `orcarouter/anthropic/claude-opus-5` → upstream
  `anthropic/claude-opus-5` — the exact upstream id is recovered in both
  shapes. Passthrough-only prefixing would corrupt the routers: `strip`
  would send bare `free` — un-routable.
- **GREEN (initial):** one registry entry (TokenHarbor/APInex template,
  public live catalog), three additive Step-5 test legs, docs
  regeneration. Wrapper file `orcarouter.ts` added per the house pattern
  (thin, shared-fetcher reuse), no resolver wire-in (catalog is keyless),
  no protocol map (OpenAI surface is the
  documented default).
- **Grounding note (FID-2026-0907-008 Loop-2 discipline):** the base URL
  is the documented `api.` subdomain (`https://api.orcarouter.ai/v1`),
  not the apex host; the catalog architecture is the **generic** fetcher
  (no new per-provider file — Law 13); the gate surface is the runbook's
  three additive test files + hard-gate battery (not guessed).
- **CHANGE DELTA:** initial authoring.

### Loop 2 — GREEN + AUDIT + ADVERSARIAL (2026-09-11)

**GREEN self-caught defects (RED discipline, before first green run):**

1. **Missing catalog wrapper.** `fetchGatewayModels` enumerates
   per-provider wrappers explicitly (`gateway.ts`) — a registry entry
   alone never surfaces in `/model`. Added `orcarouter.ts` (thin wrapper:
   registry-derived URL via `deriveLiveCatalogUrl`, response parse,
   `createLiveCatalogFetcher` instantiation) + gateway merge via
   `Promise.allSettled` (failure degrades to `[]`, never masks built-ins)
   + `__resetOrcarouterCacheForTest` in the test-reset seam + barrel
   exports.
2. **Passthrough prefixing would corrupt router ids.** The apinex-style
   passthrough branch (`upstreamId.startsWith('orcarouter/') ?
   upstreamId : …`) is WRONG for OrcaRouter: its upstream ids are MIXED
   (vendor-prefixed `anthropic/claude-opus-5` AND already-prefixed
   routers `orcarouter/free`). A wire id must equal the upstream catalog
   id, and `strip` removes exactly one segment — so already-prefixed ids
   must be DOUBLE-prefixed internally (`orcarouter/orcarouter/free` →
   wire `orcarouter/free`). The parser prefixes uniformly; the RED
   parser pin caught the defect, then caught my pin's own unsorted
   expectation. The nous/apinex passthrough branches are inert (no
   upstream id carries those prefixes) — OrcaRouter is the first provider
   where the branch would fire. Uniform-prefix rationale documented in
   the wrapper + `provider-registry.test.ts` + parser pins.
3. **Audit-manifest entry.** `validateProviderAudit` requires an owned,
   evidenced `live-catalog` exception for every live-catalog provider —
   added the `orcarouter` entry to `provider-exception-manifest.ts`
   (owner: the wrapper; evidence: wrapper + gateway merge).
4. **Count-parity tests widened.** `provider-registry.test.ts`'s
   12-provider list + 10-setup list widened to 13/11 (the same closed-
   world assertions that caught APInex).

**AUDIT — Method 1 (static):** `bun x tsc --noEmit -p .` in common, sdk,
packages/agent-runtime, cli — all exit 0. eslint `--max-warnings 0` on
all 10 touched files — 0 problems. Prettier clean. `lint:md` PASS.
`generate:provider-docs:check` exit 0.

**AUDIT — Method 2 (runtime):** common providers 52 pass / 0 fail (352
expect()); sdk free-mode 6/0 (10 expect()); cli provider-setup 15/0 (49
expect()); cli catalog family (gateway + gateway-providers + orcarouter
parser pins) 20/0 (57 expect()). RED honestly captured first (4 failing
legs + module-absent parser pins).

**Law 4 call-graph proof (grep, fresh):** routing edge —
`getModelForRequest` consumes the registry entry via the generic factory
loop (no per-provider branches; pinned by the sdk free-mode routing test
asserting `https://api.orcarouter.ai/v1/chat/completions` + Bearer +
stripped wire id); catalog edge — `fetchOrcarouterModels` called in
`gateway.ts` `allSettled` (the function `/model` invokes); setup edge —
`deriveSetupConfig` derives `/provider orcarouter` (pinned by the cli
setup test); prefix edge — `ALLOWED_MODEL_PREFIXES` derivation parity
pinned in `validate-provider-registry.test.ts`.

**Quality-ratchet reconciliation:** 22 measured baseline bumps applied to
`dev/quality-baseline.json` — NONE in files this FID touches (all from
prior merged work: FID-2026-0910-004 Steps 4-10, FID-2026-0911-001,
agent-runtime growth). Hard-cap violations before vs after this FID's
changes: 8 → 8 (verified by stash-diff) — all pre-existing
(FID-2026-0910-004/0911-001 test and module growth);
`provider-registry.test.ts` and `gateway.ts` were pushed over 300 by
earlier sessions and compressed back under during this AUDIT. Scratchpad
hygiene: 3 root-clutter files moved to `dev/scratchpad/archive/` per the
validator's instruction. Remaining 8 hard-cap violations are a separate
refactor work item — flagged to the operator, not silently absorbed.

**ADVERSARIAL re-audit:** all citations resolved against the tree; the
keyed-only unknowns are honestly parked at Step 4 (no PASS claimed
without evidence); the `fixed` status (not `closed`) reflects the
pending keyed live acceptance. Verdict: clean — no findings.

**Circuit breaker:** 2 loops, convergent; no oscillation.

## Lessons Learned

- A public, OpenAI-shaped `/v1/models` makes a gateway integration
  near-trivial: the runbook's "one entry + docs regen" claim holds with
  zero glue code. The expensive part of gateway onboarding is never the
  registry entry — it is the keyed live acceptance.
- The runbook's "one entry" claim is exactly true for ROUTING but not
  for the PICKER: live-catalog providers need a thin wrapper module or
  they never surface in `/model` (`fetchGatewayModels` enumerates
  wrappers). The runbook should say "one entry + (live catalogs) one
  wrapper".
- Uniform prefixing beats passthrough when a provider's upstream ids
  already contain the provider prefix: the wire id must round-trip
  through the strip transform. A passthrough branch is only safe when
  no upstream id carries the routing prefix (true for nous/apinex,
  false for OrcaRouter). A parser contract pin caught this before it
  shipped.
