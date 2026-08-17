# Feature Implementation Documents

This directory contains **active** FIDs only: findings that still require
operator decision, implementation, runtime review, or closure evidence.

## Current active FIDs

The active queue is **empty**. The two most recent records —
`FID-2026-0817-001` (TerminalCommandDisplay copy button + traffic-light
redesign) and `FID-2026-0817-002` (v0.0.25 harness report remediation) — were
closed and archived on 2026-08-17; see `archive/README.md` for the closure
entries.

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

### Closed records (historical)

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
