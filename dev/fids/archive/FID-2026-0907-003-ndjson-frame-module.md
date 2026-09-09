# FID: NDJSON delegation frame module + JSON-mode activation (BO Phase 1 FID 1)

**Filename:** `FID-2026-0907-003-ndjson-frame-module.md`
**ID:** FID-2026-0907-003
**Severity:** medium
**Status:** closed
**Created:** 2026-09-07
**YAGNI-Compliance:** Verified
**Related:** `dev/build-orders/BO-2026-09-07-ndjson-phase-b-emitter.md`
(§Frozen Wire Contract — FROZEN, embedded verbatim from the Savant repo's
ratified Phase B handoff); FID-2026-0731-067 (v2 delegation transport,
parent side shipped); FID-2026-0806-011 (headless run mode)

---

## Summary

Phase B child-side emitter, FID 1 of 5: the frame module that speaks the
parent's FROZEN NDJSON wire contract (strict envelope `{v, type, ts, data}`,
`v = 1`, one JSON object per line) plus argv-exact `--json` activation in the
headless entry. Pure module, no wiring — the `handleEvent` tap (FID-004) and
artifact/error emission (FID-005) build on it. The parent (Savant
DelegationEngine, Phase A) is live and waiting.

## Environment

- **OS:** Windows 11 host (win32, Git Bash); Bun 1.3.14-pinned
- **Commit/State:** working tree carrying FID-2026-0906-008 removal sweep +
  FID-2026-0907-001/-002 changes (uncommitted); automation level 3
- **Evidence:** BO read 0-EOF this session; `cli/src/headless-run.ts` (258
  lines) and `cli/src/cli-command-dispatch.ts` (153 lines) read 0-EOF;
  `common/src/types/print-mode.ts` (224 lines) read 0-EOF — the real child
  event vocabulary

## Detailed Description

### Problem

Delegations from the Savant parent run v1 one-shot: fire-and-forget, no
progress, no questions, no steering. The child cannot speak the ratified v2
wire protocol — no frame module exists.

### Expected Behavior

A pure frame module honors the frozen contract exactly: envelope keys in
order `{v, type, ts, data}`, `v = 1`, real epoch-ms `ts`, `JSON.stringify`
per line (newlines/quotes inside payloads escaped so every frame is exactly
one line), and a control-frame parser for stdin (cancel/steer accepted,
unknown type / `v ≠ 1` / malformed JSON skipped). `--json` activates via a
declared Commander option — argv-exact by construction.

### Root Cause

Phase A shipped parent-side only; the child half was never built (BO Staged
Data: "ABSENT — verified 2026-09-07 on main, all branches").

### Evidence

- BO §Frozen Wire Contract (embedded verbatim, quoted in this session)
- `common/src/types/print-mode.ts:224` — the real child event union
  (`PrintModeEvent`): NO native iteration/tokens/success/duration fields
- `cli/src/headless-run.ts:215-222` — the `handleEvent` seam (event with
  `type: 'error'` handling today)

## Impact Assessment

### Affected Components

- `cli/src/headless-ndjson.ts` (new — frame module)
- `cli/src/cli-args.ts` (+3 lines — declared `--json` option + threading)
- `cli/src/__tests__/headless-ndjson.test.ts` (new)
- Automatic later: FID-004/-005/-006 wiring consumes this module

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium: additive module + one declared flag; zero behavior change
      without `--json` (nothing consumes the module yet)
- [ ] Low

## Proposed Solution

### Approach

One new module, contract-shaped from the BO verbatim. Mapping decisions
(ground-truthed against `print-mode.ts` this session):

- The child's `PrintModeEvent` stream has NO `iteration`/`tokens_used`/
  `success`/`duration_ms` — the frozen payload shapes are synthesized
  child-side: a child-maintained step counter (`iteration`), wall-clock
  durations, and "completed = a `tool_result` arrived" for `success`
  (failures surface as `error` events, which FID-005 maps to `error`
  frames). `tokens_used` is contract-shaped but the child runtime exposes
  no token counts on this stream — value is `0` in Phase B, documented as
  a known limitation (the field is advisory to the parent).
- `thinking_started`/`thinking_completed`: the stream has `activity`
  (`kind: 'thinking'`) starts and `reasoning_delta` texts, no explicit end
  — `thinking_completed` fires on the first non-thinking event after
  thinking began, with `reasoning` = concatenated deltas.

### Steps

1. [x] **RED:** `cli/src/__tests__/headless-ndjson.test.ts` — pins for
       envelope shape/key order, epoch-ms `ts`, newline/quote escaping,
       unknown-kind tolerance at emit time, control parsing (cancel /
       steer+note / unknown type / `v ≠ 1` / malformed JSON), stdin reader
       EOF behavior.
2. [x] **GREEN:** `cli/src/headless-ndjson.ts` — types, `serializeFrame`,
       `createNdjsonEmitter` (injectable writer, real epoch-ms, counters),
       `parseControlFrame`, `createControlFrameReader` (line-delimited,
       EOF → 'end', never throws).
3. [x] **Activation:** declared `--json` Commander option + threading in
       `cli/src/cli-args.ts` (the argv-exact mechanism — Commander matches
       the literal token; prompt text containing "json" does not match).
4. [x] **VERIFY:** typecheck cli exit 0; suite green; eslint clean;
       prettier clean.

### Verification

Unit gates below. The cross-repo live smoke is FID-007's acceptance.

## Verification Gates

- gate: typecheck cli
- gate: test cli/src/__tests__/headless-ndjson.test.ts

### Verification Receipt

- fingerprint: sha256:2afc05257d8a9bde2371b8ab0f0101bcd99faba48db12cb6f93d31c5ac5401d2
- verified: 2026-09-08T18:18:35.262Z
- typecheck cli: exit 0
- test cli/src/__tests__/headless-ndjson.test.ts: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** no frame module exists; the frozen contract demands strict
  envelope + one-line frames + tolerant control parsing; the child's event
  stream lacks four of the payload fields, so the mapping must synthesize.
- **GREEN:** the module above; `--json` as a declared option.
- **AUDIT (tool-evidenced):**
  - V1 PASS — envelope keys and `v = 1` quoted verbatim from the BO's
    §Frozen Wire Contract; `serializeFrame` emits exactly
    `{v, type, ts, data}`.
  - V2 PASS — `JSON.stringify` per line escapes embedded newlines/quotes
    (pinned by test: payload containing `\n` survives as one line).
  - V3 PASS — control parsing: `v ≠ 1` and unknown `type` and malformed
    JSON all → skip; `cancel` and `steer` (+ note) parsed; EOF → end,
    never blocks (each pinned).
  - V4 PASS — activation: Commander option parsing is token-exact; the
    `--json` flag cannot be triggered by prompt text (positional args are
    a separate Commander channel).
  - V5 PASS — mapping honesty: `tokens_used: 0` documented as a known
    limitation rather than fabricated; `success: true` semantics = "a
    tool_result arrived" (failures arrive as error events).
- **ADVERSARIAL:** "Why a declared option instead of scanning
  `process.argv.includes('--json')`?" → the declared option is equally
  token-exact, integrates with help/typing, and avoids double-parsing;
  both satisfy the frozen argv-exact rule. "Why `tokens_used: 0` instead
  of omitting the key?" → the contract's payload shapes are FROZEN —
  omitting a key risks parent-side strictness; an honest 0 with a
  documented limitation preserves the shape. "Emitting `iteration` from a
  child counter is invented semantics" → the child stream has no
  iteration concept; a deterministic documented counter is the best
  available truth, and the parent treats progress as advisory display
  data (exit code owns the verdict).
- **CHANGE DELTA:** initial authoring.

### Missed Questions

1. *Envelope key order?* → The contract shows `{v, type, ts, data}` in that
   order; `serializeFrame` constructs the object literal in exactly that
   order so `JSON.stringify` preserves it (JS stringifies insertion order).
2. *Who owns the stdout writer?* → The emitter takes an injectable writer
   (default `process.stdout.write`) — tests capture frames without
   touching real stdout (the docs/testing.md DI convention).
3. *Does `--json` affect the TUI?* → No. Only the headless dispatch
   consumes it (FID-004/-005); an interactive TTY run ignores the flag
   (the dispatch's headless branch is where it activates).
4. *`question` frames?* → Phase C (BO out-of-scope); the type exists in the
   module's union so the vocabulary is complete, but nothing emits it yet.
5. *Windows stdio?* → Plain `process.stdout.write`/`process.stdin` lines —
   no UDS/named pipes (BO: Windows-first, pipes only).

### Code Verification Evidence

- [x] BO + headless-run.ts + cli-command-dispatch.ts + print-mode.ts read
      0-EOF this session
- [x] Implementation matches the Proposed Solution
- [x] Typecheck/tests pass with pasted tool output (below)
- [x] Production call-graph: pure library by design — consumers are the
      FID-004/-005/-006 wiring (recorded there); this FID's regression
      suite exercises every export of the module
- [x] FID status reflects the actual implementation state (`closed`)

### Loop 2 — Independent audit and self-correction

- **RED:** tests written first; the module is the RED target (nothing
  existed to test).
- **GREEN:** as proposed; the `--json` threading addition is the only
  surface beyond the module.
- **AUDIT:** contract conformance re-read line-by-line against the BO's
  frozen section after implementation.
- **ADVERSARIAL:** "The parent might send frames with extra fields" → the
  parser ignores unknown fields by construction (it reads only `v` and
  `type` + `data.note` for steer) — the compat mechanism the contract
  names. "The emitter could interleave with other stdout writers in JSON
  mode" → FID-005 owns stdout purity (suppression at the dispatch); the
  emitter itself is the ONLY sanctioned writer in JSON mode.
- **CHANGE DELTA:** <2%.

### Loop 3 — Final convergence

- **RED:** none.
- **GREEN:** none.
- **AUDIT:** gates declared; receipt stamped at implementation.
- **ADVERSARIAL:** STANDS.
- **CHANGE DELTA:** <2% (converged — circuit breaker).

## Implementation Verification

> Recorded at implementation — RED evidence first, then gate outputs.

**RED (2026-09-07, before the module existed):**

```text
cd cli && bun test src/__tests__/headless-ndjson.test.ts
 0 pass / 1 fail / 1 error  — Cannot find module '../headless-ndjson'
```

**Fixture corrections after GREEN (module right, pins wrong — fixed the
tests, not the module):** (1) the thinking test indexed `lines[2]` but the
started/completed pair emits exactly two lines; (2) the EOF "partial"
fixture was truncated JSON (`{"v":1,"type":"steer"`), which the contract
says to SKIP — replaced with a valid newline-less frame.

**GREEN + gates (pasted):**

```text
bun test src/__tests__/headless-ndjson.test.ts src/__tests__/cli-args.test.ts
 39 pass / 0 fail, 71 expect() calls
(final suite after fixture fixes) 18 pass / 0 fail, 32 expect() calls
bun run typecheck (cli)                    → clean (no `error TS` lines)
bun x eslint 3 files --max-warnings 0      → exit 0
prettier --check 3 files                   → clean (after --write, 2 new)
bun run quality:report                     → PASS (1467 baselined files)
line counts: headless-ndjson.ts 294, headless-ndjson.test.ts 264 (≤ 300)
```

Ratchet note: `cli-args.ts` grew 269 → 278 (the +9 activation lines);
baseline bumped to the measured value per the FID-2026-0906-008/-002
convention.

## Resolution

- **Fixed Date:** 2026-09-07
- **Fix Description:** New pure frame module `cli/src/headless-ndjson.ts`
  (294 lines): `serializeFrame` (wire-order envelope, one line per frame),
  `createNdjsonEmitter` (injectable writer + epoch-ms clock, step counter,
  tool-duration map, thinking accumulation, unknown-kind no-op),
  `parseControlFrame` + `createControlFrameReader` (tolerant control
  channel: cancel/steer parsed, unknown/v≠1/malformed skipped, EOF →
  closed, never blocks). Activation: declared `--json` Commander option in
  `cli/src/cli-args.ts` (+9 lines) — argv-exact by construction.
- **Tests Added:** `cli/src/__tests__/headless-ndjson.test.ts` (264 lines,
  18 tests): envelope shape/key order, epoch-ms ts, newline/quote
  escaping, unknown-kind no-op, counter semantics (iteration/duration/
  success/tokens_used), thinking accumulation, control parsing, reader
  chunk buffering / partial lines / EOF trailing frame / EOF-no-frames
  never blocks.
- **Verification Evidence:** RED fail → GREEN pass pasted in Implementation
  Verification; all declared gates exit 0 (receipt below, machine-stamped).
- **Closed + Archived:** 2026-09-08 (operator closure directive). The
  recorded "archive after FID-007" sequencing pointed at a FID that was
  never authored — BO Phase 2/3 (FID-006 stdin reader, FID-007 handoff
  matrix) remain unbuilt and open fresh when the operator directs them.
  This FID's own Phase-1 scope is implemented with its receipt green
  (2/2 PASS), so it closes now under the 2026-09-06 ground-truth ruling.
  Receipt re-stamped at the archived path with gates re-run live.

## Lessons Learned

- Read the child's REAL event union before accepting a mapping table at
  face value: the frozen contract shapes payloads the child must
  synthesize, and every synthesized value is a documented decision.
- Frozen contracts belong IN the implementing repo (the BO embeds its
  contract verbatim) — the first version of this BO pointed at a document
  in another repo and was unimplementable until it was made
  self-contained.
