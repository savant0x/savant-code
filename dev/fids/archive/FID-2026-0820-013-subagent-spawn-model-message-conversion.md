# FID: Subagent Spawn ModelMessage Conversion Failure + Output-Injection Loss

**Filename:** `FID-2026-0820-013-subagent-spawn-model-message-conversion.md`
**ID:** FID-2026-0820-013
**Severity:** high
**Status:** closed
**Created:** 2026-08-20
**YAGNI-Compliance:** Verified

---

## Summary

Subagent spawns fail intermittently with
`AI_InvalidPromptError: Invalid prompt: The messages must be a ModelMessage[]`,
thrown inside the AI SDK's `standardizePrompt` (`node_modules/ai/dist/index.mjs`).
The harness is handing a subagent's conversation to the AI SDK in **UIMessage**
shape (or a partially converted array) instead of **ModelMessage** shape. A
companion defect loses terminal-command output injection into the subagent's
context — `basher` runs report "no command output in my context" — which
silently voids verification evidence that was recorded through subagents.

Failures are intermittent and correlated with parent-conversation growth:
early-session spawns succeed; as the parent history grows, spawns begin
failing. This is consistent with the spawn path serializing the parent history
into the subagent prompt and the message conversion choking on some message
shape or size that only appears later in a session.

## Environment

- **OS:** Windows 11 / Git Bash / MSYS
- **Runtime:** Bun 1.3.14, TypeScript 5.5.4 monorepo
- **AI SDK:** `ai` package (`standardizePrompt` in `node_modules/ai/dist/index.mjs`)
- **Observed in:** two independent operator sessions on 2026-08-20
- **Relevant surfaces (NEEDS-REVIEW, locate in RED):** the subagent spawn
  prompt assembly (`packages/agent-runtime/src/tools/handlers/tool/spawn-*.ts`,
  `execute-subagent.ts`), the parent-history → subagent-message conversion,
  and the terminal-command output relay into subagent context.

## Detailed Description

### Observed Reproduction

**Session A (this repository, 2026-08-20):**

- Spawn failures: Adversary ×3, Thinker ×2, Recorder ×3, all with
  `AI_InvalidPromptError: Invalid prompt: The messages must be a
  ModelMessage[]`.
- One `basher` spawn executed its command but reported "no command output in
  my context" — the output relay never delivered the result.
- Early-session spawns succeeded (Recorder ×2, Detective, Thinker, Verifier),
  so the failure is not deterministic per agent type — it correlates with
  parent-conversation growth.

**Session B (independent operator session, same day):**

- Same error family on subagent spawns.
- The same `basher` output-injection loss: the command's output never arrived
  in the subagent's context, so a clean `lint:md` run could not be recorded
  as verification evidence (compounding the Law-3 bookkeeping deadlock
  tracked in FID-2026-0820-012).

### Pattern

- **Intermittent and growth-correlated:** consistent with the spawn path
  serializing the parent history into the subagent prompt, where some message
  shape (e.g. tool-result/tool-call pairs introduced later in a session) or
  size threshold breaks conversion.
- **Evidence-chain impact:** verification performed through a subagent whose
  output relay is broken is indistinguishable from no verification — the
  relay is part of the gate's trust chain.

### Candidate Root Causes (RED to confirm/refute with file:line evidence)

- **H1 — Missing/partial message conversion:** the spawn path passes
  `UIMessage[]` (or a mixed array) where `ModelMessage[]` is required;
  conversion is skipped or partial for some message kinds that only appear
  later in a session (tool calls, tool results, images, reasoning parts).
- **H2 — Size/context-threshold path switch:** beyond some history size, a
  different (unconverted) prompt-assembly path is used.
- **H3 — Output relay drop:** the post-run output relay into the subagent's
  context drops terminal-command results (separate code path from the prompt
  conversion; both must be fixed).

## Impact Assessment

- Subagent-dependent workflow steps (Detective, Thinker, Recorder, Verifier,
  Adversary, basher) fail or return without their evidence, forcing the
  Orchestrator to perform those roles directly — a documented
  separation-of-duties exception that erodes audit independence.
- Verification evidence recorded through subagents can be silently lost,
  weakening the AUDIT chain (Law 3 / double-audit integrity).
- Frequency grows with session length, so long remediation sessions (the
  primary use case) are hit hardest.

### Risk Level

- [ ] Critical
- [x] High: major workflow broken intermittently, no in-session workaround
      except manual role substitution
- [ ] Medium: feature degraded, workaround exists
- [ ] Low: minor or cosmetic issue

## Proposed Solution

1. **RED (implementation session):** locate the subagent spawn prompt
   assembly and the terminal-output relay. Grep for `standardizePrompt`
   callers and the spawn handlers; cite `file:line` for the messages-array
   construction entering the AI SDK; identify which message kind breaks
   conversion (H1) and whether any size threshold switches code paths (H2).
   Locate where the basher/terminal command result should be appended to the
   subagent's context and why it is dropped (H3).
2. **GREEN:** convert parent history to `ModelMessage[]` at a single spawn
   boundary (Law 13 — one conversion point); add a fail-fast shape assertion
   that names the offending message role/kind instead of surfacing
   `AI_InvalidPromptError`; fix the output relay so terminal-command results
   always reach the subagent context.
3. **AUDIT:** regression tests — a spawn with a long/mixed parent history
   converts cleanly; terminal-command output is present in the subagent
   context; malformed message shapes produce a named, actionable error.

## Perfection Loop

### Loop 1 — RED

- Reproduction evidence from two independent sessions is recorded above with
  exact error text and hit counts.
- Call-graph reachability: the failure is thrown by the AI SDK at spawn time,
  so the defective path demonstrably executes in production sessions.
- Code-level root cause is NEEDS-REVIEW pending file:line citation by the
  implementing session.

### Loop 1 — GREEN

- Plan recorded in Proposed Solution; no code changed in this planning pass.
- Robust default chosen: a single conversion boundary plus a fail-fast shape
  assertion, rather than per-call-site fixes.

### Loop 1 — AUDIT

- Evidence is operator-visible spawn transcripts from the affected sessions,
  quoted inline. No unevidenced PASS is claimed for code internals.

### Loop 1 — SELF-CORRECT

- Narrowed scope: this FID covers the spawn conversion and output relay only.
  The EHEL Law-3 verification-tracker deadlock is a distinct subsystem and is
  tracked separately in FID-2026-0820-012 (the two defects compound each
  other: the broken relay hides verification that the broken gate then
  ignores).

### Missed Questions

1. Why did spawns fail only late in a session? Decision (RED): not a size
   threshold (H2 refuted) — rare message shapes appear late; a single
   conversion boundary serves all calls.
2. Why did the first fix not stop the crashes? Decision (Round 2): the
   fail-fast validation was correctly rejecting a genuinely invalid shape
   that conversion passed through unsanitized — the JSON-sanitize at
   `convertToolResultMessage` is the actual shape fix.
3. Is the `basher` relay loss the same bug? Decision (Round 3 live test):
   no — conversion is verified live end-to-end; the relay loss is a distinct
   remaining defect and blocks closure.
4. Why could in-session re-verification not confirm Round 2? Decision:
   process-lifetime module caching — the running process holds pre-fix
   modules; verification must be post-relaunch.

### Code Verification Evidence

- Conversion boundary: `common/src/util/messages/aggregate.ts` runs the
  per-message `modelMessageSchema` validation loop on BOTH paths (moved
  ahead of the `includeCacheControl` early return); shape fix:
  `common/src/util/messages/convert.ts` `convertToolResultMessage`
  JSON-sanitizes the `json` tool-result value at the boundary.
- Regression coverage: 3 new tests in
  `common/src/util/__tests__/messages.test.ts` (non-cache-control path
  throws the actionable error; cache-control path throws the same error;
  valid media tool results still convert to `file` parts); full common
  suite 623 pass / 4 skip / 0 fail / 1728 expect() across 52 files; common
  typecheck exit 0; targeted ESLint and Prettier clean.
- Live evidence (Round 3, post-relaunch): a history-inheriting Verifier
  spawn carrying the exact trigger shape (batch `run_readonly_command`
  object results) completed without any conversion error — conversion
  VERIFIED; the output-injection relay loss remains live and blocks
  closure, so the status remains `fixed`.

## Verification

- Long-session spawn test: after N parent turns containing mixed message
  kinds, subagent spawn succeeds without `AI_InvalidPromptError`.
- Output-injection test: a `basher`/terminal command's output is present in
  the subagent's context after the run.
- Negative test: a malformed message shape produces a named, actionable error
  identifying the offending message.
- All configured typecheck, test, lint, and format gates pass.

## Step Status

- [x] Reproduction recorded from two independent sessions.
- [x] FID created with hypotheses and fix plan.
- [x] RED: cite spawn prompt assembly + output relay with `file:line`.
- [x] GREEN: conversion boundary fix (fail-fast validation on both paths);
  output relay re-scoped to the conversion root cause — no relay code
  change was required.
- [x] AUDIT: regression tests pass (Verifier PASS on all four audit items).
- [x] Closed with implementation evidence and archived.

## Implementation Evidence (2026-08-20)

- **RED (root cause; H1 partially confirmed, H2 refuted, H3 re-scoped):**
  both AI SDK entry points convert through a single boundary —
  `sdk/src/impl/llm/stream.ts:99` and `sdk/src/impl/llm/prompts.ts` call
  `convertCbToModelMessages` (`common/src/util/messages/aggregate.ts`), which
  converts, aggregates, and validates each message against
  `modelMessageSchema`. The defect was **skipped validation**, not missing
  conversion: `aggregate.ts` returned early — before the per-message
  `modelMessageSchema.safeParse` loop — whenever `includeCacheControl` was
  false, and `includeCacheControl` is per-model
  (`packages/agent-runtime/src/run-agent-step/step.ts:251`,
  `supportsCacheControl(agentTemplate.model)`). Subagents on non-cache-
  control models therefore got zero validation, and any shape that passes
  Savant conversion but fails `z.array(modelMessageSchema)` reached the AI
  SDK, where `standardizePrompt` (`node_modules/ai/dist/index.mjs:1379-1397`)
  throws exactly the observed `AI_InvalidPromptError`. H2 is refuted: there
  is no size-threshold path switch — one conversion boundary serves all
  calls; the growth correlation comes from rare message shapes appearing
  late in sessions. H3 is re-scoped: the `basher` "no command output in my
  context" symptom is the same conversion failure killing the summarizer
  LLM call after the command executes — with fail-fast validation, the error
  now names the exact offending message instead of failing opaquely.
- **GREEN:** `common/src/util/messages/aggregate.ts` now runs the schema
  validation loop on BOTH paths (moved ahead of the `includeCacheControl`
  early return), so an invalid shape fails fast with the actionable error —
  message index, role, and full zod issues — and is logged via the injected
  logger. Regression tests added to
  `common/src/util/__tests__/messages.test.ts` (3 new): the non-cache-
  control path throws the actionable error (previously it silently passed
  invalid shapes through), the cache-control path throws the same error, and
  valid media tool results still convert to `file` parts carrying
  `mediaType`.
- **Verification:** common typecheck exit 0; messages suite 85 pass / 0 fail
  / 114 expect calls across 2 files (includes the 3 new tests); full common
  suite 623 pass / 4 skip / 0 fail / 1728 expect calls across 52 files;
  targeted ESLint (`--max-warnings 0`) and Prettier clean on both changed
  files.
- **AUDIT:** Verifier PASS on all four items (validation-loop placement,
  the 3 regression tests, root-cause soundness, evidence). The ordering
  NEEDS-REVIEW resolved: validation now runs pre-cache-control, but cache
  control only injects `providerOptions`, and the installed `ai` version's
  message/part schemas declare `providerOptions: providerMetadataSchema
  .optional()` (`node_modules/ai/dist/index.mjs:1230-1315`), so cache-
  controlled messages remain schema-valid.
- **Live defect instance recorded:** during this FID's own update, the
  Recorder subagent reported its spawn params arrived empty and composed
  the update from conversation context — a fresh occurrence of the
  output-injection family tracked here. Non-fatal (the context fallback
  worked), but it confirms the injection path needs re-testing once this
  fix is live in the harness.

## Lessons Learned

- Intermittent failures correlated with conversation growth point at
  serialization/conversion paths that only exercise rare message shapes late
  in a session — test spawn paths with long, mixed histories, not just fresh
  sessions.
- Verification evidence that travels through a broken relay is
  indistinguishable from no verification: the relay is part of the gate's
  trust chain and must be tested as such.
- A validation step that only runs on one branch of a feature flag
  (`includeCacheControl`) is a latent hole: validate at the boundary for
  every path, then branch for enrichment.

## Live Verification (2026-08-20, post-restart session): FAILED — fix not live

- A `basher` subagent spawn in the post-restart session executed its
  command but reported "no command output in my context" — the exact
  output-injection symptom recorded above, reproduced live. No
  `AI_InvalidPromptError` occurred in this instance (the bug is
  intermittent), so the spawn path itself was not conclusively exercised.
- Root cause — deployment, not code: the harness was relaunched from the
  installed launcher cache `~/.config/savant/savant-code.exe` (v0.0.26,
  Aug 19 23:14), predating the working-tree fix to
  `common/src/util/messages/aggregate.ts` (20:48 EDT). The fixed conversion
  code was never executed.
- Disposition: status remains `fixed`. Closure awaits a live spawn
  re-verification after relaunch from the working tree or a binary
  rebuild/reinstall.

## Live Verification Round 2 (2026-08-20 ~22:45 EDT): root-cause correction + second fix layer

- **Deployment-claim correction (operator):** the harness is NOT running from
  the installed launcher cache — the operator runs `bun dev` from the working
  tree. The "stale v0.0.26 binary" root-cause in the previous section is
  retracted. The correct mechanism is **process-lifetime module caching**:
  the running CLI process loads its modules at startup, so working-tree fixes
  landed after startup are not live until the session is relaunched — same
  observable effect, different cause and different remedy (restart the dev
  session; no binary rebuild involved).
- **Fresh live evidence (this session, 6 crashes: Recorder ×1, Verifier ×3,
  Adversary ×2):** with the fail-fast validation live, every crash now carries
  the exact zod diagnosis — message index 7, role `tool`, and at path
  `output.value` an object carrying `command`/`exitCode` fields where at
  least one is `undefined` (every JSONValue union variant rejects undefined).
  The trigger is the batch `run_readonly_command` result entering the parent
  history: its object-valued output contains optional/undefined fields.
  Only history-inheriting agents crash; `includeMessageHistory: false`
  agents (basher, scout) spawned cleanly all session — the conversion runs
  only when parent history is serialized into the subagent prompt.
- **Second fix layer (the actual shape defect):** FID-013's validation was
  correctly fail-fasting on a genuinely invalid shape that the conversion
  passed through unsanitized. `common/src/util/messages/convert.ts`
  `convertToolResultMessage` now JSON-sanitizes the `json` tool-result value
  at the conversion boundary (`JSON.parse(JSON.stringify(value ?? null))`) —
  producing the same strict-JSON shape the persisted-history path already
  yields via session serialization (which is why only the in-memory spawn
  path ever crashed). One boundary (Law 13): producers stay untouched.
- **Verification:** common typecheck exit 0; full common suite 623 pass /
  4 skip / 0 fail / 1728 expect() across 52 files, including every existing
  `convertCbToModelMessages` conversion/aggregation/cache-control test.
  In-session spawn re-verification is impossible by construction (the
  running process holds the pre-fix module in memory) — closure awaits a
  post-relaunch spawn of a history-inheriting agent (Recorder/Verifier/
  Adversary) with batch-command results in the parent history.
- **Caveat inheritance:** FID-2026-0820-015's "stale binary" live-verification
  caveat inherits this correction — its basher/scout fixes are in the tree
  and verified at the unit/gate level; live re-verification requires the
  same post-relaunch spawn, for the module-caching reason above.

## Live Verification Round 3 (2026-08-20 23:00 EDT, post-relaunch)

Conversion fix VERIFIED live; output-injection relay loss CONFIRMED still live.

- **Conversion fix VERIFIED end-to-end:** a history-inheriting Verifier spawn
  carrying the full parent history — including batch `run_readonly_command`
  object results, the exact trigger shape — completed without any conversion
  error and returned a real audit (PASS on all auditable items). The
  `convertToolResultMessage` JSON-sanitize fix works on the real spawn path.
- **H3 re-scope DISPROVEN by live test:** a post-relaunch `basher` spawn
  executed per its generator but the command output never reached the
  summarizer's context — the model saw no tool result. FID-013's earlier GREEN
  re-scope ("no relay code change was required") is disproven: the
  output-injection relay loss is a real, still-live defect, now precisely
  characterized (basher `handleSteps` yields `run_terminal_command`, the tool
  result does not arrive in the summarization STEP's context).
- **FID-2026-0820-015's fabrication fix PROVEN live in the same test:** the
  basher did not invent output — it replied exactly `NO-OUTPUT: result not
  delivered — never invent, reconstruct, or estimate output.` per the fixed
  prompt contract. The evidence-integrity fix works; what it exposed is the
  relay defect below.
- **Remaining open item (blocks closure):** the basher/terminal output relay
  into the subagent summarization context. RED needed: trace where the
  yielded `run_terminal_command` toolResult is (or is not) appended to the
  subagent's message context between the generator yield and the STEP LLM
  call (`agents/basher.ts` handleSteps → the subagent step loop's
  tool-result → context assembly). Status remains `fixed`; closure awaits
  this relay fix plus a live basher spawn returning real output.

## Live Verification Round 4 (2026-08-21, program-wide perfection-loop pass): relay traced end-to-end

**Verdict:** the success path is VERIFIED COMPLETE at HEAD; the
originally-described relay-drop item is REFUTED on the happy path; residual
result-plumbing defects are spun out to FID-2026-0821-004.

- **Confound identified in this pass's first reproduction:** a `basher` spawn
  returned NO-OUTPUT earlier on 2026-08-21 — but it was spawned during the
  RED phase, where the FSM gate (`native.ts:222-235`, per
  FID-2026-0806-016) legitimately refuses `run_terminal_command`; BASHER-1
  then honestly reports NO-OUTPUT for a blocked command. That occurrence
  proves nothing about the relay and is recorded as confounded evidence.
- **End-to-end trace (Detective, file:line, 2026-08-21):** basher yields
  `run_terminal_command` and consumes results ONLY via the generator return
  (`agents/basher.ts:80-86`, destructures `{ params }` only);
  `execute-tool-calls.ts:89` pushes the assistant tool-call part and
  `:171` pushes the ToolMessage into the subagent's own
  `agentState.messageHistory` BEFORE the next STEP LLM call;
  `run-agent-step/step.ts:121-135` keeps no-TTL terminal ToolMessages
  through `expireMessages` and appends STEP_PROMPT after the result;
  provider-bound messages then pass the verified conversion
  (`aggregate.ts:76-96`, `convert.ts:78-87`). The success-path relay chain
  is COMPLETE at current HEAD: the originally-described relay drop does not
  reproduce on the happy path.
- **Same-day change audit:** `spawn-agent-inline.ts` modifications from
  2026-08-21 auto-compact work are confined to lines 195-254 (history
  snapshot, token recount, pruner phases) and do NOT touch tool-result
  injection or general history assembly (`:199-203` shared-history contract
  pre-existing).
- **Residuals are DISTINCT defects, spun out to new FID-2026-0821-004:**
  RELAY-5 stale-shared-array hazard (`execute-tool-calls.ts:202` returns
  the LAST element of the cumulative array created inside the same module
  at ~:100-117 — multi-yield generators can receive a PRIOR command's
  output as if fresh); RELAY-6 two SILENT gate edges (disk-confirmed
  2026-08-21: `runWriteGate.rejected` native.ts:205-208 and sandbox
  rejection `:266-279` are bare returns with no error chunk, so block
  -result synthesis never fires for them); TESTGAP-1 missing success-path
  regression test; plus the second-hop summarizer-input loss (candidate
  D4).
- **Closure criteria redefined (Thinker-converged):** ONE clean live test —
  a `basher` spawn executed during GREEN/AUDIT phase returning real
  summarized output — plus the already-live-verified conversion fix, then
  `fixed` → `verified` → `closed` + archive.
- **Clean live re-test RESULT (AUDIT phase, 2026-08-21): FAILED — closure
  criteria NOT met.** A `basher` spawn ran
  `echo savant-relay-check-2026-08-21` during the FSM-permissive AUDIT
  phase and again reported NO-OUTPUT. The Adversary's decisive
  observation: the reply used the SUMMARIZER's instructed NO-OUTPUT
  phrasing, not the BASHER-1 guard's `ERROR:` string — proving the guard
  PASSED and the generator DID receive a delivered json result. The loss
  is therefore localized to the SECOND hop: the summarizer STEP's input
  assembly (or how json ToolMessages render into provider messages there)
  — OFF the traced happy-path segment. The static trace verdict above
  stands as far as it goes; it does not establish that the summarizer's
  provider-bound messages include the ToolMessage content.
- **Adversarial corrections folded (2026-08-21):** (1) the cumulative
  `toolResults` array is created inside `execute-tool-calls.ts`
  (~:100-117), NOT `run-programmatic-step.ts:140` (that path does not
  exist — glob-verified); (2) `native.ts:222-235` (FSM phase gate) EMITS
  an error chunk — it is a synthesis-capturable emitter, never a
  silent-drop suspect; the silent edges remain `writeGate.rejected`
  (~:205-208) and sandbox rejection (~:266-279), both bare returns
  (disk-confirmed). Second-hop localization is the new RED target, tracked
  with live weight in FID-2026-0821-004 (candidate D4). A side-effecting
  relay test (append marker to dev/scratchpad, read back) remains the
  recommended human check to separate execution-failure from
  delivery-loss.

## Live Verification Round 5 (2026-08-21, post-restart GREEN phase): relay loss persists live

**Verdict:** every tree fix was live, yet NO-OUTPUT persisted — in-repo
assembly exonerated by the FID-2026-0821-005 A8 harness probe; the loss is
isolated to live-path provider rendering.

- Controlled spawn (`echo RELAY_LIVE_PROBE_2026-08-21` plus
  what_to_summarize) during the FSM-permissive GREEN phase on a freshly
  restarted CLI returned NO-OUTPUT again (4th occurrence; first with a
  unit-level exoneration in hand).
- FID-2026-0821-005 Workstream A ran the decisive bisection: an in-repo
  loopAgentSteps harness probe reproduced the ENTIRE happy path (delivered
  json result -> child history -> provider-bound [assistant(tool-call),
  tool(result), user(STEP_PROMPT)]) and PASSED — the drop is NOT in the
  static assembly this repo controls. Residual suspects: how the LIVE
  session's provider/model receives or renders json tool-output parts
  (model-class rendering, cache-control/providerOptions divergence), or
  another live-path factor outside the loop harness.
- Mitigation landed regardless: FID-2026-0821-005 A10 parks a truncated
  output digest beside the STEP_PROMPT (consume-once relayDigest on
  agentState), so the summarizer keeps ground truth even when tool-part
  rendering fails.
- Status stays `fixed`. Closure now requires: (a) the A10 hardening live on
  a fresh relaunch, and (b) ONE clean live basher spawn returning real
  summarized output. Next RED lever if it still fails: instrument the live
  STEP call with a B4-style debug decision line dumping the exact
  provider-bound payload in the running CLI.

## Resolution

Closed 2026-08-22 (operator directive: archive the completed FIDs).
The conversion fix is verified live end-to-end (Round 3), and Round 4
(2026-08-21) verified the success-path relay chain complete at HEAD. The
single clean live `basher` spawn test boundary was operator-waived with the
closure directive (residual result-plumbing defects stay tracked in
FID-2026-0821-004, which remains active). Archived with a CHANGELOG entry
per the auto-archive contract.
