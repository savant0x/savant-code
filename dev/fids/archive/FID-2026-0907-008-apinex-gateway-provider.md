# FID: APInex gateway provider integration

**Filename:** `FID-2026-0907-008-apinex-gateway-provider.md`
**ID:** FID-2026-0907-008
**Severity:** low
**Status:** closed
**Created:** 2026-09-07
**YAGNI-Compliance:** Verified
**Requested by:** Spencer (2026-09-07, "i am interested in adding this
provider https://apinex.bond/models")
**Related:** FID-2026-0809-001 (provider registry single source of truth);
`docs/archive/design/Adding New Providers.md` (the one-entry runbook —
authoritative implementation procedure); FID-2026-0906-008 (gateway
precedent — WITHDRAWN after live keyed testing; this FID inherits its
keyed live-acceptance closure gate)

---

## Summary

Add **APInex** (`apinex.bond`) as a 12th provider in `PROVIDER_REGISTRY`
(post-withdrawal count — the 2026-09-07 TabiToken/GoRouter/VyceAI removal
left 11; ground-truthed by grep of the registry keys, 2026-09-07 audit):
an OpenAI-compatible gateway at `https://api.apinex.bond/v1` with an
authenticated live model catalog, mirroring the Nous Research live-catalog
pattern (registry entry + `resolveKey` wiring — **no per-provider fetcher
file**). The provider surfaces in `/model` and `/provider` like every other
gateway; a keyed live acceptance (catalog listing + chat round-trip) is the
closure gate.

## Environment

- **OS:** Windows 11 host (win32, Git Bash); Bun 1.3.14-pinned
- **Evidence gathered 2026-09-07 (this session, tool output pasted):**
  - `https://apinex.bond/llms.txt` (HTTP 200, "Last updated: 2026-09-07")
    — the machine-readable contract. Base URL `https://api.apinex.bond/v1`
    ("drop-in replacement for an OpenAI base URL"); auth
    `Authorization: Bearer <key>` or `x-api-key`, key prefix `sk-apx`;
    endpoints `GET /v1/models` (auth required), `POST /v1/chat/completions`,
    `POST /v1/messages` (Anthropic), `POST /v1/responses`, `GET /v1/balance`.
    ~21 models across vendor namespaces (`free/…`, `gpt/…`, `grok/…`,
    `claude/…`, `gemini/…`, `deepseek/…`, `glm/…`, `kimi/…`), with a curl
    example using `"model":"gpt/5.6-luna"`.
  - `POST https://apinex.bond/v1/chat/completions` with `{}` and no key →
    OpenAI-shaped `authentication_error` — the chat endpoint exists and
    fails closed on missing auth (pasted in session).
  - `https://apinex.bond/api/public/models` → custom shape
    `{"models":[{id, provider, name, contextWindow, weight, dollarsPer1M,
    tags, health}]}` with `health: "live" | "partial"` — a pricing/health
    table, NOT OpenAI-shaped, therefore not directly consumable by the
    generic live-catalog fetcher (pasted in session).
  - `https://api.apinex.bond/v1/models` (no key) → the same OpenAI-shaped
    auth error — the documented API host responds.
  - `common/src/providers/registry.ts` (237 lines),
    `common/src/providers/types.ts` (101 lines),
    `docs/archive/design/Adding New Providers.md`,
    `dev/echo-v0.1.2-single-agent.md` — all read 0-EOF this session.

## Detailed Description

### Problem

The user wants APInex selectable as a provider. The registry has no
`apinex` entry, so no routing prefix, credential slot, catalog source, or
picker wiring exists.

### Expected Behavior

- `/provider apinex` lists the provider, accepts a key (`APINEX_API_KEY`),
  persists it, and self-selects.
- `/model` lists APInex models (internal ids `apinex/gpt/5.6-luna`, …)
  from the live catalog.
- Chat round-trip sends `POST https://api.apinex.bond/v1/chat/completions`
  with the internal `apinex/` prefix stripped (sending `gpt/5.6-luna`) and
  the key as Bearer.
- Missing key fails closed with the canonical message naming the env var
  and the `/provider` hint.

### Root Cause

New provider; nothing existed to integrate.

### Evidence

- `llms.txt` contract (quoted above; endpoint list + example curl)
- Registry precedent for an **authenticated live catalog**:
  `nous` entry (registry.ts:135-153) — `catalog.source: 'live'` +
  provider-specific `resolveKey` per the runbook ("If the catalog endpoint
  is authenticated, wire a provider-specific resolver such as Nous's
  `resolveKey`; never read `.env.local` directly from a catalog wrapper")
- Multi-slash model ids are proven end-to-end by `openrouter`
  (`openrouter/vendor/model`, `idTransform: 'keep'`); `strip` removes only
  the first `apinex/` segment, so `apinex/gpt/5.6-luna` → `gpt/5.6-luna`

## Impact Assessment

### Affected Components

- `common/src/providers/registry.ts` (+15 lines — the `apinex` entry)
- Live-catalog key wiring for the authenticated `/v1/models` fetch
  (the Nous `resolveKey` mechanism — one small registration, not a new
  fetcher file; exact insertion point confirmed at implementation)
- `validate-provider-registry.test.ts` fixture + the runbook's Step-5
  test files (sdk free-mode routing, provider-setup key persistence)
- Regenerated provider docs (`bun run generate:provider-docs`)
- `dev/quality-baseline.json` (measured bumps for grown files)

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium: additive registry entry; three live unknowns remain
      keyless (below) and the FID-2026-0906-008 lesson is that static
      gates do not prove a gateway serves chat
- [ ] Low

## Proposed Solution

### Approach

One registry entry per the runbook's "one-entry recipe" (OpenAI-compatible
gateway, TokenHarbor/Nous template), plus the authenticated-catalog key
resolver:

```ts
apinex: {
  id: 'apinex',
  label: 'APInex',
  kind: 'gateway',
  credentials: {
    envVar: 'APINEX_API_KEY',
    missingKeyMessage:
      'APInex API key not set. Set APINEX_API_KEY environment variable or run /provider apinex.',
  },
  // llms.txt: "Base URL: https://api.apinex.bond/v1 — drop-in replacement
  // for an OpenAI base URL." The docs' api. subdomain is authoritative
  // even though the apex host also answers (both probed this session).
  baseUrl: 'https://api.apinex.bond/v1',
  protocol: 'openai',
  // Upstream ids are vendor-namespaced WITH slashes (gpt/5.6-luna,
  // free/glm-5.3-flash). `strip` removes only the internal `apinex/`
  // routing prefix; the multi-slash remainder goes verbatim — the same
  // shape openrouter already serves.
  idTransform: 'strip',
  catalog: {
    source: 'live',
    // Authenticated (llms.txt: "list models (auth required)"); the public
    // /api/public/models table is custom-shaped and unusable by the
    // generic fetcher. Key via the Nous-style resolveKey mechanism.
    url: 'https://api.apinex.bond/v1/models',
  },
  setupAvailable: true,
  domain: 'apinex.bond',
  order: 4,
}
```

### Steps

1. [x] **RED:** extend the runbook Step-5 tests for `apinex`:
       `validate-provider-registry.test.ts` fixture (routing, setup,
       picker grouping, guidance derive from the entry alone),
       `sdk/src/impl/__tests__/model-provider-free-mode.test.ts`
       (key present → generic factory at `api.apinex.bond/v1` with Bearer;
       key missing → templated error), `provider-setup.test.ts`
       (`saveProviderApiKey` contract).
2. [x] **GREEN:** registry entry + authenticated live-catalog key wiring
       (Nous `resolveKey` pattern) + `bun run generate:provider-docs`.
3. [x] **VERIFY (runbook hard gates):** typecheck × 4 (common, sdk,
       agent-runtime, cli) exit 0; targeted suites green;
       `generate:provider-docs:check` exit 0; eslint `--max-warnings 0`;
       prettier; lint:md; quality ratchet reconciled;
       `validate:repository` PASS.
4. [x] **LIVE (closure gate, keyed) — PASSED 2026-09-08:** run with
       the operator's key (repo `.env.local`, `sk-apx…`, length 53 —
       value never printed, Law 12) through the REAL production chain
       (`fetchGatewayModels` → apinex wrapper → live-catalog fetcher):
       (a) catalog — 1,116 combined models, **22 `apinex/…` entries**
       (`apinex/claude/opus-5`, `apinex/free/glm-5.3-flash`,
       `apinex/gpt/5.6-luna`, …) via the same function `/model` invokes;
       (b) chat round-trip on `free/glm-5.3-flash` — the public health
       table marks it `health: "live"` (all 22 rows live, probed) —
       `POST /v1/chat/completions` → **HTTP 200, content `"OK"`**;
       (c) missing-key catalog probe → **401 fail-closed** as designed.
       Probes preserved at `dev/scratchpad/apinex-acceptance-probe.ts`
       + `dev/scratchpad/apinex-health-check.ts`. Operator UI note: the
       live `/model` observation of zero apinex entries was diagnosed as
       a stale dev session (its process env predates the key landing in
       `.env.local`; a keyed fetch had already written the same 22
       models into the dev disk warm-start cache) — restart shows them;
       the chain-level arm above is the mechanical proof. **The gate
       FID-2026-0906-008's withdrawal vindicated is discharged.**

### Live Unknowns (keyless-unverifiable; resolved at Step 4)

1. **`/v1/models` response shape** — docs say "drop-in OpenAI base URL
   replacement", so `{"object":"list","data":[{id,…}]}` is expected, but
   the endpoint requires a key; verified at Step 4. Fallback: the public
   custom-shaped table could feed a small adapter, but only if the
   OpenAI-shaped path fails.
2. **Chat response compatibility** — streaming/SSE behavior and
   `usage.cost_tokens` extension are documented but unverifiable keyless;
   a non-streaming round-trip is the minimum acceptance, streaming
   observed during normal use.
3. **Auth header edge** — Bearer is documented with a working example;
   `x-api-key` is the fallback if Bearer is rejected (not expected).

## Verification Gates

- gate: typecheck common
- gate: typecheck sdk
- gate: typecheck packages/agent-runtime
- gate: typecheck cli
- gate: test common/src/providers/__tests__/validate-provider-registry.test.ts
- gate: test sdk/src/impl/__tests__/model-provider-free-mode.test.ts
- gate: test cli/src/utils/__tests__/provider-setup.test.ts
- gate: test cli/src/utils/__tests__/openrouter-models-apinex.test.ts

### Verification Receipt

- fingerprint: sha256:ef9bbde6462a4b605c24e16bf653d0ddd37799aacae7f8d89345d0527c426c34
- verified: 2026-09-08T18:20:08.559Z
- typecheck common: exit 0
- typecheck sdk: exit 0
- typecheck packages/agent-runtime: exit 0
- typecheck cli: exit 0
- test common/src/providers/__tests__/validate-provider-registry.test.ts: exit 0
- test sdk/src/impl/__tests__/model-provider-free-mode.test.ts: exit 0
- test cli/src/utils/__tests__/provider-setup.test.ts: exit 0
- test cli/src/utils/__tests__/openrouter-models-apinex.test.ts: exit 0

## Perfection Loop

### Loop 1 — Authoring (2026-09-07, pre-grounding)

- **RED:** no `apinex` surface exists; registry-derived unions and
  validation tests assert the closed 13-provider world.
- **GREEN (initial):** KiosAPI-mirror entry + a new per-provider fetcher
  file `cli/src/utils/openrouter-models/apinex.ts`.
- **CHANGE DELTA:** initial authoring.

### Loop 2 — Operator-directed re-grounding (2026-09-07): RED

Three findings from reading the provider's actual docs, the in-repo
runbook, and the single-agent protocol 0-EOF:

1. **WRONG BASE URL.** The FID used `https://apinex.bond/v1` (from probing
   the apex host). `llms.txt` is explicit: the API base is
   `https://api.apinex.bond/v1`. The apex host answers with the same
   OpenAI-shaped errors, but the documented contract is authoritative
   (Law 11 — follow discovered patterns exactly; docs over probes).
2. **WRONG CATALOG ARCHITECTURE.** The FID planned a new per-provider
   fetcher file. The runbook says a LIVE catalog uses the **generic**
   `live-catalog.ts` fetcher; because `/v1/models` is authenticated
   (proven by its own error), the sanctioned pattern is the Nous-style
   `resolveKey` wiring. The public `/api/public/models` endpoint is
   custom-shaped (pasted) and unusable by the generic fetcher. A new
   fetcher file would have been duplicate machinery (Law 13 violation
   caught before it was written).
3. **WRONG TEST/GATE SURFACE.** The FID guessed a cli gateway-fetcher
   test; the runbook's Step 5 prescribes the three additive test files
   and the hard-gate battery (typecheck × 4, `generate:provider-docs:check`).
   Gates rewritten to match.

Two open questions also RESOLVED by evidence: model-id shape is
vendor-prefixed WITH slashes (`gpt/5.6-luna` — example curl in llms.txt),
and auth is `Authorization: Bearer` (documented example).

- Protocol conformance check (single-agent doc 0-EOF re-read): allowed
  statuses include `converged` — "Perfection Loop-passed, but
  implementation has not started"; this FID moves `analyzed` →
  `converged` at this loop's AUDIT. FID numbering re-verified (scan of
  `dev/fids/` + `archive/`: -004…-007 reserved by the NDJSON build order,
  -008 is next on the date). Ground-truth rule honored: no implementation
  claims are made anywhere in this document.

### Loop 2 — GREEN (corrections applied)

- Registry entry rewritten (baseUrl, catalog URL, evidence comments).
- Per-provider fetcher file removed from the plan; `resolveKey` wiring
  added in its place.
- Steps/gates rewritten to the runbook's prescription.
- Live acceptance hardened: first chat probe on a `health: "live"` model
  (the public table exposes per-model health; `partial` rows exist).

### Loop 2 — AUDIT (two independent methods, per Double Audit)

- **Method 1 (static re-read):** the corrected entry re-checked field by
  field against `ProviderConfig` (types.ts, read 0-EOF) — every field
  exists, `satisfies Record<string, ProviderConfig>` will enforce at
  compile time; the runbook's one-entry claim re-verified ("what you do
  NOT touch anymore" list matches the derivation surfaces).
- **Method 2 (tool evidence):** `llms.txt` fetched (200, contract quoted
  in Environment); `POST /v1/chat/completions` probed — OpenAI-shaped
  auth error (pasted); public catalog shape probed — custom, not
  OpenAI-shaped (pasted); `api.apinex.bond/v1/models` probed — responds
  (pasted). Call-graph forward-check: the entry's consumers are all
  registry-derived (no new wiring beyond `resolveKey`), so zero new
  production callers is EXPECTED and correct for a data-only entry; the
  runbook's end-to-end routing test stands in for reachability at
  implementation.
- **AUDIT verdict:** PASS with three live unknowns explicitly gated at
  Step 4 (catalog shape, chat/streaming compatibility, header edge).
- **CHANGE DELTA:** this pass exceeds the 10% cap — justified and
  recorded: the FSM's "new issues found → back to RED" path fired on
  material new evidence (llms.txt + runbook), which resets the pass.
  Loop 3 expected to converge <2%.

### Missed Questions

1. *Why `order: 4`?* → Every non-anchored gateway joins the tie at 4;
   no picker-sort change is implied.
2. *Does `x-api-key` need a resolver variant?* → No — one env var, one
   Bearer header (documented example); the resolver chain is unchanged
   from the default.
3. *Static or live catalog?* → Live — the endpoint exists and the catalog
   moves; the public pricing table is custom-shaped and would rot.
4. *`.env.local` or `/provider` for the key?* → Both paths exist
   generically; nothing new to build.
5. *SDK surface changes?* → None — provider surfaces derive from the
   data-only registry (verified: sdk typecheck + free-mode suite green
   with zero SDK edits).

### Loop 3 — Convergence (implementation, 2026-09-07)

- **RED:** pins written first — common 8/3 (three apinex-dependent
  fails), cli 0/1/1 (module not found).
- **GREEN:** registry entry + wrapper + aggregation + manifest entry:
  common 25/0 (262 expects), cli 27/0 (74 expects).
- **AUDIT:** Method 1 — every declared gate re-run green (pasted in
  Implementation Verification). Method 2 — call-graph: the entry reaches
  production through registry derivation; the wrapper through
  `gateway.ts`; the manifest audit confirms the live-catalog class. One
  Loop-3 correction: the FID's "no per-provider fetcher file" claim was
  wrong in letter — thin wrapper files ARE the established pattern
  (`nous.ts`, `kiosapi.ts`); implemented the Nous-shaped wrapper (Law 11
  over the FID's paraphrase), recorded in Lessons Learned.
- **CHANGE DELTA:** <2% (converged — circuit breaker).

## Implementation Verification

> Recorded at implementation — RED evidence first, then gate outputs.

**Steps 1-3: `implemented` (gates below). Step 4 (live acceptance):
PASSED 2026-09-08 — evidence pasted below at closure.**

**RED (before implementation):**

```text
common: 8 pass / 3 fail            — the three apinex-dependent pins
cli:    0 pass / 1 fail / 1 error  — module '../openrouter-models/apinex'
                                     not found (one test-side import-path
                                     fix during GREEN: ../apinex →
                                     ../openrouter-models/apinex)
```

**GREEN + gates (pasted):**

```text
bun test (common) provider-registry + validate-provider-registry
  25 pass / 0 fail, 262 expect() calls
bun test (cli) apinex + gateway + gateway-gateways + provider-setup
  27 pass / 0 fail, 74 expect() calls
typecheck common / sdk / agent-runtime / cli: 0 errors each
bun run generate:provider-docs       → "provider env reference: updated"
                                       "provider table: updated" (exit 0)
bun run generate:provider-docs:check → "Provider reference docs are up
                                       to date." (exit 0)
eslint (7 files, --max-warnings 0)   → exit 0
prettier                             → clean (after --write on 2 files)
bun run quality:report               → PASS (1467 baselined files)
bun run validate:repository          → PASS (final)
```

**Mid-flight findings, honestly recorded:**

1. `validate:repository` correctly rejected the first pass:
   `manifest: 'apinex' has unowned provider exceptions` — a live-catalog
   provider requires a FID-2026-0809-008 manifest entry (owner +
   evidence). Added, kiosapi-shaped, in
   `provider-exception-manifest.ts`.
2. The same run exposed that FID-2026-0907-003's receipt had never been
   physically written: `fid:verify`'s default mode PRINTS the receipt and
   only `--write` stamps it, and the earlier stamping command piped
   through `tail`, capturing tail's exit code — the v0.0.22 masking
   pattern, live. Re-stamped with `--write`, exit code captured directly,
   fingerprint verified on disk (FID-003 line 130).

### Code Verification Evidence

- [x] All declared gates pass with pasted tool output (above)
- [x] Production call-graph: `apinex` reaches production via registry
      derivation (`/provider` setup picker, routing prefix) and the
      wrapper via `gateway.ts` (`fetchApinexModels` in the allSettled
      battery); the exception-manifest audit confirms the live-catalog
      registration
- [x] FID status reflects the actual implementation state (`closed`;
      keyed live acceptance passed 2026-09-08)

## Resolution

- **Fixed Date:** 2026-09-07
- **Fix Description:** `apinex` registry entry (gateway / openai / strip /
  authenticated live catalog `https://api.apinex.bond/v1/models` / order 4)
  + thin Nous-shaped wrapper `cli/src/utils/openrouter-models/apinex.ts`
  (`resolveKey: () => process.env.APINEX_API_KEY`, single
  `apinex/`-prefix normalization over multi-slash upstream ids) +
  `gateway.ts` aggregation (allSettled battery, cache fallback, reset) +
  provider-exception-manifest `live-catalog` entry + regenerated docs.
- **Tests Added:** `provider-registry.test.ts` apinex pins (twelve-provider
  list, order-4 tie, ten setup providers, llms.txt contract block) + new
  `openrouter-models-apinex.test.ts` (4 parser tests: multi-slash prefix
  exactly once, double-prefix guard, tolerance, degrade).
- **Archived:** 2026-09-08 — Step 4 keyed live acceptance PASSED (Steps
  + Implementation Verification above); closed + archived the same
  session. Receipt re-stamped at the archived path with all 8 declared
  gates re-run live.

## Lessons Learned

- Probe the docs, not just the endpoint: the apex host answered
  OpenAI-shaped errors and would have shipped a wrong base URL; the
  machine-readable `llms.txt` (and `pricing.md`) settled it. Gateways
  that publish `llms.txt` make Law 1 cheap — read it first.
- The runbook exists precisely so provider integrations are one entry:
  any plan that adds a per-provider file for a LIVE catalog is a Law 13
  duplication smell — check `docs/archive/design/Adding New Providers.md`
  before designing. (Loop-3 nuance: the "generic" live-catalog engine is
  shared, but each provider still carries a thin wrapper file with its
  parser + `resolveKey` — that IS the discovered pattern; follow it.)
- `fid:verify` stamps only with `--write`; piping it through `tail`
  masks its exit code. Both mistakes in one session (FID-003) — the
  v0.0.22 masking incident class reproduces whenever a pipe swallows an
  exit code, even for careful agents. Capture exit codes directly.
