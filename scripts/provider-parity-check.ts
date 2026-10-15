#!/usr/bin/env bun
/**
 * provider-parity-check — the provider catalog parity gate as an independently
 * runnable probe.
 *
 * `bun run providers:parity:check` is a repository gate: it is the `--check`
 * form of the provider-catalog parity script, which reports whether the
 * committed census
 * (`common/src/constants/provider-catalog-census.json`) still matches the live
 * provider register. It has NO `fid:verify` declaration: the allowed shapes are
 * `typecheck`, `test`, `probe` and `quality` (FID-2026-0823-009). A bare
 * `probe scripts/provider-catalog-parity.ts` would NOT verify anything — that
 * script is report-only under `--check` and otherwise REGENERATES the census
 * with an atomic write, and a `probe` passes no arguments. Declaring the bare
 * script would mutate the tree instead of proving it clean.
 *
 * This is the `probe` route the FID template names: exit 0 clean, non-zero with
 * the drift report. Same shape as `scripts/lint-md-check.ts`.
 */
import { runProbe, runProbeMain } from './probe-runner'

import type { ProbeSpec } from './probe-runner'

const SPEC: ProbeSpec = {
  label: 'provider-parity-check',
  argv: ['run', 'providers:parity:check'],
  pass: 'provider-parity-check PASS — the provider catalog census matches the register.',
  fail: 'provider-parity-check FAILED — the provider catalog census drifted:',
}

export function main(): number {
  return runProbe(SPEC)
}

if (import.meta.main) runProbeMain(SPEC)
