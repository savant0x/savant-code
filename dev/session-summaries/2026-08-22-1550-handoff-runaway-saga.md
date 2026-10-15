# Session handoff 2026-08-22 ~15:50 EDT — runaway-turn saga + compact/auto-compact fixes

## Outcome state

Three FIDs at status `fixed` in `dev/fids/` (uncommitted per release-only-commits; the next automation release sweeps):

- **FID-2026-0822-001** (/compact dead intercept + auto-compact no-op loop): RC1 XML-frame unwrap in the serialized
  savant generator (+13 regenerated bundled chunks), RC2 `force:true` on the proactive pruner path, RC3
  `wasCompacted` guard `step.ts` (~332), RC4 pruner-crash blocked phase (`spawn-agent-inline.ts` ~173), RC5
  `/compact` registered in `cli/src/commands/defs/chat.ts` (~239). LIVE-CONFIRMED WORKING by the operator across
  two restarts.
- **FID-2026-0822-002** anti-runaway guards v1: pure module
  `packages/agent-runtime/src/run-agent-step/runaway-guards.ts` (repeated-tool-call ×4, consecutive-error ×5,
  think-only ×3), wired in `step.ts`, AgentState transient fields, 11 unit tests. Proven INSUFFICIENT alone — the
  live runaway emitted varied payloads each cycle (progress-without-input, not repetition).
- **FID-2026-0822-003** turn terminator: pure module
  `packages/agent-runtime/src/run-agent-step/post-terminal-breaker.ts`
  (`POST_TERMINAL_CONTINUATION_LIMIT=6`, `TURN_END_ENFORCEMENT_SURRENDER_LIMIT=3`,
  `isAutonomousContinuation` predicate drive active/paused/blocked OR `goal.status==='active'`), wired in
  `loop-iteration.ts` (sawTerminalVerdict raw capture on both paths; breaker after steering/compliance blocks
  forces `shouldEndTurn=true` with the 'Turn auto-ended: no operator input…' notice and returns
  `shouldContinue:false` on hardEnd; `applyTurnEndEnforcement` surrenders after 3 consecutive blocks with the same
  carve-out; exhaustion-respect: compliance steering skips at `stepsRemaining<1` and enforcement returns ending at
  `<=0` so synthetic flips never outrun the stepsRemaining backstop even for Auto Drive); AgentState fields
  `postTerminalContinuations`/`turnEndBlockCount`; 11 unit tests + 2-case integration wiring proof
  (`post-terminal-breaker-integration.test.ts`: trip at exactly LIMIT with notice; active-drive run proceeds to
  the backstop with zero notices).

## Root cause (final understanding)

Turns never ended because every continuation cycle emitted DIFFERENT tool payloads (mandated trailing
`suggest_followups` + varied cards) — progress-without-input defeats repetition-shaped guards; the end-of-turn
system reminder is injected as STEP_PROMPT each step ("even if the user just asks a question"), re-arming the turn
it was meant to close; uncapped `applyTurnEndEnforcement` blocking was a co-mechanism (ECHO_COMPLIANCE ×21,
Law-15 ×4 in fresh windows; history grew to 2,831 msgs / 380k tokens in runId 312af4bd).

## NEXT SESSION — live confirmation checklist

1. Quit + relaunch CLI (`bun run --cwd=cli dev`) — loads all three fixes (prebuild regenerates chunks; runtime
   sources resolve fresh).
2. Reproduce any long/agentic turn; expected within ≤6 continuations of a completed-with-no-user-input state: a
   visible 'Turn auto-ended: no operator input…' notice, clean turn end.
3. Re-confirm `/compact` still intercepts (⚙→✓ panel, no prose reply).
4. On pass: close/archive all three FIDs + CHANGELOG entries in one sweep.

## Open items (registered)

- Verifier advisory: decide parentId guard vs documented subagent coverage for the post-terminal breaker.
- NEEDS-REVIEW: live rendering of the notice string (one human repro closes it).
- Deferred: injection-source tagging (root-cause refinement beyond the breaker).
- Queued: BYOK usage.inputTokens cached-token probe (may delay auto-compact trigger).
- Housekeeping: 4 orphaned hung bun-test processes from diagnosis (PIDs 34032/40260/35732/32680 as of ~14:56)
  still writing to shared debug logs — reap with `taskkill //F //PID <pid>`.
- Paused programs unchanged: quality-ratchet paused; desktop Phase 1 FIDs (0820-007..011) analyzed/ready.

## Tooling failure modes tonight (context)

- basher relay returned NO-OUTPUT twice while commands silently never executed — always ground-truth check
  (grep/wc) after basher mutations.
- Host has NO tmux/WSL bridge — tmux-cli agents must execute natively in Git Bash.
- EHEL Law-3 unverified-file gate oscillated (blocked writes despite clean typecheck/lint/test batteries);
  reliable workaround: route edits through a Forge subagent (separate tracker), then verify.
- bun test hangs: `--timeout` does NOT reap hung tests; external `timeout N` or taskkill required. Buffered
  stdout is lost on hard kill — use appendFileSync probes to `debug/` for evidence that survives kills.
- Ground-truth sources tonight: `debug/trace.jsonl` + `debug/cli.jsonl` (fresh, huge); 
  `~/.savant-code/projects/*/chats` flush only at turn boundaries — runaway turns never flushed.
