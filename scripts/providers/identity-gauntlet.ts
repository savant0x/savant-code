#!/usr/bin/env bun
/**
 * FID-2026-1007-008 — the operator-run identity gauntlet.
 *
 * `bun run providers:identity -- --provider hcnsec --model kimi-k3 [--json]`
 * `bun run providers:identity -- --provider hcnsec --all [--deep] [--json]`
 *
 * `--all` sweeps every checked-in catalog route for the provider (one
 * handshake probe each; `--deep` runs all five vectors); `--models a,b,c`
 * sweeps an explicit list. A sweep never treats one route's failure as the
 * provider's — HCNSec served `glm-5.3-flash` (200) while `kimi-k3` returned
 * 500 in the same minute on 2026-10-07.
 *
 * Every run writes a dated report (`identity-report.md` + `.json`) under
 * `dev/provider-identity/` — override the directory with `--report-dir`. The
 * report is what makes the tool re-usable: a run is re-readable and comparable
 * rather than a one-off screen of output.
 *
 * Operator-initiated only. It is never scheduled, never runs at startup, and
 * never runs as part of a user's turn: the passive half of this program lives
 * in `packages/agent-runtime/src/provider-boundary/identity-observation.ts` and
 * makes no request at all. Every rule — budget, redaction, controls, verdict,
 * composite calibration — lives in `lib/identity-core.ts` and
 * `lib/identity-runner.ts` and is pinned offline; this file is only the
 * transport and the argument parsing around them.
 *
 * The operator's key is read from `<SLUG>_API_KEY` or `IDENTITY_API_KEY` at
 * invocation, used in request headers only, and never written to disk. It is
 * checked BEFORE any request is attempted, so a missing key is a clear refusal
 * rather than a burst of 401 probe traffic.
 *
 * Costs the operator's own quota. Results are advisory: a mismatch forces human
 * review and a separate FID, never an automatic routing change.
 */
import { IDENTITY_VECTORS } from './lib/identity-core'
import { buildManifest, MANIFEST_VERSION } from './lib/identity-manifest'
import { runIdentityMatrix } from './lib/identity-matrix'
import { writeIdentityReport, writeMatrixReport } from './lib/identity-report'
import { runIdentityGauntlet } from './lib/identity-runner'
import { createInvoker } from './lib/identity-transport'
import { providerBaseUrl, providerRoutes } from './lib/provider-models'

import type { IdentityVector, ProbeManifest } from './lib/identity-core'

export interface CliArgs {
  provider: string
  /** Absent for a sweep (`--all` / `--models`), required for one target. */
  model?: string
  baseUrl?: string
  /** Sweep every checked-in catalog route for the provider. */
  all: boolean
  /** Sweep an explicit model list, or undefined. */
  models?: string[]
  /** A sweep runs one handshake probe per route unless `--deep` is set. */
  deep: boolean
  json: boolean
  controlModel?: string
  controlProvider?: string
  controlBaseUrl?: string
  differentProvider?: string
  differentModel?: string
  differentBaseUrl?: string
  reportDir?: string
}

export function parseArgs(argv: readonly string[]): CliArgs {
  const read = (name: string): string | undefined => {
    const index = argv.indexOf(`--${name}`)
    return index >= 0 ? argv[index + 1] : undefined
  }
  const provider = read('provider')
  if (provider === undefined) {
    throw new Error(
      'usage: --provider <slug> (--model <id> --base-url <url> | --all | --models <a,b,c>) [--json]',
    )
  }
  const modelsRaw = read('models')
  const models =
    modelsRaw === undefined
      ? undefined
      : modelsRaw
          .split(',')
          .map((id) => id.trim())
          .filter((id) => id.length > 0)
  const all = argv.includes('--all')
  const model = read('model')
  // A sweep defaults the base URL to the provider's own registry entry; a
  // single-target run still needs one explicitly — a guessed endpoint would
  // spend quota probing a host nobody named.
  const baseUrl = read('base-url') ?? providerBaseUrl(provider)
  if (
    !all &&
    models === undefined &&
    (model === undefined || baseUrl === undefined)
  ) {
    throw new Error(
      'usage: --provider <slug> --model <id> --base-url <url> [--json]',
    )
  }
  return {
    provider,
    model,
    baseUrl,
    all,
    models,
    deep: argv.includes('--deep'),
    json: argv.includes('--json'),
    controlProvider: read('control-provider'),
    controlModel: read('control-model'),
    controlBaseUrl: read('control-base-url'),
    differentProvider: read('different-provider'),
    differentModel: read('different-model'),
    differentBaseUrl: read('different-base-url'),
    reportDir: read('report-dir'),
  }
}

/**
 * Resolves the key without touching the network. Throws a named refusal so the
 * caller never spends quota discovering that nothing was configured.
 */
export function resolveKey(
  provider: string,
  env: Record<string, string | undefined>,
): string {
  const slug = provider.toUpperCase().replace(/[^A-Z0-9]/g, '_')
  const key = env[`${slug}_API_KEY`] ?? env['IDENTITY_API_KEY']
  if (key === undefined || key.length === 0) {
    throw new Error(
      `no credential for ${provider}: set ${slug}_API_KEY or IDENTITY_API_KEY (nothing was sent)`,
    )
  }
  return key
}

/**
 * Sweeps every catalog route for one provider. A per-route failure is reported
 * as that route failing — never as the provider being down.
 */
async function runSweep(
  args: CliArgs,
  env: Record<string, string | undefined>,
  argv: readonly string[],
): Promise<number> {
  const routes =
    args.models !== undefined
      ? args.models.map((model) => ({
          provider: args.provider,
          model,
          baseUrl: args.baseUrl ?? '',
        }))
      : providerRoutes(args.provider)
  if (routes.length === 0) {
    throw new Error(
      `no catalog routes for ${args.provider}: pass --models a,b,c (nothing was sent)`,
    )
  }
  const baseByModel = new Map(
    routes.map((route) => [route.model, route.baseUrl]),
  )
  const invoke = createInvoker(
    new Map([[args.provider, resolveKey(args.provider, env)]]),
  )
  const vectors: readonly IdentityVector[] = args.deep
    ? IDENTITY_VECTORS
    : ['A']
  const matrix = await runIdentityMatrix({
    version: MANIFEST_VERSION,
    provider: args.provider,
    targets: routes,
    buildManifest: (model) =>
      buildManifest({
        provider: args.provider,
        model,
        baseUrl: baseByModel.get(model) ?? '',
        vectors,
      }),
    invoke,
  })
  const { reportPath } = writeMatrixReport(
    matrix,
    {
      generatedAt: new Date().toISOString(),
      command: `bun run providers:identity ${argv.join(' ')}`,
    },
    args.reportDir,
  )
  console.log(
    args.json
      ? JSON.stringify(matrix, null, 2)
      : [
          `swept ${matrix.summary.models} routes: ok ${matrix.summary.ok}, unavailable ${matrix.summary.unavailable}, failed ${matrix.summary.failed}`,
          `served-label: ${matrix.summary.labelMatch} match, ${matrix.summary.labelMismatch} mismatch`,
          ...matrix.rows.map(
            (row) =>
              `  ${row.status === 'ok' ? ' ' : '!'} ${row.model}: ${row.status} — label ${row.label}` +
              `${row.servedModels.length > 0 ? ` (served ${row.servedModels.join(', ')})` : ''}` +
              `${row.failureClass !== undefined ? ` [${row.failureClass}]` : ''}`,
          ),
          `report: ${reportPath}`,
          'advisory only — no routing change is made by this tool',
        ].join('\n'),
  )
  return 0
}

async function main(argv: readonly string[]): Promise<number> {
  const args = parseArgs(argv)
  const env = process.env
  if (args.all || args.models !== undefined) {
    return runSweep(args, env, argv)
  }
  const keys = new Map<string, string>([
    [args.provider, resolveKey(args.provider, env)],
  ])
  if (args.controlProvider !== undefined) {
    keys.set(args.controlProvider, resolveKey(args.controlProvider, env))
  }
  if (args.differentProvider !== undefined) {
    keys.set(args.differentProvider, resolveKey(args.differentProvider, env))
  }
  const controls: ProbeManifest['controls'] = {}
  if (args.controlProvider !== undefined && args.controlModel !== undefined) {
    controls.sameModel = {
      provider: args.controlProvider,
      requestedModel: args.controlModel,
      baseUrl: args.controlBaseUrl ?? args.baseUrl ?? '',
    }
  }
  if (
    args.differentProvider !== undefined &&
    args.differentModel !== undefined
  ) {
    controls.differentModel = {
      provider: args.differentProvider,
      requestedModel: args.differentModel,
      baseUrl: args.differentBaseUrl ?? args.baseUrl ?? '',
    }
  }
  const report = await runIdentityGauntlet({
    manifest: buildManifest({
      provider: args.provider,
      model: args.model ?? '',
      baseUrl: args.baseUrl ?? '',
      controls,
    }),
    invoke: createInvoker(keys),
  })
  const { reportPath } = writeIdentityReport(
    report,
    {
      generatedAt: new Date().toISOString(),
      command: `bun run providers:identity ${argv.join(' ')}`,
    },
    args.reportDir,
  )
  console.log(
    args.json
      ? JSON.stringify(report, null, 2)
      : [
          `verdict: ${report.verdict}`,
          `attempts ${report.attemptsUsed}, tokens ${report.tokensUsed}, ${report.wallMs}ms`,
          ...report.evidence.map((line) => `  ${line}`),
          ...report.vectors.map(
            (vector) =>
              `  vector ${vector.vector}: ${vector.status} (${vector.completed}/${vector.probes})`,
          ),
          `report: ${reportPath}`,
          'advisory only — no routing change is made by this tool',
        ].join('\n'),
  )
  return 0
}

if (import.meta.main) {
  try {
    process.exitCode = await main(process.argv.slice(2))
  } catch (error) {
    console.error(String(error instanceof Error ? error.message : error))
    process.exitCode = 1
  }
}
