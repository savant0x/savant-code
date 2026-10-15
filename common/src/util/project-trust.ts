/**
 * Project-trust gating with parent-path inheritance
 * (FID-2026-1006-002 WP9, adopted from the pi harness `core/project-trust.ts`
 * and its `security.md` "Project Trust" section).
 *
 * Savant loads workspace resources — skills under `.agents/skills/`, project
 * config, agent definitions — from the directory it is opened in. A cloned
 * repository therefore ships *executable* content: a `.agents/skills/` tree is
 * prompt material the next run will read. Trust is the decision that decides
 * whether those resources are loaded at all, and it is keyed by CANONICAL
 * directory with **closest-parent-wins** inheritance, so trusting
 * `~/work/monorepo` also covers `~/work/monorepo/packages/api` without a
 * separate entry — and a decision recorded for a child directory overrides the
 * parent's.
 *
 * The resolution order is fixed and every branch is named in the result:
 *
 * 1. **Operator override** (`approve` / `deny`) — the explicit CLI flag. `deny`
 *    wins when both are set: a contradictory flag pair must resolve the safe
 *    way.
 * 2. **Recorded decision** — the nearest ancestor present in the store that
 *    carries a real decision (`trusted` / `denied`). An `ask` entry is not a
 *    decision and does not stop the chain.
 * 3. **Deciders, in order — the first one that returns a decision owns it.**
 *    This is pi's extension rule. A decider that returns `undefined` (or
 *    defers with `ask`) is not a decision and the next decider is consulted;
 *    a decider that answers ends the chain, including answers the operator's
 *    saved store would have contradicted (that is what "owns it" means).
 * 4. **Default** — `defaultProjectTrust`, `ask` unless configured otherwise.
 * 5. **Fail closed** — a resolved `ask` in a non-interactive session becomes
 *    `denied` (`effective`), because there is nobody to ask. Resources are
 *    then not loaded.
 *
 * The store half (canonical keys, ancestry, the JSON file) lives in
 * `project-trust-store.ts` and is re-exported here — one import path for
 * consumers.
 */

import {
  canonicalTrustKey,
  readProjectTrustStore,
  recordedFor,
  trustAncestry,
} from './project-trust-store'

export * from './project-trust-store'

/** What a trust decision can be. `ask` means "no decision recorded". */
export type ProjectTrustDecision = 'trusted' | 'denied' | 'ask'

/** Where a resolved decision came from — every branch names itself. */
export type ProjectTrustSource =
  'override' | 'store' | 'decider' | 'default' | 'non-interactive'

export type ProjectTrustConfig = {
  /** Decision when nothing is recorded or decided. Default `ask`. */
  defaultProjectTrust?: ProjectTrustDecision
  /** `--approve`: trust this project for this run. */
  approve?: boolean
  /** `--no-approve`: refuse this project for this run. Beats `approve`. */
  deny?: boolean
  /** No interactive surface available — a resolved `ask` fails closed. */
  nonInteractive?: boolean
  /** Store path override (tests). Default `<home>/.savant-free/project-trust.json`. */
  storePath?: string
}

/**
 * What a decider is asked: the directory as it was offered (for display and
 * for anything the decider itself persists) and its canonical key (what a
 * recorded decision is stored under).
 */
export type ProjectTrustRequest = {
  directory: string
  key: string
}

/**
 * A trust decider (a hook, the interactive prompt, a policy module). Returning
 * `undefined` or `ask` means "no decision — try the next decider". A decider
 * may be async: the hook-backed one runs a process, so the chain is awaited.
 */
export type ProjectTrustDecider = (
  request: ProjectTrustRequest,
) =>
  ProjectTrustDecision | undefined | Promise<ProjectTrustDecision | undefined>

export type ProjectTrustResolution = {
  /** The decision after the chain: `trusted`, `denied`, or `ask`. */
  decision: ProjectTrustDecision
  /** `decision`, with a non-interactive `ask` failed closed to `denied`. */
  effective: 'trusted' | 'denied'
  source: ProjectTrustSource
  /** Canonical key of the directory asked about. */
  key: string
  /** Canonical key of the ancestor whose record decided it, when inherited. */
  inheritedFrom?: string
}

async function firstDecision(
  deciders: readonly ProjectTrustDecider[],
  request: ProjectTrustRequest,
): Promise<ProjectTrustDecision | undefined> {
  for (const decider of deciders) {
    const decision = await decider(request)
    if (decision === 'trusted' || decision === 'denied') return decision
  }
  return undefined
}

/**
 * Resolve the trust decision for `directory`. See the module header for the
 * fixed order: override → recorded (nearest ancestor) → first decider that
 * decides → default → fail closed.
 */
export async function resolveProjectTrust(
  directory: string,
  config: ProjectTrustConfig = {},
  deciders: readonly ProjectTrustDecider[] = [],
): Promise<ProjectTrustResolution> {
  const key = canonicalTrustKey(directory)
  const ancestry = trustAncestry(directory)
  const base = { key }

  if (config.deny === true) {
    return {
      ...base,
      decision: 'denied',
      effective: 'denied',
      source: 'override',
    }
  }
  if (config.approve === true) {
    return {
      ...base,
      decision: 'trusted',
      effective: 'trusted',
      source: 'override',
    }
  }

  const recorded = recordedFor(
    ancestry,
    readProjectTrustStore(config.storePath),
  )
  if (recorded !== undefined) {
    return {
      ...base,
      decision: recorded.decision,
      effective: recorded.decision,
      source: 'store',
      ...(recorded.key === key ? {} : { inheritedFrom: recorded.key }),
    }
  }

  const decided = await firstDecision(deciders, { directory, key })
  const decision: ProjectTrustDecision =
    decided ?? config.defaultProjectTrust ?? 'ask'
  const source: ProjectTrustSource =
    decided !== undefined ? 'decider' : 'default'

  if (decision !== 'ask') {
    return { ...base, decision, effective: decision, source }
  }
  // An unresolved `ask` never loads resources on its own: with no interactive
  // surface the session must fail closed, and with one the caller is expected
  // to re-resolve after the operator answers (`approve`/`deny`/a store write).
  // `decision` stays `ask` so that caller can tell the two situations apart.
  return config.nonInteractive === true
    ? { ...base, decision, effective: 'denied', source: 'non-interactive' }
    : { ...base, decision, effective: 'denied', source }
}

/** Whether workspace resources under `directory` may be loaded. */
export async function isProjectTrusted(
  directory: string,
  config: ProjectTrustConfig = {},
  deciders: readonly ProjectTrustDecider[] = [],
): Promise<boolean> {
  const resolved = await resolveProjectTrust(directory, config, deciders)
  return resolved.effective === 'trusted'
}
