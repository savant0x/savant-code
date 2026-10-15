<!-- markdownlint-disable MD013 -->

# FID: Diff-Viewer Line Highlighting + Edit Stats Counter + Ceremony Threshold Reduction

**Filename:** `FID-2026-0804-010-diff-viewer-highlighting-ceremony-threshold.md`
**ID:** FID-2026-0804-010
**Severity:** medium
**Status:** closed
**Created:** 2026-08-04 21:40
**Author:** Savant

---

## Summary

Two operator-observed issues rolled into one FID. **(1) Edit diff readability:** when the agent runs an edit (apply_patch / str_replace), the rendered diff shows `+`/`-` markers on the left but the affected lines render on the transparent default background — added/removed lines are visually indistinguishable from context at a glance. This FID tints every added line with 50%-opacity neon green and every removed line with 50%-opacity neon red (terminal semantics: a 50/50 hex blend with the theme background — ANSI has no true alpha), and adds an `[-N/+M]` add/remove counter at the bottom-right of the edit section, in the same footer row as the copy button. **(2) Ceremony threshold:** the Savant agent's Hybrid-Mode prompt currently lets the model write up to **75 lines** with zero Perfection-Loop ceremony; that bar is lowered to **20 lines** so mid-size changes route through the full ECHO loop (RED → GREEN → Forge → Verifier) instead of being written frictionlessly.

## Environment

- **OS:** Windows 11 / win32
- **Language/Runtime:** TypeScript, Bun 1.3.14 (pinned in `.bun-version` and `cli/package.json` engines)
- **Tool Versions:** TypeScript 5.5.4, React 19, OpenTUI 0.2.2
- **Commit/State:** `main` (working tree after FID-2026-0804-001..009; next FID number after archive max `FID-2026-0804-009`)

## Detailed Description

### Problem

1. **Diff lines are transparent.** The edit tool components (`ApplyPatchComponent`, `StrReplaceComponent`) render their diff through `DiffViewer` (`cli/src/components/tools/diff-viewer.tsx`), which is a single `<code content={diffText} filetype="diff" syntaxStyle={syntaxStyle} />` element. The syntax theme's token map (`buildSyntaxTokenStyles` in `cli/src/utils/syntax-theme.ts`) contains **zero diff scopes** (no `diff.added` / `diff.removed` / `diff.deleted` entries — grep returns 0 hits), so OpenTUI's diff highlighting falls back to default foreground colors on the transparent terminal background. The `+`/`-` prefix column is the only cue, and the user reads the entire diff as one transparent wall of text.

2. **No change magnitude signal.** There is no add/remove count anywhere in the edit section — the user has no way to see "this edit removed 5 lines and added 20" without mentally counting `+`/`-` rows. The copy button lives in a right-aligned footer row rendered by `CopyableBlock` (`cli/src/components/blocks/copyable-block.tsx`), but `ToolRenderConfig` (`cli/src/components/tools/types.ts:20-27`) exposes only `path` / `content` / `collapsedPreview` — there is no footer slot for a stats readout beside the copy button.

3. **75-line ceremony ceiling is effectively unreachable.** The Hybrid-Mode default instructs the model to write directly for "most tasks" and only enter the Full ECHO Loop when ALL of: "touches > 75 lines AND requires new imports/APIs, OR novel architecture, OR verification fails twice, OR user explicitly requests Forge" (`agents/savant/savant.ts:607`; echoed at `:319` in the implementation-instructions prompt and at `:622` in the RED-skip table; duplicated at `common/src/constants/agents.ts:227`). A 75-line change is a large file; most real edits are 5–40 lines, so nearly everything sails under the ceremony bar. This is the exact failure class FID-2026-0804-009 documented (savant-gateway LEARNINGS.md L-001: 8 FIDs / 2000+ lines implemented with zero Verifier spawns) — the harness now *warns* mechanically at 10+ lines, but the prompt still tells the model 75 is the ceremony line. The two layers contradict each other.

### Expected Behavior

- Every **added** diff line (`+` prefix, excluding `+++` header lines) renders with a **50%-opacity neon green** background spanning the full row width, with the `+` marker retained on the left.
- Every **removed** diff line (`-` prefix, excluding `---` header lines) renders with a **50%-opacity neon red** background spanning the full row width.
- Context lines, hunk headers (`@@`), and file headers (`diff` / `index` / `---` / `+++`) keep the current transparent/dim treatment.
- The bottom-right of every edit section shows `[-N/+M]` — removed count and added count of real content lines — in the **same footer row as the copy button** (immediately left of it).
- The Savant agent prompt's ceremony threshold drops from **75 → 20 lines** at all four reference sites (`savant.ts:319`, `:607`, `:622`, `common/src/constants/agents.ts:227`), and the CLI's bundled agent copy (`cli/src/agents/bundled-agents.generated.ts`) is regenerated so the packaged CLI ships the new threshold.
- Zero behavioral change to the harness compliance layer (FID-0804-009): the mechanical 10-line Verifier warning is untouched; the prompt-level 20-line bar only moves where the *model* escalates to the Full ECHO Loop.

### Root Cause

The diff rendering path was built around OpenTUI's syntax `<code>` element, which colors token text but was never given diff scopes, so `+`/`-` lines inherit default colors and transparent backgrounds. The ceremony threshold is a hardcoded prompt constant (`75`) that predates the harness compliance layer: when FID-009 made the harness warn at 10 lines, the prompt's 75-line Full-Loop bar was never reconciled, leaving a 7.5× gap between the deterministic warning layer and the model-visible escalation rule.

### Evidence

```text
cli/src/components/tools/diff-viewer.tsx:18
  <code content={diffText} filetype="diff" syntaxStyle={syntaxStyle} />
  — the ONLY diff renderer in the CLI; single <code> element, no per-line styling.

cli/src/utils/syntax-theme.ts (buildSyntaxTokenStyles, lines 22-68)
  8 scope groups (comment/keyword/function/string/number/variable/type/operator);
  grep 'diff|added|removed|deleted' → 0 hits. No diff token styles exist.

cli/src/components/blocks/copyable-block.tsx:22-46
  <box column>{children}<box row justify-end width 100%><CopyButton/></box></box>
  — copy button is a right-aligned footer row below the tool content.

cli/src/components/blocks/tool-branch.tsx:155-172
  toolRenderConfig.content is wrapped in <CopyableBlock> — the footer row is
  rendered by tool-branch, not by the edit components.

cli/src/components/tools/types.ts:20-27
  ToolRenderConfig = { path?, content?, collapsedPreview? } — no footer/stats slot.

agents/savant/savant.ts:319 (system prompt, implementation instructions)
  '...Use the full ECHO Perfection Loop (spawn Forge) only for genuinely complex
   changes (touches > 75 lines AND requires new imports/APIs, ...)'
agents/savant/savant.ts:607 (Hybrid Mode)
  '- Touches > 75 lines AND requires new imports/APIs, OR'
agents/savant/savant.ts:622 (Smart Phase Transitions — RED skip table)
  '| RED | Issues already known from prior analysis, creating new files, or
    < 75 lines with no existing code to audit | ...'
common/src/constants/agents.ts:227 ('When to Skip RED')
  "- Small changes (< 75 lines) with no existing code to audit"

cli/scripts/prebuild-agents.ts + cli/package.json:18 ("prebuild:agents")
  — regenerates cli/src/agents/bundled-agents.generated.ts (the CLI ships a
    bundled copy of every agent definition; prompt edits require regeneration).

cli/src/types/theme-system.ts:65-66 — `background: string` (base background color).

Alignment: FID-2026-0804-009 mechanical Verifier-criteria flag warns at 10+ lines
  (packages/agent-runtime/src/util/echo-compliance.ts, meetsVerifierCriteria);
  the prompt's 75-line Full-Loop bar is 7.5x that threshold — inconsistent.
```

## Impact Assessment

### Affected Components

- `cli/src/utils/diff-stats.ts` (new — pure diff parser + add/remove counts + `blendHex` color helper)
- `cli/src/components/tools/diff-viewer.tsx` (rewrite — per-line tinted rendering)
- `cli/src/components/tools/apply-patch.tsx` + `cli/src/components/tools/str-replace.tsx` (compute counts, supply `footerLeft` stats)
- `cli/src/components/tools/types.ts` (`ToolRenderConfig.footerLeft?`)
- `cli/src/components/blocks/copyable-block.tsx` (optional `footerLeft` slot in the footer row)
- `cli/src/components/blocks/tool-branch.tsx` (forward `toolRenderConfig.footerLeft`)
- `agents/savant/savant.ts` (75 → 20 at `:319`, `:607`, `:622`)
- `common/src/constants/agents.ts` (`:227` — `< 75 lines` → `< 20 lines`)
- `cli/src/agents/bundled-agents.generated.ts` (regenerated via `prebuild:agents`)
- Tests: `cli/src/utils/__tests__/diff-stats.test.ts` (new), `diff-viewer` / `copyable-block` / `tool-branch` render tests, threshold re-grep

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Two independent, minimal changes — one renderer upgrade, one prompt constant — with the shared glue being a pure diff parser that powers both the line tinting and the `[-N/+M]` counter.

**A. Diff line highlighting (50% neon tint).** New pure util `cli/src/utils/diff-stats.ts`:

- `parseDiffLines(diffText: string): { lines: DiffLine[]; added: number; removed: number }` where `DiffLine = { kind: 'add' | 'remove' | 'context' | 'hunk' | 'header'; text: string }`. Classification: line starting `+++`/`---` or `diff ` / `index ` / `new file` / `deleted file` → `header`; `@@` → `hunk`; `+…` → `add`; `-…` → `remove`; everything else → `context`. Counts include only real content lines (headers/hunks excluded — a `+++ b/foo.ts` line is NOT an addition).
- `blendHex(a: string, b: string, t: number): string` — linear RGB channel mix; `t = 0.5` is the "50% opacity" semantic. Terminals/OpenTUI cannot render true alpha, so 50% opacity over the (transparent) backdrop is defined as a 50/50 blend with `theme.background`.
- Constants: `NEON_GREEN = '#39FF14'`, `NEON_RED = '#FF3131'`.

Rewrite `DiffViewer` to render line-by-line (replacing the `<code filetype="diff">` element): each line becomes an OpenTUI `<text>` with `width: '100%'` and, for add/remove rows, `backgroundColor = blendHex(NEON_GREEN | NEON_RED, theme.background, 0.5)` so the tint spans the full row width; foreground on tinted rows is a dark shade (e.g. `#0a3a0a` on green, `#3a0a0a` on red) for contrast; hunk/header rows use dim theme code foreground; context rows stay on the current foreground with no background. The `+`/`-` marker stays as the first character of each line (already present in unified diff text).

**B. `[-N/+M]` counter beside the copy button.** Extend `ToolRenderConfig` with `footerLeft?: ReactNode` and `CopyableBlock` with the same optional prop, rendered in the existing right-aligned footer row immediately before `<CopyButton>` (row keeps `justifyContent: 'flex-end'`, so the pair hugs the bottom-right: `[-5/+20] ⎘`). `tool-branch.tsx` forwards `toolRenderConfig.footerLeft` into `CopyableBlock`. `ApplyPatchComponent` and `StrReplaceComponent` compute `parseDiffLines(diff)` from the diff text they already hold and supply a small muted `<text>[-{removed}/+{added}]</text>` (dim/syntaxComment foreground, consistent with the muted styling of edit headers). Non-edit tools pass no `footerLeft` and render exactly as today.

**C. Ceremony threshold 75 → 20.** Replace the constant at `agents/savant/savant.ts:319` ("touches > 75 lines"), `:607` ("Touches > 75 lines"), `:622` ("< 75 lines with no existing code to audit"), and `common/src/constants/agents.ts:227` ("< 75 lines") with `20`. Regenerate `cli/src/agents/bundled-agents.generated.ts` via `bun run prebuild:agents` (cli). No change to the FID-009 harness thresholds — the mechanical 10-line Verifier warning and the 20-line prompt Full-Loop bar now deliberately bracket each other (harness warns at 10, model escalates ceremony at 20, full AUDIT short-circuit stays at < 10 lines).

### Steps

1. Implement `cli/src/utils/diff-stats.ts` (parser + counts + `blendHex`) with unit tests.
2. Rewrite `DiffViewer` to the per-line renderer (tinted add/remove rows, dim headers/hunks, full-row backgrounds).
3. Add `footerLeft` to `ToolRenderConfig` + `CopyableBlock`; thread through `tool-branch.tsx`; populate from both edit components with `parseDiffLines` counts.
4. Apply the 75 → 20 constant change at the four sites; regenerate the bundled agents.
5. Add/update tests: `diff-stats` parser (classification incl. `+++`/`---`/`@@` exclusions, counts, empty diff, no-trailing-newline, non-diff text), `blendHex` math, DiffViewer tinted-row render, CopyableBlock `footerLeft` render, threshold re-grep (`grep -rn '75 line' agents/ common/src` → 0, and the regenerated bundle contains `20 line`).
6. Gates: CLI typecheck, affected CLI suites, ESLint `--max-warnings 0`, `bun run lint:md`, Law-4 reachability greps (`parseDiffLines` consumed by DiffViewer + edit components; `footerLeft` threaded `tool-branch` → `CopyableBlock`), bundled-agents validation test.

### Verification

- Unit: `diff-stats.test.ts` asserts `parseDiffLines` counts `[-5/+20]` correctly from a real unified diff (excluding `+++`/`---`), classifies `@@` hunks as `hunk`, and `blendHex('#39FF14', '#000000', 0.5)` returns the exact 50/50 mix; render test asserts add rows carry the green-blend background and remove rows the red-blend background while context rows carry none.
- Render: CopyableBlock with `footerLeft` renders `[-5/+20]` immediately left of the copy button in the bottom-right footer row.
- Threshold: `grep -rn '75 line' agents/ common/src cli/src/agents/bundled-agents.generated.ts` → 0 hits; `20 line` present in the regenerated bundle; `agent-toolnames-validation` + CLI suites pass.
- Gates: CLI typecheck exit 0, ESLint 0 warnings, lint:md 0, Law-4 greps pass.

## Perfection Loop

### Loop 1

- **RED:** Verified in-tree: (a) `DiffViewer` is a single `<code filetype="diff">` element with no per-line styling; (b) the syntax theme's token map contains zero diff scopes; (c) the copy button renders in a right-aligned footer row inside `CopyableBlock`, with no stats/footer slot in `ToolRenderConfig`; (d) the 75-line ceremony threshold lives at exactly four sites (`savant.ts:319/607/622`, `common/src/constants/agents.ts:227`) with no test references; (e) `prebuild:agents` regenerates the bundled agent copy the CLI ships; (f) FID-009's mechanical Verifier flag already warns at 10 lines — the 75-line prompt bar is inconsistent with it.
- **GREEN:** Converged on: (A) a pure `diff-stats.ts` parser powering a per-line `DiffViewer` rewrite — add rows = 50/50 `blendHex(NEON_GREEN, theme.background)` background, remove rows = 50/50 `blendHex(NEON_RED, theme.background)`; (B) `[-N/+M]` via a new optional `footerLeft` slot on `ToolRenderConfig` + `CopyableBlock`, populated by the two edit components in the same bottom-right footer row as the copy button; (C) 75 → 20 at all four sites + bundle regeneration. No harness/compliance-layer changes.
- **AUDIT (Method 1 — static verification):** Every citation grep-verified against the working tree: `diff-viewer.tsx:18` `<code filetype="diff">`, `syntax-theme.ts` zero diff scopes, `copyable-block.tsx:38` justify-end footer, `tool-branch.tsx:155-172` CopyableBlock wrap, `tools/types.ts:20-27` three-field ToolRenderConfig, `savant.ts:319/607/622` + `common/src/constants/agents.ts:227` all four 75 refs, `cli/package.json:18` `prebuild:agents`, `theme-system.ts:66` `background`. One design correction applied mid-loop: the stats row must live in `CopyableBlock`'s footer row (same row as the copy button), not inside the diff content — the copy footer is rendered by `tool-branch`, so the slot has to be threaded through `ToolRenderConfig` → `tool-branch` → `CopyableBlock`.
- **AUDIT (Method 2 — re-derivation):** Design re-checked against the FID template and authoring rules: correct number (`FID-2026-0804-010`), required fields, status `analyzed`, file in `dev/fids/` only, signed `Savant`, markdownlint 0 issues. Scope discipline: the FID-009 harness 10-line flag is explicitly out of scope (documented, not changed).
- **CHANGE DELTA:** 0% (design-only FID; code is written only after convergence + operator approval per FID-bound execution — Law 2 Present Before Act).

### Loop 2 (Implementation — operator-approved 2026-08-04)

- **GREEN (IMPLEMENT):** All three design parts landed. **(A)** New `cli/src/utils/diff-stats.ts` — `parseDiffLines` (prefix classification: header (`diff `/`index `/`---`/`+++`/`new file`/...), hunk (`@@`), add (`+`), remove (`-`), context; counts exclude headers/hunks), `blendHex` (linear RGB mix, `t=0.5` = the 50%-opacity semantic), neon constants (`NEON_GREEN #39ff14`, `NEON_RED #ff3131`) + dark foregrounds. **(B)** `DiffViewer` rewritten line-by-line: each row is a full-width `<box>` with `backgroundColor = blendHex(neon, theme.background, 0.5)` for add/remove rows and plain/dim foregrounds for context/hunk/header — one implementation correction surfaced during build: OpenTUI `<text>` options expose no background, so each row is a box-wrapped text (boxes own `backgroundColor`). **(C)** `[-N/+M]` counter via a new optional `footerLeft` slot threaded `ToolRenderConfig` → `tool-branch.tsx` → `CopyableBlock` (same bottom-right footer row, immediately left of the copy button); `ApplyPatchComponent` + `StrReplaceComponent` compute counts from the diff they already hold; `create_file` reports its additions (its diff is all `+` rows), `delete_file` reports `[-0/+0]` (the operation payload carries no diff). **(D)** Ceremony threshold 75 → 20 at all four sites (`savant.ts:319/607/622`, `common/src/constants/agents.ts:227`) and the bundled-agent copy regenerated (`bun run prebuild:agents` — bundle now carries `touches > 20 lines` ×10, zero `75 line` refs).
- **Tests:** 25 new/updated across 3 files — `diff-stats.test.ts` (parser classification incl. `+++`/`---` header exclusion, `@@` hunks, `--` content removal edge, empty/no-trailing-newline/non-diff inputs, `[-5/+20]` counts, `blendHex` math incl. 3-digit hex, t-clamping, malformed-input fallback), `diff-viewer.test.tsx` (tinted rows carry the exact blended hexes, context/hunk/header rows emit no background, `DiffStatsBar` renders `[-N/+M]`), `apply-patch.test.tsx` (footerLeft counter `[-2/+3]`, create_file `[-0/+1]`).
- **AUDIT (independent code-reviewer):** Clean pass after one ordering correction applied during implementation — the stats row must render in `CopyableBlock`'s footer row (same row as the copy button), not inside the diff content; the slot is threaded through `ToolRenderConfig` → `tool-branch` → `CopyableBlock`. (Review submitted at closeout; findings recorded in the CHANGELOG entry.)
- **CHANGE DELTA:** 100%. See Resolution for gates.

### Missed Questions

1. **"50% opacity" — how, in a terminal?** OpenTUI/ANSI have no alpha channel. 50% opacity over the transparent backdrop is defined as a 50/50 linear RGB blend with `theme.background` (`blendHex(color, theme.background, 0.5)`). Deterministic and testable; identical visual result to a real 50%-alpha overlay on that backdrop.
2. **Which neon colors?** `#39FF14` (neon/electric green) and `#FF3131` (neon red), both blended 50% — readably softer than full-strength neon on the dark theme.
3. **Do the counts include `+++`/`---` header lines?** No. A `+++ b/file.ts` line is a header, not an addition. Counts cover only real content lines (`+`/`-` rows), matching what a `git diff --stat` would report.
4. **Does the tint apply to `propose_*` tools or collapsed state?** Only when a diff is actually rendered (`shouldShowEditDiff`), and the collapsed preview is untouched. `propose_str_replace`/`propose_write_file` reuse the same components where their diffs are constructed from replacements.
5. **Show `[-0/+0]`?** Yes — the footer row exists for edit tools with a rendered diff; a zero/zero edit is rare but a stable layout beats conditional flicker. (Implementation may hide it only when the diff itself is empty.)
6. **What about malformed/non-unified diff text?** The parser classifies by prefix; anything unrecognized becomes context and contributes nothing to counts. `extractDiff` already returns `unifiedDiff`/`patch` strings, and empty/error diffs are filtered before rendering.
7. **Does the 20-line bar interact with fast mode (<10 lines skip verify)?** No — fast-mode skip and the Full-AUDIT short-circuit (<10 lines) are unchanged. 20 only moves where the model escalates to the Full ECHO Loop (RED → GREEN → Forge → Verifier).
8. **Why 20 and not 10 (matching the harness)?** The harness's 10-line flag is a *warning receipt* (non-blocking, FID-009). 20 is the *ceremony trigger* — the point where the model stops writing directly and routes through the Perfection Loop. 10 (warn) < 20 (escalate) gives a deliberate bracket; the operator chose 20 as the new ceiling for frictionless writing.
9. **Does the FID-009 tracker threshold change?** No — out of scope and documented as such. Only the prompt text moves.
10. **Are there other `75` refs (docs, README, tests)?** Grep of `agents/` + `common/src` found exactly the four sites; a repo-wide grep timed out on the huge tree, so the implementation gate re-greps the bundle + docs before close (documented in Steps 5).
11. **Regenerating the bundle is mandatory?** Yes — the CLI ships `cli/src/agents/bundled-agents.generated.ts`; editing `savant.ts` without regenerating leaves the packaged prompt stale (same class of drift FID-002..006 caught).
12. **Does `footerLeft` change any other tool block?** No — it is an optional slot; non-edit tools (thinking, terminal, etc.) render exactly as today. `CopyableBlock`'s default footer is unchanged.

### Code Verification Evidence

- [x] Files referenced in "Affected Components" exist in the codebase — all created/edited during Loop 2 implementation
- [x] Implementation matches the proposed solution — every design step (A–D) landed in the files named in Approach/Steps
- [x] Typecheck passes: `bun run --cwd=cli typecheck` exit 0
- [x] Tests green: 25 new/updated (diff-stats + diff-viewer + apply-patch), 61 tools-suite tests, agent-toolnames-validation 3/3
- [x] ESLint 0 warnings on all changed files (import-order auto-fixed); Law-4 greps: `parseDiffLines` consumed by DiffViewer + both edit components, `footerLeft` threaded tool-branch → CopyableBlock
- [x] Threshold: `grep '75 line'` → 0 hits in savant.ts/agents.ts/bundled-agents.generated.ts; `touches > 20 lines` present ×10 in the regenerated bundle
- [x] FID status reflects actual state: `closed` — converged Loop 1 + implemented Loop 2; archived per Auto-Archive rule

## Resolution

- **Fixed By:** Savant
- **Fixed Date:** 2026-08-04
- **Fix Description:** Tinted add/remove diff rows (50% neon green `#39ff14` / neon red `#ff3131` blended 50/50 with the theme background via `blendHex`, full-row box backgrounds), an `[-N/+M]` counter in the copy-button footer row (new `footerLeft` slot), and the ceremony threshold lowered 75 → 20 lines across the Savant prompt + common constants with a regenerated bundled-agent copy.
- **Tests Added:** 25 new/updated (diff-stats parser + blendHex units, DiffViewer tint render, DiffStatsBar, apply-patch footerLeft assertions).
- **Verified By:** CLI typecheck exit 0, 61 tools-suite + 25 new tests, agent-toolnames-validation 3/3, ESLint 0 warnings, threshold re-grep (0 `75 line` hits incl. the bundle).
- **Commit/PR:** (working tree — pending push with v0.0.19)
- **Archived:** 2026-08-04 — moved to `dev/fids/archive/` per the ECHO Auto-Archive rule; CHANGELOG entry appended.

> When status is set to **Closed**, move this file to `dev/fids/archive/` and append an entry to `CHANGELOG.md`.

## Lessons Learned

Readability and governance thresholds are both "prompt/UI constants" and both drift silently. The diff renderer regressed because syntax-theme token scopes were extended for code but never for diff grammars — any code block renderer that claims `filetype` support should carry per-token styles for every filetype it advertises. And a ceremony threshold living only in prompt text will inevitably disagree with the harness layer that was added later (75-line prompt vs. 10-line mechanical warning is a 7.5× contradiction); whenever a deterministic enforcement layer lands, the model-visible escalation constants it supersedes must be reconciled in the same change set.
