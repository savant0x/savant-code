/**
 * FID-2026-1007-016 — the catalog sweep, split out of `identity-gauntlet.ts`
 * to keep the CLI under the 300-line ceiling (same precedent as
 * `identity-manifest.ts`). The CLI keeps arg parsing, the single-target run,
 * and dispatch; everything sweep-shaped lives here.
 *
 * NOTE (import cycle, deliberate): this module imports `CliArgs` (type-only,
 * erased) and `resolveKey` (called only after module init, inside runSweep)
 * from `../identity-gauntlet`, which imports `runSweep` back. ESM-safe by
 * construction, accepted by tsc/bun/eslint — and still a smell, so it is
 * stated here rather than discovered later. If `resolveKey` ever needs to
 * run at module scope, move it (with `CliArgs`) into this module instead.
 */
import { resolveKey } from '../identity-gauntlet'
import { controlKey, loadSweepControls } from './identity-controls'
import { IDENTITY_VECTORS, modelFamily } from './identity-core'
import { buildManifest, MANIFEST_VERSION } from './identity-manifest'
import { runIdentityMatrix } from './identity-matrix'
import { writeMatrixReport } from './identity-report'
import { createInvoker } from './identity-transport'
import { providerRoutes } from './provider-models'

import type { CliArgs } from '../identity-gauntlet'
import type { SweepControlEndpoint } from './identity-controls'
import type {
  IdentityVector,
  ProbeInvoker,
  ProbeManifest,
} from './identity-core'

/**
 * Sweeps every catalog route for one provider. A per-route failure is reported
 * as that route failing — never as the provider being down.
 */
export async function runSweep(
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
  // Operator-owned controls load before any credential or request: a config
  // error refuses before anything is spent.
  const controlsManifest = loadSweepControls(args.controlsManifest)
  const keys = new Map([[args.provider, resolveKey(args.provider, env)]])
  // Per-route arming: a manifest entry keyed `<provider>/<family>` supplies
  // the control pair; anything missing runs uncontrolled (inconclusive).
  // Control credentials resolve up front — a missing key warns before its
  // route runs, never mid-sweep. Setup notes go to stderr so `--json`
  // stdout stays parseable.
  const armed = routes.map((route) => {
    const family = modelFamily(route.model)
    const entry =
      family === '' || controlsManifest === null
        ? undefined
        : controlsManifest.entries[controlKey(args.provider, family)]
    if (entry === undefined) return null
    const controls: NonNullable<ProbeManifest['controls']> = {}
    const endpoints: SweepControlEndpoint[] = []
    const slots = [
      ['sameModel', entry.sameModel],
      ['differentModel', entry.differentModel],
    ] as const
    for (const [slot, endpoint] of slots) {
      if (endpoint === undefined) continue
      try {
        keys.set(endpoint.provider, resolveKey(endpoint.provider, env))
      } catch {
        console.warn(
          `  ! ${route.model}: no credential for control provider ${endpoint.provider} — row runs uncontrolled`,
        )
        return null
      }
      controls[slot] = {
        provider: endpoint.provider,
        requestedModel: endpoint.requestedModel,
        baseUrl: endpoint.baseUrl,
      }
      endpoints.push(endpoint)
    }
    // A control must be a pair: a half-configured row spends probes for a
    // verdict `verdictFor` can never reach. Run it uncontrolled instead.
    if (endpoints.length !== 2) {
      if (endpoints.length === 1) {
        console.warn(
          `  ! ${route.model}: half-configured control pair — row runs uncontrolled`,
        )
      }
      return null
    }
    console.warn(
      `  ~ ${route.model}: controls armed` +
        (entry.capturedAt === undefined
          ? ''
          : ` (captured ${entry.capturedAt})`),
    )
    return { controls, endpoints }
  })
  const armByModel = new Map(
    routes.map((route, index) => [route.model, armed[index]]),
  )
  const invoke = createInvoker(keys)
  const endpointSet = new Set<string>()
  for (const arm of armed) {
    if (arm === null) continue
    for (const endpoint of arm.endpoints) {
      endpointSet.add(
        `${endpoint.provider}${endpoint.requestedModel}${endpoint.baseUrl}`,
      )
    }
  }
  let controlProbesUsed = 0
  let budgetExhausted = false
  const budgetedInvoke: ProbeInvoker = async (target, spec) => {
    const key = `${target.provider}${target.requestedModel}${target.baseUrl}`
    if (endpointSet.has(key)) {
      if (
        args.maxControlProbes !== undefined &&
        controlProbesUsed >= args.maxControlProbes
      ) {
        budgetExhausted = true
        return {
          probeId: spec.id,
          text: '',
          latencyMs: 0,
          failure: {
            class: 'control-budget-exhausted',
            message: `sweep control probe budget (${args.maxControlProbes}) exhausted — row runs uncontrolled`,
          },
        }
      }
      controlProbesUsed += 1
    }
    return invoke(target, spec)
  }
  const vectors: readonly IdentityVector[] = args.deep
    ? IDENTITY_VECTORS
    : ['A']
  const armedCount = armed.filter((arm) => arm !== null).length
  const matrix = await runIdentityMatrix({
    version: MANIFEST_VERSION,
    provider: args.provider,
    targets: routes,
    buildManifest: (model) => {
      const arm = armByModel.get(model)
      // A verdict needs two completed target probes (`verdictFor`
      // false-positive restraint), so controlled handshake rows run A+B;
      // uncontrolled rows keep today's single probe and cost.
      const routeVectors: readonly IdentityVector[] =
        arm !== null && arm !== undefined && !args.deep ? ['A', 'B'] : vectors
      return buildManifest({
        provider: args.provider,
        model,
        baseUrl: baseByModel.get(model) ?? '',
        vectors: routeVectors,
        controls: arm?.controls ?? {},
      })
    },
    invoke: budgetedInvoke,
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
          `controls: ${armedCount}/${matrix.summary.models} routes armed` +
            (args.controlsManifest === undefined
              ? ' (no manifest — all rows inconclusive)'
              : ` (manifest ${args.controlsManifest})`),
          ...matrix.rows.map(
            (row) =>
              `  ${row.status === 'ok' ? ' ' : '!'} ${row.model}: ${row.status} — label ${row.label}` +
              `${row.servedModels.length > 0 ? ` (served ${row.servedModels.join(', ')})` : ''}` +
              `${row.failureClass !== undefined ? ` [${row.failureClass}]` : ''}` +
              ` — verdict ${row.verdict}`,
          ),
          ...(budgetExhausted
            ? [
                `control probe budget exhausted after ${controlProbesUsed} probes — remaining routes ran uncontrolled`,
              ]
            : []),
          `report: ${reportPath}`,
          'advisory only — no routing change is made by this tool',
        ].join('\n'),
  )
  return 0
}
