#!/usr/bin/env bun
/**
 * lockfile-check — the repository lockfile gate as an independently runnable probe.
 *
 * `bun install --frozen-lockfile` is the root gate contract's `lockfile` label
 * (`scripts/validation-gates.ts`) and the first gate the release pipeline runs.
 * It has NO `fid:verify` declaration: the allowed shapes are `typecheck`,
 * `test`, `probe` and `quality` (FID-2026-0823-009), and this is a
 * package-manager invocation, not a script.
 *
 * This is the `probe` route the FID template names: exit 0 clean, non-zero with
 * the command's own output.
 */
import { runProbe, runProbeMain } from './probe-runner'

import type { ProbeSpec } from './probe-runner'

const SPEC: ProbeSpec = {
  label: 'lockfile-check',
  argv: ['install', '--frozen-lockfile'],
  pass: 'lockfile-check PASS — the committed lockfile satisfies the manifest.',
  fail: 'lockfile-check FAILED — bun install --frozen-lockfile reported drift:',
}

export function main(): number {
  return runProbe(SPEC)
}

if (import.meta.main) runProbeMain(SPEC)
