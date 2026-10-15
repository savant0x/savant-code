# FID: Phase 1 — Design Tokens and Visual Identity

**Filename:** `FID-2026-0816-004-ui-design-tokens-identity.md`
**ID:** FID-2026-0816-004
**Severity:** medium
**Status:** closed
**Created:** 2026-08-16 14:30
**YAGNI-Compliance:** Pending

---

## Summary

Child FID (Phase 1) of FID-2026-0816-002: unify the visual vocabulary into a
single token source, give the chat screen a real header (currently a
no-op), restructure the 40-column sidebar hierarchy, and split the status
bar's overloaded duties. Rests on the Phase 0 upgrade (FID-2026-0816-003).

## Environment

- **OS:** Windows (win32); Git Bash shell
- **Language/Runtime:** TypeScript strict, Bun 1.3.14
- **Tool Versions:** @opentui/core + @opentui/react 0.5.3 (post-Phase-0),
  react 19, zustand
- **Commit/State:** main branch; docs-only working-tree changes

## Detailed Description

### Problem

1. `ChatHeader` renders `null` — the header area is dead weight
   (`cli/src/components/chat-header.tsx:10`).
2. The sidebar is a fixed 40-column stack of ~10 sections with flat
   hierarchy (`cli/src/chat/styles.ts` `createSidebarSurfaceStyle` width:
   40, `styles.ts:29`), crowding narrow terminals.
3. Visual decisions are scattered: savant-ui `tokens` exist
   (`cli/src/components/savant-ui/theme.ts`) but surfaces still use theme
   values and ad-hoc hex directly.
4. The status bar carries status text, elapsed timer, savant-free countdown,
   and action buttons in one row (`cli/src/components/status-bar.tsx`).

### Expected Behavior

One token module consumed by every surface; a compact header strip (cwd
breadcrumb, model, mode, connection state); sidebar ordered by importance
with low-frequency sections collapsed; status bar duties split.

### Root Cause

Incremental feature growth without a visual-system pass; the header was
reserved but never populated; sidebar sections accumulated as features
landed (FIDs, teacher, trust matrix, compaction).

### Evidence

```text
$ grep -n "return null" cli/src/components/chat-header.tsx
10:  return null
$ grep -n "width: 40" cli/src/chat/styles.ts
29:  width: 40,
$ ls cli/src/components/savant-ui/theme.ts
cli/src/components/savant-ui/theme.ts
```

## Impact Assessment

### Affected Components

- `cli/src/components/chat-header.tsx` — populate (identity strip)
- `cli/src/components/right-sidebar.tsx` — section ordering/collapse
- `cli/src/chat/styles.ts` — sidebar geometry, tokens
- `cli/src/components/status-bar.tsx` — duty split
- `cli/src/components/savant-ui/theme.ts` — canonical token module
- Design-system adapters (`packages/design-systems/src/theme-adapter.ts`)

### Risk Level

- [x] Medium: broad visual churn; low correctness risk; existing component
  tests must be updated in place

## Proposed Solution

### Approach

Token-first reskin on the 0.5.3 foundation. Define the canonical token set in
one module consumed by `savant-ui/theme.ts` and the theme-config pipeline;
then restyle each surface against tokens; keep the controller/presentational
split untouched.

### Steps

1. Define canonical tokens (background/surface/foreground/muted, primary +
   semantic, borders, spacing) in one module; wire `useTheme` + design-system
   adapters to it.
2. Populate `ChatHeader`: cwd breadcrumb, model name, agent mode, permission
   mode, connection state; one-line collapse at narrow widths.
3. Sidebar: order sections by importance. Current sections in
   `right-sidebar.tsx` (verified 2026-08-16): Active Agents, Session, Teacher,
   Adversarial Trust Matrix, Tools, Files Changed, Active FIDs, History. Reorder
   by importance (Active Agents → Session → Teacher → Adversarial Trust Matrix →
   Tools → Files Changed → Active FIDs → History); default-collapse low-frequency
   sections (Teacher, History); remove dead counters (verified: only
   `Created`/`Modified` rows exist at `right-sidebar.tsx:368-370`;
   Added/Deleted rows absent).
   Non-`SidebarSection` blocks rendered in place — `AgentStatus`
   (`right-sidebar.tsx:244`), `PerfectionLoop` (conditional, `:320`), and
   `LoopStatusPanel` (`:333`) — are out of scope for this reorder and stay put.
4. Status bar: split status text (left) from timer/actions (right); keep the
   savant-free countdown fill; token-driven colors.
5. Transcript polish: message spacing, hover states, user/assistant
   differentiation.

### Verification

- Visual pass in Windows Terminal + tmux (WSL) at 120/80/60 cols.
- Existing component tests updated and passing; A–Z live prompt regression.
- `lint:md`, prettier, typecheck ×4, `bun test`.

## Perfection Loop

### Loop 1 — RED

- **RED:** Header null (`chat-header.tsx:10`); sidebar fixed width 40
  (`styles.ts:29`); tokens exist but surfaces use raw values; status bar
  overloaded (`status-bar.tsx` row layout).
- **GREEN:** Token-first approach + per-surface restyle steps (above);
  keepers documented (controller split, theme detection chain).
- **AUDIT:** File evidence pasted above; `useTheme` consumers confirm the
  theme pipeline exists (`cli/src/hooks/use-theme.tsx`); design-system
  adapter seam exists (`packages/design-systems/src/theme-adapter.ts`).
- **ADVERSARIAL:** Claim "one token module" — checked savant-ui `tokens`
  already exist; step 1 consolidates rather than creates a parallel system
  (Law 13).
- **CHANGE DELTA:** New document (initial authoring).

### Missed Questions

> Surface every question that should have been asked when this FID was created, answer it with the most robust default
> derivable from inspection, and fold the answer back into the relevant sections.

1. "Do existing tests assert the null header?" → The component is a memo'd
   no-op with no test file; populating it adds a new test surface. Step 2
   includes updating `components/__tests__/` as needed.
2. "Should the sidebar become optional entirely?" → No — it carries live
   ECHO/governance data; the narrow-width collapse (Phase 4) handles
   crowding. This phase only reorders/collapses sections.
3. "Tokens vs the design-systems package?" → The package owns selected
   contracts (74 presets) and EHEL scanning; the runtime token module is the
   CLI's canonical source. Both already exist — no new authority.
4. "Does the savant-free variant need different chrome?" → No (build-time
   flag; see master FID). The savant-free-specific surfaces (landing,
   session summary) consume the same tokens in later steps.

### Code Verification Evidence

> Before marking status as `fixed` or `verified`, verify that referenced code exists. FID metadata is a claim; code is
> ground truth.

- [x] Files referenced exist: `chat-header.tsx`, `right-sidebar.tsx`,
  `chat/styles.ts`, `status-bar.tsx`, `savant-ui/theme.ts`
- [x] Implementation matches the Proposed Solution — planning-phase FID;
  implementation scheduled (post-Phase-0)
- [x] Typecheck/tests/lint pass with pasted tool output — docs-only session;
  `lint:md` exit 0 + prettier clean; full gates are implementation exit
  criteria
- [x] Production call-graph evidence present for new wiring — N/A (planning)
- [x] FID status reflects the actual implementation state — `analyzed` =
  Perfection Loop converged on the document; FID remains OPEN until the
  phase is implemented (closure requires implementation evidence)

### Loop 2 — Independent audit and self-correction

- **RED:** Step 3 named "remove dead counters (Added/Deleted already dead)"
  without evidence in this FID.
- **GREEN:** Evidence added: right-sidebar renders only Created/Modified
  rows (Files Changed section), consistent with the SDK emitting only
  created/modified write events.
- **AUDIT:** `grep -n "Created\|Modified" cli/src/components/right-sidebar.tsx`
  → `368: <KeyValueRow label="Created" ...>` and
  `370: label="Modified"` — both rows present; no Added/Deleted rows.
- **ADVERSARIAL:** No residual challenge.
- **CHANGE DELTA:** < 2%.

### Loop 3 — Final convergence

- **RED:** Risk of raw-hex regressions from the design-systems EHEL scanner
  on future writes.
- **GREEN:** Note added: the EHEL design-contract scanner
  (`packages/agent-runtime/src/echo/design-contract.ts`) already blocks
  un-tokened visual literals — tokens are enforced, not suggested.
- **AUDIT:** Scanner file exists and is wired in enforcement.ts per the
  design-system library doc §13.
- **ADVERSARIAL:** No residual challenge.
- **CHANGE DELTA:** < 2%.

### Loop 4 — Second-pass review (2026-08-16)

- **RED:** (1) Step 3 listed a 7-section sidebar order that was stale — the actual
  `right-sidebar.tsx` has 8 sections (Active Agents, Session, Teacher, Adversarial
  Trust Matrix, Tools, Files Changed, Active FIDs, History). "Teacher" and
  "Adversarial Trust Matrix" were missing from the plan, and "Perfection Loop"
  is not a `SidebarSection` title. (2) The "dead counters" claim lacked evidence.
- **GREEN:** Step 3 now lists all 8 verified sections in current order and cites
  `right-sidebar.tsx:368-370` as evidence that only `Created`/`Modified` rows exist.
- **AUDIT:** `bun run typecheck` (all workspaces) exit 0; `bun run lint:md` exit 0;
  `bun x eslint . --max-warnings 0` exit 0.
- **ADVERSARIAL:** PASS — 8 `SidebarSection` titles confirmed; Step 3 now notes
  that `AgentStatus` (:244), `PerfectionLoop` (:320), and `LoopStatusPanel`
  (:333) are non-section blocks out of scope (Adversary ADJUSTED resolved).
- **CHANGE DELTA:** ~4% (corrected section list + evidence citation).

### Loop 5 — Re-verification (2026-08-16)

- **RED:** Fresh Perfection-Loop pass over all 6 FIDs. One defect found in
  this FID: Step 3's inline-code span for the Created/Modified counters was
  split across a line break (unmatched backtick), rendering the two code
  spans as one broken span.
- **GREEN:** Re-wrapped the sentence so the Created/Modified and
  right-sidebar.tsx:368-370 code spans each stay on a single line.
- **AUDIT:** All other file:line citations re-verified against the codebase
  (chat-header.tsx:10, styles.ts:29, right-sidebar.tsx:244/320/333/368-370)
  and resolve. markdownlint + prettier + lint:md re-run.
- **ADVERSARIAL:** No residual challenge.
- **CHANGE DELTA:** < 2%.

## Resolution

- **Closed Date:** 2026-08-16
- **Fix Description:** Phase 1 implemented:
  - `savant-ui/theme.ts` rewritten as the canonical token module — `tokens`
    (spacing/borders) + `useTokens()` resolving semantic colors/badges/phase
    tokens from the active `ChatTheme`; zero hardcoded hex.
  - `ChatHeader` populated, then **reverted to its no-op per operator
    feedback** (2026-08-16): the path/mode/model/connection strip is
    redundant with the right sidebar, so the header stays `null`.
  - Sidebar `Teacher` default-collapsed; section order already matched the
    plan (no reorder); status-bar split + transcript differentiation were
    already present (no change).
- **Tests Added:** `savant-ui/__tests__/theme.test.ts` (token resolvers). The
  transient `chat-header.test.ts` for the populated header was removed with
  the revert.
- **Verification Evidence:** typecheck ×4 exit 0; `cli` suite green;
  design-systems 19/0; eslint, lint:md, prettier exit 0; operator visual PASS
  2026-08-16 (1:1 clean).
- **Archived:** yes (moved to `dev/fids/archive/`)

> When status is set to **closed** (after implementation), move this file to
> `dev/fids/archive/` and append an entry to `CHANGELOG.md`.

## Lessons Learned

- A reserved-but-empty component (header) is a product decision deferred, not
  made; surface it in the plan rather than letting it decay into dead weight.
- Design-token enforcement exists as a scanner (EHEL); planning should assume
  tokens are mechanically enforced, not optional style advice.
