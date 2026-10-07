/**
 * FID-2026-1007-008 — passive provider identity observation.
 *
 * The operator's fraud-detection research and addendum want to know whether a
 * route serves the model it claims. Two things are deliberately NOT in this
 * module:
 *
 * 1. **No network.** Nothing here performs a request. The active gauntlet is an
 *    operator-run tool under `scripts/providers/` with its own budget; this
 *    module only *records what a completed call already returned* (the route,
 *    the requested and served model ids, usage, timing) and replays a dated
 *    verdict. A user's turn must never be delayed, repeated or rerouted to
 *    satisfy an audit.
 * 2. **No verdicts of its own.** It stores and ages verdicts produced elsewhere.
 *    A verdict is scoped to an explicit set of tested claims; nothing here
 *    converts one into a routing decision, a block, or a score.
 *
 * The third deliberate limit is **staleness**: a verdict is bound to an
 * endpoint, a requested/returned id pair, a manifest version and a timestamp,
 * so it can expire into "unknown" rather than quietly describing an endpoint
 * that has since changed.
 */
import type { JSONValue } from '@savant-code/common/types/json'

/** What a completed provider call already tells us. No extra request. */
export interface ProviderIdentityObservation {
  /** Provider route id, e.g. `hcnsec`. */
  provider: string
  /** The model id the request asked for. */
  requestedModel: string
  /** The model id the response reported serving, when it reported one. */
  servedModel?: string
  /** Wall-clock time of the observation. */
  observedAt: number
  /** Reported usage, when the response carried it (informational only). */
  usage?: { inputTokens?: number; outputTokens?: number }
  /** Non-sensitive response identifiers (request id, version header, …). */
  metadata?: Record<string, JSONValue>
}

/**
 * What an audit is allowed to conclude. `inconclusive` is a first-class
 * outcome, not a failure: no controls, no live authority or a weak signal must
 * land here rather than drifting into an accusation.
 */
export type IdentityVerdictStatus =
  'verified-for-tested-claims' | 'mismatch-requiring-review' | 'inconclusive'

export interface IdentityVerdict {
  provider: string
  /** The exact claim(s) the audit tested, in the audit's own words. */
  testedClaims: readonly string[]
  status: IdentityVerdictStatus
  /** ISO date the verdict was produced. */
  datedAt: string
  /** Probe manifest version, so a verdict cannot describe a later manifest. */
  manifestVersion: string
  /** Human-readable, already-redacted evidence lines. */
  evidence: readonly string[]
  /** Where it came from. Only `live` can support a served-model claim. */
  source: 'offline' | 'live'
}

export interface IdentityAdvisory {
  provider: string
  claimedModels: readonly string[]
  status: IdentityVerdictStatus
  datedAt: string
  /** True when the verdict is older than the caller's freshness window. */
  stale: boolean
  /** Advisory prose for the agent context. Never an instruction to reroute. */
  note: string
}

/** Stable key for a route + requested model pair. */
export function identityRouteKey(
  provider: string,
  requestedModel: string,
): string {
  return `${provider}::${requestedModel}`
}

/**
 * Records passive observations and holds the newest verdict per route.
 *
 * Plain in-memory state owned by its caller — no module scope, so one session
 * cannot inherit another's verdicts and no test preload has to reset it.
 */
export class ProviderIdentityObserver {
  private readonly observations = new Map<
    string,
    ProviderIdentityObservation[]
  >()
  private readonly verdicts = new Map<string, IdentityVerdict>()

  /** Bounded per-route history; the oldest entries are dropped first. */
  constructor(private readonly maxObservationsPerRoute = 20) {}

  record(observation: ProviderIdentityObservation): void {
    const key = identityRouteKey(
      observation.provider,
      observation.requestedModel,
    )
    const history = this.observations.get(key) ?? []
    history.push(observation)
    if (history.length > this.maxObservationsPerRoute) {
      history.splice(0, history.length - this.maxObservationsPerRoute)
    }
    this.observations.set(key, history)
  }

  /** Observations for one route, newest last. */
  history(
    provider: string,
    requestedModel: string,
  ): readonly ProviderIdentityObservation[] {
    return (
      this.observations.get(identityRouteKey(provider, requestedModel)) ?? []
    )
  }

  /**
   * Stores a verdict across every requested model it names. Artifact-only:
   * `mismatch-requiring-review` never mutates routing here.
   */
  recordVerdict(verdict: IdentityVerdict, requestedModels: readonly string[]) {
    for (const model of requestedModels) {
      this.verdicts.set(identityRouteKey(verdict.provider, model), verdict)
    }
  }

  /**
   * The advisory note for a route, or undefined when nothing was ever audited.
   *
   * `maxAgeDays` turns an old verdict into an explicitly stale advisory rather
   * than a silent one: the note says so, and `stale` says so to the caller.
   */
  advisoryFor(
    provider: string,
    requestedModel: string,
    now: number,
    maxAgeDays = 30,
  ): IdentityAdvisory | undefined {
    const verdict = this.verdicts.get(
      identityRouteKey(provider, requestedModel),
    )
    if (verdict === undefined) return undefined
    const ageMs = now - Date.parse(verdict.datedAt)
    const stale =
      !Number.isFinite(ageMs) || ageMs > maxAgeDays * 24 * 60 * 60 * 1_000
    return {
      provider: verdict.provider,
      claimedModels: [requestedModel],
      status: verdict.status,
      datedAt: verdict.datedAt,
      stale,
      note: advisoryNote(verdict, stale),
    }
  }
}

/**
 * Advisory prose. Written to be useful and inert: it reports what an audit
 * concluded on a date and explicitly leaves routing to a human.
 */
function advisoryNote(verdict: IdentityVerdict, stale: boolean): string {
  const claims = verdict.testedClaims.join('; ')
  const age = stale ? ` (stale — re-audit before relying on it)` : ''
  if (verdict.status === 'mismatch-requiring-review') {
    return `Provider identity audit ${verdict.datedAt}${age} reported a MISMATCH for: ${claims}. This is evidence requiring review, not proof — routing is unchanged and no model is blocked.`
  }
  if (verdict.status === 'inconclusive') {
    return `Provider identity audit ${verdict.datedAt}${age} was INCONCLUSIVE for: ${claims}. Nothing is claimed about this route; routing is unchanged.`
  }
  return `Provider identity audit ${verdict.datedAt}${age} verified only these claims for this route: ${claims}. It is not a claim about model weights.`
}
