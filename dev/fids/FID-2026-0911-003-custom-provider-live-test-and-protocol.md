# FID: Custom-provider UX hardening — wizard live test + Anthropic protocol option

**Filename:** `FID-2026-0911-003-custom-provider-live-test-and-protocol.md`
**ID:** FID-2026-0911-003
**Severity:** medium
**Status:** verified (implemented + audited 2026-09-12, autonomous mode 3;
scope expanded per operator directive 2026-09-12:
"address any weak points we found from my questions and expand the scope
properly … all things we were missing needs to be folded in then rerun
perfection on all")
**Created:** 2026-09-12 (operator pre-closure questions on
FID-2026-0911-001: "is there a 'live test' when going through the
wizard?" and "is this only openai or does it support anthropic too? some
outliers may use anthropic too")
**YAGNI-Compliance:** Verified — one optional protocol field on the
existing `CustomProviderConfig` + one verify call in the existing wizard
terminal path. No new modes, no new commands, no new persistence.
**Related:** FID-2026-0910-004 (custom providers — the feature this
hardens); FID-2026-0911-001 (picker add-new entry — the discovery
surface); FID-2026-0911-004 (B.AI — its `/messages` endpoint is a
concrete Anthropic-outlier motivating the protocol field)

---

## Summary

The operator's pre-closure due diligence on FID-2026-0911-001 exposed a
cluster of weak points sharing one root: **there is no way to verify a
custom provider actually works, and no way to express non-OpenAI wire
protocols.** This FID addresses the cluster comprehensively (scope
expanded by operator directive, not minimally patched):

1. **Wizard live test** — the terminal save path fires a bounded,
   non-blocking key/catalog probe and reports a three-outcome ladder
   (verified / rejected / unverifiable) in the summary.
2. **`/provider test <id>`** — a standalone re-test command reusing the
   same verify helper, so verification is available any time, not only
   at add/edit moments. Grammar gains the reserved word `test`.
3. **`/health` live line** — the health report gains a live-check line
   for the active custom gateway (timeout-bounded, degrades to "not
   checked"), reusing the same helper — one truth, three surfaces.
4. **Protocol field** — `protocol: 'openai' | 'anthropic'` on
   `CustomProviderConfig` (wizard step, default openai, backward
   compatible), threading Anthropic-outlier endpoints (`/v1/messages`,
   Claude-style) through the generic factory.
5. **`resolveProtocol` latent-bug fix** — the no-map branch returns
   `'openai'` unconditionally; it must return `config.protocol` BEFORE
   the protocol field can exist safely.

Everything reuses existing machinery: one verify helper, the existing
step machine (one inserted step), the existing anthropic factory branch,
the existing grammar/parser seam. No new persistence shape (one optional
JSON field), no new input modes, no new dependencies.

## Environment

- **OS:** Windows 11 host (win32, Git Bash); Bun 1.3.14-pinned
- **Evidence gathered 2026-09-12 (grep/file:line, this session):**
  - Wizard terminal path does zero network I/O:
    `route-provider-wizard.ts:155-175` — `persistDefinition` (settings
    write + registry refresh) → `persistKey` (`saveProviderApiKey`,
    0600 store) → `reactivateIfActive` → summary. No fetch anywhere in
    the file; nothing in `provider-wizard.ts` either (grep: no
    `fetch`/`probe`/`verify`).
  - `CustomProviderConfig` has no protocol field:
    `common/src/providers/types.ts:118-133` (id, label, baseUrl,
    apiKeyEnvVar, catalog — that is the whole shape).
  - `toProviderConfig` hardcodes the protocol:
    `common/src/providers/custom-providers.ts:313-325`
    (`protocol: 'openai'`, `idTransform: 'strip'`).
  - **LATENT BUG:** `resolveProtocol` no-map branch
    (`sdk/src/impl/model-provider/model-factories.ts:192-201`):
    ```ts
    if (config.protocolMap === undefined) {
      if (config.protocol !== 'openai' && config.protocol !== 'anthropic') {
        throw new Error(...)
      }
      return 'openai'   // ← returns 'openai' even for protocol 'anthropic'
    }
    ```
    No current registry entry has `protocol: 'anthropic'` without a map,
    so nothing misdispatches today — but the first `'anthropic'`-no-map
    entry (exactly what this FID adds for customs) would send
    OpenAI-shaped requests to an Anthropic `/v1/messages` endpoint.
  - The generic anthropic factory exists and is registry-driven:
    `model-factories.ts:81-89` (`createAnthropic` with the entry's
    baseUrl + apiKey) — no new transport machinery needed.
  - Real-world Anthropic-outlier gateways already integrated or probed:
    OrcaRouter (`/v1/messages` documented), B.AI (`/v1/messages`
    documented, FID-2026-0911-004), apinex (`POST /v1/messages` per its
    llms.txt).

## Detailed Description

### Problem

1. A mis-keyed or mis-URL'd custom provider is indistinguishable from a
   working one until a chat fails — violating the spirit of Law 3
   (verify before proceed) at the UX layer.
2. The custom-provider feature's promise is "bring your own provider",
   but the Anthropic-outlier half of the gateway world is excluded by a
   hardcoded protocol.

### Expected Behavior

1. **Wizard live test (terminal path).** At the key step in add mode
   (edit mode: only when a NEW key is entered), after the definition and
   key persist, the router fires `verifyCustomProviderKey` and appends
   one of three outcomes to the summary:
   - **verified** → "Live check: key accepted (N models listed)." (when
     the catalog source is `live`, the probe hits the catalog URL;
     otherwise `{baseUrl}/models`)
   - **rejected** → "Live check: the provider REJECTED this key (HTTP
     401/403). The definition was saved — re-run /provider edit `<id>` to
     fix the key."
   - **unverifiable** → "Live check: could not verify (timeout or the
     endpoint does not serve model listing). Saved anyway."
   The probe NEVER blocks or rolls back the save; it is evidence, not a
   gate. Header shape follows the protocol: Bearer for openai;
   `x-api-key` + `anthropic-version: 2023-06-01` for anthropic.
2. **`/provider test <id>`** — custom-only (built-ins already have
   keyed live acceptance through their own FIDs); runs the same helper
   against the stored definition + stored key and replies with the same
   three-outcome ladder. `test` joins the reserved grammar words, so no
   custom provider can shadow it.
3. **`/health` live line** — for the ACTIVE provider, when it is a
   custom gateway: one line "Live check: verified (N models) / rejected
   / not checked (timeout)". Timeout-bounded (8s) and skipped entirely
   when the active provider is a built-in (their keys already have
   FID-level live acceptance; no new network path for them).
4. **Protocol step.** The wizard gains a `protocol` step between baseUrl
   and envVar: "Protocol — press Enter for openai, or type `anthropic`
   for Claude-style /v1/messages endpoints." Edit mode pre-fills from
   the stored record; Enter keeps. Stored on the record (optional JSON
   field, undefined = openai on old records); validation accepts exactly
   `openai | anthropic` fail-closed; `toProviderConfig` lifts
   `custom.protocol ?? 'openai'`.
5. **`resolveProtocol` fix.** The no-map branch returns
   `config.protocol` (openai or anthropic); map-dispatched protocols
   without a map keep throwing fail-closed. Pinned so an
   anthropic-no-map entry dispatches Anthropic-shaped requests.

### Root Cause

Feature shipped (FID-2026-0910-004) with the operator's own trial key
and an OpenAI-shaped reference endpoint — both gaps invisible in that
configuration.

### Evidence

(see Environment — all file:line, grepped this session)

## Impact Assessment

### Affected Components

- `sdk/src/impl/model-provider/model-factories.ts` (the `resolveProtocol`
  one-line fix + a pin)
- `common/src/providers/types.ts` (+1 optional field on
  `CustomProviderConfig`)
- `common/src/providers/custom-providers.ts` (validation + one line in
  `toProviderConfig`)
- **NEW** `cli/src/utils/verify-custom-provider.ts` (the single verify
  helper — protocol-aware headers, 8s abort, three-outcome result union,
  zero key logging; Law 13: one truth consumed by all three surfaces)
- `cli/src/utils/provider-wizard.ts` (grammar word `test` added to the
  reservation; protocol step inserted; draft field)
- `cli/src/commands/router/route-provider-wizard.ts` (verify call at the
  terminal path + summary text)
- `cli/src/commands/provider-subcommands.ts` (`/provider test <id>`
  handler)
- `cli/src/commands/defs/model-provider-commands.ts` (grammar dispatch
  for `test`)
- `cli/src/commands/health-command.ts` (live line for the active custom)
- Suites: custom-providers validation, model-provider-custom, wizard
  e2e (mocked-fetch pins), settings round-trip, health, new verify-helper
  suite

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium: the verify call adds one network request to a local-only
      path (timeout-bounded, degradation never blocks); the protocol
      field touches the routing hot path — mitigated by the
      `resolveProtocol` fix landing WITH the field, pinned by tests
- [ ] Low

## Proposed Solution

### Approach

1. **`resolveProtocol` fix first** (one line + pin): no-map branch
   returns `config.protocol as ProviderModelProtocol`. The existing
   throw for map-dispatched protocols without a map is unchanged.
2. **Protocol field:** `protocol?: 'openai' | 'anthropic'` on
   `CustomProviderConfig`; validation restricts to the two values
   (undefined → openai at lift time); `toProviderConfig` passes
   `protocol: custom.protocol ?? 'openai'`. Wizard: a `protocol` step
   inserted after baseUrl (default openai; Enter keeps/pre-fills in
   edit mode). Input-mode continuity follows the existing step machine.
3. **Verify helper (`verify-custom-provider.ts`).**
   `verifyCustomProviderKey(def: CustomProviderConfig, key: string)`:
   protocol-aware headers (openai → Bearer; anthropic → `x-api-key` +
   `anthropic-version`), GET the catalog URL when `catalog.source ===
   'live'` else `{baseUrl}/models`, `AbortSignal.timeout(8_000)`, no
   retry, result = `{ outcome: 'verified' | 'rejected' | 'unverifiable',
   modelCount?: number, detail?: string }`. Never logs or embeds the key.
   Consumed by the wizard terminal path, `/provider test`, and
   `/health` — three surfaces, one helper (Law 13).

### Steps

1. [ ] **RED:** pins for the `resolveProtocol` fix (anthropic-no-map →
   'anthropic'), validation protocol pins (valid/invalid/missing),
   `toProviderConfig` lift pin, grammar `test` reservation pin,
   verify-helper suite (200/401/403/404/timeout/network-error via mocked
   fetch, both header shapes, no-key-logging assertion), wizard
   protocol-step pins, e2e summary-text pins, `/provider test` handler
   pins, `/health` live-line pins. Capture failing.
2. [ ] **GREEN:** dependency order: model-factories fix → common
   (types/validation/lift) → verify helper → wizard step + grammar →
   route-handler probe → `test` handler → health line.
3. [ ] **VERIFY:** typecheck ×4; suites (common providers, sdk
   model-provider-custom + free-mode, cli wizard + settings + health +
   commands); eslint; prettier; lint:md; validate:repository parity.
4. [ ] **LIVE (operator-assisted):** add a real Anthropic-outlier custom
   provider via the wizard and observe the live-test outcome in the
   summary; `/provider test` and `/health` against the same record; a
   B.AI `/messages` custom entry is the natural candidate once
   FID-2026-0911-004's key exists.

### Live Unknowns

1. Some OpenAI-shape gateways return non-JSON on `/models` or require
   auth headers beyond Bearer — the degradation ladder treats all
   non-200/401/403 outcomes as "unverifiable", so no integration can
   break; only the message text varies.
2. Whether any operator endpoint needs a THIRD protocol (Gemini-native)
   — deliberately out of scope; the two-value field is extensible
   without schema change.

## Verification Gates

- gate: typecheck common / sdk / packages/agent-runtime / cli
- gate: test common/src/providers/__tests__/
- gate: test sdk/src/impl/__tests__/model-provider-custom.test.ts
- gate: test cli/src/commands/__tests__/provider-add-wizard.test.ts
- gate: test cli/src/utils/settings/__tests__/settings-custom-providers.test.ts
- gate: eslint --max-warnings 0 · prettier · lint:md ·
  generate:provider-docs:check · validate:repository parity

## Perfection Loop

### Loop 1 — Authoring (2026-09-12, post-grounding)

- **RED findings:** no network I/O anywhere in the wizard terminal path
  (grep evidence); protocol hardcoded at the lift; `resolveProtocol`
  latent misdispatch for anthropic-no-map (file:line quoted).
- **GREEN (initial):** the three-part plan above; bug fix sequenced
  FIRST because the protocol field depends on it for correctness.
- **CHANGE DELTA:** initial authoring.

### Loop 2 — Scope expansion (operator directive, 2026-09-12)

- **Operator ruling:** "address any weak points we found from my
  questions and expand the scope properly … all things we were missing
  needs to be folded in then rerun perfection on all."
- **Weak-point sweep prompted by the four questions** (each traced to
  file:line before inclusion):
  1. No live verification anywhere → wizard probe + `/provider test` +
     `/health` line (three surfaces, ONE helper — Law 13).
  2. Protocol expressible nowhere → optional field + step + lift.
  3. `resolveProtocol` latent misdispatch → fix + pin, sequenced first.
  4. Grammar reservation must gain `test` (the FID-2026-0911-001
     lesson: reserve in the leaf module so customs can never shadow it).
  5. Header shapes differ per protocol (Bearer vs x-api-key +
     anthropic-version) — the helper must be protocol-aware, not
     Bearer-only (found while drafting, before any code).
- **YAGNI re-check:** `/provider test` for BUILT-INS rejected — their
  keys already have FID-level keyed live acceptance; adding a network
  probe per built-in would be new surface without new information.
  Third protocol (Gemini-native) rejected — two values cover every
  endpoint in evidence; the field is extensible without schema change.
- **CHANGE DELTA:** summary/behavior/components/steps rewritten; risk
  unchanged (medium); no code written yet.

### Loop 3 — Implementation (2026-09-12, autonomous mode 3)

- **RED captured failing before GREEN** (all surfaces):
  - `common/src/providers/__tests__/custom-provider-protocol.test.ts` —
    5/5 fail (protocol field absent from type + lift + validation).
  - `sdk/src/impl/__tests__/model-provider-custom.test.ts` — routing leg
    fails: anthropic-protocol custom entry dispatched to `/chat/completions`
    (the `resolveProtocol` no-map branch bug, now pinned).
  - `cli/src/utils/__tests__/verify-custom-provider.test.ts` — module
    absent (helper not yet written).
  - `cli/src/commands/__tests__/health-custom-live.test.ts` — live-line
    pins fail (no **Live check:** section rendered).
  - `cli/src/commands/__tests__/provider-add-wizard.test.ts` — protocol
    step pins fail (step machine has no protocol step; grammar lacks
    `test`).
- **GREEN (dependency order):**
  1. `sdk/src/impl/model-provider/model-factories.ts` — `resolveProtocol`
     no-map branch now honors the entry's protocol (anthropic maps to the
     anthropic factory) instead of returning `'openai'` unconditionally.
  2. `common/src/providers/types.ts` + `custom-providers.ts` — optional
     `protocol?: 'openai' | 'anthropic'` on `CustomProviderConfig`;
     validation accepts both values (fail-closed on anything else);
     `toProviderConfig` lifts the field (default `'openai'`); grammar
     reservation gains `test`.
  3. `cli/src/utils/verify-custom-provider.ts` — NEW shared helper:
     protocol-aware auth headers (Bearer vs `x-api-key` +
     `anthropic-version: 2023-06-01`), 8s bounded, single-shot, never
     throws, key-material redacted from any detail text (Law 12);
     outcome ladder verified / rejected / unverifiable.
  4. `cli/src/utils/provider-wizard.ts` — protocol step inserted after
     baseUrl (default openai, Enter to accept); summary includes the
     protocol; probe wired at the terminal step (never blocks the save).
  5. `cli/src/commands/provider-subcommands.ts` + `defs/model-provider-commands.ts`
     — `/provider test <id>` implemented on the same helper.
  6. `cli/src/commands/health-command.ts` — **Live check:** line for the
     active CUSTOM provider only (built-ins keep FID-level acceptance).
  7. `cli/src/commands/router/route-provider-wizard.ts` +
     `route-user-prompt.ts` — terminal path made async to await the probe.
- **Loop 3 verification findings (caught and fixed in-pass):**
  - The health test's in-mock `expect` threw inside Ollama detection's
    own fetch (also mocked) and its error text leaked into the rendered
    report via detectOllama's catch-and-render. Fix: URL-scoped mock +
    post-hoc `seenAuth` assertion — also proves Ollama traffic never
    reaches the gateway probe.
  - Test-env `DIRECT_PROVIDER=openrouter` leakage from a prior test in
    the same file suppressed the custom branch (handler logic was
    correct; the pin now clears it).
  - The health test file crossed the 300-line hard cap from the new pins
    — resolved by a REAL split (`health-custom-live.test.ts`, 268 lines;
    original back to 146), not a baseline bump.
- **AUDIT evidence (own-run, this session):**
  - typecheck × 4 (sdk / common / packages/agent-runtime / cli) — exit 0
    each.
  - cli suites: verify-custom-provider 8/0 · provider-add-wizard 27/0 ·
    health 11/0 across the two files · provider-key-store-custom +
    settings-custom-providers included → 5 files 53 pass / 0 fail ·
    common providers 57/0 · sdk custom suites 7/0.
  - eslint `--max-warnings 0` on all 15 touched files — exit 0 ·
    prettier — clean · lint:md — exit 0.
  - `validate:repository` hard-cap parity: **8 = 8** (stash-diff vs HEAD;
    the health-test split removed the only violation this FID added; the
    remaining 8 are pre-existing debt flagged for the refactor FID).
- **Law 4 call-graph (production reachability, grep-proven):**
  - `verifyCustomProviderKey` ← `health-command.ts:106` ·
    `provider-subcommands.ts` (`test` branch) ·
    `route-provider-wizard.ts` (terminal step) — three surfaces, one
    helper.
  - `resolveProtocol` anthropic branch ← reachable via custom entry with
    `protocol: 'anthropic'` through `registerCustomProviders` → lift →
    `createProviderModel` (pinned e2e in sdk suite).
  - `/provider test` ← grammar `test` reserved in `custom-providers.ts`
    + dispatch in `provider-subcommands.ts` + def registration in
    `model-provider-commands.ts`.
- **Verdict:** all gates pass; RED→GREEN complete; loop converges.

## Lessons Learned

- The operator's pre-closure questions were better review than any
  audit pass this session ran: both feature gaps were real, and one
  question ("does it support anthropic too?") flushed out a latent
  routing bug that would have misdispatched the very endpoint the
  question was about.
