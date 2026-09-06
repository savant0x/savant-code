# Feature Implementation Documents

This directory contains **active** FIDs only: findings that still require
operator decision, implementation, runtime review, or closure evidence.

## Current active FIDs

**2026-08-22 ledger update (four passes):** (1) full inventory — the
0821/0822 queues were folded into this table; every status below is
re-verified against the FID's own header + Resolution/Step Status. (2)
**Closure pass — operator directive ("archive the completed ones"):** eight
`fixed` FIDs closed + archived (live-verification boundaries waived). (3)
**Perfection-loop pass + master plan — operator directive:** all pending
FIDs carry full planning loops (RED/GREEN/AUDIT/ADVERSARIAL); NEW
coordination master [`FID-2026-0822-013`](FID-2026-0822-013-master-completion-plan.md)
sequences the whole queue to zero (desktop chain -008→-009→-010, deck
fixtures-now/live-after-008, four order-free implementables, ratchet HOLD).
(4) **Master-plan execution — automation level 3:** `-0822-008` (edit-diff
fallback) and `-0822-004` (yagni_check leak: streaming stripper at the
ingestion boundary + text-channel gate + payload sanitization + prompt
alignment, 1193/0 agent-runtime suite) closed + archived. The `-007` number
collision was resolved earlier the same day — hex keeps `-007`, the deck is
`FID-2026-0822-012`. Historical closure notes further down are unchanged.
**2026-08-23 supersession:** `-0822-013` (the master completion plan above)
was superseded by [`FID-2026-0823-003`](FID-2026-0823-003-overnight-queue-to-zero-master.md)
as queue-to-zero coordinator and closed + archived (see `archive/README.md`).

**2026-08-27 reconciliation (tree-drain migration):** table refreshed to
match disk ground truth — four archived records removed (-0820-009,
-0822-012, -0822-014, -0824-011; see `archive/README.md`) and the nine
on-disk records missing from the table added (-0823-003, -0824-003…-008,
-0824-028, -0824-030). Statuses verified against each record's own header.

| FID | Status | Purpose / blocking gate |
|---|---|---|
| [`FID-2026-0903-001`](FID-2026-0903-001-desktop-packaging-auto-release-integration.md) | `analyzed` | Desktop packaging integrated into the automatic release pipeline (`release:public`) as new stages — successor to closed -0820-011; implementation on the NEXT release cut per operator directive 2026-09-03 |
| [`FID-2026-0905-009`](FID-2026-0905-009-release-pipeline-backup-stage.md) | `fixed` | `BACKUP_BUNDLE` release stage (between GIT_PUSH and GITHUB_RELEASE): the pipeline writes the verified incremental bundle via git-bundle-backup (FID-008) before public artifacts are cut, fail-closed with resume-awareness (pre-009 receipts run the backup for real); 6-test scratch-repo suite + 13 gate receipts; operator live smoke on the next release cut |

**2026-09-05 closure — quality campaign to zero (6 FIDs archived):**
[`FID-2026-0905-001`](archive/FID-2026-0905-001-native-tool-executor-decomposition.md)
(native.ts 894 → 249, `24fae6f0`),
[`FID-2026-0905-004`](archive/FID-2026-0905-004-gateway-decomposition.md)
(gateway.ts 1,327 → 236, `7e4be78`),
[`FID-2026-0905-005`](archive/FID-2026-0905-005-office-scene-decomposition.md)
(office-scene.tsx 2,126 → 179, `3c737fb`),
[`FID-2026-0905-006`](archive/FID-2026-0905-006-provider-drift-baseline-resolution.md)
(provider-drift baselines + derived env-sanitize lists, `98129016`),
[`FID-2026-0905-007`](archive/FID-2026-0905-007-public-release-decomposition.md)
(public-release.ts 3,065 → 178 over 23 modules, `32255bb`), and
[`FID-2026-0905-008`](archive/FID-2026-0905-008-git-bundle-backup.md)
(git-bundle-backup G5 durability layer, `32255bb`) **closed + archived
2026-09-05**. G2 commit hashes stamped in every FID (resolved by the
2026-09-05 G1 amendment permitting agent commits + push). All five residue
monoliths of closed -0819-005 are now decomposed; `quality:report` at
**0 violations**; receipts re-verified via `fid:verify --check`. Active
queue is now `-0903-001` only.

**2026-09-05 closure — provider integrations:**
[`FID-2026-0905-002`](archive/FID-2026-0905-002-kiosapi-provider.md) (KiosAPI)
and [`FID-2026-0905-003`](archive/FID-2026-0905-003-opencode-zen-provider.md)
(OpenCode Zen) **closed + archived 2026-09-05** — the operator's live tests
("kiosapi works", "zen works") discharged the key-gated boundaries; fresh
gate re-runs green (common 24/0, gateway 16/0, sdk 10/0 + 4/0). Active
queue is now `-0903-001` + `-0905-001`.

**2026-09-05 closure (quality-ratchet program complete):**
[`FID-2026-0819-005`](archive/FID-2026-0819-005-quality-ratchet-file-remediation.md)
closed after Loops 348–358 drove the live inventory from 16 to 5 violations —
every test file and every type file in the repo is now under the 300-line
ceiling. Remaining 5 are source monoliths (public-release, office-scene,
gateway, native, `__nt-before-snapshot`) recorded in the Resolution as
follow-on backlog. Template type files split into re-export hubs with zero
import-surface change; `init-type-files.ts` now owns the 8-file `.agents/types`
raw-text scaffold. Final gates: typecheck × 4 clean, all four workspace suites
0 fail, eslint `--max-warnings 0`, lint:md, Prettier. Active queue is now
-0903-001 only.

**2026-09-05 monolith-FID opening (residue backlog, item 2 of 5):**
[`FID-2026-0905-004`](archive/FID-2026-0905-004-gateway-decomposition.md)
opened scoping the architectural decomposition of
`cli/src/server/gateway.ts` (the desktop session gateway), measured
1,327 lines — the 4th of the 5 residue monoliths. Sequenced ahead of
`public-release.ts` because -0903-001 lands in that file at the next
release cut. Loop-1 RED recorded: 9 existing test files form the
characterization base (per-method coverage map verified), with one gap —
`injectTriggerRun` has no direct pins — to be closed RED-first before any
extraction. **Superseded same day:** the Perfection Loop ran to convergence
(Loop 2 + 3) and the operator approved implementation; see the table row
and the FID's own Loop sections for the full record, including the
`request()` harness-race fix (RED finding 5) and the 1,327 → 236 facade
result. (The item-1 note below predates the -0905-001 implementation.)

**2026-09-05 monolith-FID opening (residue backlog, item 3 of 5):**
[`FID-2026-0905-005`](archive/FID-2026-0905-005-office-scene-decomposition.md)
opened scoping the architectural decomposition of
`desktop/src/floor/office/office-scene.tsx` (the R3F office deck scene),
measured 2,126 lines. Sequenced ahead of `public-release.ts` (-0903-001
landing zone). Loop-1 RED recorded: the scene's pure logic (labelFor,
makeThinkingPredicate) is module-private with ZERO test coverage — RED
step 1 is the minimal verbatim logic extraction + pins before any
component move. Live gate validation at authoring: desktop typecheck 0,
4 sibling office suites green. **Implemented 2026-09-05** (operator
approved the full loop): Loop 2 settled the bus single-ownership
(`scene-focus-bus.ts`), targetFor cohesion, and the environment promotion;
RED extracted the pure logic first (13/0 pins), then 14 `scene-*` stage
modules behind a 179-line facade (2,126 → 179; four modules ceiling-split
at audit: desk-props, identity, agent-fx); suite parity 413/0 / 5,718
expects; receipt 6/6 PASS; quality-report unlisted. Status `fixed`;
closure awaits the G2 commit hash.

**2026-09-03 Maus-suite dissolution (operator decision):** -003, -004,
-006, -007 closed out-of-scope and master -008 closed (suite dissolved) —
all archived with the decision recorded in each Resolution. The Maus-parity
roadmap program is removed from the project; -009 and -005 had already
closed shipped. Active queue is now -0903-001 (next release cut) — the
operator-held ratchet (-0819-005) closed 2026-09-05; see below.

**2026-09-03 closure (ground-truth audit):** four `fixed` FIDs closed +
archived — FID-2026-0824-012 (self-improving harness master; live boundaries
fully discharged: both lesson-derived drafts operator-trusted, 19 production
capture records), FID-2026-0824-028/-030 (robot-cast recovery pair; re-smoke
discharged by the T16-F CDP smoke + the 0824-032 root-cause fix),
FID-2026-0828-001 (compaction summary; G2 hash resolved to `51fa261`, v0.0.28).
All receipts re-stamped PASS at the archived paths; fresh closure battery
101 tests / 0 fail across 11 gate files. See `archive/README.md` and CHANGELOG.

**2026-09-03 closure ceremony (release-time remainder + re-homing):** three
`analyzed` FIDs closed + archived after the desktop packaging release-time
ceremony — [`FID-2026-0820-011`](archive/FID-2026-0820-011-packaging-distribution.md)
(signed-bundle E2E, Windows installer smoke both flavors, blank-console fix,
CI prebuild fix + dispatch scaffold), [`FID-2026-0820-007`](archive/FID-2026-0820-007-savant-desktop-app-tauri-master.md)
(desktop master; all children closed), [`FID-2026-0823-003`](archive/FID-2026-0823-003-overnight-queue-to-zero-master.md)
(coordination master; U1–U11 resolved). Operator directive: the standing
release-time process is **re-homed into the automatic release system** —
successor [`FID-2026-0903-001`](FID-2026-0903-001-desktop-packaging-auto-release-integration.md)
tracks the pipeline integration for the next cut. Receipts stamped PASS at
all archived paths.

**2026-09-02 audit sweep:** seven deck/desktop session FIDs closed + archived
(-0828-002, -0829-001, -0831-001, -0831-002, -0901-001, -0901-003, -0901-006)
— statuses corrected to the honest implemented state, gate receipts
re-stamped PASS, changelog entries added. See `archive/README.md`
(2026-09-02 closure) and CHANGELOG.

**2026-08-25 closures:** `FID-2026-0824-009` Workspace Regions and `FID-2026-0820-010` Chat UI are
closed and archived after their documented implementation and verification gates. See
`archive/README.md` and the changelog closure entries.

**2026-08-24 suite addition:** agents-as-contacts command surface —
master [`FID-2026-0824-008`](FID-2026-0824-008-agents-as-contacts-command-surface-master.md)
and children `-009` (workspace regions), `-003` (computer use / cua daemon /
MJPEG), `-004` (voice pipeline), `-005` (triggers → goal injection), `-006`
(mobile companion), `-007` (security: keychain upgrade + consent UX) — authored
from the Gemini Deep Research report
(`docs/design/Agents-as-Contacts Architecture Research.md`) under BINDING
amendments C1–C7 recorded on the master (keyring-rs→Tauri host; cua-daemon
adoption over Rust port; local-default webhook ingress; MJPEG-only transport;
existing compactor reused; db-storage extension + Amendment Gate G1–G4;
single-model rule retained; voice free-mode deferred). Placement decision:
MERGED into the chat workspace (no separate screen); Deck = WATCH, workspace =
ACT. Sequencing guard: `-009` was gated on -010 Steps 4–7 and is now closed;
remaining children are tracked at their own active statuses; batched suite AUDIT
pending.

**2026-08-24 suite addition:** eval system rebuild v3 — master
[`FID-2026-0824-013`](FID-2026-0824-013-eval-system-rebuild-v3-master.md)
and children `-014`..`-019` authored from
`docs/design/Savant Eval System Rebuild.md` under binding amendments A1–A8:
stale Phase-1 sandbox premise corrected (TempDirSandbox already default);
single-model rule retained; Tier 1 into `.githooks/pre-push` (operator decision);
regression guard retargeted to the `/skills trust` boundary per FID-2026-0824-012;
autorater strictly out-of-process; license audit as a RED hard gate; FSM scorer
already substantive — increment 0 is adversarial-phase alignment + trajectory
assertions. Strict sequence `-014`→`-019` (operator directive: blueprint order).
Batched Verifier + Adversary audits complete: six mechanical FAILs found and
discharged, citations 5 CONFIRMED / 1 ADJUSTED on disk, no omissions. All records
at `analyzed`. Master closes when the last child closes.

**2026-08-25 reconciliation:** root-cause records `FID-2026-0824-020` and
`FID-2026-0824-021` were closed and archived after resolution by the completed
`-022` through `-027` rebuild suite. Their carried live-smoke boundaries remain
explicitly recorded as waived, never passed; the implementation is not duplicated.

**2026-08-24 suite addition:** compaction integrity rebuild — master
[`FID-2026-0824-022`](FID-2026-0824-022-compaction-integrity-rebuild-master.md)
with children `-023` (visibility/transparency layer), `-024` (preservation
contract + digest schema), `-025` (minimal-surgery algorithm), `-026`
(evidence spill + requiresRawEvidence splice), `-027` (removed-content ledger,
metrics, model notice) — grown out of the operator-reported 'data passed but
compacted' symptom: `-020` (subagents inherit compacted history) + `-021`
(drop-list digest discards read/search/web results; micro-compact invisible;
pruner output unsurfaced); `resources/hermes-agent/trajectory_compressor.py`
reviewed 0-EOF as the preservation baseline. Binding amendments V1/V2
(traffic-light visibility for ALL layers, HIGHLY visible firing, expandable
summary viewer) + P1–P4/M1/Q1. Sequence `-023` first → `-024` → `-025` →
`-026` ∥ `-027`. Batched Verifier + Adversary complete: 1 FAIL (master Impact
Assessment) discharged; 1 convention-based NEEDS-REVIEW refuted against disk.
All five children IMPLEMENTED, receipt-stamped (`--check` green each), and
CLOSED 2026-08-24 via operator live-smoke WAIVER directive; master `-022`
closed per policy. All six records archived to
[`archive/`](archive/README.md).

**2026-08-24 renumbering (operator directive):** the suite's planning records
shared date-numbers with same-day harness fixes (concurrent overnight streams
allocated independently); chronological renumber — master `-001`→`-008`,
workspace regions `-002`→`-009`, design-contract scanner `-002`→`-010`
(the law4/law3 credit fix keeps `-001`). Cite by full filename.

**Carried live-observation items (no FID yet — tracked so they cannot silently
drop):** CompactionSignal parity + `/compact` live re-test (carried from
FID-2026-0822-001/006; needs a natural compaction event observed live) ·
anti-runaway guard + turn-terminator live confirmation (carried from
FID-2026-0822-002/003; next natural runaway-pattern turn is the evidence) ·
reasoning-panel 90-col scroll repro (carried from FID-2026-0822-010) ·
expanded-state read_files/add_message confirmation (carried from
FID-2026-0822-011) · sidebar Context/Model overlap (routed to a future
sidebar FID) · `sixteen.` tail-loss repro (owned in the FID-2026-0822-009
closure) · `reminder.` border-row (mid-stream transient; monitor next live
pass).

`FID-2026-0819-002` (research tools non-functional in direct-provider mode) is
**closed and archived 2026-08-19** — see
[`archive/FID-2026-0819-002-research-tools-nonfunctional-in-direct-provider-mode.md`](archive/FID-2026-0819-002-research-tools-nonfunctional-in-direct-provider-mode.md)
and the closure entry in `archive/README.md`.

Historical: the cumulative verification tracking
FID (`FID-2026-0819-001`) is **closed and archived 2026-08-19**, and the
complete Auto Drive + Discord Rich Presence program
(`FID-2026-0818-001` master + children `002`–`008` + Discord `009` +
docs/FAQ `010`) is **closed and archived 2026-08-18**:

- Children `002`–`008` and `010` were operator-directed batch-archived
  2026-08-18 (all Step Status inventories fully `[x]`).
- Master `001` and Discord `009` closed 2026-08-18 after the operator
  confirmed the two live smokes: the live `/auto` run (TUI + headless +
  crash resume) and the live Discord presence under
  `1539431002089328710` (client id rotated from `1478095645662380042`
  2026-08-18).

See `archive/README.md` for the full closure index.

The five most recent records —
`FID-2026-0817-001` (TerminalCommandDisplay copy button + traffic-light
redesign), `FID-2026-0817-002` (v0.0.25 harness report remediation),
`FID-2026-0817-003` (linux-arm64 release binary missing — OpenTUI
native-bundle variant), `FID-2026-0817-004` (unauthorized coding-agent
contributor credit purge + permanent watermark guard), and
`FID-2026-0817-005` (Anti-Deferral Gate: FID step-status enforcement) —
were closed and archived on 2026-08-17; see `archive/README.md` for the
closure entries.

The complete Savant UI-overhaul program (master `FID-2026-0816-002` +
children `003`–`012`) is **closed and archived**: Phase 0 OpenTUI 0.5.3
upgrade (`003`), Phase 1 design tokens (`004`), Phase 2 animation engine
(`005`), Phase 3 native code/diff components (`006` — custom renderer
re-verified), Phase 4 layout/responsiveness (`007`), logo easter egg
(`008`), diff + transition redesign (`009`), post-FID-009 polish backfill
(`010`), rich terminal output (`011`), and the two `012` records
(native tool-call recovery hardening + trust-matrix stuck-awaiting-audit).
Every child closed with implementation evidence + the operator's
live-test confirmation (2026-08-16); the master closed once all children
closed. See `archive/README.md` for the closure entries.

**Status vocabulary (2026-08-16):** `created | analyzed | fixed | verified | converged | closed`

- `created` = findings noted; document not yet loop-passed
- `analyzed` = issues cataloged + document loop-passed; implementation not started
- `fixed` = implementation exists and gates pass, but a review/closure gate
  remains (e.g., an operator visual pass)
- `verified` = reviewed pass recorded (rarely left open; usually folds into `closed`)
- `converged` = document is complete and loop-passed, but implementation hasn't started
- `closed` = implementation exists in codebase AND gates pass (requires evidence)

Ledger admission note (2026-08-21): the validator (`scripts/fid-ledger.ts`)
accepts only `created | analyzed | fixed | verified` for files living in
`dev/fids/`. A loop-converged planning FID stays `analyzed` until its phase
is implemented (2026-08-16 Ground-Truth lesson); `converged` documents the
loop state, not an admissible active-queue status.

### Closed records (historical)

`FID-2026-0827-001` (sidebar context readout stall near zero — `dampTokenCount`
small-count floor `CONTEXT_TOKEN_SMALL_COUNT_FLOOR = 10_000`, medium) —
**closed + archived 2026-08-27** by operator directive after the gate surface
(12/0 suite, cli typecheck, Verifier PASS) proved the formula change and the
live visual meter was recorded as the operator's boundary; see
[`archive/README.md`](archive/README.md) for the closure entry.

`FID-2026-0825-001` (/compact "No response from agent" — compact-and-stop
zero-assistant-history false error, high) — **closed + archived 2026-08-25**
after the operator confirmed the live fix; see
[`archive/README.md`](archive/README.md) for the closure entry.

`FID-2026-0823-005` (unified edit line-count format `+N -N` via shared
utility + `DiffViewer` onto `TrafficLightPanel`) — **closed + archived
2026-08-23**; see `archive/README.md` for the closure entry.

`FID-2026-0816-001` (v0.0.24 phantom-dependency incident — the release
shipped without binaries; `@noble/hashes` declared + main-package-only
publish default + cli-bundle-resolution gate) — **closed** and archived
2026-08-16; indexed in `archive/README.md`.

`FID-2026-0816-002` (Savant UI overhaul — master organizing FID, high) —
**closed** and archived 2026-08-16 after every child closed with
implementation evidence + the operator's live-test confirmation; the work
queue is empty. Governance-only (planning, no code of its own).

`FID-2026-0816-005` (Phase 2 — animation engine adoption, medium) —
**closed** and archived 2026-08-16 after the operator confirmed the
blur → 15fps check (A) in the live closure test. All 7 steps: timeline
engine (`use-animation-timeline`), animation budget + blur suspension
(`use-animation-budget`), smooth scroll, fold/collapse tween,
streaming typewriter, `opentui-spinner` rejected (raw `setInterval`, YAGNI),
setInterval grep gate (only the two allowlisted 1 Hz wall-clock timers).
Regression fix: the 1 s loop-halt (loop/duration options added to
`useAnimationTimeline`).

`FID-2026-0816-009` (diff viewer + phase-transition notification visual
redesign — medium) — **closed** and archived 2026-08-16 after the
operator's visual pass PASS: the diff viewer (bordered frame, header strip,
old/new gutter, sign column, hunk bars, EDIT fallback) renders correctly,
and the phase-transition bar renders **identically in Cursor and classic
PowerShell console** — the Loop-6 filled-chip redesign (solid phase-color
fill, black text / white-on-red, `relativeLuminance`-driven) eliminated the
ANSI-16 tint collapse that made the bar drift between terminals. See
`archive/README.md` for the closure entry.

`FID-2026-0816-010` (post-FID-009 UI polish backfill — mode-selector cyan
strokes + reactive trust matrix, medium) — **closed** and archived
2026-08-16 after the operator confirmed checks E/F in the live closure
test: cyan hover strokes project-wide, and the trust matrix now mounts only
while receipts are pending, resolves signed rows, carries no title icon,
and disappears on completion.

`FID-2026-0816-011` (rich terminal command output redesign, medium) —
**closed** and archived 2026-08-16 after the operator confirmed check G in
the live closure test: traffic-light title bar, green `$` command row +
✓/✗/⏳ status badge, cwd/timeout pills, line-number gutter (hidden <50
cols), clean expand/collapse, and `exitCode` plumbing through
`parseTerminalOutput`.

`FID-2026-0816-012` (`-trust-matrix-stuck-awaiting-audit`, medium) —
**closed** and archived 2026-08-16 (operator live-test confirmation):
Trust Matrix label "awaiting audit"→"signed", tone-glyph icon removed,
title → "Trust Matrix". **Number note:** collides with the archived
`FID-2026-0816-012-native-tool-call-recovery-hardening` (closed same day);
both preserved per the Historical duplicate IDs convention — reference by
full filename.

`FID-2026-0816-012` (native tool-call recovery hardening — high) — **closed**
and archived 2026-08-16 after operator approval + full gate sweep. Fixes the
flash-model truncated-tool-call failure that killed a Forge subagent run
(FID-011's implementation): tool-aware split steering, a 3-strike cap, an
actionable exhausted failure naming the tool, and drift warn for unknown
incomplete tools. See `archive/README.md` for the closure entry.

`FID-2026-0816-008` (Savant logo easter egg) — **closed** and archived
2026-08-16 after the operator's visual pass PASS (click-per-message flow,
centered bubbles, cyan-on-near-black viewport-height 5 s flood, 5 s moral
bubble). Canonical design doc: `docs/design/easter-eggs.md`.

The 2026-08-14 remediation program — master
`FID-2026-0814-007` and children `FID-2026-0814-002` through `-006` — was
implemented under the operator's automation level 3 grant (Nova planning PASS
recorded for each child), fully verified (typecheck ×4, full root suites,
ESLint, lint:md, Prettier, `validate:repository`), documented (README,
`docs/features.md`, CHANGELOG), and closed + archived on 2026-08-14:

| FID | Status | Purpose |
|---|---|---|
| [`FID-2026-0814-002`](archive/FID-2026-0814-002-durable-budgeted-goal-mode.md) | `closed` | Durable budgeted goal mode — event-sourced goal state machine, token/turn/wall-clock budgets, continuation driver, `update-goal`/`get-goal` tools, `<untrusted_objective>` injection |
| [`FID-2026-0814-003`](archive/FID-2026-0814-003-extensible-hook-system.md) | `closed` | Extensible hook system at the EHEL enforcement points — `hooks` config block, fail-open bounded runner, `PreToolUse`/`PostToolUse`/`PostToolUseFailure` + session/subagent events |
| [`FID-2026-0814-004`](archive/FID-2026-0814-004-verification-harness-agent-frictions.md) | `closed` | Verification-harness frictions (H-01..H-07) + project-wide model unification (H-08..H-12, P0 — one model, no paid hardcode) |
| [`FID-2026-0814-005`](archive/FID-2026-0814-005-trust-matrix-auto-resolution.md) | `closed` | Trust Matrix auto-resolution — `finalize()` resolves open `pending` receipts to honest `no_verdict` terminal via a signed system-role annotation |
| [`FID-2026-0814-006`](archive/FID-2026-0814-006-compaction-status-freshness-and-visual-feedback.md) | `closed` | Compaction freshness + visible feedback — SDK boundary `contextWindow` threading fix, snapshot emit on status/context change, in-stream `CompactionSignal` block |
| [`FID-2026-0814-007`](archive/FID-2026-0814-007-master-implementation-plan.md) | `closed` | Coordination master — sequenced the five children into one implementation pass |

Three follow-on records closed and archived on 2026-08-14 after Perfection-Loop
convergence and the full gate sweep:

| FID | Status | Purpose |
|---|---|---|
| [`FID-2026-0814-008`](archive/FID-2026-0814-008-az-v024-live-test-002-007-coverage.md) | `closed` | Extends `az-v0.0.24-harness-live-test.md` (→ v1.2.0) with deterministic `5e` rows (V024-150…167) for FID-2026-0814-002..007 |
| [`FID-2026-0814-009`](archive/FID-2026-0814-009-inter-agent-prompt-coherence-audit.md) | `closed` | Project-wide inter-agent prompt coherence audit (B-01…B-08): basher two-phase contract, Forge=GREEN attribution, Recorder status vocab, Scout stale instruction, `thinker-gpt` fold into `@thinker`, `withParentModel` privacy-flag preservation, and project-wide paid-model reconciliation (`openrouter/free`) |
| [`FID-2026-0814-010`](archive/FID-2026-0814-010-paid-build-model-conflation-remediation.md) | `closed` | Paid-build model conflation fix (B-09/B-10): the paid CLI never reads the savant-free preference or catalog — boot model resolves only from the operator's `/model` selection (`openrouter/free` fallback); `switchModel` persists build-aware; remaining `librarian`/`tmux-cli` `minimax-m3` hardcodes reconciled. Operator-authorized closure without Nova sign-off |

`FID-2026-0814-013` (force-compact trigger re-expressed as a fixed window
offset — low) was implemented and archived on 2026-08-14. It re-types the
`compression.forceCompactRatio` config key to `forceCompactOffset` (default
`15_000` tokens) across all five layers and switches the serialized trigger from
`maxContextLength × 0.9` to `maxContextLength - forceCompactOffset`, so the
force tier keeps a constant 15k margin below the hard limit regardless of window
size. The active queue was empty after this closure.

`FID-2026-0814-012` (force threshold anchored to the resolved window — low)
was implemented and archived on 2026-08-14. It anchors the 0.9 force threshold
and the sidebar percent denominator to the compactor's `reactiveCompact` (=
`contextWindow`) instead of the reconstructed `autoCompact + 30_000` — a
single-source-of-truth (Law 13) reconciliation, not a live defect. The active
queue was empty after this closure.

`FID-2026-0814-011` (auto-compaction trigger never fires — critical) was
implemented under operator approval, Nova-audited **PASS** on implementation,
operator-approved for closure, and archived on 2026-08-14. It collapses the two
competing compaction trigger systems into a single authority (`autoCompactDue`
set every step by `prepareStepContext`, consumed by the serialized savant
`handleSteps`), removes the silent baked-fallback trigger divergence, and adds
trigger-input debug observability. The active queue was empty after this closure.

`FID-2026-0814-001` (live sidebar surfaces remediation — compaction status
lifecycle, Trust Matrix live signal, teacher panel terminal state) was
implemented under automation level 3, Nova-audited **PASS** on both planning
and implementation
(`dev/nova/inbox/2026-08-14-fid-2026-0814-001-live-sidebar-surfaces-planning-response.md`
and
`dev/nova/inbox/2026-08-14-fid-2026-0814-001-live-sidebar-surfaces-implementation-response.md`),
operator-approved for closure, and archived on 2026-08-14. See
[`archive/README.md`](archive/README.md) for the closure index. Implementation
status alone is not closure evidence.

`FID-2026-0813-023` (harness observability + integrity remediation) was
implemented under automation level 3, Nova-audited **PASS** on both planning
and implementation
(`dev/nova/inbox/2026-08-13-fid-2026-0813-023-harness-observability-integrity-planning-response.md`
and
`dev/nova/inbox/2026-08-13-fid-2026-0813-023-harness-observability-integrity-implementation-response.md`),
operator-approved for closure, and archived on 2026-08-13.

`FID-2026-0813-022` (teacher live sidebar surface) was implemented, Nova-audited
(planning + implementation both **PASS**), operator-approved for closure, and
archived on 2026-08-13. The complete 2026-08-13 program set — the homegrown
Agent-Steering Teacher (master `FID-2026-0813-011`, children `-012` through
`-020`, plus the sidebar surface `-022`) and the standalone canonical
version-bump tool (`FID-2026-0813-021`) — is closed and archived. See
[`archive/README.md`](archive/README.md) for the closure index. Implementation
status alone is not closure evidence.

## Planning-only work (no FID yet — operator decision required)

The following build-order phases are **planning-only**: they have no FID, no
implementation, and no Nova sign-off. They are surfaced here so they do not
hide inside build-order files. An operator decision is required before any FID
is authored for them.

| Scope | Source | Status |
|---|---|---|
| ZTAP **P2** — Retention (ECHO Compliance Scorecard + FSRS-6 Scribe memory) | `dev/build-orders/2026-08-13-ztap-build-order.md` | planning-only |
| ZTAP **P3** — Deep architecture (Multiverse Counterfactual Debugging + Semantic Vulnerability Topography) | `dev/build-orders/2026-08-13-ztap-build-order.md` | planning-only |
| ZTAP **P4** — Economic horizon (x402 agent bounties) | `dev/build-orders/2026-08-13-ztap-build-order.md` | **deferred** (regulatory + custody) |

Only ZTAP **P1** (FIDs `001`–`010`) was implemented and closed. P2–P4 were
never implemented. See the build order for phase scope, trigger gates, and the
open design questions (Q1–Q5) that gate any P2+ work.

| Coordination master | Current status | Purpose |
|---|---|---|
| [`FID-2026-0813-011`](archive/FID-2026-0813-011-agent-steering-teacher-master.md) | `closed` | Homegrown teacher master; Nova PASS + operator closure 2026-08-13 | Archived |

| Closed child set | Status | Scope |
|---|---|---|
| `FID-2026-0813-012`…`020` | `closed` | Contracts, sandbox, vertical slice, corpus, graders, overlay, progression, integration audit |

| Standalone closed FID | Status | Scope |
|---|---|---|
| [`FID-2026-0813-021`](archive/FID-2026-0813-021-canonical-version-bump-tool.md) | `closed` | Canonical version-bump tool (internal) |

The older 0812 coordination master and FID-0812-007 remain historical closed records
in the archive. Their external-environment-dependent resolution is preserved below.

| Coordination master | Current status | Purpose |
|---|---|---|
| [`FID-2026-0812-006`](archive/FID-2026-0812-006-v0-0-23-active-queue-implementation-closure-master.md) | `closed` | Final child reconciliation; no release authorization | Archived |

| FID | Current status | Closure classification | Disposition |
|---|---|---|---|
| [`FID-2026-0812-007`](archive/FID-2026-0812-007-top-row-click-selection.md) | `closed` | Operator-confirmed external-environment resolution; application fix and root cause unverified | Archived |

FIDs 0812-002/003/004/005/006/007 are closed and archived with their implementation,
operator-confirmed evidence where applicable, lifecycle closure loops, and changelog
coverage recorded in the archive. FID-0812-007's original selection owner remains
unverified, but the operator-confirmed external-environment resolution closes its active
work queue. Reopen it only if the behavior recurs in a supported harness.

Do not archive a FID solely because code is implemented, operator-tested, or a planning
loop converged. Archive only after all stated review boundaries are resolved, the FID
status is `closed`, the `CHANGELOG.md` contains a closure entry, and the file is moved to
[`archive/`](archive/).

The most recently closed 0812 records include 002–007 and the earlier
`FID-2026-0812-001-v0-0-23-live-test-remediation-master.md`. They were archived after
implementation evidence, operator confirmation, lifecycle closure, and release-readiness
review; they are not part of the active queue. Earlier closed packages and operator-accepted historical
records remain documented below and in [`archive/README.md`](archive/README.md).

The 015–021 remediation package and the 022–029 LEARNINGS feedback-system package are
not active FIDs. Their working-tree/archive and Nova sign-off boundaries remain documented
as historical or pending evidence in the sections below; they are not silently re-opened by
this audit.

The 2026-08-09 optimization program (master FID-2026-0809-012 + children 013–018) was
implemented under the operator's automation level 3 grant, independently signed off by Nova
(implementation audit **PASS**,
`dev/nova/inbox/2026-08-09-fid-2026-0809-003-010-optimization-automation-implementation-sign-off-response.md`),
and closed/archived 2026-08-09. All seven records now live in [`archive/`](archive/) with
`closed` status.

The FID-2026-0811 deep-audit master program and children 005–014 remain untracked
working-tree artifacts whose historical closure claims are explicitly untrusted; they
were not rewritten, deleted, or silently dispositioned. The separate remediation package
015–021 is the tracked-scope implementation under current Nova review.

The complete ZTAP P1 wedge (`FID-2026-0813-001` through `-010`) was implemented and
closed under automation level 3 on 2026-08-13, then moved to [`archive/`](archive/).
Closure evidence includes full typecheck/test gates, ESLint with zero warnings,
Prettier, focused crypto/provenance/export/clean-process/Trust Matrix suites, and the
implementation sign-off request at
`dev/nova/outbox/2026-08-13-fid-2026-0813-001-ztap-implementation-signoff-request.md`.
Nova sign-off and release authorization remain separate boundaries; these are working-tree
records, not clean-release certification.

### 2026-08-09 ledger reconciliation (operator-accepted)

The FIDs previously listed here as active — `0806-017`, `0806-018`, `0807-001`
through `0807-006`, and `0808-001` — had all been moved to the archive while
retaining non-closed status metadata (`implemented`, `fixed`, `analyzed`, or
`verified`) with unresolved review boundaries. Per operator decision on
2026-08-09, those remaining review boundaries are **waived** and the records are
accepted as **historical**, matching their physical archive placement. They are not an
active work queue. `FID-2026-0808-001` is genuinely closed (operator-directed close with
Nova sign-off); `0806-017`/`0806-018` and `0807-001`…`006` are operator-accepted historical
records. See [`archive/README.md`](archive/README.md) for the corrective index entry.

The 2026-08-09 optimization and automation batch (`FID-2026-0809-003` through
`FID-2026-0809-010`) is closed and archived; its independent PASS response is recorded in
`dev/nova/inbox/2026-08-09-fid-2026-0809-003-010-optimization-automation-implementation-sign-off-response.md`.

The FID-2026-0811-022–029 LEARNINGS feedback-system remediation package is implemented,
locally verified, transitioned to `closed`, and physically moved to [`archive/`](archive/)
in this working tree. The archive files are not yet tracked by a commit, so this is
working-tree closure evidence rather than durable repository certification. Nova's
implementation sign-off request is recorded in the audit channel; release certification
remains a separate operator decision.

The batch is included in pending unreleased `0.0.23`; the release gate was re-run under the
pinned Bun `1.3.14` toolchain (2026-08-09) and passes, and publication remains a separate
operator action.

`FID-2026-0809-011` (graph-export file decomposition — `template.ts` + `export-serializer.ts`)
is closed and archived 2026-08-09 after the Nova implementation sign-off **PASS**
(`dev/nova/inbox/2026-08-09-fid-2026-0809-011-graph-export-file-decomposition-nova-audit-response.md`);
byte-identical artifact proven pre/post decomposition. Archived at
`dev/fids/archive/FID-2026-0809-011-graph-export-file-decomposition.md`.

`FID-2026-0810-002` (universal session-init grounding) and `FID-2026-0810-003`
(generated condensed protocol copies — the follow-up converting
`ECHO_PROTOCOL_INSTRUCTIONS` + the 15-turn refresh into generated output from `ECHO.md` +
generator framing) are closed and archived 2026-08-10 after Perfection-Loop convergence
(operator-approved) and implementation under automation level 3. Archived at
`dev/fids/archive/FID-2026-0810-002-universal-session-init-grounding.md` and
`dev/fids/archive/FID-2026-0810-003-generated-condensed-protocol-copies.md`.
The separate 2026-08-10 records remain archived; the 015–021 remediation package is now
closed and archived after Nova's PASS.

Do not archive a FID solely because its code is implemented. Archive only after all stated
review boundaries are resolved, the FID status is `closed`, the CHANGELOG contains a closure
entry, and the file is moved to `dev/fids/archive/`.

The 015–021 package and FID-2026-0811-030 satisfy those conditions after independent
implementation review. The design-system feature guide is maintained at
[`docs/design/design-system-library.md`](../../docs/design/design-system-library.md).
The current documentation-and-implementation sign-off request remains an explicit
independent review boundary. This remains working-tree evidence until committed.

See [`archive/README.md`](archive/README.md) for historical records and
[`FID-2026-0807-016-dev-folder-and-fid-hygiene.md`](archive/FID-2026-0807-016-dev-folder-and-fid-hygiene.md)
for the current `/dev` cleanup audit.

## Historical duplicate IDs

`FID-2026-0805-006` and `FID-2026-0805-007` were each used for two historical
records. Their filenames and contents are intentionally preserved. Do not rename them
retroactively; use the full filename when linking to either record.
