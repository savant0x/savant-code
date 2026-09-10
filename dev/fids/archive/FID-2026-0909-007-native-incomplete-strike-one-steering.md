# FID: Native-incomplete recovery loses its steering on the first strike

**Filename:** `FID-2026-0909-007-native-incomplete-strike-one-steering.md`
**ID:** FID-2026-0909-007
**Severity:** medium
**Status:** closed
**Created:** 2026-09-09 21:50
**YAGNI-Compliance:** Verified (extends the existing steering map + removes one redundant gate; no new machinery)
**Related:** FID-2026-0816-012 (strike cap + re-spawn guidance),
FID-2026-0819-004 (tool-specific steering ladder), LEARNINGS
`recovery-steers-not-just-retries`

---

## Summary

During the 2026-09-09 agenda session the native tool-call truncation class
(agents call it "turnacation") struck 9+ times: one Thinker spawn died at
3 strikes (`run_readonly_command`), and the parent absorbed bursts on
`read_files`, `run_readonly_command`, `spawn_agents`, and `write_file`.
0-EOF reads of the recovery machinery show the ladder itself is sound
(strike-2+ escalation via `native-strikes.ts` demonstrably reached the
model and fixed the `write_file` burst), but three gaps degrade the
first, most-important retry: (1) the tools that actually failed this
session — `spawn_agents`, `run_readonly_command`, `sequentialthinking` —
have no entry in the steering map, so they get only generic fallback text;
(2) strike-1 steering is gated on a five-member set
(`NATIVE_TOOL_CALL_STEER_SPLIT_TOOLS`), so unmapped tools get zero
split-the-payload guidance exactly when the model is deciding whether to
re-emit the same oversized arguments; (3) when an error is re-emitted
through the response relay its `errorClass`/`toolName` fields are lost,
the wrapper text doubles ("Please check the tool name and arguments and
try again." appears twice), and the steering suffix is stripped — the
observed parent messages were pure retry-the-same-payload invitations,
the exact anti-pattern LEARNINGS `recovery-steers-not-just-retries`
documents.

## Environment

- **OS:** Windows 11 (win32), Git Bash (MSYS)
- **Language/Runtime:** TypeScript 5.5.4 / Bun 1.3.14
- **Tool Versions:** savant-code v0.0.30 tree; model tokenrouter/z-ai/glm-5.3-free (flash-class)
- **Commit/State:** `c24e962b` (FID-2026-0909-006 governance commit); one untracked operator design doc

## Detailed Description

### Problem

Three observed defect classes, all this session (2026-09-09 ~23:36Z–00:15Z):

1. **Subagent run death.** A spawned Thinker carrying a large critique
   prompt died with
   `Native tool-call recovery failed repeatedly; ending the agent run
   without executing the incomplete tool call. (tool: run_readonly_command)`
   at `loop-iteration.ts:259`. `run_readonly_command` has no steering-map
   entry — across its 3 strikes it received only the generic fallback, and
   the run was killed with the payload never shrunk.
2. **Doubled wrapper + stripped steering at strike 1.** The parent-level
   error messages arrived as (verbatim, one representative):
   `Error during tool call: Incomplete arguments for tool read_files;
   retry the tool call with complete arguments object.. Please check the
   tool name and arguments and try again.. Please check the tool name and
   arguments and try again.` — the wrapper suffix appears twice, no
   tool-specific steering appears (despite `read_files` being a steering
   member), and the SDK template's "with a complete arguments object"
   lost its "a" — the text passed through a non-template re-emission.
   Mechanism: `error-chunk.ts:89` and `response-handler.ts:27` both wrap
   error chunks with the same prefix; a re-emitted error carries only the
   message text (no `errorClass`, no `toolName`), so the second wrap
   appends its suffix again and `steering` evaluates to `''`.
3. **Steering-map coverage gap.** The session's failing tools:
   `read_files` (mapped — but steering lost per #2),
   `write_file` (mapped — steering reached the model at strike 2 and the
   burst recovered), `spawn_agents` (unmapped), `run_readonly_command`
   (unmapped), `sequentialthinking` (unmapped — the Thinker death class).
   The map (`NATIVE_TOOL_CALL_STEERING_MESSAGES`) covers 5 tools; the
   largest payloads in the system — spawn prompts and thought texts —
   are not among them.

### Expected Behavior

On the FIRST native-incomplete strike the model receives tool-specific
split-the-payload guidance for every truncation-prone tool that reaches
the stream-error path with its classification intact (mapped tools get
their tailored hint; unmapped tools get the generic fallback hint —
never empty steering), and the wrapper text appears exactly once at
every wrap boundary. Honest residual (adversarial audit, 2026-09-09):
field-less re-emitted errors — the relay path that never carried
steering logic — still lack strike-1 steering after this fix; they
recover via the strike-2+ ladder, which steers from the loop-tracked
tool name (the proven write_file path). Full closure (restoring
`errorClass`/`toolName` onto the relayed error event) is an explicitly
out-of-scope follow-up — Missed Question 9.

### Root Cause

FID-2026-0819-004 built the steering ladder around the five tools known
to truncate at the time, and gated strike-1 steering on a parallel
five-member Set rather than on the policy that already lives in
`getSteeringMessage`'s map-plus-fallback. The relay path
(`response-handler.ts`) predates native-incomplete classification and
wraps any error chunk unconditionally — including already-wrapped text —
so re-emitted errors double their suffix and shed their fields.

### Evidence

```text
# The steering map — 5 tools; this session's failing tools absent:
packages/agent-runtime/src/run-agent-step/constants.ts:14
  run_terminal_command, write_file, str_replace, apply_patch, read_files
  * spawn_agents absent — the largest payloads in the system (spawn prompts)
  * run_readonly_command absent — the Thinker's dying tool
  * sequentialthinking absent — the Thinker's own truncation class

# The strike-1 gate — Set membership, not policy:
packages/agent-runtime/src/tools/stream-parser/error-chunk.ts:19
  NATIVE_TOOL_CALL_STEER_SPLIT_TOOLS = Set(write_file, str_replace,
  apply_patch, read_files, run_terminal_command)
packages/agent-runtime/src/tools/stream-parser/error-chunk.ts:81-88
  steering = (native-incomplete && toolName in Set)
    ? getSteeringMessage(toolName, 1) : ''

# The unconditional second wrapper — no errorClass awareness, no guard,
# and (adversarial audit) NO steering logic at all — the relay is the
# terminal emitter of the observed messages, which is why even a Set
# member (read_files) showed no strike-1 hint:
packages/agent-runtime/src/tools/stream-parser/response-handler.ts:23-31
  if (chunk.type === 'error') { markToolCallError();
    errorMessages.push(userMessage({ content: withSystemTags(
      `Error during tool call: ${chunk.message}. Please check the tool
      name and arguments and try again.`) ... })) }

# The strike-2+ ladder that WORKED (uses the tracked tool name, not
# chunk fields — why write_file recovered):
packages/agent-runtime/src/run-agent-step/loop/native-strikes.ts:46-58

# The SDK origin of the retry suffix (first wrap source):
sdk/src/impl/llm/errors.ts:99
  `Incomplete arguments for tool ${toolName}; retry the tool call with a
  complete arguments object.`

# Observed parent messages (verbatim, this session):
`Error during tool call: Incomplete arguments for tool read_files; retry
the tool call with complete arguments object.. Please check the tool name
and arguments and try again.. Please check the tool name and arguments
and try again.`
  → suffix ×2, no steering, "a" dropped from the SDK phrase

# Zero direct unit pins for the steering surface:
$ grep -rln "getSteeringMessage|handleStreamErrorChunk" \
    packages/agent-runtime/src --include=*.test.ts
  (no matches — loop-level strike-count tests exist in
   loop-agent-steps-part-f*.test.ts; the steering TEXT is unpinned)

# Thinker death stack (verbatim key line):
`Native tool-call recovery failed repeatedly; ending the agent run
without executing the incomplete tool call. (tool: run_readonly_command)
Re-spawn with the work split into smaller steps ...`
  at runLoopIteration (loop-iteration.ts:259) / loopAgentSteps (loop.ts:187)
# Wrap-chain attribution note (adversarial audit, 2026-09-09): the
# observed shape — ONE 'Error during tool call:' prefix but the suffix
# twice — cannot be produced by either known wrap site alone (both
# prepend the prefix). The exact chain (which site emitted the inner
# layer, and where the article 'a' was dropped) is runtime-flow dependent
# and not statically resolvable; the two sites above are the guarded
# surface regardless, and the guard at BOTH sites covers every chain.
```

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/run-agent-step/constants.ts` (steering map
  gains 3 entries; `getSteeringMessage` fallback unchanged — it already
  returns non-empty hints for unmapped tools at every strike tier)
- `packages/agent-runtime/src/tools/stream-parser/error-chunk.ts` (strike-1
  steering ungated: every native-incomplete chunk steers; the
  `NATIVE_TOOL_CALL_STEER_SPLIT_TOOLS` Set is deleted — Law 13: the map +
  generic fallback in `getSteeringMessage` already encode the policy)
- `packages/agent-runtime/src/tools/stream-parser/response-handler.ts`
  (idempotence guard: never re-wrap a message already prefixed
  `Error during tool call:`)
- New pin suite (RED-first): steering-map entries × tiers, generic
  fallback non-emptiness, strike-1 steering for an unmapped tool
  (`run_readonly_command`), and the re-wrap guard
- Not affected: strike caps (`native-strikes.ts` — the ladder works and
  is already pinned by `loop-agent-steps-part-f-strikes.test.ts`), the
  SDK's `normalizeNativeToolCallStreamError` (correct first-wrap source),
  `buildNativeToolCallExhaustedMessage` (re-spawn guidance already sound)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: recovery degrades on the first strike for unmapped tools and
      re-emitted errors; subagent runs die at the 3-strike cap without ever
      receiving split guidance — wasted credits + lost work, but a retry
      with a smaller payload (the documented workaround) succeeds
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Three surgical changes, one per defect:

1. **Map coverage** (`constants.ts`): add entries for the three tools that
   truncated this session — `spawn_agents` (hint: shrink the spawn prompt —
   subagents inherit conversation context, so state the delta only;
   explicit: the prompt JSON is too large, reference files instead of
   inlining content; example: spawn with a one-line pointer to the file,
   the child reads it itself), `run_readonly_command` (one command per
   call; avoid `&&` chains of many commands), and `sequentialthinking`
   (keep each thought concise; the engine persists history server-side,
   so no need to restate prior thoughts).
2. **Ungate strike-1 steering** (`error-chunk.ts`): steer for EVERY
   native-incomplete chunk — `steering = getSteeringMessage(toolName, 1)`
   whenever `errorClass === 'native-incomplete'` and `toolName !==
   undefined`; delete the `STEER_SPLIT_TOOLS` Set. `getSteeringMessage`
   already returns the tailored hint for mapped tools and a non-empty
   generic hint for unmapped ones — the Set was a second, drifting copy
   of the same policy (exactly the class of duplication Law 13 forbids).
3. **Idempotence guard at BOTH wrap sites** (adversarial amendment A):
   in `response-handler.ts` AND in the `error-chunk.ts` wrap, before
   pushing a wrapped error, check that the message does not already
   start with `Error during tool call:` — if it does, push it as-is
   (still tagged `TOOL_CALL_ERROR`, still marked) instead of wrapping
   again. Guarding both sites makes the fix robust to either wrap-chain
   attribution (the observed single-prefix/double-suffix shape cannot
   be produced by either site alone; the exact chain is runtime-flow
   dependent — see Evidence note) and the doubled suffix disappears
   from every chain. What the guard does NOT do: restore
   `errorClass`/`toolName` on field-less re-emitted chunks — that
   residual is documented above and in Missed Question 9.

### Steps

1. RED-first: new suite
   `packages/agent-runtime/src/tools/stream-parser/__tests__/error-chunk-steering.test.ts`
   pinning — (a) each new map entry returns non-empty hint/explicit/example
   at strikes 1/2/3; (b) `getSteeringMessage('run_readonly_command', 1)` ≠ ''
   (pre-fix: the generic fallback returns non-empty, so this pin holds —
   the RED leg is (c) and (e)); (c) `handleStreamErrorChunk` appends
   steering for an UNMAPPED native-incomplete tool (pre-fix: steering === ''
   → pin fails — this is the ungating proof); (d) the mapped-tool hint is
   appended at strike 1 (read_files); (e) `createResponseHandler` does not
   double-wrap an already-wrapped error message (pre-fix: suffix ×2 → pin
   fails); (f) an unwrapped error still gets exactly one wrap.
2. GREEN: the three changes above; suite green; existing
   `loop-agent-steps-part-f*.test.ts` strike-cap pins unchanged (cap
   behavior untouched).
3. Doc check: `docs/echo-protocol.md` / `docs/agents-and-tools.md` —
   only if they enumerate the steering tool set (verify at GREEN; none
   known to).
4. Close per ceremony once implemented: receipt
   (`bun run fid:verify --write`), status, archive move, CHANGELOG,
   path-scoped commit (G1–G4, G8).

### Verification

RED leg (pins (c) and (e) fail pre-fix), then: typecheck agent-runtime,
   the new suite green, the existing strike-cap suites green (no cap
   drift), eslint/prettier on touched files. Live boundary (honest): the
   next natural truncation burst in a real session shows single wrapper
   text + steering on strike 1 — operator-observable, never claimable
   from unit runs alone.

## Verification Gates

> Planning record — gates declared now; stamped at implementation time
> (mandatory once status flips to `fixed`/`verified`).

- gate: typecheck packages/agent-runtime
- gate: test packages/agent-runtime/src/tools/stream-parser/__tests__/error-chunk-steering.test.ts
- gate: test packages/agent-runtime/src/__tests__/loop-agent-steps-part-f-strikes.test.ts

## Perfection Loop

### Loop 1 — RED / GREEN (2026-09-09, this session)

- **RED:** Nine+ incidents cataloged from the live session (Thinker death
  on `run_readonly_command` at `loop-iteration.ts:259`; parent bursts on
  read_files ×5, run_readonly_command, spawn_agents ×2, write_file).
  0-EOF reads of the full recovery chain: `constants.ts` (map + ladder),
  `native-strikes.ts` (strike-2+ escalation — the part that worked),
  `error-chunk.ts` (strike-1 gate), `response-handler.ts` (unconditional
  re-wrap), `stream-parser.ts` (both consumption paths),
  `sdk/src/impl/llm/errors.ts` (first-wrap origin), plus the strikes
  characterization suite. Root causes named per defect: map coverage,
  Set-gated strike-1 steering, unguarded re-wrap.
- **GREEN (design, converged):** three surgical changes — 3 new map
  entries, ungated strike-1 steering (delete the duplicate-policy Set —
  Law 13), idempotence guard on the relay wrap. RED-first pin suite with
  the ungating proof (pin c) and the double-wrap proof (pin e) as the
  failing legs. Thinker delegation deliberately not attempted for this
  FID: the truncation class killed two Thinker spawns in the FID-006 loop
  earlier tonight (documented there); the design is resolved from
  complete 0-EOF evidence instead — the exact recovery path the
  `recovery-steers-not-just-retries` lesson prescribes.
- **AUDIT (Verifier, 2026-09-09):** 0 FAIL / NEEDS-REVIEW — design
  logic (three changes map 1:1 to three observed defects; Set deletion
  is correct Law-13 deduplication conditional on the fallback fact),
  template compliance, next-number allocation, and gates all PASS;
  the six file:line citations and the fallback fact route to the
  Adversary (compacted reads); the doubled-suffix Evidence quote and
  the guard design gap flagged for resolution.
- **ADVERSARIAL (2026-09-09):** verdict — SHIPPABLE after amendments;
  all six citations disk-resolved and CONFIRMED with quoted code
  (constants.ts:14-68 map = exactly 5 tools; getSteeringMessage
  fallback non-empty at every tier — pin (b) holds pre-fix, RED legs
  are (c)/(e) as stated; error-chunk.ts:13-25,:81-88 Set-gated ternary;
  response-handler.ts:23-31 unguarded wrap; native-strikes.ts:24-72
  loop-tracked-name escalation; errors.ts:88-102 template with article).
  Quote fidelity CONFIRMED — the suffix appears twice within one raw
  message (single prefix, double suffix, double-period seams); the
  article drop is real and consistent with re-emission. The guard-gap
  finding was CONFIRMED and STRENGTHENED: response-handler carries no
  steering logic at all, so even Set-member tools lost strike-1 hints
  on the relay path (read_files observed). Four amendments applied in
  the self-correct pass: (A) guard at both wrap sites; (B) honest
  Expected Behavior scoping with the relay-path residual; (C) Missed
  Question 9 records the errorClass/toolName restoration follow-up as
  explicitly out of scope; (D) the wrap-chain attribution in Evidence
  re-labeled as inferred (single-prefix/double-suffix shape is not
  producible by either site alone — the guarded surface covers every
  chain).
- **CHANGE DELTA:** n/a (initial record).

### Loop 2 — Implementation (2026-09-10, this session)

- **RED (suite-first proof):** pin suite authored before any production
  change; pre-fix run failed exactly legs (a)/(c)/(e) (map entries
  missing, Set-gated empty steering, suffix ×2) while (b)/(d)/(f)
  held — the RED evidence is recorded in the session transcript.
- **GREEN:** three changes landed (map +3; ungated strike-1 steering
  with Set deletion; shared idempotent wrap helper at both sites).
  Committed `7dac5c5b` (5 files, +208/−31).
- **AUDIT (Verifier, implementation):** PASS on substance — 2 minor
  FAILs (wrap template produced `object.. Please check` double period
  for messages already ending in a period; pin (e) occurrence-count
  too weak to distinguish pass-through from strip-and-rewrap) + 2
  NEEDS-REVIEW (suite re-execution; FID step bookkeeping — resolved:
  the Steps section numbers Step 1 = RED-first suite, Step 2 = the
  three GREEN changes, Step 3 = doc check, Step 4 = closure, so the
  status line was accurate).
- **SELF-CORRECT:** both FAILs fixed — trailing-period normalization in
  `wrapToolCallErrorMessage`; pin (e) strengthened with exact containment
  + new pin (g) (wrapped-with-steering pass-through — a strip-and-rewrap
  would drop the steering suffix). Re-verified: 15/15 across three
  suites (68 expect() calls), typecheck 0, eslint 0, prettier clean.
  The Verifier's suite re-execution NEEDS-REVIEW resolved by this
  fresh run with tool output.
- **Residual (documented, unchanged):** field-less re-emitted errors on
  the relay path still lack strike-1 steering (Expected Behavior scope;
  MQ-9 follow-up) — recovered by the strike-2+ ladder.

### Missed Questions

1. *Why did strike-2+ steering work but strike-1 fail for read_files?*
   `native-strikes.ts` escalates via the loop-tracked `lastIncompleteToolName`
   (populated from the chunk's fields at consumption time), while
   `error-chunk.ts` strike-1 steering was only reached on the direct path —
   the re-emitted relay path lost the fields. Both fixes (ungate + guard)
   close the gap from either side.
2. *Does ungate risk steering on non-truncation errors?* No — steering is
   still gated on `errorClass === 'native-incomplete'`; only the Set
   membership gate is removed. Parse errors and unrelated validation
   errors keep today's exact behavior.
3. *Is the generic fallback good enough for truly unknown tools?* Yes —
   it already escalates hint/explicit/example at strikes 1/2/3; the Set's
   removal means unmapped-but-real tools (like this session's) now get it
   at strike 1 instead of empty steering.
4. *Why fix the map instead of only raising the strike cap?* The cap
   raise is the exact anti-pattern the 0816-012 lesson names: re-rolling
   the same oversized payload more times. Steering that changes the
   strategy on strike 1 is the fix; the cap stays at 3/5.
5. *Could the guard hide a genuine first-wrap?* No — the guard only
   short-circuits messages already carrying the wrapper prefix; a raw
   message (never wrapped) can't start with it. Semantics for unwrapped
   errors are unchanged (pin f).
6. *What about the SDK's own retry message losing the article "a" in the
   observed text?* That loss is a symptom of the relay re-emission (the
   message text was re-typed by the model, not re-templated) — the guard
   removes the re-emission path for wrapped messages; the SDK template
   itself is correct.
7. *Why severity medium, not high?* A working workaround exists (retry
   with a smaller payload — proven twice this session), but the failure
   wastes credits and kills subagent runs; the loop's own recovery
   guidance is degraded on the first strike — medium per the rubric.
8. *Should `spawn_agents` steering say prompts inherit context?* It
   should and does (per the harness: spawned agents see the conversation
   history) — the hint tells the model to send deltas, not restatement,
   which is the actual payload-shrinking move.
9. *Why not fully fix the relay path (restore `errorClass`/`toolName` on
   the re-emitted error event so the relay can steer at strike 1)?*
   Deliberately out of scope (adversarial amendment C): it requires
   changing the relayed PrintModeEvent shape or matching on message
   content — a schema-level change crossing the stream-parser/
   response-handler boundary, disproportionate to this FID's three
   surgical defects. The strike-2+ ladder already recovers relay-path
   failures from the loop-tracked name (the proven write_file path);
   the residual is documented in Expected Behavior, and the follow-up
   is recorded here rather than silently dropped.

### Implementation Evidence (REQUIRED for `closed`)

> Implementation landed 2026-09-10 (operator approval, batch order
> 008 → 007 → 006). Audit loop complete; evidence below.

- [x] **Commit SHA:** `7dac5c5b` (implementation, 5 files,
      +208/−31); audit amendments committed at `6ce730e8`
      (double-period template fix + pin (e)/(g) strengthening, 3 files)
- [x] **File:line ranges:** `constants.ts` steering map +3 entries
      (spawn_agents / run_readonly_command / sequentialthinking);
      `error-chunk.ts` — `TOOL_CALL_ERROR_MESSAGE_PREFIX` +
      `wrapToolCallErrorMessage` (startsWith guard, trailing-period
      normalization) + ungated steering; `response-handler.ts` — shared
      helper import; new pin suite
      `tools/stream-parser/__tests__/error-chunk-steering.test.ts`
- [x] **Gate output:** RED legs (a)/(c)/(e) failed pre-fix as designed;
      post-fix: typecheck exit 0, eslint `--max-warnings 0` clean,
      prettier clean, steering suite 7/7 (pins a–g), part-f + strikes
      suites 15/15 aggregate across three files, 68 expect() calls
- [x] **Reproducibility:** `cd packages/agent-runtime && bun test
      src/tools/stream-parser/__tests__/error-chunk-steering.test.ts
      src/__tests__/loop-agent-steps-part-f.test.ts
      src/__tests__/loop-agent-steps-part-f-strikes.test.ts`
- [x] **Step statuses:** Steps 1–2 implemented + verified 2026-09-10;
      Step 3 (docs check) verified — `docs/agents-and-tools.md` mentions
      `spawn_agents` only in the agent-roster/tool tables, does NOT
      enumerate the steering tool set; no doc drift. Step 4 closure in
      progress this session.

### Code Verification Evidence

> Same discipline — verified at implementation time. Current state: every
> referenced file was read 0-EOF this session; the Proposed Solution is a
> design, not an implementation claim.

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution (all three changes +
      pin suite + docs check — Step 3 verified no doc drift: the docs
      enumerate the agent roster, not the steering tool set)
- [x] Typecheck/tests/lint pass with pasted tool output (see Gate
      output above)
- [x] Production call-graph evidence: `NATIVE_TOOL_CALL_STEER_SPLIT_TOOLS`
      grep → zero hits repo-wide (Set fully deleted);
      `wrapToolCallErrorMessage` → 1 definition + exactly 2 call sites
      (`error-chunk.ts` handleStreamErrorChunk + `response-handler.ts`
      relay); `Error during tool call` template → zero sites outside the
      shared helper + tests (no third wrap site)
- [x] FID status reflects the actual implementation state (`analyzed` =
      planning converged, no code)

## Resolution

**Closed:** 2026-09-10 (session close ceremony).
**Fix:** three surgical changes — steering-map entries for
`spawn_agents` / `run_readonly_command` / `sequentialthinking`; strike-1
steering ungated for every native-incomplete chunk (the duplicate-policy
`STEER_SPLIT_TOOLS` Set deleted — Law 13); one shared idempotent wrap
helper (`wrapToolCallErrorMessage`) at both emission sites with
trailing-period normalization.
**Tests added:** `error-chunk-steering.test.ts` — 7 pins (a)–(g): map
tiers, unmapped-tool fallback, ungated strike-1 steering, mapped hint,
wrap idempotence + pass-through fidelity (single + with-steering).
**Verification:** RED legs (a)/(c)/(e) failed pre-fix; post-fix 15/15
across three suites (steering + part-f + strikes), typecheck exit 0,
eslint 0, prettier clean; Law-4 greps: Set zero hits, helper 1 def +
2 call sites, no third wrap site.
**Commits:** `7dac5c5b` (implementation), `6ce730e8` (audit
amendments). **Archived:** dev/fids/archive/.
**Live boundary (honest):** single wrapper text + strike-1 steering on
the next natural truncation burst — operator-observable, not claimable
from unit runs.

## Lessons Learned

> Captured at closure. Preview: a recovery ladder is only as good as its
> first rung — the first retry is where the model decides between
> re-emitting the same oversized payload and splitting it, so strike-1
> steering must be universal (map + fallback), never gated behind a
> tool allowlist that drifts from the map. And: any relay that re-wraps
> error text will eventually double-wrap and strip classification —
> idempotence at the wrap boundary is not optional.