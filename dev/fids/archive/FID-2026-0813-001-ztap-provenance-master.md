<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: ZTAP Provenance Master — Zero-Trust Agentic Provenance (P1 Wedge, Complete Feature)

**Filename:** `FID-2026-0813-001-ztap-provenance-master.md`
**ID:** FID-2026-0813-001
**Severity:** high
**Status:** closed
**Planning Status:** Converged after Perfection Loop; implementation executes through child FIDs 002–010.
**Created:** 2026-08-13
**YAGNI-Compliance:** Complete — implementation scope delivered
**Depends On:** none
**Sources:** `dev/build-orders/2026-08-13-ztap-build-order.md` (planning, not approved), `docs/design/Savant-Code Feature Deep Research.md`, `dev/nova/scratchpad/2026-08-12-novel-features-deep-research-prompt.md`

---

## Summary

This master FID defines the **complete** Zero-Trust Agentic Provenance (ZTAP) wedge — P1.A cryptographic provenance at
the EHEL write boundary, P1.B the `/attest` trust-receipt export, and P1.C the Live Adversarial Trust Matrix. It is not
an MVP: it specifies the full production architecture, receipt schema, key-derivation model, interception points,
verification gates, and the nine child FIDs that carry implementation. The feature makes Savant-Code's existing
mechanical governance (EHEL law enforcement + the Adversary's override verdict) into a portable, cryptographically
verifiable trust artifact: every agent write is hashed and signed at the write boundary, Verifier and Adversary verdicts
are bound to that change hash as signed append-only records, and `/attest` exports a self-contained offline receipt an
auditor can verify with zero Savant-Code install.

The design corrects the source build order's three architectural errors discovered during RED-phase codebase
verification: (1) the "hold the write until AUDIT/ADVERSARIAL sign" model is replaced by an append-only signed chain
(Verifier/Adversary phases run turns *after* writes land, so a hold would serialize the Perfection Loop and destroy
interactive latency); (2) a single session key is replaced by per-role HKDF-derived keys so the Forge≠Verifier
separation is cryptographically checkable, not nominal; (3) the "gitignored *and* regenerable" ledger contradiction is
resolved in favor of an append-only, non-regenerable audit log, with supersession handled by export-time hash
re-computation.

**Scope boundary:** "Complete feature" = the complete P1 wedge (P1.A + P1.B + P1.C). P2 (scorecard/FSRS-6), P3 (deep
architecture), and P4 (x402 economy) remain out of scope with their own trigger gates per the build order; the required
Law-2 "Escrowed Execution" addendum is flagged but deliberately NOT part of this feature.

## Environment

- **OS:** Windows (`win32`) workstation; cross-platform runtime (Bun)
- **Language/Runtime:** TypeScript monorepo (`strict: true`), Bun ≥1.3.11 (root pins `1.3.14`), React/OpenTUI CLI
- **Governance:** ECHO Protocol v0.2.0 (harness) / v0.1.2 single-agent; EHEL enforcement layer
- **Product target:** Savant-Code v0.0.23+ (working tree; ZTAP lands post-0.0.23)
- **Repository state:** clean `main` at session start; build order + research docs untracked

## Detailed Description

### Problem

Savant-Code enforces the 15 ECHO laws mechanically (EHEL) and runs a unique Adversary meta-verification layer whose
verdicts override the Verifier — but all of that governance is **invisible and unprovable**. Nothing persists
per-write provenance; nothing binds a Verifier/Adversary verdict to the content it judged; nothing lets a third party
verify that a change passed the loop. The moat exists but is not a product surface. The build order's thesis: turn
invisible governance into a visible, exportable, cryptographically verifiable trust artifact.

### Expected Behavior

1. Every successful agent write (`write_file`, `str_replace`, `apply_patch` via the native executor) produces a signed
   receipt in `.savant/provenance/` recording change hash, path, writer agent, phase, FID id, and timestamp.
2. Verifier (AUDIT) and Adversary (ADVERSARIAL) verdicts are bound to the change hash as signed append-only records.
3. `/attest` exports a self-contained offline JSON + HTML trust receipt verifiable with zero install and zero network.
4. The Live Adversarial Trust Matrix renders verdicts over the diff in real time, read-only, sourced only from signed
   events.
5. Fail-closed semantics are available (`enforce` mode); keys and content never appear in logs or the ledger (Law 12).

### Root Cause

EHEL state is in-memory and per-session (`EnforcementState`, `EchoComplianceTracker`); there is no persistence, no
signature, no structured verdict record, and no export surface. The interception point exists but is unextended.

### Evidence (RED catalog — verified against code)

- Write interception exists: `packages/agent-runtime/src/tools/tool-executor/native.ts:279` (EHEL pre-write gate),
  `native.ts:351` (`echoCompliance.recordWrite`), `native.ts:611` (`enforcement.afterToolCall`).
- EHEL shared enforcement: `packages/agent-runtime/src/echo/enforcement.ts:88` (`getOrCreateEnforcement`),
  `enforcement.ts:170` (`beforeToolCall`), `enforcement.ts:289` (`afterToolCall`).
- Per-write capture today (`packages/agent-runtime/src/util/echo-compliance.ts:166` `recordWrite`): path, lineDelta,
  contentKnowledge, isNewFile, content (memory-only), securitySensitive — **no agentId, no fsmPhase, no persisted
  law-check results, FID id only via path-regex heuristic** (`echo-compliance.ts:252` `getTouchedFidId`).
- Custom tools cannot write: `packages/agent-runtime/src/tools/tool-executor/custom.ts:76` — "Custom extension tools
  must declare read or network effects until an audited write adapter exists." Interception is native-only.
- Adversary is read-only with text verdicts: `agents/adversary/adversary.ts:39-44` (toolNames) — no structured verdict
  record exists anywhere.
- Event stream exists for reuse: `common/src/types/contracts/trace.ts:4` (`RuntimeTraceEvent`),
  `cli/src/utils/trace-writer.ts:96` (`createTraceWriter`), recorded per tool at `native.ts:99`.
- `/export` branded-HTML pipeline exists: `cli/src/commands/export-conversation.ts`.
- `.savant/` gitignored sidecar convention established: `.savant/graph.db`
  (`packages/knowledge-graph/src/store.ts:14`), `.savant/design-systems/` (`docs/design/design-system-library.md:363`).
- No existing crypto/signing utilities in `common/src/` (only `sha256` in `common/src/reddit-capi.ts:33`, unrelated);
  `common/src/crypto/` is genuinely new.

## Design Decisions (Resolved Q1–Q6)

### D1 — Append-only signed chain, not write-holding (build order correction #1)

Writes complete normally and immediately. A receipt is **created** at write time (status `pending`) and **extended**
when the Verifier (AUDIT) and Adversary (ADVERSARIAL) phases complete. Rationale: verified architecture — the
zero-tool Verifier spawns in AUDIT and the Adversary in ADVERSARIAL, both after writes land. A literal hold would
serialize the Perfection Loop and violate the interactive-latency gate. The "complete signed chain" claim is preserved:
a complete receipt carries writer + verifier (+ adversary) signatures over the same change hash.

### D2 — Per-role Ed25519 keys derived from a session seed (build order correction #2, resolves Q1)

- Session seed: 32 bytes from `crypto.getRandomValues`, held in memory only, wiped at session end, never serialized,
  never logged (Law 12).
- Per-role keys: `HKDF-SHA256(ikm = seed, salt = sessionId, info = "savant-provenance:role:" + agentType)` → 32-byte
  role seed → Ed25519 keypair via WebCrypto `importKey` (Bun 1.3.14; fallback `@noble/ed25519` if raw-seed import
  misbehaves — verified empirically in FID-2026-0813-005).
- A `harness` role key signs system events (session open/close, rewind, mode changes).
- Receipts and the session manifest embed the session's **public** role keys. No keychain, no persistence, no external
  trust anchor needed; an auditor verifies against the embedded pubkeys.
- **Separation of duties becomes checkable:** a complete receipt must carry ≥2 distinct signing keys (writer + verifier;
  + adversary when ADVERSARIAL completes). Same-entity rejection (FID-2026-0813-006) is a real, enforceable check.

### D3 — Hash-only ledger; Law 12 by construction (resolves ledger security)

Receipts store the SHA-256 of the post-write content, the relative path, tool, writer metadata, phase, FID id,
law-check outcomes, timestamp, and signatures. **Never** file content, prompts, credentials, or PII. Verdict text is
stored verbatim because it is the evidence — it is the model's judgment payload, not source material. The session seed
and private keys are never written to disk or emitted in chunks/logs.

### D4 — JCS canonicalization (RFC 8785)

Receipt JSON is canonicalized per RFC 8785 before hashing and signing; signature validation re-canonicalizes.
Implementation: `canonicalize` package or an in-repo ~100-line implementation with conformance tests (FID-2026-0813-003).
Receipt schema is restricted to strings/ints/timestamps (JCS rejects non-finite numbers — the schema never uses them).

### D5 — Ledger: `.savant/provenance/<sessionId>/`, append-only, NOT regenerable (build order correction #3, resolves Q3)

- Path: `.savant/provenance/<sessionId>/receipts.jsonl` (one JCS-canonicalized receipt per line) +
  `session.json` (session id, public role keys, role→agentType map, session bounds, monotonic seq counter).
- Gitignored via the established `.savant/` rule. **Not regenerable** — signatures are ephemeral-key artifacts;
  deleting the ledger destroys the audit trail (mirrors `.savant/graph.db` treat-as-regenerable only because that DB is
  derived data; receipts are not). The build order's "regenerable" claim is explicitly rejected.
- Append-only: no in-place edits, ever. Corrections are new records; divergence is handled at export (D6).
- git-notes is rejected for v1 (fragile per research; mutates object store) and noted as a v2 candidate only.

### D6 — Live/superseded classification at export time (new Q6 — rewind/divergence)

`/rewind`, manual edits, and later changes can make a receipt's content hash no longer match the file on disk. The
ledger is never rewritten; at export time `/attest` recomputes each receipt's target-path hash and classifies it
`live` (matches) or `superseded` (mismatch). This covers rewind, manual edits, and reverts with zero rewind
integration. A receipt can also be `complete` (all phases signed) or `pending` (phases outstanding).

### D7 — Structured verdict capture: signed verbatim payloads (new gap from RED)

Verifier/Adversary outputs are model text (Adversary verdict format defined in `agents/adversary/adversary.ts:64-84`).
The harness binds each verdict to the receipt by signing the JCS hash of
`{ changeHash, phase, agentType, agentId, verbatimVerdictText, timestamp }`. Integrity does not depend on parsing;
the verdict record is the raw evidence an auditor can read. P1.C parses verdict text **only for display**, never for
integrity or control.

### D8 — Provenance modes and latency budget (resolves FID-ztap-004 scope)

- `provenance.mode`: `off` | `record` (default; sign every write, non-blocking, visible notice on failure) |
  `enforce` (fail-closed: a write is blocked if signing cannot complete).
- Latency budget: **<10 ms synchronous overhead per write** (Ed25519 sign and SHA-256 are microsecond-scale; the
  budget is a regression guard). Ledger I/O is async with a bounded queue and turn-end flush; a failed append never
  blocks or fails the write in `record` mode.
- The session manifest records the mode; receipts from `enforce` sessions carry a `failClosed: true` marker.

### D9 — Interception point and phase hooks

- Write-time receipt creation: `packages/agent-runtime/src/tools/tool-executor/native.ts`, immediately after
  `enforcement.afterToolCall` (`native.ts:611`), using the already-resolved written content
  (`getSuccessfulFileContent`) and the resolved write path. Only the native executor signs (custom tools are
  read/network-only, `custom.ts:76`).
- Verdict binding: hook where the AUDIT phase completes with the Verifier spawn's final message and where ADVERSARIAL
  completes with the Adversary's final message (the phase lifecycle in the agent loop; exact site pinned in
  FID-2026-0813-004).
- Event stream: native.ts emits a `provenance_receipt` chunk (write receipt / verdict binding / supersession notice)
  consumed by P1.C overlays and tests; bounded and best-effort like `traceWriter` (`cli/src/utils/trace-writer.ts:96`).

### D10 — Reuse before create (Law 7)

- Event backbone: `RuntimeTraceEvent`/`traceWriter` shape and conventions.
- Write record seed: `EchoComplianceTracker.recordWrite` data extended with agentId/fsmPhase/structured FID id.
- Export rendering: `/export` branded-HTML pipeline (`cli/src/commands/export-conversation.ts`).
- Sidecar convention: `.savant/` ignore rules already in `.gitignore`/`.savantignore`.
- No new signing primitive exists; `common/src/crypto/` is new by necessity (verified).

### D11 — `/attest` export shape (P1.B)

New `/attest` command in `cli/`:
- `trust-receipt.json` — session manifest + all receipts + verification summary (role keys, signature status per
  receipt, live/superseded classification, per-FID aggregation).
- `trust-receipt.html` — self-contained, offline, Neon Slate themed, inlined assets, **embeds the JSON plus an inline
  JS verifier** that (a) re-canonicalizes (JCS) and verifies every signature against embedded pubkeys, (b) recomputes
  content hashes against current file state, (c) renders the signed chain per FID. Auditor path: open the file in a
  browser, zero network, zero install, zero Savant-Code.
- Terminal summary: counts (receipts, live/superseded, complete/pending, per-FID), first failing check if any.

### D12 — Honest claim boundary (marketing/audit integrity)

The receipt **evidences** that the harness ran its phases and bound recorded verdicts to content. It cannot prove LLM
verdict independence (nothing cryptographic can). The value case and `/attest` copy must state: "mechanically enforced
process, made visible and exportable" — never "cryptographic proof of independent AI review." The moat remains EHEL +
the Adversary; the receipt is the proof-of-process artifact. The `/attest` export also warns auditors that receipt
trust rests on the session's ephemeral key (memory-only custody, never persisted): a compromised session key
compromises every receipt of that session (Nova audit flag #2).

## TrustReceipt v1 Schema

```jsonc
{
  "schema": "savant.provenance.receipt.v1",
  "sessionId": "sess_<compactId>",
  "seq": 42,                          // monotonic per session
  "status": "pending",                // pending | complete | superseded (export-time only)
  "changeHash": "sha256:<hex>",       // SHA-256 of post-write file content
  "path": "src/foo.ts",               // project-relative
  "tool": "write_file",               // write_file | str_replace | apply_patch
  "fidId": "FID-2026-0813-004",       // resolved or null
  "lawChecks": [ { "law": 1, "outcome": "passed" } ],  // pre-write gate outcomes (blocked | advisory | passed)
  "failClosed": false,                // true only when written under enforce mode
  "writer": { "agentId": "...", "agentType": "forge", "phase": "green" },
  "timestamp": "2026-08-13T12:00:00.000Z",
  "signatures": [
    { "role": "forge", "agentId": "...", "sig": "<base64url>",
      "over": "<sha256 of JCS(receipt without signatures)>" }
  ],
  "verdicts": [
    { "phase": "audit", "agentType": "verifier", "agentId": "...",
      "verdictText": "<verbatim model output>", "timestamp": "...",
      "sig": "<base64url>", "over": "<sha256 of JCS({changeHash, phase, agentType, agentId, verdictText, timestamp})>" },
    { "phase": "adversarial", "agentType": "adversary", "agentId": "...",
      "verdictText": "...", "timestamp": "...", "sig": "...", "over": "..." }
  ]
}
```

Verification rules: (1) each `signatures[].over` hash must match the JCS-canonical receipt-without-signatures;
(2) each `verdicts[].over` must match the JCS of the verdict payload; (3) every signature verifies against the session
manifest's pubkey for that role; (4) a `complete` receipt must carry ≥2 distinct role keys (writer + verifier) and a
third (adversary) when the ADVERSARIAL phase completed; (5) `seq` strictly increasing per session; (6) `timestamp`
inside session bounds; (7) `changeHash` recomputed against disk at export (live/superseded).

## FID Registry (Children)

| FID | Phase | Scope | Depends On |
|---|---|---|---|
| `FID-2026-0813-002-ztap-red-provenance-catalog` | RED | Catalog EHEL per-write capture, gaps, interception sites, event streams | — |
| `FID-2026-0813-003-ztap-crypto-primitives` | GREEN | `common/src/crypto/` — session seed, HKDF per-role keys, SHA-256, JCS, sign/verify, fail-closed | 002 |
| `FID-2026-0813-004-ztap-write-boundary-interception` | GREEN | Native write-boundary signing, append-only ledger, verdict binding hooks, structured capture, `provenance_receipt` events | 003 |
| `FID-2026-0813-005-ztap-signature-audit` | AUDIT | Signature gen/verify tests, key custody (never in logs), latency budget, mode behavior | 004 |
| `FID-2026-0813-006-ztap-adversarial-attack-suite` | ADVERSARIAL | Replay/forgery/staleness/same-entity rejection, JCS enforcement, tamper detection | 004 |
| `FID-2026-0813-007-ztap-attest-export` | GREEN | `/attest` command, trust-receipt.json + offline HTML + inline JS verifier, live/superseded | 004 |
| `FID-2026-0813-008-ztap-attest-audit` | AUDIT | Independent validation in a clean process with zero Savant-Code install | 007 |
| `FID-2026-0813-009-ztap-trust-matrix-ui` | GREEN | OpenTUI diff overlays streaming signed verdict events; read-only | 004 |
| `FID-2026-0813-010-ztap-trust-matrix-audit` | AUDIT | Overlay fidelity to real signed verdicts; zero control authority | 009 |

## Verification Gates

- **P1.A (002–006):** attack suite passes (same-entity rejection, JCS enforcement, stale receipt rejection, tamper
  detection); ≥2 distinct role signatures per complete receipt; key/seed never in logs or ledger (grep evidence);
  latency <10 ms/write measured; `record` failure is non-blocking, `enforce` failure blocks with a visible reason.
- **P1.B (007–008):** exported `trust-receipt.html` validates in a clean process (no Savant-Code, no network) —
  all signatures verify, JCS re-canonicalization passes, live/superseded classification matches disk state.
- **P1.C (009–010):** overlays derive only from signed `provenance_receipt` events; zero control authority (no write
  or terminal tool reachable from overlay state).
- **Cross-cutting:** `bun run typecheck` (all workspaces), `bun x eslint . --max-warnings 0`, `bun run lint:md`,
  `bun test scripts/fid-ledger.test.ts`, focused `bun test` suites per child, prettier check.
- Each child closes only with its own converged loop + implementation evidence; the master closes last.

## Impact Assessment

### Affected Components

- NEW `common/src/crypto/` — signing primitives (offline, WebCrypto/HKDF/Ed25519, JCS)
- MODIFY `packages/agent-runtime/src/tools/tool-executor/native.ts` — write-boundary receipt creation + events
- MODIFY agent-loop phase lifecycle (AUDIT/ADVERSARIAL completion) — verdict binding hooks (site per FID-0813-004)
- MODIFY `EchoComplianceTracker` write record — agentId/fsmPhase/structured FID id (FID-0813-002/004)
- NEW `.savant/provenance/` ledger (gitignored, append-only)
- NEW `cli/` `/attest` command + export serializer (reuses `/export` pipeline)
- MODIFY `cli/src/components/savant-ui/` — read-only trust-matrix overlays
- MODIFY `protocol.config.yaml` — `provenance.mode` config field
- NEW tests: crypto unit suite, attack suite, export validation, overlay fidelity

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Significant new feature spanning runtime, CLI, and UI; crypto correctness and Law-12 exposure are the
      primary risks
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Implement in dependency order through the child FIDs: catalog reality (002) → build crypto primitives (003) → wire the
write boundary and verdict binding (004) → audit signatures/keys/latency (005) → attack the scheme (006) → export
(007–008) → trust matrix (009–010). Each child runs its own Perfection Loop; the master converges the architecture
(this document) and is closed last.

### Steps

1. FID-002 RED catalog: exact per-write fields, gaps, both executors, event streams, `.savant/` conventions.
2. FID-003 crypto: seed → HKDF role keys → Ed25519; SHA-256; JCS; sign/verify; fail-closed API.
3. FID-004 wiring: native.ts write hook, ledger writer, verdict binding at phase completion, events, config field.
4. FID-005 audit: unit + integration tests, key-custody grep, latency measurement, mode matrix.
5. FID-006 adversarial: replay, forgery, same-role rejection, JCS tamper, stale-seq, supersession.
6. FID-007 export: `/attest` JSON + HTML + inline verifier; FID-008 clean-process validation.
7. FID-009 matrix overlays; FID-010 fidelity + zero-control audit.
8. Master closure: all children closed, cross-cutting gates green, honest-claim copy verified.

### Verification

```text
bun test scripts/fid-ledger.test.ts          # ledger accepts the active set (5 pass)
bun run lint:md                              # markdown gate
bunx prettier --check <fid files>            # format gate
bun run typecheck                            # all workspaces (per child at implementation)
bun x eslint . --max-warnings 0              # lint gate
bun test <per-child suites>                  # crypto, attack, export, overlay tests
```

## Perfection Loop

### Loop 1 — RED

- **RED:** The source build order's P1 design was audited against the codebase. Three architectural defects and six
  gaps found: (1) "hold the write until AUDIT/ADVERSARIAL sign" contradicts the verified phase lifecycle (writes land
  in GREEN; Verifier/Adversary spawn later — `agents/adversary/adversary.ts:39-44`, `agents/verifier` zero-tool
  contract); (2) a single ephemeral session key makes "Forge≠Verifier" rejection vacuous; (3) ".savant/provenance/
  gitignored, regenerable" is impossible for ephemeral-key signatures; (4) per-write capture lacks agentId/fsmPhase/
  structured FID id/persisted law results (`echo-compliance.ts:166`); (5) no structured verdict record exists
  (Adversary output is text); (6) no rewind/divergence story for receipts; (7) ledger Law-12 exposure unaddressed
  (content must never be stored); (8) `tool-executor.ts` is a re-export shim — the real site is `native.ts` (and
  `custom.ts` cannot write); (9) no latency budget defined for the interactive write path.
- **GREEN:** This FID applies the corrected architecture: append-only signed chain (D1), per-role HKDF keys (D2),
  hash-only ledger (D3), JCS (D4), non-regenerable append-only ledger with export-time supersession (D5/D6), signed
  verbatim verdict binding (D7), modes + latency budget (D8), exact interception sites (D9), reuse-first (D10), export
  shape with inline verifier (D11), honest claim boundary (D12). All nine build-order FIDs are re-scoped into the child
  registry above with corrected targets.
- **AUDIT (method 1 — tool output):** codebase verification greps and reads cited above resolve every claim; FID
  ledger contract (`scripts/fid-ledger.ts`) requirements satisfied by the registry (single master, master lists all
  children, dependencies resolve, no cycles). `bun test scripts/fid-ledger.test.ts` → 5 pass / 0 fail (run after FID
  set creation). Markdown lint + prettier pass on the FID set (run after creation).
- **AUDIT (method 2 — manual re-read):** the receipt schema was re-read against verification rules; every rule is
  mechanically checkable; schema uses only strings/ints (JCS-safe). The interception flow was re-traced through
  `native.ts` write lifecycle (write gate → handler → `afterToolCall` at :611 → post-write content already resolved).
- **ADVERSARIAL:** The strongest attack is semantic, not cryptographic: a receipt proves harness process, not LLM
  independence — D12 makes that boundary explicit rather than overclaiming. Second strongest: session-seed compromise
  forges everything — mitigated by memory-only custody, no persistence, and `enforce`-mode awareness. Third: ledger
  deletion destroys history — accepted as an audit-log property, documented (D5). Fourth: verdict binding could sign
  the wrong phase's text — prevented by binding at the phase-completion lifecycle hook with agentType+phase in the
  signed payload (D7).
- **CHANGE DELTA:** ~0 (initial converged draft; corrections folded in before first write, per audit-first drafting).

### Missed Questions

1. **Should receipts store full file content for re-verification?** → No. Hash-only (D3); recomputation at export
   needs only current disk state, not historical content.
2. **What happens when the same file is written twice in a turn?** → Two receipts, monotonic `seq`; the later is
   `live` at export if it matches disk; both remain in the ledger (append-only).
3. **Do SDK embedders (non-CLI) get provenance?** → The signing lives in the agent-runtime, so SDK sessions signing
   writes is natural; P1 ships CLI-first, SDK provenance is a documented follow-up, not an omission.
4. **Does provenance apply to FID documents themselves?** → Yes — FID writes are agent writes like any other; the
   `fidId` field resolves to the touched FID (path-based), and the receipt for a FID edit is itself part of the
   evidence chain for that FID.
5. **Is `enforce` mode on by default?** → No. Default is `record`; `enforce` is opt-in per project to avoid bricking
   interactive writes on crypto-unsupported environments. Fail-closed is a capability, not a default.
6. **Who verifies the verifier of the receipt?** → The auditor (human or script) runs the same JCS+signature checks
   the inline verifier performs; the checks are deterministic and public. This is the standard audit-log trust model.
7. **Does `/attest` include sessions from other projects?** → No. It reads the current project's `.savant/provenance/`;
   `--all` scans only that project. Cross-project export is out of scope (path containment, Law 12).
8. **Are verdicts ever redacted?** → No. Verdict text is signed verbatim; redaction would break the signature. If
   sensitive content appears in a verdict, the honest remedy is a new verdict record, not an edit.

### Code Verification Evidence

- [x] `packages/agent-runtime/src/tools/tool-executor/native.ts` read 0-EOF; interception sites pinned (:99, :279,
      :351, :611)
- [x] `packages/agent-runtime/src/tools/tool-executor/custom.ts` read 0-EOF; write path absent (:76)
- [x] `packages/agent-runtime/src/echo/enforcement.ts` + `types.ts` read; state shape cataloged
- [x] `packages/agent-runtime/src/util/echo-compliance.ts` read 0-EOF; `recordWrite` field set cataloged (:166)
- [x] `agents/adversary/adversary.ts` read; read-only tools + text verdict format confirmed
- [x] `common/src/types/contracts/trace.ts` + `cli/src/utils/trace-writer.ts` read; event stream reuse candidate
- [x] `cli/src/commands/export-conversation.ts` located; `/export` pipeline reuse path confirmed
- [x] No existing crypto/signing utilities in `common/src/`; `common/src/crypto/` is new (Law 7 satisfied)
- [x] FID ledger contract (`scripts/fid-ledger.ts`) read; master/child/dependency graph validated by
      `bun test scripts/fid-ledger.test.ts` → 5 pass / 0 fail
- [x] Markdown lint and prettier pass on the FID set
- [x] Implementation evidence (child FIDs) — recorded in the child closure sections and implementation files

### Loop 2 — Independent audit and self-correction

- **RED:** Second pass hunted for residual design flaws: (1) `seq` monotonicity across crashes — a crash after append
  but before the in-memory counter advances could reuse a `seq`; (2) session manifest key rotation — none exists, so a
  long session's compromised seed is unrecoverable (accepted for ephemeral v1); (3) the verdict binding hook location
  was left as "phase lifecycle" without a pinned site; (4) the export inline verifier's trust model (auditor runs
  untrusted JS from the receipt) needs a stated boundary; (5) `provenance_receipt` event volume could grow
  unboundedly on large turns.
- **GREEN:** (1) `seq` is derived from a monotonic counter persisted in the session manifest at flush time (crash-safe
  by construction: the ledger file, not memory, owns the counter); (2) documented as an accepted v1 property;
  (3) FID-2026-0813-004 pins the hook site during implementation RED (the exact loop-iteration call sites are
  identified in that FID's catalog before wiring — the master names the constraint: the hook must fire at the same
  lifecycle point where Verifier/Adversary final messages are recorded); (4) inline verifier boundary: the HTML
  verifier is a *convenience*; the authoritative check is `trust-receipt.json` + a scriptable verifier in
  `common/src/crypto/` (the same code, offline); the HTML states it is a convenience view; (5) event stream is bounded
  (per-turn cap + dedupe), mirroring `MAX_RUNTIME_EVENTS` in `cli/src/utils/trace-writer.ts:31`.
- **AUDIT:** Re-read of the corrected schema and D1–D12 confirms each Loop-2 fix is representable in the schema or
  manifest without breaking signature rules; the `over` hash fields make append-only extension safe.
- **ADVERSARIAL:** Crash-replay of the ledger: receipts are idempotent per (sessionId, seq); a duplicated `seq` is
  detectable and the later record rejected at validation — added to verification rule (5) as "strictly increasing,
  duplicates rejected". Export-verifier substitution: an attacker replaces the HTML with a lying verifier — mitigated
  because the JSON + crypto verifier is scriptable separately and the HTML embeds the same deterministic checks; the
  auditor is told the JSON is authoritative.
- **CHANGE DELTA:** <3% (four clarifying edits; no architectural change).

### Loop 3 — Final convergence

- **RED:** Residual risk review: no unresolved architectural contradiction. Remaining risk is execution drift in child
  FIDs (crypto misuse, Law-12 leaks, overlay control authority) — each has its own AUDIT gate in the registry.
- **GREEN:** Final converged state: architecture, schema, key model, ledger, export, and UI surfaces are specified;
  child registry and gates are complete; honest-claim boundary is explicit.
- **AUDIT:** Convergence check: change delta <2% from Loop 2; no open design questions remain that block child
  execution; every build-order design question Q1–Q6 has a resolved decision (D1–D12).
- **ADVERSARIAL:** Final challenge — "is this over-engineered for the value?" The build order's own value case is
  enterprise-facing (Q5); the design deliberately keeps the crypto small (Ed25519 + HKDF + JCS, no PKI, no keychain,
  no external trust) and the surface cheap (reuses existing pipeline). D12 bounds the claim so the feature cannot be
  sold as stronger than it is. Accepted.
- **SELF-CORRECT (post-write adversarial pass):** the written documents were re-audited as delivered; eight fixes
  applied: (F1) FID-009's dependency corrected to 004 (its prose already named 004 as the event-contract owner);
  (F2) FID-004 now states the `provenance_receipt` event stream is unconditional (display/observability) while
  signing + ledger are mode-gated, resolving FID-009's "renders with crypto off" contract; (F3) FID-006 attack A3
  corrected — JCS key reordering is value-preserving (negative control), value substitution is the tamper; (F4)
  `lawChecks` field added to the schema (pre-write gate outcomes), restoring the build order's original catalog
  intent; (F5) `failClosed` field added to the schema, matching D8; (F6) D8 mode phrasing clarified; (F7) D3 wording
  de-contradicted; (F8) FID-007 Q4 wording no longer implies the paid/Free decision was resolved. Delta for this
  pass: <3% (field additions + wording; no architectural change).
- **INDEPENDENT AUDIT (Nova):** `dev/nova/inbox/2026-08-13-fid-2026-0813-001-ztap-master-planning-audit-response.md`
  → **PLANNING APPROVED FOR OPERATOR DECISION.** All 9 RED-catalog citations independently re-verified against source
  (`native.ts`, `custom.ts`, `echo-compliance.ts`, `adversary.ts`, `trace.ts`, `trace-writer.ts`, `common/src/`
  crypto grep). Four non-blocking flags dispositioned: (1) verdict-binding hook pinning elevated to a hard gate in
  FID-2026-0813-004's Verification section; (2) auditor-facing session-key trust warning added to D12 and
  FID-2026-0813-007; (3) convenience-view disclaimer made a verbatim-embed requirement in FID-2026-0813-007;
  (4) event bounding already specified (per-turn cap + dedupe, `trace-writer.ts:31` precedent). No law change
  required; escrow addendum remains out of scope. Not a ship authorization — push/release stays the operator's
  hard gate.
- **ROUTING AUDIT (Nova):** `dev/nova/inbox/2026-08-13-fid-2026-0813-001-ztap-routing-audit-response.md` →
  **PASS — implementation routing approved; children 002–010 may begin execution in dependency order after operator
  go.** Targets 1–7 all PASS; ledger verified on the real working tree (`bun test scripts/fid-ledger.test.ts`
  5 pass / 0 fail); all 10 FIDs read 0-EOF. Residual non-blocking notes: FID-004's hook-site pinning is a pre-wiring
  gate (by design); session-seed compromise accepted and documented (D12/FID-007); cross-session attribution is P2
  scope, correctly excluded. Execution remains gated on the operator's explicit go; each child closes only with its
  own AUDIT/ADVERSARIAL evidence + Nova re-audit; push/release stays the operator's hard gate.
- **CHANGE DELTA:** <2% (converged).

- **POST-IMPLEMENTATION NOVA AUDIT:** Independent third-party audit returned **PASS — implementation independently verified; eligible for operator closure**. Nova confirmed all ten targets, the archive move, feature guide, `/attest` registration, config wiring, and the FID-004 phase-completion hook. No release authorization was granted.

## Implementation Closure — COMPLETE

- **Implemented:** 2026-08-13 under the operator's automation level 3 grant, after Nova planning and implementation-routing PASS plus explicit operator go.
- **Delivered:** FIDs 002–010 collectively implement the complete P1 wedge: structured EHEL provenance fields, offline crypto, signed native write receipts, append-only session ledger, verdict binding, `/attest` JSON/HTML export with inline verification, clean-process validation, and the read-only Trust Matrix.
- **Verification:** Full root typecheck passed; full root test chain passed; ESLint with zero warnings passed; Prettier check passed. Focused evidence: tracker 30/30, crypto 21/21, provenance/attack/mode 23/23, `/attest` 11/11, clean-process 4/4, Trust Matrix 6/6.
- **Independent review:** Nova's implementation audit response at `dev/nova/inbox/2026-08-13-fid-2026-0813-001-ztap-implementation-signoff-response.md` returned **PASS — implementation independently verified** with 100/100 tests reproduced and no blocking findings. This working-tree closure is not a commit, push, publication, deployment, or release authorization.

## Resolution

- **Closed Date:** 2026-08-13.
- **Fix Description:** Complete ZTAP P1 wedge implemented through children `FID-2026-0813-002` through `-010`.
- **Tests Added:** Crypto, provenance, export, clean-process, tracker, and Trust Matrix regression suites.
- **Verification Evidence:** Full repository gates and child evidence recorded above and in each child FID.
- **Archived:** Yes — moved to `dev/fids/archive/` after closure evidence was recorded.

## Lessons Learned

- Design claims about an existing codebase must be verified against the code before they become FID requirements; the
  "hold the write" model and "regenerable ledger" both survived research but died on code inspection.
- Separation of duties is only as real as the keys that sign for it: a single session key makes adversarial
  re-attestation nominal, not checkable. Per-role derivation is the difference between a badge and a proof.
- An append-only audit log and a regenerable cache are different artifacts with different lifecycle rules; conflating
  them produces a spec that cannot be implemented as written.
- The strongest competitor analysis is the claim boundary: a receipt proves process, not model independence. State
  what the artifact proves in the artifact.
