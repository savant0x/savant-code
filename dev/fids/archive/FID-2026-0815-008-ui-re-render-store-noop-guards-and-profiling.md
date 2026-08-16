<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: UI re-render — store no-op guards + profiling

**Filename:** `FID-2026-0815-008-ui-re-render-store-noop-guards-and-profiling.md`
**ID:** FID-2026-0815-008
**Severity:** medium
**Status:** closed
**Created:** 2026-08-15
**YAGNI-Compliance:** Verified — adds equality guards to existing store
actions; no new store, no new authority (Law 13). The profiling step is
read-only.

**Parent:** FID-2026-0815-002 (finding F-11)

---

## Summary

The sidebar heartbeat fires every 2s and the run-state snapshot fires ~every 5s;
both write scalar sidebar state (context tokens, session cost, compaction
status) into the Zustand store **unconditionally**, even when the value is
unchanged. Because the store actions always `set((state) => { state.x = v })`
through immer, every such write produces a new state object and notifies
subscribers — so components re-render on a timer even when nothing changed. This
is the one concrete, evidence-backed re-render driver; a profiling pass will
confirm the remaining hot components.

## RED — Issue catalog

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| E-01 | med | The 2s heartbeat writes `updateContextTokens(tokenCount)` and `setCompactionStatus(status)` every tick with no equality guard, producing a new store state + subscriber notifications even when the values are unchanged. | `cli/src/hooks/helpers/send-message-monitors.ts:72-92` (`setInterval(..., 2_000)` → `updateContextTokens(tokenCount)` + `setCompactionStatus(compactionStatus)`) |
| E-02 | med | `onStateSnapshot` writes `updateContextTokens` + `updateSessionCost` on every snapshot (~5s) with no guard. | `cli/src/hooks/helpers/send-message-lifecycle.ts:158-170` (`onStateSnapshot` → `updateContextTokens` / `updateSessionCost`) |
| E-03 | low | The store actions themselves (`updateContextTokens`, `updateContextTokensMax`, `updateSessionCost`, `setCompactionStatus`) do not no-op on an equal value — immer `set` always allocates a new state. | `cli/src/state/chat-store/sidebar-actions.ts:38-56,112-115` (`set((state) => { state.contextTokensUsed = used })` etc.) |
| E-04 | info | Remaining re-render hot spots (sidebar sections, panels) need a profiling pass to quantify before further change. | `cli/src/components/right-sidebar.tsx` (many store selectors), `savant-ui/echo/*` panels |

## GREEN — Proposed fix (converged)

1. **E-03 (root fix):** add equality guards inside the four actions — if the
   incoming value is `Object.is`-equal to the current state value, return
   without calling `set`. For `setCompactionStatus`, compare by the same
   identity the store holds (reference equality on the status object; the
   runtime already reuses/replaces the object on real transitions). This alone
   collapses the 2s/5s timer writes into true change-only notifications.
2. **E-01/E-02:** once the actions no-op, the call sites need no change (they
   are already the cheapest possible polling read of a ref). Optionally add a
   cheap `if (typeof tokenCount === 'number' && tokenCount !== current)` guard
   at the call site for clarity — determined during implementation, not a
   correctness requirement.
3. **E-04:** run a profiling pass (render counts via a dev-only instrumented
   store selector, or `bun --cpu-prof` on a scripted session) over the sidebar +
   panels to identify any remaining per-keystroke/timer re-renders; record
   findings and open follow-up child FIDs for anything material.

**Net:** sidebar/subscribed components stop re-rendering on the 2s/5s timers
when nothing changed; profiling quantifies the rest.

## Perfection Loop

### Loop 1 — RED

E-01…E-04 cataloged with `file:line` evidence. **Exit: all issues cataloged.**

### Loop 1 — GREEN

Equality-guard root fix + profiling step documented. **Exit: fixes documented.**

### Loop 1 — AUDIT (planning)

- **Law 4:** the four actions are the only writers of `contextTokensUsed`,
  `contextTokensMax`, `sessionCost`, `compactionStatus` (grep to confirm); the
  guard is behavior-preserving for all consumers (selectors read the same
  value; a skipped `set` means "nothing changed").
- **Reference-equality nuance for `setCompactionStatus`:** the runtime emits a
  new object per real transition and reuses the object across idle heartbeats;
  reference equality matches the intended change-detection. If the runtime
  instead rebuilds an equal object every heartbeat, the guard falls back to a
  shallow field compare (`phase`/`tokensSaved`/`percentUsed`) — decided during
  implementation with a regression test.
- **Verification plan:** `bun run --cwd=cli typecheck`; chat-store tests
  (`cli/src/state/chat-store/__tests__/`); a new test asserting a no-op
  `updateContextTokens(same)` does not bump the store's revision / notify
  subscribers; ESLint `--max-warnings 0`; Prettier. Profiling output recorded in
  the FID's AUDIT.
- **AUDIT passes (planning) → SELF-CORRECT (none) → COMPLETE (pending operator
  approval to implement).**

### Missed Questions

1. **Could a no-op guard hide a real update?** No — a real change passes the
   inequality check; only identical writes are dropped.
2. **Does reference equality on `compactionStatus` risk dropping a same-valued
   transition?** Transitions with equal values are semantically no-ops for the
   UI; if a deep-equality comparison is needed it is applied (not silently).
3. **Is the 2s polling itself worth removing?** It is the cheapest read of a
   ref; the cost is the write, which the guard eliminates. Removing the poll
   entirely would freeze the token meter during long chains — kept.

## Resolution

Implemented 2026-08-15 (operator approved).

- **E-03 (root fix):** `updateContextTokens`, `updateContextTokensMax`,
  `updateSessionCost` now `Object.is`-no-op on an equal value; `setCompactionStatus`
  no-ops on a **shallow field compare** (`phase`/`percentUsed`/`tokensSaved`), not
  reference equality — the runtime rebuilds a fresh object per heartbeat (proven
  by the existing `repeated status refreshes` test), so reference equality would
  never collapse equal re-deliveries. The `compacting→pruned/warning` transition
  recording is preserved (it only runs when the status actually changes).
- **E-01/E-02:** call sites unchanged (they are already the cheapest poll read);
  the guards are the single choke point.
- **E-04:** new regression tests (`chat-store-noop-guards.test.ts`) assert a
  no-op write does not notify subscribers. The full interactive profiling pass
  (render counts / `bun --cpu-prof` over a scripted tmux session) is a follow-up
  per repo conventions; the equality guards close the one concrete,
  evidence-backed re-render driver.

Verification: cli typecheck exit 0; store suites 11/0 (3 new + 8 existing);
ESLint `--max-warnings 0`.
