# FID: /compact dead intercept + auto-compact no-op loop — pipeline root causes fixed

**Filename:** `FID-2026-0822-001-compact-pipeline-root-causes.md`
**ID:** FID-2026-0822-001
**Severity:** high
**Status:** closed
**Created:** 2026-08-22 01:07
**YAGNI-Compliance:** Pending

---

## Summary

Operator report (2026-08-22 ~00:30 EDT): manual `/compact` "asked the agent for nothing more than to return a
summary, the agent reasoned about it, then the turn after it threw a response error"; and auto-compact never triggers
at threshold despite sidebar peaks >85% (expected: hermes/openclaw/openclaude automatic behavior; reference repos
under `resources/`). Root-caused FIVE defects spanning the serialized savant generator, the legacy step
interception, the pruner spawn boundary, AND the CLI input router; all five fixed surgically, gates green. Live
re-test pending operator CLI relaunch. Note: all of FID-2026-0821-001's redesign was released AFTER v0.0.27 was cut
(uncommitted working tree) — an operator running the installed v0.0.27 binary sees none of it; operator confirmed
dev mode (`bun dev`, which re-runs prebuild:agents at launch).

## Environment

- **OS:** Windows 11 (win32, Git Bash)
- **Language/Runtime:** TypeScript strict monorepo, Bun 1.3.14 (pinned)
- **Tool Versions:** savant-code v0.0.27 working tree
- **Commit/State:** main; release-only-commits convention — changes land uncommitted until the next automation release

## Detailed Description

### Problem

1. Manual `/compact` never engaged the FID-2026-0821-001 P1-4 interceptor. Pre-restart, the raw prompt fell through to
   a normal LLM step WITH the appended `compactPrompt` instruction ("Summarize the entire conversation… prepare it to
   replace the existing message history" — `loop-context.ts` additionalSystemPrompts), producing exactly the
   operator's observation. Post-restart (fresh dev process), typing `/compact` instead produced "Command not found:
   /compact" at the input layer.
2. Auto-compact spawned the context-pruner at the 80% trigger WITHOUT `force`, while the pruner's own admission gate
   (`agents/context-pruner/main.ts`: `count + TOKEN_COUNT_FUDGE_FACTOR(1000) > maxContextLength`) only proceeds near
   window level — so every trigger-threshold spawn no-oped (`ineffective`), the escalated retry stayed
   cooldown-gated (30s) despite its "bypasses the cooldown" comment, and the generator-local escalation counter
   reset every user turn. Net: zero real compaction until hard overflow (W−15k).

### Expected Behavior

`/compact` routes through the force-pruner pipeline (compact-and-stop, visible ⚙/✓/⛔ panel phases); auto-compact
compacts at `resolveTriggerThreshold` (80% default) exactly like the hermes #62625 / codex / openclaw reference
patterns.

### Root Cause (evidence)

- **RC1 — manual intercept dead (fixture-vs-production divergence):** production USER_PROMPT content is XML-framed
  by `buildUserMessageContent`/`asUserMessage` (`packages/agent-runtime/src/util/messages/framing.ts`:
  `<user_message>${str}</user_message>`; `loop-context.ts` builds the USER_PROMPT message through it), but the
  interceptor compared raw text (`text.trim().toLowerCase() === '/compact'` in
  `agents/savant/handle-steps-factory.ts`) — against `<user_message>/compact</user_message>` this can NEVER match.
  The unit test passed because its fixture hand-built a bare-string message production never produces.
- **RC2 — auto-compact no-op loop:** the proactive branch spawned with `...(escalationStage >= 1 ? { force: true }
  : {})` while every other spawn path (manual, idle, hard-overflow) forces; the pruner re-litigates the caller's
  threshold decision with a ~window-level gate ⇒ guaranteed first-pass no-op at 80%; the forced retry branch still
  required `now - lastPrunerCompletionAt > 30000`; `escalationStage` is generator-local and resets per turn.
- **RC3 — unguarded destructive legacy:** `step.ts` `wasCompacted` replaced the ENTIRE history with the model's raw
  response for ANY agent whose prompt was `/compact` — racing handleSteps pipelines (FID-2026-0821-001 claimed this
  was demoted to non-handleSteps fallback only; no guard existed in code).
- **RC4 — stuck status on pruner crash:** `spawn-agent-inline.ts` emitted terminal phases (`pruned`/`ineffective`)
  and stamped `lastPrunerCompletionAt` only AFTER `executeSubagent` resolved — a crashed inline pruner left
  `compactionStatus` stuck at `compacting` forever (silent death spiral).
- **RC5 — typed `/compact` dead-ended at the input router (found during live re-test):** FID-2026-0821-001 P1-4
  registered `compact` in the slash MENU (`data/slash-commands.ts` COMPACT_COMMANDS) but NEVER in the command
  REGISTRY. Typed `/compact` parsed via `parseCommandInput`, `findCommand('compact')` → undefined, and
  `route-user-prompt.ts` fell into the unknown-slash branch — line 266 `getSystemMessage(\`Command not found:
  ${trimmed}\`)` — returning WITHOUT calling `sendMessage`. The prompt never reached the runtime interceptor. The
  designed guard existed and had been silently red: `commands/__tests__/registry-gating.test.ts` asserts every menu
  id resolves via findCommand, failing with `paid menu compact should resolve / Received: undefined` — unnoticed
  because only targeted suites were run after the menu-only registration landed.

## Impact Assessment

### Affected Components

- `agents/savant/handle-steps-factory.ts` (RC1 + RC2) + 13 regenerated `cli/src/agents/bundled-agents.generated-data/`
  savant chunks
- `packages/agent-runtime/src/run-agent-step/step.ts` (RC3)
- `packages/agent-runtime/src/tools/handlers/tool/spawn-agent-inline.ts` (RC4)
- `cli/src/commands/defs/chat.ts` (RC5 — `compact` registered in CHAT_COMMANDS mirroring the `init`
  prompt-dispatch pattern; `route-user-prompt.ts` itself unmodified)
- `agents/__tests__/manual-compact-intercept.test.ts` (fixtures rebuilt through the real production builder)
- `packages/agent-runtime/src/__tests__/basher-relay-step-context.test.ts` (out-of-scope flag: latent TS2339
  `Property 'value' does not exist` blocked the agent-runtime typecheck gate; yield-cast type widened — fixed under
  this FID, attributed here for the record)

### Risk Level

- [x] High: both compaction surfaces (manual + automatic) effectively broken live; silent failure modes throughout
- [ ] Critical
- [ ] Medium
- [ ] Low

## Proposed Solution (implemented)

1. **RC1:** interceptor unwraps the `<user_message>` frame via `indexOf`/`slice` (regex backslash escapes cook
   inside the factory's template literal; the no-backticks factory rule is honored), compares the unwrapped payload
   trimmed/lowercased to `/compact`, keeping bare text as fallback.
2. **RC2:** proactive threshold branch passes `force: true` unconditionally — the single threshold owner
   (`autoCompactDue`/`compactTrigger`) already decided; cooldown + escalation ladder still judge post-force outcomes.
3. **RC3:** `wasCompacted` guarded with `!agentTemplate.handleSteps` (step.ts:332).
4. **RC4:** `.catch` around `executeSubagent` stamps `lastPrunerCompletionAt` and emits
   `blocked('pruner-unavailable')` for main-agent pruner spawns before rethrowing.
5. Bundled agents regenerated (`bun run --cwd=cli prebuild:agents` exit 0); intercept test fixtures rebuilt through
   the REAL `buildUserMessageContent` + new RC2 regression test.
6. **RC5:** `defineCommand({ name: 'compact' })` added to CHAT_COMMANDS (`cli/src/commands/defs/chat.ts`, directly
   after `init`) mirroring the init prompt-dispatch pattern: saveToHistory → clearInput → queue-if-streaming →
   `sendMessage({ content: trimmed })` — dispatching the literal `/compact` prompt into the runtime where the fixed
   interceptor force-spawns the pruner and compact-and-stops.

## Perfection Loop

### Loop 1

- **RED:** five defect classes cataloged with file:line evidence (dispatch chain read end-to-end: framing.ts →
  loop-context.ts → handle-steps-factory.ts → step.ts → spawn-agent-inline.ts → context-pruner/main.ts; RC5 added
  during live re-test when the operator reported "Command not found: /compact" — router trace + red parity test
  pinned it).
- **GREEN:** Orchestrator direct writes (Hybrid Mode); EHEL Law-3 gating enforced mid-batch (write blocked once
  until typecheck ran — honored); prettier/eslint import-order corrected under self-correct; RC5 added in a second
  green entry after live-re-test discovery.
- **AUDIT:** independent Verifier PASS on the RC1–RC4 changeset (all six items, two non-blocking advisories);
  RC5 covered by before/after registry-gating evidence + Verifier spot-pass.

### Missed Questions

1. Why did the intercept unit test pass while production never matched?
   Decision: fixture-vs-production divergence — the fixture hand-built a
   bare-string message that production never emits (RC1).
2. Why did the 80% trigger spawn always no-op? Decision: the pruner's own
   admission gate re-litigated the caller's threshold decision at ~window
   level — the caller owns the threshold, the callee must not veto it (RC2).
3. Why did the menu entry exist while typing `/compact` failed? Decision:
   the slash feature spans TWO registries (menu + command router); only
   targeted suites ran, so the red parity guard went unnoticed (RC5).
4. What happens when the inline pruner crashes? Decision: terminal phases
   and lastPrunerCompletionAt must be stamped on the catch path, or
   compactionStatus sticks at `compacting` forever (RC4).

### Code Verification Evidence (gates 2026-08-22 ~01:10–02:25 EDT)

- [x] **Typecheck:** agents exit 0 · packages/agent-runtime exit 0 · cli exit 0 (re-confirmed post-RC5)
- [x] **Tests:** `bun test` cwd=agents → 94 pass / 0 fail (13 files; includes 4 intercept tests:
      production-shaped intercept, bare-text fallback, normal-prompt negative, RC2 proactive-force regression; all
      pruner lifecycle/trigger/wiring/serialization suites green) · `bun test` cwd=packages/agent-runtime → 1148
      pass / 0 fail (132 files) · RC5: registry-gating.test.ts BEFORE fix 4 pass / 1 fail with
      `error: paid menu compact should resolve — Received: undefined`; AFTER fix 5 pass / 0 fail
- [x] **Lint/format:** prettier --check clean on all changed files; eslint --max-warnings 0 clean on all changed
      files (import/order corrected; chat.ts re-checked post-RC5)
- [x] **Law-4 call-graph anchors:** `compactCandidate` unwrap present in regenerated
      `cli/src/agents/bundled-agents.generated-data/32-savant.ts` serialized source; unconditional `force: true` in
      the chunk's proactive branch; `step.ts:332` `!agentTemplate.handleSteps`; `spawn-agent-inline.ts:173`
      `'pruner-unavailable'` backed by union member `common/src/types/session-state.ts:146`; RC5:
      `name: 'compact'` registered in defs/chat.ts (findCommand resolves; handler reaches sendMessage),
      handleSpawnAgentInline registered in tools/handlers/list.ts; prebuild regen exit 0

## Step Status

- [x] RC1 unwrap fix — implemented + tested
- [x] RC2 proactive force — implemented + regression-tested
- [x] RC3 legacy guard — implemented
- [x] RC4 error-truth catch — implemented
- [x] Bundled agents regenerated — exit 0
- [x] RC5 input-router registration — implemented; parity guard flipped red→green
- [ ] Live re-test (operator): restart dev CLI → type `/compact` → expect NO model reply, ⚙ Compacting… → ✓ pruned −N panel, sidebar Context % drop; then run past ~80% window and confirm automatic compaction fires — deferred::operator-approved 2026-08-22

## Resolution

Closed 2026-08-22 (operator directive: archive the completed FIDs). All
five root causes implemented and gate-verified (agents 94/0; agent-runtime
1148/0; registry-gating 5/0; typecheck ×3; eslint 0; prettier clean). The
live re-test (operator CLI relaunch) boundary was operator-waived with the
closure directive and is carried on the active ledger's observation list
(CompactionSignal parity item) — a natural compaction event still observed
live will confirm it. Archived with a CHANGELOG entry per the
auto-archive contract.

## Lessons Learned

A unit-test fixture that hand-builds message shapes can certify a feature production kills — fixtures must flow
through the REAL builders (`buildUserMessageContent`), not hand-rolled literals. A caller that owns the threshold
decision must not let the callee re-litigate it with a different threshold: the pruner's window-level admission
gate silently vetoed every 80% trigger for the feature's entire life. And a slash feature spans TWO registries —
the menu and the command router; registering one without the other ships a menu entry that errors on use, even
when a parity guard exists — if only targeted suites are run, a red guard waits unnoticed.

---

CHANGELOG entry deferred to closure (live re-test pending; status discipline: stays `fixed` in dev/fids/ until then).

---
