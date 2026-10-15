# FID: EHEL Law-3 Verification Tracker False-Positive Write Block

**Filename:** `FID-2026-0820-012-ehel-law3-verification-tracker-false-positive.md`
**ID:** FID-2026-0820-012
**Severity:** high
**Status:** closed
**Created:** 2026-08-20
**YAGNI-Compliance:** Verified

---

## Summary

The EHEL Law-3 write gate deadlocks the Hybrid write flow after any
`write_file` that creates a new file. Passing verification runs (typecheck,
targeted ESLint, Prettier — all exit 0) executed through `run_readonly_command`
and through the `basher` subagent do **not** clear the tracker's unverified-file
set. Every subsequent write — including `str_replace` on other, already-verified
files and on exempt-path `dev/fids/` documents — is blocked with
`Law 3: Verify before proceeding — N unverified file(s)` until the operator
ends the turn. The block was reproduced twice in one session
(FID-2026-0819-005, Loop 130) and cleared both times only by operator turn-end.

## Environment

- **OS:** Windows 11 / Git Bash / MSYS
- **Runtime:** Bun 1.3.14, TypeScript 5.5.4 monorepo
- **Harness:** Savant ECHO enforcement layer (EHEL `beforeToolCall` gate,
  FSM phase gating, Law-3 verification tracking per FID-2026-0804-009)
- **Observed during:** FID-2026-0819-005 Loop 130 (cli decomposition),
  2026-08-20, Orchestrator session in GREEN phase
- **Relevant surfaces (NEEDS-REVIEW, locate in RED):** the Law-3 gate in the
  tool executor (`"Verify before proceeding"` / `"unverified file(s)"` message
  source), the verification-state tracker it reads, and the command channels
  (`run_readonly_command`, `run_terminal_command`, `basher` subagent).

## Detailed Description

### Observed Reproduction (evidence from the affected session)

1. `write_file` created
   `cli/src/hooks/use-savant-free-session/landing-restart.ts` (new file).
2. `str_replace` on the parent `cli/src/hooks/use-savant-free-session.ts`
   was blocked:
   `BLOCKED: Law 3: Verify before proceeding — 1 unverified file(s):
   [C:\...\landing-restart.ts]. Run typecheck/lint before more writes.`
3. Verification was run and passed repeatedly (≥5 attempts) through BOTH
   channels:
   - `run_readonly_command`: `bun run --cwd=cli typecheck` (exit 0),
     `bun x eslint <file> --max-warnings 0` (exit 0),
     `bunx prettier --check <file>` (pass) — individually and chained.
   - `basher` subagent: same chain, exit 0.
   - Also attempted with the exact absolute backslash path string the gate
     itself reported (ruling out a path-form mismatch in the command args).
   The block persisted through all of them.
4. Operator ended the turn → the block cleared; the parent edit succeeded.
5. After the parent edit, the block re-armed for the parent file. The full
   verification battery passed again (typecheck exit 0; full CLI suite
   3242 pass / 18 skip / 0 fail / 9001 assertions; `quality:report` 170→169),
   and writes to exempt paths (`dev/fids/…`, `SCOPE.md`) were ALSO blocked —
   proving the gate is global, not per-target-path. Operator ended the turn
   → cleared; the exempt-path edits then succeeded first try.

### Candidate Root Causes (for RED to confirm/refute with file:line evidence)

- **H1 — Registration channel mismatch:** only the phase-gated
  `run_terminal_command` path registers verification with the tracker;
  `run_readonly_command` and subagent-executed commands do not. In the
  observed session the Orchestrator's palette exposed no
  `run_terminal_command` tool, making registration impossible → deadlock.
- **H2 — Path-form mismatch:** the tracker records the written file as a
  normalized absolute Windows path while verification commands name files
  with forward-slash relative paths; resolution never matches. (Partially
  refuted: the absolute backslash form was also attempted and did not
  clear — but the attempted form went through the same non-registering
  channel, so H1 may mask H2.)
- **H3 — Turn-end reconciliation:** the unverified set is only reconciled
  at turn/session boundaries, not at gate-evaluation time.

### Impact

- Hybrid Mode (the default workflow) deadlocks after every new-file write
  until the operator manually ends the turn — two interruptions in one loop.
- The gate blocks exempt-path writes (`dev/fids/`, `SCOPE.md`), contradicting
  the documented exempt-path contract (FID-2026-0718-008).
- Genuine Law-3 protection is not weakened by the fix below: an actually
  unverified file must continue to block.

## Proposed Solution

1. **RED (implementation session):** locate the tracker. Grep production
   sources for `Verify before proceeding` and `unverified file(s)`; cite
   `file:line` for the gate, the unverified-set store, and every writer that
   adds/clears entries. Determine exactly which command channel(s) register
   verification and when the set is reconciled. Confirm or refute H1/H2/H3.
2. **GREEN:** make verification registration channel-complete — any
   tool-mediated verification (`run_readonly_command` included, and commands
   run by spawned terminal subagents) must clear matching entries, keyed by
   resolved absolute path with explicit Windows/POSIX path-form
   normalization. Re-evaluate the unverified set at gate time rather than
   reconciling only at turn end. Exempt-path writes must never join the
   blocked set.
3. **AUDIT:** regression test proves: write new file → pass typecheck/lint
   via `run_readonly_command` → a `str_replace` on a different verified file
   succeeds without operator turn-end. A negative test proves an actually
   unverified file still blocks (Law 3 preserved).

## Perfection Loop

### Loop 1 — RED

- The blocker was observed live twice with full command transcripts and exit
  codes (recorded above and in FID-2026-0819-005 Loop 130).
- Call-graph reachability: the gate demonstrably fires on the write path
  (blocked tool calls returned the exact message). The tracker's source
  location is NEEDS-REVIEW — the implementing session must cite `file:line`.

### Loop 1 — GREEN

- Plan recorded in Proposed Solution; no code changed in this planning pass.
- Most robust default chosen: register verification from every command
  channel and normalize path forms, rather than special-casing one channel.

### Loop 1 — AUDIT

- Evidence is operator-visible tool output from the affected session,
  quoted inline. No unevidenced PASS is claimed for code internals; the
  code-level root cause is explicitly NEEDS-REVIEW pending implementation RED.

### Loop 1 — SELF-CORRECT

- Narrowed H2: the path-form hypothesis could not be isolated from H1
  because all verification attempts used the same non-registering channel;
  the FID records both as open questions for RED instead of asserting one.

### Loop 2 — Program-Wide Perfection-Loop Pass (2026-08-21)

- **RED:** fix surfaces re-verified intact with refreshed exact citations:
  the cumulative predicate is `pre-write-gates.ts:95-97`
  (`dirtyFiles` minus `verifiedFiles`) with the block at `:98-104` and the
  exempt-path helper at `:226-233` (`dev/fids/`, `dev/nova/`,
  `dev/scratchpad/`, backslash-normalized + lowercased);
  `enforcement.ts:328-340` credits `verifiedFiles` for every dirty file when
  `run_terminal_command`/`run_readonly_command` passes
  `detectsVerificationCommand`, and `:300-307` evicts the credit + clears
  the flag on re-write (re-arm); `enforcement-state.ts:48-54` is
  `resetForNewTurn` exactly as cited. Regression suites present:
  `pre-write-gates.test.ts` describe `FID-2026-0820-012` carries all four
  required cases (cumulative-credit pass, preserved block, partial-
  verification listing, exempt-path writes for all three prefixes) and
  `enforcement.test.ts` carries the re-arm/re-block describe. Cosmetic NIT
  recorded (cleanup folds into any future touch of the file): a stale
  duplicated `isNewFile` docstring sits above `isExemptWritePath`
  (`pre-write-gates.ts:219-222` vs the correct `:223-225`) — a copy-paste
  artifact of this FID's own edit, zero functional impact.
- **GREEN:** two amendments folded, no code change: (1) live-verification
  protocol caveat — any basher/`run_terminal_command`-channel variant of the
  live protocol must run in GREEN/AUDIT/SELF_CORRECT because the FSM gate
  (`native.ts:222-235`, per FID-2026-0806-016) legitimately refuses
  terminal commands in RED/IDLE phases; a RED-phase attempt was observed
  live 2026-08-21 and is confounded evidence by design. The RECORDED
  protocol is unaffected (it uses `run_readonly_command`, available in
  every phase, plus exempt-path writes). (2) crediting semantics documented:
  any successful verification credits ALL `dirtyFiles`
  (`enforcement.ts:328-340`) — coarse-grained OVER-crediting, the safe
  direction (opposite of false-block); root-matched tightening is queued as
  a future candidate, not urgent. Live re-verification remains OUTSTANDING;
  status stays `fixed`.
- **AUDIT:** PASS 2026-08-21 — the Verifier confirmed the refreshed
  citations fall inside the Detective's reported ranges (finer granularity,
  not contradiction) and that the FSM caveat is correctly scoped to
  basher-channel variants WITHOUT relabeling the Aug-20 pre-relaunch
  failure; the recorded `run_readonly_command` protocol is preserved
  intact.
- **ADVERSARIAL:** UPHELD 2026-08-21 — the Adversary disk-resolved every
  citation in the Loop 2 entry (`pre-write-gates.ts:95-104/:226-233`,
  `enforcement.ts:300-307/:328-340`, `enforcement-state.ts:48-54`) and
  confirmed the stale duplicated `isNewFile` docstring NIT verbatim
  (~:218-221). Status stays `fixed`: the live re-verification remains the
  closure gate.
- **CHANGE DELTA:** this loop entry + missed questions 5-6.

### Missed Questions

1. Why did five passing verification runs fail to clear the original gate?
   Decision (RED-confirmed, H3): the credit flag was only cleared by
   `resetForNewTurn` (`enforcement-state.ts:53`) at turn end, so gate-time
   evaluation never saw it — the fix evaluates the cumulative predicate at
   gate time instead.
2. Does crediting every command channel weaken Law 3? Decision: no — the
   negative regression test proves a genuinely unverified file still blocks;
   credit requires an actual exit-0 tool-mediated verification run.
3. Does a file verified once keep its credit after being modified again?
   Decision (AUDIT follow-up): no — a successful write evicts the path from
   `verifiedFiles` (`enforcement.ts` afterToolCall write branch), re-arming
   the gate; regression test added.
4. Why did the post-restart live verification still fail with the fix in the
   tree? Decision: process-lifetime module caching — the running harness
   predates the fix; closure requires a post-relaunch live re-verification
   (recorded in Live Verification below).
5. May the live protocol use the basher channel? Decision: only in
   GREEN/AUDIT/SELF_CORRECT phases — the FSM gate refuses
   `run_terminal_command` in RED/IDLE, so a RED-phase basher attempt blocks
   the command and its NO-OUTPUT report proves nothing about this gate
   (2026-08-21 program-pass caveat; the recorded `run_readonly_command`
   protocol needs no caveat).
6. Could the cumulative predicate ever false-block legitimately? Decision:
   no false-block vector found for exempt paths (explicitly skipped) or
   turn boundaries (`resetForNewTurn` starts the turn unblocked); the real
   residual quirk runs the OPPOSITE direction — any successful verification
   credits ALL dirty files (over-crediting, safe direction), documented as
   an accepted tradeoff with root-matched tightening queued as a future
   candidate (2026-08-21 program pass).

### Code Verification Evidence

- Files referenced exist and match the fix: `pre-write-gates.ts` (cumulative
  `unverifiedDirty` predicate + exempt-path handling for `dev/fids/`,
  `dev/nova/`, `dev/scratchpad/`), `enforcement.ts` (afterToolCall credit and
  `verifiedFiles` eviction), `enforcement-state.ts` (`resetForNewTurn`).
- Regression coverage: focused pre-write-gates suite 20 pass / 0 fail /
  36 expect() (6 new tests: cumulative-credit pass, unverified block
  preserved, partial-verification listing, exempt-path writes for all three
  prefixes); full agent-runtime suite 1117 pass / 0 fail / 2947 assertions;
  `enforcement.test.ts` re-block test (write → verify → re-write).
- Gates at implementation time: agent-runtime typecheck exit 0; targeted
  ESLint `--max-warnings 0` and Prettier clean.
- Live re-verification post-relaunch: outstanding (see Live Verification) —
  the status therefore remains `fixed`, not `verified`.

## Verification

- Repro test (positive): new-file write → `run_readonly_command`
  typecheck/lint pass → subsequent write to a verified file succeeds in the
  same turn.
- Negative test: a genuinely unverified file still blocks writes (Law 3
  intact).
- All configured typecheck, test, lint, and format gates pass.
- Exempt-path contract test: a pending unverified source file does not block
  writes under `dev/fids/`.

## Step Status

- [x] Blocker observed, reproduced twice, and evidenced with command output.
- [x] FID created with reproduction, hypotheses, and fix plan.
- [x] RED: locate tracker + registration channel with `file:line` citations.
- [x] GREEN: implement channel-complete registration + path normalization.
- [x] AUDIT: positive/negative/exempt-path tests pass.
- [x] Closed with implementation evidence and archived.

## Implementation Evidence (2026-08-20)

- **RED (root cause; H3 confirmed, H1/H2 refuted):** the Law-3 pre-write gate
  (`packages/agent-runtime/src/echo/pre-write-gates.ts:83`) checked only
  `dirtyFiles.size > 0 && !hasVerifiedSinceLastDirty`. Verification commands
  (both `run_terminal_command` and `run_readonly_command` — H1 refuted,
  `packages/agent-runtime/src/echo/enforcement.ts` `afterToolCall`) credit
  `verifiedFiles`, but the flag is only cleared by `resetForNewTurn`
  (`packages/agent-runtime/src/echo/enforcement-state.ts:53`), which runs
  only in `evaluateTurnEnd()` at a completed turn — so every post-write
  verification run left the gate closed until turn end. H2 was masked by H3
  and is moot under the cumulative predicate.
- **GREEN:** `pre-write-gates.ts` now computes `unverifiedDirty` =
  `dirtyFiles` minus `verifiedFiles` (the same predicate as
  `evaluateTurnEnd`'s Law 15 check) and blocks only on that; exempt-path
  targets (`dev/fids/`, `dev/nova/`, `dev/scratchpad/` — the FSM write-gate
  prefixes) are never blocked by pending source verification. Regression
  tests added to
  `packages/agent-runtime/src/echo/__tests__/pre-write-gates.test.ts`
  (cumulative-credit pass, unverified block preserved, partial-verification
  listing, exempt-path writes for all three prefixes).
- **Verification:** agent-runtime typecheck exit 0; focused pre-write-gates
  suite 20 pass / 0 fail / 36 expect() calls (6 new regression tests); full
  agent-runtime suite 1117 pass / 0 fail / 2947 assertions; targeted ESLint
  and Prettier clean.
- **AUDIT follow-up (verifiedFiles eviction):** the Verifier flagged that a
  file verified once and then modified again would keep its stale credit
  under the cumulative predicate. Fixed in
  `packages/agent-runtime/src/echo/enforcement.ts` (`afterToolCall` write
  branch): a successful write now evicts the path from `verifiedFiles`, so
  the gate and the turn-end Law 15 check re-arm for re-modified files.
  Regression test in `enforcement.test.ts` (re-block after
  write → verify → re-write).
- **Second-session reproduction (2026-08-20, independent confirmation):** a
  docs-only FID edit followed by three clean `lint:md` runs (twice via
  `run_readonly_command`, once via `basher`) still left the gate blocked
  with "1 unverified file(s)" — the compliance advisory itself says docs
  verify with `lint:md`, yet the pre-fix gate never consulted the
  verification record. The same session also hit the companion defect where
  `basher` output injection failed ("no command output in my context"),
  which prevented the verification from being observed at all. Both facts
  are consistent with the H3 root cause fixed here; the spawn/output
  injection defect is recorded separately as FID-2026-0820-013.

## Lessons Learned

- A verification gate is only as good as the channels that can satisfy it:
  if the registering channel is unavailable to the role that writes code,
  the gate becomes a deadlock instead of a quality bar.
- Gate state that is only reconciled at turn boundaries converts a
  transient bookkeeping gap into a hard workflow stop.

## Live Verification (2026-08-20, post-restart session): FAILED — fix not live

- The post-restart session executed the planned live protocol: `write_file`
  created `dev/scratchpad/live-verify-fid-012.ts`; `bun run --cwd=cli
  typecheck` passed (exit 0) three times via `run_readonly_command`; a
  `str_replace` on a different (non-exempt) file in the same turn was BLOCKED
  with `Law 3: Verify before proceeding — 1 unverified file(s)`; and a
  `dev/scratchpad/` write with one dirty-unverified file pending was ALSO
  blocked. Under the fixed gate this is impossible: `isExemptWritePath`
  (`pre-write-gates.ts`) exempts `dev/scratchpad/` targets from Law-3
  blocking, and the cumulative predicate credits `verifiedFiles` on
  `run_readonly_command` verification.
- Root cause — deployment, not code: the harness was relaunched from the
  installed launcher cache `~/.config/savant/savant-code.exe` (v0.0.26,
  file dated Aug 19 23:14, metadata file confirmed), which predates the
  working-tree fixes (20:24–20:48 EDT). `cli/bin/` holds no binary. The
  stale gate also deadlocked all Orchestrator writes for the remainder of
  that turn (the original defect, live).
- Disposition: status remains `fixed`. The working-tree implementation and
  its regression suites are unchanged and still valid. Closure awaits a
  live re-verification after relaunch from the working tree
  (`bun run --cwd=cli dev`) or a binary rebuild/reinstall.

## Resolution

Closed 2026-08-22 (operator directive: archive the completed FIDs).
Implementation landed with regression coverage (suite 20 pass / 0 fail /
36 expect(); AUDIT PASS 2026-08-21); the post-relaunch live
re-verification boundary was operator-waived with the closure directive
(running harness process predates the fix — process-lifetime module
caching). Archived with a CHANGELOG entry per the auto-archive contract.
