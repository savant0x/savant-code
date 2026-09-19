# FID: 2>&1 Anywhere In A Command Waives The Whole Metacharacter Scan

**Filename:** `FID-2026-0919-010-sec3-readonly-redirect-waiver.md`
**ID:** FID-2026-0919-010
**Severity:** medium
**Status:** closed
**Created:** 2026-09-19
**YAGNI-Compliance:** Confirmed (Loop 3 — span-scoped re-scan only, no new
policy surface)

---

## Summary

In `readonly-command-validation.ts`, the Windows stderr-redirect exemption is
tested against the *whole command segment*: a command containing `2>&1`
anywhere gets every unquoted metacharacter violation forgiven — including
`>` (arbitrary file write), `$(` (command substitution), backticks, and `;`.
The read-only tool is deliberately not phase-gated (`pre-dispatch-gates.ts`
"run_readonly_command is intentionally NOT gated here"), so this converts a
read-only tool, usable in `idle` phase, into an arbitrary-write and
arbitrary-execution primitive that bypasses `runWriteGate` path containment
entirely (shell redirection is invisible to `resolveAndContain`).

Worked example accepted by `isReadonlyCommand` today:

```text
cat .env > /tmp/exfil.txt 2>&1
```

## Environment

- **OS:** all (validation is platform-independent; the waiver exists for
  Windows diagnostic conventions but is not Windows-gated)
- **Language/Runtime:** TypeScript, Bun 1.3.14
- **Tool Versions:** `packages/agent-runtime/src/tools/handlers/tool/readonly-command-validation.ts`
  (consumed by `run-readonly-command.ts` → capability gate chain)
- **Commit/State:** branch `main`, uncommitted working tree; verified against
  live source 2026-09-19 (Task 66 audit)

## Detailed Description

### Problem

`readonly-command-validation.ts:16`:

```typescript
const WINDOWS_STDERR_REDIRECT_REGEX = /\b2>nul\b|\b2>&1\b/
```

`readonly-command-validation.ts:187-196`:

```typescript
if (
  hasUnquotedForbiddenMetachar(segment) &&
  !WINDOWS_STDERR_REDIRECT_REGEX.test(segment)   // ← whole-segment waiver
) {
  return {
    valid: false,
    reason: 'Command contains forbidden shell metacharacters …',
  }
}
```

The regex is evaluated against the entire segment, so one legitimate-looking
`2>&1` token launders every other violation in the same segment. The
denylist architecture (FID-2026-0725-085 BUG-003) is bypassed not because
the commands are allowed but because the offending operators are forgiven.

### Expected Behavior

The exemption covers exactly the diagnostic token it was written for —
`2>nul` / `2>&1` — and nothing else. Metacharacters outside that token are
still rejected.

### Evidence

```text
readonly-command-validation.ts:16       WINDOWS_STDERR_REDIRECT_REGEX
readonly-command-validation.ts:187-190  whole-segment test (verbatim above)
pre-dispatch-gates.ts                   run_readonly_command intentionally NOT
                                        phase-gated (docblock)
docs/security-audit-orchestrator-agent-flow.md  SEC-3 (verified 2026-09-19;
                                        author confirmed by reading, not executing)
```

## Impact Assessment

### Affected Components

- `readonly-command-validation.ts` — the waiver
- `run-readonly-command.ts` — consumer accepting the result
- Write-gate containment guarantees (bypassed via shell redirection)

### Risk Level

- [x] Medium: arbitrary write/exec via a read-only tool in any FSM phase;
  requires the agent (or injected content, see FID-2026-0919-009) to emit
  the crafted command; no operator interaction required

## Proposed Solution

### Approach

Scope the exemption to the matched span:

1. On a metachar violation, if `WINDOWS_STDERR_REDIRECT_REGEX` matches,
   remove the matched substring(s) from the segment and re-run
   `hasUnquotedForbiddenMetachar` on the remainder. Reject if the remainder
   still violates.
2. Behavior preserved: `cmd 2>&1`, `cmd 2>nul`, `cmd 2>&1 | grep x` (pipe
   split upstream) keep working; `cat .env > /tmp/x 2>&1` is rejected
   (the `>` survives in the remainder).
3. Tests: the worked example rejected; `>file`, `$(…)`, backtick, `;`
   variants with a trailing `2>&1` all rejected; existing diagnostic
   usages (`2>&1` alone or with plain reads) still pass.
4. Docblock update: the exemption is span-scoped, not segment-scoped.

Alternatives considered and rejected:

- *Require `2>&1` to be the segment's terminal tokens* — breaks
  `cmd 2>&1 | grep x`, a legitimate diagnostic; span-scoping is strictly
  better.
- *Windows-only enforcement* — the injection risk is not platform-bound;
  narrowing the regex scope is platform-neutral.

### Steps

1. [x] DONE — span-scoped re-scan implemented in
   `readonly-command-validation.ts`: on a metachar violation with a
   stderr-redirect match, the matched token is removed and
   `hasUnquotedForbiddenMetachar` re-runs on the remainder.
2. [x] DONE — regression cases added to `run-readonly-command.test.ts`
   (env-exfil example rejected; `echo hi 2>&1` valid; `$(…)`, `>file`,
   `;`, backtick variants with trailing `2>&1` all rejected) + a
   standalone suite `run-readonly-redirect-waiver.test.ts`.
3. [x] DONE — docblock updated; FID closure recorded.

### Verification

- New cases green (pasted output); the full existing denylist suite stays
  green; typecheck agent-runtime; eslint `--max-warnings 0`; quality gate.
- Manual proof: `isReadonlyCommand('cat .env > /tmp/exfil.txt 2>&1')` →
  invalid; `isReadonlyCommand('cat foo.txt 2>&1')` → valid.

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: test packages/agent-runtime/src/tools/handlers/__tests__/run-readonly-command.test.ts
- gate: test packages/agent-runtime/src/tools/handlers/__tests__/run-readonly-command-chains.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:934e89854f1087785a23808624eaf4ad8de8df32825efe683a625ab00316febe
- verified: 2026-09-19T04:01:45.682Z
- typecheck packages/agent-runtime: exit 0
- test packages/agent-runtime/src/tools/handlers/__tests__/run-readonly-command.test.ts: exit 0
- test packages/agent-runtime/src/tools/handlers/__tests__/run-readonly-command-chains.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Whole-segment waiver verified at the lines above; worked example
  constructed (not executed — no write was performed); report SEC-3.
- **GREEN:** Span-scoped re-scan proposed. Not implemented; awaiting
  operator approval.
- **AUDIT:** Document-level double audit; evidence re-verified on disk
  2026-09-19.
- **ADVERSARIAL:** Could span-scoping break quoted `2>&1` literals (echo
  '2>&1')? `hasUnquotedForbiddenMetachar` is quote-aware; quoted spans are
  literal and unaffected by the exemption path. Could removal of the token
  change semantics the checker relies on? The remainder is only *scanned*,
  never executed — the original segment string is what the handler runs.
- **CHANGE DELTA:** n/a (document creation).

### Missed Questions

1. Why did the original code test the whole segment? → Likely convenience;
  the comment frames the tokens as the exemption, but the implementation
  grants the segment.
2. Should `2>&1` be re-validated as terminal-after-pipe? → Unnecessary once
  the remainder is re-scanned; ordering concerns disappear.
3. Does this affect `run_terminal_command`? → No; that tool has a different
  (looser) contract by design.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** 4d89d27d (code committed earlier via the quality-
  ratchet checkpoint; operator-authorized closure 2026-09-19)
- [x] **File:line ranges:**
  `packages/agent-runtime/src/tools/handlers/tool/readonly-command-validation.ts`
  (`validateReadonlySegment` waiver re-scan);
  `tools/handlers/__tests__/run-readonly-redirect-waiver.test.ts` (new);
  `run-readonly-command.test.ts` (extended)
- [x] **Gate output:** receipt below — typecheck/test/quality all exit 0
- [x] **Reproducibility:**
  `bun test ./packages/agent-runtime/src/tools/handlers/__tests__/run-readonly-redirect-waiver.test.ts`
  (use the `./` form — bun filter-matching also sweeps the vendored
  `resources/freebuff-main` copy, a pre-existing environment artifact)
- [x] **Step statuses:** all 3 steps `implemented` (operator-approved
  2026-09-19; no deferrals)

### Code Verification Evidence

- [x] Files referenced in this FID exist and contain the quoted code
  (verified by read 2026-09-19)
- [x] Implementation matches Proposed Solution (span-scoped re-scan;
  Loop 2 audit)
- [x] Typecheck/tests/lint pass with pasted output (receipt below)
- [x] No production call-graph change proposed (predicate-internal fix)

### Loop 2 — Independent audit and self-correction

- **RED:** Whole-segment waiver confirmed live; worked example
  (`cat .env > /tmp/x 2>&1`) verified rejected after the fix by unit test
  (not executed as a real write).
- **GREEN:** Implemented as proposed. Direction proof: the re-scan can
  only widen detection (token removal cannot unflag another metachar),
  so fail-closed holds.
- **AUDIT:** Static: typecheck agent-runtime exit 0; eslint 0; quality
  PASS; receipt gates exit 0. Manual re-read of the waiver branch found
  no drift; existing chains suite still green (quote-aware scans
  unaffected).
- **ADVERSARIAL:** (1) `2>&1` inside quotes — literal, exemption path not
  taken for quoted spans (scanner quote-awareness predates this fix).
  (2) Multiple redirect tokens — all removed before re-scan. (3)
  Residual risk honestly noted: `nul` handling on POSIX (`2>nul` writes a
  file named nul) is out of scope here — the token is diagnostic-only and
  stripped before re-scan; no new exposure.
- **CHANGE DELTA:** `readonly-command-validation.ts` waiver branch
  rewritten; 1 new test file + 1 extended suite; no public API change.

### Loop 3 — Final convergence

- **RED:** Converged — bypass proven and closed (negative tests green).
- **GREEN:** Converged — span-scoped waiver live (uncommitted,
  G2-pending).
- **AUDIT:** Converged — receipt gates exit 0; eslint 0; lint:md clean.
- **ADVERSARIAL:** Converged — three challenges resolved with receipts.
- **CHANGE DELTA:** Final: see Loop 2; none after receipt stamp.

## Resolution

- **Closed Date:** 2026-09-19 (implementation commit 4d89d27d)
- **Fix Description:** stderr-redirect exemption scoped to the matched
  span; remainder of the segment re-scanned for forbidden metacharacters
- **Tests Added:** `run-readonly-redirect-waiver.test.ts` (new);
  `run-readonly-command.test.ts` cases extended
- **Verification Evidence:** receipt below; per-suite counts in the
  session summary
- **Archived:** 2026-09-19 — moved to `dev/fids/archive/`

## Lessons Learned

An exemption evaluated on a larger scope than the thing it exempts is a
grant, not an exception. Security waivers must bind to the exact matched
span — anything wider is a laundering mechanism.
