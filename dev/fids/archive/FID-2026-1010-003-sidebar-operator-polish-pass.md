# FID: Sidebar operator polish — wordmark headroom, grouped token counts, dropped `.0k`

**Filename:** `FID-2026-1010-003-sidebar-operator-polish-pass.md`
**ID:** FID-2026-1010-003
**Severity:** low
**Status:** verified
> Historical implementation verification only; the operator later cancelled
> sidebar work. This record is archived-declined; no sidebar acceptance is claimed.
**Created:** 2026-10-10 20:25
**Updated:** 2026-10-10 21:39
**Automation level:** 3
**YAGNI-Compliance:** Verified

---

## Summary

Operator feedback on the live sidebar (2026-10-10) during the
FID-2026-1009-008 cyberdeck preview effort: the `Savant` wordmark has no breathing room
above it (its two font rows start on the sidebar's first row), the Cache row's
token sample prints ungrouped numbers (`1923.8k/2265.5k`) while the Context row
directly beneath it prints grouped ones (`1,923,800/2,265,500`), and every
exact-thousand count ends in a noisy `.0k` (`1.0k`, `2.0k`, `1000.0k`).

## Environment

- **OS:** Windows 11 (bash / Git Bash)
- **Language/Runtime:** TypeScript (strict), Bun 1.3.14
- **Tool Versions:** @opentui/core (ascii-font element), React 19
- **Commit/State:** working tree, uncommitted, after the FID-2026-1009-008 loop

## Detailed Description

### Problem

Three visual defects on the right sidebar:

1. The wordmark occupies the header's first two rows with zero empty rows above
   them; the only vertical reserve in `SidebarHeader` sits *below* the mark, so
   the eye gets no separation from the sidebar's top border.
2. `formatTokens` produced `1923.8k` / `2265.5k` — no thousands separator — on
   the Cache row, while `contextDisplay` in `right-sidebar-display.ts` produced
   `1,923,800/2,265,500` for the same underlying numbers. Two rows of the same
   panel disagreed about how to group digits.
3. `formatTokens` always emitted one decimal, so exact thousands printed
   `1.0k`, `2.0k`, and `1000.0k`.

### Expected Behavior

1. One empty row above the wordmark.
2. The Cache sample reads `85% (1,923.8k/2,265.5k)`, grouping like the Context
   row.
3. Exact thousands read `1k`, `2k`, `1,000k` — no `.0`.

### Root Cause

1. `SidebarHeader` renders the logo into a shrinking column box whose only
   child spacer is placed after the logo, documented as the fold-button
   height reserve (FID-2026-0915-002's split).
2. `formatTokens` used `(tokens / 1000).toFixed(1)` — no grouping, and
   `toFixed(1)` cannot express "no decimals".

A **second operator report arrived mid-pass** (2026-10-10, while the sidebar
work was in flight): the kiosapi `step-5-preview` model showed a 200k context
window when its real window is 1M. That is the same defect class as the
already-recorded `qwen3.8-flash-free` row — an id with no
`KIOSAPI_CONTEXT_WINDOW_FALLBACKS` row falls through
`getContextWindowFallback` to `CONTEXT_WINDOW_DEFAULT` (200,000, flagged
`source: 'default'`), a 5x undersize that steers compaction with the wrong
denominator.

## Second Report — kiosapi `step-5-preview` window (200k vs 1M)

### Problem

The operator's running model, `kiosapi/step-5-preview`, resolved to the 200k
default because **neither it nor its `-free` variant had a row** in
`context-window-table-kiosapi.ts`.

### Evidence

Live OpenRouter API read 2026-10-10 (`/api/v1/models?q=step-5-preview`) for
upstream `stepfun/step-5-preview`:

```json
"context_length": 1000000,
"top_provider": { "context_length": 1000000, "max_completion_tokens": 64000 },
"architecture": { "modality": "text+image+video->text",
                  "input_modalities": ["text","image","video"] }
```

Resolution measured before the change, and after:

```text
before  kiosapi/step-5-preview      {"contextWindow":200000,"source":"default"}
before  kiosapi/step-5-preview-free {"contextWindow":200000,"source":"default"}
after   kiosapi/step-5-preview      {"contextWindow":1000000,"source":"fallback-table"}
after   kiosapi/step-5-preview-free {"contextWindow":1000000,"source":"fallback-table"}
```

### Fix

Two rows added to `KIOSAPI_CONTEXT_WINDOW_FALLBACKS` — the bare id and the
`-free` id — at 1,000,000, per the file's row-value rule (single source where
one publishes; KiosAPI itself publishes no window fields). Both ids are pinned
because KiosAPI serves both, matching the existing `grok-4.5` /
`grok-4.5-free` precedent.

### Multimodality

The operator also noted the model is multimodal. Modality is **not** statically
registered anywhere in this repo — it is live-derived at runtime from the
cached OpenRouter catalog (`openrouter.ts` reads `architecture.modality`,
`types.ts` declares the field, `model-info.ts` surfaces it as
`- **Modalities:** …`). So no code change is required for multimodality; the
capability flows through the live path. Recording it here so it is not
mistaken for an omission.

### Evidence

Ground truth captured by rendering the production sidebar through
`@opentui/core/testing` (`dev/scratchpad/active/probe-logo-geometry.tsx`), not
inferred from source:

```text
=== FULL SIDEBAR (h=44) ===
 0 |CHAT                           ╭───╮      █▀▀ ▄▀█ █ █ ▄▀█ █▄ █ ▀█▀
                                    │ » │      ▄▄█ █▀█ ▀▄▀ █▀█ █ ▀█  █
                                    ╰───╯
 11 |│   Cache         85% (1923.8k/2265.5k) │
 43 |│  Context · 1,923,800/2,265,500 · 85%  │
```

Row 0 carries the sidebar border, the fold button, **and the wordmark** — the
wordmark has no empty row above it. Row 11 (ungrouped) and row 43 (grouped)
render the same numbers two different ways.

Formatter behaviour measured before the change:

```text
formatTokens(1000)     -> "1.0k"      formatTokens(1923800) -> "1923.8k"
formatTokens(2000)     -> "2.0k"      formatTokens(2265500) -> "2265.5k"
formatTokens(1000000)  -> "1000.0k"
```

A second probe (`bun -e`, `measureText` over the whole bundled font table)
established that the perceived "vertical stretch" of the wordmark is **inherent
to the font geometry**, not a layout defect: rendering `Branding` inside parent
heights 3, 6, and 10 produced byte-identical frames — the `<ascii-font>`
element never stretches to fill its parent — and `tiny` is the only 2-row font
in the bundle (`tiny` 24×2; the other six are 6–11 rows).

```text
tiny    w= 24 h= 2    block  w= 57 h= 6    huge   w= 89 h=11
slick   w= 38 h= 6    pallet w= 38 h= 6    grid   w= 29 h= 6
shade   w= 29 h= 8
```

Operator ruling 2026-10-10 on this evidence: **keep the `tiny` wordmark as-is**
(the six-row fonts do not fit the 36-column sidebar content width; `grid` and
`shade` do fit but add real vertical bulk). That finding is recorded here so it
is not re-litigated.

## Impact Assessment

### Affected Components

- `cli/src/components/right-sidebar-header.tsx` — wordmark headroom
- `cli/src/components/right-sidebar-format.ts` — `formatTokens`
- `cli/src/components/__tests__/right-sidebar-cache.test.tsx` — Cache row pins
- `cli/src/components/__tests__/right-sidebar-format.test.ts` — formatter pins
- `common/src/constants/context-window-table-kiosapi.ts` — kiosapi
  `step-5-preview` / `-free` window rows (second operator report, same pass)
- `cli/src/utils/openrouter-models/__tests__/window-truth-kiosapi.test.ts` —
  the step-5-preview window regression pins

### Risk Level

- [ ] Critical
- [ ] High
- [ ] Medium
- [x] Low: Cosmetic polish on two rows; no behavioural, data, or protocol
      surface changes. `formatTokens` has exactly four call sites, all inside
      `right-sidebar-format.ts` (verified by grep) — `formatCacheUsage` and the
      two compaction labels — so the blast radius is the two rows it already
      feeds.

## Proposed Solution

### Approach

Minimal, surgical edits. No new module, no new dependency: grouping is done with
the `Intl` API that `right-sidebar-display.ts` already uses for the very same
numbers, so both rows derive from one convention.

1. Add one empty row above the wordmark in `SidebarHeader`, keeping the
   documented fold-button reserve below it.
2. Rewrite `formatTokens` to group the integer part and drop a trailing zero.
3. Pin the new formatter behaviour directly (it currently has no unit pins of
   its own) and update the three existing Cache-row pins plus the compaction
   pin that encode the old `.0k` output.

### Steps

1. `SidebarHeader` — insert a 1-row spacer above `<EasterEggLogo />`.
2. `formatTokens` — group and trim; keep the < 1000 fast path so counts like
   `850` stay bare.
3. Add `describe('formatTokens …')` unit pins.
4. Update `right-sidebar-cache.test.tsx` and `right-sidebar-format.test.ts`.
5. Register the new write surface in `SCOPE.md`.
6. Verify: typecheck `cli`, eslint, prettier, and the two sidebar suites, then
   re-render the probe to confirm the Cache row still fits on one line.

### Missed Questions

1. *Does adding 2 characters to the Cache value overflow the 36-column row?*
   → Not assumed — the row is verifiable. The change was made and then the
   production sidebar re-rendered through `@opentui/core/testing` to confirm
   the value still fits inside the border with no wrap or truncation.
2. *Should exact-thousand counts instead switch to `M` notation at 1e6?*
   → No. The existing k-only convention is deliberate and documented
   ("Beyond 1000 stays k — intentionally no M"), and changing it would alter
   the Context readout's semantics. Commas plus a trimmed decimal satisfy the
   operator's two complaints (`1,000k`) without touching that policy.
3. *Is the `.0` ever load-bearing?*
   → No. It is a formatting artifact of `toFixed(1)`; `1923.8k` already proves
   decimals survive where they carry information.
4. *Does the extra header row collide with the fold button?*
   → No. The fold button is absolutely positioned at `left={-3}` (outside the
   sidebar content) and the header column is a separate flex child; the
   re-render confirms the button's three rows and the spacer coexist with the
   wordmark moving from row 0 to row 1.

## Verification Gates

- gate: typecheck cli
- gate: test cli/src/components/__tests__/right-sidebar-cache.test.tsx
- gate: test cli/src/components/__tests__/right-sidebar-format.test.ts
- gate: test cli/src/components/__tests__/right-sidebar-single-home.test.tsx
- gate: test cli/src/components/__tests__/right-sidebar-responsive.test.tsx
- gate: test cli/src/components/__tests__/right-sidebar-phase-color.test.tsx
- gate: test cli/src/utils/openrouter-models/__tests__/window-truth-kiosapi.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:92870a43fc7d90c35c08faca8aa79e5e16fa641b983de29bd3990b3d7caf0471
- verified: 2026-10-11T04:44:26.690Z
- typecheck cli: exit 0
- test cli/src/components/__tests__/right-sidebar-cache.test.tsx: exit 0
- test cli/src/components/__tests__/right-sidebar-format.test.ts: exit 0
- test cli/src/components/__tests__/right-sidebar-single-home.test.tsx: exit 0
- test cli/src/components/__tests__/right-sidebar-responsive.test.tsx: exit 0
- test cli/src/components/__tests__/right-sidebar-phase-color.test.tsx: exit 0
- test cli/src/utils/openrouter-models/__tests__/window-truth-kiosapi.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Operator-reported cosmetic defects (no headroom above the wordmark,
  ungrouped cache numbers, `.0k` noise) plus the ambiguous fourth complaint
  ("stretched vertically"), which required measurement before any action.
- **GREEN:** Spacer row added; `formatTokens` rewritten to `Intl.NumberFormat`
  with `maximumFractionDigits: 1` (which drops the trailing `.0` and groups the
  integer part in one move); unit pins added; the three stale Cache-row pins
  and the compaction pin updated.
- **AUDIT:** Typecheck `common` + `cli` exit 0; eslint `--max-warnings 0` exit 0
  on all touched files; prettier `--check` exit 0. Sidebar suites 17/17
  (cache 6 + format 11). Window suites 6/6 (kiosapi) and 29/29 (window-truth,
  context-window-fallbacks, router-gaps). Sidebar frame suites 3/3
  (single-home, responsive, phase-color) — confirming the added header row
  broke no frame pin.
- **ADVERSARIAL:** Self-inflicted regression caught and repaired mid-pass: a
  careless full-file rewrite of `right-sidebar-format.ts` corrupted the
  `pruned` case's band argument to
  `bandOf(status.tokensSaved ?? 0 ? status.percentUsed : undefined)`, which
  would have silently dropped the color band whenever a pruned pass saved zero
  tokens (FID-2026-0814-006 behaviour). Restored to `bandOf(status.percentUsed)`
  and guarded with a new pin asserting a zero-save pruned pass still carries
  its band. Lesson: the Law 3 verify-before-re-edit block was what forced the
  pause that caught it.
- **CHANGE DELTA:** ~120 lines added across 6 files (2 source, 2 test, 1
  table, 1 probe), plus the FID and SCOPE register entries.

### Code Verification Evidence

FID-2026-1010-004 repair: the gate block and receipt above were previously
wrapped in a fenced `markdown` example copied from the FID template, so
`parseVerificationGates` saw no declarations (reported as "no verification gates
declared") and the placeholder `sha256:<machine-generated>` receipt was never
machine-written. The fence is removed; the ephemeral
`dev/scratchpad/active/probe-logo-geometry.tsx` probe gate is dropped because
scratch paths are gitignored and not a valid declaration target; the receipt is
re-stamped by `bun run fid:verify … --write` against live gate output.

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution
- [x] Typecheck/tests/lint pass with pasted tool output (receipt above)
- [x] Production call-graph evidence is present for new or repaired wiring
- [x] FID status reflects the actual implementation state

### Loop 2 — Independent audit and self-correction

- **RED:** Gate-declaration drift — this FID initially declared
  `- gate: test cli/src/components/__tests__/right-sidebar-densities.test.tsx`,
  a path that does not exist (that suite is covered by
  `right-sidebar-responsive.test.tsx`). `fid:verify` requires every declared
  test gate to exist, so the receipt would have been rejected.
- **GREEN:** Gate list corrected to the five real suites plus the kiosapi
  window suite and the geometry probe.
- **AUDIT:** Each declared gate re-run and passing (see Loop 1 AUDIT).
- **ADVERSARIAL:** The Cache-row width question was answered empirically rather
  than assumed — the re-rendered sidebar shows
  `│   Cache         85% (1,923.8k/2,265.5k) │` still inside the border on one
  line, so the two added characters cost no wrap.
- **CHANGE DELTA:** Gate block only.

### Loop 3 — Final convergence

- **RED:** No outstanding defects. Both operator reports are implemented and
  pinned.
- **GREEN:** n/a.
- **AUDIT:** All declared gates green.
- **ADVERSARIAL:** Residual challenge — `formatTokens` now depends on
  `Intl.NumberFormat('en-US')`. Mitigation: the locale is explicit, so the
  output is environment-independent; `right-sidebar-display.ts` already uses
  the same convention for the same numbers, so the two rows share one truth
  (Law 13). Full-ICU availability in the Bun runtime is confirmed by the
  passing `grouping is locale-pinned` pin.
- **CHANGE DELTA:** 0%.

## Resolution

- **Closed Date:** Pending (local path-scoped commit and closure record not yet
  recorded. Under the 2026-10-11 G1 ruling, the commit needs no separate
  authorization; push remains explicitly authorization-gated.)
- **Fix Description:** (1) One empty row added above the wordmark in
  `SidebarHeader`, with the fold-button reserve preserved below it.
  (2) `formatTokens` rewritten to group thousands and drop the trailing `.0`.
  (3) `KIOSAPI_CONTEXT_WINDOW_FALLBACKS` gained `step-5-preview` and
  `step-5-preview-free` rows at 1,000,000, fixing the operator's 200k-vs-1M
  report.
- **Tests Added:** Yes — a `describe('formatTokens …')` block (5 pins) and a
  `describe('step-5-preview resolves 1M …')` block (2 pins); the three stale
  Cache-row pins and the compaction pin were updated to the new output.
- **Verification Evidence:** typecheck `common`+`cli` exit 0 · eslint 0/0 ·
  prettier exit 0 · 17/17 sidebar format+cache · 29/29 window suites ·
  6/6 kiosapi window pins · 3/3 sidebar frame suites.
  Re-run 2026-10-10 21:39 on the five production files
  (`right-sidebar-header.tsx`, `right-sidebar-format.ts`, `right-sidebar.tsx`,
  `sidebar-rail.tsx`, `context-window-table-kiosapi.ts`): `bun run --cwd=cli
  typecheck` and `bun run --cwd=common typecheck` exit 0 with no errors;
  `eslint --max-warnings 0` exit 0 with no output; 26/26 across six suites
  (cache, format, single-home, phase-color, responsive, kiosapi window).
  Stamped `verified` on the operator's instruction. The Verifier and Adversary
  audits have not run; this status rests on the gate output above.
- **Archived-Declined:** operator-approved 2026-10-11 — "there are multiple fids w/ sidebar work, which i cancelled."
- **Disposition:** Operator cancelled all sidebar work after reporting the attempted sidebar failed. The implementation and passing test notes are historical; they do not establish operator acceptance or completion.
- **Closed Date:** not closed (operator-declined 2026-10-11)
- **Archived:** 2026-10-11 as operator-declined; no completion claim

## Lessons Learned

- A perceived rendering defect is not a defect until it is rendered. The
  "stretched vertically" complaint looked like a layout bug, was reported as
  one, and resolved — via three forced-height renders and a whole-font-table
  measurement — into *"inherent to `tiny`, operator elected to keep it."*
  Measuring first converted a potential wrong-direction change into a
  one-question operator ruling, and prevented an unnecessary font migration.
- Two rows of one panel reading the same numbers differently is a
  specification smell, not a display bug: the Cache row's formatter and the
  Context row's formatter were independent. Reusing the existing `Intl`
  convention (Law 13) collapsed two truths into one.
