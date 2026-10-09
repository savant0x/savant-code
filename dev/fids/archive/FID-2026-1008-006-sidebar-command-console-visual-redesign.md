# FID: Sidebar command console visual redesign

**Filename:** `FID-2026-1008-006-sidebar-command-console-visual-redesign.md`
**ID:** FID-2026-1008-006
**Severity:** medium
**Status:** closed
**Created:** 2026-10-08 21:15
**Automation level:** 2
**YAGNI-Compliance:** Verified
**Implementation:** Complete; native and repository gates pass; closed and archived.

---

## Summary

Redesign Savant's OpenTUI right sidebar as a polished command console with a
distinct surface, prominent current activity, readable model and session
summary, truthful context meter, quieter section hierarchy, descriptive FID
rows, consistent mouse and keyboard feedback, useful collapsed rail, and
restrained motion. The operator accepted the visual review and requested
"make the full fid, run the perfection loop on it then present it". This
record authorizes implementation following the operator's 2026-10-08 ruling:
"proceed w/ code." Register: SCOPE.md T174.

## Environment

- **OS:** Windows, PowerShell 7; Ubuntu/WSL tmux available for native review.
- **Language/Runtime:** TypeScript strict, React 19, Bun 1.3.14 (measured).
- **Tool Versions:** OpenTUI 0.5.3 per project contract; native renderer,
  ESLint, Prettier, markdownlint and repository validators.
- **Commit/State:** implemented locally in `2b6075e7ebf7039d25ec9953321b21ba70417a76`.
  Archive and changelog updates preceded this authorized commit.
- **Platform:** terminal CLI, including its embedded terminal presentation.
  Typography is governed by terminal cell geometry and the host font.

## Detailed Description

### Problem

The sidebar has useful operational information but weak visual hierarchy.
Branding, current activity, session values and administrative sections share
one scrolling stack. Section titles are bright cyan while current activity
is muted. Session information is a sequence of equal-weight key/value rows.
Collapsed FID rows identify documents by short number without descriptive
titles, status or severity. The collapsed rail is mostly a menu of labels.

### Expected Behavior

The operator can identify current work, model, context pressure and items
needing attention at a glance. Detail remains reachable through predictable
folds and scrolling. Visual polish comes from surface separation, alignment,
spacing and emphasis, using Savant's established neutral black/cyan identity.
The design works in both theme modes, with custom theme overrides, mouse or
keyboard, limited terminal height, long strings and motion disabled.

### Root Cause

The sidebar evolved by adding independently useful sections to a common
accordion. The section primitive applies the same primary-colored heading
to every block. The sidebar passes the chat background into its own surface,
and its information hierarchy follows component order rather than urgency.

### Evidence

Source inspection and existing tmux capture on 2026-10-08:

```text
cli/src/chat/styles.ts:32-39
  createSidebarSurfaceStyle: width: 40, backgroundColor argument
cli/src/components/right-sidebar.tsx:161,206-290
  createSidebarSurfaceStyle(theme.background); branding and all sections
  are children of the same scrollbox
cli/src/components/savant-ui/primitives/sidebar-section.tsx:94
  fg={theme.primary} on every section heading
cli/src/components/savant-ui/echo/agent-status.tsx:53,58
  both phase and runtime activity use fg={theme.muted}
cli/src/components/right-sidebar-sections.tsx:183-212,243
  Cost, Mode, Model, Context and Cache use KeyValueRow
cli/src/components/savant-ui/echo/fid-card.tsx:14-15,48,112
  status/severity are accepted props; displayed title is FID-${shortId}
cli/src/components/sidebar-rail.tsx:14,22-30,212
  RAIL_WIDTH = 14; text section labels; every click expands the full sidebar
cli/src/utils/fid-loader.ts:108-120
  parsed FidData carries summary, status and severity, but no title
cli/src/hooks/use-fids.ts:59-60
  loadFids plus countArchivedFids; preserve this inexpensive archive count
```

The existing `fid-sidebar-review-20261005` tmux pane was captured read-only.
It shows a large centered wordmark/tagline, repeated accordion headings and
plain session rows. It is an older running session: it is layout evidence,
not proof of the current tree's colors, cache row or final native behavior.

Additional evidence used to constrain the design:

```text
cli/src/utils/theme-system/palette.ts:12,25,28-29,117,128,131-132
  primary/background/surface/surfaceHover already support dark and light
cli/src/components/savant-ui/feedback/progress-bar.tsx:57-58
  default bar thresholds are >70 error and >40 warning
cli/src/components/right-sidebar-sections.tsx:204-209
  current Context row uses >=70% warning and >=100% error
cli/src/hooks/use-animation-budget.ts:150-155
  a mounted, unsuspended budget hook holds renderer.requestLive()
cli/src/utils/glyphs.ts:123-136,151-152
  ASCII override disables Nerd Font detection, but activeGlyphTier still
  returns Unicode; the promised ASCII tier needs a narrow corrective fold
cli/src/components/savant-ui/echo/perfection-loop.tsx:27-57
  FID status aggregation chooses the most advanced phase, not a run phase
```

## Impact Assessment

### Affected Components

- Composition: `cli/src/components/right-sidebar.tsx`,
  `right-sidebar-header.tsx`, `right-sidebar-sections.tsx`,
  `right-sidebar-format.ts`, `right-sidebar-focus.ts`, `sidebar-rail.tsx`,
  `cli/src/chat/sidebar.tsx`, `cli/src/chat/styles.ts`,
  `cli/src/chat/types.ts`, `cli/src/chat/build-chat-layout-props.ts`.
- Reusable UI: `cli/src/components/savant-ui/primitives/sidebar-section.tsx`,
  `primitives/key-value-row.tsx`, `echo/agent-status.tsx`, `echo/token-meter.tsx`,
  `feedback/progress-bar.tsx`, `echo/fid-card.tsx`, `echo/fid-list.tsx`,
  `echo/perfection-loop.tsx`, `echo/loop-status-panel.tsx`,
  `echo/drive-status-panel.tsx`, `theme.ts`.
- Data and motion seams: `cli/src/utils/fid-loader.ts`,
  `cli/src/utils/glyphs.ts`, `cli/src/hooks/use-fold-collapse.ts`,
  `cli/src/components/savant-ui/echo/phase-indicator.tsx`.
- Small cohesive extractions, if required by the 300-line ceiling:
  `cli/src/components/right-sidebar-summary.tsx`,
  `cli/src/components/right-sidebar-display.ts`,
  `cli/src/components/right-sidebar-motion.tsx`.
- Verification paths are enumerated below. Existing theme palette and runtime
  data contracts are inputs to the design; the design reuses their authority.
- Operator-facing design and usage documentation:
  `docs/design/sidebar-command-console.md`; CHANGELOG and session evidence
  are updated at implementation and closure.

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

Layout changes can consume the detail viewport; changed focus registration
can make sections inaccessible; meters can misrepresent unknown data; motion
can keep the renderer live unnecessarily. Native captures and semantic pins
are required in addition to source and type checks. The runtime execution,
provider setup and ECHO enforcement channels retain their existing owners.

## Proposed Solution

### Approach

Audience: operators supervising coding work. Primary hierarchy: current
activity, route/model and context pressure, then changed files and FID work,
then supporting history, tools and automation details.

#### Visual contract

1. Sidebar uses `theme.surface`, transcript uses its existing background;
   add a one-cell neutral divider using `theme.border`. Focus/hover uses
   `theme.surfaceHover`; active accents use `theme.primary`. All colors come
   from existing semantic theme tokens. No sidebar-specific hex palette.
2. Retain the real Savant wordmark and its existing click behavior. Tighten
   surrounding blank rows; keep the tagline subordinate in spacious mode.
   Use the existing tiny S mark in compact mode. Version is quiet footer text.
3. Current work receives a narrow accent edge, a bold readable activity label
   and a bounded detail line. Idle is calm. Warnings/errors have explicit text
   and semantic color. Use `phaseMapping` and `activityMapping` for labels;
   display runtime activity and ECHO phase as distinct signals. Unknown phase
   or activity is labeled unknown rather than silently presented as idle.
4. Model is a dedicated line with provider/model identity. Mode and cost share
   a compact row where they fit; fall back to stacked rows when necessary.
   Context has a segmented meter, used/limit text and visible provenance.
   Cache and compaction information remain accessible in session detail.
5. Section headers use bold neutral text, a consistent chevron column and
   right-aligned counts when counts have a defined meaning. Primary cyan
   denotes focused controls or current work. Full-width hover/focus feedback
   makes the interactive row discoverable; focus also has a non-color cue.
6. FID rows show a concise document title, unambiguous date/sequence suffix,
   actual status and severity. Expanded content includes the full ID and
   complete summary with paragraph boundaries preserved. Critical/high
   severity stays visible in folded rows and section attention counts.

#### Composition and responsive contract

Keep the current 40-column sidebar and 100-column full-sidebar breakpoint.
Use native layout units; the divider is included within the 40-column budget.
The rail retains its current 14-column allocation and becomes more informative.
At the supported 50-column floor, an expanded rail preview narrows to 30 columns
and uses the tiny brand mark, preserving 20 chat columns. Normal full mode
remains 40 columns.

The rail has its own bounded scrollable navigation area: reserve at most two
rows for brand/activity, then scroll section controls when height is limited.
Its version/hint yields space first. A narrow peek uses the same density
policy as the full sidebar; expansion must still leave a usable chat column.

Measure the sidebar's actual allocated height through its renderable resize
events. At 20+ allocated rows, pin spaced brand/activity/model groups above
the detail scrollbox; cap this summary at 9 rows. Pin the context meter and
window provenance below the scrollbox with a neutral top divider. Retain at
least 6 detail rows. At 12-19 rows, pin at most a 3-row brand/activity strip
and place model in scrollable detail, with context last. Below 12 rows, pin one status
row and scroll the remaining content; suppress discretionary blank rows and
the footer before losing access to detail. Before measurement, use this
minimal mode. At 0-1 allocated rows render only what fits without overflow.

The exact same summary component supports fixed and scrollable placement;
only one copy of each session field mounts. Changing density or theme must
retain user folds, scroll position and focus through stable section identity.
Native evidence must demonstrate this, including after rail expansion.

Long model IDs, tool targets, research queries and titles wrap within the
allocated width or use explicit ellipsis with full text available in expanded
detail. Prefer full model identity in scrollable detail when summary space
is constrained. Reuse terminal display-width helpers, never string length
for cell-fit calculations. Unicode and wide characters cannot spill into chat.

Retain all existing sections: active agents, session diagnostics, Teacher,
FID Perfection Loop, Trust Matrix, scheduled Loop, Auto Drive, Tools, Files,
Active FIDs and History. Existing conditional mounts and initial folds remain
the defaults. Organize supporting sections visually; separate FID review
progress, runtime phase and scheduled automation in wording. FID status is
shown per document; never imply that the most advanced FID describes every
FID or a percentage of work completed.

#### Truthful data and attention contract

- Session lifecycle comes from the already-derived `StatusIndicatorState`:
  thread it through `buildChatLayoutProps` and `ChatSidebarProps` to both
  sidebar forms. Connecting/retrying/paused takes precedence over a stale
  working activity; clipboard/exit feedback stays transient feedback, not a
  work phase. Reuse the canonical status derivation without a second reducer.
  DriveStatusRecord has no paused/blocked field: only GoalRecord supplies
  those goal attention states. The rail labels drive phase and queue trend.
- Context: valid positive limit gives a meter; unknown/invalid limit gives
  `Window unknown` and no numerical percent. Clamp only the meter geometry;
  invalid/nonfinite/negative usage gives `Usage unknown` and no meter.
  keep true used/limit and over-limit state visible. Preserve the current
  >=70% warning and >=100% error thresholds. Pass an explicit semantic color
  through TokenMeter/ProgressBar so generic defaults cannot override them.
- Context provenance retains catalog/table/default distinctions. Cache retains
  `—`, `Not reported`, reported `0%`, sample denominator and rejected samples.
  Preserve every compaction outcome and its reason, including blocked and
  ineffective. These indicators are independent; do not invent billing savings.
- Section counts: FIDs = active records; files = existing created/modified
  counts displayed separately, without an unevidenced deduplicated total;
  history = retained tool events; tools = distinct used tool names. Empty and
  loading states are separate where `useFids.isLoading` provides that evidence.
  Loader failures remain indistinguishable from empty in the current API and
  are recorded as a known evidence limit, never a fabricated error signal.
- Rail attention: active runtime activity; critical/high active FID count;
  blocked/ineffective compaction; paused/blocked goal or drive state only when
  that state exists on the current snapshots. Static labels and glyphs carry
  meaning even without color. Missing signal means unknown/no observation,
  never a success claim. Format large counts within the rail width.

#### Interaction, motion and accessibility contract

Extend the existing sidebar focus controller for section-addressed focus and
reveal: register stable section IDs, and after rail activation expand and
focus the requested header once mounted. Plain F6 traverses controls in visual
order even with an input draft, preserving its text; Enter/Space activates.
Ctrl+G is not intercepted. Ctrl+B and its input-text guard remain intact.
Rail controls and fold handles become keyboard reachable through the same
controller. Scrolling reveals a focused offscreen control. Unmounting a
focused conditional section returns to the nearest surviving control or the
existing unfocused state, never a stale renderable. Manual fold stays sticky;
responsive peek and Escape/Ctrl+C behavior retain their existing contracts.

Reuse the 160 ms fold and existing timeline engine. A current-activity change
may trigger one 200 ms accent emphasis; text remains fully readable. Streaming
tokens, repeated targets and idle never restart decorative animation. Add a
documented sidebar motion opt-out, `SAVANT_CODE_REDUCED_MOTION=1` (also accepts
`true`, case-insensitive), resolved once at sidebar composition and passed to
fold/activity presenters. Disabled motion renders final states immediately.
Pause on blur/unmount and release every renderer live reference on completion.
Do not mount `useAnimationBudget` continuously on a static status panel: its
current implementation retains `requestLive` while unsuspended.

Use existing glyph names and their fallback authority. Correct the existing
ASCII override so `SAVANT_GLYPH_TIER=ascii` actually resolves ASCII, then route
new chevrons/status glyphs through `glyph()`. Normal text remains meaningful
without special fonts. Dark, light and overridden themes need readable text
contrast; measure actual foreground/background pairs and confirm raster
appearance in a current native session. Target 4.5:1 for ordinary text.

### Steps

All steps below are approved for implementation by the operator's 2026-10-08
instruction, "proceed w/ code." Document convergence precedes runtime edits.

1. Establish the surface and spacing contract using existing theme tokens;
   adjust compact branding, divider and fold-handle alignment.
2. Recompose RightSidebar into height-aware summary and detail regions; add
   the measurable density policy and stable section identity/focus order.
3. Promote AgentStatus and session summary; extend the existing format/meter
   seams for truthful context, provenance, cache and compaction presentation;
   thread the canonical session lifecycle signal through chat composition.
4. Extend SidebarSection with stable IDs and optional count/attention content;
   unify hover, focus, chevrons and actionable row geometry.
5. Add optional `FidData.title` through the existing loader/list/card path;
   extract `# FID: title` and `# FID-ID — title`, with full ID fallback.
   Preserve old fixtures without a title and summary parsing. Surface real
   status/severity and unambiguous IDs; retain full expanded descriptions.
6. Improve the rail's live summary and attention counts; route keyboard and
   mouse activation to the requested revealed section using the same controller.
7. Implement bounded activity emphasis and motion opt-out; correct the ASCII
   override through the existing glyph resolver; prove cleanup and static mode.
8. Add the acceptance pins below, run the static/runtime gates and native
   visual matrix, then write operator documentation and implementation evidence.
9. Present final evidence; close/archive only after implementation gates,
   review and authorized committed evidence exist. Evict T174 and its write
   targets on closure; update CHANGELOG and the session record.

### Verification

Extend existing suites for cache/compaction parity, FID title parsing, fold
defaults and focus cycling. Add `cli/src/components/__tests__/right-sidebar-design.test.tsx`
for rendered summary/detail composition and data-state contracts;
`cli/src/components/__tests__/sidebar-rail-navigation.test.tsx` for actual
rail activation/reveal/focus;
`cli/src/hooks/__tests__/sidebar-motion.test.ts` for opt-out, finite timeline
completion and cancellation; `cli/src/utils/__tests__/glyphs.test.ts` for the
three explicit tiers. New files are planned artifacts, absent before approval.
The responsive composition pin is split into
`cli/src/components/__tests__/right-sidebar-responsive.test.tsx` to keep the
native navigation suite below 300 lines. Every suite has a declaration below.

Acceptance pins must fail if the implementation loses a behavior: known-zero
versus unknown context/cache; 69/70/99/100/>100 context boundaries; provenance;
loading versus empty FIDs; title propagation from disk to card; all FIDs
reachable with long summaries; section/rail keyboard activation; reveal after
scrolling; fold preservation across resize/theme; unknown activity label;
no animation/live-reference retention after completion or when disabled.
Split meaningful suites before any TypeScript file exceeds 300 lines.

Rendered rows use sibling text nodes; do not nest OpenTUI `<text>` elements
when adding badges, mode/cost grouping or colored compaction values. Drive
and goal attention must be derived from their actual domain fields; a phase
label alone is not evidence of failure. Test the unknown/unsupported branch.

Use native OpenTUI in tmux for fresh dark/light captures at widths 50, 60,
80, 99, 100, 120 and 160, and heights 12, 19, 24, 28 and 40. Cover breakpoint
pairs and each density mode rather than claiming every Cartesian combination.
Required pairs: 50x19, 60x24, 80x24, 99x28, 100x28, 120x12, 120x19, 120x24,
160x40. Exercise idle, thinking, tool work with a long path, streaming,
paused/blocked, context pressure, loading/empty/populated FIDs, overflow,
manual fold, responsive peek, and motion off. Native fixtures use explicitly
labeled synthetic data and make no LLM calls. Include worst-case expanded
FID prose and conditional Teacher/Trust/Drive panels.

Capture plain text for clipping/content, ANSI output for colors, and raster
screenshots for visual comparison/contrast. If raster access is unavailable,
mark it NEEDS-REVIEW and obtain operator visual review before completion.
Static markup cannot prove actual layout, focus, motion or perceived polish.
Record before/after evidence under
`dev/scratchpad/active/sidebar-command-console-2026-10-08/` and document the
review in the session summary. Web font/DOM/ARIA rules are inapplicable to
this terminal surface; native focus/readability and glyph behavior apply.

Run root `bun run typecheck`, CLI test gates from `cli/`, zero-warning ESLint,
`bun run quality:report`, `bun run lint:md`, repository validation, scope
registration and Prettier checks. Document-only checks are executed now;
implementation tests and native acceptance are executed after approval.
Current execution results and remaining boundaries are recorded below.

## Verification Gates

- gate: typecheck cli
- gate: test cli/src/components/__tests__/right-sidebar-design.test.tsx
- gate: test cli/src/components/__tests__/sidebar-rail-navigation.test.tsx
- gate: test cli/src/components/__tests__/right-sidebar-responsive.test.tsx
- gate: test cli/src/components/__tests__/right-sidebar-cache.test.tsx
- gate: test cli/src/components/__tests__/right-sidebar-format.test.ts
- gate: test cli/src/components/savant-ui/echo/__tests__/sidebar-collapse.test.tsx
- gate: test cli/src/utils/__tests__/fid-loader.test.ts
- gate: test cli/src/hooks/__tests__/sidebar-motion.test.ts
- gate: test cli/src/utils/__tests__/glyphs.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:4861cd659e75b8ca877164b9dac92064f9a93eb8fc6fb1a4b3f020ee9f547c5d
- verified: 2026-10-09T06:37:57.188Z
- typecheck cli: exit 0
- test cli/src/components/__tests__/right-sidebar-design.test.tsx: exit 0
- test cli/src/components/__tests__/sidebar-rail-navigation.test.tsx: exit 0
- test cli/src/components/__tests__/right-sidebar-responsive.test.tsx: exit 0
- test cli/src/components/__tests__/right-sidebar-cache.test.tsx: exit 0
- test cli/src/components/__tests__/right-sidebar-format.test.ts: exit 0
- test cli/src/components/savant-ui/echo/__tests__/sidebar-collapse.test.tsx: exit 0
- test cli/src/utils/__tests__/fid-loader.test.ts: exit 0
- test cli/src/hooks/__tests__/sidebar-motion.test.ts: exit 0
- test cli/src/utils/__tests__/glyphs.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED and GREEN

- **RED:** source and native capture establish the flat hierarchy, muted live
  activity, missing FID title/status/severity and label-only rail cited above.
- **GREEN:** complete visual, composition, truthful-data, interaction, motion
  and native verification contracts written before implementation.
- **AUDIT:** Law 7 search found theme surfaces, phase/activity mappings,
  TokenMeter/ProgressBar, FID loader, focus controller and fold timeline.
  Extend those seams; new modules are limited to cohesive composition/display
  helpers. Runtime data ownership stays with existing snapshots.
- **ADVERSARIAL:** a fixed summary can consume a short viewport; generic bar
  thresholds can change warning behavior; an animation budget hook can keep
  an idle renderer live. All three are addressed explicitly in the contracts.
- **CHANGE DELTA:** initial document creation; no implementation.

### Missed Questions

1. **What does AAA mean here?** A deliberate terminal composition: operational
   focus, readable depth, consistent interaction states and measured polish.
2. **Can progress imply successful verification?** Only actual per-FID status
   is displayed; runtime phase and automation state remain separately labeled.
3. **Where do titles come from?** The existing file loader extracts the H1;
   existing consumers may omit the new optional title and fall back to full ID.
4. **Does this need a theme/settings migration?** Existing semantic tokens
   suffice; the motion opt-out is an environment input, not a settings rewrite.
5. **Can a prettier sidebar hide bad news?** Cache/compaction parity tests and
   explicit attention semantics prevent unknown/error states becoming success.
6. **Does it preserve older user choices?** Existing folds, manual sticky
   collapse, special logo click behavior and input shortcut guards are retained.

### Implementation Evidence (REQUIRED for closed)

Steps 1-8 and Step 9's implementation verification are complete following
"proceed w/ code" and the operator's final correction/closure directives.
Nine declared suites pass 57 tests; with Teacher/Trust regressions, 84 tests
pass across 12 files. Fresh root regression, typecheck, ESLint, markdownlint
and quality pass. The operator authorized local commits after archive and
changelog updates on 2026-10-09; implementation commit `2b6075e7`.

### Code Verification Evidence

- Native OpenTUI fixtures cover nine dark/light size pairs and lifecycle,
  conditional Teacher/Trust/Drive, unknown window, overflow, ASCII, expanded
  prose and 50-column peek states: 36 frames, zero ordinary-text contrast
  failures; measured minimum 5.38:1. Decorative wordmark/meter/divider graphics
  are excluded from the ordinary-text calculation.
- Fresh isolated tmux session `sidebar-console-20261009` supplies 18 ANSI
  captures at the required nine size pairs. Raster previews draw native cells
  with local fonts; they do not prove the operator's host-terminal font.
- `build-chat-layout-props.ts` passes canonical lifecycle to `ChatSidebar`,
  which retains one focus controller across sidebar/rail rebuilds and now
  subscribes to terminal resize. Native pins exercise the 99/100 breakpoint,
  manual fold stickiness, input guards, responsive hover and Ctrl+C dismissal.
- `RightSidebar` measures allocated height and retains section folds and
  scroll; native pins reach History at heights 8, 12, 19, 20 and 24. The
  50-column activation pin verifies chat remains visible with a 30-column peek.
- FID loader H1 title travels through list/card; disk-to-card tests preserve
  date collisions and full paragraphs. Native prose-end capture shows the
  final paragraph and subsequent card reachable by scrolling.
- Activity and fold motion tests prove completion/blur return live-reference
  counts to baseline. Fold blur listeners exist only while a tween runs.
- Root typecheck currently fails four concurrent gateway test fixtures missing
  `loadTelemetryAggregates`; no sidebar production error remains. Root quality
  finds `cli/src/server/gateway/handshake-rpc.ts` at 310 lines. Root ESLint
  reports 13 warnings in concurrent telemetry/eval/transition-phase surfaces.
  Repository validation additionally reports scratchpad-root clutter and
  database-shaped foreign roots. Exact results are retained in the session
  summary; these are not reported as passing gates.
- Scope registration/disposition, markdownlint and `git diff --check` pass.
  `fid:verify --check` passes its structural scan; this converged FID is not
  receipt-enforced, so that scan is not an implementation gate receipt.

### Loop 2 — Independent audit and self-correction

- **RED:** rail overflow was not specified; badges risk nested native text;
  a generic drive attention label could infer failure from a phase name.
- **GREEN:** rail scroll budget, sibling-text rendering and domain-evidenced
  attention requirements folded into the applicable contracts above.
- **AUDIT:** cold re-read against `sidebar-rail.tsx:138-244` (fixed-height
  menu), `phase-indicator.tsx:18-20` (native nested-text restriction),
  `drive-status-panel.tsx:25,45-65` (actual goal/phase fields). Each finding
  has an implementation step and an acceptance path.
- **ADVERSARIAL:** stationary chrome cannot reserve the whole rail; attention
  cannot imply success/failure without observations. Both paths now have
  explicit fallbacks. No runtime or implementation PASS is claimed.
- **CHANGE DELTA:** 5.89% (Levenshtein 1,365 / 23,170 characters).

### Loop 3 — Call-graph audit and self-correction

- **RED:** paused/connecting/retrying has no producer in current sidebar
  props; DriveStatusRecord has no paused/blocked state member.
- **GREEN:** canonical lifecycle prop path added to Steps 3 and affected
  files; goal and drive attention separated by their actual domain types.
- **AUDIT:** `build-chat-layout-props.ts:129,165,234-250` computes/passes
  status to the status bar but omits it from sidebar props;
  `status-indicator-state.ts:3-13,87-100` declares and derives lifecycle;
  `common/src/types/auto-drive.ts:69-80` defines the drive mirror.
- **ADVERSARIAL:** a working label must not override waiting for operator
  input or reconnection. Tests now require canonical lifecycle precedence.
- **CHANGE DELTA:** 5.57% (Levenshtein 1,364 / 24,505 characters).

### Loop 4 — Contract audit

- **AUDIT:** gate parser: 10 gates, 0 errors; promise contract: 0 errors,
  0 warnings. Four new test paths correctly remain absent before approval.
- **SELF-CORRECT:** invalid usage cannot produce a numeric meter; drive
  citation corrected to its measured lines. No remaining design findings.

### Loop 5 — Final convergence

- **AUDIT / ADVERSARIAL:** re-read scope, data producers, viewport budgets,
  focus/reveal, motion cleanup and gate coverage; no actionable finding.
- **CONVERGED:** two passes below 2% change. Loop 4: 1.61%; Loop 5's exact
  delta is recorded in the session summary. Implementation was then authorized.

### Loop 6 — Implementation and native self-correction

- **GREEN:** surface/summary/detail hierarchy, title/status/severity rows,
  rail navigation, lifecycle precedence, truthful meters and finite motion.
- **AUDIT / SELF-CORRECT:** native inverse attributes made a focused label
  foreground/background identical; use underline plus surface feedback.
  Native root measurement needed a first-layout retry. The responsive
  composition lacked a resize subscription; subscribe through the existing
  terminal-dimensions hook. A 50-column peek needed to yield chat columns.
- **ADVERSARIAL:** permanent per-fold blur listeners broke isolated static
  rendering and exceeded the renderer listener limit. Replace them with
  optional AppContext access and a listener only during an active tween;
  completion, blur and unmount remove it. Native motion pins now pass.
- **SELF-CORRECT:** long Trust paths wrap; Active Agent/History text uses
  readable existing theme tokens. Preserve full FID paragraph boundaries.
  Separate responsive tests from navigation before the 300-line ceiling.

### Loop 7 — Native/data audit

- **AUDIT:** all nine declared suites plus Teacher/Trust regressions pass;
  native keyboard/mouse/resize/fold/scroll and live-reference pins execute.
  Native cell contrast passes in all 36 captured states. Full-prose end and
  conditional panels were inspected as raster previews.
- **ADVERSARIAL:** fixtures are labeled synthetic, including the presentation
  Trust signature. No fixture claims a provider call or cryptographic proof.
  Large wordmark color remains branding; ordinary text has measured contrast.
  Custom palettes without a readable token and the actual host font remain
  explicit evidence limits. No aggregate FID progress claim is introduced.
- **CHANGE DELTA:** zero production changes in this review pass.

### Operator correction — 2026-10-09

The operator reported a cluttered top summary, proposed moving context to the
bottom, and identified Ctrl+G as conflicting with Cursor quick selection.
This correction is authorized within T174. F6 is the chosen replacement
after the optional preference prompt; no host-wide availability is claimed.
The operator additionally requires restoring the centered tiny S rail logo
and the original raised rounded collapse/expand buttons. Preserve their
surface, border, horizontal padding and overlap with the divider; add keyboard
access without replacing their appearance. The full Savant wordmark and its
click action remain intact. Native tests pin logo presence and button geometry.
Two document checks confirm these restorations fit the existing rail budget
and focus controller; the 20-row full-sidebar budget is unchanged.
The operator also requires centered folded navigation. Center the S mark,
activity, control labels/details and version within the rail; native geometry
assertions and dark/light rail captures must verify this requirement.
Center the context label, meter and provenance within the bottom area. The
operator reports lost context after collapse/expand: pin repeated real
ChatSidebar toggles, mouse fold/unfold and responsive peek recovery. Inspect
native height notifications and preserve truthful context across remounts.
Both document checks retain these recovery requirements before correction.
Final operator refinements: center the version directly above the context
meter, outside spacious scrolling, and remove the redundant status row under
the folded S mark. The rail's Activity control retains that status. The footer
now budgets 5 rows, leaving 6 detail rows at 20; two document checks preserve
this threshold and the existing recovery pins before implementation.
Add one blank row between the folded S mark and Activity when more than four
rows are available; preserve minimal-height reachability. Two brief checks
confirm this is spacing, without reinstating the redundant status row.

- **RED / ANALYZE:** the existing summary combines four signals in 12 rows;
  thinking activity repeats the model. Both sidebar variants intercept Ctrl+G.
- **Document review 1:** separate the three top groups with one blank row,
  suppress only the top activity detail, and share the existing truthful meter
  in a bottom context component. Spacious allocation is 9 top + 4 bottom,
  leaving 7 detail rows at the 20-row threshold. Short modes put context last
  in the scrollbox to preserve reachability. Native assertions cover placement,
  minimum viewport, resize, context uniqueness and draft-preserving F6.
- **Document review 2 / ADVERSARIAL:** no additional design changes. Existing
  activity detail, provenance, unknown/zero/overflow semantics and Ctrl+B guard
  remain required. Legacy Ctrl+G and modified F6 must not cycle. Raster evidence
  and native interaction evidence remain required; prior captures alone do not
  verify this revision. Correction brief converged before production edits.

### Loop 8 — Final code review

- **AUDIT / ADVERSARIAL:** cold call-graph and contract review found no new
  sidebar defect. Existing data authority, cache/compaction semantics,
  glyph resolver, logo action, input guards and conditional panels survive.
- **CHANGE DELTA:** zero production changes in this review pass. The two
  unchanged code reviews do not turn failing repository gates into PASS.
- **OPEN:** repository gate failures, operator terminal-font acceptance and
  authorized committed evidence. FID remains active at `converged`; it is not
  marked fixed/verified/closed without the required successful receipt.

## Resolution

### Revision evidence — 2026-10-09

- All operator corrections above are implemented. F6 preserves drafts;
  Ctrl+G passes through. The S mark, raised rounded buttons and centered rail
  are restored. A blank row separates the mark and Activity. Version and
  context are centered at the bottom; context appears once after toggling.
- Native resize diagnosis: OpenTUI 0.5.3's layout callback emits `resize`,
  whereas `LayoutEvents.RESIZED` is `resized` and belongs to explicit resize.
  Both surfaces now observe layout `resize` with a settled measurement retry
  and cleanup (`right-sidebar.tsx:100`, `sidebar-rail.tsx:63`). This fixes stale
  density on resize/remount. Real ChatSidebar mouse fold/unfold passes at
  20/24/40 rows; responsive peek, keyboard folds and input guards also pass.
- Nine declared suites: 57 pass. With three Teacher/Trust regressions:
  **84 pass, 0 fail, 394 assertions, 12 files**. Native pins assert six detail
  rows at 20, footer/rail centering, raised button geometry, spacing, legacy
  shortcut rejection, context uniqueness and scroll fallback.
- `revision-bottom-context/` holds 38 fresh native character/ANSI/cell/PNG
  states, including dark/light manual folds. Ordinary-text contrast has zero
  failures and minimum 5.38:1. Final full/folded PNGs were inspected. Fresh
  isolated tmux full/folded frames and re-expanded context were inspected.
- Changed sidebar ESLint and Prettier pass. The completion pass repaired
  gateway fixture compatibility, split the 310-line handshake, cleared 13
  import warnings, preserved/ignored local database artifacts and archived
  the historical scratchpad transcript. Root typecheck, ESLint, markdownlint
  and quality now pass; root regression is 8,572 pass, 23 skip, zero failures.
- Final two code/contract reviews found no additional actionable sidebar
  finding and made zero production changes. The operator reviewed the live
  sidebar, supplied the refinements recorded above, then instructed completion
  and closure. Native cells/local-font raster captures remain the measured
  evidence; no unmeasured host-font contrast claim is made.

- **Closed Date:** 2026-10-09
- **Commit Authorization:** Operator: "you can commmit it after you properly
  archive it and update the changelog". Archive and changelog completed before
  the authorized local implementation commit.
- **Implementation Commit:** `2b6075e7ebf7039d25ec9953321b21ba70417a76`
- **Fix Description:** Command-console sidebar implemented and presented.
- **Tests Added:** Five new files and existing loader/collapse extensions;
  nine declared suites plus Teacher/Trust regressions pass.
- **Verification Evidence:** Native fixtures, 38 revision cell captures plus
  historical captures, fresh tmux full/folded views, all root gates and full
  regression. Earlier failing-gate bullets are historical, superseded above.
- **Archived:** `dev/fids/archive/FID-2026-1008-006-sidebar-command-console-visual-redesign.md`.
  Receipt above: 11/11 gates pass. Earlier open findings are historical,
  superseded by the completed revision and repository evidence above.

## Lessons Learned

A visual redesign must specify truthful data, density changes and interaction
states alongside colors. A persistent operational summary earns its place
only when detail remains reachable in the smallest supported viewport.
