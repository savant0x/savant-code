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
  rollbackLiveSkill,
  skillCanonicalDir,
  skillQuarantineDir,
  trustSkill,
  untrustSkill,
} from '@savant-code/common/util/skill-management'

import { getProjectRoot } from '../project-files'
import { getSystemMessage } from '../utils/message-history'

import type { RouterParams } from './command-shared'

/**
 * FID-2026-0824-012 S0-A/B + S2-E — operator `skills` command group.
 *
 * The operator trust boundary: agent-authored skills land in
 * `.agents/skills/.quarantine/` and are invisible to the runtime until a
 * human runs `/skills trust <name>`. This command is the ONLY release path
 * (the Adversary audits read-only; the Verifier can sandbox-test; neither
 * can release). Operator rollback restores a versioned snapshot into the
 * live copy and appends a ledger entry.
 */

type SkillRow = {
  name: string
  version: string
  description: string
  quarantined: boolean
}

function readSkillRow(dir: string, quarantined: boolean): SkillRow | null {
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

function discoverSkills(projectRoot: string): SkillRow[] {
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

function formatTable(rows: SkillRow[]): string {
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

function statusMessage(projectRoot: string): string {
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

function showMessage(projectRoot: string, name: string): string {
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

interface ProofGateSummary {
  generated_at?: string
  activation_verified?: boolean
  pass_pow_k?: number
  eligible_for_immutable?: boolean
  receipt_fingerprint?: string
  /** FID-2026-0824-018 additive erosion-guard fields. */
  erosion_blocked?: boolean
  erosion_measured?: boolean
  verbosity_delta_pct?: number
  structural_erosion_pct?: number
  erosion_reasons?: string[]
}

/**
 * FID-2026-0824-016: read `.savant/skill-proofs/<name>.json` (written by the
 * evals prove engine) and summarize its gate fields. Dependency-light by
 * design — manual field extraction, no cross-workspace import. Null when no
 * artifact exists or the file is malformed.
 */
function readProofGate(
  projectRoot: string,
  name: string,
): ProofGateSummary | null {
  const file = path.join(projectRoot, '.savant', 'skill-proofs', `${name}.json`)
  if (!fs.existsSync(file)) return null
  try {
    const raw = JSON.parse(
      fs.readFileSync(file, 'utf8'),
    ) as Partial<ProofGateSummary> & {
      gate?: { eligible_for_immutable?: boolean }
      metrics?: { pass_pow_k?: number }
      ztap?: { receipt_fingerprint?: string }
      erosion?: {
        blocked?: boolean
        measured?: boolean
        verbosity_delta_pct?: number
        structural_erosion_pct?: number
        reasons?: string[]
      }
    }
    return {
      generated_at: raw.generated_at,
      activation_verified: raw.activation_verified,
      pass_pow_k: raw.metrics?.pass_pow_k,
      eligible_for_immutable: raw.gate?.eligible_for_immutable,
      receipt_fingerprint: raw.ztap?.receipt_fingerprint,
      erosion_blocked: raw.erosion?.blocked,
      erosion_measured: raw.erosion?.measured,
      verbosity_delta_pct: raw.erosion?.verbosity_delta_pct,
      structural_erosion_pct: raw.erosion?.structural_erosion_pct,
      erosion_reasons: raw.erosion?.reasons,
    }
  } catch {
    return null
  }
}

/** Render the ADVISORY proof-status block (trust stays operator-only). */
function formatProofAdvisory(gate: ProofGateSummary): string {
  const verdict = gate.eligible_for_immutable
    ? '✅ ELIGIBLE for immutable promotion'
    : '⚠️ NOT yet eligible'
  return [
    '**Proof status — ADVISORY ONLY (trust stays operator-only)**',
    '```',
    `generated_at: ${gate.generated_at ?? '—'}`,
    `activation_verified: ${String(gate.activation_verified ?? false)}`,
    `pass^k reliability: ${gate.pass_pow_k != null ? String(gate.pass_pow_k) : '—'}`,
    `immutable eligibility: ${String(gate.eligible_for_immutable ?? false)} → ${verdict}`,
    gate.receipt_fingerprint
      ? `ztap receipt: ${gate.receipt_fingerprint}`
      : 'ztap receipt: _none bound_',
    '```',
  ].join('\n')
}

function formatPct(value: number | undefined): string {
  return value == null ? '—' : `${value.toFixed(2)}%`
}

/**
 * FID-2026-0824-018: erosion advisory under the proof block. A BLOCK is
 * rendered prominently with its reasons; a clean measurement renders one
 * dim line; an absent measurement renders nothing.
 */
function formatErosionAdvisory(gate: ProofGateSummary): string {
  if (gate.erosion_blocked === true) {
    const reasons =
      gate.erosion_reasons && gate.erosion_reasons.length > 0
        ? gate.erosion_reasons.map((reason) => `  - ${reason}`).join('\n')
        : '  - threshold breach'
    return [
      '**🚫 EROSION BLOCK — structural regression detected (ADVISORY)**',
      '',
      'The paired-run workspace eroded beyond thresholds:',
      reasons,
      '',
      '_Trust stays operator-only; consider a `skills:evolve` review first._',
    ].join('\n')
  }
  if (gate.erosion_measured !== true) return ''
  return [
    `_Erosion advisory: verbosity ${formatPct(gate.verbosity_delta_pct)}, structural ${formatPct(gate.structural_erosion_pct)} — within thresholds._`,
  ].join('\n')
}

/**
 * Pure core of the skills command — resolves `args` against `projectRoot` and
 * returns the rendered output. Exported for direct testing (the handler only
 * adds the router plumbing).
 */
export function runSkillsCommand(projectRoot: string, args: string): string {
  const parts = args.trim().split(/\s+/).filter(Boolean)
  const sub = parts[0]?.toLowerCase() ?? 'status'

  let output: string
  if (sub === 'list') {
    const rows = discoverSkills(projectRoot)
    const quarantinedOnly = parts.includes('--quarantined')
    const filtered = quarantinedOnly
      ? rows.filter((r) => r.quarantined)
      : rows.filter((r) => !r.quarantined)
    output =
      `**${quarantinedOnly ? 'Quarantined drafts' : 'Trusted skills'}**\n\n` +
      formatTable(filtered)
  } else if (sub === 'show') {
    const name = parts[1]
    if (!name) {
      output = 'Usage: `/skills show <name>`'
    } else {
      output = showMessage(projectRoot, name)
    }
  } else if (sub === 'trust') {
    const name = parts[1]
    if (!name) {
      output = 'Usage: `/skills trust <name>`'
    } else {
      const result = trustSkill(projectRoot, name)
      if (!result.ok) {
        output = `❌ ${result.error}`
      } else {
        // FID-2026-0824-016/-018: ADVISORY proof + erosion status accompany
        // every trust decision when evidence exists.
        const gate = readProofGate(projectRoot, name)
        const sections = gate
          ? [formatProofAdvisory(gate), formatErosionAdvisory(gate)].filter(
              (section) => section !== '',
            )
          : []
        output =
          `✅ ${result.message ?? `Trusted '${name}'`}` +
          (sections.length > 0 ? `\n${sections.join('\n\n')}` : '')
      }
    }
  } else if (sub === 'untrust') {
    const name = parts[1]
    if (!name) {
      output = 'Usage: `/skills untrust <name>`'
    } else {
      const result = untrustSkill(projectRoot, name)
      output = result.ok
        ? `✅ ${result.message ?? `Untrusted '${name}'`}`
        : `❌ ${result.error}`
    }
  } else if (sub === 'prove') {
    // FID-2026-0824-016: paired-trial execution lives in @savant-code/evals
    // (`bun run --cwd=evals prove <name>`); this surface reports evidence.
    const name = parts[1]
    if (!name) {
      output =
        'Usage: `/skills prove <name>` — launches paired trials from the evals workspace and reports gate status.'
    } else {
      const gate = readProofGate(projectRoot, name)
      const sections = gate
        ? [formatProofAdvisory(gate), formatErosionAdvisory(gate)].filter(
            (section) => section !== '',
          )
        : []
      output =
        `**Skill proof: ${name}**\n\n` +
        (sections.length > 0
          ? sections.join('\n\n')
          : [
              '_No proof artifact yet._',
              'Launch paired trials with:',
              '',
              '    bun run --cwd=evals prove <name> --task <taskId> --tasks-dir <tasksDir>',
              '',
              '(paired-trial engine: `runSkillProve`, @savant-code/evals). Status appears',
              'here as an ADVISORY — trust decisions remain operator-only.',
            ].join('\n'))
    }
  } else if (sub === 'rollback') {
    const name = parts[1]
    const seq = Number.parseInt(parts[2] ?? '', 10)
    if (!name || !Number.isFinite(seq)) {
      output =
        'Usage: `/skills rollback <name> <seq>` (seq from `/skills show`)'
    } else {
      const result = rollbackLiveSkill(projectRoot, name, seq)
      output = result.ok
        ? `✅ ${result.message ?? `Rolled back '${name}' to v${seq}`}`
        : `❌ ${result.error}`
    }
  } else {
    output = statusMessage(projectRoot)
  }

  return output
}

export function handleSkillsCommand(params: RouterParams, args: string): void {
  const projectRoot = getProjectRoot() ?? process.cwd()
  const output = runSkillsCommand(projectRoot, args)
  params.setMessages((prev) => [...prev, getSystemMessage(output)])
  params.saveToHistory(params.inputValue.trim())
}
