<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: Per-step history copy reduction

**Filename:** `FID-2026-0815-004-per-step-history-copy-reduction.md`
**ID:** FID-2026-0815-004
**Severity:** medium
**Status:** closed
**Created:** 2026-08-15
**YAGNI-Compliance:** Verified — removes redundant copies only; no new store, no new authority. The `expireMessages` fast-path and the conditional append both reuse existing logic (Law 13).

**Parent:** FID-2026-0815-002 (finding F-03)

---

## Summary

Every agent step rebuilds the full message history several times in `runAgentStep` (`packages/agent-runtime/src/run-agent-step/step.ts`). The step-start construction `buildArray(...expireMessages(history, 'agentStep'), stepPrompt && userMessage(...))` performs **three** full-history allocations (a `filter`, a spread-collect, and a falsey `filter`) when the semantic is simply "append the step prompt." The step-end `expireMessages(history, 'agentStep')` adds a fourth. Over a session this is O(n) × 4 per step with a large constant, growing quadratically in total.

## RED — Issue catalog

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| E-01 | med | `buildArray(...expireMessages(history, 'agentStep'), stepPrompt && userMessage(...))` does three full-history copies (filter → spread-collect → falsey-filter) every step, when only "append the step prompt" is needed. | `step.ts:117-134` (`const agentMessagesUntruncated = buildArray<Message>(...expireMessages(...), stepPrompt && userMessage(...))`) |
| E-02 | med | `expireMessages` always allocates a new array via `.filter()`, even when nothing expires — the common case at step start (the prior step's end already removed `agentStep` messages). | `packages/agent-runtime/src/util/messages/history.ts:14-26` (`return messages.filter(...)`) |
| E-03 | low | The step-end `expireMessages(history, 'agentStep')` allocates a full copy to remove the transient step-prompt message (real work, but one full pass per step). | `step.ts:280-283` |

**Structural note (presented, not silently dropped):** the immutable `[...history, msg]` append pattern used for steering / ECHO-compliance / grounding appends is O(n) by design. Reducing it further would require changing the history data structure (e.g., mutable array + versioning) — a larger architectural decision to be raised separately with the operator, not absorbed here.

## GREEN — Proposed fix (converged)

1. **E-02:** add a fast-path to `expireMessages` — scan once for a would-expire message; if none, return the input array unchanged (no allocation). Semantics identical (same elements returned); the scan is O(n) with no allocation versus the current O(n) allocation.
2. **E-01:** replace `buildArray(...expireMessages(history, 'agentStep'), stepPrompt && userMessage(...))` with a conditional append:
   ```ts
   const filtered = expireMessages(agentState.messageHistory, 'agentStep')
   const stepPromptMessage = stepPrompt
     ? userMessage({ content: stepPrompt, tags: ['STEP_PROMPT'], timeToLive: 'agentStep' as const, keepDuringTruncation: true })
     : undefined
   agentState.messageHistory = stepPromptMessage
     ? [...filtered, stepPromptMessage]
     : filtered
   ```
   `buildArray`'s falsey-filter only ever removed the `false` from `stepPrompt && …` when `stepPrompt` was absent — the conditional append covers that exactly.

**Net:** 4 allocations/step → 2 (and 1 when `stepPrompt` is absent). No behavior change.

## Perfection Loop

### Loop 1 — RED

E-01…E-03 cataloged. **Exit: all issues cataloged.**

### Loop 1 — GREEN

Two-part fix documented. **Exit: fixes documented.**

### Loop 1 — AUDIT (planning)

- **Law 4:** `expireMessages` callers are `step.ts:84/119/280` and `loop.ts:209/249`. The fast-path returns the same array only when nothing expires; every caller treats the result as read-only or reassigns `messageHistory` (appends use spread copies, never in-place mutation). `buildArray` does not mutate its inputs.
- **Verification plan:** `bun run --cwd=common typecheck`, `bun run --cwd=packages/agent-runtime typecheck`, full agent-runtime suite (963 tests), plus `spawn-agents-message-history.test.ts` (expiry semantics) and the loop suites.
- **AUDIT passes (planning) → SELF-CORRECT (none) → COMPLETE (pending operator approval to implement).**

### Missed Questions

1. **Is returning the input array (aliasing) safe?** Yes — callers reassign `messageHistory` and append via spread copies; no caller mutates the returned array in place. The `buildArray` removal does not change mutation behavior.
2. **Does `buildArray`'s falsey-filter do anything else?** No — it only removes `false` from `stepPrompt && …`; the conditional append handles that case exactly.
3. **Is the end-of-step `expireMessages` (E-03) avoidable?** Only by tracking the pre-append length and slicing, which is still O(n) and more fragile; left as the one necessary per-step pass. The structural (mutable-array) alternative is raised separately.

## Resolution

Implemented 2026-08-15 (operator approved). Verification: `bun run --cwd=packages/agent-runtime typecheck` exit 0; full agent-runtime suite 963 pass / 0 fail (incl. `spawn-agents-message-history.test.ts`, loop suites, `run-agent-step-prefill.test.ts`); ESLint `--max-warnings 0` on both changed files. Law-4 grep: `expireMessages` callers are `loop.ts:209,249`, `step.ts:80,120,282` — all reassign `messageHistory` or spread-copy; none mutate the returned array in place.
