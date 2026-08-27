# FID: TUI Chrome Unification — TrafficLightPanel as the Single Panel Utility

**Filename:** `FID-2026-0822-006-tui-chrome-unification.md`
**ID:** FID-2026-0822-006
**Severity:** high
**Status:** closed
**Created:** 2026-08-22
**Closed:** 2026-08-22
**YAGNI-Compliance:** Satisfied — TrafficLightPanel reused, not duplicated; primitive API unchanged (`{children}` only); no speculative scaffolding.

---

## Summary

Unify the main CLI chat surface on ONE panel chrome: `TrafficLightPanel`
(the bordered surface panel with the right-aligned glowing traffic-lights
title bar). Four coexisting design systems rendered side by side; this FID
migrated every hand-rolled/bare transcript surface onto the shared primitive
and re-skinned the agent-branch frame to the same design language.
Operator scope lock (2026-08-22): agent-branch re-skin IN; sidebar explicitly
OUT ("this never had anything to do with the sidebar"); hex cleanup split to
follow-up FID-2026-0822-007 per Nova-review default.

## Implementation (GREEN)

All changes in the working tree (release-only-commits convention):

- **`cli/src/components/terminal-command-display.tsx`** — both branches
  migrated from hand-rolled outer-box + local `titleBar` pairs onto
  `<TrafficLightPanel>` (:141 no-output branch, :169 output branch); per-row
  `paddingLeft/right: 1` removed because the primitive's content box owns the
  gutter; `copyFooter` horizontal padding stripped; `TrafficLights` import
  removed.
- **`cli/src/components/compaction-signal.tsx`** — hand-rolled chrome replaced
  by `<TrafficLightPanel>{body}</TrafficLightPanel>` (:86) inside a thin
  `selectable={false}` wrapper box that preserves prior behavior without
  extending the primitive's API.
- **`cli/src/components/tools/set-output.tsx`** (:77) and
  **`cli/src/components/tools/sequential-thinking.tsx`** (:86) — content
  framed in `<TrafficLightPanel>` and `codeBlockWidth` switched from
  `availableWidth` to `Math.max(1, options.availableWidth - 2)` atomically,
  closing the bare-renderer width divergence (RED-03).
- **`cli/src/components/blocks/agent-branch-item.tsx`** (:82-96) — frame
  re-skinned to the chrome language per decision point 6 / Nova endorsement:
  `borderStyle single→rounded`, `borderColor theme.border` (the
  expanded↔collapsed `toggleFrameColor` secondary↔muted flip removed),
  `backgroundColor theme.surface` added, `customBorderChars`/BORDER_CHARS
  import removed; compact `<TrafficLights/>` right-aligned in the header row
  via `justifyContent: 'space-between'`. Collapse/streaming UX untouched
  (chevron, status text, shimmer preserved). Sole consumer
  `agent-branch-wrapper.tsx:248` unaffected.
- **Tests:** NEW `cli/src/components/__tests__/compaction-signal.test.tsx`
  (6-test characterization net); NEW
  `cli/src/components/__tests__/agent-branch-item.test.tsx` (2 tests pinning
  header lights + collapse affordances); chrome `'●'` assertions added to the
  set-output and sequential-thinking suites plus their
  `mockOpentuiReactForStaticRender()` wiring.

### Testing seam discovery (recorded for reuse)

zustand v5 serves `getInitialState()` — not `getState()` — as the SSR server
snapshot, so `useChatStore.setState(...)` before `renderToStaticMarkup` never
reaches a component selector. The characterization net drives the store via a
capture-and-swap `mock.module` stub: real module imported and snapshotted
first, stub registered before the component loads (top-level-await dynamic
import keeps import/order groups intact), real module re-registered in
`afterAll` so later-loading suites see the genuine store. `mock.restore()`
does NOT undo module mocks in bun 1.3.14. Also: `message-with-agents.test.tsx`
renders a different single-agent path (bullet layout) that never mounts
AgentBranchItem — branch coverage lives in its own direct-render suite.

## AUDIT (Verifier)

Overall verdict: **PASS**. Per-surface verdicts with citations:
terminal-command-display.tsx:141/169 PASS; compaction-signal.tsx:86 PASS;
set-output.tsx:77 + sequential-thinking.tsx:86 + registry.ts:19-20,77-78
PASS; agent-branch-item.tsx:82-96 PASS (sole-consumer grep tool-mediated);
single-owner gate amendment PASS (exactly one sanctioned direct TrafficLights
import outside the primitive: agent-branch-item.tsx:11 — zero hand-rolled
box+titleBar recipes remain); YAGNI PASS. Gate outputs: cli typecheck exit 0;
eslint --max-warnings 0 exit 0 on all changed files; focused suites 57 pass /
0 fail across 7 files including the cross-file mock-leak regression probe.

Self-correct round: Verifier IMPROVE suggested asserting `'●'` inside
message-with-agents.test.tsx — empirically refuted (that file exercises the
single-agent bullet path without AgentBranchItem). Coverage relocated to the
new direct-render AgentBranchItem suite (2/2 green); message-with-agents
reverted and 22/22 green. Post-fix battery: typecheck exit 0, eslint exit 0,
30/30 across three suites.

## ADVERSARIAL

Adversary meta-verification: **every finding CONFIRMED first-hand against
file contents; Verifier PASS stands; zero refutations.** Closure-hygiene
requirements honored: single-owner gate text amended; deferred Step Status
items explicitly annotated.

## Verification gates (final state)

- `bun run --cwd=cli typecheck` — exit 0
- `bun x eslint <all changed files> --max-warnings 0` — exit 0
- Focused suites: 59 pass / 0 fail across 8 test files
- Single-owner grep (AMENDED gate): zero hand-rolled chrome recipes anywhere;
  direct `TrafficLights` imports outside traffic-light-panel.tsx = exactly one
  SANCTIONED site (agent-branch-item.tsx:11, header-row lights).
- Hex-cleanup gate: DEFERRED → FID-2026-0822-007.
- Production TUI smoke: EXECUTED 2026-08-22 — see Post-Closure section.

## Step Status

- [x] CompactionSignal characterization test (pre-migration net)
- [x] TerminalCommandDisplay migrated onto TrafficLightPanel (both branches)
- [x] CompactionSignal migrated onto TrafficLightPanel
- [x] set-output + sequential-thinking framed (+ -2 width allowance)
- [x] Agent-branch chrome policy decided (Nova-endorsed re-skin) + implemented
- [x] Gates: typecheck / eslint / focused suites / amended single-owner grep
- [x] Tests passing (59/0 focused; leak probe green)
- [~] Production TUI smoke — EXECUTED 2026-08-22 via WSL tmux against the
      live TUI (v0.0.27 working tree): nested-panel contrast CLEARED (PASS);
      TerminalCommandDisplay parity CLEARED (PASS); branch-header lights
      CLEARED at 120 cols (PASS); REMAINING OPEN: CompactionSignal never fired
      in-session (unfireable cheaply — stays NEEDS-REVIEW) and 90-col
      branch-header fit unverified (frames above viewport during narrow pass;
      true ~24-col grid cells also untested). Details in Post-Closure section.
- [ ] Sidebar frame-language decision — OUT OF SCOPE by operator directive 2026-08-22 ("this never had anything to do with the sidebar") — skipped::operator-approved 2026-08-22
- [ ] Hex-hardcoding cleanup — split to FID-2026-0822-007 (created, analyzed) — deferred::operator-approved 2026-08-22
- [ ] RED-04 timeline-mutation hardening (traffic-lights.tsx `timeline.items.length = 0`) — deferred/tracked, non-blocking — deferred::operator-approved 2026-08-22

## Missed Questions (answered during implementation)

7. Does the single-owner grep gate survive the agent-branch header lights?
   Decision: amend it — the gate's intent is one owner of the panel RECIPE
   (box+title-bar pair); a compact lights instance embedded in a different
   structure (button header row) is not a recipe copy. Recorded above.
8. How do tests drive chat-store state under static render? Decision:
   capture-and-swap mock.module (see Testing seam discovery) — setState is
   invisible under zustand v5 SSR snapshots.
9. Where does branch-frame coverage live? Decision: dedicated direct-render
   suite; message-with-agents covers a different renderer path.

## Resolution

Closed 2026-08-22. Implementation complete for the operator-locked scope:
steps 1-4 of the plan plus the agent-branch re-skin (decision point 6);
sidebar excluded by directive; hex cleanup split to FID-2026-0822-007;
production smoke executed with partial clearance (see below). All gates
tool-evidenced; Verifier PASS confirmed by Adversary. Working-tree closure
per release-only-commits convention.

## Post-Closure Production Smoke (2026-08-22, WSL tmux, live TUI v0.0.27)

Driven per operator directive to clear the carried NEEDS-REVIEW items.
Captures preserved under `dev/scratchpad/fid-006-smoke/` (gitignored):
00-boot, 01-final(+ansi), 02-narrow(+ansi), 03-narrow-rerun(+ansi),
04-wide-rerun, 05-scroll-01..12, 07-commandblock(+ansi).

Cleared:
- **(b) Nested panel-on-surface contrast — PASS.** Tool cards inside expanded
  branch frames show their own borders; same-background nests read separated
  (05-scroll-05..07).
- **(c, terminal half) TerminalCommandDisplay parity — PASS.** Live block:
  rounded corners intact, FIRST row right-aligned `● ● ●`, then `$ echo
  NARROW-SMOKE-OK` command row, stdout/exitCode rows (07-commandblock.txt;
  ANSI-styled $ confirmed in -e capture).
- **Agent-branch header lights @120 cols — PASS.** Toggle + name + status +
  right-aligned `● ● ●` on one row, no truncation (side-by-side thinker+
  basher and full-width layouts both captured).
- Bonus surfaces verified: sequentialthinking framed panels with `💭 Thought
  1/1` title bar (D PASS); set_output framed with yaml payload visible at 120
  AND 90 cols (E PASS).

Still open (narrowed):
- **CompactionSignal** — never fired during the session (sidebar showed
  "Compaction idle" throughout; not forceable cheaply). Parity check for this
  one surface remains NEEDS-REVIEW until a natural compaction event.
- **Branch-header lights at 90 cols / true ~24-col grid cells** — frames sat
  above the viewport during the narrow pass; PageUp walk happened after
  resizing back to 120. Narrow-width crowding question remains unanswered.

New defects discovered (NOT attributed to this migration without triage —
filed as FID-2026-0822-009):
1. 90-col border bleed: trailing wrapped word renders INSIDE the set_output
   bottom border (`╰─complexity.──────────╯`) — 03-narrow-rerun.txt.
2. Horizontal overflow swallowing an inner box's right border on long lines
   (05-scroll-07.txt).
3. Mid-stream bottom-border corruption during streaming reflow
   (`└──run_readonly_command─2.─Transition─green───┘`).
4. Merged-character/clipping anomalies in plain captures (`SmokeStestAexecuted`)
   absent from same-instant `-e` captures — triage render bug vs capture
   artifact before filing upstream.

Infra lessons (for future smokes): tmux is absent from Git Bash PATH — drive
via `wsl -e tmux ...` targeting `/mnt/c/...`; the TUI runs altscreen so
`capture-pane -S -N` returns only the last screenful — walk transcript
history with the app's PageUp/PageDown; `send-keys ... Enter` often needs a
second Enter ~2s later.
