#!/usr/bin/env bun
/**
 * fid-verify-check — the FID receipt scan as an independently runnable probe.
 *
 * `bun run fid:verify --check` is a pre-push hook gate: it refuses a push when
 * a `fixed`/`verified` FID carries no valid verification receipt. It has NO
 * `fid:verify` DECLARATION of its own: the allowed shapes are `typecheck`,
 * `test`, `probe` and `quality` (FID-2026-0823-009), and this gate is the
 * executor invoked in its `--check` mode. A `probe` passes no arguments, so a
 * bare `probe scripts/fid-verify.ts` would run the executor without a FID path
 * and exit on its usage error — the flag cannot be expressed.
 *
 * This is the `probe` route the FID template names: exit 0 clean, non-zero
 * with the scan's own findings. It re-enters the STRUCTURAL scan only (C1/C2,
 * no gate execution), so it can never recurse into FID verification the way
 * `validate:repository` does (lesson, FID-2026-0915-004).
 */
import { runProbe, runProbeMain } from './probe-runner'

import type { ProbeSpec } from './probe-runner'

const SPEC: ProbeSpec = {
  label: 'fid-verify-check',
  argv: ['run', 'fid:verify', '--check'],
  pass: 'fid-verify-check PASS — all enforced FID receipts are valid.',
  fail: 'fid-verify-check FAILED — an enforced FID lacks a receipt:',
}

export function main(): number {
  return runProbe(SPEC)
}

if (import.meta.main) runProbeMain(SPEC)
