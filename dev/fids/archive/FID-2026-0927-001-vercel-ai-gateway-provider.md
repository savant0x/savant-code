# FID: Vercel AI Gateway as a built-in provider

**Filename:** `FID-2026-0927-001-vercel-ai-gateway-provider.md`
**ID:** FID-2026-0927-001
**Severity:** low
**Status:** closed
**Created:** 2026-09-27 11:24
**Automation level:** 3
**YAGNI-Compliance:** Verified

---

## Summary

Add the Vercel AI Gateway (`https://vercel.com/docs/ai-gateway`) as a built-in
provider so `vercel/<id>` model ids route through the standard registry chain.
The operator confirmed the interpreted scope (SCOPE.md Task 88) on 2026-09-27
with three decisions: routing prefix **`vercel`**; credentials must work
**two ways — `.env.local` and the CLI** (masked `/provider vercel` store, shell
keys taking precedence per FID-2026-0804-001); and this work is **FID-bound** —
the Perfection Loop converges this document before any code is written. The
walkthrough (`docs/archive/design/Adding New Providers.md`) claims "one registry
entry + a catalog reference"; measurement shows the real contract additionally
requires a `live-catalog` exception-manifest entry with an owner module
(FID-2026-0809-008), so the plan below is the corrected recipe.

## Environment

- **OS:** Windows 11 (win32), bash shell
- **Language/Runtime:** TypeScript (`strict: true`), Bun 1.3.14 (root `engines.bun`)
- **Tool Versions:** bun 1.3.14; test runner `bun test`
- **Commit/State:** HEAD `8f40f6f2` (v0.0.33), worktree dirty 51 paths (the
  known G2 boundary — operator-held uncommitted work plus this session's records)

## Detailed Description

### Problem

The provider registry has no Vercel AI Gateway entry, so the gateway's 391
models are unreachable through Savant's routing, setup, and picker surfaces.
Grep ground truth at intake: `AI_GATEWAY|'vercel'|"vercel"` over
`common/src/providers/`, `cli/src/utils/provider-setup.ts` and `.env.example`
returns **zero hits**.

### Expected Behavior

A model id `vercel/<upstream-id>` resolves catalog → `/model` selection →
persisted `activeProvider` → SDK registry loop → generic factory →
`POST https://ai-gateway.vercel.sh/v1/chat/completions` with the upstream id
after one prefix strip and `Authorization: Bearer <key>`, where the key comes
from `AI_GATEWAY_API_KEY` (shell / `.env.local`) or the masked `/provider
vercel` key store, shell taking precedence.

### Root Cause

The gateway was never integrated. Additionally, the archived runbook's
"everything else derives" framing is incomplete against the current contract:
`common/src/providers/audit.ts` derives a required `live-catalog` exception
kind for any `catalog.source === 'live'` entry and fails closed without a
manifest owner + evidence paths.

### Evidence

```text
# Keyless catalog (intake probe):
GET https://ai-gateway.vercel.sh/v1/models            → HTTP 200
{"object":"list","data":[{"id":"alibaba/qwen-3-14b","object":"model",
"created":1755815280,"released":1745798400,"owned_by":"alibaba",
"name":"Qwen3-14B","context_window":40960,"max_tokens":16384,...}]}
count: 391 models
keys: ['context_window','created','deprecated_at','description','id',
'interleaved','knowledge','max_tokens','modalities','name','no_training',
'object','owned_by','pricing','reasoning_options','regions','released',
'supported_parameters','supported_specifications','tags','temperature',
'type','video_capabilities','zdr']

# Keyless inference boundary (intake probe):
POST https://ai-gateway.vercel.sh/v1/chat/completions  → HTTP 401 (fail-closed)

# Registry absence (intake grep):
grep -rn "AI_GATEWAY|'vercel'|\"vercel\"" common/src/providers/ \
  cli/src/utils/provider-setup.ts .env.example        → 0 hits

# Audit contract (common/src/providers/audit.ts):
:34   if (config.catalog.source === 'live') kinds.add('live-catalog')
:121  problems.push(`manifest: '${providerId}' has unowned provider exceptions`)

# File ceiling (wc -l):
common/src/providers/registry.ts               190
common/src/providers/registry-partitioned.ts   298   (300-line quality ceiling)
```

## Impact Assessment

### Affected Components

- `common/src/providers/` — registry entry (new partition module), exception manifest
- `cli/src/utils/openrouter-models/` — live catalog module + gateway merge
- `.env.example`, `cli/release/README.md` — generated provider docs
- Test surfaces: `common/src/providers/__tests__/`, `cli/src/utils/__tests__/`,
  `sdk/src/impl/__tests__/`

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [x] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

The orcarouter/bai pattern verbatim (Law 11/13): one registry entry on the
existing `ProviderConfig` fields, one live-catalog module over the shared
`createLiveCatalogFetcher`, the gateway merge seam, one exception-manifest
entry, then generated docs. No new abstractions, no protocol map (the gateway
normalizes every model behind its OpenAI Chat Completions surface), no
quota field (no documented key-scoped balance endpoint).

### Steps

1. **RED first.** Widen the closed-world/contract pins to expect `vercel` and
   add the parser contract suite; run them against the unmodified tree so each
   fails for the named reason (entry absent from registry/manifest/union).
2. **Registry entry** `vercel` in a new `common/src/providers/registry-partitioned-2.ts`,
   spread into `PROVIDER_REGISTRY` after `PROVIDER_REGISTRY_PARTITION`
   (`registry-partitioned.ts` is at 298/300 lines, so an inline insert would
   breach the file ceiling; `Object.keys` order preserved — `vercel` sorts
   last). Entry fields: `kind: 'gateway'`; `label: 'Vercel AI Gateway'`;
   `credentials.envVar: 'AI_GATEWAY_API_KEY'` with the `/provider vercel`
   hint in `missingKeyMessage` (nous/kiosapi pattern — the provider is
   setup-available); `baseUrl: 'https://ai-gateway.vercel.sh/v1'`;
   `protocol: 'openai'`; `idTransform: 'strip'`; `catalog: { source: 'live',
   url: 'https://ai-gateway.vercel.sh/v1/models' }`; `setupAvailable: true`;
   `domain: 'vercel.com'`; `order: 4` (the documented unknown-provider tie).
3. **Catalog module** `cli/src/utils/openrouter-models/vercel.ts` on
   `createLiveCatalogFetcher` (orcarouter template): keyless (probed 200), a
   provider-typed parser that uniform-prefixes every upstream id with exactly
   one `vercel/` (orcarouter's load-bearing precedent — the wire id must equal
   the upstream id after one strip), maps `context_window` → `contextLength`,
   `max_tokens` → `maxCompletionTokens`, `name`/`description`, and stringifies
   the numeric `created` (`OpenRouterModel.created?: string`,
   `types.ts:46`); exports the fetcher pair, `hasVercelCatalog`,
   `__resetVercelCacheForTest`, and a test-only parser seam.
4. **Gateway merge** in `cli/src/utils/openrouter-models/gateway.ts`:
   import, `Promise.all` fetch entry, cached fallback on reject, merge, reset
   hook — the exact orcarouter shape.
5. **Exception manifest** entry in
   `common/src/providers/provider-exception-manifest.ts`:
   `{ providerId: 'vercel', kinds: ['live-catalog'], owner:
   'cli/src/utils/openrouter-models/vercel.ts', evidence: [that module,
   'cli/src/utils/openrouter-models/gateway.ts'] }` — the shape every existing
   live-catalog provider carries.
6. **Docs regen:** `bun run generate:provider-docs` (`.env.example` gateway
   section + release README provider table), then
   `bun run generate:provider-docs:check`.
7. **Credential contract (operator ruling 2026-09-27: "two ways, via .env.local,
   and also via the cli"):** no new code — the derived `deriveSetupConfig` +
   `saveProviderApiKey()` already serve the masked CLI store and the generic
   env read serves `.env.local`/shell; the gated suites pin both legs for
   `vercel` with shell precedence (FID-2026-0804-001).

### Verification

The provider is "wired" when `vercel/<id>` round-trips the whole chain
(runbook definition): catalog → `/model` selection → persisted `activeProvider`
→ SDK registry loop → generic factory → correct base URL and auth header —
proven by the gated suites below plus a production-chain derivation check
(Law 4 greps land on the registry loop, the generic factory, and the gateway
merge). The boundary was probed at intake (keyless chat 401). A keyed live
smoke is deliberately not claimed: no `AI_GATEWAY_API_KEY` is available to this
session, and end-to-end inference is not asserted without one (the Nous
precedent — treat catalog and inference contracts as separate acceptance
checks).

> Contract rule (FID-2026-0918-006): every promised test artifact MUST name
> its repo-relative `*.test.ts(x)` path, and that path MUST also appear as a
> declared `- gate: test <path>` below.

## Verification Gates

- gate: typecheck common
- gate: typecheck sdk
- gate: typecheck packages/agent-runtime
- gate: typecheck cli
- gate: test common/src/providers/__tests__/provider-contract-pins.test.ts
- gate: test common/src/providers/__tests__/provider-registry.test.ts
- gate: test common/src/providers/__tests__/provider-audit.test.ts
- gate: test cli/src/utils/__tests__/openrouter-models-vercel.test.ts
- gate: test cli/src/utils/__tests__/openrouter-models.test.ts
- gate: test cli/src/utils/__tests__/provider-setup.test.ts
- gate: test cli/src/utils/__tests__/provider-setup-vercel.test.ts
- gate: test sdk/src/impl/__tests__/model-provider-free-mode.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:8e60648f7fc14ad21330bcf4172aced8b8126079a03b67e713590ef0d740bb65
- verified: 2026-09-27T16:07:49.114Z
- typecheck common: exit 0
- typecheck sdk: exit 0
- typecheck packages/agent-runtime: exit 0
- typecheck cli: exit 0
- test common/src/providers/__tests__/provider-contract-pins.test.ts: exit 0
- test common/src/providers/__tests__/provider-registry.test.ts: exit 0
- test common/src/providers/__tests__/provider-audit.test.ts: exit 0
- test cli/src/utils/__tests__/openrouter-models-vercel.test.ts: exit 0
- test cli/src/utils/__tests__/openrouter-models.test.ts: exit 0
- test cli/src/utils/__tests__/provider-setup.test.ts: exit 0
- test cli/src/utils/__tests__/provider-setup-vercel.test.ts: exit 0
- test sdk/src/impl/__tests__/model-provider-free-mode.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Five issues cataloged with evidence above: (R1) no registry entry
  (grep 0 hits); (R2) the runbook's "one entry" recipe is incomplete against
  the audit contract — a live-catalog entry without a manifest owner fails
  `validateProviderAudit` (`audit.ts:34`, `:121`); (R3) the 300-line ceiling —
  `registry-partitioned.ts` is at 298 lines; (R4) parser field drift — the
  gateway publishes `context_window`/`max_tokens` with numeric `created`, so a
  verbatim orcarouter parser copy silently drops context windows; (R5) the
  two-way credential contract is unpinned for this provider.
- **GREEN:** Steps 1-7 above: RED-first pins, entry in a second partition
  module, a measured-parser catalog module, the gateway merge, the manifest
  entry, docs regen, and credential pins. Minimal-change throughout: every
  field is an existing `ProviderConfig` field.
- **AUDIT:** Plan claims verified against source with quoted evidence:
  entry fields all exist in `common/src/providers/types.ts` (`satisfies
  Record<string, ProviderConfig>` makes a typo a compile error);
  `deriveLiveCatalogUrl(PROVIDER_REGISTRY, …)` is the catalog seam
  (`orcarouter.ts` imports it from `@savant-code/common/providers/derive`);
  `createLiveCatalogFetcher` supplies cache/TTL/in-flight dedup/degrade
  (`live-catalog.ts`); gate vocabulary matches the template's allowlist and
  archived provider FIDs (`typecheck common|sdk|packages/agent-runtime|cli`).
  No new function or config field is introduced beyond data + one fetcher
  module, so the zero-production-caller rejection class does not apply; Law 4
  greps are scheduled in the Verification battery instead.
- **ADVERSARIAL:** (a) "Use `@ai-sdk/gateway` instead?" — rejected: the
  registry's generic factory is the single routing truth (Law 13); the
  gateway speaks OpenAI Chat Completions natively (documented curl form), so
  a second client stack would fork the credential contract for no gain.
  (b) "Is `order: 4` right?" — yes; the registry header records the 4-tie as
  the historical default and the runbook calls it intentional. (c) "Prefix
  collision with an existing routing namespace?" — none; grep 0 hits.
  (d) "Why not `setupAvailable: false`?" — that shape is for multi-credential
  providers (Cloudflare); one key fits the standard masked flow.
- **CHANGE DELTA:** 100% (initial authoring of a new document).

### Missed Questions

1. **If the recipe is "one entry", why does the plan touch five source files?**
   The runbook's phrase covers *derivable* surfaces only; FID-2026-0809-008
   added the exception-manifest contract afterwards, which every existing
   live-catalog provider satisfies with a small owner module (the manifest
   names `cli/src/utils/openrouter-models/{nous,kiosapi,apinex,orcarouter,bai}.ts`
   as owners). Measurement wins over the archived doc; the plan folds it in.
2. **Are context-window fallback rows needed (FID-2026-0916-002 pattern)?**
   No. Those rows exist for static catalogs; this catalog publishes
   `context_window` per model (measured, 391 models), which the parser maps
   into `contextLength` — the first source the lookup consults. Family
   fallbacks remain for any row the catalog omits.
3. **What if an upstream id already starts with `vercel/`?** Uniform prefixing
   (exactly one added, always) keeps the wire id equal to the upstream id
   after one strip — the orcarouter comment records why a passthrough branch
   is wrong (it would send the bare remainder, un-routable).
4. **Does the gateway's Anthropic/Responses surface need a protocol map?** No.
   The gateway normalizes: its docs present OpenAI Chat Completions as a
   universal client surface. Protocol maps exist for providers whose families
   404 on chat (tokenrouter/commandcode), which is not this gateway.
5. **Does bare-slug routing (`openai/gpt-6-astra` with `vercel` active) need
   code?** No — bare slugs route to the active provider's gateway by
   documented design (runbook, "Known asymmetries").
6. **`created` is numeric on the wire but typed `string`?** The parser
   stringifies (`OpenRouterModel.created?: string`, `types.ts:46`) — recorded
   so the mapping is not re-discovered as a bug.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** none — G2 withheld (the single-agent protocol reserves git
      execution to the operator); evidence below is file:line + grep, the form
      the FID Lifecycle rule admits for `closed`.
- [x] **File:line ranges:**
      `common/src/providers/registry-partitioned-2.ts:15-45` (the `vercel`
      entry in a new second partition — `registry-partitioned.ts` was measured
      at 298/300 lines); `common/src/providers/registry.ts:19` + `:189`
      (import + spread); `common/src/providers/provider-exception-manifest.ts:98`
      (`live-catalog` ownership); `cli/src/utils/openrouter-models/vercel.ts:43-83`
      (measured parser + fetcher: `context_window`→`contextLength`,
      `max_tokens`→`maxCompletionTokens`, numeric `created` stringified,
      uniform single `vercel/` prefix); `cli/src/utils/openrouter-models/gateway.ts:69-71`,
      `:167`, `:208-211`, `:236`, `:270` (production merge: import, parallel
      fetch, cache fallback, combined spread, test reset) plus the same-pass
      doc-header repair in that file; docs surfaces — generated (`bun run
      generate:provider-docs`: `.env.example`, `cli/release/README.md` table)
      and hand-maintained (README.md ×3, README.zh-CN.md ×4,
      `cli/release/README.md` dotenv template, `docs/sdk-overview.md` ×2,
      `docs/installation.md`, `docs/features.md`, `docs/index.md`).
- [x] **Gate output:** RED-first, before any source change — common 4 fail
      (manifest/contract/19-keys/17-setup), cli 3 fail + 1 module-missing
      import error, sdk 2 fail (the routing leg captured
      `http://localhost:3000/chat/completions` — proof the id fell through
      un-routed). GREEN — common 65 pass / 0 fail (476 expects), cli 27/0,
      sdk 10/0. Full chain `bun run test` 12/12 workspaces **0 fail**;
      `bun run typecheck` **exit 0**; `eslint --max-warnings 0` exit 0;
      `prettier --check .` clean; `lint:md` clean; `quality:report` **PASS
      (1498 baselined files)**; `validate:repository` **PASS**;
      `generate:provider-docs:check` "Provider reference docs are up to date."
- [x] **Reproducibility:** `grep -n "vercel:" common/src/providers/registry-partitioned-2.ts`
      → `15`; `grep -n "providerId: 'vercel'" common/src/providers/provider-exception-manifest.ts`
      → `98`; `grep -n "fetchVercelModels" cli/src/utils/openrouter-models/gateway.ts`
      → `:70,:167`; every gated suite runnable from its workspace root.
- [x] **Step statuses:** Steps 1-7 all `implemented` (Step 1's RED run is
      recorded in the gate output above; Step 7's two credential legs are
      pinned in the split suite after the 300-line ceiling forced
      `provider-setup.test.ts` back to its original size — the split is the
      house pattern, FID-2026-0914-001's precedent).

### Code Verification Evidence

> Before marking status as `fixed` or `verified`, verify that referenced code exists. FID metadata is a claim; code is
> ground truth.

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution
- [x] Typecheck/tests/lint pass with pasted tool output
- [x] Production call-graph evidence is present for new or repaired wiring —
      Law 4 greps land on the production merge (`gateway.ts:167,:236`) and the
      registry loop (`sdk/src/impl/model-provider.ts:18` →
      `getEffectiveProviderRegistry`, ordered loop at `:86`) into the generic
      factory; the sdk free-mode leg drove the chain live and captured
      `POST https://ai-gateway.vercel.sh/v1/chat/completions` with
      `Authorization: Bearer vercel-test-key` and the stripped wire id
      `alibaba/qwen-3-14b`.
- [x] FID status reflects the actual implementation state

> Every PASS and FAIL in AUDIT cites `path/to/file.ts:LINE` plus quoted code or exact command output. Absence-shaped
> checks paste the exact search and mark out-of-reach evidence `NEEDS-REVIEW`.

### Loop 2 — Independent audit and self-correction

- **RED:** Two findings, both real. **(F1)** `bun run validate:repository` →
  `FAIL (1 issue)`: `scope.unregistered-item` — the active FID had no
  `SCOPE.md` line (the coverage guard's first catch was its own authoring
  session, the same shape FID-2026-0919-025 recorded). **(F2)**
  `bun run fid:verify … --check` → `gate path does not exist:
  cli/src/utils/__tests__/openrouter-models-vercel.test.ts` — the declared
  gate names the Step-1 RED suite, which cannot exist before implementation.
- **GREEN:** (F1) register line added to SCOPE.md Task 88 naming
  FID-2026-0927-001 and recording the three operator confirmations; (F2) no
  change — the gate list is the FID-2026-0918-006 contract (every promised
  test path covered), and the path-existence check is expected to pass from
  Step 1 forward. Deleting the gate instead would fail the promise sweep at
  `verified` time.
- **AUDIT:** Two independent methods, tool output: repository validator
  `validation: PASS` after the correction; `scope-register-check` → `PASS (0
  issues)`; filesystem leg — all six pre-existing gate paths `EXISTS` (ls);
  `lint:md` clean (markdownlint exit 0); `prettier --check` on both touched
  records → "All matched files use Prettier code style!".
- **ADVERSARIAL:** "Is a red `--check` acceptable on a converged record?" —
  yes and it is the honest state: the standing gate (`validate:repository`)
  is green, and the alternative (dropping the gate) trades one truthful
  red line for a contract violation at stamp time. "Could F1 have been
  avoided?" — yes: register-then-author ordering; the guard exists because
  creation and registration are two writes (the FID-2026-0917-002 deadlock
  class is why it is not a write-time block).
- **CHANGE DELTA:** ~3% (loop sections + status flip; SCOPE.md registration
  is outside this document).

### Loop 3 — Final convergence

- **RED:** Residual risks recorded: (1) the parser mapping is asserted from
  the key census over all 391 rows, not 391 individual reads — the contract
  suite pins the mapping and any per-row anomaly (`deprecated_at`, absent
  `context_window`) stays parser-internal; (2) merge position in `gateway.ts`
  is cosmetic (registry `order` drives picker grouping, not merge order);
  (3) the keyed live smoke is unclaimed by design (no `AI_GATEWAY_API_KEY`
  in this session) — catalog and inference contracts are separate acceptance
  checks (Nous precedent).
- **GREEN:** No corrections required; the plan stands.
- **AUDIT:** The entry's required-exception set was re-derived by hand against
  `requiredExceptionKinds` (`audit.ts:24-39`): plain `strip`, `openai`, no
  resolver, no `extra`, `gateway`, `setupAvailable: true` ⇒ exactly one
  required kind (`live-catalog`), which the manifest entry in Step 5 owns.
- **ADVERSARIAL:** "Anything left unowned?" — no: every other surface is
  derived or generated (`ModelProvider` union, `ALLOWED_MODEL_PREFIXES`,
  setup config, picker order, docs tables); the runbook's do-not-touch list
  is the witness.
- **CHANGE DELTA:** <2% (this section only) → **CONVERGED** — implementation
  may begin (operator ruling 2026-09-27: "Approve, FID-bound first").

## Resolution

- **Closed Date:** 2026-09-27 13:10
- **Fix Description:** Vercel AI Gateway (`https://vercel.com/docs/ai-gateway`)
  integrated as built-in provider `vercel`: one registry entry (label
  "Vercel AI Gateway", `AI_GATEWAY_API_KEY`, base
  `https://ai-gateway.vercel.sh/v1`, `protocol: 'openai'`, `idTransform:
  'strip'`, keyless live catalog at `/v1/models`) in a new second registry
  partition module; a measured live-catalog parser module (gateway field
  names `context_window`/`max_tokens`, numeric `created`, uniform single
  prefix); the gateway merge; a `live-catalog` exception-manifest entry with
  owner + evidence paths (the FID-2026-0809-008 contract the archived runbook
  under-documented); and all generated + hand-maintained docs surfaces
  synced. Two-way credentials (`.env.local`/shell + masked `/provider vercel`
  store, shell precedence) pinned. In-pass repair: `gateway.ts`'s doc header
  had listed two removed providers and omitted Atria AI.
- **Tests Added:** Yes — two new suites (catalog parser contract;
  two-way credential legs, split from `provider-setup.test.ts` at the
  300-line ceiling) plus widened pins in four existing suites and two legs
  in the sdk free-mode suite (key-missing templated error; one-prefix
  routing round-trip).
- **Verification Evidence:** RED-first with named failures (common 4 fail /
  cli 3 fail + 1 import error / sdk 2 fail) before any source change; then
  65/0, 27/0, 10/0 on the touched suites; full chain `bun run test` 12/12
  workspaces 0 fail; `bun run typecheck` exit 0; eslint 0; prettier clean;
  lint:md clean; `quality:report` PASS (1498); `validate:repository` PASS;
  `generate:provider-docs:check` clean. Boundary measured at intake (keyless
  catalog 200 / keyless chat 401); keyed live inference deliberately not
  claimed (no `AI_GATEWAY_API_KEY` in this session).
- **Archived:** 2026-09-27 13:10 (moved to `dev/fids/archive/`; receipt re-stamped at the archived path)

> When status is set to **closed**, move this file to `dev/fids/archive/` and append an entry to `CHANGELOG.md`.

## Lessons Learned

A walkthrough doc is a claim, not ground truth: the archived provider runbook
described the pre-manifest recipe, and the real contract (the audit module)
demanded one more owned surface. Grounding the plan in the *current* contract
modules — not the doc — is what caught it before code, and the parser-field
drift (R4) would have shipped silently from a template copy.
