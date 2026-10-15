# FID: Safe Chat-State Serialization

**Filename:** `FID-2026-0806-012-safe-chat-state-serialization.md`
**ID:** FID-2026-0806-012
**Severity:** high
**Status:** closed
**Created:** 2026-08-06
**Author:** Savant
**YAGNI-Compliance:** Verified
**Source:** Nova fresh-user teardown Bug #3
**Reply to:** `dev/nova/inbox/2026-08-06-fresh-user-teardown-bug-report.md`

---

## Problem

"Failed to save chat state: JSON.stringify cannot serialize cyclic structures"
fires on runs. `--continue` cannot work if state never saves.

## RED — evidence (verified against working tree, 2026-08-06)

| Claim | Evidence |
|---|---|
| Plain stringify in the save path | `cli/src/utils/run-state-storage.ts:225-226` (sync) + `:252-253` (async) — `JSON.stringify(runState)` / `JSON.stringify(messages)` |
| RunState can carry cycles | `sdk/src/run/types.ts:218` — `mainAgentState = JSON.parse(JSON.stringify(state.mainAgentState))` runs during state assembly; `AgentState.echoCompliance` is `@internal`/non-serialized, but message history and tool outputs can embed object references |
| DB path also stringifies | `saveChatStateToDb` receives the same `runState`/`messages` (db-storage) |
| Prior cyclic fix exists for reports only | `evals/v2/src/reports.ts` — cyclic-safe replacer for provider error objects (FID-2026-0803-012 RR-5c); not applied to chat state |

## GREEN — design (loop-converged)

| Decision | Design |
|---|---|
| Safe serializer | Shared cyclic-safe stringify (replacer with a `WeakSet`/`Set` of seen objects; drop repeated refs, keep primitives) in `cli/src/utils/` — reuse the pattern from `evals/v2/src/reports.ts` |
| Wire both paths | Apply in `saveChatState` + `saveChatStateAsync` for `runState` and `messages` |
| DB fallback | Serialize via the same helper before handing to `saveChatStateToDb` |
| Diagnostics | On failure, log which field dropped cycles (debug) so future cycles are traceable |
| `--continue` | Restore path (`loadChatStateFromDisk`) unchanged — output format identical for acyclic state |

## AUDIT — double-audit evidence

- `run-state-storage.test.ts` exists and covers save/load round-trips — extend with a cyclic fixture.
- `evals/v2/src/reports.ts` cyclic-safe replacer verified as the in-repo precedent.
- `sdk/src/run/types.ts:218` stringify confirmed as a second cycle risk on the
  state-assembly path (clamp with the same helper if reachable).

## ADVERSARIAL — verdicts

| Challenge | Verdict |
|---|---|
| Dropping cyclic refs loses data? | CONFIRMED acceptable — cycles are bookkeeping refs, not user content; messages/runState survive intact |
| Add `flatted` dependency? | REFUTED — a 15-line replacer covers the need; YAGNI gate holds (no new dep) |
| Does the SDK-side stringify need fixing too? | ADJUSTED — same helper exported from the SDK or duplicated locally; verified at implementation |
| Silent data loss on failure? | CONFIRMED — already caught + logged; improve log to include the cycle path |

## Loop 2 (double-audit, 2026-08-06)

- **RED:** AUDIT pass found (1) template metadata non-compliance; (2)
  citation drift — stringify call sites are `run-state-storage.ts:225-226`
  (sync) and `:252-253` (async), not :154-156.
- **GREEN:** metadata block brought to template contract; citations corrected.
- **AUDIT (fresh tool output):** `grep -n JSON.stringify
  cli/src/utils/run-state-storage.ts` → :225 runState, :226 messages (sync);
  :252 runState, :253 messages (async) — plain stringify confirmed on all
  four writes. `sdk/src/run/types.ts:218`
  `JSON.parse(JSON.stringify(state.mainAgentState))` confirmed as a second
  cycle risk. `evals/v2/src/reports.ts:17` `const seen = new WeakSet<object>()`
  — in-repo cyclic-safe replacer precedent confirmed.
- **CHANGE DELTA:** < 2% (metadata + one citation line).

### Missed Questions

1. Does the DB path need the same fix? → Yes — `saveChatStateToDb` receives
   the same `runState`/`messages`; serialize once in `saveChatState` and pass
   plain JSON to both sinks (db + disk).
2. Are `ContentBlock`/`ChatMessage` types free of shared refs? → They can
   embed tool outputs that reference run objects; the replacer drops
   second-visit object refs without losing message content.

## Convergence

Zero actionable improvements remain. Loop terminated → COMPLETE state.
**Nova verdict (2026-08-06):** ✅ APPROVED — see
`dev/nova/inbox/2026-08-06-fid-009-015-fresh-user-teardown-nova-audit-response.md`.
Awaiting operator approval for IMPLEMENT.

## Resolution

- **Fixed By:** Savant (Savant ECHO v0.1.2)
- **Fixed Date:** 2026-08-06
- **Fix Description:** Shared safeStringify (cli/src/utils/safe-stringify.ts) - WeakSet circular-replacer (reports.ts/logger.ts pattern) + Error/BigInt handling - used on all 4 chat-state write sites (saveChatState + saveChatStateAsync, run-state + messages). A cyclic run state can no longer throw away the checkpoint.
- **Tests Added:** run-state-storage.test.ts cyclic sync + cyclic async tests (2).
- **Verified By:** Savant (implementation AUDIT) — typecheck ×4 exit 0; full-repo eslint exit 0; prettier clean; lint:md 0; SDK suite 452 pass / 0 fail; CLI suite 2874 pass / 0 fail
- **Commit/PR:** *(pending — operator commits/pushes)*
- **Archived:** 2026-08-06

## Lessons Learned

State that crosses a process boundary must serialize defensively by default.
A cyclic structure is a bug waiting to erase an entire session's history —
the cost of a safe replacer is negligible, the cost of the failure is total.
