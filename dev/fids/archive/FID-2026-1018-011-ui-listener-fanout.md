# FID: Bound shared UI event subscriptions

**Filename:** `FID-2026-1018-011-ui-listener-fanout.md`
**ID:** FID-2026-1018-011
**Severity:** medium
**Status:** closed
**Created:** 2026-10-18 22:15
**Automation level:** 3
**YAGNI-Compliance:** Verified

## Summary

LIVE-004 records resize, focus, blur and scrollbar change listener warnings.
Each mounted animation budget independently subscribes to the same renderer
and ancestor scrollbar. Bound native subscriptions by sharing event dispatch
at the existing hook seams, preserving per-consumer cleanup and updates.

## Environment

- **OS:** Windows
- **Language/Runtime:** TypeScript, Bun 1.3.14, OpenTUI 0.5.3
- **Commit/State:** e26b9ab230f8ebf1df543d819bf0d48a914f0ea4

## Detailed Description

### Problem and evidence

debug/cli.jsonl:2090 records 11 resize listeners; lines 2105 and 2127 record
11 scrollbar change listeners; lines 2125-2126 record 11 focus/blur listeners.
The first warning predates the picker open, so picker-driven leaking is not
established. use-animation-budget.ts:99-103 registers three renderer listeners
per mounted budget and lines 129-130 attach two listeners per scroll ancestor.
Cleanup at lines 136-145 is present: high concurrent subscriptions can produce
the warning without retained listeners after unmount.

### Expected Behavior

Any number of mounted consumers share one native listener per target/event;
unsubscribe the native listener when its final subscriber leaves. Resize must
update both dimensions, blur/focus must retain animation throttling, and
scroll/layout changes must retain visibility-based suspension.

### Root Cause

Repeated hooks duplicate target/event registrations. OpenTUI's dimension and
focus hooks register directly per component. Animation budgets add the same
scrollbar event for every animated child under a shared scrollbox.

## Impact Assessment

Shared lifecycle change at three production seams: dimensions, focus/blur,
and animation scrollbar observation. No global listener-limit increase.

## Proposed Solution

1. Add a small subscribeSharedEvent utility using a WeakMap keyed by emitter,
   then event name, then independent subscriber tokens. One dispatch closure
   fans out to current callbacks; cleanup is idempotent and removes the native
   listener on the last unsubscribe.
2. Update useTerminalDimensions to read renderer dimensions on shared resize;
   update animation budget focus/blur and scrollbar subscriptions to reuse it.
3. Test independent duplicate callback lifetimes, large fanout, dispatch and
   cleanup. Add a real render lifecycle test with many animation consumers.

### Verification

cli/src/utils/__tests__/shared-event.test.ts validates native subscription
cardinality, events and final cleanup; cli/src/hooks/__tests__/ui-listeners.render.test.tsx
mounts many consumers, resizes, blurs/focuses and unmounts, checking listener
counts return to baseline. Picker keyboard acceptance will be covered by an
additional integration test, without storing typed filter content in logs.

## Verification Gates

- gate: typecheck cli
- gate: test cli/src/utils/__tests__/shared-event.test.ts
- gate: test cli/src/hooks/__tests__/ui-listeners.render.test.tsx
- gate: test cli/src/components/__tests__/model-picker-scroll.test.tsx
- gate: quality

### Verification Receipt

- fingerprint: sha256:d7ac6711da05535175bc48b14beee86d300da8ca2183e76258c66404f8f39c14
- verified: 2026-10-19T02:44:20.297Z
- typecheck cli: exit 0
- test cli/src/utils/__tests__/shared-event.test.ts: exit 0
- test cli/src/hooks/__tests__/ui-listeners.render.test.tsx: exit 0
- test cli/src/components/__tests__/model-picker-scroll.test.tsx: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED / GREEN

- RED: exact warning timestamps and production registration/cleanup inspected.
- GREEN: bound native event registrations at shared hooks, preserve callbacks.
- AUDIT: plain Set of callbacks would incorrectly merge duplicate subscriptions;
  use a fresh subscription wrapper per call. Cleanup must tolerate repeated calls.
- ADVERSARIAL: snapshot callbacks at event start and check membership before
  invoking each token. This skips removals while postponing additions to the
  next event; a live Set iteration could loop if a callback replaces itself.

### Missed Questions

1. Is this proven to be a leak? No. Record excessive concurrent registration
   separately from retained subscriptions and prove both cardinality/cleanup.
2. Is a global max-listener increase appropriate? No; native fanout should be
   bounded while legitimate consumers retain independent lifetimes.
3. Must dimensions still track height? Yes, resize reads both renderer fields.

### Loop 2 — convergence

Design fits existing emitters and read-only render state. No dependency or
public API change. Verify utility callers with rg after wiring.

## Resolution

### Code Verification Evidence

Shared-event and native render lifecycle suites: 5 pass, 0 fail, 41 assertions.
30 animation consumers retain resize/focus behavior and release listeners over
three real state-driven mount/unmount cycles. CLI typecheck and scoped lint pass.

Implementation and focused verification complete; committed as `106ee6f8`.
No new operator-terminal observation is claimed by the native render tests.

**Closed:** 2026-10-19
**Archived:** 2026-10-19

## Lessons Learned

A listener-limit warning establishes excessive registrations, not a leak;
measure simultaneous cardinality and post-unmount retention independently.
