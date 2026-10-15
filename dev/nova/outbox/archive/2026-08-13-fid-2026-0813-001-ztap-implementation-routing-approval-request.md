<!-- markdownlint-disable MD013 -->

# Nova Implementation-Routing Approval Request — FID-2026-0813-001 (ZTAP Master + Children 002–010)

**Date:** 2026-08-13
**To:** Nova — independent third-party ECHO auditor
**Scope:** Implementation-routing readiness review for the converged ZTAP FID set: master `FID-2026-0813-001` plus
children `FID-2026-0813-002` through `-010`
**Status:** AWAITING NOVA REVIEW
**Priority:** High — no implementation code is written until this request passes Nova
**Method requested:** Read the referenced protocol, build order, master FID, all nine child FIDs, and Nova's own
planning-audit response 0-EOF. Independently verify the FID set against the current working tree. Return `PASS`,
`FAIL`, or `NEEDS-REVIEW` per target with exact `path:line` or command-output evidence.

> This request intentionally contains no signature, author, or agent-attribution fields. It follows the no-signature
> policy in `ECHO-single-agent.md` and `dev/echo-v0.1.2-single-agent.md`.

---

## 1. Approval boundary

This request asks Nova to approve **implementation routing only**: that the ZTAP FID set is converged, internally
consistent, code-verified, and ready for the target harness to begin executing children in dependency order.

It does NOT authorize implementation by itself. **No code is written until both gates pass: (1) this request returns
`PASS` from Nova, and (2) the operator issues the explicit go.** Even after both gates, every child closes only after
its own AUDIT/ADVERSARIAL gates pass with independent implementation evidence, and Nova re-audits each child per the
conditions of Nova's planning approval.

This request authorizes no commit, tag, push, publication, deployment, credential use, or remote action. Push/release
remains the operator's hard gate.

**Mutation boundary for Nova review:** read-only inspection of the referenced artifacts and current repository state.
Do not modify production source, package manifests, protocol configuration, generated artifacts, FIDs, reports,
release files, or durable settings while reviewing.

## 2. Documents under review

1. `ECHO-single-agent.md`
2. `dev/echo-v0.1.2-single-agent.md`
3. `protocol.config.yaml`
4. `templates/FID-TEMPLATE.md`
5. `scripts/fid-ledger.ts` (active-FID ledger contract)
6. `dev/build-orders/2026-08-13-ztap-build-order.md` (seeding plan, status PLANNING — NOT APPROVED)
7. `dev/fids/FID-2026-0813-001-ztap-provenance-master.md`
8. `dev/fids/FID-2026-0813-002-ztap-red-provenance-catalog.md`
9. `dev/fids/FID-2026-0813-003-ztap-crypto-primitives.md`
10. `dev/fids/FID-2026-0813-004-ztap-write-boundary-interception.md`
11. `dev/fids/FID-2026-0813-005-ztap-signature-audit.md`
12. `dev/fids/FID-2026-0813-006-ztap-adversarial-attack-suite.md`
13. `dev/fids/FID-2026-0813-007-ztap-attest-export.md`
14. `dev/fids/FID-2026-0813-008-ztap-attest-audit.md`
15. `dev/fids/FID-2026-0813-009-ztap-trust-matrix-ui.md`
16. `dev/fids/FID-2026-0813-010-ztap-trust-matrix-audit.md`
17. `dev/nova/inbox/2026-08-13-fid-2026-0813-001-ztap-master-planning-audit-response.md` (Nova's own planning approval)

### Baseline identity to verify

- Master FID: `FID-2026-0813-001` — `Status: analyzed`, `Planning Status: Converged after Perfection Loop`
- Child FIDs: `FID-2026-0813-002` … `-010` — `Status: analyzed`, converged
- All ten FIDs are **untracked working-tree artifacts** (new files, not committed) — working-tree evidence, not durable
  repository certification
- Nova's planning verdict on the master: **PLANNING APPROVED FOR OPERATOR DECISION** (inbox response, 2026-08-13)

## 3. Routing targets

### Target 1 — FID registry integrity

Verify the active-FID ledger graph is valid: exactly one master (`FID-2026-0813-001`), the master lists every child
ID, every child declares the master, all `Depends On` edges resolve to active FIDs, no dependency cycles, no forbidden
attribution fields, all required headings present. Evidence: `bun test scripts/fid-ledger.test.ts` (5 pass / 0 fail)
and a direct real-ledger validation run (recorded PASS at request time — 12 active FIDs).

### Target 2 — Build-order corrections present and consistent

Verify the three corrections to the seeding build order are implemented in the master and reflected in the children
without contradiction:

- (a) **Append-only signed chain** replaces write-holding (D1) — receipts created at write time (`pending`), extended
  at Verifier/Adversary phase completion; no write is ever held.
- (b) **Per-role HKDF keys** replace the single ephemeral session key (D2) — role separation is cryptographically
  checkable (≥2 distinct role signatures per complete receipt), enforced by the attack suite (FID-006).
- (c) **Non-regenerable append-only ledger** with export-time supersession (D5/D6) — the build order's "regenerable"
  claim is explicitly rejected; `/rewind`/manual-edit divergence is handled at export by content-hash recomputation.

### Target 3 — Child convergence

Verify each child 002–010 has: a scoped Summary, Detailed Description, Impact Assessment, Proposed Solution with
Verification, a Perfection Loop with RED/GREEN/AUDIT/ADVERSARIAL records, Missed Questions, Code Verification Evidence
(with `file:line` citations against the real codebase), and a Resolution section stating implementation is pending.
No child may carry an open design question that blocks execution.

### Target 4 — Nova planning-approval conditions dispositioned

Verify the four non-blocking flags from Nova's planning audit are closed in the FID set:

- Flag #1 (verdict-binding hook site): FID-004's Verification section carries a hard gate — implementation RED must
  grep the agent-loop phase-lifecycle modules and cite the exact AUDIT/ADVERSARIAL completion call sites (`file:line`)
  before any wiring.
- Flag #2 (session-key trust): master D12 and FID-007 require the `/attest` artifacts to warn that receipt trust
  rests on the session's ephemeral key (memory-only custody).
- Flag #3 (convenience-view disclaimer): FID-007 requires the HTML to embed the verbatim disclaimer that
  `trust-receipt.json` is the authoritative artifact.
- Flag #4 (event volume): per-turn cap + dedupe specified (FID-004), mirroring `MAX_RUNTIME_EVENTS`.

Verify the master's Loop 3 records the planning approval and the disposition trail.

### Target 5 — Per-child gates defined

Verify every child defines its AUDIT/ADVERSARIAL gate with tool-output evidence requirements, that FID-004's hard gate
is a precondition for wiring, and that each child's closure requires its own implementation evidence plus Nova
re-audit (per Nova's planning conditions).

### Target 6 — Governance boundary

Verify: no ECHO law change is proposed anywhere in the set; the Law-2 "Escrowed Execution" addendum is explicitly out
of scope; no attribution/signature fields exist in any of the ten FIDs; the receipt schema stores hashes only (Law 12
— no content/prompts/credentials, verdict text verbatim as evidence, seed/keys never on disk or in logs).

### Target 7 — Implementation boundary

Verify the request boundary is respected: the FID set is planning-converged (`analyzed`), no implementation code
exists for any child, and nothing in the set claims implementation, closure, archive, release, or Nova approval.
Confirm the executing harness must not write implementation code until this request returns `PASS` and the operator
issues the go.

## 4. Evidence navigation

Read-only navigation aids; Nova may use equivalent commands:

```text
cat dev/fids/FID-2026-0813-001-ztap-provenance-master.md
cat dev/fids/FID-2026-0813-002-ztap-red-provenance-catalog.md
# ... through -010 ...
cat dev/nova/inbox/2026-08-13-fid-2026-0813-001-ztap-master-planning-audit-response.md
bun test scripts/fid-ledger.test.ts
bun -e "import { validateActiveFidLedger } from './scripts/fid-ledger'; console.log(validateActiveFidLedger(process.cwd()))"
bunx markdownlint "dev/fids/FID-2026-0813-*.md"
bunx prettier --check "dev/fids/FID-2026-0813-*.md"
```

These commands validate document/governance state only. They do not establish product implementation or release
readiness.

## 5. Requested Nova response

Please return a new response in the Nova inbox containing:

1. Verdict for Targets 1–7: `PASS`, `FAIL`, or `NEEDS-REVIEW`.
2. Exact `path:line` evidence for every PASS and FAIL.
3. Any missing acceptance criterion, contradiction, unsupported claim, scope overlap, or dependency cycle.
4. Confirmation that all requested documents were reviewed 0-EOF, or a precise list of documents not fully reviewed.
5. Confirmation that the FID set is planning-only and untracked working-tree evidence.
6. Confirmation that the no-signature/no-attribution policy is followed.
7. Overall verdict using exactly one:
   - `PASS — implementation routing approved; children 002–010 may begin execution in dependency order after operator go`
   - `FAIL — routing revision required`
   - `NEEDS-REVIEW — named evidence remains unavailable`
8. Explicit statement that Nova's verdict does not authorize implementation by itself, and never authorizes commit,
   push, release, publication, or remote action.

If a target fails, identify the smallest required FID correction. Do not redesign the program or modify production
files while reviewing.

## 6. Expected boundaries and non-claims

This request does not claim:

- that any implementation code exists for the ZTAP children;
- that the FIDs are tracked, closed, or archived;
- that Nova has already approved implementation routing;
- that the receipt scheme is proven (implementation evidence comes from children 005/006/008/010);
- that the current worktree is clean beyond the known untracked ZTAP/build-order/research artifacts;
- that release readiness exists in any form.

The only requested decision is whether the converged ZTAP FID set is sufficiently complete, consistent, and
code-verified for implementation to begin in dependency order after a Nova PASS and the operator's explicit go.
