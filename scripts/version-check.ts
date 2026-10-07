#!/usr/bin/env bun
/**
 * version-check — the repository version-synchronization gate as an
 * independently runnable probe.
 *
 * `bun run version:check` is a governed repository gate. It has NO `fid:verify`
 * declaration: the allowed shapes are `typecheck`, `test`, `probe` and
 * `quality` (FID-2026-0823-009). The underlying script
 * (`scripts/bump-version.ts`) BUMPS the version surfaces by default and only
 * checks under `--check`, and a `probe` passes no arguments — so a bare probe
 * would rewrite every version surface instead of verifying it.
 *
 * This is the `probe` route the FID template names: exit 0 clean, non-zero with
 * the command's own output.
 */
import { runProbe, runProbeMain } from './probe-runner'

import type { ProbeSpec } from './probe-runner'

const SPEC: ProbeSpec = {
  label: 'version-check',
  argv: ['run', 'version:check'],
  pass: 'version-check PASS — every version surface is synchronized.',
  fail: 'version-check FAILED — a version surface is out of sync:',
}

export function main(): number {
  return runProbe(SPEC)
}

if (import.meta.main) runProbeMain(SPEC)
