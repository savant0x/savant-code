/** Append-only operator rejection ledger for skill-eval proposals. */
import * as fs from 'node:fs'
import * as path from 'node:path'

import type { ProofGateSummary } from './skills-proof-gate'

const HEADER = [
  '# Skill-impact ledger (rejected changes)',
  '',
  '| Date | Skill | Proposed change | Eval evidence | Disposition |',
  '| --- | --- | --- | --- | --- |',
  '',
].join('\n')

function cell(value: string): string {
  return value.replace(/[|\r\n]+/g, ' ').trim()
}

function score(trials: { passed: boolean }[] | undefined): string {
  if (!trials?.length) return 'unmeasured'
  return `${trials.filter((trial) => trial.passed).length}/${trials.length}`
}

export function appendSkillImpactRejection(
  projectRoot: string,
  name: string,
  reason: string,
  gate: ProofGateSummary | null,
  rejectedAt: string,
): void {
  const file = path.join(projectRoot, 'evals', 'skill-impact.md')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  if (!fs.existsSync(file)) fs.writeFileSync(file, HEADER, 'utf8')
  const identity = `| ${cell(name)} | ${cell(reason)} |`
  if (fs.readFileSync(file, 'utf8').includes(identity)) return
  const before = score(gate?.baselineTrials)
  const after = score(gate?.activeTrials)
  const evidence = before === 'unmeasured' && after === 'unmeasured'
    ? 'no paired proof artifact'
    : `baseline ${before}; active ${after}; activation ${String(gate?.activation_verified === true)}`
  const row = `| ${cell(rejectedAt.slice(0, 10))} | ${cell(name)} | ${cell(reason)} | ${cell(evidence)} | rejected |\n`
  fs.appendFileSync(file, row, 'utf8')
}
