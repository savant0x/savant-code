import { spawnSync } from 'child_process'
import { readFileSync, readdirSync, statSync } from 'fs'
import os from 'os'
import path from 'path'

export type ReleaseReceiptSummary = {
  file: string
  version?: string
  mode?: string
  headSha?: string
  completedStages?: string[]
  failedStage?: string
  restored?: boolean
  evidenceFinalized?: boolean
  modifiedAt: number
}

function readReceipt(filePath: string): ReleaseReceiptSummary | undefined {
  try {
    const parsed = JSON.parse(
      readFileSync(filePath, 'utf8'),
    ) as Partial<ReleaseReceiptSummary>
    return {
      file: path.basename(filePath),
      version: typeof parsed.version === 'string' ? parsed.version : undefined,
      mode: typeof parsed.mode === 'string' ? parsed.mode : undefined,
      headSha: typeof parsed.headSha === 'string' ? parsed.headSha : undefined,
      completedStages: Array.isArray(parsed.completedStages)
        ? (parsed.completedStages as string[])
        : undefined,
      failedStage:
        typeof parsed.failedStage === 'string' ? parsed.failedStage : undefined,
      restored:
        typeof parsed.restored === 'boolean' ? parsed.restored : undefined,
      evidenceFinalized:
        typeof parsed.evidenceFinalized === 'boolean'
          ? parsed.evidenceFinalized
          : undefined,
      modifiedAt: statSync(filePath).mtimeMs,
    }
  } catch {
    return undefined
  }
}

/** Newest release receipt + newest diagnostic evidence in the receipt dir. */
export function latestReleaseEvidence(receiptDir?: string): {
  receipt?: ReleaseReceiptSummary
  diagnostic?: ReleaseReceiptSummary
} {
  const dir = receiptDir ?? os.tmpdir()
  let receipt: ReleaseReceiptSummary | undefined
  let diagnostic: ReleaseReceiptSummary | undefined
  try {
    for (const name of readdirSync(dir)) {
      if (!/^savant-public-release-.+\.json$/i.test(name)) continue
      const summary = readReceipt(path.join(dir, name))
      if (!summary) continue
      if (/diagnostic/i.test(name)) {
        if (!diagnostic || summary.modifiedAt > diagnostic.modifiedAt) {
          diagnostic = summary
        }
      } else if (!receipt || summary.modifiedAt > receipt.modifiedAt) {
        receipt = summary
      }
    }
  } catch {
    // Unreadable temp dir → no evidence to report.
  }
  return { receipt, diagnostic }
}

function gitOutput(root: string, args: string[]): string {
  try {
    const result = spawnSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: 'pipe',
      windowsHide: true,
    })
    return result.status === 0 ? String(result.stdout ?? '').trim() : ''
  } catch {
    return ''
  }
}

export type ReleaseStatusOptions = {
  root: string
  /** Overridable for tests; defaults to the OS temp directory. */
  receiptDir?: string
}

/**
 * Assembles a compact operator-facing status block: current version, git
 * position, tag state, and the newest release receipt + diagnostic evidence.
 * All git/environment lookups fail soft (reported as `unknown`), because the
 * status command is informational only.
 */
export function getReleaseStatus(options: ReleaseStatusOptions): string {
  const { root, receiptDir } = options
  let version = 'unknown'
  try {
    version =
      readFileSync(path.join(root, 'VERSION'), 'utf8').trim() || 'unknown'
  } catch {
    // No VERSION file → not the monorepo root; keep 'unknown'.
  }

  const branch = gitOutput(root, ['rev-parse', '--abbrev-ref', 'HEAD'])
  const dirty = gitOutput(root, ['status', '--porcelain'])
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0).length
  let unpushed = 'unknown'
  const upstreamCount = gitOutput(root, [
    'rev-list',
    '--count',
    '@{upstream}..HEAD',
  ])
  if (/^\d+$/.test(upstreamCount)) unpushed = upstreamCount

  const tagged =
    gitOutput(root, ['tag', '-l', `v${version}`]).length > 0 ? 'yes' : 'no'

  const { receipt, diagnostic } = latestReleaseEvidence(receiptDir)

  const lines: string[] = [
    `Savant-Code public release — status`,
    `  version:        ${version}`,
    `  branch:         ${branch || 'unknown'}`,
    `  worktree:       ${dirty} changed file(s)`,
    `  unpushed:       ${unpushed} commit(s) ahead of upstream`,
    `  tag v${version}:   ${tagged}`,
  ]
  if (receipt) {
    lines.push(
      `  last receipt:   ${receipt.file}`,
      `    mode=${receipt.mode ?? 'unknown'} head=${(receipt.headSha ?? '').slice(0, 8) || 'unknown'}`,
      `    completed=${(receipt.completedStages ?? []).join(',') || 'none'}` +
        (receipt.failedStage ? ` failed=${receipt.failedStage}` : '') +
        (receipt.restored === true ? ' restored=true' : ' restored=false'),
    )
  } else {
    lines.push(`  last receipt:   none`)
  }
  if (diagnostic) {
    lines.push(
      `  diagnostic:     ${diagnostic.file} (${diagnostic.evidenceFinalized ? 'evidence finalized' : 'evidence missing'})`,
    )
  } else {
    lines.push(`  diagnostic:     none`)
  }
  lines.push(
    `  next step:      /release preview → /release diagnose → /release go`,
  )
  return lines.join('\n')
}
