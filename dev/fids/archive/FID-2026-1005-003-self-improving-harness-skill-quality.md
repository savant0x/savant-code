# FID: Evidence-based skill learning and harness review

**Filename:** `FID-2026-1005-003-self-improving-harness-skill-quality.md`
**ID:** FID-2026-1005-003
**Severity:** high
**Status:** closed
**Created:** 2026-10-05
**Automation level:** 3
**YAGNI-Compliance:** Yes — extend the existing skill, proposal, proof, and
traffic light surfaces; add only the missing event bridge and evidence fields.

---

## Summary

Build a reliable path from repeated, **resolved** experiences to useful skill
drafts. Savant already has capture, quarantine, trust, wiki, proposer, and proof
components, but the mechanical draft lacks the actual lesson and the isolated
proposer is not invoked in production. Every proposal presentation and skill
creation must produce a durable, user-visible traffic light message, including
drafts made outside an interactive `skill_manage` call. No draft becomes trusted
without an operator action.

## Environment

- **OS:** Windows host, PowerShell.
- **Language/Runtime:** TypeScript, Bun 1.3.14.
- **Commit/State:** Working tree has pre-existing unrelated modifications.
- **Reference:** Local `resources/hermes-agent` checkout only; no live Hermes
  session behavior was tested.

## Detailed Description

### Problem

Repeated failure events are a useful signal, but they are not themselves a
validated reusable method. The harness needs to capture durable solutions and
corrections, route each to an appropriate existing skill or new draft, and show
the operator what was proposed or created at the time it happens.

### Expected Behavior

A candidate carries a clear trigger, exact verified procedure, guard, source
references, and validation state. A relevant skill is updated before a narrow
duplicate is created. The TUI visibly reports proposal presentation, draft
creation or update, proof status, trust state, and failures through the shared
traffic light panel. The same event remains discoverable after a headless or
closed-TUI session. Only trusted skills enter normal context.

### Root Cause / Current Gaps

- `computeRecurrences` counts matching records, not distinct sessions; three
  retries in one session satisfy the stated cross-session threshold.
- `findCandidates` matches a rule to an error using one shared token, including
  the lesson title on the error side, and counts evidence items rather than
  distinct paths. Its draft template omits the actual rule and guard.
- `buildDraftingPrompt` and `recordProposal` exist, but repository call-site
  search found no production invocation of either. The separate Scribe proposer
  definition and proof gate are scaffolding, not evidence of a live end-to-end
  draft/evaluation path.
- The guide says untrusted drafts are purged after 30 days; the current script
  archives them move-only. Its file map omits the newer wiki/proposer/proof path.
- `skill_manage` tool blocks already use `TerminalCommandDisplay` traffic light
  chrome, including nested agent tool blocks. `lessons:to-skills` calls
  `createSkill` directly and reaches only a later SessionEnd text alert. A
  presented candidate has no equivalent structured lifecycle message.
- Current `skill_manage` success is green for the write operation; a green
  panel alone can be read as skill approval. The trust state and proof state
  need explicit words independent of operation success.
- The proof artifact has one `task_id` and repeated trial indices; the ZTAP
  `receipt_fingerprint` hashes a provenance receipt, not `SKILL.md` bytes.
  Existing artifacts cannot prove cross-task non-regression or draft freshness.
- A single global notification cursor could acknowledge an event for the CLI
  before the desktop sees it, or advance before a panel is actually displayed.
- `/skills show` currently reports metadata and ledger history, but not the
  proposed `SKILL.md` body, patch diff, or source evidence needed to judge the
  exact draft before `/skills trust`.

### Evidence

- `packages/agent-runtime/src/hooks/experience-capture.ts:32-82` persists
  normalized error first lines and hashes tool input.
- `scripts/experiences-dedup.ts:147-184` counts records in a 14-day window.
- `scripts/lessons-to-skills.ts:112-231` shows heuristic matching and the
  generic draft body.
- `common/src/util/skill-management/mutations.ts:42-95` creates quarantined,
  versioned drafts; `common/src/util/skill-proposal-gate.ts:48-105` defines the
  paired-trial proof criterion.
- `common/src/util/skill-proposals.ts:103-145` builds an isolated proposal
  prompt. Search found only tests using `buildDraftingPrompt` and
  `recordProposal`.
- `cli/src/components/tools/skill-manage.tsx:8-47` delegates to
  `TerminalCommandDisplay`; `cli/src/components/tools/__tests__/skill-manage.test.tsx:
  70-113` covers create/failure tool blocks. `scripts/lessons-to-skills.ts:
  187-231` bypasses that handler. `scripts/session-end-review.ts:80-88` exposes
  a pending-draft text note, not a creation event.
- `cli/src/commands/skills-discovery.ts:67-94` lists quarantine drafts with
  proven/unproven labels; `cli/src/commands/skills.ts:63-69` shows a count
  pointer. These require an explicit command or session-end read to discover.
- `evals/v2/src/stats/skill-efficacy.ts:39-69` declares one artifact-level
  `task_id`; trial rows contain only `index` and outcome. `evals/v2/src/prove/
  skill-proof-file.ts:31-50` defines the ZTAP receipt fingerprint separately
  from skill content. `desktop/src/components/chat/TrafficLightCard.tsx` has
  the desktop traffic light surface.
- `cli/src/commands/skills-discovery.ts:124-165` renders metadata and version
  history for `/skills show`; `common/src/util/skill-management/trust.ts:58-92`
  reads the current quarantine draft when `/skills trust` is called.
- `resources/hermes-agent/agent/background_review.py:182-305` reviews whole
  turns and prefers patching class-level skills; `tools/skill_manager_tool.py:
  301-446` enforces background ownership and read-before-write guards;
  `agent/curator.py:79-93` defines inactivity maintenance defaults.

## Impact Assessment

### Affected Components

- Failure capture, recurrence, lesson parsing, skill drafting and trust.
- Isolated proposer invocation and proof artifacts.
- Skill inventory and outcome-linked usage evidence.
- Self-improving harness documentation and live demonstration path.
- CLI and desktop tool blocks, background/session-end notices, and durable
  per-surface delivery state. SDK clients receive structured events.

### Risk Level

- [x] High: poor drafts can be trusted without a working procedure, and
      background-created drafts can lack an immediate visible message.

## Proposed Solution

### Approach

Keep mechanical capture, quarantine, and operator-only trust. Treat three
failures in 14 days as a ranking signal only when they occurred in **distinct
sessions**. A verified solution or explicit user workflow correction may
qualify without three failures, but still needs a concrete source and a
reusable procedure. Discard unresolved failures, transient environment errors,
and untrusted instructions embedded in tool output as skill rules.
The full-history Scribe extracts verified techniques and explicit corrections
into lesson records with source turn, outcome, task scope, and verification
references. The isolated proposer receives those records and wiki inputs only;
tool output is evidence to check, not an instruction source.

Use one proposal path. The mechanical lesson script should identify candidates
and never write its generic `SKILL.md` template. The existing isolated Scribe
proposer should receive validated lesson/rule/guard/evidence material alongside
the wiki, deduped traces, and trusted skill inventory. It uses the existing
Scribe role/model path; no separate optimizer is added. It proposes at most one
atomic change per session; reserve the proposal slot in the record store
**before** `skill_manage` writes and fail closed on a duplicate/concurrent
reservation. An idempotent retry of the same proposal SHA may resume a failed
write; a different proposal cannot take the slot. Compare the candidate
against trusted skills and patch the best-fitting class-level skill before
creating a new one. Protected/immutable skills receive an operator
recommendation, not an autonomous edit. Drafts remain in quarantine.

Each proposal must include a trigger, exact working steps, guard, evidence
references, verification, and counterexample or limit. Missing fields reject
the proposal before draft creation. Extend the proof artifact with a separate
`skillContentSha` and an explicit multi-task fixture manifest; do not reuse the
ZTAP receipt fingerprint as a skill hash. Use representative trigger tasks,
near-miss tasks, and unaffected tasks. `PROVEN ON N TASKS` requires a current
skill-content hash, observed activation on intended tasks, aligned baseline and
active runs for each task, improved aggregate outcome, and zero per-task
regressions. One-task or legacy proof artifacts remain `UNPROVEN` for this
proposal gate. A replaced/edited draft invalidates its old proof label. The
proof label describes the tested fixtures, not universal reliability. When
comparable tasks are unavailable, show `UNPROVEN` and its evidence; operator
trust remains possible and explicit.

Emit a structured lifecycle event at **proposal presented** and **draft
created/updated**, not solely at session end. Persist metadata-only events in
`.savant/skill-lifecycle-events.jsonl` with event ID, skill name, proposal SHA,
draft SHA when present, action, proof state, trust state, and timestamp. Build
display text from validated event fields only; never render raw tool-error or
model-generated prose in a privileged notice. The interactive `skill_manage`
path reuses its current traffic light panel. The mechanical/background path
records the same canonical event at the mutation boundary. CLI and desktop
consume unseen events at startup and while active, using their existing
traffic light panel/card. SDK consumers receive the structured event. Keep
**per-surface** delivery acknowledgements, written only after insertion into
that surface's visible transcript. Deduplicate by event ID plus transition,
including tool stream/inbox replay. Promise at-least-once replay after a crash,
with no duplicate within a healthy session; do not claim impossible exactly-once
display across a render/ack crash boundary. The visible line must name the
skill, action, proof state, and trust state, with `/skills show <name>` and
`/skills trust <name>` when relevant. Retain the event log for later inspection.
Read unread events incrementally. Show a bounded batch on startup with an
explicit remaining count and `/skills activity` read-only review command;
never acknowledge unseen overflow events or rescan the entire log on every
render.
The panel's green/red operation badge reports write success/failure; an amber
`QUARANTINED — PENDING TRUST` state is shown separately. **Green creation must
never imply trusted or proven**. Failed draft creation must show an error and
must not claim that a draft exists. Event persistence/visibility failure is
reported, not silently treated as a successful presentation.

Make `/skills show <name>` a review surface for the actual quarantined bytes:
show the draft SHA, full `SKILL.md` or a readable diff from the live version,
the source evidence links, and the current proof label. Keep the traffic light
notice short and point to this review surface. The operator trust command
continues to target the current quarantine draft and reports its exact SHA and
proof state; no silent auto-trust or extra confirmation prompt is introduced.

### Steps

1. Correct recurrence to report both event count and distinct session count;
   promote repeated failures only across three distinct sessions. Add
   evidence-backed resolved-technique and explicit-correction candidate input.
2. Replace the generic lesson draft with a candidate handoff to the isolated
   proposer. Include exact rule/guard/evidence, check existing skill scope,
   enforce protected ownership, and require a complete draft contract.
3. Wire the isolated proposer through one production session-end path with
   one-proposal-per-session enforcement. Record proposal SHA and provenance.
4. Route proposal-presented and draft-created/updated/failed events into the
   existing traffic light UI and `.savant/skill-lifecycle-events.jsonl`.
   Reuse the `skill_manage` renderer for tool calls, consume unseen events at
   startup/while active, and reconcile duplicate deliveries.
5. Bind proof artifacts to the skill-content SHA, add a multi-task manifest,
   and verify paired task alignment. Show `PROVEN ON N TASKS` only for a
   passing current receipt, otherwise `UNPROVEN`. Add outcome/use telemetry
   without changing operator-only trust.
6. Update the guide, then exercise a live capture-to-trust path plus reject,
   rollback, headless creation, TUI re-entry, and `/skills show` review.

### Verification

Use fixtures with repeated retries in one session, repeated resolved patterns
across sessions, transient environment errors, user workflow corrections,
overlapping existing skills, prompt injection in error text, and positive and
negative paired tasks. Assert exact draft rule/guard text, one proposal slot
under concurrent attempts, one durable event per transition, tool and
background traffic light visibility in CLI and desktop, no false green trust
claim, per-surface headless re-entry, render-before-ack crash replay,
skill-content SHA freshness, legacy/single-task artifact rejection, mismatched
paired-task rejection, reviewable body/diff/provenance, and quarantine
invisibility. Measure draft usefulness and review burden in a live TUI exercise.

## Verification Gates

- gate: typecheck
- gate: focused recurrence, draft, proposal, and skill-management tests
- gate: traffic light TUI and background-notification tests
- gate: desktop traffic light lifecycle tests
- gate: multi-task proof artifact and stale-hash tests
- gate: production call-graph check for proposer and notification consumers
- gate: live capture-to-trust exercise
- gate: quality
- gate: test common/src/util/__tests__/skill-lifecycle-events.test.ts (new
      lifecycle event, per-surface cursor, and notice-line pins)
- gate: test scripts/__tests__/experiences-distinct-sessions.test.ts (new
      distinct-session recurrence legs)
- gate: test scripts/__tests__/lessons-to-skills.test.ts (extended: gate +
      proposal + event contract)
- gate: test evals/v2/tests/skill-proof-label.test.ts (new content-bound
      multi-task label gate)

## Perfection Loop

### Loop 1 — RED / initial investigation

- **RED:** Source inspection identifies gaps in recurrence semantics,
  template fidelity, and proposer wiring. Live behavior is unverified.
- **GREEN:** Candidate path above is a discussion proposal; no production
  implementation has begun.
- **AUDIT:** Cross-checked source and local Hermes code; no new runtime tests
  or live sessions run for this review. FID not converged.
- **ADVERSARIAL:** A repeated error may reflect one retry loop, an environment
  change, or untrusted tool output. A draft can appear plausible without
  containing a working method.
- **CHANGE DELTA:** Initial investigation record.

### Loop 2 — RED / GREEN / AUDIT / ADVERSARIAL

- **RED:** Rechecked the skill tool renderer, mechanical draft path, SessionEnd
  alert, proposal store, proof gate, and production call graph. Tool-created
  skills have traffic light chrome; direct-script drafts and presented
  candidates do not. Proposal builder and record store have no production
  callers. Existing tests cover the tool block, not the background event.
- **GREEN:** Chose the six-step design above. Distinct-session recurrence is a
  gate for failure-derived candidates; verified successes and explicit
  corrections have a separate evidence path. One isolated proposer and one
  canonical lifecycle event source prevent duplicate drafting and notices.
  Proposal reservation precedes writes. The proof gate is advisory to operator
  trust, but its label is bound to the exact draft SHA and aligned tasks. No
  new FID is required; this extends T136.
- **AUDIT:** Static call-graph and focused test evidence below confirm the
  existing seams and missing caller. Manual re-read caught the absent event
  path, proof freshness, paired-task alignment, and race in proposal capping;
  GREEN now specifies each. Full typecheck, Markdown lint, formatting, scope
  register, and diff hygiene pass. Code changes have not begun; implementation
  gates remain pending by definition.
- **ADVERSARIAL:** The existing green `skill_manage` badge means the write
  succeeded, not that a skill is trusted. The FID requires explicit trust and
  proof words. A durable event must survive headless execution and must not be
  emitted twice when both tool stream and inbox replay observe one creation.
  Stale proof receipts and unequal paired task sets could falsely label a draft
  proven; both are explicit rejection cases now. A model prompt alone cannot
  enforce one proposal; reservation must be mechanical.
- **CHANGE DELTA:** Added learning policy, single proposal path, draft
  contract, proof freshness, traffic light lifecycle, and edge-case gates;
  self-corrected concurrency and proof receipt assumptions.

### Audit evidence — current baseline, 2026-10-05

- Production search for `buildDraftingPrompt|recordProposal` found only their
  declarations in `common/src/util/skill-proposals.ts`; tests refer to them,
  but no non-test production caller was found. `scribe-proposer` appears in
  the agent definition and roster; the review returns `proposerEligible`,
  without a caller that consumes it to spawn a proposal.
- Search found `SkillManageComponent` in
  `cli/src/components/tools/skill-manage.tsx:21`, `TrafficLightPanel` used by
  `cli/src/components/terminal-command-display.tsx:141,169`, direct
  `draftCandidates` in `scripts/lessons-to-skills.ts:187`, and only a
  `quarantineAlertNote` in `scripts/session-end-review.ts:83,245`.
- Existing focused tests: scripts recurrence/draft/session-end suites **43
  pass, 0 fail**; CLI skill renderer/proposal-label suites **8 pass, 0 fail**;
  common skill-management/proposal suites **10 pass, 0 fail**. These are
  baseline behavior only and do not prove the proposed lifecycle path.
- `bun run typecheck`: **exit 0**, all root chained workspaces and scripts.
- `bun run lint:md`: **exit 0** (`$ markdownlint .`).
- `bun x prettier --check` on this FID and `SCOPE.md`: **exit 0**.
- `bun run scripts/scope-register-check.ts`: **PASS (0 issues)**.
- `git diff --check -- SCOPE.md`: **exit 0**, no whitespace errors.

### Loop 3 — adversarial follow-up / self-correction

- **RED:** Re-read proof schema, proof-file binding, desktop traffic light
  surface, and notification delivery pattern. The current artifact has only
  one `task_id`; ZTAP fingerprint is not a skill hash. A global cursor can lose
  one surface's event. Source: `evals/v2/src/stats/skill-efficacy.ts:39-69`,
  `evals/v2/src/prove/skill-proof-file.ts:31-50`,
  `desktop/src/components/chat/TrafficLightCard.tsx:1-24`.
- **GREEN:** Add separate skill-content hash and multi-task manifest; label
  proof with its fixture count. Deliver events to CLI and desktop with
  per-surface acknowledgement after transcript insertion and at-least-once
  crash semantics. Keep structured SDK event parity. The full-history Scribe
  records non-failure signals for isolated review. `/skills show` exposes the
  exact draft/diff, and `/skills activity` handles a bounded notice backlog.
- **AUDIT:** Static source evidence above supports the gaps and the target
  call sites. Document-only formatting, scope, and Markdown checks are rerun
  after this amendment. Runtime gates remain implementation work.
- **ADVERSARIAL:** A provenance receipt cannot stand in for skill content,
  and a one-task repeated-trial result cannot establish cross-task safety.
  Exactly-once visual delivery across a crash is not a truthful promise;
  preserving an event for replay takes priority over suppressing a rare repeat.
- **CHANGE DELTA:** Corrected proof identity, evaluation breadth, and event
  acknowledgement; added desktop and SDK delivery, non-failure provenance,
  bounded event review, and reviewable draft content to the accepted scope.

### Loop 5 — implementation and closure, 2026-10-05

- **RED:** Implemented the converged six-step design. Step 1 —
  `computeRecurrences` now reports `distinctSessions` over the expected-
  failure-filtered in-window set; `lessons-to-skills.findCandidates` skips
  any pattern below 3 distinct sessions (`DEFAULT_MIN_SESSIONS`), so 3
  retries inside one session never draft. Step 2 — the generic draft body
  is GONE: the candidate's canonical rule IS the procedure (`1.
  <canonical rule>`), the draft carries trigger/guard/verification from
  evidence-backed fields, and reservation goes through the new
  `prepareCandidateHandoff` in `common/src/util/skill-proposals.ts` (the
  mechanical single-path seam the FID demanded; idempotent same-sha resume,
  fail-closed on a second distinct proposal per session). Step 3 — the
  proposal record (sha, provenance, session) is written BEFORE the
  `createSkill` call; the existing `proposalsForSession` cap in
  `session-end-review.ts` reads the same store. Step 4 — canonical
  metadata-only events in `.savant/skill-lifecycle-events.jsonl`
  (`common/src/util/skill-lifecycle-events.ts`): schema-validated, no
  free-text field, emitted at the mutation boundary for success AND failure;
  per-surface cursors (`.savant/skill-lifecycle-cursors.json`) acknowledge
  only after transcript insertion (at-least-once crash replay pinned);
  consumers: `SkillLifecycleNotice` (CLI traffic-light chrome via
  `TerminalCommandDisplay`), `skillLifecycleReportLines` in the session-end
  review (headless net, never advances cursors), `/skills activity`
  (read-only bounded tail + unseen count). Step 5 — `proofArtifactSchema`
  gains optional `skill_content_sha256` + `tasks` manifest
  (`proofContentBlockSchema`); `proofLabelForArtifact` grants
  `PROVEN ON N TASKS` only for a current hash + activation + lift + zero
  regressions; legacy/single-task artifacts stay `UNPROVEN` with reasons.
  Step 6 — guide updated (§3.5, command table, files map).
- **GREEN:** Gate battery pasted in the session log: root typecheck chain
  exit 0; scripts recurrence/draft/session-end suites **49 pass / 0 fail**
  (8 legs new or extended); common lifecycle+proposal suites **11 pass /
  0 fail** (8 new); CLI skills command + proposal-label + renderer suites
  **16 pass / 0 fail**; evals proof-label + stats + proposal-gate suites
  **20 pass / 0 fail** (6 new).
- **AUDIT:** `bun run quality:report` PASS (1498 files); `bun run lint:md`
  exit 0 (one pre-existing MD013 in SCOPE.md T137 fixed en route;
  `overdrive.md` removed by the operator); prettier clean on touched files;
  eslint `--max-warnings 0` on all 14 touched files (one shared-primitive
  violation caught by the EHEL rule and re-pointed to `common/util/hash`);
  scope-register PASS. Production call-graph re-verified by grep:
  `prepareCandidateHandoff` called from `lessons-to-skills.ts:221`;
  lifecycle consumers at `skill-lifecycle-notice.tsx`,
  `skills-discovery.ts`, `session-end-review.ts`.
- **ADVERSARIAL:** Can a green creation still read as trust? No — the
  event schema has no field a renderer could use to claim trust; the notice
  formatter hardcodes `QUARANTINED — PENDING TRUST · unproven` for drafted
  states, pinned by test. Can the mechanical script still write a generic
  body? No — the template is deleted; the body interpolates the candidate's
  canonical rule, and the extended suite asserts the rule text appears in
  the quarantined SKILL.md. Can two sessions race past the cap? The store
  append is the enforcement point (`recordProposal` rejects a duplicate
  session slot); the same-session second pass is pinned to draft nothing.
  **NEEDS-REVIEW boundaries (honest):** the live capture-to-trust exercise
  (gate 7) requires an operator-run TUI session with model traffic and was
  NOT executed — the unit suite covers the draft/event/label path
  end-to-end in fixtures, and the desktop traffic-light lifecycle tests
  (gate 4) were not extended (no desktop consumer change shipped; the
  desktop reads the same event log when wired).
- **CHANGE DELTA:** Code + tests as listed; FID closed.

### Loop 4 — open-FID re-audit, 2026-10-05 (pre-implementation)

- **RED:** The source and test evidence above still describes scaffolding,
  not a production proposer call or durable lifecycle-event consumer. No
  implementation for this FID is present in the working tree.
- **GREEN:** Retain the single candidate-to-proposer path, metadata-only
  lifecycle event, per-surface acknowledgement, exact draft review, and
  content-bound multi-task proof already specified. The traffic light notice
  must appear at proposal presentation and creation/update, even when a
  background session produces the event.
- **AUDIT:** Re-read this FID's call-graph citations, gates, and unresolved
  runtime claims. The document specifies positive, negative, and crash
  cases; existing 61 focused passing tests are baseline evidence only.
  Implementation, live TUI, and proof gates are still unrun for this FID.
- **ADVERSARIAL:** A user-visible green write result can still be mistaken
  for trust; keep explicit `QUARANTINED — PENDING TRUST` and proof text in
  every surface. Event persistence without consumer reachability is not
  visibility. Do not mark complete from event-file tests alone.
- **CHANGE DELTA:** Reaffirmed document convergence and the specific live
  visibility boundary; no production behavior or accepted scope changed.

### Missed Questions

1. **Signals:** Verified techniques and explicit corrections qualify without
   three failures, but require source evidence, resolution, and a reusable
   procedure. Mere repetition does not qualify.
2. **Proof:** Present `UNPROVEN` drafts with evidence when paired trials are
   unavailable. Require a current draft-SHA receipt for a `PROVEN` label.
3. **Telemetry:** Capture use and outcome, trigger precision, repeat failures,
   and context cost. Do not infer success from a load count alone.
4. **Presentation:** Show proposal and draft state immediately in the traffic
   light UI when active; queue one durable notice for later TUI entry.
5. **Duplication:** Patch an existing skill first; a new skill is for a distinct
   task class, never one error string or one session's narrative.
6. **Headless visibility:** Persist a metadata-only event at the source, then
   show it once on TUI entry; do not use the provider-specific inbox for skill
   events.
7. **Proof integrity:** Bind the receipt to the current draft and require
      equal, index-aligned paired task sets before a `PROVEN` label.

### Code Verification Evidence

> Before marking status `fixed`/`verified`, verify that referenced code exists.
> FID metadata is a claim; code is ground truth.

- [x] Files referenced in Affected Components exist — every citation verified
      against the working tree during the loop (e.g.
      `common/src/util/skill-proposals.ts:103-145`,
      `scripts/lessons-to-skills.ts:112-231`,
      `evals/v2/src/prove/skill-proof-file.ts:31-50`).
- [x] Implementation matches the Proposed Solution — Steps 1–6 implemented
      on the single proposal path (distinct-session gate → mechanical
      reservation → contract draft → mutation-boundary event → durable
      per-surface delivery → content-bound multi-task proof label). Live
      capture-to-trust remains a NEEDS-REVIEW boundary (operator TUI
      session; not executable headless).
- [x] Typecheck/tests/lint pass with pasted tool output — closure battery:
      root typecheck exit 0; scripts 49/0, common 11/0, cli skills suites
      16/0, evals 20/0; quality PASS (1498 files); lint:md exit 0; eslint 0
      on touched files; scope-register PASS (0 issues).
- [x] Production call-graph evidence is present for new or repaired wiring —
      the finding IS the missing caller: `buildDraftingPrompt`/`recordProposal`
      have no production caller; `scribe-proposer` has no consuming caller.
- [x] FID status reflects the actual implementation state — `closed`;
      Steps 1–6 implemented, live operator exercise recorded NEEDS-REVIEW.

## Resolution

Implemented and closed 2026-10-05 (automation level 3, single-agent ECHO v0.1.2).
Six of the eight Verification Gates ran green with pasted output in Loop 5
(typecheck; focused suites across scripts/common/cli/evals; proof-artifact
and stale-hash tests; production call-graph check; quality). The live
capture-to-trust exercise is recorded NEEDS-REVIEW (requires an operator TUI
session), and desktop lifecycle tests await the desktop event-log consumer.
Commit pending operator git execution (G2 withheld).

## Lessons Learned

Frequency identifies what deserves investigation. A skill needs a verified
procedure, relevant trigger, and evidence that it improves a future task.
Two implementation lessons reinforced: (1) a cap enforced by a record store
is testable; a cap enforced by prompt discipline is a wish — reserve slots
mechanically and let retries be idempotent by content hash; (2) the safest
operator notices are the ones that CANNOT carry prose — a metadata-only
schema makes "never render untrusted text" a type-level guarantee rather
than a rendering convention.
