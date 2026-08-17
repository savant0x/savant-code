# Archived FIDs

This directory contains closed or historically completed FIDs. Files here are
an audit record, not an active work queue.

> **Correction (2026-08-16):** a closure section for the six planning FIDs
> (FID-2026-0816-002..007) was briefly added here and then removed — closure
> requires implementation evidence. As of 2026-08-16, FID-2026-0816-003
> (Phase 0), FID-2026-0816-004 (Phase 1), FID-2026-0816-006 (Phase 3 —
> custom renderer re-verified), FID-2026-0816-007 (Phase 4),
> FID-2026-0816-008 (logo easter egg), and FID-2026-0816-009 (diff +
> transition redesign) are implemented and archived here. The master (002)
> and Phase 2 (005) were the last to close — both archived 2026-08-16, and
> the `dev/fids/` active queue is now empty (see the final-batch closure
> entry below).
>
> **Palette correction (2026-08-16, operator directive):** the navy/slate
> neutral family (`#0f172a` surface, `#1e293b` border, `#94a3b8`/`#64748b`
> muted, `#e2e8f0` foreground) that `FID-2026-0812-002` established as
> "native Savant" is **superseded** — the operator states it is pre-fork
> Freebuff branding; Savant is near-black (`#050508`) + cyan (`#18faf9`)
> only. The 2026-08-16 navy purge (see CHANGELOG) replaces the neutral
> scale project-wide with neutral near-black grays; semantic accents are
> unchanged. Historical archive records are not rewritten.

## 2026-08-16 closure — FID-2026-0816-009 (diff viewer + phase-transition redesign)

`FID-2026-0816-009-diff-viewer-and-transition-notification-visual-redesign.md`
(severity: medium) closed and archived 2026-08-16 after the operator's
visual pass **PASS**: the diff viewer renders correctly (bordered rounded
container, header strip with file path + `+N −M` counters, dual old/new
line-number gutter + sign column, full-width hunk bars, muted metadata rows,
`EDIT` fallback label) and the phase-transition bar renders **identically in
Cursor and classic PowerShell console** (operator confirmation 2026-08-16:
"the phase bar renders identically in Cursor and PowerShell now").

Six loop rounds: (1) framed gutter diff layout + registered
`transition_phase` bar; (2) line-number correctness from `@@` hunk starts;
(3) phase coverage via shared `phaseMapping`; (4) `run_readonly_command`
registered with the shared terminal-command renderer + copy-button chrome
dropped on both notices; (5) `SAVANT CODE` brand title row, idle black text
(mid-tone gray chip), ADVERSARIAL violet `phaseAdversarial` token; (6)
**filled-chip redesign** for terminal-uniform rendering — the 14% theme tint
collapsed to "black background + white header" under ANSI-16 approximation
(classic conhost lacks truecolor), so the bar is now a solid phase-color
fill with inverted text (BLACK on bright fills, WHITE on the red fill via
new `relativeLuminance` in `diff-stats.ts` with a 0.25 floor; idle keeps the
mid-gray + black). No native `<diff>` (production-blanked, reverted in
FID-006).

Verification: typecheck ×4 exit 0; cli suite 3158 pass / 0 fail; eslint 0;
lint:md 0; prettier clean; tmux launch smoke clean; operator visual pass
PASS (diff + transition bar, both terminals).

## 2026-08-16 closure — FID-2026-0816-002 (UI-overhaul master) + 005 + 010 + 011 + 012-trust (final batch)

The remaining open UI-overhaul FIDs were closed together on 2026-08-16
after the operator's live-test confirmation ("close all completed fids, all
have been confirmed in the live tests"). The active queue is now **empty**.

- **`FID-2026-0816-002-savant-ui-overhaul-master.md`** (high) — master
  organizing FID, governance-only (planning, no code of its own). Closed
  once every child closed with implementation evidence; step 7
  (idea-shelf reconciliation) complete.
- **`FID-2026-0816-005-animation-engine-adoption.md`** (medium, Phase 2) —
  timeline engine (`use-animation-timeline` with loop/duration options),
  animation-budget hook (blur → 15fps, scissor-hidden suspension),
  smooth scroll, fold/collapse tween, streaming typewriter; `opentui-spinner`
  rejected (raw `setInterval` scheduler — YAGNI); grep gate: only the two
  allowlisted 1 Hz wall-clock timers remain. Operator confirmed the
  blur → 15fps check (A) in the live test.
- **`FID-2026-0816-010-post-fid-009-ui-polish-backfill.md`** (medium) —
  mode-selector cyan hover strokes project-wide; reactive trust matrix
  (mounts only while pending, resolves signed rows, no title icon,
  disappears on completion). Checks E/F confirmed by operator.
- **`FID-2026-0816-011-rich-terminal-command-output.md`** (medium) — rich
  terminal panel: traffic-light title bar, `$` command row + ✓/✗/⏳ status
  badge, cwd/timeout pills, line-number gutter (hidden <50 cols), clean
  expand/collapse; `exitCode` now parsed and plumbed through
  `parseTerminalOutput`. Check G confirmed by operator.
- **`FID-2026-0816-012-trust-matrix-stuck-awaiting-audit.md`** (medium) —
  Trust Matrix label "awaiting audit"→"signed", tone-glyph icon removed,
  title → "Trust Matrix". Check H confirmed by operator. (Historical
  duplicate ID with the 012 hardening record — both preserved by filename.)

Closure gates: typecheck ×4 exit 0; cli suite 3158 pass / 0 fail; eslint 0;
lint:md 0; prettier clean; operator live-test confirmation on every check
(A–H). CHANGELOG entries added; active-queue README rewritten (empty).

## 2026-08-16 closure — FID-2026-0816-001 (v0.0.24 phantom-dependency incident)

`FID-2026-0816-001-v0.0.24-bad-build-phantom-dependency-and-pipeline-scope.md`
was archived 2026-08-16 after the release-blocking incident was closed: the
`v0.0.24` release shipped without binaries because `@noble/hashes` phantom
entry made the CLI bundle fail its integrity scan, and the pipeline ran
`publish:package` for a main package that was never built. Resolved by
declaring `@noble/hashes` (dependency) and defaulting publication to
main-package-only with a cli-bundle-resolution release gate + dispatch-ref
guardrails. Status `closed`; full record in the CHANGELOG 2026-08-16 entry.

## 2026-08-16 closure — FID-2026-0816-012 (native tool-call recovery hardening)

`FID-2026-0816-012-native-tool-call-recovery-hardening.md` (severity: high)
closed and archived 2026-08-16 after operator approval and the full gate
sweep. Root cause: a flash-class model truncated a large `write_file` native
call mid-JSON, the runtime retried once with a generic prompt, the model
re-emitted the same oversized payload and truncated again, and the 2-strike
cap killed the whole subagent run with a guidance-free stack trace.

Deliverables in `packages/agent-runtime`: (1) tool-aware split-steering
appended to the TOOL_CALL_ERROR retry prompt for large-payload tools
(`write_file`/`str_replace`/`apply_patch`/`read_files` — the write tools via
the canonical `WriteToolName` union); (2) `NATIVE_TOOL_CALL_RECOVERY_MAX_STRIKES
= 3` replacing the hard 2; (3) an actionable exhausted failure naming the
last incomplete tool (`lastIncompleteToolName` threaded stream-parser → step
→ loop-iteration) plus a re-spawn strategy; (4) a `logger.warn` for
incomplete calls naming tools unknown to the runtime (provider tool-set
drift). Recorded deviations: exhausted message reworded to "failed
repeatedly" (accurate at 3 strikes; tests updated), and the drift check uses
the canonical native tool list (runtime-observable equivalent of the
llm-providers `requiredToolKeys`).

Verification: typecheck ×4 exit 0; agent-runtime 973 pass / 0 fail; SDK 477
pass / 0 fail; eslint 0; lint:md 0; prettier clean. Tests added: 3-strike
exhaustion, steering present/absent, drift warn + tool name on exhaustion,
streak-reset at 5 calls.

## 2026-08-16 closure — FID-2026-0816-008 (Savant logo easter egg)

`FID-2026-0816-008-savant-logo-easter-egg.md` (severity: low) closed and
archived 2026-08-16 after the operator's visual pass **PASS** ("absolutely
perfect, feature is complete"). Delivered: a click-per-message hidden
state machine on the Savant wordmark — clicks 1–3 show small **centered**
auto-dismiss nag bubbles (1.5 s), and the 4th click plays a ~600 ms glitch,
a **full-screen** fake-terminal "DELETED" takeover in the **cyan-on-
near-black** Savant colorway (480 lines through a viewport-height scrolling
window over ~5 s), and a centered moral bubble that auto-resets after 5 s.
State lives in an app-root `EasterEggProvider` with `<EasterEggOverlays />`
mounted as a sibling of `AppShell` (full-viewport absolute). Three
operator-driven correction rounds: (1) freeze fix — the takeover timeline
pins its `duration` (the 1000 ms default cut the item off; same class as
the FID-2026-0816-005 loop regression, proven by
`animation-timeline-loop.test.ts`); (2) interaction — 7-click/next-click
popups → click-per-message with a `level` counter; (3) colorway/position/
flood — green-on-black + top-right bubbles + 2 s blip → cyan-on-near-black,
centered, viewport-height 5 s flood. The round-3 pass also purged the
**navy/slate neutral family project-wide** (operator directive: pre-fork
Freebuff branding) — see CHANGELOG 2026-08-16 palette entry. Gates:
typecheck ×5, cli suite 3132/18/0, eslint/lint:md/prettier green, tmux
launch smoke clean; operator visual pass PASS. Canonical design doc:
`docs/design/easter-eggs.md`.

## 2026-08-16 closure — FID-2026-0816-006 (Phase 3: native code/diff components)

`FID-2026-0816-006-native-code-diff-components.md` (severity: medium) closed
and archived 2026-08-16. The native renderables (`<code>`/`<line-number>`/`<diff>`,
`<image protocol="blocks">`) were adopted, verified against the test frame
buffer, then **reverted** after live terminal testing showed they paint
nothing in the production CLI renderer (diff showed only the `Edit filename`
header; code blocks lost their line gutter). The spike conclusion "native
wins" was overturned — the test renderer is not a proxy for production.
Shipped state: custom `diff-viewer.tsx` (line-by-line + neon tinting),
`markdown-leaves.tsx` plain `<code>` block, `image-block.tsx` metadata-card
path; `<ascii-font>` branding retained; the nonexistent `Markdown` component
stayed out of scope. Closure evidence: typecheck ×4, cli suite 3089/18/0,
eslint/lint:md/prettier green, and the operator's live confirmation that the
restored custom diff renders (2026-08-16). Design polish of that diff is now
tracked by FID-2026-0816-009.

## 2026-08-16 closure — FID-2026-0816-007 (Phase 4: layout/responsiveness)

`FID-2026-0816-007-layout-responsiveness.md` (severity: medium) closed and
archived 2026-08-16. Delivered: breakpoint-aware sidebar collapse (new
`sidebar-rail.tsx` icon rail below 60 cols, full `RightSidebar` at 60+);
unified picker chrome (`dialog-overlay.tsx` — absolute + RGBA backdrop +
`translateY` entry/exit) for model/provider/rewind pickers; a focus-containment
fix (rewind picker no longer leaks keys to the chat dispatcher); a toast stack
that is absolutely positioned, timeline-animated, and z-index layered with
two-phase dismiss; and the `cwd:` line folded into input-bar chrome (border
title normal mode / dim row compact mode; data source unchanged). Gates:
typecheck ×4, cli suite 3099/18/0, eslint, lint:md, prettier all green; tmux
smoke at 50/60/80/120 cols + provider-picker open/navigate/cancel walk at
60/80/120 and model-picker open at 80 all PASS; operator visual PASS
2026-08-16 (60/80/120 cols + picker walk confirmed in terminal).

## 2026-08-16 closure — FID-2026-0816-004 (Phase 1: design tokens + visual identity)

`FID-2026-0816-004-ui-design-tokens-identity.md` (severity: medium) closed and
archived 2026-08-16. Delivered: `savant-ui/theme.ts` rewritten as the canonical
token module (`tokens` = spacing/borders + `useTokens()` resolving semantic
colors/badges/phase tokens from the active `ChatTheme`, zero hardcoded hex);
sidebar `Teacher` default-collapsed (History already was; section order already
matched the plan). The `ChatHeader` was populated then reverted to its no-op per
operator feedback — the path/mode/model/connection line is redundant with the
right sidebar. Status-bar duty split and transcript differentiation were already
present. Gates: typecheck ×4, cli suite, design-systems 19/0, eslint, lint:md,
prettier all green; operator visual PASS 2026-08-16 (1:1 clean).

## 2026-08-16 closure — FID-2026-0816-003 (Phase 0: OpenTUI 0.2.2 → 0.5.3 upgrade)

`FID-2026-0816-003-opentui-0-5-x-upgrade.md` (severity: high) closed and
archived 2026-08-16. Delivered: exact `@opentui/core`/`@opentui/react` 0.5.3
pins, JS `yoga-layout` dropped (native since 0.4.1), `react-reconciler` synced
to ^0.33.0, and the `OPENTUI_FORCE_EXPLICIT_WIDTH=false` ConHost guard
(`shouldSuppressExplicitWidthQuery`). Interactive acceptance: tmux (WSL) smoke
(launch/render/resize/input/streaming/interrupt/exit) PASS, ConHost guard
unit/logic PASS, operator Windows Terminal visual PASS (2026-08-16). Gates:
typecheck ×4, full `bun test`, eslint, lint:md, prettier, savant-free build all
green; the savant-free e2e suite has pre-existing Windows harness failures
recorded out-of-scope in `SCOPE.md`.

## 2026-08-14 closure — FID-2026-0814-013 (force-compact trigger as a fixed window offset)

`FID-2026-0814-013-force-compact-offset-not-ratio.md` (severity: low) was
implemented and archived on 2026-08-14 as a follow-on to FID-2026-0814-012.
The force tier was `maxContextLength × 0.9`, so its headroom below the hard
limit grew linearly with the window (12.8k @ 128k → 40k @ 400k). The config key
is renamed `compression.forceCompactRatio` → `compression.forceCompactOffset`
(default `15_000` tokens) across all five layers, and the serialized generator
now computes `forceDue = contextTokenCount > maxContextLength -
forceCompactOffset`. `autoCompactRatio` (0.8) stays a ratio. Both generated
bundles regenerated; docs and tests updated to the new unit; a regression pins
the force tier above the proactive tier at 262k and 128k windows.

Gates: typecheck ×5 clean; common 610/0 · agents 54/0 · agent-runtime 963/0 ·
sdk 548/0 · cli 3071/0; ESLint `--max-warnings 0`; lint:md; Prettier;
`validate:repository` PASS; protocol-bundle drift clean. The PASSes are not
release authorization; these are working-tree closure records.

## 2026-08-14 closure — FID-2026-0814-012 (force threshold anchored to the resolved window)

`FID-2026-0814-012-force-threshold-reactive-compact-reconciliation.md`
(severity: low) was implemented and archived on 2026-08-14 as a follow-on to
FID-2026-0814-011. It anchors the 0.9 force threshold and the sidebar percent
denominator to the compactor's `reactiveCompact` (= `contextWindow`) instead of
the reconstructed `autoCompact + 30_000`. `loop-context.ts` sets
`maxContextLength = getThresholds().reactiveCompact` and `context-tokens.ts`
uses `thresholds.reactiveCompact`, so the generator's force threshold is
`contextWindow × 0.9` — never diverging from the resolved window. Three
threshold regression tests pin the clamp-floor overshoot. Single-source-of-truth
(Law 13) reconciliation; not a live defect (the clamp only overshoots below
130k, a 2k delta at the 128k floor).

Gates: typecheck ×4 clean; agent-runtime 963/0; ESLint `--max-warnings 0`;
lint:md; Prettier; `validate:repository` PASS. The PASSes are not release
authorization; these are working-tree closure records.

## 2026-08-14 closure — FID-2026-0814-011 (auto-compaction trigger never fires)

`FID-2026-0814-011-auto-compaction-trigger-never-fires.md` (severity: critical)
was implemented under operator approval, Nova-audited **PASS** on
implementation, operator-approved for closure, and archived on 2026-08-14.

Scope: the context-pruner spawn was dead at runtime (0 spawns across a
2,540-step session at 353k tokens vs a 262,144 window) because two trigger
systems existed and only the broken one could spawn. The fix collapses them
into a single authority — `prepareStepContext` records the proven
`shouldAutoCompact` verdict as `agentState.autoCompactDue` every step, and the
serialized savant `handleSteps` consumes it as the primary trigger; the baked
`maxContextLength` fallback can no longer silently push the trigger above the
window (fail-loud debug), and the trigger inputs are now observable. 5 new
regression tests cover the `toString→eval` round-trip and the removed silent
fallback chain.

Gates: typecheck ×4 + agents clean; full root suites green (agent-runtime 960/0,
common 610 pass / 4 skip / 0 fail, SDK 475 pass / 1 skip / 0 fail, CLI 3071
pass / 18 skip / 0 fail, agents 54/0); ESLint `--max-warnings 0`; lint:md;
Prettier; `validate:repository` PASS. The PASSes are not release authorization;
these are working-tree closure records.

## 2026-08-14 closure batch — FID-2026-0814-002..007 (Goal engine, hooks, frictions, model unification, Trust Matrix + compaction)

The 2026-08-14 remediation program — master `FID-2026-0814-007` and children
`FID-2026-0814-002` through `-006` — was implemented under the operator's
automation level 3 grant (Nova planning PASS recorded for each child) and
closed/archived on 2026-08-14:

- `FID-2026-0814-002` — durable budgeted goal mode: event-sourced goal state
  machine (`active | paused | blocked | complete`), token/turn/wall-clock
  budgets, runtime continuation driver, `update-goal`/`get-goal` model tools,
  `<untrusted_objective>` injection, `/goal status|pause|resume|cancel`. 30
  focused tests.
- `FID-2026-0814-003` — extensible hook system: `hooks:` config block,
  fail-open bounded JSON-on-stdin runner, `PreToolUse`/`PostToolUse`/
  `PostToolUseFailure` at the EHEL gate plus session/subagent events.
- `FID-2026-0814-004` — verification-harness frictions (H-01..H-07:
  exit-code-preserving micro-compaction, quote-aware shell metachar scanner,
  code-vs-docs compliance writes, config-driven micro-compact keep-recent) +
  project-wide model unification (H-08..H-12, P0: the UI-selected model is the
  only model used — teacher-forge/thinker/headless paid hardcodes removed).
- `FID-2026-0814-005` — Trust Matrix auto-resolution: `finalize()` resolves
  open `pending` receipts to an honest `no_verdict` terminal via a signed
  system-role close annotation.
- `FID-2026-0814-006` — compaction freshness + visible feedback: the
  SDK-boundary `contextWindow` drop fixed (no silent 200k fallback), snapshot
  emit on status/context change (no stale percent), and an in-stream
  `CompactionSignal` block.
- `FID-2026-0814-007` — coordination master; closed last after all children.

Gates: typecheck ×4 clean; full root suites green (agent-runtime 958/0,
common 610 pass / 4 skip / 0 fail, SDK 475 pass / 1 skip / 0 fail, CLI 3070
pass / 18 skip / 0 fail); ESLint `--max-warnings 0`; lint:md; Prettier;
`validate:repository` PASS. The PASSes are not release authorization; these are
working-tree closure records.

## 2026-08-14 closure — FID-2026-0814-010 (paid-build model conflation)

`FID-2026-0814-010` was closed and archived on 2026-08-14 under an explicit
operator authorization **without** a Nova sign-off. Findings B-09/B-10:

- **B-09 (P0):** the paid build's `resolveInitialSelectedModel` trusted the
  savant-free preference and `switchModel` wrote it, so a stale
  `minimax/minimax-m3` free preference silently overrode the operator's `/model`
  selection on boot. Fixed: the paid build resolves only from
  `savantCodeModelPreference ?? openrouter/free`; `switchModel` persists
  build-aware (paid → savant-code key, free → savant-free key).
- **B-10 (P1):** `agents/librarian/librarian.ts` and `agents/tmux-cli.ts` still
  hardcoded `minimax/minimax-m3` (missed by FID-009 B-08); reconciled to
  `openrouter/free` and the bundle regenerated.

Gates: 27/0 model-store + settings tests, typecheck ×4 + agents, ESLint
`--max-warnings 0`, Prettier, markdownlint, `validate:repository` PASS. No
release authorization is implied.

## 2026-08-14 closure — FID-2026-0814-008 and -009 (test coverage + prompt coherence)

Two follow-on records were closed and archived on 2026-08-14 after
Perfection-Loop convergence and the full gate sweep:

- `FID-2026-0814-008` — extends `az-v0.0.24-harness-live-test.md` (→ v1.2.0)
  with a deterministic `5e` phase (V024-150…167: 9 executable suites + 9 static
  greps), two Phase 3 operator live rows (`/goal` lifecycle, in-stream
  `CompactionSignal`), and three Agent View re-examination items covering
  FID-2026-0814-002..007. No code added — test-prompt documentation only.
- `FID-2026-0814-009` — project-wide inter-agent prompt & definition coherence
  audit (B-01…B-08): basher two-phase contract rewritten (the "vital problem" —
  "run the command" vs "Do not use any tools" contradiction), Detective phase
  attribution corrected (Forge = GREEN, not RED), Recorder status vocabulary
  aligned to `created | analyzed | fixed | verified | closed`, Scout stale
  XML-tag instruction removed, `thinker-gpt` deleted with `/plan` + `/review`
  folded into the standard `@thinker` (the old `@thinker-gpt` delegation was
  dead — never in the savant's `spawnableAgents`), and `withParentModel` now
  preserves the child's `data_collection: 'deny'` privacy flag (B-06). The
  ChatGPT-OAuth connection feature itself is untouched. B-07/B-08 (added under
  the operator's "nothing is out of scope" directive) reconciled **every paid
  `model` default across `agents/`** to `openrouter/free` — the best-of-n
  editor (B-07) and the canonical ECHO role agents + infra helpers (B-08); the
  free flash-lite defaults and the free savant catalog were verified free and
  left intact. Regenerated `bundled-agents.generated.ts` contains zero
  paid-model literals.

Gates: typecheck ×4 clean; full root suites green (agent-runtime 960/0,
common 614 pass / 4 skip / 0 fail, SDK 476 pass / 1 skip / 0 fail, CLI 3088
pass / 18 skip / 0 fail; agents suite 49/0); ESLint `--max-warnings 0`;
lint:md; Prettier; `validate:repository` PASS; fid-ledger clean. The PASSes are
not release authorization; these are working-tree closure records.

## 2026-08-14 closure — FID-2026-0814-001 (Live Sidebar Surfaces Remediation)

`FID-2026-0814-001-live-sidebar-surfaces-remediation.md` (severity: high) was
implemented under the operator's automation level 3 grant and closed/archived
on 2026-08-14 after **both** Nova audits returned PASS:

- **Planning PASS**
  (`dev/nova/inbox/2026-08-14-fid-2026-0814-001-live-sidebar-surfaces-planning-response.md`)
  — all 6 hard questions + 7 claims verified at source; one precision
  observation (teacher mount citation corrected to `right-sidebar.tsx:261-268`)
  accepted and reconciled.
- **Implementation PASS**
  (`dev/nova/inbox/2026-08-14-fid-2026-0814-001-live-sidebar-surfaces-implementation-response.md`)
  — all 7 hard questions verified at source with quoted `path:line`; zero flags.

Scope: (A) real compaction-status lifecycle — `compacting` emitted by the
serialized savant handleSteps at every pruner spawn, a 30s post-pruner re-spawn
cooldown, `pruned`/`warning` result writes at the spawn-agent-inline
history-replacement boundary, window-relative `percentUsed`, and the sidebar
labels `idle · ✓ micro −N · compacting… · ✓ pruned −N · ⚠ N% of window`; (B) a
live `N signed event(s) this session` Trust Matrix footer plus a headless test
closing the operator-gated V024-P3-3 real-time row; (C) a packed teacher event
log and runtime-authoritative `phase`/`completionState` props so `/learn cancel`
renders a `· CANCELLED` badge. Gates: typecheck ×4, full root suites
(SDK 470/0, common 612/0, agent-runtime 891/0, CLI 3069/0), new lifecycle
suites (agents phase3 10/10, CLI 22/22), ESLint zero warnings, lint:md,
Prettier, and `validate:repository` PASS. The PASSes are not release
authorization; these are working-tree closure records.

## 2026-08-12 archive index — FID-2026-0812-001

`FID-2026-0812-001-v0-0-23-live-test-remediation-master.md` was closed by
operator direction on 2026-08-12 and archived here after the A-Z v0.0.23
harness live-test program reached ledger closure (85 rows: 46 PASS +
33 OPERATOR-CONFIRMED + 1 FAIL\* fixed post-run + 5 SKIP, 0 NEEDS-REVIEW) and
the release-readiness review passed. Closure was recorded with a dedicated
addendum inside the file; historical planning content was preserved and no
section was rewritten. Clean-release certification remains a separate operator
action pending a committed tree.

## 2026-08-12 queue closure batch — FIDs 002–007

The following children of master FID-2026-0812-006 completed their narrowed implementation/evidence, lifecycle closure, and archive moves on 2026-08-12:

- `FID-2026-0812-002` — Savant terminal surface/sidebar and existing chat scrollbar; focused CLI tests 7/7 and CLI typecheck passed; sidebar confirmed fine by the operator.
- `FID-2026-0812-003` — Nous Research direct provider; provider-focused validation 90/90, common/SDK/CLI typechecks, provider-doc drift check, and operator-confirmed live inference passed; Portal OAuth remains out of scope.
- `FID-2026-0812-004` — `/model` ranking and picker visibility/navigation; focused picker evidence and CLI typecheck passed; residual short-terminal, scrolling, resize, focus, keyboard/mouse, Enter/Escape, and persistence checks were operator-confirmed.
- `FID-2026-0812-005` — adaptive grounding refresh/resume; agent-runtime enforcement 27/27 and loop tests 16/16 passed, common/agent-runtime/SDK typechecks passed, and live grounding was operator-confirmed.
- `FID-2026-0812-006` — coordination master; reconciled the child closure records and preserved the no-release/no-GitHub boundary.
- `FID-2026-0812-007` — top-row click/highlight forensics; the operator confirmed no highlight in a different IDE. Closure is classified as an external-environment-dependent resolution; the responsible IDE/extension/terminal condition, application root cause, and Savant fix remain unverified.

The active queue is now empty. Reopen 007 only if the behavior recurs in a supported harness with reproducible evidence.

## 2026-08-13 ZTAP implementation closure — FIDs 001–010

The complete Zero-Trust Agentic Provenance P1 wedge was implemented under
automation level 3 and archived on 2026-08-13:

- `FID-2026-0813-001` — provenance master;
- `FID-2026-0813-002` — RED provenance catalog;
- `FID-2026-0813-003` — crypto primitives;
- `FID-2026-0813-004` — write-boundary interception and signed ledger;
- `FID-2026-0813-005` — signature, custody, latency, and mode audit;
- `FID-2026-0813-006` — replay, forgery, staleness, and A1–A11 attack suite;
- `FID-2026-0813-007` — `/attest` JSON/HTML export;
- `FID-2026-0813-008` — clean-process validator and parity audit;
- `FID-2026-0813-009` — read-only event-sourced Trust Matrix; and
- `FID-2026-0813-010` — Trust Matrix fidelity and zero-control audit.

Local evidence recorded in the FIDs includes root typecheck and test-chain
success, ESLint with zero warnings, Prettier, focused suites 30/30, 21/21,
23/23, 11/11, 4/4, and 6/6, plus the pinned verdict-hook sites. Nova's
independent implementation sign-off is requested separately in
`dev/nova/outbox/2026-08-13-fid-2026-0813-001-ztap-implementation-signoff-request.md`.
Nova returned **PASS — implementation independently verified; eligible for operator closure** on 2026-08-13 after reproducing 100/100 focused tests with no blockers. Her audit corrected the FID-004 documentation citation from spawn initiation lines to the actual phase-completion bindings at `spawn-agents.ts:266` and `spawn-agent-inline.ts:169`. The PASS is not release authorization; these are working-tree closure records. The v0.0.23 release itself shipped on 2026-08-12, so this ZTAP wedge belongs to the post-0.0.23 working tree.

## 2026-08-13 housekeeping closure — FIDs 0812-008 and 0812-009

The final two 2026-08-12 queue records were closed and archived on 2026-08-13
after the v0.0.23 public release completed (tag `v0.0.23`, five platform
binaries, and npm `savant-code@0.0.23` shipped 2026-08-12):

- `FID-2026-0812-008` — project-wide production cleanup and release readiness.
  Nova's final implementation audit returned PASS WITH CONDITIONS and every
  closure condition was satisfied by the completed release transaction; a
  closure addendum is appended to the record.
- `FID-2026-0812-009` — unauthorized co-author commit guard
  (`.githooks/commit-msg`). Verified with smoke tests 6/0 and final independent
  review PASS; closed and archived as a completed attribution-guard record.

## 2026-08-13 Agent-Steering Teacher implementation closure — FIDs 011–021

The complete homegrown Agent-Steering Teacher was implemented under the
operator's automation level 3 grant in dependency order and archived on
2026-08-13 after Nova's independent implementation audit returned **PASS —
implementation independently verified; eligible for operator closure** and the
operator approved closure:

- `FID-2026-0813-011` — teacher master (coordination + converged plan);
- `FID-2026-0813-012` — pedagogy contracts (common zod schemas + trust-boundary parsers);
- `FID-2026-0813-013` — capability sandbox (restricted `node:vm` subprocess, honest `not_enforced` report, fail-closed `unavailable`);
- `FID-2026-0813-014` — headless vertical-slice exercise engine (FSM, cancellation/retry/timeout, hash-only evidence);
- `FID-2026-0813-015` — corpus authoring/validation (content-addressed public/private pack split);
- `FID-2026-0813-016` — behavior-first equivalence grader (+ hardcoding signal);
- `FID-2026-0813-017` — deterministic mutation/detection grader (+ calibration);
- `FID-2026-0813-018` — live `/learn` command + read-only overlay;
- `FID-2026-0813-019` — versioned SQLite progression store + honest ZTAP attempt-receipt adapter; and
- `FID-2026-0813-020` — cross-cutting integration/security audit.

`FID-2026-0813-021` (canonical version-bump tool) was closed and archived in the
same batch as a standalone internal-tool record.

Local evidence recorded in the FIDs includes typecheck ×4 PASS, full suites
common 612 and agent-runtime 891 pass / 0 fail, `validate:repository` PASS,
ESLint zero warnings, Prettier clean, `lint:md` clean, and 100 focused teacher
tests across 10 suites. Nova's final audit response — a **PASS** over the
complete scope (base implementation + live `/learn` wiring, per-attempt ZTAP
receipt, progression persistence, and `/learn progress`) — is recorded in
`dev/nova/inbox/2026-08-13-fid-2026-0813-011-teacher-implementation-audit-response.md`.
Three non-blocking notes remain for the release decision: the `node:vm`-in-
subprocess backend is not an OS boundary (honestly `not_enforced`, fail-closed
when a policy requires those dimensions), detection-calibration thresholds are
met by fixtures rather than held-out human data, and an unrelated pre-existing
`lint:md` long-line failure. The PASS is not release authorization; these are
working-tree closure records, and the archive files are not yet tracked by a
commit.

## 2026-08-13 Teacher live sidebar surface closure — FID-022

`FID-2026-0813-022` (teacher live sidebar surface) was closed and archived on
2026-08-13 after Nova's independent planning audit **PASS** and implementation
audit **PASS — implementation independently verified; eligible for operator
closure**, followed by operator approval. The feature mounts the implemented
`LearnOverlay` as a read-only `Teacher` panel in the right sidebar, adds the
`teacherState` zustand slice (mirroring the `provenanceEvents` pattern), fixes
the load-bearing `events: [...events]` snapshot copy in `getTeacherSessionState()`,
extracts shared render helpers into `cli/src/teacher/render.ts`, and enforces a
zero-authority ESLint scope for the teacher UI.

Nova verified all six hard questions at source and re-ran the real teacher/state
suites green (28/28 within her glob). Nova's one residual note — a claim that the
cited `learn.test.ts` was a phantom file — was refuted: the file exists at
`cli/src/commands/__tests__/learn.test.ts` (10/10 pass), and the full focused
count is 38 pass / 0 fail across 5 files. Local evidence includes typecheck ×4
PASS, ESLint zero warnings, Prettier clean, `lint:md` clean, and
`validate:repository` PASS. The audit responses are recorded at
`dev/nova/inbox/2026-08-13-fid-2026-0813-022-teacher-sidebar-surface-planning-response.md`
and
`dev/nova/inbox/2026-08-13-fid-2026-0813-022-teacher-sidebar-surface-implementation-response.md`.

## 2026-08-13 Harness observability & integrity closure — FID-023

`FID-2026-0813-023` (harness observability + integrity remediation) was closed
and archived on 2026-08-13 after Nova's independent planning audit **PASS** and
implementation audit **PASS — implementation independently verified; eligible
for operator closure**, followed by operator approval. The FID covers seven
workstreams: (A) the repo-wide `savantCode$1` rebrand-corruption repair
(15 source sites + CHANGELOG prose) with a fail-closed absence scan and the
restored legacy settings migration + name-based pause-guard contract;
(B) Trust Matrix live/empty-state + disclosure + stable row keys;
(C) the frozen-context-meter fix (no render-time disk I/O, resolved
`contextWindow` for all agent shapes, `contextTokensMax` reset) and the
auto-compact + read-only `Compaction` sidebar row fed by
`packages/agent-runtime/src/run-agent-step/context-tokens.ts`;
(D) Files-Changed counters; (E) the `/help` operator overlay Governance legend;
(F) the `test-env.ts` ratchet reconcile + `.qoder/` gitignore; and (G) the
teacher Forge model-source fix (all agents honor the operator's active model
via `loadSavantCodeModelPreference()`).

Nova verified all 9 hard questions at source and re-ran the workspaces green
(SDK 469/0, common 612/0, agent-runtime 891/0, CLI 3047/0; typecheck ×4,
`validate:repository` PASS, fid-ledger 5/5, `savantCode$1` scan 0). Two
reporting items were reconciled in the closure record: Nova's initial "101 SDK
fail" was a measurement error (repo-root glob bleed into
`resources/freebuff-main/`) and was retracted — the scoped SDK suite is 469/0;
and the compaction-path citation in the request was corrected to the real
`packages/agent-runtime/src/run-agent-step/context-tokens.ts`. The teacher-
driver headless assertion is agent-verified + Nova source-verified, not
Nova-executed (command guard). Audit response:
`dev/nova/inbox/2026-08-13-fid-2026-0813-023-harness-observability-integrity-implementation-response.md`.
The PASS is not release authorization; this is a working-tree closure record,
and the archive file is not yet tracked by a commit.

## Archive invariants

The FID-2026-0811-004 master program and children 005–014 are present as untracked working-tree artifacts with untrusted historical closure claims; they are not certified repository closure evidence and remain untouched pending explicit operator disposition. The separate FID-2026-0811-015–021 remediation package was implemented, independently audited by Nova with **PASS — implementation approved for closure**, transitioned to `closed`, and archived on 2026-08-11. The FID-2026-0811-022–029 LEARNINGS feedback-system remediation package was implemented and locally verified under automation level 3, transitioned to `closed`, and physically archived in this working tree on 2026-08-11; the archive files are not yet tracked by a commit, so durable certification remains pending. Its Nova implementation sign-off is requested in a separate audit-channel record. The implementation entries are recorded in `CHANGELOG.md`; v0.0.23 itself remains pending and unreleased.


- A closed FID is moved here only after implementation and verification evidence
  is recorded and a CHANGELOG entry exists.
- Historical content and filenames are preserved. Older records may use legacy
  status wording such as `fixed`, `verified`, or `complete`; do not mass-rewrite
  those records.
- Duplicate historical IDs are intentional legacy collisions. Always reference
  the full filename when the numeric ID is ambiguous.
- If an archived record is discovered with stale lifecycle metadata, add a
  corrective note or index entry rather than rewriting its historical evidence.

## Legacy status exception

Some older archived records predate the current closure gate and retain statuses
such as `created`, `fixed`, `verified`, or transition prose even though the file
was archived as a historical release record. For example,
`FID-2026-0806-016-v0.0.21-post-audit-fix-batch.md` retains its original
`created` metadata. This is documented drift, not a current active-FID claim;
do not mass-rewrite the historical record.

## 2026-08-09 operator-accepted records (corrective index)

The following archived records retain non-closed status metadata
(`implemented`, `fixed`, `analyzed`, or `verified`) with review boundaries that
were never formally closed. On 2026-08-09 the operator **waived** those remaining
boundaries and accepted the records as historical, matching their physical
archive placement. They are not an active work queue; do not resurrect them as
open FIDs without operator direction.

| FID | Stated status | Waived boundary |
|---|---|---|
| `FID-2026-0806-017-graph-export-performance-precomputed-layout.md` | implemented | pending operator push/closure language |
| `FID-2026-0806-018-graph-export-visible-overview-fit.md` | fixed | pending operator decision |
| `FID-2026-0807-001-spatial-knowledge-graph-experience.md` | analyzed | proposal/analysis (superseded by 0807-002) |
| `FID-2026-0807-002-code-universe-webgl-renderer.md` | implemented | GPU visual audit NEEDS-REVIEW |
| `FID-2026-0807-003-graph-universe-post-click-navigation-and-comet-physics.md` | fixed | browser click persistence review |
| `FID-2026-0807-004-code-universe-hierarchical-browser-and-document-view.md` | implemented | browser runtime review |
| `FID-2026-0807-005-offline-graph-initialization-and-loader-failure.md` | fixed | browser runtime review |
| `FID-2026-0807-006-code-universe-document-and-image-viewer.md` | verified | browser runtime review |

`FID-2026-0808-001-reversible-public-release-pipeline.md` is genuinely closed
(2026-08-09 operator-directed close with Nova sign-off). The active queue is
[`../`](../); its reconciliation record is in [`../README.md`](../README.md).

## 2026-08-16 audit — legacy-status stragglers indexed (no rewrite)

Audit of `archive/` (2026-08-16) found the following records still carrying
non-closed or absent status metadata. Per the **Legacy status exception**
above, this is documented drift, not an active-FID claim — they are physical
archive members and are **not** part of the active queue. Indexed here for
consistency; the historical files were **not** rewritten (per the convention,
add a corrective note rather than rewriting historical evidence).

| FID | Stated status | Note |
|---|---|---|
| `FID-2026-0806-016-v0.0.21-post-audit-fix-batch.md` | created | legacy release record (named in the exception paragraph) |
| `FID-2026-0807-008-code-universe-polish-batch.md` | verified | pre-gate legacy wording |
| `FID-2026-0807-009-code-universe-document-view-polish.md` | `analyzed` → operator-approved → implemented | closed by operator directive per its own record |
| `FID-2026-0807-010-code-universe-sidebar-drilldown.md` | (none — old format) | `Phase: … COMPLETE` header; historical |
| `FID-2026-0807-011-code-universe-ui-polish-and-identity-cleanup.md` | (none — old format) | `Phase: … COMPLETE` header; historical |
| `FID-2026-0807-014-code-universe-qc-polish-pass.md` | complete | operator-approved; implemented + verified 2026-08-07 |
| `FID-2026-0807-019-graph-export-sidebar-responsive-document-budgets.md` | implemented | pre-gate legacy wording |
| `FID-2026-0807-020-code-universe-architecture-evaluation.md` | implemented | pre-gate legacy wording |

The active queue is [`../`](../). The current `/dev` lifecycle audit is recorded in
[`../README.md`](../README.md); the historical cleanup FID remains
[`FID-2026-0807-016-dev-folder-and-fid-hygiene.md`](FID-2026-0807-016-dev-folder-and-fid-hygiene.md).

`FID-2026-0811-030-loadable-design-system-skill-library.md` was closed and archived on
2026-08-11 after implementation, focused verification, all-wrapper packaging evidence,
and an independent PASS review. Its extensive product documentation is maintained at
[`docs/design/design-system-library.md`](../../../docs/design/design-system-library.md).
The documentation-and-implementation sign-off request remains an explicit independent
review boundary for the current working-tree evidence; no release or publication was
performed.
