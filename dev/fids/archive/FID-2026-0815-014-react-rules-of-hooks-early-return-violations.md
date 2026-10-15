<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: React Rules-of-Hooks violations — early `return null` before hooks (13 instances)

**Filename:** `FID-2026-0815-014-react-rules-of-hooks-early-return-violations.md`
**ID:** FID-2026-0815-014
**Severity:** high
**Status:** closed (implemented + verified; archived)
**Created:** 2026-08-15
**YAGNI-Compliance:** Pending — fix is behavioral (reorder guards/hoist hooks), plus a
dev-dependency addition (`eslint-plugin-react-hooks`) gated for operator approval.

---

## Summary

A component that calls a React hook after a conditional `return null` violates
the Rules of Hooks; when the guard's condition changes between renders the hook
count changes and React throws `Rendered more hooks than during the previous
render`, which crashes the render and takes the harness down.

**Loop 1** cataloged seven instances of the `IS_SAVANT_FREE`-guard family and
one already-fixed dynamic instance (`thinking-block.tsx`). Enabling
`eslint-plugin-react-hooks` (`rules-of-hooks: error`) — the very guard rail this
FID adds — mechanically surfaced **six further instances** the original grep
missed, because they gate on *content/mode*, not on `IS_SAVANT_FREE`. **Loop 2**
extends the FID to the full **13-instance** map.

## Environment

- **OS:** Windows (dev), cross-platform runtime
- **Language/Runtime:** TypeScript / React 19 / Bun
- **Commit/State:** uncommitted working tree on `main` (0.0.24 work in progress)

## Detailed Description

### Root Cause

1. **Guard-before-hooks anti-pattern.** Components short-circuit with a
   conditional `return` as the *first* statement (or mid-body), before their
   `use*` hooks. React requires every hook to be called unconditionally in the
   same order on every render.
2. **No lint enforcement.** `eslint.config.js` loaded `eslint-config-prettier`,
   `eslint-plugin-import`, and `@typescript-eslint` — but **not**
   `eslint-plugin-react-hooks`, so `rules-of-hooks` was never checked and this
   class shipped undetected (including the six Loop-2 instances).

### Evidence (grep/lint-verified)

**Loop 1 (7 instances — 6 fixed this session, 1 pre-fixed):**

```text
cli/src/components/agent-mode-toggle.tsx:168:  if (IS_SAVANT_FREE) return null
cli/src/components/build-mode-buttons.tsx:21:  if (IS_SAVANT_FREE) return null
cli/src/components/mode-divider.tsx:14:  if (IS_SAVANT_FREE) return null
cli/src/components/out-of-credits-banner.tsx:21:  if (IS_SAVANT_FREE || isDirectProviderMode()) return null
cli/src/components/subscription-limit-banner.tsx:20:  if (IS_SAVANT_FREE || isDirectProviderMode()) return null
cli/src/components/usage-banner.tsx:49:  if (IS_SAVANT_FREE || isDirectProviderMode()) return null
cli/src/components/blocks/thinking-block.tsx  (dynamic — fixed earlier this session)
```

**Loop 2 (6 further instances — surfaced by `rules-of-hooks: error`, awaiting approval):**

```text
$ bun x eslint cli/src 2>&1 | awk '/\.(tsx|ts)$/ {file=$0} /rules-of-hooks/ {print file " :: " $1}'

cli/src/hooks/use-gravity-ad.ts                         :: 72:25 73:41 76:37 79:30 91:32 95:19 106:19 109:28 160:3 168:3
cli/src/components/blocks/tool-branch.tsx               :: 93:36 142:26 146:25
cli/src/components/blocks/agent-branch-wrapper.tsx      :: 473:22 477:25
cli/src/components/message-with-agents.tsx              :: 151:60 162:29
cli/src/components/blocks/single-block.tsx              :: 74:29
cli/src/components/blocks/tool-block-group.tsx          :: 47:25
```

Each is a hook called after a conditional early return:

| File | Guard (early return before hooks) | Hooks that follow |
|---|---|---|
| `hooks/use-gravity-ad.ts:54` | `if (isDirectProviderMode()) return {…}` | `useState`×3, `useTerminalLayout`, `useHasUserMessaged`, `useRef`×3, `useEffect`×2 |
| `components/blocks/tool-branch.tsx:41-48` | `if (toolName === 'end_turn'/'ask_user'/includeToolCall===false) return null` | `useCallback`×3 |
| `components/blocks/agent-branch-wrapper.tsx:370` | `if (shouldRenderAsSimpleText(agentType)) return (…)` | `useCallback`×2 |
| `components/message-with-agents.tsx:100,113` | `if (isAgent) return (…)` + mode-divider `return (…)` | `useMemo`×2 |
| `components/blocks/single-block.tsx:67` | `if (isReasoningTextBlock(block)) return null` (inside `switch` `case 'text'`) | `useCallback` |
| `components/blocks/tool-block-group.tsx:44` | `if (groupNodes.length === 0) return null` | `useCallback` |

### Impact Assessment

- **Severity rationale (high):** `thinking-block.tsx` was the live crash the
  operator hit. **All six Loop-2 instances gate on runtime-mutable
  conditions** — tool type, message variant, agent type, block content, provider
  mode — so each can change the hook count mid-session and reproduce the crash.
  This is strictly worse than the Loop-1 `IS_SAVANT_FREE` family (compile-time
  constant, latent). `use-gravity-ad.ts` gates on `isDirectProviderMode()`, the
  same runtime toggle as the Loop-1 live-crash risk, but in a **custom hook
  (`.ts`)**, which is why the `.tsx`-only grep missed it.

## Proposed Solution (GREEN)

### Approach

Relocate every early `return` to **after the component's last hook** (or hoist
the hooks above the guard), so all hooks run unconditionally in a fixed order.
The guard condition and returned value stay exact; only ordering changes. This
is the same principle already applied to the six Loop-1 files this session.

Per-file plan for the six Loop-2 instances:

1. **`use-gravity-ad.ts`** — move the `isDirectProviderMode()` early-return
   block (`:54-63`) to just before the final state `return`, after the last
   `useEffect`. The `useEffect` bodies already self-gate via `getAdsEnabled()`
   (and `shouldStart`/`shouldHideAds`), so they are inert in direct mode.
2. **`tool-branch.tsx`** — move the three `return null` guards (`:41-48`) below
   the three `useCallback` hooks (`:93/:142/:146`). The hooks depend only on
   props + the local `sanitizePreview`, so ordering is preserved.
3. **`agent-branch-wrapper.tsx`** — hoist the two `useCallback`s (`:473/:477`,
   depend only on `agentBlock`/`onToggleCollapsed` props) above the
   `shouldRenderAsSimpleText` early return at `:370`.
4. **`message-with-agents.tsx`** — hoist the `isAi/isUser/isError/textColor/
   codeBlockWidth/messageContentWidth` derivations and the two `useMemo`s
   (`:151/:162`) above the `if (isAgent)` (`:100`) and mode-divider (`:113`)
   early returns.
5. **`single-block.tsx`** — hoist the `useCallback` out of the `switch` `case
   'text'` block; compute the copy text unconditionally (or key the hook on
   `block.type`). Most involved of the six — the `switch` structure is
   preserved, only the hook placement changes.
6. **`tool-block-group.tsx`** — move the `if (groupNodes.length === 0) return
   null` guard (`:44`) below the `useCallback` (`:47`).

Then keep `rules-of-hooks: error` (already wired). **`exhaustive-deps: warn` is
recommended to be set to `off` for now** — it surfaces 23 pre-existing
dependency-array warnings, and this repo's gate is `--max-warnings 0` (warnings
are blocking). The FID's original "non-blocking" note was wrong for this repo.
A separate triage FID would own those 23 warnings. This is flagged for operator
decision.

### Verification

- `bun run --cwd=cli typecheck`
- CLI full suite
- `bun x eslint cli/src --max-warnings 0` → **zero** `rules-of-hooks` errors
- Law-4 grep: `bun x eslint cli/src` shows no `rules-of-hooks` diagnostics.

## Perfection Loop

### Loop 1 — RED

Seven instances cataloged with `file:line` evidence (the `IS_SAVANT_FREE` guard
family + the pre-fixed dynamic `thinking-block`). Root cause (missing
`react-hooks` lint rule) identified. **Exit: all issues cataloged.**

### Loop 1 — GREEN / AUDIT / SELF-CORRECT → COMPLETE

Fix documented and approved; six `.tsx` guards relocated; `rules-of-hooks:
error` + `exhaustive-deps: warn` wired. **AUDIT surfaced an over-broad original
map:** enabling the rule revealed the six Loop-2 instances below, so Loop 1 was
re-opened rather than closed.

### Loop 2 — RED

Re-cataloged the full 13-instance map. The six new instances were missed by the
original grep because that grep targeted only `IS_SAVANT_FREE ||
isDirectProviderMode() → return null`; the lint rule catches the whole
conditional-hooks class regardless of guard expression. All six are
runtime-mutable → live-crash class. **Exit: all issues cataloged.**

### Loop 2 — GREEN

Per-file fix plan documented above. **Exit: fixes documented.**

### Loop 2 — AUDIT (planning)

- **Behavior preservation:** ordering-only change; guard condition and returned
  value exact. The six Loop-1 files already prove the approach is clean
  (typecheck + suite green on those).
- **Reachability (Law 4):** each fix is validated by the lint rule itself —
  `rules-of-hooks: error` must report zero after the fix, which is the same
  mechanical guarantee the rule now provides at rest.
- **Tradeoff (flagged):** `exhaustive-deps: warn` conflicts with
  `--max-warnings 0` (23 pre-existing warnings). Recommend `off` now + separate
  triage. `rules-of-hooks` is the mandatory, crash-class rule and stays `error`.
- **Complexity note:** `single-block.tsx` (hook inside a `switch` case) and
  `message-with-agents.tsx` (hooks after two early returns) are the two that
  need the most care; both are still ordering-only.
- **Verification plan:** cli typecheck + full suite + ESLint zero
  `rules-of-hooks` + Law-4 re-scan.
- **AUDIT passes (planning) → COMPLETE (converged — present for approval, no
  code written for the six Loop-2 instances yet).**

### Missed Questions

1. **Why did the original scan miss six instances?** It grepped only the
   `IS_SAVANT_FREE`/`isDirectProviderMode` guard family and only `.tsx` files.
   The six new instances gate on tool/message/agent/content state, and one is a
   custom hook (`.ts`). The lint rule is the correct, exhaustive detector — which
   is the whole point of adding it.
2. **Are there instances outside `cli/src`?** React components live in the CLI
   workspace; the other workspaces are non-React. ESLint over `cli/src` is the
   complete surface.
3. **Does `rules-of-hooks` have false positives?** No false positives for the
   conditional-hook class; every flagged site was confirmed by reading the guard
   above it.
4. **Fix order?** Hoist/move guards first, then confirm the rule reports zero;
   `rules-of-hooks` stays `error` throughout.

## Resolution

Implemented and verified (2026-08-15). All six Loop-1 `.tsx` guards and the six
Loop-2 instances are fixed; `rules-of-hooks: error` is wired globally and
`exhaustive-deps` is `off` (pending a separate triage FID for its 23
pre-existing warnings). Post-change evidence (`file:line`):

- `hooks/use-gravity-ad.ts:254` — `isDirectProviderMode()` return moved below the hooks
- `components/blocks/tool-branch.tsx` — `useCallback`×3 at `:83/:132/:136`, guards at `:140+`
- `components/blocks/agent-branch-wrapper.tsx:370` — `onToggle`/`getCopyText` above the `:389` early return
- `components/message-with-agents.tsx` — `paletteForMessage` `:127`, `markdownOptions` `:139`, `if (isAgent)` `:143`
- `components/blocks/single-block.tsx:73` — `getCopyText` hoisted above the `:75` `switch`
- `components/blocks/tool-block-group.tsx:45` — `getCopyText` above the `:56` guard
- `eslint.config.js` — `react-hooks/rules-of-hooks: error`, `react-hooks/exhaustive-deps: off`

Verification: `bun x eslint . --max-warnings 0` exit 0 (zero `rules-of-hooks`
diagnostics repo-wide); `cli` typecheck exit 0; CLI full suite 3074 pass / 18
skip / 0 fail. No commit, push, release, publication, or deployment was
performed.
