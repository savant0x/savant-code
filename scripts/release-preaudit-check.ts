#!/usr/bin/env bun
/**
 * release-preaudit-check — the release pre-audit gate as an independently
 * runnable probe.
 *
 * `bun run release:preaudit:check` is a repository gate: it answers "am I ready
 * to release?" by reporting every finding the pre-audit can see, without
 * touching anything. It has NO `fid:verify` declaration: the allowed shapes are
 * `typecheck`, `test`, `probe` and `quality` (FID-2026-0823-009). A bare
 * `probe scripts/release-preaudit.ts` would NOT verify anything — that script
 * runs in `--check` (preview) mode only when the flag is present and otherwise
 * runs in MUTATION mode, and a `probe` passes no arguments. Declaring the bare
 * script would let a record "prove" the pre-audit by mutating the tree.
 *
 * This is the `probe` route the FID template names: exit 0 clean, non-zero with
 * the pre-audit's own findings. Same shape as `scripts/lint-md-check.ts`.
 */
import { runProbe, runProbeMain } from './probe-runner'

import type { ProbeSpec } from './probe-runner'

const SPEC: ProbeSpec = {
  label: 'release-preaudit-check',
  argv: ['run', 'release:preaudit:check'],
  pass: 'release-preaudit-check PASS — the release pre-audit found nothing auto-fixable.',
  fail: 'release-preaudit-check FAILED — the release pre-audit reported findings:',
}

export function main(): number {
  return runProbe(SPEC)
}

if (import.meta.main) runProbeMain(SPEC)
