# FID: Skill lifecycle changes are invisible — live traffic-light notification + quarantine surfacing

**Filename:** `FID-2026-0910-001-skill-lifecycle-live-notification.md`
**ID:** FID-2026-0910-001
**Severity:** high
**Status:** fixed (implemented + gates green 2026-09-10; closure/archive
pending the path-scoped commit per G2)
**Created:** 2026-09-10 00:20
**YAGNI-Compliance:** Verified (three surfaces, all reuse of existing chrome; no new
panels, no new event bus, no sidebar badge)
**Related:** FID-2026-0824-012 (self-improving harness), FID-2026-0908-001
(skill_manage output template parity), FID-2026-0822-006 (TrafficLightPanel
primitive), FID-2026-0821-007 (result-bearing renderer reuse pattern),
FID-2026-0824-016/-018 (proof/erosion advisories at trust time)

---

## Summary

The self-improving harness drafts skills into quarantine, but the
presentation stage does not exist: skill creation/update renders nowhere in
the chat (skill_manage is absent from the tool renderer registry and falls
to the header-only collapsed fallback), the mechanical SessionEnd review
never mentions drafts, and no proactive surface exists — the quarantine
count is on-demand only (bare `/skills` prints it, `/skills list
--quarantined` lists it, but nothing ever pushes it at the operator who
doesn't already know to look). In the origin repository this means three
drafts have accumulated invisibly (two 2026-08-26 lesson-derived drafts, one
2026-09-08 operator-directive edit to release-workflow), `/skills trust` has
been used zero times ever, and the live release-workflow skill still ships
the superseded 0.1.0 release cadence while its replacement decays in
quarantine. This FID converges three surgical surfaces: (P1) a dedicated
`SkillManageComponent` reusing TerminalCommandDisplay so every skill_manage
call — main-agent or subagent — renders live in the chat with the traffic
light chrome, ✓/✗ exit-status badge, and the engine's own
"quarantined, pending operator trust" line; (P2) an explicit pending-draft
pointer appended to `/skills list`; (P3) a deterministic, zero-LLM SessionEnd
alert with an engine-owned quarantine counter. Nothing auto-promotes; the
trust boundary is untouched.

## Environment

- **OS:** Windows 11 (win32), Git Bash (MSYS)
- **Language/Runtime:** TypeScript 5.5.4 / Bun 1.3.14 (pinned)
- **Tool Versions:** savant-code v0.0.30 tree; model
  tokenrouter/z-ai/glm-5.3-free (flash-class)
- **Commit/State:** working tree after FID-2026-0909-006/007 authoring;
  three quarantined drafts on disk; zero historical trust actions

## Detailed Description

### Problem

1. **Live invisibility.** When the Scribe (or Orchestrator) runs
   `skill_manage` — the moment a skill is created, patched, or edited — the
   tool block renders through the generic collapsed fallback. FID-2026-0908-
   001 already standardized the handler's output to the canonical
   command-class template (`{stdout, stderr, exitCode}` + identity fields)
   explicitly so the CLI could render it, but the registration never
   happened. The operator asked for the traffic-light command output in the
   chat; the machinery to satisfy it exists unused.
2. **Boundary invisibility.** `scripts/session-end-review.ts` (117 lines,
   wired via the SessionEnd hook) refreshes the learning agenda and prints
   FID-routing notes, but contains zero references to skills, quarantine,
   or drafts. Mechanical drafts (from `lessons:to-skills`) never pass
   through the chat at all, so nothing anywhere announces them.
3. **On-demand-only counts.** Bare `/skills` already prints
   `Quarantined (pending trust): **N**`, and `/skills list
   --quarantined` exists — but both require the operator to already know
   the state exists. `/skills list` (the natural first command) shows the
   trusted view with no pointer that drafts are waiting.

### Expected Behavior

Every skill lifecycle mutation visible to the operator at the moment it
happens, plus a deterministic net for non-chat draft sources:

- A `skill_manage` tool call renders in the chat stream (main agent and
  subagent branches alike) with the shared traffic-light chrome: the
  synthesized command label `skill {action} {name}`, ✓/✗ status badge from
  `exitCode`, expandable stdout/stderr, and the engine's own human-readable
  line including `— quarantined, pending operator trust` when applicable.
- `/skills list`, when quarantined drafts exist, appends one explicit
  pointer line naming the count and the exact follow-up command. Silent
  when zero.
- The mechanical SessionEnd review prints one alert line when drafts
  pend, using an engine-owned counter (one truth for the count).

### Root Cause

The self-improving harness (FID-2026-0824-012) wired capture → agenda →
Scribe drafting → quarantine and correctly made trust operator-only, but
the loop's presentation half was never built: FID-2026-0908-001 prepared
the output side (handler template) without the input side (renderer
registration), and no notification surface was ever wired at any boundary.
The Gemini deep-research report (2026-09-09) independently confirmed the
gap but cited three nonexistent seams (a fabricated `SkillList.tsx`, an
impossible `prompts.ts:415` in a 211-line file, `session-end-review.ts:140`
in a 117-line file); this FID's seams are the adversarially verified ones.

### Evidence

```text
# Registry gap — skill_manage absent (grep: zero matches for skill_manage
# in registry.ts); the Map and the two precedents that ARE there:
cli/src/components/tools/registry.ts:45
  const toolComponentRegistry = new Map<ToolName, ToolComponent>([
cli/src/components/tools/registry.ts:56-61
  // `run_readonly_command` shares the exact input/output schema with
  // `run_terminal_command` ... so it reuses the same
  // TerminalCommandDisplay renderer (Law 13 — one renderer, two tools).
  // Without this it fell through to the generic collapsed ToolCallItem
  // fallback.
  ['run_readonly_command', RunTerminalCommandComponent],

# skill_manage output is already command-class (FID-2026-0908-001) —
# render-ready with zero handler changes:
packages/agent-runtime/src/tools/handlers/tool/skill-manage.ts:31-39
  type OutputValue = { action: string; name?: string; version?: string;
    nextSha?: string; pendingTrust?: boolean; stdout: string;
    stderr: string; exitCode: 0 | 1 }
packages/agent-runtime/src/tools/handlers/tool/skill-manage.ts:54-58
  stdout: result.message ?? `skill '${result.name}' ${result.action} at
  v${result.version}${result.pendingTrust
    ? ' — quarantined, pending operator trust' : ''}`

# The reuse seam — parser exported (docstring: "Exported for testing.")
# and consumed here as the command-class output decoder; its body picks
# known fields only (startingCwd/exitCode/errorMessage/stdout/stderr)
# with no strict validation — extra skill_manage identity fields
# (action/name/version/nextSha/pendingTrust) are tolerated, not rejected:
cli/src/components/tools/run-terminal-command.tsx:16
  export const parseTerminalOutput = (rawOutput) => {
    ... const parsed = JSON.parse(rawOutput)
    const value = Array.isArray(parsed) ? parsed[0]?.value : parsed
    const startingCwd = value.startingCwd
    const exitCode = value.exitCode
    if (value.errorMessage) { ... }
    const output = (value.stdout || '' + value.stderr || '').trimEnd()
  }

# One registration covers BOTH render paths (main + subagent branches):
cli/src/components/blocks/tool-branch.tsx:48
  getToolComponent(toolBlock.toolName) !== undefined
cli/src/components/blocks/tool-branch.tsx:60
  const toolRenderConfig = renderToolComponent(toolBlock, theme, {...})

# The SessionEnd seam exists but never mentions drafts (grep exit 1 for
# quarantin|skill across the whole file):
scripts/session-end-review.ts:117 lines, zero matches
protocol.config.yaml:185-186
  - event: SessionEnd
    command: bun scripts/session-end-review.ts

# Status counts exist on demand; the list view has no pointer:
cli/src/commands/skills-discovery.ts:97
  `- Quarantined (pending trust): **${quarantined.length}**`
cli/src/commands/skills.ts:44-52   // the list branch (pointer seam)

# The live failure this FID closes (origin-repo ground truth):
.agents/skills/.quarantine/{fid-gates-unfenced-parser-contract,
  minisign-pubkey-vs-secret-key, release-workflow}/  — three drafts,
  trusted 0 times; live release-workflow SKILL.md still ships the 0.1.0
  cadence the 2026-09-08 operator directive replaced (active drift)

# skill_manage toolsets (both call sites that P1 makes visible):
agents/bundled-agents.generated-data/32-savant.ts:51
agents/bundled-agents.generated-data/34-scribe.ts:25

# Existing pins that must keep passing:
cli/src/commands/__tests__/skills-command.test.ts
  'list separates trusted from quarantined'
```

## Impact Assessment

### Affected Components

- **New** `cli/src/components/tools/skill-manage.tsx` —
  `SkillManageComponent` (`defineToolComponent`, pattern:
  `run-terminal-command.tsx`): synthesizes the label
  `skill {action} {name}` from input, reuses `parseTerminalOutput` +
  `TerminalCommandDisplay` (TrafficLightPanel chrome, ✓/✗ badge,
  expandable, `maxVisibleLines`), collapsedPreview `skill {action} {name}`
- `cli/src/components/tools/registry.ts` — one registration line
- `cli/src/commands/skills.ts` — pointer line appended in the `list`
  branch when quarantined rows exist (trusted view unchanged when zero)
- `common/src/util/skill-management` (+ barrel `skill-management.ts`) —
  exported `countQuarantinedDrafts(rootDir): number`, engine-owned
  (reuses `skill-management/paths.ts` layout constants; Law 13 — one
  count, one truth; CLI `discoverSkills` stays CLI-side presentation)
- `scripts/session-end-review.ts` — import the counter; print one alert
  line after the routing notes when N > 0 (silent at 0)
- **Tests:** new
  `cli/src/components/tools/__tests__/skill-manage.test.tsx`; extend
  `cli/src/commands/__tests__/skills-command.test.ts`,
  `scripts/__tests__/session-end-review.test.ts`, and the common
  skill-management suite
- **Not touched:** the skill-manage handler (already render-ready),
  TerminalCommandDisplay / traffic-light-panel (reused as-is),
  skills-discovery status view (already shows counts), the trust boundary
  (operator-only trust unchanged), dev/agenda.md (stays a pure function of
  the recurrence ledger — quarantine state does not pollute it)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: major feature (self-improvement loop) broken end-to-end — the
      presentation stage never existed; origin-repo evidence: zero trust
      actions ever, three invisible drafts, live release-workflow skill
      teaches the superseded cadence. No workaround a user could discover
      without already knowing hidden flags.
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Three surgical surfaces, all reuse (no new chrome, no new event paths):

1. **P1 — live renderer (the operator's core ask).** A dedicated
   `SkillManageComponent` rather than a raw registry alias of
   `RunTerminalCommandComponent`: skill_manage's input carries no
   `command` field, so an alias would render an empty command row. The
   component synthesizes the label from `{action, name}` and delegates
   everything else to `TerminalCommandDisplay` — the exact
   FID-2026-0821-007 reuse pattern (`OutputResultComponent`) and the
   `run_readonly_command` alias precedent (FID note in registry.ts:56-61).
   `parseTerminalOutput` consumes the command-class JSON and ignores the
   extra identity fields. Because `tool-branch.tsx` consults the same
   registry for agent-branch blocks, Scribe-authored drafts render in the
   main chat stream inside the agent branch with no extra wiring. The
   engine's own stdout line — including "quarantined, pending operator
   trust" — is the expanded body, so the live view states the trust
   boundary at the exact moment of creation.
2. **P2 — `/skills list` pointer, not default-inversion.** When the
   trusted list renders and drafts exist, append one line:
   `⚠ {N} quarantined skill draft(s) pending operator review — run
   /skills list --quarantined`. Default-inversion was rejected: it breaks
   the existing separation pin and makes command semantics state-dependent
   (surprise anti-pattern). The pointer is state-gated: silent at zero.
3. **P3 — deterministic SessionEnd net.** `session-end-review.ts` imports
   the engine counter and prints
   `⚠ {N} quarantined skill draft(s) pending operator review` after the
   routing notes when N > 0. This is the only surface that can catch
   mechanical drafts (`lessons:to-skills`), which never pass through the
   chat. Zero LLM, zero noise (silent at 0), idempotent (pure read after
   the agenda write).

### Steps

1. Engine counter: `countQuarantinedDrafts` in common (paths-based; no
   fs scan duplication of `discoverSkills` — the CLI keeps its
   presentation list; the engine owns the count), pinned in the common
   skill-management suite.
2. `SkillManageComponent` + registry registration; RED-first pin suite
   (pre-fix RED leg: `getToolComponent('skill_manage')` returns
   undefined) covering — registry lookup; ✓ badge + label on a
   successful create (exitCode 0); ✗ badge + stderr on failure
   (exitCode 1); the `— quarantined, pending operator trust` line in the
   expanded output.
3. `/skills list` pointer (RED leg: the appended line is absent pre-fix);
   existing separation pin must still pass.
4. SessionEnd alert (RED leg: absent pre-fix); seeded via engine
   `createSkill` in a temp root, silent when quarantine is empty.
5. Docs: `docs/self-improving-harness.md` gains a short "Operator
   visibility" note listing the three surfaces (verify whether the doc
   enumerates surfaces at GREEN; update only what exists).
6. Close per ceremony once implemented: receipt
   (`bun run fid:verify --write`), status, archive move, CHANGELOG,
   path-scoped commit (G1–G4, G8).

### Verification

RED legs (registry lookup, list pointer, SessionEnd alert, engine counter)
fail pre-fix; then: typecheck `common` + `cli`, the four suites green,
eslint/prettier on touched files, existing skills-command pins green (no
inversion drift). Live boundary (honest): the next Scribe-drafted skill in
a real session renders live in the chat with the traffic-light chrome —
operator-observable, never claimable from unit runs alone.

## Verification Gates

> Stamped 2026-09-10 at implementation (Loop 3). All exit 0.

- gate: typecheck common — PASS (tsc --noEmit -p ., exit 0)
- gate: typecheck cli — PASS (exit 0 after one test-helper param fix:
  `content` is optional on `ToolRenderConfig`)
- gate: test common/src/util/__tests__/skill-management.test.ts — PASS
  (7 pass / 0 fail)
- gate: test common/src/util/__tests__/skill-management-count.test.ts —
  PASS (3 pass / 0 fail; added at implementation)
- gate: test cli/src/components/tools/__tests__/skill-manage.test.tsx —
  PASS (4 pass / 0 fail)
- gate: test cli/src/commands/__tests__/skills-command.test.ts — PASS
  (8 pass / 0 fail, `list separates trusted from quarantined` pin intact)
- gate: test scripts/__tests__/session-end-review.test.ts — PASS (7 pass /
  0 fail)
- gate (added at implementation): eslint on the 10 touched source/test
  files `--max-warnings 0` — PASS; prettier --check on the 12 touched
  files — PASS; lint:md — PASS

## Perfection Loop

### Loop 1 — RED / GREEN design (2026-09-09/10, this session)

- **RED:** Full render-path trace (Detective + 0-EOF reads):
  registry gap (`registry.ts:45-90`, skill_manage absent, zero grep
  matches), the two reuse precedents (`run_readonly_command` alias,
  `OutputResultComponent` fan-out), parser export
  (`run-terminal-command.tsx:16`), dual-path consumption
  (`tool-branch.tsx:48,60`), SessionEnd wiring
  (`protocol.config.yaml:185-186`), status-count surface
  (`skills-discovery.ts:97`), existing command pins
  (`skills-command.test.ts`), engine layout
  (`skill-management/paths.ts`), the handler's render-ready template
  (`skill-manage.ts:31-58`), and origin-repo ground truth (three drafts,
  zero trusts, live release-workflow drift). Adversarial verification of
  the Gemini report refuted its three code citations (SkillList.tsx
  fabricated; prompts.ts:415 and session-end-review.ts:140 impossible
  line numbers; quarantine-root VERSIONS.jsonl nonexistent) and adjusted
  two claims (`/skills` bare already shows counts; the Levenshtein cap is
  already engine-enforced) — this FID's seams are the verified set.
- **GREEN (design, converged):** three surfaces, reuse-only. Deliberate
  design decisions with rationale: dedicated component over raw alias
  (empty command row otherwise); pointer-append over default-inversion
  (pin + state-dependent-semantics breakage); engine counter over CLI
  import (dependency direction scripts → common; Law 13 count truth);
  agenda stays pure (quarantine state does not enter dev/agenda.md).
  Thinker delegation deliberately not attempted: the native tool-call
  truncation class (FID-2026-0909-007's subject) killed the Thinker
  spawn mid-run and struck 8 tools this session; per the
  `recovery-steers-not-just-retries` lesson and FID-0909-007's own
  precedent, the critique was resolved from complete 0-EOF evidence
  instead of re-rolling the same oversized payload.
- **AUDIT (Verifier, 2026-09-10):** PASS-on-design — 0 architectural
  FAILs; template compliance, number allocation, design logic, and honest
  boundaries all PASS. Findings map: 2 confirmed documentation-integrity
  defects (the Summary's "behind flags" phrasing contradicted the FID's
  own Problem §3; the Evidence block glossed the parser's docstring as
  "exported for exactly this kind of reuse" when it reads "Exported for
  testing.") — both corrected in Loop 2. 2 FAILs refutable against the
  disk: the missing-Author template claim (dissolved by FID-2026-0910-002 —
  ECHO.md:542-543 now ends at `**Created**.`; the field the rule required
  was the residue of the 2026-08-09 signature scrub) and the
  `scripts/__tests__/session-end-review.test.ts` path claim (file exists —
  ls exit 0). A NEEDS-REVIEW cluster of line-number drifts
  (registry.ts:45 vs an earlier 38-90 read; skills.ts:44-52 vs 46-51;
  skills-discovery.ts:97 vs 91-97) re-stamped fresh in Loop 2: the Map at
  registry.ts:45 and the alias at :61 confirmed by grep, the list branch
  and status-count lines re-read 0-EOF this session.
- **ADVERSARIAL:** pending — refutation pass over the Loop 2 corrections
  at presentation time.
- **CHANGE DELTA:** n/a (initial record).

### Loop 3 — Implementation (2026-09-10, operator-approved session)

- **Trigger:** operator directive — "Implement FID-2026-0910-001's three
  skill-notification surfaces, entering the Perfection Loop at GREEN."
  Scope recorded in `SCOPE.md` Task 25 (T25-A..G); no drops, no deferrals.
- **RED legs (all four captured failing before any production edit):**
  counter pin — `SyntaxError: Export named 'countQuarantinedDrafts' not
  found`; renderer pin — `Cannot find module '../skill-manage'`; pointer
  pin — received `**Trusted skills**\n\n_none_`, expected the pointer
  line; SessionEnd pin — `Expected: true, Received: false`.
- **GREEN:** Steps 1–5 implemented exactly as the converged design —
  `countQuarantinedDrafts` in `common/src/util/skill-management/helpers.ts`
  (+ `skillQuarantineRootDir` in `paths.ts` so the quarantine layout has
  one truth; facade re-exports both); `SkillManageComponent` in
  `cli/src/components/tools/skill-manage.tsx` + one registry line
  (`registry.ts:69`); pointer appended in the `list` branch of
  `cli/src/commands/skills.ts` (state-gated, silent at zero);
  `quarantineAlertNote` in `scripts/session-end-review.ts` appended to the
  routing notes; docs note `docs/self-improving-harness.md` §3.4. No
  handler changes (output already render-ready per FID-2026-0908-001);
  trust boundary untouched; agenda stays a pure function of the ledger.
- **AUDIT (double audit, single-agent methods):** Method 1 — typecheck
  common exit 0; typecheck cli exit 0 (one test-helper param fix during
  the pass: `content` is optional on `ToolRenderConfig`); eslint 10
  touched files `--max-warnings 0` exit 0 (two import/order warnings fixed
  mid-pass); prettier clean on all 12 touched files; lint:md PASS.
  Method 2 — all four suites green (22 pass / 0 fail / 69 assertions):
  common counter pin 3/3, renderer pin 4/4, skills-command incl. the
  pre-existing separation pin, session-end-review incl. silent-at-zero
  leg; main common skill-management suite 7/0 (no drift). Law 4 greps:
  registry registration `registry.ts:69`; consumption via existing
  `tool-branch.tsx:48,60`; production counter consumers `skills.ts:59`
  and `session-end-review.ts:59`.
- **One test-authoring correction:** the P3 pin initially asserted the
  placeholder text `draft(s)`; the implementation correctly emits the
  pluralized form (`draft` at N=1) — the assertion was corrected to the
  real contract, not the code loosened.
- **ADVERSARIAL:** pending — presentation-time refutation pass over the
  implementation vs. the converged design (file:line evidence above).
- **CHANGE DELTA:** n/a (implementation loop; production surface ≈90
  lines across 6 files, all reuse, zero new subsystems — YAGNI holds).

### Loop 2 — Self-correct (2026-09-10, this session)

- **RED (Verifier findings):** 2 confirmed documentation-integrity defects
  (internal Summary contradiction; parser-export gloss) + 2 disk-refutable
  FAILs + a line-drift NEEDS-REVIEW cluster.
- **GREEN:** corrections applied — the Summary now states the verified
  narrower claim (on-demand-only counts, no proactive surface) instead of
  the self-contradicting "behind flags" phrasing; the Evidence block quotes
  the parser's real docstring and its verified field-picking body (the
  design dependency the Verifier flagged is now evidenced, not asserted);
  the AUDIT record folded into Loop 1 with the full verdict map; all
  drifted line citations re-stamped from fresh grep/reads (registry.ts:45,
  :61).
- **AUDIT:** inline re-verification — markdownlint + prettier on the
  amended document (tool-mediated, own runs).
- **ADVERSARIAL:** pending — spawned at presentation; both refutable
  FAILs carry fresh disk evidence (ECHO.md:542-543 post-0910-002 text;
  session-end-review.test.ts ls exit 0).
- **CHANGE DELTA:** ~4% of document text (four surgical edits).

### Missed Questions

1. *Why not default-invert `/skills list` to show drafts first?* Breaks
   the existing `list separates trusted from quarantined` pin and makes
   the command's meaning depend on hidden state. The pointer line gives
   disclosure without semantic surprise.
2. *Why not a persistent sidebar badge (Skills [N])?* Deferred as
   explicitly out of scope (YAGNI): the three surfaces cover live
   creation, list disclosure, and boundary net. A badge can follow as its
   own small FID if the operator wants ambient awareness.
3. *Does P1 surface Scribe (subagent) calls, not just main-agent ones?*
   Yes — agent-branch tool blocks render through `tool-branch.tsx`, which
   consults the same registry, so one registration covers both paths.
4. *Where does the SessionEnd hook's stdout actually land?* Honest
   boundary: hook-command stdout surfacing is not itself verified. At
   implementation, confirm the alert reaches the operator transcript or
   hook log; if the harness swallows hook stdout, the alert still fires
   deterministically and this gap becomes a named follow-up — it does not
   block P1/P2.
5. *Why a synthesized label instead of raw alias?* skill_manage has no
   `command` input; an alias renders an empty command row. The label
   `skill {action} {name}` is deterministic from the input pair.
6. *What about drafts created by scripts, not agents?* They never pass
   through the chat — that is exactly why P3 exists: the SessionEnd net
   catches every draft source, mechanical included.
7. *Desktop parity?* The desktop app wraps the same CLI render path;
   the registry component flows through. Verified at implementation, not
   assumed.
8. *Alert fatigue?* All three surfaces are state-gated (silent at zero)
   and the agenda cap already bounds drafting volume to 1–3 per session.
9. *Does the count duplicate `discoverSkills`?* No — `discoverSkills` is
   CLI presentation (rows, tables); the engine counter is the single
   numeric truth, and the CLI list may later consume it too. One truth per
   kind of fact.
10. *Why severity high rather than medium?* The workaround rubric assumes
    a discoverable workaround; here the defect is precisely that no
    surface tells you a workaround exists, proven by the origin
    operator's own zero-detection record, plus active content drift in a
    shipped skill.

### Implementation Evidence (REQUIRED for `closed`)

> Status `fixed` 2026-09-10. Commit-SHA evidence lands at closure (G2:
> closure requires a committed hash — the path-scoped commit is presented
> for execution; G1 authority question raised at session boot).

- [x] **File:line ranges:**
      `common/src/util/skill-management/paths.ts:23-24`
      (`skillQuarantineRootDir`),
      `common/src/util/skill-management/helpers.ts:130-155`
      (`countQuarantinedDrafts`),
      `common/src/util/skill-management.ts` (facade re-exports),
      `cli/src/components/tools/skill-manage.tsx` (new,
      `SkillManageComponent`), `cli/src/components/tools/registry.ts:23,66-73`
      (import + registration), `cli/src/commands/skills.ts:2,55-65`
      (pointer), `scripts/session-end-review.ts:27,49-61,84-86`
      (alert), `docs/self-improving-harness.md` §3.4; tests:
      `common/src/util/__tests__/skill-management-count.test.ts` (new),
      `cli/src/components/tools/__tests__/skill-manage.test.tsx` (new),
      `cli/src/commands/__tests__/skills-command.test.ts`,
      `scripts/__tests__/session-end-review.test.ts`
- [x] **Gate output:** Loop 3 AUDIT (typecheck ×2 exit 0; four+one suites
      22/0; eslint 0; prettier clean; lint:md PASS)
- [x] **Reproducibility:** RED legs captured failing pre-fix (Loop 3
      record); each gate command re-runnable as declared above
- [ ] **Commit SHA:** pending — presented for path-scoped execution
- [x] **Step statuses:** Steps 1–5 implemented; Step 6 (close/archive/
      CHANGELOG/commit) blocked on the G1 git-authority confirmation
      (presented — not silently deferred)

### Code Verification Evidence

> Same discipline — verified at implementation time. Current state: every
> referenced file was read 0-EOF this session; the Proposed Solution is a
> design, not an implementation claim.

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution (Loop 3; all three
      surfaces + engine counter, reuse-only, no handler/trust changes)
- [x] Typecheck/tests/lint pass with pasted tool output (Loop 3 AUDIT)
- [x] Production call-graph evidence for new/repaired wiring — grep:
      `registry.ts:69` maps `skill_manage` → SkillManageComponent;
      `tool-branch.tsx:48` (`getToolComponent(...)  !== undefined`) and
      `:60` (`renderToolComponent(...)`) consume the registry for BOTH
      render paths; `countQuarantinedDrafts` production consumers at
      `skills.ts:59` and `session-end-review.ts:59`
- [x] FID status reflects the actual implementation state (`fixed` =
      implementation exists and gates pass; closure pending commit)

## Resolution

> Pending implementation. Set when the fix lands: Closed Date, Fix
> Description, Tests Added, Verification Evidence, Archived.

## Lessons Learned

> Captured at closure. Preview: a self-improving loop without a
> presentation stage is indistinguishable from no loop at all — capability
> that accumulates where nobody looks is capability that does not exist.
> The output contract (FID-2026-0908-001) and the render contract must land
> as one unit, or the second half silently never ships. And: when a
> research report supplies file:line citations, verify them against the
> tree before building on any of them — three of this report's central
> seams were fabricated.