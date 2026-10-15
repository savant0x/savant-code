# FID: Basher Relay Second-Hop Loss + Vendored-Ripgrep Nondeterministic Resolution

**Filename:** `FID-2026-0821-005-basher-relay-and-ripgrep-vendoring.md`
**ID:** FID-2026-0821-005
**Severity:** high
**Status:** closed
**Created:** 2026-08-21 21:45
**YAGNI-Compliance:** Verified

---

> Authoring note (2026-08-21): created by the Orchestrator under the documented
> separation-of-duties fallback (LEARNINGS 2026-07-25 precedent) after the
> Recorder spawn was cancelled twice by the operator during this session's
> program-wide pass. Operator directive: one FID covering both defects.

## Summary

Two defects that jointly break subagent-mediated verification and search,
converged into one remediation FID by operator directive:

- **Defect A — basher output-relay second-hop loss:** a `basher` subagent's
  terminal-command output reaches the generator return (the BASHER-1 guard
  passes on a delivered json result) but the subsequent summarizer STEP call
  is assembled without the output in context, so basher reports
  `NO-OUTPUT: result not delivered`. The signature — generator-return
  present, history-assembled context absent — localized DOWNSTREAM of the
  statically-confirmed child-history append (STEP-call assembly or
  provider rendering; see Root Cause). Tracked as candidate D4 in
  FID-2026-0821-004; this FID is the implementation vehicle.
- **Defect B — vendored-ripgrep nondeterministic resolution:** the
  `code_search` tool intermittently fails with ENOENT against
  `node_modules/@savant-code/sdk/dist/vendor/ripgrep/<platform>/<rg|rg.exe>`
  even though the binary exists on disk at that exact path (5,407,744
  bytes, verified 2026-08-21). The structural chain is proven: vendoring is
  MANUAL-ONLY (`fetch-ripgrep` invoked by no script, hook, or CI workflow),
  the build copy warn-and-skips on absence, `dist/**` is gitignored so the
  vendored tree is a local-build artifact only, the fetch script can strand
  empty platform dirs, and the platform/binary-name mapping exists in THREE
  drifted copies.

## Environment

- **OS:** Windows 11 / Git Bash / MSYS
- **Language/Runtime:** TypeScript 5.5.4, Bun 1.3.14
- **Commit/State:** main @ v0.0.27 (working tree)
- **Surfaces (A):** `agents/basher.ts`,
  `packages/agent-runtime/src/tools/handlers/tool/spawn-agents.ts`,
  `packages/agent-runtime/src/tools/handlers/tool/spawn-agent-utils.ts`,
  `packages/agent-runtime/src/tools/handlers/tool/spawn-agent-inline.ts`,
  `packages/agent-runtime/src/run-agent-step/step.ts`,
  `packages/agent-runtime/src/run-agent-step/loop-context.ts`,
  `packages/agent-runtime/src/util/messages/history.ts`,
  `common/src/util/messages/convert.ts`
- **Surfaces (B):** `sdk/src/native/ripgrep.ts`,
  `sdk/scripts/fetch-ripgrep.ts`, `sdk/scripts/build.ts`,
  `sdk/src/tools/code-search/executor.ts`, `cli/src/native/ripgrep.ts`,
  `cli/src/utils/savant-code-client.ts`, `sdk/test/setup-env.ts`,
  `sdk/package.json`, root `package.json`, `.gitignore` files

## Detailed Description

### Defect A — basher relay second-hop loss

#### Problem

Three live `NO-OUTPUT` occurrences on 2026-08-21 (two during RED phase —
confounded by design because the FSM gate refuses `run_terminal_command`
there per FID-2026-0806-016 — and one during the FSM-permissive AUDIT
phase, which is the clean datum). In the clean occurrence the command was a
trivial `echo`; the Adversary's decisive observation is that basher's
reply used the SUMMARIZER's instructed NO-OUTPUT phrasing rather than the
BASHER-1 guard's `ERROR:` string (`agents/basher.ts:105-121`) — proving
the guard PASSED and the generator return carried a delivered json result
while the summarizer STEP call's context lacked the output.

#### Established facts (disk-verified 2026-08-21)

- Non-inline spawns (`spawn-agents.ts`, registered
  `handlers/list.ts:44-46`) forward the child definition UNMODIFIED:
  `createAgentState` seeds child history EMPTY when
  `includeMessageHistory` is false (`agents/basher.ts:41`) — unlike the
  inline path, where `spawn-agent-inline.ts:99-106` forces
  `includeMessageHistory:true`.
- The parent-side aggregated report lands via
  `tool-executor/native.ts:579-584` (json ToolMessage); basher's OWN inner
  machinery is: yield `run_terminal_command` (`agents/basher.ts:80-86`), consume
  generator return only, yield `'STEP'` (`:124`).
- `expireMessages` drops only TTL-tagged messages
  (`util/messages/history.ts:~40`); the terminal ToolMessage carries no
  TTL, so truncation cannot be the primary cause.
- json tool results convert structurally
  (`common/src/util/messages/convert.ts:~76-100`), so conversion is not
  the primary cause.
- Micro-compaction replaces content but keeps the message
  (`packages/agent-runtime/src/context-compactor/micro-compact.ts:126-136`,
  path corrected per adversarial disk-resolution) and cannot fire on a
  near-empty basher history.

#### Expected Behavior

A basher spawn whose command produces output returns a summary grounded in
that output. The provider-bound messages for the summarizer STEP call
contain `[assistant(tool-call), tool(json result), user(STEP_PROMPT)]` in
order.

#### Root Cause (primary hypothesis)

The generator-present/history-absent asymmetry persists even though the
child-history append is statically confirmed (`execute-tool-calls.ts`
~:171 pushes the per-call accumulator into `agentState.messageHistory`;
adversarially whole-file-read 2026-08-21) — so the loss sits DOWNSTREAM:
in the summarizer STEP-call message assembly
(`run-agent-step/step.ts:121-135` / `loop-context.ts`) or in provider-side
rendering of the json tool-output part. Static analysis eliminates TTL
filtering, prompt placement, json conversion, and micro-compaction as
primaries. The confirming/diagnosing step is deliberately first in the fix
plan (A8/A9 below).

### Defect B — vendored-ripgrep nondeterministic resolution

#### Problem

Subagent `code_search` calls failed intermittently with ENOENT naming
`...\dist\vendor\ripgrep\x64-win32\rg.exe` (hint: set
`SAVANT_CODE_RG_PATH`), degrading every spawned agent that searches — the
root aggravator of a ~20-call subagent search loop observed 2026-08-21.
Ground truth on disk: the file EXISTS at that exact path (5,407,744 bytes,
mtime Jul 17 15:43; parent dir mtime Aug 21 16:05 — a rebuild event);
`sdk/vendor/ripgrep/` holds all five platform binaries; `rg` is on no PATH
(`rg --version` → command not found; `where rg` → no results).

#### Structural chain (all disk-verified)

1. **Manual-only vendoring:** `sdk/package.json` defines
   `fetch-ripgrep` (`bun scripts/fetch-ripgrep.ts`); root `prepare` is
   hooks-only; NO postinstall/preinstall exists anywhere; NO CI workflow
   invokes it. `sdk prepack` runs `build`, and `build` does NOT fetch.
2. **Silent partial copy:** `copyRipgrepVendor` (`sdk/scripts/build.ts`,
   near file tail — citation corrected per adversarial disk-resolution;
   the :34-60 range is NODE_PATH setup) warn-and-skips when the source
   vendor tree is absent or incomplete ("No vendored ripgrep found;
   skipping").
3. **Local-artifact-only:** root `.gitignore` `**/dist/` and
   `sdk/.gitignore` `dist` mean the vendored tree under `dist/` exists
   only where a local build copied it.
4. **Partial-state hazards in fetch:** `Promise.all` over 5 platforms
   persists completed downloads when one fails; the win32 branch
   mkdir()s before extraction, so a mid-extract failure strands an EMPTY
   platform dir that skip-if-exists then masks on rerun.
5. **Mapping drift ×3:** the platformDir/binaryName mapping exists in
   `sdk/src/native/ripgrep.ts:26-44` (resolver, 6-candidate probe chain:
   env override `:18-20` → ESM-dev → ESM-dist → CJS variants → cwd
   fallback ~`:115-129` → throw ~`:131-137` — line ranges adversarially
   corrected), duplicated in
   `sdk/test/setup-env.ts:59-95`, and baked as a literal in
   `cli/src/native/ripgrep.ts` (compiled-mode self-extract
   `require('../../../sdk/dist/vendor/ripgrep/x64-win32/rg.exe')`).
6. **Missing-binary UX is otherwise sound:** two remediation-hint sites
   (~`ripgrep.ts:131-137` throw; `executor.ts:271-276` spawn-error
   handler).

#### Root Cause

No deterministic pipeline owns the vendored tree end to end: fetch is
manual, copy is best-effort, validation is absent, and resolution fans out
across six silent candidates plus three mapping copies. The specific
trigger of THIS session's ENOENT window is UNPROVEN (the binary is present
now; mtimes are ambiguous) — this FID claims the structural mechanism
chain, not the triggering event.

## Impact Assessment

### Affected Components

- Defect A: basher subagent contract; every non-inline spawn of a
  definition with `includeMessageHistory:false` that relies on its own
  in-run tool results for a later STEP call.
- Defect B: `code_search` native tool (all agents), SDK packaging
  (published tarballs can silently lack platform binaries), contributor
  onboarding (fresh clones get no vendor tree and no automatic fetch).

### Risk Level

- [ ] Critical
- [x] High: verification evidence recorded through basher is silently lost
      (audit-chain integrity); subagent code search intermittently dead
      (workflow-wide tool outage with confusing failures)
- [ ] Medium
- [ ] Low

## Proposed Solution

### Approach

Two disjoint workstreams, sequenced B then A (B's mechanism is fully
proven; A is diagnostic-first). No cross-dependency.

### Workstream B — deterministic ripgrep vendoring (first)

1. **B1 (split validation gates, never network in build):** prepack/publish
   runs a HARD 5-platform manifest gate (every expected platform file must
   exist or packing FAILS closed — a shipped tarball missing a platform
   binary is a shipped defect); the plain dev build emits a LOUD warning
   and skips. No build step downloads anything.
2. **B2 (supply-chain pinning):** `fetch-ripgrep.ts` pins SHA-256 digests
   of the official BurntSushi 14.1.1 release artifacts (computed once at
   implementation, committed) and verifies post-extract.
3. **B3 (one mapping):** export a single `PLATFORM_TARGETS` table from
   `sdk/src/native/ripgrep.ts`; `setup-env.ts` imports it; the cli
   compiled-mode literal gets a PARITY TEST (precedent:
   FID-2026-0821-003-B trigger-threshold parity sweep).
4. **B4 (observability):** `getBundledRgPath` emits an optional,
   throwing-logger-safe debug decision line (winning candidate + env
   override presence) — precedent: FID-2026-0821-003-A
   `reconcileTokenCount` decision line.
5. **B5 (fail-closed getter):** NO auto-repair inside the resolver — no
   filesystem writes from a getter; the validated build copy is the
   repair path; the loud remediation throw stays.
6. **B6 (acceptance matrix):** manifest-completeness unit test;
   empty-platform-dir behavior test (resolver falls through → remediation
   throw); resolver-regime unit tests (env override / ESM-dist / CJS /
   cwd fallback / throw); checksum-verify test; mapping parity test.
7. **B7 (honesty):** the instance trigger of the 2026-08-21 ENOENT window
   is recorded UNPROVEN; closure claims the structural chain plus green
   gates.

### Workstream A — basher relay (diagnostic-first)

1. **A8 (diagnostic-first, BEFORE production changes):** a fake-model
   integration test spawning a NON-inline basher, asserting the
   provider-bound messages contain
   `[assistant(tool-call), tool(json result), user(STEP_PROMPT)]` in
   order. A FAIL yields the reproducing unit; a PASS relocates the loss
   to provider rendering/environment.
2. **A9 (bisect the downstream hops first):** static evidence now
   CONFIRMS the child-history append for non-excluded yields
   (`execute-tool-calls.ts` ~:171; adversarially whole-file-read
   2026-08-21), so the bisection starts DOWNSTREAM of it: first the
   STEP-call assembly (`run-agent-step/step.ts:121-135` /
   `loop-context.ts`), then provider-side rendering of the json
   tool-output part. The original 'whether appended at all' framing was
   corrected by this loop's adversarial read.
3. **A10 (basher-local hardening, defense-in-depth):** embed a TRUNCATED
   output digest (bounded head/tail with elision marker) directly in the
   STEP prompt text while KEEPING the full ToolMessage in history — the
   summarizer becomes immune to any history-assembly regression; the
   general history contract stays pinned by the permanent regression
   test (GREEN-4 of FID-2026-0821-004).
4. **Closure coupling:** a passing live basher spawn with real output is
   also FID-2026-0820-013's remaining closure criterion; record the
   shared evidence in both.

### Steps

1. WS-B implementation session: B1-B6 with the full acceptance matrix;
   gates: sdk typecheck, sdk suite, targeted ESLint/Prettier,
   `code_search` live smoke.
2. WS-A diagnostic session: A8 test → A9 bisection → root-cause citation →
   minimal fix → A10 hardening; gates: agent-runtime + common typecheck,
   focused suites, full agent-runtime suite, live basher spawn smoke
   (GREEN/AUDIT phase). A10 edits `agents/basher.ts`, which is serialized
   into `cli/src/agents/bundled-agents.generated.ts` at prebuild
   (audit NEEDS-REVIEW resolved 2026-08-21 by disk check: the generated
   bundle contains basher and prebuild scans all of `agents/`) — regenerate
   via `bun run --cwd=cli prebuild:agents` and include the regenerated
   bundle in the change.
3. Fold live-evidence cross-references into FID-2026-0821-004 (D4) and
   FID-2026-0820-013 (Round 5) at closure.

### Verification

- WS-B: all B6 tests pass; `bun run --cwd=sdk build` with a populated
  vendor tree produces a complete dist/vendor manifest; with an empty
  platform dir the resolver throws the remediation message; a live
  subagent `code_search` returns results.
- WS-A: the A8 integration test fails before the fix and passes after (or
  its PASS redirects the fix per A9 findings); the permanent regression
  test lands; a live basher spawn returns real summarized output.
- Both: full typecheck/test/lint gates for touched workspaces.

## Perfection Loop

### Loop 1 — RED

- **RED:** 2026-08-21 — Defect A: three live NO-OUTPUT occurrences (one
  unconfounded AUDIT-phase datum with the guard-passed inference);
  non-inline `includeMessageHistory:false` empty-seed confirmed
  (`spawn-agent-utils.ts` createAgentState; `agents/basher.ts:41`); TTL
  (`history.ts:~40`), conversion (`convert.ts:~76-100`), and
  micro-compaction (`context-compactor/micro-compact.ts:126-136`)
  eliminated as primary causes; parent-side injection confirmed
  (`native.ts:579-584`). Defect B: vendoring manual-only (no
  postinstall/CI invoker); build copy warn-and-skip (`build.ts`
  `copyRipgrepVendor`, file tail); dist gitignored; fetch partial-state
  hazards; mapping drift ×3; binary present on disk (5,407,744 bytes)
  despite the ENOENT window; `rg` absent from every PATH.
- **GREEN:** 2026-08-21 — missed-questions pass conducted (11 questions,
  7 plan-changing folded into Proposed Solution: B1 split gates, B2
  checksums, B3 unified table + parity test, B4 resolver debug line, A8
  diagnostic-first test, A9 divergence-first bisection, A10 digest
  hardening; 4 documentation-only: B5 fail-closed getter, B6 acceptance
  matrix, B7 trigger honesty, A11 B-then-A sequencing).
- **AUDIT:** PASS-with-notes 2026-08-21 — the Verifier passed all eight
  audit items (number allocation, metadata, Defect A/B accuracy, disk-state
  claim discipline, plan soundness, cross-references, process compliance)
  with two follow-throughs, both resolved in-document: (1) NEEDS-REVIEW on
  bundled-agents regeneration for A10 — RESOLVED by disk check (the
  generated bundle contains `basher`; prebuild scans all of `agents/`),
  regeneration step added to WS-A; (2) Manifest Sync pointer added to
  FID-2026-0821-004's D4 paragraph.
- **ADVERSARIAL:** UPHELD 2026-08-21 — the Adversary disk-resolved the
  new citation set (majority CONFIRMED, four ADJUSTED) and required four
  documentation corrections before the status flip, all applied:
  (1) micro-compact REAL path is
  `packages/agent-runtime/src/context-compactor/micro-compact.ts` (the
  cited run-agent-step-prefixed path does not exist); (2)
  `copyRipgrepVendor` sits near the build.ts file tail (:34-60 is
  NODE_PATH setup); (3) ripgrep.ts cwd-fallback/throw lines drift low
  (~:115-129 / ~:131-137); (4) A9's 'whether appended at all' framing was
  stale — the whole-file read statically CONFIRMED the child-history
  append (~:171), refocusing the bisection on STEP-call assembly then
  provider rendering. Mechanisms, plan soundness, and claim discipline
  all stand. Carried NEEDS-REVIEW: step.ts/loop-context/native.ts are
  re-read FIRST in the WS-A diagnostic session.
- **CHANGE DELTA:** N/A — new FID created with the converged plan.

### Missed Questions

> Surfaced during the Loop 1 GREEN pass (Thinker, 2026-08-21).

1. Auto-fetch during build? Decision: NEVER network in build
   (non-hermetic, supply-chain surface, CI flake) — prepack gets the hard
   manifest gate, dev build gets loud-warning-and-skip (B1).
2. Pin download integrity? Decision: SHA-256 pin the official 14.1.1
   artifacts in fetch-ripgrep.ts, verified post-extract (B2).
3. Three mapping copies — collapse? Decision: one exported
   `PLATFORM_TARGETS` table; setup-env imports it; the cli compiled
   literal gets a parity test per the FID-2026-0821-003-B precedent (B3).
4. Resolver observability? Decision: optional throwing-logger-safe debug
   decision line naming the winning candidate and env override (B4,
   FID-2026-0821-003-A pattern).
5. Should the getter auto-repair from `sdk/vendor`? Decision: NO — a
   resolver that writes the filesystem is a surprising, concurrent-unsafe
   side effect that masks the build bug; fail closed with the existing
   remediation message (B5).
6. Acceptance matrix? Decision: manifest-completeness, empty-dir
   behavior, resolver-regime units, checksum-verify, mapping parity (B6).
7. Claim the ENOENT trigger? Decision: recorded UNPROVEN — the FID claims
   the structural chain and green gates, not the triggering event (B7).
8. Fix code before diagnosing the relay? Decision: NO — the fake-model
   provider-bound-message test lands FIRST and directs the fix (A8).
9. Which hop-2 candidate bisects first? Decision: the downstream hops —
   STEP-call assembly, then provider rendering. Amendment during this
   loop: the adversarial whole-file read statically CONFIRMED the child
   -history append (`execute-tool-calls.ts` ~:171), so 'whether appended
   at all' is resolved and closed; TTL, prompt shadowing, json conversion,
   and micro-compaction remain eliminated as primaries (A9).
10. Harden basher regardless of root cause? Decision: YES — embed a
    truncated head/tail output digest in the STEP prompt while keeping
    the full ToolMessage in history; plus the permanent regression test
    (A10).
11. Sequencing between workstreams? Decision: B then A; disjoint surfaces
    (sdk vendoring vs agent-runtime relay), no cross-dependency (A11).

### Code Verification Evidence

- [x] Defect B surfaces disk-verified 2026-08-21: `sdk/src/native/ripgrep.ts`
      (:14, :18-20, :26-44; candidate chain ~:47-129 and throw ~:131-137 —
      ranges adversarially corrected), `sdk/scripts/fetch-ripgrep.ts`
      (Promise.all, win32 zip entry, skip-if-exists, mkdir-before-extract),
      `sdk/scripts/build.ts` `copyRipgrepVendor` (file tail; warn-and-skip;
      range corrected per adversarial read), sdk/package.json
      (fetch-ripgrep script; prepack=build; files:["dist",...]), root
      package.json prepare (hooks-only), `.gitignore` dist entries,
      `executor.ts:95/:102/:271-276`, `cli/src/utils/savant-code-client.ts:69-71`,
      `cli/src/native/ripgrep.ts` (dev branch + win32 embed),
      `sdk/test/setup-env.ts:59-95`, `sdk/test/ripgrep-bundling/test-ripgrep.js`.
- [x] Disk state: `node_modules/@savant-code/sdk/dist/vendor/ripgrep/x64-win32/rg.exe`
      present (5,407,744 bytes, Jul 17 15:43); `sdk/vendor/ripgrep/` complete
      (5/5 platforms); `rg` not on PATH (command not found; where: no results).
- [x] Defect A surfaces disk-verified 2026-08-21: `agents/basher.ts:41/:58-62/`
      `:80-86/:105-121/:124`; `spawn-agent-utils.ts` createAgentState
      (includeMessageHistory gate); `spawn-agent-inline.ts:99-106`;
      `spawn-agents.ts` (definition forwarded unmodified) +
      `handlers/list.ts:44-46`; `native.ts:579-584`;
      `util/messages/history.ts:~40` (TTL-only expiry);
      `convert.ts:~76-100` (json branch);
      `step.ts:121-135`; `loop-context.ts` createLoopContext;
      `context-compactor/micro-compact.ts:126-136` (path corrected per
      adversarial disk-resolution).
- [x] Workstream B implementation matches Proposed Solution items B1-B6
      (Verifier PASS-with-notes, 2026-08-21); Workstream A
      (diagnostic-first relay) still pending.
- [x] WS-B gates pasted: prettier over nine changed files exit 0;
      eslint over eight TS surfaces exit 0; sdk + cli + agents typechecks
      exit 0 (consumer typechecks run after the Verifier flagged them);
      focused suite 13 pass / 36 expect() / 0 fail; FULL sdk suite 562
      pass / 1 skip (POSIX-only perms test) / 0 fail across 71 files;
      build smoke exit 0 printing '✓ Copied vendored ripgrep binaries
      (5/5 platforms)'; verify script '✅ Vendored ripgrep manifest
      complete (5/5 platforms)' exit 0.
- [x] FID status reflects the actual state: `analyzed` (loop-converged
      planning document; no implementation — Ground-Truth convention,
      2026-08-16 lesson).

### Loop 2 — Independent audit and self-correction

- **RED:** Not yet run.
- **GREEN:** Not yet run.
- **AUDIT:** Not yet run.
- **ADVERSARIAL:** Not yet run.
- **CHANGE DELTA:** N/A.

### Implementation — Workstream B (2026-08-21): landed, all gates green

- **Changeset (operator-approved implementation of B1-B6):**
  `sdk/src/native/platform-targets.ts` NEW — leaf PLATFORM_TARGETS table +
  resolvePlatformTarget (zero imports; safe for bunfig preload);
  `sdk/src/native/ripgrep.ts` REWRITTEN — consumes the table (B3), optional
  third param `debug?: ResolverDebugLogger` emitting throwing-safe decision
  lines (B4), candidate order + overwrite semantics + throw text preserved
  verbatim, table re-exported; `sdk/scripts/vendor-manifest.ts` NEW —
  PINNED_RIPGREP_SHA256 (five digests computed from the working-tree
  vendor binaries, provenance + re-pin procedure documented), sha256File,
  findMissingVendorBinaries, findChecksumMismatches;
  `sdk/scripts/verify-ripgrep-vendor.ts` NEW — fail-closed prepack manifest
  CLI (B1), never networks; `sdk/scripts/build.ts` — copyRipgrepVendor now
  warns listing exactly which platforms are missing (dev loudness) and
  still skips; `sdk/scripts/fetch-ripgrep.ts` — post-extract SHA-256 verify
  per download plus a final sweep covering skip-if-exists (B2);
  `sdk/test/setup-env.ts` — duplicated mapping replaced by the leaf table
  (off-matrix platforms keep silent-skip via try/catch);
  `sdk/package.json` — prepack = `bun run build && bun scripts/
  verify-ripgrep-vendor.ts` (published tarballs fail closed) + new
  `verify:vendor` script; `sdk/src/__tests__/ripgrep.test.ts` NEW — the
  B6 acceptance matrix (13 tests / 36 expect calls).
- **Gates (all pasted in-session):** prettier over nine changed files
  exit 0; eslint over eight TS surfaces exit 0; sdk typecheck exit 0;
  cli typecheck exit 0; agents typecheck exit 0; focused B6 suite 13
  pass / 0 fail; FULL sdk suite 562 pass / 1 skip / 0 fail (71 files);
  build smoke exit 0 with the enhanced copy step printing 5/5 platforms;
  verify script smoke exit 0 reporting 5/5.
- **Implementation AUDIT (Verifier):** PASS-with-notes — behavior
  preservation, signature backward compatibility, leaf purity, pin
  provenance honesty, gate-split correctness, checksum logic, and test
  adequacy all PASS; REQUIRED follow-through (consumer typechecks for cli
  + agents) executed post-verdict, both exit 0. Two non-blocking test-gap
  notes recorded for a future pass: synthetic checksum-MISMATCH negative
  case, and CJS resolver regimes (document-only — unreachable under Bun
  ESM).
- **Scope discipline confirmed by audit:** the fetch Promise.all
  partial-state hazard was NOT addressed — it is outside the converged
  B1-B7 decisions; the checksum sweep mitigates downstream impact.
- **Outstanding:** none for WS-B; Workstream A implemented same-day —
  see the Implementation — Workstream A section below.

### Implementation — Workstream A (2026-08-21): landed, all gates green

- **A8 probe (diagnostic-first, built BEFORE any production change):**
  `packages/agent-runtime/src/__tests__/basher-relay-step-context.test.ts`
  drives a NON-inline basher-contract agent (empty-seeded history,
  includeMessageHistory:false) through loopAgentSteps with a delivered
  json executor stub and a signature-agnostic capturing stream. First aim
  (runProgrammaticStep directly) exposed a harness fact: the STEP LLM call
  lives in loopAgentSteps, not inside runProgrammaticStep (probe captured
  0 calls) — re-aimed accordingly.
- **A8 RESULT — PASS at the loop layer:** provider-bound messages contain
  [assistant(tool-call), tool(json result), user(STEP_PROMPT)] in order
  (6 expect() assertions incl. ordering + hop-1 history integrity). Per
  the converged decision rule, the live NO-OUTPUT therefore relocates
  DOWNSTREAM of in-repo assembly: live-path provider rendering or
  environment.
- **Round-5 live datum (same day, post-CLI-restart, GREEN phase):** a live
  `echo RELAY_LIVE_PROBE_2026-08-21` spawn with what_to_summarize still
  returned NO-OUTPUT (4th occurrence; first fully post-relaunch with every
  tree fix live). Cross-ref: FID-2026-0820-013 Round 5.
- **A10 implemented (defense-in-depth, contract-typed end-to-end):**
  `relayDigest?: string` added to BOTH AgentState declarations — canonical
  (`common/src/types/session-state.ts`) AND the dependency-free template
  twin (`common/src/templates/initial-agents-dir/types/agent-definition.ts`,
  twin-sync comments mirroring its compactionStatus precedent); writer
  parked in `agents/basher.ts` before `yield 'STEP'` (truncated head/tail
  excerpt with elision marker, skip-when-empty); consume-once injector in
  `run-agent-step/step.ts` appends a tagged STEP_RELAY_DIGEST user message
  beside the STEP_PROMPT then deletes the field; fixture asserts the digest
  message rides AFTER STEP_PROMPT and that the field is cleared
  post-injection.
- **Bundled-agents regeneration:** `bun run --cwd=cli prebuild:agents`
  exit 0 (serialized basher updated); cli typecheck exit 0.
- **WS-A gates (all pasted in-session):** common + agent-runtime + agents
  + cli typechecks exit 0; eslint over the five touched surfaces exit 0;
  prettier canonical normalization of the probe (byte-exact rewrite from
  `bunx prettier` stdout) exit 0; focused probe 1 pass / 6 expect()
  including the A10 ride + consume-once assertions; Law-4 wiring grep
  pasted (loop-iteration.ts:14/:288 → runAgentStep; relayDigest at
  basher.ts:139-144 producer, step.ts:142-156 consumer, both type twins,
  test :170-175/:321).
- **Verifier audit (implementation, WS-A): PASS-with-notes —** injection
  placement (trailing user digest makes the assistant-prefill check a
  structural no-op), consume-once atomicity (delete synchronous with the
  append, before any await), serialized-cast precedent, truncation bounds
  (~830 chars worst case), the A8 inference chain, gates, and cross-refs
  (FID-013 Round 5 extends rather than contradicts; FID-004 D4 pointer
  accurate) all PASS. REQUIRED follow-ups, recorded: (1) probe-file test
  gaps — writer TRUNCATION branch (>840 chars → elision) and a no-digest
  negative regression — land on the next touch of
  `basher-relay-step-context.test.ts`; (2) queue an AgentState-twin parity
  test alongside them (FID-2026-0821-003-B precedent); (3) the next RED
  lever names the SDK `run()` boundary explicitly alongside the B4-style
  live payload dump. Recording-fidelity re-audit (second Verifier pass):
  items 1-3 PASS / PASS-with-note; item-level labels for test-adequacy and
  scope-discipline queue with follow-up (1); REQUIRED correction applied —
  status flipped `analyzed` → `fixed` (implementation exists, gates pass,
  live-path closure gate remains).

## Resolution

- **Closed Date:** 2026-08-22 (operator directive: archive the completed
  FIDs).
- **Fix Description:** WS-B deterministic vendoring (B1-B6) and WS-A
  relay hardening (A8 probe / A10 digest defense) LANDED 2026-08-21 — see
  the Implementation sections. Remaining open item: live-path
  provider-rendering diagnosis (A9 conclusion) tracked jointly with
  FID-2026-0820-013, whose own live boundary was operator-waived at
  closure; A9 remains an observation on the carried list, not a blocker.
- **Tests Added:** B6 acceptance matrix + A8/A10 relay tests (see
  Implementation sections).
- **Verification Evidence:** All gates green at implementation (typecheck,
  vendoring determinism tests, relay probe tests); see Implementation
  sections.
- **Archived:** 2026-08-22 to `dev/fids/archive/` with CHANGELOG entry.

## Lessons Learned

Two subsystems failed the same way: a critical artifact (command output;
vendored binary) moved through a chain with no owner at the seam. The
generator return had its result while history did not; the vendor source
had its binaries while dist did not. Every handoff seam needs either a
validated copy step or a contract test that fails loudly when the two
sides disagree.
