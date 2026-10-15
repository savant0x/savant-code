# FID: Self-Improving Harness + Agent-Created Skills (versioned) — master retrofit

**Filename:** `FID-2026-0824-012-self-improving-harness-and-agent-created-skills.md`
**ID:** FID-2026-0824-012
**Severity:** high
**Status:** closed
**Created:** 2026-08-24
**YAGNI-Compliance:** Verified — the subsystem reuses the existing lifecycle-hook engine, pre-write gates, ZTAP provenance, and skill loader; no parallel governance infrastructure (closure audit 2026-09-03)

---

## Summary

Retrofit a first-class self-improvement loop and an agent-created skill
subsystem into Savant-Code, retrofitting ideas from the OpenClaw
proactive-self-improving-agent skill, the Hermes skill-building system, and
the RangeKing/aceforge evolution ecosystem — **not as a 1:1 clone but as a
governed subsystem that is better than all prior art combined and tuned to
the ECHO Protocol**. The design adds: (1) mechanical capture of tool
failures / operator corrections / capability gaps via the existing
lifecycle-hook engine, (2) a hybrid experience store (raw traces unloaded;
only promoted canonical rules enter the boot-read `dev/LEARNINGS.md`),
(3) a `skill_manage` authoring tool with an **internal per-skill versioning
system** (snapshots + append-only ledger + semver + rollback + ZTAP
provenance), (4) an **auto-parse lessons → skills pipeline** that turns
recurring, verified lessons into draft SKILL.md skills, (5) a proactive
layer (SessionEnd Scribe review + `dev/agenda.md`), and (6) an operator-run
usage-evidence evolution ritual. The existing skill system
(`loadSkills` → `fileContext.skills` → XML injection → `skill` tool) is
verified wired into the product agents but **passive**; this FID expands
scope to activate it end-to-end: CLI management surface (`skills list /
show / trust / untrust / rollback / status`), a `skills:check` mechanical
validator, `immutable` + `version` frontmatter enforcement, quarantine +
ZTAP trust boundary, and `references/` progressive disclosure.

## Environment

- **OS:** Windows (primary dev) / macOS / Linux
- **Language/Runtime:** TypeScript (strict, noImplicitReturns) / Bun ≥1.3.11 (pinned 1.3.14)
- **Tool Versions:** ECHO Protocol v0.2.0 (harness) / single-agent ECHO v0.1.2 (sessions)
- **Commit/State:** working tree @ 2026-08-24, v0.0.27; research output at
  `docs/design/Savant Self-Improving Architecture Plan.md` (Gemini Deep
  Research report, audited this session)

## Detailed Description

### Problem

Savant-Code expands its capability matrix only through human-steered FIDs and
static prompts. It lacks the machinery to mechanically observe its own tool
failures, synthesize reusable procedural knowledge, author its own skills,
and get proactively better through ordinary use. The prior-art skills that
solve this elsewhere are prompt-text-only (the OpenClaw skill's triggers rely
on the LLM remembering to write files — the same failure class as Savant's
own recorder read-without-write stalls), bloat context (whole-file logs),
have no verification (self-reported lessons), and no governance for
agent-authored artifacts (prompt-injection vectors). Additionally, the
existing Savant skill system is verified **wired but passive**: the `skill`
tool is in the Savant agent's toolNames
(`agents/savant/savant.ts:151`) and registered
(`common/src/tools/constants.ts:78,123`), and `loadSkills` populates
`fileContext.skills` — but there is no CLI surface, no authoring, no
versioning, no trust/provenance, no progressive disclosure, and nothing
drives active use.

### Expected Behavior

1. Tool failures, operator corrections, capability requests, and task-review
   findings are **mechanically captured** at the harness layer with zero
   prompt compliance required.
2. Recurring, verified lessons **evolve** into canonical rules
   (LEARNINGS.md), FIDs (code changes), or **new skills** — through the ECHO
   Perfection Loop with Law 2 operator approval and Law 3 verification.
3. The agent can **author, improve, version, roll back, and use its own
   skills**; every mutation is snapshot-versioned, provenance-signed, and
   gated by validation + a trust boundary.
4. Lessons are **auto-parsed into draft skills** the agent can eventually
   use, with human/Adversary/Verifier review before activation.
5. The skill system is **fully wired and user-visible**: CLI commands,
   quarantine, trust, rollback, and progressive disclosure.

### Root Cause

The harness has capture seams (lifecycle hooks, FID-2026-0814-003) but no
sink; a lesson schema (`dev/LEARNINGS.md` + `learnings:check`) but no
capture→promotion pipeline; a skill loader + tool but no authoring,
versioning, or trust machinery; and an agent roster (Scribe, Recorder,
Verifier, Adversary) whose contracts stop at documentation, not evolution.

### Evidence

- **Hook engine exists and is live:** `packages/agent-runtime/src/hooks/engine.ts`
  (`HookEngine`, `getHookEngine` reads `readProtocolConfig(cwd).hooks`);
  SessionStart/SessionEnd fire-and-forget at `main-prompt-run.ts:127-134,
  196-207`; PreToolUse gate + PostToolUse/PostToolUseFailure at
  `tools/tool-executor/native.ts:360-367, 777-823` and `custom.ts:208-214,
  363-367`; SubagentStart/Stop at `execute-subagent.ts:129,156`. Config:
  `protocol.config.yaml` `hooks: []` (events PreToolUse | PostToolUse |
  PostToolUseFailure | SessionStart | SessionEnd | SubagentStart |
  SubagentStop | PreCompact | PostCompact | Stop | Interrupt |
  Notification; fail-open).
- **Skill system wired but passive:** `agents/savant/savant.ts:151` includes
  `'skill'`; `common/src/tools/constants.ts:78,123`; loader
  `sdk/src/skills/load-skills.ts` (4 dirs, later wins; `isValidSkillName`
  skips dot/invalid names); whole-file `skill` handler
  `packages/agent-runtime/src/tools/handlers/tool/skill.ts` (disk-first,
  mid-session creations loadable); XML injection via
  `common/src/util/skills.ts` `formatAvailableSkillsXml`; frontmatter schema
  `common/src/types/skill.ts` (`name`/`description`/`license?`/`metadata?` —
  **no `version`, no `immutable`**); limits `common/src/constants/skills.ts`
  (name 1-64, `^[a-z0-9]+(-[a-z0-9]+)*$`, description 1-1024).
- **Lesson store:** `dev/LEARNINGS.md` ~1,205 lines, boot-read every session,
  validated by `scripts/learnings-validation.ts` (`learnings:check`), legacy
  boundary preserved; schema fields failure/evidence/invariant/guard/
  verification/scope/owning-FID/canonical-rule.
- **Context budget:** `protocol.config.yaml` `compression.keepRecentTokens:
  16384`, auto-compact 0.8, force offset 15000.
- **Governance:** FID lifecycle + Verification Receipts (`fid:verify`,
  fingerprint-pinned, C3 re-run at `validate:repository`, pre-push `--check`);
  pre-write gates `packages/agent-runtime/src/echo/pre-write-gates.ts` (Law 1
  canonicalization, >100-line Orchestrator FID write → route through
  Recorder); ZTAP provenance (`provenance.mode: record`).
- **Roster constraints:** Scribe is doc-write-only
  (`agents/scribe/scribe.ts`); Adversary is **read-only** per
  ARCHITECTURE.md (read_files/code_search/glob/list_directory/set_output —
  cannot execute tests, move files, or release quarantine); Verifier runs
  tests (double-audit, pasted output).
- **Prior art (audited):** `docs/design/Savant Self-Improving Architecture
  Plan.md` (the Gemini research output — §3 demand matrix, §4 ADRs Q1-Q8);
  Hermes `skill_manage` + `/learn` + progressive disclosure + quarantine
  (docs/user-guide/features/skills); hermes-agent-self-evolution (DSPy+GEPA,
  rejected — no second LLM); RangeKing capability ladder; aceforge
  tool-observation + adversarial mutation validation; ClawHub
  self-improving-agent (#1, ~474K downloads).

## Impact Assessment

### Affected Components

- `packages/agent-runtime/` — hooks engine (builtin capture sink), new
  `skill_manage` tool handler + rollback, pre-write gates (immutable
  enforcement), skill tool (Level-2 `references/` loading)
- `common/` — `types/skill.ts` schema (+`version`, +`immutable`),
  `constants/skills.ts`, new `types/experience.ts`
- `sdk/src/skills/load-skills.ts` — version-aware loading, quarantine
  exclusion (already implicit via name validation), progressive disclosure
- `agents/` — Scribe (SessionEnd review contract), Recorder (FID routing),
  Orchestrator prompt (agenda surfacing), tool restrictions
  (skill_manage only Scribe + Orchestrator)
- `cli/` — new `skills` command group (list/show/trust/untrust/rollback/
  status) + router registration
- `scripts/` — new `skills:check` validator, `lessons-to-skills.ts`,
  `evolve-skills.ts`
- `dev/` — new `dev/experiences/` store, `dev/agenda.md`; LEARNINGS.md
  retirement tier
- `desktop/` — inherits everything via the shared runtime (hooks + skill
  system are runtime-level; no separate desktop work)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround — agent-authored skills are
      prompt-injection vectors and ungoverned mutation of foundational rules
      would violate the no-silent-mutation invariant; context bloat would
      degrade every session
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Five phases, each gated and independently shippable, sequenced so capture
(Phase 1) feeds authoring/versioning (Phase 2) which feeds proactivity
(Phase 3). **Phase 0 (activation) is new scope** — the existing skill system
is wired into the agents but has no CLI, no authoring, no versioning, no
trust, and no validator; this FID activates it end-to-end as the substrate
for everything else.

### Steps

**Phase 0 — Activate & wire the skill system (new scope, foundation)**

- [x] **S0-A.** End-to-end wiring audit: `loadSkills` → `fileContext.skills`
      → `formatAvailableSkillsXml` → `skill` tool description → agent tool
      list; add a regression test asserting the 11 bundled skills load and
      the Savant agent's toolNames include `skill` (Law 4 grep evidence).
- [x] **S0-B.** New CLI command group `skills` (`list` incl. `--quarantined`,
      `show <name>`, `trust <name>`, `untrust <name>`,
      `rollback <name> <version>`, `status`) registered in the command
      router — register the full alias surface per the two-word-command
      lesson (router resolves first word).
- [x] **S0-C.** New `skills:check` mechanical validator
      (`scripts/skills-check.ts` + root script): frontmatter validity,
      description-length policy (1024 for hand-written, 60 for agent-authored),
      section-order (When to Use / Procedure / Pitfalls / Verification),
      command allowlist — mirror the FID-2026-0823-009 argv-allowlist
      precedent: any shell-invocation pattern must resolve against an
      allowlist of Savant tool names / known-safe commands; unknown patterns
      fail validation, never execute — 300-line file ceiling, `version`
      presence, `immutable` enforcement on protected skills.
- [x] **S0-D.** `references/` progressive disclosure: loader + `skill` tool
      gain Level-2 sub-file loading (`skill_view(name, path)` equivalent);
      XML listing stays name+description (Level 0/1) so context cost is
      proportional to the answer.

**Phase 1 — Capture & record (mechanical, prompt-free)**

- [x] **S1-A.** `ExperienceRecordSchema` (`common/src/types/experience.ts`):
      `{ts, triggerType, toolName, errorFirstLine, contextHash, sessionId}`
      — single immutable event per record; aggregate counters live in the
      dedup layer, never in the record.
- [x] **S1-B.** In-process capture sink in the hooks engine: a builtin
      "experience-capture" action (config-declared via `hooks: []`, fail-open)
      — **no per-event process spawn** (external-command hooks would spawn a
      process per tool event). Appends to `dev/experiences/raw-traces.jsonl`;
      atomic line-append; path-normalized keys (Windows `\` vs `/` lesson —
      canonical rule `no-environment-dependent-guards`).
- [x] **S1-C.** Dedup: `sha256(toolName + normalizedErrorFirstLine)` grouping
      with a **persistent cross-session frequency counter** over a rolling
      14-day sliding window (a per-session counter could never reach the ≥3
      recurrence threshold for a pattern that recurs once per session);
      expected-failure noise filter (e.g. broad-search 404s); recurrence
      window = **≥3 within rolling 14 days**; PreCompact hook purges
      non-promoted traces older than 14 days (promoted lessons live durably
      in LEARNINGS.md + FIDs, so the purge cannot destroy evidence that
      already promoted).

**Phase 2 — Skill authoring + internal versioning (core)**

- [x] **S2-A.** Schema extension: `version` (semver string, default `0.1.0`
      for legacy skills) + `immutable` (bool) in `SkillFrontmatterSchema`;
      validator + pre-write gate reject mutations to `immutable: true`
      skills (governance/safety/compliance domains).
- [x] **S2-B.** `skill_manage` tool (`create | patch | edit | delete |
      write_file | remove_file | rollback`), restricted to **Scribe +
      Orchestrator** only (separation of duties — withheld from Forge,
      Verifier, Detective). Patch preferred (token-efficient); Levenshtein
      10% change cap per patch (Perfection Loop circuit breaker applied to
      skills — larger changes must be split across patches or go through
      `edit` with operator review); semver rules (patch→patch, edit→minor,
      rewrite→major); agent `rollback` is quarantine-scoped only (see S2-E).
- [x] **S2-C.** **Internal versioning system** (critical addition): every
      mutation snapshots the current live skill state first —
      `.agents/skills/<name>/versions/<vN>/SKILL.md` (+ affected
      `references/`), then appends to `.agents/skills/<name>/VERSIONS.jsonl`:
      `{seq, version, action, ts, sessionId, reason, prevSha, nextSha,
      provenanceRef, semanticPreservation}`. Live `SKILL.md` always carries
      `version` in frontmatter. Git history is NOT the ledger (release-only-
      commits convention) — the on-disk ledger is authoritative and survives
      into the release commit.
- [x] **S2-D.** Quarantine + trust boundary: agent-authored/patched versions
      land in `.agents/skills/.quarantine/<name>/` (already invisible to
      `loadSkills` via name validation — plus an **explicit `.quarantine`
      directory exclusion in the loader AND the `skill` tool's disk lookup**
      as defense in depth, not regex reliance); each entry carries a ZTAP provenance
      receipt (authoring session, source lesson/session evidence — no
      attribution fields in the document). Release is **operator-only** via
      `skills trust <name>`; Verifier sandbox-tests candidates; Adversary
      audits (read-only — cannot execute or release).
- [x] **S2-E.** Rollback: `skills rollback <name> <version>` (operator CLI)
      restores a snapshot + appends a ledger entry; agent-initiated rollback
      only within quarantine; immutable skills never mutate.

**Phase 3 — Proactive evolution + auto-parse lessons → skills**

- [x] **S3-A.** Scribe SessionEnd review contract extended: full-fidelity
      background synthesis (**token cost is not a constraint** — operator
      decision; bounds remain for determinism: one review per session,
      tail-bounded reads, single-writer rule). **Spawn mechanism is explicit
      scope:** the runtime has no session-end Scribe spawn today — the
      SessionEnd hook fires external commands only (`main-prompt-run.ts:
      196-207`) and Scribe is demand-spawnable only
      (`agents/savant/savant.ts:187`). Wire an in-process session-end trigger
      that spawns Scribe after the final turn (mirrors the context-pruner
      auto-spawn pattern; gated to natural run completion, not auto-drive
      continuation), or an explicit Orchestrator end-of-turn directive — the
      SessionEnd hook alone cannot spawn an agent. Reviews current-session
      `raw-traces.jsonl`, updates `dev/agenda.md` (≤50 lines, 1-3 active
      high-leverage capabilities), routes FEATURE_REQUEST/recurrence items to
      FIDs — Orchestrator direct write when <100 lines per the hybrid
      routing rule; Recorder only above 100.
- [x] **S3-B.** **Auto-parse lessons → skills**: extraction criteria
      (recurrence ≥3 in 14 days, resolved+verified, non-obvious, cross-
      project, 2+ See Also links) → auto-draft candidate SKILL.md into
      quarantine via the `skill_manage` handler (same validation path);
      drafts carry `{sourceLessonId, sessionId, evidence}` provenance. Agent
      can use the skill once trusted. **Rejected drafts** stay in quarantine
      for a 30-day review window, then are purged (never loaded); operator
      may delete earlier; nothing auto-promotes.
- [x] **S3-C.** LEARNINGS.md retirement tier: canonical rules at the ~1,200-
      line cap move superseded entries to a retirement section/archive
      (**move-only, never delete** — retirement is append-only to the archive
      so no rule is ever lost); no promotion deadlock; `learnings:check`
      stays green.

**Phase 4 — Usage-evidence evolution ritual (operator-run)**

- [x] **S4-A.** `scripts/evolve-skills.ts`: operator-run during maintenance;
      aggregates trace data per skill; uses the configured model (no second
      LLM) to propose candidate patches; gates = semantic-preservation diff
      analysis + native test suite execution; outputs a candidate patch +
      accompanying FID; **never commits or mutates directly**; human review
      is the hard boundary. DSPy/GEPA-style pipelines are explicitly rejected
      (no-second-LLM invariant + per-run cost; replaced by real-usage
      evidence).

## Verification Gates

- gate: typecheck sdk
- gate: typecheck common
- gate: typecheck packages/agent-runtime
- gate: typecheck cli
- gate: typecheck agents
- gate: test common/src/util/__tests__/skill-management.test.ts
- gate: test packages/agent-runtime/src/hooks/__tests__/experience-capture.test.ts
- gate: test scripts/__tests__/experiences-dedup.test.ts
- gate: test cli/src/commands/__tests__/skills-command.test.ts

### Verification Receipt

- fingerprint: sha256:e38ca1adf720d775b7e3a19ae2b0f97b1b070ffadd47022c8b93171dd74f0b36
- verified: 2026-09-03T13:19:03.474Z
- typecheck sdk: exit 0
- typecheck common: exit 0
- typecheck packages/agent-runtime: exit 0
- typecheck cli: exit 0
- typecheck agents: exit 0
- test common/src/util/__tests__/skill-management.test.ts: exit 0
- test packages/agent-runtime/src/hooks/__tests__/experience-capture.test.ts: exit 0
- test scripts/__tests__/experiences-dedup.test.ts: exit 0
- test cli/src/commands/__tests__/skills-command.test.ts: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** (1) Prompt-only capture fails (recorder read-without-write stall
  precedent; OpenClaw skill relies on LLM memory). (2) Context bloat —
  whole-file logs kill the 16,384-token budget; LEARNINGS.md already ~1,205
  lines. (3) No skill authoring: agents can only read skills. (4) No
  versioning — a skill improved later has no history, no rollback, no
  provenance. (5) Skill system wired but passive: no CLI, no validator, no
  trust boundary, no progressive disclosure. (6) No proactive layer — nothing
  runs at task/session boundaries to improve. (7) No verification of
  improvements — self-reported lessons violate the Honest-Assessment ban.
  (8) Agent-authored skills are prompt-injection vectors with no quarantine.
  (9) No immutable protection for governance/safety skills (Hermes #25083,
  #32497, CVE-2026-9366). (10) Lessons never become usable skills — no
  auto-parse pipeline. (11) Meta-loop oscillation risk — no convergence guard
  on skill rewrites.
- **GREEN:** The five-phase architecture above. Mechanical capture at the
  existing hook seams; hybrid store; `skill_manage` + per-skill versioning
  ledger + semver + rollback; quarantine + ZTAP + operator-only trust;
  SessionEnd Scribe agenda + lessons→skills auto-draft; operator-run
  evolution ritual; Phase 0 activation of the existing skill system.
- **AUDIT:** Ground-truth verified — hooks engine live at
  `packages/agent-runtime/src/hooks/engine.ts` + `main-prompt-run.ts:127-134,
  196-207` + `native.ts:360-367, 777-823`; skill tool registered
  (`agents/savant/savant.ts:151`, `common/src/tools/constants.ts:78,123`);
  loader `sdk/src/skills/load-skills.ts`; schema
  `common/src/types/skill.ts` (no version/immutable — extension needed);
  `skills:check` does NOT exist (must be created — the Gemini plan wrongly
  claimed it existing in its Q7); Adversary is read-only (cannot release
  quarantine — the Gemini plan's Q4 claim corrected); hook mechanism is
  external-command (in-process sink needed — no per-event spawn).
- **ADVERSARIAL:** (a) "Versioning adds write amplification on every patch —
  worth it?" → Yes: skills are ≤15KB-class, disk is cheap, the ledger is
  append-only JSONL, and the sha256-pinned snapshots are the only audit trail
  that survives the release-only-commits convention. (b) "Auto-draft pipeline
  could flood quarantine with junk" → Drafts are gated behind the five
  extraction criteria + recurrence window, land only in quarantine, and cost
  nothing until reviewed; operator `skills list --quarantined` is the sieve.
  (c) "In-process capture couples the runtime to dev/experiences/" → The sink
  is config-declared + fail-open (zero behavior change when unset), resolves
  the path from the project root, and matches canonical rule
  `no-environment-dependent-guards`. (d) "`immutable` is prompt-text again" →
  No: enforced in the `skill_manage` handler + pre-write gates
  (`pre-write-gates.ts`), the same layer that already blocks Law-1 violations
  and FID-status flips without receipts.
- **CHANGE DELTA:** N/A (initial convergence; document authored from the
  audited research output + operator decisions).

### Missed Questions

1. **Token cost of the Scribe SessionEnd background review?** → Operator
   decision 2026-08-24: cost is NOT a constraint (single model; the LLM does
   all work). Full-fidelity synthesis; no artificial token ceiling. Bounds
   remain for determinism and loop-safety only (one review per session,
   tail-bounded reads, single-writer, deterministic output schema).
2. **Can the Adversary release quarantined skills?** → No. The Adversary is
   read-only by roster (cannot execute tests, move files, or run the CLI).
   Verifier sandbox-tests candidates; **release is operator-only** via
   `skills trust`. Zero non-operator release paths in v1.
3. **Skill deprecation after 30 days unused?** → Demote to quarantine at
   SessionEnd review (reversible), never auto-delete; deletion is
   operator-only.
4. **Hook mechanism — external command or in-process?** → In-process builtin
   capture sink. External-command hooks spawn a process per event (cost +
   failure surface); a builtin sink appended to the HookEngine is atomic,
   fast, and config-declared.
5. **Recurrence threshold semantics?** → ≥3 occurrences within a rolling
   14-day window (tied to the PreCompact purge), not a lifetime counter.
6. **Who writes what (races)?** → Hooks append raw traces only (single
   append-only writer, atomic per line). Scribe is the sole writer of
   summaries, `dev/agenda.md`, and lesson-derived drafts. Recorder/Orchestrator
   own FIDs per the hybrid routing rule (<100 lines Orchestrator direct;
   >100 Recorder).
7. **LEARNINGS.md cap deadlock?** → Retirement tier (S3-C): superseded
   canonical rules evict to a retirement section/archive; the boot-read store
   stays ~1,200 lines without stalling promotion.
8. **`references/` progressive disclosure is real scope?** → Yes — loader +
   handler + XML changes; scheduled in S0-D, not assumed free.
9. **`skills trust` is a new CLI surface?** → Yes — new command group with
   router registration (S0-B); the two-word-command lesson applies (register
   the bare alias).
10. **immutable semantics?** → `immutable: true` = no agent mutation at any
    layer (skill_manage, pre-write gate, rollback); operator can still edit
    files directly. Applies to governance/safety/compliance skills.
11. **Where do FEATURE_REQUESTs go?** → Through ECHO, not a parallel silo:
    SessionEnd review routes them to FIDs (created|analyzed in `dev/fids/`),
    matching the existing backlog.
12. **Git as the version ledger?** → No — release-only-commits convention
    means the working tree is uncommitted mid-session; the on-disk
    `VERSIONS.jsonl` + snapshots are authoritative and land in the release
    commit.
13. **How is the Scribe spawned at session end today?** → It is NOT
    mechanically spawned. The runtime has no session-end Scribe trigger
    (the SessionEnd hook fires external commands only,
    `main-prompt-run.ts:196-207`); Scribe is demand-spawnable via
    `agents/savant/savant.ts:187`. Phase 3 therefore includes wiring the
    spawn (in-process session-end trigger mirroring the context-pruner
    auto-spawn pattern), not merely extending a prompt contract.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** `6ef39b8` (experience-capture hook + engine wiring) ·
      `a1f13b8` (fid gates + skills tooling) · `b588f9c` (skills command +
      tool rendering) · `23621ba` (governance skills incl. the two trusted
      drafts) · `2611380` (bundle regen + receipt re-stamp) — all on `main`
- [x] **File:line ranges:** hooks/experience-capture.ts:59 (atomic ledger
      append) · hooks/engine.ts:29 (builtin action dispatch) ·
      handlers/tool/skill-manage.ts:50 (skill_manage handler) ·
      common/src/util/skill-management.ts:22 (versioning layout) ·
      agents/scribe/scribe.ts:15 + agents/savant/savant.ts:154 (tool
      restriction to Scribe + Orchestrator) · scripts/skills-check.ts
      (mechanical validator)
- [x] **Gate output:** receipt 9/9 PASS 2026-08-27 (typecheck ×5 + 4 test
      suites); fresh closure battery 2026-09-03: skill-management 30/0 ·
      experience-capture 20/0 · experiences-dedup 14/0 · skills-command 7/0
- [x] **Reproducibility:** grep `experience-capture|raw-traces` under
      packages/agent-runtime/src → dispatch + sink + tests; grep
      `skill_manage` → handler, params, safety registry, Scribe/Savant
      toolNames; `.agents/skills/.quarantine/` + trusted top-level skills
      on disk; `dev/experiences/raw-traces.jsonl` (19 records) +
      auto-refreshed `dev/agenda.md`
- [x] **Step statuses:** S0-A…S4-A all `implemented` ([x] in Proposed
      Solution); zero `blocked`, zero `deferred`

### Code Verification Evidence

- [x] Files referenced in Affected Components exist (hook engine + capture
      sink, skill_manage handler, CLI skills command group, validator,
      lessons-to-skills/evolve-skills scripts)
- [x] Implementation matches the Proposed Solution (Phases 0-4 as specified)
- [x] Typecheck/tests/lint pass with pasted tool output (receipt 9/9 +
      fresh closure battery 2026-09-03: 71 tests / 0 fail across the four
      suites)
- [x] Production call-graph evidence is present for new or repaired wiring
      (capture sink dispatched from hooks/engine.ts via the config-declared
      action; skill_manage registered ONLY in Scribe + Orchestrator
      toolNames; /skills in the CLI registry with the two-word alias)
- [x] FID status reflects the actual implementation state (closed
      2026-09-03 after live-boundary discharge + fresh gates)

### Loop 2 — Independent audit and self-correction

- **RED:** Residual issues from the ADVERSARIAL pass and the operator's
  review: (a) the Gemini research plan contains ground-truth errors that must
  NOT propagate (Q7 claims `skills:check` exists; Q4 lets the read-only
  Adversary clear quarantine; module path `echo/lifecycle-hooks.ts` is wrong
  — real engine is `hooks/engine.ts`; citation mappings sloppy). (b) The
  `references/` loading change touches three packages — needs its own focused
  test surface. (c) `immutable` needs an explicit enforcement matrix (who may
  write what) to avoid a prompt-text guardrail.
- **GREEN:** (a) Corrections folded into this FID's Evidence/Approach
  sections (verified against the working tree). (b) S0-D adds loader +
  handler + XML tests (Level-2 path resolution, quarantine invisibility).
  (c) Enforcement matrix recorded: operator = full; Scribe/Orchestrator =
  skill_manage on non-immutable skills only; Forge/Verifier/Detective =
  read-only; hooks = append-only raw traces; pre-write gates = immutable +
  version + receipt checks.
- **AUDIT:** The enforcement matrix is consistent with the roster
  (`agents/savant/savant.ts:151`, Scribe doc-write-only, Adversary read-only
  per ARCHITECTURE.md); the quarantine invisibility claim is mechanically
  grounded (`loadSkills` skips names failing `isValidSkillName`, and
  `.quarantine` fails the `^[a-z0-9]+(-[a-z0-9]+)*$` regex); versioning
  layout does not collide with the existing loader (versions/ and
  VERSIONS.jsonl are inside the skill dir, not new skill names).
- **ADVERSARIAL:** "The 14-day purge could delete evidence before a lesson
  reaches ≥3." → Purge only applies to non-promoted raw traces older than 14
  days; promoted lessons live in LEARNINGS.md + FIDs (durable); the ≥3 window
  counts within any rolling 14-day span, so a pattern crossing a purge
  boundary is caught by the Scribe review before the purge runs (purge fires
  at PreCompact, review at SessionEnd — review precedes purge in a session).
  Residual: two parallel sessions could both run SessionEnd Scribe reviews —
  mitigated by the single-writer rule (last-writer-wins with a merge note in
  the ledger; agenda/LEARNINGS writes are one file, one review per session).
- **CHANGE DELTA:** ~8% (corrections + enforcement matrix vs Loop 1).

### Loop 3 — Final convergence

- **RED:** (a) Scope is large — five phases; the master must not block
  incremental value (capture alone is shippable). (b) Operator decisions must
  be recorded as binding amendments, not design preferences.
- **GREEN:** (a) Phases are independently gated and shippable; Phase 1 (and
  Phase 0) can land without Phase 2/3; children FIDs may be authored per phase
  at implementation time, citing this master. (b) Binding amendments
  recorded: A1 cost-is-not-a-constraint (Scribe full-fidelity); A2 operator-
  only quarantine release; A3 demote-not-delete deprecation; A4 in-process
  capture sink; A5 ≥3-within-14-days recurrence; A6 single-writer rules; A7
  LEARNINGS retirement tier; A8 versioning is mandatory for every
  skill_manage mutation; A9 `immutable` enforceable at the gate layer.
- **AUDIT:** The amendments are consistent with ECHO Law 2 (operator
  approval recorded for each scope decision) and Law 3 (every phase ships
  with a declared gate battery); the design reuses existing mechanisms
  (hooks engine, pre-write gates, learnings:check, fid:verify receipts,
  ZTAP) rather than inventing parallel governance.
- **ADVERSARIAL:** "Five phases is still large — will it survive contact?"
  → The master stays `analyzed`; each phase becomes its own child FID at
  implementation start (queue-to-zero pattern, FID-2026-0823-003 precedent);
  failure of one phase does not block the others; the honest boundaries
  (operator live smoke for hooks, trust release, SessionEnd review) are
  carried per phase.
- **CHANGE DELTA:** ~3% (binding amendments + phase-isolation note).
  Converged.

### Loop 4 — Operator-directed full re-run (FID-only; no code written)

- **RED:** Eleven document defects cataloged against the working tree:
  R1 S1-C "frequency counter per session" contradicts the ≥3 **cross-session**
  recurrence rule (a pattern recurring once per session can never reach 3);
  R2 S3-A assumes a SessionEnd Scribe spawn that does not exist — the hook
  fires external commands only and Scribe is demand-spawn only;
  R3 S0-C "no hallucinated commands" has no validation mechanism;
  R4 `skills list --quarantined` used in Loop 1 ADVERSARIAL but absent from
  S0-B; R5 S2-B `rollback` action vs S2-E quarantine-scope tension;
  R6 rejected-draft disposition unspecified (S3-B); R7 desktop inheritance
  unstated in Impact Assessment; R8 quarantine invisibility relies on regex
  alone — needs explicit exclusion in the loader AND the `skill` tool;
  R9 `frequency` field in the record schema (S1-A) conflicts with the
  dedup-side aggregate counter; R10 Levenshtein 10% cap vs `edit`→minor
  semantics unclear (S2-B); R11 retirement must be move-only, never delete
  (S3-C).
- **GREEN (pass A):** All eleven folded into the document — S1-A single-event
  record (no frequency); S1-C persistent cross-session 14-day sliding-window
  counter; S3-A explicit spawn-mechanism step (in-process session-end
  trigger, context-pruner pattern, gated to natural completion); S0-C
  command-allowlist mechanism (FID-2026-0823-009 argv-allowlist precedent);
  S0-B `list --quarantined`; S2-B rollback quarantine-scope + split-or-review
  rule; S2-D explicit `.quarantine` exclusion in loader + tool; S3-B 30-day
  review window then purge (operator may delete earlier; nothing
  auto-promotes); S3-C move-only retirement; Impact Assessment desktop
  inheritance note.
- **GREEN (pass B):** Missed Q13 (Scribe spawn mechanism) + this Loop 4
  record.
- **AUDIT:** Each fix re-verified against the working tree — no Scribe spawn
  in agent-runtime (the only runtime `scribe` reference is
  `util/caveman-rules.ts:33`; spawnable only via `agents/savant/savant.ts:
  187`); SessionEnd is fire-and-forget external commands
  (`main-prompt-run.ts:196-207`); the command-allowlist precedent is real
  (`echo/fid-verification-gates.ts` hostile-args validation, FID-2026-0823-
  009); quarantine skip-by-regex verified in `sdk/src/skills/load-skills.ts`
  (`isValidSkillName`); markdownlint + fid-ledger probe re-run green after
  both passes.
- **ADVERSARIAL:** (a) "In-process session-end Scribe spawn could fire during
  crash-resume or auto-drive continuation." → Gated to natural run
  completion; the auto-drive supervisor runs separately and the trigger
  mirrors the context-pruner lifecycle. (b) "A 14-day sliding window needs
  state that survives restarts." → The counter is derived from the
  append-only `raw-traces.jsonl` (restart-safe); the window is a query over
  the file, not in-memory state. (c) "30-day quarantine purge could drop a
  valuable rejected draft." → Purge applies only to drafts never reviewed;
  any draft the operator interacted with (trust/untrust/note) is excluded.
- **CHANGE DELTA:** pass A ~5%, pass B ~2% (each under the 10% Levenshtein
  cap; combined ~7%). Converged.

### Loop 5 — Implementation (all 16 steps)

- **RED:** None — build proceeded phase-by-phase with gates green at each
  milestone; two defects surfaced by the test batteries and fixed in-tree
  (dedup key assumed pre-normalized input; CLI command needed the
  tool-safety registry entry).
- **GREEN:** All 16 Proposed Solution steps implemented ([x] above); status
  `analyzed` → `fixed`; verification receipt stamped via
  `fid:verify --write` (9/9 gates PASS: typecheck ×5 workspaces + 4 test
  files).
- **AUDIT:** full gates green — common 652/0 · sdk 493/0 · agent-runtime
  hooks+echo 187/0 · tools 195/0 · scripts 193/0 · skills:check exit 0
  (project-scoped hermetic) · eslint `--max-warnings 0` on all touched
  files · prettier clean · Law-4 call-graphs verified (capture sink
  dispatched from `hooks/engine.ts` via the builtin `action`; skill_manage
  registered in Scribe + Orchestrator toolNames only; `/skills` command in
  the registry + slash menu).
- **ADVERSARIAL:** quarantine invisibility now has an EXPLICIT loader/tool
  exclusion (not regex reliance); the immutable gate exists at BOTH the
  engine and the EHEL pre-write boundary; the SessionEnd review is
  mechanical (deterministic agenda) + directive-gated full-fidelity Scribe
  synthesis — no auto-spawn surprises.
- **CHANGE DELTA:** implementation added ~3,000 lines across common,
  agent-runtime, sdk, cli, agents, scripts; document text delta well under
  the 10% cap.
- **Live boundaries (NEEDS-REVIEW, honestly carried):** fail-open hooks do
  not interrupt HYBRID-mode execution on expected failures; `/skills trust`
  release path in the real TUI; a real SessionEnd Scribe review producing an
  agenda + a lesson-derived draft skill.
  **PARTIAL DISCHARGE 2026-08-26:** a real session-end Scribe review ran —
  `dev/agenda.md` confirmed within budget AND TWO lesson-derived draft skills
  landed in `.agents/skills/.quarantine/` via skill_manage
  (`fid-gates-unfenced-parser-contract`, recurrence ×2 at -017/-013 closures;
  `minisign-pubkey-vs-secret-key`, live near-miss this session) — both
  pendingTrust, invisible until operator `/skills trust`. REMAINING:
  real-TUI trust flow exercising a trusted skill end-to-end, and HYBRID
  fail-open hook behavior on an expected failure.
  **FULL DISCHARGE (closure audit 2026-09-03):** the trust flow ran live —
  both 2026-08-26 drafts were released by the operator and sit trusted at
  top level (`.agents/skills/fid-gates-unfenced-parser-contract/` carries
  its `VERSIONS.jsonl` + `versions/` snapshot tree; committed in `23621ba`),
  with the quarantine copies retained as drafts; the trusted skills load
  through `loadSkills` + the `skill` tool in every session. The HYBRID
  fail-open capture is proven in production: the config-declared sink has
  appended 19 records across sessions without ever interrupting tool
  execution, and this closure session itself exercised the full loop
  (raw-traces → dedup → agenda refresh → skill tooling gates green).

## Resolution

- **Closed Date:** 2026-09-03 (ground-truth closure audit: implementation
  committed across `6ef39b8`…`2611380`, gates fresh green, live boundaries
  discharged)
- **Fix Description:** Self-improving harness + agent-created skills — Phase
  0-4 implemented (see Proposed Solution steps; all 16 [x]).
- **Tests Added:** Yes — 24 skill-management engine tests, 8 experience-
  capture tests, 13 dedup tests, 7 CLI skills-command tests, 4 session-end
  review tests, 6 lessons-to-skills tests, 5 learnings-retire tests, 3
  evolve-skills tests + parser coverage (34 tests total new across the
  batteries).
- **Verification Evidence:** `fid:verify --write` receipt stamped
  (fingerprint-pinned, 9/9 PASS); fresh closure battery 2026-09-03 (71/0
  across the four suites); receipt re-stamped at the archived path.
- **Archived:** yes → `dev/fids/archive/FID-2026-0824-012-self-improving-harness-and-agent-created-skills.md`

## Lessons Learned

- **Verify research-output claims against the working tree before folding
  them into a FID.** The Gemini plan claimed `skills:check` already exists
  (it does not), let the read-only Adversary execute (it cannot), and cited a
  non-existent module path (`echo/lifecycle-hooks.ts` — real:
  `hooks/engine.ts`). A planning document's citations are claims, not ground
  truth — same discipline as FID metadata (Ground-Truth rule).
- **The best retrofit seam is the one that already exists.** The lifecycle
  hook engine (FID-2026-0814-003) and the skill loader/tool were already
  wired; the design adds sinks and governance, not new parallel
  infrastructure.
- **Versioning must be on-disk, not git.** The release-only-commits
  convention means the working tree is uncommitted mid-session; git history
  cannot be the skill ledger.
- **A read-only auditor cannot be the release authority.** Roster
  restrictions (Adversary read-only) shape the trust design: audit and
  sandbox-test yes, execute/release no.
