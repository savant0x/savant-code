import type {
  DriveManifest,
  DriveMilestone,
} from '@savant-code/common/types/auto-drive'

/**
 * FID-2026-0818-003: Auto Drive decomposition manifest check.
 *
 * Proves, mechanically, that the plan→FID conversion was complete and lawful:
 * every plan milestone has a FID (nothing in the approved scope went missing)
 * AND every FID traces to a plan milestone (an extra FID is unapproved scope
 * expansion — equally a Law 2 violation). Dependency edges must reference real
 * milestones, numbering must be unique, and the result includes the
 * dependency-ordered (topological) execution order the drive queue uses.
 */

export type ManifestFid = {
  /** FID-YYYY-MMDD-NNN identifier. */
  id: string
  /** The milestone this FID implements, when present. */
  milestoneId?: string
  dependsOn: string[]
}

export type ManifestCheckResult = {
  valid: boolean
  errors: string[]
  /** Milestone ids in dependency order (topological). */
  orderedMilestones: string[]
}

export function validatePlanManifest(
  manifest: DriveManifest,
  fids: readonly ManifestFid[],
): ManifestCheckResult {
  const errors: string[] = []
  const milestones = manifest.milestones
  const milestoneIds = milestones.map((m) => m.id)
  const milestoneSet = new Set(milestoneIds)

  if (milestoneSet.size !== milestoneIds.length) {
    errors.push('duplicate milestone id in plan manifest')
  }

  // Bidirectional coverage: plan ⊆ FIDs and FIDs ⊆ plan.
  const fidMilestoneIds = fids
    .map((f) => f.milestoneId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
  for (const id of milestoneIds) {
    if (!fidMilestoneIds.includes(id)) {
      errors.push(`plan milestone "${id}" has no FID (silent scope drop)`)
    }
  }
  for (const id of fidMilestoneIds) {
    if (!milestoneSet.has(id)) {
      errors.push(`FID maps to unknown milestone "${id}" (unapproved scope)`)
    }
  }

  // Unique FID numbering.
  const fidIds = fids.map((f) => f.id)
  if (new Set(fidIds).size !== fidIds.length) {
    errors.push('duplicate FID id in manifest')
  }

  // Dependency edges must reference real milestones.
  for (const milestone of milestones) {
    for (const dep of milestone.dependsOn) {
      if (!milestoneSet.has(dep)) {
        errors.push(
          `milestone "${milestone.id}" depends on unknown milestone "${dep}"`,
        )
      }
    }
  }

  const ordered = topologicalOrder(milestones, errors)
  return {
    valid: errors.length === 0,
    errors,
    orderedMilestones: ordered,
  }
}

/** Kahn-style topological sort keyed by `dependsOn` edges; reports cycles. */
export function topologicalOrder(
  milestones: readonly DriveMilestone[],
  errors: string[],
): string[] {
  const byId = new Map(milestones.map((m) => [m.id, m]))
  const indegree = new Map<string, number>()
  const dependents = new Map<string, string[]>()

  for (const m of milestones) {
    if (!indegree.has(m.id)) indegree.set(m.id, 0)
    for (const dep of m.dependsOn) {
      if (!byId.has(dep)) continue
      indegree.set(m.id, (indegree.get(m.id) ?? 0) + 1)
      const list = dependents.get(dep) ?? []
      list.push(m.id)
      dependents.set(dep, list)
    }
  }

  const ready = [...milestones]
    .filter((m) => (indegree.get(m.id) ?? 0) === 0)
    .map((m) => m.id)
  const order: string[] = []

  while (ready.length > 0) {
    const id = ready.shift()!
    order.push(id)
    for (const dependent of dependents.get(id) ?? []) {
      const next = (indegree.get(dependent) ?? 0) - 1
      indegree.set(dependent, next)
      if (next === 0) ready.push(dependent)
    }
  }

  if (order.length !== milestones.length) {
    errors.push(
      `dependency cycle detected among milestones (${milestones.length - order.length} unreachable)`,
    )
  }
  return order
}
