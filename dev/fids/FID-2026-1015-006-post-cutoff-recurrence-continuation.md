# FID: Post-cutoff recurrence investigation and execution repair

**Filename:** `FID-2026-1015-006-post-cutoff-recurrence-continuation.md`
**ID:** FID-2026-1015-006
**Severity:** high
**Status:** verified
**Created:** 2026-10-15
**Automation level:** 3
**Master FID:** FID-2026-1012-022
**Continues Classes From:** FID-2026-1012-017, FID-2026-1012-018, FID-2026-1012-019, FID-2026-1012-023, FID-2026-1012-024
**YAGNI-Compliance:** Verified

## Summary

The master's current census has 606 records and 59 stable classes. Eight
classes have post-cutoff failures that invalidate their archived owners'
implementation-only closure waivers. This active continuation owns those
classes without rewriting history or pretending observation has completed.

## Environment

- Windows 11, Bun 1.3.14, TypeScript 5.5.4.
- Baseline implementation commits: 001e36c6 and d71b9065.

## Detailed Description

### Problem

The live recurrence probe reports eight issues. Its archived-waiver check is
working: it refuses a waiver when the class recurs after its declared cutoff.

### Expected Behavior

Each recurrent class has an active repair owner, investigated causes, truthful
handling and qualified production observation before any class-repair claim.

### Root Cause

Distinct causes require investigation rather than treating every failure as a
new runtime defect. The ledger stores first-line outcomes, not tool inputs.
The shell lane shows missing GNU head and Windows FIND selected in Git Bash.
One diagnostic-fixture Bun descendant remained after the initial suite run;
its cause was not established. The existing test checked its registry rather
than proving the descendant stopped; the new PID-marker regression passes.

### Evidence

```text
experiences: 606 records, 59 unique patterns, 25 recurrences >=3 in 14d
recurrence probe: 606 records, 59 stable classes, 8 issues
closure waiver cannot excuse post-fix recurrence (eight class keys below)
```

Owned classes, transferred from the archived original lanes:

- v1:run_terminal_command:timeout:undetermined (023)
- v1:read_files:read-incomplete:undetermined (024)
- v1:run_readonly_command:command-exit:undetermined (024)
- v1:spawn_agents:incomplete-arguments:unexpected (017)
- v1:read_url:http-404:undetermined (018)
- v1:read_url:fetch-unextractable:undetermined (018)
- v1:read_url:http-403:undetermined (018)
- v1:web_search:research-unavailable:undetermined (019)

## Impact Assessment

### Affected Components

- dev/experiences/class-owners.json and the master's status board.
- SDK shell selection, child environment and process cancellation.
- Runtime native rejection steering and producer outcome handling.

### Risk Level

High: a false class-closure claim conceals recurrent failures; shell cleanup
can leave commands running after cancellation. No credential changes, external
requests, inferred expectedness, new waivers or ledger rewrites are authorized.

## Proposed Solution

### Approach

Transfer current ownership to this active record, preserving immutable traces
and archived records. Inspect live producers and reproduce local failures.
Converge the exact source repair before editing it. Distinguish deterministic
handling from remote availability, provider rejections and real observation.

The exact local repair is now converged: the waiver checker admits an ownership
transfer only to one active FID explicitly declaring the former owner in its
Continues Classes From metadata and naming the exact class. It never inherits
the old waiver, and closure of the successor fails while repair is unproved.
Preserve every existing waiver and trace byte.

Add a pure SDK command-failure hint for observed missing Bash executables and
the measured Windows FIND/GNU collision. Attach the hint through the existing
message field, preserving exit status and stderr; never auto-replay commands.
Pin immediate-abort cleanup with a real PID marker before choosing any process
repair. Cause-aware rejection retries already exist in applyNativeStrikeHandling
and buildStepExhaustedError; preserve them and their tests. Remote 403/404,
unextractable pages, missing research access and absent files remain observed
failures with actionable existing diagnostics, not evidence of a local defect.

Source inspection also found the terminal tool's embedded commit guide still
requires agent signatures, global staging and per-commit permission despite
the current single-agent/G1 rules. Align that guide with current authority,
preserving release approval and destructive-operation boundaries.

### Steps

1. Implemented: register all eight classes and re-run allocation, zero issues.
2. Implemented local investigation; provider-specific reproduction is blocked
   on sanitized rejected arguments/schema details and exact URLs absent from
   the immutable capture. Input request is pending; no credentials requested.
3. Implemented: explicit continuation provenance, real shell-failure guidance,
   immediate-abort regression and terminal-tool authority alignment.
4. Deterministic gates pass. Production class-repair certification is blocked
   on real exposure across the required 14-day/three-session window and the
   missing replay evidence. No class is declared repaired.

### Verification

The existing recurrence probe remains the ownership and closure authority.
Source gates are declared after the repair contract converges.

## Verification Gates

- gate: typecheck sdk
- gate: typecheck common
- gate: typecheck packages/agent-runtime
- gate: probe scripts/scripts-typecheck-check.ts
- gate: test scripts/__tests__/experiences-closure-waiver.test.ts
- gate: test sdk/src/__tests__/terminal-failure-hints.test.ts
- gate: test sdk/src/__tests__/terminal-early-abort.test.ts
- gate: test packages/agent-runtime/src/tools/stream-parser/__tests__/error-chunk-rejection-steering.test.ts
- gate: test packages/agent-runtime/src/echo/__tests__/vacuous-verifier-and-settled-loop.test.ts
- gate: probe scripts/experiences-recurrence.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:066c9ac013995c001d2f1109763a06ae34fbc9e1c022480863abab4332cbcaba
- verified: 2026-10-16T03:37:58.958Z
- typecheck sdk: exit 0
- typecheck common: exit 0
- typecheck packages/agent-runtime: exit 0
- probe scripts/scripts-typecheck-check.ts: exit 0
- test scripts/__tests__/experiences-closure-waiver.test.ts: exit 0
- test sdk/src/__tests__/terminal-failure-hints.test.ts: exit 0
- test sdk/src/__tests__/terminal-early-abort.test.ts: exit 0
- test packages/agent-runtime/src/tools/stream-parser/__tests__/error-chunk-rejection-steering.test.ts: exit 0
- test packages/agent-runtime/src/echo/__tests__/vacuous-verifier-and-settled-loop.test.ts: exit 0
- probe scripts/experiences-recurrence.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

Measured the immutable capture against each original lane's cutoff. The eight
issues are real post-cutoff rows, including spawn_agents at 23:12:37Z and a
head-not-found command at 23:12:39Z. Full root suites report 9,162 passes and
23 skips, but the first PowerShell wrapper has not returned an exit status.
The SDK diagnostic Bun descendant was confirmed by PID and command signature
and stopped; unrelated processes were preserved. A new root run uses cmd.exe
to distinguish shell-wrapper behavior from test failures.

### Missed Questions

1. Does active ownership prove repair? No. It restores an honest active owner.
2. Can ordinary 404s or provider rejections be labeled expected? No; Q26 forbids
   inferred expectedness. Investigate handling and preserve the failure record.
3. Can silence close this record? No. The 14-day, three-session qualified
   exposure contract and the operator's named-waiver boundary remain intact.

### Loop 2 — GREEN and independent contract audit

The continuation metadata supplies an explicit provenance check for transfer,
not a waiver. Tests must reject a foreign active owner and a closed successor.
The SDK failure hint is advisory data derived from a failed command's actual
output; command execution, timeouts, expectedness and ledger identity remain
unchanged. Source and fixture inspection confirms a process-race hypothesis,
not its cause, so the PID-marker test precedes any production termination edit.
The exact three new/modified suites are covered by the declared gates. All
local source changes above are authorized by the master at automation level 3.

The final type audit narrows settled-check input to the actual JSONValue domain;
the existing raw tool boundary normalizes it before calling the pure checker.
Its declared regression gate pins unchanged key, warning and reset behavior.

### Code Verification Evidence

```text
SDK src suite: 709 pass / 1 skip / 0 fail, exit 0
Scripts suite: 1012 pass / 0 fail, exit 0
Root typecheck: exit 0
Continuation ownership suite: 9 pass / 0 fail
Local shell/abort suites: 4 pass / 0 fail
Recurrence probe: 606 records / 59 stable classes / 0 issues
```

The declared receipt covers the source repair and regression gates. The final
JSON-domain refinement has its own settled-check regression gate. Production
callers: runTerminalCommand consumes terminalFailureHint; the recurrence CLI
calls closedOwnerIssues, which validates active continuation provenance;
terminalCommandOutputSchema retains message through the client boundary.

## Resolution

Local implementation verified under the master; production investigation remains
active with the specific replay/exposure blockers above. Ownership changes do
not change class keys, repair cutoffs, historical waivers, failure counts or
capture behavior. Status verified certifies deterministic local gates, not class
repair or external availability. Commit is recorded after implementation lands.

## Lessons Learned

An archived implementation receipt is not a guarantee of class-level repair.
