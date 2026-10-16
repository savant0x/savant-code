# SCOPE — Open Work Register

This register lists active work only. On closure, remove the item and its write
targets; retain evidence in the changelog, archived FID and session summary.
Every active FID and agenda task must be registered here. Machine-readable
targets grant write authority only for the corresponding open item.

Automation levels follow `dev/echo-v0.1.2-single-agent.md` and the session
ceiling in `protocol.config.yaml`. They do not override ECHO laws, credential
handling or repository boundaries.

## Open items

- [ ] **FID-2026-1016-007. Batch pushed-range credential-scan Git reads.**
      Automatic progress push encountered a historical 6,207-file deletion
      and restoration. Per-path size, absence and content subprocesses make
      that scan require roughly 25,000 Git launches. Batch exact-commit tree
      metadata and bounded binary blob reads without weakening range coverage,
      credential checks, deletion confirmation, size caps or identity pins.
      Complete and verify this necessary push-path repair, then retry the push.
      **Automation level: 3.**

- [ ] **T194. Linked-checkout retrofit reconnaissance before any FID.**
      Retrofitting the git-worktree idea against Savant rather than adopting the intake
      report: all 192 `resources/` repositories classified, mechanics extracted with
      file:line from real implementations, each mechanic checked against what Savant
      already has (Law 7/13), a state-surface map (per-checkout versus shared, including
      the governance ledgers `dev/experiences/**`, `dev/LEARNINGS.md`, `dev/agenda.md`,
      `.agents/skills/.quarantine/**` and `SCOPE.md` itself), a failure catalog, and a
      measurement plan for the G9 trigger. No FID is authored until the record is
      complete. Method is bounded per-repository probing: recursive sweeps of
      `resources/` exceed the search tool's execution cap (measured).
      **Automation level: 3.**

## Internal follow-ups and current operator authority (2026-10-16)

Implementation-complete records FID-2026-1015-006 and FID-2026-1012-022
are closed and archived, with changelog entries. Observation and live comparison
are separate work, per the operator's explicit ruling in this session.
MarsAI removal FID-2026-1016-005 (`87c2f87a`, 11/11 gates) and internal
tracking FID-2026-1016-006 (`dbb8de12`, 10/10 gates) are also closed and archived.

- `OBS-001` in `dev/tracking/internal-followups.json`: production exposure and
  remaining sanitized replay evidence for eight classes. No class repair is claimed.
- `LIVE-001` in the same store: the former T175 live-comparison work, independent
  of coordinator closure. Selected references and numeric call/spending limits
  remain prerequisites for a live run; this instruction authorizes no spending.
- Selected lessons features are implemented: LF-003 at `628375ff`, LF-004 at
  `d71b9065`, LF-007/008/009 at `6b847099`; fresh focused verification passes.
  Candidate states/report are reconciled. Unselected drafts remain proposals.
- Commit verified progress and automatically push normal fast-forward updates
  to `main` through mandatory gates. Older handoff/local-only holds are
  superseded. Handoffs, observation windows and release timing do not hold
  progress pushes. Releases remain separate operator actions.

## Recorded operator dispositions (2026-10-15)

The verbatim source is `dev/fids/answers.md`; the durable decision record is
FID-2026-1015-002. These dispositions supersede the previous register holds.

- T171: dropped::operator-approved 2026-10-15 — "keep as is".
- T173: current conservative KiosAPI defaults accepted — "its fine, close it as done".
  No vendor-published or newly measured context windows are claimed.
- T62-followups: dropped::operator-approved 2026-10-15 — "no need to check".
  No fresh availability or funding verification is claimed.
- Q23 routing decision and attribution branch-protection requirement:
  dropped::operator-approved 2026-10-15 — "disregard these, im not doing ci".
  Existing local guards remain effective.
- T186: scripts/tmux is now wired into ordinary and release typecheck/test
  chains; its typecheck and four offline tests pass. Savant-Free registration
  is removed, leaving 14 registered workspaces with a leg in each root chain.
- T187: all six coding skills now have `version: 0.1.0`, per "agree";
  skills:check reports zero repository errors and 24 warnings.
- Standing normal-main push authority and T191: committed at 98375762.
- T192/T193: transcript retained under dev/scratchpad/archive/ (1,304,054 bytes);
  receipt retained under dev/scratchpad/active/ (1,144 bytes). Root clutter is
  cleared; the intake report passes Markdown lint. No artifact was deleted.

## Machine-readable scope targets

Operator authorization: completion at automation level 3, renewed 2026-10-15;
specific removal and skill metadata approvals are in answers.md. Governance
artifacts required by ECHO retain their gate-level exemptions.

- FID-2026-1016-007: `scripts/push-content*.ts`,
  `scripts/*push*.test.ts`,
  `scripts/__tests__/*push*.test.ts`, `scripts/__tests__/*pin*.test.ts`,
  `scripts/pre-push-scan.ts`, `SCOPE.md`, `CHANGELOG.md`, `dev/fids/**`,
  `dev/session-summaries/**`

- Release-0.0.36: `VERSION`, `package.json`, `agents/package.json`,
  `cli/package.json`, `cli/release/package.json`, `common/package.json`,
  `common/src/constants/protocol-bundle.generated.ts`, `desktop/package.json`,
  `desktop/src-tauri/tauri.conf.json`, `desktop/src-tauri/Cargo.toml`,
  `desktop/src-tauri/Cargo.lock`, `evals/package.json`,
  `scripts/tmux/package.json`, `sdk/package.json`, `packages/**/package.json`,
  `bun.lock`, `protocol.config.yaml`, `README.md`, `README.zh-CN.md`,
  `ARCHITECTURE.md`, `CHANGELOG.md`, `docs/**`, `SCOPE.md`, `dev/agenda.md`,
  `dev/operator-decisions.md`, `dev/fids/**`, `dev/feature-pipeline/**`,
  `dev/session-summaries/**`, `scripts/version-docs.ts`,
  `scripts/version-docs-drift.test.ts`, `.agents/skills/**/SKILL.md`
- T194: `docs/design/**`, `dev/research/**`, `dev/scratchpad/**`, `dev/fids/**`,
  `dev/task-id-ledger.json`, `SCOPE.md`
