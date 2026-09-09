# FID: NDJSON artifact + error frames; stdout purity (BO Phase 1 FID 3)

**Filename:** `FID-2026-0907-005-ndjson-artifact-error-stdout-purity.md`
**ID:** FID-2026-0907-005
**Severity:** medium
**Status:** closed
**Created:** 2026-09-08
**YAGNI-Compliance:** Verified
**Related:** `dev/build-orders/BO-2026-09-07-ndjson-phase-b-emitter.md`
(§Frozen Wire Contract rules 3-5 + §Phased Build Order Phase 1 FID 3);
FID-2026-0907-003 (frame module — `emitArtifact`/`emitError` exist,
unwired); FID-2026-0907-004 (tap — deferred error-event frames to this
FID); FID-2026-0907-006 (stdin control reader — the next FID)

---

## Summary

BO Phase B child-side emitter, FID 3 of 5: complete the child-to-parent
frame vocabulary. In JSON mode, emit **exactly one `artifact` frame** at
the answer point (`data.output` = the `--print` answer), emit `error`
frames at every nonzero-exit boundary (usage error, client-init failure,
error output, thrown run — plus mid-run error events, the mapping
FID-004 explicitly deferred here), and keep **stdout pure** in JSON mode:
the dispatch suppresses the raw answer write (the artifact frame owns
the answer channel) while stderr diagnostics stay byte-identical in both
modes. Non-JSON mode remains byte-identical v1 by construction — the
emitter is only created when `jsonMode` is set.

## Environment

- **OS:** Windows 11 host (win32, Git Bash); Bun 1.3.14-pinned
- **Commit/State:** working tree carrying FID-003/-004/-008/-009/-010
  (uncommitted); automation level 3
- **Evidence (all read 0-EOF this session):**
  - `cli/src/headless-run.ts` (283 lines) — the answer point
    (`extractFinalAnswer` → `result.output`), the four nonzero-exit
    boundaries, the `handleEvent` error branch, and the FID-004 tap
    creation (the emitter is scoped to the tap ternary only)
  - `cli/src/cli-command-dispatch.ts` (158 lines) — the
    `--print`/stdin/CI branch: threads `jsonMode` (FID-004) but still
    unconditionally `console.log`s the raw answer — the stdout-purity
    defect
  - `cli/src/headless-ndjson.ts` (291 lines) — `emitArtifact` /
    `emitError` exist with **zero production callers** (grepped this
    session: definitions + tests only)
  - `cli/src/headless-ndjson-tap.ts` (96) + its suite (276) — the
    error-event deferral note and the one wiring pin that must migrate
    (error events now emit an error frame)
  - `cli/src/__tests__/headless-run.test.ts` — the DI pattern +
    exit-code contract pins this suite extends
  - stdout-purity grep: `local-agent-registry.ts` /
    `savant-code-client.ts` / `read-stdin.ts` carry zero
    `console.log` / `process.stdout.write` — the dispatch answer write
    is the ONLY stdout pollution on the JSON path
  - quality baseline: `cli/src/headless-run.ts` 284 (300 absolute
    ceiling); `cli-command-dispatch.ts` unlisted (under threshold)

## Detailed Description

### Problem

Four defects (grep + 0-EOF read evidence above):

1. **No artifact frame** — `runHeadlessPrint` computes the answer, but
   the FID-003 emitter's `emitArtifact` has no caller: in JSON mode the
   parent's only answer channel does not exist.
2. **No error frames** — all four nonzero-exit boundaries return
   without a frame; mid-run error events are stderr-only (FID-004's
   recorded deferral: "error frames are FID-2026-0907-005's scope").
3. **stdout pollution** — the dispatch `console.log`s the raw answer
   even in JSON mode: a malformed line on the parent channel (BO rule 5
   violation: "stdout carries nothing else in JSON mode").
4. **Emitter lifetime** — created after client init, so early failures
   (usage error, client-init failure) could never frame even
   internally.

### Expected Behavior (BO acceptance gates)

- Exactly one artifact frame per run; `artifact.output` == the
  `--print` answer for the same brief
- Error frames emitted before nonzero exits
- Zero non-frame bytes on stdout in JSON mode
- stderr untouched in both modes
- Non-JSON mode byte-identical to v1

### Root Cause

Phase 1 FID 3 of the BO not yet implemented (this FID is that
implementation).

## Impact Assessment

### Affected Components

- `cli/src/headless-run.ts` (~+13 → ~296 lines, under the 300 ceiling)
- `cli/src/cli-command-dispatch.ts` (+~6: call the new seam)
- `cli/src/headless-outcome.ts` (NEW — pure ~24-line
  `writeHeadlessOutcome` seam)
- `cli/src/__tests__/headless-ndjson-output.test.ts` (NEW — 9 pins)
- `cli/src/__tests__/headless-ndjson-tap.test.ts` (1 pin migration)
- `dev/quality-baseline.json` (honest headless-run bump if the ratchet
  flags the growth)

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium: additive behind `jsonMode` (non-JSON untouched by
      construction); the dispatch gains a pure, tested seam; question
      frames stay Phase C
- [ ] Low

## Proposed Solution

### Approach

1. `headless-run.ts`: hoist the emitter creation above the prompt
   check (fixes the lifetime defect); compose the FID-004 tap from it
   (mapping unchanged); a tiny local `failWith(exitCode, error)`
   helper emits the error frame at each nonzero boundary; the answer
   point emits the artifact with the exact string the result carries;
   the existing error-event branch also frames (FID-004's deferral).
2. `cli-command-dispatch.ts` + `headless-outcome.ts`: extract the pure
   `writeHeadlessOutcome(result, json)` — the stdout write is gated on
   `!json`; the stderr diagnostic is identical in both modes. A new
   module (not inline) so the purity pin does not drag the dispatch's
   import graph (release/server/login) into the test.

### Mapping decisions

| boundary | frame | notes |
|---|---|---|
| answer point (exit 0) | exactly 1 `artifact` | `data.output` == `result.output` (the `--print` answer, ANSI-stripped + newline-terminated exactly as v1 prints it piped) |
| usage error (exit 2) | `error` | emitter now exists before the prompt check |
| client-init failure (exit 1) | `error` | |
| error output (exit 1) | `error` | |
| thrown run (exit 1) | `error` | |
| error event mid-run | `error` | FID-004's deferral; non-fatal diagnostic; the pre-existing stderr log line is preserved in both modes |
| every boundary, non-JSON | none | emitter never created |

### Steps

1. [x] **RED:** `headless-ndjson-output.test.ts` — artifact
       exactly-once-and-last with `output` == the `--print` answer;
       error frames on all four nonzero boundaries; non-JSON emits
       nothing (run-level v1 identity); `writeHeadlessOutcome` stdout
       suppression + stderr identity (dispatch-level v1 identity).
       Plus migrate the FID-004 error-event pin in the tap suite to
       expect the error frame. Expect FAIL. **Done 2026-09-08** —
       Stage 1 run-level: 6 fail / 1 pass (the v1-identity pin passed;
       every frame pin failed). Stage 2 dispatch-level: module-absent
       (`Cannot find module '../headless-outcome'`) — both RED shapes
       captured below.
2. [x] **GREEN:** the two file changes + the new seam module. **Done
       2026-09-08** — emitter hoisted above the prompt check; `failWith`
       seam frames every nonzero boundary; the answer point emits the
       artifact; the error-event branch frames (FID-004's deferral);
       the dispatch routes the terminal write through the new pure
       `headless-outcome.ts` seam.
3. [x] **VERIFY:** typecheck cli; the four NDJSON/headless suites;
       eslint + prettier on touched files; quality ratchet (honest
       baseline bump recorded: `headless-run.ts` 284 → 296);
       `fid:verify --write`; `validate:repository`; Law 4 grep
       (dispatch → seam → run → emitter). **All green 2026-09-08** —
       receipt below.

## Verification Gates

- gate: typecheck cli
- gate: test cli/src/__tests__/headless-ndjson-output.test.ts
- gate: test cli/src/__tests__/headless-ndjson-tap.test.ts
- gate: test cli/src/__tests__/headless-run.test.ts
- gate: test cli/src/__tests__/headless-ndjson.test.ts

### Verification Receipt

- fingerprint: sha256:804870aef7d80cfd2344bb0feeff344633e0bde9f30be4bf00d0b963b4f250a4
- verified: 2026-09-08T18:19:26.055Z
- typecheck cli: exit 0
- test cli/src/__tests__/headless-ndjson-output.test.ts: exit 0
- test cli/src/__tests__/headless-ndjson-tap.test.ts: exit 0
- test cli/src/__tests__/headless-run.test.ts: exit 0
- test cli/src/__tests__/headless-ndjson.test.ts: exit 0

## Perfection Loop

### Loop 1 — RED (2026-09-08)

- The four defects above cataloged with grep + 0-EOF evidence;
  `emitArtifact`/`emitError` confirmed caller-less; the headless path's
  stdout confirmed clean except the dispatch write.
- **ADVERSARIAL pre-check:** "Why does the artifact carry the
  stripped, newline-terminated string rather than the raw answer?" → it
  IS the `--print` answer — exactly what v1 writes to a piped stdout;
  the BO gate reads `artifact.output` == the `--print` answer, taken
  literally. "Why frame mid-run error events when the BO gate only
  demands frames before nonzero exits?" → FID-004's record deferred
  error-event frames to this FID; the contract calls error frames
  non-fatal diagnostics, and a survivable denial mid-run is exactly
  that; the parent tolerates them by contract. "Why a new module for
  the outcome writer?" → Law 13 pure seam; the dispatch import graph
  (release/server/login commands) is heavy for a console-pin test.
  "Why not dedup an error event followed by an error output?" → no
  dedup contract exists; both frames are non-fatal diagnostics and the
  parent logs them; dedup would be unratified shaping.
- **CHANGE DELTA:** initial authoring.

### Missed Questions

1. *Question frames?* → Phase C (BO out-of-scope note); nothing in
   this FID emits them.
2. *The `--auto` headless branch?* → Untouched; `--json` threads only
   the `--print`/stdin/CI path (FID-004's scope decision, retained).
   **Verifier-audit amendment (2026-09-08, grep-evidenced):** the
   combination is NOT guarded — `--json` (`cli-args.ts:166`) and
   `--auto` (`:138`) are independently declared with no conflict
   rejection, and the dispatch routes `--auto` before the
   `--print`/stdin/CI branch, so `--auto --json` silently ignores
   `--json` and prints raw v1 stdout (`cli-command-dispatch.ts:106,110`
   — the only console writes left in the file, both in the `--auto`
   branch). The BO's parent never invokes `--auto` (activation contract:
   `--json` rides the `--print` path), so this is a misuse footgun, not
   a contract violation. Disposition: recorded here; a conflict guard
   (or `--auto` frame support) is future-FID material, noted for the
   FID-007 live-matrix review.
3. *Empty answer on success?* → `display` stays the empty string; the
   artifact carries `output: ""`. Exactly-one still holds; the parent
   sees an empty answer with exit 0 — honest.
4. *Baseline growth?* → If the ratchet flags `headless-run.ts`, record
   the honest bump (FID-004 precedent: 259 → 284).

## Implementation Verification

> Recorded at implementation — RED evidence first, then gate outputs.

**RED (before GREEN, pasted):**

```text
Stage 1 (run-level pins vs current code):
 1 pass / 6 fail — the artifact pin, all four error-boundary pins,
 and the error-event pin fail (frames never emitted); the non-JSON
 v1-identity pin passes (behavior already exists).
Sample diff (mid-run error-event pin): expected ['error','artifact'],
 received [] — zero frames on the wire.

Stage 2 (dispatch-level pins, module not yet written):
 0 pass / 1 fail / 1 error — Cannot find module
 '../headless-outcome' from headless-ndjson-output.test.ts
```

**Mid-flight pin correction, honestly recorded (FID-004 precedent):**
the non-JSON v1-identity pin for `writeHeadlessOutcome` initially
expected TWO stdout chunks (`output`, then a bare `\n`); v1's
`console.log(result.output)` writes ONE chunk — `output + '\n'`
(the answer is already newline-terminated, so the byte stream carries
the doubled newline). The bytes were identical; the chunk count was a
pin authoring error — fixed the test, not the seam.

**GREEN + gates (pasted):**

```text
bun test (4 suites: output + tap + run + ndjson)   → 50 pass / 0 fail
bun run typecheck (cli)                            → exit 0
eslint 4 touched files --max-warnings 0           → exit 0 (after
                                                     --fix: 2
                                                     import-order
                                                     warnings)
prettier --check 4 touched files                 → clean (after
                                                     --write)
bun run quality:report                             → PASS (1467
   baselined files; honest bump headless-run.ts 284 → 296)
headless-run.ts 296 / headless-outcome.ts 51 / dispatch 155 — all
   under the 300 ceiling
```

### Code Verification Evidence

- [x] All declared gates pass with pasted tool output (receipt below)
- [x] Production call-graph (Law 4, grepped this session):
      `cli-command-dispatch.ts:6,151` imports + calls
      `writeHeadlessOutcome` (`json: json === true` at 151; the
      `--json` threading at 144); `headless-outcome.ts:32` defines
      it; `headless-run.ts:163` `failWith` → `emitError`, `:262`
      error-event → `emitError`, `:282` answer point →
      `emitArtifact` — entry → dispatch → seam → run → emitter, every
      link grepped
- [x] FID status reflects the actual implementation state (`closed`)

## Resolution

- **Fixed Date:** 2026-09-08
- **Fix Description:** `runHeadlessPrint` hoists the FID-003 emitter
  creation above the prompt check (JSON mode only — the lifetime
  defect: usage and client-init failures can now frame), composes the
  FID-004 tap from the same emitter, adds a `failWith` seam that
  frames an error at every nonzero boundary (usage / client-init /
  error output / thrown run), emits the error frame from the
  pre-existing error-event branch (FID-004's recorded deferral;
  stderr logging preserved), and emits exactly one `artifact` frame at
  the answer point carrying the exact `--print` answer string. The
  dispatch's terminal write routes through the new pure
  `writeHeadlessOutcome(result, {json})` seam (`cli/src/headless-outcome.ts`):
  JSON mode suppresses the raw stdout answer (the artifact frame owns
  the answer channel — BO rule 5) while the stderr diagnostic stays
  byte-identical in both modes; non-JSON stays v1 byte-identical.
- **Tests Added:** `cli/src/__tests__/headless-ndjson-output.test.ts`
  (10 tests): 7 run-level pins (artifact exactly-once-and-last with
  output == the answer; error frames on error-output / thrown /
  client-init / usage boundaries; the mid-run error-event frame;
  non-JSON frame-silent v1 identity) + 3 dispatch-level purity pins
  (JSON stdout zero bytes; non-JSON v1 stdout + stderr shapes; JSON
  error diagnostics still on stderr). Plus the FID-004 error-event pin
  migrated in the tap suite to expect the frame.
- **Verification Evidence:** RED → GREEN pasted above; all five
  declared gates green; quality ratchet PASS with the honest baseline
  bump recorded (headless-run.ts 296).
- **Archived:** 2026-09-08 (operator closure directive; see
  FID-2026-0907-003's closure record — the "after FID-007's cross-repo
  smoke" sequencing pointed at a FID never authored). This FID's own
  Phase-1 scope is implemented with its receipt green (5/5 PASS).
  Receipt re-stamped at the archived path with gates re-run live.