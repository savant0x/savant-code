#!/usr/bin/env bun
/**
 * provider-reference-check — the repository provider-reference gate as an
 * independently runnable probe.
 *
 * `bun run generate:provider-docs:check` is the root gate contract's
 * `provider-reference` label (`scripts/validation-gates.ts`). It has NO
 * `fid:verify` declaration: the allowed shapes are `typecheck`, `test`,
 * `probe` and `quality` (FID-2026-0823-009). The underlying script
 * (`scripts/generate-provider-reference.ts`) REWRITES the four checked-in
 * surfaces by default and only checks under `--check`, and a `probe` passes no
 * arguments — so a bare probe would rewrite generated docs instead of
 * verifying them, and would then always report success.
 *
 * This is the `probe` route the FID template names: exit 0 clean, non-zero with
 * the command's own output.
 */
import { runProbe, runProbeMain } from './probe-runner'

import type { ProbeSpec } from './probe-runner'

const SPEC: ProbeSpec = {
  label: 'provider-reference-check',
  argv: ['run', 'generate:provider-docs:check'],
  pass: 'provider-reference-check PASS — the provider reference surfaces are current.',
  fail: 'provider-reference-check FAILED — a provider reference surface is stale:',
}

export function main(): number {
  return runProbe(SPEC)
}

if (import.meta.main) runProbeMain(SPEC)
