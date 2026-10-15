<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: ZTAP ADVERSARIAL — Replay, Forgery, and Staleness Attack Suite

**Filename:** `FID-2026-0813-006-ztap-adversarial-attack-suite.md`
**ID:** FID-2026-0813-006
**Severity:** high
**Status:** closed
**Planning Status:** Converged after Perfection Loop; implementation complete.
**Created:** 2026-08-13
**YAGNI-Compliance:** Complete — implementation scope delivered
**Master FID:** FID-2026-0813-001
**Depends On:** FID-2026-0813-004

---

## Summary

The ADVERSARIAL-phase gate for the ZTAP signed chain: a simulated attack suite that attempts to break the receipt
scheme and must fail. Attacks covered: same-entity signature reuse (Forge signing as Verifier), JCS canonicalization
subversion, stale/duplicate `seq` replay, receipt tampering, ledger replay across sessions, and pubkey substitution.
The suite is the master's P1.A "replay/forgery test passes" gate and makes the Forge≠Verifier separation mechanically
checkable (master D2).

## Environment

- **OS:** Windows (`win32`); cross-platform (Bun)
- **Language/Runtime:** TypeScript, Bun 1.3.14; `packages/agent-runtime/` + `common/`
- **Master:** `FID-2026-0813-001` (D2, D4, D6, verification gates)
- **Depends on:** FID-2026-0813-004 (wired chain to attack)

## Detailed Description

### Problem

A signed chain that cannot survive an adversarial test is decoration. The build order demanded "simulated
replay/forgery attack — reject same-entity signatures (Forge≠Verifier), enforce JCS canonicalization, reject stale
receipts" — but with the original single-session-key design those checks were vacuous. This FID specifies the attacks
against the corrected per-role design and the assertions that must hold.

### Expected Behavior

Every attack below is attempted by the suite and must fail (assertion holds):

| # | Attack | Assertion |
|---|---|---|
| A1 | Forge's key signs a Verifier verdict slot | Verification fails: signer pubkey ≠ manifest's verifier role key |
| A2 | Same key signs both writer and verifier on one receipt | "complete" validation rejects <2 distinct role keys |
| A3 | Receipt JSON **value substitution** (path/timestamp/fidId changed) without re-signing | JCS canonical string changes → `over` hash differs → signature fails. Key reordering/whitespace is a **negative control**: canonicalization is value-preserving, so the signature must still verify (reordering is not a tamper under JCS) |
| A4 | Change hash altered (content tamper) | Signature covers the hash; recompute mismatch → reject |
| A5 | Old receipt replayed as new (same session, same `seq`) | Strictly increasing `seq` rule rejects duplicates |
| A6 | Receipt replayed across sessions | `sessionId` is part of the signed payload and manifest; cross-session replay fails role-key lookup |
| A7 | Receipt timestamp outside session bounds | Session manifest bounds check rejects |
| A8 | Pubkey substitution in the manifest | The manifest is itself signed by the harness role (session open/close); substitution breaks the harness signature |
| A9 | Verdict text swapped after signing | Verdict `over` hash mismatch → reject |
| A10 | Ledger line edited in place | JSONL line fails JCS + signature validation |

### Root Cause

Design-time only; the suite is new. Its necessity derives from master D2/D4/D6 verification rules (1)–(7).

### Evidence

- Verification rules defined in master D-section ("Verification rules" under the schema).
- Adversary verdict-format reference: `agents/adversary/adversary.ts:64-84`.

## Impact Assessment

### Affected Components

- NEW `packages/agent-runtime/src/provenance/__tests__/attack-suite.test.ts` (or `common/src/crypto/__tests__/`
  for A1–A4/A8)
- Verifier/validator surface shared with FID-2026-0813-007 export and FID-2026-0813-008 clean-process check

### Risk Level

- [x] Critical: System crash, data loss, or security vulnerability (the suite exists to prove the trust boundary)
- [ ] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

A table-driven attack suite: each attack is a fixture mutation + validation call; the suite asserts the validator
rejects. The validator (shared by runtime, export, and clean-process check) is the single implementation under test —
the suite proves the validator, not a test-only copy.

### Steps

1. Extract the receipt validator as a shared function (`validateReceipt(receipt, sessionManifest)` returning typed
   failures) if not already isolated by FID-2026-0813-004.
2. Implement attacks A1–A10 as fixtures; run; assert every attack fails validation with the expected failure code.
3. Add negative controls (a pristine receipt must validate; A3's key-reordering fixture must validate) to prove the
   suite isn't over-rejecting and that JCS is value-preserving by design.
4. Wire the suite into the P1.A gate; publish exact output.

### Verification

```text
bun test packages/agent-runtime/src/provenance/__tests__/attack-suite.test.ts
bun run --cwd=packages/agent-runtime typecheck
bun x eslint . --max-warnings 0
```

## Perfection Loop

### Loop 1 — RED

- **RED:** The build order's same-entity rejection was vacuous under a single session key; no validator existed to
  attack.
- **GREEN:** Ten concrete attacks (A1–A10) specified against the per-role design; validator-first approach; negative
  controls to prevent over-rejection.
- **AUDIT:** Each attack maps to a master verification rule (1)–(7); the suite is table-driven so new attacks are one
  row each.
- **ADVERSARIAL:** "Can the suite prove what it claims?" → It proves the validator rejects these mutations; it cannot
  prove validator completeness. Mitigation: the suite is the regression gate, and D12 bounds the claim (process
  evidence, not mathematical certainty). Accepted.
- **CHANGE DELTA:** ~0.

### Missed Questions

1. **Should the suite attack the HTML verifier too?** → No; the HTML verifier is a convenience view (master Loop 2
   fix); the authoritative validator is the shared `validateReceipt` — the suite attacks that.
2. **Is a valid receipt with wrong metadata an attack?** → Yes — validator checks `fidId`/`path`/`tool` against the
   session context where applicable; added as A11 (metadata spoof: receipt claims a different file than the hash
   covers — rejected because the hash is over content, and path+hash are signed together).
3. **Do attacks run in production?** → No; the suite is a test gate. Production runs only the validator's checks.

### Code Verification Evidence

- [x] Master verification rules (1)–(7) exist and are mechanically checkable
- [x] Adversary verdict format confirmed (`agents/adversary/adversary.ts:64-84`)
- [x] FID ledger validation passes (master + children set)
- [x] Attack suite implementation + output — 23/23 shared provenance tests passed

### Loop 2 — Independent audit and self-correction

- **RED:** Second pass: A1 (role-key mismatch) depends on the manifest mapping being unforgeable; A8 covers manifest
  signing. A replay of an *entire session* (export re-presented later) is not covered — but that is the export's
  business (session bounds + timestamps), covered by A7.
- **GREEN:** A11 added (metadata spoof); cross-session replay (A6) explicitly asserts sessionId binding.
- **AUDIT:** Re-read confirms every master rule has ≥1 attack and every attack maps to ≥1 rule.
- **ADVERSARIAL:** "Validator and suite could share a bug" → Negative controls (pristine validates) bound that risk;
  the clean-process check (FID-2026-0813-008) exercises the validator independently. Accepted.
- **SELF-CORRECT (post-write adversarial pass):** attack A3 corrected — JCS canonicalization is value-preserving, so
  key reordering/whitespace changes are NOT a tamper (signature must still verify) and were mis-specified as a
  rejection; the real tamper is value substitution (path/timestamp/fidId/content), which changes the canonical string
  and must fail. Key reordering is now an explicit negative control (fixes F3).
- **CHANGE DELTA:** <2%.

### Loop 3 — Final convergence

- **RED:** No residual risks.
- **GREEN:** Attack matrix final.
- **AUDIT:** Converged; delta <2%.
- **ADVERSARIAL:** No unresolved challenge.
- **CHANGE DELTA:** <2%.

## Implementation Closure — COMPLETE

- **Implemented:** 2026-08-13 as the adversarial portion of the shared provenance suite.
- **Delivered:** Validator and negative controls cover replay, forgery, wrong-role, same-entity, sequence, JCS tamper, stale/superseded, session-bound, metadata, and unknown-field attacks (A1–A11).
- **Verification:** Shared provenance suite passed 23/23, including pristine acceptance controls and tamper rejection; clean-process parity independently passed 4/4.

## Resolution

- **Closed Date:** 2026-08-13.
- **Fix Description:** ZTAP receipt validation and A1–A11 adversarial attack coverage implemented.
- **Tests Added:** Table-driven attack, negative-control, batch, and schema fail-closed tests.
- **Verification Evidence:** Focused suite 23/23 plus clean-process 4/4 and full repository gates passed.
- **Archived:** Yes — moved to `dev/fids/archive/`.

## Lessons Learned

- A security suite needs negative controls — a validator that rejects everything is indistinguishable from a broken
  one without pristine-receipt controls.
- Table-driven attacks keep the suite growing with the threat model; one row per attack, one assertion per row.
