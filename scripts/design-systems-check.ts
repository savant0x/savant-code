#!/usr/bin/env bun
/**
 * design-systems-check — the repository design-systems gate as an
 * independently runnable probe.
 *
 * `bun run design-systems:check` is a governed repository gate. It has NO
 * `fid:verify` declaration: the allowed shapes are `typecheck`, `test`,
 * `probe` and `quality` (FID-2026-0823-009). The underlying script
 * (`scripts/generate-design-systems.ts`) WRITES the generated surfaces by
 * default and only checks under `--check`, and a `probe` passes no arguments —
 * so a bare probe would regenerate the tokens instead of verifying them.
 *
 * This is the `probe` route the FID template names: exit 0 clean, non-zero with
 * the command's own output.
 */
import { runProbe, runProbeMain } from './probe-runner'

import type { ProbeSpec } from './probe-runner'

const SPEC: ProbeSpec = {
  label: 'design-systems-check',
  argv: ['run', 'design-systems:check'],
  pass: 'design-systems-check PASS — the generated design-system surfaces are current.',
  fail: 'design-systems-check FAILED — a generated design-system surface is stale:',
}

export function main(): number {
  return runProbe(SPEC)
}

if (import.meta.main) runProbeMain(SPEC)
