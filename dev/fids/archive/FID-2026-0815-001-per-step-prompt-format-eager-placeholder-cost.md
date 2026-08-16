<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: Per-step prompt formatting eagerly computes unused placeholders

**Filename:** `FID-2026-0815-001-per-step-prompt-format-eager-placeholder-cost.md`
**ID:** FID-2026-0815-001
**Severity:** low
**Status:** closed
**Created:** 2026-08-15
**YAGNI-Compliance:** Verified — no new store, no new authority. One new helper (`countTokensJsonCached`) memoizes an existing computation and is a special case of the already-established `countTokensMessagesCached` WeakMap pattern (Law 13).

---

## Summary

`formatPrompt` (`packages/agent-runtime/src/templates/strings.ts`) runs on **every agent step** via `prepareStepContext → getAgentPrompt`. It eagerly evaluated all 16 placeholder value providers — including three file-tree walks/truncations (`getProjectFileTreePrompt` at 2.5k / 10k / 190k budgets), a `flattenTree` + system-info build, the git-changes prompt, and the knowledge-files join — then discarded them, because the actual `stepPrompt` templates (`buildImplementationStepPrompt` and siblings in `agents/savant/prompts.ts`) contain **zero** placeholders. Each `replaceAll` on an absent needle is a no-op, so the work was pure waste on every LLM round-trip. Two secondary per-step costs were fixed in the same pass: a per-call `Intl.DateTimeFormat` construction and a per-step `JSON.stringify` of the invariant tool-schema list.

## RED — Issue catalog

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| E-01 | low | `formatPrompt` computed every placeholder value eagerly, then `replaceAll`'d each into `prompt` even when the placeholder was absent. For the per-step stepPrompt (no placeholders) this ran three file-tree truncations + system-info + git-changes + knowledge-files joins every step. | `strings.ts:204-211` (pre-fix loop `for (const varName of placeholderValues) { const value = await valueProvider(); prompt = prompt.replaceAll(varName, value) }`); `strings.ts:141-161` (the three `getProjectFileTreePrompt` providers); stepPrompt templates carry no placeholders (`agents/savant/prompts.ts:56-95`) |
| E-02 | low | `formatCurrentDate` constructed a new `Intl.DateTimeFormat` on every call; formatter construction is expensive and the locale/options are constant. | `strings.ts:50` (pre-fix `new Intl.DateTimeFormat('en-US', …)` inside `formatCurrentDate`) |
| E-03 | low | The local token estimate re-`JSON.stringify`'d the invariant per-loop tool-schema list every step (`countTokensJson(toolsForTokenCount)`). The string is identical each step (tools are built once in `createLoopContext`), so only the `countTokens` LRU lookup was cached — the stringify itself still ran. | `context-tokens.ts:89` (pre-fix `countTokensJson(toolsForTokenCount)`) |

## GREEN — Proposed fix (converged)

1. **E-01:** guard each placeholder provider behind `if (!prompt.includes(varName)) continue` (`strings.ts`), and defer the last-user-input scan + agent-template lookup into lazy accessors consumed only by `USER_INPUT_PROMPT` / `AGENT_NAME` / `MODEL_INFO`. Behavior-preserving: `replaceAll` on an absent needle is a no-op.
2. **E-02:** hoist the `Intl.DateTimeFormat('en-US', …)` into a module-level `CURRENT_DATE_FORMATTER` singleton (`strings.ts`).
3. **E-03:** add `countTokensJsonCached` (`token-counter.ts`) — a `WeakMap<object, number>` memoization keyed by object identity, same contract as the existing `countTokensMessagesCached` — and call it for the invariant `toolsForTokenCount` in `context-tokens.ts`.

**Out of scope:** the `reactiveCompact` O(n²) `indexOf`/`includes` patterns (rare emergency path); `getThresholds()` spread copy; CLI startup / sidebar-render profiling.

## Perfection Loop

### Loop 1 — RED

E-01…E-03 cataloged with `file:line` evidence above. **Exit: all issues cataloged.**

### Loop 1 — GREEN

Three-part fix documented above. **Exit: fixes documented.**

### Loop 1 — AUDIT (double audit, tool output)

**Method 1 (static analysis):**

```text
$ bun run --cwd=packages/agent-runtime typecheck
$ tsc --noEmit -p .        # exit 0

$ bun x eslint packages/agent-runtime/src/templates/strings.ts \
  packages/agent-runtime/src/util/token-counter.ts \
  packages/agent-runtime/src/run-agent-step/context-tokens.ts --max-warnings 0
# exit 0

$ bunx prettier --check <the three files>
# All matched files use Prettier code style!

$ typecheck ×4 (sdk / common / packages/agent-runtime / cli)
# all four: tsc --noEmit, exit 0
```

**Method 2 (manual re-read vs. FID):** re-read the three changed regions. The lazy loop (`strings.ts:204-211`) only invokes a provider when `prompt.includes(varName)`. The lazy accessors (`strings.ts:112-131`) return the same value the removed eager code produced — null agent template yields `'Savant'` for `AGENT_NAME` and `formatFallbackModelInfo(undefined)` for `MODEL_INFO`, identical to before. `countTokensJsonCached` (`token-counter.ts:59-70`) falls through to `countTokensJson` for primitives and is GC-safe (WeakMap keys). `formatCurrentDate` (`strings.ts:51-60`) produces identical output from a singleton formatter.

**Tests (tool output):**

```text
$ bun run --cwd=packages/agent-runtime test
# 963 pass / 0 fail  (2607 expect() calls, 110 files)

$ bun test src/templates/__tests__/strings.test.ts src/util/__tests__/token-counter.test.ts
# 18 pass / 0 fail
```

**Law 4 (call-graph reachability):** `countTokensJsonCached` is defined at `token-counter.ts:59` and has exactly one production consumer, `context-tokens.ts:89` (plus its import at `:11`) — reachable from `prepareStepContext`, which runs every agent step. Not dead code. `CURRENT_DATE_FORMATTER` (`strings.ts:53`) is consumed by `formatCurrentDate` (`:60`); the lazy accessors are consumed by their placeholders.

**AUDIT passes → SELF-CORRECT (none) → COMPLETE.**

### Missed Questions

1. **Could the lazy guard change output when a placeholder value itself contains another placeholder token?** No — values are file trees, dates, and path strings; no provider emits a `{SAVANT_CODE_*}` token, and the loop already replaced in fixed order. Skipping absent needles is equivalent to the prior no-op `replaceAll`.
2. **Is a WeakMap memoization safe if `toolsForTokenCount` mutates mid-run?** The array is built once in `createLoopContext` and treated as read-only thereafter; this is the same accepted drift contract as `countTokensMessagesCached` (documented in `token-counter.ts`). No new risk.
3. **Should the eager providers have been memoized instead of skipped?** Skipping is strictly better: a placeholder-free prompt should do zero work, not cached work. Memoization would still pay the first-step cost for placeholders never used.
4. **Why not also fix `reactiveCompact`'s O(n²) scan?** It is the emergency truncation path (rare, bounded by prompt-too-long errors); recorded as out of scope to keep this change surgical.

### Code Verification Evidence

- [x] Files referenced in Affected Components exist (`strings.ts`, `token-counter.ts`, `context-tokens.ts`)
- [x] Implementation matches the Proposed Solution (verified by re-read above)
- [x] Typecheck/tests/lint pass with pasted tool output (963/0; typecheck ×4 exit 0; ESLint `--max-warnings 0`; Prettier clean)
- [x] Production call-graph evidence present for the new function (one caller, `context-tokens.ts:89`)
- [x] FID status reflects the actual implementation state

## Resolution

- **Closed Date:** 2026-08-15
- **Fix Description:** `formatPrompt` now skips placeholder providers absent from the prompt and resolves the last-user-input + agent-template lazily; `formatCurrentDate` reuses a module-level formatter; the invariant tool-schema token count is memoized via `countTokensJsonCached`.
- **Tests Added:** No (behavior-preserving; existing `strings.test.ts` + `token-counter.test.ts` cover the paths).
- **Verification Evidence:** typecheck ×4 exit 0; agent-runtime 963 pass / 0 fail; ESLint + Prettier clean on the three files.
- **Archived:** 2026-08-15

## Lessons Learned

A per-step hot path must not compute values the step never consumes. The `formatPrompt` loop substituted from a fixed provider map without checking presence, so the step prompt — the one prompt rebuilt every LLM step — silently paid for three file-tree truncations and a git/system-info build on every round-trip. When a loop substitutes from a provider map, guard each provider with an `includes` check before invoking it: a no-op `replaceAll` is not free when the value is computed eagerly.
