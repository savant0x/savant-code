# FID: Clean APIs (cleanapis.com) as a built-in provider

**Filename:** `FID-2026-0927-005-cleanapis-provider.md`
**ID:** FID-2026-0927-005
**Severity:** low
**Status:** closed
**Created:** 2026-09-27 19:05
**Automation level:** 3

> **Status: `closed` (2026-09-27) — archived.** Implemented RED-first against
> the runbook, audited, and **live-verified end to end** with a real key —
> authenticated catalog (200, 33 models) and a real inference completion
> (200 OK). The one defect the live data exposed — the nested-shape mapping gap
> that left `topProvider` and `modality` at 0/33 — is **RESOLVED and measured**;
> see *Open Remediation → Resolved*.

> **Operator report (verbatim):** *"i want to add this provider
> https://cleanapis.com/, i have a doc about how to properly add providers"*
> — the doc is `docs/archive/design/Adding New Providers.md`, and this record
> follows it.

## Summary

Clean APIs added as built-in provider `cleanapis`, following the one-entry
runbook: a single registry entry in `common` plus one live-catalog wrapper in
the CLI, with the exception manifest, gateway registration, thirteen
hand-maintained doc surfaces, and eight catalog test legs completed around them.

The design decision that mattered came from the live probe, not from the
runbook: `GET https://cleanapis.com/v1/models` returns **401 keyless**, so this
is the **authenticated** live-catalog pattern (Nous / KiosAPI / B.AI), not the
keyless Vercel one. A `url`-only registry entry would have looked correct and
silently never populated.

## Environment

- **OS / shell:** Windows 11 (`win32`), Git Bash (MSYS)
- **Runtime:** Bun `1.3.14`
- **Workspaces touched:** `common` (registry + manifest), `cli` (catalog wrapper,
  gateway, tests)
- **Design system:** `savant-cyberpunk` (provider favicon domain
  `cleanapis.com`; no design-system contract change)
- **Governance:** ECHO Protocol v0.2.0, FID-bound, Law 1/3/4

## Detailed Description

### The probe that decided the design

```text
$ GET https://cleanapis.com/v1/models        (no Authorization header)
HTTP 401 Unauthorized
```

Per the runbook's discovery-pipeline vocabulary, a 401 on a model-list route is
the *healthy* boundary signal: the route exists and is auth-gated. It therefore
requires a `resolveKey` wiring — a registry `url`-only entry would degrade to an
empty catalog forever, with no error.

The site advertises an OpenAI-compatible surface and names opencode, Claude Code,
Cursor, and Kilo Code as first-class clients, so the standard OpenAI Chat
Completions path applies: `protocol: 'openai'`, base `https://cleanapis.com/v1`
(the protocol layer appends `/chat/completions`).

### Registry entry

`common/src/providers/registry-partitioned-2.ts` — one entry:

| Field | Value | Why |
|---|---|---|
| `id` | `cleanapis` | routing prefix, matches the object key |
| `kind` | `gateway` | hosted service |
| `credentials.envVar` | `CLEANAPIS_API_KEY` | single credential |
| `baseUrl` | `https://cleanapis.com/v1` | probed |
| `protocol` | `openai` | vendor-documented OpenAI compatibility |
| `idTransform` | `strip` | **confirmed by live data** — see below |
| `catalog` | `{ source: 'live', url: '…/v1/models' }` | authenticated |
| `setupAvailable` | `true` | operator ruling |
| `domain` | `cleanapis.com` | favicon |
| `order` | `4` | the intentional tie group |

The entry lives in the second partition because `registry-partitioned.ts` is at
298/300 lines; `registry-partitioned-2.ts` was nearly empty, and the partition
is spread into `PROVIDER_REGISTRY` at `registry.ts:189`, preserving `Object.keys`
order.

### `idTransform: 'strip'` — proven, not assumed

The live catalog serves **bare** upstream ids. Raw payload, verbatim:

```json
{"id":"muse-spark-1.1","object":"model","created":1787211373,
 "owned_by":"Clean APIs","name":"Muse Spark 1.1",
 "context_length":1000000,…}
```

No `openai/` or `anthropic/` vendor segment. So the picker adds `cleanapis/` and
the registry strips exactly one segment on the wire, recovering the vendor's own
id. The inference probe closes the loop: the response echoes
`"model":"claude-fable-5"` — the bare upstream id, unchanged.

### Live round-trip evidence

**Catalog** — through the real fetcher, with the operator's key:

```text
count: 33   all cleanapis-prefixed: true   hasCatalog: true
cleanapis/claude-fable-5, cleanapis/claude-fable-5.1,
cleanapis/claude-mythos-preview, cleanapis/claude-opus-4.6,
cleanapis/claude-opus-4.7, cleanapis/claude-opus-4.8,
cleanapis/claude-opus-5, cleanapis/claude-opus-5.5,
cleanapis/claude-sonnet-5, cleanapis/deepseek-v4-flash-0731, …
```

**Inference** — `POST https://cleanapis.com/v1/chat/completions`:

```json
{"id":"chatcmpl-6ab9ad1053b3f","object":"chat.completion",
 "model":"claude-fable-5",
 "choices":[{"index":0,"message":{"role":"assistant","content":"PONG"},
            "finish_reason":"stop"}],
 "usage":{"prompt_tokens":296,"completion_tokens":204,"total_tokens":500}}
```

HTTP **200 OK** — not 401 (auth), not 402 (out of credits), not 404 (unknown
model). The key is funded and the bare id is accepted.

## Root Cause

Not a defect class — this is a **feature addition**, recorded as a FID because
the runbook's own claim ("adding a provider is one registry entry") understates
the work: the entry is one line of the twelve surfaces a provider actually
touches, and the drift gate exists precisely because the other eleven are
hand-maintained and fail closed when missed.

## Impact Assessment

- **Severity:** low — additive, no existing behaviour altered. One new routing
  prefix, one new picker entry, one new env var.
- **Blast radius:** every `DiffViewer`/tool surface is untouched; the change is
  confined to provider metadata, one catalog fetcher, and documentation.
- **Failure mode if the catalog is unavailable:** degrades to an empty list (the
  shared fetcher's D10 ladder). Free-text `/model cleanapis/<id>` still routes
  through the registry, so exact-id selection does not depend on the catalog.

## Proposed Solution

Implemented, in the runbook's order:

1. Registry entry in `registry-partitioned-2.ts`.
2. `cli/src/utils/openrouter-models/cleanapis.ts` — live-catalog wrapper with
   `resolveKey: () => process.env.CLEANAPIS_API_KEY`, the Nous precedent.
3. Registered in `gateway.ts` — the `Promise.allSettled` fetch list, the
   combined-catalog spread, and `__resetOpenRouterModelsCacheForTest`.
4. Exception-manifest record with owner + evidence (required for every
   `live-catalog` entry; the manifest fails closed without it).
5. `bun run generate:provider-docs` — regenerated `.env.example` and the
   release README table.
6. Thirteen hand-maintained doc surfaces synced, named by the drift checker.
7. Eight catalog contract legs.

### A defect the tests caught — the prefix guard

The first implementation guarded the prefix:

```ts
// REJECTED — wrong for a vendor-served catalog
id: upstreamId.startsWith('cleanapis/') ? upstreamId : `cleanapis/${upstreamId}`
```

The eight-leg suite caught it, and the reasoning matters: `idTransform: 'strip'`
removes **exactly one** segment. If a vendor ever serves an id that itself begins
with `cleanapis/`, the guard leaves the picker id single-prefixed and `strip`
then sends the **wrong id on the wire** (`cleanapis/router` → `router`).
Unconditional prefixing makes the round-trip exact for every possible upstream
id.

Neither live-catalog precedent (`vercel.ts`, `orcarouter.ts`) has that guard;
the guard belongs to **custom providers**, where the operator types their own
already-prefixed ids. The code was changed, not the test — the test's
expectation was correct and the implementation was wrong.

> **Gate-section contract:** the gate parser accepts **only** `- gate:` lines
> between this heading and the next `##` — any other line in the section is a
> hard `malformed gate declaration` error, so this note sits *above* the
> heading. The gate set mirrors the known-valid Vercel precedent
> (`FID-2026-0927-001`) rather than inventing one; `typecheck scripts` is
> deliberately **absent** because `scripts` is not in
> `VALIDATION_WORKSPACE_POLICY` and the allowlist rejects it by design (the
> scripts workspace is typechecked by the root `typecheck` gate instead).

## Verification Gates

- gate: typecheck common
- gate: typecheck sdk
- gate: typecheck packages/agent-runtime
- gate: typecheck cli
- gate: test cli/src/utils/__tests__/openrouter-models-cleanapis.test.ts
- gate: test common/src/providers/__tests__/provider-registry.test.ts
- gate: test common/src/providers/__tests__/provider-contract-pins.test.ts
- gate: test cli/src/utils/__tests__/provider-setup.test.ts
- gate: test cli/src/utils/__tests__/openrouter-models-gateway.test.ts
- gate: test sdk/src/impl/__tests__/model-provider-free-mode.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:8078823f35458fc3bd45d9224ba6b16a30ad92d01d2b824b943733b413962863
- verified: 2026-09-28T00:36:57.953Z
- typecheck common: exit 0
- typecheck sdk: exit 0
- typecheck packages/agent-runtime: exit 0
- typecheck cli: exit 0
- test cli/src/utils/__tests__/openrouter-models-cleanapis.test.ts: exit 0
- test common/src/providers/__tests__/provider-registry.test.ts: exit 0
- test common/src/providers/__tests__/provider-contract-pins.test.ts: exit 0
- test cli/src/utils/__tests__/provider-setup.test.ts: exit 0
- test cli/src/utils/__tests__/openrouter-models-gateway.test.ts: exit 0
- test sdk/src/impl/__tests__/model-provider-free-mode.test.ts: exit 0
- quality: exit 0

## Step Status

- [x] Probe the live endpoint before designing — 401 keyless ⇒ authenticated
      catalog pattern
- [x] Confirm `idTransform: 'strip'` against real bare ids
- [x] Registry entry (`registry-partitioned-2.ts`, spread at `registry.ts:189`)
- [x] Live-catalog wrapper with `resolveKey`
- [x] Gateway registration (fetch list, combined spread, test reset)
- [x] Exception-manifest record (owner + evidence)
- [x] Generated docs regenerated; **13 hand-maintained surfaces** synced so the
      drift gate clears
- [x] Eight catalog contract legs, including the single-prefix guard that
      caught the implementation defect
- [x] Live round-trip: catalog 200/33 models, inference 200 OK
- [x] **Open Remediation RESOLVED** — nested-shape mapping implemented;
      `modality`, `topProvider` and pricing went **0/33 → 33/33** against the
      live payload; six new legs pinned from the **real** response

## Perfection Loop

### Missed Questions

1. **Why not a static catalog of the advertised 33 models?** The live catalog
   already serves 33, and it served models the public site does not advertise
   (`muse-spark-1.1`, `claude-opus-5.5`, `claude-sonnet-5`). A static pin would
   have been wrong on arrival and would need manual updates per vendor change.
   The operator chose live; the data supports it.
2. **Is the model window correct?** `context_length` populates 33/33 at
   1,000,000 and the vendor also sends an equal `context_window`. The standard
   name is the primary field, so the value is right; the fallback is redundant
   on this endpoint but retained for drift tolerance.
3. **Does the vendor publish a max-output limit?** No — see Open Remediation.
4. **What about the per-model `capabilities` array** (`reasoning`, `vision`,
   `tools`, `streaming`, `json_mode`)? Investigated 2026-09-27 and it is the
   **only one of the vendor's 13 fields with no home** on `OpenRouterModel` —
   the other twelve map cleanly (`top_provider` → `topProvider`, `architecture.*`
   → `modality`/`tokenizer`/`instructType`, `pricing.*` → the price fields).
   `capabilities` is read by **no parser in the repo** — `grep` for
   `capabilities` across `cli/src/utils/openrouter-models/*.ts` returns nothing,
   so no sibling catalog surfaces it either. Recorded, not adopted: adding it is
   a shared-type change, and its values overlap what `architecture.input_modalities`
   and `supported_parameters` already imply.
5. **Does the picker need a group of its own?** `order: 4` is the intentional
   tie group the runbook documents, so no.

### Code Verification Evidence

- [x] Law 4 — reachability proven **at runtime**, not by import inspection:

```text
registry entry: Clean APIs | https://cleanapis.com/v1 | openai | strip
in validProviders: true
in allowedPrefixes: true
picker order: 4
setup config: {"label":"Clean APIs","envVar":"CLEANAPIS_API_KEY",
               "baseUrl":"https://cleanapis.com/v1"}
logo domain: cleanapis.com
```

  Every derived surface resolves from the merged registry, and the catalog
  wrapper is reached from `fetchGatewayModels` (the picker/live-refresh entry
  point), not only from tests.

- [x] Typecheck — `common`, `sdk`, `cli`, `packages/agent-runtime` all exit 0.
- [x] Tests — `common/src/providers/__tests__/` **65 pass / 0 fail**;
      `cli/src/utils/__tests__/` **1479 pass / 0 fail** (158 files);
      `sdk` `model-provider-free-mode` **10 pass / 0 fail**;
      the catalog suite **14 pass / 0 fail** (8 synthetic + 6 real-payload).
- [x] Lint — `eslint . --max-warnings 0` exit 0; `lint:md` clean after two
      MD013 reflows the provider entries introduced; `prettier --check .` clean
      after formatting five files.
- [x] Doc drift — `generate:provider-docs:check` reports
      *"Provider reference docs are up to date."*
- [x] `validate:repository` PASS; `quality:report` PASS (1498 baselined).

- **RED:** complete. Two named failures captured before the fix:
  (1) the catalog suite's single-prefix leg failed
  (`Expected: ["cleanapis/router"]` vs the implementation's doubling
  behaviour under the guard); (2) `common` registry tests failed with
  *"setup config derives exactly the seventeen current setup providers"* and
  *"covers all nineteen current providers"* — the count pins, correctly
  reporting the new entry.
- **GREEN:** complete. All seven runbook steps.
- **AUDIT:** complete. The independent Verifier's central finding was adopted:
  the `startsWith` prefix guard is a **real defect** for a vendor-served
  catalog, and the fix belongs in the code rather than the test.
- **ADVERSARIAL:** complete. The standing refutation — "read
  `top_provider.max_completion_tokens` into `maxCompletionTokens`" — was
  **rejected and withdrawn**: it would have made a number appear that the
  catalog does not carry. A negative leg now pins that the parser omits the
  value rather than fabricating it.
- **COMPLETE:** reached. The remediation is closed, measured, and covered by a
  leg that would fail if the omitted value were ever synthesized.

## Resolution

- **Resolved by:** this record
- **Resolution date:** 2026-09-27
- **Verified by:** tool-mediated runs quoted in *Code Verification Evidence*
- **Verification date:** 2026-09-27
- **Verification receipt:** see `### Verification Receipt` below
- **Closed by:** this record, 2026-09-27 — the one open remediation was
  implemented and measured, not waived
- **Close date:** 2026-09-27
- **Archived:** yes — `dev/fids/archive/`, receipt re-stamped at the archived
  path
- **CHANGELOG entry:** "Clean APIs as a built-in provider" (heading updated to
  **Closed + archived 2026-09-27**)

## Open Remediation (1 item) — RESOLVED 2026-09-27

**The parser read OpenRouter field names at the top level, but this vendor
serves them nested — so `topProvider` and `modality` were never populated.**

The original finding: the parser read top-level `max_completion_tokens` /
`max_tokens`; the live payload has **neither**, so that branch populated
**0/33**. The value is nested:

```json
"top_provider": { "context_length": 1000000, "max_completion_tokens": null,
                  "is_moderated": false }
```

**Corrected after a follow-up type investigation.** The first draft of this
section recommended "read `top_provider.max_completion_tokens` into
`maxCompletionTokens`" — that is the wrong fix and is **withdrawn**.
`OpenRouterModel` already declares `topProvider`, and `openrouter.ts` and
`lookup.ts` already populate it, so the correct fix was to populate `topProvider`
the way the OpenRouter parser does — keeping every catalog on one shape.

### What was implemented

`architecture.modality` / `.tokenizer` / `.instruct_type` are one level
**deeper** than `openrouter.ts` reads them; `top_provider` and `pricing` are at
the top level as OpenRouter serves them. All are now mapped:

| Wire field | Maps to |
|---|---|
| `architecture.modality` | `modality` |
| `architecture.tokenizer` | `tokenizer` |
| `architecture.instruct_type` | `instructType` |
| `top_provider.{context_length,is_moderated}` | `topProvider.{contextLength,isModerated}` |
| `pricing.prompt` / `.completion` (decimal **strings**) | `promptPricePerToken` / `completionPricePerToken` |

`maxCompletionTokens` deliberately does **not** fall back to the nested value:
the vendor publishes no max-output (`null` on all 33 models), and routing it in
would assert a number the catalog does not carry.

### Measured against the live payload — before → after

```text
modality populated:            0/33  ->  33/33
topProvider populated:         0/33  ->  33/33
promptPricePerToken populated: 0/33  ->  33/33
maxCompletionTokens populated: 0/33  ->   0/33   (correct: source is null)
```

### Why it mattered

`model-info.ts:67-68` is the **only** production consumer of the
capability-shaped fields, and it renders `modality`:

```ts
if (model.modality) {
  lines.push(`- **Modalities:** ${model.modality}`)
}
```

So before the fix **every cleanapis model rendered with no modalities line** —
a user-visible gap that only the live probe could reveal.

### The honest part

**My own tests could not catch this.** All eight original legs passed against a
synthetic payload; I had pinned the shape I *assumed* rather than the shape
*served*. Six new legs are now pinned from the **real** response (HTTP 200,
33 models, 2026-09-27), including the negative leg that a `null` nested
`max_completion_tokens` is **omitted, never fabricated** — the exact failure mode
the withdrawn fix would have introduced.

The suite grew **8 → 14 legs**, all green, with **1479 pass / 0 fail** across
the full `cli/src/utils/__tests__/` surface.

The narrower question — whether the *other* live catalogs need the same
nested-shape reconciliation — is out of scope here and is named in
`FID-2026-0927-006` → *Deferred*.

## Lessons Learned

- **A 401 is evidence, not an error.** The keyless probe that returned
  "Unauthorized" was the single most decision-relevant measurement in this
  record: it chose the authenticated catalog pattern over the keyless one, and
  getting it backwards would have produced a provider that silently never lists
  a model.
- **A defensive guard can be a routing bug.** `startsWith` looks like hygiene and
  read like it. Against a one-segment `strip`, it silently corrupts the wire id
  for any upstream id that happens to share the prefix. The guard belonged to a
  different feature (custom providers) and was carried into the wrong one.
- **Synthetic fixtures pin the shape you assumed.** Every leg in the catalog
  suite passed against a payload I invented; the only thing that found the dead
  field was fetching the real endpoint. A test suite over invented data can be
  fully green and still describe nothing the vendor does.