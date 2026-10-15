/**
 * FID-2026-0912-002 — archive-not-purge (the archive executor).
 *
 * Expired never-trusted drafts MOVE to
 * `.quarantine/.archive/<YYYY-MM>/<name>/` (SKILL.md bytes intact) with an
 * ARCHIVED.json provenance record. NOTHING is ever deleted: a rejected
 * draft is the harness's memory of what it proposed and why; the operator
 * may revisit or resurrect it at any time (the harness cannot forget).
 *
 * The archive directory is inert by name (`.`-prefixed): the quarantine
 * loader and count skip it, so archived drafts cost zero context. Name
 * collisions in the same month get `-2`, `-3`, … suffixes.
 *
 * Extracted from lessons-to-skills.ts to hold that file under the
 * 300-line ceiling.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

import { readSkillFile } from '@savant-code/common/util/skill-management'

export const DRAFT_REJECTION_WINDOW_DAYS = 30
const MS_PER_DAY = 24 * 60 * 60 * 1000

export function archiveRejectedDrafts(
  rootDir: string,
  opts: { now?: number } = {},
): string[] {
  const now = opts.now ?? Date.now()
  const cutoff = now - DRAFT_REJECTION_WINDOW_DAYS * MS_PER_DAY
  const quarantineRoot = path.join(rootDir, '.agents', 'skills', '.quarantine')
  if (!fs.existsSync(quarantineRoot)) return []
  const archived: string[] = []
  for (const entry of fs.readdirSync(quarantineRoot)) {
    // Skip the archive itself (and any other dotted state dir).
    if (entry.startsWith('.')) continue
    const dir = path.join(quarantineRoot, entry)
    const skill = readSkillFile(dir)
    if (!skill) continue
    const stat = fs.statSync(path.join(dir, 'SKILL.md'))
    if (stat.mtimeMs >= cutoff) continue

    const month = new Date(stat.mtimeMs).toISOString().slice(0, 7)
    const monthDir = path.join(quarantineRoot, '.archive', month)
    fs.mkdirSync(monthDir, { recursive: true })

    // Collision suffix: collide, collide-2, collide-3, …
    let destName = entry
    let suffix = 2
    while (fs.existsSync(path.join(monthDir, destName))) {
      destName = `${entry}-${suffix}`
      suffix += 1
    }
    const dest = path.join(monthDir, destName)

    fs.renameSync(dir, dest)
    fs.writeFileSync(
      path.join(dest, 'ARCHIVED.json'),
      `${JSON.stringify(
        {
          name: entry,
          archivedAs: destName,
          archivedAt: new Date(now).toISOString(),
          originalMtime: new Date(stat.mtimeMs).toISOString(),
          windowDays: DRAFT_REJECTION_WINDOW_DAYS,
          reason: 'expired never-trusted draft (archive-not-purge)',
        },
        null,
        2,
      )}\n`,
      'utf8',
    )
    archived.push(entry)
  }
  return archived
}
