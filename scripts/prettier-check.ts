#!/usr/bin/env bun
/**
 * prettier-check — the repository format gate as an independently runnable probe.
 *
 * `bunx prettier --check .` is `protocol.config.yaml` `commands.format`, the
 * root gate contract's `prettier` label (`scripts/validation-gates.ts`), and a
 * pre-push hook gate. It has NO `fid:verify` declaration: the allowed shapes
 * are `typecheck`, `test`, `probe` and `quality` (FID-2026-0823-009), and this
 * is a third-party binary invoked with `--check`, which a bare `probe
 * scripts/…` cannot express (a probe passes no arguments).
 *
 * This is the `probe` route the FID template names: exit 0 clean, non-zero
 * listing the unformatted files. Same shape as `scripts/lint-md-check.ts`.
 */
import { runProbe, runProbeMain } from './probe-runner'

import type { ProbeSpec } from './probe-runner'

const SPEC: ProbeSpec = {
  label: 'prettier-check',
  argv: ['x', 'prettier', '--check', '.'],
  pass: 'prettier-check PASS — every tracked file is formatted.',
  fail: 'prettier-check FAILED — prettier reported unformatted files:',
}

export function main(): number {
  return runProbe(SPEC)
}

if (import.meta.main) runProbeMain(SPEC)
