#!/usr/bin/env bun
/**
 * protocol-bundle-check — the repository protocol-bundle gate as an
 * independently runnable probe.
 *
 * `bun run generate:protocol-bundle:check` is the root gate contract's
 * `protocol-bundle` label (`scripts/validation-gates.ts`) and a pre-push hook
 * gate. It has NO `fid:verify` declaration: the allowed shapes are `typecheck`,
 * `test`, `probe` and `quality` (FID-2026-0823-009). The underlying script
 * (`scripts/generate-protocol-bundle.ts`) REWRITES the embedded bundle by
 * default and only checks under `--check`, and a `probe` passes no arguments —
 * so a bare probe would regenerate the bundle instead of verifying it.
 *
 * This is the `probe` route the FID template names: exit 0 clean, non-zero with
 * the command's own output.
 */
import { runProbe, runProbeMain } from './probe-runner'

import type { ProbeSpec } from './probe-runner'

const SPEC: ProbeSpec = {
  label: 'protocol-bundle-check',
  argv: ['run', 'generate:protocol-bundle:check'],
  pass: 'protocol-bundle-check PASS — the embedded protocol bundle is current.',
  fail: 'protocol-bundle-check FAILED — the embedded protocol bundle is stale:',
}

export function main(): number {
  return runProbe(SPEC)
}

if (import.meta.main) runProbeMain(SPEC)
