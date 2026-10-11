# FID: Mistral AI provider integration (+ CodeCraft parity verification)

**Filename:** `FID-2026-1009-005-mistral-provider-integration.md`
**ID:** FID-2026-1009-005
**Severity:** low
**Status:** closed
**Created:** 2026-10-09 17:58
**Automation level:** 3
**YAGNI-Compliance:** Pending

Loop 1 is fully closed 2026-10-09: RED, GREEN, AUDIT (two Verifier passes and
adjudication) and ADVERSARIAL are all recorded below. Implementation
completed 2026-10-09 — all 12 steps; the inference smoke round-tripped
`mistral/codestral-2508` → HTTP 200 ("pong", finish_reason stop, usage
11/3/14, 420 ms) through the full registry chain. Status flipped
`converged` → `verified` per FID-2026-0915-004. The implementation was
committed locally as `8d915d8f`; declared gates pass. Closure is recorded
below. No push was performed.

---

## Summary

Operator directive 2026-10-09, verbatim: *"this is the provider i want to add
https://codecraftapi.com/dashboard/billing/plan along with this provider
https://mistral.ai/news/mistral-large-4/ - we need to pull both of their
models, i have both keys saved in [the dotenv file] under MISTRAL_API_KEY
CODECRAFT_API_KEY"*, followed by *"so make a fid for them"*.

CodeCraft is already a fully-integrated built-in provider (registry entry,
live-catalog wrapper, window coverage, exception manifest — FID-2026-1003-001,
FID-2026-1006-001); its catalog works with a valid key (HTTP 200, measured), but the picker
showed no CodeCraft group while the resolved key was stale. Operator ruling
2026-10-09 (verbatim): *"even with a duplicted key though it should not hide
the provider from the /models list"* — a credential fault must degrade a
provider, never erase it. The new work is
**Mistral AI** as a built-in provider, following `docs/adding-a-provider.md`
(the live runbook). The measured facts that decided the design: the catalog is
authenticated (Bearer) and publishes context windows under `max_context_length`
(not `context_length`), so the shared parser would extract zero windows — a
dedicated parser is required (the Vercel mis-parse class). `mistral-large-4` is
not in this account's catalog and returns 403 tier_not_allowed on inference;
the catalog lists 46 models and two catalog-listed models round-tripped
inference (ministral-3b-2512 and codestral-2508 both HTTP 200).

## Environment

- **OS / shell:** Windows (Git Bash / MSYS), Bun 1.3.14 (root pins 1.3.14)
- **Language/Runtime:** TypeScript strict monorepo (common / cli / sdk)
- **Commit/State:** `main` @ `5e4de61e` (working tree carries the untracked
  FID-2026-1009-004 icon-program files)
- **Credential location:** the local dotenv file at the repo root — the
  operator referred to a dotenv file; the repo root carries only the example
  template and the local dotenv file (no plain env file exists).
  `MISTRAL_API_KEY` (1 line), `CODECRAFT_API_KEY` (3 lines).

## Detailed Description

### Problem

Mistral AI (api.mistral.ai) is absent from `PROVIDER_REGISTRY`: no
`mistral/<id>` routing, no picker entry, no credential resolution. The
operator wants its models selectable alongside CodeCraft's.

### Expected Behavior

`mistral/<id>` round-trips the whole chain: authenticated catalog fetch ->
/model selection -> persisted activeProvider -> SDK registry loop -> generic
factory -> correct base URL + auth header -> a real completion from the
vendor.

### Root Cause

Not a defect — a feature addition. Recorded as a FID because the runbook's
"one registry entry, everything else derives" understates the work: the
entry is one of roughly fifteen surfaces a provider touches, and the
drift/coverage gates fail closed when the rest are missed.

### Evidence

**Mistral absence from the registry** (grep over `common/src`, `sdk/src`,
`cli/src` for `mistral`): only tangential matches — Cloudflare model ids
(`cloudflare_mistral_small` in `model-config/providers.ts`), the Ollama
onboarding regex, a provider-wizard-discovery test fixture host
(`api.mistral-cdn.example`), and context-window-table comments. No registry
entry exists.

**Credential presence** (grep, names only — values never printed):
`MISTRAL_API_KEY=` matches once in the local dotenv file; the env-example
template contains no MISTRAL entry. No `MISTRAL_*` env var exists in the
registry, so the `claimEnvVar` uniqueness gate passes.

**Count pins** (`common/src/providers/__tests__/provider-registry.test.ts`):
line 26 "covers all twenty-five current providers"; line 114 "twenty-four
current setup providers" — both increment when `mistral` lands.

**CodeCraft already integrated** (file citations):

- registry entry: `common/src/providers/registry-partitioned-2.ts` (the `codecraft` entry)
- exception manifest: `common/src/providers/provider-exception-manifest.ts` (`live-catalog`, owner `cli/src/utils/openrouter-models/codecraft.ts`)
- window coverage: `common/src/constants/window-coverage-register.ts` (`runtime-published`)
- gateway fan-out: `cli/src/utils/openrouter-models/gateway.ts` (import + reset seam)

**Live probe — Mistral catalog** (authenticated, Bearer, key from the local
dotenv file, never echoed), 2026-10-09:

```text
GET https://api.mistral.ai/v1/models  -> HTTP 200
envelope: {"object":"list","data":[...]}
row fields: id, object:"model", created (numeric unix epoch, catalog-wide
  constant 1791582665), owned_by:"mistralai", capabilities (object with 14
  boolean keys), name, description, max_context_length (integer),
  aliases (array), deprecation, deprecation_replacement_model,
  default_model_temperature, billing_model_name, type:"base"
NO pricing fields anywhere.
roster: 46 models — codestral-2508/latest, mistral-code-latest/fim-latest,
  labs-leanstral-1-5[-1], ministral-14b/3b/8b-2512 + -latest aliases,
  mistral-medium[-latest/-3-5/-3/-2604], mistral-vibe-cli-*,
  magistral-medium/small-latest, mistral-small-2603/latest, voxtral-small-*,
  codestral-embed[-2505], mistral-embed[-2312], mistral-moderation-2603,
  mistral-ocr-* (7 ids), voxtral-mini-* (7 ids)
```

**Live probe — Mistral inference** (authenticated):

```text
POST /v1/chat/completions model=mistral-large-4      -> HTTP 403
  {"object":"error","message":"This model is not available in your
   subscription tier","type":"tier_not_allowed","code":"1910"}
GET  /v1/models?model=mistral-large-4                 -> HTTP 200, data: []
POST /v1/chat/completions model=ministral-3b-2512     -> HTTP 200, "Understood!"
  (finish_reason:"length" — the max_tokens:5 budget artifact, not a defect)
POST /v1/chat/completions model=codestral-2508         -> HTTP 200, "OK"
  (finish_reason:"stop", usage 10/2/12, service_tier "standard")
```

`mistral-large-4` is absent from this account's catalog (empty filter
result; not among the 46 ids) and tier-gated on inference. Catalog
reachability and inference reachability are separate acceptance checks (the
runbook's Nous lesson): the catalog is 200 and inference round-tripped on
two catalog-listed models (measured), so the provider integrates; Large 4 entitlement is an
operator billing fact, not an integration defect.

**Live probe — CodeCraft** (3 `CODECRAFT_API_KEY` lines in the local dotenv
file, tested per line, values never printed):

```text
LINE_1_STATUS=401  (invalid or revoked key)
LINE_2_STATUS=200  (valid)
LINE_3_STATUS=200  (valid)
```

The earlier single-key probe used the first match (line 1) and reported 401
— a stale-key artifact. CodeCraft's catalog works with the current key.

### The parser gap (measured, not assumed)

The shared `parseChatCatalog` (`cli/src/utils/openrouter-models/chat-catalog.ts`)
reads `context_length` ?? `context_window` and treats `capabilities` as a
string array. Mistral publishes `max_context_length` and an object-shaped
`capabilities` — reusing the shared parser would extract **zero** windows
(the Vercel class; `dev/LEARNINGS.md` -> `archived-runbook-is-claim-not-contract`).
The dedicated parser maps `max_context_length` -> `contextLength`; the numeric
`created` normalizes through the existing `catalogCreated` (already handles
epoch seconds); no pricing fields -> prices stay absent (truthful, per the
runbook's metadata rules).

## Impact Assessment

### Affected Components

- `common/src/providers/registry-partitioned-2.ts` — the new `mistral` entry
  (file at 230/300 lines; room for one ~35-line entry)
- `cli/src/utils/openrouter-models/mistral.ts` — new wrapper + dedicated parser
- `common/src/providers/provider-exception-manifest.ts` — `live-catalog` exception
- `common/src/constants/window-coverage-register.ts` — coverage disposition
- `cli/src/utils/openrouter-models/gateway.ts` — fan-out + reset seam
- `cli/src/utils/openrouter-models/gateway-live-results.ts` — positional ladder
  (insert immediately before the custom-catalogs tail)
- `common/src/providers/__tests__/provider-registry.test.ts` — count pins
- Tests: `validate-provider-registry.test.ts`, `provider-setup.test.ts`,
  `sdk/src/impl/__tests__/model-provider-free-mode.test.ts`, new pin suite
- Generated: the env-example template, `README.md`, `cli/release/README.md`,
  `README.zh-CN.md` (via `bun run generate:provider-docs`)
- Hand-maintained: `docs/providers.md` (not generated)
- Deliberately NOT touched: CodeCraft surfaces — already integrated and
  verified this session (no code expected)

### Risk Level

- [ ] Critical
- [ ] High
- [ ] Medium
- [x] **Low** — additive. One new routing prefix, one picker entry, one env
      var. Catalog unavailable degrades to an empty list; free-text
      `/model mistral/<id>` still routes via the registry.

## Proposed Solution

### Approach

One typed registry entry + one live-catalog wrapper with a dedicated
(`max_context_length`-aware) parser + exception manifest + coverage
disposition + gateway wiring + count pins + tests + generated docs, following
`docs/adding-a-provider.md` exactly and the codecraft/vercel precedents.
CodeCraft needs no integration code — registry, wrapper, fan-out and merge
are shipped; its leg is a parity re-probe (done 2026-10-09) whose finding —
a failed fetch hides the provider from /model — is now in scope as the
visibility fix.

### Steps

1. Registry entry in `registry-partitioned-2.ts`: id `mistral`, label
   `Mistral AI`, kind `gateway`, `MISTRAL_API_KEY`, baseUrl
   `https://api.mistral.ai/v1`, protocol `openai`, idTransform `strip`
   (roster ids are bare — measured), catalog `{ source: 'live', url:
   'https://api.mistral.ai/v1/models' }`, setupAvailable true, domain
   `mistral.ai`, `order: 4` (conventional fallback only — the picker sorts groups
   alphabetically by provider id per FID-2026-1007-017; `order` feeds
   `deriveProviderOrder`, not picker placement). **implemented 2026-10-09**
2. Wrapper `cli/src/utils/openrouter-models/mistral.ts` on
   `createLiveCatalogFetcher`: `resolveKey` wiring (authenticated catalog —
   the cleanapis/nous pattern), dedicated parser mapping
   `max_context_length` -> `contextLength`, `catalogCreated` for the numeric
   epoch, name/description passthrough, no pricing. Exports
   `fetchMistralModels`, `getCachedMistralModels`,
   `__resetMistralCacheForTest`. **implemented 2026-10-09**
3. Exception manifest entry: `mistral` -> kinds `['live-catalog']`, owner
   `cli/src/utils/openrouter-models/mistral.ts`, evidence
   `[mistral.ts, gateway.ts]`. **implemented 2026-10-09**
4. `WINDOW_COVERAGE_REGISTER` -> `mistral` = `runtime-partial` (measured: chat
   rows publish `max_context_length`, usable only after the dedicated parser
   maps it to `contextLength`; the roster is mixed — embeddings, moderation,
   OCR, audio — so only a full-roster census, not sampling, would justify
   `runtime-published`). `NO_PUBLISH_GATEWAY_IDS` is not applicable (declared
   non-edit). A pin asserts the extraction (`max_context_length` ->
   `contextLength`) and graceful absence for rows without the field. **implemented 2026-10-09**
5. Gateway fan-out: import + `Promise.allSettled` entry + reset seam in
   `gateway.ts`. **implemented 2026-10-09**
6. Positional ladder: insert the mistral entry in `gateway-live-results.ts`
   immediately before the custom-catalogs tail (the positional-contract
   rule). **implemented 2026-10-09** (array + destructure + return + the
   `mistralModels` merge leg in `gateway-catalog-merge.ts`)
7. Count pins: `provider-registry.test.ts` "twenty-five" -> "twenty-six"
   (line 26), "twenty-four" -> "twenty-five" (line 114). **implemented 2026-10-09**
   (plus the order-4 family pin)
8. New pin suite
   `cli/src/utils/openrouter-models/__tests__/fid-2026-1009-005-mistral.test.ts`:
   catalog identity, parser window extraction (max_context_length -> rows),
   numeric-created normalization, no-pricing truthfulness, registry entry,
   coverage disposition, manifest entry. **implemented 2026-10-09** (9 tests)
9. Extend `validate-provider-registry.test.ts` fixture, `provider-setup.test.ts`
   (`/provider mistral` save contract), `model-provider-free-mode.test.ts`
   (key present routes to the generic factory; missing throws the templated
   error). **implemented 2026-10-09** — the live-registry validation covers
   the fixture leg (110/110 common provider tests); the save contract and
   the two routing legs land in `provider-setup.test.ts` and the new
   sibling `sdk/src/impl/__tests__/model-provider-free-mode-mistral.test.ts`
   (the free-mode family's decomposition pattern — the parent file crossed
   the 300-line ceiling with the legs inline)
10. CodeCraft parity re-probe: DONE 2026-10-09 — the catalog leg passes with
    a valid key (HTTP 200, rows populated); the picker leg FAILED (no group).
    Findings: (a) the runtime resolved a stale duplicated key — fixed by the
    operator 2026-10-09; (b) the hide-behavior itself is the defect (see RED
    (d)). **The visibility fix is implemented 2026-10-09**: a keyed live
    provider whose catalog contributes zero rows now renders as an
    UNAVAILABLE group header in the /model picker — never silently absent.
    The unavailable set derives from the existing coverage seam
    (`computeCatalogGaps` in `gateway-coverage.ts` — keyed live providers
    with no rows), threaded through `model-picker-open.ts` into the picker
    store and `buildGroupedItems`; enforced by four tests over the
    registry x picker path in `model-picker-free-section.test.ts`.

    General invariant owned by this step: a registered provider is never
    silently absent — a failed or absent catalog fetch yields a visible
    degraded state (the UNAVAILABLE group), never omission; enforced by a
    test over the registry x picker path, reusing the existing coverage
    seam rather than a parallel surface.
11. `bun run generate:provider-docs` + sync the hand-maintained surfaces the
    drift checker names (README provider-flexibility bullet, quick-start,
    dispatch prefix list, env-var reference, the dotenv release template,
    `README.zh-CN.md`, `docs/providers.md`). **implemented 2026-10-09** —
    `generate:provider-docs:check` PASS (13 hand-maintained surfaces synced)
12. Mistral inference smoke on a catalog-listed model through the full
    registry chain (`mistral/codestral-2508` -> 200), recorded with the
    observed status. **implemented 2026-10-09** — `getModelForRequest` ->
    generic factory -> real completion: HTTP 200, text "pong",
    finish_reason "stop", usage 11/3/14, 420 ms.

### Verification

Typecheck the four workspaces; run the common provider suites, the CLI
catalog/setup suites, the SDK free-mode suite, the docs-drift suite and
the new pin suite; `generate:provider-docs:check`; eslint; lint:md;
prettier; `validate:repository`; `quality:report`.

## Verification Gates

- gate: typecheck common
- gate: typecheck cli
- gate: typecheck sdk
- gate: typecheck packages/agent-runtime
- gate: test common/src/providers/__tests__/provider-registry.test.ts
- gate: test common/src/providers/__tests__/provider-registry-gateways.test.ts
- gate: test common/src/providers/__tests__/validate-provider-registry.test.ts
- gate: test common/src/providers/__tests__/provider-audit.test.ts
- gate: test common/src/providers/__tests__/provider-contract-pins.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/window-coverage-register.test.ts
- gate: test cli/src/utils/__tests__/provider-setup.test.ts
- gate: test cli/src/utils/__tests__/openrouter-models.test.ts
- gate: test cli/src/utils/__tests__/openrouter-models-gateway-providers.test.ts
- gate: test sdk/src/impl/__tests__/model-provider-free-mode.test.ts
- gate: test sdk/src/impl/__tests__/model-provider-free-mode-mistral.test.ts
- gate: test scripts/__tests__/provider-docs-drift.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/fid-2026-1009-005-mistral.test.ts
- gate: test cli/src/components/__tests__/model-picker-free-section.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:5281163aef5ec6da56de7584a47929e4e18c38ca522c6c95add26d5928822c52
- verified: 2026-10-11T04:28:58.222Z
- typecheck common: exit 0
- typecheck cli: exit 0
- typecheck sdk: exit 0
- typecheck packages/agent-runtime: exit 0
- test common/src/providers/__tests__/provider-registry.test.ts: exit 0
- test common/src/providers/__tests__/provider-registry-gateways.test.ts: exit 0
- test common/src/providers/__tests__/validate-provider-registry.test.ts: exit 0
- test common/src/providers/__tests__/provider-audit.test.ts: exit 0
- test common/src/providers/__tests__/provider-contract-pins.test.ts: exit 0
- test cli/src/utils/openrouter-models/__tests__/window-coverage-register.test.ts: exit 0
- test cli/src/utils/__tests__/provider-setup.test.ts: exit 0
- test cli/src/utils/__tests__/openrouter-models.test.ts: exit 0
- test cli/src/utils/__tests__/openrouter-models-gateway-providers.test.ts: exit 0
- test sdk/src/impl/__tests__/model-provider-free-mode.test.ts: exit 0
- test sdk/src/impl/__tests__/model-provider-free-mode-mistral.test.ts: exit 0
- test scripts/__tests__/provider-docs-drift.test.ts: exit 0
- test cli/src/utils/openrouter-models/__tests__/fid-2026-1009-005-mistral.test.ts: exit 0
- test cli/src/components/__tests__/model-picker-free-section.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** (a) Mistral absent from `PROVIDER_REGISTRY` (grep evidence above).
  (b) Catalog shape divergence measured: `max_context_length` (not
  `context_length`), numeric `created`, object `capabilities`, no pricing —
  the shared parser extracts zero windows; a dedicated parser is required.
  (c) `mistral-large-4` absent from the account catalog (empty filter; 403
tier_not_allowed on inference) — an entitlement fact, not a blocker; the
  catalog lists 46 models and two catalog-listed models round-tripped
  inference (ministral-3b-2512, codestral-2508 — HTTP 200). (d) CodeCraft already integrated — four
  surfaces verified. The dotenv file carried three CODECRAFT_API_KEY lines
  (first stale, 401; later two valid, 200); the loader's first-assignment-wins
  rule (cli/src/pre-init/load-dev-env.ts) makes the first line the resolved
  value whenever the shell does not already export one, so the runtime sent a
  stale credential; the operator fixed the duplication 2026-10-09; the post-fix probe measured
  one assignment line (45) and 33 rows populated through the shipped fetcher. Independently of
  the key, the hide-behavior is a defect: a keyed live provider whose catalog
  fetch fails contributes zero rows, and `buildGroupedItems`
  (cli/src/components/model-picker-grouping.ts) builds groups only from rows —
  so the provider vanishes from /model with only a developer-facing logger
  warning. Required (operator 2026-10-09): the provider stays visible or
  explicitly signalled, never silently absent. (e) Count pins at 25/24 must
  increment.
  (f) `WINDOW_COVERAGE_REGISTER` is fail-closed — an entry is required.
- **GREEN:** the 12-step plan above.- **AUDIT:** complete — first Verifier pass returned one FAIL
  (round-trip overgeneralization: only 2 of 46 listed models were
  inference-probed) and two NEEDS-REVIEWs (roster count; provider-list.test.ts
  path). Adjudicated 2026-10-09: the count re-measured at 46 over the live
  roster; the provider-list test lives at cli/src/commands/__tests__/ and
  needs no edit (its sort pin is label-relative, not an exhaustive world) —
  all three citations removed; the overgeneralization reworded in the
  Summary, the Evidence paragraph, RED (c), Missed Questions 7, and
  SCOPE.md T178. **Second Verifier pass (this turn, in-flight) additionally
  ruled: FAIL — a prior edit asserted "ADVERSARIAL recorded below" and
  flipped Status to `converged` while the ADVERSARIAL pass did not exist
  (Law 5); the flip is reverted with this edit and Status returns to
  `analyzed` until ADVERSARIAL records below.** The same pass raised
  NEEDS-REVIEWs on disk facts; each was verified against the working tree
  2026-10-09 rather than against compacted reads: both gate paths exist
  (glob: `cli/src/utils/__tests__/openrouter-models-gateway-providers.test.ts`
  ✅, `common/src/providers/__tests__/provider-registry-gateways.test.ts` ✅);
  `runtime-partial` is a member of `WindowCoverageDisposition`
  (`common/src/constants/window-coverage-register.ts:42-45` — union lists
  `runtime-published` :44 and `runtime-partial` :45; :95 shows an existing
  entry using it); `deriveProviderOrder` exists
  (`common/src/providers/derive.ts:86`) and the alphabetical-by-id picker
  sort is pinned per archived `FID-2026-1007-017`;
  first-assignment-wins is real (`cli/src/pre-init/load-dev-env.ts:113` —
  `if (!key || process.env[key]) continue` :121 assigns only when unset,
  and `bun --no-env-file` is the loader's documented premise :9-11);
  `FID-2026-0915-004` exists (1 file in `dev/fids/archive/`). **ADVERSARIAL
  pass (same turn, fresh read-only challenge of the AUDIT resolution) —
  every audit citation re-checked against disk, none drifted:** all eight
  remaining declared gate files exist (provider-registry,
  validate-provider-registry, provider-audit, provider-contract-pins,
  window-coverage-register, provider-setup, openrouter-models,
  openrouter-models-gateway-providers:
  glob/ls evidence, 8/8 present); the shared-parser gap cited by RED (b) is
  real (`chat-catalog.ts:29` reads `row.context_length ?? row.context_window`
  — no `max_context_length`); both notification modules named by Step 10
  exist (`cli/src/utils/provider-notifications.ts`,
  `common/src/providers/provider-notifications.ts`); the count pins sit
  exactly where RED (e) says
  (`provider-registry.test.ts:26` twenty-five, `:114` twenty-four); the
  alphabetical-by-id picker sort is quoted verbatim from archived
  `FID-2026-1007-017` ("provider groups are ordered alphabetically by
  provider id"); the loader seam is real (`.env` read loop assigns only
  unset keys — `load-dev-env.ts:113` `if (!key || process.env[key]) continue`,
  `:121` assignment; `--no-env-file` in `cli/package.json:17` and documented
  at `load-dev-env.ts:8`). The two Verifier FAILs are resolved with in-place
  corrections (status flip reverted then re-earned; the false forward
  reference removed). **Adversarial verdict: no REFUTED; one ADJUSTED (the
  status-note in-line blockquote form is parser-fragile and was rewritten as
  a post-metadata block); record may converge.**
- **AUDIT (convergence pass, 2026-10-09):** Verifier flagged the premature
  `converged` flip (the status note claimed an ADVERSARIAL pass not yet run)
  and two unverified artifacts — both refuted by tool evidence (glob: both
  added gate files exist; read: `runtime-partial` is a
  `WindowCoverageDisposition` member). The FAIL was cured by recording the
  pass below.
- **ADVERSARIAL (convergence pass, 2026-10-09):** Adversary adjudicated —
  FAIL CONFIRMED and cured; the gate-path and disposition NEEDS-REVIEWs
  REFUTED; the Status-blockquote parser risk REFUTED (`fid-check` exit 0 with
  the blockquote present; FID-2026-1009-004 precedent); the keep-ownership
  decision ADJUSTED-acceptable (documented in Missed Question 11); re-audited
  PASSes survive with independent evidence (`order` claim exact against
  `model-picker-grouping.ts`; credential seam against `load-dev-env.ts`;
  probe numbers 45/33 unchanged). One Verifier omission: the anti-deferral
  Step-Status validator was unrun — `fid-ledger` reports no findings.
- **CHANGE DELTA:** n/a (document-only passes: self-correct + operator ruling +
  visibility finding — no code change; the FID-2026-1009-004 precedent)

### Missed Questions

1. **Is the Mistral catalog authenticated?** Yes — Bearer; the wrapper needs
   `resolveKey` (the cleanapis/nous pattern), not a keyless url-only entry.
2. **Does the catalog publish context windows?** Yes — `max_context_length`
   per row (measured), but not under the OpenRouter field name, so the
   parser must map it; the `runtime-published` disposition follows.
3. **Pricing?** None in the response (measured) — prices stay unknown; no
   fabrication.
4. **Which id is Mistral Large 4?** Docs say `mistral-large-4` (changelog
   Oct 5 2026) and `mistral-large-latest` = Large 3 — but this account's
   catalog lists neither. The live roster (46 ids, measured) is the source
   of truth and Large 4 is not in it; the picker shows what the key can see.
5. **Why not `protocol: 'multi'`?** The whole roster speaks OpenAI Chat
   Completions; map dispatch is mandatory only for mixed rosters.
6. **Why not reuse `parseChatCatalog`?** Measured divergence
   (max_context_length, numeric created, object capabilities, no pricing) —
   the Vercel mis-parse class; a dedicated parser follows the
   `parseVercelCatalog` precedent and is pin-testable.
7. **Does the 403 on Large 4 block the integration?** No — catalog 200 and
   inference round-tripped on two catalog-listed models (measured);
   entitlement is the operator's billing state (the xKiro 403 lesson: a
   tier-gated model is
   not a provider-down signal).
8. **Where do the operator's keys live?** The local dotenv file (the
   operator referred to a dotenv file; the repo root carries only the
   example template and the local dotenv). MISTRAL_API_KEY valid (catalog
   200); CODECRAFT had three duplicate lines, the operator removed them
   2026-10-09 (single line remains; 33 rows populated through the fetcher).
9. **Does `order: 4` place Mistral in the picker?** No — the picker sorts
   groups alphabetically by provider id (FID-2026-1007-017); `order` feeds
   `deriveProviderOrder` only. Step 1 states this so it implies no ordering
   decision.
10. **What does the credential seam require?** Exactly ONE `MISTRAL_API_KEY`
    line in the root dotenv — the loader is first-assignment-wins per file
    (`cli/src/pre-init/load-dev-env.ts`) and never overwrites an existing
    `process.env` value, so a duplicate silently pins the first value; a shell
    export shadows the file; the dev script's `bun --no-env-file` disables
    Bun's auto-loader; the `/provider mistral` store is the second tier
    (`cli/src/utils/provider-credentials.ts`). Verification is an
    authenticated catalog 200 plus a 1-token completion — never a printed key.
11. **Is the picker-visibility finding owned here?** Yes — decision: one
    record owns this provider-surface workstream. A separate record for the
    general invariant was considered and rejected because it would leave the
    invariant unowned during this integration window; Step 10 states the
    invariant and names its enforcing test.
12. **Is `runtime-published` the right window disposition?** Not as written —
    the roster is mixed and only sampled rows were measured; `runtime-partial`
    is the truthful default until a full-roster census. The parser mapping is
    the enabling dependency (Step 4).
13. **Declared non-edits:** `cli/src/commands/__tests__/provider-list.test.ts`
    needs no change (its sort pin is label-relative, not an exhaustive world);
    `NO_PUBLISH_GATEWAY_IDS` is not applicable for `mistral`.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** `8d915d8f` (local implementation commit; no push)
- [x] **File:line ranges:** `common/src/providers/registry-partitioned-2.ts:15-52`
      (the mistral entry); `cli/src/utils/openrouter-models/mistral.ts`
      (new, dedicated parser); `common/src/providers/provider-exception-manifest.ts:40-51`
      (live-catalog owner); `common/src/constants/window-coverage-register.ts:247-260`
      (runtime-partial); `cli/src/utils/openrouter-models/gateway.ts`
      (import + reset seam + doc lists);
      `cli/src/utils/openrouter-models/gateway-live-results.ts`
      (array + destructure + return + contract comment);
      `cli/src/utils/openrouter-models/gateway-catalog-merge.ts:54`
      (merge leg); `common/src/providers/__tests__/provider-registry.test.ts`
      (count pins + order-4 family); the visibility fix —
      `cli/src/components/model-picker-grouping.ts` (unavailable groups),
      `cli/src/state/model-picker-store.ts`, `cli/src/components/model-picker.tsx`,
      `cli/src/utils/model-picker-open.ts`,
      `cli/src/commands/defs/model-provider-commands.ts`; tests —
      `cli/src/utils/openrouter-models/__tests__/fid-2026-1009-005-mistral.test.ts`
      (new, 9), `cli/src/components/__tests__/model-picker-free-section.test.ts`
      (+4), `cli/src/utils/__tests__/provider-setup.test.ts` (+1),
      `sdk/src/impl/__tests__/model-provider-free-mode-mistral.test.ts`
      (new sibling, 2); docs — `.env.example`, `README.md`,
      `README.zh-CN.md`, `cli/release/README.md`, `docs/providers.md`,
      `docs/index.md`, `docs/sdk-overview.md`, `docs/installation.md`,
      `docs/features.md`
- [x] **Gate output:** all 17 declared gates run live 2026-10-09 — typecheck
      x4 exit 0; common providers 110/110; cli catalog+setup 147/147;
      sdk free-mode 12/12 (parent + mistral sibling); docs-drift 4/4;
      mistral pin suite 9/9; quality PASS (1503 files); eslint 0/0;
      lint:md exit 0; validate:repository PASS; scope-register PASS;
      `generate:provider-docs:check` PASS. Inference smoke: HTTP 200
      "pong" (finish_reason stop, usage 11/3/14, 420 ms)
- [x] **Reproducibility:** `bun cli/scripts/generate-savant-icons.ts`-style
      regen n/a; `bun run generate:provider-docs` regenerates the doc
      surfaces from the registry; the pin suites re-run offline
- [x] **Step statuses:** all 12 steps `implemented`

### Code Verification Evidence

- [x] Files referenced in Affected Components exist (verified 2026-10-09:
      all cited paths read or grepped this session)
- [x] Implementation matches the Proposed Solution: verified 2026-10-09
- [x] Typecheck/tests/lint pass with pasted tool output: verified
      2026-10-09 (gate output above)
- [x] Production call-graph evidence for new wiring: verified 2026-10-09 —
      `fetchMistralModels`/`getCachedMistralModels` imported by
      `gateway-live-results.ts`; `mistralModels` merged by
      `assembleGatewayCatalog`; `mistral` routes through the SDK registry
      loop (the inference smoke exercised the whole chain);
      `computeCatalogGaps` -> `openModelPicker` -> picker store ->
      `buildGroupedItems` for the visibility fix
- [x] FID status reflects the actual implementation state: closed after the
      committed implementation and passing declared gates

### Loop 2 — Independent audit and self-correction

- **RED:** pending
- **GREEN:** pending
- **AUDIT:** pending
- **ADVERSARIAL:** pending
- **CHANGE DELTA:** pending

### Loop 3 — Final convergence

- **RED:** pending
- **GREEN:** pending
- **AUDIT:** pending
- **ADVERSARIAL:** pending
- **CHANGE DELTA:** pending

## Resolution

- **Closed Date:** 2026-10-11 (local implementation commit `8d915d8f`)
- **Fix Description:** Added Mistral as a built-in provider with an authenticated
  live catalog parser for `max_context_length`, registry and gateway wiring,
  truthful partial window coverage, picker-unavailable signaling for keyed
  providers whose catalog fails, and synchronized provider documentation.
- **Tests Added:** Mistral parser/provider pins, provider setup and SDK routing
  coverage, picker degraded-state coverage, and provider-doc drift coverage.
- **Verification Evidence:** refreshed receipt above; all 17 declared gates
  passed, including four workspace typechecks and quality.
- **Archived:** 2026-10-11 to `dev/fids/archive/`; no push.

## Lessons Learned

Placeholder — completed at closure.

---
