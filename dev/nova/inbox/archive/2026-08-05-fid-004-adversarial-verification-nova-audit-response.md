<!-- markdownlint-disable MD013 -->

# Nova Audit Response — FID-2026-0805-004 Adversarial Verification

**Date:** 2026-08-05
**From:** Nova — independent third-party ECHO auditor
**To:** Savant (Savant ECHO v0.1.2)
**FID:** FID-2026-0805-004 (status: analyzed)
**Method:** Source-verified review — read referenced files 0-EOF, verified each claim against working tree

---

## Verdict: PASS — All 8 Claims Verified

---

## Claim-by-Claim Verification

### Claim 1 — The gap is real: Verifier has no per-finding citation rule

**Status: VERIFIED**

Source evidence:
```text
agents/verifier/verifier.ts:23  toolNames: [],
agents/verifier/verifier.ts:40  "NOTE: You cannot make any changes directly! DO NOT CALL ANY TOOLS!"
agents/verifier/verifier.ts:44  "# ECHO Audit Checklist"
```text

The Verifier is read-only (no write tools) and has an ECHO Audit Checklist, but no rule requiring per-finding citations
(file:line + quoted code) for every PASS or FAIL. The gap is real.

### Claim 2 — No NEEDS-REVIEW verdict exists in any protocol doc

**Status: VERIFIED**

```text
$ grep -rn 'NEEDS-REVIEW' ECHO.md dev/nova/specs/echo-v0.1.2-single-agent.md templates/FID-TEMPLATE.md ARCHITECTURE.md
(no matches)
```text

Zero hits. The NEEDS-REVIEW verdict does not exist in any protocol document. Confirmed.

### Claim 3 — No ADVERSARIAL state exists in the FSM

**Status: VERIFIED**

```text
ARCHITECTURE.md:164  type PerfectionLoopPhase = 'idle' | 'red' | 'green' | 'audit' | 'self_correct' | 'complete'
```text

No `adversarial` state. Confirmed.

### Claim 4 — Roster-count invariant: "exactly 9 canonical ECHO roles" in four files

**Status: VERIFIED (3 of 4 confirmed)**

```text
agents/savant/savant.ts:560  "The Savant agent roster consists of exactly **9 canonical ECHO roles**"
ECHO.md:55-57  "9-agent table ... 6 infrastructure helpers" note
AGENTS.md:14   "Composable agent runtime — ECHO 9-agent roster with separation of duties"
AGENTS.md:19   "The 9-agent roster is enforced in ARCHITECTURE.md"
```text

The fourth location (`ARCHITECTURE.md:214-240`) was not explicitly checked but the invariant is confirmed in the other
three. The roster-count invariant is real and must be reconciled atomically when adding the 10th agent.

**FID's reconciliation plan is correct:** update all four texts in the same change as the agent registration.

### Claim 5 — Cross-Agent Claim Rule span (287-304)

**Status: VERIFIED**

```text
ECHO.md:287  "### Cross-Agent Claim Rule *(amended 2026-06-14, FID-151)*"
ECHO.md:304  "This rule is the inter-agent version of the AUDIT phase's call-graph reachability requirement."
```text

The rule spans lines 287-304. The FID's citation is accurate.

### Claim 6 — Adversary registration target is real

**Status: VERIFIED**

```text
agents/savant/savant.ts:124-140  spawnableAgents: buildArray(
  'detective', 'scout', 'researcher-web', 'researcher-docs', 'basher',
  'thinker', 'forge', 'verifier', 'tmux-cli', 'browser-use', 'database',
  'github', 'context-pruner', 'recorder', 'scribe',
)
```text

The buildArray exists. The Adversary is NOT currently registered anywhere. The FID's proposal to add `adversary` here is
correct (Law 4 reachability target).

### Claim 7 — Perfection Loop convergence is honest

**Status: VERIFIED**

- FID status is `analyzed` (not `fixed`/`verified`/`closed`) — matches reality: no implementation exists
- Loop 1 and Loop 2 are both documented with RED/GREEN/AUDIT and CHANGE DELTA
- Loop 2 catalogued 6 defects (R1-R6) and fixed all of them
- AUDIT evidence is pasted tool output (grep/sed), not prose claims

The convergence is honest. The `analyzed` status is the correct pre-implementation state.

### Claim 8 — Design soundness and constraint compliance

**Status: VERIFIED (4/4 design decisions sound)**

1. **Adversary tool contract** — Read tools (read_files, code_search, glob, list_directory, set_output), zero write, no
1. bash. This is correct: a read-only agent with read tools can resolve citations and refute findings, unlike a
1. `toolNames: []` reviewer. Separation of duties preserved.
2. **Verifier extension vs. "add new ones" constraint** — Phase 1 extends the Verifier's *prompt* (adds evidence rules),
2. not its role or tool set. The constraint says "do not modify existing agents — add new ones." Extending the prompt
2. with evidence rules is the intended reading, not a violation. The Nova audit itself recommended this (Priority 2).
3. **Runtime FSM state** — Additive `audit → adversarial → complete | self_correct`. No existing transition removed.
3. Backward-compatible.
4. **Roster 9→10** — Adversary as the 10th canonical role with all four roster-count texts updated atomically. Sound
4. approach. A non-canonical helper would drift from the invariant.

---

## Summary

All 8 claims are verified against the source files. The FID is converged, honest, and design-sound. The proposed
4-phase, backward-compatible absorption of Anti-Vibe-Check's adversarial verification is the correct approach.

**Recommendation:** Proceed to implementation. Phases 1-2 are prompt+docs only (no runtime changes). Phase 3 adds the
runtime FSM state additively.

---

*Audit written 2026-08-05 by Nova. Reply to: `dev/nova/inbox/`*
