# FID: Turns never end — savant step loop re-invokes past exempt-only completions

**Filename:** `FID-2026-0822-003-turn-never-ends-step-loop.md`
**ID:** FID-2026-0822-003
**Severity:** high
**Status:** closed
**Created:** 2026-08-22 13:07
**YAGNI-Compliance:** Pending

---

## Summary

Operator report (2026-08-22, third incident): assistant turns "continue running without ending", back to back,
requiring manual interrupts — persisting AFTER the 12:57 restart that loaded FID-2026-0822-002's anti-runaway guards.
Operator directed: "we need to make a fid, this has been going on too long."
An external AI review of the conversation export (operator-supplied, 'Nova') independently confirmed the live cycle and
sharpened the mechanism. OPERATOR DESIGN CONSTRAINT (13:30): any termination cap introduced by this FID MUST be disabled
for Auto Drive — "only thing you need to disable that fix for is the auto drive feature or the fix will kill a real
feature." Autonomous continuation is legitimate product behavior and must never be surrendered by this fix.

## Perfection Loop

### RED Evidence

- Guards live but silent: FID-2026-0822-002 verified loaded post-restart. External analysis confirms why: every
  continuation cycle emits a DIFFERENT suggest_followups payload (varied cards → unique signatures), zero tool errors,
  real visible text (not think-only). "The loop signature isn't repetition — it's progress-without-input." None of the
  three trip conditions match that shape.
- Live cycle (externally corroborated + observed in-session): agent completes real work → trailing suggest_followups →
  harness injects end-of-turn system_reminder → model correctly reasons "no new user input" but responds anyway
  (mandated) → reminder fires again → repeat. Observed 4+ consecutive cycles before operator interrupt; dozens of
  text-only message pairs in the freshest trace window with zero interleaved tool_started events.
- Surface: standard savant loopAgentSteps (runtime_events, runId bcfe87cb…); reminder delivered as STEP_PROMPT
  (timeToLive agentStep) each step; TOOLS_WHICH_WONT_FORCE_NEXT_STEP contains 'suggest_followups'
  (common/src/tools/constants.ts:36); savant.ts lacks task_completed.
- Injection-point diagnosis (external): the end-of-turn reminder shares a queue with step triggers — "the reminder
  re-arms the very turn it was supposed to close"; synthetic injections are eligible to INITIATE steps because nothing
  distinguishes 'user spoke' from 'harness nudged'.
- Corroborating signals: ECHO_COMPLIANCE ×21 and Law-15 ×4 in freshest windows (uncapped applyTurnEnforcement blocking
  remains a co-mechanism); history grown to 2,831 msgs / 380k tokens in runId 312af4bd; cli.jsonl ERROR class includes
  chat-state save failures (cyclic structures) explaining absent flushes; no chat state flushed since 12:57 restart.

### Green — Plan (implemented — see Audit evidence below)

1. Pin the injection site: trace exactly where the end-of-turn reminder enters the message queue relative to step
   initiation (external offer: walk step.ts/prepareStepContext/getAgentPrompt path).
2. Root-cause kill (external Option 1, adopted): source-tag synthetic injections (reminders/compliance/steering) so
   step.ts can distinguish 'user spoke' from 'harness nudged'; a reminder must NEVER be eligible to initiate a step —
   only append context to an already-running one. Hard-end any sequence whose only post-completion inputs are synthetic.
3. Safety net (external Option 2, REFINED — as originally stated it would kill every legitimate long agentic turn,
   since normal turns legitimately run many steps without user messages): trip only on POST-TERMINAL continuations —
   steps that begin after a step that already satisfied shouldEndTurn (clean exempt-only/no-tool-call completion) without
   an intervening genuine user message. N=2 → auto-end with distinct notice ('Turn auto-ended: no operator input').
   AUTONOMY CARVE-OUT (operator-mandated): the breaker is bypassed entirely when the run is an autonomous continuation —
   predicate: `agentState.drive` present with status active/paused/driving (Auto Drive) OR
   `agentState.goal?.status === 'active'` (goal engine). For those runs, today's behavior is preserved exactly.
4. Co-mechanism cleanup per prior plan: retry cap + visible surrender on applyTurnEnforcement (mirror
   COMPLETION_GATE_MAX_RETRIES). The surrender path is likewise bypassed for autonomous runs under the same predicate —
   enforcement may keep blocking long autonomous turns by explicit operator acceptance.
5. Loop-level regression tests: (a) exempt-only completion followed by synthetic-only input terminates within 1
   continuation; (b) enforcement-blocked turns still terminate after N blocks; (c) legitimate 30-step no-user-input
   agentic turn is NOT interrupted (guards against over-tripping the refined net); (d) an Auto-Drive-active turn (drive
   record present / goal active) is NEVER auto-ended or surrendered regardless of block count — the real feature
   survives.
6. Interim mitigation available: lower maxAgentSteps (default 200).

### Code Verification Evidence (audit — implemented and gated green 2026-08-22 ~14:10 EDT):

- NEW packages/agent-runtime/src/run-agent-step/post-terminal-breaker.ts: POST_TERMINAL_CONTINUATION_LIMIT=6,
  TURN_END_ENFORCEMENT_SURRENDER_LIMIT=3, isAutonomousContinuation (drive driving/paused/blocked OR goal.status active),
  updatePostTerminalCounter (reset on clean terminal / genuine operator input / ordinary working step; increments ONLY on
  overridden terminal verdicts), updateTurnEndBlockCounter.
- Wired packages/agent-runtime/src/run-agent-step/loop-iteration.ts: sawTerminalVerdict captured from RAW
  endTurn/llmShouldEndTurn before gates on both paths; applyTurnEndEnforcement now counts turnEndBlockCount and
  SURRENDERS after 3 consecutive blocks (logs + allows end) unless autonomous; post-terminal breaker placed after
  steering/compliance blocks — genuineUserInput (drained user messages) resets, trip forces shouldEndTurn=true with
  logger.warn + 'Turn auto-ended: no operator input…' notice.
- common/src/types/session-state.ts: transient postTerminalContinuations + turnEndBlockCount fields.
- LIMIT rationale: 6 exceeds the sum of bounded self-correction budgets (grounding gate 3 steers + enforcement surrender
  3), so bounded courses ALWAYS complete before the breaker trips; unbounded synthetic cycles hard-end at 6.
Gate battery (all tool-verified): bun run --cwd=common typecheck exit 0; bun run --cwd=packages/agent-runtime typecheck
exit 0; post-terminal-breaker.test.ts 11 pass / 0 fail; loop-agent-steps-part-a 11/11 (includes the FID-2026-0810-002
grounding-gate course that originally failed at N=2 and drove the limit refinement); part-b 4/4; eslint --max-warnings 0
on all four changed files exit 0; prettier --check all four clean. Deferred: injection-source tagging (Green item
refined to follow-up) — the breaker+cap bound the failure class completely regardless of injection source.
WIRING PROOF (2026-08-22 ~15:25 EDT): NEW
packages/agent-runtime/src/__tests__/post-terminal-breaker-integration.test.ts drives loopAgentSteps end-to-end with a
stubbed echoCompliance tracker reproducing the synthetic-injection cycle: (a) clean completions overridden by compliance
steering auto-end at exactly POST_TERMINAL_CONTINUATION_LIMIT with the no-operator-input notice; (b) an active-drive run
is NEVER auto-ended or surrendered — it proceeds to the stepsRemaining backstop with zero terminator notices.
REFINEMENTS forced by proof/typecheck: (i) LIMIT raised 2→6 so bounded self-correction courses (grounding 3 + enforcement
surrender 3) always finish first (part-a regression caught this); (ii) autonomy predicate corrected to real DriveRecord
statuses ('active'|'paused'|'blocked' — 'driving' was a phantom status the type system rejected); (iii)
exhaustion-respect added: compliance steering skips when stepsRemaining < 1 and enforcement returns ending at <= 0,
because the probe trace (24,368 events) proved an autonomous run could otherwise loop forever on guard-short-circuited
steps with no LLM calls — synthetic flips must never outrun the stepsRemaining backstop even for Auto Drive
(driver-level budgets remain the bound there). Probes removed post-proof.
Final battery: typecheck common + agent-runtime exit 0; integration 2/2 (6-call trip with notice; 30-call carve-out
without); breaker unit suite 11/11; part-a 11/11; part-b 4/4; eslint --max-warnings 0 ×4 files; prettier --check ×4
clean.

### Missed Questions

1. Why trip only on POST-TERMINAL continuations? Decision: legitimate
   long agentic turns run many steps without user messages; only steps
   after a satisfied shouldEndTurn without intervening genuine input are
   the failure class (safety-net refinement, Green item 3).
2. Why N=6? Decision: exceeds the bounded self-correction budgets
   (grounding gate 3 steers + enforcement surrender 3), so bounded courses
   always complete before the breaker trips; unbounded synthetic cycles
   hard-end at 6.
3. Why bypass for Auto Drive / goal-engine runs? Decision: operator
   design constraint (2026-08-22 13:30) — autonomous continuation is a
   real feature; `isAutonomousContinuation` preserves it exactly.
4. Deferred injection-source tagging? Decision: refined to follow-up —
   the breaker + cap bound the failure class completely regardless of
   injection source.

## Step Status

- [x] RED: live incidents captured post-guard-restart; externally corroborated cycle (progress-without-input);
  injection-point hypothesis recorded; co-mechanism (uncapped enforcement) evidenced
- [x] Operator design constraint recorded: termination caps MUST exempt Auto Drive (and goal-engine continuations) —
  autonomous continuation is a real feature
- [x] GREEN: post-terminal breaker (N=6, autonomy carve-out) + capped enforcement surrender + 11-case unit suite;
  LIMIT raised 2→6 after part-a exposed the bounded-budget interaction
- [x] AUDIT: gates green (typecheck ×2, 26/26 targeted tests, eslint 0, prettier clean); live confirmation = next
  runaway-pattern turn auto-ends within ≤6 continuations with the no-operator-input notice
- [x] Wiring proof added (integration tests a+b); LIMIT=6 refinement; autonomy-predicate correction;
  exhaustion-respect fix — all gate-verified

## Resolution

Closed 2026-08-22 (operator directive: archive the completed FIDs).
Post-terminal breaker (N=6, autonomy carve-out) + capped enforcement
surrender implemented and wiring-proven (integration tests a+b; breaker
unit 11/11; part-a 11/11; part-b 4/4; typecheck ×2; eslint 0; prettier
clean). Live confirmation (next natural runaway-pattern turn auto-ends
≤6 continuations) was operator-waived with the closure directive; the
Verifier advisory on subagent skip is carried as an observation. Archived
with a CHANGELOG entry per the auto-archive contract.

## Open follow-up

- Live human confirmation remains: next natural runaway-pattern turn should show 'Turn auto-ended: no operator input…'
  within ≤6 continuations (requires CLI relaunch to load).
- Verifier advisory open: decide whether the post-terminal breaker should skip subagents (parentId guard) like
  enforcement does, or keep subagent coverage documented.
