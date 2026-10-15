<!-- markdownlint-disable MD013 -->

# Nova Planning Sign-off Request — FID-2026-0814-005 (Trust Matrix Auto-Resolution)

**Date:** 2026-08-14
**Scope:** Planning review of a ZTAP display-semantics fix: `finalize()` resolves open `pending` receipts with a signed `system`-role close annotation ("no independent verdict — session closed") and a new `no_verdict` terminal status; the Trust Matrix renders `awaiting audit` for live pending and a terminal row for `no_verdict`; `/attest` export + clean-process validator accept the new terminal.
**Status:** REQUESTED
**Priority:** Medium (operator-visible defect: the matrix "never updated or clear")

## Request

Please independently audit the **planning** FID below and return one of:

- `PASS — planning approved for operator decision`
- `FAIL — planning requires self-correction`
- `NEEDS-REVIEW — evidence boundary cannot be evaluated`

This is a **planning sign-off request**. A PASS verifies the plan's ground-truth claims against the repo; it does **not** authorize implementation, closure, commit, push, release, publication, or deployment. Implementation (and a separate implementation-audit request) follows operator approval.

## Record under review

`dev/fids/FID-2026-0814-005-trust-matrix-auto-resolution.md` — status `analyzed` (planning-converged via the Perfection Loop with AUDIT + ADVERSARIAL + a fresh Loop-2 re-audit).

## What the FID claims (verify each at source)

| ID | Claim | Cited source |
|---|---|---|
| T-01 (high) | Receipts are structurally stuck at `pending` unless a Verifier+Adversary pair runs — most sessions never do | `packages/agent-runtime/src/provenance/session.ts:186-238` (only `bindVerdict` completes via `hasAudit && hasAdversarial` at `:233-238`); `tools/handlers/tool/spawn-agents.ts:259-272` + `spawn-agent-inline.ts:169-181` (verdict binding is spawn-gated on `verifier`/`adversary` + non-empty text); `util/echo-compliance.ts:312-315` (Verifier trigger is a warning, not a spawn) |
| T-02 (medium) | `finalize()` closes the ledger but never resolves open receipts | `session.ts:247-272` (`session_close` only; no status write) |
| T-03 (medium) | No terminal status exists; the UI renders status verbatim | `common/src/types/provenance.ts:23` (`ReceiptStatus = 'pending'\|'complete'`); `cli/src/components/savant-ui/echo/trust-matrix.tsx` (`status.toUpperCase()`) |
| T-04 (low) | `/attest` export vocabulary has no session-close terminal | Export serializer status handling; `no_verdict` does not exist anywhere (absence grep) |

## Hard questions Nova must verify at source

1. **Single completion path.** Confirm `session.ts:186-238` — `bindVerdict` is the only writer of `status: 'complete'` (`:233-238` `if (hasAudit && hasAdversarial)`).
2. **Verdict sources are spawn-gated.** Confirm `grep -rn "bindVerdict" packages/agent-runtime/src --include="*.ts"` → only `session.ts:186`, `spawn-agents.ts:266`, `spawn-agent-inline.ts:169`, and that both spawn sites require `agentType === 'verifier' | 'adversary'` plus non-empty `extractVerdictText` (`verdict.ts`).
3. **Finalize is close-only.** Confirm `session.ts:247-272` enqueues `session_close` and never touches open receipts (absence of any status write in `finalize`).
4. **No terminal status in the type.** Confirm `common/src/types/provenance.ts:23` — `ReceiptStatus = 'pending' | 'complete'`, and `no_verdict`/`session-close`/`agentType: 'system'` appear nowhere in `packages/agent-runtime/src` or `common/src` (absence grep).
5. **Production caller exists.** Confirm `packages/agent-runtime/src/run-agent-step/loop.ts:404` calls `initialAgentState.provenance?.finalize()` — the auto-resolution hook point is reachable.
6. **Honesty boundary.** Confirm the GREEN plan's claim that the close annotation is signed by the `system` role with text stating *no independent verdict* (never `verifier`/`adversary`, never fabricated evidence), and that `no_verdict` is only reachable from `pending` (a `complete` receipt is untouched).

## Adversarial checks already run in the FID's Perfection Loop

- The close annotation must be **ledgered** (append-only) and **verifiable by the clean-process validator** — an in-memory-only annotation would break ZTAP integrity (the ADVERSARIAL refinement).
- `no_verdict` must render as *no independent verdict* in the UI — never as "complete" — matching the ZTAP honest-boundary doctrine.
- The reducer's last-event-wins semantics (`trust-matrix.tsx:56-67`, keyed by `seq`) must carry the close-time update.
- No change to verdict binding for real Verifier/Adversary runs; no weakening of the trust model.

## Authorization boundary

This request authorizes no implementation, closure, commit, push, release, publication, or deployment. A PASS marks the plan converged and code-grounded; operator approval is then required before any code, and a separate implementation-audit request must precede closure.

## Expected response

1. Overall verdict.
2. Verdict per hard question with `path:line` + quoted code/command output.
3. Any missing citation, scope contradiction, or unverified claim.
4. Explicit confirmation this is planning review only and does not authorize production changes or release activity.
