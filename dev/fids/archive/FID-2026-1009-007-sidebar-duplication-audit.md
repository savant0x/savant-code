# FID: Sidebar duplication audit + FSM phase color-coding restoration

**Filename:** `FID-2026-1009-007-sidebar-duplication-audit.md`
**ID:** FID-2026-1009-007
**Severity:** medium
**Status:** verified
> Historical implementation verification only; the operator later cancelled
> sidebar work. This record is archived-declined; no sidebar acceptance is claimed.
**Created:** 2026-10-09 20:20
**Automation level:** 3
**YAGNI-Compliance:** Pending

> Loop 1 closed 2026-10-09: RED (rendered-frame evidence + git history),
> GREEN (the one-home plan), AUDIT and ADVERSARIAL recorded below —
> no blocking findings. Implementation completed 2026-10-09 (all 6
> steps; Loop 2 records the implementation audit). Status flipped
> `converged` → `verified` per FID-2026-0915-004. Closure awaits a local
> path-scoped commit and the remaining closure record. Under the 2026-10-11
> G1 ruling, that commit needs no separate authorization; push still
> requires explicit operator authorization.

---

## Summary

Operator report 2026-10-09: *"looking at the sidebar we had an agent mess up
my sidebar, for example, 'actvity details' contains the info, then above it
it shows thinking/idle and the model /mode? Not sure how that happened but
we need to audit the sidebar for duplications and most likely remove a few
sections considering the info is duplicated. To be clear 'activity detail'
is correct, the things above it are wrong. Also the phases ilde red/green/etc
used to be color coded, that feature needs to return. This needs a
fid+perfection loop"*.

Two defects, one root cause family (the v0.0.5 TUI rebuild + the
FID-2026-1008-006 "polish" pass):

1. **Duplication.** The right sidebar renders the live status twice: a
   fixed area at the top (activity label + phase + `Model ·` + `mode · cost`)
   and the "Activity detail" section in the scroll tree (activity detail +
   phase + model). The operator rules the section correct and the top area
   wrong.
2. **Lost color coding.** The FSM phase line renders hardcoded
   `theme.muted` in `AgentStatus`; the per-phase `colorKey`s in
   `phase-info.ts` (idle→muted, red→error, green→success, audit→warning,
   adversarial→phaseAdversarial, self_correct→warning, complete→primary)
   are never resolved on that path. Before the v0.0.5 rebuild the sidebar
   carried its own `PHASE_INFO` table with per-phase hex.

## Environment

- **OS:** Windows (win32), Git Bash / MSYS
- **Language/Runtime:** TypeScript strict, Bun 1.3.14, OpenTUI 0.5.3 /
  React 19 (CLI TUI)
- **Commit/State:** `main` @ `a6f04079` (working tree carries this
  session's T177/T178/T180 work, all gate-verified)

## Detailed Description

### Problem

**Defect 1 — the duplication (rendered evidence, 160x40, fsmPhase=green,
activity=thinking, captured 2026-10-09 via the OpenTUI test renderer):**

```text
│ │ ● thinking                    <- top fixed area: activity label
│ │ ECHO · GREEN                  <- top fixed area: phase (muted)
│ │
│ │ Model · vendor/fully-qualified-model…   <- top fixed area: model
│ │ HYBRID · $0.25                <- top fixed area: mode · cost
│ │ ▶ Activity detail             <- the section (collapsed by default)
│ │ ▼ Session
│ │   Cache                       —
...
```

With "Activity detail" expanded it renders (`AgentStatus detailOnly` +
the section's model line): the activity detail (for `thinking`, the model
name), `ECHO · GREEN`, and the model id. So the phase appears twice, the
model appears twice, and the activity signal appears at two granularities.

**Defect 2 — the lost color coding.** `agent-status.tsx` renders the phase
line as `<text fg={theme.muted}>` in both the `detailOnly` branch
(:88-90) and the normal branch (:158-162). `phase-info.ts` still carries
the per-phase `colorKey` map and `resolveThemeColor` exists (used by
`phase-indicator.tsx:33`) — the sidebar path simply never calls it. Git
evidence: `740d0637` (v0.0.5 TUI rebuild) deleted the inline
`PHASE_INFO` table from `right-sidebar.tsx` (idle `#6b7280`, red
`#ef4444`, green `#39ff14`, audit `#eab308`, self_correct `#f97316`,
complete `#06b6d4`) and the replacement never wired the colorKeys into
the sidebar's phase line.

### Expected Behavior

Every live fact has exactly one home in the sidebar. "Activity detail" is
that home for the current activity: the activity detail line, the FSM
phase line **in the phase's own color**, the model, and the mode · cost
line. The fixed area above carries no duplicated status. The phase colors
match the pre-rebuild semantics through the theme tokens (red=error,
green=success, audit=warning, adversarial=phaseAdversarial, fix=warning,
done=primary, idle=muted).

### Root Cause

- The duplication: `2b6075e7` (FID-2026-1008-006, "polish sidebar command
  console") introduced the `compact`/`detailOnly`/`hideDetail` prop split
  on `AgentStatus` and mounted a second copy (compact, `hideDetail`) in
  the fixed top area beside `SidebarSessionSummary`, while the
  "Activity detail" section kept the full copy — two renderers of one
  state, with no test pinning the absence of duplication.
- The color loss: the v0.0.5 rebuild (`740d0637`) extracted the color
  table to `phase-info.ts` as theme colorKeys and wired
  `PhaseIndicator`, but the sidebar's own phase line kept a hardcoded
  `theme.muted`.

### Evidence

- Rendered frame (above) captured 2026-10-09 with the OpenTUI test
  renderer at 160x40.
- `cli/src/components/right-sidebar.tsx:186-191` (top `AgentStatus
  compact hideDetail`), `:133-139` (top `SidebarSessionSummary`),
  `:225-232` ("Activity detail" section: `AgentStatus detailOnly` +
  model line).
- `cli/src/components/savant-ui/echo/agent-status.tsx:80-92` (detailOnly
  branch, phase line hardcoded muted), `:158-162` (normal branch, same).
- `cli/src/components/savant-ui/echo/phase-info.ts:24-36` (PHASE_MAP with
  colorKeys), `cli/src/components/savant-ui/icon-theme-keys.ts:59-67`
  (`resolveThemeColor`), `phase-indicator.tsx:33` (the working consumer).
- `git show 740d0637~1:cli/src/components/right-sidebar.tsx` — the
  pre-rebuild per-phase hex table.
- Consumer census: `AgentStatus` is mounted only by `right-sidebar.tsx`
  (two sites); `SidebarSessionSummary` by `right-sidebar.tsx` (top) and
  `right-sidebar-sections.tsx:174` (Session section when
  `summaryVisible` is false — the sidebar passes true, so no third copy
  today).

## Impact Assessment

### Affected Components

- `cli/src/components/right-sidebar.tsx` (layout: remove the duplicated
  top blocks; Activity detail becomes the single status home)
- `cli/src/components/savant-ui/echo/agent-status.tsx` (phase color
  restoration; the section gains the mode · cost line)
- `cli/src/components/right-sidebar-sections.tsx` (Session section keeps
  its non-summary rows; no model/mode repeat)
- `cli/src/components/right-sidebar-summary.tsx` (unchanged API; the
  top-area caller goes away)
- Tests: `cli/src/components/__tests__/right-sidebar-responsive.test.tsx`
  (full-sidebar frame pins), `right-sidebar-design.test.tsx`,
  `savant-ui/echo/__tests__/sidebar-collapse.test.tsx`

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium: TUI presentation only — no runtime correctness surface; the
      responsive/design/collapse suites pin the frame and must stay green
- [ ] Low

## Proposed Solution

### Approach

One home per fact. Remove the duplicated fixed-area blocks; make
"Activity detail" the single status home (default-expanded so the info is
visible without a click, matching the operator's expectation); restore
the per-phase color through the existing `resolveThemeColor` seam.

### Steps

1. `right-sidebar.tsx`: remove the top-area `AgentStatus` (compact,
   `hideDetail`) and the top-area `session` (`SidebarSessionSummary`)
   mounts; the fixed area keeps the header/branding only. The scrollbox's
   non-spacious `session` mount goes away too (its facts move into
   Activity detail) — the Session section keeps Agent/Compaction/Cache.
   **implemented 2026-10-09**
2. `agent-status.tsx` `detailOnly` branch: render the phase line with
   `resolveThemeColor(theme, phaseMapping(phase).colorKey)`; add the
   mode · cost line so no fact is lost with the top area (props flow
   through the section). **implemented 2026-10-09** — the color resolves
   through the new pure `sidebarPhaseColor(theme, phase)` helper in
   `right-sidebar-display.ts` (the module's established helper pattern);
   the mode · cost line renders in the section, not inside AgentStatus
   (the section composes; AgentStatus stays activity+phase focused)
3. `right-sidebar.tsx`: "Activity detail" gains `defaultExpanded` and the
   mode · cost line; the spacious-only bare model line folds into the
   section's single model row. **implemented 2026-10-09** — the section
   carries `KeyValueRow` Model + Mode rows at every density (the
   responsive test's `Model` pin flows through the full sidebar, and
   `KeyValueRow` renders no `·` so the rail-collapse
   `not.toContain('Model ·')` pin holds)
4. Restore the color on the normal branch too (the barrel export stays
   honest for any future consumer). **implemented 2026-10-09**
5. Tests: pin the single-home invariant (phase text appears once, model
   appears once), the per-phase colors (each phase resolves to its
   colorKey's theme color), and keep the responsive/design/collapse
   suites green. **implemented 2026-10-09** — three new files:
   `right-sidebar-single-home.test.tsx` (frame pins: `ECHO · GREEN`
   once, `Model` once, no `Model ·`, `HYBRID · $0.25` present,
   `▼ Activity detail`), `right-sidebar-phase-color.test.tsx`
   (real-renderer wiring: all seven phases render their own color, six
   distinct), `agent-status-phase-color.test.tsx` (helper unit pins:
   per-phase keys, distinctness, unknown → muted, valid hex)
6. Verification: cli typecheck, the sidebar suites, eslint, prettier,
   lint:md, quality, validate:repository. **implemented 2026-10-09** —
   all declared gates green; full CLI battery 4099 pass / 0 fail

### Verification

Typecheck cli; run the sidebar suites (responsive, design, collapse) plus
the savant-ui echo suites; eslint; prettier on touched files; lint:md;
quality:report; validate:repository. A rendered-frame probe at 160x40 and
100x24 confirms the duplication is gone and the phase line carries the
phase color.

## Verification Gates

- gate: typecheck cli
- gate: test cli/src/components/__tests__/right-sidebar-responsive.test.tsx
- gate: test cli/src/components/__tests__/right-sidebar-design.test.tsx
- gate: test cli/src/components/savant-ui/echo/__tests__/sidebar-collapse.test.tsx
- gate: test cli/src/components/__tests__/right-sidebar-single-home.test.tsx
- gate: test cli/src/components/__tests__/right-sidebar-phase-color.test.tsx
- gate: test cli/src/components/savant-ui/echo/__tests__/agent-status-phase-color.test.tsx
- gate: quality

### Verification Receipt

- fingerprint: sha256:83083ec445acafcce5fe70447f9be9c1df72dc5ed08b71935da87787fa7abaaa
- verified: 2026-10-11T04:29:43.811Z
- typecheck cli: exit 0
- test cli/src/components/__tests__/right-sidebar-responsive.test.tsx: exit 0
- test cli/src/components/__tests__/right-sidebar-design.test.tsx: exit 0
- test cli/src/components/savant-ui/echo/__tests__/sidebar-collapse.test.tsx: exit 0
- test cli/src/components/__tests__/right-sidebar-single-home.test.tsx: exit 0
- test cli/src/components/__tests__/right-sidebar-phase-color.test.tsx: exit 0
- test cli/src/components/savant-ui/echo/__tests__/agent-status-phase-color.test.tsx: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** (a) the rendered frame above — the top fixed area duplicates
  the Activity detail section's phase and model, and repeats the activity
  signal at a coarser granularity; (b) the phase line is hardcoded
  `theme.muted` in both `AgentStatus` branches while `phase-info.ts`
  carries unused per-phase colorKeys; (c) git history pins both regressions
  (`740d0637` color loss, `2b6075e7` duplication); (d) no test pins the
  single-home invariant.
- **GREEN:** the 6-step plan above.
- **AUDIT (design verification against the live tree, 2026-10-09):**
  (1) Consumer census — `AgentStatus` is mounted only by
  `right-sidebar.tsx` (top compact + section detailOnly) and re-exported
  from the savant-ui barrel; `SidebarSessionSummary` by the top area and
  by the Session section when `summaryVisible` is false (the sidebar
  passes true — no third copy today). (2) The responsive test's
  `toContain('Model')` pins flow through the full `RightSidebar` (the
  rail peeks into it on hover — `sidebar-rail.tsx:94-102,173`), so the
  section's model row must carry the literal label; `KeyValueRow`
  (label left, value right, no `·`) satisfies both that pin and the
  rail-collapse `not.toContain('Model ·')` pin. (3) The model line is
  currently spacious-only in the section (`right-sidebar.tsx:227-231`)
  while the top summary carried it at every density — the section row
  must be unconditional or compact widths lose the model. (4) The
  mode · cost fact exists only in the top summary — it moves into the
  section so no fact is lost. (5) `sidebar-collapse.test.tsx` pins only
  `SidebarSection`/`FidCard`/`FidList` defaults and the focus cycle —
  unaffected. (6) `resolveThemeColor` is defensive (falls back to
  `theme.foreground`, never throws — Law 14) and every PHASE_MAP colorKey
  exists on `ThemeColorKey`.
- **ADVERSARIAL:** challenge — (1) does removing the top area lose the
  activity LABEL at any density? Yes for the full sidebar (the rail keeps
  `display.label`); accepted — the operator ruled that line wrong and the
  detail line carries the activity's identity, the phase line carries the
  FSM state; (2) could the section's default-expanded change break the
  responsive frame pins? The pins assert presence/absence of specific
  strings, not section fold state; (3) is the normal `AgentStatus` branch
  now dead? It has no production caller after the top mount is removed,
  but it is barrel-exported API — the color fix keeps it honest and prop
  removal is explicitly deferred, not silently done; (4) does the phase
  color regress contrast? The colorKeys are the theme's own semantic
  tokens (error/success/warning/primary/muted) — the same tokens the
  design test's readability pin covers for primary/muted/warning/error.
  Verdict: no blocking findings; the plan may implement.
- **CHANGE DELTA:** n/a (document authored; no code pass yet)

### Missed Questions

1. **Does the mode · cost fact survive the top area's removal?** It must —
   step 2 moves it into Activity detail. The operator named model/mode as
   part of the info, so the section becomes the complete home.
2. **Should Activity detail be default-expanded?** Yes — the operator
   reads it as the status home; a collapsed home hides the fix. Session
   and Files Changed are already `defaultExpanded`, so this follows the
   discovered pattern.
3. **Does the responsive test's `Model` pin still hold?** At 100x24
   (compact) the Activity detail section renders the model line, so
   `toContain('Model')` holds; the rail-collapse pins (`not.toContain('Model ·')`)
   hold because the rail renders branding only.
4. **Is the `compact`/`hideDetail` prop surface now dead?** After the top
   mount is removed, `AgentStatus` has one caller (detailOnly). The props
   stay (barrel-exported API) but the normal branch's color fix keeps it
   honest; removing the props is a separate cleanup, not silently done
   here.

### Implementation Evidence (REQUIRED for `closed`)

- [ ] **Commit SHA:** pending — local path-scoped commit not yet recorded.
      G1 permits the commit without separate authorization; push remains
      explicitly authorization-gated.
- [x] **File:line ranges:** `cli/src/components/right-sidebar.tsx`
      (top-area `AgentStatus`/`session` mounts and the `session` variable
      removed; the "Activity detail" section restructured with
      `defaultExpanded` + Model/Mode `KeyValueRow`s; imports),
      `cli/src/components/savant-ui/echo/agent-status.tsx` (phase color
      via `sidebarPhaseColor` in both branches; one pre-existing
      line-wrap fix), `cli/src/components/right-sidebar-display.ts`
      (new `sidebarPhaseColor` helper)
- [x] **Gate output:** all 8 declared gates run live 2026-10-09 — cli
      typecheck exit 0; responsive/design/collapse suites green; the
      three new suites green (single-home 1/1, phase-color wiring 1/1,
      helper units 4/4); quality PASS (1503 files); full CLI battery
      4099 pass / 0 fail; eslint 0/0; prettier clean on touched files;
      lint:md exit 0; validate:repository PASS; scope-register PASS
- [x] **Reproducibility:** the three new suites re-run offline; the
      rendered-frame evidence reproduces via the OpenTUI test renderer
      at 160x40
- [x] **Step statuses:** all 6 steps `implemented`

### Code Verification Evidence

- [x] Files referenced in Affected Components exist (verified 2026-10-09:
      all cited paths read or grepped this session)
- [x] Implementation matches the Proposed Solution: verified 2026-10-09 —
      the top-area duplicates are gone, Activity detail is the single
      default-expanded home, and the phase line carries the phase color
- [x] Typecheck/tests/lint pass with pasted tool output: verified
      2026-10-09 (gate output above)
- [x] Production call-graph evidence for new wiring: verified 2026-10-09 —
      `sidebarPhaseColor` is consumed by `agent-status.tsx` (both
      branches); the section's Model/Mode rows render from `props` in
      `right-sidebar.tsx`; the removed mounts leave no dangling imports
      (typecheck + eslint prove); the wiring test asserts the rendered
      RGBA per phase through the real renderer
- [ ] FID status reflects the actual implementation state: pending — the
      status flips at closure, blocked on the G2 commit

### Loop 2 — Independent audit and self-correction (implementation, 2026-10-09)

- **RED (implementation-time findings, all fixed in-pass):** (1) the
  first wiring-test approach used `renderToStaticMarkup`, which always
  rendered `idle` — zustand's `useStore` serves the INITIAL state as the
  React server snapshot, so store-driven phase state is invisible to SSR;
  the test was rebuilt on the real OpenTUI test renderer. (2) The tree
  walk first tried `chunks[].text` (empty at the buffer level) before
  finding `plainText` on `TextBufferRenderable`. (3) Three type errors in
  the new tests (`AgentActivity` uses `startedAt` for thinking and
  requires `since` for idle; the theme index needed the resolver's type).
  (4) A pre-existing prettier drift line in `agent-status.tsx` (81 chars,
  in the original 159-file census) was fixed in-pass since the file was
  being edited. (5) The FID-005 receipt needed the extended
  `model-picker-free-section.test.ts` declared as a gate
  (FID-2026-0918-006 contract) — added and re-stamped.
- **GREEN:** all five fixed; the final tree renders the single home
  (frame captured 2026-10-09): `▼ Activity detail` → detail line,
  color-coded `ECHO · GREEN`, `Model` row, `Mode` row — with the
  duplicated top area gone.
- **AUDIT (live evidence, final tree):** cli typecheck exit 0; the three
  new suites green (single-home 1/1 with 6 pins; phase-color wiring 1/1
  with 8 expects across seven phases; helper units 4/4); the sidebar
  suites green (responsive, design, collapse, cache, format — 32/32);
  the FULL cli battery 4099 pass / 0 fail (18 pre-existing skips);
  eslint 0/0 repo-wide; prettier clean on every touched file; lint:md
  exit 0; quality PASS (1503 files); validate:repository PASS;
  scope-register PASS. Call-graph: `sidebarPhaseColor` is consumed by
  `agent-status.tsx` (both branches); the section's Model/Mode rows
  render from `props` in `right-sidebar.tsx`; the removed top-area mounts
  leave no dangling imports (typecheck + eslint prove).
- **ADVERSARIAL:** challenge — (1) is any fact LOST by the top area's
  removal? The mode · cost line moved into the section (pinned); the
  activity label exists only on the rail now (accepted in Loop 1); the
  context summary is untouched at the bottom. (2) Could the section's
  default-expanded state break the density layouts? The frame pins hold
  at 160x40 and the responsive suite passes at 100x24/160x40/rail. (3)
  Is the color restoration faithful to the pre-rebuild semantics? The
  colorKeys map to the same semantic tokens (red=error, green=success,
  audit=warning, fix=warning, done=primary, idle=muted) — the wiring test
  asserts the rendered RGBA per phase. (4) Does `sidebarPhaseColor`'s
  theme param widen the pure-helper contract? It takes the ChatTheme the
  caller already holds — the same shape `sidebarActivity`'s callers use;
  no new coupling. Verdict: no blocking findings.
- **CHANGE DELTA:** modified —
  `cli/src/components/right-sidebar.tsx` (top-area mounts + session
  variable removed; Activity detail section restructured; imports),
  `cli/src/components/savant-ui/echo/agent-status.tsx` (phase color via
  the helper, both branches; one pre-existing wrap fix),
  `cli/src/components/right-sidebar-display.ts` (new `sidebarPhaseColor`
  helper); added this pass —
  `cli/src/components/__tests__/right-sidebar-single-home.test.tsx`,
  `cli/src/components/__tests__/right-sidebar-phase-color.test.tsx`,
  `cli/src/components/savant-ui/echo/__tests__/agent-status-phase-color.test.tsx`.

### Loop 3 — Final convergence

- **RED:** pending
- **GREEN:** pending
- **AUDIT:** pending
- **ADVERSARIAL:** pending
- **CHANGE DELTA:** pending

## Resolution

- **Archived-Declined:** operator-approved 2026-10-11 — "there are multiple fids w/ sidebar work, which i cancelled."
- **Disposition:** Operator cancelled all sidebar work. Earlier implementation and test notes remain historical evidence only; the sidebar was not accepted as complete.
- **Closed Date:** not closed (operator-declined 2026-10-11)
- **Archived:** 2026-10-11 as operator-declined; no completion claim

## Lessons Learned

Placeholder — completed at closure.
