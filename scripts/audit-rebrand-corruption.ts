/**
 * FID-2026-0813-023: fail-closed, absence-shaped scan for the un-expanded
 * rebrand marker.
 *
 * The rebrand commit (da18963) left the literal identifier `savantCode$1`
 * repo-wide. It compiles silently — no type error, no lint warning — so the
 * only durable defense is a validation gate that fails when the marker
 * reappears in source.
 *
 * Extracted from `validate-repository.ts` alongside `audit-exit-codes.ts` and
 * `audit-gate-env-parity.ts`; the aggregator was over the 300-line ceiling.
 */
import fs from 'node:fs'
import path from 'node:path'

export type RebrandCorruptionIssue = { code: string; message: string }

const REBRAND_CORRUPTION_MARKER = 'savantCode$1'

const REBRAND_SOURCE_DIRS = [
  'sdk/src',
  'cli/src',
  'common/src',
  'packages',
  'agents',
]

const SKIP_DIRS = new Set(['node_modules', 'dist'])

function collectRebrandHits(root: string, dir: string, hits: string[]): void {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      collectRebrandHits(root, full, hits)
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      if (fs.readFileSync(full, 'utf8').includes(REBRAND_CORRUPTION_MARKER)) {
        hits.push(path.relative(root, full))
      }
    }
  }
}

export function auditRebrandCorruption(root: string): RebrandCorruptionIssue[] {
  const hits: string[] = []
  for (const dir of REBRAND_SOURCE_DIRS) {
    collectRebrandHits(root, path.join(root, dir), hits)
  }
  if (hits.length === 0) return []
  return [
    {
      code: 'rebrand.corruption',
      message:
        `Un-expanded rebrand marker \`${REBRAND_CORRUPTION_MARKER}\` found at ` +
        `${hits.length} source location(s): ${hits.join(', ')}`,
    },
  ]
}
