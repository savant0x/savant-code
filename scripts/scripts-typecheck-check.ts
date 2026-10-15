#!/usr/bin/env bun
/**
 * scripts-typecheck-check — the scripts-tree typecheck leg as a probe.
 *
 * `bun run typecheck:scripts` (`tsc --noEmit -p scripts/tsconfig.json`) is the
 * 14th leg of the root `typecheck` chain and part of `protocol.config.yaml`
 * `commands.type_check`. It has NO `fid:verify` declaration: the allowed
 * shapes are `typecheck <workspace>`, `test <path>`, `probe <path>` and
 * `quality` (FID-2026-0823-009), and `scripts` is NOT a bun workspace, so the
 * `typecheck <workspace>` kind rejects it (the executor validates the argument
 * against `VALIDATION_WORKSPACE_POLICY`).
 *
 * This is the `probe` route the FID template names: exit 0 clean, non-zero with
 * the compiler's own output.
 */
import { runProbe, runProbeMain } from './probe-runner'

import type { ProbeSpec } from './probe-runner'

const SPEC: ProbeSpec = {
  label: 'scripts-typecheck-check',
  argv: ['run', 'typecheck:scripts'],
  pass: 'scripts-typecheck-check PASS — the scripts tree typechecks.',
  fail: 'scripts-typecheck-check FAILED — the scripts typecheck reported errors:',
}

export function main(): number {
  return runProbe(SPEC)
}

if (import.meta.main) runProbeMain(SPEC)
