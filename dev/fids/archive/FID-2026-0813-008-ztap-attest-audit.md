<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: ZTAP Export AUDIT — Clean-Process Validation

**Filename:** `FID-2026-0813-008-ztap-attest-audit.md`
**ID:** FID-2026-0813-008
**Severity:** medium
**Status:** closed
**Planning Status:** Converged after Perfection Loop; implementation complete.
**Created:** 2026-08-13
**YAGNI-Compliance:** Complete — implementation scope delivered
**Master FID:** FID-2026-0813-001
**Depends On:** FID-2026-0813-007

---

## Summary

The AUDIT-phase gate for `/attest`: proves the exported `trust-receipt.html` and `trust-receipt.json` validate
independently — in a clean process with zero Savant-Code install and zero network — matching the build order's P1.B
gate ("exported receipt validates in a clean process with zero Savant-Code install"). The audit runs the same
deterministic checks an external auditor would run: JCS re-canonicalization, signature verification against embedded
pubkeys, and live/superseded hash recomputation.

## Environment

- **OS:** Windows (`win32`); validation executed with Node/Bun runtime only (no Savant-Code packages imported)
- **Language/Runtime:** TypeScript, Bun 1.3.14 (runtime used only as a generic JS engine)
- **Master:** `FID-2026-0813-001` (D11, D12, P1.B gate)
- **Depends on:** FID-2026-0813-007 (export to validate)

## Detailed Description

### Problem

An export that only validates inside Savant-Code proves nothing to an auditor. The P1.B gate requires the receipt to
stand alone.

### Expected Behavior

A scripted audit (fixture-generated session → `/attest` export → clean-process validation) where the validator has
**no import path to any Savant-Code package** and no network access, and it must: (1) load the embedded JSON from the
HTML (parse via regex/DOMParser-free extraction — the JSON is embedded verbatim), (2) re-canonicalize (JCS) every
receipt, (3) verify every signature against the embedded public keys, (4) recompute content hashes against the
fixture file state, (5) produce the same live/superseded classification as the export, and (6) detect a deliberately
tampered receipt. The audit asserts clean-process parity: the standalone validator and the in-product validator agree
on every receipt.

### Root Cause

No clean-process evidence exists; the gate is new and is the trust anchor for the export surface.

### Evidence

- Export artifacts: `trust-receipt.json` + `trust-receipt.html` (FID-2026-0813-007).
- The shared validator under test: `validateReceipt` (FID-2026-0813-006) — the audit re-implements the *checks* as a
  standalone script (independent implementation, per double-audit: two independent methods), not by importing it.

## Impact Assessment

### Affected Components

- NEW `cli/src/commands/attest/__tests__/clean-process-audit.test.ts` + standalone validator script (fixture-only,
  no Savant-Code imports)
- Gate dependency: FID-2026-0813-007

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: This gate is the difference between a receipt an auditor can trust and a self-referential artifact
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Fixture-first: generate a scripted session (writes + verdicts), export, then validate with a standalone script that
implements the checks independently (no shared imports). Assert parity with the in-product validator. Run with network
disabled (offline by construction — no network calls exist in the script).

### Steps

1. Fixture generator: scripted writes across all three write tools + Verifier/Adversary verdict bindings → real
   ledger.
2. Export via `/attest` (FID-2026-0813-007).
3. Standalone validator: independent JCS + Ed25519 + hash-recompute implementation over the exported JSON; parse the
   HTML-embedded JSON; assert identical results.
4. Tamper control: mutate one receipt (content tamper + signature-order tamper); assert both validators flag it.
5. Parity assertion: standalone results == in-product results for every receipt.
6. Publish exact output.

### Verification

```text
bun test cli/src/commands/attest/__tests__/clean-process-audit.test.ts
bun run --cwd=cli typecheck
```

## Perfection Loop

### Loop 1 — RED

- **RED:** No clean-process evidence path existed; the build order named the gate but not the mechanism.
- **GREEN:** Fixture + standalone-validator parity audit specified; tamper controls included; offline by construction.
- **AUDIT:** Independent implementation (double-audit method 2) — the standalone script deliberately does not import
  the product validator, so a shared bug cannot produce a false parity pass.
- **ADVERSARIAL:** "Parsing the HTML for embedded JSON is brittle" → The HTML embeds the JSON verbatim with a known
  delimiter (implementation detail of FID-2026-0813-007); the standalone validator primarily validates
  `trust-receipt.json` and cross-checks the HTML-embedded copy via the delimiter. Accepted.
- **CHANGE DELTA:** ~0.

### Missed Questions

1. **Does the audit need network to verify?** → No; Ed25519 + SHA-256 + JCS are all local. The script asserts zero
   network imports.
2. **Who runs the standalone validator in production?** → Any auditor: the script is committed under
   `cli/src/commands/attest/` and documented in the export header (D12).
3. **Is the standalone validator also used for the HTML inline verifier?** → No; the inline verifier is a convenience
   view (FID-2026-0813-007); this standalone script is the authoritative third-party path.

### Code Verification Evidence

- [x] Export artifact shape defined (FID-2026-0813-007)
- [x] Shared validator + attack suite defined (FID-2026-0813-006)
- [x] FID ledger validation passes (master + children set)
- [x] Fixture, standalone validator, parity output — 4/4 focused tests passed

### Loop 2 — Independent audit and self-correction

- **RED:** Second pass: parity could hide a bug where both validators share the same wrong assumption about the
  schema; fixture coverage of supersession and cross-session cases was implicit.
- **GREEN:** Add a schema-conformance assertion (receipt matches the master schema — unknown fields rejected) to both
  validators; add explicit superseded and cross-session fixtures to the matrix.
- **AUDIT:** Re-read confirms the added fixtures cover the master's D6 (supersession) and session-bounds rules.
- **ADVERSARIAL:** "Two independent implementations can still share a spec-level bug" → True; that is what the attack
  suite (FID-2026-0813-006) bounds from the threat side, and the schema-conformance assertion bounds the spec side.
  Accepted.
- **CHANGE DELTA:** <2%.

### Loop 3 — Final convergence

- **RED:** No residual risks.
- **GREEN:** Audit design final.
- **AUDIT:** Converged; delta <2%.
- **ADVERSARIAL:** No unresolved challenge.
- **CHANGE DELTA:** <2%.

## Implementation Closure — COMPLETE

- **Implemented:** 2026-08-13.
- **Delivered:** An independent clean-process validator validates the receipt schema and cryptographic fields without importing Savant-Code, and parity fixtures cover JSON/HTML, live/superseded, tamper, and unknown-field boundaries.
- **Verification:** Clean-process audit suite passed 4/4, including the no-Savant-import control; CLI typecheck passed.

## Resolution

- **Closed Date:** 2026-08-13.
- **Fix Description:** Independent offline receipt validator and parity audit implemented.
- **Tests Added:** Clean-process parity, supersession, tamper, schema, and dependency-isolation tests.
- **Verification Evidence:** Focused suite 4/4 and full repository gates passed.
- **Archived:** Yes — moved to `dev/fids/archive/`.

## Lessons Learned

- "Validates with zero install" is only credible if the validator is an independent implementation, not the product
  importing itself.
- Parity tests need explicit fixtures for the edge states (superseded, cross-session), not just happy-path receipts.
