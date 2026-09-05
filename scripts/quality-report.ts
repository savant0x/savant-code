#!/usr/bin/env bun

import fs from 'node:fs'
import path from 'node:path'

export type QualityBaseline = {
  maxFileLines: number
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
const sourceRoots = [
  '.agents',
  'agents',
  'cli',
  'common',
  'desktop',
  'evals',
  'packages',
  'savant-free',
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
    if (lineCount <= baseline.maxFileLines) {
      issues.push({
        file,
        message: `unnecessary dataConstantExemptions entry: file is ${lineCount} lines, at or below the ${baseline.maxFileLines}-line ceiling — remove the exemption`,
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

    if (lineCount > baseline.maxFileLines) {
      if (baseline.dataConstantExemptions?.[relative] !== undefined) {
        // Exempt data constant: still growth-frozen below via trackedFiles.
        if (baselineLines !== undefined && lineCount > baselineLines) {
          issues.push({
            file: relative,
            message: `${lineCount} lines exceeds baseline ${baselineLines}`,
          })
        }
        continue
      }
      issues.push({
        file: relative,
        message: `${lineCount} lines exceeds absolute maximum ${baseline.maxFileLines}`,
      })
      continue
    }

    if (baselineLines !== undefined && lineCount > baselineLines) {
      issues.push({
        file: relative,
        message: `${lineCount} lines exceeds baseline ${baselineLines}`,
      })
    }
  }

  issues.push(...dataConstantIssues(baseline, lineCountByFile))
  return issues
}

if (import.meta.main) {
  const baseline = readQualityBaseline()
  const issues = collectQualityIssues(baseline)
  if (issues.length === 0) {
    console.log(
      `quality: PASS (${Object.keys(baseline.trackedFiles).length} baselined files)`,
    )
  } else {
    console.error(`quality: FAIL (${issues.length} quality violation(s))`)
    for (const issue of issues.slice(0, 50))
      console.error(`- ${issue.file}: ${issue.message}`)
    if (issues.length > 50) console.error(`- (+${issues.length - 50} more)`)
    process.exitCode = 1
  }
}
