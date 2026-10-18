# FID: Live parallel-worktree acceptance - operator-driven A-Z live run

**Filename:** `FID-2026-1017-008-live-parallel-worktree-acceptance.md`
**ID:** FID-2026-1017-008
**Severity:** low
**Status:** closed
> **Current state (2026-10-18, run 4):** lifecycle demonstrated end-to-end;
> all 15 closure gates passed. Durable report:
> `dev/test-prompts/archive/2026-10-18-parallel-worktrees-live-test-report-run4.md`.
> Qualified acceptance and corrected accounting:
> `dev/test-prompts/archive/2026-10-18-parallel-worktrees-run4-closure-assessment.md`.
> Original report labels 43 PASS / one substituted SKIP, not its 34-PASS headline.
> The tracked-file dirty-state substitution was operator-elected; MD013 required
> repair commit `e0d29fb0` after merge `a99db5b8`, so the original one-commit
> constraint was unmet. This record accepts the demonstrated lifecycle with
> these deviations, not an unchanged-instrument perfect run. Historical notes
> below describe their original observation times and are superseded here.
> **Run state (2026-10-18, run 3):** the A–Z instrument was re-run a third time
> and again returned DEFECTS FOUND. Rows §3 and §4 passed (20 PASS, 0 FAIL);
> the live lifecycle ran through §5.11, where the **dirty-disposal refusal
> failed to fire** — the lane was clean because
> `docs/design/parallel-worktrees-lane-proof.md` is already tracked on `main`
> (commits `3d24daf9`, `01763f17`), so `dispose` legitimately succeeded. Two
> rows (§5.9a, §5.10) are **NEEDS-REVIEW** for the same reason: the covered
> write and the dirty-lane state cannot be observed when the target is already
> committed. Nine rows (§5.12–§5.17, §6.1) are NOT-RUN: the operator stopped
> the mutation sequence after the §5.11 disposal removed the lane. A further
> **BLOCKER-1** was a *concurrent* operator session mutating the shared main
> checkout mid-run (new FIDs `FID-2026-1018-002`/`FID-2026-1018-003`, `SCOPE.md`
> register additions, CLI render changes), which alone makes §5.13's
> both-checkouts-clean merge gate unreachable. The lane system behaved
> correctly for everything it was allowed to do; the defects are in the
> **instrument's preconditions**, not the lifecycle. Run 3's report is
> preserved at
> `dev/test-prompts/archive/2026-10-18-parallel-worktrees-live-test-report-run3.md`.
> `converged` is retained because the lane vehicle's `create` requires exactly
> one active converged FID. This record claims no acceptance until a clean run.
>
> **Run state (2026-10-17, run 2):** the A–Z instrument was re-run and again
> returned DEFECTS FOUND. Rows §3 and §4 passed (13 PASS, 0 FAIL); §5.1 onward
> was unreachable because every `fid_worktree` call was refused before dispatch
> with `the arguments failed the tool schema at: action — invalid_union`. Root
> cause is FID-2026-1017-014: the tool's root parameter schema was a
> `discriminatedUnion`, which serializes to `{ oneOf }` with no top-level
> `type: 'object'` and no `properties`, so the provider advertised no fields.
> That is now repaired and proven at the provider boundary; the lifecycle has
> still not been exercised live. `converged` is retained because the lane
> vehicle's `create` requires exactly one active converged FID. This record
> claims no acceptance until a clean run.
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

2026-10-18 live run 3 (report archived at
`dev/test-prompts/archive/2026-10-18-parallel-worktrees-live-test-report-run3.md`):
20 PASS, 1 FAIL (§5.11 — the dirty-disposal refusal did not fire because the
lane was clean), 4 OPERATOR-CONFIRMED, 2 NEEDS-REVIEW (§5.9a, §5.10 — the
lane-proof target is already tracked on `main`, so the covered write and the
dirty-lane state are unobservable), 0 SKIP, 9 NOT-RUN (§5.12–§5.17, §6.1 —
operator stopped after §5.11 disposed the lane). Instrument-level defects
recorded: (a) §5.9a/§5.10 assume the proof file is untracked; (b) §5.11
assumes a dirty lane; (c) §2's clean-tree precondition is checked only at
start. BLOCKER-1 is *live interference*, not a code defect: a concurrent
operator session mutated the shared main checkout mid-run (new FIDs
`FID-2026-1018-002`/`FID-2026-1018-003` and CLI render changes appeared at
15:16, two minutes after the lane was created at 15:14), which makes §5.13's
both-checkouts-clean merge gate impossible and §5.19's clean-final-checkout
unverifiable. §5.8b needed a retry under `MSYS_NO_PATHCONV=1` because Git Bash
rewrote the probe's `/KEY|TOKEN|SECRET/i` regex into a `C:/Program Files/Git/...`
path. §5.5c observed the managed dependency links as Git Bash symlinks rather
than NTFS junctions (targets correct). The §4 gate matrix passed unchanged
(53 tests + 2 root gates, all exit 0).

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
   register grant. — implementation complete on run-4 evidence, with fresh
   receipt stamped and archive ceremony complete. Graph refresh passed on the first
   attempt; covered tracked-file substitution and repaired MD013 failure are
   recorded in the closure assessment. Historical unsafe-root root cause is
   unconfirmed; it did not recur here.

### Verification

The durable run-4 report and companion closure assessment above, merged proof
`docs/design/parallel-worktrees-lane-proof-mve8j1nl-fa0f6aaf.md`, commits
`a99db5b8` / `e0d29fb0` and stamp-time gates are the current acceptance evidence.
Earlier reports remain historical failures. No new test artifact is promised
by this record; the eight declared existing suites and probe are rerun at
closure. Live limits remain explicit in the assessment; unit tests do not
become live evidence by association.

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

- fingerprint: sha256:4a9c8862f9e2ca1470fbde9d080bf87c6f9b96c489087edc9b06ad7a8d585d62
- verified: 2026-10-18T20:33:09.666Z
- typecheck packages/agent-runtime: exit 0
- typecheck common: exit 0
- typecheck sdk: exit 0
- typecheck agents: exit 0
- test packages/agent-runtime/src/__tests__/fid-worktree-provision.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/fid-worktree-dispose.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/fid-worktree-merge.test.ts: exit 0
- test packages/agent-runtime/src/echo/__tests__/law2-worktree-jurisdiction.test.ts: exit 0
- test common/src/tools/__tests__/fid-worktree-params.test.ts: exit 0
- test sdk/src/__tests__/ripgrep.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/fid-worktree-environment.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/fid-worktree-tool.test.ts: exit 0
- probe scripts/probes/fid-worktrees.ts: exit 0
- probe scripts/scripts-typecheck-check.ts: exit 0
- quality: exit 0

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

- [x] **Commit SHA:** lane/merge `a99db5b8`, proof-format repair `e0d29fb0`.
- [x] **File:line ranges:** run-unique proof lines 1–7; durable report §5–§9.
- [x] **Gate output:** 15/15 declared gates passed; stamped receipt above.
- [x] **Reproducibility:** exact proof and graph row exist; commit diffs each
  name only that proof. Graph query returned its exact path at closure.
- [x] **Step statuses:** delivery and live execution implemented; durable
  evidence committed in `72aefe15`; all three steps implemented and archived.

### Code Verification Evidence

No production code is changed by this record; the checks below run at closure
over the instrument and the register:

- [x] Files referenced in Affected Components exist (closure)
- [x] Instrument output checks and covered discard setup repaired by FID-005
- [x] Typecheck/tests/probes/quality pass (15/15 stamped receipt); Markdown lint exit 0
- [x] Production call-graph evidence: not applicable (no new wiring)
- [x] FID status reflects implemented acceptance artifacts awaiting stamp

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

### Current run-4 disposition

Operational lifecycle accepted with the documented tracked-file substitution,
repaired MD013 artifact and second-commit deviation. Report promoted durably;
fresh receipt stamped, record archived and scope grant released. No fifth live run or new
paid inference is required for this closure. The original report's 43 PASS
labels / one substituted SKIP are reconciled separately; its headline counts
and §5.19 label are not endorsed as unchanged-instrument conformance.

Prep stash SHA `d5846b96bf2ab8ec2f0fdc8ffa06d7063acbfe2b` remains present.
Retained branch remains at `a99db5b8`; no lane is registered. Main graph has
exactly the run-unique proof path. No external path was mutated here.
Instrument findings belong to FID-2026-1018-005; lock advisory to FID-006.
Live coverage limits and historical unknowns remain in the assessment.

- **Closed Date:** 2026-10-18
- **Commit SHA:** a99db5b8, e0d29fb0; durable evidence and instrument `72aefe15`.
- **Fix Description:** Qualified live operational acceptance, not a claim that
  every original instrument constraint passed unchanged.
- **Tests Added:** None by this acceptance record; existing eight suites rerun.
- **Verification Evidence:** All 15 declared gates exit 0; actual proof and
  exact graph row verified; original failures and substitutions preserved.
- **Archived:** 2026-10-18

### Historical resolution notes (runs 1–3)

Not yet resolved. Three A-Z runs have executed and all returned DEFECTS FOUND;
their reports are preserved. Repaired so far: the graph-refresh defect
(FID-2026-1017-011, `774eb705`), the root-guard retry and instrument drift
(FID-2026-1017-012, `4f989510`), and the unreachable `fid_worktree` tool schema
(FID-2026-1017-014). The `unsafe-root` flake remains unexplained.

Run 2's report is preserved at
`dev/test-prompts/archive/2026-10-17-parallel-worktrees-live-test-report-run2.md`;
its BLOCKER is the
schema refusal, now fixed and pinned by
`common/src/tools/__tests__/tool-schema-object-root.test.ts`. The next step is a
fourth operator run of the corrected `dev/test-prompts/az-parallel-worktrees-live-test.md`
against the repaired tree; closure follows only a clean run, with the receipt
stamped and this record archived.

Run 2's two instrument-level divergences are corrected in the instrument: §2
now requires the tool's advertised parameter schema (and names the
`analyzeOnly`/`planOnly` exclusion), so a session that cannot call the tool
fails before any mutation; §5.6 attributes `fid-in-use` to
`provisionFidWorktree` rather than to the service's reason list.

**Run 3 (2026-10-18)** exercised the repaired tree live and cleared the run-2
blocker: every `fid_worktree` call reached the service and returned the
expected shape — `list`/\(create\)/`not-converged`/`fid-in-use`/schema-refusal
all matched their declared strings, lane provisioning recorded the correct
base, branch, index, six dependency links and graph snapshot, `exec` reported
`index 1` / `port 3100` / `compose savant_wt1` / `secretVars 0`, and the Law 2
gate blocked both uncovered writes with the expected wording. It did not reach
a clean verdict, for three **instrument** reasons and one **environment**
reason now on record:

1. **§5.9a/§5.10 unfalsifiable.** `docs/design/parallel-worktrees-lane-proof.md`
   is already tracked on `main` (from runs 1–2), so the lane starts with the
   file present and clean; a fresh covered write is indistinguishable and the
   `?? …` dirty state cannot appear. Fix: use a run-unique proof filename.
2. **§5.11 assumed dirtiness.** With a clean lane, `dispose` correctly
   removed it (no `dirty` refusal). The refusal path needs a genuine
   uncommitted change first.
3. **§2 is a start-only check.** The instrument validates a clean tree once and
   never re-checks it before §5.13. It should re-assert cleanliness on both
   checkouts immediately before the merge row.
4. **BLOCKER-1 (environment).** A concurrent operator session mutated the
   shared main checkout during the run, which is fatal to §5.13/§5.19 by
   construction. The instrument should require a quiescent checkout.

Consequently §5.12–§5.17 and §6.1 remain unproven and this record still claims
no acceptance. The next step is a fourth run of
`dev/test-prompts/az-parallel-worktrees-live-test.md` with the four instrument
preconditions above corrected and no concurrent writer in the checkout.

## Lessons Learned

### Run-4 preparation (FID-2026-1018-004)

The repaired instrument records a run stamp and an absent run-unique proof
path, whose register glob is `docs/design/parallel-worktrees-lane-proof-*.md`.
It requires exact untracked/dirty:true evidence before either refusal test,
both checkout statuses and refs immediately before merge, and operator-confirmed
exclusive main access throughout. Graph lookup matches the new proof exactly.
New scratch reports live under `dev/scratchpad/active/` rather than its root.

The retained branch and prep stash are preserved. Because main advanced after
run 3, run 4 preflight must check the retained branch tip equals start HEAD;
an operator may first approve a normal fast-forward when ancestry proves it
safe. No branch/stash mutation is performed by the instrument-repair session.
Original run-3 findings and verdict remain unchanged. At that preparation
point a fourth run had not run; the current run-4 disposition supersedes it.

Acceptance instruments must encode refusal strings and expected JSON from a
read of the production sources, not from memory; and a register's
machine-readable grants live in its PARSEABLE heads — a "released" claim in
prose does not stop a stale head from granting writes (repaired this session,
FID-2026-1016-013's line).
