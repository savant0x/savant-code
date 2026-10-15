<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Planning Approval Audit Response — FID-2026-0813-011 (Agent-Steering Teacher, master + 012–020)

**Date:** 2026-08-13
**Auditor:** Nova — independent third-party ECHO auditor
**Target:** `dev/nova/outbox/2026-08-13-fid-2026-0813-011-teacher-planning-approval-request.md`
**Method:** Read all 10 FIDs (master 011 + children 012–020) 0-EOF + authoritative architecture (`Agent-Steering Teacher Homegrown Architecture.md`) + build order. Verified ledger integrity, FID status counts, superseded-marker presence, and absence of teacher production code via `bun test scripts/fid-ledger.test.ts` (5 pass / 0 fail) on the real working tree.

---

## Verdicts (Targets 1–11)

| Target | Verdict | Evidence |
|---|---|---|
| 1 — Master convergence | **PASS** | No ECHO law change proposed; integrates via existing common/runtime/CLI/SQLite/ZTAP boundaries (master §Problem/Expected; arch §11). Loop 3 states "fully integratable without changing ECHO laws." |
| 2 — Pedagogy/contracts (012) | **PASS** | Public/private schemas, mutation/critique contracts, target learner (dev/reviewer reading JS), honest progression defined. Operator-owned pedagogy explicit. |
| 3 — Sandbox (013) | **PASS** | Worker-only rejected as security boundary (Loop 1 RED); dedicated backend + structured IPC + fail-closed `unavailable`; escape matrix is a hard implementation gate. Corrected my earlier "Bun permission flags suffice" hand-wave. |
| 4 — Vertical slice (014) | **PASS** | One headless exercise required before corpus/UI (Loop 1 RED → GREEN); value gate, not reduced scope. FSM defined. |
| 5 — Corpus (015) | **PASS** | Operator-owned pedagogy, agent-assisted authoring, independent validation, content hashes, public/private trust domains; SQLite is generated artifact not source of truth. |
| 6 — Equivalence (016) | **PASS** | Hidden behavioral tests + anti-cheat primary; AST diagnostic only (Loop 1 RED → GREEN). Alternate implementations must pass. No mastery claim from one pass. |
| 7 — Detection (017) | **PASS** | Deterministic mutation contracts (witness/impact), structured critique evidence, bounded Adversary, calibration/held-out gates (100 cases, 95%/5% thresholds). Rejects random slop. |
| 8 — Overlay (018) | **PASS** | `/learn` is presentation/input consumer only; no tool/corpus/grader/progression/filesystem authority; static + runtime zero-control tests. Unavailable/uncalibrated are first-class states. |
| 9 — Progression (019) | **PASS** | Local-only versioned records; ZTAP process-evidence adapter; `local-unverified` fallback; no proof-of-skill overclaim (corrects exploratory "ECHO-Verified skill %"). Three held-out passes required for stronger claims. |
| 10 — Integration audit (020) | **PASS** | Terminal cross-cutting audit FID; dependencies on all trust-sensitive children; owns sandbox/calibration/held-out/privacy/call-graph evidence before closure. |
| 11 — Governance/docs | **PASS** | fCC research marked superseded (homegrown arch + master + 012); ZTAP status accurate (archived + Nova PASS); ledger reconciled. |

---

## Independent Verification (Nova, real output)

- `bun test scripts/fid-ledger.test.ts` → **5 pass / 0 fail**. Single master (011), all 9 children listed, deps resolve 012→013→014→015/016/017→018→019→020, no cycles.
- All 10 teacher FIDs report `Status: verified` (grep count: 10).
- Superseded markers present in `Agent-Steering Teacher Homegrown Architecture.md`, master 011, and 012.
- No teacher production code: `packages/agent-runtime/src/teacher` does not exist. Planning-only confirmed.

---

## What This Design Got Right (auditor's read)

This is a materially better plan than the exploratory version, and it closed every gap I flagged earlier tonight:

1. **Sandbox boundary** — rejected worker-thread isolation as a security claim. My in-house synthesis said "Bun permission flags as the boundary" with a risk note; this design makes a dedicated capability-reported backend + fail-closed `unavailable` the requirement. Correctly harder.
2. **Private-answer isolation** — explicit trust domains (public pack / exercise workspace / private pack / sandbox / grader / progress / UI). "Tool deny rule is one defense, not the trust model" — reachability tested through paths, imports, env, errors, stdout, shared memory.
3. **Grading validity** — behavior-first (hidden tests + anti-cheat fixtures), AST diagnostic only. Adversary bounded by mutation contract, not a free oracle. This is exactly the "LLM-as-judge bias" fix the research identified.
4. **Honest claims** — "completed exercise evidence," not "proof-of-skill." ZTAP adapter is process-evidence only; `local-unverified` fallback labeled honestly. Three held-out passes for stronger competency state. No telemetry overclaim (separated from Law 12).
5. **Phase order** — vertical slice (014) is a mandatory gate *before* corpus scale or UI. Value risk minimized first.

---

## Hard-Question Disposition (per request §55)

- *Is the sandbox implementable on Windows/Bun?* — Design says NO silently: returns `unavailable` if the backend cannot prove its guarantees. Honest. Implementation gate owns the proof. ✅
- *Grading distinguish judgment from lucky Forge?* — Equivalence requires learner explanation/evidence; detection uses structured critique. Partial mitigation; held-out transfer is the real test (a planning gate, not yet proven). ✅ as design.
- *Private pack unreachable?* — Trust domains + reachability tests required (015/020). Design-level pass; implementation gate owns proof. ✅
- *Claims narrower than provable?* — Yes; ZTAP process-only, local-unverified fallback, no mastery from one pass. ✅
- *Phase order minimizes value risk?* — Yes; vertical slice before corpus/UI. ✅

---

## Overall Verdict

**PLANNING APPROVED FOR OPERATOR DECISION.**

The teacher concept is fully converged, internally consistent, security-first, and honestly bounded. The FID set is planning-only (no production code), ledger-valid, and correctly supersedes the fCC research. Every hard question from the request is dispositioned as a design decision with an explicit implementation gate (not a deferred risk).

This is a planning sign-off only. It does not authorize implementation, commit, push, release, or deployment. When you issue the go, children execute in dependency order (012→013→014→015/016/017→018→019→020); each closes only after its own AUDIT/ADVERSARIAL gates pass with runtime evidence, and I re-audit per the master's Loop-4 discipline.

---

## Blocking findings

**None.**

## Residual non-blocking notes

1. **Loop-4 thresholds are policy, not evidence.** The 20-run / 95% / 5% / zero-escape gates are acceptance criteria; they prove nothing until runtime output exists. My sign-off discipline (per master Loop 4 ADVERSARIAL) will reject any implementation claim that reports these as passed without executable output.
2. **Filename divergence from request.** The request cited `FID-2026-0813-0XX-agent-steering-teacher-<scope>.md`; actual files use `FID-2026-0813-0XX-teacher-<scope>.md` (no `agent-steering-` middle). Minor; the request's registry still resolves correctly. Noted so future references use the real names.
3. **Held-out transfer is the real product-risk test.** One vertical slice proves integration mechanics, not market value. The design acknowledges this (014/017 ADVERSARIAL). If held-out transfer fails at build time, the concept should be reconsidered — the design says so explicitly. Good.

---

## Release authorization

**NONE.** Planning approval is not implementation authorization, and neither is a future implementation-routing PASS. Commit/push/tag/release remains the operator's hard gate.

*Audit by Nova, 2026-08-13. All 10 FIDs read 0-EOF; ledger 5/5 on real tree; no teacher code present; fCC docs superseded. Planning approved for operator decision; execution gated on go + per-child gates + Nova re-audit.*
