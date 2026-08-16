<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Planning Audit Response — FID-2026-0813-001 (ZTAP Provenance Master)

**Date:** 2026-08-13
**Auditor:** Nova — independent third-party ECHO auditor
**Target:** `dev/fids/FID-2026-0813-001-ztap-provenance-master.md` (Status: analyzed; Planning-converged)
**Mode:** Planning audit only. No implementation executed. Verdict covers the *design*, not shipped code.

---

## Verdict

**PLANNING APPROVED FOR OPERATOR DECISION.**

The master FID is a genuinely strong, codebase-verified architecture. The RED catalog was checked against the actual source (not the research doc), and every cited interception point, field gap, and reuse candidate is real. The three corrections to my own build order (write-holding → append-only chain; single key → per-role HKDF; regenerable → non-regenerable ledger) are each justified by code inspection, not opinion. The design is sound enough to route to child FIDs.

This is NOT a ship authorization. It is a planning sign-off: the architecture may proceed to implementation through children 002–010.

---

## What I Verified Directly (code, not claims)

| FID claim | Cited site | Verified? |
|---|---|---|
| EHEL pre-write gate exists | `native.ts:279` `enforcement.beforeToolCall` | ✅ confirmed (blocking, unconditional) |
| Per-write capture exists | `native.ts:351` `echoCompliance.recordWrite` | ✅ confirmed |
| After-call enforcement | `native.ts:611` `enforcement.afterToolCall` | ✅ confirmed |
| Write record lacks agentId/fsmPhase/FID | `echo-compliance.ts:166` recordWrite | ✅ confirmed — `WriteRecord` has only path/lineDelta/contentKnowledge/isNewFile/content/securitySensitive |
| Custom tools cannot write | `custom.ts:76` | ✅ confirmed (read/network-only; no write adapter) |
| Adversary is read-only, text verdicts | `adversary.ts:39-49` | ✅ confirmed (zero write tools; verbatim verdict payload) |
| Event stream reuse candidate | `trace.ts:4`, `trace-writer.ts:90-101` | ✅ confirmed (`RuntimeTraceEvent`, `MAX_RUNTIME_EVENTS` bound) |
| No existing crypto in common | grep `common/src/` for ed25519/HKDF/importKey/webcrypto | ✅ 0 matches — `common/src/crypto/` is new by necessity |

**All 9 RED-catalog citations resolve.** The interception design (hook at `native.ts:611` after-write, verdict-binding at phase-completion lifecycle) is built on real sites.

---

## Design Strengths (auditor's read)

1. **Append-only chain over write-holding (D1).** Correct. Verified: Verifier (zero-tool) and Adversary spawn *after* writes land. A literal hold would serialize the Perfection Loop and break interactive latency. The "complete signed chain" guarantee is preserved via post-write verdict binding.
2. **Per-role HKDF keys (D2).** This is the load-bearing insight. A single session key makes "Forge≠Verifier" rejection vacuous — the FID caught that my build order's ephemeral-key model was nominal, not checkable. Per-role derivation makes separation-of-duties *cryptographically enforceable* (≥2 distinct role sigs required). This is what turns ECHO's structural moat into a proof.
3. **Honest claim boundary (D12).** The FID explicitly forbids "cryptographic proof of independent AI review" — it states the receipt evidences *process*, not model independence. This is integrity, not marketing. Matches the auditor's own boundary discipline.
4. **Hash-only ledger (D3) + non-regenerable (D5).** Law 12 satisfied by construction (no content/prompts/keys on disk). The "regenerable" claim from my build order is correctly rejected — signatures are ephemeral-key artifacts; deleting the ledger is a real (documented) audit-loss property, not a bug.
5. **Latency budget (D8) + fail-closed optional (D5/Q5).** `<10ms` sync overhead, `record` default, `enforce` opt-in. Correct: fail-closed must never be a default that bricks interactive writes on crypto-unsupported runtimes.

---

## Risks / Open Items (auditor's flags — not blockers)

1. **Verdict-binding hook site (D9) is named but not pinned.** The master says "exact site pinned in FID-2026-0813-004." Acceptable for a master, but FID-004's RED must locate the precise AUDIT/ADVERSARIAL completion call sites before wiring. **Gate: FID-004 must cite the exact loop-iteration line before implementation.**
2. **Session-seed compromise is the one unrecoverable risk (ADVERSARIAL, Loop 1).** Memory-only custody + no persistence mitigates but does not eliminate. Accepted for ephemeral v1 — documented. Fine, but the `/attest` copy should warn auditors that receipt trust = session-key trust.
3. **Inline HTML verifier trust (Loop 2 fix #4).** Correctly bounded: JSON + scriptable crypto verifier is authoritative; HTML is convenience. Good. Ensure the HTML embeds that disclaimer verbatim.
4. **Event volume (Loop 2 fix #5).** Bounded per-turn with dedupe, mirroring `MAX_RUNTIME_EVENTS`. Sound.

---

## Governance

- **No ECHO law change required for P1.** Confirmed — ZTAP expresses Laws 3/4, does not bypass them.
- **Law 2 "Escrowed Execution" addendum is OUT of scope** for this FID (correctly excluded). Flagged for the P-horizon (unattended) work only.
- **Master/child registry** validated by `bun test scripts/fid-ledger.test.ts` → 5 pass / 0 fail (per FID self-report; ledger contract satisfied: single master, lists all children, deps resolve, no cycles).

---

## Conditions for Proceeding

1. Route to children 002–010 via the target harness (strong-harness model authors/executes; Nova audits).
2. FID-004 must pin the verdict-binding hook site in its own RED before wiring (flag #1).
3. Child AUDIT/ADVERSARIAL gates (005, 006, 008, 010) must pass before any child closes — Nova re-audits each.
4. **Push/release remains Spencer's hard gate.** This planning approval is not a ship authorization.

---

## Bottom Line

The design is real, verified, and honest about its boundaries. The crypto is deliberately small (Ed25519 + HKDF + JCS, no PKI/keychain/external trust). The surface is cheap (reuses `/export` pipeline + existing event stream). It claims the enterprise-accountability category without overclaiming. **Planning approved for operator decision** — proceed to child FIDs when you're ready.

*Audit by Nova, 2026-08-13. Code citations independently verified against `native.ts`, `custom.ts`, `echo-compliance.ts`, `adversary.ts`, `trace.ts`, `trace-writer.ts`, and a `common/src/` crypto grep.*
