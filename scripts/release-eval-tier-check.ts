#!/usr/bin/env bun
/**
 * release-eval-tier-check — the optional Tier-3 capability gate as an
 * independently runnable probe.
 *
 * `bun run --cwd=evals v2/src/cli.ts --release-tier` is the root gate
 * contract's `release-eval-tier3` stage (`scripts/validation-gates.ts`): the
 * evals CLI's deterministic structural rehearsal (token rotation + ceiling),
 * failing closed on breach. It has NO `fid:verify` declaration: the allowed
 * shapes are `typecheck`, `test`, `probe` and `quality` (FID-2026-0823-009),
 * and this is a workspace file invoked with a FLAG, which a bare `probe
 * scripts/…` cannot express (a probe passes no arguments).
 *
 * Two properties are preserved faithfully. First, the wrapper always throws
 * `--release-tier`, so the declaration exists and is runnable on demand.
 * Second, the stage stays OPT-IN: the underlying rehearsal costs ~2M tokens and
 * is only meant to run when the operator exports
 * `SAVANT_CODE_RELEASE_EVAL_TIER=full`. This probe is therefore the ad-hoc
 * route (an operator or a FID that is specifically about the capability gate
 * declares it deliberately); the default release path reaches it through
 * `releaseEvalTierGate`, which is env-gated.
 *
 * This is the `probe` route the FID template names: exit 0 clean, non-zero with
 * the rehearsal's own output. Same shape as `scripts/lint-md-check.ts`.
 */
import { runProbe, runProbeMain } from './probe-runner'

import type { ProbeSpec } from './probe-runner'

const SPEC: ProbeSpec = {
  label: 'release-eval-tier-check',
  argv: ['run', '--cwd=evals', 'v2/src/cli.ts', '--release-tier'],
  pass: 'release-eval-tier-check PASS — the Tier-3 capability rehearsal held its ceiling.',
  fail: 'release-eval-tier-check FAILED — the Tier-3 capability rehearsal breached:',
}

export function main(): number {
  return runProbe(SPEC)
}

if (import.meta.main) runProbeMain(SPEC)
