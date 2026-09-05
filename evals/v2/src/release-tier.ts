import { readFileSync } from 'node:fs'
import path from 'node:path'

import {
  assertTokenCeiling,
  DEFAULT_RELEASE_TOKEN_CEILING,
  estimateTokens,
  selectForRelease,
} from './ingest/rotation'
import { loadTaskRegistry } from './registry'

// FID-2026-0819-005 Loop 155: the Tier-3 release-rotation command, extracted
// verbatim from cli.ts.

const ROOT_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/

/**
 * FID-2026-0824-019: Tier-3 structural rehearsal — deterministic rotation
 * plan + token ceiling against the current corpus. Baseline-only by design
 * (zero tokens); live evaluate-mode runs stay operator-keyed.
 */
export async function runReleaseTier(versionOverride?: string): Promise<void> {
  const version =
    versionOverride ??
    (() => {
      const raw = readFileSync(
        path.resolve(import.meta.dir, '..', '..', '..', 'VERSION'),
        'utf8',
      ).trim()
      if (!ROOT_VERSION_PATTERN.test(raw)) {
        throw new Error(`root VERSION is malformed: ${raw}`)
      }
      return raw
    })()

  const registry = await loadTaskRegistry(
    path.resolve(import.meta.dir, '..', 'tasks'),
  )
  const selected = selectForRelease(Object.values(registry), version)
  const estimate = estimateTokens(selected.length)

  console.log(`Tier-3 rotation plan for v${version}:`)
  for (const task of selected) {
    console.log(`  - [${task.category}/${task.difficulty}] ${task.task_id}`)
  }
  console.log(
    `selected ${selected.length} task(s); estimated tokens ${estimate} (ceiling ${DEFAULT_RELEASE_TOKEN_CEILING})`,
  )
  if (selected.length === 0) {
    throw new Error('Tier-3 rotation selected zero tasks — corpus empty?')
  }
  assertTokenCeiling(estimate)
  console.log(
    'Baseline structural rehearsal complete; live capability runs are operator-keyed.',
  )
}
