#!/usr/bin/env bun
/**
 * ci-build-check — the release-artifact build chain as a runnable probe.
 *
 * `bun run ci` is `protocol.config.yaml` `commands.build` — the chain that
 * compiles the SDK declaration bundle. It has NO
 * `fid:verify` declaration: the allowed shapes are `typecheck`, `test`,
 * `probe` and `quality` (FID-2026-0823-009). Root `ci` runs `build:sdk`, so it is
 * neither a workspace `typecheck` leg nor a `*.test.ts` path, and it is not
 * the repo-wide `quality` report. A FID whose subject is the artifact build
 * could therefore not declare it.
 *
 * This is the `probe` route the FID template names: exit 0 clean, non-zero
 * with the build's own output. Same shape as `scripts/eslint-check.ts`.
 */
import { runProbe, runProbeMain } from './probe-runner'

import type { ProbeSpec } from './probe-runner'

const SPEC: ProbeSpec = {
  label: 'ci-build-check',
  argv: ['run', 'ci'],
  pass: 'ci-build-check PASS — the release-artifact build chain succeeded.',
  fail: 'ci-build-check FAILED — the build chain reported errors:',
}

export function main(): number {
  return runProbe(SPEC)
}

if (import.meta.main) runProbeMain(SPEC)
