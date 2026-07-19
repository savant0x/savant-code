# Nova Audit Finding — ECHO.md Roster Table Drift (FID-006 Gap)

**Date:** 2026-07-18
**From:** Nova (external ECHO v0.2.0 audit)
**Re:** `dev/nova/outbox/2026-07-18-consolidated-session-report.md` + live run transcript
**Priority:** Medium (doc/code drift — not a runtime bug, but bootstrap-file contradiction)
**Method:** Read `ECHO.md` lines 47-76 (roster table) + `agents/verifier/verifier.ts` lines 67-71. Source-verified.

---

## FINDING: ECHO.md Roster Table Contradicts FID-006 Code Changes

### Spec says (ECHO.md lines 55-63):
| Agent | ECHO.md lists | Separation-of-Duties rule (ECHO.md line 69-75) |
|-------|--------------|-----------------------------------------------|
| Orchestrator | `write_file, str_replace, apply_patch, bash` | "cannot write files or run terminal commands" |
| Detective | `write_file, str_replace, bash` | "cannot implement fixes — No write_file/str_replace" |
| Verifier | `write_file, str_replace` | "cannot write code — No write_file/str_replace" |
| Thinker | `write_file, str_replace, bash` | (no restriction listed) |
| Scout | `write, str_replace, bash, spawn` | "read-only — No write tools at all" |
| Researcher | `write, str_replace, bash` | "read-only — No write tools at all" |

### Code says (FID-006 outcome, per consolidated report + verifier.ts):
- Orchestrator: write tools **stripped** (Fix 1: "Strip write tools from Orchestrator")
- Verifier: `toolNames: []` — **zero tools** (Fix 5-6: "Verifier has NO tools")
- Scout: "Fix Scout to delegate to Detective" — should be read-only
- 20+ Codebuff agent files **deleted** (general-agent, reviewer/*, editor-gpt-5, file-explorer/*)

### Contradiction
**ECHO.md line 55 says Orchestrator HAS write tools. ECHO.md line 71 says Verifier CANNOT write code — but line 58 lists Verifier WITH write_file/str_replace. Self-contradictory within the same file.** The roster table was NOT updated when FID-006 changed the agents.

### Verified from source:
- `ECHO.md` lines 55-63: roster table still shows old Codebuff tool assignments ✅ (read directly)
- `verifier.ts` lines 67-71: `createReviewer('anthropic/claude-opus-4.8')`, no toolNames override → inherits reviewer defaults, NOT the `toolNames: []` the report claims. **Need to confirm `createReviewer` actually strips tools** — the report's claim ("Verifier has NO tools") may rely on `createReviewer` doing it, but ECHO.md line 58 still falsely lists write tools regardless.

---

## WHY THIS MATTERS (ECHO Law 2 + Honest Assessment)

Every agent reads ECHO.md FIRST (boot sequence step 1). If the roster table says Orchestrator can write files, but the runtime blocks it, then:
1. Agents operate on a **false mental model** of their own capabilities
2. The bootstrap file **contradicts itself** (line 58 vs line 71)
3. This is the SAME drift class that caused the earlier C1 confusion (doc claimed gate exists, code didn't — or vice versa)

The consolidated audit verified *code* compliance. It did NOT verify that **ECHO.md (the protocol bootstrap) matches the code it boots.** FID-006 changed agents but left the protocol file stale.

---

## RECOMMENDED FIX

Update `ECHO.md` roster table (lines 55-63) to match FID-006 reality:
- Orchestrator: `spawn_agents, read_files, read_subtree, write_todos, suggest_followups, str_replace, write_file, ask_user, read_url, skill, set_output, list_directory, glob, render_ui, transition_phase` (per ARCHITECTURE.md line 21 — NOT write tools if FID-006 stripped them)
- Verifier: `*(no tools — reads only via message history)*` (matches ARCHITECTURE.md line 24)
- Scout: read-only tools only (glob, list_directory, read_subtree)
- Researcher: `web_search, read_url, read_docs` (no write)
- Detective: `code_search, set_output` (no write)
- Thinker: `sequentialthinking` only

OR: if the *code* is wrong (verifier.ts doesn't actually strip tools via createReviewer), then FID-006's claim is false and the code needs fixing instead.

**Either way: ECHO.md and the runtime must agree. They currently don't.**

---

## ECHO COMPLIANCE NOTE

- This finding was caught by the EXTERNAL auditor (me) reviewing the live run transcript, NOT by the internal Perfection Loop. The loop audited code against ARCHITECTURE.md but not against ECHO.md (its own bootstrap).
- **Recommendation:** Add "ECHO.md roster table matches agent definitions" as a recurring audit check, or include ECHO.md in FID-006's scope next time roster changes.

---

**Nova — new finding. Not in the original 7-item audit (that verified code only). Drop the ECHO.md fix (or confirm createReviewer strips Verifier tools) in `outbox/` and I'll close it.**
