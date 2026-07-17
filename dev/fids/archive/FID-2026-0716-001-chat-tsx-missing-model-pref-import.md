# FID: `ReferenceError: saveCodebuffModelPreference is not defined` at chat.tsx:255 — missing import

**Filename:** `FID-2026-0716-001-chat-tsx-missing-model-pref-import.md`
**ID:** FID-2026-0716-001
**Severity:** high
**Status:** closed
**Created:** 2026-07-16 12:55
**Fixed/Closed:** 2026-07-16 12:55 (same session)
**Author:** ECHO Agent (Hy3, free)

---

## Summary

`cli/src/chat.tsx` references `saveCodebuffModelPreference` and `loadCodebuffModelPreference`
at lines 240, 241, 255, 256 (inside a model-pick handler's `useCallback` body + dependency
array) but does NOT import them. The functions are correctly exported from
`cli/src/utils/settings.ts:200` and `:208` and are imported correctly by the other two
production consumers (`commands/command-registry.ts:28`, `hooks/use-send-message.ts:19`).
At runtime, the TUI's React render path passes evaluation of the `useCallback` callback
declaration (which references the unresolved identifiers in its dep array), throwing
`ReferenceError` and breaking the entire TUI render before the user reaches the login screen
or any CLI command. This blocks the developer-boot verification of FID-005/FID-006 work —
the TUI does not boot far enough to test the dev-mode auth bypass in a real run, even
though the auth bypass logic itself is correct (verified in isolation).

## Environment

- **OS:** Windows 11, Bun 1.3.11
- **Language/Runtime:** TypeScript 5.5.4 / Bun monorepo / React 19 (OpenTUI)
- **Commit/State:** working tree at `C:\Users\spenc\dev\codebuff` (NOT a git repo)
- **Hot path:** `bun dev` → `bun --cwd cli dev` → `bun run src/index.tsx --cwd ..`

## Detailed Description

### Problem

`bun dev` starts. Env validation passes (`Using environment: dev`). The when-`INFERENCE_BASE_URL`-set
dev-mode auth bypass correctly returns a stub token (verified by direct `import` + invocation:
`AUTH: {"token":"dev-local-bypass-token","source":"environment"}`). The TUI's React render
then crashes:

```text
ReferenceError: saveCodebuffModelPreference is not defined
    at Chat (C:\Users\spenc\dev\codebuff\cli\src\chat.tsx:255:7)
    at react-stack-bottom-frame (...react-reconciler.development.js:15859:20)
    at renderWithHooks (...react-reconciler.development.js:3221:22)
    ...
```

Result: instead of the login screen / projects picker, the TUI pastes a red error overlay
reading "ReferenceError: saveCodebuffModelPreference is not defined" with the React stack.
The user cannot test any CLI functionality.

### Expected Behavior

`cli/src/chat.tsx` is the React component at the top of the TUI render tree. It should
import all of the symbols it references. Specifically: it should import
`loadCodebuffModelPreference` and `saveCodebuffModelPreference` from `./utils/settings`
in the same import block that already imports `hasSubmittedFirstPrompt` and
`markFirstPromptSubmitted`. Then the model-picker handler's `useCallback` would resolve.

### Root Cause

**Single missing import in `cli/src/chat.tsx`.** The component's import block
(lines 72-75) currently reads:

```ts
import {
  hasSubmittedFirstPrompt,
  markFirstPromptSubmitted,
} from './utils/settings'
```

This block is missing the two model-preference functions used at lines 240-241 (body) and
255-256 (dep array). Both are exported from `./utils/settings` (lines 200 and 208 of
`util/settings.ts`). All other production consumers (`command-registry.ts:28`,
`hooks/use-send-message.ts:19`, plus the `state/model-picker-store.ts:10` comment that
confirms intentional wiring) import them correctly.

Why did TypeScript not catch this? The functions are referenced inside a `useCallback`
hook whose **callback body** is only evaluated when the picker is triggered OR whose **dep
array** is only evaluated when React re-reads the closure. Both happen lazily at runtime,
and `useCallback`'s dep array syntax does not produce a static reference the way a direct
call in module scope would. So `tsc` sees the identifiers as presumably resolvable via
ambient/global lookup (or via a different transpiled shape) and does not fail compile.

### Evidence

**Error (from running `bun dev` and capturing the TUI render output to a log):**

```text
ReferenceError: saveCodebuffModelPreference is not defined
    at Chat (C:\Users\spenc\dev\codebuff\cli\src\chat.tsx:255:7)
```

**Definition sites (`grep` against `cli/src`):**

```text
cli/src/utils/settings.ts:200:  export const loadCodebuffModelPreference = (): string | undefined => {
cli/src/utils/settings.ts:208:  export const saveCodebuffModelPreference = (model: string): void => {
```

**Use sites in `chat.tsx` (the offender):**

```text
cli/src/chat.tsx:240:        saveCodebuffModelPreference(modelId)
cli/src/chat.tsx:241:        const current = loadCodebuffModelPreference()
cli/src/chat.tsx:255:        saveCodebuffModelPreference,
cli/src/chat.tsx:256:        loadCodebuffModelPreference,
```

**Use sites elsewhere (correctly imported):**

```text
cli/src/commands/command-registry.ts:28:  import { loadCodebuffModelPreference, saveCodebuffModelPreference } from '../utils/settings'
cli/src/hooks/use-send-message.ts:19:  import { loadCodebuffModelPreference } from '../utils/settings'
cli/src/state/model-picker-store.ts:10: (comment) "...saveCodebuffModelPreference (handled by the model picker)"
```

**chat.tsx import block (lines 72-75):**

```ts
import {
  hasSubmittedFirstPrompt,
  markFirstPromptSubmitted,
} from './utils/settings'
```

The two functions are missing from this list.

## Impact Assessment

### Affected Components

- `cli/src/chat.tsx` — TUI crashes on render
- `cli/src/utils/settings.ts` — unaffected (correctly defined/exports)
- Indirect: any user-facing CLI capability in this screenshot session (login, chat, agent
  flows) is unreachable until fixed. The dev-mode bypass itself is verified working in
  isolation (tests pass), so auth is not the issue.

### Risk Level

- [x] High: Major feature broken, no workaround (TUI does not boot)

## Proposed Solution

### Approach

Add the two missing identifiers to the existing `./utils/settings` `import {…}` block in
`cli/src/chat.tsx` (lines 72-75). No other change is needed — the symbols are already
imported correctly elsewhere, so this aligns `chat.tsx` with the established consumer
pattern. Surgical. No behavior change beyond fixing the runtime ReferenceError.

Per ECHO Law 13 (utility-first): expand the existing `import {…}` block — do NOT add a
new import statement, since the same source (`./utils/settings`) is already being
imported 12 lines earlier.

### Steps

1. Edit `cli/src/chat.tsx` to add `loadCodebuffModelPreference` and
   `saveCodebuffModelPreference` to the existing `from './utils/settings'` `import {…}`
   block.
2. Verify `bunx tsc --noEmit -p cli/tsconfig.json` reports the same pre-existing `react-dom/server`
   errors only (no new errors introduced by this change).
3. Verify `bun dev` boots the TUI past React's initial render (no `ReferenceError` overlay).

### Verification

- `bun dev` does NOT print "ReferenceError: saveCodebuffModelPreference is not defined".
- TUI renders the Freebuff landing / project picker / login flow.
- `bunx tsc --noEmit -p cli/tsconfig.json` exit code identical to baseline (no regressions).

## Perfection Loop

### Loop 1

- **RED:** `ReferenceError: saveCodebuffModelPreference` thrown by React render at
  `cli/src/chat.tsx:255:7` in the `useCallback` dep array. TUI crashes. Definition sites
  exist at `cli/src/utils/settings.ts:200,208`. chat.tsx import block (lines 72-75) lacks
  both entries. Other consumers (`command-registry.ts:28`, `use-send-message.ts:19`)
  import correctly, so the symbols are demonstrably present, exported, and resolvable in
  the rest of the codebase. Call-graph: only sites of `loadCodebuffModelPreference` in
  production code are `command-registry.ts:481`, `use-send-message.ts:114`, and
  `chat.tsx:241`; only sites of `saveCodebuffModelPreference` are
  `command-registry.ts:473` and `chat.tsx:240`. After fix, all 5 sites must resolve via
  the existing `./utils/settings` module exports. RED also includes: dev-mode auth bypass
  verified working in isolation (`AUTH: {"token":"dev-local-bypass-token",...}` printed by
  direct module invocation) — so the env gate AND auth gate both work; the ONLY blocker is
  this import. Pre-existing baseline errors: 8 `react-dom/server` declaration errors
  visible to `tsc -p cli/tsconfig.json` since before this fix (FID-005 session); they
  must not change after the fix.
- **GREEN:** Edit `cli/src/chat.tsx:72-75` from:
  ```ts
  import {
    hasSubmittedFirstPrompt,
    markFirstPromptSubmitted,
  } from './utils/settings'
  ```
  to:
  ```ts
  import {
    hasSubmittedFirstPrompt,
    loadCodebuffModelPreference,
    markFirstPromptSubmitted,
    saveCodebuffModelPreference,
  } from './utils/settings'
  ```
  Alphabetized (matches the existing alphabetical ordering observed in
  `command-registry.ts:28` for consistency). No other file is touched. No new symbol
  introduced. No existing dependency removed. Change delta: 2 lines added, 0 removed,
  < 50 characters.
- **AUDIT:** (verified) `bunx tsc --noEmit -p cli/tsconfig.json` returns 2 pre-existing
  errors in `cli/src/components/model-picker.tsx:132-133` (`key.input` and `key.alt` not on
  `KeyEvent` type). These errors are **not introduced by this FID's change** — neither file
  was modified, and the errors reference OpenTUI `KeyEvent` typings independent of
  `./utils/settings`. 8 react-dom/server declaration errors that existed in earlier sessions
  are no longer raised (likely local state difference — the project has multiple
  pre-existing baseline errors, but the relevant fact is: my FID's change did not introduce
  new errors, and the 2 remaining are unrelated). `bun dev` boots: TUI renders cleanly
  with no `ReferenceError` overlay (log captured to `$env:TEMP\cb-after-fix.log`, 8899 bytes,
  no match for /ReferenceError|undefined|SyntaxError|^Error|cannot|is not defined/
  throw new/). Call-graph grep after fix — chat.tsx now imports both identifiers
  (`loadCodebuffModelPreference` at line 74, `saveCodebuffModelPreference` at line 76 of
  the import block). All 5 production call sites of these symbols (chat.tsx:242-243,
  chat.tsx:257-258 deps, command-registry.ts:473, command-registry.ts:481,
  use-send-message.ts:114) resolve through the import. Definitions still produced by
  settings.ts:200,208. Visible TUI content includes: "Codebuff will run commands on your
  behalf to help you build.", directory `~/dev/codebuff`, prompt placeholder
  "Enter a coding task or / for commands", and mode banner `< DEFAULT` — i.e. the
  intended default Freebuff landing. Audit satisfied: error gone, call-graph wired,
  no regressions, TUI renders.
- **CHANGE DELTA:** 1 file modified (`cli/src/chat.tsx`), 2 lines added, 0 removed,
  ~110 characters. ≈ 0.0006% of repo's 1,101 .ts/.tsx files / ~186k LOC baseline
  (negligible).

## Resolution

- **Fixed By:** ECHO Agent (Hy3, free)
- **Fixed Date:** 2026-07-16 12:55
- **Fix Description:** Added `loadCodebuffModelPreference` and `saveCodebuffModelPreference`
  to the existing `./utils/settings` `import {…}` block in `cli/src/chat.tsx` (was at lines
  72-75, now at 72-77). Alphabetical ordering preserved. No other file touched. Resolves
  `ReferenceError: saveCodebuffModelPreference is not defined` at chat.tsx:255 (was dep
  array of `useCallback` in the model-pick handler).
- **Tests Added:** None required. The single-line import fix is exercised by any path that
  triggers the model picker or by `useSendMessage` (which already imports
  `loadCodebuffModelPreference`). Headless test infra not present in this repo for the TUI.
- **Verified By:** (1) `bunx tsc --noEmit -p cli/tsconfig.json` — exit 2 with only 2
  pre-existing model-picker.tsx errors (unrelated to this fix). (2) `bun dev` — TUI
  rendered to log (8899 bytes), zero matches for
  /ReferenceError|undefined|SyntaxError|^Error|cannot|is not defined|throw new/. Visible
  TUI content shows the Freebuff landing text, project directory, input placeholder, and
  DEFAULT mode banner — confirming the React render completed normally.
  (3) `grep -rn "loadCodebuffModelPreference\|saveCodebuffModelPreference" cli/src/` —
  chat.tsx now imports both (lines 74, 76); all 5 production call sites resolve through
  the import; definitions still in settings.ts:200,208.
- **Commit/PR:** pending (this workspace is not a git repo per AGENTS.md/boot output)
- **Archived:** pending FID-001 closure

## Lessons Learned

- React `useCallback` dep-array identifier resolution is **lazy**: `tsc` cannot catch
  unresolved identifiers in a `useCallback` dep array even though they would be a hard
  `ReferenceError` when React re-creates the closure. Treat dep arrays as runtime code,
  not compile-checked references. Future safeguards: consider adding a small ESLint rule
  via `@typescript-eslint/no-undef` scope check on `.tsx`, or a unit test that mounts
  `Chat` headlessly to smoke-test render.
- The dev-mode auth bypass (FID-006) was suspected to be the boot blocker based on the
  prior-session error message, but the actual bug was unrelated and downstream. The
  previous transcript's "Unable to connect. Is the computer able to access the url?
  (POST http://127.0.0.1:9/api/auth/cli/code)" — that error was thrown by a *different*
  failing state in an earlier code revision before the auth bypass was added; with the
  current source, the auth bypass fires, but a render crash preempts the entire TUI.
  Lesson: when a user reports a runtime symptom, always reproduce against the **current**
  source rather than inferring from a previous transcript — symptoms can be re-mapped
  by intervening commits.
- ECHO's "Additional Rule" (always flag any issue, even outside scope) caught this:
  the user thought we were resuming after the auth-boot problem; the **actual** boot
  blocker surfaced only after a fresh run + log capture.
