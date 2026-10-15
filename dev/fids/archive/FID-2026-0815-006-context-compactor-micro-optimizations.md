<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: Context compactor micro-optimizations

**Filename:** `FID-2026-0815-006-context-compactor-micro-optimizations.md`
**ID:** FID-2026-0815-006
**Severity:** low
**Status:** closed
**Created:** 2026-08-15
**YAGNI-Compliance:** Verified — no new store/authority; converts O(n²) scans
to O(n) and removes a defensive copy. Reuses existing logic (Law 13).

**Parent:** FID-2026-0815-002 (findings F-06, F-07, F-08)

---

## Summary

The `ContextCompactor` has three micro-inefficiencies. Two are quadratic scans
on the message history; one is a defensive object copy on every `getThresholds()`
call (invoked once per step from the token-count path). None is a correctness
defect — they are constant-factor / asymptotic waste on a per-step or
emergency-path surface.

## RED — Issue catalog

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| E-01 | low | `reactiveCompact` performs three full `messages.filter(...)` passes (images, preserved-state, critical-context), then `messages.indexOf(imgMsg)` inside a loop over `imageMessages` (O(n·m) → O(n²)), and `lastMessages.includes(msg)` inside a `.filter()` over `reAddedPreserved` (O(n·k)). | `packages/agent-runtime/src/context-compactor.ts` — `reactiveCompact`: `imageMessages`/`preservedStateMessages`/`criticalMessages` `filter`s, `messages.indexOf(...)` loop, `reAddedPreserved = [...].filter((msg, idx, arr) => arr.indexOf(msg) === idx && ... && !lastMessages.includes(msg))` |
| E-02 | low | `microCompact` computes `keepRecent.includes(idx)` inside a `toolResultIndices.filter(...)` — O(n·k) membership test where a `Set` lookup is O(1). | `context-compactor.ts` — `microCompact`: `const clearSet = new Set(toolResultIndices.filter((idx) => !keepRecent.includes(idx)))` |
| E-03 | low | `getThresholds()` returns `{ ...this.thresholds }` — a fresh spread on every call, called once per step from the token-count path. `this.thresholds` is assigned once in the constructor and never mutated. | `context-compactor.ts` — `getThresholds(): Thresholds { return { ...this.thresholds } }`; consumers `run-agent-step/context-tokens.ts` / `loop-context.ts` read only |

## GREEN — Proposed fix (converged)

1. **E-01:** single-pass `reactiveCompact` rewrite — one forward walk builds (a)
   the set of preserved indices and (b) the ordered `imageMessages` /
   `preservedStateMessages` / `criticalMessages` lists, eliminating the repeated
   `indexOf` scans. Use a `Set` for last-20% membership so the
   `reAddedPreserved` dedupe is O(1) per element. Preserve the exact current
   output ordering (`firstMessage`, 10% middle, re-added preserved, last 20%)
   and the token-estimate / logging contract.
2. **E-02:** build `keepRecentSet = new Set(keepRecent)` once, then
   `toolResultIndices.filter((idx) => !keepRecentSet.has(idx))` — O(n).
3. **E-03:** return `this.thresholds` directly (or a frozen reference) instead
   of a fresh spread. `this.thresholds` is immutable after construction; the
   single-source-of-truth (Law 13) is the compactor's own field.

**Net:** reactiveCompact O(n²) → O(n); microCompact O(n·k) → O(n); zero
allocation on `getThresholds()`. No observable behavior change.

## Perfection Loop

### Loop 1 — RED

E-01…E-03 cataloged with `file:line`-anchored evidence. **Exit: all issues
cataloged.**

### Loop 1 — GREEN

Three-part fix documented, with explicit preservation of output ordering and
contracts. **Exit: fixes documented.**

### Loop 1 — AUDIT (planning)

- **Law 4:** `getThresholds` consumers are `context-tokens.ts` (reads
  `reactiveCompact`), `loop-context.ts`, and `context-compactor.test.ts` — all
  read-only; returning the internal reference is safe only if no consumer
  mutates it. Verification: grep all consumers for writes to the returned
  object; if any mutation exists, freeze instead of aliasing.
- **Behavior-preservation check:** `reactiveCompact` output ordering and the
  `tokensSaved`/`messagesRemoved` arithmetic are asserted by the existing
  `context-compactor.test.ts` + `context-compactor-micro.test.ts` — those suites
  become the regression net (plus any new assertions for ordering).
- **Verification plan:** `bun run --cwd=packages/agent-runtime typecheck`;
  `bun test src/context-compactor*.test.ts` + full agent-runtime suite; ESLint
  `--max-warnings 0`; Prettier.
- **AUDIT passes (planning) → SELF-CORRECT (none) → COMPLETE (pending operator
  approval to implement).**

### Missed Questions

1. **Is `reactiveCompact` hot enough to matter?** It is the rare emergency
   path, but the operator directive makes nothing out of scope; the change is
   behavior-neutral and removes real quadratic scans.
2. **Does aliasing `this.thresholds` risk a caller mutating shared state?** The
   audit grep answers this before implementation — freeze if any mutation
   exists, alias otherwise.
3. **Could the single-pass rewrite change which messages survive?** No — the
   preserved-set construction is order-independent; only the algorithm changes,
   not the membership.

## Resolution

Implemented 2026-08-15 (operator approved). `reactiveCompact` rewritten as a
single forward walk (preserved-index set + ordered image/preserved-state/
critical lists) with Set-based dedupe and last-20% exclusion;
`microCompact` uses `keepRecentSet` (Set) for the keep-recent test;
`getThresholds()` returns the immutable `this.thresholds` reference (Law-4
grep: consumers `context-tokens.ts:146`, `loop-context.ts:349`, test suites
all read-only — no mutation). Also corrected the stale header comment
(`context-compactor.ts:11-13`) that mis-described this file as a re-export shim
(Nova's initial "citation gap" was caused by that comment; Nova retracted the
flag — see the planning verdict).

Verification: agent-runtime typecheck exit 0; full suite 964 pass / 0 fail
(incl. `context-compactor.test.ts` + `context-compactor-micro.test.ts` 17/0);
ESLint `--max-warnings 0`. Post-change locations: `getThresholds`
`context-compactor.ts:162`, `microCompact` keep-recent Set `:221-223`,
`reactiveCompact` single-pass `:352`+ (walk at `:369`).
