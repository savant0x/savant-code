# FID: Context meter resets to 0/1,000,000 mid-session and on every boot

**Filename:** FID-2026-1009-002-context-meter-resets-to-zero-mid-session.md
**ID:** FID-2026-1009-002
**Severity:** medium
**Status:** closed
**Created:** 2026-10-09
**Automation level:** 2
**YAGNI-Compliance:** Verified

---

## Summary
The sidebar context meter ("used / cap") resets to `0/1,000,000` randomly
between turns and on every boot: the used-count drops to zero while the cap
stays at the model's resolved window, and the meter stays wrong until the next
run's first step recomputes the count. Two independent defects: the readout is
never seeded from the restored chat at boot, and any non-positive runtime
reading wipes an established count exactly by design.

## Environment

- **OS:** Windows (win32), Git Bash
- **Language/Runtime:** TypeScript, Bun 1.3.14
- **Tool Versions:** `tsc --noEmit`, `eslint` (`--max-warnings 0`)
- **Commit/State:** committed locally as `f56020b7` (combined with
  FID-2026-1009-001/-003); closed and archived 2026-10-09

## Detailed Description

### Problem

Two defects produce the operator-reported symptom ("it keeps getting reset to
0/1,000,000 … happening randomly between turns"):

1. **Boot (every boot):** `contextTokensUsed` initializes to `0`
   (`cli/src/state/chat-store/initial-state.ts`) and nothing seeds it from the
   restored chat. `use-chat-bootstrap` seeds only the *cap* (from the resolved
   model window); the restored chat's persisted
   `mainAgentState.contextTokenCount` — which survives resume via
   `resolveSessionState` → `applyOverridesToSessionState` — is never read into
   the sidebar. The meter reads `0/1,000,000` until the first run's first step
   recomputes the count.

2. **Mid-session (randomly between turns):** `dampTokenCount`
   (`cli/src/state/chat-store/compaction-helpers.ts`) adopts ANY incoming
   ≤ `CONTEXT_TOKEN_SMALL_COUNT_FLOOR` (10,000) **exactly — including 0** —
   bypassing the ±5% deadband and the 12% ramp. The floor was introduced by
   FID-2026-0827-001 to fix the opposite problem (early-session counts pinned
   near zero on a 1M window); it opened the door for a non-positive reading to
   wipe an established count in one step. All three writers (the 2s heartbeat
   in `send-message-monitors`, the ~5s `onStateSnapshot`, and the run-end
   `adoptAndPersist`) feed `mainAgentState.contextTokenCount` through
   `updateContextTokens`, so one spurious 0 zeroes the meter — and the run-end
   writer makes the zero persist until the next run recomputes.

### Expected Behavior
The meter shows the real context count continuously: the restored chat's count
at boot, and a tracked value during and between runs that never collapses to 0
unless the context is genuinely empty.

### Root Cause

- **Display layer:** the small-count floor has no non-positive guard — a 0 is
  adopted exactly whenever the runtime delivers it.
- **Runtime layer:** `reconcileTokenCount`
  (`packages/agent-runtime/src/run-agent-step/reconcile-token-count.ts`)
  prefers `agentState.lastProviderUsage` whenever
  `capturedAt > lastPrunerCompletionAt`, without checking the value. The
  upstream usage shape is `inputTokens?: number`
  (`packages/agent-runtime/src/provider-boundary/identity-observation.ts`) —
  some provider streams finalize with 0 or an unset input-token count. A 0
  then stands as "provider truth" for the step: the meter wipes AND
  `shouldAutoCompact` / `percentUsed` see an empty context, silently disabling
  proactive compaction until the next step's estimator.

### Evidence

- `cli/src/state/chat-store/compaction-helpers.ts` — `dampTokenCount`:
  `if (current <= 0 || incoming <= CONTEXT_TOKEN_SMALL_COUNT_FLOOR) return incoming`
  (floor 10,000, FID-2026-0827-001).
- Writers (all guarded only by `typeof tokenCount === 'number'`, so a 0
  passes): `send-message-monitors.ts` heartbeat, `send-message-lifecycle.ts`
  `onStateSnapshot` + `adoptAndPersist`. `resetSidebarData`/`resetSidebarSlice`
  zero BOTH used and max — ruled out (the operator sees max intact at 1M);
  `resetSidebarData` also has no production callers (dead action).
- `reconcile-token-count.ts` —
  `choseProviderUsage = Boolean(usage && usage.capturedAt > lastCompactionAt)`;
  `result = choseProviderUsage && usage ? usage.inputTokens : localEstimate`.
- `packages/agent-runtime/src/run-agent-step/step.ts` —
  `agentState.lastProviderUsage = { inputTokens: usage.inputTokens, capturedAt: Date.now() }`
  from the stream `onUsage`.
- Boot seam: `use-send-message.ts`'s continueChat effect loads
  `loadedState.runState` but never reads
  `sessionState.mainAgentState.contextTokenCount`; `use-chat-bootstrap.ts`
  seeds only `updateContextTokensMax`.
- **Error run states verified SAFE (not a defect):** `createErrorRunStateFrom`
  omits `sessionState` entirely (the CLI's `typeof` guard skips the write);
  `getCancelledRunState` / `buildMainPromptErrorRunState` clone the LIVE
  session state (`cloneSessionState` is a JSON round-trip and
  `contextTokenCount` is a plain number that survives it); `adoptAndPersist`
  is only reached for non-error run states.
- **`/new` seam:** `commands/defs/chat.ts`'s `/new` → `params.clearMessages()`
  nulls `previousRunStateRef` + runState but never resets the sidebar — today
  the meter zeroes on `/new` only because the next run's run-start snapshot
  delivers the fresh session state's 0, which the old floor adopted. Layer 1's
  guard removes that accidental zeroing, so `/new` needs an explicit companion
  reset or the previous chat's count strands in the meter.

## Impact Assessment

### Affected Components

- `cli/src/state/chat-store/compaction-helpers.ts` (display damping)
- `cli/src/state/chat-store/sidebar-actions.ts`, `sidebar-reset.ts`,
  `chat-store-actions.ts` (`/new` reset action)
- `cli/src/hooks/use-send-message.ts` (boot seeding + `/new` companion)
- `cli/src/utils/run-state-storage/load.ts`, `run-state-storage.ts`
  (restored-count helper)
- `packages/agent-runtime/src/run-agent-step/reconcile-token-count.ts`
  (provider-usage positivity guard)

### Risk Level

- [x] Medium: Feature degraded, workaround exists (ignore the meter — the
      runtime's own count still drives compaction honestly once Layer 3 lands)

## Proposed Solution

### Approach

Three layers (operator-approved 2026-10-09), plus the `/new` companion:

1. **Display guard (CLI):** `dampTokenCount` treats a non-positive incoming as
   "no reading" — hold the current value. The positive small-count floor
   (FID-2026-0827-001) is preserved for genuine early counts.
2. **Boot seeding (CLI):** the continueChat effect seeds `updateContextTokens`
   from the restored chat's persisted count.
3. **Runtime guard (agent-runtime):** `reconcileTokenCount` requires a
   positive provider `inputTokens` before provider truth wins; a 0/unset
   count falls back to the local estimate, keeping the count — and the
   compaction gates — honest.
4. **`/new` companion:** a focused `resetContextTokens` store action (zeroes
   the used-count only; the cap is owned by the resolved model window and
   survives a chat clear) wired into `clearMessages`.

### Steps

1. `dampTokenCount`: add a non-positive guard ahead of the existing branches.
2. `load.ts`: add `readRestoredContextTokenCount(runState)` (positive number
   or null); export via the storage barrel.
3. `use-send-message.ts`: destructure `updateContextTokens` /
   `resetContextTokens`; seed the restored count in the continueChat effect;
   reset the meter in `clearMessages`.
4. `sidebar-reset.ts`: `resetContextTokensUsed(state)`; `sidebar-actions.ts`:
   one-line action; `chat-store-actions.ts`: type + `SidebarActionKeys`.
5. `reconcile-token-count.ts`: positivity guard on the provider usage.
6. Tests: damping pins (0 suppressed, floor preserved, deadband/ramp
   preserved), restored-count helper pins, reset-action pins (used zeroed,
   cap preserved), reconcile additions (0/undefined usage falls back).
7. Full gate set.

### Verification

Typecheck (cli + agent-runtime), the four test files, and the quality report —
declared below.

## Verification Gates

- gate: typecheck cli
- gate: typecheck packages/agent-runtime
- gate: test cli/src/state/chat-store/__tests__/context-token-damping.test.ts
- gate: test cli/src/state/chat-store/__tests__/context-token-reset.test.ts
- gate: test cli/src/utils/__tests__/restored-context-token-count.test.ts
- gate: test packages/agent-runtime/src/__tests__/reconcile-token-count.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:ec4fd955f162525aaa1178cc2196b36f3c60234894d641b8cfcf12ec0b9b4e21
- verified: 2026-10-09T16:03:28.660Z
- typecheck cli: exit 0
- typecheck packages/agent-runtime: exit 0
- test cli/src/state/chat-store/__tests__/context-token-damping.test.ts: exit 0
- test cli/src/state/chat-store/__tests__/context-token-reset.test.ts: exit 0
- test cli/src/utils/__tests__/restored-context-token-count.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/reconcile-token-count.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** (1) Boot never seeds `contextTokensUsed` from the restored chat.
  (2) `dampTokenCount` adopts any incoming ≤ 10,000 — including 0 — exactly,
  so a non-positive runtime reading wipes an established count mid-session.
  (3) `reconcileTokenCount` prefers a provider usage without a positivity
  check, so a 0/unset `inputTokens` stands as truth for the step.
  (4) `/new` relies on the (now-guarded) run-start 0-snapshot to zero the
  meter.
- **GREEN:** non-positive suppression in `dampTokenCount`; boot seeding from
  the restored session; provider-usage positivity guard; focused
  `resetContextTokens` action wired into `clearMessages`.
- **AUDIT:** independent Verifier pass over the four write sites + four test
  files; call-graph reachability for the new action and the seeding path.
- **ADVERSARIAL:** Would the guard strand a legitimately small count? No —
  only non-positive values are suppressed; the FID-2026-0827-001 small-count
  floor is pinned by test. Would `/new` regress? No — the companion reset
  preserves today's 0/1,000,000 display with the cap intact. Does the
  reconcile guard hide a real 0-token request? No — a real LLM request always
  has input tokens; 0/unset is "no reading".
- **CHANGE DELTA:** n/a (converged, implementation lands with this pass)

### Missed Questions

1. **Why not change the SDK snapshot emitter's immediate run-start emit?**
   Evidence check: the immediate emit delivers the resumed session's real
   count for continued chats and 0 for genuinely fresh ones (truthful). With
   the display guard a fresh-chat 0 is a visual no-op (the meter starts at 0).
   Changing checkpoint timing would trade crash-safety for nothing; the real
   spurious-0 source was the reconcile, fixed in Layer 3.
2. **Why not reset the whole sidebar on `/new` (`resetSidebarData`)?** It
   zeroes the cap too (the meter falls back to the plain readout until the
   next run) and clears session stats (tools/cost/compaction) beyond this
   FID's mandate. The focused action keeps `/new`'s displayed state identical
   to today (0/1,000,000) with no collateral change.
3. **Is a provider-reported 0 `inputTokens` ever legitimate?** No real LLM
   request has zero input tokens (there is always a prompt). Providers that
   do not populate the field report 0 or omit it; both are "no reading".

## Resolution

- **Closed Date:** 2026-10-09
- **Fix Description:** Three layers, all implemented and verified.
  Layer 1 (`cli/src/state/chat-store/compaction-helpers.ts`): `dampTokenCount`
  now returns `current` for a non-positive `incoming` — a 0 is "no reading"
  and can never wipe an established count. The FID-2026-0827-001 positive
  small-count floor, the ±5% deadband, and the 12% ramp are preserved.
  Layer 2 (`cli/src/hooks/use-send-message.ts` +
  `cli/src/utils/run-state-storage/load.ts`): the continueChat effect seeds
  `updateContextTokens` from the restored chat's persisted
  `mainAgentState.contextTokenCount` via the new `readRestoredContextTokenCount`
  helper (exported through the `run-state-storage` barrel), so a resumed chat
  shows its real count at boot instead of 0/1,000,000. Layer 3
  (`packages/agent-runtime/src/run-agent-step/reconcile-token-count.ts`):
  provider usage wins the reconcile only when `inputTokens` is a real positive
  number; a 0/unset count falls back to the local estimate, keeping the meter
  and the compaction gates honest. `/new` companion: the focused
  `resetContextTokens` store action (`resetContextTokensUsed` in
  `sidebar-reset.ts`, one-line call site in `sidebar-actions.ts`, type +
  `SidebarActionKeys` in `chat-store-actions.ts`) is wired into
  `clearMessages` — `/new` still shows 0/1,000,000 with the cap intact.
- **Tests Added:** four files, 26 pins, all green —
  `cli/src/state/chat-store/__tests__/context-token-damping.test.ts` (8: 0 and
  negative suppressed while established, floor/deadband/ramp preserved),
  `cli/src/state/chat-store/__tests__/context-token-reset.test.ts` (3: used
  zeroed, cap preserved, re-seedable),
  `cli/src/utils/__tests__/restored-context-token-count.test.ts` (5: positive
  count returned; missing/non-number/non-positive → null),
  `packages/agent-runtime/src/__tests__/reconcile-token-count.test.ts` (+3
  cases: 0 / undefined / negative provider inputTokens falls back to the
  estimate).
- **Verification Evidence:** all green on the final tree —
  `quality: PASS (1498 baselined files)`; `typecheck cli` exit 0;
  `typecheck packages/agent-runtime` exit 0; `bun test` 26 pass / 0 fail across
  the 4 files; `eslint --max-warnings 0` clean on all 12 touched files;
  `prettier --check` clean across all 14 touched files; `sidebar-actions.ts`
  at 298 lines (under the 300 ceiling after the extraction to
  `sidebar-reset.ts`, now 201). Call-graph reachability: `resetContextTokens`
  is called from `clearMessages` (`use-send-message.ts`), which is invoked by
  the `/new` command (`commands/defs/chat.ts`); the boot seeding runs in the
  continueChat effect of `use-send-message.ts`.
- **Archived:** 2026-10-09 — moved to `dev/fids/archive/` on the
  operator's closure authorization (implementation commit `f56020b7`,
  combined with FID-2026-1009-001/-003); register entry evicted from
  `SCOPE.md`; CHANGELOG entry appended under 0.0.35 `### Fixed`.

### Code Verification Evidence

Status is `closed` — receipt stamped by `fid:verify --write` on the
verified content (the pre-closure fingerprint is prescribed for closed
records); all seven declared gates passed on the final tree;
implementation commit `f56020b7`.