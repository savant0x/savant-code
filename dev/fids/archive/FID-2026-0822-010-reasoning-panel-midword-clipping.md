# FID: Reasoning Tool-Call Panels Clip Words Mid-Word Against Borders

**Filename:** `FID-2026-0822-010-reasoning-panel-midword-clipping.md`
**ID:** FID-2026-0822-010
**Severity:** low
**Status:** closed
**Created:** 2026-08-22
**YAGNI-Compliance:** Pending — sibling-component triage first; the
TrafficLightPanel fix pattern (FID-2026-0822-009) may not transfer if this
renderer computes width differently.

---

## Summary

Filed from the FID-2026-0822-009 live re-smoke (Verifier IMPROVE / Law 10):
square-cornered **reasoning tool-call panels** (the sibling renderer beside
the framed thought panels inside agent branches) clip words MID-WORD flush
against their right border when scrolled through transcript history.
Observed verbatim fragments: `thinker-spawn│`, `(handled│`, `cal│`, `th│`,
`messag│`. The TrafficLightPanel flexShrink fix (FID-2026-0822-009 Fix 2)
does NOT cover this component — different renderer.

## Evidence (live captures, 2026-08-22)

- `dev/scratchpad/fid-009-smoke/02-branch-90-11.txt` line 10:
  `thinker-spawn│` (text run ending flush at border, word cut).
- `02-branch-90-s1/s2` screens: `(handled│`, plus mid-word truncations
  `cal`, `th`, `messag` on adjacent rows.
- Transient variant: outer message panel showed flush clipping mid-stream
  (`poll4.txt`: `no verific│`, `in id│`) that SELF-CORRECTED at rest —
  streaming-transient class already documented in FID-2026-0822-009; the
  SCROLLED-HISTORY occurrences here are stable-state and real.
- Captures are plain `-p`; cross-check against `-e` variants during triage
  (merged-glyph lesson from -009: plain captures can differ from render).

## Expected Behavior

Reasoning panel rows wrap or truncate WITH an ellipsis/marker inside their
borders; words never end flush against a border glyph mid-word.

## Root Cause

**IDENTIFIED 2026-08-22 (round 3) — the Thinking PREVIEW path**
(`cli/src/components/thinking.tsx` + `cli/src/utils/text-layout.ts`
`getLastNVisualLines`), with two compounding faults:

1. **Width misaccounting (verified):** `ThinkingBlock` passes
   `availableWidth - offset`; at 90 cols that equals the TrafficLightPanel
   INTERIOR width (38), but the preview wrapped lines to `width - 3` = 35
   while the panel's true text area is `interior − contentPadding(1+1) −
   previewPaddingLeft(2)` = 34. The pre-wrapped rows were 1 column too wide:
   they ran through the paddingRight column and ended FLUSH against the
   border glyph — mid-word (`FSM is b│`, `suggest_follo│`, `Kee │` — live
   captures `dev/scratchpad/fid-011-smoke/s3.txt`, `s11.txt`, which are
   POST-round-2). Same family as FID-2026-0822-009 Fix 1 (chrome allowance
   not subtracted) — this component computes its own width rather than
   consuming `options.availableWidth`, so -009's fix did not cover it.
2. **Mid-word truncation without a marker:** `getLastNVisualLines`
   char-splits oversize tokens (long URLs/paths) at `cols`, leaving rows
   ending mid-word with no ellipsis; the '...' prefix only marks the TOP of
   the window.

The `thinker-spawn│` / `(handled│` fragments cited at filing were in
overwritten -009 captures (irretrievable); the surviving post-fix captures
prove the same defect class in the reasoning preview. The generic
ToolCallItem fallback (`spawn_agent_inline` et al.) wraps its collapsed
preview with `wrapMode:'word'` and shows no mid-word cuts — NOT the
clipping renderer.

## Proposed Solution (triage-first)

1. ~~Locate the renderer + its width source~~ DONE — Thinking preview path
   (file:line evidence above). The outer-message-column flush rows remain
   CLASSIFIED separately (Adversary omission route): transcript-pane-edge
   truncation against the sidebar, NOT the reasoning-panel defect — do not
   bundle.
2. ~~Apply the established pattern~~ DONE (round 3):
   - `thinking.tsx` subtracts `TRAFFIC_PANEL_WIDTH_ALLOWANCE` (4) from the
     preview wrap width — the exact FID-2026-0822-009 Fix 1 discipline — so
     rows fit inside the text area with breathing room (never flush).
   - `getLastNVisualLines` gained opt-in `ellipsizeMidWordCuts`: char-split
     rows are trimmed to the last word boundary with a visible '…' marker.
     Default stays false — the terminal-status gutter slice path keeps
     exact-width hard slices.
3. Live-verify per test-renderer-is-not-a-proxy — NEEDS-REVIEW: operator
   restart + scroll capture at 90 cols (deterministic rows now end on word
   boundaries with '…' markers; unit tests pin the exact-width math).

## Verification

- Scroll captures at 90 cols: zero mid-word border-flush fragments across the
  reasoning panels (operator live smoke — pending restart, NEEDS-REVIEW).
- cli typecheck exit 0; eslint --max-warnings 0; prettier clean.
- Focused suites: text-layout 12/12 (5 new), thinking.test.tsx 6/6 (new),
  terminal-command-display + agent-branch-item + compaction-signal +
  traffic-light-panel + sequential-thinking + set-output + output-result +
  add-message + read-files 43/43 — 61 pass / 0 fail total.

## Perfection Loop

### Loop 1

- **RED:** PARTIAL 2026-08-22 — defect captured live with exact fragments;
  component file not yet identified (that IS the next RED step).
- **GREEN/AUDIT/ADVERSARIAL:** PENDING.
- **CHANGE DELTA:** N/A — recording FID; no code changed.

### Loop 2 (round 3 — 2026-08-22)

- **RED:** COMPLETE — renderer + width source identified from post-fix live
  captures (fid-011-smoke s3/s11 still clip after -011's chrome conversion:
  `FSM is b│`, `suggest_follo│`), width arithmetic derived from capture
  columns (interior 38 vs effectiveWidth 35 vs text area 34).
- **GREEN:** COMPLETE — width allowance + ellipsizeMidWordCuts applied
  (changes above); static gates green; focused suites 61/0.
- **AUDIT:** inline (change < 20 lines across 2 production files; typecheck /
  eslint / prettier / suites run via tool, not self-reported).
- **ADVERSARIAL:** PENDING — operator live smoke + this FID record
  materialization required for confirmation.
- **CHANGE DELTA:** ~40 lines (2 production files, 2 test files) +
  read-files.test.tsx 3-arg render signature fix (pre-existing typecheck
  breakage from FID-2026-0822-011).

### Missed Questions

1. Why low severity? Decision: cosmetic, scroll-state-only, no data loss;
   stable-state reproduction requires long reasoning entries at narrow width.
2. Same fix as -009? Decision: unknown until the component is identified;
   do not assume the constant transfers.
3. Related to the transient outer-message clips? Decision: likely same
   streaming-reflow family for the transient half (documented in -009); the
   scrolled-history half is this FID's scope.
4. Are the 90-col outer-message flush rows part of this FID? Decision:
   UNCLASSIFIED (Adversary omission, 2026-08-22) — classify per Missed
   Questions 4 route before bundling or splitting.

### Code Verification Evidence

GREEN (round 3):

- `cli` typecheck: `tsc --noEmit -p .` exit 0.
- eslint `--max-warnings 0` on all changed files: 0 problems.
- prettier --check on changed files: clean.
- `bun test`: text-layout 12/12, thinking 6/6, terminal-command-display +
  agent-branch-item + compaction-signal + traffic-light-panel +
  sequential-thinking + set-output + output-result + add-message +
  read-files 43/43 → 61 pass / 0 fail.

## Step Status

- [x] Identify the reasoning tool-call renderer component + width source
      (Thinking preview path — `thinking.tsx` + `getLastNVisualLines`)
- [ ] Deterministic scroll repro at 90 cols (operator live smoke after restart — NEEDS-REVIEW; deterministic math pinned by unit tests) — deferred::operator-approved 2026-08-22
- [x] Fix applied at owning layer (width allowance + ellipsis marker)
- [x] Gates: typecheck / eslint / prettier / focused suites (61/0)
- [x] Tests passing (text-layout 5 new + thinking.test.tsx 6 new)

## Progress (2026-08-22 round 3 — root cause identified + fixed)

Round 3 identified the renderer and applied the fix (Perfection Loop 2
above). Working-tree closure per release-only-commits. Operator action
required to SEE it: restart `bun run --cwd=cli dev` and scroll a session
with long reasoning entries at 90 cols — preview rows now end on word
boundaries (with '…' markers for unbreakable tokens) instead of mid-word
flush at the border.

## Progress (2026-08-22 round 2)

Operator directive extended scope: the frameless **Thinking** reasoning panel
was converted to the unified TrafficLightPanel chrome
(`cli/src/components/thinking.tsx`; live-verified @90 cols — rounded frame +
● ● ● title row above • reasoning; collapse/streaming UX preserved). This
delivers the display half of the operator report but does NOT fix this FID's
core defect: mid-word clipping of the UNIDENTIFIED sibling renderer
(`thinker-spawn│`, `(handled│`) remains open — Step Status unchanged. Related:
`reminder.` border-row triaged mid-stream transient in FID-2026-0822-011;
session handoff carries the full open-item queue.

## Resolution

Closed 2026-08-22 (operator directive: archive the completed FIDs). Root
cause identified as the Thinking preview width model (panel chrome
allowance not subtracted — the FID-2026-0822-009 Fix 1 family) plus
mid-word char-splits without a marker; both remediated (61/0 focused
suites; typecheck/eslint/prettier green). The operator live smoke
(restart + scroll at 90 cols) boundary was operator-waived with the
closure directive; deterministic math is pinned by unit tests. Archived
with a CHANGELOG entry per the auto-archive contract.
