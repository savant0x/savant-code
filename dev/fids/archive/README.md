# Archived FIDs

This directory contains closed or historically completed FIDs. Files here are
an audit record, not an active work queue.

## 2026-09-02 closure — deck + desktop session FIDs (release-ready audit batch)

Seven FIDs closed + archived by the 0.0.29 release-ready audit (all gate
receipts re-stamped PASS at their new paths via `bun run fid:verify … --write`;
statuses corrected to the honest implemented state; ledger README table
updated):

- `FID-2026-0828-002-deck-live-fidelity.md` (high) — defect B fixed
  (emissive/body-base/palette); defects C/D superseded by the 0831 rebuild.
- `FID-2026-0829-001-deck-visual-activity.md` (critical) — six activity
  layers + lane-alignment fix; superseded surface replaced by 0831 rebuild.
- `FID-2026-0831-001-deck-rebuild-neon-noir-office.md` (high) — R3F
  neon-noir office rebuild P0–P3; live smoke discharged by operator.
- `FID-2026-0831-002-deck-office-visual-correction.md` (critical) — office
  correction passes P4–P8 (robot cast, accents, heading, beacons).
- `FID-2026-0901-001-sidecar-env-and-sdk-client-init.md` (critical) —
  sidecar env forwarding + SDK client init; operator live use confirmed.
- `FID-2026-0901-003-deck-ambient-life-interaction.md` (medium) — six
  ambient-life features + P9 obstacle routing.
- `FID-2026-0901-006-desktop-cli-ui-parity.md` (medium) — 36-pass desktop
  CLI-parity program (timestamps, model, context window, bubbles, traffic
  lights, FID queue initial sync, scratchpad auto-management, mini-chat
  island, connectOnce boot fix).

Also 2026-09-02: `FID-2026-0824-028/-030` forbidden `**Author:**` attribution
fields removed (fid.policy.attribution) and receipts re-stamped; archived
`FID-2026-0822-013` superseded steps given explicit
`deferred::operator-approved 2026-08-23` markers (fid.steps.unresolved).

## 2026-08-27 closure — FID-2026-0827-001 (sidebar context readout stalls near zero in the small-count regime)

`FID-2026-0827-001-sidebar-context-readout-damping-small-count-stall.md` (severity: medium)
closed + archived 2026-08-27 by operator directive. Operator-reported "context stuck at 0/x"
during a live session with the denominator correctly resolved to the real ~1M window. Root
cause: `dampTokenCount` (display-only damper from FID-2026-0821-003-A) applies a relative
±5% deadband + 12% max-step ramp against the currently displayed value, so a small
early-session count against a large window reads ~0 for a long stretch. Fix: NEW
`CONTEXT_TOKEN_SMALL_COUNT_FLOOR = 10_000` in `cli/src/state/chat-store/compaction-helpers.ts`
— counts ≤ the floor (and any transition out of zero) are adopted exactly; deadband/ramp
unchanged above the floor. 2 regression tests in `chat-store-noop-guards.test.ts` (small-count
exact adoption; below-floor replacement). Gates: cli typecheck exit 0 · suite 12 pass / 0
fail · eslint/prettier/markdownlint clean · Verifier audit PASS (4/4). Receipt re-stamped at
the archived path `sha256:787cb606...2402` (2/2 declared gates live PASS) after `### Perfection
Loop` was promoted to `##` per the fid-verification parser contract (gate section window runs
to the next level-2 heading); repo-wide `fid:verify --check` sweep PASS. Live visual-meter
confirmation = operator boundary, recorded, never claimed passed.

## 2026-08-25 closure — FID-2026-0820-010 Chat UI and Auto Drive dashboard

`FID-2026-0820-010-chat-ui-structured-no-terminal.md` is closed and archived
after the structured no-terminal desktop chat surface was completed. The
implementation includes bounded transcript virtualization, structured
verification output, diff/phase/approval/EHEL/compaction visuals, scoped FID
queue state, and the Auto Drive dashboard with authoritative lifecycle counts,
deterministic parent-child graph projection, and gateway-driven emergency-halt
feedback. Verification: common/CLI/desktop typechecks, scoped desktop suite
229/0 across 39 files, CLI loader/gateway coverage, ESLint, Prettier, renderer
production build, Tauri `cargo check`, and live compiled sidecar E2E 4/0.
Interactive Tauri/WebView visual review remains an operator-owned boundary and
is not claimed as automated evidence.

## 2026-08-25 closure — FID-2026-0824-009 Workspace Regions

`FID-2026-0824-009-workspace-regions-roster-and-thread-duality.md` is closed and archived after the desktop workspace gained the canonical roster rail, project/global scoped thread persistence, read-only scoped history hydration, persisted unread/pin state, and the formal project-scoped `fid_update` amendment. The gateway derives one stable project-root identity, returns it during hello, and emits it on every FID lifecycle event; Project views filter by exact identity while Fleet retains the aggregate stream. Verification: common/CLI/desktop typechecks, CLI gateway suite 25/0, desktop suite 199/0, live sidecar E2E 4/0, renderer build, Tauri `cargo check`, drift guard, ESLint, and Prettier. Interactive WebView visual validation was waived as an operator-only boundary and is not claimed as automated evidence.

## 2026-08-25 closure — FID-2026-0806-017/-018 historical status normalization

`FID-2026-0806-017` and `FID-2026-0806-018` are now normalized to `closed`.
Their implementation, verification, operator-accepted historical disposition,
and archive placement were already documented; this change reconciles stale
`implemented`/`fixed` headers without claiming additional live evidence.

## 2026-08-25 closure — FID-2026-0824-020/-021 root-cause reconciliation

`FID-2026-0824-020` (subagents inherit compacted history, high) and
`FID-2026-0824-021` (compaction summary data loss and invisible layers, high)
were reconciled and closed after their implementation was delivered by the
compaction integrity rebuild suite `FID-2026-0824-022` and children `-023` through
`-027`. The root-cause records now link to the implementation and verification
evidence without duplicating the fix. The suite's explicitly waived live-smoke
boundaries remain documented as waived, never passed.

## 2026-08-25 closure — FID-2026-0825-001 (/compact "No response from agent" after a prior compaction)

`FID-2026-0825-001-compact-and-stop-no-response-error.md` (severity: high) closed +
archived 2026-08-25 after the operator confirmed the live fix. Manual `/compact` takes the
serialized savant interceptor's compact-and-stop path (zero assistant turns);
`getAgentOutput` treated a zero-assistant-message history as
`{type:'error','No response from agent'}` (`util/agent-output.ts:87`), rendered via setError
— deterministic right after any prior successful compaction, plus a stale-turn echo
otherwise. Fix: one-shot `AgentState.compactAndStop` flag stamped by the interceptor,
wiped at loop start, consumed at output assembly to emit an explicitly empty lastMessage
(success). Bundle regenerated; all 13 savant chunks carry the stamp. Gates: root typecheck
×12 exit 0 · eslint/prettier clean · Verifier audit PASS with residuals discharged
(repo-wide grep 0 matches; headless-run extractFinalAnswer tolerant). Receipt re-stamped on
the closed content sha256:8f4b14ba…43ea6 (`--write` + `--check` PASS). Closed from the
uncommitted working tree per operator directive (commit remains a separate action).

## 2026-08-24 closure — compaction integrity rebuild suite (-022 master + -023..-027)

All five children implemented, gated (typechecks cli/agents/agent-runtime/common
exit 0; suites 18/0 · 37/0 · 43/0 incl. seeded fuzz · 4/0 · 3/0), receipt-stamped
(`fid:verify --check` green each), batched Verifier+Adversary closure audit PASS,
and CLOSED 2026-08-24 via operator live-smoke WAIVER directive (never claimed
passed): `FID-2026-0824-022-compaction-integrity-rebuild-master.md` (high,
coordination master) · `-023-compaction-visibility-transparency-layer.md` (high;
receipt 4f3ad082) · `-024-compaction-preservation-contract-digest-schema.md`
(high; fef329e5) · `-025-compaction-minimal-surgery-algorithm.md` (medium;
cce77973) · `-026-evidence-spill-subagent-raw-splice.md` (high; cde6df3d) ·
`-027-removed-content-ledger-metrics-model-notice.md` (medium; bc5b3566).
Resolves FID-2026-0824-020/-021 root causes (compacted-history inheritance;
drop-list digest + invisible compaction layers). Carried NEEDS-REVIEW (waived):
TUI phase-rendering smoke, /compact run, verifier raw-citation probe.
Post-closure addendum: stream-routing + `lastCompactionReport` surfacing in
CompactionSignal landed 2026-08-24 (see `-023` GREEN AMENDMENT trail);
live-smoke waiver unchanged.

## 2026-08-24 closure — FID-2026-0824-031 (Forge Law-1 deadlock — read_files granted + forced protocol grounding)

`FID-2026-0824-031-forge-law1-read-deadlock-existing-file-edits.md` (severity: high)
closed + archived 2026-08-24. Forge could not satisfy EHEL Law 1 on existing-file edits:
toolNames omitted read_files so the per-child tracker never registered a read (10 blocked
attempts in one live spawn during FID-2026-0824-029; new-file creation worked only via
isNewFile). Fix (Remedy A): toolNames += read_files; prohibition prompt replaced with a
Read-before-edit mandate; PLUS operator-directed forced grounding — handleSteps yields
`read_files ECHO.md` programmatically before the model's first turn; tier-accurate law
wording (Laws 1-4 unconditional / 5-15 strict-only); roster sweep in ECHO.md +
ARCHITECTURE.md; bundle regenerated. Scope-expanded model audit: VERIFIED INTACT —
withParentModel unconditionally overrides child.model with parent.model on both spawn
paths, zero inheritParentModel:false opt-outs remain (gemini thinkers inherit; alive
Free-tier reasoners, misnamed only). Gates: typecheck agents+cli exit 0 · sdk
validate-agents-part-a 7/0 · eslint forge.ts exit 0 · markdownlint ECHO.md/ARCHITECTURE.md
clean · receipt stamped sha256:7b87046a (3/3 gates live PASS + check-mode PASS). Verifier
AUDIT PASS. Carried NEEDS-REVIEW (waived per operator archive directive):
restart-gated live probe (read→edit flow; unread-file still blocks; ECHO.md read credits
tracker). Deferred: remedy B (history-derived read credit).

## 2026-08-24 closure — FID-2026-0824-029 (adversarial verdict / structured output markdown formatting)

`FID-2026-0824-029-adversarial-verdict-output-markdown-formatting.md` (severity: medium)
closed + archived 2026-08-24. The Adversary agent's verdict output rendered as a wall of
unformatted bold text inside the correct TrafficLightPanel chrome: every string leaf in the
structured-card layer flattened through `scalarToDisplayString` → `String(value)` while the
ChatTheme-aware `renderMarkdown` (`cli/src/utils/markdown-renderer.tsx`) sat unused one
directory over. Fix (operator-approved Approach A): NEW `structured-card/rich-text.tsx` —
conservative `isRichTextCandidate` gate (newline | code fence | line-starting block syntax)
+ a `RichTextValue` dual-branch component routing candidates through
`renderMarkdown(value, { theme })` with byte-stable legacy fallbacks; wired at every
scalar-leaf exit (KeyValueRow value cell, SuccessCard message, RecordCard non-object +
NestedItems scalars, ListCard bullet text, ErrorCard scalar branch + errorMessage). All
`set_output` payloads AND ~13 OutputResultComponent-aliased tools inherit the fix. Gates:
cli typecheck exit 0 · focused suites 82 pass / 0 fail across 7 files · eslint --max-warnings
0 · prettier clean · fid:verify receipt stamped (5/5 gates live PASS, check-mode PASS).
Verifier PASS ×7; Adversary STANDS (6 CONFIRMED / 1 ADJUSTED discharged). Carried
NEEDS-REVIEW: live TUI smoke of a real verdict card. Harness flags recorded in Lessons
Learned: Forge lacks read_files (permanent Law-1 deadlock editing existing files);
root-cwd bun test filters collide with vendored resources/freebuff-main copies.

## 2026-08-23 closure — FID-2026-0823-012 (Recorder corrective retry ladder)

`FID-2026-0823-012-recorder-corrective-retry-ladder.md` (severity: medium)
closed + archived 2026-08-23 by operator directive ("close and archive ...
after an operator visual pass of a retried spawn"). Implemented the -008-
guard-aware corrective retry ladder: RECORDER_STALL_RETRY_LIMIT (=1) +
buildRecorderRetryPrompt in recorder-stall-check.ts; bounded retry loop on a
fresh child state in spawn-agents.ts with stalled-attempt credit merge;
post-run relay guard unchanged as the single outcome authority. Gates:
agent-runtime typecheck exit 0; focused suites 16 pass / 0 fail; eslint
--max-warnings 0 ×4 files; fid:verify receipt stamped (3/3 gates PASS);
Verifier AUDIT FAIL discharged before closure (limit constant wired into
control flow). Live CLI-smoke boundary waived by the close directive —
never claimed passed. Working-tree archival (release-only-commits
convention).

## 2026-08-23 closure — closure pass: four `fixed` FIDs archived (operator directive)

Four records closed + archived 2026-08-23 by operator directive ("close all
4 fixed"); each carried live-verification/operator boundary was waived by
the close directive (FID-2026-0823-005 waiver precedent) and recorded as never claimed passed.
Working-tree closures (release-only-commits convention).

- **FID-2026-0820-009** (`tauri-shell-sidecar-supervisor`, critical) —
  all 8 steps implemented Loops 2–4; gates green (desktop bun 19/0 incl.
  live real-sidecar E2E 4/4; cargo 14/0). GUI live-smoke boundary waived.
- **FID-2026-0822-014** (`structured-output-cards`, medium) — semantic
  cards replaced the YAML display fallback; export bytes pinned; suites
  50/0. Production-TUI-smoke boundary waived.
- **FID-2026-0823-004** (`process-agent-defs-drop-handlesteps`, critical)
  — processor preserves string handleSteps; regression net + offline e2e
  probe PASS + live basher echo-probe PASSED post-restart. Residual probe
  boundary waived.
- **FID-2026-0823-007** (`laws-1-4-universal-hard-block`, high) — Law 1/
  Law 4 gates unconditional across tiers; contract-flip + new coverage
  (65/0/142). Live-HYBRID-confirmation boundary waived.

## 2026-08-23 closure — FID-2026-0823-015 (Law-1 path-form mismatch + undefined yield keys; was -009)

`FID-2026-0823-015-law1-path-form-mismatch-and-generator-undefined-yields.md`
(severity: critical) closed + archived 2026-08-23. Fixed the spurious Law-1
blocks (path-form canonicalization at both gate boundaries) and the
generator crashes on undefined yield keys (deep-clean sanitizer before yield
validation), with cross-form + never-read-control + crash-site integration
regression nets. fid:verify receipt stamped (typecheck + 3 focused suites,
4/4 PASS). Live probes post-restart: Detective and Orchestrator probes
PASSED; the Recorder UPDATE stall persisted post-fix (residual follow-up);
closure via direct Hybrid-mode writes per operator directive. Duplicate
record at -010 deleted same day (interrupted-turn artifact).

**Renumbered 2026-08-24** (operator de-duplication directive):
`FID-2026-0823-009-law1-…` → `FID-2026-0823-015-law1-…`, clearing the
same-day numeric collision with
`FID-2026-0823-009-fid-verification-gates-enforcement.md` (which keeps
-009; created 16:05 vs this record's 18:28). Receipt fingerprint predates
this identity-only rename.

## 2026-08-23 closure — FID-2026-0822-013 (master completion plan — SUPERSEDED)

`FID-2026-0822-013-master-completion-plan.md` (severity: high) closed +
archived 2026-08-23 as **SUPERSEDED** by `FID-2026-0823-003`
(overnight queue-to-zero master), whose Summary states: "This master
supersedes FID-2026-0822-013 as the queue-to-zero coordinator." The record's
own sequencing substantially executed before supersession: Track B drained in
full (-0821-004, -0822-004, -0822-008, -0822-007 all closed + archived
2026-08-22), Track A step 1 closed + archived (-008) with step 2 at `fixed`,
deck fixtures landed via -003/U7 (8/0), ratchet HOLD honored throughout.
Open items (-010 close, -011 operator-gated close, final queue-at-zero) are
live rows in FID-2026-0823-003's Step Status — not silently dropped.
Working-tree archival (release-only-commits convention).

## 2026-08-23 closure — FID-2026-0823-005 (edit line-count + chrome unification)

`FID-2026-0823-005-diff-line-count-format-and-chrome-unification.md`
(severity: low) closed + archived 2026-08-23. Operator-directed unification
of the Edit line-count display: `formatDiffCountSide` + `formatDiffCounts`
added to `cli/src/utils/diff-stats.ts` (pair delegates to the per-side
helper — one concatenation site); `DiffViewer` header + `DiffStatsBar`
footer both render `+N -N` (ASCII, added-first, no wrapper); `DiffViewer`
outer chrome migrated to the shared `TrafficLightPanel` (dual old/new
gutter, sign column, neon tinting, hunk bars preserved); `CompactFileStats`
bars + width math routed through the per-side helper (byte-identical). Zero
`[-N/+M]`/`\u2212` residue across `cli/src` incl. comments. Gates: cli
typecheck exit 0; full cli suite 3320 pass / 18 skip / 0 fail (9181
expects); focused 145/0; eslint --max-warnings 0; prettier clean; ledger
probe 0. Working-tree closure (release-only-commits). Carried
live-TUI-smoke boundary waived by the operator's close directive
2026-08-23.

## 2026-08-23 closure — FID-2026-0820-008 (desktop session gateway)

`FID-2026-0820-008-desktop-session-gateway.md` (severity: critical) closed and
archived 2026-08-23. New `savant-code server` subcommand ships the frozen v1
localhost WebSocket sidecar contract (`GATEWAY_PROTOCOL_VERSION=1` hello
handshake, reserved error codes -32001..-32004 / -32600..-32603, env-only
`SAVANT_GATEWAY_TOKEN`, Origin/Host allowlist enforced server-side,
single-session model, fail-closed approvals via AskUserBridge, ~50ms event
batches as JSON-RPC `event` notifications wrapping batch arrays, stdin-close
watchdog extracted to light `cli/src/server/stdin-watchdog.ts` with public
re-export preserved). Closure blocker fixed: spawned-child crashes under
full-suite load were traced via append-to-disk probes to an env-restore leak
(`process.env.X = undefined` coerces to the string "undefined") in
use-usage-query.test.ts — now delete-on-unset; child-spawn tests hardened
fail-fast with captured stderr/stdout diagnostics. Gates: full cli suite 3316
pass / 18 skip / 0 fail exit 0; cli/common/agent-runtime typecheck exit 0;
eslint --max-warnings 0 on touched files; prettier clean; Verifier AUDIT PASS
(all five items). Working-tree closure (release-only-commits convention).
Unblocks FID-2026-0820-009 (Tauri sidecar supervisor gateway E2E).

## 2026-08-22 closure — master-plan Track B (automation level 3): 4 implementables archived

- **FID-2026-0822-007** (`hex-hardcoding-theme-token-migration`) — 27/27
  hex sites in production components migrated to ChatTheme tokens: badge
  10-variant tone map → semantic tokens, ask-user pair →
  `inputFocusedFg`/`onPrimary`, diff bars → new `diffBarAdded`/
  `diffBarRemoved` palette tokens (both themes), dialog backdrop +
  transition-phase onFill anchors → promoted constants in
  utils/ui-constants.ts. Zero-hex gate green over components/ (single
  documented terminal-status-utils carve-out kept). Full cli suite
  3295/0. Closed 2026-08-22.

- **FID-2026-0821-004** (`execute-tool-calls-result-plumbing`) — D1 stale
  shared-array return fixed: `executeSingleToolCall` now slices only its own
  call's results from the cumulative `toolResults` array, so a silently-
  blocked yield receives `[]` instead of a prior call's output; D2
  re-verified (claimed-silent write/sandbox gate edges actually emit error
  chunks internally — record corrected); D3 confirmed covered by the
  0821-005 A8 relay test. NEW D1 regression test (RED-first verified).
  agent-runtime suite 1194/0. Closed 2026-08-22.

Operator granted automation level 3 on 2026-08-22 ("proceed through all
pending fids following the master plan"). Track B order-free implementables
were executed first (no deps, self-contained, verified against existing
suites). Both are working-tree closures (release-only-commits convention).

- **FID-2026-0822-008** (`edit-diff-zero-counts-raw-content-fallback`) —
  `extractDiff` fallback now `+`-prefixes raw content so unparseable diffs
  report real change counts instead of `[-0/+0]`; defense-in-depth
  zero-change footer suppression in apply-patch + str-replace components;
  107/0 focused suite. Closed 2026-08-22.
- **FID-2026-0822-004** (`yagni-check-block-leaks-unparsed`) —
  `<yagni_check>` scaffolding never reaches the transcript or written files:
  streaming stripper at the `emitCommittedText` ingestion boundary
  (chunk-split-safe), YAGNI gate now consumes the assistant-TEXT channel
  (payload first, then text) + honors `yagni.enforced: false`, write-payload
  sanitization between gate and handler, Forge prompt aligned to the text
  contract. agent-runtime suite 1193/0. Closed 2026-08-22.

## 2026-08-22 closure — operator-directed batch: 8 fixed FIDs archived (live-verification boundaries waived)

Operator directive 2026-08-22 ("archive the completed ones"): eight `fixed`
FIDs whose implementation landed and whose gates are green were closed and
archived in one pass. Each FID's remaining live-verification boundary
(operator smoke / natural-event observation) was operator-waived with the
directive and is carried on the active ledger's observation list so it cannot
silently drop. All eight are working-tree closures (release-only-commits
convention).

- **FID-2026-0820-012** (`ehel-law3-verification-tracker-false-positive`) —
  EHEL Law-3 tracker deadlock fix with regression coverage (suite 20/0,
  36 expect(); AUDIT PASS 2026-08-21). Closed 2026-08-22.
- **FID-2026-0820-013** (`subagent-spawn-model-message-conversion`) — spawn
  ModelMessage conversion fixed + live-verified (Rounds 3/4); success-path
  relay chain verified at HEAD. Residual result-plumbing defects remain
  tracked in active FID-2026-0821-004. Closed 2026-08-22.
- **FID-2026-0821-005** (`basher-relay-and-ripgrep-vendoring`) — WS-B
  deterministic ripgrep vendoring (B1–B6) + WS-A basher relay hardening
  (A8/A10). A9 live-path diagnosis carried as observation. Closed 2026-08-22.
- **FID-2026-0822-001** (`compact-pipeline-root-causes`) — /compact dead
  intercept + auto-compact no-op loop: five root causes (RC1–RC5) fixed;
  bundled agents regenerated; registry-gating parity flipped green. Live
  re-test carried on the observation list. Closed 2026-08-22.
- **FID-2026-0822-002** (`step-loop-runaway-guards`) — anti-runaway guards v1
  (repeated-tool-call ×4 / consecutive-error ×5 / think-only ×3) in a pure
  module wired at the runAgentStep boundary; 12-case unit suite. Live
  confirmation carried. Closed 2026-08-22.
- **FID-2026-0822-003** (`turn-never-ends-step-loop`) — post-terminal breaker
  (N=6, Auto Drive carve-out, enforcement surrender) + wiring-proof
  integration tests; 26/26 targeted + part-a 11/11 + part-b 4/4. Live
  confirmation carried. Closed 2026-08-22.
- **FID-2026-0822-010** (`reasoning-panel-midword-clipping`) — Thinking
  preview width model fixed (panel chrome allowance + ellipsis marker in
  `getLastNVisualLines`); 61/0 focused suites. 90-col scroll repro carried.
  Closed 2026-08-22.
- **FID-2026-0822-011** (`post-unification-display-gaps`) — read_files
  framed, add_message registered (new AddMessageComponent), Thinking
  converted to TrafficLightPanel chrome; per-component suites green.
  Expanded-state confirmation + sidebar overlap carried. Closed 2026-08-22.

## 2026-08-21 closure — FID-2026-0821-008 (sequentialthinking header-only rendering)

`FID-2026-0821-008-sequentialthinking-header-only.md` (severity: low) closed
and archived 2026-08-21. The Thinker's `sequentialthinking` tool had no
renderer, so each reasoning step rendered header-only inside the Thinker's
agent branch via the generic collapsed fallback. Fixed by registering a new
`SequentialThinkingComponent` (`cli/src/components/tools/sequential-thinking.tsx`)
that renders `input.thought` inline as markdown with a `💭 Thought N/M` /
`↩️ Revising thought #k` / `· branch <id>` label and a one-line
`collapsedPreview`, wired at `registry.ts:19,77`. Gates: cli typecheck clean;
sequential-thinking.test.tsx 3/3; eslint 0 warnings. Working-tree closure
(uncommitted).

## 2026-08-21 closure — FID-2026-0821-007 (output-carrying tools header-only rendering)

`FID-2026-0821-007-output-carrying-tools-header-only.md` (severity: low) closed
and archived 2026-08-21. Fourteen result-bearing tools (`deep_research`,
`find_files`, `list_tables`, `describe_table`, `execute_query`, `analyze_query`,
`lookup_agent_info`, `query_blast_radius`, `query_domain_clusters`,
`query_node_edges`, `ponytail_debt`, `run_file_change_hooks`, `get_goal`,
`browser_logs`) had no renderer and rendered header-only via the generic
collapsed fallback. Fixed by a shared `OutputResultComponent`
(`cli/src/components/tools/output-result.tsx`) that renders the formatted
`output` expanded with a one-line collapsed preview, aliased to all 14 names in
`registry.ts:80-93`. `end_turn`/`task_completed` were excluded (empty input,
content already rendered); `think_deeply` excluded (dead — not in any agent's
`toolNames`). Gates: cli typecheck clean; output-result.test.tsx 4/4; eslint 0
warnings. Working-tree closure (uncommitted).

## 2026-08-21 closure — FID-2026-0821-006 (set_output header-only rendering)

`FID-2026-0821-006-set-output-rendering.md` (severity: medium) closed and
archived 2026-08-21. `set_output` rendered only the box-drawing header
(`┌─ Set Output ─┐`) and a bare `}` because it had no dedicated renderer — the
generic fallback collapses by default and previews the last line of the JSON
*input*, while the runtime handler stores the real payload in the tool-call
input and returns only `{ message: 'Output set' }`. Fixed by registering a new
`SetOutputComponent` (`cli/src/components/tools/set-output.tsx`) that extracts
the payload (mirroring the handler's `data` unwrap) and renders it expanded as
a YAML code block, and by removing `set_output` from the
`COLLAPSED_BY_DEFAULT_TOOL_NAMES` list. Gates: cli typecheck clean;
`set-output.test.tsx` 4/4; eslint 0 warnings on changed files; call-graph grep
(registry wiring + empty collapse list). Working-tree closure (uncommitted).

## 2026-08-21 closure — FID-2026-0821-002 (release-engine hardening)

`FID-2026-0821-002-release-engine-hardening.md` (severity: medium) closed and
archived 2026-08-21. Three hardening items from the v0.0.27 release: (P1)
concurrent-writer detection — post-commit worktree fingerprint, `IN-PROGRESS.md`
lock-dir marker, and a `dev/`-sweep warning in the automation commit; (P2)
failed-run local-only tag auto-prune (remote-absent + failed-receipt-ownership
guards, fail-closed otherwise); (P3) credential-scan source-file carve-out —
source files named `credentials*`/`secrets*` are content-scanned instead of
filename-blocked, replacing the 3-file allowlist. Gates: public-release.test.ts
56/0, pre-push-scan.test.ts 17/0, eslint 0, prettier clean, lint:md PASS.

## 2026-08-19 closure — FID-2026-0819-002 (research tools restored in direct-provider mode)

`FID-2026-0819-002-research-tools-nonfunctional-in-direct-provider-mode.md`
(severity: high) closed and archived 2026-08-19. `read_docs`, `web_search`,
and `deep_research` were dead in direct-provider mode (the default
release-binary boot mode) because they routed exclusively through the
SavantCode backend web API, which short-circuits there.

Fix: research is decoupled from `DIRECT_PROVIDER` behind a swappable adapter
(`research-sources.ts`). `web_search` ships a keyless Qwant + DuckDuckGo port
(default, zero keys) plus BYOK Serper/Parallel/Tavily/Exa/Firecrawl facades;
`read_docs` ships keyless search-and-fetch plus a self-populating local SQLite
FTS5 docset cache (`~/.savant-code/docsets/`, 7-day TTL, keyless npm/PyPI/
crates.io/RubyGems/Go version detection, `ecosystem` pinning) plus BYOK
Context7; `deep_research` inherits via its injected `SearchFn`. BYOK keys are
entered via `/research-keys <service>` (masked, saved to `credentials.json`
under `researchApiKeys`, applied at boot) or as `SERPER_API_KEY` /
`CONTEXT7_API_KEY` / `PARALLEL_API_KEY` / `TAVILY_API_KEY` / `EXA_API_KEY` /
`FIRECRAWL_API_KEY` env vars.

Gates (all exit 0): typecheck ×4; agent-runtime 1103 pass / 0 fail; CLI 3242
pass / 0 fail (18 skip); eslint (changed files) clean; prettier clean;
Law-4 call-graph grep. Docs updated (`.env.example`, `docs/features.md`,
`docs/installation.md`, `docs/faq.md`, `docs/index.md`, `README.md`,
`README.zh-CN.md`). Closed + archived 2026-08-19.

## 2026-08-19 closure — FID-2026-0819-001 (cumulative verification tracking)

`FID-2026-0819-001-cumulative-verification-tracking.md` (severity: medium)
closed and archived 2026-08-19. Replaced the edge-triggered boolean
verification latch (`verifiedAfterLastWrite` in `EchoComplianceTracker`,
`hasVerifiedSinceLastDirty` in `EchoEnforcement`) with cumulative per-write
`verified` state: each write carries its own flag, a verification command
credits ALL currently-unverified writes (never revoked by later writes), and
turn-end evaluation flags only the specific files that are genuinely
unverified. Also fixes RED-002/RED-003/RED-012: the enforcement layer now uses
the shared `detectsVerificationCommand` as the single source of truth and
handles both `run_terminal_command` and `run_readonly_command`.

Gates (all exit 0): agent-runtime typecheck; 1057 pass / 0 fail (3 new
cumulative-behavior cases in echo-compliance). Closed + archived 2026-08-19.

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

## 2026-08-18 closure — Auto Drive children 002–008 + docs 010 (operator-directed batch archive)

Seven Auto Drive child FIDs and the docs/FAQ FID closed and archived
2026-08-18 by operator direction ("move the completed ones"). Each record
carries the FID-2026-0817-005 Step Status inventory with **every step
`[x]`** — code + unit tests green, no unresolved steps, no silent deferral.
The two program-level `blocked::` live-smoke steps — **master
`FID-2026-0818-001` step 8** (live `/auto` smoke) and **`FID-2026-0818-009`
step 5** (live Discord smoke) — were confirmed by the operator 2026-08-18
and closed + archived the same day (next section).

| FID | Scope | Step inventory |
|---|---|---|
| [`FID-2026-0818-002`](FID-2026-0818-002-drive-mode-entry.md) | drive-mode entry: `/auto-drive` + interview + approval + input lock | 9/9 `[x]` |
| [`FID-2026-0818-003`](FID-2026-0818-003-decomposition-engine.md) | decomposition engine: spec → master + child FID backlog | 6/6 `[x]` |
| [`FID-2026-0818-004`](FID-2026-0818-004-drive-loop-supervisor.md) | drive-loop supervisor: queue, phase-evidence, transition driving, archive | 8/8 `[x]` |
| [`FID-2026-0818-005`](FID-2026-0818-005-self-healing-ladder.md) | self-healing ladder: failure routing + Run Log | 7/7 `[x]` |
| [`FID-2026-0818-006`](FID-2026-0818-006-completion-certification.md) | completion certification: goal-conformance + gap loop | 6/6 `[x]` |
| [`FID-2026-0818-007`](FID-2026-0818-007-observability-long-session-bounds.md) | observability + long-session bounds: sidebar, Esc, compaction, trims, `/export` | 8/8 `[x]` |
| [`FID-2026-0818-008`](FID-2026-0818-008-headless-cli-mode.md) | headless CLI mode: `--auto` + approval + exit codes + resume | 8/8 `[x]` |
| [`FID-2026-0818-010`](FID-2026-0818-010-auto-drive-discord-docs-and-faq.md) | operator-facing docs + FAQ (Auto Drive + Discord) | 7/7 `[x]` |

Gates (all exit 0): typecheck ×4; agent-runtime + CLI suites; eslint 0;
lint:md 0; `validate:repository` PASS. Nova issued a program-level
implementation **PASS** for the original 001–009 scope
(`dev/nova/outbox/archive/2026-08-18-auto-drive-and-discord-rich-presence-implementation-verdict.md`)
AND a separate **PASS** for the 009 hardcode revision + 010 docs
(`dev/nova/outbox/archive/2026-08-18-discord-rich-presence-hardcode-and-docs-nova-verdict.md`).

## 2026-08-18 closure — Auto Drive master 001 + Discord 009 (operator-confirmed live smokes)

The two remaining program records closed and archived 2026-08-18 after the
operator confirmed the live smokes, completing the Auto Drive + Discord Rich
Presence program:

- **`FID-2026-0818-001`** (master) — step 8 program certification: the
  operator confirmed the live `/auto` smoke (TUI + headless + crash resume);
  all seven children (002–008) closed + archived with evidence.
- **`FID-2026-0818-009`** (Discord Rich Presence) — step 5 live smoke: the
  operator confirmed Discord activities working in the live client under
  `1478095645662380042`.

Both records carry a FID-2026-0817-005 Step Status inventory with **every step
`[x]`** (the final live-smoke steps flipped `[x]` on the operator confirmation).
Nova planning + implementation PASS on record for both. The active queue is
now empty.

## 2026-08-17 closure — FID-2026-0817-004 (unauthorized coding-agent contributor credit purge + permanent watermark guard)

`FID-2026-0817-004-watermark-purge-and-guard.md` (severity: high) closed
and archived 2026-08-17. The operator found `@codebuff-team` and
`@CommandCodeBot` listed as repo contributors despite never being approved.
Forensics: the watermarks were `Co-Authored-By:` trailers inside commit
messages (21 commits with Codebuff trailers, 2026-07-17 → 2026-08-17) —
GitHub converts trailers into contributor credit; author identity was always
the operator's own. The existing `.githooks/commit-msg` guard (FID-2026-0812-
009) covered only CommandCodeBot, never Codebuff.

- **Purge:** `git filter-branch --msg-filter` stripped the trailer +
  `Generated with Codebuff` lines from all refs (14 commits rewritten,
  messages only; trees byte-identical). Force-pushed `main` (explicit lease)
  and re-pointed the `v0.0.25` tag; every other tag's commit target verified
  unchanged; release assets 5/5; npm untouched; pre-rewrite backup bundle
  retained outside the repo. GitHub contributor caches may lag.
- **Guard:** `.githooks/commit-msg` now blocks BOTH identities
  (`co-authored-by:…commandcodobot|commandcode.ai|codebuff` and
  `(generated with|generated by) codebuff` lines; legitimate co-authors
  still pass); `scripts/pre-push-scan.ts` now scans every pushed commit
  message fail-closed with the same patterns (`commitWatermarkLines`,
  exported + tested) — so even a `--no-verify` commit cannot push a
  watermark to the remote.

Gates: `pre-push-scan.test.ts` 17 pass / 0 fail; hook smoke 4/4; eslint 0;
lint:md 0. Closed + archived 2026-08-17.

## 2026-08-17 closure — FID-2026-0817-005 (Anti-Deferral Gate: FID step-status enforcement)

`FID-2026-0817-005-anti-deferral-fid-step-enforcement.md` (severity: high)
closed and archived 2026-08-17. Closes the silent-deferral failure class
(2026-08-16: 6 planning FIDs closed without implementation; 3-of-7 steps
silently deferred): approved plans are now machine-checkable at the three
existing enforcement points.

- `## Step Status` inventory — one md-checkbox per step; `deferred`/
  `skipped` legal only with `operator-approved <YYYY-MM-DD>`; every other
  unimplemented step is `blocked` by construction.
- `validateFidStepStatus` (new, `fid-validator.ts`) — pure validator;
  errors on missing approval markers and on `converged`/`closed` declared
  over unresolved steps (listing them); orphan markers are advisories.
- Pre-write transition gate (`pre-write-gates.ts`) — a FID write declaring
  `converged`/`closed` with unresolved steps is a hard block at the write
  path on both executors.
- Ledger archive scan (`scripts/fid-ledger.ts`) — `validateFidStepLedger`
  scans active + archived FIDs; an archived `closed` FID with unresolved
  steps fails `validate:repository` (`fid.steps.unresolved`);
  section-conditional (legacy FIDs unaffected).
- Recorder + Adversary instructions updated (present-before-close,
  never-archive-unresolved, silent-deferral checklist item).

Gates (all exit 0): agent-runtime suite 1001 pass / 0 fail (11 new
fid-validator + 5 new pre-write-gate cases); `fid-ledger.test.ts` 9 pass /
0 fail (4 new scan cases); typecheck ×4; eslint 0; lint:md 0; prettier
clean; `validate:repository` PASS. Closed + archived 2026-08-17 (the
active queue is now empty).

## 2026-08-17 closure — FID-2026-0817-003 (linux-arm64 release binary missing — OpenTUI native-bundle variant)

`FID-2026-0817-003-linux-arm64-missing-binary-incident.md` (severity: high)
closed and archived 2026-08-17. Post-release incident from the v0.0.25
publish: npm + GitHub release went live but the CI `Build linux-arm64` job
failed with `Could not resolve: "@opentui/core-linux-arm64-musl"`, leaving
4/5 binary tarballs; the fail-closed `verifyReleaseAssets` held
finalization until all five existed.

Root cause: OpenTUI 0.5.3 splits native bundles by libc
(`@opentui/core-linux-*` glibc vs `-musl`), and Bun's cross-target libc pick
is host-dependent — `bun-linux-arm64` resolved the musl bundle on the
ubuntu runner but the glibc bundle on Windows. `ensureOpenTuiNativeBundle`
fetched only the glibc variant; the musl resolution failed in CI. Same
function's latent defects also fixed: stub/empty package dirs treated as
installed, and Git Bash GNU tar parsing `C:/` paths as remote hosts
(now `--force-local`).

Fix: exported `getOpenTuiNativePackageNames` — every linux target installs
BOTH glibc and musl bundles of its arch (whichever Bun resolves is
present); empty dirs cleaned + re-fetched; extraction sanity-checks
`package.json`. 7 unit tests pin the mapping against the declared
`@opentui/core@0.5.3` optionalDependencies.

Release completion: resume path finalized the transaction — receipt
`POST_RELEASE_VERIFY` marked, `restored: true`, settings restored,
receipt finalized; release shows 5/5 binaries. Fix merged to `main`
(`18fec3a` + `8ee1883`) and pushed so future releases build every linux
variant on any host. Gates: cli typecheck exit 0; `build-binary-env.test.ts`
17 pass / 0 fail; full local arm64 cross-compile exit 0; CI matrix + asset
verify PASS; pre-push gate green on both commits.

## 2026-08-17 closure — FID-2026-0817-001 (TerminalCommandDisplay copy button + traffic-light redesign)

`FID-2026-0817-001-terminal-command-display-copy-button-and-traffic-lights.md`
(severity: medium) closed and archived 2026-08-17. Delivered: a panel-owned
copy footer on `TerminalCommandDisplay` that copies the entire block (command
line, status/meta row, and raw output — no title-bar dots, no line-number
gutter), so the shared renderer gives every context (history, ghost-message,
`run_terminal_command`, `run_readonly_command`) a copy affordance;
`tool-branch.tsx` reconciled so terminal/readonly commands no longer get a
double copy button; and the decorative traffic lights recolored
green/yellow/red, right-aligned, with a budget-gated `blendHex` brightness
pulse (zero `setInterval`, suspends to static dots under the animation budget).

Gates: typecheck ×4 exit 0; new `terminal-command-display.test.ts` 15 pass /
0 fail; root `bun run test` 0 fail; eslint 0; lint:md 0; prettier clean;
`validate:repository` PASS.

## 2026-08-17 closure — FID-2026-0817-002 (v0.0.25 harness report — capability completeness + findings)

`FID-2026-0817-002-v025-agent-capability-completeness-and-findings.md`
(severity: medium) closed and archived 2026-08-17. Root cause: the in-harness
agent guessed because its capability surface was documented unevenly.
Delivered: a generated phase-availability table naming `run_readonly_command`
in every phase with a read-only-shell callout + a `validateToolAvailability`
drift guard; safe pipes in `run_readonly_command` (split on unquoted `|`,
per-segment denylist, shell interpreters added to the dangerous-command
denylist so `cat x | sh` stays blocked); `read_files` `offset`/`limit` line
ranges; batch `run_readonly_command` (`commands` array); the names-only
sub-agent addendum upgraded; `initial-agents-dir/README.md` tool list
rewritten; a `scripts/test-count.ts` helper; the A–Z `V025-160` count
corrected 5/5 → 3/3. Also resolved the report's two findings: AV-001 (the
`bun build` gate now passes on win32 via `--external '@opentui/core-*'`) and
AV-002 (the `contrast.test.ts` slate fixtures replaced with current
savant-cyberpunk tokens).

Gates: typecheck ×4 exit 0; root `bun run test` 0 fail; eslint 0; lint:md 0;
prettier clean; `generate:protocol-bundle:check` exit 0; protocol-copies
token-budget baseline ratified.

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
