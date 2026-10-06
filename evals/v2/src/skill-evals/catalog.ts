/**
 * The project skill-catalog walk for the Tier-2 evals (FID-2026-1005-005).
 *
 * Catalog = the project-scoped roots the loader reads (`.claude/skills`
 * then `.agents/skills`, later overriding earlier — loader precedence),
 * trusted skills only for ranking: quarantined drafts are
 * loader-invisible, so they are reported separately as advisory coverage.
 *
 * Discovery is the checker's (`discoverSkillDirs` from scripts/skills-check)
 * so there is one catalog walk (Law 13). Frontmatter validation stays
 * Tier-1's job (`skills:check`); this module extracts only the routing
 * metadata the loader exposes — name + description — through the shared
 * `SkillFrontmatterSchema`.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { SkillFrontmatterSchema } from '@savant-code/common/types/skill'
import { parse as parseYaml } from 'yaml'

import { discoverSkillDirs } from '../../../../scripts/skills-check'

const SKILL_FILE = 'SKILL.md'

export interface CatalogSkill {
  name: string
  description: string
  dir: string
}

/** Minimal frontmatter slice — Tier 1 owns full schema enforcement. */
function readRoutingMetadata(
  file: string,
): { name: string; description: string } | undefined {
  let content: string
  try {
    content = readFileSync(file, 'utf8')
  } catch {
    return undefined
  }
  const fenced = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content)
  if (fenced === null) return undefined
  let data: unknown
  try {
    data = parseYaml(fenced[1])
  } catch {
    return undefined
  }
  const parsed = SkillFrontmatterSchema.safeParse(data)
  if (!parsed.success) return undefined
  return { name: parsed.data.name, description: parsed.data.description }
}

/**
 * The project-scoped catalog in loader precedence order. Ledger-only
 * trusted dirs (their draft is in quarantine) carry no SKILL.md and are
 * not rankable — they surface as coverage gaps, not crashes.
 */
export function loadSkillCatalog(cwd: string): {
  trusted: CatalogSkill[]
  drafts: string[]
} {
  const roots = [
    path.join(cwd, '.claude', 'skills'),
    path.join(cwd, '.agents', 'skills'),
  ]
  const byName = new Map<string, CatalogSkill>()
  const drafts: string[] = []
  for (const root of roots) {
    for (const { entry, dir, quarantined } of discoverSkillDirs(root)) {
      if (quarantined) {
        drafts.push(entry)
        continue
      }
      const metadata = readRoutingMetadata(path.join(dir, SKILL_FILE))
      if (metadata === undefined) continue
      byName.set(metadata.name, {
        name: metadata.name,
        description: metadata.description,
        dir,
      })
    }
  }
  return { trusted: [...byName.values()], drafts }
}
