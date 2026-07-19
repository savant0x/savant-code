# Architecture Gap Audit — Savant-Code vs ARCHITECTURE.md

**Date:** 2026-07-18
**Auditor:** Nova (external ECHO v0.2.0 second-set-of-eyes)
**Scope:** Does the built code match `ARCHITECTURE.md` spec? Gaps, missing pieces, deviations.
**Method:** Read ARCHITECTURE.md (195 lines) + probed `packages/agent-runtime/src` + `agents/` against spec. Source-verified, not self-reported.

---

## 🔴 HIGH — Tool Gating (active) NOT implemented

**Spec (ARCH line 167-179):** "Tools are gated by FSM phase in `tool-executor.ts`" with explicit table:
- `write_file, str_replace, apply_patch` → GREEN only
- `bash (test/typecheck)` → AUDIT only
- `bash (destructive)` → Never
- `create_fid, update_fid, archive_fid` → Recorder only
- `sequentialthinking` → Thinker only

**Code reality:** Grep for `tool-executor`, `fsmPhase` in handler execution, `GREEN only` gates → **0 matches** in `packages/agent-runtime/src`. The only FSM enforcement is `transition_phase.ts` (validates *transitions*, not *tool calls by phase*).

**Impact:** An agent in RED phase can call `write_file` if its `toolNames` includes it. Gating is *template-level only* (agent def lists tools), not *runtime FSM-enforced*. This is exactly ARCHITECTURE's **Open Decision #1** ("FSM enforcement: implement now or defer?") — currently **deferred**.

**Verdict:** Spec says "active", code says "deferred". Either implement `tool-executor.ts` phase gating, or update ARCHITECTURE to mark it "future phase" honestly (like the original ECHO doc did).

---

## 🟡 MEDIUM — 9-Agent Roster incomplete as named definitions

**Spec (ARCH line 19-29):** 9 agents with dedicated roles: Orchestrator, Detective, Forge, Verifier, Recorder, Thinker, Scout, Researcher, Scribe.

**Code reality:** `agents/` has `detective/`, `forge/`, `browser-use/`, `context-pruner/`, `basher/`, `file-explorer/`, `editor/`, `general-agent/`. Grep for `orchestrator|verifier|recorder|scribe|researcher|scout|thinker` as named agent defs → **0 matches**.

The FEATURE-TEST-REPORT showed 16 sub-agents spawned at runtime (scout, verifier, recorder, scribe, thinker, etc.) — so they exist via `spawn_agents` runtime, but there are **no dedicated agent definition files** matching the clean 9-agent roster. The spec's strict separation (Verifier = zero tools, Recorder = FID-only) is not verifiable against a definition file.

**Verdict:** Either the 9 agents are defined inline in `base2.ts`/`general-agent.ts` (need to confirm), or the roster is runtime-spawned without the clean spec structure. Flag for the coding agent to confirm where these defs live.

---

## 🟡 MEDIUM — Verifier "no tools" deviates from spec

**Spec (ARCH line 24):** Verifier = `*(no tools — reads only via message history)*`

**Code reality:** FEATURE-TEST-REPORT showed Verifier did a read-only review of `transition-phase.ts` and independently confirmed C1. That requires **read tools** (read_files / read_subtree), not just message history.

**Verdict:** Safer in practice (Verifier must read to audit), but deviates from the literal spec table. Either update spec to "read-only tools" or restrict Verifier to message-history-only as written.

---

## ⚠️ STALE REPORT — FEATURE-TEST-REPORT.md is outdated on C1 and C2

The first-boot report (generated earlier today) claimed two findings that the **current code contradicts**:

| Report claim | Actual code | Status |
|---|---|---|
| **C1 (High):** `hasOpenFids()` gate absent from `transition-phase.ts` | Lines 57-76: `scanOpenFids()` IS called, blocks `idle → green` when no FIDs exist | ❌ Stale — gate is present |
| **C2 (Medium):** `Promise<any>` violates Law 6 | Line 27: `previousToolCallFinished: Promise<void>` — `void`, not `any` | ❌ Stale — Law 6 compliant |

**Conclusion:** The report was generated against an older `transition-phase.ts` (before you added the FID-Bound gate + fixed the type). The coding agent has already closed C1 and C2. **The report should be regenerated** before using it as a TODO list — it currently lists 2 resolved items as open.

---

## ✅ VERIFIED CORRECT (no action needed)

1. FSM transition validation works — `idle → red → green → audit → complete → idle` legal, invalid rejected with clear message (confirmed in `transition-phase.ts` lines 14-55)
2. FID-Bound Execution gate present — `scanOpenFids()` blocks code-writing phase without open FID (lines 57-76)
3. Circuit Breaker — `MAX_ITERATIONS = 10` hard stop implemented (lines 12, 78-95)
4. Forge tool restriction — `toolNames: ['write_file', 'str_replace', 'set_output']` matches spec exactly (forge.ts line 43)
5. 16 sub-agents spawn + self-report (per FEATURE-TEST-REPORT, 21/21 core systems passing)

---

## RECOMMENDATION PRIORITY

1. **🔴 Implement `tool-executor.ts` phase gating** (or honestly mark it "future phase" in ARCHITECTURE — don't claim "active" when deferred)
2. **🟡 Confirm 9-agent roster defs** — where do Orchestrator/Verifier/Recorder/Thinker/Scout/Researcher/Scribe live? Dedicated files or inline?
3. **🟡 Reconcile Verifier tools** — spec says zero, code gives read. Pick one and update the other.
4. **⚠️ Regenerate FEATURE-TEST-REPORT** — C1/C2 already fixed, report is stale.

---

## ECHO Compliance Notes

- Law 1 (Read 0-EOF): ✅ Read full ARCHITECTURE.md (195 lines) + transition-phase.ts (129 lines) + forge.ts (60+) before auditing
- Law 2 (Present Before Act): This is an audit, no code written. Presenting findings for your approval.
- Law 3 (Verify Before Proceed): All claims backed by grep/read tool output, not assumption.
- Law 4 (Call-Graph): N/A — this is a spec-vs-code gap analysis, not a feature wire.
- Honest Assessment: Stale-report findings flagged as such; not treated as open bugs.

**Nova — external audit only. No code modified. Drop corrected reports in `outbox/` and I'll re-audit.**
