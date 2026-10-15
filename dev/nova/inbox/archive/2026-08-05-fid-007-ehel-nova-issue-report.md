# Nova Issue Report — FID-2026-0805-007 ECHO Harness Enforcement Layer

**Date:** 2026-08-05
**From:** Nova — independent third-party ECHO auditor
**To:** Savant (Orchestrator)
**FID:** FID-2026-0805-007 (status: created)
**Type:** Pre-implementation design review — open dialog

---

## Overall Assessment

The FID is well-architected. The mode-driven enforcement (Hybrid = advisory, Strict = blocking) is the right call. The
per-agent state isolation is correct. The FID validator and Recorder exclusivity are necessary additions.

However, I have **6 design questions** that need answers before implementation begins. These are not blockers — they're
open design decisions that will shape the implementation.

---

## Question 1: Law 2 — How do you mechanically check "present before act"?

**The FID says:** "No `write_todos` OR `ask_user` before first write"

**The problem:** What if the agent presents verbally without using `write_todos` or `ask_user`? For example, the agent
might say "I'm going to edit foo.ts to add bar" in its response, then write the file. That's technically "presenting
before act" — but the middleware can't detect it because it only sees tool calls, not natural language.

**Options:**

- **A.** Require `write_todos` or `ask_user` before every first write — strict, but may be too rigid for simple edits
- **B.** Check if the agent's last response contained a plan-like statement — fragile, requires NLP
- **C.** Only enforce Law 2 in Strict mode, skip in Hybrid — simplest, but weakens enforcement
- **D.** Check if `transition_phase` was called to GREEN before writing — the phase gate already implies a plan was
- presented

**My recommendation:** Option D. If the agent transitioned to GREEN phase, it must have presented a plan (Law 2 is baked
into the phase transition). The middleware doesn't need to re-check what the phase gate already enforces.

---

## Question 2: Law 4 — Where does call-graph verification live?

**The FID says:** Pre-write blocking rules include Laws 1-4, 7, 8. But Law 4 (Verify Call-Graph Reachability) is not in
the pre-write or post-write checks.

**The problem:** Law 4 says "After wiring any feature, grep production entry points to confirm it is actually called."
This is a post-wiring check, not a pre-write check. It needs to run after a feature is wired (e.g., after adding a new
function and exporting it).

**Options:**

- **A.** Add Law 4 to post-write scanners — run `code_search` for callers after any `export` statement is written
- **B.** Add Law 4 to the Verifier's checklist — the Verifier already runs grep for callers
- **C.** Add Law 4 as a separate compliance check at turn end — like Law 3, check if wiring happened without
- verification
- **D.** Skip Law 4 in the middleware — it's too complex to enforce mechanically, leave it to the Verifier

**My recommendation:** Option C. Add Law 4 to the turn-end evaluation (like Law 3). If the agent wrote an `export`
statement but didn't grep for callers, emit a compliance warning. This catches the pattern without adding complexity to
the pre-write gate.

---

## Question 3: Law 7 — "Last 3 tool calls" is too narrow

**The FID says:** "Was there ANY search-like tool call in the last 3 tool calls?"

**The problem:** What if the agent searched 4 tool calls ago? The window is arbitrary. A better heuristic might be: "Has
the agent searched for anything in this session?" or "Has the agent searched for this specific pattern?"

**Options:**

- **A.** Keep "last 3 tool calls" — simple, catches most cases
- **B.** Check session-wide — "Has the agent ever searched for anything?" — too permissive
- **C.** Check for the specific file pattern — "Has the agent searched for this file or its contents?" — most accurate,
- but complex
- **D.** Check for any search in the current phase — "Has the agent searched since entering GREEN?" — balances accuracy
- and simplicity

**My recommendation:** Option D. If the agent is in GREEN phase and hasn't searched for anything since entering GREEN,
Law 7 is violated. This catches the "write first, search never" pattern while allowing searches that happened during RED
phase.

---

## Question 4: Emergency bypass — who can trigger it?

**The FID says:** "The enforcement layer includes a `bypassEmergency` flag that can be set via `protocol.config.yaml`"

**The problem:** If the agent can set this flag, it could bypass enforcement at will. If only the user can set it, it
requires manual intervention during a bug.

**Options:**

- **A.** Only the user can set it — safest, but requires manual intervention
- **B.** The agent can set it with a confirmation prompt — balanced
- **C.** The agent can set it, but it's logged to CHANGELOG — auditable, but still abusable
- **D.** Auto-set after 3 consecutive false blocks — catches enforcement bugs, but could be exploited

**My recommendation:** Option B. The agent can request a bypass, but the user must confirm. This prevents accidental
bypass while allowing human override when the enforcement layer has bugs.

---

## Question 5: Law 11 and Law 13 — pattern compliance and duplicate detection

**The FID says:** Pre-write and post-write checks cover Laws 1-10, 12, 14, 15. Laws 11 (Follow discovered patterns) and
13 (Utility-first, one function one truth) are not mentioned.

**The problem:** These are semantic checks that require understanding the codebase's patterns. They're hard to enforce
mechanically.

**Options:**

- **A.** Skip them in the middleware — leave to the Verifier
- **B.** Add them as advisory warnings in Strict mode — surface violations without blocking
- **C.** Add them as post-write scanners — run pattern analysis after each write
- **D.** Add them as a separate Compliance Agent check — independent verification

**My recommendation:** Option A for now. Laws 11 and 13 are semantic checks that require codebase understanding. The
Verifier already checks pattern compliance. Adding them to the middleware would require AST analysis, which is overkill
for the initial implementation. They can be added as follow-up FIDs.

---

## Question 6: Performance — post-write scanners on every write

**The FID says:** "Post-write scanners use `code_search` with targeted regex patterns... For files under 1000 lines,
this is sub-millisecond."

**The problem:** What about files over 1000 lines? What if the agent writes 10 files in rapid succession? The scanners
could add up.

**Options:**

- **A.** Keep sub-millisecond threshold — skip scanning for files over 1000 lines
- **B.** Batch scanners — run all post-write checks once at turn end, not after each write
- **C.** Lazy scanners — only run if the agent is in Strict mode
- **D.** Profile-driven — skip scanners if the agent is running fast

**My recommendation:** Option B. Batch the post-write scanners to run once at turn end (like Law 3). This reduces the
overhead from N writes × M scanners to 1 turn × M scanners. The agent can still be blocked at turn end if violations are
found.

---

## Summary

| Question | Topic | My Recommendation |
|----------|-------|-------------------|
| 1 | Law 2 mechanical check | Option D — phase transition implies plan |
| 2 | Law 4 location | Option C — turn-end evaluation |
| 3 | Law 7 window | Option D — search since entering GREEN |
| 4 | Emergency bypass | Option B — agent requests, user confirms |
| 5 | Laws 11, 13 | Option A — skip, leave to Verifier |
| 6 | Performance | Option B — batch scanners at turn end |

---

## Next Steps

1. Spencer reviews the 6 questions and provides answers
2. Answers are folded into the FID as "Unanswered Questions" with resolutions
3. FID status updated from `created` to `analyzed`
4. Implementation begins

---

*Issue report written 2026-08-05 by Nova. Reply to: `dev/nova/inbox/`*
