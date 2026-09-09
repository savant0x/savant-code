// FID-2026-0907-005 — headless outcome writer (stdout purity seam).
//
// The terminal write for a headless run, extracted pure (Law 13) so the
// JSON-mode purity contract is testable without dragging the dispatch's
// import graph (release/server/login) into a console-pin test:
//   - v1 (non-JSON): stdout gets the answer (console.log shape), stderr
//     gets red(`Error: …`) on failure — byte-identical to the pre-FID-005
//     dispatch lines.
//   - JSON mode: stdout carries ONLY NDJSON frames (BO §Frozen Wire
//     Contract rule 5) — the artifact frame owns the answer channel, so
//     the raw answer write is suppressed. stderr stays the diagnostics
//     channel in BOTH modes, unchanged.
// Exit-code policy is untouched: the caller still owns process.exit.

import { red } from 'picocolors'

import type { HeadlessRunResult } from './headless-run'

export type HeadlessOutcomeIo = {
  /** True when the run emitted NDJSON frames (suppresses the raw write). */
  json: boolean
  /** Injectable writers (DI per docs/testing.md); default to the streams. */
  stdoutWrite?: (chunk: string) => void
  stderrWrite?: (chunk: string) => void
}

/**
 * Write a headless run's terminal outcome and return its exit code.
 * Injecting the writers keeps the seam pure; the defaults bind the real
 * streams so the dispatch stays a one-liner.
 */
export function writeHeadlessOutcome(
  result: HeadlessRunResult,
  io: HeadlessOutcomeIo,
): number {
  const stdoutWrite =
    io.stdoutWrite ?? ((chunk: string) => process.stdout.write(chunk))
  const stderrWrite =
    io.stderrWrite ?? ((chunk: string) => process.stderr.write(chunk))

  if (result.output !== undefined && !io.json) {
    // v1 shape: console.log(output) — the string plus one newline.
    stdoutWrite(`${result.output}\n`)
  }
  if (result.error) {
    // v1 shape: console.error(red(`Error: …`)) — both modes (BO rule 5:
    // stderr diagnostics are unchanged in JSON mode).
    stderrWrite(`${red(`Error: ${result.error}`)}\n`)
  }
  return result.exitCode
}
