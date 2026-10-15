# FID: Provider live-list probes — remaining account boundary

**Filename:** `FID-2026-1013-005-provider-live-list-remaining-boundaries.md`
**ID:** FID-2026-1013-005
**Severity:** low
**Status:** fixed
**Created:** 2026-10-13 18:51
**Automation level:** 3
**YAGNI-Compliance:** Verified
**Master FID:** FID-2026-1012-022

## Summary

T119's 25 remote catalog probes were measured in the previous continuation.
This wave checks the remaining local and account-specific boundaries. Local
Ollama is reachable with three models. Cloudflare lacks both its account ID
and token, so an authenticated account-specific model list cannot be requested.

## Environment

- OS: Windows, PowerShell.
- Runtime: Bun 1.3.14; local development line 0.0.36.
- Commit: `9d6fe794`; public catalog boundary and acceptance ruling recorded.

## Detailed Description

### Problem

The earlier remote inventory did not establish local Ollama availability or
the configured Cloudflare account's catalog. The two require distinct evidence.

### Expected Behavior

Every available catalog is probed without inference or purchase. Missing
external account configuration remains a specific blocker, never a PASS.

### Root Cause

Cloudflare's account-specific endpoint requires both `CLOUDFLARE_ACCOUNT_ID`
and `CLOUDFLARE_API_TOKEN`; neither is configured in the probing process.
The existing `readProviderProbeKeys` helper also confirms neither field is
present in the persisted provider-key store; no stored value was printed.

### Evidence

Read-only probe output, 2026-10-13:

```json
{"ollama":{"reachable":true,"status":200,"models":3},"cloudflare":{"tokenConfigured":false,"accountConfigured":false}}
```

Ollama was queried at `http://127.0.0.1:11434/api/tags` with a 3-second
deadline. The Cloudflare request was skipped when configuration was absent.
No credential value, account ID, model completion or payment was emitted.

## Revalidation Evidence — 2026-10-14

The boundary was re-run without changing credentials or provider state. A
read-only request to `http://127.0.0.1:11434/api/tags` returned:

```json
{"status":200,"models":3}
```

The process environment and the persisted provider-key store were checked by
presence only; neither contained the Cloudflare account ID or API token:

```json
{"cloudflare":{"accountConfigured":false,"tokenConfigured":false}}
{"cloudflareAccountConfigured":false,"cloudflareTokenConfigured":false}
```

No credential value was printed, written, or transmitted. This corroborates the
existing blocker and does not establish an account-specific Cloudflare catalog.

## Public Documentation Evidence — 2026-10-14

Cloudflare publishes a public Workers AI model catalog at
`https://developers.cloudflare.com/workers-ai/models/`. The page is readable
without an account and is the appropriate public evidence for model
availability. Savant's release catalog remains a deliberately curated static
subset of that public catalog.

Cloudflare's official REST guide at
`https://developers.cloudflare.com/workers-ai/get-started/rest-api/` separately
states that REST API requests require both an API token and Account ID, and its
example uses an account-scoped URL. The documented runtime endpoint therefore
cannot be independently queried from an accountless environment. No personal
account is required to release or browse Savant's static Cloudflare catalog;
users supply their own credentials only when they choose to run Cloudflare
Workers AI.

## Impact Assessment

### Affected Components

- T119 in `SCOPE.md` and the master's C3 row.
- Existing local Ollama and account-specific Cloudflare model catalogs.

### Risk Level

Low: the local catalog is verified; one external configuration boundary remains.

## Proposed Solution

### Approach

Use read-only live catalog requests under the existing no-purchase authority.
The operator retains credential placement; this record grants no secret writes.

### Steps

1. Implemented: probe local Ollama; HTTP 200 and three models returned.
2. Implemented: establish the public Cloudflare catalog boundary from the
   vendor's documentation without credentials.
3. Implemented: Q27 establishes that an account-specific live API roster is
   not a completion gate. The static catalog and public vendor evidence are
   sufficient; no credential is required or claimed.

### Verification

Actual HTTP status, catalog size, public vendor documentation, and the provider
documentation drift probe are the verification for this read-only work. No
account-specific roster query is claimed.

## Verification Gates

- gate: probe scripts/provider-docs-counts-drift.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:1eec5b8565e06910bf7bc73fcbcfd47acc24730ac89a27c20469f20446ba8fbc
- verified: 2026-10-15T00:18:20.937Z
- probe scripts/provider-docs-counts-drift.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- RED: two catalog boundaries remained after the remote inventory.
- GREEN: query local Ollama and conditionally query a configured Cloudflare account.
- AUDIT: tool output shows HTTP 200 / three models and absent account configuration.
- ADVERSARIAL: a reachable local service proves no remote account availability;
  absence of credentials does not prove the provider has no models.
- CHANGE DELTA: evidence and tracking only; no source or credential writes.

### Missed Questions

Does a public provider inventory establish an account catalog? No. Keep the
account-specific probe blocked until the operator supplies its configuration.

### Code Verification Evidence

No implementation status is claimed. The live read-only output above is the
evidence, and the root SDK exports the existing Cloudflare environment helpers.

## Resolution

Local probe and public documentation evidence are complete. Q27 records that a
Cloudflare Account ID and API token are not required for completion of the
curated static catalog code. The account-specific live roster is not claimed as
queried, and no credential was requested, printed, stored, or transmitted.

## Lessons Learned

No class-repair lesson is claimed by a provider inventory probe.
