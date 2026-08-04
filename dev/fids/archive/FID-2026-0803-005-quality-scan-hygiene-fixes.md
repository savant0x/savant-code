# FID: Quality Scan Hygiene Fixes — Config Drift, Checkpoint Error Path, Assertion/Cast Cleanup

**Filename:** `FID-2026-0803-005-quality-scan-hygiene-fixes.md`
**ID:** FID-2026-0803-005
**Severity:** medium
**Status:** verified
**Created:** 2026-08-03
**Author:** Savant

**Summary:**
Address the findings of the codebase quality scan (ECHO compliance / performance / code quality /
robustness): (E1) `protocol.config.yaml` version drift (`0.0.15` vs `0.0.16`); (P1a) a latent
data-loss corner in the checkpoint safety net where `captureSnapshot`'s catch-all conflates `ENOENT`
with any other read failure and would make `restoreTurn` DELETE an existing file it merely failed to
read; (P1b) documented by-design rationale for the checkpoint store's synchronous IO (no code change);
(C1) redundant `agentTemplate!` non-null assertions; (C2) an unnecessary `as string[]` cast; (C3) an
unsafe `generator!` that masks a real `undefined` path from an `eval`'d handleSteps function; (C4) a
silent `catch {}` on tool-call input JSON parsing.

---

## Environment (RED — findings with evidence)

### E1 — LOW — protocol.config version drift

`protocol.config.yaml:11` declares `version: '0.0.15'`. `VERSION` (file) and the release manifests
(`package.json`, `sdk/package.json`, `cli/package.json`, `cli/release/package.json`) are all `0.0.16`.
The field is advisory (only `perfection_loop.max_iterations` is consumed at runtime per the file's own
comments), but the config is the machine-readable contract and should track the release.

### P1a — MEDIUM — checkpoint capture conflates ENOENT with all read failures (latent data loss)

`packages/agent-runtime/src/tools/handlers/tool/checkpoint-store.ts:151-156`:

```ts
try {
  buffer.files.set(filePath, fs.readFileSync(filePath, 'utf8'))
} catch {
  // File doesn't exist yet (creation) — record null ⇒ delete-on-restore.
  buffer.files.set(filePath, null)
}
```

`content: null` is the documented "file was created this turn" marker — `restoreTurn` (same file,
`:330-337`) DELETES such files. Any non-`ENOENT` read failure — `EACCES`, `EISDIR`, `EMFILE`,
permission sandbox denial — is indistinguishable here and would be recorded as `null`, so a rewind
would **delete a file that exists but could not be read at capture time**. This is a swallowed-error
violation (Law 14 / anti-pattern "Swallowed errors") inside the edit-safety net — the one subsystem
where silent misbehavior is worst. Additionally, if a later write to the same path in the same turn
succeeds where the first capture failed, retrying would capture *mid-turn* content as the "turn-start"
state, violating the FID-2026-0803-004 first-capture-wins invariant.

### P1b — INFO — checkpoint sync IO is correct by design (no change)

`captureSnapshot`/`closeTurn`/`prune` use sync `fs` (`readFileSync`, `writeFileSync`, `readdirSync`,
`rmSync`). Reviewed 0-EOF; the sync choice is intentional and correct:

- Capture must complete **before** the write dispatches — converting to async risks a race where a
  later write lands before the capture resolves, silently breaking rewind correctness (worse than the
  blocking cost).
- Cost is bounded by dedup: `buffer.files.has(filePath)` is checked **before** `fs.readFileSync`
  (`:146-150`, the FID-004 lesson), so each unique file is read at most once per turn.
- `closeTurn`/`listTurns`/`getTurn` run CLI-side (rewind picker, `use-send-message`), not on the agent
  loop; `captureSnapshot` is the only sync call on the agent hot path, at most once per touched file.
- Captured files are typical source files (small). The reads are sub-millisecond against a loop that
  waits hundreds of ms on LLM calls.

No code change; this rationale is recorded so the concern is not re-flagged.

### C1 — LOW — redundant non-null assertions

`packages/agent-runtime/src/run-agent-step.ts:157,163,164` — `agentTemplate!` ×3. The enclosing
`additionalToolDefinitions` declares `agentTemplate: AgentTemplate` (required, non-nullable, verified
in the signature at `:145-149`). The `!` is noise; no type-level purpose.

### C2 — LOW — unnecessary type assertion

`packages/agent-runtime/src/tools/tool-executor.ts:941` —
`!(agentTemplate.toolNames as string[]).includes(toolCall.toolName)`. `toolNames` is typed
`(ToolName | (string & {}))[]` (`common/src/types/agent-template.ts:134`); `ToolName` is a string
literal union (`common/src/tools/constants.ts:120`), so `ToolName | (string & {})` widens to `string`
and the array is already `string[]`-assignable. `toolCall.toolName` is `string` (SavantCodeToolCall),
so `.includes(...)` typechecks without the cast.

### C3 — LOW/MEDIUM — unsafe `!` on a possibly-undefined generator

`packages/agent-runtime/src/run-programmatic-step.ts:256` — `generator!.next(...)`. `generator` is
`StepGenerator | undefined` sourced from the module map `runIdToGenerator` (`:40,169`). It is
initialized when absent (`:172-208`), but `generatorFn` may be `deserializeHandleSteps(...)` — an
`eval`'d, cast function (`:44-48`) that can return `undefined` at runtime. The `!` dereferences
silently; the resulting `TypeError` is caught by the outer catch and misreported as a generic
"Error executing handleSteps" with a misleading message. A definite-assignment guard yields a
diagnosable error instead (Law 6 / Law 14).

### C4 — LOW — silent catch on tool-call input parsing

`packages/agent-runtime/src/tool-stream-parser.ts:122` — `catch {}` around `JSON.parse` of a
string-typed tool-call `input`. The pass-through behavior is intentional (executor surfaces a clear
error — documented at `:117-119`), but the failure is invisible to analytics/traces. A `Logger` is
already in scope (`:77,95`), so a debug trace costs nothing.

---

## Root Cause

These are hygiene drift findings from an ongoing quality program, not a single defect. The one
substantive item (P1a) comes from an over-broad `catch` written to distinguish "file doesn't exist"
from "anything else" without actually discriminating the error code — a classic swallowed-error
shortcut in a subsystem whose entire purpose is safety.

## Proposed Solution (after approval — audit-only now)

**E1** — `protocol.config.yaml:11`: `version: '0.0.15'` → `version: '0.0.16'`.

**P1a** — `checkpoint-store.ts`: discriminate the error code using the repo's established narrowing
pattern (`common/src/util/paths.ts:72-78` — `'code' in err && typeof err.code === 'string'`, Law 11):

- `ENOENT` → record `null` (unchanged; file created this turn ⇒ delete-on-restore).
- Any other error → add the path to a new per-turn `skippedPaths: Set<string>` on `OpenTurnBuffer`
  and leave it out of `files`. `captureSnapshot`'s dedup becomes
  `buffer.files.has(filePath) || buffer.skippedPaths.has(filePath)`, so the path is never re-captured
  mid-turn (preserves the first-capture-wins invariant) and `restoreTurn` never touches it — the file
  is simply not restorable that turn, which is strictly safer than deleting it.

**P1b** — no code change; rationale recorded above.

**C1** — `run-agent-step.ts:157,163,164`: drop the three `!`.

**C2** — `tool-executor.ts:941`: `agentTemplate.toolNames.includes(toolCall.toolName)` (drop the cast).

**C3** — `run-programmatic-step.ts`: after the `if (!generator)` initialization block, add:

```ts
// Definite-assignment guard: generatorFn (possibly eval'd) may return undefined;
// fail diagnosably rather than dereferencing undefined in the loop below.
if (!generator) {
  throw new Error(
    `handleSteps for agent ${template.id} did not return a generator`,
  )
}
```

and change `generator!.next(` → `generator.next(`.

**C4** — `tool-stream-parser.ts:120-124`: log the parse failure at debug level:

```ts
} catch (error) {
  logger.debug(
    {
      toolName,
      inputLength: input.length,
      error: getErrorObject(error),
    },
    'Tool-call input was a string that failed JSON.parse; passing through as string — the executor will surface a clear error',
  )
}
```

plus import `getErrorObject` from `@savant-code/common/util/error` (already the source of the
`PromptResult` import in this file).

**Non-goals:** no async conversion of the checkpoint store (P1b rationale); no change to the
`closeTurn` best-effort persistence swallow (documented, host-side, intentionally non-fatal); no
general empty-catch sweep beyond C4/P1a (the scan found no other production empty catches in the
agent-runtime hot path).

## Files To Be Changed (implementation stage)

- `protocol.config.yaml` (E1)
- `packages/agent-runtime/src/tools/handlers/tool/checkpoint-store.ts` (P1a)
- `packages/agent-runtime/src/run-agent-step.ts` (C1)
- `packages/agent-runtime/src/tools/tool-executor.ts` (C2)
- `packages/agent-runtime/src/run-programmatic-step.ts` (C3)
- `packages/agent-runtime/src/tool-stream-parser.ts` (C4)
- Tests: `checkpoint-store.test.ts` (P1a), `sandbox-generator.test.ts` or
  `run-programmatic-step.test.ts` (C3, only if an existing assertion depends on the old TypeError
  message — check at implementation)

## Verification

- [x] Recon: versions compared (`VERSION`/manifests `0.0.16` vs `protocol.config.yaml:11` `0.0.15`)
- [x] `checkpoint-store.ts` read 0-EOF; capture call-graph verified: `captureSnapshot` called from
      `tool-executor.ts:461` (write gate); `openTurn`/`closeTurn` from
      `cli/src/hooks/use-send-message.ts:576/967`; `restoreTurn` delete-on-null confirmed at
      `:330-337`
- [x] `run-programmatic-step.ts` read 0-EOF; `generator` narrowing + `generatorFn` eval path confirmed
- [x] `ToolName` definition (`common/src/tools/constants.ts:120`) and `toolNames` type
      (`agent-template.ts:134`) confirm C2 cast is removable
- [x] `Logger.debug(data, msg)` contract confirmed (`common/src/types/contracts/logger.ts`); `logger`
      in scope at `tool-stream-parser.ts:77,95`
- [x] Repo ENOENT pattern confirmed (`common/src/util/paths.ts:72-78`) for Law-6-compliant narrowing
- [x] No implementation files modified during this audit (audit-only)
- [x] Implementation: agent-runtime suite 583 pass / 0 fail (incl. 2 new P1a regression tests), 4-way
      typecheck (sdk/common/agent-runtime/cli), `bun x eslint . --max-warnings 0` exit 0, `bun run lint:md`
      exit 0, Prettier clean on all changed files
- [x] Implementation: independent AUDIT via code-reviewer (clean — no CRITICAL/HIGH/MEDIUM; skipped-capture
      observability noted as accepted documented debt); CHANGELOG entry added; FID archived

## Perfection Loop

### Loop 1

- **RED:** Completed 2026-08-03 — four-pass scan of `packages/agent-runtime/src`, `cli/src`,
  `protocol.config.yaml`, and FID hygiene. Findings E1/P1a/P1b/C1/C2/C3/C4 catalogued with
  file:line evidence above. All claims verified by direct code reads and greps; the `any`/`as`
  inventory resolved clean except the cited cast (C2) and test-only casts (accepted convention).
- **GREEN:** Sequential thinking over each finding (see Summary): E1 one-line config bump; P1a
  errno-discriminating capture with a per-turn skip set (follows the `paths.ts` narrowing pattern);
  P1b documented by-design; C1/C2 assertion/cast removal; C3 explicit definite-assignment guard
  replacing the unsafe `!`; C4 in-scope `logger.debug`. Answers to the mandatory missed-question
  check ("What questions should I have asked when this FID was created, but failed to?"):
  1. *Is the checkpoint sync IO actually harmful?* — No: ordering invariant + dedup bounds it
     (P1b). Not converting to async.
  2. *Does the empty catch cause real damage?* — Yes, in the worst place: a failed read recorded as
     `null` deletes an existing file on restore (P1a).
  3. *Are the `!` assertions load-bearing?* — C1: no (non-nullable param). C3: yes, and it hides a
     genuine `undefined` path → replace with a guard, not a silent removal.
- **AUDIT:** Document-audit before implementation: C1/C2 removals are typecheck-verifiable (the
  compiler is the arbiter — if the `!`/cast were needed, `bun run typecheck` fails); C3 guard is
  reachable-verified against the module map and eval path; P1a fix cross-checked against the
  existing checkpoint tests' semantics (first-capture-wins, null-deletes) and the `paths.ts`
  narrowing idiom; C4 logging uses the existing contract. Call-graph evidence pasted in Verification.
  Zero new functions or config fields introduced — the AUDIT grep requirement is satisfied by the
  capture call-graph above.
- **SELF-CORRECT:** Initial scan framed P1 as "sync IO on the spawn path (MEDIUM)". Reading
  `checkpoint-store.ts` 0-EOF corrected this: the sync cost is bounded and correct (downgraded to
  P1b INFO), while the real defect — the non-ENOENT catch-all — was found in the same lines
  (elevated to P1a MEDIUM). C3's fix also evolved from "drop the `!`" to "explicit guard" once the
  eval'd-generator path was confirmed.

## Lessons Learned

1. An empty `catch` in a safety-net subsystem is not "best-effort" — it is a silent misclassification
   waiting to delete user files. Discriminate error codes (ENOENT vs the rest) even when the fallback
   looks safe.
2. Perf findings on hot paths deserve a 0-EOF read before severity is assigned: the same lines that
   looked like a perf problem held the actual correctness bug.

## Resolution

- **Fixed By:** Savant (operator-approved implementation — FID presented for approval, approved, then
  implemented)
- **Fixed Date:** 2026-08-03
- **Fix Description:** E1 — `protocol.config.yaml` project version `0.0.15` → `0.0.16`. P1a —
  `checkpoint-store.ts` `captureSnapshot` now narrows the read error via the `paths.ts` idiom: `ENOENT`
  records the delete-on-restore `null` marker; any other failure (EACCES/EISDIR/EMFILE) adds the path to a new
  per-turn `skippedPaths` set (checked in the dedup gate, never serialized, never restored) so a rewind can
  never delete an existing file that merely failed to read. P1b — sync IO documented as correct by design
  (no change). C1 — three redundant `agentTemplate!` assertions removed in `run-agent-step.ts`. C2 —
  `as string[]` cast dropped in `executeCustomToolCall` (`tool-executor.ts`); the native gate already used
  the cast-free form. C3 — `generator!` replaced with an explicit definite-assignment guard in
  `run-programmatic-step.ts` (throws a diagnosable error when an eval'd handleSteps function returns
  undefined). C4 — `tool-stream-parser.ts` logs the tool-call input JSON.parse failure at debug level via the
  in-scope `Logger` (`getErrorObject` payload), replacing the invisible `catch {}`.
- **Tests Added:** `checkpoint-store.test.ts` +2 — (1) a non-ENOENT read failure (EISDIR directory path) is
  never recorded as `null` and restore leaves the directory untouched; (2) a skipped path stays skipped for
  the rest of the turn while normal files are still captured. C3 verified against existing suites (no test
  asserted the old TypeError message — the `sandbox-generator` ReferenceError test is a different path).
- **Verified By:** Savant — independent AUDIT via code-reviewer (clean — no CRITICAL/HIGH/MEDIUM; one LOW
  note, skipped-capture observability, accepted as documented debt since the store deliberately has no
  logger). Gate suite: agent-runtime 583 pass / 0 fail, 4-way typecheck (sdk/common/agent-runtime/cli) 0
  errors, `bun x eslint . --max-warnings 0` exit 0, `bun run lint:md` exit 0, Prettier clean.
- **Commit/PR:** None (working tree)
- **Archived:** Yes
