# FID: NDJSON handoff test matrix, live — the 6-case real-process proof (BO Phase 3, FID 5)

**Filename:** `FID-2026-0907-007-ndjson-handoff-matrix-live.md`
**ID:** FID-2026-0907-007
**Severity:** medium
**Status:** closed
**Created:** 2026-09-08
**YAGNI-Compliance:** Verified
**Related:** `dev/build-orders/BO-2026-09-07-ndjson-phase-b-emitter.md`
(§Phased Build Order — Phase 3 FID 5 + §Frozen Wire Contract);
FID-2026-0907-003/-004/-005/-006 (the shipped transport — all closed +
archived with this matrix as their carried live boundary); SCOPE.md T21-E

---

## Summary

BO Phase 3 (FID 5 of 5, "Prove"): execute the handoff's **6-case matrix as
real-process tests** — spawn the actual CLI child (`bun run cli/src/index.tsx
--print <brief> --json`) against a deterministic local fake OpenAI-compatible
SSE gateway and drive its stdin, asserting the frozen wire contract end to
end. This is the live boundary every archived transport FID carried
("never claimed here; lives in FID-007"). The cross-repo smoke (pointing the
real Savant parent's `test_ndjson_*` harness at the built CLI) remains the
explicitly operator-assisted boundary — out of automated scope, carried open.

## Environment

- **OS:** Windows 11 host (win32, Git Bash); Bun 1.3.14-pinned
- **Commit/State:** working tree at v0.0.30 prep (uncommitted); automation
  level 3
- **Evidence (all read 0-EOF 2026-09-08):**
  - BO §Phase 3 — the six cases verbatim + acceptance gates
  - `sdk/src/__tests__/model-provider-free-mode-bare-slug.test.ts` — bare
    slug + `INFERENCE_BASE_URL` routes to that base URL with the caller key
    (proven, tool-mediated) — the deterministic-model seam for a real child
  - `sdk/src/impl/model-provider/default-inference.ts` —
    `createDefaultInferenceModel` uses `getInferenceBaseUrlFromEnv()` for
    its URL and `getInferenceApiKeyFromEnv()` as key fallback
  - `cli/src/utils/settings.ts` + `ollama-onboarding.ts` — the persisted
    model preference key is `savantCodeModelPreference` in
    `settings.json`; config dir overridable via `SAVANT_CODE_CONFIG_DIR`
    (privacy doc §Config directory)
  - `cli/src/__tests__/e2e-cli.test.ts` — the established real-process
    spawn pattern (`spawn(BUN, ['run', CLI_PATH, ...args])`)
  - `cli/src/cli-command-dispatch.ts` + `cli/src/cli-args.ts` — argv-exact
    `--json`; brief via positional argv keeps stdin free for control frames

## Detailed Description

### Problem

The transport shipped (FIDs -003..-006) but its only verification was
in-process DI suites; the BO's Phase 3 gate — the 6-case matrix against a
REAL child process — was never executed. The archived records carry this as
their live boundary.

### Expected Behavior (the 6 cases, BO §Phase 3 verbatim)

1. `--json` happy run: ≥1 progress frame + exactly 1 artifact frame + exit 0
   + `artifact.data.output` == the print answer.
2. no-`--json` byte-identical: stdout is exactly the raw answer (v1 shape),
   zero frame lines.
3. Embedded newline/quote payload survives as one line: the artifact frame's
   JSON escaping round-trips `data.output` == the multi-line answer.
4. Cancel mid-run within grace: parent writes `{"v":1,"type":"cancel"}` to
   the child's stdin; child exits within the 10 s grace window, exit code 1,
   error frame present, no artifact after the ack.
5. stderr-only diagnostics: on a gateway HTTP 500, stdout stays pure NDJSON
   (error frame before nonzero exit) and the diagnostic text goes to stderr.
6. Unknown control frame ignored: `{"v":2,...}` + garbage line + a valid
   steer → run completes exit 0, artifact present, steer note parked (stderr
   diagnostic).

### Root Cause

Phase 3 not yet executed (this FID is that execution). The feasibility seam
is `INFERENCE_BASE_URL` direct-mode routing: a bare-slug model preference in
a temp config dir routes the real child's inference to a local fake gateway,
removing the network nondeterminism.

## Impact Assessment

### Affected Components

- `cli/src/__tests__/handoff-matrix-harness.ts` (NEW — shared gateway/spawn/
  collect/frame-parsing machinery; 300-line-ceiling split)
- `cli/src/__tests__/handoff-matrix.test.ts` (cases 1-3) +
  `cli/src/__tests__/handoff-matrix-part-b.test.ts` (cases 4-6) — the matrix
- Production fix-forwards the live matrix caught (the BO's explicit Phase 3
  contract — "any case failure is a transport defect fix-forward"):
  - `common/src/env.ts` — dev boot banner `console.log` → `console.error`
    (stdout is the headless answer channel; the banner polluted BOTH modes)
  - `cli/src/headless-run.ts` — the default frame writer now appends the
    NDJSON `\n` terminator (frames glued onto one line, live run 2); wires
    the control plane; frames the parent reason on cancel paths
  - `cli/src/headless-ndjson.ts` — `createControlFrameReader` gains the
    `onCancel` ARRIVAL hook (a held LLM request yields no boundaries)
  - `cli/src/headless-control-plane.ts` (NEW — run-side cancel/steer
    semantics extracted from headless-run.ts; `PARENT_CANCEL_REASON`)
  - `cli/src/__tests__/headless-control.test.ts` — arrival-time pin added
  - `dev/quality-baseline.json` — honest bump `headless-run.ts` → 297
- Operator boundary (NOT in this FID's automated scope): the cross-repo
  smoke from the real Savant parent repo

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium: real-process spawns are slower and env-sensitive (child boot,
  gateway SSE shape); mitigated by generous per-case timeouts, a temp config
  dir (`SAVANT_CODE_CONFIG_DIR`), and skip-free deterministic assertions
- [ ] Low

## Proposed Solution

### Approach

1. **Fake gateway** (in-test `Bun.serve`, ephemeral port): OpenAI-compatible
   `POST /v1/chat/completions` answering SSE — one delta chunk with the
   canned content, then `data: [DONE]`. The canned content is configurable
   per case (plain / embedded-newline+quotes). A `/v1/chat/completions` 500
   mode serves case 5. Binds `127.0.0.1` only; closed in `afterAll`.
2. **Child env contract**: `SAVANT_CODE_CONFIG_DIR` = temp dir with
   `settings.json` `{"savantCodeModelPreference":"local-matrix-model"}`
   (bare slug → `createDefaultInferenceModel`); `INFERENCE_BASE_URL` =
   `http://127.0.0.1:<port>/v1`; `INFERENCE_API_KEY` = `dummy-key`
   (bare-slug fallback key); `SAVANT_CODE_RUN_TIMEOUT_MS` = 60000.
3. **Child spawn** (e2e-cli pattern): `spawn(BUN, ['run', cli/src/index.tsx,
   '--print', brief, ('--json')], { cwd: cli/, stdio: pipe })`; stdin free
   for control frames (write + end per case); stdout split by lines.

### Steps

1. [x] **MATRIX (2026-09-08):** the six cases authored and run against the
   shipped transport — the opening runs caught FOUR transport defects
   (Loop 2 below); all fixed forward and re-run to 6/6.
2. [x] **VERIFY (2026-09-08):** typecheck cli exit 0; matrix 6/6 (25
   expects, both parts); the five headless DI suites 56/0; eslint
   `--max-warnings 0` on all touched files; prettier clean;
   `quality: PASS (1467 baselined files)`.
3. [ ] **BOUNDARY:** the cross-repo smoke (real Savant parent → built CLI)
   remains OPEN as the operator-assisted step — documented, never claimed
   by this record.

### Verification

The matrix IS the verification (Phase 3 = Prove). Each case asserts the
frozen wire contract end to end against a real child process.

## Verification Gates

- gate: typecheck cli
- gate: test cli/src/__tests__/handoff-matrix.test.ts
- gate: test cli/src/__tests__/handoff-matrix-part-b.test.ts

### Verification Receipt

- fingerprint: sha256:5057ab7caf83d49c4dc56cf26fc037be16141221580d3c43cec654973a41ecc0
- verified: 2026-09-09T03:58:39.616Z
- typecheck cli: exit 0
- test cli/src/__tests__/handoff-matrix.test.ts: exit 0
- test cli/src/__tests__/handoff-matrix-part-b.test.ts: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Phase 3 never executed — no real-process proof of the frozen
  wire contract exists; the archived transport FIDs carry it as an open
  boundary (never claimed).
- **GREEN:** the matrix design above (fake gateway + deterministic model +
  real child spawns; six cases verbatim from the BO).
- **ADVERSARIAL pre-check:** "Why a fake gateway instead of the DI seams the
  headless suites already use?" → Phase 3's gate is explicitly REAL-PROCESS
  (`spawn the actual CLI`); DI seams bypass argv parsing, child env, stdin
  framing, and stdout purity — the exact surfaces this matrix proves.
  "Why not hit a real provider?" → nondeterministic, network-bound, paid;
  the BO's cross-repo smoke against the real parent covers the live-provider
  dimension as the operator-assisted step. "Flaky child boot?" → generous
  timeouts (60s run timeout, 120s case timeout), ephemeral-port server,
  temp config dir isolates from the operator's dev state.
- **CHANGE DELTA:** initial authoring.

### Loop 2 — Implementation + live-run fix-forwards (2026-09-08)

- **MATRIX run 1 (pasted):** 0 pass / 6 fail / 8 expects — jsonLines threw
  `JSON Parse error` on stdout carrying a non-frame line starting `"Using"`.
  **Defect 1 (transport):** `common/src/env.ts` printed the dev boot banner
  with `console.log` — stdout pollution in BOTH modes (the BO's exact
  "stray print becomes a malformed line on the parent" prediction). Fixed:
  banner → `console.error` (stderr, the diagnostics channel).
- **MATRIX run 2:** 4 pass / 2 fail. **Defect 2 (transport, live-diagnosed
  via `dev/scratchpad/active/matrix-diag.ts`):** two NDJSON frames glued
  onto ONE stdout line — the default frame writer at `headless-run.ts:116`
  wrote no `\n` delimiter (every DI suite injects a collector, so no
  in-process suite could catch it — the real-process gate did its job).
  Fixed: the default writer appends `\n`. **Defect 3 (suite):** case 4's
  collector attached after the cancel write (hangs on early exit), `hold`
  gateway mode unimplemented, untyped frame parsing — suite hardened.
- **MATRIX run 3:** 5 pass / 1 fail — case 2's pin was authored from
  assumption: live diag #2 proved v1 emits `answer\n\n` (display
  normalization `\n` + the console.log-shape `\n`). Byte-identity pins
  what v1 emits; the pin was corrected to ground truth.
- **MATRIX run 4:** 5 pass / 1 fail — case 4 rode the 90s run timeout
  (elapsed 92.6s): `handleEvent` fires only for structured chunks
  (sdk/src/run/stream-handlers.ts); a held pure-text request yields NO
  boundaries. **Fix-forward (transport):** `onCancel` ARRIVAL hook in
  `createControlFrameReader` — the cancel aborts at stdin-parse time,
  independent of LLM state; run-side semantics extracted to
  `headless-control-plane.ts` (300-line ceiling; headless-run.ts was 329).
- **MATRIX run 5:** 6/6 elapsed-green but case 4's error frame carried the
  SDK's generic "Run cancelled by user" (agent-runtime loop.ts:95 /
  exit-paths.ts:101 interpose it) instead of the parent reason.
  **Fix-forward:** `PARENT_CANCEL_REASON` (one truth) framed on both
  failure paths when THIS child consumed the cancel frame.
- **MATRIX run 6 (pasted):** **6 pass / 0 fail / 25 expects** across both
  parts — case 4 aborts in 6.4s with the parent-reason error frame, no
  artifact. Unit suites 56/0; typecheck cli 0; eslint/prettier clean;
  `quality: PASS (1467)`. Harness + cases split per the 300-line ceiling.
- **CHANGE DELTA:** <10% of the FID (evidence + status fields).

### Loop 3 — Independent Verifier audit + self-correct (2026-09-08)

- **AUDIT (Verifier, fresh instance):** 4 PASS (PARENT_CANCEL_REASON
  reachability — export + headless-run.ts import at both failure paths +
  part-b test pin; the `onCancel` arrival hook verbatim in the reader
  enqueue; boundary honesty — the cross-repo smoke carried OPEN verbatim in
  FID/SCOPE/CHANGELOG; FID status + 3-gate list), 4 NEEDS-REVIEW, 4
  advisories.
- **NEEDS-REVIEW discharges (all with fresh tool evidence):**
  (a) pass-count re-execution post-hardening: **62 pass / 0 fail / 148
  expects across all 7 suites** (matrix parts + five headless DI suites;
  pasted below in the Resolution update); (b) typecheck cli exit 0 +
  eslint `--max-warnings 0` clean on the post-hardening files (pasted);
  (c) receipt block confirmed present by grep (fingerprint + 3 gate lines
  exit 0) — and RE-STAMPED after these audit edits so the fingerprint
  covers the hardened tree; (f) quality-gate scope: `quality-report.ts`
  walks `sourceRoots` (lines 23/98) and gates EVERY visited file — proven
  live when the unbaselined `handoff-matrix.test.ts` was flagged at 374
  lines; the static 1467 count labels baseline entries, not gate scope.
- **Advisory discharges (accepted, fixed):** (1) harness start/stop
  reentrancy guards (part-a/part-b share the module-singleton gateway in
  one bun process; idempotent start/stop kills the ordering hazard); (2)
  case-4 grace pin tightened 30s → 20s with the arithmetic documented
  (boot ~4-5s + fixed 6s hold + observed ~1.5s abort ≈ 11.5s worst
  normal; the defect guarded was the 92s timeout ride); (3) case-5 stderr
  pin upgraded from smoke-level `length > 0` to the deterministic
  `Error:` marker (writeHeadlessOutcome writes it on every failed run);
  (4) `dev/scratchpad/active/matrix-diag.ts` deleted (superseded by the
  harness; rm exit 0 confirmed).
- **CHANGE DELTA:** <10% (audit record + guards + pins).

### Missed Questions

1. *Does the run loop attempt tool calls against the fake gateway?* → The
   canned reply is a plain assistant message (no tool_calls); the runtime
   finishes after the turn. Deterministic.
2. *Windows pipe encoding?* → stdout chunks decoded utf8; split by `\n`;
   strip-ANSI is applied by the CLI itself when piped.
3. *Does `--json` position matter?* → Commander parses flags anywhere, but
   the BO contract is argv-exact final-arg-before-brief — the suite follows
   that convention.
4. *Cross-repo smoke?* → Operator-assisted (real Savant parent repo + built
   CLI); carried OPEN, never claimed by this FID.

### Code Verification Evidence

- [x] Files referenced in Affected Components exist (`headless-run.ts` 297
      lines; `headless-control-plane.ts` new 64; `headless-ndjson.ts` 298;
      matrix harness 258 + parts 90/98 post-audit-hardening,
      prettier-normalized; `env.ts` 108)
- [x] Implementation matches the Proposed Solution + the recorded
      fix-forwards (the matrix IS the verification; production defects
      fixed per the BO's Phase 3 contract, all recorded in Loop 2)
- [x] Typecheck/tests/lint pass with pasted tool output (Loop 2 run 6)
- [x] Production call-graph evidence: the emitter default writer is the
      stdout seam for every non-injected JSON run; `createHeadlessControlPlane`
      called from `runHeadlessPrint` (Law 4 grep — sole production caller);
      `PARENT_CANCEL_REASON` referenced at both failure paths
- [x] FID status reflects the actual implementation state (`fixed`)

## Resolution

- **Fixed Date:** 2026-09-08
- **Fix Description:** the 6-case matrix executed live to 6/6 against the
  real CLI child. Phase 3 caught and fixed forward four transport defects
  the in-process DI suites structurally could not see: (1) the env boot
  banner polluted stdout in both modes (→ stderr); (2) the default NDJSON
  frame writer omitted the `\n` delimiter (→ frames glued on one line);
  (3) mid-stream cancel rode the run timeout because a held LLM request
  yields no stream boundaries (→ `onCancel` arrival-time abort in the
  control plane); (4) the SDK's generic cancellation message masked the
  parent reason (→ `PARENT_CANCEL_REASON` framed when this child consumed
  the cancel). One test pin was corrected to ground truth (v1 emits
  `answer\n\n`); the matrix was split per the 300-line ceiling
  (harness + part-a + part-b).
- **Tests Added:** Yes — the 6-case real-process matrix (harness + two
  parts, 25 expects) + the arrival-time cancel pin in
  headless-control.test.ts (6 tests total in that suite).
- **Verification Evidence:** matrix run 6 = 6 pass / 0 fail / 25 expects
  (pasted in Loop 2); Loop 3 audit hardening re-run: **62 pass / 0 fail /
  148 expects across all 7 suites** with the tightened grace + stderr
  pins; typecheck cli exit 0; eslint `--max-warnings 0` clean on all
  touched files; prettier clean; `quality: PASS (1467 baselined files)`;
  receipt machine-stamped below (re-stamped post-audit).
- **Archived:** 2026-09-08 — moved to `dev/fids/archive/` per the operator
  closure directive; receipt re-stamped at the archived path with all
  declared gates re-run. The cross-repo smoke (real Savant parent → built
  CLI) carries OPEN as the operator-assisted boundary — never claimed by
  this record; any wire defect found there fixes forward against this
  archived path.

## Lessons Learned

- Real-process gates earn their cost: all four transport defects were
  invisible to every in-process DI suite because DI replaces the exact
  surfaces that were broken (stdout writer, stdin arrival, SDK cancellation
  framing). The matrix caught them on its opening runs.
- Pin outputs from ground truth, not assumption: case 2's "obvious" single
  newline was wrong by one byte — live diagnosis showed v1 emits two.
- A held LLM request yields no stream boundaries: any child-side logic that
  waits for the next event to act on stdin input will ride the run timeout.
  Arrival-time handling is the only contract-honoring design for cancel.
- File ceilings bind during fix-forward bursts: extract the new seam
  (control plane) rather than compressing history out of existing comments;
  keep one canonical constant for strings that cross the abort/frame
  boundary.