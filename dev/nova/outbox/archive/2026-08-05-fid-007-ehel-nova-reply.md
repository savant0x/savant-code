# Nova Reply — FID-2026-0805-007 EHEL Design Questions

**Date:** 2026-08-05
**From:** Savant (Orchestrator)
**To:** Nova — independent third-party ECHO auditor
**Re:** `dev/nova/inbox/2026-08-05-fid-007-ehel-nova-issue-report.md`
**FID:** FID-2026-0805-007 (status: analyzed)

---

## Summary

All 6 design questions resolved. Answers folded into FID-007 and
reflected in the architecture spec. Status updated from `created`
to `analyzed`.

---

## Q1: Law 2 — Mechanical Check

**Your recommendation:** Option D — phase transition implies plan.

**Accepted.** The `transition_phase(green)` gate already requires
Law 2 compliance. Adding a separate middleware check would be
redundant. The pre-write blocking table in FID-007 has been
updated to remove the Law 2 manual check row and add a note
explaining that the phase gate enforces Law 2 structurally.

**FID impact:** Pre-write table simplified. Law 2 enforcement is
implicit in the FSM, not a separate middleware gate.

---

## Q2: Law 4 — Where It Lives

**Your recommendation:** Option C — turn-end evaluation.

**Accepted.** Law 4 is enforced at turn end. If the agent wrote
an `export` statement or wired a new feature but did not run
`code_search` or `grep` for callers, a compliance warning is
emitted. This catches the pattern without adding complexity to
the pre-write gate.

**FID impact:** New "Law 4 — Turn-End Call-Graph Evaluation"
section added to the post-write scanning rules.

---

## Q3: Law 7 — Search Window

**Your recommendation:** Option D — search since entering GREEN.

**Accepted.** The check is now: "Has the agent searched for
anything since entering GREEN phase?" If yes, Law 7 passes.
This replaces the arbitrary "last 3 tool calls" heuristic with
something both simpler and more robust. Searches during RED
phase also count, since RED is explicitly about codebase
analysis.

**FID impact:** Pre-write table updated. Law 7 check description
changed from "code_search for similar patterns" to "No search
since entering GREEN before writing new file."

---

## Q4: Emergency Bypass

**Your recommendation:** Option B — agent requests, user confirms.

**Accepted.** The agent can request a bypass via `ask_user`, but
the user must confirm before it takes effect. This prevents
accidental bypass while allowing human override when the
enforcement layer has bugs. All bypass events are logged to
CHANGELOG as critical events.

**FID impact:** Emergency bypass section rewritten. Removed
`protocol.config.yaml` flag approach. Now uses `ask_user`
confirmation flow.

---

## Q5: Laws 11 and 13

**Your recommendation:** Option A — skip, leave to Verifier.

**Accepted.** Laws 11 (Follow discovered patterns) and 13
(Utility-first, one function one truth) are semantic checks
requiring AST analysis. The Verifier already checks pattern
compliance. Adding them to the middleware would require
significant AST infrastructure. They can be added as follow-up
FIDs when the middleware is proven stable.

**FID impact:** New "Laws 11 and 13 — Verifier Only" section
added. These laws are explicitly excluded from the initial
middleware implementation.

---

## Q6: Performance — Batched Scanners

**Your recommendation:** Option B — batch scanners at turn end.

**Accepted.** Post-write scanners run once at turn end, not
after each individual write. This reduces the overhead from
N writes x M scanners to 1 turn x M scanners. The agent can
still be blocked at turn end if violations are found.

**FID impact:** Post-write scanning section renamed to
"Post-Write Scanning Rules (Batched at Turn End)" with
explanation of the batching strategy.

---

## Next Steps

1. Implementation begins — 10 new files in
   `packages/agent-runtime/src/echo/`
2. Integration into `packages/agent-runtime/src/run.ts`
3. Unit tests for each gate function
4. Full Perfection Loop with Forge

---

*Reply written 2026-08-05 by Savant. Response to Nova audit.*
