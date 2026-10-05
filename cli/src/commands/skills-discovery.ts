import { createHash } from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'

import {
  QUARANTINE_DIR_NAME,
  SKILL_FILE_NAME,
  SKILLS_DIR_NAME,
  isValidSkillName,
} from '@savant-code/common/constants/skills'
import {
  claimSkillLifecycleEvents,
  formatSkillLifecycleNoticeLine,
  readSkillLifecycleEvents,
} from '@savant-code/common/util/skill-lifecycle-events'
import {
  readLedgerEntries,
  readCurrentSkill,
  skillCanonicalDir,
  skillQuarantineDir,
} from '@savant-code/common/util/skill-management'
// FID-2026-0912-004: gate-before-present labels on quarantine rows.
import { formatProposalLabel } from '@savant-code/common/util/skill-proposal-gate'
// FID-2026-1005-003: the draft's source evidence comes from the proposal store.
import { readProposalStore } from '@savant-code/common/util/skill-proposals'

import { readProposalGate } from './skills-proof-gate'

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
  /** FID-2026-0912-004: [✓ PROVEN] / [⚠ UNPROVEN] on quarantine rows. */
  proposalLabel?: string
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
        if (row) {
          // FID-2026-0912-004: every draft carries its honest epistemic
          // label — absent or failed proof renders UNPROVEN (trusting
          // blind is made visible).
          const gate = readProposalGate(projectRoot, row.name)
          row.proposalLabel = formatProposalLabel(gate)
          rows.push(row)
        }
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
      `${r.quarantined ? '⏳' : '✓'} ${r.name.padEnd(nameW)}  v${r.version.padEnd(verW - 1)}  ${r.proposalLabel ? `${r.proposalLabel} ` : ''}${r.description}`,
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
    `/skills reject <name> <reason> — record a rejection in the wiki (FID-2026-0912-004)`,
    `/skills show <name>       — detail + version history`,
    `/skills show <name> --review — quarantined draft body, diff, evidence`,
    `/skills activity          — recent skill lifecycle events (read-only)`,
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

/**
 * FID-2026-1005-003 — the exact-draft review surface for `/skills show`.
 *
 * `/skills show <name>` alone reports metadata + ledger (above); this adds
 * what an operator needs to JUDGE the draft before `/skills trust`: the
 * draft SHA, the full SKILL.md body (or a unified diff against the live
 * version when one exists), and the source evidence (proposal record). The
 * traffic-light notice stays short and points here.
 */
export function showDraftReviewMessage(
  projectRoot: string,
  name: string,
): string {
  const current = readCurrentSkill(projectRoot, name)
  if (!current.draft && !current.live) return `Skill '${name}' not found.`

  const sections: string[] = []
  const draftSha = current.draft
    ? createHash('sha256').update(current.draft.content, 'utf8').digest('hex')
    : null
  sections.push(
    `**${name} — draft review**`,
    '',
    `Draft state: ${
      current.draft ? 'quarantined — PENDING TRUST' : 'no quarantine draft'
    }${draftSha ? ` · draft sha \`${draftSha.slice(0, 16)}…\`` : ''}`,
    `Proof state: run \`/skills prove ${name}\` (advisory; trust is operator-only)`,
  )

  if (current.draft) {
    sections.push(
      '',
      '**Quarantined SKILL.md:**',
      '```markdown',
      current.draft.content.trimEnd(),
      '```',
    )
    if (current.live) {
      sections.push(
        '',
        '**Diff vs live trusted version:**',
        '```',
        diffLines(current.live.content, current.draft.content),
        '```',
      )
    }
  } else if (current.live) {
    sections.push(
      '',
      `_No quarantine draft — showing live v${current.live.version}._`,
    )
  }

  // Source evidence: the proposal record behind the draft, when present.
  const proposal = readProposalStore(projectRoot).find(
    (p) => p.skillName === name,
  )
  if (proposal) {
    sections.push(
      '',
      '**Source evidence (proposal record):**',
      `  proposal sha \`${proposal.proposalSha.slice(0, 16)}…\` · ${proposal.rationale}`,
      `  created ${proposal.createdAt} · session ${proposal.sessionId}`,
    )
  }
  sections.push(
    '',
    `Trust with: \`/skills trust ${name}\` — targets the exact draft${draftSha ? ` sha \`${draftSha.slice(0, 16)}…\`` : ''}.`,
  )
  return sections.join('\n')
}

/** Minimal line diff (added/removed prefix), sufficient for review context. */
function diffLines(live: string, draft: string): string {
  const liveLines = live.split(/\r?\n/)
  const draftLines = draft.split(/\r?\n/)
  const out: string[] = []
  const max = Math.max(liveLines.length, draftLines.length)
  for (let i = 0; i < max && out.length < 60; i++) {
    const a = liveLines[i]
    const b = draftLines[i]
    if (a === b) continue
    if (a !== undefined) out.push(`- ${a}`)
    if (b !== undefined) out.push(`+ ${b}`)
  }
  return out.length > 0 ? out.join('\n') : '(identical)'
}

/**
 * FID-2026-1005-003 — read-only `/skills activity` review surface.
 *
 * Shows the recent skill lifecycle events (bounded) plus how many unseen
 * events the CLI surface still owes a notice for. Never acknowledges or
 * mutates delivery state — review only.
 */
export function activityMessage(projectRoot: string, limit = 10): string {
  const all = readSkillLifecycleEvents(projectRoot)
  if (all.length === 0) return 'No skill lifecycle events recorded.'
  const { remaining } = claimSkillLifecycleEvents(projectRoot, 'cli', {
    limit: 0,
  })
  const tail = all.slice(-limit)
  const lines = [
    `**Skill activity** — ${all.length} event(s) total, ${remaining} unseen by this surface`,
    '',
    ...tail.map(
      (e) => `- ${formatSkillLifecycleNoticeLine(e)} · ${e.ts.slice(0, 19)}`,
    ),
  ]
  if (all.length > limit) {
    lines.push(
      '',
      `… oldest ${all.length - limit} event(s) omitted (review the log at \`.savant/skill-lifecycle-events.jsonl\`).`,
    )
  }
  return lines.join('\n')
}
