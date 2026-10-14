<!-- markdownlint-disable MD013 -->

# FID: Wave 4 — CLI and Desktop UI/UX parity, subagent tool attribution, interactive approval, and 3D scene performance

**Filename:** `FID-2026-1013-013-wave4-cli-desktop-ui-qol-enhancements.md`
**ID:** FID-2026-1013-013
**Severity:** medium
**Status:** fixed
**Created:** 2026-10-13 19:35
**Automation level:** 3
**YAGNI-Compliance:** Verified
**Master FID:** FID-2026-1012-022
**Depends On:** FID-2026-1013-009, FID-2026-1013-012

---

## Summary

Wave 4 of the QOL & Enterprise Hardening Program (`FID-2026-1013-009`) delivers six concrete UI/UX and runtime
performance improvements across the Desktop and CLI clients: (W4-1) Desktop `ChatBlock` (`kind: 'tool'`) in
`desktop/src/state/transcript-types.ts` , `desktop/src/state/transcript-reducer.ts` , and
`desktop/src/components/chat/ToolCard.tsx` now captures and displays subagent attribution (`agentId`,
`parentAgentId` , and resolved `agentType` / `displayName` from the live roster) so subagent tool calls are
visually attributed instead of blending indistinguishably into root Savant calls; (W4-2) Desktop
`desktop/src/lib/diff-parse.ts` parses `apply_patch` 's nested `input.operation.diff` and `input.operation.path`
(which previously returned `null` because `parseDiffInput` only checked top-level `input.diff` / `input.patch` ),
and `desktop/src/components/chat/ToolCard.tsx` + `desktop/src/components/chat/tool-display.ts` render `set_output`
payloads cleanly instead of raw JSON; (W4-3) Desktop `desktop/src/components/chat/ApprovalCard.tsx` ,
`desktop/src/components/chat/ChatThread.tsx` , and `desktop/src/hooks/use-gateway.ts` support an optional operator
note/answer input wired through `respondApproval(approvalId, answers, skipped)` ; (W4-4) Desktop 3D
`desktop/src/floor/office/scene-frame-loop.ts` pre-indexes `walkers` into an `O(1)` `Map` per frame instead of
`O(N*W)` `walkers.find(...)` , `desktop/src/floor/office/office-scene.tsx` skips duplicate burst state updates, and
`desktop/src/floor/office/scene-agent-ui.tsx` reference-counts pointer hover cursor transitions so moving directly
between two agents never resets `document.body.style.cursor` to `'auto'` ; (W4-5) CLI
`cli/src/chat/use-message-block-sync.ts` replaces its inline `{}` allocation on `responseAds` with a module-level
frozen `EMPTY_RESPONSE_ADS` constant; and (W4-6) CLI `cli/src/hooks/use-chat-messages.ts` tracks its collapse
`setTimeout` handle in a ref and clears it on re-trigger and unmount. The pre-implementation record declared six
findings and eight gates; execution landed all six with every gate green — see `### Implementation Evidence` and
the stamped `### Verification Receipt`.

`implementation_started: true`

## Environment

- **OS:** Windows 11 (win32), Git Bash
- **Language/Runtime:** TypeScript 5.5.4, Bun 1.3.14, React 18/19, Three.js / React Three Fiber
- **Tool Versions:** ESLint 9 (`--max-warnings 0`), Prettier
- **Commit/State:** `main` @ `3ee91a35`

## Detailed Description

### Problem

1. **W4-1 — Desktop `ToolBlock` drops subagent attribution (`agentId`, `parentAgentId`, `agentLabel`):**
   - `common/src/types/print-mode.ts:52-68` (`PrintModeToolCall` and `PrintModeToolResult` ) carries
     `agentId?: string` and `parentAgentId?: string` .
   - `desktop/src/state/transcript-types.ts:43-50` (`ChatBlock` where `kind: 'tool'` ) omits `agentId` ,
     `parentAgentId` , and `agentLabel` , and `desktop/src/state/transcript-reducer.ts:95-115` discards them on
     `tool_call` . As a result, when Detective, Scout, Forge, or Basher executes a tool call, Desktop
     `ToolCard.tsx` renders the card identically to a root-level tool call with no badge indicating which subagent
     invoked it.

2. **W4-2 — Desktop `diff-parse.ts` misses `apply_patch` (`input.operation.diff`) and `ToolCard.tsx` lacks
   `set_output` preview/card support:**
   - `desktop/src/lib/diff-parse.ts:127-133` checks `const diff = asString(input.diff ?? input.patch)` and
     `asString(input.path)` . However, Savant's `apply_patch` tool schema
     (`common/src/tools/params/tool/apply-patch.ts` / `sdk/src/tools/apply-patch.ts` ) nests the payload under
     `input.operation` :
     `{ operation: { type: 'update_file' | 'create_file' | 'delete_file', path: string, diff?: string } }` .
     Because `input.diff` is `undefined` , `parseDiffInput('apply_patch', inputJson)` returns `null` on every real
     `apply_patch` call, degrading Desktop `ToolCard` to a raw JSON dump!
   - Similarly, `desktop/src/components/chat/tool-display.ts:59-135` and
     `desktop/src/components/chat/ToolCard.tsx:78-105` have no dedicated preview or structured summary for
     `set_output` (unlike CLI `cli/src/components/tools/set-output.tsx:20-73` ), so `set_output` collapses to `}`
     (the last line of raw JSON) on Desktop.

3. **W4-3 — Desktop `ApprovalCard.tsx` hardcodes empty `answers: []`:**
   - `desktop/src/components/chat/ApprovalCard.tsx:14-64` and `desktop/src/hooks/use-gateway.ts:224-233`
     (`respondApproval(approvalId, skipped)`) always send `[]` for `answers` in
     `getClient().respondApproval(approvalId, [], skipped)` . The operator has no text input to attach an answer or
     rejection note when approving or denying an `approval_request` on Desktop.

4. **W4-4 — Desktop 3D `OfficeScene` per-frame `O(N*W)` lookup and hover-cursor race condition:**
   - `desktop/src/floor/office/scene-frame-loop.ts:106-111` iterates `for (const child of group.children)` and runs
     `walkers.find((candidate) => candidate.agentId === id)` inside the 60fps `useFrame` callback (`O(N * W)`
     linear scan every frame instead of indexing `walkers` once per step or when `walkers` changes).
   - `desktop/src/floor/office/scene-agent-ui.tsx:48-54` runs:
     ```ts
     useEffect(() => {
       document.body.style.cursor = hovered ? 'pointer' : 'auto'
       return () => { document.body.style.cursor = 'auto' }
     }, [hovered])
     ```
     Inside `OfficeContents` , 10 `AgentCharacter` instances mount simultaneously. When the pointer moves directly
     from Agent A (`hovered: true -> false`) to Agent B (`hovered: false -> true`) in the same frame, Agent A's
     effect or cleanup can run after Agent B's effect and clobber `document.body.style.cursor` back to `'auto'`
     while the pointer is still hovering Agent B.

5. **W4-5 — CLI `use-message-block-sync.ts` fresh `{}` allocation every layout effect:**
   - `cli/src/chat/use-message-block-sync.ts:74` passes `responseAds: showInlineAds ? responseAds : {}` inside
     `useLayoutEffect` . Whenever `showInlineAds` is `false` and any dependency (`timerStartTime`,
     `isWaitingForResponse` , `messageTree` ) updates during streaming, a brand-new `{}` reference is allocated and
     written into `useMessageBlockStore` , invalidating `responseAds` referential identity on every streaming tick.

6. **W4-6 — CLI `use-chat-messages.ts` untracked `setTimeout` in `handleCollapseToggle` / `handleToggleAll`:**
   - `cli/src/hooks/use-chat-messages.ts:91-93` and `116-118` call bare
     `setTimeout(() => { isUserCollapsingRef.current = false }, 0)` without storing or clearing the timer ID. Rapid
     consecutive collapse toggles clear `isUserCollapsingRef.current` prematurely on the first timer's tick while
     the second toggle's render is still settling, and unmounting leaves dangling timers.

### Expected Behavior

1. **W4-1:** `ChatBlock` (`kind: 'tool'`) in `desktop/src/state/transcript-types.ts` includes optional
   `agentId?: string` , `parentAgentId?: string` , and `agentLabel?: string` .
   `desktop/src/state/transcript-reducer.ts` populates these on `tool_call` (resolving `agentLabel` from
   `state.roster` when `event.agentId` or `event.parentAgentId` matches an active subagent), and
   `desktop/src/components/chat/ToolCard.tsx` renders a compact subagent badge (`<span
   className="tool-agent-badge">{block.agentLabel}</span>`) in the tool header when present.
2. **W4-2:**
   - `desktop/src/lib/diff-parse.ts` (`parseDiffInput` for `apply_patch` ) checks both nested `input.operation`
     (`operation.diff`, `operation.path` , `operation.type` ) and top-level `input.diff` /`input.patch` so real
     `apply_patch` tool calls render their structured `DiffBlock` and `[-N/+M]` stats in `ToolCard.tsx` (and
     `toolCollapsedPreview` in `desktop/src/components/chat/tool-display.ts` shows `Patch <path>` or
     `Create <path>` ).
   - `desktop/src/components/chat/tool-display.ts` (`toolCollapsedPreview`) and
     `desktop/src/components/chat/ToolCard.tsx` extract `set_output` 's `data` / `message` summary so `set_output`
     cards show a clean one-line preview and formatted payload instead of a bare `}` line.
3. **W4-3:** `desktop/src/components/chat/ApprovalCard.tsx` includes an optional single-line note/answer `<input>`
   and passes `note?: string` to `onRespond(approvalId: string, skipped: boolean, note?: string)` .
   `desktop/src/hooks/use-gateway.ts` (`respondApproval`) forwards
   `note && note.trim() ? [{ note: note.trim() }] : []` to
   `getClient().respondApproval(approvalId, answers, skipped)` (backwards-compatible with 2-arg callers).
4. **W4-4:**
   - `desktop/src/floor/office/scene-frame-loop.ts` builds a `walkerById` lookup `Map` once at the top of `step()`
     (or reuses a cleared `Map` instance on the stepper closure for zero per-frame Map allocation) so child lookup
     is `O(1)` with zero GC churn.
   - `desktop/src/floor/office/scene-agent-ui.tsx` uses a module-level hover reference counter (with a
     test-isolation reset helper `resetHoveredAgentCursorCount` wired into `desktop/test/setup-test-isolation.ts` )
     so `document.body.style.cursor` stays `'pointer'` as long as `hoveredCount > 0` and only resets to `'auto'`
     when `hoveredCount === 0` .
5. **W4-5:** `cli/src/chat/use-message-block-sync.ts` defines
   `const EMPTY_RESPONSE_ADS: Record<string, AdResponse[]> = Object.freeze({})` at module scope and passes
   `showInlineAds ? responseAds : EMPTY_RESPONSE_ADS` .
6. **W4-6:** `cli/src/hooks/use-chat-messages.ts` stores the collapse reset timeout in `collapseResetTimerRef` ,
   clears any prior pending timer before scheduling a new one in `handleCollapseToggle` and `handleToggleAll` , and
   clears it on unmount via `useEffect` .

### Root Cause

1. Desktop's `ToolCard` , `diff-parse.ts` , and `ApprovalCard` were built in early Gateway v1 passes
   (`FID-2026-0820-010`) before `apply_patch` 's nested `operation` schema and `set_output` 's structured card were
   finalized on the CLI.
2. `scene-agent-ui.tsx` wrote to the global `document.body.style.cursor` from per-instance `useEffect` hooks
   without coordinating across the 10 mounted character instances.
3. `use-message-block-sync.ts` and `use-chat-messages.ts` used inline object/timer literals in hot hooks.

### Evidence

```text
- desktop/src/lib/diff-parse.ts:127-133:
  if (toolName === 'apply_patch') {
    const diff = asString(input.diff ?? input.patch)
    if (diff === null) return null
    const hunks = parsePatch(diff)
    if (hunks.length === 0) return null
    return { path: asString(input.path) ?? extractPatchPath(diff), hunks }
  }
  (Real apply_patch calls have { operation: { type, path, diff } }, so input.diff is always null!)

- desktop/src/state/transcript-types.ts:43-50:
  | {
      kind: 'tool'
      id: number
      toolCallId: string
      toolName: string
      inputJson: string | null
      outputText: string | null
      done: boolean
    }
  (No agentId / parentAgentId / agentLabel)

- desktop/src/components/chat/ApprovalCard.tsx:22-26 & desktop/src/hooks/use-gateway.ts:224-228:
  await getClient().respondApproval(approvalId, [], skipped)

- desktop/src/floor/office/scene-frame-loop.ts:106-111:
  for (const child of group.children) {
    const id = child.userData.agentId as string | undefined
    if (id === undefined) continue
    const walker = walkers.find((candidate) => candidate.agentId === id)

- desktop/src/floor/office/scene-agent-ui.tsx:48-53:
  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : 'auto'
    return () => { document.body.style.cursor = 'auto' }
  }, [hovered])

- cli/src/chat/use-message-block-sync.ts:74:
  responseAds: showInlineAds ? responseAds : {},

- cli/src/hooks/use-chat-messages.ts:91-93:
  setTimeout(() => {
    isUserCollapsingRef.current = false
  }, 0)
```

## Impact Assessment

### Affected Components

- `desktop/src/state/transcript-types.ts`
- `desktop/src/state/transcript-reducer.ts`
- `desktop/src/components/chat/ToolCard.tsx`
- `desktop/src/components/chat/tool-display.ts`
- `desktop/src/lib/diff-parse.ts`
- `desktop/src/components/chat/ApprovalCard.tsx`
- `desktop/src/components/chat/ChatThread.tsx`
- `desktop/src/hooks/use-gateway.ts`
- `desktop/src/floor/office/scene-frame-loop.ts`
- `desktop/src/floor/office/scene-agent-ui.tsx`
- `desktop/test/setup-test-isolation.ts`
- `cli/src/chat/use-message-block-sync.ts`
- `cli/src/hooks/use-chat-messages.ts`

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists — Desktop `apply_patch` diffs never render (always falling back
      to raw JSON), subagent tool calls lack agent attribution, `ApprovalCard` cannot send operator notes, and
      `scene-agent-ui.tsx` has a multi-agent hover cursor race.
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

1. **Subagent attribution on Desktop `ToolBlock` and `ToolCard` (W4-1):**
   - Extend `ChatBlock` (`kind: 'tool'`) in `desktop/src/state/transcript-types.ts` with optional
     `agentId?: string` , `parentAgentId?: string` , and `agentLabel?: string` .
   - In `desktop/src/state/transcript-reducer.ts` (which has >80 lines of headroom after Wave 3's decomposition),
     capture `event.agentId` and `event.parentAgentId` on `case 'tool_call':` , look up the matching active
     subagent in `state.roster` (`entry.agentId === (event.agentId ?? event.parentAgentId)`), and set
     `agentLabel: entry.displayName || entry.role` when found.
   - In `desktop/src/components/chat/ToolCard.tsx` , render
     `<span className="tool-agent-badge">{block.agentLabel}</span>` beside `<span className="tool-name">` when
     `block.agentLabel` is present.
2. **Desktop `apply_patch` diff parsing and `set_output` preview/card support (W4-2):**
   - In `desktop/src/lib/diff-parse.ts` , update the `if (toolName === 'apply_patch')` branch to inspect
     `input.operation` (when `typeof input.operation === 'object' && input.operation !== null` ) for
     `operation.diff` and `operation.path` (including `operation.type === 'delete_file'` when `diff` is omitted),
     while keeping fallback support for top-level `input.diff ?? input.patch` and `input.path` .
   - In `desktop/src/components/chat/tool-display.ts` (`toolCollapsedPreview`), add `apply_patch` (`Patch <path>` /
     `Create <path>` / `Delete <path>` ) and `set_output` (extracting `input.data` or top-level `input.message` /
     key summary, mirroring CLI `set-output.tsx` ) so collapsed headers never display a bare `}` .
3. **Interactive note/answer input on Desktop `ApprovalCard` (W4-3):**
   - In `desktop/src/components/chat/ApprovalCard.tsx` , add a `note` state and a compact
     `<input type="text" className="approval-note-input" placeholder="Optional note or answer…" />` inside the
     un-responded action row, and pass `note.trim() || undefined` as the 3rd argument to
     `onRespond(block.approvalId, skipped, note.trim() || undefined)` .
   - In `desktop/src/components/chat/ChatThread.tsx` and `desktop/src/hooks/use-gateway.ts` , widen
     `onRespondApproval` / `respondApproval` to `(approvalId: string, skipped: boolean, note?: string)` and pass
     `note ? [{ note }] : []` to `getClient().respondApproval(approvalId, answers, skipped)` .
4. **Desktop 3D `OfficeScene` frame-loop and hover-cursor hardening (W4-4):**
   - In `desktop/src/floor/office/scene-frame-loop.ts` , maintain a reusable
     `walkerById = new Map<string, StepperWalker>()` inside `createWalkerFrameStepper()` . At the start of `step()`
     , `walkerById.clear()` and populate `walkerById.set(w.agentId, w)` once (`O(W)`), then replace
     `walkers.find(...)` inside the `group.children` loop with `walkerById.get(id)` (`O(1)`).
   - In `desktop/src/floor/office/scene-agent-ui.tsx` , manage `document.body.style.cursor` via a reference-counted
     helper (`acquireHoverCursor()` / `releaseHoverCursor()` plus `resetHoverCursorCount()` registered in
     `desktop/test/setup-test-isolation.ts` ) so transitioning directly from one hovered agent to another keeps
     `hoveredCount >= 1` and never flickers to `'auto'` .
5. **CLI hook allocation and timer cleanup (W4-5, W4-6):**
   - In `cli/src/chat/use-message-block-sync.ts` , hoist
     `export const EMPTY_RESPONSE_ADS: Readonly<Record<string, AdResponse[]>> = Object.freeze({})` and use
     `showInlineAds ? responseAds : EMPTY_RESPONSE_ADS` .
   - In `cli/src/hooks/use-chat-messages.ts` , add
     `const collapseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)` with a helper
     `scheduleCollapseFlagReset()` that clears any existing timeout before scheduling the `0ms` reset, plus a
     `useEffect` unmount cleanup that clears `collapseTimeoutRef.current` .

### Steps

1. Update `desktop/src/lib/diff-parse.ts` and `desktop/src/components/chat/tool-display.ts` to support nested
   `apply_patch` (`input.operation.{type,path,diff}`) and `set_output` collapsed previews, and extend
   `desktop/src/lib/__tests__/diff-parse.test.ts` and `desktop/src/components/chat/__tests__/tool-display.test.ts`
   .
2. Add `agentId` , `parentAgentId` , and `agentLabel` to `ToolBlock` in `desktop/src/state/transcript-types.ts` ,
   populate them in `desktop/src/state/transcript-reducer.ts` , render the subagent badge in
   `desktop/src/components/chat/ToolCard.tsx` , and test in `desktop/src/state/__tests__/transcript-store.test.ts`
   .
3. Add optional operator note input to `desktop/src/components/chat/ApprovalCard.tsx` and thread `note?: string`
   through `desktop/src/components/chat/ChatThread.tsx` and `desktop/src/hooks/use-gateway.ts` into
   `respondApproval` , with unit tests in `desktop/src/components/chat/__tests__/approval-card.test.tsx` .
4. Replace `walkers.find(...)` in `desktop/src/floor/office/scene-frame-loop.ts` with a reusable `walkerById` `Map`
   , and replace direct `document.body.style.cursor` writes in `desktop/src/floor/office/scene-agent-ui.tsx` with
   reference-counted hover cursor helpers (registered in `desktop/test/setup-test-isolation.ts` ).
5. Hoist `EMPTY_RESPONSE_ADS` in `cli/src/chat/use-message-block-sync.ts` and add tracked `collapseTimeoutRef`
   cleanup in `cli/src/hooks/use-chat-messages.ts` , with unit tests in
   `cli/src/hooks/__tests__/use-chat-messages-collapse.test.ts` .

### Verification

- `gate: typecheck desktop`
- `gate: typecheck cli`
- `gate: test desktop/src/lib/__tests__/diff-parse.test.ts`
- `gate: test desktop/src/components/chat/__tests__/tool-display.test.ts`
- `gate: test desktop/src/state/__tests__/transcript-store.test.ts`
- `gate: test desktop/src/components/chat/__tests__/approval-card.test.tsx`
- `gate: test desktop/src/state/__tests__/transcript-tool-attribution.test.ts` (added during execution: the W4-1
  attribution suite lives in its own file — the sibling suites in
  `transcript-store.test.ts` already sit at 273 of the 300-line ceiling)
- `gate: test desktop/src/floor/office/__tests__/scene-frame-loop.test.ts` (added during execution: pins the W4-4
  `O(W)` walker index, which had no declared gate)
- `gate: test cli/src/hooks/__tests__/use-chat-messages-collapse.test.ts`
- `gate: quality`

## Verification Gates

- gate: typecheck desktop
- gate: typecheck cli
- gate: test desktop/src/lib/__tests__/diff-parse.test.ts
- gate: test desktop/src/components/chat/__tests__/tool-display.test.ts
- gate: test desktop/src/state/__tests__/transcript-store.test.ts
- gate: test desktop/src/state/__tests__/transcript-tool-attribution.test.ts
- gate: test desktop/src/floor/office/__tests__/scene-frame-loop.test.ts
- gate: test desktop/src/components/chat/__tests__/approval-card.test.tsx
- gate: test cli/src/hooks/__tests__/use-chat-messages-collapse.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:dad2edb25ce11387e0a5329bc659084adc508bef513b4ec72c7399c5dd981ec7
- verified: 2026-10-14T14:22:14.852Z
- typecheck desktop: exit 0
- typecheck cli: exit 0
- test desktop/src/lib/__tests__/diff-parse.test.ts: exit 0
- test desktop/src/components/chat/__tests__/tool-display.test.ts: exit 0
- test desktop/src/state/__tests__/transcript-store.test.ts: exit 0
- test desktop/src/state/__tests__/transcript-tool-attribution.test.ts: exit 0
- test desktop/src/floor/office/__tests__/scene-frame-loop.test.ts: exit 0
- test desktop/src/components/chat/__tests__/approval-card.test.tsx: exit 0
- test cli/src/hooks/__tests__/use-chat-messages-collapse.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Identified four concrete edge cases across the Desktop and CLI UI changes:
  1. In `desktop/src/lib/diff-parse.ts:127-133` , `apply_patch` in Savant uses
     `{ operation: { type: 'create_file' | 'update_file' | 'delete_file', path: string, diff?: string } }` ,
     whereas existing unit tests in `desktop/src/lib/__tests__/diff-parse.test.ts` may pass flat `{ path, diff }`
     or `{ patch }` .
  2. In `desktop/src/floor/office/scene-agent-ui.tsx` , adding a module-level `hoveredAgentCount` counter in
     `desktop/` will be scanned by `scripts/module-state-check.ts` unless its reset helper is wired in
     `desktop/test/setup-test-isolation.ts` .
  3. In `desktop/src/components/chat/ApprovalCard.tsx` , existing callers (`ChatThread.tsx`, tests) call
     `onRespond(approvalId, skipped)` with 2 arguments; making the 3rd `note?: string` parameter optional preserves
     100% backwards compatibility.
  4. In `desktop/src/components/chat/ToolCard.tsx` (currently 223 lines), adding subagent badge and `set_output`
     preview must stay well below the 300-line ceiling.
- **GREEN:**
  1. `parseDiffInput('apply_patch', inputJson)` checks `input.operation` first and falls back to top-level
     `input.diff ?? input.patch` and `input.path` , supporting both the real runtime `apply_patch` schema and
     legacy flat test fixtures.
  2. Exported `resetHoverCursorState()` from `scene-agent-ui.tsx` (or a small pure helper module) and wired it into
     `desktop/test/setup-test-isolation.ts` .
  3. Kept `note?: string` optional across `ApprovalCard`, `ChatThread`, and `useGateway.respondApproval`.
  4. Kept `set_output` preview extraction in `desktop/src/components/chat/tool-display.ts`
     (`toolCollapsedPreview`), keeping `ToolCard.tsx` concise (~235 lines, well below 300).
- **AUDIT:** Verified `desktop/src/lib/diff-parse.ts:1-141` , `desktop/src/components/chat/ToolCard.tsx:1-223` ,
  `desktop/src/components/chat/ApprovalCard.tsx:1-66` , `desktop/src/hooks/use-gateway.ts:224-233` ,
  `desktop/src/floor/office/scene-frame-loop.ts:1-120` , `desktop/src/floor/office/scene-agent-ui.tsx:1-141` ,
  `cli/src/chat/use-message-block-sync.ts:1-119` , and `cli/src/hooks/use-chat-messages.ts:1-120` .
- **ADVERSARIAL:** What if an `AgentCharacter` component unmounts while `hovered === true` (for example, when a
  spawned subagent finishes and leaves the cast)? **Addressed:** In `scene-agent-ui.tsx` , the `useEffect` only
  calls `acquireHoverCursor()` when `hovered` is `true` , and its cleanup `return () => releaseHoverCursor()` runs
  both when `hovered` flips `true -> false` AND when the component unmounts while `hovered === true` . When
  `hovered` is `false` , the effect does nothing and registers no cleanup, so unmounting an un-hovered agent never
  decrements the counter!
- **CHANGE DELTA:** Initial authoring pass + hover-cursor unmount invariant and `apply_patch` dual-shape support.

### Missed Questions

1. **Question:** Why did `desktop/src/lib/diff-parse.ts` fail to render diffs for real `apply_patch` calls even
   though `'apply_patch'` was in `DIFF_TOOLS` ?
   **Decision:** `diff-parse.ts:128` looked for `input.diff ?? input.patch` at the top level of the JSON input,
   whereas the runtime `apply_patch` tool schema nests `{ operation: { type, path, diff } }` . Supporting both
   `input.operation.{diff,path,type}` and top-level `input.{diff,patch,path}` fixes real runtime `apply_patch`
   cards while keeping existing unit test fixtures green.
2. **Question:** How do we prevent an unmounting `AgentCharacter` with `hovered === false` from decrementing the
   shared hover cursor counter?
   **Decision:** Only call `acquireHoverCursor()` inside `if (!hovered) return` in `useEffect([hovered])` , and
   return `releaseHoverCursor` exclusively from the `hovered === true` branch. That guarantees every `acquire` is
   paired with at most one `release` across both hover-out and unmount transitions.
3. **Question:** Does the Gateway JSON-RPC protocol (`desktop/src/lib/gateway-protocol.ts`) already support
   non-empty `answers` on `approval_response` ?
   **Decision:** Yes. `desktop/src/lib/gateway-protocol.ts:164-184` (`approvalResponseParamsSchema` and
   `approvalResponseRequest` ) already accepts `answers: Array<Record<string, unknown>>` and serializes
   `response: { answers, skipped }` whenever `answers.length > 0 || skipped` . Only the UI (`ApprovalCard.tsx`) and
   hook (`use-gateway.ts`) hardcoded `[]` .

### Implementation Evidence (REQUIRED for `closed`)

> Working-tree implementation (`Status: fixed`); committed closure evidence remains open.

- [x] **Implementation state:** working tree on `main` based on `6e6998b6`,
      uncommitted alongside Waves 1–3. The baseline HEAD is not an implementation
      commit; G2 closure requires the actual implementation commit hash.
- [x] **File:line ranges:**
  - **W4-1** — `desktop/src/state/transcript-types.ts:52-67` (optional `agentId` / `parentAgentId` / `agentLabel`
    on the `kind: 'tool'` block); `desktop/src/state/transcript-reducer.ts:67-95` (both ids captured on
    `tool_call`, `agentLabel` resolved from the matching ACTIVE roster row, the savant row excluded);
    `desktop/src/components/chat/ToolCard.tsx:136-141` + `desktop/src/styles.css:1691-1699` (`.tool-agent-badge`);
    tests `desktop/src/state/__tests__/transcript-tool-attribution.test.ts:1-96` (5 cases: subagent badge, root
    unbadged, orchestrator never badged, finished subagent loses only the badge, unmatched id invents no label).
  - **W4-2** — `desktop/src/lib/diff-parse.ts:133-148` (nested `operation.{type,path,diff}` read FIRST, flat
    `input.diff ?? input.patch` + `input.path` retained for legacy shapes, `delete_file` still degrades to `null`);
    `desktop/src/components/chat/tool-display.ts:56-71` (`setOutputPreview`), `:124-140` (`set_output` and
    `apply_patch` verb+path: `Patch|Create|Delete <path>`), `:210-232` (`setOutputPayloadJson` unwraps `data` for
    the card body); `desktop/src/components/chat/ToolCard.tsx:63-75`; tests
    `desktop/src/lib/__tests__/diff-parse.test.ts` (nested create/update/delete + flat legacy) and
    `desktop/src/components/chat/__tests__/tool-display.test.ts` (preview + payload card).
  - **W4-3** — `desktop/src/components/chat/ApprovalCard.tsx:36-72` (optional single-line note input; Enter
    approves with the note attached); `desktop/src/lib/approval-answers.ts:1-20` (`approvalAnswerPayload`:
    `note ? [{ note }] : []`, split out of the hook for the 300-line ceiling);
    `desktop/src/hooks/use-gateway.ts:226-247` (`respondApproval(approvalId, skipped, note?)`);
    `desktop/src/components/chat/ChatThread.tsx:129,202`; `desktop/src/App.tsx:214-216`;
    `desktop/src/styles.css:1626-1644` (`.approval-note`); tests
    `desktop/src/components/chat/__tests__/approval-card.test.tsx:1-68`.
  - **W4-4** — `desktop/src/floor/office/scene-frame-loop.ts:108-123` (reusable `walkerById` Map, cleared and
    refilled once per step, `walkerById.get(id)` in the children loop);
    `desktop/src/floor/office/scene-agent-ui.tsx:26-58,87-96` (module-level reference count,
    `acquireHoverCursor` / `releaseHoverCursor` / `resetHoveredAgentCursorCount`; only a hovered instance claims
    and registers the cleanup); `desktop/test/setup-test-isolation.ts:18,30` (reset wired into the desktop
    preload); tests `desktop/src/floor/office/__tests__/scene-frame-loop.test.ts:1-186` (per-frame id reads = W,
    unmatched children skipped, order independence, working→idle burst still fires once).
  - **W4-5** — `cli/src/chat/use-message-block-sync.ts:17-23,88` (frozen module-level `EMPTY_RESPONSE_ADS`,
    `showInlineAds ? responseAds : EMPTY_RESPONSE_ADS`).
  - **W4-6** — `cli/src/hooks/collapse-flag-timer.ts:1-35` (`scheduleCollapseFlagReset` replaces the pending
    timer, `clearCollapseFlagReset` on unmount; split out of `use-chat-messages.ts` for the ceiling);
    `cli/src/hooks/use-chat-messages.ts:78-95` (tracked `collapseResetTimerRef`, arming in both collapse
    handlers, unmount cleanup); tests `cli/src/hooks/__tests__/use-chat-messages-collapse.test.ts:142-184`.
  - **Ceiling compliance:** `cli/src/hooks/use-chat-messages.ts` 302 → 298, `desktop/src/hooks/use-gateway.ts`
    313 → 299, `desktop/src/state/__tests__/transcript-store.test.ts` 383 → 276 — three extractions/moves, no
    suppression and no gate weakening.
- [x] **Gate output:** All 10 declared verification gates exit 0 and are stamped in `### Verification Receipt`.
      Additionally green: `bun run quality:report` (1502 baselined files, zero ceiling violations) and
      `bun run scripts/module-state-check.ts` (195 of 200 resettable bindings wired — the new hover-cursor
      counter is one of the wired ones).
- [x] **Reproducibility:** Run
      `bun run fid:verify dev/fids/FID-2026-1013-013-wave4-cli-desktop-ui-qol-enhancements.md`.
- [x] **Step statuses:**
  - Step 1: [COMPLETED] `diff-parse.ts` reads `input.operation.{type,path,diff}` first (real `apply_patch`
    schema) while keeping the flat legacy shapes, and `tool-display.ts` gained `set_output` (message-first, `data`
    unwrapped) plus `Patch|Create|Delete <path>` previews; the two existing suites gained the nested-schema,
    `delete_file`, and payload-card pins.
  - Step 2: [COMPLETED] `agentId` / `parentAgentId` / `agentLabel` added to the tool block, populated on
    `tool_call` from the active roster, badged in `ToolCard`; the W4-1 suite lives in its own file because its
    sibling suites already sit at 273 of the 300-line ceiling (declared as an additional gate).
  - Step 3: [COMPLETED] ApprovalCard note input threaded through `ChatThread` → `useGateway.respondApproval` into
    the existing `approval_response` `answers`; no wire-protocol file changed.
  - Step 4: [COMPLETED] `walkers.find(...)` replaced by the reusable `walkerById` Map and the global cursor write
    replaced by the ref-counted helpers, with the reset wired into the desktop preload (module-state check green).
  - Step 5: [COMPLETED] `EMPTY_RESPONSE_ADS` hoisted and the collapse reset timer tracked, both pinned by tests in
    the declared CLI gate.

### Code Verification Evidence

- [x] Files referenced in Affected Components exist and were read 0-EOF:
      `desktop/src/state/transcript-types.ts:1-105` , `desktop/src/state/transcript-reducer.ts:1-299` ,
      `desktop/src/components/chat/ToolCard.tsx:1-223` , `desktop/src/components/chat/tool-display.ts:1-136` ,
      `desktop/src/lib/diff-parse.ts:1-141` , `desktop/src/components/chat/ApprovalCard.tsx:1-66` ,
      `desktop/src/components/chat/ChatThread.tsx:1-286` , `desktop/src/hooks/use-gateway.ts:1-286` ,
      `desktop/src/lib/gateway-protocol.ts:121-240` , `desktop/src/floor/office/scene-frame-loop.ts:1-281` ,
      `desktop/src/floor/office/scene-agent-ui.tsx:1-141` , `cli/src/chat/use-message-block-sync.ts:1-119` ,
      `cli/src/hooks/use-chat-messages.ts:1-286` .
- [x] Verified `desktop/src/lib/gateway-protocol.ts:164-184` wire schema compatibility for `approval_response`
      `answers` .
- [x] Current status is `fixed` with `implementation_started: true`; the
      pre-implementation checks in the planning loops are historical evidence.

### Loop 2 — Independent audit and self-correction

- **RED:** Checked whether `desktop/scripts/gateway-contract.drift.test.ts` could fail if we touch
  `desktop/src/lib/gateway-protocol.ts` .
- **GREEN:** Because `desktop/src/lib/gateway-protocol.ts:173-184` (`approvalResponseRequest`) ALREADY accepts
  `answers: Array<Record<string, unknown>>` , Wave 4 does not need to modify `gateway-protocol.ts` or
  `gateway-client-requests.ts` at all — only `ApprovalCard.tsx` , `ChatThread.tsx` , and `use-gateway.ts` need to
  pass `note ? [{ note }] : []` into the existing `getClient().respondApproval(approvalId, answers, skipped)`
  method!
- **AUDIT:** Verified `desktop/src/lib/gateway-client-requests.ts:171-180` (`respondApprovalVia` already takes
  `(ctx, approvalId, answers, skipped)` ). Zero wire-protocol files need to be touched.
- **ADVERSARIAL:** What if `apply_patch` has `operation.type === 'delete_file'` (where `operation.diff` is
  undefined)? In `diff-parse.ts` , if `operation.type === 'delete_file'` and `operation.diff` is absent,
  `toolCollapsedPreview` in `tool-display.ts` still formats `Delete <operation.path>` cleanly so the collapsed
  header is always informative.
- **CHANGE DELTA:** ~5% simplification confirming zero edits needed in `gateway-protocol.ts` and handling
  `delete_file` in `apply_patch` preview.

### Loop 3 — Final convergence

- **RED:** Final check of all 5 steps, affected components, and declared verification gates.
- **GREEN:** No further changes needed.
- **AUDIT:** Structural validation against `fid-validator.ts` (`REQUIRED_SECTIONS`, `STRICT_SECTIONS` , 3 answered
  Missed Questions, zero placeholders, standalone `implementation_started: false` ).
- **ADVERSARIAL:** Confirmed Wave 4 depends on Wave 3 (`FID-2026-1013-012`), ensuring `transcript-reducer.ts` has
  ample line headroom before Step 2 adds subagent attribution fields.
- **CHANGE DELTA:** 0% — converged.

## Resolution

**Implemented in the working tree — `Status: fixed`; committed closure evidence remains open.**

Ground-truth audit 2026-10-14 confirms production consumers for the tool-agent
badge (`ToolCard.tsx:139`), output payload renderer (`ToolCard.tsx:67`), approval
answer builder (`use-gateway.ts:237`), walker index (`scene-frame-loop.ts:123`),
stable ad map (`use-message-block-sync.ts:88`), and collapse cleanup
(`use-chat-messages.ts:90`). Declared gates pass. The source changes are
uncommitted, and no live Desktop/TUI smoke is claimed by this audit. Record the
actual implementation commit and final closure evidence before archival.

- **Parent Coordinator:** `FID-2026-1013-009`
- **Findings Owned:** W4-1, W4-2, W4-3, W4-4, W4-5, W4-6

## Lessons Learned

1. **Check the wire protocol before assuming a UI limitation requires a protocol change.** `gateway-protocol.ts`
   and `gateway-client.ts` already supported `answers: Array<Record<string, unknown>>` on `respondApproval` ; only
   `use-gateway.ts` and `ApprovalCard.tsx` hardcoded `[]` .
2. **Coordinate global DOM side-effects (`document.body.style.cursor`) across multi-instance R3F components with a
   reference counter, not raw boolean overwrite.** Pairing `acquire` and `release` inside the `hovered === true`
   effect branch eliminates inter-instance cursor clobbering.
