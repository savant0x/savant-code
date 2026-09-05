import * as fs from 'node:fs'
import * as path from 'node:path'

import {
  QUARANTINE_DIR_NAME,
  SKILL_FILE_NAME,
  SKILLS_DIR_NAME,
  isValidSkillName,
} from '@savant-code/common/constants/skills'
import {
  readLedgerEntries,
  skillCanonicalDir,
  skillQuarantineDir,
} from '@savant-code/common/util/skill-management'

// FID-2026-0819-005 Loop 143: skill discovery + rendering cluster,
// extracted from skills.ts. Reads SKILL.md frontmatter rows across
// `.agents/skills` and `.claude/skills` (quarantine-aware) and renders the
// status/table/detail messages. Internal — the command surface stays in
// skills.ts.

export type SkillRow = {
  name: string
  version: string
  description: string
  quarantined: boolean
}

export function readSkillRow(
  dir: string,
  quarantined: boolean,
): SkillRow | null {
  const file = path.join(dir, SKILL_FILE_NAME)
  if (!fs.existsSync(file)) return null
  const content = fs.readFileSync(file, 'utf8')
  const nameMatch = content.match(/^name:\s*(.+)$/m)
  const versionMatch = content.match(/^version:\s*(.+)$/m)
  const descMatch = content.match(/^description:\s*(.+)$/m)
  const name = nameMatch?.[1]?.trim() ?? path.basename(dir)
  return {
    name,
    version: versionMatch?.[1]?.trim() ?? '0.1.0',
    description: descMatch?.[1]?.trim() ?? '',
    quarantined,
  }
}

export function discoverSkills(projectRoot: string): SkillRow[] {
  const rows: SkillRow[] = []
  for (const skillsDir of [
    path.join(projectRoot, '.agents', SKILLS_DIR_NAME),
    path.join(projectRoot, '.claude', SKILLS_DIR_NAME),
  ]) {
    if (!fs.existsSync(skillsDir)) continue
    for (const entry of fs.readdirSync(skillsDir)) {
      if (entry === QUARANTINE_DIR_NAME) continue
      if (!isValidSkillName(entry)) continue
      const row = readSkillRow(path.join(skillsDir, entry), false)
      if (row) rows.push(row)
    }
    const quarantineDir = path.join(skillsDir, QUARANTINE_DIR_NAME)
    if (fs.existsSync(quarantineDir)) {
      for (const entry of fs.readdirSync(quarantineDir)) {
        if (!isValidSkillName(entry)) continue
        const row = readSkillRow(path.join(quarantineDir, entry), true)
        if (row) rows.push(row)
      }
    }
  }
  return rows
}

export function formatTable(rows: SkillRow[]): string {
  if (rows.length === 0) return '_none_'
  const nameW = Math.max(...rows.map((r) => r.name.length), 4)
  const verW = Math.max(...rows.map((r) => r.version.length), 7)
  const lines = rows.map(
    (r) =>
      `${r.quarantined ? '⏳' : '✓'} ${r.name.padEnd(nameW)}  v${r.version.padEnd(verW - 1)}  ${r.description}`,
  )
  return [
    '```',
    `${'   '.padEnd(1)}${'NAME'.padEnd(nameW)}  VERSION    DESCRIPTION`,
    ...lines,
    '```',
  ].join('\n')
}

export function statusMessage(projectRoot: string): string {
  const rows = discoverSkills(projectRoot)
  const trusted = rows.filter((r) => !r.quarantined)
  const quarantined = rows.filter((r) => r.quarantined)
  return [
    `**Skills status** (project: \`${projectRoot}\`)`,
    '',
    `- Trusted: **${trusted.length}**`,
    `- Quarantined (pending trust): **${quarantined.length}**`,
    '',
    '```',
    `/skills list              — trusted skills`,
    `/skills list --quarantined — untrusted drafts`,
    `/skills show <name>       — detail + version history`,
    `/skills prove <name>      — paired-run evidence status (ADVISORY)`,
    `/skills trust <name>      — release a draft (operator-only)`,
    `/skills untrust <name>    — demote a trusted skill to quarantine`,
    `/skills rollback <name> <seq> — restore a versioned snapshot`,
    '```',
  ].join('\n')
}

export function showMessage(projectRoot: string, name: string): string {
  const live = readSkillRow(skillCanonicalDir(projectRoot, name), false)
  const draft = readSkillRow(skillQuarantineDir(projectRoot, name), true)
  if (!live && !draft) return `Skill '${name}' not found.`
  const ledger = readLedgerEntries(projectRoot, name)
  const ledgerTail = ledger
    .slice(-8)
    .map(
      (e) =>
        `  v${e.version}  ${e.action.padEnd(11)} ${e.ts.slice(0, 19)}  ${e.reason}`,
    )
    .join('\n')
  const snapshots = fs.existsSync(
    path.join(projectRoot, '.agents', 'skills', name, 'versions'),
  )
    ? fs
        .readdirSync(
          path.join(projectRoot, '.agents', 'skills', name, 'versions'),
        )
        .sort()
        .join(', ')
    : '—'
  return [
    `**${name}** — ${live ? 'trusted' : 'quarantined draft'}`,
    live
      ? `  version ${live.version} · ${live.description}`
      : draft
        ? `  version ${draft.version} · ${draft.description} (untrusted)`
        : '',
    '',
    '**Version history (VERSIONS.jsonl tail):**',
    '```',
    ledgerTail === '' ? '  _no ledger entries_' : ledgerTail,
    '```',
    '',
    `**Snapshots:** \`${snapshots}\``,
  ]
    .filter((line) => line !== '')
    .join('\n')
}
