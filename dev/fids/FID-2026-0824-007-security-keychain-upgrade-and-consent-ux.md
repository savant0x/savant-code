# FID: Security — Keychain Upgrade and Risk-Adaptive Consent UX

**Filename:** `FID-2026-0824-007-security-keychain-upgrade-and-consent-ux.md`
**ID:** FID-2026-0824-007
**Severity:** critical
**Status:** analyzed
**Created:** 2026-08-24 01:04
**YAGNI-Compliance:** Verified
**Parent:** FID-2026-0824-008

---

## Summary

Trust layer for the whole suite, built almost entirely on EXTENSION POINTS
that already exist (report risks #1/#10 re-framed per C7c): (1) secrets
upgrade — audit the existing TS credentials layer (`sdk/src/credentials.ts`,
storage integration tests) then add OS-keychain backing via keyring-rs in the
TAURI HOST exposed through Tauri commands (C1 correction — never the Bun
sidecar; the sidecar keeps receiving secrets via the env-only -009 spawn
channel, buffers overwritten after use); (2) consent UX — risk-adaptive
policy on the EXISTING sandbox engine and permission modes
(safe|prompt|unsafe at `packages/agent-runtime/src/tools/tool-executor/sandbox-gate.ts`,
`sandbox/engine.ts`): auto-allow reads and exempt paths, high-friction
context-rich cards for destructive writes/host exec; (3) WS hardening —
Origin allowlist + bearer enforcement ALREADY EXISTS at
`cli/src/server/gateway.ts:534`; verify coverage extends to every NEW endpoint
this suite adds (CSWSH risk #2).

## Environment

- Tauri host = only Rust surface (keyring-rs: Windows Credential Manager,
  Secret Service on Linux); webview sees boolean `is_configured` flags only.

## Detailed Description

### Problem

Approval fatigue is the dominant human-layer vulnerability (report §F:
"Confirm Everything" trains rubber-stamping — arXiv evidence cited therein).
Meanwhile plaintext-at-rest secrets are exposed to info-stealers, and every
new suite endpoint is a fresh CSWSH surface if the existing origin/bearer gate
does not cover it.

### Approach

- Consent policy (build on shipped modes, no new machinery): reads +
  dev/fids/-class exempt operations auto-allow silently; codebase writes and
  host-executing commands escalate with SEMANTIC context (rich diff preview,
  AST/plain-language summary of shell impact) and the Allow control activates
  only after the card renders fully (forced cognitive engagement).
- Secrets: write-only API contract preserved end-to-end; keyring-rs upgrade is
  incremental behind the existing credentials interface (Law 13 — callers do
  not change); memory-hygiene note from report risk #8 adopted for the sidecar.
- Audit trail: decisions already logged via ZTAP receipts + decision-log
  patterns; consent cards link to their receipt entries.
- SQLCipher noted as second choice only if keychain paths prove insufficient
  on Linux Secret Service.

### Proposed Solution Steps

1. Credentials-layer audit report (current storage, threat surface, callers
   grep) pasted into GREEN record — gates everything else.
2. keyring-rs integration in the Tauri host + Tauri command bridge; sidecar
   env-only handoff verified unchanged (behavioral test).
3. Consent-card component family in the workspace (shared with -002 inline
   cards; one component tree, one audited consent surface).
4. Endpoint-hardening sweep: enumerate every new WS/HTTP route across -002..-
   006; assert origin+bearer coverage; paste the matrix into the record.
5. Auto-allow policy table codified next to the sandbox engine (declarative,
   testable, mode-aware).

### Verification

Focused security batteries: secret write-only assertions (no echo path),
constant-time comparisons, endpoint coverage matrix, policy-table unit tests;
hostile-review pass by the Adversary on this record specifically.

## Boundaries / Gates

- Step 1 audit BLOCKS steps 2–5 until reviewed.
- No change to the provenance ledger contract (ZTAP untouched; consumers
  only).

## Perfection Loop

### Loop 1 — RED

- **RED:** Existing machinery mapped: sandbox gate/engine, permission modes,
  gateway origin+bearer (`gateway.ts:534`), credentials layer with storage
  tests. Report framing corrected from "new builds" to "extension points"
  (C7c); C1 placement error corrected (Tauri host, not sidecar).
- **GREEN:** Extension-point plan; forced-engagement consent design; endpoint
  sweep made a mandatory GREEN artifact for every sibling child.
- **AUDIT:** Batched Verifier PASS (2026-08-24): extension-point framing
  verified against Detective evidence; one NEEDS-REVIEW raised on this record's
  sandbox-gate.ts full-path citation.
- **ADVERSARIAL:** STANDS WITH CORRECTIONS (2026-08-24): the NEEDS-REVIEW was
  upgraded to PASS — fresh glob returned exactly one match at
  packages/agent-runtime/src/tools/tool-executor/sandbox-gate.ts (citation was
  precise); Author-field FAIL refuted (template has no Author field;
  scripts/fid-ledger.ts FORBIDDEN_ATTRIBUTION forbids it); its new omission —
  missing required `### Code Verification Evidence` heading — fixed in this
  revision.
- **CHANGE DELTA:** Initial authorship (n/a).

### Missed Questions

1. Do we already redact secrets in logs? → Existing redaction utilities exist
   in-repo patterns (Maus's redact.ts studied; our own logging hygiene rules
   Law 12 apply) — audit confirms coverage rather than assumes it.
2. Who can rotate webhook secrets? → -005 owns rotation mechanics; this child
   owns their secure display/storage via the same write-only contract.

### Code Verification Evidence

Planning-phase record: no implementation exists yet; verification evidence is
intentionally pending. All cited enforcement surfaces (sandbox engine,
sandbox-gate, permission modes, gateway origin+bearer, credentials layer)
were ground-truth-checked during Loop 1 RED and the Adversarial pass
(2026-08-24); verification gates will be declared and receipt-stamped per
FID-2026-0823-009 before any status flips past analyzed.

## Resolution

- (pending)