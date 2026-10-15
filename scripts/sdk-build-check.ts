#!/usr/bin/env bun
/**
 * sdk-build-check — the repository SDK build gate as an independently runnable probe.
 *
 * `bun run build:sdk` is the root gate contract's `build:sdk` label
 * (`scripts/validation-gates.ts`), the SDK half of `protocol.config.yaml`
 * `commands.build` (`bun run ci`), and a pre-release gate. It has NO
 * `fid:verify` declaration: the allowed shapes are `typecheck`, `test`, `probe`
 * and `quality` (FID-2026-0823-009), and this is a nested workspace build
 * (`cd sdk && bun run build`), not a `typecheck <workspace>` leg.
 *
 * This is the `probe` route the FID template names: exit 0 clean, non-zero with
 * the compiler's own output.
 */
import { runProbe, runProbeMain } from './probe-runner'

import type { ProbeSpec } from './probe-runner'

const SPEC: ProbeSpec = {
  label: 'sdk-build-check',
  argv: ['run', 'build:sdk'],
  pass: 'sdk-build-check PASS — the SDK built from the current tree.',
  fail: 'sdk-build-check FAILED — the SDK build reported errors:',
}

export function main(): number {
  return runProbe(SPEC)
}

if (import.meta.main) runProbeMain(SPEC)
