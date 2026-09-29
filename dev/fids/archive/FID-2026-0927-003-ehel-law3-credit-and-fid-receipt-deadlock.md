# FID-2026-0927-003: EHEL Law 3 Credit + FID Receipt Deadlock

**Filename:** `FID-2026-0927-003-ehel-law3-credit-and-fid-receipt-deadlock.md`
**ID:** FID-2026-0927-003
**Severity:** critical
**Status:** closed
**Created:** 2026-09-27 17:20
**Closed:** 2026-09-28
**Automation level:** 3
> **Status corrected 2026-09-27: `analyzed` → `fixed`.** Steps 1 and 2 are
> implemented, audited, and mutation-proven. Step 3 is implemented at the
> repository gate but carries an OPEN RESIDUAL (the write boundary still treats
> a stale receipt as fatal) — recorded under *Open Remediation*, not hidden.
> Step 4 is satisfied by this document. `fixed` is therefore the honest status:
> the critical soundness hole is closed, and the remainder is named.
>
> **Closed 2026-09-28 by operator ruling.** Asked to decide F3's residual
> (run the declared gates at write time, or accept the narrower
> repository-only demotion), the operator ruled: *"T90-F3 residual needs no
> code."* The repository-only demotion is accepted as final: the write
> boundary stays fatal by design (it cannot run the C3 live re-run at write
> time, and trading that for a weaker write-time guarantee is a design
> decision the operator declines to make). The residual is documented under
> *Open Remediation* as accepted, not outstanding.

## Summary

Two EHEL Law 3 findings and one receipt-mechanics finding converge on a single
root cause, plus two corrections that close out hypotheses which were wrong.

- **F1 (critical, soundness).** Law 3 credit is granted on a **red** test. The
  credit predicate is *shape-aware* (`hasToolResultError` looks for structured
  `errorMessage` / `error` / `errorCode` fields), not *outcome-aware*. A failing
  `bun test` returns plain text (`1 fail`), so the predicate computes
  `commandSucceeded === true` and every dirty file is credited as verified. For
  the most common failure mode in this repo, the Law 3 safety gate silently does
  nothing.
- **F2 (high, liveness).** When a verification run *is* recognized as failed,
  credit is withheld silently, the file stays unverified, and the only remedy —
  edit the file whose test is red — is blocked. `pre-write-gates-law3.ts`
  cannot distinguish "the test is wrong, fix it" from "the code is wrong, do not
  edit the test to hide it", so the legitimate case is unrecoverable inside the
  gate. The bypass actually used (`rm` the file via a basher, then recreate) is
  available to anyone and defeats the gate entirely.
- **F3 (high).** `fid-verification-gates.ts:219-224` invalidates a FID's
  verification receipt on **any** edit outside the receipt, while
  `scripts/fid-verify.ts` refuses to stamp a receipt while any declared gate is
  red. The natural workflow (implement → verify → then document) therefore
  invalidates its own receipt as the last act, and a FID with a red declared gate
  can never be stamped and so can never reach `fixed` at all.
- **F4 / F5 (corrections, not defects).** "Incomplete arguments for tool X" is
  **not** a `str_replace` serialization bug, and the `git mv` staged-index-blob
  report is **not** an EHEL defect. Both are recorded as rejected hypotheses so
  they are not re-investigated.

F1 is the reason this FID is `critical`: it is a soundness hole in a safety gate,
not a usability problem. The gate is wrong in **both** directions at once.

## Environment

- **OS / shell:** Windows 10 (`win32`), Git Bash (MSYS) — POSIX syntax, forward-slash paths.
- **Runtime / package manager:** Bun `1.3.14` (pinned in `.bun-version`).
- **Project:** `savant-code` — TypeScript monorepo, `strict: true`.
- **Workspaces in scope:** `packages/agent-runtime` (EHEL enforcement layer),
  `sdk` (native tool-call error normalization), `scripts` (FID verification).
- **Governance:** ECHO Protocol v0.2.0 (`ECHO.md`), 10-agent roster, Perfection
  Loop FSM, FID lifecycle. EHEL is the enforcement layer that realizes Law 3
  ("Verify Before Proceed").
- **Session artifacts:** `dev/scratchpad/active/ehel-deadlock-probe.ts` (the probe
  that produced the F1/F2 verdicts below).

## Detailed Description

### F1 — Law 3 credits a red test as verified (soundness, critical)

Grounded call chain, all paths relative to `packages/agent-runtime/src`:

1. `tools/tool-executor/result-lifecycle.ts:168` computes
   `commandSucceeded = !hasToolResultError(toolResult.content)`.
2. `tools/tool-executor/tool-result-errors.ts:6` — `hasToolResultError`
   recognizes **only structured fields**: `errorMessage`, `error`, `errorCode`,
   and only on *object* content parts.
3. A failing `bun test` emits **plain text** (`1 fail`, a non-zero exit, no
   structured error field). `hasToolResultError` returns `false`, therefore
   `commandSucceeded` computes **`true`**.
4. `tools/tool-executor/tool-pipeline.ts:216-218` grants Law 3 credit for every
   entry in `dirtyFiles` on the strength of that `true`.

Empirical proof, from probe `dev/scratchpad/active/ehel-deadlock-probe.ts`:

```text
PROBE A — red test, plain text: commandSucceeded computed: true;
credit granted: true; re-edit blocked: false;
VERDICT: CREDIT GRANTED ON A RED TEST — soundness hole
```

The safety property Law 3 exists to provide — *do not proceed past an unverified
edit* — is not merely weakened, it is **inverted** for the dominant failure mode:
a red suite produces a green gate. Because the failure is silent, no audit report
is generated, which is why this went unreported while F2 (the loud, blocking
sibling) generated reports continuously.

### F2 — Law 3 deadlocks on a red suite (liveness, high)

Same probe:

```text
PROBE B — red run, structured error: re-edit blocked: true … DEADLOCK
```

`tools/../echo/pre-write-gates-law3.ts` hard-blocks a write to any file that is
in `dirtyFiles` and absent from `verifiedFiles`. When a verification run *is*
recognized as failed (`commandSucceeded === false`,
`tools/tool-executor/tool-pipeline.ts:216-230`), the credit is withheld
**silently** — no message attributes the failure to any file — the file remains
unverified, and the gate then refuses the one action that could resolve the
failure.

The gate has no notion of **failure attribution**. A red test names a subject
under test; the only legal repair is editing that subject. But the gate's rule is
uniform: *dirty and unverified ⇒ unwritable*. It cannot express the distinction
that matters:

| Situation | Correct action | Gate's answer |
|---|---|---|
| The test is wrong / the API changed | edit the file | **blocked** (F2) |
| The code is wrong | do not edit the test to hide it | blocked (correct) |

The legitimate case is therefore unrecoverable **inside** the gate. Recovery
requires escaping the gate, and the escape is trivially available: the file was
removed via a basher `rm` and recreated, which the enforcement layer never sees
because `resetForNewTurn` clears only in-memory sets. So the gate is not merely
annoying — it is *advisory in the one case it should be binding*, because the
bypass costs one `rm`.

F1 and F2 are two symptoms of the same root: the credit/verdict representation
carries no **outcome** (exit status) and no **attribution** (which file failed),
so the gate can only respond uniformly, and the uniform response is wrong
whenever the shape or the attribution diverges from the common case.

### F3 — FID receipt self-invalidation loop (high)

Two independent rules compose into a loop that has no exit for a normal workflow:

- `packages/agent-runtime/src/echo/fid-verification-gates.ts:219-224` requires
  a `### Verification Receipt` block whose `fingerprint: sha256:` matches
  `computeFidFingerprint(content)`, else
  `"stale verification receipt (fingerprint mismatch — FID edited after
  verification; re-run bun run fid:verify <fid> --write)"`.
- `scripts/fid-verify.ts` `main()` refuses to stamp when any declared gate is
  red (`"receipt NOT stamped"`, returns `1`).

Consequences:

1. **Self-invalidation.** Once a FID is `fixed`, *any* documentation edit outside
   the receipt invalidates it. The natural workflow — implement, verify, and
   *then* record the findings — therefore always invalidates its own receipt as
   the final act, forcing a full re-run of every declared gate to change one
   sentence of prose.
2. **Unreachable status.** A FID whose declared gate is red can never be stamped,
   so it can never reach `fixed` — the receipt it needs cannot be produced by the
   only tool that produces receipts.

**Key mitigating fact (must travel with this finding).**
`scripts/fid-gates.ts:107-113` — gate **C3 already re-runs every declared gate
LIVE against the current tree on every `validate:repository`.** The live re-run,
*not* the fingerprint, is the substantive enforcement of a FID's declared gates.
The fingerprint is a *staleness tripwire* whose cost (a hard failure on any prose
edit) is disproportionate to its marginal value over a re-run that already
happens anyway.

### F4 — "Incomplete arguments for tool X" is NOT a serialization bug (correction)

Recorded as a **rejected hypothesis** so it is not re-investigated.

- Both the reporting agent and this session's orchestrator independently assumed
  a `str_replace` argument-serialization defect. **Both assumptions are wrong.**
- The string is emitted at `sdk/src/impl/llm/errors.ts:102`, inside
  `normalizeNativeToolCallStreamError`. It is a **native LLM tool-call** error:
  the model emitted a tool call whose arguments were incomplete at the provider
  **stream** level.
- It is **not `str_replace`-specific.** `dev/experiences/raw-traces.jsonl` records
  the same error for `write_file` (2026-09-16), `spawn_agents` (2026-09-17),
  `run_readonly_command` (2026-09-13 and 2026-09-17), `suggest_followups`
  (2026-09-13 and 2026-09-14), and `sequentialthinking`.
- `errors.ts:99-101` already has a **distinct** branch for
  `finishReason === 'length'` (output-token cap) that steers to "split the work
  into smaller calls". The message observed is the **other** branch: incomplete
  arguments **without** a length finish reason.
- **Verdict:** not a harness code defect, not a tool-schema defect. The remedy is
  a smaller payload and/or a retry — which is exactly why `apply_patch`
  (single-operation schema) succeeded where a multi-replacement `str_replace`
  payload did not.

### F5 — The `git mv` staged-index-blob report is NOT an EHEL defect (correction)

- `enforcement-state.ts:44-52` `resetForNewTurn` clears `dirtyFiles` and
  `verifiedFiles`. Both are **in-memory `Set`s** with zero git involvement.
- EHEL **cannot** read the git index, because it never invokes git.
- The observed behaviour is plain `git mv` semantics: `git mv` stages the index
  entry and leaves unstaged worktree edits behind.
- The basher's refusal to report a clean tree was **correct instinct**; the
  cause is git, not the harness.

## Root Cause

A **single representational root cause with three expressions**: the Law 3
pipeline reduces a verification run to a *shape* predicate
(`hasToolResultError` on structured fields) instead of an *outcome* predicate
(exit status), and carries no *attribution* (which file failed). Everything
downstream is then forced to respond uniformly:

- F1 — the shape predicate misses plain-text failures, so credit is granted on a
  red suite (**soundness**).
- F2 — lacking attribution, the gate cannot exempt the files named in a failure
  output, so it blocks the only legal repair (**liveness**).
- F3 — a *staleness* tripwire (content fingerprint) enforces a property already
  enforced by a *live* re-run (C3), so the tripwire's cost is paid in ordinary
  prose edits while its marginal value over C3 approaches zero.

F4 and F5 are the same class of error one level up: **hypotheses formed by
similarity and re-derivation** rather than by reading the emitting code path
(`errors.ts:102`; `enforcement-state.ts:44-52`). Both were expensive and both
were refutable in one read.

## Impact Assessment

| Finding | Class | Impact | Detection |
|---|---|---|---|
| F1 | Soundness (critical) | Law 3 credit granted on a red `bun test`; the safety gate is inverted for the most common failure mode | **Silent** — no error, no audit record; found by direct probe, not by any reported symptom |
| F2 | Liveness (high) | Legitimate fixes to a red suite are blocked; recovery requires escaping the gate via `rm` + recreate, which defeats it entirely | Loud, continuous, repeatedly reported |
| F3 | Workflow (high) | "Implement → verify → document" always invalidates its own receipt; a FID with a red declared gate can never reach `fixed` | Loud, at the moment of filing the FID |
| F4 | Non-defect | None — a rejected hypothesis; recorded to stop re-investigation | — |
| F5 | Non-defect | None — a rejected hypothesis; recorded to stop re-investigation | — |

**Blast radius.** F1 and F2 are in `packages/agent-runtime`'s EHEL layer, so
they affect **every** agent run that edits a file and runs a verification
command — i.e. the core of the protocol, not an edge feature. F1 is the more
damaging of the two precisely because it is silent: a gate that is wrong in the
permissive direction produces no evidence of its own failure, so the only
detection path is the kind of direct probe used here.

**Severity rationale (`critical`).** F1 is a soundness hole in a safety gate. A
safety gate that can be passed by the exact event it exists to detect is not
degraded — it is absent, while still reporting success.

## Proposed Solution

1. **F1 — make Law 3 credit outcome-aware rather than shape-aware.** The
   terminal / readonly command handlers must surface the **process exit status**
   as a structured field, and the credit path must require `exit === 0`.
   `hasToolResultError` may remain as a *supplementary* signal (it is the only
   signal for infrastructure-level failures), but it must no longer be the
   *primary* one. Explicitly: **do not loosen the gate** to resolve F2's
   blocking behaviour; the soundness fix and the liveness fix are independent and
   must land as independent changes.
2. **F2 — layered escape, preserving the anti-masking property.**
   - **(a) Primary — failure-attributed exemption.** When a verification run is
     red, allow re-editing **exactly** the files named in its failure output, and
     only those files. The anti-masking property is preserved: editing a *test*
     to hide a failure in a *different* file stays blocked; editing the subject
     the failure names is legal.
   - **(b) Fallback — the existing `self_correct` phase.** Any dirty-unverified
     file becomes writable when attribution cannot be determined, since the
     self-correct phase is already the protocol's sanctioned escape hatch and is
     recorded rather than silent.
3. **F3 — demote a stale receipt from error to warning WHEN every declared gate
   passes the C3 live re-run.** Keep it a hard error when any declared gate is
   red. Rationale: the live re-run (`fid-gates.ts:107-113`) is the substantive
   enforcement, so this removes the doc-edit loop **without** weakening the
   invariant that declared gates must pass. The receipt stops being the
   enforcement mechanism and becomes what it actually is — a staleness signal.
4. **F4 / F5 — no code change.** Record both as rejected hypotheses (this
   section is the record) so neither is re-investigated. If a future session hits
   "incomplete arguments", the remedy is a smaller payload or a retry, not a
   harness fix.

**Sequencing.** Step 1 (F1) is independent and should land first: it removes the
soundness hole without touching liveness, so it is safe to ship alone. Step 2
(F2) depends on step 1 landing first, so that the exemption is never widening a
gate that already passes red runs. Step 3 (F3) is independent of both and can
land in parallel.

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: test packages/agent-runtime/src/echo/__tests__/law3-failure-attribution.test.ts
- gate: test packages/agent-runtime/src/echo/__tests__/law3-fsmphase-reachability.test.ts
- gate: test packages/agent-runtime/src/tools/tool-executor/command-outcome.test.ts
- gate: test packages/agent-runtime/src/echo/__tests__/pre-write-gates-law3.test.ts
- gate: test scripts/__tests__/fid-gates.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:c065795377e5222eff5078c5fbf546a5e7fb02f95be46dacfb3c4e18f57309ea
- verified: 2026-09-28T22:23:03.223Z
- typecheck packages/agent-runtime: exit 0
- test packages/agent-runtime/src/echo/__tests__/law3-failure-attribution.test.ts: exit 0
- test packages/agent-runtime/src/echo/__tests__/law3-fsmphase-reachability.test.ts: exit 0
- test packages/agent-runtime/src/tools/tool-executor/command-outcome.test.ts: exit 0
- test packages/agent-runtime/src/echo/__tests__/pre-write-gates-law3.test.ts: exit 0
- test scripts/__tests__/fid-gates.test.ts: exit 0
- quality: exit 0

## Step Status

Step Status is recorded for the Anti-Deferral Gate (FID-2026-0817-005).
Steps 1, 2 and 4 are complete. **Step 3 is deliberately left open** — the
repository-gate half shipped and is mutation-proven, but the write boundary
still treats a stale receipt as fatal, so the doc-edit loop F3 set out to kill
survives at that boundary. The operator directed on 2026-09-27 to keep step 3
open for exactly this reason. It is marked partial rather than complete because
the record's own standard is that a step is done when it is done, not when its
main part is.

Authoring steps (complete):

- [x] Identify the Law 3 credit predicate and its failure shape — `result-lifecycle.ts:168`, `tool-result-errors.ts:6`
- [x] Prove F1 (credit on a red test) by direct probe — `dev/scratchpad/active/ehel-deadlock-probe.ts`, PROBE A
- [x] Prove F2 (deadlock on a red suite) by direct probe — same probe, PROBE B
- [x] Trace the F3 receipt rule and the stamping rule to their interaction — `fid-verification-gates.ts:219-224`, `scripts/fid-verify.ts`
- [x] Establish the C3 live re-run mitigating fact — `scripts/fid-gates.ts:107-113`
- [x] Refute the `str_replace` serialization hypothesis — `sdk/src/impl/llm/errors.ts:99-102` + `dev/experiences/raw-traces.jsonl`
- [x] Refute the "EHEL reads the git index" hypothesis — `enforcement-state.ts:44-52`
- [x] Decide the fix direction for F1/F2/F3 and record rejected hypotheses for F4/F5

Remediation steps:

- [x] Proposed Solution step 1 — **F1 outcome-aware Law 3 credit.** IMPLEMENTED
      and audited. `hasCommandFailure` in
      `tools/tool-executor/tool-result-errors.ts` reads the `exitCode` already
      present in the payload, wired at `result-lifecycle.ts:176` and
      `custom-result.ts:134`. `writeSucceeded` deliberately keeps the
      shape-aware predicate. 11 RED-first legs in
      `tools/tool-executor/command-outcome.test.ts`, including a contrast leg
      that pins the old defect (`hasToolResultError(redRun) === false`) so it
      cannot be silently re-introduced.
- [x] Proposed Solution step 2 — **F2 failure-attributed exemption +
      `self_correct` fallback.** IMPLEMENTED and audited. New
      `verification-failure-paths.ts` attributes a red run to the files it names;
      `EnforcementState.failureAttributedFiles` carries that set;
      `pre-write-gates-law3.ts` permits the named file and still blocks every
      other dirty-unverified file (the anti-masking leg). 13 legs in
      `law3-failure-attribution.test.ts`. Five audit findings fixed — see
      *Adversarial findings fixed* below.
- [x] Proposed Solution step 3 — **F3 stale-receipt demotion.** PARTIAL
      implementation, RESOLVED by operator ruling 2026-09-28 ("T90-F3
      residual needs no code"). The repository-gate half is IMPLEMENTED:
      C1+C2 in `scripts/fid-gates.ts` collects structural errors and
      classifies them AFTER C3 runs, and a stale receipt whose declared gates
      all pass the live re-run is demoted to a non-fatal `severity:
      'warning'` (mutation-proven end-to-end on a real `fixed` FID,
      `REAL_EXIT=0`, byte-identical restore). The write-boundary half
      (`pre-write-gates-fid.ts:105`, `scripts/fid-check.ts:40` staying
      fatal) is accepted as final by the ruling — the write path cannot run
      the C3 live re-run, and the operator declines the weaker write-time
      guarantee. See *Open Remediation* for the accepted-behavior record.
- [x] Proposed Solution step 4 — **F4/F5 corrections.** No code change
      required; this record IS the record. Both hypotheses are recorded as
      rejected above with the refuting evidence.

## Perfection Loop

### Missed Questions

1. **Can F1 be closed by making the gate stricter, without F2's exemption?**
   No. Tightening the credit predicate without an attribution-based escape
   converts F1's soundness hole into a strictly worse liveness wall. The two
   changes must land together, and in the order given: outcome-awareness first,
   exemption second, so the exemption is never widening a gate that already
   passes red runs.
2. **Does the F1 fix regress infrastructure-error detection?** No, provided
   `hasToolResultError` is retained as a supplementary signal. A missing git
   binary or a rejected command produces a structured error and must still
   withhold credit. This is the reason step 1 is additive rather than a
   replacement, and it is a test obligation, not an assumption.
3. **Is the F3 demotion a weakening of tamper-evidence?** It is a narrowing of
   the *tripwire*, not of the *guarantee*: gate outcomes are re-derived live by
   C3 on every `validate:repository`, so "the declared gates pass" is never
   taken on the receipt's word. What is given up is only "the document has not
   been edited since it was last attested" — a property with no bearing on
   whether the code is correct. Recorded explicitly so the tradeoff is visible
   rather than inherited silently.
4. **Should the F2 exemption cover non-test files?** No. Attribution is read
   from the failing run's own output, so whatever it names is what may be
   edited. A policy that widened this to "any code file when tests are red"
   would reintroduce exactly the masking vector the block exists to prevent.
5. **Could the F2 exemption be abused to weaken a test to make it pass?** That
   is the anti-masking case, and it remains blocked whenever the failure names a
   different file. The residual risk — editing the named test to assert less —
   is inherent to any TDD loop where the agent writes its own tests, and is
   bounded by the operator reviewing the diff, not by this gate.

### Code Verification Evidence

- [x] Files referenced in Affected Components exist — verified at authoring:
      `pre-write-gates-law3.ts`, `result-lifecycle.ts`, `tool-result-errors.ts`,
      `tool-pipeline.ts`, `enforcement-state.ts`, `fid-verification-gates.ts`,
      `scripts/fid-verify.ts`, `scripts/fid-gates.ts`, `sdk/src/impl/llm/errors.ts`
- [x] Implementation matches the Proposed Solution — steps 1, 2 and 4 in full;
      step 3 in part, with the remainder named under *Open Remediation*
- [x] Typecheck/tests/lint pass — `bun run --cwd=packages/agent-runtime
- [x] Production call-graph evidence for the wiring audited: the credit path is
      `result-lifecycle.ts:168` → `tool-pipeline.ts:216-230` →
      `state.verifiedFiles`; the blocking path is `tool-pipeline.ts` (write
      tracking, `:172`) → `pre-write-gates-law3.ts` (`runLaw3Gate`, invoked from
      `tool-pipeline.ts` `beforeToolCallImpl`); both are reached from the
      agent-runtime tool executor, so the defect is on the live path for every
      write, not in dead code
- [x] Status reflects reality: `fixed` with the residual named. The earlier
      `converged` = "no implementation written" line was true at authoring and
      was corrected rather than left describing a pre-implementation state.
- **RED:** complete. Named failures captured before any source change, with the
  probe output reproduced inline in F1/F2 above (PROBE A `credit granted: true`;
  PROBE B `re-edit blocked: true`). The F3 conflict is a RED in the documentary
  sense: the two rules are individually defensible and jointly unsatisfiable for
  the normal workflow.
- **GREEN:** complete for steps 1, 2 and 4; part for step 3. Source modified:
  `tool-result-errors.ts`, `result-lifecycle.ts`, `custom-result.ts`,
  `verification-failure-paths.ts` (new), `pre-write-gates-law3.ts`,
  `pre-write-gates.ts`, `types.ts`, `enforcement-state.ts`, `enforcement.ts`,
  `enforcement/tool-pipeline.ts`, `ehel-gate.ts`, `custom.ts`, `fid-gates.ts`,
  `fid-ledger-types.ts`, `validate-repository.ts`, plus three test files.
- **AUDIT:** complete, by independent Verifier — not self-report. Five findings
  were returned, **all confirmed on disk and all fixed**; see *Adversarial
  findings fixed*. A prior Verifier pass had also produced two FAILs against a
  stale snapshot (citing a "4 failures" count and a `CLI_EXIT=0` line that do
  not exist in this file), which is why every finding was re-verified directly
  before being accepted or rejected.
- **SELF-CORRECT:** complete. The three points anticipated at implementation
  time all materialised and were each fixed: (a) `hasToolResultError` retained
  as the supplementary infrastructure-error signal, with a test; (b) the
  anti-masking case is pinned by a test asserting `blocked === true`; (c) the
  hard error for a red declared gate is pinned by its own test. A fourth,
  unplanned finding — a **vacuous** fail-closed test that would have passed with
  the demotion deleted outright — was caught by the same audit and rewritten.
- **COMPLETE:** reached for the critical soundness hole (F1) and the deadlock
  (F2). NOT reached for step 3, which remains open by operator direction; that
  residual is why this record is `fixed` and not `closed`.

## Resolution

- **Resolved by:** this record, for steps 1, 2 and 4. Step 3 partially, with
  the remainder named below rather than folded into the claim.
- **Resolution date:** 2026-09-27
- **Verified by:** independent Verifier audit (not self-report), plus
  tool-mediated runs of every gate quoted in *Code Verification Evidence*.
- **Verification date:** 2026-09-27
- **Verification receipt:** see `## Verification Receipt` below.
- **Closed by:** operator ruling 2026-09-28 — *"T90-F3 residual needs no
  code."* The step-3 residual (write-boundary staleness staying fatal) is
  accepted as final repository behavior, not deferred work. Closure commit
  hash pending (G2) — to be recorded at push.
- **Close date:** 2026-09-28
- **Archived:** yes — moved to `dev/fids/archive/` on close.
- **CHANGELOG entry:** yes — under 0.0.34 (written at closure).

## Open Remediation (step 3 residual — ACCEPTED AS FINAL 2026-09-28)

**Operator ruling, 2026-09-28:** asked to choose between running the
declared gates at write time or accepting the narrower repository-only
demotion, the operator ruled *"T90-F3 residual needs no code."* The
repository-only demotion is the final disposition: the two write-boundary
consumers below stay fatal **by design**, and this section records accepted
behavior rather than outstanding work.

The repository gate now demotes a stale receipt to a warning when every
declared gate passes the C3 live re-run. **Two other consumers of
`validateFidVerification` still treat staleness as fatal:**

| Consumer | Line | Still fatal? |
|---|---|---|
| `scripts/fid-check.ts` (`fid:verify --check`) | `:40` | yes |
| `packages/agent-runtime/src/echo/pre-write-gates-fid.ts` (write tripwire) | `:105` | yes |

The write tripwire is the consequential one: it blocks **any** write to a FID
declaring `fixed`/`verified` whose proposed content has a stale receipt. So the
doc-edit loop F3 set out to kill is **halved, not closed** — the repository gate
no longer blocks it, but the write boundary does.

**Not fixed here, deliberately.** Demoting at the write boundary requires the
C3 live re-run to be available *at write time*, which the write path does not
perform. Reusing the same "the gates are probably green" reasoning that F3 uses
would trade one loop for a weaker guarantee on the gate that prevents flipping a
FID to `fixed` without a receipt. That is a design decision with a real
tradeoff, not a patch, and it is the operator's to make.

## Adversarial findings fixed

The audit that cleared steps 1 and 2 returned five findings. Each was
re-verified against the tree before being accepted; all five were real.

1. **The `self_correct` fallback was inert.** `fsmPhase` was threaded cleanly
   through four modules and **no production caller supplied it** — the tests
   passed because they passed the phase directly. This is the exact
   accepted-but-never-supplied class the record's own Lesson Learned names.
   Fixed at `ehel-gate.ts:48` and `custom.ts:188`.
2. **Bare-basename widening.** `attributionMatches` used a path-segment
   suffix match, so `tick.test.ts` — which `tsc` emits when run from inside a
   directory — matched any same-named file anywhere, unlocking it. The test
   that claimed to cover this only exercised the sibling-directory case.
   Reduced to exact canonical equality, which fails closed.
3. **Attribution accumulated across red runs**, contradicting the "most recent
   failed run" contract on `EnforcementState`. Now cleared before being set.
4. **Call-site drift.** `custom-result.ts` passed attribution unconditionally
   where `result-lifecycle.ts` gated on the command outcome. Aligned.
5. **A vacuous test.** The fail-closed leg stripped the gate lines, which made
   C1/C2 emit `fid.gates.missing` and no stale issue at all — so
   `expect(undefined).not.toBe('warning')` passed. It would have passed with
   the demotion deleted outright. Rewritten to assert `toBeDefined()` first.

Two of my own implementation mistakes are recorded here rather than smoothed
over, because both were caught by verification rather than by reading: a patch
deleted a call site instead of replacing it (twice, caught by eslint and `tsc`),
and `fsmPhase` was added to a signature and then silently never forwarded —
`typecheck` passed, because a parameter that is accepted and ignored compiles
fine.

## Lessons Learned

1. **A safety gate that is wrong in BOTH directions is worse than one that is
   merely strict.** The same root cause produced a *soundness* hole nobody
   reported (F1 — the gate passes red runs) and a *liveness* deadlock everybody
   reported (F2 — the gate blocks legitimate repairs). The loud one consumed the
   attention; the silent one consumed the guarantee. Report volume is not a
   proxy for risk, and a gate that grants credit on failure produces no evidence
   of its own failure — the only detection path is a direct probe.
2. **A hypothesis that "the harness reads the index" is refuted by reading the
   state constructor, not by reasoning** (`enforcement-state.ts:44-52`: two
   in-memory `Set`s, cleared, zero git involvement). Neither plausibility
   argument nor careful reasoning about what an enforcement layer "should" do
   settles it; the constructor settles it in one read. F4 is the same lesson in a
   different subsystem: the emitting line (`errors.ts:102`) plus a cross-tool
   grep in `raw-traces.jsonl` refuted a `str_replace`-specific bug that two
   independent reasoners had already "established".
3. **A staleness tripwire is not enforcement.** F3 is the general form: a check
   that fires on *change* while a check that re-runs against *current state*
   already exists (`fid-gates.ts:107-113`, C3) is a cost centre wearing a
   guarantee's clothes. Ask which one is load-bearing before letting the cheap one
   hard-fail the workflow.
4. **A gate that cannot be honoured inside the gate is not a gate.** F2's
   legitimate case had exactly one legal repair and the gate blocked it, so the
   only path forward was to escape enforcement (`rm` + recreate) — a bypass
   cheaper than the compliance. When a rule must distinguish two cases, and the
   implementation cannot, the implementation is the defect, not the user.