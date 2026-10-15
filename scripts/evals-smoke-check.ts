#!/usr/bin/env bun
/**
 * evals-smoke-check — the Tier-1 governance smoke as a runnable probe.
 *
 * `bun run evals:smoke` is a pre-push hook gate: a zero-token, deterministic
 * governance smoke that refuses the push when it fails. It has NO `fid:verify`
 * declaration: the allowed shapes are `typecheck`, `test`, `probe` and
 * `quality` (FID-2026-0823-009). The smoke is a workspace entry point
 * (`bun run --cwd=evals evals:smoke`) with no `*.test.ts` path to declare under
 * `test`, and `evals` has no `typecheck`-style form for it either. A FID whose
 * subject is the smoke gate could therefore not declare it.
 *
 * This is the `probe` route the FID template names: exit 0 clean, non-zero
 * with the smoke's own output. Same shape as `scripts/eslint-check.ts`.
 */
import { runProbe, runProbeMain } from './probe-runner'

import type { ProbeSpec } from './probe-runner'

const SPEC: ProbeSpec = {
  label: 'evals-smoke-check',
  argv: ['run', 'evals:smoke'],
  pass: 'evals-smoke-check PASS — the governance smoke passed.',
  fail: 'evals-smoke-check FAILED — the smoke reported failures:',
}

export function main(): number {
  return runProbe(SPEC)
}

if (import.meta.main) runProbeMain(SPEC)
