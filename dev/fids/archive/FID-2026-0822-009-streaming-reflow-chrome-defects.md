# FID: Streaming-Reflow Chrome Defects — Border Bleed, Overflow, Merged Glyphs

**Filename:** `FID-2026-0822-009-streaming-reflow-chrome-defects.md`
**ID:** FID-2026-0822-009
**Severity:** medium
**Status:** closed
**Created:** 2026-08-22
**Closed:** 2026-08-22
**YAGNI-Compliance:** Satisfied — fixes reuse existing wrapText/panel-chrome patterns; zero new machinery built.

---

## Summary

The FID-2026-0822-006 live TUI smoke captured four chrome rendering defect
classes on migrated surfaces. This FID triaged all four, fixed the two real
root causes, closed the capture-artifact class on grep evidence, and tracked
residuals to their own FIDs. Live-verified at 90 cols across two independent
WSL tmux sessions.

## Root Cause (RED)

1+2+3 (real defects): `TrafficLightPanel` consumes 4 horizontal columns
(border 2 + content-box padding 2) but all three framed tool renderers
subtracted only 2 from availableWidth → app-side `wrapText` emitted rows up
to 2 cols wider than the true interior → OpenTUI soft-wrapped residue onto
border rows. Intermittent purely by payload wrap points. Additionally,
paragraph/thought hosts in row-layout (`compactInlineFlow`) got max-content
width with no shrink, letting long text escape bounded interiors.
4 (merged glyphs): CAPTURE/STREAMING ARTIFACT — zero occurrences in any
preserved `-p` OR `-e` capture; seen only transiently mid-stream.

Evidence anchors: bleed confirmed ANSI `03-narrow-rerun-ansi.txt:16`
(`╰─complexity.──╯`); overflow `05-scroll-07.txt`; mid-stream splice seen
live run 1; merged-glyph grep zero-match across dev/scratchpad/fid-006-smoke.

## Implementation (GREEN)

- **Fix 1 — chrome allowance constant:** `traffic-light-panel.tsx` exports
  `TRAFFIC_PANEL_WIDTH_ALLOWANCE = 4` (doc comment explains border+padding
  arithmetic); consumed by `output-result.tsx`, `set-output.tsx`,
  `sequential-thinking.tsx` as
  `Math.max(1, options.availableWidth - TRAFFIC_PANEL_WIDTH_ALLOWANCE)`
  (was `- 2`). Generic unframed fallback (tool-branch.tsx) correctly
  untouched.
- **Fix 2 — shrinkable inline hosts:**
  `markdown-content-core.tsx` `renderInlineTextHost` text style gained
  `flexShrink: 1` so compactInlineFlow paragraph rows shrink below max-content
  inside bounded panel interiors, engaging `wrapMode: 'word'` instead of
  painting past borders.
- Residual sibling defect (reasoning tool-call panels clip mid-word when
  scrolled) filed as **FID-2026-0822-010** per Verifier IMPROVE / Law 10.

## Verification Gates

- cli typecheck exit 0 (every round)
- eslint --max-warnings 0 exit 0 on all 5 changed files
- Focused suites: 38 pass / 0 fail across 5 files (+14/14 earlier round):
  markdown-content, message-with-agents, output-result, set-output,
  sequential-thinking, traffic-light-panel

## AUDIT (Verifier)

Overall verdict: **PASS**. Verdicts: constant + arithmetic root cause PASS;
all three renderer consumption sites PASS; Fix 2 confined to style object
with blast radius tested (column layouts inert; suites green); live evidence
ruled sufficient; scope discipline confirmed (no residual converted to PASS;
merged-glyph closure evidence-backed). Two IMPROVEs issued and honored:
follow-up FID for sibling clipping (-010) and repro-owner box for the
tail-loss anomaly (below).

## ADVERSARIAL

Independent glyph-adjacency sweep over every preserved capture (77 hits
analyzed). All seven Verifier findings **CONFIRMED first-hand; verdict STANDS;
zero refutations**. Evidence strengthened: ANSI capture lines 9-21 show every
set_output yaml row strictly inside borders, long tokens wrapping onto their
own rows INSIDE the panel, bottom border a pure ╰───╯ run. One OMISSION routed
to FID-2026-0822-010 triage: classify 90-col outer-message-column flush rows
(bordered-box defect vs normal pane-edge truncation against the sidebar).
Closure conditions (both honored below): repro-owner box for tail-loss;
CompactionSignal parity NEEDS-REVIEW annotation.

## LIVE VERIFICATION (test-renderer-is-not-a-proxy honored)

Re-smoke #1 (session fid009smoke, 90 cols): set_output bottom border CLEAN —
cat -A byte-check confirms 38 pure ─ runs, zero letter-adjacent glyphs;
longest content line 36ch < 38 interior; old bleed shape absent everywhere;
branch header `▸ basher completed ✓ ● ● ●` fits ONE row at 90 cols (closes
FID-2026-0822-006's narrow-width crowding question).
Re-smoke #2 (session fid009v2, 90 cols): Thought 1/1 panel — ALL 9 wrapped
thought rows strictly inside borders; adjacency regex 0 hits across stable
captures (mid-stream poll4 transient self-corrected at rest).
Captures under dev/scratchpad/fid-009-smoke/.

## Step Status

- [x] Triage #4: CLOSED as capture/streaming artifact (zero-match grep across
      preserved -p AND -e captures)
- [x] Root cause identified for #1/#2/#3 (chrome allowance arithmetic +
      unshrunk row-layout hosts)
- [x] Fix 1 applied (TRAFFIC_PANEL_WIDTH_ALLOWANCE=4, three renderers)
- [x] Fix 2 applied (renderInlineTextHost flexShrink: 1)
- [ ] 'sixteen.' tail-loss anomaly: repro against raw tool-call args before any renderer-bug filing — OWNER: implementing session of a future chrome pass; open observation, not claimed fixed — deferred::operator-approved 2026-08-22
- [x] Full live re-smoke clean at 90 cols (two sessions; both fix targets
      verified against the real renderer)
- [x] Gates: typecheck / eslint / focused suites
- [x] Tests passing (38/0 focused; no regressions in adjacent suites)
- [x] Residual sibling clipping tracked → FID-2026-0822-010 (incl. Adversary
      omission route for outer-message-pane-edge classification)
- [ ] CompactionSignal parity — NEEDS-REVIEW carried from FID-2026-0822-006; requires a natural compaction event or forced pruner trigger observed in a live session; never converted to PASS without that screen evidence — deferred::operator-approved 2026-08-22

## Missed Questions

1. Why file first instead of fixing blind? Honored: triage-first plan executed;
   #4 proved to be an artifact — a blind fix would have patched nothing.
2. Regressions from -006 migration? Ruled out by intermittency analysis +
   correct rendering at other instants; fixes target width math, not markup.
3. Blast radius of flexShrink? Inert outside row layouts; markdown-content +
   message-with-agents suites green; broad live sweep clean.
4. Infra notes? wsl -e tmux; altscreen PageUp walks; double-Enter send-keys;
   md5 stability detection; plain -p geometry authoritative over -e for glyph
   adjacency.
5. Why -009 not -008? Same-date number collision with concurrent session;
   renumbered at creation.

## Resolution

Closed 2026-08-22. Both real defect classes fixed and live-verified at 90
cols; artifact class closed on grep evidence; residuals explicitly routed
(-010; CompactionSignal carried; sixteen.-repro owned). Gates tool-evidenced;
Verifier PASS confirmed by Adversary with zero refutations. Working-tree
closure per release-only-commits convention.
