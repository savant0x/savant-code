import {
  trustSkill,
  untrustSkill,
  rollbackLiveSkill,
} from '@savant-code/common/util/skill-management'

import { getProjectRoot } from '../project-files'
import {
  discoverSkills,
  formatTable,
  showMessage,
  statusMessage,
} from './skills-discovery'
import {
  formatErosionAdvisory,
  formatProofAdvisory,
  readProofGate,
} from './skills-proof-gate'
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
