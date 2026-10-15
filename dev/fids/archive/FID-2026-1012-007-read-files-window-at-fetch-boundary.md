# FID: read_files serves line windows at the fetch boundary

**Filename:** `FID-2026-1012-007-read-files-window-at-fetch-boundary.md`
**ID:** FID-2026-1012-007
**Severity:** high
**Status:** closed
**Created:** 2026-10-12
**Automation level:** 3
**YAGNI-Compliance:** Verified

## Summary

`read_files` advertises `offset`/`limit`, but the SDK truncates a file at
`READ_FILES_MAX_CHARS` before the runtime handler ever slices lines. Any window
past that prefix therefore returned nothing while the data existed. This record
implements candidate `LF-001` of the lesson-driven feature pipeline.

## Environment

- **Commit/State:** `303c683838ad1fa2f1eea1c209dea1fff0ac360d`; G2 field
  reconciled 2026-10-14 from the existing implementation evidence below.

- Windows, Bun 1.3.14, TypeScript monorepo, initial HEAD `57d1d06d`.
- Candidate source: `dev/feature-pipeline/candidates.json` `LF-001` (P1,
  `ready`, `observed-gap`), itself derived from the lesson "Files over the
  100k-character tool read limit break every in-place edit path".

## Detailed Description

### Problem and expected behavior

A windowed read must return the requested lines whenever they exist, and the
response must stay bounded. Today the cap is applied first and the window
second, so `offset` past the cap is not a window at all — it is an empty
result. The measured instance: `dev/LEARNINGS.md` has 2,147 lines, its
100k-character prefix holds 1,552, and `offset: 1750` returned an empty
string even though those lines were on disk.

### Root cause and evidence

- `sdk/src/tools/read-files.ts:88-101` read the whole file, sliced
  `content.slice(0, MAX_CHARS)` and appended the `FILE_TOO_LARGE` notice.
- `packages/agent-runtime/src/tools/handlers/tool/read-files.ts:74-79`
  applied `sliceLines(file.content, offset, limit)` to what the SDK had
  already truncated, and `sliceLines` itself only ever saw that prefix.
- The window therefore had two owners and neither held the complete content:
  `getFileReadingUpdates` (`packages/agent-runtime/src/get-file-reading-updates.ts:17`)
  requested paths without a window, so the fetch boundary could not know what
  page was wanted.
- `docs`/schema were already correct: `common/src/tools/params/tool/read-files.ts`
  declares the 1-indexed `offset`/`limit`, so the defect is purely in the
  fetch/slice order.

## Impact Assessment

High: the tool's documented large-file escape hatch silently returned nothing,
which pushed agents back into whole-file reads and failed in-place edits on
every file over the cap. It also made the lesson ledger's own tail unreadable
through the tool the ledger tells you to use.

## Proposed Solution

1. Extract the window into one shared, newline-exact function
   (`common/src/util/read-window.ts`) with pages that concatenate back to the
   original content.
2. Carry the window in the file request itself — `RequestFilesFn` gains
   optional `offset`/`limit`, `getFileReadingUpdates` forwards them, and the
   SDK's `readFiles`/`getFiles` serve them on the complete content before the
   cap.
3. Let whoever holds the complete content own the window: the SDK boundary
   windows filesystem reads (and hands the window to an `overrideTools`
   implementation, which owns its own response), while the runtime handler
   windows only the embedded grounding reads that never cross that boundary.
   Re-slicing an already-windowed response is the one failure mode this rule
   exists to prevent.
4. Keep the existing safety envelope: traversal refusal, gitignore filtering,
   the 10MB skip and the response cap are untouched and re-pinned.

### Verification

Hermetic suites at three levels: the shared extractor (boundaries,
past-EOF, non-positive limit, `>100k` reconstruction with a matching
SHA-256), the SDK boundary (a window past the cap returns the real lines;
the cap still applies; the 10MB and ignored-file rules still apply; an
unwindowed read keeps the previous notice; the override receives the
window), the runtime handler (the window reaches `requestFiles`, the response
is not sliced twice, embedded reads are windowed locally), and the composed
seam production actually runs: the runtime handler wired to the SDK boundary
exactly as `agent-runtime-impl.ts` wires it, windowing a real 3,000-line file
on disk past the cap. The third acceptance criterion (a window past the 100k
prefix returns the real lines through the production SDK/runtime path) is
asserted in that composed flow, not only in its two halves.

## Verification Gates

- gate: typecheck common
- gate: typecheck sdk
- gate: typecheck packages/agent-runtime
- gate: test common/src/__tests__/read-window.test.ts
- gate: test sdk/src/__tests__/read-files-window.test.ts
- gate: test packages/agent-runtime/src/tools/handlers/__tests__/read-files-window.test.ts
- gate: test packages/agent-runtime/src/tools/handlers/__tests__/read-files.test.ts
- gate: test packages/agent-runtime/src/__tests__/get-file-reading-updates.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:1c95be4cf0b71d1022f1a7a43e978e9ee4d90202f7dab6379ab7bc80550d6da8
- verified: 2026-10-12T20:57:18.858Z
- typecheck common: exit 0
- typecheck sdk: exit 0
- typecheck packages/agent-runtime: exit 0
- test common/src/__tests__/read-window.test.ts: exit 0
- test sdk/src/__tests__/read-files-window.test.ts: exit 0
- test packages/agent-runtime/src/tools/handlers/__tests__/read-files-window.test.ts: exit 0
- test packages/agent-runtime/src/tools/handlers/__tests__/read-files.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/get-file-reading-updates.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED / GREEN / AUDIT / ADVERSARIAL

RED: the two consumers of `read_files` content were inspected before any edit —
the fetch boundary (`sdk/src/tools/read-files.ts`) and the slice site
(`packages/agent-runtime/src/tools/handlers/tool/read-files.ts`) — and the
window was proved unreachable past the cap by measurement, not inference
(2,147 ledger lines vs 1,552 inside the cap).

GREEN: one shared helper plus an optional field on an existing request type.
No new tool, no second read path, no widened authority: the safety rules that
already guarded the read (traversal, gitignore, 10MB, cap) stay exactly where
they were.

AUDIT: three real hazards. (a) Two slicers on one value — the defect being
fixed — so the window must have exactly one owner per byte range. (b) The
`overrideTools.read_files` surface replaces the tool wholesale; assuming it
honours a window the SDK never used to send would be a fiction, so the window
travels in its input and its response is used verbatim. (c) Newline handling:
the old mid-file window dropped the separator, so pages could never
concatenate — reconstruction is asserted, not assumed.

ADVERSARIAL: does moving the slice into the SDK quietly change unwindowed
behavior? No — an unwindowed read takes the previous branch verbatim
(re-pinned, including the truncation notice text). Does the change let a
window escape the cap? No — the cap is applied to the selected page, and a
page larger than the cap is still truncated and labelled. Is a 10MB file now
read to window it? No - the size gate runs before `readFile`, for windowed and
unwindowed reads alike.

Converged; implementation proceeded under recorded automation level 3.

### Missed Questions

- Is the trailing separator a breaking change? It changes only a mid-file
  window's last byte, and that is exactly what makes pages additive; every
  other case is asserted unchanged.
- Should the override be windowed by the SDK instead? No — the override owns
  its response, and post-processing its output would corrupt non-content status
  values it is allowed to return.
- Does the tool description need updating? No; it already promised line
  windows, and this record makes the implemented behavior match it.

## Resolution

### Code Verification Evidence

Commits `303c6838` and `e3bea01e` (the ceiling split that moved `requireCwd`
into `sdk/src/run/require-cwd.ts` verbatim, no behavior change).
The window travels with the request
(`common/src/types/contracts/client.ts` `RequestFilesFn`), is forwarded by
`packages/agent-runtime/src/get-file-reading-updates.ts:21-28`, served at the
SDK boundary (`sdk/src/tools/read-files.ts:97-98`, cap applied to the selected
page at :99-101) and windowed locally for embedded grounding reads
(`packages/agent-runtime/src/tools/handlers/tool/read-files.ts:72-77`).
`sliceLines` is now the shared `extractLineWindow` (`:28`), so the runtime and
the SDK cannot slice differently.

Production reachability: `handlers/list.ts:112` registers `read_files` →
`handleReadFiles` → `getFileReadingUpdates` → `requestFiles`
(`sdk/src/run/agent-runtime-impl.ts:112-119`) → `readFiles`
(`sdk/src/run/tool-call.ts:60-75`) → `getFiles`. `readFiles` is the only
windowed caller; `requestOptionalFile` (`:120-127`) intentionally passes none.
The CLI's `overrideTools` block (`cli/src/utils/savant-code-client.ts:76-118`)
overrides only `ask_user`, so the production CLI uses the SDK boundary.

Focused verification: 9 pass (shared extractor), 9 pass (SDK boundary,
including the handler → SDK seam on a real file), 20 pass across the four
runtime files it touches — 0 fail. Full workspace suites after the change:
common 853 pass / 4 skip, SDK 619 pass / 1 skip, agent-runtime 2020 pass, all
0 fail. Root typecheck, ESLint, Markdown lint,
formatting, `quality:report` and `validate:repository` pass.

Boundaries recorded honestly: an `overrideTools.read_files` implementation that
ignores the window it now receives returns the whole bounded file it always
returned (more content, never wrong content); no live interactive `read_files`
call from a model was observed in this session; and the aggregate `bun run ci`
red is the separately characterized Savant-Free disposition, not this change
(see FID-2026-1012-004's closure note).

## Lessons Learned

A windowed read has exactly one owner: whoever still holds the complete
content. Truncating first and slicing second turns "read this page" into
"read nothing" while every unit test of the slicer stays green — the bug lives
in the order of two correct components.
