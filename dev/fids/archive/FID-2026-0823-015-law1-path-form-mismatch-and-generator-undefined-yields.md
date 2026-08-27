# FID: Law-1 path-form mismatch blocks verified writes; undefined yield keys crash programmatic generators

**Filename:** `FID-2026-0823-015-law1-path-form-mismatch-and-generator-undefined-yields.md`
**ID:** FID-2026-0823-015
**Severity:** critical
**Status:** closed
**Created:** 2026-08-23 18:28
**YAGNI-Compliance:** Verified

---

## Summary

Two live harness failures reproduced 2026-08-23 in a restarted session
(post-v0.0.27 hardening), sharing one systemic theme — unchecked path/value
forms crossing validation boundaries:

1. **Law-1 spurious hard blocks (critical):** every write to a
   legitimately-read file is blocked with "has not been read". Reads register
   under raw RELATIVE paths while the write gate receives ABSOLUTE Windows
   forms; raw-string `Set.has` can never match. Latent since inception,
   lethal since FID-2026-0823-007 made Law 1 block unconditionally (formerly
   advisory-only in HYBRID/core_4). Blast radius: Recorder UPDATE writes
   blocked despite prior read (the read-without-write stall ×2), Orchestrator
   str_replace blocked on freshly-read files, Forge relays blocked (children
   inherit enforcement state).
2. **Generator yield crashes (high):** the Detective's handleSteps yields a
   code_search input containing explicitly-undefined-valued keys
   (`cwd: undefined`, `maxResults: undefined`); `HandleStepsYieldValueSchema`
   types input as `z.record(z.string(), jsonValueSchema)` and `undefined` is
   not a JSON value, so `safeParse` fails and the ENTIRE subagent run dies
   with a giant zod dump (operator-reported "mangled output"). The RED-phase
   Detective is currently unusable for any query whose params omit optional
   fields.

## Environment

- **OS:** Windows (Git Bash / MSYS)
- **Runtime:** TypeScript strict monorepo, Bun 1.3.14
- **Commit/State:** working tree @ v0.0.27 + unreleased hardening
  (release-only-commits); failures reproduce deterministically post-restart

## Detailed Description

### Problem

ISSUE-01 (critical) — path-form mismatch across the Law-1 boundary:

- Read registration stores the caller's literal string:
  `packages/agent-runtime/src/echo/enforcement.ts:222-227` —
  `extractPaths(params.input)` → `this.state.filesRead.add(p)` (relative
  forms like `dev/fids/FID-x.md`).
- Write checks receive absolutized paths: SDK-side resolution via
  `sdk/src/tools/path-utils.ts` (`resolveFilePath`/`toPosix`; consumers incl.
  `sdk/src/run/tool-call.ts`, `tools/apply-patch.ts`,
  `tools/change-file.ts`) produces drive-stripped/absolute forms before the
  runtime gate sees `input.path`.
- The Law-1 comparison is raw membership:
  `pre-write-gates.ts:84-92` — `!params.state.filesRead.has(targetPath)`
  with zero normalization on either side.

Evidence (debug/cli.jsonl, this session): **70 block messages**
(`66 Law 1: Read 0-EOF before touch — \` + `4 ... — \\\\`) quoting absolute
Windows paths, while EVERY tracked read registers relative
(`paths":["agents/basher.ts"]`, `"paths":[".gitignore"]` class — grep census).
Firsthand reproductions: Orchestrator str_replace blocked immediately after
read_files of the same file (×4 files), Forge relay blocked identically,
Recorder stalled twice.

ISSUE-02 (critical) — Recorder stall ×2 (root cause = ISSUE-01):
Both Recorder spawns executed the UPDATE contract (read_files succeeded),
then ended with NO successful write_file; the FID-2026-0823-008 relay guard
fired correctly both times (`Recorder stalled: read without write...`). The
child's write_file hit the ISSUE-01 block; blocked-tool recovery ends the
run without a successful write. The guard works — the cause persists
upstream.

ISSUE-03 (high) — undefined yield keys kill generators:
`common/src/types/agent-template.ts` `HandleStepsToolCallSchema`: input is
`z.record(z.string(), jsonValueSchema)`; a generator yielding
`{toolName:'code_search', input:{pattern, flags, cwd: undefined,
maxResults: undefined}}` fails safeParse (the JSON union has no undefined
member) → `run-programmatic-step.ts` throws `Invalid yield value from
handleSteps in agent detective:` + the complete zod issue JSON. Live repro:
the Detective spawn dispatched during this FID's own RED phase died before
executing any search.

ISSUE-04 (medium, follow-up candidate): the invalid-yield error surfaces the
full zod JSON into the relay/transcript — mangled operator-visible output.

ISSUE-05 (low): pin the exact production call site where tool-call inputs
are absolutized pre-gate (primary suspect `sdk/src/run/tool-call.ts`);
record the citation at GREEN.

### Expected Behavior

- A file read via read_files (any path spelling) is editable afterwards by
  any writer (Orchestrator, Recorder child, Forge) regardless of the path
  form the write call carries.
- A programmatic generator may include optional keys with undefined values
  in yielded tool inputs; they are dropped, never fatal.

### Root Cause

Both defects are boundary form-validation gaps: raw strings compared across
a transformation boundary (path forms), and a strict JSON schema fed objects
containing JS-only `undefined` values that JSON serialization silently drops
(which is also why the logged "Received" payload looks clean).

## Impact Assessment

### Affected Components

- packages/agent-runtime/src/echo/enforcement.ts (read registration)
- packages/agent-runtime/src/echo/pre-write-gates.ts (Law-1 check)
- packages/agent-runtime/src/run-programmatic-step.ts (yield validation)
- common/src/types/agent-template.ts (schema reference only)
- All subagents whose generators may yield optional-keyed inputs

### Risk Level

- [x] Critical: governance gates spuriously block all verified writes;
      the RED-phase agent is unusable

## Proposed Solution

### Approach

A) ONE canonicalization helper (Law 13): `canonicalizePath(p)` =
`path.resolve(path.isAbsolute(p) ? p : path.resolve(process.cwd(), p))` →
strip drive letter → backslashes to forward slashes. Apply at BOTH
boundaries: read registration (enforcement.ts add site) and the Law-1
comparison (pre-write-gates.ts). Note: reads registered before the fix stay
mismatched until re-read or restart (state is per-session).

B) In `run-programmatic-step.ts`, before
`HandleStepsYieldValueSchema.safeParse(result.value)`: when the value is a
tool-call object, shallow-copy `input` dropping `undefined`-valued keys; the
sanitized object flows onward to execution.

C) Deferred follow-ups (documented, non-blocking): truncate the zod dump in
the invalid-yield error (ISSUE-04); sweep bundled generators for
explicit-undefined yields (ISSUE-03 hardening); pin resolver-site citation
(ISSUE-05).

### Steps

1. Add `packages/agent-runtime/src/echo/path-canonicalization.ts` + unit tests
2. Wire canonicalization into enforcement.ts read-registration and
   pre-write-gates.ts Law-1 check
3. Sanitize undefined input keys in run-programmatic-step.ts pre-parse
4. Regression tests: cross-form read/write passes; undefined-keyed yield executes
5. Gates: agent-runtime typecheck exit 0; focused suites green;
   eslint --max-warnings 0

### Verification

Typecheck + focused suites + eslint with pasted output; live confirmation:
one Recorder UPDATE spawn completes a real write post-fix (restarted
harness) — NEEDS-REVIEW for closure until that probe passes.

## Perfection Loop

### Loop 1 — RED (2026-08-23)

- The Detective spawn dispatched for this loop crashed itself (ISSUE-03 live
  reproduction) — RED evidence gathered by the Orchestrator via direct
  greps/reads instead (log ground truth over attribution).
- Evidence: 70 absolute-path Law-1 blocks in debug/cli.jsonl vs all-relative
  tracked reads; firsthand cross-form blocks (Orchestrator ×4, Forge,
  Recorder ×2 via the -008 guard).
- Code citations: enforcement.ts:222-227; pre-write-gates.ts:84-92;
  common/src/types/agent-template.ts HandleStepsToolCallSchema;
  sdk/src/tools/path-utils.ts toPosix.

### Loop 1 — GREEN (2026-08-23)

- **Fix A:** NEW `echo/path-canonicalization.ts` — canonicalizePath()
  resolves relative paths against process.cwd(), strips the drive letter,
  converts backslashes to forward slashes. Wired at BOTH boundaries:
  enforcement.ts:13/:227 (read registration stores canonical form) and
  pre-write-gates.ts:23/:84-105 (Law-1 check compares canonical forms on both
  sides behind a raw-equality fast path). isNewFile exemption unchanged.
- **Fix B:** NEW `run-programmatic-step/sanitize-yield-input.ts` —
  sanitizeYieldToolCallInput() deep-cleans tool-call inputs dropping
  undefined-valued keys at ANY nesting depth (plain objects + arrays),
  reference-preserving when clean. Wired run-programmatic-step.ts:11/:186;
  the sanitized call flows to executeSingleToolCall.
- **Relay channel:** production wirings landed via exact-match,
  count-asserted scratchpad scripts executed by the basher agent (scripts #1
  /#2/#3/#5) because the PRE-FIX runtime blocked Orchestrator str_replace on
  freshly-read files — the defect itself. Documented remedy:
  kill-proof-probes-and-forge-relay (LEARNINGS).
- **Self-correction during GREEN:** the first cross-form test run failed 2
  cases, exposing that lookup-side-only canonicalization misses legacy raw
  entries — hardened to both-sides comparison (relay #2), re-run green.
- **Verifier conditions discharged (self_correct):** C1 — deep-clean of
  nested undefined leaves + 5 nested unit tests (relay #3; cast patch #5
  after grep ground truth showed a multi-line anchor); C2 — integration
  regression AT THE CRASH SITE: runProgrammaticStep driven through an
  undefined-keyed yield (spyOn executeSingleToolCall), asserting survival +
  sanitized execution.

### Loop 2 — AUDIT (2026-08-23)

- Independent Verifier: **PASS WITH CONDITIONS** — C1/C2 as above (both
  discharged same session), C3 = live post-restart probe (NEEDS-REVIEW).
- Gates (all tool-mediated): agent-runtime typecheck exit 0; focused suites
  **49 pass / 0 fail** across 6 files (30 legacy pre-write-gates cases + 4
  canonicalization + 3 cross-form incl. the never-read-still-blocks control
  + 6 sanitizer + 5 nested + 1 integration); eslint --max-warnings 0 clean
  on every touched file (import-order --fix x2 relayed); Law-4 reachability
  greps pasted in-session (enforcement.ts:13/:227, pre-write-gates.ts:23/,
  run-programmatic-step.ts:11/:186).
- Observations recorded (documented, not acted on): win32 case-variance is
  out of scope (lowercase-compare would break case-sensitive POSIX);
  knowledge-graph index staleness for the new files (manual greps stand).

## Step Status

- [x] Canonicalization helper + unit tests
- [x] Enforcement + pre-write-gate wiring
- [x] run-programmatic-step undefined-key sanitization
- [x] Regression tests green
- [x] Gates green (typecheck/suites/eslint)
- [x] Live probes post-restart 2026-08-23: Detective optional-key spawn
      SURVIVED (17 clean matches, no zod crash) — PASSED; Orchestrator
      read_files -> str_replace succeeded first try — PASSED; Recorder
      UPDATE spawn stalled a THIRD time even post-fix — root cause not the
      Law-1 mismatch (probes 1+3 prove it fixed); suspected secondary
      blocker: the verification-receipt tripwire gating `closed` flips.
      Closure completed via DIRECT Hybrid-mode FID writes per explicit
      operator directive; the residual Recorder-stall question is recorded
      as follow-up material.
- Identity note (2026-08-24): renumbered from FID-2026-0823-009 to
      FID-2026-0823-015 by operator de-duplication directive (same-day
      collision with the fid-verification-gates record, created 16:05 vs
      this record's 18:28); the receipt below predates this identity-only
      edit.

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: test packages/agent-runtime/src/echo/__tests__/pre-write-gates-cross-form.test.ts
- gate: test packages/agent-runtime/src/run-programmatic-step/__tests__/sanitize-yield-input-nested.test.ts
- gate: test packages/agent-runtime/src/__tests__/run-programmatic-step-undefined-yield.test.ts

### Verification Receipt

- fingerprint: sha256:481cdc462ad104e3ee6804e8f977a122137f856ab1610feb78d469af43384c35
- verified: 2026-08-23T23:40:08.740Z
- typecheck packages/agent-runtime: exit 0
- test packages/agent-runtime/src/echo/__tests__/pre-write-gates-cross-form.test.ts: exit 0
- test packages/agent-runtime/src/run-programmatic-step/__tests__/sanitize-yield-input-nested.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/run-programmatic-step-undefined-yield.test.ts: exit 0

## Lessons Learned

- A raw-string Set membership check silently spans a transformation boundary:
  reads register under caller spelling, writes arrive resolved. When a gate
  goes from advisory to BLOCKING, latent form mismatches become hard failures
  — audit both sides of every membership check when flipping severity.
- JSON.stringify hides undefined-valued keys, so logged payloads look clean
  while the raw object fails strict schemas. Validate what the validator
  sees, not what the log prints.
- The failure of a RED-phase tool (Detective crash) removed the agent meant
  to investigate it; the orchestrator fell back to direct greps/reads. Every
  specialized agent needs a manual fallback path that does not depend on the
  broken subsystem.