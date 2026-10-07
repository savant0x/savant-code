#!/usr/bin/env bun
/**
 * eslint-check — the repository ESLint gate as an independently runnable probe.
 *
 * `bun x eslint . --max-warnings 0` is a HARD gate: it is
 * `protocol.config.yaml` `commands.lint`, the root gate contract's `eslint`
 * label (`scripts/validation-gates.ts`), and a pre-push hook gate. It has NO
 * `fid:verify` declaration: the allowed shapes are `typecheck`, `test`,
 * `probe` and `quality` (FID-2026-0823-009), and this is a third-party binary,
 * not a workspace script. It is also the gate that caught the v0.0.22
 * crashed-eslint-shipped-green class, so a record that cannot declare it cannot
 * prove it either.
 *
 * This is the `probe` route the FID template names: exit 0 clean, non-zero
 * with the linter's own output. Same shape as `scripts/lint-md-check.ts`.
 */
import { runProbe, runProbeMain } from './probe-runner'

import type { ProbeSpec } from './probe-runner'

const SPEC: ProbeSpec = {
  label: 'eslint-check',
  argv: ['x', 'eslint', '.', '--max-warnings', '0'],
  pass: 'eslint-check PASS — no ESLint errors or warnings.',
  fail: 'eslint-check FAILED — ESLint reported errors/warnings:',
}

export function main(): number {
  return runProbe(SPEC)
}

if (import.meta.main) runProbeMain(SPEC)
