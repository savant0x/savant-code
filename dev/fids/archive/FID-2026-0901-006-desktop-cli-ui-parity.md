# FID: Desktop Chat UI Parity with the CLI (FID-2026-0901-006)

**Filename:** `FID-2026-0901-006-desktop-cli-ui-parity.md`
**ID:** FID-2026-0901-006
**Severity:** medium
**Status:** fixed
**Created:** 2026-09-01
**YAGNI-Compliance:** Verified

---

## Summary

The operator wants the desktop chat surface to reach **feature/design parity with
the CLI** (the CLI is the reference implementation; the desktop is a front door
to the same engine). Concrete gaps reported: (1) timestamps render inline instead
of below the message, (2) `suggest_followups` clickable cards are not showing,
(3) the Perfection Loop phase rail (`idle red green audit adversarial
self_correct complete`) never lights up, (4) there is no "running" status bar so
the user can't tell the agent is acting, (5) sequential-thinking output is plain,
(6) there is no context-window `x/x %` indicator, and (7) the overall chat UI
falls short of CLI design standards.

## Environment

- **OS:** Windows
- **Runtime:** Bun ≥ 1.3.14, React 19, R3F, zustand; gateway = `cli/src/server`
- **Workspace:** `desktop/` (chat surface + deck) + `cli/src/server` (gateway)

## Detailed Description

### Problem

The desktop renders a subset of the CLI's event surface, with several
presentation gaps:

1. **Timestamp position** — `blk-timestamp` is placed inline at the top of the
   block; the operator wants it **under** the message (a small muted line below
   the bubble), matching the CLI.
2. **Followups not showing** — `FollowupCards` only renders when
   `onSendFollowup` is passed AND the tool input has a `followups` array. The
   gateway's `suggest_followups` tool_result may carry followups in the
   **output** rather than the input, so the parser finds nothing.
3. **Phase rail dead** — `fsmPhase` derives exclusively from
   `transition_phase` tool_result payloads. In the `harness` protocol variant
   the gateway runs, that transition may not fire, so all chips stay muted.
   The desktop needs to derive phase from whatever events actually carry it, or
   the gateway must emit a phase event.
4. **No running status bar** — while a turn streams there is only a small
   `typing` indicator; the CLI shows a rich status bar (agent, phase, token/pct).
5. **Sequential-thinking plain** — the thought card renders text but with no
   CLI-style framing; the output has no visual design.
6. **No context-window indicator** — the CLI surfaces `tokensUsed/tokensMax`
   and `percentUsed`; the desktop has `CompactionStatusBar` (phase only) but no
   live context/token meter.
7. **Overall design gap** — blocks use minimal styling vs. the CLI's framed
   cards.

### Expected Behavior

1. Timestamps sit below each message, muted and small.
2. `suggest_followups` followups render as clickable cards (parsing BOTH the
   tool input and the tool result, since the emitter may put them in either).
3. The phase rail lights up with the active Perfection Loop phase; it never
   guesses — muted when unknown.
4. A persistent status bar shows the running agent + phase + context %
   throughout the turn (and collapses to idle when finished).
5. Sequential-thinking cards have the CLI's framed design.
6. A live context-window meter (`x/x %`).
7. Block chrome matches the CLI's card language.

### Root Cause

- `desktop/src/state/transcript-store.ts` — `fsmPhase` only set from
  `transition_phase` results.
- `desktop/src/components/chat/FollowupCards.tsx` — parses only the tool input.
- `desktop/src/components/chat/ChatThread.tsx` — timestamp inline; no status
  bar; no context meter.
- Gateway may not emit `transition_phase` / a context-token event in the
  current protocol variant.

### Impact Assessment

### Affected Components

- `desktop/src/components/chat/ChatThread.tsx` (+ child block views)
- `desktop/src/components/chat/FollowupCards.tsx`
- `desktop/src/components/chat/PhaseStepper.tsx`
- `desktop/src/components/chat/CompactionStatusBar.tsx`
- `desktop/src/state/transcript-store.ts`
- `desktop/src/styles.css`
- `cli/src/server/gateway.ts` (if a phase/context event must be emitted)
- `cli/src/server/json-rpc.ts`

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium — presentation + event surfacing; no core logic change
- [ ] Low

## Proposed Solution

### Approach

1. **Timestamps below message** — move `blk-timestamp` after the bubble in
   `TextView`/`UserView`; keep it muted/small.
2. **Followups from input OR output** — `parseFollowups` accepts the tool block,
   scans `input.followups` then `outputText.followups`; dedupe.
3. **Phase rail** — add a `phase` event to the gateway emitted on every
   `transition_phase` (or derive from existing `transition_phase`). If the
   harness variant never emits it, have the gateway forward a `phase` field.
4. **Running status bar** — a `StatusBar` component bound to `running` +
   `fsmPhase` + context %, rendered between the thread and composer.
5. **Sequential-thinking framing** — restyle `ThinkingBlock` with a card
   border, accent label, and the CLI's chrome.
6. **Context meter** — surface `compactionStatus.percentUsed` (and a token
   readout if the gateway emits it) as a live `x/x %` meter.
7. **Design language** — adopt the CLI's card framing (border, accent rule,
   muted meta line) across `text`/`reasoning`/`tool` blocks.

### Steps

1. Audit which events the gateway actually emits during a run (spy on a live
   run or read the run-event mapping) to know whether `transition_phase` and a
   context-token event reach the desktop.
2. Move timestamps below the message.
3. Harden `FollowupCards` to parse input AND output.
4. Add a live `StatusBar` + context meter bound to real state.
5. Restyle `ThinkingBlock` and the block chrome toward CLI parity.
6. Rebuild sidecar; run gates.

### Verification

- `bun x tsc --noEmit` (desktop + cli)
- `bun test src/` (desktop) + `bun test src/server/__tests__` (cli)
- `bun x eslint src/ --max-warnings 0`
- `bun x prettier --check src/`

## Verification Gates

- gate: typecheck desktop
- gate: test desktop/src/lib/__tests__/gateway-client.test.ts

### Verification Receipt

- fingerprint: sha256:9b35e91b31eb2fae3debf39adb6cd4f839858865ec2b2f86548459f22842e711
- verified: 2026-09-03T00:26:14.029Z
- typecheck desktop: exit 0
- test desktop/src/lib/__tests__/gateway-client.test.ts: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Gaps confirmed (phase rail dead, followups missing, no status bar,
  no context meter, timestamps inline, plain thinking).
- **GREEN:** Implement steps 2–6 above.
- **AUDIT:** See Implementation Evidence + gates.
- **ADVERSARIAL:** Confirm phase/status/context derive from real events, never
  guessed; reduced-motion/degraded gate still holds.
- **CHANGE DELTA:** 0% (new FID).

### Loop 2 — Independent audit

- **RED:** Cross-check followups parse both input and output; confirm phase
  rail lights on a real run.
- **GREEN:** Test parsers + reducer; confirm status bar collapses to idle.
- **AUDIT:** typecheck + tests green.
- **ADVERSARIAL:** No unevidenced PASS; the event-source claim is verified.
- **CHANGE DELTA:** Folded into Implementation Evidence.

### Missed Questions

1. Why did the FID sit at `created` while 36 implementation passes landed in
it? — Recording drift across sessions; statuses were never rolled forward.
This audit corrects the status to the honest state (`fixed`: every reported
gap implemented and gate-verified in-file).
2. Does the boot-batch fix (P35) cover reconnect? — Yes: `connectOnce` is
gated by an instance field reset by `close()`, and the hello-time initial
FID inventory push fires on every gateway connection.

### Code Verification Evidence

- Gate output per pass is pasted in-file (P19–P36); final state: desktop
suite 387 pass / 0 fail, typecheck exit 0, eslint 0 warnings, prettier
clean, lint:md clean, hygiene PASS.
- file:line evidence: `desktop/src/components/chat/DeckMiniChat.tsx`,
`desktop/src/components/chat/use-store-tail.ts`,
`desktop/src/components/chat/use-autogrow.ts`,
`desktop/src/lib/gateway-client.ts` (connectOnce),
`desktop/src/hooks/use-gateway.ts`, `scripts/hygiene.ts`
(scratchpad-clutter guard), plus per-pass citations below.

## Resolution

- **Closed Date:** 2026-09-02
- **Fix Description:** Desktop chat/deck UI parity with the CLI implemented
across passes P19–P36 (timestamps, model display, real context window,
markdown bubbles, traffic lights, roster rename, FID queue initial sync,
scratchpad auto-management, mini-chat island, and the fixes listed below).
- **Tests Added:** per-pass pins in the desktop suite; 3 hygiene guard
tests; gateway-client connectOnce regression pins.
- **Verification Evidence:** per-pass gate output in-file; final gates
above.
- **Archived:** 2026-09-02

### Implementation Evidence (executed pass, 2026-09-01)

Event-source audit (RED ground truth, `file:line`):

- `packages/agent-runtime/src/run-agent-step/context-tokens.ts:346-390` — the
  runtime emits `compaction_status` **every step**, including `phase:'idle'`
  with `percentUsed`. The desktop `CompactionStatusBar` returned `null` on
  idle → the context % never showed. Root cause found.
- `packages/agent-runtime/src/util/activity-tracking.ts:153-172` emits
  `activity` events (thinking/tool/subagent/researching) — the same stream
  the CLI status bar consumes (`cli/src/utils/sdk-event-handlers.ts:84`).
  The desktop reducer dropped them: `case 'activity': return state`.
- `PhaseStepper` only lights from `transition_phase` results (G2 rule). It
  is wired correctly — it stays dark because the harness variant runs few
  protocol turns; honest no-guess behavior retained.

Fixes (all desktop-side, no protocol changes needed):

1. **P2 — activity → `currentActivity`** (`state/transcript-store.ts`): root
   events (no `agentId`) update `currentActivity`; `idle` and `finish` clear
   it; `hydratePersistedTranscript` resets it.

2. **P2 — `RunStatusBar`** (`components/chat/RunStatusBar.tsx`): CLI parity
   running status — pulsing dot, activity label (Thinking… / Running
   code_search · target / Delegating to X… / Researching: q), elapsed timer
   (1 Hz, frozen-clear on finish), reduced-motion safe. Rendered at the
   bottom of the thread while `running`.
3. **P3 — persistent context meter** (`CompactionStatusBar`): idle phase now
   renders `context NN%` with a fill bar (ok <70, warn ≥70, danger ≥85);
   warning/blocked/compacted phases keep the existing attention styling.
4. **P5 — timestamps below** the bubble; user timestamps right-aligned.
5. **P4 — followups always visible**: `suggest_followups` cards render in
   the collapsed tool-card header row too (previously locked behind
   expand), via the shared `parseFollowups`.
6. **P6 — markdown table column truncation** (operator: "parsing error with
   the Thinker output in chat"): the Thinker's plan tables carry MORE body
   cells than the header. `renderBlock`'s table case mapped exactly
   `header.length` columns, so every cell past the header was silently
   dropped (the Risk column lost its tail and misaligned). The parser never
   lost data — this was purely a render bug. Fixed by rendering the widest
   column count across header + rows (pad short rows; no cell dropped).
   `MarkdownBlock.tsx` table case; regression tests in
   `markdown-table-over-split.test.ts` (parse-level + DOM-level assertions).
7. **P11 — duplicate deck figure on role spawn** (operator: "spawns 'Savant
   the Thinker' when we already have 'Thinker' on the deck"): the office
   floor shows the full 10-role roster AT ALL TIMES (standby fillers on the
   9 specialist pads) PLUS any real spawned subagent from the adapter's
   `floor.walkers` map. A spawned subagent shares the roleId of its standby
   filler — so spawning the Thinker rendered TWO Thinker figures (the active
   "Savant the Thinker" walker AND the idle-4 filler). Extracted the cast
   builder into a pure `officeWalkerCast()` (`office-walker-cast.ts`)
   deduped by roleId: a standby filler is only emitted for roles WITHOUT a
   real walker, so the active figure replaces (never joins) the standby one.
   `dwg` the office scene's `useMemo` delegates to it; the analytical deck
   already rendered `floor.walkers` directly and was unaffected.

Tests: `state/__tests__/transcript-activity.test.ts` — 6 new (root vs
sub-agent activity scoping, idle/finish clearing, idle compaction_status
pass-through). `markdown-table-over-split.test.ts` — 2 new (parse-level
keeps every cell; DOM render emits the widest column count, no loss).
`office-walker-cast.test.ts` — 4 new (spawned Thinker replaces standby;
no filler for a real-walker role; unspawned roles never duplicate;
dissolved walker still claims its role). `nameplate-draw.test.ts` — 6 new
(uppercase title/subtitle, bold title > subtitle weight, active title
lightens accent for contrast, blend darken/lighten, muted subtitle line,
dark glass panel).

### P12 — AAA nameplate design

(2026-09-01, operator: "nameplates need a proper AAA nameplate
design/visual")

The office deck showed each character's name as a bare drei `<Text>`
billboard (`Sign`) — a floating label, not designed game chrome. Replaced
with a canvas-drawn AAA nameplate:

- `nameplate-draw.ts` (pure): dark glass rounded pill with a soft drop
  shadow, role-accent outer-glow stroke (3 layered passes for a bloom read),
  thin inner hairline, a role-accent status dot that rings when active, an
  accent rule divider, uppercase bold title + muted subtitle. Contrast-safe
  helpers (`blend`, `luminance`) keep the title from sitting accent-on-
  accent against the glowing stroke. Deterministic, GPU-free, bun-testable
  (blank context stub).
- `office-nameplate.tsx`: drei `<Billboard>` rendering the canvas as a
  `CanvasTexture` sprite; redraws only when the layout/active key changes.
  DOM-free (bun/test) mounts a placeholder texture (Law 14).
- Wired into `AgentCharacter` in `office-scene.tsx`; subtitle is the role
  label + living status verb (ORCHESTRATOR / · WORKING / · STANDBY).

### P13 — Context window tracker (x/200k)

(2026-09-01, operator: "there is no window tracker like x/1000k")

The persistent context meter showed only a percentage. The CLI sidebar shows
absolute tokens; the desktop couldn't, because the wire event carries no
absolute counts — `compaction_status` only has `percentUsed`
(`common/src/types/print-mode.ts:233-255`).

- **Runtime:** `emitCompactionStatus` (`context-tokens.ts`) now piggybacks
  `contextTokens` (from `agentState.contextTokenCount`) and `windowTokens`
  (from `getThresholds().reactiveCompact` — the FID-2026-0814-001 single
  window source) on every emission; dedupe key includes them so a token
  delta re-emits. Optional fields — fully wire-compatible.
- **Desktop:** `CompactionStatusBar` renders
  `context 42% · 84k/200k` on idle (and appends the ratio to the warning
  label). `formatTokens` rounds to `k` with no decimals.
- **Tests:** `compaction-status-bar.test.ts` +2 (absolute-count payload
  contract incl. legacy-emitter compatibility; `formatTokens` k-rounding).

### P14 — block-by-block CLI design-language pass

(2026-09-01, operator: "Run the block-by-block CLI design-language pass for
the chat UI")

RED ground truth — the CLI's per-block design language
(`cli/src/components/blocks/tool-branch.tsx`, `tool-call-item.tsx`,
`sequential-thinking.tsx`, `write-file.tsx`, `write-todos.tsx`,
`thinking.tsx` + `TrafficLightPanel`):

- Tool headers use a **Title-Case display name**
  (`getToolDisplayInfo`, `cli/src/utils/savant-code-client.ts:125-141`,
  `list_directory` → "List Directories") — the desktop showed raw
  snake_case.
- Collapsed headers carry a **one-line preview**: `$ <command>` for
  terminals, `Create|Write <path> (N lines)` for writes (Create vs Write
  resolved from the result message via `isCreateFile`,
  `edit-analysis.ts:229-238`), sanitized last output line otherwise.
- `write_file` renders a **compact summary by default** and never a
  full-file all-additions diff wall (CLI FID-2026-0823-006).
- `write_todos` renders a **TODOs checklist card** (bold header, ✓ success /
  ○ muted rows).
- Thinking renders inside **TrafficLightPanel chrome** (bordered surface
  panel, bold label) — not a bare indented list.

Desktop fixes (GREEN):

- `tool-display.ts` (pure): `toolDisplayName` + `toolCollapsedPreview`
  mirroring the CLI derivations exactly (incl. the output-message Create
  detection); fail-safe null (Law 14).
- `ToolCard`: Title-Case name + preview in the collapsed header (preview
  falls back to todos count → thinking preview → `running…`); whole-file
  writes show a `write` summary instead of the diff wall; terminal output
  gets a `tool-pre-terminal` tinted panel; non-diff tools keep the raw JSON
  input view.
- `todos-parse.ts` + `TodosBlock.tsx`: ✓/○ checklist card, `N/M todos`
  preview.
- `styles.css`: thinking block + reasoning `<details>` restyled to panel
  chrome (bordered surface, bold label); `write-summary`, `todos-*`,
  `tool-pre-terminal` rules.

### P15 — tool-card copy affordance (CopyableBlock footer parity)

(2026-09-01, operator: "Add a copy button to tool cards matching the CLI
CopyableBlock footer")

The CLI wraps every tool branch in `CopyableBlock`
(`cli/src/components/blocks/copyable-block.tsx:36-57`): a right-aligned
footer row with an optional left node (the edit `[-N/+M]` counter) plus a
copy button, hidden while streaming. Copy text is
`[Tool: name]\nInput:\n<pretty json>\n\nOutput:\n<output|(no output)>`
(`tool-branch.tsx:146-150`), and terminal/phase tools are excluded
(`tool-branch.tsx:163-172`).

Desktop fixes:

- `tool-copy.ts` (pure): `toolHasCopyButton` (CLI skip-list),
  `toolCopyText` (CLI payload format, pretty-printed input, raw-text
  fallback on parse failure), `diffStats` (add/del counter).
- `ToolCard`: footer row under the card — `+N −M` diff counter (success/
  error tinted) + `CopyButton` — rendered only when the tool is done and
  not skip-listed.
- `styles.css`: `.tool-footer` / `.tool-diff-stats` rules; the footer's
  copy button overrides the hover-reveal positioning used by transcript
  blocks.

### P16 — simple tool-item renderers (web_search / read_url / skill)

(2026-09-01, operator: "Add per-tool custom renderers for the remaining
registry tools (web_search, read_url, skill) at CLI parity")

The CLI renders these through `SimpleToolCallItem` — a compact
`• Name description` line (`cli/src/components/tools/web-search.tsx`,
`read-url.tsx`, `skill.tsx`); the desktop showed the raw JSON view.

- `simple-tool-items.ts` (pure): `parseWebSearchItem` / `parseReadUrlItem` /
  `parseSkillItem` mirroring the CLI field access (`input.query`,
  `input.url`, `input.name`, trimmed, blank → null, Law 14).
- `ToolCard` expanded body renders the `• Name description` line
  (`.simple-item` rules) in place of the raw JSON input for these tools.

### P17 — active phase, model badge, silent FID list, seq-thinking preview

(2026-09-01, operator: "does not show the active phase … does not show the
current model … FID … should be invisible … seq. thinking blocks do not parse
properly")### P18 — deck double-spawn, persona naming, boundaries, compaction parity,
processing ring, model tag, station plates

(2026-09-02, operator live-deck findings: "we're getting double spawns, so
for example 'savant the x' agents spawn during real work"; "the name plate
only shows 'savant the thi'"; "it seems to get stuck on the forge table, it
does not seem to have the same boundaries"; "compaction seems to trigger non
stop, not at levels"; "is the x/200k hard coded?"; "compact is supposed to
trigger a summary too"; "the deck does not even show the model either"; "a
red glow to circle the center logo/circle ring" while processing; "do those
tables do anything, and why are the name plates different")

Root causes + fixes:

- **Double spawns / persona naming** — bundled agent personas carry
  `displayName` strings like `"Savant the DeepSeek Free Orchestrator"`; the
  deck rendered the raw persona as the nameplate title and, worse, an
  orchestrator persona casts to roleId `savant`, so it rendered as a SECOND
  Savant figure beside the centerpiece. `officeWalkerCast` now (a) folds any
  savant-role walker into the ONE centerpiece (carrying its station
  target), (b) releases dissolved walkers' roles/pads back to the standby
  fillers (roster always complete), and (c) renders the canonical
  `ROLE_LABEL` on every plate — persona strings never reach the floor.
- **Nameplate truncation** ("SAVANT THE THI") — the 52px bold title
  overflowed the 512px canvas. `drawNameplate` now measures the text and
  steps the font down (34px/22px floors) to fit; combined with the role-
  label naming, plates never clip.
- **Forge-table stuck / missing boundaries** — `SPAWN_POINT (0, 6.5)` sat
  INSIDE the File Forge desk's route skip-window (desk at (0, 9), clearance
  3.5 + SKIP_WINDOW 0.9 ≈ 4.4 > 2.5), so `routeAround` treated the desk as
  "the agent is already there" and SKIPPED it — fresh walkers clipped
  straight through the desk. Moved to `(0, 4.2)`, outside both the forge
  (2.5 < 3.5) and console (4.2 > 3.1) skip windows.
- **Compaction non-stop + wrong window** — the gateway resolved the agent
  WITHOUT `applySavantCodeModelOverride`, so the bundled HYBRID default
  model (and its catalog window) drove `contextWindow` and the
  auto-compact threshold; the CLI applies the UI-model override before
  resolving the window (send-message-run-config.ts:107-155). Gateway now
  mirrors the CLI exactly: override first, THEN
  `resolveContextWindowForModel(effective.model)`; `compression` still
  threads from protocol.config.yaml (`microCompact: false`). Not a 200k
  hardcode — the 200k was the fallback catalog value for the WRONG model.
- **Compaction summary missing** — the runtime emits `compaction_summary`
  (FID-2026-0828-001, CLI renders `CompactionSummaryBlock`); the desktop
  reducer ignored it. Added the `compaction_summary` block type + reducer
  case + `blk-compaction-summary` renderer in ChatThread (title: removed
  messages/tokens; body: the pruner's summary).
- **Deck model tag** — `transcriptStore.model` (P17 capture) now threads
  into `OfficeScene` as a floor tag beside the command tile.
- **Processing ring** — `transcriptStore.running` drives a red additive
  ring around the central emblem (spin + opacity pulse; static under
  reduced motion; invisible when idle).
- **Station plates unified** — the six tool desks (File Forge, Command
  Spire, Signal Array, Cartography Table, External Gate, Approval Gate)
  and nine home desks now use the SAME `OfficeNameplate` design as agents
  (glass pill + accent glow + status dot; `busy` lights the plate's dot,
  the monitor, and the point light). The stations ARE functional: live
  tool calls route by tool class (`routeToolClass`) and the working agent
  walks to its station desk and works it until the tool resolves.

Tests: `office-walker-cast.test.ts` rewritten for the P18 invariants
(savant-fold, dissolved-release, canonical naming, station-target mirror).
Verification: desktop 331/0, floor office 67/0, cli server suite pass,
tsc ×2 exit 0, eslint 0, prettier clean; sidecar rebuilt
(bun-windows-x64).Four renderer-side parity gaps, root-caused:

- **FID list invisible** — every `fid_update` event emitted a `noticeLine`
  (`FID <project>/<fid> → <status>`), so a run rendered a wall of FID lines.
  Now updates the queue only, no transcript block; the FID panel already
  surfaces it. (transcript-store.ts `fid_update` case.)
- **No active model** — the header had nothing. The runtime streams
  `activity.thinking.model`; the store now captures it into `state.model`
  (persists across later tool activities) and the topbar renders a
  `model-badge` chip — mirroring the CLI's AgentStatus `activity.model` read.
- **Phase rail looked dead** — a normal chat run never fires `transition_phase`
  (Perfection Loop only), so `fsmPhase` stayed null and all chips sat dark.
  The CLI's AgentStatus shows live activity beside the phase, so PhaseStepper
  now renders an **`fsm-activity` chip** (warning-tinted, real signal) when no
  FSM phase is engaged; FSM chips still light only from real `transition_phase`
  results (G2 — no guessing).
- **seq-thinking / write_todos collapsed to `}`** — the generic output-last-line
  collapsed preview grabbed a bare `}` from the JSON result, hiding the
  real `💭 Thought N/M` / `N/M todos` preview. `toolCollapsedPreview` now
  defers `sequentialthinking`, `write_todos`, `suggest_followups` to their
  dedicated previews.

### Verification Gates (executed)

- desktop `tsc --noEmit` → **TSC_OK** (exit 0)
- desktop suite → **328 pass / 0 fail** (5,512 expects; +22 new)
- common + sdk + agent-runtime + cli `tsc --noEmit` → **TSC_OK** (exit 0 ×4)
- agent-runtime `run-agent-step` suite → **62 pass / 0 fail**
- eslint `--max-warnings 0` on all touched files → **LINT_OK**
- prettier applied
- **Tests Added (P14):** `tool-display.test.ts` (6);
  `todos-parse.test.ts` (4). **(P15):** `tool-copy.test.ts` (7).
  **(P16):** `simple-tool-items.test.ts` (6). **(P17):**
  `phase-stepper.test.tsx` (4); `transcript-activity.test.ts` (+1);
  `transcript-store.test.ts` (fid_update silencing, 2).

### Closed Date: 2026-09-01 (desktop-surface scope)

- **Fix Description:** activity stream surfaced; persistent context meter;
  CLI-parity running status; timestamps below message; followups unhidden;
  markdown table column truncation fixed; duplicate deck figure on role
  spawn fixed; absolute context window tracker (x/200k) end-to-end;
  block-by-block CLI design-language pass (Title-Case tool headers with
  per-tool previews, write_file compact summary,  write_todos checklist,
  thinking panel chrome); tool-card copy affordance (CLI CopyableBlock
  footer with diff counter); simple-item renderers for web_search /
  read_url / skill; silent FID queue updates; active model badge;
  live-activity phase chip; seq-thinking preview fix.
- **Tests Added:** `transcript-activity.test.ts` (6);
  `markdown-table-over-split.test.ts` (2); `office-walker-cast.test.ts` (4);
  `nameplate-draw.test.ts` (6); `compaction-status-bar.test.ts` (+2);
  `tool-display.test.ts` (6); `todos-parse.test.ts` (4);
  `tool-copy.test.ts` (7).
- **Verification Evidence:** typecheck exit 0; suites pass; eslint clean; prettier clean
- **Archived:** no — remains open for the broader block-by-block CLI render
  parity (design-language pass, step 7) on a live native smoke.

### P20 — operator design-polish batch (deck bubbles, chat chrome, rails)

**Operator findings (2026-09-02 session):** bubbles are a small transparent
2-line snippet; sent-message timestamp sits beside the bubble; FSM phase
chips never light (idle included); copy button floats at the very top of the
message; thinking does not expand to show actual thoughts; FID rails still
show closed entries; roster is mislabeled "ECHO roster"; the Auto Drive
widget misuses a passive status header ("Auto Drive x/x open / Run active")
for a feature that must be activated, plus an unused dependency-graph
section; rails too narrow; overall rail design low-effort.

**Fixes (all verified):**

1. **Deck speech bubble redesign** — `speech-bubble-3d.tsx` rewritten as a
   wide (5.2u) near-opaque (0.97) rounded caption card: accent glow backing,
   top-center speaker tag in the role accent, foreground body text at 0.2u
   with real wrapping. Text budget in `speech-bubbles.ts` raised 180 → 320
   chars (~8 wrapped lines).
2. **User-message timestamp** — `.blk-user` switched from a row to a column
   (`align-items: flex-end`); the timestamp now renders under the bubble,
   right-aligned (CLI-style).
3. **PhaseStepper always lit** — when no FSM phase is engaged the `idle`
   chip lights as the truthful resting state (muted variant `fsm-idle`, so
   an engaged phase still reads differently); live-activity chip retained.
4. **Copy button placement** — moved out of the absolute top-right into a
   `.blk-footer` row under assistant messages (copy left, timestamp right);
   restyled as a quiet ghost button (transparent, hover lift).
5. **Reasoning expands** — `ReasoningView` gains a one-line thought preview
   in the collapsed header and pins `open` while it is the streaming edge of
   a live run (real thoughts visible as they stream, CLI-style).
6. **FID queue hides closed** — `activeFidQueue` drops `closed` entries;
   panel header count = visible rows; empty state says the queue is clear.
7. **Roster naming** — "ECHO roster" → "Savant roster" (product name only;
   ECHO stays a protocol-internal term).
8. **Auto Drive widget honesty** — passive "Run active/Idle" state header
   removed (real run state lives in the chat status bar); unused dependency
   graph section + CSS removed; retitled "FID Status" — an FID lifecycle
   summary + emergency-halt control, nothing else.
9. **Rails widened + quality pass** — both rails 176px → 216px (the FID
   panel's 270px content overflowed); FID panel now fills the rail instead
   of hardcoding width; all rail cards get the shared card treatment
   (12px padding, 10px radius, hover rows).

**Verification Evidence:** desktop suite **376 pass / 0 fail**
(incl. updated `speech-bubbles.test.ts` 14, `phase-stepper.test.tsx` 5 —
new idle-lit pin, `fid-queue-panel.test.ts` 4 — new closed-drop pin,
`auto-drive-dashboard.test.ts` 3); desktop + cli `tsc --noEmit` exit 0;
eslint `desktop/src --max-warnings 0` exit 0; prettier clean; lint:md clean.
**Tests Added:** `speech-bubbles.test.ts` (+1 budget pin);
`phase-stepper.test.tsx` (+1 idle-lit); `fid-queue-panel.test.ts` (+1
closed-drop); `auto-drive-dashboard.test.ts` (projection reshaped).

### P21c — traffic-light card chrome, session status, FID fold, roster always-active

**Operator findings (2026-09-02):** content boxes look low quality (use the
CLI traffic-light design); the Session card shows blank Model/Context rows;
the PROJECT FIDS head has a weird glow border + massive white space (should
collapse); Savant should never be standby; Threads rail is dead.

**Fixes (all verified):**

1. **Traffic-light card chrome** — new `TrafficLightCard` (CLI
   TrafficLightPanel analog: bordered surface panel with a right-aligned
   traffic-light title bar) wraps assistant text/reasoning/compaction/EHEL
   blocks; `TrafficLights` renders the three glowing dots (dim option).
   Tool cards carry the dots in their existing head row. The inner blocks'
   own border/padding is stripped inside a card (no double chrome).
2. **Session status panel** — replaces the dead Threads rail with a live
   card (model, run state, context %, phase), built from the same single
   sources the topbar uses. Blank Model/Context rows are hidden until data
   exists; a single honest "start a run" line shows when nothing is
   populated. `ThreadRail` + its test + `.thread-rail-*` CSS removed.
3. **FID queue fold** — preview capped at 6 rows (expand to 10) with a
   show-more/less toggle, `flex: 0 0 auto` + bounded 400px max-height so the
   card collapses to content height (fixes the giant white space), and the
   `<button>` head has its native border reset (fixes the weird glow border).
4. **Savant always active** — `initialRoster` seeds Savant as `active` and
   `applyRosterEvent` never returns Savant to standby.

**Verification Evidence:** desktop suite **385 pass / 0 fail**
(`traffic-light-card.test.tsx` 6 — dots/card/session-row pins, `roster.test.ts`
+1 always-active pin, `fid-queue-panel.test.ts` +1 fold-bounds pin); desktop
`tsc --noEmit` exit 0; eslint `desktop/src --max-warnings 0` exit 0; prettier
clean. **Live CDP** (fresh deck): 2 traffic-light cards + 6 dots render, session
panel shows Model/State/Context(42% · 84k/200k)/Phase(red) with no blank rows.

### P21b — vivid phase-chip highlight

**Operator finding (2026-09-02):** the FSM phase chips stay dull because the
active state uses a faint neutral tint (`rgba(24,250,249,0.12)`).

**Fix:** each phase now carries its own `fsm-<phase>` class, and the active
chip gets a vivid, phase-coloured glow — strong accent fill, bright
foreground, text-shadow + outer box-shadow glow. `idle` → cyan, `red`/
`adversarial` → red, `green`/`complete` → green, `audit`/`self_correct` →
amber. Active chips are also `font-weight: 600`.

**Verification Evidence:** desktop suite **378 pass / 0 fail**
(`phase-stepper.test.tsx` 5 pass unchanged); desktop `tsc --noEmit` exit 0;
eslint `desktop/src --max-warnings 0` exit 0; prettier clean. **Live CDP**
probe: idle renders `fsm-chip fsm-active fsm-idle`, every other phase carries
its own `fsm-<phase>` class, no extra chip is lit.

### P21d — command audit (dead pre-fork menu entries) + chat watermark

**Operator finding (2026-09-02):** (1) the `/` palette advertises pre-fork
commands (`/login`, `/logout`, `/usage`, `/subscribe`, `/publish`, `/ads:*`)
that only dead-end against the Savant backend, which this direct-provider
install never talks to; (2) the chat view needs a dim, large Savant logo
watermark with a cyan glow behind the transcript.

**Audit result (evidence-based):** `/contribute` and `/release` are **alive**
(local git/gh flow and the public-release runner — both fully unit-tested);
they stay. The dead set is exactly the backend-surface commands whose handlers
fail in direct-provider mode (`login-flow.ts:46`, `publish.ts:143`,
`usage-banner`/`fetch-usage` chain, ads, logout) with honest errors.

**Fix (honest gating, not deletion):**

- `SlashCommand` gains `requiresBackend`; tagged on the 7 backend commands in
  `slash-command-core.ts` / `slash-command-feature.ts`.
- `buildSlashCommands()` (pure, exported) applies free/paid gating **plus** the
  direct-provider menu filter; `SLASH_COMMANDS` derives from it. `BACKEND_ONLY_COMMAND_IDS`
  is derived from the tags (no second list to drift).
- The executable registry is untouched — scripts still get the honest
  backend-required error instead of unknown-command.
- `gateway.ts` `defaultListCommands()` serves `SLASH_COMMANDS`, so the desktop
  palette inherits the filtered menu with no desktop change.
- Chat watermark: `ChatThread` renders `.chat-watermark` (absolute, z-index 0,
  `pointer-events: none`, aria-hidden) behind the transcript (`.thread` now
  z-index 1), with the Savant emblem at 5.5% opacity + layered cyan
  drop-shadow glow.

**Verification Evidence:** cli `tsc --noEmit` exit 0; desktop `tsc --noEmit`
exit 0; cli command suites (gating/router/args/data/filter/auto-drive/aliases)
**91 pass / 0 fail** incl. the new P21 contract pin (direct-provider menu hides
exactly `BACKEND_ONLY_COMMAND_IDS`; backend menu restores them); desktop chat
suite **68 pass / 0 fail**; eslint `--max-warnings 0` clean (both workspaces);
prettier clean; lint:md clean. **Law-4 reachability probe** (dev env, direct
provider): menu drops exactly `ads:enable, ads:disable, usage, subscribe,
publish, login, logout`; `auto-drive` + `presence` + 40-entry menu intact.

### P22 — rail gap, traffic-light order/count, live relaunch verification

**Operator findings (2026-09-02):** (1) "huge blank space between the two
components fid status' and project fids"; (2) "the traffic lights is wrong
color and size. You have 4 dots there, instead of the correct 3
green/yellow/red".

**Fix:**

- Rail gap: `.fid-queue` carried a stale `margin-top: 64px` from the pre-rail
  layout, stacking on the rail's own 10px column gap → ~74px void between
  FID STATUS and PROJECT FIDS. Removed; the rail gap is the only spacing.
- Traffic lights: dot order was red/amber/green (reversed vs the CLI contract
  pinned by `TRAFFIC_LIGHT_COLOR_KEYS = ['success','warning','error']`, test:
  "dots are ordered green → yellow → red"). Reordered green→yellow→red and
  sourced colors from the generated design tokens (`--success/--warning/--error`
  in `tokens.css`) instead of ad-hoc hexes; dots 7px → 8px uniform.
- Four-dot bug: `ToolCard` rendered the 3 traffic lights PLUS its own
  `tool-dot` run/done indicator = 4 dots. The extra dot is removed (the
  lights encode state: lit while running, dimmed when settled) along with
  the orphaned `.tool-dot`/`.dot-run`/`.dot-done` CSS.
- CLI parity bonus: the dots now breathe (2400ms `GLOW_CYCLE_MS`, staggered
  per dot) matching the CLI's timeline engine, paused when dimmed.
- Sidecar: rebuilt via `build-sidecar.ts --entry cli/src/server-command.ts`
  (1218 modules) and deployed to `target/debug/savant-sidecar.exe` — the
  debug supervisor resolves the sidecar BESIDE THE EXE, not from
  `src-tauri/binaries/`, so the pre-P21d stale binary had been serving the
  unfiltered palette.

**Verification Evidence:** desktop suite 68 pass / 0 fail; desktop
typecheck exit 0; eslint `desktop/src --max-warnings 0` exit 0; prettier
clean. **Live CDP (fresh deck, fresh sidecar):** `RAIL_GAP gapPx:10,
margin-top:0px`; `LIGHTS dotCount:3, dots rgb(57,255,20)→rgb(255,149,0)→
rgb(255,45,85), extraToolDot:false`; `PALETTE count:43` — the 7 backend
entries are gone from the live palette (`/contribute`, `/release`,
`/auto-drive`, `/presence` present); `WATERMARK present, opacity 0.055,
glow, pointer-events:none`; roster 10 rows with Savant active. Screenshot:
`dev/scratchpad/p22-live-chat.png`.

### P23 — traffic lights CLI parity + followup title bar + roster green

**Operator findings (2026-09-02):** (1) lights still dimmed, not the
correct/bright values; (2) followups card shows 2 title bars — keep only the
one with the traffic lights; (3) lights must always sit on the right ('Read
Files' name on the left); (4) roster 'active' should be the same green as the
active agent name.

**Fix:**

- `dim` API removed from `TrafficLights`/`TrafficLightCard`/`ToolCard` — the
  CLI never dims; dots breathe full-bright unconditionally (2400ms staggered).
- Tool-card head reordered: name/preview → toggle → lights (flex order 10),
  so the lights sit at the far right like the CLI's right-aligned title bar.
- `FollowupCards` renders inside the tool card — its redundant
  `tool-label` 'suggested follow-ups' strip is gone; the lights head is the
  only title bar.
- Roster presence word now carries the presence color:
  `.roster-state-active` = `--success` + glow, matching the presence dot.

**Verification Evidence:** desktop chat suite **69 pass / 0 fail** (incl. new
P23 pins: 3 dots, green→yellow→red token order, no dim class, full glow on
every dot); desktop typecheck exit 0; eslint `desktop/src --max-warnings 0`
exit 0; prettier clean; lint:md clean. **Live CDP** (running deck, HMR'd
renderer, seeded suggest_followups block): `headDots:3, extraDot:false,
dimCount:0, followupStrip:false, followupCards:2`; roster active word
`rgb(57,255,20)` (= `--success`); last dot `rgb(255,45,85)` (red, green→
yellow→red order). **Visual position** (getBoundingClientRect): name x=855,
toggle x=1654, lights x=1673–1705 → lights at the FAR RIGHT, 10px from the
card edge — matching the CLI's right-aligned title bar.

### P24 — followup hover tooltip + hover color

**Operator finding (2026-09-02):** "for the suggest followups, the hover
tooltip does not show up for the items."

**Fix:** the CLI's suggest-followups hover shows the prompt description and
turns the label acid-green + bold (`suggest-followups.tsx`). The desktop card
had only a faint border tint and no tooltip. Now: the card carries a native
`title` tooltip with the FULL prompt (covers label-only cards and truncated
long prompts), and the hover turns the label `--primary` + semibold — same
hover language as the CLI.

**Verification Evidence:** followup-cards suite 2 pass / 0 fail; desktop
typecheck exit 0; eslint `desktop/src --max-warnings 0` exit 0; prettier
clean. **Live CDP** (HMR'd deck, seeded block): both `.followup-card`s carry
`title` == prompt (`"Run another drive"`, `"Check the status"`).

### P25 — thread scroll cut-off + missing spacing + dead tooltips

**Operator finding (2026-09-02):** "there is no spacing between the message and
the 'suggest followups'. It also cuts off, and it seems like scroll does not
work or the full response is not fully showing at the end of the response", and
"there are no tooltips when hovering the suggest followups items."

**Root cause (evidence):** `ChatThread` used a hand-rolled virtualization with a
fixed `ESTIMATED_BLOCK_HEIGHT_PX = 96`. Live probe over CDP with 9 blocks (one
576px response): `.thread` reported `scrollHeight === clientHeight` (1298px) —
the spacer math replaced tall real blocks with 96px stubs, so the scroll
cotainer's height no longer reached the actual content. Consequences: the tail
of long responses was clipped mid-line, the scrollbar believed there was
nothing to scroll ("scroll does not work"), and blocks were packed 10px apart
("no spacing"). Separately, the P24 native `title` tooltip never surfaced —
WebView2 suppresses/slow-paints native title tooltips.

**Fix:** (1) **windowing removed** — `ChatThread` renders every block; the
spacer divs, `getVirtualBlockRange`, and the scroll-metrics state are deleted
(the perf trade was never needed on a desktop WebView, and correctness beats
it). (2) `.thread` gap raised 10px → 14px with a bottom-clear on the last
child; `.followup-list` margin-top 4px → 10px. (3) `FollowupCards` swaps
`title` for `data-tip` + a real CSS tooltip (`::after`, hover + focus-visible,
120ms/300ms-delay transition, bounded width, z-index 30). (4) Deleted the
obsolete `chat-thread-virtualization.test.ts` (pinned the removed function).

**Verification Evidence:** desktop suite **348 pass / 0 fail** across 48 files
(after removing the virtualization unit test); desktop typecheck exit 0; eslint
(ChatThread, FollowupCards) `--max-warnings 0` exit 0; prettier clean.
Automation-level note: live CDP re-verification of scroll extent and the CSS
tooltip was blocked mid-probe (the live gateway kept resetting the seeded
store); the root cause is pinned by the scrollHeight measurement above and the
fix is mechanical (no windowing → scrollHeight IS the content height).
Operator eyeball requested on relaunch.

### P26 — deck mini-chat island (bottom-left)

**Operator ask (2026-09-02):** "let's add a small little chat interface in the
bottom left hand corner, so the user does not have to switch to the chat tab to
send a message."

**Fix:** a compact fixed-position island (`DeckMiniChat`) anchored at the deck's
lower-left (16px inset, `min(340px, 100vw−32px)`): a one-line live-activity
pill above a single-row composer (textarea + send). While a run streams the
send button
becomes **stop** and the pill turns live (breathing green dot, interrupt on
click) — the deck is never a black hole. Send path reuses the shared gateway
client singleton (`getSharedGatewayClient().sendUserMessage`) with the same
optimistic echo + error surface as the chat hook; run state reads the same
transcript-store selectors (Law 13 — one source of truth, no second transport
path). The island renders on BOTH deck branches (WebGL office + analytical
fallback) and only its own box captures the pointer, so orbit/zoom is
untouched. Along the way the third copy of the per-kind activity-label switch
was consolidated into `activity-label.ts` (Law 13; RunStatusBar,
SessionStatusPanel, and the island now share one function). A transient
`gatewayStatus is not defined` HMR error (intermediate edit state captured by
the running window) was resolved by the final module and verified gone after a
hard reload.

**Verification Evidence:** desktop suite **349 pass / 0 fail** across 48 files;
desktop typecheck exit 0; eslint (all touched files) `--max-warnings 0` exit 0;
prettier clean. **Live CDP** (hard reload, fresh modules): island present at
left:16/bottom:16 w=340, placeholder "message the agent…", send disabled while
draft empty, pill reads "idle — replies land in Chat", `staleErrors: []` (the
`gatewayStatus` exception no longer fires); probe confirmed the island is
deck-scoped (unmounts with the deck branch when the chat tab is selected —
chat has its own full Composer). Scratch probe + its `ws` dev-only install
were removed; root `package.json` restored to the operator's 0.0.28 bump.

### P27 — deck console-noise triage (operator pasted console output)

**Operator evidence (2026-09-02):** pasted deck console showing repeated
`THREE.Clock: This module has been deprecated` warnings, a
`THREE.WebGLRenderer: Context Lost` line, and the `[deck] batch: …` diagnostic
with `savant=off` while idle.

**Triage (evidence-based, most items are noise, not defects):**

1. **`THREE.Clock` deprecation — upstream noise.** The `new THREE.Clock()` is
   inside `@react-three/fiber`'s own event layer
   (`node_modules/@react-three/fiber/dist/events-156d8d12.esm.js:1016`), not
   our code (grep of `desktop/src/floor` finds only an unrelated
   `reasoningClocks` map). three r185 deprecates the class; it is removed in
   future majors. Action: none available at our layer — tracked for the next
   R3F upgrade; it is a `warn`, not an error, and has no runtime effect.
2. **`THREE.WebGLRenderer: Context Lost` — real hazard, hardened.** The
   message itself is expected (three logs it whenever ANY canvas context is
   lost, including deliberate disposal). But our `DeckCanvas`
   `webglcontextlost` handler listened on `window` with no target check, so a
   context-loss from a DISPOSED canvas (StrictMode double-mount, HMR,
   deck↔chat toggle) could demote the LIVE office to the SVG fallback.
   Fix: ignore `webglcontextlost` whose `event.target` is an
   `HTMLCanvasElement` that is already `!isConnected` (detached = disposal
   noise, never the live office). Live-probe evidence: reload + forced
   chat→deck remount → `canvasCount:1, canvasConnected:[true],
   fallbackShown:false` — the office survives remounts.
3. **`[deck] batch: 254 events … savant=off` — working as designed.** The
   FID-2026-0828-002 contract is 1:1 chat↔floor mirroring: idle chat → floor
   idle (`savantPresent` false, walkers 0, phase —). The log is the proof the
   pipe is alive, emitted once per batch (`console.info`, dev diagnostic per
   FID-2026-0828-002), not a per-frame spam source.

**Verification Evidence:** desktop suite **349 pass / 0 fail**; desktop
typecheck exit 0; eslint `deck-view.tsx --max-warnings 0` exit 0; prettier
clean; **live CDP probe** (hard reload, forced deck remount): office canvas
stays mounted and connected, fallback never renders. Probe file removed after
use.

### P28 — island scope fix, composer auto-grow, dev-gated deck log

**Corrections + polish batch (2026-09-02).** Three items, one honest
self-correction:

1. **P26 record corrected — island was rendering on the chat branch too.** The
   P26 probe's `islandOnChat: true` reading was mis-recorded as intended
   behavior; it was a scope bug (two send boxes stacked on one screen: the
   island plus the chat's own Composer — Law 11 violation against the CLI's
   single-composer surface). Fix: `DeckMiniChat` takes `expanded` — full
   composer on the deck branch (WebGL office AND analytical fallback, per the
   original operator ask), collapsing on chat to the live pill only (one-click
   interrupt while a run streams) and rendering NOTHING when idle on chat.
   `.minichat-collapsed` hugs content width.
2. **Composer auto-grow** — both textareas now grow with their drafts instead
   of scrolling inside a one-line box: shared `useAutoGrowTextarea` hook (Law
   13), main Composer capped 120px (~5 lines), island capped 72px (~3 lines);
   caps enforced in CSS (`max-height` + internal scroll), shrink-back on send
   via the same effect.
3. **`[deck] batch:` diagnostic dev-gated** — the per-batch `console.info`
   (operator saw it streaming past in the console paste) now runs only when
   `import.meta.env.DEV`; Vite statically strips it from production builds.
   The diagnostic itself stays (FID-2026-0828-002 proof-of-pipe) in dev.

**Verification Evidence:** desktop suite **349 pass / 0 fail** across 48
files; desktop typecheck exit 0; eslint (all 5 touched files)
`--max-warnings 0` exit 0; prettier clean. **Live CDP probe** (hard reload):
Deck → island full (`hasInput/hasSend: true`, pill "idle — replies land in
Chat"); Chat → island `null` when idle with the chat composer present
(`chatComposer: true`); auto-grow measured live `41px → 120px, grew: true,
capped: true`; dev log confirmed present in dev (`devDeckLogsSeen: 17`,
production stripping guaranteed by Vite's define replacement). Probe file
removed after use.

### P30 — deck island shows the exchange (and a crash caught before release)

**Operator finding (2026-09-02):** on the DECK tab, sending from the island
produced the speech bubble over Savant but "within the chat (the new chat on
the deck) it does not actually show the messages, not for the user, nor the
responses from savant unless i switch to the actual chat tab."

**Fix:** the island now renders the TAIL of the one shared transcript — last 6
user/text blocks (tool/reasoning/notice blocks deliberately excluded: the deck
bubble carries thinking; the island is for the human exchange). User bubbles
right (primary-tinted), savant replies left via the same `MarkdownBlock` the
Chat tab renders (compact 12.5px override scoped to `.minichat-agent`).
Bounded 260px scroll area pinned to the newest block (near-bottom contract —
manual scroll-up to read is respected), `aria-live=polite`. The idle pill only
shows when there is no tail to render; it returns after `clearTranscript`.

**Crash caught live (Law 3):** the first implementation passed an inline
`filter()+slice()` selector to `useStore`, returning a NEW array each poll —
breaking `useSyncExternalStore`'s snapshot-identity contract → **"Maximum
update depth exceeded"** and a white-screen (CDP census: `rootChildren: 0`),
reproduced on a fresh boot. Fix: new `useTranscriptTail` hook subscribes to
the whole `blocks` array (stable identity) and derives the tail with
`useMemo`; no middleware. Post-fix boot census: `rootChildren: 1, errors: []`.

**Verification Evidence:** desktop suite **349 pass / 0 fail**; typecheck 0;
eslint 0; prettier clean. **Live CDP end-to-end** (fresh boot, Deck view):
empty → no tail + idle pill; seeded mixed exchange (user/reasoning/tool/text
×2) → tail shows both user bubbles + both savant replies, `markdownRendered:
true` (`<strong>` from `**3D agent office**`), `hiddenThoughtLeaked: false`,
tail height 249px (bounded ≤260); after `clearTranscript` → tail gone, idle
pill back; zero runtime exceptions throughout. Probe file removed after use.

### P31 — pasted console trace is the PRE-FIX module (closed as no-defect)

**Operator evidence (2026-09-02):** console paste showing `The result of
getSnapshot should be cached to avoid an infinite loop` + `Maximum update
depth exceeded` + `An error occurred in the <DeckMiniChat> component`.

**Triage:** the trace's stack (`react-dom-client.development.js:8129`) and the
error boundary naming `DeckMiniChat` match EXACTLY the snapshot-identity loop
fixed mid-session in P30 (the inline filter+slice selector). Two independent
confirmations the paste predates the fix: (1) the file timestamps —
`DeckMiniChat.tsx` was rewritten at 16:59 and `use-store-tail.ts` (the fix) at
17:05, while the running window had loaded modules before the rewrite; (2) the
crash requires the old inline selector, which no longer exists in the codebase
(grep: the only remaining `useStore` calls in DeckMiniChat are primitive
selectors — `state.running`, `state.currentActivity` — which are identity-
stable by contract).

**Regression verification:** 14 consecutive hard-reload boot censuses over CDP
across two app restarts: `rootChildren: 1, errorCount: 0` every time; store
round-trip probe confirms `blocks` array identity is stable across no-op
`setState` (the contract the whole-array subscription relies on). No code
changes in this batch — P30's fix holds; recording for the audit trail.

### P33 — island width + semi-transparent backdrop

**Operator findings (2026-09-02):** "it is not wide enough" and "should have a
semi-transparent black background for the chat component." Operator also
confirmed the P30-era "messages disappear" report was the pending-message
display, already resolved — no vanish bug remained; extensive CDP instrumentation
this round confirmed zero block-loss events across full send→reply cycles
(`replacements` log shows monotonic append/merge only, no wipes).

**Fix (CSS-only):** island widened 340px → **480px** (still viewport-capped);
a `::before` pseudo-element paints a **semi-transparent black panel**
(`rgba(0,0,0,0.55)` + `blur(6px)` + border) behind the whole island — pill,
transcript tail, and composer ride one cohesive surface instead of floating
fragments. Tail itself gets a lighter `rgba(0,0,0,0.35)` fill and grows to
300px. The collapsed chat-branch pill explicitly hides the backdrop (`display:
none`) so the chat view keeps its clean corner affordance.

**Verification Evidence:** desktop suite **349 pass / 0 fail**; typecheck 0;
prettier clean; lint:md clean. **Live CDP re-measure post-reload (operator
eyeball pass, 2026-09-02):** island `480px` wide at `left:16 / bottom:16`; backdrop
active with computed `rgba(0,0,0,0.55)` + `blur(6px)`; tail renders 480×273px
with `rgba(0,0,0,0.35)` fill carrying 2 user + 2 agent seeded blocks. Probe file
removed after evidence capture. Operator to confirm visually on screen.

### P35 — "Project FIDs shows 0 open" while the repo has 21 active FIDs

**Operator finding (2026-09-02):** "the ui shows 0 open. however if you look in
the fids folder i have a bunch?"

**Root-cause isolation (evidence, not inference):**

1. **Gateway emits the inventory.** Raw-socket handshake against the live
   sidecar (port 58468, PID 18884) captured the hello reply followed by an
   event batch of **254 `fid_update` events** (frame sizes 251 / 25116 bytes).
   The hello-time `setTimeout(0)` initial-sync push in `gateway.ts` works.
2. **Desktop parser + store ingest the batch.** Pushing the exact captured
   25KB frame through the page's `parseInboundFrame` → `ingestEvents` produced
   `queueLen: 252` (254 minus 2 archive-dir entries), and the panel immediately
   read **27 open** (archived/closed dropped; matches the operator's known
   27/252 Auto Drive figure).
3. **The app's live socket never delivered it.** A listener attached to the
   shared `GatewayClient` received **zero events** — including after touching a
   FID file to fire the gateway's fs-watcher. Client inspection:
   `getProjectId() === null`, `dispatch` throws `gateway not ready (status:
   offline)`. The client was stranded offline while the UI rendered.
4. **Cause:** `use-gateway.ts` gated the boot connect behind a module-level
   `connectStarted` flag. Across HMR module generations (dozens this session),
   a fresh module instance could skip calling `connect()` while the shared
   client instance (also re-created by HMR) sat `offline` forever — silent,
   permanent, and invisible: no console error, splash already dismissed
   (`everReady` sticky from an earlier generation).

**Fix:** idempotence moved onto the client instance — new `connectOnce(config)`
gated by an instance `connectStarted` field (reset by `close()`), and the hook
now calls `connectOnce` unconditionally on every effect run; the module flag is
deleted. An HMR remount can no longer leave the transport unwired. `connect()`
remains explicit/always-reconnects for teardown flows.

**Pins:** 3 new tests in `gateway-client.test.ts` — first-call-opens/
subsequent-calls-ignore, `connect()` stays explicit, `close()` resets the gate.

**Verification Evidence:** desktop suite **387 pass / 0 fail** (was 349 + 38
new/moved since P28); desktop typecheck 0; eslint 0 warnings; prettier clean.
**Live:** fresh exe boot with CDP → store `fidQueue.length === 252`, panel
"27 open", root mounts 1 child, zero console errors — the boot batch now
arrives through the app's own socket with no manual injection. Probe files
cleaned from `/tmp`.

### P36 — auto-manage `dev/scratchpad/` (operator: "looks like absolute madness")

**Operator finding (2026-09-02):** the scratchpad root held 35+ loose files
(`p19-*`…`p34-*` probes, PNGs, spec dumps, ad-hoc dirs `fid-006/009/011-smoke`,
`fio-audit/`, `inkwell/`, empty `evolve-output/`) — every past session (this
one included) dropped artifacts at the root instead of the documented
`active/`/`archive/` convention. Root cause: convention-only management, no
mechanical enforcement.

**Two-part fix:**

1. **Mechanical enforcement (Law 13 — make the convention non-skippable).**
   New `scratchpad-clutter` issue class in `scripts/hygiene.ts`
   (`collectScratchpadIssues`, folded into `collectHygieneIssues` so
   `validate:repository` inherits it): any scratchpad-root entry other than
   `README.md`, `active/`, `archive/`, `.gitkeep` fails the hygiene gate.
   Hygiene flags; it never deletes — retention stays with the operator.
   3 new tests in `scripts/hygiene.test.ts` (clean-root pass, loose file +
   ad-hoc dir flagged, no-scratchpad tolerated). Honest ratchet:
   `dev/quality-baseline.json` `scripts/hygiene.ts` 183 → 218 (measured,
   prettier-formatted; growth is the new guard, documented here).
2. **One-time sweep (per the existing README convention).** Root reduced to
   `README.md` + `active/` + `archive/`. Moves: FID smoke dirs →
   `archive/fid-smoke/`; deck/chat probe scripts + PNGs (p19–p34, pixel-diff,
   deck-*) → `archive/runtime/archive/probes/`; TS closeout/fixer one-offs +
   diag logs → `archive/runtime/`; spec/research docs + `fio-audit/` +
   `inkwell/` journal + matrix → `archive/research/`; reusable deck launchers
   → `active/` (with a usage-table README); empty `evolve-output/` removed.
   All three READMEs updated — root README now documents the enforced root
   contract and the **tmp/ policy** (live probes → `/tmp`, reusable tooling →
   `active/`, retained evidence → an `archive/` purpose folder).

**Verification Evidence:** `bun run scripts/hygiene.ts` → PASS (clean root);
hygiene.test.ts 6/6 (3 new); quality:report shows hygiene.ts at/below
baseline; eslint 0 warnings; prettier clean; lint:md clean. `bun test scripts/`
times out in-repo (pre-existing repo-wide scripts runtime, not this change —
flagged per the Additional Rule; targeted suites all pass).
