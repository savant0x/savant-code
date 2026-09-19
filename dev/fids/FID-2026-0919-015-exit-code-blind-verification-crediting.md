# FID: Exit-Code-Blind Verification Crediting Discharges Law 3/15 On Failing Builds

**Filename:** `FID-2026-0919-015-exit-code-blind-verification-crediting.md`
**ID:** FID-2026-0919-015
**Severity:** medium
**Status:** verified
**Created:** 2026-09-19
**YAGNI-Compliance:** Confirmed (Loop 3 — thread one boolean through an
existing bag; one predicate change; flip pinned tests. No modes, no config
surface, no new tool.)

---

## Summary

EHEL verification crediting fires on **detection** of a verification-shaped
command, never on its **outcome**. In
`packages/agent-runtime/src/echo/enforcement/tool-pipeline.ts:196-209`,
`afterToolCallImpl` adds every dirty file to `state.verifiedFiles` as soon as
any terminal-command candidate matches the verification detector. The result
bag it receives — `{ text?: string; error?: string }`
(`echo/enforcement.ts:131-136`) — carries **no exit code**, so a *failing*
typecheck/test/lint run discharges Law 3 (pre-write block) and Law 15
(turn-end block) exactly like a passing one.

This is a pre-existing design from FID-2026-0819-001 (detection-only
crediting), pinned as a repro during FID-2026-0918-005 Step 1
(`pre-write-gates-law3.test.ts:169-202`) and flagged-not-hidden in Loop 2
ADVERSARIAL (SCOPE.md T65-D, routed candidate 1). This FID promotes that
flag to a tracked defect.

## Environment

- **OS:** all
- **Language/Runtime:** TypeScript, Bun 1.3.14
- **Tool Versions:** `packages/agent-runtime/src/echo/enforcement/*`,
  `packages/agent-runtime/src/tools/tool-executor/*`
- **Commit/State:** verified against live source 2026-09-19

## Detailed Description

### Problem

The credit branch, verbatim (`tool-pipeline.ts:196-209`):

```typescript
// Handles both terminal command types (RED-003) via the shared detector.
if (
  toolName === 'run_terminal_command' ||
  toolName === 'run_readonly_command'
) {
  const verified = terminalCommandCandidates(input).some(
    detectsVerificationCommand,
  )
  if (verified) {
    for (const f of self.state.dirtyFiles) {
      self.state.verifiedFiles.add(f)
    }
  }
}
```

The invocation site hands in only `{ text?, error? }`
(`echo/enforcement.ts:131-136`), so **no outcome signal exists on this path
at all** — crediting cannot be exit-gated by construction. Meanwhile both
real call sites already hold the information needed to derive success:

- `tools/tool-executor/result-lifecycle.ts:163-171` computes
  `hasToolResultError(toolResult.content)` right next to its
  `enforcement.afterToolCall` call (for `writeSucceeded`);
- `tools/tool-executor/custom-result.ts:116-124` holds the same
  `toolResult` when it calls in.

The defect's consumers are both Law 3/15 blocks: the pre-write gate and the
turn-end predicate (`echo/enforcement/turn-end.ts:36-40`,
`dirtyFiles` minus `verifiedFiles`).

### Expected Behavior

Credit must reflect verification that **succeeded**, not verification that
was merely attempted:

1. A verification-shaped command whose tool result reports failure does
   **not** credit `verifiedFiles`.
2. A verification-shaped command whose outcome is unknown does not credit
   **silently** — credit is withheld and a steering notice tells the agent
   the run did not count (fail-closed, consistent with house norms: ZTAP
   enforce fails closed, unknown tools strip to none).
3. Law 4 grep/find crediting (`featuresVerified`, `tool-pipeline.ts:216+`)
   is a different counter for a different law and is **out of scope** — its
   signal is evidence-of-reading, not build health.

### Evidence

```text
echo/enforcement/tool-pipeline.ts:196-209   credit-on-detection (verbatim above)
echo/enforcement.ts:131-136                 result bag {text?, error?} — no exit field
tools/tool-executor/result-lifecycle.ts:163-171  call site; success derivable here
tools/tool-executor/custom-result.ts:116-124     second call site, same
echo/enforcement/turn-end.ts:36-60          Law 15 consumes the same verifiedFiles
echo/__tests__/pre-write-gates-law3.test.ts:190-202  repro pin: failing run credits
SCOPE.md T65-D (routed candidate 1)         flagged-not-hidden origin, 2026-09-18
FID-2026-0819-001                           original detection-only design
```

## Impact Assessment

### Affected Components

- `echo/enforcement/tool-pipeline.ts` — credit policy
- `echo/enforcement.ts` + the two tool-executor call sites — result bag
- `echo/enforcement/turn-end.ts` — downstream consumer (unchanged code,
  changed behavior: blocks more often, which is the point)

### Risk

The protocol's own quality bar is self-deceiving: Law 15's promise — "build
stays clean" — is dischargeable by a build that is **not** clean. An agent
that runs `bun run typecheck`, receives `error TS2307`, and proceeds has
satisfied the letter of the enforcement path while violating its entire
purpose. Severity medium: not runtime-exploitable, but it hollows out the
invariant the rest of the protocol leans on (every FID receipt in this repo
is stamped on the assumption that a "passing" gate means passing).

### Out of Scope

- Law 4 grep crediting (above).
- Re-litigating FID-2026-0819-001's cumulative-credit model: a passing run
  still credits **all** currently-dirty files; per-file attribution via
  tsc output parsing is explicitly **not** attempted (brittle,
  locale/version-dependent — rejected in Loop 2 below).
- Turn-end Law 15 tier semantics (unchanged).

## Proposed Fix (GREEN)

1. **Bag extension (mechanical):** add
   `commandSucceeded?: boolean` to the `afterToolCall` result bag and
   through to `afterToolCallImpl`. Derive it at the two call sites from the
   already-in-scope `toolResult` via the same
   `hasToolResultError(...)` primitive `result-lifecycle.ts` uses for
   `writeSucceeded` — `false` on reported failure, `true` on clean result,
   `undefined` when neither is determinable.
2. **Policy change:** in the verification branch, credit only when
   `commandSucceeded === true`. When `undefined`, withhold credit and emit
   a steering notice ("verification command detected but outcome unknown —
   Law 3 credit not granted; re-run and confirm it passes"). When `false`,
   withhold credit (no notice — the failure is already visible in the
   transcript).
3. **Test contract flips:** the pinned tests that encode detection-only
   crediting flip to the new contract —
   `pre-write-gates-law3.test.ts:196-202` (failing run must NOT credit),
   plus new pins: clean result credits; unknown outcome withholds + emits
   notice; Law 4 grep crediting untouched (regression guard).
4. **Docs:** this FID document is the record; no ECHO.md law text changes
   (Law 15 already says "verification" — the enforcement now means it).

### Steps

1. [x] DONE — result bag extended (`echo/enforcement.ts`:
      `commandSucceeded?: boolean` threaded through to `afterToolCallImpl`);
      derived at BOTH call sites via the same `hasToolResultError`
      primitive the write lifecycle trusts (`result-lifecycle.ts` native
      path; `custom-result.ts` custom/MCP path — parity, no bypass).
2. [x] DONE — credit policy in `afterToolCallImpl`
      (`echo/enforcement/tool-pipeline.ts`): credit only on `true`; on
      `undefined` withhold + steering advisory (warnings accumulator added,
      returned to the executor); on `false` withhold silently.
3. [x] DONE — test contracts: `pre-write-gates-law3.test.ts` repro pin
      flipped (failing run must NOT credit) + success pin added; new
      `tool-pipeline-verification-credit.test.ts` (6 tests: success/fail/
      unknown-notice/non-verification-silence/terminal-fail/Law-4-guard);
      three Law-3-channel extraction pins in `law4-turn-end.test.ts` now
      pass `commandSucceeded: true` (extraction is orthogonal to outcome).
4. [x] DONE — this document updated, receipt stamped.

Declared below under `## Verification Gates` (machine-executed by
`scripts/fid-verify.ts`).

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: test packages/agent-runtime/src/echo/__tests__/pre-write-gates-law3.test.ts
- gate: test packages/agent-runtime/src/echo/__tests__/tool-pipeline-verification-credit.test.ts
- gate: test packages/agent-runtime/src/echo/__tests__/law4-turn-end.test.ts
- gate: test packages/agent-runtime/src/echo/__tests__/enforcement.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:4cd9e32d562923b0450bb4e4a1390a3890dd49ea1c54dd760a7a5994317cc0ac
- verified: 2026-09-19T04:43:44.120Z
- typecheck packages/agent-runtime: exit 0
- test packages/agent-runtime/src/echo/__tests__/pre-write-gates-law3.test.ts: exit 0
- test packages/agent-runtime/src/echo/__tests__/tool-pipeline-verification-credit.test.ts: exit 0
- test packages/agent-runtime/src/echo/__tests__/law4-turn-end.test.ts: exit 0
- test packages/agent-runtime/src/echo/__tests__/enforcement.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED (grounded 2026-09-19)

Call-graph verified: both `afterToolCall` call sites reach the credit branch
with no outcome field; the turn-end predicate consumes the same
`verifiedFiles`. The repro pin exists and documents the defect as status quo
(this FID inverts that pin's contract deliberately — it was written as a
pin, not an endorsement).

### Loop 2 — Independent audit and self-correction

- (1) Could withholding on `undefined` wedge hybrid sessions at turn end?
  Both real call sites can derive success from `toolResult`, so unknown is
  a should-never path; the steering notice makes it visible if it happens,
  and the agent recovers by re-running verification. Accepted residual.
- (2) Is deriving success from `hasToolResultError` sound for terminal
  commands? It is the same primitive the pipeline already trusts for
  `writeSucceeded`; a handler that reports neither error nor clean text is
  the unknown case, handled fail-closed. No output-text parsing is added.
- (3) ADVERSARIAL: does stricter crediting regress the FID-2026-0819-001
  false-block fixes? No — it narrows the *grant* side only; batch-first
  extraction (`FID-2026-0824-001`) and credit revocation on re-write
  (`FID-2026-0820-012`) are untouched.
- Rejected alternative: parsing command stdout for failure markers —
  brittle across toolchains/locales; structured status only.

### Loop 3 — Final convergence

CONVERGED 2026-09-19. Implementation matched the GREEN design with one
empirical correction: the flipped repro pin initially asserted via the
pre-write block (wrong observable — under the FID-2026-0918-005 two-part
rule a hybrid-mode write to a *different* file is advisory-only), so the
pin asserts the credit state (`verifiedFiles`) directly — the actual
subject of the contract. Live gates: agent-runtime typecheck exit 0; echo
suite 181/0 (incl. new 6-test suite); result-lifecycle 2/0; repo-wide
typecheck/eslint(0w)/lint:md/quality PASS. No open deltas.

## Operator Decision

**Implementation approval required.** The fix is small (one boolean threaded
through an existing bag, one predicate, test flips) but it changes
enforcement behavior repo-wide: verification only counts when it passes.
Approved on request — it enters the same Loop 2/3 + receipt discipline as
FIDs 008-014.
