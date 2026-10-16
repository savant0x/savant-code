# SCOPE — Open Work Register

This register lists active work only. On closure, remove the item and its write
targets; retain evidence in the changelog, archived FID and session summary.
Every active FID and agenda task must be registered here. Machine-readable
targets grant write authority only for the corresponding open item.

Automation levels follow `dev/echo-v0.1.2-single-agent.md` and the session
ceiling in `protocol.config.yaml`. They do not override ECHO laws, credential
handling or repository boundaries.

## Open items

## Internal follow-ups and current operator authority (2026-10-16)

Implementation-complete records FID-2026-1015-006 and FID-2026-1012-022
are closed and archived, with changelog entries. Observation and live comparison
are separate work, per the operator's explicit ruling in this session.
MarsAI removal FID-2026-1016-005 (`87c2f87a`, 11/11 gates) and internal
tracking FID-2026-1016-006 (`dbb8de12`, 10/10 gates) are also closed and archived.
Push-path repair FID-2026-1016-007 (`6b2d9d91`, 7/7 gates) is closed and archived
after the credential scan's Git reads were batched; the exact 38-commit push range
was measured at 6,548 files / 26 s / exit 0, and the push retried through the
unmodified hook chain. No scan bypass, cap change or history rewrite was used.
Attribution-guard extension FID-2026-1016-008 (`302ffe69`, content strips
`579e781f`, 4/4 gates) is closed and archived: the rule now covers the documents
agents write as well as commit messages, always on through
`validate:repository`, the pre-push working-tree scan and CI, and every
non-Savant credit the operator's sweep and the new scanner found is stripped —
the two tree scans report exit 0.
Learning-pipeline register repair FID-2026-1016-009 (`dc7362b4`, 6/6 gates) is closed
and archived: the active candidate store holds open work only, implemented candidates
retire verbatim to `dev/feature-pipeline/implemented.json`, and four repair boundaries
are declared in `dev/experiences/fix-boundaries.json` against verified fix commits, so
the exposure sink is armed for the first time. `OBS-001` stays open — three classes now
report `incomplete-observation` while four classes with no provable repair commit,
including both truthful-upstream `read_url` refusals, remain `unresolved`. No class
repair and no production observation is claimed.

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
- T194 reconnaissance is **complete**:
  `dev/research/linked-checkout-reconnaissance-2026-10-16.md` classifies all 192
  farm entries (12 read-level, 46 machinery-dense, 62 mentions, 69 no surface),
  extracts nine checkout mechanics with file:line, reconciles each against
  Savant's existing surfaces, maps per-checkout versus shared state, catalogs
  eleven failure classes and states the G9 trigger measurement plan. Answer: no
  retrofit now, with the trigger thresholds and the minimal lawful shape if one
  fires recorded in the study. Authoring a FID for a dependency-sharing lane is
  a pending operator decision, not an agent disposition.

Free-offers discovery fidelity FID-2026-1016-010 (`560b04ae`, 10/10 gates) is closed and
archived: the free-options surface now reads advertised deadlines from the shapes the feed
actually emits (ISO first, else the tail's human date at end-of-day UTC), so 12 of the 219
cached offers report a real deadline instead of all 219 reporting "deadline unverified" while
a 72 h window that could never fire; the offer category lifts the tail's final dash segment, so
multi-dash prose no longer pollutes the harvest leg's class filter; the `/provider free` output
is bounded and attributed while `free-options.md` keeps every offer grouped by category; and
the catalog delta reaches both headers. Live label histogram after the repair: 207
no-deadline / 12 advertised / 0 unverified. No release and no notification traffic beyond the
repaired window logic is claimed.

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
- FID-2026-1016-011: `cli/src/utils/logger/file-sink.ts`,
  `cli/src/utils/logger/sink.ts`, `cli/src/utils/trace-writer.ts`,
  `cli/src/utils/chat-history.ts`, `cli/src/index.tsx`,
  `cli/src/utils/logger/__tests__/file-sink.test.ts`,
  `cli/src/utils/__tests__/trace-writer.test.ts`, `scripts/hygiene.ts`,
  `scripts/__tests__/hygiene.test.ts`, `docs/scratchpad.md`, `AGENTS.md`,
  `.gitignore`, `dev/scratchpad/**`
