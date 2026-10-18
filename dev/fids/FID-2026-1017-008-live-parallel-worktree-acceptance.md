# FID: Live parallel-worktree acceptance - operator-driven A-Z live run

**Filename:** `FID-2026-1017-008-live-parallel-worktree-acceptance.md`
**ID:** FID-2026-1017-008
**Severity:** low
**Status:** converged
> **Run state (2026-10-17):** the A–Z run executed and returned DEFECTS FOUND.
> `converged` is retained because the lane-vehicle precondition (and the
> re-run's `create`) requires exactly one active converged FID; the run outcome,
> the failed row and both blockers are recorded below. This record claims no
> acceptance until a clean re-run.
**Created:** 2026-10-17 17:34
**Automation level:** 3
**YAGNI-Compliance:** Verified - reuses the existing focused suites, the
real-git/SQLite probe, the Law 2 register gate and the operator CLI; this
record introduces no new code, dependency, daemon or service.

---

## Summary

FID-2026-1017-007 shipped the FID-bound parallel worktree system and closed
with a real-git probe plus unit suites, while explicitly making no live
operational claim ("No live multi-agent inference, throughput benchmark or
sandbox claim is made"). This record closes the operational-acceptance gap:
the operator drives an A-Z live test inside the running harness against the
real repository, exercising the whole lane lifecycle (create, verify,
refusals, lane writes under the Law 2 jurisdiction mapping, dirty-disposal
refusal, lane commit, fast-forward merge with main-graph refresh, divergent
re-merge refusal, explicit-discard disposal). This converged record doubles as
the acceptance vehicle: its id is the lane under test. The only artifacts this
session authors are the run instrument
(`dev/test-prompts/az-parallel-worktrees-live-test.md`), this record, and the
register grant that lets the run's lane write pass as its repo-relative
target. The run's report plus the lane proof merged to `main` become the
acceptance evidence; closure retires this record and releases its write
targets.

## Environment

- **OS:** win32 (Git Bash), Git 2.52
- **Language/Runtime:** TypeScript strict, Bun 1.3.14, Bun workspaces
- **Tool Versions:** markdownlint-cli 0.49.x (repo gate), harness at
  `2b10a946` when this record was authored
- **Commit/State:** authored on `main` at `2b10a946`; the lane under test is
  provisioned from the commit that adds this record

## Detailed Description

### Problem

The parallel-worktree lifecycle is proven against temp repositories and
injected seams (probe `scripts/probes/fid-worktrees.ts`, the eight focused
suites). No live run had exercised it in the real repository through the
harness's own tool surface and the operator CLI with the real register,
real graph, real junctions and real refusals. The failure classes that only
appear live are exactly the ones the FID-007 closure documents as unclaimed:
registration reconciliation against real git state, the Law 2 jurisdiction
mapping against the real `SCOPE.md`, the environment stride on the real
machine, and the merge + graph-refresh path on a populated `.savant/`.

### Expected Behavior

An operator-driven A-Z run inside the running CLI proves, with pasted
evidence: lane creation from this record's converged status with the recorded
base, branch, junctions and graph snapshot; typed refusals for invalid,
not-converged, duplicate, locked, dirty and diverged states; a covered write
inside the lane passing the Law 2 gate while uncovered and unregistered-lane
writes are blocked; a committed lane proof fast-forwarding onto `main`; the
main graph refreshed with the merged file; disposal refusing dirty lanes and
honoring explicit discard; and a clean final checkout. The run's report is the
acceptance record.

### Root Cause

Not a defect: an acceptance-coverage gap. FID-2026-1017-007's limits state it
explicitly, and the system's own design routes lifecycle mutations through a
lock and fail-closed gates that were only exercised at unit/probe level.

### Evidence

```text
FID-2026-1017-007 (archive) Resolution: "No live multi-agent inference,
throughput benchmark or sandbox claim is made."

2026-10-17 live run (report archived at
`dev/test-prompts/archive/2026-10-17-parallel-worktrees-live-test-report.md`):
41 PASS, 1 FAIL (§5.15 — the merged file was absent from main's graph), 1
OPERATOR-CONFIRMED, 1 SKIP (busy-lock row declined by the operator), 0
NEEDS-REVIEW. BLOCKER-1: intermittent `unsafe-root` refused 3 of the 18 live
lifecycle calls that reached the service; not reproducible out-of-process and
still unexplained. BLOCKER-2: post-merge graph refresh failed; root-caused and
repaired by FID-2026-1017-011 (`774eb705`), which completed the live refresh in
8,894 ms and indexed the merged lane proof.

This session (pre-run): the register's machine-readable surface was audited
with the gate's own parser module (packages/agent-runtime/src/echo/scope-targets.ts)
after FID-2026-1001-003's grammar: the previous FID-2026-1017-008 line was
unparseable (a parenthetical stood between the id and its colon) and therefore
granted nothing; it was rewritten to the parseable form. The audit also found
a closed record (FID-2026-1016-013) whose line still parsed as a live grant;
its head was converted to the released prose form so the mechanical register
matches its prose. Parser output for both states is recorded in the session
commit range.
```

## Impact Assessment

### Affected Components

- No production component is modified by this record; the affected surfaces
  are `dev/test-prompts/az-parallel-worktrees-live-test.md`, this record, and
  the register grant in `SCOPE.md`.

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [x] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Instrument the acceptance as an A-Z live-test prompt executed by the operator
inside the harness (paid inference explicitly authorized for this run:
provider `kiosapi`, model `step-5-preview`), with every mutation
operator-confirmed and every refusal string captured verbatim. The run
re-executes the declared gate surface live and then drives the lane cycle in
the real repository.

### Steps

1. Author the A-Z run instrument + this converged record + the register grant
   (including the parseable write targets the lane write needs); commit on
   `main`. — implemented in this session.
2. Operator executes the A-Z run inside the running CLI from `main` at that
   commit; the run writes its report to `dev/scratchpad/` and leaves the lane
   proof merged onto `main`. — implemented: the run executed on 2026-10-17
   (19:03–19:31 EDT) from `5768aff6`, merged the lane proof as `3d24daf9`
   (fast-forward), disposed the lane and retained the branch. Its report is
   preserved at
   `dev/test-prompts/archive/2026-10-17-parallel-worktrees-live-test-report.md`;
   its overall call was **DEFECTS FOUND** (one FAIL row, §5.15).
3. Closure: promote the report to a durable path, stamp the receipt below,
   close and archive this record, add the CHANGELOG entry, and release the
   register grant. — blocked (specific blocker: the acceptance verdict is not
   clean. §5.15 failed because the post-merge graph refresh threw; that defect
   is repaired and archived as FID-2026-1017-011, commit `774eb705`. The
   unsafe-root flake (BLOCKER-1) remains unexplained, and a re-run of the live
   A–Z cycle is required before this record can claim acceptance.)

### Verification

The run's report
(`dev/test-prompts/archive/2026-10-17-parallel-worktrees-live-test-report.md`)
plus the merged lane proof (`docs/design/parallel-worktrees-lane-proof.md`)
and the stamp-time gate re-run are the acceptance evidence. No new `*.test.ts`
artifact is promised by this record: the eight existing suites and the probe
are re-executed live by the run (§4 rows) and re-run again by the receipt
stamp at closure. Acceptance is not claimed at this status: the first run's
§5.15 failed, its BLOCKER-2 repair (FID-2026-1017-011) landed after the run,
and the re-run that exercises the repaired merge path has not happened.

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: typecheck common
- gate: typecheck sdk
- gate: typecheck agents
- gate: test packages/agent-runtime/src/__tests__/fid-worktree-provision.test.ts
- gate: test packages/agent-runtime/src/__tests__/fid-worktree-dispose.test.ts
- gate: test packages/agent-runtime/src/__tests__/fid-worktree-merge.test.ts
- gate: test packages/agent-runtime/src/echo/__tests__/law2-worktree-jurisdiction.test.ts
- gate: test common/src/tools/__tests__/fid-worktree-params.test.ts
- gate: test sdk/src/__tests__/ripgrep.test.ts
- gate: test packages/agent-runtime/src/__tests__/fid-worktree-environment.test.ts
- gate: test packages/agent-runtime/src/__tests__/fid-worktree-tool.test.ts
- gate: probe scripts/probes/fid-worktrees.ts
- gate: probe scripts/scripts-typecheck-check.ts
- gate: quality

### Verification Receipt

Not yet stamped. Closure procedure: set status to `verified`, run
`bun run fid:verify dev/fids/FID-2026-1017-008-live-parallel-worktree-acceptance.md --write`,
then close and archive.

## Perfection Loop

### Loop 1 — RED

- **RED:** No live operational acceptance exists for the lane system; the
  register grant as previously written granted nothing (unparseable head);
  the run instrument did not exist.
- **GREEN:** This converged record + the A-Z instrument + a parseable
  register grant; the lane under test is this record itself.
- **AUDIT:** The instrument was designed against the production sources read
  end-to-end this session: the service entry (lock, refusals, rollback) at
  `packages/agent-runtime/src/echo/parallel/fid-worktree-service.ts:71-201`;
  the Law 2 gate at `packages/agent-runtime/src/echo/pre-write-gates-law2.ts:117-159`;
  the register grammar at `packages/agent-runtime/src/echo/scope-targets.ts:53-116`;
  jurisdiction at `packages/agent-runtime/src/echo/parallel/fid-worktree-jurisdiction.ts:68-107`;
  merge at `packages/agent-runtime/src/echo/parallel/fid-worktree-merge.ts:24-129`;
  environment at `packages/agent-runtime/src/echo/parallel/fid-worktree-environment.ts:17-110`;
  the CLI mirror at `scripts/worktree.ts:12-67`.
- **ADVERSARIAL:** A green A-Z run still proves nothing about throughput,
  schedulers or sandboxing; the report must not claim them. The declared
  suite matrix remains the code-level proof; the run is operational only.
- **CHANGE DELTA:** 100% (initial authoring).

### Missed Questions

1. Why must the lane vehicle be a converged FID? Create refuses otherwise
   (`fid-worktree-service.ts:118-123`); making this record converged and
   committed on `main` satisfies the check and gives the lane its register.
2. What if the register grant is mis-parsed? Verified mechanically with the
   gate's own parser module (`scope-targets.ts`) rather than by eye; the
   pre-run audit in Evidence records both the failure and the fix.
3. What if the in-harness terminal refuses `exec` or the lane commit (the
   mutating-terminal guard)? The instrument pins an operator fallback for
   every EXECUTABLE row (§1.5 of the prompt) so evidence is never lost.
4. What else must be operator-confirmed? Every mutation: create, commit,
   merge, both disposals, and the lock step — the prompt's ⌘ rows.
5. Could the run interfere with the receipt contract? No: the run does not
   touch FID files; closure is a separate session step after the evidence
   exists.

### Implementation Evidence (REQUIRED for `closed`)

- [ ] **Commit SHA:** filled at closure
- [ ] **File:line ranges:** filled at closure
- [ ] **Gate output:** stamped at closure
- [ ] **Reproducibility:** filled at closure
- [x] **Step statuses:** Step 1 implemented; Step 2 implemented (run executed,
  report preserved, lane proof merged as `3d24daf9`); Step 3 blocked on the
  operator re-run and the unexplained BLOCKER-1 (see Proposed Solution)

### Code Verification Evidence

No production code is changed by this record; the checks below run at closure
over the instrument and the register:

- [ ] Files referenced in Affected Components exist (closure)
- [ ] Instrument matches the production semantics it encodes (Loop 2 audit)
- [ ] Typecheck/tests/lint pass with pasted tool output (stamp)
- [ ] Production call-graph evidence: not applicable (no new wiring)
- [ ] FID status reflects the actual implementation state (closure)

### Loop 2 — Independent audit and self-correction

- **RED:** Instrument risks: hardcoded expected strings could drift from the
  sources; the lane write could be blocked if the register grant is wrong;
  the graph query could fail on quoting.
- **GREEN:** Every expected string in the instrument was quoted from a read of
  its source line (refusals from `fid-worktree-service.ts:80-115,173-178`,
  `fid-worktree.ts:135-141`, `fid-worktree-merge.ts:98-103`, the Law 2 gate
  reasons from `pre-write-gates-law2.ts:149-155` and
  `fid-worktree-jurisdiction.ts:77-82`); the environment stride expectations
  were derived from `fid-worktree-environment.ts:12-35` (base 3000 + 100 ×
  index); the graph query was written with single-quoted SQL inside a
  double-quoted `bun -e` payload and given an adapt-quoting instruction.
- **AUDIT:** The register-grant fix was tested with the production parser
  before commit (pattern set enumerated; covered/not-covered probe paths
  asserted).
- **ADVERSARIAL:** If the operator's session differs from the assumed shape
  (no `fid_worktree` tool visible, provider quirks), §2 preconditions STOP
  the run rather than improvising — the failure becomes evidence, not a
  corrupted test.
- **CHANGE DELTA:** Minor (instrument wording; register head fix).

### Loop 3 — Final convergence

- **RED:** Residual risk: operator-session execution details (model quirks,
  TUI-only rows).
- **GREEN:** All rows are agent-executable except three operator steps, each
  with explicit instructions; the report contract captures inconclusive rows
  honestly.
- **AUDIT:** The record converged; the run is the next action; closure is
  gated on the run's evidence.
- **ADVERSARIAL:** Accepted limit: a SKIP-marked operator row (§6.1) narrows
  coverage by design and must be recorded as such.
- **CHANGE DELTA:** Converged; no further edits before the run.

## Resolution

Not yet resolved. The A-Z run executed and its report and merged lane proof are
preserved, but its verdict was DEFECTS FOUND. The graph-refresh defect is
repaired (FID-2026-1017-011, `774eb705`); the `unsafe-root` flake remains
unexplained. The next step is an operator re-run of
`dev/test-prompts/az-parallel-worktrees-live-test.md` against the repaired tree;
closure follows only a clean run, with the receipt stamped and this record
archived.

## Lessons Learned

Acceptance instruments must encode refusal strings and expected JSON from a
read of the production sources, not from memory; and a register's
machine-readable grants live in its PARSEABLE heads — a "released" claim in
prose does not stop a stale head from granting writes (repaired this session,
FID-2026-1016-013's line).
