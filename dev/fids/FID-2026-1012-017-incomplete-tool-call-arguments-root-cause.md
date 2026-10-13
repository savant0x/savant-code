# FID: The incomplete-tool-call class has never been fixed at its source

**Filename:** `FID-2026-1012-017-incomplete-tool-call-arguments-root-cause.md`
**ID:** FID-2026-1012-017
**Severity:** critical
**Status:** fixed
**Created:** 2026-10-12 20:15
**Automation level:** 3
**YAGNI-Compliance:** Verified
**Master FID:** FID-2026-1012-022 (The failure-class remediation program)
**Depends On:** FID-2026-1012-024

---

## Summary

The `Incomplete arguments for tool X` family is the single largest defect class in this
repository: **193 of 559 recorded tool failures (35%)** across **nine tools and more than 40
distinct sessions**, and it fired **16 times today (2026-10-12)**. The ledger already learned
this class on **2026-08-16** — the lesson "A retry that re-emits the same oversized tool call
is not recovery" — and on 2026-10-12 that lesson was **retired out of the boot read** into
`dev/LEARNINGS-RETIRED.md:1373` while the class was still firing. Every mechanism in the tree
acts *after* the arguments have already been cut: the runtime steers and re-sends with a
three-strike budget, so the class can only be retried, never prevented.

This record owns **one lane of the remediation program `FID-2026-1012-022`** — 18 classes and 193
records of its 68-class census — and fixes the class at its source, replacing one-off verification
with a recurrence assertion.

## Environment

- **OS:** Windows 11 (win32), Git Bash
- **Language/Runtime:** TypeScript 5.5.4, Bun 1.3.14
- **Tool Versions:** `ai` 5.0.122 (the classification boundary cited by FID-2026-1012-009)
- **Commit/State:** `main` @ `bee0610d`

## Detailed Description

### Problem

A tool call whose arguments never finish arriving is answered with advice that cannot work for
the most common cause of it. When the output budget cut the arguments mid-document, the only
lever the runtime has is what it tells the model next, and for that cause "retry the tool call
with a complete arguments object" prescribes re-sending the payload that was already too large.
The class is therefore self-sustaining: the model is told to re-emit an oversized call, the
call is cut again, and the strike ladder eventually fails the turn.

The measurement is unambiguous, and it is not historical. `dev/experiences/raw-traces.jsonl`
records **193** such failures across nine tools. Six of them are still live in the last two
days, three of them **today**:

- `read_files` — 48 hits / 19 sessions / last 2026-10-12
- `write_file` — 23 hits / 20 sessions / last 2026-10-12
- `run_readonly_command` — 15 hits / 8 sessions / last 2026-10-12
- `str_replace` — 28 hits / 18 sessions / last 2026-10-11
- `spawn_agents` — 17 hits / 15 sessions / last 2026-10-11
- `read_url` — 27 hits / 3 sessions / last 2026-10-10
- `write_todos` 7 / `suggest_followups` 6 / `basher` 5 — 13 hits / 5 sessions, last 2026-10-11

The class has also been worked on, twice, without moving: FID-2026-1012-007 windowed
`read_files` at the fetch boundary (the tool's large-file escape hatch), and FID-2026-1012-009
classified the truncation cause so the advice is truthful. Both landed; `read_files` still
fired 48 times and `write_file` 23.

### Expected Behavior

A tool call that cannot fit must not be emitted as one call. The budget for a tool's arguments
is knowable before the model writes them, so the emit path should shape the payload — splitting
a bulk write into an append/chunked sequence, or a read into a window — and a cut payload must
never be answered with "retry with a complete arguments object". Once the class stops recurring
in the trace ledger for a full window, it earns a lesson; until then it is an open defect, not
a lesson.

### Root Cause

**Nothing bounds what the model emits.** Every present mechanism is downstream of the cut:

- `packages/agent-runtime/src/run-agent-step/constants.ts` —
  `NATIVE_TOOL_CALL_RECOVERY_MAX_STRIKES = 3`, `NATIVE_TOOL_CALL_STEERING_MESSAGES`,
  `getSteeringMessage`: recovery is steer-and-retry, which by construction re-sends the class.
- `sdk/src/impl/llm/errors.ts:142-146` — the three advice variants, including the
  re-send text that survives for the non-truncation causes.
- `packages/agent-runtime/src/tools/stream-parser/error-chunk.ts` — where that text is wrapped
  for the model and the strike is spent.
- `sdk/src/impl/llm/stream-error-chunk.ts` — `classifyInvalidToolCall`, the vendor-side
  classifier (partial fix from FID-2026-1012-009).

There is no per-tool argument budget anywhere on the emit path, and no legal shape for an
oversized bulk write to take other than "one enormous call". The lessons themselves show the
loop failing in both directions: the fix was recorded after the fact, and the record was then
retired while its class still ran.

### Evidence

```text
$ bun -e '<aggregate dev/experiences/raw-traces.jsonl by toolName+errorFirstLine>'
records=559  classes=70  distinct sessions=195
classes at the repo's >=3-distinct-session promotion bar (FID-2026-1005-003): 27

$ grep -c 'Incomplete arguments for tool' dev/experiences/raw-traces.jsonl
193
$ grep 'Incomplete arguments for tool' dev/experiences/raw-traces.jsonl | grep -c '2026-10-12'
16

$ grep -n 'A retry that re-emits the same oversized tool call' dev/LEARNINGS-RETIRED.md
1373:## Lesson: A retry that re-emits the same oversized tool call is not recovery
      Date: 2026-08-16 — retired out of the boot read by commit ac4bad20 (2026-10-12)
```

The class is 35% of every failure this repository has captured, and the file that was supposed
to drive its fix archived the lesson instead.

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/run-agent-step/constants.ts` (the strike ladder and steering text)
- `packages/agent-runtime/src/tools/stream-parser/error-chunk.ts` (wrapping and strike spend)
- `sdk/src/impl/llm/errors.ts` (the advice selection)
- `sdk/src/impl/llm/stream-error-chunk.ts` (`classifyInvalidToolCall`)
- The bulk-write and bulk-read tool handlers, which need a legal shape for a payload that does
  not fit in one call

### Risk Level

- [x] Critical: the class suppresses turns and is the largest source of wasted work in the
  system; it is also the reason the lessons ledger grows without shrinking.

## Proposed Solution

### Approach

Loop 2 and `docs/design/perfection-loop-2026-10-12.md` govern implementation where
they correct the original plan. No age-based class disposition or repair is implied.

Bound the payload before it is emitted, not after it is cut. Three levers, in order of value:
(1) an explicit per-tool argument budget the model is given and can plan against; (2) a legal
split shape for the two tools that cannot avoid large payloads (`write_file` / `str_replace`
append-path; `read_files` window path already exists); (3) removal of the re-send advice for
every truncation cause, so no path tells the model to repeat the failing call. Verification is
a **recurrence assertion** measured against the trace ledger, not a green suite.

### Steps

1. Measure the current class in the RED below and record the numbers verbatim; re-run the
   aggregation at implementation time so the before/after is the same instrument.
2. Define a per-tool argument budget constant with the emit path honoring it, and expose the
   budget to the model's tool schema or prompt so it can plan a split.
3. Give `write_file` and `str_replace` an append/chunked shape, and confirm the existing
   `read_files` window path (FID-2026-1012-007) is reachable from the class's actual call
   shapes — the 48 hits say the window was not used when it mattered.
4. Delete the re-send advice from every truncation branch so no cause can select it, keeping
   the split-the-work advice as the single truncation answer.
5. Replace one-off verification with a recurrence assertion: the class must not appear in
   `dev/experiences/raw-traces.jsonl` for the next window, asserted by a probe that fails when
   it does.
6. Only after the assertion holds, write the lesson — and write it against the class, not the
   incident.

### Verification

- The same aggregation used in RED, re-run at implementation and recorded in this record's
  Code Verification Evidence, showing the class count for the window after the fix.
- A recurrence probe (exit 0 clean / 1 with issues) declared as the record's gate when the
  status reaches `fixed`, plus the workspace typechecks and `quality`.
- A negative control: the strike ladder still ends a genuinely unrecoverable call, so the fix
  does not merely raise the retry ceiling.

**Not a gate:** the recurrence assertion. It reads the capture rather than this record's artifacts, and
no class can be asserted clean until the 14-day / three-session observation window runs; it becomes the
closure gate when that window completes (`FID-2026-1012-021` owns the machinery that wires it into the
repository gate).

## Verification Gates

- gate: test sdk/src/__tests__/tool-argument-budget.test.ts
- gate: test sdk/src/impl/__tests__/llm-native-tool-call.test.ts
- gate: test sdk/src/impl/__tests__/llm-native-tool-call-schema-issue.test.ts
- gate: test packages/agent-runtime/src/tools/handlers/tool/__tests__/chunked-write.test.ts
- gate: test packages/agent-runtime/src/tools/handlers/tool/__tests__/chunked-write-commit.test.ts
- gate: test packages/agent-runtime/src/tools/stream-parser/__tests__/error-chunk-steering.test.ts
- gate: test packages/agent-runtime/src/tools/stream-parser/__tests__/native-failure-deduper.test.ts
- gate: test common/src/util/__tests__/experience-classes.test.ts
- gate: typecheck common
- gate: typecheck sdk
- gate: typecheck packages/agent-runtime
- gate: quality

### Verification Receipt

- fingerprint: sha256:3dbd18a8aacec58fc0e9152957e0195b1ed82236d2b0aedd0f4c3939dcc99517
- verified: 2026-10-13T19:15:43.972Z
- test sdk/src/__tests__/tool-argument-budget.test.ts: exit 0
- test sdk/src/impl/__tests__/llm-native-tool-call.test.ts: exit 0
- test sdk/src/impl/__tests__/llm-native-tool-call-schema-issue.test.ts: exit 0
- test packages/agent-runtime/src/tools/handlers/tool/__tests__/chunked-write.test.ts: exit 0
- test packages/agent-runtime/src/tools/handlers/tool/__tests__/chunked-write-commit.test.ts: exit 0
- test packages/agent-runtime/src/tools/stream-parser/__tests__/error-chunk-steering.test.ts: exit 0
- test packages/agent-runtime/src/tools/stream-parser/__tests__/native-failure-deduper.test.ts: exit 0
- test common/src/util/__tests__/experience-classes.test.ts: exit 0
- typecheck common: exit 0
- typecheck sdk: exit 0
- typecheck packages/agent-runtime: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED (2026-10-12)

- **RED:** 193 records of `Incomplete arguments for tool X` across nine tools and 40+ distinct
  sessions — 35% of all 559 captured failures — with 16 dated today (`read_files` 48/19 and
  `write_file` 23/20 both live on 2026-10-12). The class was learned on 2026-08-16 and its
  lesson was retired out of the boot read on 2026-10-12 while the class still fired.
- **GREEN:** bound the payload at the emit path (per-tool budget + a legal split shape for the
  bulk tools), remove the re-send advice for every truncation cause, and verify with a
  recurrence assertion over the trace ledger.
- **AUDIT:** the aggregation is reproducible from this record's Evidence block; the mechanism
  paths cited are read at `bee0610d` and exist; the retired lesson was located by `grep -n` in
  `dev/LEARNINGS-RETIRED.md` and its 2026-08-16 date read from the entry itself.
- **ADVERSARIAL:** (a) Does this collide with FID-2026-1012-009? No — 009 made the *advice*
  truthful for two of three causes; this record removes the remaining re-send path and bounds
  *emission*, which is a different layer. (b) Could a budget simply invite smaller, worse calls?
  The budget is a planning constraint with a split shape, and the negative control keeps the
  ladder honest. (c) Is the trace a fair instrument? It records the first line of each failure
  and is written by a fail-open hook, so a *drop* in count is strong evidence while a *rise*
  may be undercounted — the assertion is therefore stated as "no recurrence in the window",
  not as an exact number. (d) Does "no re-send advice" hide a real service error? No: the
  classification already distinguishes causes, and the failure still surfaces.
- **CHANGE DELTA:** 0% source — this record made no code change; it is a converged
  pre-implementation design.

### Loop 2 — Current-tree review and self-correction (2026-10-12)

- **RED:** Census remains 18 classes / 193 records, 16 on October 12; nine tools is
  only a subset. Known truncation already receives split advice. Stream capture keeps
  `chunk.message` but drops cause metadata; the line cannot establish all sub-causes.
- **GREEN:** Apply `docs/design/perfection-loop-2026-10-12.md`: bounded arguments,
  atomic revision-checked bulk staging, and provider/child-specific recovery. Preserve
  schema-error recovery; do not infer truncation from every JSON parse error. Repair
  spawn steering that assumes shared history even for the no-history Recorder.
- **AUDIT:** Runtime already forwards `maxOutputTokens`; no missing streaming mapper
  is claimed. `stream-parser.ts:203` captures only message/tool identity. Baseline gates
  prove these paths exist, not that the class stopped.
- **ADVERSARIAL / missed question:** Can changed advice or renamed errors prove repair?
  No. Assert causes across all 18 owned shapes with exposure and capture coverage.
  The shared review names the observation window and exact planned test/probe paths.
- **CHANGE DELTA:** Planning correction only; all emission classes remain unresolved.

### Loop 3 — Implementation pass (2026-10-12, operator-authorized)

- **RED (re-measured this pass, the instrument of FID-2026-1012-022):** `bun
  scripts/experiences-recurrence.ts` reports the record's 18 owned keys unresolved at their recorded
  volumes — `read_files` 48, `str_replace` 28, `read_url` 27, `write_file` 23, `spawn_agents` 17,
  `run_readonly_command` 15, `write_todos` 7, `suggest_followups` 6, `basher` 5, `run_terminal_command`
  4, `transition_parameter` 3, `forge`/`grep`/`transition_phase` 2 each, and one each for `...`,
  `apply_patch`, `savant_code_tool_call`, `write_files`; `grep -c 'Incomplete arguments for tool'
  dev/experiences/raw-traces.jsonl` = **193**, 16 of them dated 2026-10-12. The class is live, not
  historical.
- **GREEN (implemented this pass):** the emit path is bounded and no branch prescribes a re-send.
  `common/src/util/tool-argument-budget.ts` derives a per-tool argument budget from the model's own
  output allowance, measures serialized arguments fail-closed, and states the bound in one sentence
  (`describeArgumentBudget`); `sdk/src/impl/llm/errors.ts` states that budget in both truncation causes
  and replaces the unproven-cause re-send prescription with schema-first guidance (schema recovery
  preserved, decision table in `docs/design/perfection-loop-2026-10-12.md` §017);
  `sdk/src/impl/llm/stream-error-chunk.ts` and `stream.ts` forward the request's `maxOutputTokens` into
  the classifier; `sdk/src/run/tool-call-argument-ceiling.ts` refuses a call above the ceiling before
  any override, MCP client or local handler runs, so nothing is applied partially;
  `packages/agent-runtime/src/run-agent-step/constants.ts` no longer tells a parent that every spawned
  agent inherits the conversation — the Recorder runs with `includeMessageHistory: false`, so the advice
  now names both context policies.
- **AUDIT (gates run in this pass, output pasted in Code Verification Evidence):** `bun run typecheck`
  (all workspaces + `scripts/`) exit 0; the SDK suite 647 pass / 0 fail; the agent-runtime suite 2,048
  pass / 0 fail; the stream-parser steering suites 23 pass / 0 fail; `bun run validate:repository` PASS
  (the two ratchet breaches this change first introduced — `stream.ts` and `tool-call.ts` over 300 lines
  — were repaired by extraction, not by suppression, and the FID-023 `quality` gate they reddened is
  green again); Prettier and ESLint clean on every changed file.
- **ADVERSARIAL:** (a) *Does the budget merely invite smaller, worse calls?* The budget is stated, not
  silently enforced, and a complete large payload is still executed below the ceiling — the negative
  control (`allows a complete payload below the ceiling`) pins that. (b) *Can a renamed error hide the
  class?* The class key is `toolName` + cause (`experienceClassIdentity`), so the assertion is on the
  key, not the rendered wording. (c) *Did any class stop?* **No claim:** no fix boundary exists for this
  record, so `fix-boundaries.json` stays empty and the horizon for all 18 keys remains `unresolved`.
- **STILL OPEN at the close of this pass — closed by Loop 4 below:** the third lever of the reviewed
  design — *bulk writes stage bounded chunks with revision/hash guards and commit once, failure leaving
  the target untouched* — was not implemented when this entry was written.
- **CHANGE DELTA:** ~0.7% of the record (source: 6 files under 300 lines, 3 new modules/tests).

### Loop 4 — Bulk-write staging (2026-10-12, same session)

- **RED:** the emitter's other half was still missing: a bulk write had no bounded representation, no
  guard against the file having moved on since the write was authored, and no failure mode other than
  "apply what arrived". The propose staging surface (`proposed-content-store.ts`,
  `propose-write-file.ts`) handed the whole payload straight to the proposal store.
- **GREEN (implemented):** `packages/agent-runtime/src/tools/handlers/tool/chunked-write.ts` stages a
  write as bounded chunks with two hashes — `baseRevision` (the content the write was authored
  against) and `revision` (what the chunks must reproduce). The chunk size is the tool's own argument
  budget, the refusal point is the shared `MAX_ARGUMENT_CHARS` ceiling, the staging state lives beside
  the proposed content it belongs to (so the store's resets and the suite's isolation cover it), and
  the guards are enforced at assemble/commit time: a changed base or an incomplete or tamper-mismatched
  staging exposes nothing and commits nothing.
- **AUDIT:** `packages/agent-runtime/src/tools/handlers/tool/__tests__/chunked-write.test.ts` — 15 pass
  / 0 fail, covering the plan's reassembly identity and unusable chunk sizes, the round trip, the
  revision guard, incomplete staging, the integrity guard, restaging against a different base, the
  ceiling refusal, "nothing staged", single-commit semantics, zero writes on a refused guard, staging
  kept for a retry when the commit fails, and the handler's exact staging sequence. Full agent-runtime
  suite 2,063 pass / 0 fail across 315 files; `bun run typecheck` exit 0; `validate:repository` PASS.
- **ADVERSARIAL:** (a) *Is a chunked staging just ceremony for a single call?* The guards are the
  value, not the chunking — an oversized payload is refused before it is staged, a stale write cannot
  be applied over another edit, and no partial staging can be read. (b) *Does the propose path now
  refuse legitimate large proposals?* Only above the shared 60,000-character ceiling, the same number
  the SDK execution seam refuses on; the per-tool budget is the chunk size, not the refusal point.
- **COVERAGE BOUNDARY, stated rather than implied:** the propose handler's own wiring is verified by
  typecheck and call-graph reachability (the handler requires the full tool-handler param set, which
  only the programmatic-step harness supplies — and that harness mocks the executor, so it would not
  exercise this path either). The staging semantics are unit-tested; the handler call site is not
  driven end-to-end by a test.
- **CHANGE DELTA:** ~0.35% of the record.

### Missed Questions

1. Should the budget live in the tool schema or in the prompt? → In the emit path first, so it
   is enforced rather than advised; exposing it to the model is a second step, because a
   schema-declared limit that nothing enforces is the same failure as a documented constraint
   with no test.
2. Why did the `read_files` window (FID-2026-1012-007) not reduce the class? → Unknown, and it
   is the first thing to measure at implementation: the window was built for the large-file
   escape hatch, and the 48 hits suggest the model's failing calls were not that shape. The fix
   must not assume the window is irrelevant.
3. Is "never re-send" correct for a payload that was cut by a transport fault rather than the
   output budget? → The classification already separates the causes it can see; where a cause
   is unknown the fail-closed default is the generic advice, so removing the re-send text must
   be paired with keeping that default truthful.

### Code Verification Evidence

> Implemented in two passes in one session: Loop 3 landed the emission budget, the truthful recovery
> text, the pre-execution ceiling and the spawn-steering repair; Loop 4 landed the bounded,
> revision-guarded bulk-write staging. The gate output below is the evidence for both.

- [x] Measurements re-checked: the aggregation over `dev/experiences/raw-traces.jsonl` returned
      559 records / 68 classes / 195 sessions (instrument: `toolName` + the first 70 characters of the
      error line, sensitivity table in `FID-2026-1012-022`), 193 `Incomplete arguments for tool` records, 16
      of them dated 2026-10-12, and the per-tool counts listed above; the retired lesson was
      located at `dev/LEARNINGS-RETIRED.md:1373` with its 2026-08-16 date.
- [x] Every cited mechanism path exists at `main` @ `bee0610d`
      (`run-agent-step/constants.ts`, `tools/stream-parser/error-chunk.ts`,
      `sdk/src/impl/llm/errors.ts:142-146`, `sdk/src/impl/llm/stream-error-chunk.ts`); the
      matrix that ranks this class is `docs/design/learnings-root-cause-matrix.md` §3 row 2 and
      §4 RC1.
- [x] **Emission budget implemented:** `common/src/util/tool-argument-budget.ts`
      (`toolArgumentBudget` / `measureSerializedArguments` / `assessToolArguments` /
      `describeArgumentBudget`), consumed by `sdk/src/impl/llm/errors.ts`,
      `sdk/src/impl/llm/stream-error-chunk.ts`, `sdk/src/impl/llm/stream.ts` and
      `sdk/src/run/tool-call-argument-ceiling.ts`; production callers confirmed by grep
      (`normalizeNativeToolCallStreamError` ← `classifyNativeToolCallError` ← `stream.ts:104`;
      `classifyInvalidToolCall` ← `stream.ts:266`; `refuseOversizedToolCall` ← `tool-call.ts`
      `handleToolCall`).
- [x] **Truthful recovery, verified by suite output:** the suite at
      `sdk/src/impl/__tests__/llm-native-tool-call.test.ts`
      — 15 pass / 0 fail, including *states the tool argument budget derived from the output
      allowance* (4,096-token allowance → `at most 8192 characters`), *states the default budget when
      no allowance is known* (16,384 characters), and the three schema-recovery cases that assert the
      re-send prescription is gone while schema correction remains.
- [x] **New budget suite:** the suite at `sdk/src/__tests__/tool-argument-budget.test.ts` — 11 pass / 0 fail
      (derivation, default on hostile allowances, short-tool share, floor/ceiling clamps, measurement,
      fail-closed cyclic handling, assessment, the stated sentence, and the ceiling refusal).
- [x] **Full gates this pass:** `bun run typecheck` exit 0 (13 workspaces + `scripts/`); SDK suite
      `647 pass / 0 fail` across 104 files; agent-runtime suite `2,048 pass / 0 fail` across 314 files;
      stream-parser steering suites `23 pass / 0 fail`; `bun run validate:repository` →
      `validation: PASS`; `bun x prettier --check` and `bun x eslint` clean on all changed files.
- [x] **Capture instrument green:** `bun scripts/experiences-recurrence.ts` → `563 records, 56 stable
      classes, 0 issues`, exit 0. The pass also surfaced one unowned class
      (`v1:run_readonly_command:command-exit:undetermined`, a command-exit shape owned by the capture
      lane) which is now registered to `FID-2026-1012-024`.
- [x] **Bulk-write staging implemented:** `packages/agent-runtime/src/tools/handlers/tool/chunked-write.ts`
      (staging state extended in `proposed-content-store.ts`, wired in `propose-write-file.ts`);
      the suites at `packages/agent-runtime/src/tools/handlers/tool/__tests__/chunked-write.test.ts` and
      `…/chunked-write-commit.test.ts` — 15 pass / 0 fail across the two.
- [x] **Not claimed:** any class having stopped recurring. No fix boundary is written, so every owned
      key reports `unresolved` and the 14-day/three-session observation window has not started.
- [x] **Loop 5 measured the opposite for four of the nineteen:** 20 post-fix rows after both fix
      commits (`suggest_followups` 17, `basher` 1, `transition_phase` 1, `browser_use` 1), all
      `errorClass: native-incomplete` and all carrying this lane's own budget text. The window cannot
      start for those classes, and the provider-side rejection is this lane's identified remaining work.

### Loop 5 — Recurrence check against the fix boundary (2026-10-13, automation level 3)

- **RED:** This record was `fixed` on the strength of its gates. Its own Boundaries said a reduction in
  the recorded count is claimed only after the recurrence assertion window passes — and no measurement
  had ever been taken against the fix commits, so "fixed" and "the class stopped" were
  indistinguishable for all nineteen classes.
- **Method:** FID-2026-1012-024's instrument applied to this lane's owned classes, with the boundaries
  taken from the commits themselves (`git log -1 --format=%cI`) rather than from a date
  approximation: `972c389d` @ 2026-10-13T03:44:28Z (emit path), `f46af839` @ 2026-10-13T04:05:07Z
  (staging). Rows were recounted from `dev/experiences/raw-traces.jsonl` with `experienceClassIdentity`.
- **GREEN — MEASURED RECURRENCE: four classes did not stop.** 20 of this family's rows are dated after
  **both** fix commits, in **one session** (`40c8bf08…`), inside a single **6-second burst**
  (2026-10-13T05:08:46.967Z → 05:08:52.666Z):

| class | post-fix rows | sessions |
|---|---|---|
| `suggest_followups:incomplete-arguments:unexpected` | 17 | 1 |
| `basher:incomplete-arguments:unexpected` | 1 | 1 |
| `transition_phase:incomplete-arguments:unexpected` | 1 | 1 |
| `browser_use:incomplete-arguments:unexpected` | 1 | 1 |

  The horizon rule is unambiguous: `postFixFailures > 0` ⇒ `recurred`. These four classes have **not**
  stopped recurring, and no repair may be claimed for them.

- **The fix is live inside those rows, which locates the remaining half.** All 20 carry
  `errorClass: native-incomplete`, and each first line contains the recovery text this lane shipped —
  *"One tool call's arguments may occupy at most 8192 characters (derived from this model's
  8192-token output allowance)"*. So the emit-path lever is deployed and stating its budget, and the
  failure still occurs: the **provider** rejects the call's arguments ("nothing observed indicates
  truncation"), which a local ceiling cannot prevent by refusing oversized local calls. That second
  half is newly identified here, not previously known.
- **The other fifteen classes are unobserved, not clean.** They have zero post-fix rows, but the family
  has only three post-fix sessions and under a day of elapsed time against a 14-day / three-session
  requirement. Silence is not evidence — the rule this program exists to enforce.
- **AUDIT:** the 20 rows were read in full (`errorClass`, `finishReason`, `argumentsTruncated` presence,
  exact line text). Root typecheck, ESLint, `validate:repository`, the scripts suites and the census
  were re-run green on the tree carrying this note.
- **ADVERSARIAL:** (a) *Were these rows produced by the fix's own author session?* No — they are
  1 h 03 m after the staging commit, in a session id absent from both fix commits. (b) *Does a 6-second
  burst inflate 20 records into 20 recurrences?* The class claim needs one; the burst is reported as
  what it is. (c) *Should the boundary be declared anyway so the instrument can score it?* No:
  declaring a repair boundary for a recurring class makes the census report `unsupported repair` — the
  instrument refusing the claim, as designed. The window cannot start while the class is firing.
- **CHANGE DELTA:** 0% source — measurement and record only. No boundary is declared, no class claim is
  made, and `dev/experiences/fix-boundaries.json` stays empty.

### Loop 6 — The rejection half: the amplification and the unnamed field (2026-10-13, automation level 3)

- **RED — the recurrence re-measured against the capture at HEAD.** `bun scripts/experiences-recurrence.ts`:
  586 records / 57 stable classes / 0 issues, every class `unresolved` because
  `dev/experiences/fix-boundaries.json` is still empty. The only post-fix rows of this family are the 20 Loop 5
  found: one run (`40c8bf08-ca36-417e-a6cb-44a80c219831`), one **5.7-second** window
  (05:08:46.967Z → 05:08:52.666Z), every row `errorClass: native-incomplete` carrying this lane's budget text, no
  row carrying a `finishReason`, no row carrying `tool_input` (hence `contextHash: ""`).
- **RED — two decidable facts Loop 5 did not read off those rows:**
  1. **They are parts of ONE response, not 17 recurrences.** 17 of the 20 are the same tool
     (`suggest_followups`), and the tail pairs `transition_phase` and `browser_use` **10 ms** apart
     (05:08:52.656Z / 05:08:52.666Z). No model round trip is 10 ms, and `processStream` captures one record per
     error chunk (`stream-parser.ts` → `captureNativeFailure`), so these are 20 rejected tool-call **parts** of a
     single streamed response. A class's row count is therefore amplified by one response's shape, which is part of
     what this lane has been reading as recurrence.
  2. **Nothing in the message could change the next emission.** All 20 rows are answered with "…the provider
     rejected the call's arguments… Correct the argument values so they satisfy the tool schema…" — advice that
     names no field. `ai` core *does* carry the validation failure (`InvalidToolInputError`'s `cause` is a
     `TypeValidationError` whose own `cause` is the issue list), and `classifyInvalidToolCall` transported only
     `argumentsTruncated`, discarding the field path — the same "discard the error we were handed" defect this lane
     already repaired once for the unavailable-tool class (FID-2026-1012-002). Measured, the model re-emitted the
     same call.
- **GREEN — two bounded changes, both inside this record's write surface.**
  1. **The rejection names the field.** `summarizeSchemaIssue` (`sdk/src/impl/llm/stream-error-chunk.ts`) reads the
     issue `path` + `code` + `expected` and never the payload: `TypeValidationError.message` embeds the received
     value (`Type validation failed: Value: {…}`), so that string is not read at all. The detail travels as
     `NativeToolCallError.schemaIssue` (`common/src/types/contracts/llm.ts`, guarded like `finishReason` and
     `argumentsTruncated`) into the message factory (`sdk/src/impl/llm/errors.ts`), which appends
     ` The arguments failed the tool schema at: followups[0].prompt — invalid_type (expected string).`
     Bounded (120 characters) and exclusive with the truncation clause: a cut payload never parsed, so it can name
     no issue and keeps the split-the-work advice.
  2. **One call-out steers once.** `createNativeFailureDeduper` / `nativeFailureKey`
     (`packages/agent-runtime/src/tools/stream-parser/native-failure-capture.ts`) key a report by (tool, class) for
     the lifetime of one stream; `handleStreamErrorChunk` takes an `isDuplicate` flag and skips the
     `TOOL_CALL_ERROR` message push for a repeat, wired in `stream-parser.ts`. The report itself is unchanged —
     class, tool name, `captureChunk` and the strike ladder behave exactly as before — so 17 duplicate paragraphs
     of context become one, and **no ledger row is dropped**: shrinking capture volume is a capture-policy decision
     that belongs to `FID-2026-1012-024`, not to the emit path.
- **AUDIT (run this pass):** `sdk/src/impl/__tests__/llm-native-tool-call.test.ts` 20 pass / 0 fail (5 new: the named
  field, the value never travelling, the unreadable-cause fallback, a cut payload never claiming a schema issue, the
  hostile non-string guard); `…/stream-parser/__tests__/native-failure-deduper.test.ts` 5 pass / 0 fail;
  `common/src/util/__tests__/experience-classes.test.ts` 10 pass / 0 fail including the additive-rule pin that the
  appended clause keeps `v1:suggest_followups:incomplete-arguments:unexpected`; SDK suite 677 pass / 1 skip / 0 fail;
  root `typecheck` 14 legs exit 0.
- **ADVERSARIAL:** (a) *Does the field clause change the class?* No — the cause short-circuits on
  `errorClass === 'native-incomplete'`, so both spellings derive one key, and that is pinned by test rather than
  argued. (b) *Is the "one response" reading a guess?* The 10 ms gap between two different tools and the
  one-row-per-chunk capture are both in the tree; the alternative reading (17 model round trips in 6 seconds) is
  excluded by latency. (c) *Does the dedupe hide a distinct failure?* Only an identical (tool, class) pair inside one
  stream collapses; a second tool, or a second class for the same tool, still steers and still captures. (d) *Can the
  schema detail leak?* Only `path`/`code`/`expected` are read, and the pin asserts a secret in the payload reaches
  neither the message nor the serialized chunk. (e) *Does this stop the class?* **No, and it is not claimed** — the
  model must still correct the call, and the window cannot start while rows are landing.
- **CHANGE DELTA:** 5 source files (2 sdk, 1 common contract, 2 agent-runtime), 2 suites extended, 1 suite added,
  0 historical rows rewritten, 0 boundaries declared, 0 classes closed; `fix-boundaries.json` stays empty.

## Boundaries

- The trace ledger stores only each failure's first line, so the 193 records may span several
  sub-causes of the emit path; this record is written at the class level and its RED re-measures
  before any fix is claimed.
- No runtime session was driven to reproduce the class on demand in this pass; the mechanism is
  read from the tree and the volume is measured from the ledger.
- A reduction in the recorded count is claimed only after the recurrence assertion window
  passes. Until then the class is open and no lesson is written for it. Loop 5 shows the reduction has
  not happened for four of the nineteen classes, so the window cannot start for them at all.
- **Loop 6 bounds the count itself:** one response contributes one ledger row per rejected tool-call
  part, so a class's row count is an upper bound on occurrences, not a count of them (measured: 20 rows
  from one response). Every class claim in this record is stated over the window, never over a row
  total, and the capture-volume question is registered to `FID-2026-1012-024`.

## Resolution

**Implemented — `Status: fixed`.**

Loop 3 landed the emit-path half of the reviewed design in the tree: the per-tool argument budget
(`common/src/util/tool-argument-budget.ts`) with the recovery text that states it, the removal of every
re-send prescription from the truncation branches, the pre-execution ceiling refusal
(`sdk/src/run/tool-call-argument-ceiling.ts`), and the spawn-steering repair for children that inherit no
history. Its gates were run in this pass and are pasted in Code Verification Evidence above.

Loop 4 landed the third lever the same session: `packages/agent-runtime/src/tools/handlers/tool/chunked-write.ts`
stages bulk writes as bounded chunks under a `baseRevision` guard (the content the write was authored
against) and a `revision` guard (what the chunks must reproduce), with the staging state in
`proposed-content-store.ts` and the wiring in `propose-write-file.ts`. A changed base, an incomplete staging
or a tamper-mismatched staging exposes nothing and commits nothing; the refusal point is the shared
`MAX_ARGUMENT_CHARS` ceiling and the chunk size is the tool's own argument budget.

`fixed` — the status for "implementation exists, gates green, awaiting the observation window". It is not
`closed`: **no class has been shown to have stopped recurring.**

**Loop 6 (2026-10-13)** landed the second half of the emit path: the rejection now names the field the schema
refused (`schemaIssue`), and a repeated part of the same call-out steers once instead of once per part. It makes no
class claim. The rejection itself is provider-side and cannot be repaired locally, so the four classes Loop 5
measured as still firing stay open, the other fifteen stay unobserved rather than clean, and the ledger's row count
for a class is now known to be amplified by multi-part responses. `dev/experiences/fix-boundaries.json` stays
empty, every owned key reports `unresolved` from `bun scripts/experiences-recurrence.ts`, and the 14-day /
three-session window has not started. Closure additionally requires that window's evidence, at which point
this section is rewritten in the closure format (Closed Date / Fix Description / Tests Added / Verification
Evidence / Archived) and the FID is archived.

**Verified:** the declared gates below were run live in this pass and their receipt is stamped under
`### Verification Receipt`. `bun run validate:repository` reports PASS with this record at `fixed`.

- **Commit for what landed:** `972c389d` — `fix(sdk): bound tool-call arguments at the emit path
  (FID-2026-1012-017)`, 15 files, 649 insertions / 86 deletions: the budget module and its suite, the
  classifier/stream plumbing, the ceiling guard, the `read_files` extraction that kept `tool-call.ts` and
  `stream.ts` inside the 300-line ceiling, the spawn-steering repair, the register entry for the newly
  captured `command-exit` class, and the scope-target update for this record.
- **Commit for the staging lever:** `f46af839` — `fix(agent-runtime): stage bulk writes as bounded,
  revision-guarded chunks (FID-2026-1012-017)`, 8 files, 884 insertions / 43 deletions: the staging
  module and its two suites, the staging state in the proposed-content store, the `propose-write-file`
  wiring, this record at `fixed`, and the master status board row.

- **Authorised write surface:** `SCOPE.md` → machine-readable scope targets → this record's
  line (registered 2026-10-12 with the root-cause matrix).
- **Design record:** `docs/design/learnings-root-cause-matrix.md` §3 rows 2, 4, 5, 8, 10, 11
  and 16; §4 root cause RC1; §5 feature E1.
- **Ordering:** measured first and fixed before FID-2026-1012-021's loop can assert on it; the
  recurrence assertion this record introduces is the instrument FID-2026-1012-021 needs.
