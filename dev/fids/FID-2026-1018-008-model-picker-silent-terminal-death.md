# FID: `/model` kills the CLI silently with three bashers active

**Filename:** `FID-2026-1018-008-model-picker-silent-terminal-death.md`
**ID:** FID-2026-1018-008
**Severity:** critical
**Status:** analyzed
**Created:** 2026-10-18 17:58
**Automation level:** 3
**YAGNI-Compliance:** Pending

---

## Summary

Opening `/model` while three basher agents were running killed the CLI
immediately. The terminal was cleared with no error, no recovery prompt and no
usable message; the process was gone afterwards. The existing finalised log
shows no `Uncaught exception:` entry, so the death did not pass through the
in-process fatal handler, and Windows logged no application-error or WER dump
for it. This is the first reproduction of the incident tracked as LIVE-003, and
it answers that item's open question: the CLI **exits**, it does not stay alive
on a blank screen. The cause is not established.

## Environment

- **OS:** Windows (31.1 GB physical memory)
- **Language/Runtime:** TypeScript, Bun 1.3.14, OpenTUI 0.5.3
- **Tool Versions:** pinned repository dependencies at `HEAD` `d0c600ef`
- **Commit/State:** `main` at `d0c600ef`, clean tree, HYBRID mode, dev catalog
  of 4,075 model rows

## Detailed Description

### Problem

With three bashers running (the operator's reproduction: the sandbox-run
prompt that spawns SDK, agent-runtime and CLI `bun test` suites), typing
`/model` and submitting it cleared the terminal completely and instantly. No
error text appeared, no recovery key sequence worked, and the session was lost.

### Expected Behavior

The picker opens, or — if it cannot — the CLI reports a recoverable error and
stays alive. A fatal path must leave a durable record naming the failure, so the
operator does not lose the session and the defect is diagnosable afterwards.

### Root Cause

Not established. The death left no JS-level fatal record and no OS crash record,
so the evidence is currently consistent with several mechanisms, in order of
what the log shape suggests:

1. A **native abort** in the picker render path (4,075 rows are materialised as
   native nodes on mount) while three test suites compete for the machine. A
   native abort never reaches `uncaughtException`, and anything it printed to
   stderr lived in the alternate screen that was then reset.
2. An **OOM kill**. 31.1 GB total memory makes a system-level kill less likely,
   but the pre-repair measurement of this path was over 1 GB RSS and native
   allocation failure is not the same as a managed OOM.
3. An **unhandled exit** from the picker's async open path
   (`openModelPicker` awaits a catalog refresh) racing agent updates.

The terminal clearing itself is explained and is not the defect: either
`cleanup()` writes `TERMINAL_RESET_SEQUENCES`, or — for a death that runs no
handler — the sacrificial terminal watchdog writes them after the process dies.

### Evidence

The finalised log ends mid-turn with ordinary DEBUG/INFO lines and no fatal
entry (times UTC; crash at 21:51:26Z = 17:51:26 local):

```text
{\"level\":\"DEBUG\",\"timestamp\":\"2026-10-18T21:51:23.268Z\",...\"prompt\":\"Run the SDK test suite (read-only, do not modify anything).\",\"params\":{\"command\":\"cd sdk && bun test src/\"...},\"msg\":\"...basher...\"}
{\"level\":\"INFO\",\"timestamp\":\"2026-10-18T21:51:26.198Z\",...}  stream recovery accounting
{\"level\":\"DEBUG\",\"timestamp\":\"2026-10-18T21:51:26.200Z\",...,\"agentId\":\"UP8iCpg43LE\",\"shouldEndTurn\":true,...}  End agent basher step 5
{\"level\":\"DEBUG\",\"timestamp\":\"2026-10-18T21:51:26.202Z\",...}  reconcileTokenCount: context token source decision
--- end of file ---
```

`debug/trace.jsonl` ends at the same instant with a normal basher lifecycle:

```text
{\"timestamp\":\"2026-10-18T21:51:26.204Z\",\"event\":\"cleanup_finished\",\"agentType\":\"basher\",\"phase\":\"cleanup\",\"step\":3}
```

Absence checks, each run after the crash:

```text
grep 'Uncaught exception:' debug/cli.jsonl   → no match in the final minutes
Get-WinEvent Application (17:45-17:56 local)  → no bun/savant application-error event
Get-WinEvent System (17:45-17:56 local)       → no resource-exhaustion event
ls $LOCALAPPDATA/CrashDumps                   → no bun.exe dump
Get-Process bun                               → no process from ~17:50 survived
```

`renderer-cleanup.ts` logs `Uncaught exception:` before exiting, so its absence
is evidence the fatal handler never ran. `terminal-watchdog.ts` explains the
cleared screen without explaining the death.

## Impact Assessment

### Affected Components

- `cli/src/components/model-picker.tsx` (4,075-row native mount)
- `cli/src/utils/model-picker-open.ts` (async open path)
- `cli/src/utils/renderer-cleanup.ts`, `cli/src/utils/terminal-watchdog.ts`
  (why the evidence is lost, not why the process dies)

### Risk Level

- [x] Critical: the operator loses the session instantly, with no message and
      no recovery path, and the failure leaves no diagnosable record.

## Proposed Solution

### Approach

Reproduce with stderr captured **outside** the alternate screen before changing
any behaviour, then fix the specific cause. A fix written before the cause is
known would be a guess, and this path has already had one incorrect diagnosis
(render load) attributed to it.

### Steps

1. **Capture (no product change).** Reproduce with stderr redirected to a file
   so a Bun/native panic is preserved after the terminal is reset:
   `bun run dev 2> debug/cli.stderr.log` from `cli/`, then run the three-basher
   prompt and `/model`.
2. **Make silent deaths durable.** If step 1 shows no panic text, duplicate
   stderr into `debug/cli.stderr.log` for TUI runs at startup, so this class of
   death is always diagnosable; the file is short, bounded and gitignored like
   the other debug artifacts.
3. **Narrow the trigger.** Establish whether the death requires the bashers, the
   full catalog, or both, using the existing PTY probe and the native render
   suite rather than the live operator session.
4. **Fix the cause** with the smallest change that removes it, keeping the
   picker's full search, selection and viewport behaviour.

### Verification

- A reproduction that fails before the fix and passes after it.
- `bun run typecheck`, the picker suites (`model-picker-load`,
  `model-picker-scroll`, `model-picker-open`) and the CLI suite.
- A live operator run of the three-basher + `/model` sequence with the terminal
  intact afterwards.

## Perfection Loop

### Loop 1 — RED

Reproduction confirmed by the operator at 21:51:26Z. Log and trace both end
mid-turn with no fatal record; no OS-level crash or exhaustion event exists;
no surviving process; screen cleared by the designed reset/watchdog paths.
Candidate mechanisms are ranked, not concluded.

### Loop 2 — narrowing (2026-10-18 19:09)

The picker open completed. The death follows subagent completion, three times
out of three hard kills, so the FID's title premise (`/model` kills the CLI) is
now the operator's context rather than the cause. Next instrumentation moves to
the subagent-result delivery path, not the picker.

### Missed Questions

1. Did the bashers remain alive after the CLI died, or did they die with it?
   Their `bun test` children would answer whether the death was a job-object
   kill of the whole tree.
2. Was `/model` submitted, or did the terminal die while the palette was still
   open? The two have different suspects (picker mount vs. command dispatch).
3. Was this the first time the operator's session had rendered the picker on
   this catalog since the memo repair, or had it rendered successfully earlier
   in the same process?

### Code Verification Evidence

Picker-open breadcrumbs added (`cli/src/commands/defs/model-provider-commands.ts`)
around `openModelPicker`, and the shared writer moved to
`cli/src/utils/exit-provenance.ts` so the exit line and these markers cannot
diverge. Verified: cli typecheck 0, breadcrumb suite 3 pass / 0 fail, ESLint and
Prettier clean, and a PTY quit still wrote
`reason: process.exit@cli\src\hooks\use-exit-handler.ts:49`.

Exit provenance implemented (`cli/src/utils/exit-provenance.ts`, installed at
CLI startup): the first `process.exit` call site is captured and reported in
the breadcrumb as `process.exit@<file:line>`, or `drain` when the loop simply
emptied. Exercised live through the PTY harness: a normal quit reported
`process.exit@cli\src\hooks\use-exit-handler.ts:49`, and a synthetic
`code:0` line was produced for the operator crash above.

Diagnostics step implemented (`cli/src/utils/renderer-cleanup.ts`): the `exit`
handler now appends one JSON line to `debug/cli.exit.log` with a `reason`
(`exit` or `sigint`), the exit code, pid, uptime and RSS before `cleanup()`. Absence of that line is the signal that
the process was killed rather than exited. Exercised live through the PTY
harness: a normal Ctrl+C quit wrote
`{"event":"process-exit","reason":"exit","code":0,"pid":51648,"uptimeSeconds":5,"rssMb":424}`
for a Ctrl+C quit, so a spontaneous signal would read `reason: sigint` and a
killed process would leave no line at all.
Gates: `cd cli && bun run typecheck` exit 0; the new suite
`cli/src/utils/__tests__/exit-breadcrumb.test.ts` 2 pass / 0 fail; ESLint and
Prettier clean on both files.

The defect itself is **not fixed**. This FID stays `analyzed` until the crash
class is identified and the cause is repaired.

## Resolution

Pending. The defect is reproduced and the cause is not established; the
resolution records the captured cause, the fix, and the live operator run once
they exist.

**Updated 2026-10-18 18:39** — the instrumented reproduction named the class:

```text
{"timestamp":"2026-10-18T22:39:13.104Z","event":"process-exit","reason":"exit","code":0,"pid":25744,"uptimeSeconds":66,"rssMb":580}
```

Exit **code 0**, no `sigint` record, empty stderr, 66 s into the session at
580 MB RSS. The process therefore ended on a normal exit path — either an
explicit `process.exit(0)` or an event loop that drained while the UI was
still mounted — and not by a native abort or OOM kill as the earlier absence
of records suggested. The remaining fork is one line in the next run: the
`exit-provenance` wrapper reports `process.exit@<file:line>` for a call site
and `drain` when no call happened, verified live against the known Ctrl+C path
(`process.exit@cli\src\hooks\use-exit-handler.ts:49`).

**Updated 2026-10-18 19:09 — the picker opened, then a basher completing killed it.**

The bracketed run recorded a complete picker open and a death 14 s later on a
basher tick:

```text
23:09:16.025Z  model-picker-open-begin     model=river/deepseek-v4.1-flash
23:09:16.917Z  model-picker-open-returned  opened=true          (892 ms)
...           (no picker close, no exit breadcrumb)
23:09:30.965Z  cli.jsonl  basher step 5
23:09:30.969Z  trace      cleanup_finished (basher UUaZeg_3eVg)
23:09:33Z      probe read the log: process gone
```

The picker opened in 892 ms and stayed open. The death landed on the same tick
as a basher `cleanup_finished` — the third such coincidence:

```text
21:51:26.204Z  cleanup_finished → hard kill
22:54:16.759Z  cleanup_finished → hard kill
23:09:30.969Z  cleanup_finished → hard kill
```

So `/model` is incidental: it is what the operator is doing while bashers run,
and the death arrives when the first subagent completes. The earlier
`23:07:26.800Z` record is a different event — `reason:
process.exit@cli\\src\\utils\\renderer-cleanup.ts:130`, code 0, 866 s uptime,
1022 MB RSS — which is the SIGTERM/SIGHUP `cleanupAndExit` path, i.e. an
ordinary session teardown, not this defect.

**Leading hypothesis (unproven):** the first subagent result delivered to the
main agent is a large `bun test` output; rendering it while the 4,075-row
picker is mounted pushes the native renderer past what the process survives.
The confirmed fact is the tick, not the mechanism — RSS was already 1022 MB in
the long session.

**Updated 2026-10-18 18:54 — the second instrumented crash left no record at
all.** `debug/cli.exit.log` still ended at the previous session's line, so the
`exit` handler never ran: this death was a hard kill, not a chosen exit, which
is the opposite of the 18:39 crash. Both hard-kill deaths land on the same
tick as a basher's `cleanup_finished`:

```text
21:51:26.204Z  cleanup_finished (basher)   → no further log line  (crash 1)
22:54:16.759Z  cleanup_finished (basher)   → no exit breadcrumb   (crash 3)
```

No OS application-error event, no resource-exhaustion event and no WER dump
exists for either. The two signatures together say the process is sometimes
exited deliberately and sometimes terminated natively, so the remaining
question is which operation the process was inside — not which mechanism
killed it. `model-picker-open-begin` / `model-picker-open-returned`
breadcrumbs now bracket the picker open, so the next run reports whether the
death happens inside that path (begin without returned) or elsewhere (both
present, or neither).

Diagnostics landed first on purpose: the two observed deaths produced no fatal
log entry, no stderr text and no OS crash record, so a fix written now would be
a guess. The next reproduction splits the space in one run — a breadcrumb line
means the CLI exited deliberately and the exit code names the path; no line
means the runtime was killed and the search moves to native allocation and the
job object.

**Updated 2026-10-18 19:22 — the next reproduction never reached the bashers.**
Run `09d02e45` (prompt: three 45-second bashers) ended at 23:21:58 without any
`spawn_agents` call: the turn was consumed by the session-init grounding gate
reading the boot set, and died on a separate, now-fixed defect recorded as
FID-2026-1018-009. `debug/cli.exit.log` has no exit record for it and the
process stayed alive and idle, so this run says **nothing** about the
basher-completion correlation — it must not be counted as a fourth data point
for or against it. The reproduction still needs a run that actually spawns the
three bashers.

**Updated 2026-10-18 19:52 — it is not a process death. It is a dead renderer.**
Run `473b4f3f` (pid 4048, booted 19:43:25) was followed up while the operator
reported a completely black, unresponsive screen. The process was **alive and
healthy**: `Responding: True`, RSS ~1044 MB, CPU flat at 23.42 s, and the
agent turn ran to completion after the screen died —

```text
23:43:41  transition_phase → green
23:43:42  read_files [all four harness boot files]      ← one steering message total
23:43:45  transition_phase → green
23:43:48  spawn_agents ............................... tool_finished 23:44:35 (47 s)
23:44:37  write_todos → transition_phase ×3 → suggest_followups
23:44:46.830  terminal step=10, cleanup_finished
23:44:46.835  [finish-logic] UI reset to idle (reason: finish)
```

The screen went black between `model-picker-open-begin` (23:43:52.852) and
`model-picker-open-returned` (23:43:53.562), while the JS loop kept working for
another 53 s. No `process-exit` line was ever written, and nothing appears at
ERROR level. **Every earlier "hard kill" in this record is now suspect for the
same reason**: a dead renderer looks exactly like a dead process from the
operator's chair, and the process ends only when the terminal window is closed.

Why it was invisible — both OpenTUI failure shapes are silent here:

- a JS render throw is emitted as `render:error`; with **no listener** it falls
  to the renderer's `handleError`, which `console.error`s into a console the
  renderer captures and never displays (`@opentui/core` renderer.js:9863,
  :7168);
- a native render status of `failed` merely stops scheduling the next frame
  (renderer.js:9848-9851) — no event, no log, no exit.

**Instrumentation added (same commit as this record):**
`cli/src/utils/renderer-health.ts` listens for `render:error` (records message,
bounded stack, uptime, RSS, then asks for one repaint) and probes liveness every
10 s by requesting a render and checking that a `frame` event arrived. Three
consecutive misses record one `render-stall` breadcrumb and request a repaint —
which restarts a stopped loop, because `requestRender()` reschedules when
`_isRunning` and no timer is armed. It never exits: a stalled frame is evidence,
not proof. 7 tests cover the probe verdict, the record fields and the install
wiring.

**Also observed, unproven:** streamed assistant deltas are persisted as one
message each (step 17 of the 23:21 run produced 14 assistant messages for one
sentence; the 23:43 turn ended at `messageCount: 170`). Not attributed to this
defect, not yet filed — recorded here so it is not lost.

**Updated 2026-10-19 00:05 — the screen is blank because the tree is empty.**
Run `46880` (started 00:00:35, `/model` opened 00:01:10.674, returned
`opened=true` at 00:01:11.393) reproduced the operator's black screen. Reading
the live console back from outside the process (`AttachConsole` +
`ReadConsoleOutputCharacterW`/`ReadConsoleOutputAttribute`) gave:

```text
size=123x76 window=123x76
read=9348  nonSpace=0            (earlier sample: nonSpace=1, a stray wide glyph)
attribute histogram: 0x0F = 9348 cells   (every cell, the default attribute)
```

So the terminal is healthy and the renderer **paints** — the buffer changed
between two samples — but every cell is a space with the default attribute.
`AppShell` paints a full-viewport box with `theme.background`; a single cell
carrying a background attribute would prove it had rendered. None does. An
injected `ESC` (`WriteConsoleInputW`) produced no repaint and no state change.

Frames were still arriving during the blank period (`render-stall` never
fired — probes at :20, :30, :40 and :50 all saw a frame), so this is *not* a
stopped render loop: React reconciled the root down to nothing while the loop
kept ticking, and nothing reached the logger (`ERROR` count for the run: 0;
`Render error caught` count: 0).

Local reproduction attempt, at the operator's exact 123x76 size: the real
picker was mounted ad hoc with 30, 500, 1,500, 3,000 and the full 4,075 rows,
and then the production `DialogOverlay` + picker. **Every size painted** — so
the picker mount alone does not empty the tree, and the trigger needs the live
app's surroundings. The shipped test
(`cli/src/components/__tests__/model-picker-full-catalog.render.test.tsx`)
keeps the 500-row bare and overlay cases only: at 4,075 rows the mount leaves
the shared OpenTUI render state disturbed and fails dozens of later render
tests in the same `bun test` process, so that size is measured ad hoc rather
than asserted in-suite.

**Instrumentation added (same commit):**

- `cli/src/utils/console-capture.ts` — `console.error`/`console.warn` are now
  forwarded to `debug/cli.jsonl` before OpenTUI captures them. A React commit
  failure reports itself this way, and until now that text went into an overlay
  the app never opens.
- `renderer-health`'s probe now also records `render-tree-empty` once per
  episode when the renderer root has no children, which is the exact shape
  measured above — it fires even while frames tick.

### Notes

The cleared screen is expected behaviour after death, so no change should be
made to the reset or watchdog paths until the death itself is explained.
Improving the message a survivor would show is only meaningful once something
survives.
