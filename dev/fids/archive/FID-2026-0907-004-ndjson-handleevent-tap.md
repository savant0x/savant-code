# FID: NDJSON handleEvent tap — progress frames from the headless event stream (BO Phase 1 FID 2)

**Filename:** `FID-2026-0907-004-ndjson-handleevent-tap.md`
**ID:** FID-2026-0907-004
**Severity:** medium
**Status:** closed
**Created:** 2026-09-07
**YAGNI-Compliance:** Verified
**Related:** `dev/build-orders/BO-2026-09-07-ndjson-phase-b-emitter.md`
(§Frozen Wire Contract + §Phased Build Order — Phase 1 FID 2);
FID-2026-0907-003 (frame module — this FID wires its emitter into the live
event seam); FID-2026-0907-005 (artifact + error frames + stdout purity —
the next FID); FID-2026-0806-011 (headless run mode)

---

## Summary

BO Phase B child-side emitter, FID 2 of 5: tap the existing `handleEvent`
seam in `cli/src/headless-run.ts` so that, **in JSON mode only**, each
qualifying agent event maps to a ratified NDJSON progress frame through the
FID-003 emitter. Tap, don't fork (BO rule): the existing error-event
stderr logging is preserved untouched; the tap is purely additive.
Non-JSON mode is byte-identical by construction — the tap is only created
when `jsonMode` is set. The five ratified kinds map per the BO's table;
the child stream has no native iteration-end or thinking-end events, so
`iteration_completed` and `thinking_completed` are synthesized (decisions
already documented in FID-003's mapping-honesty record).

## Environment

- **OS:** Windows 11 host (win32, Git Bash); Bun 1.3.14-pinned
- **Commit/State:** working tree carrying FID-003/-008/-009/-010
  (uncommitted); automation level 3
- **Evidence (all read 0-EOF this session):**
  - `cli/src/headless-run.ts` (258 lines) — the `handleEvent` seam at the
    `client.run` call; today it logs error events to stderr and ignores
    everything else
  - `common/src/types/print-mode.ts` (224 lines) — the real child event
    union (`PrintModeEvent`): 17 event types; no native iteration-end or
    thinking-end event exists
  - `cli/src/cli-command-dispatch.ts` (153 lines) — the `--print` /
    piped-stdin / CI branch that calls `runHeadlessPrint`; the `json` flag
    is parsed (FID-003) but not yet threaded here
  - `cli/src/headless-ndjson.ts` (291 lines, FID-003) — the emitter whose
    `toolCallStarted` / `toolCallCompleted` / `iterationCompleted` /
    `thinkingStarted` / `addReasoningDelta` / `thinkingCompleted` methods
    this FID drives
  - `cli/src/cli-args.ts` — `--json` declared + threaded into the parsed
    args (lines 29, 166, 260; FID-003)
  - `cli/src/__tests__/headless-run.test.ts` — the DI pattern (injectable
    `getClient` + fake client) this FID's wiring tests extend
  - BO read 0-EOF (§Frozen Wire Contract, §Phased Build Order Phase 1
    FID 2: "Forward per-event frames from the existing seam in JSON mode
    only; map the ratified minimum five kinds")
  - Archive scanned: no `-004` collision on 2026-09-07; the number is
    reserved for this exact FID by the BO's phased build order

## Detailed Description

### Problem

The FID-003 frame module exists but has zero production consumers — the
delegating parent still receives no progress frames, so every delegation
runs v1 one-shot (fire-and-forget).

### Expected Behavior (BO acceptance gate)

- JSON mode: at least one progress frame per qualifying event, on stdout,
  through the FID-003 emitter (strict envelope, one line per frame).
- Non-JSON mode: zero frames; stdout and behavior byte-identical to
  pre-change (the tap is not created).
- Existing error-event stderr logging is preserved in both modes.

### Root Cause

Phase B child-side emitter absent (BO Staged Data: "ABSENT — verified
2026-09-07 on main, all branches"); FID-003 built the module, this FID
wires it.

## Impact Assessment

### Affected Components

- `cli/src/headless-ndjson-tap.ts` (new — pure event-to-emitter mapping)
- `cli/src/headless-run.ts` (+~17 — `jsonMode` / `jsonFrameWriter`
  params, emitter+tap creation, additive handleEvent wiring)
- `cli/src/cli-command-dispatch.ts` (+~3 — destructure `json`, thread
  `jsonMode` into `runHeadlessPrint`)
- `cli/src/__tests__/headless-ndjson-tap.test.ts` (new — mapping pins +
  wiring pins)

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium: additive tap behind a new param; non-JSON path untouched
      by construction; stdout purity and artifact/error frames stay in
      FID-005's scope
- [ ] Low

## Proposed Solution

### Approach

One pure module plus minimal wiring, per the BO's tap-don't-fork rule:

1. `createHeadlessEventTap(emitter)` returns an event handler; the tap
   owns only the thinking-span bookkeeping the child stream lacks.
2. `runHeadlessPrint` gains `jsonMode?: boolean` and `jsonFrameWriter?:
   FrameWriter` (DI per docs/testing.md — the established headless
   pattern: `getClient`, `resolvedAgent`, `agentDefinitions`,
   `previousRun` are all injectable); the tap is created only when
   `jsonMode` is true and composed additively into `handleEvent`.
3. The dispatch threads the parsed `--json` flag (FID-003) into
   `runHeadlessPrint` on the `--print` / piped-stdin / CI branch.

### Mapping (ground-truthed against print-mode.ts; BO table verbatim)

| `PrintModeEvent` | tap action | emitted kind(s) |
|---|---|---|
| `tool_call` | `toolCallStarted(toolCallId, toolName)` | `tool_call_started` |
| `tool_result` | `toolCallCompleted(...)` then `iterationCompleted()` | `tool_call_completed` plus `iteration_completed` |
| `activity` with `kind: 'thinking'` (first) | `thinkingStarted()` | `thinking_started` |
| `reasoning_delta` | `addReasoningDelta(text)` (implicit start if no activity preceded) | none (accumulates) |
| first non-thinking, non-reasoning event while a span is open | `thinkingCompleted()` | `thinking_completed` (concatenated reasoning) |
| all other event types (start, text, finish, subagent variants, download, compliance_warning, provenance_receipt, approval_request, fid_queue_update, compaction variants, error) | no frame (error frames are FID-005's scope; existing stderr logging preserved) | none |

Synthesized fields (FID-003's documented mapping honesty): no native
iteration-end event exists, so `iteration_completed` fires after each
`tool_result` pair (the iteration whose tool call completed;
`tokens_used: 0` — no token counts on this stream); no native
thinking-end event exists, so `thinking_completed` flushes on the first
non-thinking/non-reasoning event; a repeated `activity` thinking event
while a span is open does not re-fire `thinking_started`.

### Steps

1. [x] **RED:** `headless-ndjson-tap.test.ts` — pure mapping pins
       (tool_call to started; tool_result to completed plus iteration;
       thinking start/accumulate/flush ordering — flush lands BEFORE the
       next event's frame; repeated-activity guard; implicit start on a
       leading reasoning_delta; non-qualifying events emit nothing) plus
       wiring pins via the `runHeadlessPrint` DI (fake client invokes
       `handleEvent` with synthetic events; injected writer captures
       lines; `jsonMode` unset means the writer is never called and the
       result shape is unchanged).
2. [x] **GREEN:** tap module plus `headless-run.ts` wiring plus dispatch
       threading.
3. [x] **VERIFY:** typecheck cli; the new suite plus the FID-003 suite
       plus the headless-run suite green; eslint plus prettier on touched
       files; `fid:verify --write`; `validate:repository`; Law 4 grep
       (dispatch to `runHeadlessPrint({jsonMode})` to tap to emitter).

## Verification Gates

- gate: typecheck cli
- gate: test cli/src/__tests__/headless-ndjson-tap.test.ts
- gate: test cli/src/__tests__/headless-ndjson.test.ts
- gate: test cli/src/__tests__/headless-run.test.ts

### Verification Receipt

- fingerprint: sha256:3362f27b0476be83b08d3b73c137651759e5221cbf31edabd23cd126627dc8b6
- verified: 2026-09-08T18:18:59.364Z
- typecheck cli: exit 0
- test cli/src/__tests__/headless-ndjson-tap.test.ts: exit 0
- test cli/src/__tests__/headless-ndjson.test.ts: exit 0
- test cli/src/__tests__/headless-run.test.ts: exit 0

## Perfection Loop

### Loop 1 — RED (2026-09-07)

- Nothing consumes the FID-003 emitter; the event vocabulary was read
  0-EOF and the five-kind mapping table above was checked against the
  real `PrintModeEvent` union field by field (two synthesized kinds, one
  accumulating kind, two direct kinds — matching FID-003's counter
  design).
- **ADVERSARIAL pre-check:** "Why not map `text` events to progress
  frames too?" → The ratified minimum five is the contract (BO rule 2);
  unmapped kinds are the parent's forward-compat territory, not the
  child's obligation. "Why `iterationCompleted()` after each tool_result
  rather than once at finish?" → a per-iteration heartbeat is the closest
  truthful signal to the BO's iteration-end row — the child stream has no
  native boundary event (documented in FID-003). "Why thread
  `jsonFrameWriter` instead of capturing stdout?" → DI over module
  mocking is the repo's established testing convention; the default writer
  binds `process.stdout.write` directly.
- **CHANGE DELTA:** initial authoring.

### Missed Questions

1. *Does the tap own stdout purity?* → No — FID-005 (exactly one artifact
   frame; the dispatch suppresses the raw stdout write in JSON mode). This
   FID wires progress frames only; the raw answer write is unchanged
   here.
2. *Why a separate tap module rather than inline in headless-run.ts?* →
   headless-run.ts is 258 lines against the 300 ceiling; a pure module
   keeps the seam surgical and independently testable (Law 13).
3. *Subagent events?* → Not in the ratified five; skipped in Phase B (the
   parent tolerates unknown kinds by contract, but the child emits only
   ratified shapes).
4. *The `--auto` headless mode?* → Out of scope; the delegation parent
   uses the `--print`/stdin path (the branch that calls
   `runHeadlessPrint`).
5. *Can a hostile event crash the tap?* → The tap reads only union
   fields; `JSON.stringify` in the emitter escapes payloads; a throwing
   tap would propagate into `handleEvent` — the same failure surface the
   existing error-logging path already has (acceptable per the BO's
   non-fatal-diagnostics rule; error frames are FID-005's).

## Implementation Verification

> Recorded at implementation — RED evidence first, then gate outputs.

**RED (before GREEN, pasted):**

```text
bun test src/__tests__/headless-ndjson-tap.test.ts
 0 pass / 1 fail / 1 error — Cannot find module '../headless-ndjson-tap'
(after the tap module landed, before the run wiring: 8 pass / 1 fail —
 the jsonMode wiring pin; typecheck errors named the missing params)
```

**Mid-flight pin correction, honestly recorded:** the RED suite's
implicit-start pin initially expected only two frames
(`thinking_started`, `thinking_completed`) but the following `tool_call`
also emits its own `tool_call_started` — the module was right, the pin
was wrong; fixed the test, not the code.

**GREEN + gates (pasted):**

```text
bun test tap + ndjson + headless-run suites    → 40 pass / 0 fail
bun run typecheck (cli)                         → exit 0
eslint 4 touched files --max-warnings 0         → exit 0 (after --fix:
                                                  3 import-order warnings)
prettier --check 4 touched files                → clean (after --write)
quality:report                                  → PASS (1 honest baseline
                                                  bump: headless-run.ts
                                                  259 → 284, still < 300)
```

### Code Verification Evidence

- [x] All declared gates pass with pasted tool output (receipt below)
- [x] Production call-graph (Law 4, grepped this session):
      `cli-command-dispatch.ts:143` passes `jsonMode: json === true` into
      `runHeadlessPrint`; `headless-run.ts:219` creates the tap only when
      `jsonMode` is set; `headless-run.ts:252` invokes `jsonTap?.(event)`
      inside `handleEvent`; `createHeadlessEventTap` defined at
      `headless-ndjson-tap.ts:43` — entry point → run → tap → emitter,
      every link grepped
- [x] FID status reflects the actual implementation state (`closed`)

## Resolution

- **Fixed Date:** 2026-09-07
- **Fix Description:** new pure module `cli/src/headless-ndjson-tap.ts`
  (97 lines) mapping the five ratified progress kinds from the headless
  `PrintModeEvent` stream (with thinking-span bookkeeping: implicit start
  on a leading `reasoning_delta`, no re-fire on repeated thinking
  activity, flush-before-next-event ordering); `runHeadlessPrint` gained
  `jsonMode` / `jsonFrameWriter` params and creates the tap only in JSON
  mode, composing it additively into `handleEvent` (error-event stderr
  logging preserved); `cli-command-dispatch.ts` threads the argv-exact
  `--json` flag (FID-003) into the run on the `--print`/stdin/CI branch.
- **Tests Added:** `cli/src/__tests__/headless-ndjson-tap.test.ts`
  (9 tests): six pure mapping pins (tool_call started; tool_result
  completed+iteration; thinking start/accumulate/flush ordering;
  repeated-activity guard; implicit start; non-qualifying events emit
  nothing) plus three wiring pins (jsonMode forwards events to the
  injected writer; jsonMode unset never writes and the result shape is
  unchanged; error-event stderr logging preserved in JSON mode).
- **Verification Evidence:** RED → GREEN pasted above; all four declared
  gates green; quality baseline bump recorded (headless-run.ts 284).
- **Archived:** 2026-09-08 (operator closure directive; see
  FID-2026-0907-003's closure record — the "after FID-007's cross-repo
  smoke" sequencing pointed at a FID never authored). This FID's own
  Phase-1 scope is implemented with its receipt green (4/4 PASS).
  Receipt re-stamped at the archived path with gates re-run live.