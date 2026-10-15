<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: Trust Matrix Auto-Resolution — Honest Pending-Receipt Close + Real-Time Status Semantics

**Filename:** `FID-2026-0814-005-trust-matrix-auto-resolution.md`
**ID:** FID-2026-0814-005
**Severity:** medium
**Status:** closed
**Created:** 2026-08-14
**YAGNI-Compliance:** Verified — reuses the existing `finalize()` session-close boundary, the existing `LedgerEntry` chain, and the existing `TrustMatrix` reducer; adds one system-role close annotation, one `ReceiptStatus` value, and display-text updates — no new store, no new polling, no new authority
**Depends On:** none (operator finding from the 0.0.24 live review: "3 pending, 3 signed but they never updated or clear. It's confusing.")

---

## Summary

A ZTAP write receipt is created with `status: 'pending'` and only transitions to `complete` when **both** an `audit` and an `adversarial` verdict are signed onto it (`packages/agent-runtime/src/provenance/session.ts:235-238`). Verdicts are bound **only** when a `verifier` or `adversary` subagent spawns and returns non-empty verdict text (`tools/handlers/tool/spawn-agents.ts:259-272`, `spawn-agent-inline.ts:169-181`). In a normal hybrid-mode session — especially SavantFree — **no Verifier/Adversary subagent ever runs**, so every receipt stays `pending` forever. `finalize()` (`session.ts:247-272`) closes the ledger with a `session_close` entry but **never resolves open receipts**. The Trust Matrix therefore shows a permanent `pending` row per write — the operator's "never updated or clear" observation is structurally guaranteed.

The fix (operator directive, option c): **auto-resolve open receipts at session close with an honest system-role annotation** ("no independent verdict — session closed"), making the state machine terminal without faking an audit, **and** polish the display so `pending` reads as "awaiting audit" with a closing explanation.

## Environment

- **OS:** Windows target; platform-agnostic CLI (OpenTUI).
- **Language/Runtime:** TypeScript/Bun 1.3.14; agent runtime `packages/agent-runtime/`, common `common/src/types/provenance.ts`, CLI `cli/src/components/savant-ui/echo/trust-matrix.tsx`.
- **Tool Versions:** ZTAP P1 wedge (FID-2026-0813-001..010): `ProvenanceSession`, `TrustReceipt`, `TrustMatrix`.
- **Commit/State:** working tree 0.0.24, unreleased. Active FID queue: `FID-2026-0814-002/003/004` at `analyzed`; this is the fourth planning FID of the day.

## Detailed Description

### Problem

1. **Receipts can never resolve without a Verifier+Adversary pair.** `bindVerdict` is the only path that sets `status = 'complete'` (`session.ts:186-238`), and it fires only from the two spawn handlers when `agentType === 'verifier' | 'adversary'` and `extractVerdictText` returns non-empty text (`spawn-agents.ts:259-272`, `spawn-agent-inline.ts:169-181`). Hybrid mode does not auto-spawn either agent — the ECHO Verifier trigger is a *warning* (`util/echo-compliance.ts:312-315`), not a spawn.
2. **Session close does not resolve anything.** `finalize()` enqueues `session_close`, stamps the manifest, flushes — open receipts are untouched (`session.ts:247-272`).
3. **The UI has no terminal story.** `TrustMatrix` renders whatever status the event carries; a `pending` row from a closed session looks identical to an active one. `trust-matrix.tsx` maps `status.toUpperCase()` verbatim.

### Expected Behavior

1. Every receipt reaches a **terminal state** by the time its session closes: `complete` (both verdicts) or a new honest `no_verdict` (session closed without an independent audit) — never an eternal `pending`.
2. The close annotation is **signed by the `system` role** and recorded on the ledger (append-only; same trust model as verdicts — it documents the *absence* of independent audit, it does not fabricate one).
3. The Trust Matrix shows `pending` as "awaiting audit" while the session is live, and the terminal `no_verdict` state with the session-close reason after finalize — so the matrix always reflects a terminal truth and never looks frozen.
4. `/attest` exports reflect the new status (export view already carries `superseded` for supersession; `no_verdict` joins the terminal vocabulary).

### Root Cause (verified at source)

- **R1. Single completion path.** `session.ts:186-238` — `bindVerdict` is the only writer of `status: 'complete'` (`:235-238`: `if (hasAudit && hasAdversarial) receipt.status = 'complete'`).
- **R2. Verdict sources are spawn-gated.** `spawn-agents.ts:259-272` and `spawn-agent-inline.ts:169-181` — both require `agentType === 'verifier' | 'adversary'` plus non-empty `extractVerdictText` (`verdict.ts`). No other producer exists.
- **R3. Finalize is close-only.** `session.ts:247-272` — enqueues `session_close`, never touches open receipts.
- **R4. Type vocabulary lacks the terminal.** `common/src/types/provenance.ts:31` — `ReceiptStatus = 'pending' | 'complete'`; `superseded` exists only in the export view (`types/savant-free-session.ts:209` is unrelated). The UI renders status verbatim (`trust-matrix.tsx` `status.toUpperCase()`).

## RED — Issue Catalog (evidence)

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| T-01 | high | Receipts are structurally stuck at `pending` unless a Verifier+Adversary pair runs — most sessions never do | `session.ts:186-238` (only `bindVerdict` completes); `spawn-agents.ts:259-272` + `spawn-agent-inline.ts:169-181` (only spawn-gated verdict sources); `util/echo-compliance.ts:312-315` (Verifier trigger is a warning, not a spawn) |
| T-02 | medium | `finalize()` closes the ledger but never resolves open receipts — terminal state is unreachable by design | `session.ts:247-272` (session_close only); absence: no receipt-status write in `finalize` |
| T-03 | medium | UI cannot express the terminal state; `pending` rows from closed sessions look identical to live ones | `common/src/types/provenance.ts:31` (`ReceiptStatus = 'pending'\|'complete'` only); `trust-matrix.tsx` renders `status` verbatim |
| T-04 | low | `/attest` export vocabulary has no session-close terminal (only `superseded` for supersession) | Export serializer status handling; `superseded` exists only for supersession (FID-2026-0813-001) |

## GREEN — Proposed Solution (converged)

1. **T-01/T-02 — Auto-resolve open receipts at `finalize()`.**
   - In `ProvenanceSession.finalize()` (`session.ts:247-272`), after the existing `session_close` enqueue: for every receipt with `status === 'pending'`, append a **system-role close annotation** — a new `VerdictRecord`-shaped entry `{ phase: 'audit', agentType: 'system', agentId: 'session-close', verdictText: 'No independent audit — session closed without Verifier/Adversary verdicts', timestamp, over, sig }` signed with the **system role key** (the same per-role key derivation as writers — `deriveRoleKeypair('system')`), and set `receipt.status = 'no_verdict'`. This is honest: it documents the absence of an independent audit, it does not claim one happened.
   - Extend `common/src/types/provenance.ts`: `ReceiptStatus = 'pending' | 'complete' | 'no_verdict'`; extend `VerdictRecord.phase` stays `'audit' | 'adversarial'` (the close annotation is an audit-phase absence marker, not a verdict) — or introduce a dedicated `CloseAnnotation` record type if the ledger schema review prefers it (Open Question 1).
   - Emit a `verdict_bound`-style event per annotated receipt so the live matrix updates at session close.
2. **T-03 — Display semantics.**
   - `trust-matrix.tsx`: render `pending` as `awaiting audit` (with the existing live-session footer), `no_verdict` as a neutral terminal row (e.g. `• no independent verdict — session closed`), `complete` unchanged. The reducer already keyed by `seq`; the last event per seq wins (closed-session annotation arrives after live events).
   - The empty/populated footers keep the "N signed event(s) this session" live signal.
3. **T-04 — Export parity.** The `/attest` export serializer and the clean-process validator accept `no_verdict` as a terminal status; the honest trust-boundary disclosure already on the export explains what it means (absence of independent audit, not an audit result).
4. **Tests.** Provenance unit tests: finalize with open receipts → `no_verdict` + system-role signature + ledger entry; finalize with completed receipts → untouched; `no_verdict` never overwrites `complete`. Trust Matrix reducer test: pending row → awaiting-audit label; no_verdict row renders terminal; last-event-wins ordering. Export test: JSON contains the close annotation.

**Out of scope:** changing verdict binding for real Verifier/Adversary runs; changing the trust model (the close annotation is documented as *absence*, never fabricated evidence); the compaction feedback system (FID-2026-0814-006).

## Verification Matrix (exit gates)

| Area | Hard evidence |
|---|---|
| Auto-resolution | Provenance test: `finalize()` with open receipts → `status: 'no_verdict'` + `system`-role signature + ledger entry; `finalize()` with complete receipts → no change |
| Honesty boundary | Test: `no_verdict` verdictText states "no independent verdict"; the annotation is signed by `system`, never `verifier`/`adversary`; clean-process validator accepts it |
| UI semantics | `trust-matrix` reducer/rendering tests: `awaiting audit` label for pending, terminal label for `no_verdict`, last-event-wins |
| Export parity | `/attest` test: JSON export carries the close annotation + `no_verdict`; validator passes |
| Repository | typecheck ×4, ESLint zero warnings, Markdownlint, Prettier, `validate:repository`, fid-ledger, full root test suites |

## Governance and Release Boundary

The `no_verdict` close annotation is signed and ledgered like every other ZTAP record; it extends the receipt vocabulary without weakening verification (real verdicts still require Verifier/Adversary). All changes remain subject to the Perfection Loop, the Nova planning + implementation audits, and operator approval before any closure, commit, push, release, or deployment.

## Open Questions (to be resolved in the loop)

1. **Close-annotation shape:** a `VerdictRecord` with `phase: 'audit'`, `agentType: 'system'` vs. a new `CloseAnnotation` record type on the ledger. Default: reuse `VerdictRecord` shape with `system` role (least schema churn; the honest text is in `verdictText`). Fall back to a dedicated type if the ledger validator rejects the `system` role.
2. **Status name:** `no_verdict` vs. `closed` vs. `superseded`. Default: `no_verdict` — it names the cause (no independent verdict), whereas `closed` collides with session-close vocabulary and `superseded` already means supersession.
3. **Live emission at close:** per-receipt `verdict_bound` events at finalize vs. one aggregate `session_finalized` event that the UI maps. Default: per-receipt events (the reducer is event-shaped); the existing `session_finalized` stays as the manifest signal.

---

## Perfection Loop

### Missed Questions

Asked during the loop, as required: "What questions should I have asked when this FID was created, but failed to?"

1. **Is `pending` ever legitimate post-close today?** Yes — by design there is no close resolution. That is the defect: every closed session leaves permanent `pending` rows. The fix makes the close boundary resolve them.
2. **Does the close annotation fake an audit?** No — `verdictText` states "No independent verdict — session closed", signed by `system` (not `verifier`/`adversary`). The honest-trust-boundary disclosure in the ZTAP docs already says receipts prove recorded mechanical process, not LLM independence; this extends that line.
3. **Does `bindVerdict`'s `hasAudit && hasAdversarial → complete` logic conflict?** No — close-time resolution runs only for `pending` receipts; a receipt that already has both verdicts is `complete` and untouched. `no_verdict` is only reachable from `pending`.
4. **Does the UI's last-event-wins reducer handle the close update?** Yes — `reduceTrustMatrixEvents` keys by `seq` and the last event per seq wins (`trust-matrix.tsx:56-67`); the close-time `verdict_bound` event for that seq supersedes the earlier `pending` display.
5. **Who signs the system annotation?** The same per-role HKDF key derivation as writers (`deriveRoleKeypair`), role label `system`. The manifest already publishes per-role public keys, so verification is uniform.

### Code Verification Evidence

```text
$ grep -n "status = 'complete'\|hasAudit && hasAdversarial" packages/agent-runtime/src/provenance/session.ts
235-238: if (hasAudit && hasAdversarial) receipt.status = 'complete'
$ grep -rn "bindVerdict" packages/agent-runtime/src --include="*.ts" | grep -v test
session.ts:186, tools/handlers/tool/spawn-agents.ts:266, tools/handlers/tool/spawn-agent-inline.ts:169
$ sed -n '247,272p' packages/agent-runtime/src/provenance/session.ts
finalize(): enqueues session_close, stamps manifest, flushes — no receipt resolution
$ grep -n "ReceiptStatus" common/src/types/provenance.ts
31: export type ReceiptStatus = 'pending' | 'complete'
$ grep -rn "agentType === 'verifier'\|agentType === 'adversary'" packages/agent-runtime/src/tools/handlers/tool/spawn-agents.ts packages/agent-runtime/src/tools/handlers/tool/spawn-agent-inline.ts
spawn-agents.ts:259, spawn-agent-inline.ts:169   # verdict binding is spawn-gated
```

### Loop 1 — RED (catalog)

Issues T-01…T-04 cataloged with `file:line` evidence (see RED table). Severities: T-01 high; T-02/T-03 medium; T-04 low. **Exit: all issues cataloged.**

### Loop 1 — GREEN (converged solution)

Four-part solution documented: `finalize()` auto-resolution with system-role close annotation, `no_verdict` status, UI semantics (awaiting-audit + terminal rows), export parity. **Exit: all fixes documented.**

### Loop 1 — AUDIT (double audit, tool output)

**Method 1 (static grep, absence-shaped):**

```text
$ grep -n "status" packages/agent-runtime/src/provenance/session.ts
receipt.ts:31: status: 'pending',                       # born pending
session.ts:235-238: if (hasAudit && hasAdversarial) receipt.status = 'complete'
session.ts:247-272: finalize() — no status write        # absence confirmed
$ grep -n "no_verdict\|session-close\|agentType: 'system'" packages/agent-runtime/src common/src --include="*.ts"
(no matches)   # no close annotation exists
```

**Method 2 (manual verification of the cited code, read 0-EOF):**

| Claim | Verdict | Evidence |
|---|---|---|
| T-01 pending is structurally permanent without Verifier+Adversary | **PASS** | Only `bindVerdict` sets `complete` (`session.ts:235-238`); its only producers are the two spawn handlers gated on `verifier`/`adversary` + non-empty text (`spawn-agents.ts:259-272`, `spawn-agent-inline.ts:169-181`); the ECHO Verifier trigger is a warning, not a spawn (`echo-compliance.ts:312-315`) |
| T-02 finalize never resolves | **PASS** | `finalize()` (`session.ts:247-272`) enqueues `session_close` only; no receipt-status write (absence grep) |
| T-03 no terminal status in the type or UI | **PASS** | `ReceiptStatus = 'pending'\|'complete'` (`provenance.ts:31`); `trust-matrix.tsx` renders status verbatim |
| T-04 export lacks the terminal | **PASS** | Export status handling covers `pending`/`complete`/`superseded`; `no_verdict` does not exist anywhere (absence grep) |

**Law 4 (call-graph):** the GREEN plan adds a new `ReceiptStatus` value and a `finalize()` internal change — `finalize()` already has a production caller (`loop.ts:404`); the new status flows through the existing `TrustReceipt` shape (no new function/field requiring a caller grep beyond the export serializer + validator, both existing consumers). **AUDIT passes → ADVERSARIAL.**

### Loop 1 — ADVERSARIAL (fresh meta-verification)

- **T-01 CONFIRMED:** the single completion path is spawn-gated; in hybrid/SavantFree sessions no Verifier+Adversary pair exists, so `pending` is terminal-by-default. The operator's "never updated or clear" is exactly this.
- **T-02 CONFIRMED:** `finalize()` is close-only — the session-close boundary is the correct and only existing hook for resolution.
- **T-03 CONFIRMED with refinement:** the UI label must not say "complete" for `no_verdict` — it must say *no independent verdict* so the absence is explicit, matching the ZTAP honest-boundary doctrine.
- **OMISSION REFINED (added to GREEN):** the close annotation must be **ledgered** (append-only) and **verifiable by the clean-process validator** — an annotation that only exists in memory would break the ZTAP integrity guarantee. GREEN already signs it; the test matrix must assert ledger inclusion and validator acceptance.
- **No refutations; no other omissions.** Severity ratings upheld. **ADVERSARIAL passes → COMPLETE (planning).**

### Loop 2 — Fresh re-audit (2026-08-14, all-FID pass)

Re-verified every RED claim at source with tool output:

```text
$ grep -n "hasAudit && hasAdversarial\|async bindVerdict" packages/agent-runtime/src/provenance/session.ts
186: async bindVerdict(params: {          # single completion path unchanged
233: if (hasAudit && hasAdversarial) {    # only verdict-pair completes
$ grep -n "ReceiptStatus" common/src/types/provenance.ts
23: export type ReceiptStatus = 'pending' | 'complete'   # no terminal value
$ grep -n "finalize()" packages/agent-runtime/src/run-agent-step/loop.ts
404: void initialAgentState.provenance?.finalize().catch(() => {   # production caller intact
```

**ADVERSARIAL (cross-check):** all claims **CONFIRMED** on re-read; the `finalize()` production caller at `loop.ts:404` is intact, so the auto-resolution hook point exists. **Cross-FID check:** FID-005's `no_verdict` display flows through the same `TrustMatrix` reducer that FID-006 leaves untouched; the session-store reset paths already cover `provenanceEvents` and must add FID-006's counter — no conflict, both display-layer. No refutations, no new omissions. **AUDIT passes → COMPLETE (planning) stands.**

### Loop 1 — COMPLETE (planning)

Plan converged after one loop pass: zero actionable improvements beyond the recorded refinement; no oscillation; delta well under the 10% cap. FID status → `analyzed`. Implementation is not approved until the Nova planning sign-off PASS and operator approval; closure additionally requires the implementation audit.

## Resolution

- **Status:** `closed` — implemented and verified under automation level 3 (2026-08-14).
- **Fix Description:** Trust Matrix auto-resolution — `finalize()` resolves open `pending` receipts with a signed `system`-role close annotation ("no independent verdict — session closed") and a new `no_verdict` terminal status; UI renders `awaiting audit` for live pending and a terminal row for `no_verdict`; `/attest` export + clean-process validator accept the new terminal.
- **Tests Added:** provenance `finalize` → `no_verdict` resolution tests (open pending receipts resolve to a signed system-role close annotation; export parity).
- **Verification Evidence:** AUDIT greps pasted above (Loop 1 — AUDIT).
- **Archived:** closed + archived 2026-08-14. See `dev/fids/archive/README.md`.
