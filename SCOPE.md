# SCOPE — Open Work Register

This register lists active work only. On closure, remove the item and its write
targets; retain evidence in the changelog, archived FID and session summary.
Every active FID and agenda task must be registered here. Machine-readable
targets grant write authority only for the corresponding open item.

Automation levels follow `dev/echo-v0.1.2-single-agent.md` and the session
ceiling in `protocol.config.yaml`. They do not override ECHO laws, credential
handling or repository boundaries.

## Open items

### EMBED-001 — the harness single-agent embed is a superseded law revision (blocked)

Authority: automation level 3 (session ceiling). The install step is reserved to the
operator — the target file lies outside the project directory, and no automation level
lifts that boundary (ECHO v0.1.2 → Automation Levels → "Invariants no level lifts").

`C:\Users\spenc\.config\opencode\agent\echo.md` (409 lines, last written 2026-08-11) embeds
a law set that predates the current `dev/echo-v0.1.2-single-agent.md` (618 lines) while
claiming to be complete (echo.md:9) and carrying its own re-embed instruction
(echo.md:15). Verified missing from the embed: the Law 1 scripted-edit prohibition and its
2026-09-30 operator ruling (canonical:89-113), the no-agent-side scope-disposition rule
(canonical:78-87), the Scope Boundary / SCOPE.md register section (canonical:325-380),
Automation Levels (canonical:165-221), Step-Level Anti-Deferral (canonical:552-570), the
2026-10-16 auto-archive and progress-push rulings (canonical:427-459, 580-593), the
Double-Audit FID contract check (canonical:385-389), `converged` in the allowed status set
(canonical:412-419), and the two anti-pattern rows for scripted edits and scope labelling
(canonical:498, 503). The stale copy also contradicts the current rules: it requires an
`Author` FID metadata field (echo.md:272-273) while forbidding attribution (echo.md:38;
canonical:14-24), names `ECHO.md` as the protocol to read (echo.md:393) while
`ECHO-single-agent.md:5-12` forbids that for single-agent sessions, and its recovery paths
use a `PENDING` status absent from every status set (echo.md:359, 373).

Blocker: writing outside the project directory is an operator-reserved action. Remedy
presented: retain echo.md:1-15 (frontmatter, directive, mandate, canonical-source line)
and replace echo.md:19-409 with the current canonical body, read 0-EOF. This session is
not affected — the canonical file was read in full and governs.

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
the exposure sink is armed for the first time. `OBS-001` is cancelled by the
operator's 2026-10-16 ruling below. Historical recurrence states remain evidence
of the recorded failures; cancellation claims neither class repair nor completed
production observation.

- OBS-001: dropped::operator-approved 2026-10-16 — "i thought we addressed that but it
  went on a 14 day tracking i canclled. We can dig deeper into it but i don't have
  14 days to wait for data". The observation task is cancelled. Current recovery
  investigation uses deterministic reproduction and replay without a waiting period.
  No completed observation or production repair is claimed. Evidence:
  `dev/session-summaries/2026-10-16-2250-recurrence-reassessment.md`.
- `LIVE-001` in the same store is **closed not-planned** (operator ruling 2026-10-16,
  the second operator round this session): live provider comparisons are not planned.
  No paid run happened, nothing was measured, and no comparison result is claimed —
  retiring the item is not evidence of one. Reopening requires a future ruling that
  names the comparison references and numeric call/spending limits; this instruction
  authorizes no spending.
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

The verbatim source is `dev/fids/answers.md` (op: i deleted that answers.md file
during cleanup.); the durable decision record is FID-2026-1015-002. These
dispositions supersede the previous register holds.

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
- FID-2026-1016-011 is **closed and archived** (2026-10-16, 9/9 gates, receipt stamped, six
  commits `88e2578a`..`c44431ad`). Its write targets are released: `cli/src/utils/logger/*`,
  `cli/src/utils/trace-writer.ts`, `cli/src/utils/chat-history.ts`, `cli/src/index.tsx`,
  `scripts/hygiene.ts`, `scripts/orphan-sweep.ts`, `docs/scratchpad.md`, `AGENTS.md`,
  `.gitignore`, `eslint.config.js`, `templates/FID-TEMPLATE.md`, `dev/scratchpad/**`,
  `dev/research/**`, `packages/agent-runtime/src/echo/fid-verification-gates.ts`,
  `common/src/constants/protocol-bundle.generated.ts`. **The six commits are not yet pushed:**
  the pre-push suite is red for the unrelated reason registered below.
- FID-2026-1016-012 is **closed and archived** (2026-10-16, 4/4 gates, receipt stamped). Root cause
  confirmed rather than assumed: the production call site passed the wrong base URL into the
  ripgrep resolver, so the pinned vendored binary never won and every cold resolution ran a
  1-second `spawnSync` PATH probe. Fix applied test-first (red → green), full sdk suite 717 pass /
  0 fail. Write targets released: `sdk/src/tools/code-search/executor.ts`,
  `sdk/src/__tests__/ripgrep.test.ts`. The sdk suite is no longer a push blocker.
- FID-2026-1016-013: `scripts/quality-report.ts`,
  `scripts/quality-report.test.ts`, `protocol.config.yaml`,
  `common/src/constants/protocol-bundle.generated.ts`, `common/src/constants/skills.ts`,
  `scripts/skills-check.ts`, `scripts/skills-check-content.ts`,
  `scripts/__tests__/skills-check-*.test.ts`, `coding-standards/**`,
  `.agents/skills/coding-*/SKILL.md`, `docs/adding-a-provider.md`,
  `docs/design/Savant Self-Improving Architecture Plan.md`,
  `desktop/public/floor-assets/robots/**`, `desktop/src/floor/**`,
  `scripts/orphan-sweep.ts`, `scripts/orphan-sweep.test.ts`,
  `scripts/session-end-review.ts`, `AGENTS.md`, `WINDOWS.md`, `README.md`,
  `CHANGELOG.md`, `cli/src/**`, `common/src/constants/**`, `common/src/util/**`,
  `packages/agent-runtime/src/find-files/**`, `scripts/eslint-rules/**`
  (this session, operator-ruled: the one tracked 400-line ceiling, the duplicate robot model,
  the orphan triage and the recurring sweep; write targets release at closure.)
- FID-2026-1016-016 and FID-2026-1016-017 are **closed and archived** (2026-10-17, receipts
  stamped, both implemented on commit `ec60a108`). Their write targets are released:
  `scripts/production-acceptance.ts`, `scripts/acceptance-check.ts`, `scripts/learnings-staleness.ts`,
  `scripts/learnings-validation.ts`, `scripts/lesson-feature-admission.ts`,
  `scripts/validate-repository.ts`, `scripts/__tests__/**`, `docs/production-acceptance.md`,
  `package.json`, `dev/feature-pipeline/**`. Two records because the register admits one owning FID
  per candidate: LF-005 (run-bound production acceptance) and LF-006 (stale lesson authority) shipped
  in one commit but could not share one owner.
- FID-2026-1016-019 is **closed and archived** (2026-10-17, 6/6 gates, receipt stamped, commit
  `8d735d34`). Its write targets are released: `evals/v2/skill-cases/**`,
  `evals/v2/tests/skill-trigger-routing.test.ts`, `SCOPE.md`, `CHANGELOG.md`. The trusted-catalog
  trigger-case reconciliation authored the three missing case files, re-pinned `release-workflow`'s
  hash to the deliberate FID-015 description rewrite and amended the quarantined-drafts premise to
  the documented ruling; the lane red was pre-existing and blocked the FID-2026-1016-018 push through
  the pre-push test chain. The same commit carried format-only prettier edits to four paths outside
  this surface (`cli/src/utils/openrouter-models/__tests__/ashna-catalog.test.ts`,
  `scripts/probes/ashna-census.ts`, `scripts/__tests__/lessons-to-skills-drafting.test.ts`,
  `scripts/lesson-feature-admission.ts`) — disclosed here because the register did not authorise
  them at the time, and the receipt's gate run includes them.
- FID-2026-1016-018 is **closed and archived** (2026-10-17, 17/17 gates, receipt stamped, commit
  `cc544ea3`). Its write targets are released: `common/src/providers/**`, `common/src/constants/**`,
  `cli/src/utils/openrouter-models/**`, `cli/src/utils/__tests__/**`,
  `sdk/src/impl/__tests__/**`, `docs/**`, `README.md`, `README.zh-CN.md`,
  `.env.example`, `cli/release/README.md`, `scripts/probes/ashna-census.ts`,
  `common/src/constants/provider-catalog-census.json`, `CHANGELOG.md`. The vendor-side inference
  leg remains plan-gated (429, verbatim in the FID); it unblocks with zero code changes on a paid
  plan. The FID number 016/017 stay held by the LF-005/LF-006 items.
- FID-2026-1016-015 is **closed and archived** (2026-10-17, 6/6 gates, receipt stamped, commit
  `bbffdc2d`). Its write targets are released: `scripts/lessons-to-skills.ts`,
  `scripts/__tests__/lessons-to-skills-drafting.test.ts`, `common/src/util/skill-proposals.ts`,
  `.agents/skills/**`, `dev/tracking/internal-followups.json`, `SCOPE.md`, `CHANGELOG.md`. The four
  quarantined drafts were trusted under the operator ruling, so `.agents/skills/.quarantine/` is empty.
- FID-2026-1016-014 is **closed and archived** (2026-10-16, 7/7 gates, receipt stamped, four
  commits `36c6855f`..`1502db60`). Its write targets are released: `cli/src/chat/panels.tsx`,
  `cli/src/components/skill-lifecycle-notice.tsx`,
  `cli/src/components/__tests__/skill-lifecycle-notice.test.tsx`,
  `desktop/src/floor/office/robot-cast.ts`, `desktop/src/floor/office/scene-agent-ui.tsx`,
  `coding-standards/x402.md`, `scripts/probes/**`, `scripts/orphan-sweep.ts`,
  `scripts/orphan-sweep.test.ts`, `CHANGELOG.md`
  (operator-ruled follow-ups to FID-2026-1016-013: the declared Step-4 surface is mounted and
  pinned by test, the office cast states one design, the recorded x402 deletion is executed, and
  hand-run probes have their documented home as a named sweep exclusion class.)
- FID-2026-1017-006 is **closed and archived** (2026-10-17, 5/5 gates, receipt
  stamped, commit `907e04f8`). Its write targets are released:
  `cli/src/components/free-options-panel.tsx`,
  `cli/src/components/__tests__/free-options-panel.render.test.tsx`, `SCOPE.md`,
  `CHANGELOG.md`, `dev/LEARNINGS.md`, `dev/session-summaries/**`.
  Follow-up to FID-2026-1017-005: a bare `{' '}` string child inside
  `TrafficLightPanel` is illegal for OpenTUI, so every boot showed the transcript
  boundary fallback and the serialized block. The fix removes the child and adds
  native-render pins; the operator's real 146-model / 223-offer report renders
  natively in both states. No live TUI session was run here (`tmux` absent).
