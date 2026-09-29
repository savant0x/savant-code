# FID: T61 — Cloudflare provider is fully routed but excluded from setup; surfacing needs a dual-credential seam

**Filename:** `FID-2026-0928-008-t61-cloudflare-setup-surfacing.md`
**ID:** FID-2026-0928-008
**Severity:** low
**Status:** closed
**Created:** 2026-09-28
**Automation level:** 1 (the surfacing decision is the operator's; the implementation is level 3 once ruled)

---

## Summary

T61 asked for grounding plus a Perfection Loop record on Cloudflare surfacing,
present-only. Grounded against source 0-EOF:

**Cloudflare is the only registered gateway that is fully routed end-to-end
yet invisible in the setup flow.** Every routing primitive exists and is
pinned by tests: the registry entry with its mid-path account-id template,
the `{ENV_VAR}` placeholder resolution, the `cf-rewrite` id transform, a
14-model static catalog, and membership in the `ModelProvider` union and
`validProviders`. The single exclusion point is `setupAvailable: false`,
and the reason it cannot simply be flipped is now precise:
**the setup seam is single-credential by construction** —
`deriveSetupConfig` yields `{ label, envVar, baseUrl }` and has no concept
of `credentials.extra`, so a flipped Cloudflare would onboard a token and
then throw `{CLOUDFLARE_ACCOUNT_ID} not set` the first time it resolved a
base URL.

Three fix shapes are offered; the recommendation is Option A.

## Environment

- Repo: `savant-code` v0.0.34, `main`. Evidence gathered 2026-09-28.
- Surfaces read 0-EOF: `common/src/providers/registry.ts` (cloudflare entry),
  `common/src/providers/derive.ts` (`deriveSetupConfig`),
  `common/src/providers/discovery-stamp.ts` (not relevant), `sdk/src/impl/
  model-provider/model-factories.ts` (`applyIdTransform`, `resolveBaseUrl`),
  `cli/src/utils/provider-key-store.ts` (the exclusion seam),
  `common/src/constants/model-config/providers.ts` (static catalog).
- No Cloudflare credentials in the local env — no live probe was attempted
  or needed; the catalog is static by design and every claim below is a
  source-level fact with file:line.

## Detailed Description

### What already exists (all verified in source)

| Primitive | Location | Evidence |
|---|---|---|
| Registry entry, `kind: 'gateway'`, `protocol: 'openai'` | `common/src/providers/registry.ts:138-168` | `CLOUDFLARE_API_TOKEN` + extra `CLOUDFLARE_ACCOUNT_ID`, `setupAvailable: false`, `order: 4` |
| Base URL with mid-path account id | `registry.ts:158-160` | `https://api.cloudflare.com/client/v4/accounts/{CLOUDFLARE_ACCOUNT_ID}/ai/v1` |
| `{ENV_VAR}` placeholder resolution (fail-closed throw on missing) | `sdk/src/impl/model-provider/model-factories.ts` (`resolveBaseUrl`) | Throws `` `${envVar} not set. Set ${envVar} environment variable.` `` |
| `cf-rewrite` id transform | `model-factories.ts` (`applyIdTransform`) | `cloudflare/<model>` → `@cf/<model>` |
| Static 14-model catalog | `common/src/constants/model-config/providers.ts:214-231` (`cloudflareModels`) | incl. `cloudflare/zai-org/glm-5.2`, `cloudflare/meta/llama-3.3-70b-instruct-fp8-fast` |
| Union + `validProviders` membership (Phase 1 delta b) | `registry.ts:11,15,164`; pins at `provider-registry.test.ts:64-66` | `deriveValidProviderIds` contains `cloudflare` |
| Registry pins for baseUrl/envVar | `provider-registry.test.ts:178-182` | exact-string assertions |
| Exclusion seam (the only gate) | `cli/src/utils/provider-key-store.ts:22-28` | *"Cloudflare and Ollama are intentionally absent — Cloudflare enters the setup flow in a later phase (it needs two credentials)"* |

### The precise blocker

`deriveSetupConfig` (`common/src/providers/derive.ts:90-106`) builds the
setup view from `config.setupAvailable && config.credentials.envVar` and
emits `{ label, envVar, baseUrl }`. `credentials.extra`
(`common/src/providers/types.ts:60`) — the typed home for the second
credential — is never read by the setup derivation, the persisted key store,
or the wizard prompt flow. Flipping `setupAvailable: true` today would:

1. list Cloudflare in `/provider setup`,
2. prompt for and persist `CLOUDFLARE_API_TOKEN`,
3. never prompt for `CLOUDFLARE_ACCOUNT_ID`,
4. and then fail at first model resolution with the `resolveBaseUrl` throw —
   the error path exists (Law 14 satisfied) but the user hits it *after*
   completing setup, which is the failure mode the exclusion comment
   exists to prevent.

The persisted store side has the same shape gap: keys are saved per provider
id (`saveProviderApiKey`), with no second slot for an extra credential;
`applyPersistedProviderApiKeys` sets env vars at run start, which is where a
persisted `CLOUDFLARE_ACCOUNT_ID` would need to land.

### Why this is a decision record and not a patch

The Phase-1 comment defers Cloudflare "to a later phase" — the phase gate is
the operator's (it changes the setup UX contract for every provider that
follows, e.g. any future provider needing 2+ credentials). The grounding
here makes the decision cheap: the seam work is small and bounded, and the
routing underneath it is already test-pinned.

## Root Cause

Not a defect — a deliberately deferred phase, now with its true cost
measured: the gap is a single-credential seam, not Cloudflare-specific
plumbing.

## Impact Assessment

- Users with Cloudflare credentials cannot adopt the provider through the
  supported setup flow; they must hand-set two env vars (undiscoverable —
  `/provider setup` does not list it) and rely on the union membership for
  settings validation.
- The routing stack carries zero drift risk while unsurfaced: nothing
  consumes `cloudflareModels` dynamically and the transform is pinned.

## Proposed Solution — the operator ruling this record requests

**Option A — extend the seam, then flip (recommended).**
`ProviderSetupInfo` gains `extraEnvVars?: Array<{ envVar: string; label:
string }>` populated from `credentials.extra` in `deriveSetupConfig`; the
wizard prompts for extras after the primary key; `saveProviderApiKey` gains
an optional extra-credential slot (or persists under the extra's env-var
name, same store); `applyPersistedProviderApiKeys` already sets env vars by
name and needs no change. Then `setupAvailable: true` for cloudflare, plus
setup-flow pins (cloudflare listed; extras prompted; persisted extras
applied). Mechanical once ruled; the seam is provider-agnostic so the next
dual-credential provider is a registry entry, not a feature.

**Option B — env-only surfacing.** No seam work; document the two env vars
in the registry `missingKeyMessage` and README providers table so hand-setup
is discoverable, and leave `setupAvailable: false`. Zero code risk; costs
the wizard UX and leaves the "later phase" debt standing.

**Option C — keep absent.** Defer until a second dual-credential provider
exists to justify the seam. Zero work now; the exclusion comment already
records the intent, but the catalog and transform remain dead weight for
users who cannot use the flow.

**Recommendation:** Option A — the seam is small, the routing is already
pinned, and Option C leaves a fully-built provider unusable through the only
supported adoption path.

A decision record gating on tests of code it did not write would claim
credit it has not earned; the gates verify the grounded surface itself:
the registry pins that already exist still hold, and repo quality holds.

## Verification Gates

- gate: test common/src/providers/__tests__/provider-registry.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:8c82a54f0ae352668457f562db2f249d26d25bd0782fd70e8aeaed9da37b2b38
- verified: 2026-09-28T20:53:17.451Z
- test common/src/providers/__tests__/provider-registry.test.ts: exit 0
- quality: exit 0

## Step Status

- [x] Read the cloudflare registry entry, derive seam, factory seams,
      exclusion seam, static catalog (all 0-EOF)
- [x] Verify union/validProviders membership and existing test pins
- [x] Establish the precise blocker: `deriveSetupConfig` is
      single-credential; `credentials.extra` is typed but never consumed
- [x] Confirm no live probe needed (static catalog; no credentials present)
- [x] Draft the three fix shapes + recommendation
- [x] Operator ruling on the surfacing shape — received 2026-09-28:
      **Option A** (dual-credential seam, then flip), per the operator's
      message "1, 2.a, 3. activate" answering the three pending records in
      order

## Perfection Loop

### Missed Questions

1. **Is the single-credential seam claim overstated?** No — `deriveSetupConfig`
   builds `{label, envVar, baseUrl}` and never reads `credentials.extra`; the
   persisted store saves one key per provider id. Both are direct reads of
   the seam code, and the wizard prompt flow consumes that same shape.
2. **Could Cloudflare be surfaced without touching the seam?** Only by
   misusing the primary slot (e.g. prompt for the account id as if it were a
   second provider) — a shape abuse that would confuse every consumer of
   `ProviderSetupInfo` and teach the next dual-credential provider the wrong
   pattern. Rejected here so it is not re-proposed.
3. **Does Option A risk the customs path?** `deriveSetupConfig` is used by
   both built-ins and customs; widening `ProviderSetupInfo` with an optional
   field is additive, and customs carry no `credentials.extra`, so their
   derived entries are unchanged.
4. **Why is no live probe needed?** The catalog is static and the routing
   seams are pinned by exact-string registry tests; a probe would measure
   the vendor's network, not any claim in this record.

### Code Verification Evidence

- [x] Every file:line claim in the existence table verified by reading the
      cited surface 0-EOF this session
- [x] The exclusion seam comment (`provider-key-store.ts:22-28`) names
      Cloudflare and the two-credential reason verbatim
- [x] Declared gates run live at authoring: registry pins pass; receipt
      stamped 2/2
- [x] No credential or network access used — the record's evidence is
      source-level by design

## Resolution

**IMPLEMENTED under Option A** (operator ruling 2026-09-28).

- **The seam carries extras** — `ProviderSetupInfo` gained the optional
  `extraEnvVars?: Array<{ envVar: string; label: string }>`, populated by
  `deriveSetupConfig` from `credentials.extra`; single-credential providers'
  derived shape is unchanged (additive field).
- **Cloudflare flipped** — `setupAvailable: true` with the phase-gate
  comment updated; the registry entry remains the single source of the
  credential list. The registry test's setup-provider count pin moved
  18 → 19 with `cloudflare` in the sorted list.
- **The key store persists extras** — new `saveProviderApiKeyExtra`
  (validated against the provider's declared extras, persisted under the
  extra's OWN env-var name in the shared 0600 store, applied to the process
  env with shell precedence); the write/apply logic was factored into
  `persistProviderKey`/`activateProviderRouting` (Law 13 — one body each);
  `applyPersistedProviderApiKeys` now applies persisted extras for every
  declared extra of every setup provider.
- **The flow chains** — `beginProviderSetup` stages the provider's extras
  (skipping any already satisfied by the shell env); the masked-key router
  saves the primary key, then chains into one masked prompt per extra and
  finishes with a completion message; `routeKeySetup` gained the optional
  `getNextInputMode` (resolved post-save) and `emptyValueMessage` hooks so
  chaining works and an account id is never called an "API key".
- **Docs updated** — the README provider table row and both READMEs'
  Cloudflare prose describe the `/provider cloudflare` two-prompt flow.
- **Runtime proof:** the provider-setup suites pass (12 legs in the gateway
  suite incl. 4 new T61 pins; 80 legs across the 9 touched suites), and
  common+cli typecheck plus the widened scripts gate all exit 0. The
  provider-exception manifest dropped the stale cloudflare `setup-exclusion`
  entry — the audit gate caught it live.
- **Closed Date:** 2026-09-28 (closure commit hash pending operator commit;
  per G1 the agent does not execute git).

## Lessons Learned

- **`setupAvailable: false` was doing double duty** — both "not surfaced"
  and "setup seam cannot express this provider's credentials". Only the
  second is a real constraint; conflating them made the deferral look like
  a UX choice when it was a schema gap.
- **A provider can be complete everywhere except the front door.** Every
  routing primitive for Cloudflare exists and is pinned; the one missing
  shape (`extra` in the setup derivation) is invisible in every gate
  because the exclusion itself is data, not code.
