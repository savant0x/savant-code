# FID: compaction summary corruption — harness/system dumps contaminate every section of the standing summary

**Filename:** `FID-2026-0916-006-compaction-summary-contamination.md`
**ID:** FID-2026-0916-006
**Severity:** medium
**Status:** created
**Created:** 2026-09-16 18:09

---

## Summary

The `/compact` compaction artifact (LIVE output pasted by the operator,
2026-09-16) is severely contaminated: its "pinned first user turn" section
is a harness/system dump (`<user_message>hello</user_message>` +
`<system>User interrupted…</system>` + an allowance notice), its
"Decisions & rationale" section contains the literal junk `-.` / `- hosts` /
`- ok`, its Goal section is `hey`, its "Pending user asks" section claims
`(none)` while the section below it is a wall of duplicated progress-note
lines, and the standing-facts section lost the actual session (five ECHO
tasks, FID-004 implementation state, operator rulings). The compaction
pipeline transcribes harness framing and interrupt spam as if it were
operator dialogue, and its per-turn assembly produces section entries that
are individually useless and collectively misleading.

## Environment

- **OS:** win32 (operator's live session)
- **Workspace:** savant-code monorepo
- **Trigger:** `/compact` on a long multi-task session

## Detailed Description

### Problem

The operator ran `/compact` on a 1132-message session and pasted the
artifact back. Verified defects in the artifact (all observable in the
pasted text):

1. **Pinned-first-user-turn is infrastructure, not operator intent** —
   `[pinned first user turn — verbatim]` contains `<user_message>hello</user_message>`,
   then `<system>User interrupted the response…</system>`, then
   `<system>Free-model allowance is too low…923,420 weighted tokens</system>`,
   then the ECHO protocol refresh dump. The operator's real session-start
   ask is nowhere in the pinned section.
2. **Junk decisions** — `## Decisions & rationale` contains `-.`,
   `- hosts`, `- ok`: transcribed fragments of interrupted assistant turns,
   not decisions.
3. **Goal corruption** — the Goal section is `hey` (the latest live prompt
   at compaction time), while the real goal (FID-004 implementation) is
   absent from Goal.
4. **Standing-facts starvation** — the session's actual work (5-task ECHO
   queue, FID-004 rulings, tokenrouter gauntlet results) is missing from
   Standing facts; user turns were crowded out by the protocol-refresh dump
   and interrupt turns riding the same 12000-token budget.
5. **Interrupt spam transcribed as dialogue** — `hey` (×5+), `resume` (×3+),
   `hello` (×2) each survive as separate standing-facts lines / historical
   entries; mid-turn "resume" coalescing (FID-2026-0914-002 MQ3) only
   handles *consecutive identical* turns, so `hey → interrupt → hey` breaks
   the run and multiplies entries.
6. **System-prompt leakage into the artifact** — the artifact includes a
   `<system>…echo-critical…ECHO Protocol (condensed refresh)…</system>`
   block verbatim, i.e. the compaction preserves the very dump the pin
   filter was built (FID-2026-0914-002) to exclude.

### Expected Behavior

- The pinned first user turn is the first **operator-authored** turn,
  verbatim.
- Standing facts contains operator turns only — no `<system>`-framed
  harness content, no protocol-refresh dumps, no allowance notices.
- Decisions & rationale carries substantive assistant text or an explicit
  `(none)` — never bare punctuation fragments.
- Goal reflects the operator's live request, not interrupt spam.
- Harness-injected protocol refreshes are either excluded from summary
  inputs entirely or counted as infrastructure by the dump detector.

### Root Cause

Four independent defects in the context-pruner summary pipeline:

- **RC1 (exclusion gap).** The ECHO protocol refresh is injected as a
  user-role message (`packages/agent-runtime/src/echo/grounding.ts:159-163`,
  tag `ECHO_REFRESH`, wrapped in `<system>`). The pruner's exclusion
  filters (`agents/context-pruner/summary-parsing.ts:10-17
  shouldExcludeMessage`; `isHarnessMessage` in
  `agents/context-pruner/structured-summary.ts:124-131`) cover only
  INSTRUCTIONS_PROMPT / STEP_PROMPT / SUBAGENT_SPAWN / GRAPH_EVIDENCE —
  `ECHO_REFRESH` messages pass straight into `buildStandingFacts` inputs.
- **RC2 (framing transcription).** `buildStandingFacts`
  (structured-summary.ts:190-212) and `summarizeMessages`
  (summarize-messages.ts:33-77) transcribe the raw framed text
  (`<user_message>…</user_message>`, `<system>…</system>` interleaved) with
  no framing strip, so harness tags become artifact content.
- **RC3 (infrastructure-detector threshold).** `isProtocolInfrastructureDump`
  (structured-summary.ts:99-122) classifies a turn as infrastructure only
  when ≥40% of lines are tags/fences/headings. The protocol refresh is
  prose-heavy markdown (~35% tag/fence lines) — it passes as "operator
  dialogue" and its density siblings (allowance notices, interrupt notes)
  pass even more easily.
- **RC4 (no substance floor in decisions + goal).** `buildDecisions`
  (structured-summary.ts:245-265) takes the last non-empty assistant text
  per turn with no minimum length/alphabetic threshold — `.` survives as a
  decision. `buildGoalSection` (structured-summary.ts:267-274) pins the
  latest live prompt unconditionally — `hey` replaces the real goal after
  interrupt churn.

### Evidence

- LIVE artifact (operator-pasted, 2026-09-16, reproduced in this session's
  transcript): pinned turn = `<user_message>hello</user_message>` +
  `<system>` interrupts + allowance notice + protocol dump; decisions =
  `-.` / `- hosts` / `- ok`; Goal = `hey`; `hey` ×5 / `resume` ×3 as
  standing-facts lines.
- Injection path: `grounding.ts:159-163` (user-role refresh, tag
  ECHO_REFRESH) vs. exclusion list `summary-parsing.ts:10-17` (no
  ECHO_REFRESH case) — grep verified: `ECHO_REFRESH` appears nowhere in
  `agents/context-pruner/`.
- Framing path: `util/messages/framing.ts:26-28` (`asUserMessage` wraps
  every operator turn) and `:99-101` (`withSystemTags`) — raw framed text
  is what the summarizers see.
- Interrupt-note path: `<system>User interrupted…</system>` blocks ride
  inside user turns (client-attached), so they are part of the transcribed
  text even when the turn itself is operator-authored.

## Impact Assessment

### Affected Components

- `agents/context-pruner/summary-parsing.ts` (exclusion list)
- `agents/context-pruner/structured-summary.ts` (standing facts, decisions,
  goal, dump detector)
- `agents/context-pruner/summarize-messages.ts` (user-turn transcription)
- `packages/agent-runtime/src/echo/grounding.ts` (refresh message shape —
  read-only reference; the fix is pruner-side)
- Downstream: every post-`/compact` session, every auto-compact boundary,
  subagent spawn summaries (they embed the same artifact).

### Risk Level

medium — correctness of long-session memory; no data loss, no security
exposure, but post-compaction sessions resume with corrupted intent, which
misdirects subsequent agent work (observed: the pasted artifact caused the
resumed session to treat infrastructure as the operator's ask).

## Proposed Solution

### Approach

Pruner-side hardening, five targeted changes (no runtime/grounding change):

1. **Exclusion (RC1):** add `ECHO_REFRESH` to `shouldExcludeMessage` and
   `isHarnessMessage` so protocol-refresh messages never enter summary
   inputs.
2. **Framing strip (RC2):** strip `<system>…</system>`,
   `<user_message>`/`</user_message>`, `<think>` blocks and
   `[compaction-notice]` blocks from transcribed user-turn text in
   `buildStandingFacts` and `summarizeMessages` before dedupe/pin —
   operator prose remains, harness framing never does.
3. **Detector hardening (RC3):** extend `isProtocolInfrastructureDump` —
   classify as infrastructure any turn containing
   `<!--echo-critical-->`, `<compaction-notice`, the ECHO refresh sentinel
   lines, or allowance/interrupt system blocks, regardless of density.
4. **Substance floor (RC4a):** `buildDecisions` skips texts shorter than 3
   chars or without a letter; falls through to the previous substantive
   text before emitting `(none)`.
5. **Goal guard (RC4b):** `buildGoalSection` skips goal candidates that are
   pure interrupt spam (single greeting word, matches `^(hey|hello|resume|yo|ok)[!. ]*$`
   case-insensitive) and falls back to the newest non-spam user turn.

### Steps

1. RED pins first (per-turn unit tests against the exact pasted shapes:
   refresh message in standing facts, `.` as decision, `hey` as goal,
   framing tags in output).
2. Apply 1–5 in `summary-parsing.ts`, `structured-summary.ts`,
   `summarize-messages.ts`.
3. Re-run pin suites; verify the pasted artifact's shapes now produce
   clean sections.
4. Sync the embedded generated scope
   (`cli/src/agents/bundled-agents.generated-data/04-context-pruner.ts`)
   via the factory regeneration path; confirm byte-parity of unchanged
   sections.

### Verification

- All context-pruner suites green (phase-1 hardening, phase-1 summary,
  preservation, serialization parity).
- New RED pins green post-fix; artifact-shape regression pins added to the
  permanent suite.
- typecheck ×4, `quality:report`, `validate:repository`, `lint:md`.
- LIVE `/compact` reproduction on a scratch session: pinned turn is the
  real operator ask; decisions section has no punctuation-only entries.

## Perfection Loop

### Loop 1 — RED

Grounding pass complete (see Root Cause — all file:line verified by grep +
read). Pins not yet authored — this FID is presented at `analyzed` per the
present-before-act ruling; pins land with operator approval of scope.

### Missed Questions

- MQ1 (ruled by operator framing): the corruption is a pipeline defect, not
  a model defect — fix the transcription/exclusion layer, do not prompt
  around it.
- MQ2 (open, needs operator ruling): should protocol-refresh content be
  (a) excluded from summaries entirely (proposed), or (b) retained as a
  compact "protocol was refreshed at turn N" marker line? Proposed: (a) —
  the refresh re-injects itself on cadence and does not need summary
  space.
- MQ3 (open, needs operator ruling): interrupt-turn handling — coalesce
  consecutive identical turns (already done), also coalesce
  greeting-spam runs (`hey`×5 → one line `(×5)`)? Proposed: yes, extends
  the FID-2026-0914-002 MQ3 rule to non-identical same-intent turns.
- MQ4 (self-caught): `cli/src/agents/bundled-agents.generated-data/
  04-context-pruner.ts` embeds the pruner source — the fix MUST regenerate
  it, otherwise the shipped scope keeps the defective behavior.

## Resolution

- **Fix Description:** —
- **Fixed Date:** —

### Code Verification Evidence

- [ ] Typecheck ×4 planned
- [ ] RED-first pin suite planned (pasted-artifact shapes)
- [ ] LIVE `/compact` scratch-session reproduction planned
