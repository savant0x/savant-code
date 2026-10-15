# FID: NDJSON stdin control-frame reader — cancel/steer wiring (BO Phase 2, FID 4)

**Filename:** `FID-2026-0907-006-ndjson-stdin-control-reader.md`
**ID:** FID-2026-0907-006
**Severity:** medium
**Status:** closed
**Created:** 2026-09-08
**YAGNI-Compliance:** Verified
**Related:** `dev/build-orders/BO-2026-09-07-ndjson-phase-b-emitter.md`
(§Phased Build Order — Phase 2 FID 4 + §Frozen Wire Contract, control frames);
FID-2026-0907-003 (frame module — `parseControlFrame` +
`createControlFrameReader` shipped pure, zero production callers);
FID-2026-0907-004 (handleEvent tap — the drain seam);
FID-2026-0907-005 (artifact/error/stdout purity); SCOPE.md T21-D

---

## Summary

BO Phase 2 (FID 4 of 5): wire the FID-003 control-frame reader into the
headless run. In JSON mode, attach the line-delimited reader to stdin and
drain it at the `handleEvent` step boundary (the child's observable step
yield): `cancel` → stop new steps via the existing abort signal (cooperative
exit per existing run-loop policy — the throw path → exit 1 + one rule-4
error frame); `steer` → accept + park (Phase C applies); unknown type or
`v ≠ 1` → skipped by the FID-003 parser; stdin EOF → harmless, the run
continues. Non-JSON mode: no reader is created — stdin is never attached,
and v1 stays byte-identical.

## Environment

- **OS:** Windows 11 host (win32, Git Bash); Bun 1.3.14-pinned
- **Commit/State:** working tree at v0.0.30 prep (uncommitted); automation
  level 3
- **Evidence (all read 0-EOF this session):**
  - BO §Phased Build Order — Phase 2 FID 4 (scope + acceptance gates) and
    §Frozen Wire Contract control-frame rules
  - `cli/src/headless-ndjson.ts` — the FID-003 pure reader:
    `parseControlFrame` (tolerant: malformed/unknown/`v≠1` → null) and
    `createControlFrameReader` (`drain()` + `isClosed()`, event-driven
    buffering, never blocks) — **zero production callers** (built pure by
    design in FID-003)
  - `cli/src/headless-run.ts` (296 lines, 300 ceiling) — `jsonMode` wiring
    (emitter + tap + artifact/error), `abortController` already threading
    the SDK run's `signal` (timeout path proves mid-run abort works)
  - `cli/src/__tests__/headless-run.test.ts` — the DI patterns this suite
    mirrors (injectable client, abort-race continuation, isTTY guards)
  - `cli/src/cli-command-dispatch.ts` — the `--print`/piped-stdin/CI branch
    reads piped stdin for the prompt BEFORE `runHeadlessPrint`

## Detailed Description

### Problem

The delegation transport's parent→child half is unimplemented: the FID-003
control reader ships as a pure module with zero production callers, so a
delegating parent cannot cancel a run (its cooperative cancel waits
`cancel_grace_secs` then kills the process) or park steering. Every
delegation remains v1 one-shot.

### Expected Behavior (BO Phase 2 acceptance gates)

- Cancel mid-run → the run stops taking new steps and exits within the
  cooperative window; no progress frames stream after the cancel is drained.
- Unknown/foreign control frames → ignored; the run continues.
- EOF-only stdin → never blocks the run; treated as "no control input".
- Non-JSON mode → no stdin attachment, byte-identical v1.

### Root Cause

Phase 2 of the BO not yet implemented (this FID is that implementation).

### Evidence

- `headless-ndjson.ts` exports `createControlFrameReader({input})` →
  `{drain(): NdjsonControlFrame[], isClosed(): boolean}` — lines confirmed
  in the 0-EOF read; `NdjsonControlFrame` = `{v, type:'cancel'} |
  {v, type:'steer', data:{note}}`.
- `headless-run.ts` already owns `abortController` + `signal` threading and
  the timeout abort path (`client.run` rejects on abort — proven by the
  headless-run timeout test).
- The 296/300 ceiling forces a structural move: the answer-extraction
  helpers (`isTextPart`, `textFromContent`, `lastAssistantText`,
  `extractFinalAnswer`) extract verbatim to `cli/src/headless-answer.ts`;
  `extractFinalAnswer` re-exports from `headless-run.ts` (existing import
  surface preserved — headless-run.test.ts imports it from there).

## Impact Assessment

### Affected Components

- `cli/src/headless-answer.ts` (NEW — pure verbatim move of the four
  answer-extraction helpers; Law 13 re-export hub pattern from
  FID-2026-0819-005)
- `cli/src/headless-run.ts` (reader creation, drain-at-boundary, cancel
  abort + flag, `parkedSteerNotes` on the result)
- `cli/src/__tests__/headless-control.test.ts` (NEW — the Phase 2 pins)
- Not affected: `headless-ndjson.ts` (the FID-003 module is consumed as-is);
  `cli-command-dispatch.ts` (no changes — `jsonMode` already threaded);
  non-JSON mode (no reader created — byte-identity by construction)

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium: headless control-surface wiring; the abort mechanism is
  already proven (timeout path); the reader is event-driven and never
  blocks; non-JSON identity is by construction
- [ ] Low

## Proposed Solution

### Approach

1. **Seam extraction (ceiling pressure):** move the four answer helpers
   verbatim to `cli/src/headless-answer.ts`; `headless-run.ts` re-exports
   `extractFinalAnswer` (import surface preserved).
2. **Reader wiring:** in `runHeadlessPrint`, when `jsonMode`, create
   `createControlFrameReader({ input: params.jsonControlInput ??
   process.stdin })`. New DI param `jsonControlInput?: ControlInputStream`
   (tests inject a fake; production binds stdin).
3. **Drain at the step boundary:** `handleEvent` drains FIRST (before the
   tap) — the per-event seam is the child's observable step yield
   (tap-don't-fork lineage, FID-004). Per drained frame: `cancel` → set a
   `cancelledByControl` flag, `abortController.abort(new Error('Cancelled
   by parent control frame'))`; `steer` → park the note (result field
   `parkedSteerNotes`) + one stderr diagnostic (`[savant-code] steer note
   parked (Phase C): <note>`); unknown → already skipped by the parser.
   After cancel drains, `handleEvent` returns early — no further frames,
   no further stderr logging.
4. **Exit policy:** the abort rejects `client.run` → the existing catch →
   `failWith(HEADLESS_EXIT_ERROR, <abort reason>)` → ONE error frame at
   exit (BO rule 4: error frames before nonzero exit) → exit 1. BO: "a
   nonzero code is also acceptable and is logged as the cooperative exit
   status; the parent reports cancellation from its own side regardless".
   If the run nonetheless RESOLVES after cancel (completion race), the
   success path checks the flag and skips the artifact frame (no frames
   after the ack).
5. **EOF:** `isClosed()` is informational; `drain()` returns `[]` — the run
   never blocks (event-driven buffering, FID-003 design).

### Steps

1. [x] **RED:** `cli/src/__tests__/headless-control.test.ts` — pins:
   (a) cancel mid-run aborts (fake client races the signal like the
   timeout test) → exit 1, error carries the cancel reason, and NO
   progress frame is emitted after the cancel drained; (b) steer parked →
   `parkedSteerNotes` carries the note, run completes exit 0; (c)
   unknown/foreign frames (`{"v":2,"type":"cancel"}`, malformed JSON) →
   ignored, run completes exit 0; (d) EOF-only stdin → run completes
   normally (never blocks); (e) non-JSON mode never attaches the reader
   (the injected input's `on` is never called). **Done 2026-09-08** —
   RED confirmed: 2 pass / 3 fail / 10 expect() calls against the unwired
   run (cancel-abort, steer-park, foreign-frame all failing; the two
   vacuous pins — EOF, non-JSON — green as predicted).
2. [x] **GREEN:** the seam extraction + wiring per the Approach. **Done
   2026-09-08** — `headless-answer.ts` (61 ln, verbatim move + re-export)
   and the `headless-run.ts` wiring (reader creation gated on the emitter,
   drain-before-tap in `handleEvent`, `cancelledByControl` early-return,
   artifact suppression on the completion race, `parkedSteerNotes` through
   `failWith` and the success return).
3. [x] **VERIFY:** typecheck cli; new suite + headless-run/ndjson/tap/output
   suites; eslint `--max-warnings 0` on touched files; prettier; quality
   ratchet; Law 4 grep (`createControlFrameReader` gains its first
   production caller). **Done 2026-09-08** — typecheck cli exit 0;
   55 pass / 0 fail (120 expects) across the five headless suites; eslint
   + prettier clean; quality PASS after ceiling-forced comment
   condensation (Loop 2); Law 4 grep: the `headless-run.ts` import + call
   site are the FID-003 reader's first production callers.

### Verification

Gates below run green with a stamped receipt. The cancel/steer/EOF wiring
is covered by the suite; the live parent-side confirmation is FID-007's
Phase 3 cross-repo smoke (out of this FID's scope). The gates section
carries ONLY allowlisted gate lines — the parser rejects prose (the
FID-2026-0908-001 first-stamp lesson).

## Verification Gates

- gate: typecheck cli
- gate: test packages/agent-runtime/src/echo/__tests__/fid-verification-gates.test.ts
- gate: test cli/src/__tests__/headless-control.test.ts
- gate: test cli/src/__tests__/headless-run.test.ts
- gate: test cli/src/__tests__/headless-ndjson.test.ts

### Verification Receipt

- fingerprint: sha256:857ee00bdcbd0f9870d991b5d9c4a755da43d886e6d757026b52e14a27779780
- verified: 2026-09-08T22:13:02.251Z
- typecheck cli: exit 0
- test packages/agent-runtime/src/echo/__tests__/fid-verification-gates.test.ts: exit 0
- test cli/src/__tests__/headless-control.test.ts: exit 0
- test cli/src/__tests__/headless-run.test.ts: exit 0
- test cli/src/__tests__/headless-ndjson.test.ts: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** the parent→child control half is absent — the FID-003 reader has
  zero production callers (grepped this session); the BO Phase 2 scope and
  acceptance gates are fully specified in the BO (read 0-EOF).
- **GREEN:** the wiring design above (drain-at-boundary; abort reuse;
  park; EOF harmless).
- **ADVERSARIAL pre-check:** "Why drain in `handleEvent` rather than the
  run loop's own boundaries?" → the run loop is inside the SDK
  (`client.run`); `handleEvent` is the child's only observable per-step
  yield and the sanctioned additive seam (FID-004/FID-005 lineage).
  "Why exit 1 on cancel instead of 0?" → BO: "Exit code by existing
  run-loop policy (0 is fine; a nonzero code is also acceptable)" — the
  existing policy for abort is the throw path → 1; the parent owns the
  verdict. "Why park steer notes on the result instead of silently
  dropping?" → the BO gate says "steer accepted + park"; an unobservable
  park cannot be pinned by tests or consumed by Phase C.
- **CHANGE DELTA:** initial authoring.

### Missed Questions

1. *Does the piped-stdin prompt path conflict?* → In the sanctioned
   delegation flow the brief is argv (`--json` final arg), so stdin is free
   for control frames. Piped-prompt + `--json` reads the prompt to EOF
   first (dispatch) → the reader then marks closed → run continues (BO EOF
   rule). Recorded as a design note, not a gate.
2. *Does the reader block when stdin is a TTY?* → No — event-driven
   buffering; drain() returns whatever arrived and the run never waits on
   stdin (FID-003 design).
3. *Timeout vs cancel abort interplay?* → Both share `abortController`;
   whichever fires first wins, and the catch maps the reason. The cancel
   flag distinguishes the cooperative exit from the timeout error.

### Loop 2 — IMPLEMENTATION (2026-09-08)

- **RED evidence:** `bun test src/__tests__/headless-control.test.ts`
  (cwd cli) → 2 pass / 3 fail / 10 expect() calls against the unwired run:
  cancel-abort FAIL (exitCode 0, error "Aborted by caller" — no abort, no
  cancel reason), steer-park FAIL (`parkedSteerNotes` undefined),
  foreign-frame FAIL (the v:2 cancel aborted the run); the EOF and
  non-JSON pins green as predicted.
- **GREEN:** per the Approach — seam extraction first
  (`headless-answer.ts`), then the wiring (reader creation gated on
  `jsonEmitter`, drain-before-tap, `cancelledByControl` early-return,
  artifact suppression on the completion race, `parkedSteerNotes` carried
  through `failWith` and the success return). Post-GREEN: 55 pass /
  0 fail (120 expects) across headless-control, headless-run,
  headless-ndjson, headless-ndjson-tap, and headless-ndjson-output.
- **Ceiling correction:** the wiring grew `headless-run.ts` to 302
  quality-count lines (301 physical by `wc -l`) — over the 300 absolute
  maximum the FID-005 baseline (296) sat under. Absolute ceilings take no
  baseline bumps (FID-2026-0819-005 policy), so the fix was comment
  condensation only — zero code or semantic change — back to 294 physical
  lines; `quality: PASS (1467 baselined files)` re-confirmed. No baseline
  bump needed (294 < the 296 baseline).
- **Gates:** typecheck cli exit 0; eslint `--max-warnings 0` clean on all
  three touched files; prettier clean; quality PASS.

## Implementation Evidence

- `cli/src/headless-answer.ts` (NEW, 61 ln): `isTextPart`,
  `textFromContent`, `lastAssistantText`, `extractFinalAnswer` moved
  verbatim off `headless-run.ts`; `headless-run.ts` re-exports
  `extractFinalAnswer` so the headless-run.test.ts import surface is
  unchanged.
- `cli/src/headless-run.ts` (294 ln post-condensation):
  `jsonControlInput?: ControlInputStream` DI param (defaults
  `process.stdin` in JSON mode); `controlReader` created only when the
  emitter exists (non-JSON never touches stdin); drain-before-tap in
  `handleEvent` with the `cancelledByControl` early-return; cancel →
  `abortController.abort(new Error('Cancelled by parent control frame'))`
  (cooperative exit 1 via the existing throw path; one rule-4 error frame
  from `failWith`); steer → `parkedSteerNotes.push(note)` + one stderr
  diagnostic; completion-race artifact suppression;
  `HeadlessRunResult.parkedSteerNotes?`.
- `cli/src/__tests__/headless-control.test.ts` (NEW, 221 ln): five pins —
  cancel cooperative exit (exit 1 + exact reason + no progress frame after
  the ack), steer parked + artifact still lands, foreign/unknown frames
  ignored (`parkedSteerNotes` = the one valid steer only), EOF-only
  harmless, non-JSON never attaches (the injectable input's `on` is never
  called).
- Law 4 reachability: grep for `createControlFrameReader` across cli/src
  (excluding tests and the defining headless-ndjson.ts) returns only the
  `headless-run.ts` import + call site — the FID-003 reader's first
  production caller.
- Battery (post-condensation re-run): prettier check clean on all three
  touched files; typecheck cli exit 0; 55/0 (120 expects) across the five
  headless suites; quality PASS (1467 baselined files).

## Resolution

- Implemented 2026-09-08: the FID-003 control reader has
  its first production caller and every BO Phase 2 acceptance gate is
  pinned by the suite — cancel cooperatively aborts at the step boundary
  with no frames after the ack; steer is accepted + parked; unknown and
  malformed frames are ignored; EOF-only stdin never blocks; non-JSON
  mode never attaches a reader (byte-identical v1). The live parent-side
  confirmation (real parent → child cancel/steer round-trip) is FID-007's
  Phase 3 cross-repo smoke (SCOPE T21-E) and remains out of this FID's
  scope, per Proposed Solution → Verification.
- Closed + archived 2026-09-08 per the operator's standing directive
  (T17-C: "completed = close + archive + changelog immediately") and the
  same-day trio precedent — scope-complete with a green receipt; the
  FID-007 live-matrix dependency carries as a never-claimed boundary (any
  wire defect found at the future Phase 3 cross-repo smoke fixes forward
  against this record). Receipt re-stamped at the archived path.

## Lessons Learned

- `handleEvent` is the child's only observable per-step yield — control
  frames must drain there, BEFORE the tap, or a cancel cannot stop the
  next step from being taken.
- Ceiling pressure is structural, not cosmetic: 296 (the FID-005
  baseline) + any real wiring exceeds the 300 absolute maximum, so the
  seam move (`headless-answer.ts`) was a prerequisite of the wiring, not
  an optimization.
- A completion race (cancel drained, run resolves anyway) must emit no
  artifact frame — the parent owns the verdict after the ack; the flag
  check before `emitArtifact` is the enforcement point.
- str_replace on multi-line comment blocks can strip the first line's
  indentation (observed twice this session); the mechanical remedy is a
  post-edit prettier --write + --check before trusting the diff.