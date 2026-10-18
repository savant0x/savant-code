# FID: Zylo AI text model provider

**Filename:** `FID-2026-1017-016-zylo-provider.md`
**ID:** FID-2026-1017-016
**Severity:** medium
**Status:** converged
**Created:** 2026-10-17 23:50
**Automation level:** 3
**YAGNI-Compliance:** Verified

---

## Summary

Add Zylo AI as an official registry-driven provider, following `docs/adding-a-provider.md`.
The operator expressly requested text models only and corrected the credential variable to
`ZYLO_API_KEY`. Preserve all entries in the API's `text` array, including rows whose sparse
capabilities omit chat; exclude the separate image and submodel arrays. Authentication now
passes, but live inference acceptance remains unproven and must be tracked honestly.

## Environment

- **OS:** Windows, PowerShell
- **Language/Runtime:** TypeScript, Bun 1.3.14
- **Tool Versions:** Official Zylo API documentation accessed 2026-10-17
- **Commit/State:** Shared `main` working tree; River provider is undergoing verification.

## Detailed Description

### Problem

Zylo is absent from the provider registry, setup picker, gateway catalog, and SDK routing
contracts. Its model payload differs from the generic OpenAI catalog shape.

### Expected Behavior

Provider `zylo`, displayed as Zylo AI, resolves `ZYLO_API_KEY` through the common credential
resolver and routes exact upstream text model IDs to `https://api.zyloai.net/v1`.
The live picker contains all valid text rows and no image or submodel rows.

### Root Cause

The registry lacks a Zylo entry and the gateway lacks a parser for its root `text` array.
Assuming `{data: [...]}` or requiring a chat capability flag would discard valid text rows.

### Evidence

- Official documentation: <https://console.zyloai.net/docs/#introduction>.
- Operator corrected `ZELOAI_API_KEY` to `ZYLO_API_KEY` and requested text only.
- Updated key loaded through `common/src/env.ts`; `GET /v1/validate` returned HTTP 200.
- `GET /v1/models` returned HTTP 200 and root fields `text,image,submodels,version,engine`:
  126 text rows, 14 image rows, and 2 submodel rows.
- One-token `deepseek-v4` request returned HTTP 410, `Upstream request failed`.
- `llama-3.1` returned HTTP 402: BASIC plan requires credits or GO access.
- `gemma-4` timed out after 45 seconds. No successful completion or model identity is claimed.
- Census: all 126 text rows publish positive finite `context_window`; no missing windows.
- Boundary comparison: keyless and authenticated `/v1/models` both returned HTTP 200,
  byte-identical bodies and 126 text rows. The catalog is public, not account-scoped.
- `nemotron-3.5-lightning` timed out after 20 seconds; `nemotron-3-omni` returned HTTP 404,
  `Upstream request failed`. Catalog membership does not establish account plan entitlement.
- Existing seams: `common/src/providers/registry-partitioned-5.ts`,
  `cli/src/utils/openrouter-models/gateway-live-results.ts`, and
  `cli/src/utils/openrouter-models/gateway.ts`.

The measurements above are the parent session's direct probe outputs; durable census evidence
will be retained by implementation. No credential value belongs in this record.

## Impact Assessment

### Affected Components

- Provider registry, setup derivation, and generic SDK routing
- Gateway fan-out, settled-result ladder, cache reset, and catalog merge
- Live context metadata, exception ownership, and window-coverage registration
- Generated provider documentation and human-facing provider references

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Register `zylo` as an OpenAI-compatible gateway using strip ID transformation, live `/models`,
domain `zyloai.net`, setup enabled, and setup order 4. Derive the catalog URL from the registry
without `resolveKey`: the measured catalog is public. Inference still resolves `ZYLO_API_KEY`
through the generic SDK credential path. Parse only `text`; preserve IDs,
names, and returned token pricing. Accept positive finite runtime `context_window` values and
leave absent or invalid windows unknown. Register the live-catalog exception and measured
window coverage as `runtime-published`, measured 2026-10-17 at 126 of 126 text rows.

### Steps

1. Add registry, exception ownership, measured window coverage, and setup metadata.
2. Implement the typed text-only catalog wrapper using `deriveLiveCatalogUrl` and the shared
   public fetch/cache utility without a credential resolver. Preserve sparse-capability text rows.
3. Wire fan-out, cache reset, result extraction, and merge. Zylo occupies slot 18; custom
   catalogs move to slot 19. Update existing slot and registry-count fixtures.
4. Verify parser boundaries, exact wire IDs, shared SDK routing, and credential setup through
   the durable tests declared below. Do not add a provider-specific SDK factory.
5. Generate provider tables and environment examples with the existing generator; update
   hand-maintained docs and run the provider documentation drift check.
6. Run required gates, retain census evidence, and record unsuccessful live inference in
   `dev/tracking/internal-followups.json`. No plan upgrade or additional spending is authorized.
7. Commit verified implementation, close and archive the FID, update the changelog, and push
   normally. External live acceptance does not certify itself through implementation closure.

### Verification

The declared registry tests cover derived setup and registry validity. The Zylo catalog test
covers the measured response shape, text-only selection, sparse capabilities, invalid rows,
runtime windows, pricing, exact IDs, and cache/ladder wiring. Existing setup and SDK tests pin
credential resolution and exact wire IDs. The window-coverage test verifies registration.
Full typecheck, full tests, lint, markdown lint, formatting, and repository validation also run
as ordinary completion gates; recursive repository validation is not a declared FID gate.

## Verification Gates

- gate: typecheck common
- gate: typecheck cli
- gate: typecheck sdk
- gate: test common/src/providers/__tests__/provider-registry-setup.test.ts
- gate: test common/src/providers/__tests__/validate-provider-registry.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/zylo-catalog.test.ts
- gate: test cli/src/utils/__tests__/provider-setup.test.ts
- gate: test sdk/src/impl/__tests__/model-provider-free-mode.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/window-coverage-register.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:7436d2b6c136b6d66c70f52d9dac2ef96ea36ddf75e389a3e3b45b266d80576f
- verified: 2026-10-18T03:52:52.499Z
- typecheck common: exit 0
- typecheck cli: exit 0
- typecheck sdk: exit 0
- test common/src/providers/__tests__/provider-registry-setup.test.ts: exit 0
- test common/src/providers/__tests__/validate-provider-registry.test.ts: exit 0
- test cli/src/utils/openrouter-models/__tests__/zylo-catalog.test.ts: exit 0
- test cli/src/utils/__tests__/provider-setup.test.ts: exit 0
- test sdk/src/impl/__tests__/model-provider-free-mode.test.ts: exit 0
- test cli/src/utils/openrouter-models/__tests__/window-coverage-register.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Missing built-in registry and live catalog. The measured root shape differs from
  OpenAI's catalog. Sparse capabilities make chat-flag filtering unsafe. Image and submodel
  arrays fall outside the operator's text-main-catalog instruction.
- **GREEN:** Use the registry-driven generic gateway path and a typed text-array parser.
  Preserve every valid text ID; consume returned positive finite context metadata.
- **AUDIT:** The measured 126/14/2 array counts establish the parser boundary. HTTP 200 from
  validation establishes accepted authentication. HTTP 410, HTTP 402, and timeout establish
  that live completion acceptance has not passed. Implementation tests remain to be run.
- **ADVERSARIAL:** A public catalog is insufficient authentication evidence; the separate
  validation result supplies it. Catalog presence does not establish plan access, working
  upstream inference, or model identity. Preserve those distinctions in closure and tracking.
- **CHANGE DELTA:** Initial plan convergence; implementation has not started under this record.

### Missed Questions

1. **Which key spelling governs?** The operator's correction is `ZYLO_API_KEY`; remove the old
   spelling from new provider surfaces and never copy the value into evidence.
2. **Does text-only mean requiring `chat` capability?** No. The vendor's text array is the
   authorized boundary; sparse capability metadata must not discard text models.
3. **Are image and custom submodel rows included?** No. The operator authorized only the main
   text catalog; keep both separate arrays out of this integration.
4. **Can catalog metadata establish usable account inference?** No. Authentication passes,
   while observed completion failures remain external acceptance work in the internal tracker.
5. **What happens to unknown context windows?** Retain positive finite returned values and
   leave missing or invalid values unknown; do not invent fallback limits.
6. **Does integration authorize plan upgrades?** No. No further upgrade or spend is authorized.

### Implementation Evidence (REQUIRED for `closed`)

- [ ] **Commit SHA:** Implementation and closure hashes will be recorded after verification.
- [ ] **File:line ranges:** Registry, parser, routing, setup, SDK, and coverage anchors.
- [ ] **Gate output:** Declared receipt and ordinary completion gate results.
- [ ] **Reproducibility:** Production caller grep and durable census/test evidence.
- [ ] **Step statuses:** Steps 1–7 will be accounted for at closure.

### Code Verification Evidence

- [ ] Files referenced in Affected Components exist
- [ ] Implementation matches the Proposed Solution
- [ ] Typecheck/tests/lint pass with direct command evidence
- [ ] Production call-graph evidence is present for the new wiring
- [x] FID status reflects a converged pre-implementation plan

### Loop 2 — Independent audit and self-correction

- **RED:** Generic catalog assumptions and mistaken credential spelling were challenged.
- **GREEN:** Pin the corrected environment variable and parse the vendor's text array only.
- **AUDIT:** Probe statuses above distinguish authentication from upstream availability.
- **ADVERSARIAL:** No completion or identity PASS can be inferred from catalog/validation PASS.
- **CHANGE DELTA:** Clarified the parser boundary and explicit live-acceptance limitation.

### Loop 3 — Self-correction and renewed convergence

- **RED:** The initial wrapper treated a public catalog as authenticated. Keyless and authenticated
  `/v1/models` both returned HTTP 200 with byte-identical bodies and 126 text rows.
- **GREEN:** Remove catalog `resolveKey` and retain generic SDK inference authentication.
  Public catalog loading must work without a key and must send no Authorization header.
- **AUDIT:** Earlier implementation receipt gates passed; this contract correction requires
  a fresh wrapper test and receipt stamp. The source report is `docs/reports/zylo-provider-live-check.md`.
- **ADVERSARIAL:** External availability remains visible independently and cannot be converted
  into a successful completion claim by closing this implementation record.
- **CHANGE DELTA:** Renewed converged public-catalog plan recorded before the wrapper correction.

## Resolution

- **Closed Date:** Not closed; implementation and verification remain.
- **Fix Description:** Converged registry-driven text catalog plan above.
- **Tests Added:** Planned durable tests are declared in Verification Gates.
- **Verification Evidence:** Authentication/catalog measurements above; no implementation PASS yet.

## Lessons Learned

A vendor may publish distinct modality arrays and sparse capability metadata. Use the explicit
catalog boundary requested by the operator, and report authentication, account entitlement,
upstream availability, and model identity as separate measured claims.
