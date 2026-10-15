# FID: Phase 3 — Native Code and Diff Components

**Filename:** `FID-2026-0816-006-native-code-diff-components.md`
**ID:** FID-2026-0816-006
**Severity:** medium
**Status:** closed
**Created:** 2026-08-16 14:30
**YAGNI-Compliance:** Pending

---

## Summary

Child FID (Phase 3) of FID-2026-0816-002: adopt the OpenTUI native
code/data components — `<code>` (tree-sitter highlighting), `<line-number>`
(diagnostics), `<diff>` (unified/split) — for tool-call diffs and code
blocks, use `<ascii-font>` for sidebar branding, and evaluate native image
rendering with its fallback story. The report's `Markdown` component claim is
corrected: it does not exist; markdown stays on the custom renderer.

## Environment

- **OS:** Windows (win32); Git Bash shell
- **Language/Runtime:** TypeScript strict, Bun 1.3.14
- **Tool Versions:** @opentui/core + @opentui/react 0.5.3 (post-Phase-0)
- **Commit/State:** main branch; Phase 3 attempted + reverted to custom renderers

## Detailed Description

### Problem

Code blocks and diffs in the transcript render through custom markdown
renderables without tree-sitter highlighting; there is no native diff view
for tool edits; branding uses a text-level logo. Meanwhile the capability
report lists a `Markdown` component that is not part of @opentui/react —
planning around it would be wasted work.

### Expected Behavior

Native `<code>`/`<line-number>`/`<diff>` components adopted where they
measurably win; branding via `<ascii-font>`; images only where the
Sixel/kitty fallback (half-block) is acceptable; no work planned on a
nonexistent Markdown component.

### Root Cause

The transcript renderer predates the native code components' maturity; the
report's component table (report §5) included entries not in the verified
component set.

### Evidence

```text
$ ls cli/src/components/blocks/
agent-branch-item.tsx  agent-branch-wrapper.tsx  agent-list-branch.tsx
ask-user-branch.tsx  copy-button.tsx  image-block.tsx  implementor-row.tsx
markdown-renderables.tsx  single-block.tsx  tool-branch.tsx
user-content-copy.tsx
```

Verified component set (@opentui/react 0.5.3 npm docs): text, box,
scrollbox, ascii-font, input, textarea, select, tab-select, code,
line-number, diff. No `Markdown`, no `Slider`, no `TextTable` (report §14.3).

## Impact Assessment

### Affected Components

- `cli/src/components/blocks/markdown-renderables.tsx` — code-block path
- `cli/src/components/blocks/tool-branch.tsx` — diff rendering
- `cli/src/components/savant-ui/branding.tsx` — ascii-font upgrade
- `cli/src/components/image-card.tsx` — image fallback evaluation
- New dependency: none unless tree-sitter runtime needs declaration

### Risk Level

- [x] Medium: new native components change transcript rendering; terminal
  graphics fragmentation limits images

## Proposed Solution

### Approach

Evaluate-then-adopt. Build a spike comparing custom rendering vs native
`<code>`/`<diff>` on a real tool-edit transcript (perf + visual parity);
adopt where the native path wins. Images only if the half-block fallback is
acceptable on the ConHost floor.

### Steps

1. Spike: render a representative tool-edit diff with `<diff>` vs the custom
   path; measure with `OPENTUI_DEBUG=true` + `bun --cpu-prof`.
2. Adopt `<code>` + `<line-number>` for code blocks where the spike wins;
   keep the custom markdown pipeline for prose.
3. Wire `<diff>` into tool-branch rendering (unified or split per width).
4. Verify the existing `<ascii-font>` branding renders correctly post-Phase-0.
   `branding.tsx` already renders `<ascii-font text={text} font={font}>` with
   `font: BrandingStyle = 'tiny' | 'block' | 'slick' | 'shade'` (verified
   `branding.tsx:21-58`). This is a regression-check step, not an upgrade — no new
   work unless the Phase-0 engine change breaks the existing rendering.
5. Evaluate native images (`<image>`/Image renderable) on Windows Terminal
   and ConHost; adopt only with an acceptable fallback; keep the existing
   image-card path otherwise.
6. Do NOT plan around a `Markdown` component (corrected — report §14.1).

### Verification

- Spike results recorded with real output (perf + screenshots/captures).
- Transcript renders highlighting in tmux (WSL) + Windows Terminal.
- A–Z live regression; typecheck ×4; `bun test`; lint gates.

## Perfection Loop

### Loop 1 — RED

- **RED:** No tree-sitter highlighting in the transcript (custom
  markdown-renderables path only); report §5 lists a nonexistent `Markdown`
  component; image support unverified on target terminals.
- **GREEN:** Evaluate-then-adopt spike; explicit non-goal for `Markdown`;
  image fallback acceptance criterion.
- **AUDIT:** `markdown-renderables.tsx` exists (evidence above); component
  set verified against 0.5.3 npm docs (no Markdown/Slider/TextTable);
  `<diff>` + `<line-number>` documented with line-sign/diagnostic APIs
  (npm docs, verified 2026-08-16); native image rendering release facts
  (v0.5.0/0.5.1) verified in master FID evidence.
- **ADVERSARIAL:** Claim "native wins measurably" is an assumption — the
  spike is mandatory, and adoption is conditional on its result. Claim
  "ascii-font tiny exists" — verified in the @opentui/react ASCII font
  example (tiny/block/slick/shade).
- **CHANGE DELTA:** New document (initial authoring).

### Missed Questions

> Surface every question that should have been asked when this FID was created, answer it with the most robust default
> derivable from inspection, and fold the answer back into the relevant sections.

1. "Does tree-sitter parsing run on the main thread?" → The report claims
   offloading (§5); verify at spike time — if it blocks, keep highlighting
   limited to visible blocks. Folded into step 1 measurements. **Fallback:** if
   tree-sitter native modules fail to initialize on Windows (a known `web-tree-sitter`
   WASM failure mode), fall back to the existing custom highlight path — never ship
   a broken or blank code block.
2. "What happens to existing markdown-renderables tests?" → The pipeline
   stays for prose; tests remain valid; new native-block tests are added
   alongside. Folded into step 2.
3. "Are images worth it at all on this platform?" → Primary floor is
   Windows Console (no Sixel/kitty); the half-block fallback exists but is
   low-fidelity — acceptance criterion is explicit, and the safe default is
   keep-current-behavior.
4. "Does the diff component handle streaming?" → v0.5.2 added bound streaming
   code highlights (#1331); verify during the spike for streamed tool output.

### Code Verification Evidence

> Before marking status as `fixed` or `verified`, verify that referenced code exists. FID metadata is a claim; code is
> ground truth.

- [x] Files referenced exist (`markdown-renderables.tsx`, `tool-branch.tsx`,
  `branding.tsx`, `image-card.tsx`; listing evidence above)
- [x] Implementation matches the Proposed Solution — attempted, then reverted
  (native renderables painted nothing in the production renderer); custom
  renderer retained (see Resolution + Step-Level Accounting)
- [x] Typecheck/tests/lint pass with pasted tool output — typecheck ×4 exit 0;
  cli suite 3089 pass / 18 skip / 0 fail; eslint/lint:md/prettier exit 0
- [x] Production call-graph evidence present — step 4 (`<ascii-font>`
  branding) retained and reachable; native wiring removed
- [x] FID status reflects the actual implementation state — `analyzed` =
  native adoption reverted, custom renderer is the shipped state; OPEN
  pending operator re-verification

### Loop 2 — Independent audit and self-correction

- **RED:** The report's §10 0.5.x row mentions "bound streaming code
  highlights" only implicitly; the FID cited it as #1331 without verifying.
- **GREEN:** Verified: v0.5.2 release notes include
  "render: bound streaming code highlights by @simonklee in #1331". Now
  cited with the release.
- **AUDIT:** GitHub releases v0.5.2 changelog contains #1331 (verified
  2026-08-16).
- **ADVERSARIAL:** No residual challenge.
- **CHANGE DELTA:** < 2%.

### Loop 3 — Final convergence

- **RED:** Residual risk: adoption churn if the spike result is marginal.
- **GREEN:** Adoption decision rule recorded (perf + visual parity; fallback
  = keep custom path).
- **AUDIT:** Decision rule present in Steps 1–2 and Loop 1 ADVERSARIAL.
- **ADVERSARIAL:** No residual challenge.
- **CHANGE DELTA:** 0%.

### Loop 4 — Second-pass review (2026-08-16)

- **RED:** (1) Step 4 claimed "Upgrade `Branding` to `<ascii-font>`" — but
  `branding.tsx:58` already renders `<ascii-font text={text} font={font}>` with
  `font: 'tiny' | 'block' | 'slick' | 'shade'`. The work was already done; the
  plan was stale. (2) No fallback existed if tree-sitter native modules fail to
  initialize on Windows (a known `web-tree-sitter` WASM failure mode).
- **GREEN:** Step 4 corrected to a regression-check step citing the existing
  implementation. Added a fallback to Missed Question #1: fall back to the custom
  highlight path if tree-sitter fails to init — never ship a broken code block.
- **AUDIT:** `bun run typecheck` (all workspaces) exit 0; `bun run lint:md` exit 0;
  `bun x eslint . --max-warnings 0` exit 0.
- **ADVERSARIAL:** PASS — `branding.tsx:58` ascii-font claim confirmed against
  the file; tree-sitter init fallback is sound.
- **CHANGE DELTA:** ~4% (corrected ascii-font claim + tree-sitter fallback).

### Loop 5 — Re-convergence (2026-08-16)

- **RED:** The Code Verification Evidence section still carried planning-phase
  text (`analyzed` = document converged; "implementation scheduled
  post-Phase-0") after the native adoption was attempted and reverted.
- **GREEN:** Rewrote the section to reflect the revert outcome and the
  retained `<ascii-font>` branding.
- **AUDIT:** `grep -rln "transition_phase" cli/src/components/tools/` → no
  match (transition renderer absent — grounds the follow-on redesign FID-009);
  custom `diff-viewer.tsx` + `markdown-leaves.tsx` + `image-block.tsx` are the
  shipped paths (re-read this session).
- **ADVERSARIAL:** No residual challenge.
- **CHANGE DELTA:** < 2%.

## Resolution

- **Closed Date:** 2026-08-16 (operator re-verified the restored custom
  diff/code rendering: "Now it's showing the edit" — the follow-on design
  complaint was routed to FID-2026-0816-009, not this FID)
- **Archived:** yes — moved to `dev/fids/archive/` on closure
- **Fix Description:** All six steps were implemented, then steps 1–3 and 5
  were **reverted** after live terminal testing (2026-08-16) showed the native
  renderables paint nothing in the real CLI renderer: the diff viewer showed
  only the `Edit filename` header (no sign markers, no line numbers) and code
  blocks lost their line-number gutter, even though the same renderables
  verified clean against `@opentui/core/testing`'s frame buffer. The spike's
  "native wins" conclusion is overturned — the test renderer is not a proxy
  for the production renderer. Reverted to the pre-Phase-3 custom path:
  `diff-viewer.tsx` back to the line-by-line renderer (`parseDiffLines` + neon
  tinting), `markdown-leaves.tsx` back to the plain `<code>` block, and
  `image-block.tsx` back to the inline-escape/metadata-card path. Removed the
  now-unused `tree-sitter-highlight.ts` and `phase3-spike.test.tsx`. Step 4
  (`<ascii-font>` branding) is retained — it renders correctly in production.
  Step 6 (`Markdown` component) unchanged (nonexistent). No durable new code
  remains from the native adoption; the custom renderer is the shipped state.
- **Tests Added:** none durable — the spike + rewritten diff/apply-patch tests
  were reverted with the native path.
- **Verification Evidence:** typecheck ×4 exit 0; `cli` suite 3089 pass / 18
  skip / 0 fail; `eslint --max-warnings 0` exit 0; `lint:md` exit 0;
  `prettier --check` clean; operator confirmed the restored custom diff
  renders in the live TUI (2026-08-16).
- **Archived:** yes — `dev/fids/archive/FID-2026-0816-006-native-code-diff-components.md`

### Step-Level Accounting (anti-deferral)

| Step | Status |
| --- | --- |
| 1. Spike (diff/code/line-number/image/ascii-font vs custom) | `reverted` — spike test removed |
| 2. Adopt `<code>` + `<line-number>` for code blocks | `reverted` — production blanked |
| 3. Wire `<diff>` into tool-branch rendering (unified/split) | `reverted` — production blanked |
| 4. Verify `<ascii-font>` branding post-Phase-0 | `implemented` (retained) |
| 5. Evaluate/adopt native `<image>` with acceptable fallback | `reverted` — custom path retained |
| 6. Do not plan around the nonexistent `Markdown` component | `implemented` (no work) |

> When status is set to **closed** (after operator verification), move this
> file to `dev/fids/archive/` and append an entry to `CHANGELOG.md`.

## Lessons Learned

- Component tables in capability reports must be diffed against the real
  package component list before planning (Markdown/Slider/TextTable were
  fabricated).
- Terminal-graphics adoption needs an explicit fallback acceptance criterion
  per platform floor (ConHost), or the safe default is keep-current.
