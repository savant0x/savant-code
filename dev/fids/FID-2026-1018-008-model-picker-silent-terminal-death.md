# FID: `/model` kills the CLI silently with three bashers active

**Filename:** `FID-2026-1018-008-model-picker-silent-terminal-death.md`
**ID:** FID-2026-1018-008
**Severity:** critical
**Status:** created
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

No implementation exists yet, so there is nothing to verify. This FID is at
`created`; the implementation evidence section is filled during GREEN and
AUDIT, with the commit SHA, the gate output and the live reproduction result.

## Resolution

Pending. The defect is reproduced and the cause is not established; the
resolution records the captured cause, the fix, and the live operator run once
they exist.

### Notes

The cleared screen is expected behaviour after death, so no change should be
made to the reset or watchdog paths until the death itself is explained.
Improving the message a survivor would show is only meaningful once something
survives.
