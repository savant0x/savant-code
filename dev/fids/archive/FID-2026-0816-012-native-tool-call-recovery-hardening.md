# FID: Native tool-call recovery hardening (steer, don't just retry)

**Filename:** `FID-2026-0816-012-native-tool-call-recovery-hardening.md`
**ID:** FID-2026-0816-012
**Severity:** high
**Status:** closed
**Created:** 2026-08-16
**YAGNI-Compliance:** Verified

---

## Summary

A live agent run failed with `Native tool-call recovery failed twice consecutively; ending the
agent run without executing the incomplete tool call.` (operator-reported, Forge subagent on the
FID-2026-0816-011 implementation task). The chain: a flash-class model streamed a large native
tool call (`write_file` of a full component file) whose JSON arguments terminated truncated →
the provider flush flagged it `native-incomplete` → the runtime retried once with a generic
"retry with a complete arguments object" prompt → the model re-emitted the same giant payload and
truncated again → the 2-strike cap killed the entire subagent run with a guidance-free error.
This FID hardens the recovery path: tool-aware steering that tells the model to split large
payloads, a 3-strike cap, and an actionable exhausted-failure message that names the tool and
tells the parent how to re-spawn.

## Environment

- **OS:** Windows (operator terminal), WSL tmux harness
- **Language/Runtime:** TypeScript monorepo, Bun ≥ 1.3.14
- **Tool Versions:** deepseek-v4-flash (Freebuff gateway), @opentui/core 0.5.x CLI
- **Commit/State:** working tree post Phase 0-4 + FID-010/011 work; six planning FIDs open in `dev/fids/`

## Detailed Description

### Problem

1. **Subagent runs die with a raw, guidance-free error.** `NATIVE_TOOL_CALL_RECOVERY_EXHAUSTED_MESSAGE`
   (`packages/agent-runtime/src/run-agent-step/constants.ts:1-2`) is thrown at
   `loop-iteration.ts:372` after two consecutive `native-incomplete` steps, propagating through
   `executeSubagent` → `Promise.allSettled` (`spawn-agents.ts:168`) as a bare stack-trace error.
2. **Recovery re-rolls the same die.** The retry prompt (`stream-parser.ts:362-366`) only says
   "retry the tool call with a complete arguments object" (`sdk/src/impl/llm/errors.ts:92-97`) —
   it never steers away from the failure mode. Because the failed call is dropped from history
   (asserted in `loop-agent-steps-part-f.test.ts:204-214`), the retry re-emits the entire huge
   arguments object from scratch → same truncation risk → strike 2 fails identically.
3. **The 2-strike cap is tight for output-budget truncation**, and each strike burns a full model
   call on a doomed re-emission (`loop-iteration.ts:311-319`).
4. **The exhausted message carries no tool name and no guidance**, so the parent Orchestrator has
   nothing actionable and the whole Forge run is lost, including any partial work.

### Expected Behavior

- When a native tool call truncates, the retry prompt should steer the model toward the fix
  (split large payloads into multiple smaller calls), not just repeat "retry."
- The strike cap should tolerate at least one more attempt after the split-guidance lands.
- If recovery is still exhausted, the failure must name the tool and give the parent a
  re-spawn strategy, not surface as an opaque stack trace.

### Root Cause

- **Immediate:** flash-class models streaming long single tool-call payloads (a whole file via
  `write_file`) hit output-budget/stream termination mid-JSON. The provider flush
  (`flush-handler.ts:58-66`) correctly refuses to emit malformed candidates, but the recovery
  loop then demands a byte-for-byte re-emission of the same oversized call.
- **Structural:** the recovery message is not tool-aware; the strike cap (2) is smaller than the
  number of attempts a split-guidance strategy needs; the exhausted failure discards the only
  diagnostic (the tool name) that makes the failure actionable.

### Evidence

```text
Agent run error: Native tool-call recovery failed twice consecutively; ending the agent run
without executing the incomplete tool call.
at runLoopIteration (...\packages\agent-runtime\src\run-agent-step\loop-iteration.ts:372:15)
at async loopAgentSteps (...\loop.ts:156:27)
at async executeSubagent (...\spawn-agent-utils.ts:565:20)
at async ... spawn-agents.ts:168:30
```

Session history shows the same truncation class repeatedly (recovered one-off cases):
`read_files` args cut at `{"offset"...`, `write_todos` missing `completed`, `str_replace` missing
`oldString` — all "malformed or incomplete" tool-call errors.

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/run-agent-step/loop-iteration.ts` — strike logic + exhausted throw
- `packages/agent-runtime/src/run-agent-step/constants.ts` — exhausted message + new strike constant
- `packages/agent-runtime/src/run-agent-step/types.ts` — `RunAgentStepResult` (new tool-name field)
- `packages/agent-runtime/src/tools/stream-parser.ts` — TOOL_CALL_ERROR message construction
- `packages/agent-runtime/src/__tests__/loop-agent-steps-part-f.test.ts` — recovery contract tests
- `sdk/src/impl/llm/errors.ts` — unchanged (message stays generic; steering lives in runtime)
- `common/src/types/provenance.ts` — canonical `WriteToolName` union reused for the payload set

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround (spawned agent runs hard-fail on flash models)
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Three coupled changes (each worthless without the others):

1. **Tool-aware steering** — in `stream-parser.ts`, when the error chunk is
   `errorClass: 'native-incomplete'` (`common/src/types/contracts/llm.ts:30-37` carries
   `toolName`), append split-guidance to the TOOL_CALL_ERROR message for known large-payload
   tools: *"If the arguments are large, split the work into multiple smaller tool calls (e.g.,
   write a smaller initial file, then use `str_replace` to append); keep each tool call's
   arguments compact."* The payload set is the canonical `WriteToolName` union
   (`common/src/types/provenance.ts:14` — `write_file | str_replace | apply_patch`) plus
   `read_files` (multi-path). Never embed truncated argument fragments (Law 12; already asserted
   by `sdk/src/impl/__tests__/llm-native-tool-call.test.ts:29-35`).
2. **3-strike cap** — add `NATIVE_TOOL_CALL_RECOVERY_MAX_STRIKES = 3` to `constants.ts`; change
   `loop-iteration.ts:312` `>= 2` → `>= 3`. Streak-reset semantics unchanged (any non-incomplete
   step resets to 0).
3. **Graceful exhausted failure** — thread the last incomplete tool name from `runAgentStep`
   (`RunAgentStepResult` gains `lastIncompleteToolName?: string`; `stream-parser.ts` sets it from
   `chunk.toolName`) and build the exhausted message as
   `NATIVE_TOOL_CALL_RECOVERY_EXHAUSTED_MESSAGE` + ` (tool: <name>)` + parent guidance:
   *"Re-spawn with the work split into smaller steps (write in chunks, append with
   `str_replace`)."* Keep the existing prefix so `toContain` assertions in
   `loop-agent-steps-part-f.test.ts` remain valid.

### Steps

1. `constants.ts` — add `NATIVE_TOOL_CALL_RECOVERY_MAX_STRIKES`; keep the exhausted message
   prefix for test compat.
2. `types.ts` + `stream-parser.ts` — add `lastIncompleteToolName` to `RunAgentStepResult`; set
   it when `errorClass === 'native-incomplete'`; append steering when the tool is in the
   large-payload set (reuse `WriteToolName`, no duplicated set — Law 7/13).
3. `loop-iteration.ts` — read the strike cap constant (`>= NATIVE_TOOL_CALL_RECOVERY_MAX_STRIKES`)
   and include `lastIncompleteToolName` + re-spawn guidance in the exhausted error.
4. Guard the unknown-tool false-positive: only apply steering for known large-payload tools;
   log a `warn` when a tool call is flagged incomplete whose name is absent from
   `requiredToolKeys` (provider-tool-set drift observability — `tool-arguments.ts:56-65` returns
   `false` for unknown tools).
5. Tests — update the exhaustion test (`llmCallCount` 2 → 3), add steering-message test
   (large-payload tool gets split guidance; non-payload tool gets the generic message), add
   exhausted-message test (contains tool name + re-spawn guidance).
6. Gate sweep — typecheck ×4, agent-runtime suite, sdk suite, eslint, lint:md, prettier.

### Verification

- `cd packages/agent-runtime && bun run typecheck && bun test src/`
- `cd sdk && bun run typecheck && bun test src/`
- Grep call-graph: `normalizeNativeToolCallStreamError` consumers; `lastIncompleteToolName`
  set/read sites; `NATIVE_TOOL_CALL_RECOVERY_MAX_STRIKES` usage.
- Contract preserved: no orphaned assistant tool-call/tool messages on an incomplete step;
  streak resets on any non-incomplete step.

## Perfection Loop

### Loop 1 — RED

- **RED:** Cataloged R-01 (raw guidance-free exhausted failure), R-02 (retry re-emits the same
  oversized call — no steering), R-03 (2-strike cap too tight for output-budget truncation),
  R-04 (exhausted message lacks tool name + action), R-05 (incomplete call dropped from history
  forces full re-emission — inherent, documented).
- **GREEN:** Solution = steering + 3 strikes + graceful failure (see Proposed Solution).
- **AUDIT:** Cited `constants.ts:1-2`, `loop-iteration.ts:311-319,372`, `stream-parser.ts:358-367`,
  `errors.ts:90-99`, `contracts/llm.ts:30-37`, `flush-handler.ts:58-66`, part-f tests
  `loop-agent-steps-part-f.test.ts:150-320`. Call-graph checked: `NATIVE_TOOL_CALL_RECOVERY_EXHAUSTED_MESSAGE`
  is consumed only by `loop-iteration.ts` + tests; `normalizeNativeToolCallStreamError` only by
  `sdk/src/impl/llm/stream.ts` + its test — the steering change must therefore live in
  `stream-parser.ts` (runtime owns agent behavior; SDK message stays generic — Law 13).
- **ADVERSARIAL:** Challenged the 3-strike bump as "burning tokens without fixing the cause";
  resolved by coupling it to steering (step 1 feeds step 2). Challenged tool-name threading as
  unnecessary surface; resolved: the tool name is the single diagnostic the parent needs to
  re-spawn effectively.
- **CHANGE DELTA:** 100% (document creation).

### Missed Questions

> Surface every question that should have been asked when this FID was created, answer it with
> the most robust default derivable from inspection, and fold the answer back into the relevant
> sections.

1. **Which tools count as "large payload"?** → Reuse the canonical `WriteToolName` union
   (`common/src/types/provenance.ts:14`) + `read_files` (multi-path). No duplicated set (Law 7).
2. **Does steering risk leaking truncated argument fragments?** → No. `sdk/src/impl/__tests__/
   llm-native-tool-call.test.ts:29-35` already asserts no `rawArguments` echo; steering adds only
   the tool name + static guidance (Law 12).
3. **Is 3 strikes worth the extra model call?** → Only when paired with steering; the bump alone
   would likely waste the 3rd call. The two changes land together (documented coupling).
4. **What if the model ignores the split guidance?** → The exhausted failure then carries the tool
   name + re-spawn guidance so the parent can re-spawn with an explicit split-task prompt — the
   durable backstop.
5. **Should the strike streak persist across a re-spawn?** → No. Per-run state is correct; the
   parent guidance is the durable mechanism, and each subagent run starts fresh.
6. **Can a complete call be misflagged incomplete?** → Yes, when its name is absent from
   `requiredToolKeys` (`tool-arguments.ts:56-65` returns `false` for unknown tools). Mitigation
   folded into step 4: steering applies only to known tools, and unknown-tool incompletes log a
   `warn` so provider-tool-set drift is observable instead of being misread as model truncation.
7. **Test-contract impact?** → The exhaustion test asserts `llmCallCount` `toBe(2)`
   (`loop-agent-steps-part-f.test.ts:191`) → must become 3; "recovers on the next step" and
   "resets the streak" tests remain valid. `toContain('Native tool-call recovery failed twice
   consecutively')` stays green if the prefix is preserved.

### Implementation Evidence (REQUIRED for `closed`)

> A FID **cannot** be set to `closed` without this section filled. No silent deferrals — every
> step must be `implemented`, `blocked`, or `deferred` (operator-approved only).

- [x] **Commit SHA:** working tree, uncommitted (operator commits when ready). Reproducible via
      the file:line ranges below.
- [x] **File:line ranges:** `constants.ts:1-26` (MAX_STRIKES, steering, re-spawn guidance,
      builder); `stream-parser.ts:47-51` (steer set), `:193` (state), `:370-413` (error branch:
      tool-name capture, drift warn, steering suffix), `:481` (return); `step.ts:93,263,391`
      (threading); `loop-iteration.ts:283,315-320` (3-strike cap + exhausted builder);
      `types.ts:111` (RunAgentStepResult field); tests `loop-agent-steps-part-f.test.ts:161`
      (3-strike exhaustion), `:301` (steering), `:344` (drift warn).
- [x] **Gate output:** typecheck ×4 exit 0 (sdk/common/agent-runtime/cli); agent-runtime suite
      **973 pass / 0 fail**; SDK suite **477 pass / 0 fail**; repo-wide eslint 0 warnings;
      `lint:md` exit 0; prettier clean (see Resolution for pasted runs).
- [x] **Reproducibility:** `grep -rn lastIncompleteToolName packages/agent-runtime/src` shows
      the full set→return→step→loop→builder chain; `grep -rn NATIVE_TOOL_CALL_RECOVERY_MAX_STRIKES`
      shows the constant consumed at `loop-iteration.ts:315`; `NATIVE_TOOL_CALL_STEERING_MESSAGE`
      consumed at `stream-parser.ts:403`.
- [x] **Step statuses:** all 6 steps `implemented` (verified by the gates above); operator
      approved implementation (2026-08-16, "approve").

**Implementation deviations (recorded honestly):**

1. The exhausted message was reworded from "failed twice consecutively" to **"failed repeatedly"**
   — at 3 strikes "twice" would be factually wrong; the two `toContain` assertions in
   `loop-agent-steps-part-f.test.ts` were updated to match. The FID's Loop-1 note about keeping
   the prefix was superseded by accuracy.
2. Step 4's drift warn checks the tool name against the canonical native `toolNames` list
   (`stream-parser.ts:382-394`) rather than threading llm-providers' `requiredToolKeys` through
   four packages — the runtime-observable equivalent of "absent from requiredToolKeys". The
   substantive guard (steering only for known payload tools) is fully implemented; unknown-tool
   incompletes are still surfaced via `logger.warn`.

### Code Verification Evidence

> Before marking status as `fixed` or `verified`, verify that referenced code exists. FID
> metadata is a claim; code is ground truth.

- [x] Files referenced in Affected Components exist (all cited paths verified by read this session)
- [ ] Implementation matches the Proposed Solution (pending)
- [ ] Typecheck/tests/lint pass with pasted tool output (pending)
- [ ] Production call-graph evidence present for new wiring (pending — AUDIT will grep
      `lastIncompleteToolName` and the strike constant)
- [x] FID status reflects the actual implementation state — `converged` (plan loop-passed,
      implementation not started)

### Loop 2 — Independent audit and self-correction

- **RED:** Second pass found two gaps: (1) the SDK layer was initially targeted for the steering
  message — re-audit showed the runtime owns agent behavior and the SDK stays generic (Law 13);
  (2) the unknown-tool false-positive in `isCompleteKnownToolCallArguments` was not cataloged in
  Loop 1 — a complete call to a tool missing from `requiredToolKeys` would be flagged incomplete,
  inflating the strike count.
- **GREEN:** Steering relocated to `stream-parser.ts`; step 4 (unknown-tool guard + `warn` log)
  added; MQ-6 folded in.
- **AUDIT:** Re-verified the call graph: the TOOL_CALL_ERROR message is built only in
  `stream-parser.ts:362-366`; the `StreamErrorChunk` already carries `toolName`
  (`contracts/llm.ts:30-37`), so no provider/SDK change is needed for the tool name to reach the
  runtime — confirmed the fix surface is runtime-only.
- **ADVERSARIAL:** Attempted to refute "runtime-only fix" — could the SDK's
  `normalizeNativeToolCallStreamError` be the better steering point? Refuted: it is consumed by
  `sdk/src/impl/llm/stream.ts` and its test only, and the SDK layer is product-agnostic; the
  agent-runtime owns retry behavior. ADJUSTED the FID to leave `errors.ts` untouched.
- **CHANGE DELTA:** ~12% (step 4 added, MQ-6 added, approach re-worded).

### Loop 4 — Implementation audit (post-IMPLEMENT)

- **RED:** Implementation surfaced two refinements: the exhausted message text was stale at the
  new strike count, and the drift-warn needed a runtime-observable check (the llm-providers
  `requiredToolKeys` map is not visible in the runtime).
- **GREEN:** Message reworded to "failed repeatedly" + tests updated; drift warn keyed on the
  canonical native `toolNames` list with a `logger.warn` at `stream-parser.ts:382-394`. Both
  recorded as deviations above.
- **AUDIT:** Typecheck ×4 exit 0; agent-runtime 973/0; SDK 477/0; eslint 0; lint:md 0;
  prettier clean. Call-graph grep for `lastIncompleteToolName` and the new constants confirms
  production wiring (see Implementation Evidence).
- **ADVERSARIAL:** Attempted refute — could the reworded message break the CLI's handling of the
  exhausted error? Refuted: the string is consumed only by `loop-iteration.ts` (throw) and the
  part-f assertions; no CLI/UI string match exists (`grep 'failed twice consecutively'` now
  returns no matches). CONFIRMED clean.
- **CHANGE DELTA:** ~6% (evidence + resolution + loop 4).

### Loop 3 — Final convergence

- **RED:** Residual risk: the 3rd model emission may still truncate even with guidance; mitigated
  by the parent re-spawn path (step 3). No remaining cataloged issues.
- **GREEN:** No further corrections; all Missed Questions answered and folded in.
- **AUDIT:** Five Questions pass — (1) ALL cases: steering covers the known set, generic path
  preserved for everything else; (2) scales to 1000 agents: constant + message changes only, no
  new state; (3) hostile attacker: static guidance, no fragment echo, no new surface (Law 12);
  (4) maintainable in 2 years: reuses `WriteToolName`, one named constant, no duplicated logic;
  (5) industry standard: converts a silent hard-fail into a steer-and-recover path with
  actionable failure.
- **ADVERSARIAL:** No residual findings. Verdict: document converged.
- **CHANGE DELTA:** < 2% (no substantive change from Loop 2 → convergence detected).

## Resolution

- **Closed Date:** 2026-08-16 (implementation gates green; operator approved implementation)
- **Fix Description:** Native tool-call recovery hardened in the agent runtime: (1) the
  TOOL_CALL_ERROR retry prompt now appends split-steering for large-payload tools
  (`write_file`/`str_replace`/`apply_patch`/`read_files`); (2) the strike cap is a named constant
  `NATIVE_TOOL_CALL_RECOVERY_MAX_STRIKES = 3`; (3) the exhausted failure names the last
  incomplete tool and carries a re-spawn strategy; (4) incomplete calls for tools unknown to the
  runtime log a drift warn instead of being misread as truncation.
- **Tests Added:** Yes — 3-strike exhaustion contract (was 2), steering-present for `write_file`,
  steering-absent for `sequentialthinking`, drift warn + tool name on exhaustion for an unknown
  tool; streak-reset count updated to 5.
- **Verification Evidence:** `cd packages/agent-runtime && bun run typecheck` exit 0; `bun test
  src/` → **973 pass / 0 fail**; `cd sdk && bun run typecheck && bun test src/` → **477 pass /
  0 fail**; `cd common && bun run typecheck` exit 0; `cd cli && bun run typecheck` exit 0;
  `bun x eslint . --max-warnings 0` → 0 warnings; `bun run lint:md` exit 0; `bun x prettier
  --check` clean.
- **Archived:** 2026-08-16 (moved to `dev/fids/archive/` with CHANGELOG + index entries)

> When status is set to **closed**, move this file to `dev/fids/archive/` and append an entry to
> `CHANGELOG.md`.

## Lessons Learned

Flash-class models will truncate large single tool-call payloads; the recovery loop must steer
the model toward smaller calls, tolerate one more attempt after that guidance lands, and — when
exhausted — hand the parent an actionable failure (tool name + re-spawn strategy) instead of an
opaque stack trace. A retry that re-emits the same oversized payload is not recovery; it is
re-rolling the same die.
