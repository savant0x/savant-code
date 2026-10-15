# FID: Mechanized harness-honesty gates — tool absence, edit-size guidance, exit codes, clean-room verify

**Filename:** `FID-2026-0907-002-harness-honesty-gates.md`
**ID:** FID-2026-0907-002
**Severity:** medium
**Status:** closed
**Created:** 2026-09-07
**YAGNI-Compliance:** Verified
**Related:** `dev/LEARNINGS.md` canonical rules `no-environment-dependent-guards`,
`large-file-edits-via-apply-patch`, `assume-unchanged-phantom-source`,
`dependency-resolution-repo-bound`, `fid-closure-requires-implementation-evidence`
(2026-09-07 review of the learnings file); `dev/agenda.md` tool-friction
recurrences (code_search ×5, str_replace ×5)

---

## Summary

The 2026-09-07 review of `dev/LEARNINGS.md` (1,449 lines, 24 structured
lessons) found that the highest-frequency failure class is **silent
dishonesty of the harness's own surfaces**: a missing search binary that
returns an empty result set, an edit tool that reports "not found" with no
size context on a truncated giant file, gates whose exit codes can be
masked by a pipe, and green local gates that describe the worktree instead
of the commit. Four of these are mechanizable now with small, bounded
changes. This FID implements them as one program.

## Environment

- **OS:** Windows 11 host (win32, Git Bash); Bun 1.3.14-pinned
- **Commit/State:** local `ff1ea8f` + working-tree provider-removal sweep
  (uncommitted); automation level 3
- **Evidence:** live ENOENT of the vendored `rg.exe` in the desktop
  orchestrator (2026-09-07, this session); `dev/agenda.md` recurrences;
  learnings review same day

## Detailed Description

### Problem

Four recurring, lesson-documented dishonesty classes have no mechanical
guard:

1. **Tool absence returns empty, not an error.** The `rg` missing-binary
   class produced a false "zero consumers" claim (2026-08-03, `rg` not on
   PATH) and recurred today as a hard ENOENT in the desktop orchestrator.
   In this repo, `sdk/src/native/ripgrep.ts` throws with a message that can
   embed `undefined` (both fallback paths can be unassigned), and nothing
   probes availability at boot — the operator learns about it at the first
   search, mid-task.
2. **Edit-tool errors carry no size context.** A `str_replace` on a file
   over the 100k-char read-truncation limit fails with
   `The old string … was not found in the file, skipping.`
   (`packages/agent-runtime/src/process-str-replace.ts:211`) even when the
   true cause is that the tail of the file was never shown to the model
   (`sdk/src/tools/read-files.ts` truncates at `MAX_CHARS = 100_000` and
   appends a FILE_TOO_LARGE notice that the next tool call does not see).
   The `large-file-edits-via-apply-patch` lesson records this exact
   confusion loop (str_replace → not-found → grep → confusion).
3. **Exit codes can be pipe-masked.** The v0.0.22 release shipped with a
   *crashed* eslint reported clean because the gate was `cmd | tail; echo $?`
   — `$?` was `tail`'s. The repo's own gate runners capture `exitCode`
   directly (`scripts/fid-verify.ts:141`), but no check forbids the masking
   pattern from re-entering scripts, hooks, or workflow YAML.
4. **Local gates verify the worktree, not the commit.** The
   assume-unchanged phantom-source incident (v0.0.29) and the phantom
   parent-directory `node_modules` incident (v0.0.24) are the same class:
   every local gate passed against content that was not what ships. The
   provenance machinery that proves the committed tree compiles exists only
   inside the release pipeline (`scripts/public-release/provenance.ts`,
   `assertCleanCheckoutCompiles`) — unavailable at commit time.

### Expected Behavior

1. Ripgrep availability is probed once at CLI boot with a loud, remediation-
   naming warning when absent; the resolver's error message names real
   candidate paths (never `undefined`).
2. `str_replace` failures on files over the read-truncation threshold
   append size guidance: the file's true size, the truncation limit, and
   the ranged-read remedy.
3. A repo audit fails `validate:repository` when an exit-code-masking
   pattern (`echo $?` shadowing a piped command) appears in tracked
   scripts, git hooks, or workflow steps.
4. `bun run verify:clean` proves the **committed** tree (detached worktree
   at HEAD + frozen-lockfile install + the typecheck chain) on demand,
   reusing the release-provenance logic, cleaning up on every path.

### Root Cause

Each class was fixed at its incident site but never mechanized, so the
guard lives in prose (`dev/LEARNINGS.md`) instead of in a gate. The learnings
schema itself says it: "Narrative-only lessons cannot reliably become
reusable guardrails."

### Evidence

- `dev/LEARNINGS.md` canonical rules listed in Related (all `active`).
- `dev/agenda.md`: `code_search — tool result contains an error,
  recurrences: 5` and `str_replace — tool result contains an error,
  recurrences: 5`.
- `packages/agent-runtime/src/process-str-replace.ts:205-212` — the
  not-found error string with no size context (read this session).
- `sdk/src/tools/read-files.ts` — `MAX_CHARS = 100_000` truncation with the
  FILE_TOO_LARGE notice appended to the *read* result only.
- `sdk/src/native/ripgrep.ts:150-165` — final throw interpolates
  `vendorPath`/`distVendorPath`, both possibly `undefined`.
- `scripts/public-release/provenance.ts:146-182` — the clean-checkout
  compile gate exists, release-scoped.
- v0.0.22 incident: `dev/LEARNINGS.md` "A gate that 'passed' on a pipe is
  not a verified gate."

## Impact Assessment

### Affected Components

- `sdk/src/native/ripgrep.ts` — resolver error message + new
  `probeRipgrepAvailability()` (memoized, warn-only)
- `cli/src/init/init-app.ts` — boot-time probe call (one try/catch + warn)
- `packages/agent-runtime/src/process-str-replace.ts` — size-guidance
  suffix on match failures when content exceeds the read-truncation limit
- `scripts/audit-exit-codes.ts` (new) + `scripts/validate-repository.ts`
  (wire-in) + `scripts/__tests__/audit-exit-codes.test.ts` (new)
- `scripts/verify-clean.ts` (new) + root `package.json` (`verify:clean`)
  + `scripts/__tests__/verify-clean.test.ts` (new); reuses
  `scripts/public-release/provenance.ts` exports (no duplication — Law 13)
- Automatic (no edits): `str-replace.ts` / `propose-str-replace.ts`
  handlers (they call `processStrReplace`); every consumer of
  `getBundledRgPath`

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium: Developer-experience/audit hardening; no product behavior
      change beyond richer error strings; all additive, fail-loud direction
- [ ] Low

## Proposed Solution

### Approach

Four bounded, independently verifiable changes, ordered by payoff. Each one
converts an existing lesson's "Guard" from prose into a mechanical check or
a self-explaining error. No new dependencies; the clean-room command reuses
the proven release-provenance functions (Law 13).

### Steps

1. [x] **Step 1 — Ripgrep honesty (A).**
   a. In `sdk/src/native/ripgrep.ts`, change the exhausted-candidates throw
      to list the concrete candidate paths attempted (or state "no
      candidates resolved") — never an interpolated `undefined`; include
      `SAVANT_CODE_RG_PATH` + `npm run fetch-ripgrep` remediation.
   b. Add `probeRipgrepAvailability(importMetaUrl?)` returning
      `{ ok: true, path } | { ok: false, error }` (memoized per process;
      wrapping the same resolver, never throwing).
   c. Call it once during CLI boot (`cli/src/init/init-app.ts`) and emit a
      `logger.warn` naming the remediation when `ok: false`. Warn-only —
      the fail-closed behavior at call time is unchanged.
2. [x] **Step 2 — Edit-size guidance (B).**
   In `packages/agent-runtime/src/process-str-replace.ts`, when a
   replacement fails to match (not-found or ambiguity) and
   `initialContent.length > 100_000` (the SDK read-truncation constant;
   export it from `sdk/src/tools/read-files.ts` as a shared constant rather
   than duplicating the number), append to the returned error:
   `This file is <n> chars; read_files output truncates at 100,000 chars,
   so content past that point has not been shown to you. Use read_files
   with offset/limit windows to read the exact region you are editing,
   then retry.` — with tests pinning both the suffix (large file) and its
   absence (small file) in `process-str-replace.test.ts` or a sibling.
3. [x] **Step 3 — Exit-code audit (C).**
   New `scripts/audit-exit-codes.ts`: scan tracked `scripts/**/*.ts`,
   `.githooks/*`, and `.github/workflows/*.yml` for the masking pattern — a
   line matching `^\s*echo \$\?` within 3 lines after a line piping into
   `tail`/`head`/`tee` (regex-scoped, documented allowlist for legit
   usages). Wire it into `scripts/validate-repository.ts` as a new issue
   family; unit-test the detector (positive + negative fixtures).
4. [x] **Step 4 — Clean-room verify (D).**
   New `scripts/verify-clean.ts` exposing
   `runVerifyClean({ sha, root, runner })`: worktree prune → detached
   worktree at HEAD (or explicit sha) → `bun install --frozen-lockfile` →
   root `typecheck` chain → removal on every path. Compose the existing
   exported helpers from `scripts/public-release/provenance.ts`
   (`assertCleanCheckoutCompiles` already owns the sequence; this step
   adds the standalone entrypoint + CLI arg parsing + direct `exitCode`
   capture, no pipes). Root `package.json` gains `verify:clean`.
   Unit-test the arg parsing + runner call sequence with a mock runner
   (the `public-release-provenance.test.ts` pattern).

### Verification

- Static: typecheck (sdk, cli, agent-runtime via root chain), eslint,
  prettier, lint:md, `validate:repository` (now including the new audit).
- Behavioral: unit tests for each new decision function; the clean-room
  command proven once live (exit 0 on the current HEAD) — its own output
  is the acceptance evidence.
- Reachability (Law 4): grep `probeRipgrepAvailability` has a production
  caller in `cli/src/init/`; `verify:clean` present in `package.json`
  scripts; audit wired in `validate-repository.ts`.

## Verification Gates

- gate: typecheck sdk
- gate: typecheck cli
- gate: test packages/agent-runtime/src/__tests__/process-str-replace.test.ts
- gate: test scripts/__tests__/audit-exit-codes.test.ts
- gate: test scripts/__tests__/verify-clean.test.ts

### Verification Receipt

- fingerprint: sha256:f66cf9fdb209a9177460624ab4643bb43fe159d16884f2a663123dce689738c2
- verified: 2026-09-07T17:11:54.673Z
- typecheck sdk: exit 0
- typecheck cli: exit 0
- test packages/agent-runtime/src/__tests__/process-str-replace.test.ts: exit 0
- test scripts/__tests__/audit-exit-codes.test.ts: exit 0
- test scripts/__tests__/verify-clean.test.ts: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** four dishonesty classes enumerated; target files read 0-EOF
  (`process-str-replace.ts` 213/213, `sdk/src/tools/read-files.ts`,
  `sdk/src/native/ripgrep.ts`, `sdk/src/tools/code-search/executor.ts`,
  `sdk/src/run/tool-call.ts`, `scripts/fid-verify.ts`,
  `scripts/fid-gates.ts`, `scripts/public-release/provenance.ts`,
  `cli/src/init` wiring, `.githooks/pre-push`).
- **GREEN:** four steps above.
- **AUDIT (tool-evidenced):**
  - V1 PASS — the not-found error string at
    `process-str-replace.ts:211` quotes verbatim (no size context); the
    truncation notice lives only in the read path
    (`sdk/src/tools/read-files.ts`, `MAX_CHARS = 100_000`).
  - V2 PASS — `ripgrep.ts` final throw interpolates `vendorPath` and
    `distVendorPath`, both possibly unassigned; the executor's spawn-error
    handler (`code-search/executor.ts`) already names `rg` +
    `SAVANT_CODE_RG_PATH` (kept as-is; Step 1 fixes the resolver, not the
    executor).
  - V3 PASS — `sdk/src/run/tool-call.ts` catch converts tool-executor
    throws to `errorMessage` output (fail-closed already holds at the
    dispatch layer); the gap is boot-time visibility + resolver message
    quality, both in Step 1.
  - V4 PASS — `scripts/fid-verify.ts:134-141` captures `spawned.exitCode`
    directly (the repo's gate runners are clean); the masking class lives
    in ad-hoc shell usage, hence the audit battery (Step 3) rather than a
    runner rewrite.
  - V5 PASS — `assertCleanCheckoutCompiles`
    (`scripts/public-release/provenance.ts:146+`) owns the worktree →
    frozen-install → typecheck → cleanup sequence; Step 4 composes it,
    does not copy it.
- **ADVERSARIAL:** "Make read_files return the full file instead" →
  rejected: the 100k cap is a context-budget feature (Law 6 spirit;
  OOM guard upstream); guidance, not removal, is the fix. "Audit could
  just grep for `echo $?`" → too broad: legit uses exist in single-command
  context; the scoped pattern (pipe + `echo $?`) is the incident class.
  "`verify:clean` duplicates the release gate" → the release gate stays
  the authority at cut time; the command is the commit-time *rehearsal*
  and reuses the same functions (Law 13).
- **CHANGE DELTA:** initial authoring.

### Missed Questions

1. *Should the probe block the session when rg is absent?* → No. Search
   fails honestly at call time today (`errorMessage`); blocking boot would
   turn a degraded capability into an outage. Warn + proceed matches the
   "fail loud, don't fail shut" split the release env gate uses.
2. *Threshold constant: duplicate 100_000 or share it?* → Share. Export the
   constant from `sdk/src/tools/read-files.ts` and import it in
   `process-str-replace.ts`; a silent divergence between read-truncation
   and edit-guidance would recreate the confusion this fixes.
3. *Does the size guidance fire on the ambiguity error too?* → Yes — both
   match-failure branches return through `tryMatchOldStr`'s error path;
   guidance applies whenever content exceeded the threshold, whichever
   error shape surfaces. Absence on sub-threshold files is pinned by test.
4. *Windows path separators in the audit scanner?* → Scan tracked files via
   `git ls-files` (the repo's own convention, learned 2026-08-03:
   filesystem grep is not git state), normalize separators, and run the
   same regex on both.
5. *verify:clean default sha?* → HEAD. An explicit `--sha <ref>` supports
   pre-commit rehearsal of a specific commit; absent that, HEAD is the
   thing about to be pushed.
6. *What if `bun install --frozen-lockfile` needs network in the
   worktree?* → Same constraint as the release gate (which has run green in
   cuts); document in `--help` that the command needs registry access or a
   warm bun cache, exactly like the GATES stage.
7. *Does the audit battery scan workflow YAML reliably?* → Workflow files
   use `run: |` blocks; the scanner applies the same line-based regex over
   YAML text (the pattern is line-oriented in both languages). False-
   positive risk is handled by the explicit allowlist with reasons.

### Code Verification Evidence

- [x] Files referenced in Affected Components exist and were read 0-EOF
      this session (paths + line numbers in Loop 1 AUDIT)
- [x] Implementation matches the Proposed Solution (steps are concrete
      edits to named files; no speculative machinery)
- [x] No code claims yet — status `analyzed`; gates bind at `fixed`
- [x] FID status reflects the actual state

### Loop 2 — Independent audit and self-correction

- **RED:** Step 2 initially proposed editing the handler layer
  (`propose-str-replace.ts`); corrected to the shared
  `processStrReplace` core so both `str_replace` and the propose path
  inherit the guidance (Law 13).
- **GREEN:** Step 1 narrowed to the resolver + probe after V3 showed the
  dispatch layer already converts throws to honest `errorMessage` output.
- **AUDIT:** each step cites the file:line it changes; adversarial
  alternatives recorded with rejections.
- **ADVERSARIAL:** "The audit battery is greppable theater" → it encodes
  the exact incident pattern and runs at the same boundary that already
  failed this class; theater would be a rule with no runner.
- **CHANGE DELTA:** <5%.

### Loop 3 — Final convergence

- **RED:** none outstanding; the four steps are independent and ordered by
  payoff.
- **GREEN:** none.
- **AUDIT:** gates declared (three new test paths noted as
  implementation-created); receipt stamps at `fixed`.
- **ADVERSARIAL:** STANDS.
- **CHANGE DELTA:** <2% (converged — circuit breaker).

## Step Status

| Step | Status | Evidence / blocker |
|---|---|---|
| 1 — Ripgrep honesty | `implemented` | Resolver lists attempted candidates (never `undefined`); `probeRipgrepAvailability` memoized probe (`sdk/src/native/ripgrep.ts:181-207`); boot warn wired (`cli/src/init/init-app.ts:30-44`) |
| 2 — Edit-size guidance | `implemented` | Shared constant canonicalized in `common` (see Loop 4); guidance on both match-failure shapes (`process-str-replace.ts:18-40,96-102`); sibling suite 3/0 |
| 3 — Exit-code audit | `implemented` | `scripts/audit-exit-codes.ts` (pure detector + git-ls-files collector); wired into `validate-repository.ts` as `audit.exit-code-masking`; suite 8/0 |
| 4 — Clean-room verify | `implemented` | `scripts/verify-clean.ts` + root `verify:clean`; suite 9/0; **live proof: `verify:clean PASS — ff1ea8f61 (v0.0.30) compiles from a clean checkout (133.9s)`, exit 0** |

## Loop 4 — Implementation-phase corrections

- **Constant home corrected (architecture):** the plan had agent-runtime
  import the shared constant from `sdk/src/tools/read-files.ts`, but the
  workspace dependency direction runs **sdk → agent-runtime**
  (`sdk/src/index.ts:20` imports agent-runtime) — an sdk import from
  agent-runtime is a cycle. Canonical home is `common`
  (`common/src/constants/read-files.ts`, 18 lines); sdk re-exports it
  (`read-files.ts:14-16`); agent-runtime imports from common. One truth,
  no cycle.
- **Test placement:** the guidance pins live in a sibling
  (`process-str-replace-large-file.test.ts`, 101 lines) — the main suite
  was at 264 lines and the 300-line absolute ceiling forbids extending it.
- **Detector-window fixture correction:** the anchor-reset test initially
  placed the shadowing echo at distance 4 (outside the window) — the
  detector was right, the fixture was wrong; corrected to distance 3.
- **[OPEN-OUT-OF-SCOPE → RESOLVED 2026-09-07 (operator ruling):]** an
  untracked parallel-session draft `scripts/audit-silent-failure.ts`
  (364 lines, over the 300 absolute ceiling, unwired) contained its own
  `checkExitCodeMasking` overlapping this FID's Step 3, plus three
  further check families (empty-catch, promise-singleton,
  withTimeoutNoAbort). The parallel session ended mid-draft; the operator
  confirmed it is no longer running and ruled the surviving agent into
  the driver's seat. Resolution: the draft was QUARANTINED (not deleted)
  to `dev/scratchpad/active/audit-silent-failure-draft.ts` — off the
  gated tree (dev/ is not a quality sourceRoot), preserving the three
  extra check families as future-FID reference material; this FID's
  wired + tested Step 3 stands as the exit-code guard. Gates green
  post-ruling: `quality: PASS (1467 files)`, `validate:repository: PASS`.

## Implementation Verification (2026-09-07)

- [x] `typecheck sdk`: exit 0; `typecheck cli`: exit 0;
      `typecheck agent-runtime`: exit 0
- [x] `process-str-replace.test.ts`: 11 pass / 0 fail (untouched suite)
- [x] `process-str-replace-large-file.test.ts`: 3 pass / 0 fail (new, 16
      expects) — combined run with the main suite: 14 pass / 0 fail
- [x] `audit-exit-codes.test.ts`: 8 pass / 0 fail (14 expects)
- [x] `verify-clean.test.ts`: 9 pass / 0 fail (23 expects, mock runner —
      no test spawns git or bun)
- [x] eslint (all 11 touched/new files, `--max-warnings 0`): clean after
      `--fix` import-order auto-fixes
- [x] prettier: clean
- [x] quality baseline: five honest measured bumps (init-app 64→79,
      process-str-replace 214→241, validate-repository 248→258, ripgrep
      185→229, read-files 111→117); all new files under ceiling (predicate
      module n/a; audit 153, verify-clean 157, tests 118/101/18)
- [x] **Live clean-room proof:** `bun run verify:clean` → `verify:clean
      PASS — committed tree at ff1ea8f61 (v0.0.30) compiles from a clean
      checkout (133.9s)`, exit 0
- [x] Reachability (Law 4): `probeRipgrepAvailability` imported by
      `cli/src/init/init-app.ts:4`; `auditExitCodeMasking` imported by
      `scripts/validate-repository.ts:7`; `verify:clean` present in root
      `package.json` scripts; `READ_FILES_MAX_CHARS` imported by both
      `sdk/src/tools/read-files.ts` and
      `packages/agent-runtime/src/process-str-replace.ts`
- [x] Known-red note: `quality:report` / `validate:repository` carry ONE
      violation — the parallel draft above, not this FID's surface

## Resolution

- **Closed Date:** 2026-09-07
- **Fix Description:** four mechanized honesty gates (ripgrep boot probe +
  honest resolver error; edit-size guidance on over-threshold match
  failures; exit-code-masking audit wired into validate:repository;
  standalone clean-room verify command).
- **Tests Added:** Yes — three suites (8 + 9 + 3 tests), 53 expects total
  across the new files.
- **Verification Evidence:** receipt-stamped gates 5/5 PASS + the live
  clean-room run: `verify:clean PASS — ff1ea8f61 (v0.0.30) compiles from
  a clean checkout (133.9s)`, exit 0. Post-collision-ruling tree:
  `quality: PASS (1467 files)`, `validate:repository: PASS`, `lint:md`
  PASS, prettier clean.
- **Archived:** 2026-09-07 (moved to `dev/fids/archive/`; CHANGELOG entry
  appended under Unreleased)
- **Commit SHA:** pending G2 stamp (operator commit; stamped at the
  archived path per the ground-truth ceremony precedent)

## Lessons Learned

- The learnings file's structured schema made this FID cheap: every step
  cites an existing canonical rule with evidence already on disk. The
  schema change (FID-2026-0811-024) is the gift that keeps paying.
- "Fail loud, don't fail shut" is the recurring design split: tool absence
  warns at boot and fails honestly at call time; the audit battery refuses
  the repo, not the workflow.
- **Untracked drafts in a shared tree are a gate hazard:** a parallel
  session's oversized draft broke `quality:report` repo-wide without being
  registered anywhere. Quarantine (not delete) was the right disposition —
  the draft's three unwired check families are real future-FID material
  now parked in `dev/scratchpad/active/`.
- **Workspace dependency direction matters for shared constants:** sdk →
  agent-runtime (not the reverse); a constant needed by both belongs in
  `common`. Check the import graph BEFORE writing the plan's missed-
  question answers.
