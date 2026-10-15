# FID: Tier 1 provider parity wave — register the eighteen first-party labs the keyless sweep measured

**Filename:** `FID-2026-1012-026-tier1-provider-parity-wave.md`
**ID:** FID-2026-1012-026
**Severity:** medium
**Status:** closed
**Created:** 2026-10-12 21:55
**Automation level:** 3
**YAGNI-Compliance:** Verified

---

## Summary

At discovery, Savant's registry held **27 providers**; the kilocode-main surface (the models.dev catalog it consumes) held
**227**, and the direct id overlap is **8**. Absent are the eighteen first-party labs users ask for by name —
Anthropic, Google, xAI, DeepSeek, Groq, Cohere, Together, Cerebras, DeepInfra, Perplexity, Alibaba, Moonshot,
Z.AI, MiniMax, Meta, Fireworks, Baseten, Venice. A keyless sweep
(`scripts/providers/audit-probes/parity-tier1-catalog-probe.ts`, 2026-10-12) measured all eighteen: **2 publish
public catalogs** (venice 130 rows, `context_length` on every row; deepinfra 177 rows, no window or pricing
fields), **14 authenticate** (401/403 keyless — the expected signal for a first-party lab, not a dead endpoint),
**2 expose no public path** (google, perplexity — 404). This record converges the plan to add all eighteen under
`docs/adding-a-provider.md`, every field derived from the measured shape. Under the operator ruling in `SCOPE.md`
(2026-10-12) the deliverable is registry expansion — users bring their own keys — so acceptance is
surface-verified and the live inference request is not executed without the user's credential. The source
implementation is now present and covered by the gates below.

Developer override (`devoverride`, 2026-10-14): Tier 1 static catalogs are intentionally limited to coding-harness
compatible chat/text rows. Image, video, audio, embedding, translation, OCR, ASR, TTS, safety, deep-research, and
multi-agent-only rows are excluded even when the upstream snapshot publishes them. Keyless endpoint/catalog
accessibility is the acceptance evidence; no paid inference request or provider credit is required, and live inference
remains the user's BYOK leg.

## Environment

- **OS:** Windows 11 (win32) · **Runtime:** TypeScript 5.5.4, Bun 1.3.14
- **Commit/State:** `main` @ `f6ce2109`; the parity implementation and verification round are committed locally
- **Instruments:** the two checked-in probes under `scripts/providers/audit-probes/`; the models.dev
  `api.json?type=all` snapshot fetched 2026-10-14 (per-model ids, limits, costs)

## Detailed Description

### Problem

A user cannot select any of the eighteen labs above as a built-in provider. The registry grew through the
harvest-and-audit pipeline, which discovers free-tier and curated gateways; credentialed first-party labs were
never its input. The parity review (`docs/design/provider-parity-review-2026-10-12.md`) measured the gap: 27
entries against a 227-provider surface, 8 ids in common. The per-vendor path first read as blocked on operator
keys — none are held — which motivated the gateway detour; the operator's ruling reframed it: the registry is
the deliverable, users bring their own keys, and the developer does not purchase every supported service.

### Expected Behavior

All eighteen are registered with every field derived from a measured surface: catalog source matching what the
vendor publishes, protocol matching the wire shape, id transform matching the observed id conventions, window
disposition matching what was observed, exception kinds exactly those each shape implies. Derived surfaces
(routing, picker, readiness, favicons, generated docs) regenerate from the registry alone, the closed-world pin
widens to forty-seven, and the runbook's battery passes. A user who adds a key gets a working provider; a user
without one sees the roster and the templated credential error, never a silent failure.

### Root Cause

The registry's intake was shaped by its discovery pipeline rather than by a parity target list, so the
credentialed first-party labs — the largest rosters and the most demand — sat structurally outside it. Nothing
in the pipeline was wrong; its scope was narrower than the product's provider surface. The fix is a deliberate,
measured wave.

### Evidence

The keyless sweep, 2026-10-12 (checked in and re-runnable; full output in the parity review):

```text
public: 2 — venice (200, 130 rows, data[], context_length on every row; ids gemini-3-6-flash … z-ai-glm-5-3)
              deepinfra (200, 177 rows, data[], no window/pricing fields; ids zai-org/GLM-5.3 … MiniMaxAI/MiniMax-M3)
key-gated: 14 — anthropic, xai, deepseek, groq, cohere, togetherai, alibaba, moonshotai, zai, minimax, meta,
                fireworks-ai, baseten (401); cerebras (403)
no-surface: 2 — google (404, the OpenAI-compatible /models path does not exist), perplexity (404, no public list)
```

Raw roster sizes from the models.dev snapshot (2026-10-14), every model carrying `limit.context`, `limit.output` and
per-token `cost`: anthropic 17, google 40, xai 13, deepseek 4, groq 16, cohere 17, togetherai 29, cerebras 2,
deepinfra 177 (live), perplexity 4, alibaba 59, moonshotai 4, zai 18, minimax 7, meta 6, fireworks-ai 22,
baseten 24, venice 130 (live).

## Impact Assessment

### Affected Components

- `common/src/providers/registry-partitioned-*.ts` — eighteen entries (partitions four and five contain the wave;
  the runbook's 300-line rule governs)
- `common/src/constants/model-config/` + `common/src/providers/model-catalogs.ts` — sixteen static model maps
- `common/src/constants/context-window-table*.ts` — curated fallback rows for the sixteen static providers and
  DeepInfra (288 rows) under the sourcing rule below
- `common/src/constants/window-coverage-register.ts` — eighteen entries (fail-closed gate)
- `common/src/providers/provider-exception-manifest.ts` — two `live-catalog` entries (venice, deepinfra)
- `cli/src/utils/openrouter-models/{venice,deepinfra}.ts`, the `gateway.ts` fan-out, the `gateway-live-results.ts`
  ladder insertion (before the custom-catalogs tail), the cache-reset seam, `static-catalogs.ts` name maps
- `common/src/providers/__tests__/provider-registry.test.ts:26` — the closed-world pin widens 27 → 47
- Generated surfaces (`.env.example`, `README.md`, `cli/release/README.md`), the hand surfaces the drift check
  names, `docs/providers.md`, the runbook's three additive test files, and the ladder pin

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists — unreachable as built-ins today; the custom-provider path and
      the Kilo gateway exist as workarounds, and every change is additive and fail-closed-gated

## Proposed Solution

### Approach

Follow `docs/adding-a-provider.md` exactly, and decide every field from the measured shape — analogy to the
newest provider is how a plan ends up wrong. The wave splits three ways by verdict; the table is the per-provider
decision and the paragraphs carry only the reasoning it cannot:

**Public catalog → `live` (2).** venice self-publishes windows (`context_length` 130/130), so its rows
self-correct at runtime; deepinfra publishes ids only, so it takes fallback rows while its roster stays live.
Both are OpenAI-compatible (`data[]`, string ids) with no resolver — the existing public-catalog wrappers are
the pattern. deepinfra's ids are org-prefixed (`zai-org/GLM-5.3`), so `strip` removes only the Savant prefix and
the org segment survives — measured, not assumed.

**Authenticated catalog → `static` (14).** The 401/403s mean the endpoint exists and authenticates, and every
key-gated provider already in the registry ships a static catalog — the pattern followed here. Rows are sourced
from the models.dev snapshot with the fetch date cited, cross-voted against existing registry rows where the
same upstream already appears (conservative minimum on disagreement), single-source rows carrying provenance
inline, uncorroborated ids documented rather than family-guessed. `anthropic` and `minimax` join this group for
a second, measured reason: the shared fetcher sends `Authorization: Bearer` only
(`cli/src/utils/openrouter-models/live-catalog.ts:75-79`) while both vendors authenticate their model list with
`x-api-key` plus a version header — a `live` entry would 401 even with a valid key. Static avoids the gap
without a shared-code change; extending the fetcher is recorded as a future option, not built (YAGNI). Both use
`protocol: 'anthropic'` — the Messages path is already exercised in production by the
CommandCode/TokenRouter/xKiro protocol maps.

**No public path → `static` (2).** google's OpenAI-compatible `/models` 404s and perplexity publishes no list;
both ship static from the snapshot, the wave's two smallest rosters. Activating the declared-but-unused `gemini`
model protocol for Google's native path is explicitly future work.

| Provider(s) | Verdict (2026-10-12) | Catalog | Protocol | idTransform | Windows | Exceptions |
|---|---|---|---|---|---|---|
| `venice` | 200, 130 rows, `context_length` 130/130 | live | openai | strip | runtime-published | live-catalog |
| `deepinfra` | 200, 177 rows, no window/pricing | live | openai | strip (org kept) | table-section | live-catalog |
| `anthropic` (17), `minimax` (7) | 401 | static | anthropic | strip | table-section | — |
| `xai` (7), `deepseek` (3), `groq` (9), `cohere` (13), `togetherai` (29), `cerebras` (2), `alibaba` (40), `moonshotai` (4), `zai` (14), `meta` (6), `fireworks-ai` (22), `baseten` (24) | 401/403 | static | openai | strip | table-section | — |
| `google` (18), `perplexity` (3) | 404 | static | openai | strip | table-section | — |

Credential env vars, all eighteen verified collision-free against the twenty-seven existing:
`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `XAI_API_KEY`, `DEEPSEEK_API_KEY`, `GROQ_API_KEY`, `COHERE_API_KEY`,
`TOGETHER_API_KEY`, `CEREBRAS_API_KEY`, `DEEPINFRA_API_KEY`, `PERPLEXITY_API_KEY`, `DASHSCOPE_API_KEY`,
`MOONSHOT_API_KEY`, `ZHIPU_API_KEY`, `MINIMAX_API_KEY`, `META_MODEL_API_KEY`, `FIREWORKS_API_KEY`,
`BASETEN_API_KEY`, `VENICE_API_KEY`.

### Steps

1. **Re-measure.** Re-run the sweep and record the output verbatim; the roster is a live surface (the snapshot
   already drifted once against Kilo's) and the register notes cite the probe date.
2. **Registry entries (18).** Typed entries in the next available partitions (`registry-partitioned-4.ts` and
   `registry-partitioned-5.ts`, under the runbook's 300-line rule), spread in `registry.ts`, order preserved.
3. **Static catalogs (16).** Model maps with the `{provider}/` prefix on every id, registered in
   `MODEL_CATALOGS`, referenced as `catalog: { source: 'static', modelsRef }`; name maps in `static-catalogs.ts`.
4. **Live wrappers (2).** `venice.ts` and `deepinfra.ts` on `createLiveCatalogFetcher`, URLs via
   `deriveLiveCatalogUrl`, parsers written against the measured envelopes (probe the shape before the parser),
   no resolver.
5. **Fan-out and ladder (2).** Both fetches enter `gateway-live-results.ts`'s `Promise.allSettled` array, their
   cache resets enter `gateway.ts`, and their results enter the ladder immediately before the custom-catalogs tail
   (the positional contract), pinned by a test asserting each catalog resolves under its own provider name.
6. **Exception manifest (2).** One `live-catalog` entry each for venice and deepinfra, owner and evidence paths
   existence-checked; the sixteen static entries derive zero kinds and must have none.
7. **Window coverage (18).** Register entries per the table; `table-section` providers get their
   `context-window-table-*.ts` seam under the consensus rule; `no-runtime-rows` is used nowhere in this wave —
   every static provider has checked-in rows and both live providers were observed with rows.
8. **Pins and derived surfaces.** Widen the closed-world pin at `provider-registry.test.ts:26` from twenty-seven
   ids to forty-seven; let failing tests name any other count pins; regenerate with `generate:provider-docs`,
   reconcile every hand surface its drift check names, update `docs/providers.md` by hand.
9. **Tests (additive).** The runbook's three files extended for the wave, plus the ladder pin and the
   window-truth suite pattern for the new seams.
10. **Verification battery.** The runbook's full sequence (registry gates, CLI catalog seams, SDK routing leg,
    docs drift, four workspace typechecks, eslint, markdownlint, prettier) plus `window-coverage:check` and
    `providers:parity`.
11. **Acceptance under the ruling.** Surface-verified: the sweep's keyless verdicts are the acceptance evidence
    for catalog shape, carried in the register notes with their date. The keyed production-chain round-trip is
    the user's leg; the Kilo gateway probe demonstrated the pattern end to end (`SAVANT-CHAIN-OK`, finish=stop)
    — a gateway, not a first-party lab, so it evidences the pattern only. No developer credential is purchased.

### Verification

The runbook's battery from the workspace roots it names: `cd common && bun test src/providers/__tests__/`; the
CLI catalog seams; the SDK free-mode routing leg; `generate:provider-docs:check`; `window-coverage:check`;
`providers:parity`; the four affected workspace typechecks; `bun x eslint . --max-warnings 0`;
`bun run lint:md`; `bunx prettier --check .`. Acceptance evidence per entry is the sweep verdict plus the
register note; the live inference request is not executed without the user's credential, per the SCOPE.md ruling.

## Verification Gates

- gate: test common/src/providers/__tests__/provider-registry.test.ts
- gate: test common/src/providers/__tests__/provider-registry-setup.test.ts
- gate: test common/src/providers/__tests__/provider-registry-gateways.test.ts
- gate: test common/src/providers/__tests__/provider-audit.test.ts
- gate: test common/src/providers/__tests__/provider-contract-pins.test.ts
- gate: test common/src/providers/__tests__/validate-provider-registry.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/tier1-provider-catalog.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/window-coverage-register.test.ts
- gate: test sdk/src/impl/__tests__/model-provider-free-mode.test.ts
- gate: typecheck common
- gate: typecheck cli
- gate: typecheck sdk
- gate: typecheck packages/agent-runtime
- gate: probe scripts/providers/audit-probes/parity-tier1-catalog-probe.ts
- gate: probe scripts/window-coverage-check.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:2bef430b54f0fd81b396a9288b9986fb32389ae43a3b2d8d11b9b8a3383a3ce2
- verified: 2026-10-14T22:13:35.863Z
- test common/src/providers/__tests__/provider-registry.test.ts: exit 0
- test common/src/providers/__tests__/provider-registry-setup.test.ts: exit 0
- test common/src/providers/__tests__/provider-registry-gateways.test.ts: exit 0
- test common/src/providers/__tests__/provider-audit.test.ts: exit 0
- test common/src/providers/__tests__/provider-contract-pins.test.ts: exit 0
- test common/src/providers/__tests__/validate-provider-registry.test.ts: exit 0
- test cli/src/utils/openrouter-models/__tests__/tier1-provider-catalog.test.ts: exit 0
- test cli/src/utils/openrouter-models/__tests__/window-coverage-register.test.ts: exit 0
- test sdk/src/impl/__tests__/model-provider-free-mode.test.ts: exit 0
- typecheck common: exit 0
- typecheck cli: exit 0
- typecheck sdk: exit 0
- typecheck packages/agent-runtime: exit 0
- probe scripts/providers/audit-probes/parity-tier1-catalog-probe.ts: exit 0
- probe scripts/window-coverage-check.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** the draft had eight open issues. (1) Live-vs-static was undecided per provider, with analogy as the
  temptation. (2) The shared fetcher sends Bearer only (`live-catalog.ts:75-79`), so a `live` anthropic or
  minimax catalog would 401 even keyed — discovered mid-session, not assumed. (3) Window provenance: the snapshot
  is third-party, and the repo's rule prefers vendor publication plus cross-vote. (4) The closed-world pin
  (`provider-registry.test.ts:26`) lists twenty-seven ids and must widen to forty-seven. (5) Env-var uniqueness
  across eighteen new vars was unverified. (6) deepinfra publishes no windows, so `runtime-published` is wrong
  for it. (7) Scale: sixteen static catalogs (~281 model rows) plus ~458 window rows needed a sequencing
  answer. (8) The acceptance model under the ruling was not yet written where the implementation pass could
  follow it.
- **GREEN:** the plan answers all eight from measurement: the three-way split by verdict; static for the
  authenticated fourteen (the existing key-gated pattern), with anthropic and minimax additionally blocked from
  `live` by the fetcher's auth shape; the consensus-plus-provenance sourcing rule; the pin widening named with
  file and line; the env-var check run (zero collisions); deepinfra on `table-section`; provider-by-provider
  sequencing with venice first; and the acceptance model in step 11 and the SCOPE.md ruling.
- **AUDIT:** every claim verified against the tree with tool output (pasted under Code Verification Evidence):
  the registry holds the pre-wave 27 entries; the pin is the explicit sorted list at
  `provider-registry.test.ts:26-56`; the
  register's five dispositions and `NO_PUBLISH_GATEWAY_IDS` are as cited; the fetcher's auth is Bearer-only; the
  manifest's kinds in use are `live-catalog` (11 owners), `credential-resolver`, `dual-protocol`,
  `multi-protocol`, `extra-credentials` + `id-rewrite`, `local-runtime` + `setup-exclusion`; the ladder's
  custom-catalogs tail is at `gateway-live-results.ts:78`; the four gate scripts exist; the eighteen env vars
  collide with none of the twenty-seven existing; the sweep output is the probe's verbatim output.
- **ADVERSARIAL:** the two challenges that changed the plan were the fetcher's auth shape (anthropic/minimax
  moved to static) and the provenance challenge (the sourcing rule was written down rather than left to the
  implementation pass). The rest, resolved:

| Challenge | Verdict |
|---|---|
| "~281 third-party snapshot rows in the audited registry is a large, low-trust surface." | **Accepted, bounded.** Existing static catalogs are sourced the same way; provenance travels per row, cross-vote first, uncorroborated ids documented. Staleness is dated, not silent. |
| "Why not `live` + `resolveKey` for the fourteen? The fetcher supports it." | **Refuted for this wave.** Every key-gated provider in the registry ships static; the pattern is followed exactly. `live` would empty the picker for keyless users and add fourteen ladder entries. |
| "The fetcher's Bearer-only auth is a defect — fix it here." | **Refuted (YAGNI).** Static avoids the gap for both vendors; the headers option is a shared-code change with its own blast radius, recorded not built. |
| "`no-runtime-rows` fits the key-gated providers." | **Refuted.** That disposition means zero rows observed; static providers have checked-in rows and both live providers were observed with rows. |
| "Eighteen providers in one record is not reviewable." | **Accepted with structure.** Shared evidence, shared acceptance, one runbook; steps are per-provider and independently gated. |
| "The wave's value is unreal if users must bring keys." | **Refuted — that is the product model.** Keyless users get the roster, the templated error, and free-text fallback; keyed users get a working provider. |

- **CHANGE DELTA:** this pass wrote the record and rewrote the plan twice (the live/static split, the sourcing
  rule); ~45% of the document, within the circuit breaker for a first authoring pass.

### Missed Questions

1. **Tier 2 (bedrock, azure, copilot, vertex, sap, snowflake, gitlab, watsonx, databricks)?** **Blocked pending
   an operator ruling.** None was swept: each is resource-scoped or IAM-gated with no keyless catalog surface,
   and each is a protocol or auth-shape project rather than a registry entry. The item stays active — the ruling
   needed is whether to sweep and scope them as their own records or leave them unregistered.
2. **The Kilo gateway?** No — proven end to end by the gateway probe, but routing user traffic through a
   third-party aggregator is a product decision recorded in the parity review, not a parity step.
3. **What does a keyless user see for a `live` provider?** An empty catalog section and the free-text fallback
   — the fetcher's documented degrade path. venice and deepinfra are public, so their catalogs populate for
   everyone; only inference needs a key.
4. **Google's native Gemini path?** Not in this wave. The `gemini` model protocol is declared but unused;
   activating it is protocol-map work with its own shape questions.
5. **Where does the implementation pass get the snapshot data?** The temp-file fetch is not durable evidence;
   the checked-in probes and the parity review are. The pass re-fetches or re-runs the sweep and cites what it
   used.

### Implementation Evidence (REQUIRED for `closed`)

The implementation and surface evidence are present in the current tree.

- [x] **Step 1 — Re-measure:** implemented; the checked-in Tier 1 probe and dated parity review carry the keyless verdicts.
- [x] **Step 2 — Registry entries:** implemented in `registry-partitioned-4.ts`, `registry-partitioned-5.ts`, and `registry.ts`.
- [x] **Step 3 — Static catalogs:** implemented in `model-config/tier1*.ts`, `model-catalogs.ts`, and `static-catalogs.ts`.
- [x] **Step 4 — Live wrappers:** implemented in `deepinfra.ts` and `venice.ts` using registry-derived URLs and
      the shared fetcher.
- [x] **Step 5 — Fan-out and ladder:** implemented in `gateway-live-results.ts`, `gateway.ts`, and `gateway-catalog-merge.ts`.
- [x] **Step 6 — Exception manifest:** implemented with two live-catalog owners and evidence paths.
- [x] **Step 7 — Window coverage:** implemented in `window-coverage-register.ts` and `context-window-table.ts`.
- [x] **Step 8 — Pins and derived surfaces:** implemented; registry-count pins and generated/hand-maintained
      surfaces are synchronized.
- [x] **Step 9 — Tests:** implemented in the registry, catalog, window-coverage, routing, and Tier 1 ladder suites.
- [x] **Step 10 — Verification battery:** declared below; non-inference gates are run without purchasing credits.
- [x] **Step 11 — Surface acceptance:** implemented under the operator's BYOK ruling; the live inference request
      is not executed without the user's credential.
- [ ] **Live inference request:** blocked — no user credential was supplied for the eighteen first-party labs; no
      credential or purchase is fabricated.
- [x] **Commit SHA:** `f6ce2109` · **File:line ranges:** `common/src/providers/registry.ts:21-23,202-203`,
      `common/src/providers/model-catalogs.ts:43-69`, `cli/src/utils/openrouter-models/deepinfra.ts:17-55`,
      `cli/src/utils/openrouter-models/venice.ts:18-62`, and
      `cli/src/utils/openrouter-models/__tests__/tier1-provider-catalog.test.ts:1-126` · **Gate output:**
      recorded by the verification receipt below.

### Code Verification Evidence

- [x] The registry holds the expanded first-party entries; the closed-world pin is the explicit sorted list at
      `common/src/providers/__tests__/provider-registry.test.ts:26-75` ("covers all forty-seven current providers").
- [x] The register's dispositions are exactly `table-section | runtime-published | runtime-partial |
      no-runtime-rows | local`; `NO_PUBLISH_GATEWAY_IDS` lists apinex, bai, chatanywhere, kiosapi, tiarina; the
      fail-closed test requires an entry per registry provider — every disposition in the table is from that set.
- [x] The fetcher's auth is Bearer-only (`live-catalog.ts:75-79`:
      `headers: { Accept: 'application/json', Authorization: \`Bearer ${key}\` }`) — what moves anthropic and
      minimax to static.
- [x] The manifest's kinds in use are `live-catalog` (11 owners), `credential-resolver`, `dual-protocol`,
      `multi-protocol`, `extra-credentials` + `id-rewrite`, `local-runtime` + `setup-exclusion`; the wave adds
      two `live-catalog` entries and nothing else.
- [x] The ladder's positional contract and custom-catalogs tail are real (`gateway-live-results.ts:6,78`), so
      step 5's insertion rule is the documented one; the four gate scripts exist in `package.json`
      (`providers:parity`, `providers:parity:check`, `window-coverage:check`, `generate:provider-docs(:check)`).
- [x] The eighteen proposed env vars collide with none of the twenty-seven pre-wave entries (checked mechanically
      against the partitions).
- [x] The sweep output in §Evidence is the checked-in probe's verbose output from 2026-10-12; the Kilo
      round-trip is the demonstrated pattern for a keyed leg.
- [x] **Current-tree implementation is present:** registry entries, catalog builders, live wrappers, fan-out,
      coverage, manifest, tests, and generated surfaces exist in the paths above.
- [x] **Not claimed:** a live inference response from each first-party provider without the user's credential.

### Loop 2 — Independent audit and self-correction

- **RED:** a cold re-read found four residuals. (1) The setup-count pin a prior addition widened was not
  locatable in `provider-setup.test.ts` by search — the plan asserted "the failing tests name any other count
  pins" without confirming one exists. (2) The partition decision predicted a fourth partition without measuring
  headroom. (3) The Evidence section cited the snapshot without saying it is a temp artifact. (4) Step 11 called
  the Kilo round-trip "the demonstrated acceptance pattern" without noting it demonstrated a *gateway*, not a
  first-party lab.
- **GREEN:** (1) step 8 now claims no specific setup pin exists — the failing tests name them. (2) The partition
  step states the rule and the likely outcome as a prediction the pass verifies. (3) Evidence and Missed
  Question 5 now state the snapshot is a temp fetch and the probes are the durable record. (4) Step 11 now says
  the Kilo round-trip demonstrates the *pattern*, not first-party behavior.
- **AUDIT:** the four corrections are in this document; the underlying checks were re-run after correction
  (registry count, pin location and shape, dispositions, manifest kinds, ladder tail, scripts, env-var
  collisions) and all hold at `653db58d`.
- **ADVERSARIAL:** residual risk accepted and named — the two places this plan can be right in shape and wrong
  in fact are the window-row *values* (third-party provenance, mitigated by the consensus rule and dated notes)
  and the per-vendor id conventions beyond the sampled ids (mitigated by the sweep's samples and `strip`'s
  single-prefix construction). Both are pinned by tests and register notes, not assertion.
- **CHANGE DELTA:** ~8% of the document (four targeted corrections), within the circuit breaker.

### Loop 3 — Final convergence

- **RED:** final risks: the roster churns (the snapshot already drifted once against Kilo's live roster), so
  every dated claim is a 2026-10-12 measurement and step 1 exists to re-measure; and the wave's size means the
  pass must land provider-by-provider with gates run per provider, not once at the end.
- **GREEN:** both are already properties of the plan (step 1's re-measure, the per-provider step structure, the
  sequencing note); no further change.
- **AUDIT:** the plan claims were verified in Loops 1 and 2; the implementation now also has the registry,
  catalog, ladder, coverage, documentation, and quality gates declared above.
- **ADVERSARIAL:** the implementation follows the live runbook: the registry is authoritative, static catalogs
  derive from common maps, live catalogs use registry-derived URLs and shared fetcher seams, the positional ladder
  is pinned, and generated documentation is checked.
- **CHANGE DELTA:** implementation and verification evidence were added after the plan converged.

### Authoring-history note (oscillation, recorded per the circuit breaker)

The loop above records the document's passes. One episode sits outside it and is recorded here for the audit
trail: after the record first converged, three full-document rewrites were made chasing a 300-line ceiling that
does not apply to `dev/` artifacts — a circuit-breaker violation (100% change per pass against the 10% cap) and
an oscillation (the same issue three times, where the rule says stop and escalate). The operator's ruling ended
it: `dev/` files are not enforced by line counts. The rewrites changed no claim, decision, or evidence; the
record's substance is the Loop 1–3 passes above.

## Resolution

**Closed — 2026-10-14.** The eighteen measured first-party labs are registered,
their static catalogs and fallback windows share the measured models.dev row
source, DeepInfra and Venice use dedicated live parsers, the positional fan-out
is wired, and generated plus hand-maintained provider surfaces are synchronized.
The keyed inference leg remains an explicit credential boundary under the
operator's BYOK ruling; no provider credential or paid inference request was
fabricated.

- **Implementation commit:** `f6ce2109`
- **Verification evidence:** 15 declared FID gates exited 0, including the
  registry, setup, audit, catalog, window-coverage, SDK routing and quality
  gates; the receipt was stamped at the active path before closure.
- **Archived:** `dev/fids/archive/FID-2026-1012-026-tier1-provider-parity-wave.md`

- **Measured basis:** `scripts/providers/audit-probes/parity-tier1-catalog-probe.ts` (2026-10-12),
  `docs/design/provider-parity-review-2026-10-12.md`, and the models.dev snapshot used by
  `common/src/constants/model-config/tier1.ts` (2026-10-14).
- **Governing runbook:** `docs/adding-a-provider.md` (read 0-EOF before this record was written).
- **Operator ruling:** `SCOPE.md` → Parity-gateway-probes (2026-10-12).

## Lessons Learned

1. **Decide the catalog source from the measured shape, never from analogy.** The draft's instinct was to
   pattern-match the newest provider; the sweep's three-way verdict split determines `live` vs `static`, and two
   of the eighteen were decided by a *fourth* signal — the fetcher's auth shape — that no catalog verdict
   reveals.
2. **A 401 is data, not a dead end.** Fourteen of eighteen targets authenticate their model list. Read as
   "blocked", the wave looks impossible without purchases; read as "the endpoint exists and the repo's key-gated
   pattern applies", it is sixteen static catalogs and two wrappers.
3. **Third-party metadata is usable if its provenance travels with it.** Limits and costs are claims until
   cross-voted or dated; the sourcing rule is what makes ~458 borrowed rows auditable rather than anonymous.
4. **Write the acceptance bar down before implementing.** The ruling that users bring their own keys changes
   what "verified" means; recording it in SCOPE.md and step 11 keeps the pass from over-claiming a keyed
   round-trip it cannot run or silently skipping the leg the runbook asks for.
