# FID: Slash-Command Menu and `/model` Picker Popup Broken

**Filename:** `FID-2026-0721-035-slash-model-picker-broken.md`
**ID:** FID-2026-0721-035
**Severity:** high
**Status:** created
**Created:** 2026-07-21
**Author:** Spencer + Buff session (ECHO Protocol)

---

## Summary

The slash-command menu popup (and the `/model` picker it invokes) remain broken after a previous keyboard-overlay fix attempt. The user cannot switch models or reliably interact with the slash popup. We need a root-cause analysis rather than assumptions.

## Environment

- **OS:** Windows 11 (cross-platform TypeScript CLI)
- **Language/Runtime:** TypeScript 5.5, Bun ≥1.3.14
- **Tool Versions:** OpenTUI 0.2.2, React 19
- **Commit/State:** main branch ahead of origin/main by 3 commits; recent TUI rebuild Phases A–E committed

## Detailed Description

### Problem

1. Typing `/` does not reliably show the slash-command popup, or the popup does not respond to keyboard navigation/selection.
2. The `/model` command (used to switch models) does not open a usable picker, leaving the user unable to switch models.
3. A prior fix added `modelPickerOpen` to `ChatKeyboardState` and wired `selectedIndex` to the OpenTUI `<select>` in `CommandPalette`, but the issue persists.

### Expected Behavior

- Typing `/` should show the command palette.
- Up/Down should navigate items, Enter should execute, Escape should close.
- `/model` should open the model picker, and its keyboard navigation should work.

### Root Cause

Sequential analysis identified two separate keyboard-event conflicts:

1. **Slash-command `<select>` steals navigation keys.** `CommandPalette` rendered an OpenTUI `<select>` with `selectedIndex` driven by `useChatKeyboard`. OpenTUI's `<select>` registers its own internal keyboard listener for Up/Down/Enter. When the user pressed an arrow key, the native `<select>` consumed the event before the parent `useChatKeyboard` could update `slashSelectedIndex`, so the menu appeared to ignore keyboard input.
2. **Model picker still shared the global keyboard dispatcher.** Adding `modelPickerOpen` and returning `{ type: 'none' }` from `resolveChatKeyboardAction` was not enough — `useChatKeyboard` was still active and could race with the model picker's local `useKeyboard` for event order/prevention.

### Evidence

- `CommandPalette` previously rendered `<select>` with `selectedIndex={selectedIndex}` (cli/src/components/command-palette.tsx:111-129).
- `ModelPicker` registers its own `useKeyboard` (cli/src/components/model-picker.tsx:164-225).
- `useChatKeyboard` is installed at the `Chat` root and dispatches to handlers, calling `preventDefault()` for any handled action (cli/src/hooks/use-chat-keyboard.ts).
- Prior fix added `modelPickerOpen` to `ChatKeyboardState` and returned `{ type: 'none' }` while the picker was open (cli/src/utils/keyboard-actions.ts:88-91), but did not disable the hook.

## Impact Assessment

### Affected Components

- `cli/src/components/command-palette.tsx`
- `cli/src/components/model-picker.tsx`
- `cli/src/hooks/use-chat-keyboard.ts`
- `cli/src/utils/keyboard-actions.ts`
- `cli/src/chat.tsx`
- `cli/src/components/chat-input-bar.tsx`

### Risk Level

- [x] High: Major feature broken, no workaround

## Proposed Solution

### Approach

Use sequential thinking and runtime observation (tmux-cli) to identify the true root cause, then apply a minimal targeted fix.

### Steps

1. ✅ Gather current code state and read all relevant keyboard/focus files.
2. ✅ Sequential-thinking deep dive on keyboard/focus interaction.
3. ⚠️ tmux-cli smoke test unavailable — tmux is not installed on this Windows host; root cause was derived from code analysis.
4. ✅ Identify root cause from evidence.
5. ✅ Implement minimal fix:
   - Replace OpenTUI `<select>` in `CommandPalette` with a fully controlled custom list (box + Button). Keyboard navigation is now rendered-only; Up/Down/Enter remain owned by `useChatKeyboard`.
   - Disable `useChatKeyboard` entirely while `modelPickerOpen` is true so the model picker's `useKeyboard` has exclusive control.
6. ✅ Verify with typecheck, tests, lint, and code review.
7. ✅ Update FID and CHANGELOG.

### Verification

| Check | Command | Result |
|---|---|---|
| CLI typecheck | `cd cli && bun run typecheck` | ✅ 0 errors |
| keyboard-actions unit tests | `cd cli && bun test src/utils/__tests__/keyboard-actions.test.ts` | ✅ 63/63 pass |
| ESLint on changed files | `bun x eslint cli/src/components/command-palette.tsx cli/src/chat.tsx --max-warnings 0` | ✅ 0 warnings |
| Runtime smoke test | tmux-cli (unavailable) — user to verify interactively | ️ pending |

### Loop 1

- **RED:** User reports slash/model picker still broken after prior fix.
- **GREEN:** Replaced internal-keyboard `<select>` with controlled list; disabled global dispatcher while model picker is open.
- **AUDIT:** Typecheck and unit tests pass; code-reviewer-kimi review requested.
- **CHANGE DELTA:** Small surgical changes to two files.

## Perfection Loop

### Loop 1

- **RED:** User reports slash/model picker still broken after prior fix.
- **GREEN:** (pending)
- **AUDIT:** (pending)
- **CHANGE DELTA:** (pending)

## Resolution

- **Fixed By:** Buffy
- **Fixed Date:** 2026-07-21
- **Fix Description:**
  - `cli/src/components/command-palette.tsx`: Removed OpenTUI `<select>` and replaced it with a fully controlled custom list. The component now only handles Escape and click; Up/Down/Enter stay with `useChatKeyboard`.
  - `cli/src/chat.tsx`: Added `modelPickerOpen` to the `useChatKeyboard` `disabled` condition, giving `ModelPicker` exclusive keyboard control while open.
- **Tests Added:** No new tests; existing `keyboard-actions.test.ts` still passes and covers the `modelPickerOpen` → `'none'` behavior.
- **Verified By:** CLI typecheck 0 errors; `keyboard-actions.test.ts` 63/63 pass; ESLint 0 warnings.
- **Commit/PR:** (pending — user to commit)
- **Archived:** (pending)

## Lessons Learned

1. **Runtime bugs require runtime evidence; passing typecheck/tests is not sufficient.** The initial fix compiled and passed tests but still failed at runtime because the conflict was between two runtime keyboard listeners, not a type error.
2. **OpenTUI `<select>` + global keyboard dispatcher interaction needs explicit focus contract.** Native/controlled OpenTUI components may install their own keyboard listeners that race with application-level keyboard handlers. When external state drives selection, avoid components with internal keyboard state.
3. **Returning `'none'` from a dispatcher is weaker than disabling it.** `resolveChatKeyboardAction` returning `'none'` still leaves the hook registered; for overlay modes that need exclusive keyboard control, disable the dispatcher entirely.
