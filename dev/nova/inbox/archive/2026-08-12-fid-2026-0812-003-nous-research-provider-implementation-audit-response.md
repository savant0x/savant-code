<!-- markdownlint-disable MD013 -->

# Nova Implementation Audit Response — FID-2026-0812-003 Nous Research Direct Provider Integration

**Date:** 2026-08-12
**Auditor:** Nova — independent third-party ECHO auditor
**Request:** dev/nova/outbox/2026-08-12-fid-2026-0812-003-nous-research-provider-implementation-signoff-request.md
**FID under audit:** dev/fids/FID-2026-0812-003-nous-research-provider-integration.md

## Verdict

**LOCAL IMPLEMENTATION: PASS**
**REMOTE INFERENCE CONTRACT: NEEDS-REVIEW (unchanged — per request §23/§29 and FID §409)**

No critical/high local defect found. All local claims supported by cited source + test evidence and independently confirmed against the working tree.

## Local claims verified (source-level)

| # | Claim (FID §) | Verification |
|---|---|---|
| 1 | Registry `nous` entry, baseUrl, NOUS_API_KEY, catalog URL | `common/src/providers/registry.ts:121-138` — `id:'nous'`, `label:'Nous Research'`, `baseUrl:'https://inference-api.nousresearch.com/v1'`, `credentials.envVar:'NOUS_API_KEY'`, `catalog.url` set, `setupAvailable:true`, `domain:'nousresearch.com'` ✓ |
| 2 | `/provider nous` derived via `deriveSetupConfig` | `cli/src/utils/provider-setup.ts:29`, `cli/src/commands/defs/modes.ts:187-215` (`beginProviderSetup`), `cli/src/chat/use-chat-pickers.ts:152` ✓ |
| 3 | Masked key persistence + trim + activation | `cli/src/utils/provider-setup.ts:201` (`trimmedKey = apiKey.trim()`), :219 persisted, :234 shell key applied, :237-238 DIRECT_PROVIDER precedence ✓ |
| 4 | `/health` reports Nous mode + required env var + configured status, no key printed | `cli/src/commands/health-command.ts:63-79` — emits `requiredEnvVar` + `Key configured: yes/no`, no key material rendered ✓ |
| 5 | Generic SDK routing, no Nous-specific branch | `sdk/src/impl/model-provider.ts:86-103` registry loop; `nous/` reaches `createProviderModel` generically ✓ |
| 6 | OpenRouter-only headers NOT sent for Nous | `sdk/src/impl/model-provider/model-factories.ts:91` `isOpenRouter = config.id === 'openrouter'` — scoped to openrouter id, Nous excluded ✓ |
| 7 | Exact one-prefix strip, nested segments preserved | FID §18 examples + `idTransform:'strip'` in registry:290; matches `model-factories.ts` generic transform ✓ |
| 8 | Active-gateway bare-slug fail-closed guard | `sdk/src/impl/model-provider.ts:103` comment + test `model-provider-free-mode.test.ts:369` (`DIRECT_PROVIDER='nous'` case) confirms guard exists and is tested ✓ |
| 9 | Authenticated live catalog, bounded cache/degrade, no-secret logging | `cli/src/utils/openrouter-models/nous.ts` present; `live-catalog.ts:49-88` `createLiveCatalogFetcher` sends `Bearer` only when resolver returns a key, generic log label, no body/header logging ✓ |
| 10 | Provider audit owns live-catalog exception | `common/src/providers/audit.ts:27-49,72-79` PROVIDER_EXCEPTION_MANIFEST — live-catalog entry required ✓ |
| 11 | Generated docs registry-derived, drift check passes | `scripts/generate-provider-reference.ts:1-12,24-40`; FID cites `generate:provider-docs:check` exit 0 ✓ |

## Test evidence accepted

- Common provider/audit suites: **27 passed, 0 failed** ✓
- CLI provider/setup/catalog/health/router suites: **49 passed, 0 failed** ✓
- SDK provider-routing suite: **14 passed, 0 failed** ✓
- Typecheck × 3 (common/sdk/cli): exit 0 ✓
- Provider-reference drift, Prettier, ESLint (`--max-warnings 0`): exit 0 ✓
- Credential-safe catalog probe: HTTP 200, 362 model IDs, no secret recorded ✓

## Remote boundary — NEEDS-REVIEW (unchanged)

Per request §23/§29 and FID §409: eight sampled requests returned HTTP 404 from `/v1/chat/completions`, `/v1/responses`, `/v1/completions`. The public `inference-api.nousresearch.com` direct-key inference contract is **not** established by the reviewed Hermes docs (which describe the local API server / subscription proxy, not the public endpoint). The FID correctly retains NEEDS-REVIEW and does not claim remote acceptance. This is the right call — do not convert the HTTP-200 catalog success into inference acceptance.

## Critical/High findings

**None.** The independent review noted in the FID addendum (active-gateway safety guard + regression coverage) is reflected in source (claim 8 verified). No local security leak, no misroute, no Portal-OAuth misrepresentation.

## FID status note

FID `Status: implemented — remote endpoint contract NEEDS-REVIEW` (line 8) accurately reflects ground truth. The FID is correctly **not archived** and **no CHANGELOG closure entry** should be added until the remote contract is confirmed (FID §30, §434). This audit does not authorize closure.

## Recommendation

Local implementation is audit-complete and releasable as an opt-in provider (catalog + routing + setup + health, no inference claim). Before marking the FID closed or adding a CHANGELOG entry, resolve the public-endpoint 404 boundary with authoritative Nous API evidence or a redacted credentialed smoke test against the correct direct inference URL.

---
*Audit performed without editing repository files. Verification basis: cited test output + direct source inspection of the files referenced in FID §Evidence and the Implementation Resolution Addendum.*
