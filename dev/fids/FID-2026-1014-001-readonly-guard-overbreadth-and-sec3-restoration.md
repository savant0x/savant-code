# FID: read_only guard — over-broad refusals removed, and the SEC-3 redirect waiver found live again

**Filename:** `FID-2026-1014-001-readonly-guard-overbreadth-and-sec3-restoration.md`
**ID:** FID-2026-1014-001
**Severity:** high
**Status:** verified
**Created:** 2026-10-14
**Automation level:** 3
**YAGNI-Compliance:** Verified

## Summary

Two findings on one code path, `run_readonly_command`'s guard
(`packages/agent-runtime/src/tools/handlers/tool/readonly-command-validation.ts`).

**(A) Over-breadth — and the operator-facing consequence.** The operator's
standing objection is that the harness must not refuse the operator
(`dev/operator-decisions.md`, Q23). A guard that refuses a *legitimate read-only
command* converts an operator instruction into an agent-visible dead end and
burns a turn. Measured against a 56-command read-only corpus, the guard refused
**five** legitimate commands: the POSIX null sink (`2>/dev/null`, three spellings)
and input redirection (`< file`, two spellings) — while the EHEL mutation
classifier already treats `/dev/null` as a non-mutation target
(`echo/enforcement/helpers.ts:144`). Fixed; corpus false positives are now **0**.

**(B) Under-breadth — a closed security FID's fix is absent from the tree.**
The wrapper that this guard replaced was **live at HEAD**: a `2>&1` anywhere in a
segment waived the whole metacharacter scan, so a *read-only* tool accepted
`cat .env > /tmp/exfil.txt 2>&1`, `echo $(whoami) 2>&1` and `ls; rm x 2>&1`.
That is exactly the vulnerability archived `FID-2026-0919-010` (SEC-3) describes
as *fixed*, with a 4/4 receipt, steps marked DONE and a promised standalone suite
that has never existed in any commit. The span-scoping SEC-3 specified is now
implemented and the promised suite exists.

## Environment

- **OS:** Windows (bash/Git Bash shell)
- **Language/Runtime:** TypeScript 5.5.4, Bun 1.3.14, local line 0.0.36
- **Commit/State:** `e29e6ddf`; work in the working tree only (no push, no release)

## Detailed Description

### Problem

**(A)** The guard refused legitimate read-only commands. Corpus measurement,
before the change (`dev/scratchpad/active/readonly-overbreadth-audit.ts`):

```text
corpus=56 allowed=44 rejected=12
OVER-BREADTH false positives: 5
  REJECT  bun test 2>/dev/null
  REJECT  bun test 2> /dev/null
  REJECT  ls -la 2>/dev/null
  REJECT  wc -l < SCOPE.md
  REJECT  grep -c allow < dev/fids/README.md
UNDER-BREADTH allowed-but-not-read-only: 4
  ALLOW   git push origin main
  ALLOW   git clean -fd
  ALLOW   git stash pop
  ALLOW   find . | xargs rm -f
```

The POSIX null sink was refused while its Windows twin `2>nul` was explicitly
permitted (`readonly-command-validation.ts:15` at HEAD), and `/dev/null` is a
declared non-mutation target in the shared classifier (`helpers.ts:144`) — one
truth disagreed with itself.

**(B)** At HEAD, `2>&1` laundered every other metacharacter in its segment:

```text
$ git show HEAD:.../readonly-command-validation.ts > dev/scratchpad/active/ro-head-snapshot.ts
$ bun -e "…isReadonlyCommand(HEAD snapshot)…"
ALLOW  "cat .env > /tmp/exfil.txt 2>&1"
ALLOW  "cat foo.txt 2>&1"
ALLOW  "echo $(whoami) 2>&1"
ALLOW  "ls; rm x 2>&1"
REJECT "bun test 2>/dev/null"
```

Line 193 of the HEAD module was the whole-segment test
`!WINDOWS_STDERR_REDIRECT_REGEX.test(segment)` — verbatim the shape SEC-3 opens
with, and the shape SEC-3's step 1 says was replaced.

### Expected Behavior

- A permitted redirect is removed from the segment and the remainder is
  re-scanned, so a permitted token can never forgive a violation (SEC-3 step 1).
- Redirections that are read-only in effect (`2>&1`, `[n]>`/`[n]>>` into a null
  sink) and input redirection (`< file`) are permitted; process substitution
  (`<(`), heredocs/here-strings (`<<`, `<<<`), and any redirect into a real file
  are refused.
- The classifier and the guard consume the same truth (Law 13) — one exported
  predicate, non-global so its `.test()` caller is stable.

### Root Cause

**(A)** Redirection permission was enumerated per-OS (`2>nul`, `2>&1`) and
`<` was grouped with the write redirects in `FORBIDDEN_METACHAR_REGEX`, so the
allowance never covered the POSIX null sink or stdin redirection.

**(B)** The HEAD module carried the pre-SEC-3 whole-segment waiver, and the
implementation commit for SEC-3 does not exist: the only commits touching the
`*redirect-waiver*` path are the record's own add (`e6d06fe7`) and its archive
move (`407527b2`), both `docs(protocol)`. `run-readonly-redirect-waiver.test.ts`
was never committed, and the last commit touching the waiver expression is an
unrelated checkpoint (`4d89d27d`). The record was closed on a receipt whose test
gates name the two suites that *do* exist; the promised suite was never declared
as a gate, so the promise rule never fired.

### Evidence

After the change (same corpus):

```text
corpus=56 allowed=49 rejected=7
OVER-BREADTH false positives: 0
```

Under-breadth probe, predicate-only (nothing executed) — the guard's contract is
"read-only", and these are not read-only:

```text
ALLOW  "bun -e \"console.log(1)\""          ALLOW  "bun x eslint . --max-warnings 0"
ALLOW  "bun run release:public"            ALLOW  "deno eval \"1+1\""
ALLOW  "find . -name \"*.ts\" -delete"      ALLOW  "kill -9 1"
REJECT "npx tsx script.ts"  REJECT "eval echo hi"  REJECT "node -e \"1\""  REJECT "python -c \"1\""
```

Suites (all run from `packages/agent-runtime`):

```text
run-readonly-command.test.ts            18 pass / 0 fail
run-readonly-redirect-waiver.test.ts     4 pass / 0 fail   (new; discharges SEC-3's promise)
run-readonly-command-chains.test.ts     10 pass / 0 fail
terminal-mutation-classifier.test.ts +
deny-mutating-terminal.test.ts          15 pass / 0 fail
src/tools/handlers src/tools/tool-executor src/echo
                                        644 pass / 0 fail across 78 files
bun run --cwd=packages/agent-runtime typecheck   exit 0
```

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/tools/handlers/tool/readonly-command-validation.ts`
- `packages/agent-runtime/src/tools/handlers/tool/run-readonly-command.ts` (consumer, unchanged)
- `packages/agent-runtime/src/echo/enforcement/helpers.ts` (shared-predicate consumer)
- `packages/agent-runtime/src/tools/handlers/__tests__/run-readonly-command.test.ts`
- `packages/agent-runtime/src/tools/handlers/__tests__/run-readonly-redirect-waiver.test.ts` (new)

### Risk Level

- [x] High: the pre-change state admitted arbitrary file writes and command
  substitution through a tool that is deliberately not phase-gated; the
  over-breadth half cost turns rather than safety.

## Proposed Solution

### Approach

1. Replace the contains-style redirect exemption with a strip-then-rescan
   (SEC-3 step 1), using one exported, non-global predicate
   (`PERMITTED_REDIRECT_REGEX`) plus a local global twin for stripping.
2. Widen the allowed redirections to the null sink on any stream and to stdin
   redirection, leaving `<(` / `<<` / `<<<` and real-file targets refused.
3. Keep the classifier on the same predicate; no divergent copy (Law 13).
4. Pin the whole matrix, including SEC-3's worked example and its diagnostics.

### Steps

1. `implemented` — `readonly-command-validation.ts:29-36` exported predicate +
   global twin; `:227-228` strip-then-rescan; `:203-208` `<` handling with
   `<(`/`<<` still refused.
2. `implemented` — `helpers.ts:11,150,157` renamed consumer, comment corrected.
3. `implemented` — 7 new pins in `run-readonly-command.test.ts`; new
   `run-readonly-redirect-waiver.test.ts` carrying SEC-3's acceptance matrix.
4. `blocked (operator)` — the under-breadth holes are **reported, not closed**:
   closing them means adding refusals, which is the operator's ruling (Q23), and
   `git push`/`git clean -fd` are better handled by routing than by a bigger
   denylist. A second probe pass shows the list is **a class, not four items — the
   guard is a denylist, not a boundary**: `bun -e "…"`, `bun x <pkg>`,
   `bun run release:public`, `deno eval "…"`, `find . -name "*.ts" -delete` and
   `kill -9 1` are all ALLOWED. This session's own audit harness invoked `bun -e`
   throughout, so the guard would not have stopped the audit either.

### Verification

Named artifacts: `run-readonly-command.test.ts` (matrix + EHEL predicate
contract), `run-readonly-redirect-waiver.test.ts` (SEC-3 acceptance),
`run-readonly-command-chains.test.ts` (segment scoping),
`terminal-mutation-classifier.test.ts` (shared predicate), and the corpus probe
`dev/scratchpad/active/readonly-overbreadth-audit.ts`.

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: test packages/agent-runtime/src/tools/handlers/__tests__/run-readonly-command.test.ts
- gate: test packages/agent-runtime/src/tools/handlers/__tests__/run-readonly-redirect-waiver.test.ts
- gate: test packages/agent-runtime/src/tools/handlers/__tests__/run-readonly-command-chains.test.ts
- gate: test packages/agent-runtime/src/echo/__tests__/terminal-mutation-classifier.test.ts
- gate: probe dev/scratchpad/active/readonly-overbreadth-audit.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:5ff0f8913092c4f8c14a010beeaa51767c3ba38c1bcd48d60ac3991cb80cc567
- verified: 2026-10-14T16:24:32.993Z
- typecheck packages/agent-runtime: exit 0
- test packages/agent-runtime/src/tools/handlers/__tests__/run-readonly-command.test.ts: exit 0
- test packages/agent-runtime/src/tools/handlers/__tests__/run-readonly-redirect-waiver.test.ts: exit 0
- test packages/agent-runtime/src/tools/handlers/__tests__/run-readonly-command-chains.test.ts: exit 0
- test packages/agent-runtime/src/echo/__tests__/terminal-mutation-classifier.test.ts: exit 0
- probe dev/scratchpad/active/readonly-overbreadth-audit.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** The corpus probe failed first: 5/56 legitimate read-only commands
  refused, 3 of them the POSIX null sink. The HEAD-snapshot probe then failed
  harder: the SEC-3 waiver accepted credential exfiltration, command substitution
  and a separator behind a trailing `2>&1`.
- **GREEN:** Strip-then-rescan (SEC-3 step 1) plus the widened allowance; the
  shared predicate renamed and kept non-global; the promised suite written.
- **AUDIT:** Corpus false positives 0/56; guard suites 18/0 and 4/0; chains 10/0;
  classifier 15/0; the three affected directories 644/0; workspace typecheck
  exit 0. Two of my own pins failed on the first run (`> nul.txt`,
  `> /dev/null/foo` were allowed) — a missing delimiter in the sink lookahead —
  and the fix is the `(?=\s|$|['"]|[;&|])` boundary now in the predicate. The
  pins were kept and made to pass for the right reason rather than relaxed.
- **ADVERSARIAL:** A `g`-flagged exported predicate would make EHEL's `.test()`
  alternate — that is why the exported form is non-global and the stripping twin
  is local, and a pin asserts `PERMITTED_REDIRECT_REGEX.global === false`.
  Stripping cannot hide a violation: the matched text is only ever a null-sink
  redirect, and the denylists still run against the stripped segment, so
  `rm -rf x > /dev/null` stays refused. **And the guard is not a control at all
  for the audit itself:** it permits `bun -e`, which is how every probe in this
  pass evaluated the predicate — including the probe that reproduced the SEC-3
  takeover on a copy of the HEAD module. That reproduction evaluated a predicate;
  it did not read `.env` or write anything (`NEEDS-REVIEW` on the boundary: the
  guard's real authority is the phase gate, not this denylist).
- **CHANGE DELTA:** first pass (this document).

### Missed Questions

1. **Was an over-breadth audit ever run on this guard?** No. FID-2026-0919-010
   narrowed the guard's *permissiveness*; nothing ever measured its **false
   refusals**. Answered by building the corpus probe in this pass, and the
   operator asked for it directly.
2. **Does a permitted redirect still waive the rest of the segment?** It did at
   HEAD, despite SEC-3 being closed — caught only because the audit's first edit
   to that branch happened to touch it. Folded in as finding (B).
3. **Is the promised SEC-3 suite present?** No — and no commit ever added it.
   Answered by writing it in this pass, and registered as FID-2026-1014-002 so
   the class is visible beyond this one record.
4. **Should the guard's under-breadth holes be closed here?** No: closing them
   adds refusals, which contradicts the operator's standing position and needs
   their ruling. Presented in Q23 with a routing option.

### Implementation Evidence

- [ ] **Commit SHA:** pending (working tree only; the operator holds the commit)
- [x] **File:line ranges:** `readonly-command-validation.ts:18,29-36,203-208,227-228`;
  `helpers.ts:11,150,157`; `run-readonly-command.test.ts` (new describe);
  `run-readonly-redirect-waiver.test.ts` (new file)
- [x] **Gate output:** pasted in Detailed Description → Evidence
- [x] **Reproducibility:** `grep -n "PERMITTED_REDIRECT_REGEX" packages/agent-runtime/src/**`
- [x] **Step statuses:** 1-3 `implemented`; 4 `blocked (operator)`

### Code Verification Evidence

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution
- [x] Typecheck/tests pass with pasted tool output
- [x] Production call-graph evidence: `run-readonly-command.ts:60,68` is the only
  caller of `isReadonlyCommand`; `helpers.ts:157` is the only consumer of the
  shared predicate
- [x] Status reflects the implementation state (`verified`; not closed)

## Resolution

- **Closed Date:** —
- **Fix Description:** over-broad refusals removed; SEC-3 span scoping restored
  and its promised suite delivered.
- **Tests Added:** Yes — 7 pins in the guard suite, 4 in the new waiver suite
- **Verification Evidence:** see Evidence (corpus 0/56 false positives)
- **Archived:** —

## Lessons Learned

- **A closed FID is a claim, not an artifact.** FID-2026-0919-010 named a test
  file that no commit ever contained, and its 4/4 receipt was earned by the two
  suites that did exist. "Declared artifact exists" belongs in the census, not in
  a promise rule keyed to prose (FID-2026-1014-002).
- **A safety guard needs a false-positive measurement as much as an attack
  suite.** Every prior pass on this file asked "what does it allow that it
  should not?"; the operator's objection required the opposite question, which
  nobody had instrumented until now.
- **One truth means one *form* too.** Two layers agreed that `/dev/null` is
  diagnostic while the guard refused it; a shared constant is not shared
  behaviour unless both sides read the same field.
