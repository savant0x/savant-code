#!/usr/bin/env bun

import fs from 'node:fs'
import path from 'node:path'

export type QualityBaseline = {
  /** Historical line counts. Since the 2026-09-13 operator ruling the ONLY
   *  load-bearing use is the growth-freeze of dataConstantExemptions
   *  entries; values for regular under-cap files are informational history
   *  and do NOT fail the report when the file grows below the ceiling. */
  trackedFiles: Record<string, number>
  /** FID-2026-0819-005 (operator decision): generated-data constants exempt
   *  from the absolute ceiling. Each entry must carry a written rationale;
   *  exempt files remain growth-frozen via trackedFiles. Stale or unnecessary
   *  entries fail the report (fail-closed). */
  dataConstantExemptions?: Record<string, string>
}

type QualityIssue = {
  file: string
  message: string
}

const root = path.resolve(import.meta.dir, '..')
const baselinePath = path.join(root, 'dev', 'quality-baseline.json')
const protocolConfigPath = path.join(root, 'protocol.config.yaml')
const sourceRoots = [
  '.agents',
  'agents',
  'cli',
  'common',
  'desktop',
  'evals',
  'packages',
  'scripts',
  'sdk',
  'templates',
  'test',
]
// FID-2026-0819-005 Loop 145: git-ignored build-output directories are not
// project-owned source — exclude them alongside external node_modules.
// Verified: `git ls-files` has zero tracked files under any dist/ segment.
const excluded = /(^|[\\/])(node_modules|dist)([\\/]|$)/

export function readQualityBaseline(): QualityBaseline {
  return JSON.parse(fs.readFileSync(baselinePath, 'utf8')) as QualityBaseline
}

/**
 * The enforced file-length ceiling, read from TRACKED `protocol.config.yaml`.
 *
 * FID-2026-1016-013: this number used to live in `dev/quality-baseline.json`,
 * which is untracked — `/dev` is local-only by the 2026-10-16 operator ruling —
 * so the single most consequential quality number in the repository was
 * machine-local, unreviewable and unshareable, and the tracked
 * `protocol.config.yaml` merely *claimed* to be its home in a comment. The
 * ceiling is policy, so it is read from the tracked file and a missing or
 * unparsable value is a hard failure rather than a silent fallback to some
 * built-in default (fail-closed: a ceiling nobody can see is worse than no
 * ceiling).
 *
 * The scan mirrors the block-reader precedent in `generate-protocol-bundle.ts`
 * (`readHarnessContract`) rather than adding a YAML dependency to the scripts
 * tree: first `max_file_lines` scalar after the top-level `quality:` line.
 */
export function readQualityCeiling(): number {
  const lines = fs
    .readFileSync(protocolConfigPath, 'utf8')
    .replace(/\r\n/g, '\n')
    .split('\n')
  const qualityIdx = lines.findIndex((line) => line.trim() === 'quality:')
  if (qualityIdx === -1) {
    throw new Error(
      'protocol.config.yaml has no top-level `quality:` block — the file-length ceiling cannot be resolved.',
    )
  }
  const raw = lines
    .slice(qualityIdx + 1)
    .map((line) => line.match(/^\s+max_file_lines:\s*(\S+)\s*$/)?.[1])
    .find((value): value is string => value !== undefined)
  if (raw === undefined) {
    throw new Error(
      'protocol.config.yaml `quality:` block has no `max_file_lines` value — the file-length ceiling cannot be resolved.',
    )
  }
  const ceiling = Number(raw)
  if (!Number.isInteger(ceiling) || ceiling <= 0) {
    throw new Error(
      `protocol.config.yaml quality.max_file_lines is not a positive integer: ${raw}`,
    )
  }
  return ceiling
}

function hasUnsupportedApprovedGrowth(baseline: QualityBaseline): boolean {
  return Object.prototype.hasOwnProperty.call(baseline, 'approvedGrowth')
}

// FID-2026-0819-005 (operator decision): base64 data-constant payloads
// (logos, model catalogs) are generated data, not authored logic — line
// count is meaningless for them and splitting a single string literal is
// impossible. Exempting one is a deliberate, rationaled baseline edit.
function dataConstantIssues(
  baseline: QualityBaseline,
  lineCountByFile: Map<string, number>,
  ceiling: number,
): QualityIssue[] {
  const issues: QualityIssue[] = []
  const exemptions = baseline.dataConstantExemptions ?? {}
  for (const [file, rationale] of Object.entries(exemptions)) {
    if (rationale.trim().length === 0) {
      issues.push({
        file,
        message: 'dataConstantExemptions entry has an empty rationale',
      })
      continue
    }
    const lineCount = lineCountByFile.get(file)
    if (lineCount === undefined) {
      issues.push({
        file,
        message:
          'stale dataConstantExemptions entry: file is missing from the source tree',
      })
      continue
    }
    if (lineCount <= ceiling) {
      issues.push({
        file,
        message: `unnecessary dataConstantExemptions entry: file is ${lineCount} lines, at or below the ${ceiling}-line ceiling — remove the exemption`,
      })
    }
  }
  return issues
}

function sourceFiles(): string[] {
  const files: string[] = []
  const visit = (directory: string): void => {
    if (!fs.existsSync(directory)) return
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name)
      if (entry.isDirectory()) visit(fullPath)
      else if (/\.(ts|tsx)$/.test(entry.name) && !excluded.test(fullPath))
        files.push(fullPath)
    }
  }
  for (const relativeRoot of sourceRoots) visit(path.join(root, relativeRoot))
  return files.sort()
}

export function collectQualityIssues(
  baseline: QualityBaseline,
  ceiling: number = readQualityCeiling(),
): QualityIssue[] {
  const issues: QualityIssue[] = []
  if (hasUnsupportedApprovedGrowth(baseline)) {
    issues.push({
      file: 'dev/quality-baseline.json',
      message: 'approvedGrowth is not supported; remove the exemption field',
    })
  }

  const lineCountByFile = new Map<string, number>()

  for (const filePath of sourceFiles()) {
    const relative = path.relative(root, filePath).replaceAll(path.sep, '/')
    const lineCount = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).length
    lineCountByFile.set(relative, lineCount)
    const baselineLines = baseline.trackedFiles[relative]

    // Exempt data constants skip the ceiling but stay growth-frozen via
    // trackedFiles — the freeze is their only constraint (FID-2026-0819-005).
    if (baseline.dataConstantExemptions?.[relative] !== undefined) {
      if (baselineLines !== undefined && lineCount > baselineLines) {
        issues.push({
          file: relative,
          message: `${lineCount} lines exceeds baseline ${baselineLines}`,
        })
      }
      continue
    }

    // The invariant is the absolute ceiling: no authored file exceeds it.
    // Operator ruling 2026-09-13: under-cap files may grow freely — the
    // historical per-file ratchet (failing any growth below the ceiling)
    // is removed. trackedFiles values below the ceiling are history, not
    // limits.
    if (lineCount > ceiling) {
      issues.push({
        file: relative,
        message: `${lineCount} lines exceeds absolute maximum ${ceiling}`,
      })
    }
  }

  issues.push(...dataConstantIssues(baseline, lineCountByFile, ceiling))
  return issues
}

if (import.meta.main) {
  const baseline = readQualityBaseline()
  const ceiling = readQualityCeiling()
  const issues = collectQualityIssues(baseline, ceiling)
  if (issues.length === 0) {
    console.log(
      `quality: PASS (${ceiling}-line ceiling, ${Object.keys(baseline.trackedFiles).length} baselined files)`,
    )
  } else {
    console.error(`quality: FAIL (${issues.length} quality violation(s))`)
    for (const issue of issues.slice(0, 50))
      console.error(`- ${issue.file}: ${issue.message}`)
    if (issues.length > 50) console.error(`- (+${issues.length - 50} more)`)
    process.exitCode = 1
  }
}
