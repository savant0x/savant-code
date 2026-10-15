<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: ZTAP Crypto — Signing Primitives

**Filename:** `FID-2026-0813-003-ztap-crypto-primitives.md`
**ID:** FID-2026-0813-003
**Severity:** high
**Status:** closed
**Planning Status:** Converged after Perfection Loop; implementation complete.
**Created:** 2026-08-13
**YAGNI-Compliance:** Complete — implementation scope delivered
**Master FID:** FID-2026-0813-001
**Depends On:** FID-2026-0813-002

---

## Summary

Implements `common/src/crypto/` — the offline signing primitives for ZTAP: session-seed generation, HKDF-SHA256
per-role key derivation (per master D2), Ed25519 sign/verify via WebCrypto (with `@noble/ed25519` fallback), SHA-256
content hashing, JCS (RFC 8785) canonicalization, and a fail-closed public API. No key ever leaves memory; nothing is
logged; the module is dependency-light and fully offline (Law 12, Five Questions #5).

## Environment

- **OS:** Windows (`win32`); cross-platform (Bun 1.3.14, Node-compatible WebCrypto)
- **Language/Runtime:** TypeScript (`strict: true`), `common/` workspace
- **Master:** `FID-2026-0813-001` (D2, D3, D4, D8)
- **Depends on:** FID-2026-0813-002 (catalog field decisions drive the receipt payload shape)

## Detailed Description

### Problem

No signing primitives exist in `common/src/` (verified: only an unrelated `sha256` in `common/src/reddit-capi.ts:33`).
The signed chain, verdict binding, and `/attest` verification all require a single, audited crypto surface.

### Expected Behavior

A `common/src/crypto/` module with:

- `createSessionSeed()` → 32 bytes via `crypto.getRandomValues`; never serialized.
- `deriveRoleKeypair(sessionSeed, sessionId, role)` → Ed25519 keypair via HKDF-SHA256
  (`ikm=seed, salt=sessionId, info="savant-provenance:role:"+role`) + WebCrypto `importKey` (raw 32-byte seed).
- `hashChange(content)` → `sha256:<hex>` of post-write content bytes.
- `jcsCanonicalize(value)` → RFC 8785 canonical JSON string; rejects non-finite numbers.
- `sign(keypair, payload)` / `verify(pubkey, payload, signature)` — payload is the JCS string or its hash per the
  master schema (`over` fields).
- Fail-closed: any crypto failure throws a typed `ProvenanceCryptoError`; callers decide block-vs-record per mode
  (D8), never a silent unsigned write in `enforce` mode.

### Root Cause

Greenfield capability; no prior module.

### Evidence

- `common/src/reddit-capi.ts:33-35` — only existing `sha256` helper (unrelated, stays).
- WebCrypto Ed25519 + HKDF are available in Bun 1.3.14; raw-seed import semantics verified empirically in
  FID-2026-0813-005 (AUDIT gate). Fallback: `@noble/ed25519` (pure JS, zero deps) if any WebCrypto edge misbehaves.

## Impact Assessment

### Affected Components

- NEW `common/src/crypto/` (module boundary per master D10)
- NEW `common/src/crypto/__tests__/` — unit suite (determinism, round-trip, tamper, JCS vectors)
- Consumers (future): FID-2026-0813-004 wiring, FID-2026-0813-007 export, FID-2026-0813-008 clean-process verifier

### Risk Level

- [x] Critical: System crash, data loss, or security vulnerability (crypto correctness is the core trust boundary)
- [ ] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Small, dependency-light, exhaustively tested module. Deterministic key derivation (same seed+session+role ⇒ same
keypair) so receipts from a session are verifiable without re-deriving (verification uses embedded pubkeys, not
re-derivation — determinism is a test property, not a runtime requirement).

### Steps

1. `session.ts` — seed generation + role derivation (HKDF via WebCrypto; `@noble/ed25519` fallback path).
2. `hash.ts` — SHA-256 helper returning `sha256:<hex>` (string/bytes input).
3. `jcs.ts` — RFC 8785 canonicalization with conformance vectors (object key ordering, number handling, string
   escaping, rejection of non-finite numbers).
4. `sign.ts` / `verify.ts` — typed sign/verify over JCS strings and hashes; `ProvenanceCryptoError`.
5. `index.ts` — public surface; no internal state; fail-closed exports.
6. Unit tests: round-trip, tamper detection, cross-role key distinctness, determinism, JCS vectors, error paths.

### Verification

```text
bun test common/src/crypto/
bun run --cwd=common typecheck
bun x eslint common/src/crypto --max-warnings 0
bunx prettier --check common/src/crypto
```

## Perfection Loop

### Loop 1 — RED

- **RED:** No crypto module exists; the build order's "deterministic Ed25519 keypair gen (WebCrypto/Bun)" needs
  concrete derivation semantics; single-key design (build order Q1) was rejected at the master (D2) in favor of
  per-role keys.
- **GREEN:** Module boundary, API, derivation scheme, JCS choice, and fail-closed contract specified above; fallback
  strategy for raw-seed import.
- **AUDIT:** JCS is RFC 8785 (industry standard — Five Questions #5); HKDF + Ed25519 are WebCrypto built-ins (no new
  runtime deps); `@noble/ed25519` is the only optional dep and is zero-dependency itself. WebCrypto Ed25519 support
  in Bun 1.3.14 is empirically confirmed by FID-2026-0813-005 before this FID's implementation is accepted.
- **ADVERSARIAL:** "Does embedding pubkeys make receipts forgeable?" → No: an attacker who can replace the pubkey can
  re-sign, but that requires session-state compromise (memory-only seed); the audit trail's tamper-evidence is the
  signed chain, and `/attest` verification re-checks signatures against the embedded keys — replacement is detectable
  because the manifest is itself part of the signed session record.
- **CHANGE DELTA:** ~0.

### Missed Questions

1. **Should the same role key sign for all sessions?** → No; per-session seed ⇒ per-session keys; cross-session
   attribution is a P2 (scorecard) concern, not P1.
2. **Is determinism required at runtime?** → No; it is a test property. Runtime verification uses embedded pubkeys.
3. **Can the seed be reconstructed from a receipt?** → No; receipts carry public keys only (Law 12, D3).
4. **What if WebCrypto lacks Ed25519 at runtime?** → `enforce` mode fails closed with a typed error; `record` mode
   emits a visible notice and does not sign (documented in FID-2026-0813-005's mode matrix).

### Code Verification Evidence

- [x] No existing crypto module in `common/src/` (Law 7 satisfied; `reddit-capi.ts:33` is unrelated and retained)
- [x] Bun 1.3.14 WebCrypto Ed25519/HKDF availability verified in FID-2026-0813-005 (empirical gate, cross-referenced)
- [x] FID ledger validation passes (master + children set)
- [x] Implementation + unit suite — 21/21 focused tests passed

### Loop 2 — Independent audit and self-correction

- **RED:** Second pass: JCS implementation risk (subtle canonicalization bugs); schema must avoid non-JCS-safe values
  (floats/NaN) — enforced by types; a bare `string` signature could be ambiguous between "signature of JCS string" and
  "signature of hash".
- **GREEN:** Signature payloads are typed (`SignedPayload = { kind: 'jcs' | 'hash', value: string }`) so
  verify() cannot be confused; JCS conformance vectors are mandatory in the test suite.
- **AUDIT:** Re-read of the API surface confirms every public function has an unambiguous fail-closed path.
- **ADVERSARIAL:** Confusion attack (signature of hash vs string) closed by the tagged union. Accepted.
- **CHANGE DELTA:** <2%.

### Loop 3 — Final convergence

- **RED:** No residual risks.
- **GREEN:** API + tests final.
- **AUDIT:** Converged; delta <2%.
- **ADVERSARIAL:** No unresolved challenge.
- **CHANGE DELTA:** <2%.

## Implementation Closure — COMPLETE

- **Implemented:** 2026-08-13.
- **Delivered:** `common/src/crypto/` provides session seeds, HKDF role derivation, deterministic Ed25519 keypairs, SHA-256 hashing, JCS canonicalization, typed sign/verify, and fail-closed errors. Bun's raw-seed WebCrypto limitation is handled by the named `@noble/ed25519` fallback.
- **Verification:** `common/src/crypto/__tests__/crypto.test.ts` passed 21/21; common typecheck passed; custody and confusion negative controls passed.

## Resolution

- **Closed Date:** 2026-08-13.
- **Fix Description:** Offline ZTAP cryptographic primitive surface implemented and verified.
- **Tests Added:** JCS vectors, hash vectors, key derivation, role separation, signing, tamper, and fail-closed tests.
- **Verification Evidence:** Focused suite 21/21 and full repository gates passed.
- **Archived:** Yes — moved to `dev/fids/archive/`.

## Lessons Learned

- "Deterministic keys" is a test property, not a runtime requirement; runtime trust comes from embedded public keys.
- Signature payloads need typed kinds at the API boundary to prevent hash-vs-string confusion attacks.
