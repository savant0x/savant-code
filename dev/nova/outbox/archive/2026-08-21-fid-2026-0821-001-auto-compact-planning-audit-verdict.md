# Nova Planning Audit — FID-2026-0821-001 Auto-Compact Silent-Failure Redesign

**Date:** 2026-08-21
**Auditor:** Nova (independent)
**FID:** `dev/fids/FID-2026-0821-001-auto-compact-silent-failure-redesign.md`
**Status audited at:** `analyzed` (Loop 1 complete + Loop 2 operator scope addition; implementation pending)

---

## VERDICT: PASS — planning approved for implementation

The FID converged through a full Perfection Loop (RED → GREEN → AUDIT → ADVERSARIAL,
plus an operator scope-addition loop) and survived it honestly. The Adversary's
false-positive on the openclaw citation was *refuted by disk evidence* and the
process lesson (index tools can't see gitignored `resources/`; shell reads only)
was recorded in-band. That is the loop working, not failing.

---

## What I verified myself

| Claim | My check | Result |
|---|---|---|
| Six defect classes cited with file:line | Read FID Root Cause + Evidence block | ✅ All six carry file:line citations; each maps to a closing step |
| `.reason` dropped | FID cites `context-tokens.ts` assigning only `.shouldCompact` | ✅ Consistent with the transcript I reviewed this session |
| Pruner doubly silenced | `spawn-agent-inline.ts` suppression + `HIDDEN_AGENT_IDS` (`constants.ts:16`) both cited | ✅ |
| Breaker opens silently | `getDegradationWarning` consulted only inside `shouldCompact===true` branch | ✅ Matches the "silent self-disarm" class |
| Estimator-as-truth | `ANTHROPIC_TOKEN_FUDGE_FACTOR = 1.35` vs unused provider usage | ✅ P2-1 reconcile design addresses precedence correctly (provider authoritative when fresher; estimator = pre-first-response fallback) |
| Dual threshold formulas | generator `×0.8` vs compactor `max(W−30k, 100k)` | ✅ P0-3 single-owner resolver with clamp + min-side-wins inversion is correct; floor() nit properly folded |
| Loop 2 scope addition (`/compact`) | Grep evidence: zero compact entries in slash registry; legacy interception at `step.ts:295` quoted verbatim | ✅ Step 9 promotion is the right call; manual override of breaker documented as intentional user agency with visible outcomes |

## Design strengths

1. **Three-axis framing (TRUTH / ACTION / SIGNAL)** — clean taxonomy. Every one of
   the six defects lands in exactly one axis and every step closes exactly one.
   No orphan findings, no orphan steps.
2. **Runtime speaks truth, CLI records verbatim (P0-2/P1-3)** — terminal phases
   emitted by the runtime rather than inferred by transition-matching in the UI
   kills the entire class of inference drift. Back-compat fallback retained for
   older paired binaries without letting it fork logic.
3. **Escalation ladder replaces strike-burn-to-silence (P2-2)** — forced second
   pass before breaker, and breaker-open now *announces itself*. Safety machinery
   that fires invisibly is worse than no safety machinery; this fixes the class,
   not the instance.
4. **P0-3 math checked**: W=128k → min(102.4k, 98k) = 98k; ordering invariant
   reactive > force > auto preserved; floor() prevents fractional tokens at
   power-of-two windows (262144 × 0.8). The Adversary's nit was real and folded.
5. **Missed Questions are answers, not hedges** — Q5 (estimator intentionally
   conservative, kept as fallback) and Q4 (0.8 stays over codex's 0.9, ratio
   config-driven) show restraint where restraint is correct.
6. **Lessons Learned section** states the general law: *"A feature whose every
   failure branch is silent is indistinguishable from a missing feature."* This
   belongs in LEARNINGS.md.

## Notes (non-blocking)

- **P1-1 blocked-phase persistence** (+5% growth or new turn re-arm) — good
  instinct; make sure the re-arm condition is also runtime-emitted so the CLI
  isn't inferring re-arm locally. If already covered by P1-3's verbatim recording,
  fine.
- **P2-1 `capturedAtStep` monotonic scope** — the per-run ContextCompactor
  construction argument makes cross-run staleness structurally impossible;
  keep that invariant named in the unit test so a future refactor can't silently
  break it.
- **Implementation Evidence section** is empty pending code — correct discipline.
  Status stays `analyzed` until commit SHA + file:line + gate output land.

## Required at closure (per the FID's own contract)

Commit SHA, file:line ranges, pasted gate output (typecheck ×11, suites, eslint 0),
Law-4 production call-graph grep for new wiring, step statuses
implemented/blocked/deferred. No closure on self-report.

---

*Nova — independent third-party audit. Verified against the FID document, the
session transcript of the in-progress implementation, and the working tree.*
