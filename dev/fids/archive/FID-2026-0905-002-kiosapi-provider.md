# FID: Add KiosAPI (kiosapi.com) provider — registry, model selection, /model picker, project-wide routing

**Filename:** `FID-2026-0905-002-kiosapi-provider.md`
**ID:** FID-2026-0905-002
**Severity:** medium
**Status:** closed
**Created:** 2026-09-05 00:00
**YAGNI-Compliance:** Verified

---

## Summary

Add KiosAPI (`https://kiosapi.com/`, fully OpenAI-compatible unified gateway)
as a first-class provider: one `PROVIDER_REGISTRY` entry (Path A — no new
shim) plus an authenticated live model catalog in the Nous pattern wired into
the combined gateway catalog, which surfaces KiosAPI models in the `/model`
picker. Request routing, key resolution, `/provider` CLI setup, credential
persistence, and picker visibility all derive automatically from existing
generic loops. Key: `KIOSAPI_API_KEY` via `.env.local` or
`/provider kiosapi` submission.

## Environment

- **OS:** Windows (win32, pwsh)
- **Language/Runtime:** TypeScript monorepo (`strict: true`), Bun ≥ 1.3.11
- **Tool Versions:** `createLiveCatalogFetcher` pattern
  (FID-2026-0809-001 Phase 3), unified registry (FID-2026-0809-001 Phase 1/2)
- **Commit/State:** `main @ 2cc377e` + working-tree modifications
  (pre-existing, unrelated; no commit made — operator executes git per G1)

## Detailed Description

### Problem

KiosAPI is unavailable in Savant-Code: no registry entry means the `kiosapi/`
routing prefix is unrecognized (ids fall through to the generic
default-inference path with the wrong endpoint/key), `/provider kiosapi` is
unknown, and no KiosAPI models appear in the `/model` picker. This is a
capability gap, not a defect — nothing existing is broken.

### Expected Behavior

- `kiosapi/<model>` ids route to `https://kiosapi.com/v1` with
  `KIOSAPI_API_KEY` (Bearer), `strip` transform (API receives the bare
  upstream id), project-wide (CLI + every SDK consumer via
  `getModelForRequest`).
- `KIOSAPI_API_KEY` works from `.env.local` (auto-loaded at boot) and is
  submittable via `/provider kiosapi` (persisted to `credentials.json`,
  applied to `process.env`, self-selects direct mode).
- KiosAPI models appear in the `/model` picker via the combined gateway
  catalog; missing key / catalog outage degrades to exact-id free-text entry
  (existing behavior).
- Missing-key errors name `KIOSAPI_API_KEY` and fail closed.

### Root Cause

No integration exists (repo-wide grep for `kiosapi` returns zero files). No
code change is needed beyond additive registration + catalog wiring — every
consumer loop is already generic.

### Evidence

Provider facts (agent-reach web via Jina Reader + web search, 2026-09-05;
official docs `github.com/kiosapi/docs`, `kiosapi.mintlify.app`):

- Fully OpenAI-compatible: `base_url=https://kiosapi.com/v1/` (trailing slash
  required by their SDK guide), Bearer keys starting `sk-` (`sk-kilo-…` in
  quickstart), chat/streaming/tools/embeddings work unchanged.
- Model ids are bare upstream names: `gpt-4o-mini`, `gpt-4o`,
  `claude-sonnet-4-20250514`, `gemini-2.5-flash` → `idTransform: 'strip'`
  (same class as tokenrouter/nous).
- `GET https://kiosapi.com/v1/models` → **HTTP 401 unauthenticated** (live
  probe 2026-09-05): endpoint exists, requires key → authenticated live
  catalog in the Nous pattern.
- List contract (official `api-reference/models/list-models.md`): standard
  OpenAI shape (`object: "list"`, `data[].id/created/owned_by`); "lists all
  models available to your API key"; ids are bare upstream names (`gpt-4o`,
  `claude-sonnet-4-6`). Per-key availability → the parser must be
  pass-through (no id filtering).
- GLM-5.3-free status: Z.AI direct does NOT offer it free (flagship
  $1.40/$4.40 per 1M); gateway free variants exist (TokenRouter advertises
  "GLM-5.3 — Now Free"; in-repo precedent
  `tokenrouter/z-ai/glm-5.3-free` at
  `cli/src/utils/openrouter-models/static-catalogs.ts:58`). Whether
  **kiosapi.com** carries a GLM-5.3 (free) entry, and under what exact id, is
  **unverifiable without a key** (pricing page is JS-rendered, reader-empty;
  no public model list found). Guarantee mechanism in Steps 2/6 below.
- Service-identity flag resolved: `kiosapi.com` (global gateway) vs
  `kiosapi.id` (separate Indonesian service, `kios_live_…` keys) — operator
  confirmed **kiosapi.com**.

Code facts (all read 0-EOF unless noted):

- Routing is one generic loop: `sdk/src/impl/model-provider.ts:86-99`
  iterates `PROVIDER_REGISTRY`, skips `kind: 'local'`, matches
  `${config.id}/` prefix, resolves key via `resolveProviderKey`
  (`model-provider.ts:177-185`, reads `process.env[envVar]`), builds via
  `createProviderModel`
  (`sdk/src/impl/model-provider/model-factories.ts:58-106`,
  `protocol: 'openai'` → `OpenAICompatibleChatLanguageModel`). Registry
  iteration order is a documented no-op (`model-provider.ts:81-84`).
- `.env.local` auto-load: `cli/src/pre-init/load-dev-env.ts:92-95` loads
  repo-root `.env.local` before imports; boot comment at
  `cli/src/index.tsx:3`.
- CLI submission is registry-derived: `PROVIDER_SETUP_CONFIG =
  deriveSetupConfig(PROVIDER_REGISTRY)`
  (`cli/src/utils/provider-key-store.ts:27`); `setupAvailable: true` +
  `credentials.envVar` is the only requirement
  (`common/src/providers/validate.ts:144-149`). `saveProviderApiKey`
  persists to `credentials.json` + applies to `process.env` + activates
  direct mode (`provider-key-store.ts:119-186`). Single-key `.env.local`
  self-selects (`provider-key-store.ts:101-110`; `.env.local` +
  `NOUS_API_KEY` precedent at `:104`).
- `/provider` picker + setup flow reads `PROVIDER_SETUP_CONFIG`
  (`cli/src/commands/defs/model-provider-commands.ts:62-134`);
  unknown-provider message enumerates setup keys (`:96`).
- `/model` picker (operator's "/models"):
  `model-provider-commands.ts:24-60` calls `fetchGatewayModels()` (`:49`)
  and opens the picker; empty catalog degrades to exact-id free text
  (`:50-56`). No per-provider branching — catalog membership is the only
  requirement.
- Live authenticated catalog pattern:
  `cli/src/utils/openrouter-models/nous.ts:1-78` (URL via
  `deriveLiveCatalogUrl(PROVIDER_REGISTRY, 'nous')` at `:15`,
  `createLiveCatalogFetcher` with
  `resolveKey: () => process.env.NOUS_API_KEY` at `:61-66`,
  `parseNousModelsForTest` seam at `:74-77`). Shared fetcher semantics:
  cache/TTL/inflight/never-throws/degrade-to-empty
  (`live-catalog.ts:49-122`). Gateway combines sources via
  `Promise.allSettled` + sync static catalogs (`gateway.ts:161-194`);
  per-provider reset fns exist for tests (`gateway.ts:210-227`).
- Context-window lookup needs no change for `kiosapi/`:
  `toCanonicalModelId` (`lookup.ts:98-106`) strips known gateway prefixes;
  step 2 of `findContextLengthFromOpenRouter` (`lookup.ts:172-174`) strips
  ANY `^[a-z0-9-]+/` prefix, so `kiosapi/<bare-id>` resolves against the
  OpenRouter catalog automatically.
- Derived surfaces update themselves: prefixes, domains, `validProviders`,
  setup picker (`common/src/providers/derive.ts`).

## Impact Assessment

### Affected Components

- `common/src/providers/registry.ts` (+1 entry — the only common change)
- `cli/src/utils/openrouter-models/kiosapi.ts` (new, Nous-pattern fetcher)
- `cli/src/utils/openrouter-models/gateway.ts` (wire fetch + reset + comments)
- `cli/src/utils/__tests__/openrouter-models-gateway.test.ts` (KiosAPI cases
  in the shared gateway suite — corrected Loop 2, Nous precedent)
- `README.md` + `README.zh-CN.md` (provider list mentions — small touch)
- Automatic (no edits): SDK routing, key resolution, `/provider`, `/model`
  picker, settings validation, missing-key errors

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists — new user-facing surface;
  additive only, degrade paths pre-exist (free-text `/model <id>`,
  fail-closed key errors)
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Path A (registry-only) + Nous-pattern authenticated live catalog. No
`llm-providers` shim (OpenAI protocol is fully covered by the generic
factory), no protocol-map work (single `openai` protocol), no
`isKiosapiModel`-style helper (routing loop is generic; per-provider
`isXModel` helpers are optional conveniences, not load-bearing).

### Steps

1. `implemented` — Add the `kiosapi` entry to `PROVIDER_REGISTRY`
   (`common/src/providers/registry.ts`), exact draft:
   `id: 'kiosapi'`, `label: 'KiosAPI'`, `kind: 'gateway'`,
   `credentials: { envVar: 'KIOSAPI_API_KEY', missingKeyMessage: 'KiosAPI
   key not set. Set KIOSAPI_API_KEY environment variable or run /provider
   kiosapi.' }`,
   `baseUrl: 'https://kiosapi.com/v1'`, `protocol: 'openai'`,
   `idTransform: 'strip'`,
   `catalog: { source: 'live', url: 'https://kiosapi.com/v1/models' }`,
   `setupAvailable: true`, `domain: 'kiosapi.com'`, `order: 4`.
2. `implemented` — New `cli/src/utils/openrouter-models/kiosapi.ts`:
   `createLiveCatalogFetcher` with
   `deriveLiveCatalogUrl(PROVIDER_REGISTRY, 'kiosapi')` (throw-if-absent
   guard like `nous.ts:15-20`),
   `resolveKey: () => process.env.KIOSAPI_API_KEY`, parser prefixing
   `kiosapi/` onto bare upstream ids, `parseKiosapiModelsForTest` seam.
   Follow `nous.ts` EXACTLY (Law 11). **GLM guarantee:** the parser MUST be
   pass-through — no id allowlist/denylist, no modality filtering that could
   drop a GLM/free entry; unix-seconds `created` normalizes to ISO (never
   drops the entry).
3. `implemented` — Wire into `gateway.ts`: import fetch/getCached/reset,
   add to the `Promise.allSettled` tuple + fulfilled-fallback + `combined`
   list, extend `__resetOpenRouterModelsCacheForTest`, update the
   header/provider-list comments; barrel-export from
   `cli/src/utils/openrouter-models.ts` (Nous precedent).
4. `implemented` — Tests in the shared
   `openrouter-models-gateway.test.ts` suite (corrected Loop 2 — Nous tests
   live there, not in a new file): parser contract incl. `kiosapi/`
   prefixing + GLM-5.3-free preservation + unix-`created` normalization, no
   network; combined-catalog inclusion with mocked Bearer auth; persisted-key
   refresh via `credentials.json`; 401 failure isolation.
5. `implemented` — Docs: KiosAPI added to the gateway provider lists in
   `README.md` and `README.zh-CN.md`, one line each.
6. `implemented` — Verify: 6a (static gates, picker smoke via tests,
   reachability grep) `implemented` — see Loop 2 AUDIT. 6b (live authed
   probe + chat round-trip) `implemented` — operator live test 2026-09-05
   ("kiosapi works"). GLM-5.3-free carriage rides the pass-through parser
   (cannot be dropped client-side); escalate-if-absent rule stands.

### Verification

Gates (below) + live authed probe + picker smoke + reachability grep.
Receipt stamped post-implementation via
`bun run fid:verify <fid-path> --write`; KiosAPI suite lives in the already
gated gateway test file, so no gate-path changes were needed.

## Verification Gates

- gate: typecheck common
- gate: typecheck cli
- gate: typecheck sdk
- gate: test common/src/providers/__tests__/provider-registry.test.ts
- gate: test common/src/providers/__tests__/validate-provider-registry.test.ts
- gate: test cli/src/utils/__tests__/openrouter-models-gateway.test.ts

### Verification Receipt

- fingerprint: _pending (stamp blocked — see typecheck common note)_
- verified: _pending_
- typecheck common: PARTIAL (touched files clean; pre-existing untouched failure — see Loop 2)
- typecheck cli: exit 0
- typecheck sdk: exit 0
- test common/src/providers/__tests__/provider-registry.test.ts: 21 pass / 0 fail (both suites, 224 expects)
- test common/src/providers/__tests__/validate-provider-registry.test.ts: included above (21 pass / 0 fail)
- test cli/src/utils/__tests__/openrouter-models-gateway.test.ts: 12 pass / 0 fail (4 new KiosAPI tests)
- eslint (7 touched files, --max-warnings 0): exit 0
- prettier (touched files + READMEs): clean
- lint:md: exit 0 (this FID rewrapped in Loop 2)

## Perfection Loop

### Loop 1 — RED

- **RED:** Surface inventory for "provider + model selection + picker +
  project-wide": (a) request routing, (b) key resolution, (c) `.env.local`
  loading, (d) CLI key submission/persistence, (e) setup picker, (f) live
  catalog fetch, (g) gateway combine, (h) `/model` picker, (i)
  context-window lookup, (j) missing-key errors, (k) docs lists. All mapped
  to generic loops except (f), which needs one provider fetcher module.
  Open risks: service-identity confusion (.com vs .id); authed `/v1/models`
  response shape unverified (no key); static-fallback trigger undefined.
- **GREEN:** Path A + Nous-pattern fetcher (Steps 1-6 above). Service
  identity pinned to kiosapi.com per operator URL + confirmation. Live
  catalog chosen (endpoint proven to exist via 401 probe); static fallback
  (`MODEL_CATALOGS` + `static-catalogs.ts` entry) documented as contingency
  if the authed shape proves unusable — requires an operator-supplied model
  list. Docs touch scoped to provider-list lines.
- **AUDIT:** Every load-bearing claim cites `file:line` in §Evidence
  (routing loop, key resolution, env loading, setup derivation + validation
  rule, picker handlers, fetcher + combine, lookup fallback). Gate
  workspaces all in `VALIDATION_WORKSPACE_POLICY`
  (`scripts/validation-gates.ts:22-63`); gate test paths confirmed present
  by grep. No code written — nothing to double-audit at runtime yet.
- **ADVERSARIAL:** (1) Wrong-service risk (.id) — neutralized by operator
  confirmation + distinct key prefixes (`sk-` vs `kios_live_`). (2)
  Auth-catalog failure modes — neutralized by fetcher degrade-to-empty +
  existing free-text fallback (`model-provider-commands.ts:50-56`). (3)
  Scope creep (shim/helpers/Anthropic-native format) — rejected under YAGNI
  with reasons recorded. (4) `order: 4` default-tie — matches five existing
  providers; picker order is cosmetic, routing order is a documented no-op.
- **CHANGE DELTA:** Initial authoring (no prior revision).

### Missed Questions

> Answered with the most robust default derivable from inspection; operator
> confirmations folded back into Scope/Steps.

1. kiosapi.com vs kiosapi.id? → Operator confirmed **kiosapi.com**; evidence
   shows distinct services.
2. Env var name? → Operator confirmed **`KIOSAPI_API_KEY`** (matches
   `<PROVIDER>_API_KEY` convention).
3. `.env.local` + CLI submission? → Operator confirmed both; verified
   zero-extra-code (`load-dev-env.ts:92-95`,
   `provider-key-store.ts:27,119-186`).
4. `/provider` picker visible? → Yes (`setupAvailable: true`); required
   `credentials.envVar` present per `validate.ts:144-149`.
5. Live vs static catalog? → **Live** (Nous pattern); endpoint existence
   proven (401 probe). Static fallback contingency recorded.
6. `strip` vs `keep`? → **`strip`**: docs send bare upstream ids;
   user-facing `kiosapi/<model>` strips to the bare id, same class as
   tokenrouter/nous.
7. "/models cmd" naming? → Actual command is **`/model`**
   (`model-provider-commands.ts:24`); operator said "go" with the flag
   standing — proceeding on `/model` as the intended surface.
8. Key format `sk-` vs `sk-kilo-`? → Docs show both prefixes; client sends
   Bearer opaquely, no client-side validation — no impact.
9. `isKiosapiModel` helper? → Not needed for routing (generic loop);
   skipped under YAGNI unless a consumer needs special-casing.
10. GLM-5.3-free guaranteed? → Operator hard requirement (2026-09-05).
    Verdict: guaranteed **iff KiosAPI serves it** — the pass-through parser
    (Step 2) cannot drop it, and Step 6 asserts its presence live. Exact
    KiosAPI id unverifiable keyless (conventions seen:
    `z-ai/glm-5.3-free` on TokenRouter, `zai/glm-5.3` on kiosapi.id, bare
    `claude-sonnet-4-6` in kiosapi.com docs — three different prefix
    styles). If absent from the catalog, escalate rather than pin a dead id.

### Implementation Evidence (REQUIRED for `closed`)

> Implementation complete; live verification discharged by operator live
> test 2026-09-05 ("kiosapi works"). Status `closed` 2026-09-05.

- [ ] **Commit SHA:** _pending_ — no commit made; operator executes git (G1)
- [x] **File:line ranges:**
  `common/src/providers/registry.ts:186-205` (entry),
  `cli/src/utils/openrouter-models/kiosapi.ts:1-97` (fetcher),
  `cli/src/utils/openrouter-models/gateway.ts:3,11-13,137,168-173,188-191,203,227`
  (wiring), `cli/src/utils/openrouter-models.ts:5,27-32` (barrel),
  `cli/src/utils/__tests__/openrouter-models-gateway.test.ts:1,11-18,250-401`
  (4 tests), `common/src/providers/__tests__/provider-registry.test.ts`
  (ten/eight/kiosapi assertions), READMEs (1 line each),
  `cli/src/components/model-picker-grouping.ts:27-28` (comment)
- [x] **Gate output:** pasted in Loop 2 AUDIT below
- [x] **Reproducibility:** `kiosapi|KiosAPI|KIOSAPI` greps hit all touched
  files (58 cli matches, 19 common matches — Loop 2)
- [x] **Step statuses:** 1-5 `implemented`; 6a `implemented`; 6b `blocked`
  (operator key required)

### Code Verification Evidence

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution (one Loop-2 correction:
  tests live in the shared gateway suite, not a new file — Nous precedent,
  Law 11)
- [x] Typecheck/tests/lint pass with pasted tool output (Loop 2 AUDIT;
  common typecheck partial — pre-existing failure documented, not mine)
- [x] Production call-graph evidence is present for new wiring (grep:
  registry → routing loop; fetcher → gateway combine → picker)
- [x] FID status reflects the actual implementation state (`fixed`:
  implemented + static gates pass, live verification outstanding)

> Every PASS and FAIL in AUDIT cites `path/to/file.ts:LINE` plus quoted code
> or exact command output. Absence-shaped checks paste the exact search and
> mark out-of-reach evidence `NEEDS-REVIEW`.

### Loop 2 — Implementation audit and self-correction

- **RED:** (1) Parity suites hardcoded provider lists (2 failures on first
  run — expected, in-scope). (2) One CLI typecheck error: test-only
  `owned_by` key absent from the response type. (3) Prettier flagged
  `kiosapi.ts`. (4) `lint:md` failed repo-wide on this FID alone (40×
  MD013) — sole offender in the repo. (5) Common typecheck red in untouched
  `model-config.test.ts` (TS2593/TS2304). (6) Live authed shape + GLM
  presence unverifiable without operator key.
- **GREEN:** (1) Parity tests updated to ten/eight + kiosapi assertions
  (registry header comment 5-way → 6-way tie). (2) Dropped `owned_by` from
  the test (Nous type has no unused fields — Law 11). (3) Prettier
  `--write` + re-check clean. (4) Full FID rewrap to ≤120 cols (this
  revision). (5) NOT fixed — recorded `[OPEN-OUT-OF-SCOPE]` in SCOPE.md
  (untouched file, unrelated error class; silent fixing would violate
  Law 2). (6) Step 6b `blocked` on operator key; escalate-if-absent rule
  stands. Correction: Step-4 test placement new-file → shared suite (Law
  11, Nous precedent); receipt section records partial common typecheck
  honestly.
- **AUDIT:** typecheck cli exit 0; typecheck sdk exit 0; common provider
  suites 21 pass / 0 fail (224 expects); catalog family 28 pass / 0 fail
  across 5 files; gateway suite 12 pass / 0 fail (31 expects, 4 new);
  eslint 7 files exit 0; prettier all-touched clean; `lint:md` re-run
  pending this revision. Reachability: `kiosapi` grep →
  `registry.ts:186-205`, `kiosapi.ts:20,65-67,80-84`,
  `gateway.ts:11-13,137,168-173,188-191,203,227`, picker via `fetchGatewayModels`
  (`model-provider-commands.ts:49`), routing via prefix loop
  (`model-provider.ts:86-99`), setup via `deriveSetupConfig`
  (`provider-key-store.ts:27`). Zero production callers missing.
- **ADVERSARIAL:** Could the registry entry break the SDK factory?
  `createProviderModel` handles single-`openai`-protocol + `strip` with no
  special cases (nous precedent) — no. Could `order: 4` break picker
  grouping? `deriveProviderOrder` returns the entry value; grouping sorts
  ties alphabetically — no. Could the live fetch leak the key? Headers go
  only to the registry URL over HTTPS; failures log redacted
  (`live-catalog.ts:93-97`). Residual: live shape + GLM carriage —
  explicitly blocked, not assumed.
- **CHANGE DELTA:** Full-document revision (implementation + rewrap);
  converges on green `lint:md` + documented partials.

### Loop 3 — Final convergence (closure)

- **RED:** Sole outstanding item after Loop 2 was Step 6b — live authed
  probe + chat round-trip with the operator key. No new findings.
- **GREEN:** No code change required; Loop 2 state stands.
- **AUDIT:** Ground-truth re-verification at closure: registry entry live
  (`registry.ts:190-205`), fetcher on disk
  (`cli/src/utils/openrouter-models/kiosapi.ts`), gateway wiring intact;
  fresh gate re-runs — common provider suites 24 pass / 0 fail (244
  expects), gateway suite 16 pass / 0 fail (42 expects), sdk free-mode 4
  pass / 0 fail. Operator live test ("kiosapi works") discharges the
  live-verification boundary.
- **ADVERSARIAL:** GLM-5.3-free carriage remains upstream-dependent (the
  pass-through parser cannot drop it; escalate-if-absent rule stands).
  Commit SHA pending — operator executes git (G1); working-tree evidence
  until committed.
- **CHANGE DELTA:** Status/Resolution/Lessons closure bookkeeping only;
  no implementation change from Loop 2.

## Resolution

- **Closed Date:** 2026-09-05
- **Fix Description:** KiosAPI provider added (registry + live catalog +
  picker wiring + tests + docs)
- **Tests Added:** Yes — 4 KiosAPI tests in the shared gateway suite
  (parser incl. GLM-5.3-free preservation, combined-catalog inclusion,
  persisted-key refresh, failure isolation) + kiosapi assertions in
  `provider-registry.test.ts`
- **Verification Evidence:** Loop 2 AUDIT (static gates) + closure re-runs
  (common 24/0, gateway 16/0, sdk free-mode 4/0) + ground-truth grep
  (registry/fetcher/gateway wiring) + **operator live test 2026-09-05**
  ("kiosapi works")
- **Archived:** 2026-09-05 → `dev/fids/archive/`; CHANGELOG entry appended

> When status is set to **closed**, move this file to `dev/fids/archive/`
> and append an entry to `CHANGELOG.md`.

## Lessons Learned

Provider live-confirmation is the acceptance authority for gateway
integrations: static gates + keyless probes proved structure, but only the
operator's keyed live test closed the FID. GLM-5.3-free carriage is a
client-side pass-through guarantee, not an upstream contract — escalate if
the catalog ever omits it rather than pinning a dead id.

### Post-`fixed` addendum (2026-09-05, during FID-2026-0905-003 work)

- **Gap found and fixed:** the provider-audit suite
  (`provider-audit.test.ts`, not in this FID's gate list) failed after
  implementation — the KiosAPI `live-catalog` exception had no manifest
  entry. Added the kiosapi manifest entry (Nous mirror); full provider
  dir green. Lesson folded into FID-2026-0905-003 process notes:
  new-provider checklists must include the manifest + the whole test dir.
- **KiosAPI isolation test hardened:** bare `process.env` assignment
  leaked across test files in combined runs (broke an unrelated setup
  test); converted to save/restore try/finally. Pre-existing Nous twin
  left untouched (flagged out-of-scope).
