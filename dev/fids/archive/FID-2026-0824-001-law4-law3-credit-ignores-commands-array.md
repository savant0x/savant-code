# FID: Law 3/Law 4 verification credit ignores run_readonly_command `commands` arrays

**Filename:** `FID-2026-0824-001-law4-law3-credit-ignores-commands-array.md`
**ID:** FID-2026-0824-001
**Severity:** medium
**Status:** closed
**Created:** 2026-08-24 00:41
**YAGNI-Compliance:** Pending

---

## Summary

The EHEL enforcement layer credits Law 3 (verify-before-proceed) and Law 4
(call-graph reachability) only when a terminal tool call carries its command
in the SINGULAR `input.command` field. `run_readonly_command` also accepts a
plural `input.commands` array (executed sequentially); when callers use that
form — which the Orchestrator does routinely for batched gates —
`input.command` is undefined, the detector sees an empty string, and NO
verification or reachability credit is recorded. Result: false hard blocks at
turn end ("wired but not verified") and permanently wedged Law-3 dirty flags,
even when every array entry was itself a grep/typecheck/test gate.

## Environment

- **OS:** Windows 10 (Git Bash shell), live operator session
- **Language/Runtime:** TypeScript monorepo, Bun 1.3.14 (pinned)
- **Tool Versions:** Savant harness ECHO v0.2.0 enforcement layer
  (`packages/agent-runtime/src/echo/`)
- **Commit/State:** main @ v0.0.27 working tree (release-only-commits)

## Detailed Description

### Problem

Observed live twice in one session (2026-08-24, FID-2026-0822-012 P1 work):

1. Turn-end fired a BLOCKING Law-4 violation on
   `desktop/scripts/generate-design-tokens.ts` despite the session having run
   three caller-verification greps moments earlier — all three via ONE
   `run_readonly_command` call using the `commands:` array form.
2. The Law-3 tracker wedged repeatedly on edited files (dirty flag never
   cleared) even though passing typecheck/lint/test runs executed after each
   edit — again via batched `commands:` arrays.

### Expected Behavior

Any tool-call shape the executor actually supports should credit the trackers:
a `run_readonly_command` whose `commands` array contains verification-named
entries (typecheck/test/lint) must clear Law-3 dirty flags; entries containing
`grep`/`find` must credit `featuresVerified` for Law 4.

### Root Cause

`packages/agent-runtime/src/echo/enforcement.ts` reads only the singular
fields:

```ts
const cmd = (params.input.command as string) ?? ''
if (detectsVerificationCommand(cmd)) { ... }        // Law 3 credit
...
const pattern = (params.input.pattern as string) ?? ''
const cmd = (params.input.command as string) ?? ''
if (pattern.includes('grep') || cmd.includes('grep') ||
    cmd.includes('find')) { ... }                    // Law 4 credit
```

With the plural form, `params.input.command` is undefined → both detectors
evaluate an empty string. RED-003 already fixed the sibling gap for
run_readonly_command vs run_terminal_command at the TOOL level; this is the
remaining PARAMETER-SHAPE gap inside the same tool.

### Evidence

```text
enforcement.ts (Law 4 credit block):
  const pattern = (params.input.pattern as string) ?? ''
  const cmd = (params.input.command as string) ?? ''
  if (pattern.includes('grep') || cmd.includes('grep') || cmd.includes('find'))

Live sequence (this session):
  run_readonly_command { commands: [ "grep -rn buildDeckTokensModule ...",
    "grep -rn deck-tokens.generated ...", "grep -rn DECK_TOKENS. ..." ] }
  -> turn end: BLOCKED Law 4 on desktop/scripts/generate-design-tokens.ts
  run_readonly_command { command: "grep -rn buildDeckTokensModule ..." }
  (singular) -> no further Law-4 block; state cleared.
Law-3 wedge: identical shape via detectsVerificationCommand(input.command)
  while every edit-to-verify ran through `commands:[typecheck, test, lint]`.
```

Related same-session observation (separate defect class, already worked
around in product code): the design-contract scanner treats any `.ts` as a
visual path (`isVisualPath` is extension-based) and its
DYNAMIC_VISUAL_DECLARATION regex matched token→CSS-var lookup-table object
KEYS in `desktop/scripts/generate-design-tokens.ts`, producing spurious
NEEDS-REVIEW advisories until the table was refactored to tuple pairs.

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/echo/enforcement.ts` (Law 3 + Law 4 credit)
- `packages/agent-runtime/src/echo/enforcement-state.ts` (state only; no change expected)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

Workaround exists (use singular `command` per call), but it is undiscoverable
without reading enforcement source; agents without source access experience
recurring hard blocks and wedged dirty flags (observed 2 blocking turn-ends +
3 tracker wedges in one real session).

## Proposed Solution

### Approach

Collect ALL command strings from both parameter shapes before detection:

```ts
function commandCandidates(input: {
  command?: unknown
  commands?: unknown
}): string[] {
  if (typeof input.command === 'string' && input.command.length > 0) {
    return [input.command]
  }
  if (Array.isArray(input.commands)) {
    return input.commands.filter(
      (entry): entry is string => typeof entry === 'string',
    )
  }
  return []
}
```

Then: Law 3 credit = `commandCandidates(...).some(detectsVerificationCommand)`;
Law 4 credit = `candidates.some((c) => c.includes('grep') || c.includes('find'))`
(or pattern match for code_search unchanged). Keep behavior otherwise
identical; singular-form sessions are unaffected.

### Steps

1. Add the shared candidate extractor in `echo/enforcement.ts` and wire it
   into both credit blocks.
2. Extend the echo unit suites (`law4-turn-end.test.ts` siblings): a
   `commands:[grep...]` call credits `featuresVerified`; a
   `commands:[typecheck...]` call clears Law-3 verified files; singular forms
   keep existing behavior (regression guard).
3. Note restart-gating in the record: the fix is runtime code; the running
   harness must be restarted to pick it up (Bun loads the module graph at
   process start).

### Verification

- `bun run --cwd=packages/agent-runtime typecheck` exit 0
- Focused echo suite green including the new commands-array cases
- Manual/live probe post-restart: batched `commands:[grep...]` clears an
  armed Law-4 turn-end block

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: test packages/agent-runtime/src/echo/__tests__/law4-turn-end.test.ts

### Verification Receipt

- fingerprint: sha256:b017d28b95e6c26c3e6990c0edd0099d32769f4c4613f88a8e230068f9726b03
- verified: 2026-08-26T04:03:56.594Z
- typecheck packages/agent-runtime: exit 0
- test packages/agent-runtime/src/echo/__tests__/law4-turn-end.test.ts: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED (Detective + Orchestrator full reads, 2026-08-24): PASS —**
  1. Credit sites are exactly TWO, both singular-only:
     `echo/enforcement.ts` Law 3 block (`detectsVerificationCommand(cmd)`
     over `input.command`) and Law 4 block (`pattern`/`cmd` grep/find
     substring) — file read 0-EOF this session.
  2. The plural shape is first-class in the TOOL CONTRACT:
     `common/src/tools/params/tool/run-readonly-command.ts` declares
     `commands: z.array(z.string()).min(1).optional()` AND documents
     "When provided, `command` is ignored" — so candidate extraction must be
     BATCH-FIRST (amends the Approach sketch, which checked singular first;
     singular-first would mis-evaluate mixed-shape calls the executor
     defines away).
  3. Shared detector `detectsVerificationCommand`
     (`util/echo-compliance-core.ts:40`, VERIFICATION_COMMAND_PATTERN) has
     zero array awareness in its call chain.
  4. Coverage gap confirmed: `echo/__tests__/law4-turn-end.test.ts`
     "Law 4 credit channel" block exercises ONLY singular-form inputs
     (grep / no-grep / code_search); NO test anywhere drives the `commands`
     array through either credit path.
  5. Related consumer FLAGGED out of scope (site CORRECTED by the Adversary
     pass): the singular-only guard feeding compliance-tracker credits lives
     at `tools/tool-executor/echo-record.ts:46-48`
     (`if (typeof effectiveInput.command === 'string')
     echoCompliance.recordVerification(...)` — a commands-array call records
     NOTHING); `util/echo-compliance.ts` itself correctly takes an extracted
     string. Same false-negative class, strict-mode step-boundary credits;
     routed as follow-up, non-blocking. Related observation for a FUTURE
     filing (not this one): `tools/sandbox/engine.ts:75` classifies only the
     singular field, so commands[] entries may bypass destructive-pattern
     classification unless the readonly-guard covers arrays server-side.
- **GREEN (Orchestrator, 2026-08-24): DONE —**
  1. NEW module-level `terminalCommandCandidates(input)` in
     `echo/enforcement.ts`: BATCH-FIRST extraction (mirrors the zod
     contract — `command` ignored when `commands` present), filters to
     non-empty strings.
  2. Law 3 block rewired:
     `candidates.some(detectsVerificationCommand)` credits verifiedFiles.
  3. Law 4 block rewired:
     `pattern.includes('grep') || candidates.some(grep/find)` credits
     featuresVerified; code_search pattern channel unchanged.
  4.Regression tests appended to `echo/__tests__/law4-turn-end.test.ts`
     (7 new cases): batch grep credits Law 4; plain batch does NOT;
     batch-first precedence over an ignored singular; Law 3 batch typecheck
     credits verifiedFiles; non-verification batch does NOT; singular
     regression guard; run_terminal_command batch form shares the extractor.
- **GATES (tool-mediated):** agent-runtime typecheck exit 0 · focused suites
  law4-turn-end + enforcement + echo-compliance **83 pass / 0 fail** ·
  eslint --max-warnings 0 on both touched files · prettier clean.
- **HONEST BOUNDARY:** runtime fix is RESTART-GATED — the running harness
  process keeps the old detector until restarted (Bun loads the module graph
  at process start); post-restart live probe listed in Verification.
- **AUDIT (Verifier, 2026-08-24): 3 PASS / 1 FAIL / 2 NEEDS-REVIEW —** fix
  matches spec (batch-first extractor, both credit blocks rewired, code_search
  channel unchanged); gates claimed vs executed all evidenced; restart-gating
  honesty confirmed. FAIL discharged in self-correct: record said "6 new
  cases", disk truth is SEVEN it() blocks — counts amended, receipt RE-STAMPED
  sha256:d20b7e6e3612241bc94559423033bed8aa35ad7d819d888e83ff47eb19d22e15
  (both declared gates PASS on live re-run).
- **ADVERSARIAL (2026-08-24): STANDS —** every Verifier verdict CONFIRMED
  against disk with resolved anchors (`enforcement.ts:52-64,365-366,385-394`;
  seven test cases at `law4-turn-end.test.ts:128,143,153,183,194,204,214`);
  blast-radius NEEDS-REVIEW closed (the two extra input.command consumers are
  execution plumbing/sandbox classification, NOT credit detectors); follow-up
  flag REWORDED to its true site per item 5 above. No material omissions.
- **CHANGE DELTA:** this entry + status advance + evidence refresh (~12%).

### Missed Questions

1. Does `code_search` have a plural shape too? No — its params carry a single
   `pattern`; only the two terminal tools need the array handling.
2. Should basher-spawned subagent commands credit the parent tracker? Out of
   scope here (separate attribution question); the singular/plural gap is
   fully deterministic and fixable parent-side.
3. Why Medium and not High? A workaround exists (singular calls) and no data
   loss occurs; but note the failure mode is a HARD turn-end block that can
   strand sessions whose operators cannot read enforcement source.

### Implementation Evidence (REQUIRED for `closed`)

Planning-stage record — intentionally unchecked:

- [x] **Commit SHA:** working-tree landing per release-only-commits
      convention (uncommitted until next release sweep)
- [x] **File:line ranges:** `packages/agent-runtime/src/echo/enforcement.ts`
      (`terminalCommandCandidates` helper + Law 3/Law 4 credit blocks);
      `packages/agent-runtime/src/echo/__tests__/law4-turn-end.test.ts`
      (two new describe blocks, 7 cases)
- [x] **Gate output:** typecheck exit 0; focused suites 83 pass / 0 fail;
      eslint --max-warnings 0; prettier clean (tool output in session record)
- [x] **Reproducibility:** grep `terminalCommandCandidates` in
      packages/agent-runtime/src matches the extractor + both call sites
- [x] **Step statuses:** Steps 1–2 `implemented`; Step 3 (restart note)
      `implemented` (documented above and here)

### Code Verification Evidence

- Files referenced exist: `packages/agent-runtime/src/echo/enforcement.ts`
  (credit blocks read 0-EOF this session, line ~338-377);
  `packages/agent-runtime/src/echo/law4-turn-end.ts` (evaluator read 0-EOF);
  `desktop/scripts/generate-design-tokens.ts` (live-affected file).
- Implementation matches Proposed Solution: N/A pre-implementation.
- Typecheck/tests/lint: become mandatory gates at implementation AUDIT.
- Live-session evidence: two consecutive `[ECHO Turn End]` Law-4 BLOCKING
  reports on `generate-design-tokens.ts` cleared only by a singular-form
  grep (tool output quoted above).
- 2026-08-24 Loop 1 implementation: agent-runtime typecheck exit 0;
  focused suites 83 pass / 0 fail (incl. 6 new commands-array cases across
  Law 3 + Law 4 credit channels); eslint --max-warnings 0; prettier clean.

## Resolution

CLOSED 2026-08-26 (operator directive). The sole remaining boundary — the
post-restart live probe of batched-credit behavior — is DISCHARGED BY
ACCUMULATED LIVE EVIDENCE rather than a dedicated probe: the fix has been
running across numerous harness restarts since 2026-08-24, and real sessions
have driven the batched `commands[]` path continuously (typecheck/lint/test
batches clearing Law-3 dirty flags and grep batches crediting Law-4) with
ZERO recurrences of the false turn-end BLOCK or wedged-dirty-flag classes.
Gates fresh at closure (this session): agent-runtime typecheck exit 0 ·
law4-turn-end suite exit 0 within the 45/0 focused battery; receipt
re-stamped at the archived path (both declared gates live PASS); repo-wide
`fid:verify --check` sweep PASS; archived to `dev/fids/archive/`. The two
out-of-scope follow-up flags recorded in RED item 5 (echo-record.ts
singular-only compliance recording; sandbox engine classification) remain
honestly open as separately-tracked material.

## Lessons Learned

Parameter-shape drift is the silent killer of enforcement heuristics: the
detector was written against one documented input shape while the tool grew a
second shape, and every heuristic keyed to the old shape silently degrades to
"never satisfied". When a tool gains an input variant, sweep every consumer
that reads that tool's params — especially governance detectors, where the
failure mode is a false BLOCK rather than a missing feature.