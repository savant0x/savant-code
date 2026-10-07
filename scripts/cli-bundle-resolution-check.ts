#!/usr/bin/env bun
/**
 * cli-bundle-resolution-check — the undeclared-dependency gate as a probe.
 *
 * `bun build cli/src/index.tsx --production --target=bun --external
 * '@opentui/core-*' --outdir cli/bin/.resolution-check` is the root gate
 * contract's `cli-bundle-resolution` label (`scripts/validation-gates.ts`). It
 * bundles the CLI entry with every import resolved — the exact phase that
 * failed in CI when an undeclared dependency (phantom @noble/hashes) only
 * resolved from a node_modules outside the repo (FID-2026-0816-001 D-01). It
 * has NO `fid:verify` declaration: the allowed shapes are `typecheck`, `test`,
 * `probe` and `quality` (FID-2026-0823-009), and this is a `bun build`
 * invocation with flags, which a bare `probe scripts/…` cannot express (a probe
 * passes no arguments).
 *
 * This is the `probe` route the FID template names: exit 0 clean, non-zero with
 * the bundler's own output.
 */
import { runProbe, runProbeMain } from './probe-runner'

import type { ProbeSpec } from './probe-runner'

const SPEC: ProbeSpec = {
  label: 'cli-bundle-resolution-check',
  argv: [
    'build',
    'cli/src/index.tsx',
    '--production',
    '--target=bun',
    '--external',
    '@opentui/core-*',
    '--outdir',
    'cli/bin/.resolution-check',
  ],
  pass: 'cli-bundle-resolution-check PASS — the CLI entry bundles with every import resolved.',
  fail: 'cli-bundle-resolution-check FAILED — an import did not resolve:',
}

export function main(): number {
  return runProbe(SPEC)
}

if (import.meta.main) runProbeMain(SPEC)
