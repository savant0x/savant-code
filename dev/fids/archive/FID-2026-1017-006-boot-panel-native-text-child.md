# FID: boot free-options panel crashes on a bare text child in the native reconciler

**Filename:** `FID-2026-1017-006-boot-panel-native-text-child.md`
**ID:** FID-2026-1017-006
**Severity:** high
**Status:** closed
**Created:** 2026-10-17 14:40
**Automation level:** 3
**YAGNI-Compliance:** Verified — one stray child removed and one native-render
pin added; no new component, dependency or API.

---

## Summary

FID-2026-1017-005 replaced the boot digest with a `TrafficLightPanel` block, but
left a literal `{' '}` string child directly inside the panel's `box` chrome.
OpenTUI's reconciler rejects text outside a `<text>` node, so every real boot
threw `Text must be created inside of a text node` inside `FreeOptionsPanel`.
The transcript error boundary caught it and rendered its fallback — the
"session is still active" line plus `JSON.stringify(blocks)` — so the user's
first screen was raw JSON (`[{"type":"free-options",...}]`) instead of the
panel. The shipped static-markup suite passed because `react-dom/server` treats
`box`/`text` as custom elements and accepts any child, so the invalid tree was
only invalid on the reconciler that actually renders it.

## Environment

- **OS:** win32 (Git Bash)
- **Language/Runtime:** TypeScript strict, Bun 1.3.14
- **Tool Versions:** repository pin per `package.json` / `bun.lock`
- **Commit/State:** `main` @ `40f45311` (FID-005 closure), dirty only with the
  operator's blueprint file and this fix

## Detailed Description

### Problem

Boot renders the free-options block as a transcript fallback containing the
serialized block instead of the panel:

```text
This content could not be displayed. Your session is still active.
[{"type":"free-options","id":"free-options-1792261702202","snapshot":{...
```

### Expected Behavior

Boot shows the collapsed panel header (`Free options — fresh · cached 3h ago`,
the counts line, the export status and the resolved `free-options.md` path) and
expanding it mounts every lane and offer. No fallback, no serialized block.

### Root Cause

`cli/src/components/free-options-panel.tsx` opened `TrafficLightPanel` with a
spacer string child:

```tsx
<TrafficLightPanel>
  {' '}
  <CopyableBlock …>
```

`TrafficLightPanel` renders children inside a `<box>`
(`cli/src/components/traffic-light-panel.tsx:50-59`), and OpenTUI's
`createTextInstance` throws for a string child of a non-text host
(`@opentui/react` chunk `createTextInstance`). The error boundary in
`containTranscriptNodes` (`cli/src/components/blocks/transcript-boundary.tsx:24`)
catches it and prints `JSON.stringify(blocks)` as the fallback preview, which is
exactly the junk the user saw.

The reason CI stayed green: `cli/src/components/__tests__/free-options-panel.test.tsx`
renders through `react-dom/server`, where lowercase hosts are emitted as custom
elements and host invariants are not enforced. The repo already had a native
renderer harness (`@opentui/core/testing` + `createRoot`) for exactly this class
of defect, but the panel had no native pin.

### Evidence

`debug/cli.jsonl` (dev sink, rendered by the live TUI):

```json
{"level":"ERROR","timestamp":"2026-10-17T18:28:22.228Z","data":{
 "componentName":"Transcript:sys-1792261702202:0",
 "error":"Text must be created inside of a text node",
 "stack":"Error: Text must be created inside of a text node\n    at createTextInstance (...@opentui/react/chunk-vx8rm66p.js:443:22)",
 "componentStack":"\n    at box (<anonymous>)\n    at box (<anonymous>)\n    at TrafficLightPanel (...traffic-light-panel.tsx:29:17)\n    at box (<anonymous>)\n    at FreeOptionsPanel (...free-options-panel.tsx:25:3)"}}
```

Four identical hits across two boots (18:27:39, 18:28:10, 18:28:12, 18:28:22).

## Impact Assessment

### Affected Components

- `cli/src/components/free-options-panel.tsx` (fix)
- `cli/src/components/__tests__/free-options-panel.render.test.tsx` (new native pin)

### Risk Level

- [ ] Critical
- [x] High — the first screen of every boot was an error fallback plus raw JSON;
  no workaround inside the panel (the block could not be displayed at all).
- [ ] Medium
- [ ] Low

## Proposed Solution

### Approach

Delete the bare spacer child; the title bar already provides the panel's top
spacing. Add native-reconciler pins (collapsed and expanded) so any illegal host
tree in this panel fails in the suite that runs on the same renderer as
production.

### Steps

1. Remove the `{' '}` child from `TrafficLightPanel` in
   `free-options-panel.tsx`. — implemented
2. Add `free-options-panel.render.test.tsx` mounting the panel on
   `@opentui/core/testing` within an `ErrorBoundary`, asserting the collapsed
   frame shows the header and path and neither the boundary fallback nor
   `{"type":"free-options"`, and that the expanded frame shows model ids and an
   offer. — implemented
3. Prove the pin has teeth: re-adding `{' '}` fails both native tests
   (2 fail / 0 pass), removing it passes (2 pass / 0 fail). — implemented

### Verification

- `cli/src/components/__tests__/free-options-panel.render.test.tsx` (new, native).
- `cli/src/components/__tests__/free-options-panel.test.tsx` (static pins still
  hold after the child is gone).
- `cli/src/hooks/__tests__/use-chat-messages-collapse.test.ts` (collapse by id
  unaffected).
- CLI typecheck and the repo quality gate.

## Verification Gates

- gate: typecheck cli
- gate: test cli/src/components/__tests__/free-options-panel.render.test.tsx
- gate: test cli/src/components/__tests__/free-options-panel.test.tsx
- gate: test cli/src/hooks/__tests__/use-chat-messages-collapse.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:d0e34cee3461bce9de0ba10e49773cbe434c162c431004f13c0baf77e84becdb
- verified: 2026-10-17T18:35:32.270Z
- typecheck cli: exit 0
- test cli/src/components/__tests__/free-options-panel.render.test.tsx: exit 0
- test cli/src/components/__tests__/free-options-panel.test.tsx: exit 0
- test cli/src/hooks/__tests__/use-chat-messages-collapse.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Live log shows `Text must be created inside of a text node` at
  `free-options-panel.tsx:25` (the `TrafficLightPanel` open) on every boot; the
  boundary fallback prints `JSON.stringify(blocks)`.
- **GREEN:** The stray `{' '}` child is removed; a native-render pin mounts the
  panel on the production reconciler in both collapsed and expanded states.
- **AUDIT:** `grep -n "{' '}" cli/src/components/free-options-panel.tsx` returns
  no match; the native suite passes 2/2; the static suite and collapse suite
  still pass (15 pass / 0 fail across the three files).
- **ADVERSARIAL:** A static-markup render proves nothing about host legality —
  the same test file passed with the defect present. The pin therefore renders
  through `@opentui/core/testing`, the same reconciler whose
  `createTextInstance` threw.
- **CHANGE DELTA:** 100% (initial authoring).

### Missed Questions

1. **Why did the shipped test not catch it?** It renders with
   `react-dom/server`; unknown lowercase hosts become custom elements, so
   `box{' '}` is accepted. Host invariants need a native pin.
2. **Is the spacer needed for layout?** No. `TrafficLightPanel` already renders a
   title bar row above the content box and the inner `box` has its own padding;
   the stray space only added a text node that was illegal.
3. **Are there other bare string children in boot surfaces?** A search for
   `{' '}` / bare text in the free-options panel and the compaction-summary block
   finds none; both panel chromes now mount natively in tests.
4. **Should the boundary print the whole block as JSON?** It remains the
   diagnostic preview (bounded to 2000 chars). With the host tree legal again it
   is no longer the first screen; changing the fallback's shape is a separate
   design question and is not needed for this fix.
5. **Does the fix change the rendered panel?** Only the deletion of one leading
   space inside the content box; the header, counts, path and expansion are
   unchanged.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** `907e04f8` (fix + native pin)
- [x] **File:line ranges:** `cli/src/components/free-options-panel.tsx:61-65`
      (no bare child; comment states the invariant);
      `cli/src/components/__tests__/free-options-panel.render.test.tsx:1-133`
      (native harness, collapsed and expanded pins)
- [x] **Gate output:** typecheck cli exit 0; native suite 2 pass / 0 fail;
      static panel suite + collapse suite 15 pass / 0 fail; quality PASS.
      Negative control: with `{' '}` re-added the native suite reports
      2 fail / 0 pass.
- [x] **Reproducibility:** `grep -rn "No bare string child" cli/src/components`
      finds the fix; `bun test src/components/__tests__/free-options-panel.render.test.tsx`
      from `cli/` reproduces the guard.
- [x] **Step statuses:** step 1 implemented, step 2 implemented, step 3
      implemented (negative control run and recorded above).

### Code Verification Evidence

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution
- [x] Typecheck/tests/lint pass with pasted tool output
- [x] Production call-graph evidence is present for new or repaired wiring
- [x] FID status reflects the actual implementation state

## Resolution

- **Closed Date:** 2026-10-17 14:52
- **Fix Description:** The stray `{' '}` string child inside `TrafficLightPanel`
  in `FreeOptionsPanel` is removed, so the block mounts on OpenTUI's reconciler
  instead of throwing and being replaced by the transcript fallback. A native
  render suite now mounts the panel collapsed and expanded on
  `@opentui/core/testing` and rejects the fallback, the raw block JSON, or a
  missing header.
- **Tests Added:** `cli/src/components/__tests__/free-options-panel.render.test.tsx`
  (2 native pins, proven red without the fix).
- **Verification Evidence:** `bun run fid:verify` — all 5 declared gates exit 0
  (`typecheck cli`, the two panel suites, the collapse suite, `quality`);
  negative control 2 fail with the child restored; static panel and collapse
  suites 15 pass / 0 fail. Beyond the fixture pins, the operator's real cached
  report (3 wired lanes / 146 models / 2 not-wired tiers / 1 local / 223 offers,
  artifact `ok`) was mounted on the native reconciler at 120 columns in both
  states: the frame carried `Free options — fresh · cached 1h ago`, the counts
  line and the expanded sections, with no boundary fallback and no
  `{"type":"free-options"` text.
- **Archived:** 2026-10-17 14:52

## Lessons Learned

A UI tree can be valid for `react-dom/server` and illegal for the renderer that
ships it. Any transcript block rendered through OpenTUI needs at least one pin
on the native reconciler — static markup is a text assertion, not a host
contract. The same boot surface that motivated FID-005 also proves the rule:
the suite that "verified" the panel could not see the defect the user saw.
