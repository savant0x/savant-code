# FID: The incomplete-tool-call class has never been fixed at its source

**Filename:** `FID-2026-1012-017-incomplete-tool-call-arguments-root-cause.md`
**ID:** FID-2026-1012-017
**Severity:** critical
**Status:** converged
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

## Verification Gates

This record is **pre-implementation** (`Status: converged`), so **no gates are declared yet**:
a declared gate must point at an artifact that exists, and declaring one now would be a false
declaration. Gates are added under this heading when the status flips to `fixed`/`verified` —
the recurrence probe, the affected workspaces' typechecks and `quality`.

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

> Pre-implementation record: `Status: converged` (FID-2026-0915-004). Nothing in this record
> has been implemented, so what follows records what was CHECKED at the cited `HEAD` — not what
> was built.

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
- [x] **Not yet true, and deliberately not claimed:** the repair itself, its gates and its
      receipt. Gates are declared when the status flips to `fixed`/`verified`; declaring them
      now would be a false declaration.

## Boundaries

- The trace ledger stores only each failure's first line, so the 193 records may span several
  sub-causes of the emit path; this record is written at the class level and its RED re-measures
  before any fix is claimed.
- No runtime session was driven to reproduce the class on demand in this pass; the mechanism is
  read from the tree and the volume is measured from the ledger.
- A reduction in the recorded count is claimed only after the recurrence assertion window
  passes. Until then the class is open and no lesson is written for it.

## Resolution

**Not implemented — `Status: converged` (pre-implementation, FID-2026-0915-004).**

This record exists so the finding has an owner, a converged design and a register item with
write authority; it made no source change. The work above is implemented by whichever pass
flips the record to `fixed`, at which point this section is rewritten in the closure format
(Closed Date / Fix Description / Tests Added / Verification Evidence / Archived) and the
declared gates are added under `## Verification Gates`.

- **Authorised write surface:** `SCOPE.md` → machine-readable scope targets → this record's
  line (registered 2026-10-12 with the root-cause matrix).
- **Design record:** `docs/design/learnings-root-cause-matrix.md` §3 rows 2, 4, 5, 8, 10, 11
  and 16; §4 root cause RC1; §5 feature E1.
- **Ordering:** measured first and fixed before FID-2026-1012-021's loop can assert on it; the
  recurrence assertion this record introduces is the instrument FID-2026-1012-021 needs.
