# FID: DSML special-token stream recovery + orphan tool-call delta survival

**Filename:** `FID-2026-1009-006-dsml-stream-parser.md`
**ID:** FID-2026-1009-006
**Severity:** high
**Status:** verified
> Implementation exists in the working tree (uncommitted) and every declared
> gate passes; closure is blocked pending an operator ruling — G2: the
> single-agent closure ceremony requires a committed hash and the agent
> never executes git. Specific blocker: operator commit authorization for
> this work. The item stays active.
**Created:** 2026-10-09 19:40
**Automation level:** 3
**YAGNI-Compliance:** Pending

---

## Summary

DeepSeek-family models emit special tokens delimited by `｜` (U+FF5C,
FULLWIDTH VERTICAL LINE). When the provider's native tool-call templating
malforms, those tokens arrive on the plain text/reasoning channels: the raw
template markup (`<｜DSML｜ calls>`) leaks to the user as assistant text
while the real invocation data is discarded. A second, independent defect
in the same family: an OpenAI-compatible tool-call delta without a
`function.name` threw `InvalidResponseDataError`, killing the whole
session. Both defects were observed live (operator session crash +
scratchpad transcripts at `dev/scratchpad/active/pass-through.md` and
`dev/scratchpad/archive/2026-10-07-conversation-issues-found.md`), and a
fix for both was written in a session that crashed before it could land —
leaving the work uncommitted, unregistered, and carrying a stale
`FID-2026-1009-001` citation (that record covers the credentials
false-positive, not this work). This FID is the corrective record: it
registers the work, re-verifies it against the current tree, and carries
it to closure.

## Environment

- **OS:** Windows (win32), Git Bash / MSYS
- **Language/Runtime:** TypeScript strict, Bun 1.3.14
- **Commit/State:** `main` @ `a6f04079`; the DSML work is uncommitted in the
  working tree (2 modified tracked files + 2 untracked new files)
- **Tool Versions:** `@ai-sdk/provider` (the throwing import, now removed
  from the transform handler)

## Detailed Description

### Problem

Two defects on the DeepSeek-family streaming path:

1. **Template-band leak.** When native tool-call templating malforms, the
   model emits the invocation inside the template band
   (`<｜tool_calls_begin｜><｜tool_call_begin｜>name<｜tool_sep｜>{args}<｜tool_call_end｜><｜tool_calls_end｜>`)
   on the text or reasoning channel. The runtime's canonical XML parser
   does not recognize the `｜`-delimited form, so the markup reaches the
   user verbatim and the invocation is lost.
2. **Orphan delta kills the session.** `transformChunk`
   (`packages/llm-providers/src/openai-compatible/chat/stream-transform/transform-handler.ts`)
   threw `InvalidResponseDataError` on a tool-call delta whose
   `function.name` was null. Providers emit such orphan deltas at stream
   end or after malformed native templating; the throw propagated and
   killed the session.

### Expected Behavior

Template-band tool calls are recovered and executed (same contract as the
canonical XML parser: the runtime executes only recovered calls); stray
template markers are stripped so raw markup never reaches the UI; tokens
split across chunk boundaries never leak partial markup; malformed
payloads are dropped, never thrown; and an orphan tool-call delta is
skipped so the stream — and the session — survive.

### Root Cause

The stream pipeline understood exactly one tool-call dialect (canonical
XML `<tool_call>`). DeepSeek's native templating is a second dialect that
arrives on the same channels, and the OpenAI-compatible transform treated
a shape variation (missing name) as a protocol violation rather than a
skippable orphan.

### Evidence

**Observed leak (scratchpad transcripts, operator sessions):** 20+
occurrences of the literal string `<｜DSML｜ calls>` in
`dev/scratchpad/active/pass-through.md` and
`dev/scratchpad/archive/2026-10-07-conversation-issues-found.md` — raw
template text rendered as assistant output.

**The fix (working tree, verified this session):**

- `packages/agent-runtime/src/util/dsml-stream-parser.ts` (new, 255
  lines): stateful chunk parser — complete tool-call blocks recovered
  into `{toolName, input}`; stray markers stripped; partial-token
  suffixes held in the buffer (fail-closed, no partial leak); truncated
  JSON args repaired (dangling brace / dangling quote); never throws.
- `packages/agent-runtime/src/tool-stream-parser.ts` (modified): the
  parser runs on BOTH the reasoning channel (before the legacy filter)
  and the text channel (after the canonical XML parser); recovered calls
  execute through the existing `executeXmlToolCall` with `dsml-` prefixed
  ids.
- `packages/llm-providers/.../transform-handler.ts` (modified): the
  orphan-delta throw replaced by `continue` (skip the orphan — it carries
  no executable data).
- `packages/agent-runtime/src/util/__tests__/dsml-stream-parser.test.ts`
  (new): 15 tests.

**Verification (this session, tool output):**

```text
bun run --cwd=packages/agent-runtime typecheck   -> exit 0
bun run --cwd=packages/llm-providers typecheck   -> exit 0
bun test src/util/__tests__/dsml-stream-parser.test.ts -> 15 pass / 0 fail
bun test src/ (agent-runtime full battery)       -> 1971 pass / 0 fail
bun x eslint . --max-warnings 0                  -> exit 0
```

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/util/dsml-stream-parser.ts` (new)
- `packages/agent-runtime/src/tool-stream-parser.ts` (stream integration)
- `packages/llm-providers/src/openai-compatible/chat/stream-transform/transform-handler.ts` (orphan-delta survival)
- `packages/agent-runtime/src/util/__tests__/dsml-stream-parser.test.ts` (new)

### Risk Level

- [ ] Critical
- [x] High: user-visible raw markup leak + a session-killing throw on a
      live provider family; both fixed and verified, but the fix is
      uncommitted, so the shipped build still carries the defects
- [ ] Medium
- [ ] Low

## Proposed Solution

### Approach

The work is already written and verified; this FID's job is the corrective
record. Remaining steps: correct the stale `FID-2026-1009-001` citations
in the two modified files to this FID's ID, register the work in
`SCOPE.md`, and carry it to closure on the operator's commit.

### Steps

1. DSML parser module + state machine — **implemented** (working tree)
2. Reasoning-channel + text-channel integration in
   `tool-stream-parser.ts` — **implemented** (working tree)
3. Orphan-delta survival in `transform-handler.ts` — **implemented**
   (working tree)
4. Pin suite (15 tests) — **implemented** (working tree)
5. Citation correction (`FID-2026-1009-001` → `FID-2026-1009-006`) —
   **implemented** this session
6. SCOPE.md registration — **implemented** this session (T180)
7. Commit + closure — **blocked pending operator ruling** (G2: operator
   commit authorization; the agent never executes git)

### Verification

Typecheck both touched workspaces; run the DSML pin suite and the full
agent-runtime battery; eslint repo-wide; prettier on the touched files.
All gates are declared below and were run live this session.

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: typecheck packages/llm-providers
- gate: test packages/agent-runtime/src/util/__tests__/dsml-stream-parser.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:97972d0031018c837152c0ec44b644263ad583ef2604528afd433821fa1884f9
- verified: 2026-10-09T23:41:10.714Z
- typecheck packages/agent-runtime: exit 0
- typecheck packages/llm-providers: exit 0
- test packages/agent-runtime/src/util/__tests__/dsml-stream-parser.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED (discovery + registration, 2026-10-09)

- **RED:** (a) uncommitted, unregistered work in the working tree with no
  governing FID — 2 modified tracked files + 2 untracked new files; (b)
  the code's own header cites `FID-2026-1009-001`, which covers the
  credentials false-positive (verified by reading the archived record) —
  a stale citation; (c) the defects it fixes are real and observed
  (scratchpad transcripts); (d) no verification had been run against the
  current tree this session.
- **GREEN:** verify the work (typecheck ×2, DSML suite, full
  agent-runtime battery, eslint), author this FID as the corrective
  record, register the work in SCOPE.md, correct the citations.
- **AUDIT:** live evidence above — agent-runtime typecheck exit 0;
  llm-providers typecheck exit 0; DSML suite 15/15; agent-runtime full
  battery 1971/1971 across 305 files; eslint 0/0 repo-wide. Call-graph:
  `parseDsmlChunk`/`createDsmlParserState` imported by
  `tool-stream-parser.ts` (grep-verified production consumer);
  `processStreamWithTools` is the stream entry the agent runtime calls
  for every provider turn.
- **ADVERSARIAL:** challenge — (1) does the parser leak partial tokens
  across chunk boundaries? The pin suite covers split tokens; the
  fail-closed buffer holds any proper-prefix suffix; (2) can a malformed
  payload throw? `parseInput` catches and repairs, returning null on
  failure; the parser never throws; (3) does the orphan-skip swallow
  real tool calls? The skipped delta has no `function.name` — no
  executable data — and the canonical path still processes named deltas;
  (4) is the citation correction complete? Both modified files carry the
  stale id; both are corrected in step 5. Verdict: no blocking findings.
- **CHANGE DELTA:** this session — new FID (this file), SCOPE.md T180
  registration, citation corrections in the two modified files; the
  parser/integration/test files were already in the working tree.

### Missed Questions

1. **Why was this work never committed?** The authoring session crashed
   (operator: "my last session crashed and im unable to restore it") —
   the G2 commit never happened. This FID is the recovery path.
2. **Why the stale citation?** The authoring session cited
   `FID-2026-1009-001`; that record covers a different defect. Corrected
   here to `FID-2026-1009-006`.
3. **Does the DSML dialect need the same treatment on other channels?**
   The parser runs on both the reasoning and text channels — the two
   channels the scratchpad transcripts show the leak on. No other
   channel carries model text.

### Implementation Evidence (REQUIRED for `closed`)

- [ ] **Commit SHA:** pending — blocked on G2 (operator commit
      authorization; the agent never executes git)
- [x] **File:line ranges:** `packages/agent-runtime/src/util/dsml-stream-parser.ts`
      (new, 255 lines); `packages/agent-runtime/src/tool-stream-parser.ts:109-110,183-199,213-232,244-255`
      (integration); `packages/llm-providers/src/openai-compatible/chat/stream-transform/transform-handler.ts:139-152`
      (orphan skip); `packages/agent-runtime/src/util/__tests__/dsml-stream-parser.test.ts`
      (new, 15 tests)
- [x] **Gate output:** pasted in Loop 1 AUDIT — typecheck ×2 exit 0;
      DSML 15/15; agent-runtime 1971/1971; eslint 0/0
- [x] **Reproducibility:** `bun test src/util/__tests__/dsml-stream-parser.test.ts`
      from `packages/agent-runtime` re-runs the pin suite
- [x] **Step statuses:** 1-6 `implemented`; 7 `blocked` — G2 commit
      authorization (specific blocker named)

### Code Verification Evidence

- [x] Files referenced in Affected Components exist (verified 2026-10-09:
      all four paths read or grepped this session)
- [x] Implementation matches the Proposed Solution: verified 2026-10-09
- [x] Typecheck/tests/lint pass with pasted tool output: verified
      2026-10-09 (Loop 1 AUDIT)
- [x] Production call-graph evidence for new wiring: verified 2026-10-09 —
      `parseDsmlChunk`/`createDsmlParserState` imported by
      `tool-stream-parser.ts`; `processStreamWithTools` is the runtime's
      stream entry
- [ ] FID status reflects the actual implementation state: pending — the
      status flips at closure, blocked on the G2 commit

### Loop 2 — Independent audit and self-correction

- **RED:** pending
- **GREEN:** pending
- **AUDIT:** pending
- **ADVERSARIAL:** pending
- **CHANGE DELTA:** pending

### Loop 3 — Final convergence

- **RED:** pending
- **GREEN:** pending
- **AUDIT:** pending
- **ADVERSARIAL:** pending
- **CHANGE DELTA:** pending

## Resolution

- **Closed Date:** pending — blocked pending an operator ruling (G2:
  closure requires a committed hash; the work is uncommitted). Specific
  blocker: operator commit authorization. The item stays active and
  completes the moment the commit lands.
- **Fix Description:** pending (fires at closure)
- **Tests Added:** pending at closure —
  `packages/agent-runtime/src/util/__tests__/dsml-stream-parser.test.ts`
  (15 tests, green on the current tree)
- **Verification Evidence:** pending (fires at closure)
- **Archived:** pending (fires at closure)

## Lessons Learned

Placeholder — completed at closure.
