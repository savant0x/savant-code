<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: Eager `messagesWithStepPrompt` history copy computed and discarded on the local-estimation path

**Filename:** `FID-2026-0815-013-messages-with-step-prompt-eager-copy.md`
**ID:** FID-2026-0815-013
**Severity:** low
**Status:** closed
**Created:** 2026-08-15
**YAGNI-Compliance:** Verified — moves an existing expression to its only consumer;
no new store, no new authority (Law 13). Behavior-preserving.

**Parent:** none (follow-on scan after FID-2026-0815-012 closed)

---

## Summary

`prepareStepContext` builds `messagesWithStepPrompt` on **every step** by
spreading the entire message history through `buildArray`, which recursively
collects every message and then filters it — an O(history) walk plus a fresh
`userMessage` allocation per step. The resulting array is consumed in exactly
one place: the `else` branch that calls the paid hosted `callTokenCountAPI`.
The default local-estimation path (`shouldUseLocalTokenCount` →
`estimateContextTokensLocally`) never reads it, so the copy is built and
discarded every step on the common path — the same class as FID-2026-0815-001's
"eagerly compute unused placeholder" finding.

## Environment

- **OS:** Windows (dev), cross-platform runtime
- **Language/Runtime:** TypeScript / Bun (repo-pinned `1.3.14`)
- **Commit/State:** uncommitted working tree on `main` (0.0.24 work in progress)

## Detailed Description

### Problem

Every agent step, `prepareStepContext` builds a full-history array
(`messagesWithStepPrompt`) that the local token-estimation path never uses.

### Root Cause

The array is constructed unconditionally at the top of `prepareStepContext`
(`context-tokens.ts:69`) but consumed only inside the hosted-API branch
(`context-tokens.ts:117`). The local path computes its estimate from
`countTokensMessagesCached(agentState.messageHistory)` directly, so the eager
copy is wasted work on that path.

### Evidence

```text
$ grep -n "messagesWithStepPrompt\|buildArray\|shouldUseLocalTokenCount\|estimateContextTokensLocally()\|callTokenCountAPI" packages/agent-runtime/src/run-agent-step/context-tokens.ts
2:import { buildArray } from '@savant-code/common/util/array'
69:  const messagesWithStepPrompt = buildArray(
107:    shouldUseLocalTokenCount({
113:    agentState.contextTokenCount = estimateContextTokensLocally()
116:    const tokenCountResult = await callTokenCountAPI({
117:      messages: messagesWithStepPrompt as JSONValue[],

$ grep -n "export function buildArray" common/src/util/array.ts
14:export function buildArray<T>(...params: FalseyValueArray<T>[]): T[] {
```

`buildArray` (`common/src/util/array.ts:14`) calls `collectValues`, which
recurses through `messageHistory` pushing each element, then `.filter(isNotFalsey)`
over the result — an O(history) recursive walk plus an allocation. `stepPrompt &&
userMessage({ content: stepPrompt })` also allocates a new message per step.

### Expected Behavior

The history copy should only be built on the path that consumes it.

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/run-agent-step/context-tokens.ts`

### Risk Level

- [x] Low: pure move of an existing expression; no behavior change

## Proposed Solution

### Approach

Move the `buildArray(...)` construction (and its `userMessage` allocation) from
the top of `prepareStepContext` into the `else` branch, immediately before the
`callTokenCountAPI` call. The local-estimation path then never builds it.

### Steps

1. Remove the `const messagesWithStepPrompt = buildArray(...)` block from
   `context-tokens.ts:69`.
2. Add the same construction inside the `else` branch, before
   `callTokenCountAPI({ ... })`.
3. Verify `buildArray`/`userMessage` imports remain used (they will — still
   referenced in the `else` branch).

### Verification

- `bun run --cwd=packages/agent-runtime typecheck`
- agent-runtime full suite
- `bun x eslint --max-warnings 0` on the changed file; Prettier
- Law-4 grep: confirm `messagesWithStepPrompt` has exactly one consumer
  (`context-tokens.ts` `callTokenCountAPI`), and the local path no longer
  references it.

## Perfection Loop

### Loop 1 — RED

One finding cataloged with grep-verified `file:line` evidence (above): the
eager, discarded history copy on the local-estimation path. **Exit: all issues
cataloged.**

### Loop 1 — GREEN

Minimal fix documented (move the expression to its sole consumer). **Exit: fix
documented.**

### Loop 1 — AUDIT (planning)

- **Law 4 (grep-verified):** `messagesWithStepPrompt` is referenced at exactly
  two lines — the declaration (`context-tokens.ts:69`) and the consumer
  (`context-tokens.ts:117`). The local path (`:113`) uses
  `estimateContextTokensLocally`, which reads `countTokensMessagesCached(
  agentState.messageHistory)` + `countTokens(stepPrompt)` + `systemTokens` +
  `countTokensJsonCached(toolsForTokenCount)` — never `messagesWithStepPrompt`.
- **Behavior preservation:** the `else` branch receives an identical array (same
  `buildArray` call, same `stepPrompt`, same `messageHistory`); the local path's
  output is unchanged. No observable difference.
- **Verification plan:** agent-runtime typecheck + full suite; ESLint
  `--max-warnings 0`; Prettier; Law-4 grep.
- **AUDIT passes (planning) → COMPLETE (converged — present for approval, no
  code written yet).**

### Missed Questions

1. **Could `messagesWithStepPrompt` be needed before the `if/else`?** No — grep
   shows only the `:117` consumer, inside the `else`.
2. **Does `buildArray` differ from a plain spread?** It recursively flattens and
   filters falsey values; preserving the exact call preserves the exact array
   shape the API receives. Moving it verbatim is the safe choice.
3. **Is `stepPrompt` still computed for the local path?** Yes — `stepPrompt` is
   needed by `estimateContextTokensLocally` (`countTokens(stepPrompt ?? '')`).
   Only the `buildArray` wrapping moves; `stepPrompt` itself stays computed once.
4. **Any test asserting the eager build?** None — tests exercise the token-count
   result, not the intermediate array construction (to be confirmed at
   implementation time by running the suite).

## Resolution

Implemented under operator approval (2026-08-15).

- The `buildArray(...)`/`userMessage(...)` construction moved from
  `context-tokens.ts:69` into the `else` (hosted-API) branch, immediately
  before `callTokenCountAPI` (`context-tokens.ts:111`). The default
  local-estimation path no longer builds the full-history array each step.

**Verification (all exit 0):** agent-runtime typecheck; agent-runtime full
suite **966/0**; ESLint `--max-warnings 0`; Prettier. Law-4 grep:
`messagesWithStepPrompt` now declared at `:111` and consumed at `:119` (single
consumer, inside the `else`); `buildArray`/`userMessage` imports remain used.

Closed and archived. No commit, push, release, publication, or deployment.
