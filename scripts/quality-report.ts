#!/usr/bin/env bun

import fs from 'node:fs'
import path from 'node:path'

export type QualityBaseline = {
  maxFileLines: number
  trackedFiles: Record<string, number>
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
const excluded = /(^|[\\/])node_modules([\\/]|$)/

export function readQualityBaseline(): QualityBaseline {
  return JSON.parse(fs.readFileSync(baselinePath, 'utf8')) as QualityBaseline
}

function hasUnsupportedApprovedGrowth(baseline: QualityBaseline): boolean {
  return Object.prototype.hasOwnProperty.call(baseline, 'approvedGrowth')
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

  for (const filePath of sourceFiles()) {
    const relative = path.relative(root, filePath).replaceAll(path.sep, '/')
    const lineCount = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).length
    const baselineLines = baseline.trackedFiles[relative]

    if (lineCount > baseline.maxFileLines) {
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
