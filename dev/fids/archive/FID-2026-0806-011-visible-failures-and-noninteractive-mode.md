# FID: Visible Failures + Non-Interactive Mode

**Filename:** `FID-2026-0806-011-visible-failures-and-noninteractive-mode.md`
**ID:** FID-2026-0806-011
**Severity:** high
**Status:** closed
**Created:** 2026-08-06
**Author:** Savant
**YAGNI-Compliance:** Verified
**Source:** Nova fresh-user teardown Bug #4
**Reply to:** `dev/nova/inbox/2026-08-06-fresh-user-teardown-bug-report.md`

---

## Problem

After an agent run fails, the TUI sits in the alternate screen with no error
surfaced. Piped/scripted invocations hang forever — no `--print`/headless
mode, no non-zero exit codes, no timeout.

## RED — evidence (verified against working tree, 2026-08-06)

| Claim | Evidence |
|---|---|
| Startup errors ARE handled | `cli/src/index.tsx:423-447` — `earlyFatalHandler` exits alt screen + prints error (startup only) |
| Mid-run failures not surfaced | No handler found on the agent-run failure path that exits the alt screen + prints |
| No `--print`/`--headless` flag | Grep of `cli/src/index.tsx` + CLI arg parsing: NO-MATCH for `--print`, `--headless`, `--non-interactive` |
| Piped invocations hang | No non-TTY/pipe handling that prints a final result and exits non-zero |

## GREEN — design (loop-converged)

| Decision | Design |
|---|---|
| Loud TUI errors | On run failure, exit alternate screen, print the error summary in the main buffer, keep the process exit code non-zero |
| `--print` mode | New `--print <prompt>` flag: run one prompt headlessly, stream the final answer to stdout, exit 0 on success / non-zero on failure |
| Piped stdin | When stdin is not a TTY (or `CI=1`), default to non-interactive behavior with result to stdout + non-zero exit on error |
| Timeout | Default run timeout (configurable, e.g. `SAVANT_CODE_RUN_TIMEOUT_MS`); on expiry print timeout error + exit non-zero |
| Slash commands | `/print`-adjacent behavior documented; existing commands untouched |

## AUDIT — double-audit evidence

- `cli/src/index.tsx` argument parsing verified: no print/headless flags today.
- `cli/src/utils/terminal-reset-sequences.ts` exists — the alt-screen exit
  sequences needed by the error renderer are already available.
- Existing `--permission-mode` and `--continue` flags parse via the same arg
  path — `--print` slots in beside them.
- SDK `run()` resolves to `RunState` with `output.type === 'error'` — the
  headless path can read the final state directly.

## ADVERSARIAL — verdicts

| Challenge | Verdict |
|---|---|
| Does `--print` duplicate `sdk` embedding? | CONFIRMED — it's a thin CLI convenience over the existing SDK run(); no new engine work |
| Timeout default too aggressive? | ADJUSTED — default 10 min (long runs are real); env-overridable, off when `--print` is absent and stdin is a TTY |
| Exit-code contract | CONFIRMED — 0 = completed with content, 1 = error/timeout, 2 = usage error (conventional) |
| ANSI in piped output | CONFIRMED — strip ANSI when stdout is not a TTY |

## Loop 2 (double-audit, 2026-08-06)

- **RED:** AUDIT pass found (1) template metadata non-compliance; (2)
  citation drift — `earlyFatalHandler` at `index.tsx:423` (registered 447).
- **GREEN:** metadata block brought to template contract; citation corrected.
- **AUDIT (fresh tool output):** `grep -n earlyFatalHandler cli/src/index.tsx`
  → :423 definition, :447 `process.on('uncaughtException')` — startup-only
  confirmed. `--print`/`--headless`/`--non-interactive` in `cli/src/index.tsx`
  → NO-MATCH (no non-interactive mode exists).
  `cli/src/utils/terminal-reset-sequences.ts` exists (alt-screen exit
  sequences for the error renderer).
- **CHANGE DELTA:** < 2% (metadata + one citation line).

### Missed Questions

1. Do existing slash commands already cover headless output? → No — the
   command registry has no print/export-to-stdout path for a single prompt;
   `--print` fills that gap via the SDK run().
2. Should `--continue` work with `--print`? → Yes — document that `--print`
   accepts `--continue` to resume the most recent chat and stream its final
   state; same exit-code contract.

## Convergence

Zero actionable improvements remain. Loop terminated → COMPLETE state.
**Nova verdict (2026-08-06):** ✅ APPROVED — see
`dev/nova/inbox/2026-08-06-fid-009-015-fresh-user-teardown-nova-audit-response.md`.
Awaiting operator approval for IMPLEMENT.

## Resolution

- **Fixed By:** Savant (Savant ECHO v0.1.2)
- **Fixed Date:** 2026-08-06
- **Fix Description:** --print <prompt> headless mode (cli/src/headless-run.ts + cli-args.ts + index.tsx): runs one prompt via the SDK, prints the final answer to stdout (ANSI stripped when piped), exit 0 on success / 1 on error+timeout / 2 on usage. Auto-headless on piped stdin or CI (stdin used as prompt). SAVANT_CODE_RUN_TIMEOUT_MS (default 10 min) aborts hung runs. Headless client skips ask_user.
- **Tests Added:** cli/src/__tests__/headless-run.test.ts (13: exit-code contract, timeout abort, ANSI strip, extractFinalAnswer, resolveRunTimeoutMs); cli-args.test.ts --print parse (2).
- **Verified By:** Savant (implementation AUDIT) — typecheck ×4 exit 0; full-repo eslint exit 0; prettier clean; lint:md 0; SDK suite 452 pass / 0 fail; CLI suite 2874 pass / 0 fail
- **Commit/PR:** *(pending — operator commits/pushes)*
- **Archived:** 2026-08-06

## Lessons Learned

Interactive-first CLIs need a first-class non-interactive contract the day
they ship — CI users and reviewers are the earliest adopters, and an invisible
failure reads as a hang.
