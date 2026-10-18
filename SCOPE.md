# SCOPE — Open Work Register

This register lists active work only. On closure, remove the item and its write
targets; retain evidence in the changelog, archived FID and session summary.
Every active FID and agenda task must be registered here. Machine-readable
targets grant write authority only for the corresponding open item.

Automation levels follow `dev/echo-v0.1.2-single-agent.md` and the session
ceiling in `protocol.config.yaml`. They do not override ECHO laws, credential
handling or repository boundaries.

## Open items

### FID-2026-1018-004 — repeatable run-4 acceptance instrument

- [ ] Automation level 3. Operator handoff authorizes all four run-3
  precondition repairs: unique proof target, observed dirty state before
  disposal, clean/ref checks immediately before merge, exclusive main writer.
  Preserve run-3 evidence, retained branch and prep stash. Prepare the run-4
  instrument and register, commit/push verified documents; the operator drives
  the next live run. No lifecycle code or acceptance claim is authorized here.

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

### FID-2026-1017-008 — live parallel-worktree acceptance (active)

Authority: automation level 3 (session ceiling). The task arrived as a loose
instruction; the interpretation below was presented on 2026-10-17 and the
operator approved it with two decisions: (1) the full live lane cycle
(create → lane commit → fast-forward merge → graph refresh → dispose) runs in
this repository; (2) the live phase is operator-driven — the operator executes
an A–Z live test inside the running CLI personally ("ill drive it … Ill do
the test manually"), with paid inference authorized under the operator's named
provider/model (`kiosapi`, `step-5-preview`), recorded by the run itself. The
earlier plan of an agent-run operator-CLI cycle was replaced by that election.
The agent delivers the run instrument and closes the record on the run's
evidence.

Objective: prove the FID-bound parallel worktree system (FID-2026-1017-007,
archived) end-to-end in the real repository through its production paths. This
session delivers: this converged record (the lane vehicle), the register
grant, and the A–Z live-test prompt
(`dev/test-prompts/az-parallel-worktrees-live-test.md`) that re-runs the
declared gate surface live and drives the full lane lifecycle with
operator-confirmed mutations, typed refusals, Law 2 lane-jurisdiction writes,
the merge with main-graph refresh, and dirty/discard disposal. The run's
report (`dev/scratchpad/active/FID-2026-1017-008-<run-stamp>-live-test-report.md`) and the
merged lane proof become the acceptance evidence; closure retires this record
and releases its write targets. Any discovered defect becomes its own
implementation FID. Claims stay within measured evidence.

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

- FID-2026-1018-004: `dev/test-prompts/**`, `dev/fids/**`,
  `dev/session-summaries/**`, `SCOPE.md`, `CHANGELOG.md`

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
- FID-2026-1016-013 is **closed and archived** (2026-10-16) — write targets
  released: `scripts/quality-report.ts`,
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
- FID-2026-1017-008: `dev/fids/**`, `SCOPE.md`, `CHANGELOG.md`,
  `dev/session-summaries/**`, `dev/test-prompts/**`,
  `docs/design/parallel-worktrees.md`, `docs/design/parallel-worktrees-lane-proof.md`,
  `docs/design/parallel-worktrees-lane-proof-*.md`
  (live parallel-worktree acceptance; active). No production source write is
  authorized by this item; a discovered defect opens its own implementation
  FID. Run 3 cleared the tool-schema blocker but returned DEFECTS FOUND from
  instrument preconditions and concurrent main writes. The next run uses a
  unique proof path and exclusive main access; acceptance remains unclaimed.
- FID-2026-1017-014 is **closed and archived** (2026-10-17, 6/6 gates, receipt
  stamped, commit `0dad50e5`). Its write targets are released:
  `common/src/tools/params/tool/fid-worktree.ts`,
  `common/src/tools/__tests__/fid-worktree-params.test.ts`,
  `common/src/tools/__tests__/tool-schema-object-root.test.ts`,
  `packages/agent-runtime/src/echo/parallel/fid-worktree-service.ts`,
  `dev/fids/**`, `SCOPE.md`, `CHANGELOG.md`. It repairs run 2's BLOCKER: the
  tool's root schema was a discriminated union, so the provider advertised no
  fields and every call was refused `invalid_union`. A class guard now fails
  any tool whose provider-facing root is not an object. No live acceptance is
  claimed; the third A–Z run remains the operator's.
- FID-2026-1018-001 is **closed and archived** (2026-10-18, 3/3 gates, receipt
  stamped, commit `00fa0959`). Its write targets are released:
  `docs/sdk-overview.md`, `dev/fids/**`, `SCOPE.md`, `CHANGELOG.md`. It closes the
  one documentation gap left after the provider work: the SDK environment
  reference annotated the BlazeRail and River keys but not Zylo's, leaving out
  that its catalog is public and keyless while the key is for inference only.
- FID-2026-1017-016 is **closed and archived** (2026-10-17, 10/10 gates, receipt
  stamped, commit `e22c06bf`). Its write targets are released:
  `common/src/providers/**`, `common/src/constants/**`,
  `cli/src/utils/openrouter-models/**`,
  `cli/src/utils/__tests__/provider-setup.test.ts`,
  `sdk/src/impl/__tests__/model-provider-free-mode.test.ts`, `.env.example`,
  `README.md`, `README.zh-CN.md`, `cli/release/README.md`, `docs/**`,
  `dev/fids/**`, `dev/session-summaries/**`, `SCOPE.md`, `CHANGELOG.md`. Zylo is a
  keyless text-only catalog: all 126 published text rows are kept (sparse
  capability metadata included) while image and custom sub-model arrays are
  excluded, the public fetch sends no Authorization header, and the provider
  sits at slot 18 ahead of the custom tail. The live census is preserved in
  `docs/reports/zylo-provider-live-check.md`; account entitlement, upstream
  availability and inference remain separately observed, never claimed here.
- FID-2026-1017-015 is **closed and archived** (2026-10-17, 12/12 gates, receipt
  stamped, commit `e22c06bf`). Its write targets are released:
  `common/src/providers/registry-partitioned-5.ts`,
  `common/src/providers/provider-exception-manifest.ts`,
  `common/src/constants/window-coverage-register.ts`,
  `common/src/constants/context-window-table-river.ts`,
  `cli/src/utils/openrouter-models/river.ts`,
  `cli/src/utils/openrouter-models/gateway.ts`,
  `cli/src/utils/openrouter-models/gateway-live-results.ts`,
  `cli/src/utils/openrouter-models/__tests__/river-catalog.test.ts`,
  `cli/src/utils/openrouter-models/__tests__/blazerail-catalog.test.ts`,
  `cli/src/utils/openrouter-models/__tests__/tier1-provider-catalog.test.ts`,
  `cli/src/utils/openrouter-models/__tests__/window-coverage-register.test.ts`,
  `cli/src/utils/__tests__/provider-setup.test.ts`,
  `sdk/src/impl/__tests__/model-provider-free-mode.test.ts`,
  `common/src/providers/__tests__/**`, `.env.example`, `README.md`,
  `README.zh-CN.md`, `cli/release/README.md`, `docs/**`, `dev/provider-identity/**`,
  `dev/fids/**`, `dev/session-summaries/**`, `SCOPE.md`, `CHANGELOG.md`. River is a
  registry-driven OpenAI-compatible gateway whose catalog is the account's own
  model list; the three documented 1,048,576-token windows are pinned and
  undocumented windows stay unknown. It takes ladder slot 17, before Zylo and
  the custom tail. The identity gauntlet stayed inconclusive; route
  reachability is not an identity verdict.
- FID-2026-1017-012 is **closed and archived** (2026-10-17, 5/5 gates, receipt
  stamped, commit `4f989510`). Its write targets are released:
  `packages/agent-runtime/src/echo/parallel/fid-worktree-service.ts`,
  `packages/agent-runtime/src/__tests__/fid-worktree-tool.test.ts`,
  `dev/test-prompts/az-parallel-worktrees-live-test.md`, `.markdownlintignore`,
  `dev/fids/**`, `SCOPE.md`, `CHANGELOG.md`. The root guard now retries only a
  git process that could not run; the A–Z instrument matches the code and the
  gates. The lane is prepped for the operator re-run: stale branch deleted,
  blueprint stashed. No acceptance is claimed by this record.
- FID-2026-1017-011 is **closed and archived** (2026-10-17, 7/7 gates, receipt
  stamped, commit `774eb705`). Its write targets are released:
  `packages/knowledge-graph/src/update-scan.ts`,
  `packages/knowledge-graph/src/extract.ts`,
  `packages/knowledge-graph/src/__tests__/refresh-safety.test.ts`, `dev/fids/**`,
  `SCOPE.md`, `CHANGELOG.md`. It repairs the open BLOCKER-2 from the
  FID-2026-1017-008 live run: the merge's graph refresh now completes live and
  the merged lane proof is indexed. The unsafe-root flake (BLOCKER-1) is not
  addressed here and the live A–Z cycle still awaits the operator re-run.
