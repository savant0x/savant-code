#!/usr/bin/env bun
/**
 * FID declared-artifact census (FID-2026-1014-002).
 *
 * Every repo-relative test path named by an active FID is an artifact claim.
 * The claim is satisfied only when the path exists, or the same record carries
 * an explicit `artifact::absent <path>` marker for a historical reference.
 * Archived records are available through `--all` for an informational census;
 * the default gate is intentionally limited to active records.
 */
import fs from 'node:fs'
import path from 'node:path'

export type ArtifactRecord = {
  record: string
  paths: string[]
  missing: string[]
  markedAbsent: string[]
}

export type ArtifactCensus = {
  recordsScanned: number
  namedPaths: number
  distinctMissingPaths: string[]
  recordsWithMissingPaths: ArtifactRecord[]
}

const TEST_ARTIFACT_PATH =
  /(?<![\w@-])((?:agents|cli|common|desktop|evals|packages|scripts|sdk|savant-free)\/[A-Za-z0-9_@.+~/-]+\.test\.(?:ts|tsx))(?![\w-])/g
const ABSENT_ARTIFACT = /artifact::absent\s+([^\s`]+)/g

function stripFencedBlocks(content: string): string {
  const lines = content.split('\n')
  const visible: string[] = []
  let fenced = false
  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      fenced = !fenced
      continue
    }
    if (!fenced) visible.push(line)
  }
  return visible.join('\n')
}

export function findDeclaredTestPaths(content: string): string[] {
  const found = new Set<string>()
  for (const match of stripFencedBlocks(content).matchAll(TEST_ARTIFACT_PATH)) {
    found.add(match[1].replaceAll('\\', '/'))
  }
  return [...found].sort()
}

export function findMarkedAbsentPaths(content: string): string[] {
  const found = new Set<string>()
  for (const match of stripFencedBlocks(content).matchAll(ABSENT_ARTIFACT)) {
    found.add(match[1].replaceAll('\\', '/'))
  }
  return [...found].sort()
}

function readRecord(root: string, record: string): ArtifactRecord {
  const absolute = path.resolve(root, record)
  const content = fs.readFileSync(absolute, 'utf8')
  const paths = findDeclaredTestPaths(content)
  const markedAbsent = findMarkedAbsentPaths(content)
  const missing = paths.filter(
    (candidate) =>
      !fs.existsSync(path.resolve(root, candidate)) &&
      !markedAbsent.includes(candidate),
  )
  return { record, paths, missing, markedAbsent }
}

export function collectFidRecords(
  root: string,
  includeArchive = false,
): string[] {
  const directories = includeArchive
    ? ['dev/fids', 'dev/fids/archive']
    : ['dev/fids']
  const records: string[] = []
  for (const directory of directories) {
    const absolute = path.resolve(root, directory)
    if (!fs.existsSync(absolute)) continue
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
      if (entry.isFile() && /^FID-.*\.md$/.test(entry.name)) {
        records.push(`${directory}/${entry.name}`)
      }
    }
  }
  return records.sort()
}

export function scanFidArtifacts(
  root: string,
  records = collectFidRecords(root),
): ArtifactCensus {
  const rows = records.map((record) => readRecord(root, record))
  const missing = new Set<string>()
  for (const row of rows) {
    for (const candidate of row.missing) missing.add(candidate)
  }
  return {
    recordsScanned: rows.length,
    namedPaths: rows.reduce((total, row) => total + row.paths.length, 0),
    distinctMissingPaths: [...missing].sort(),
    recordsWithMissingPaths: rows.filter((row) => row.missing.length > 0),
  }
}

function printCensus(census: ArtifactCensus): void {
  console.log(`records scanned: ${census.recordsScanned}`)
  console.log(`named test paths (distinct per record): ${census.namedPaths}`)
  console.log(`distinct missing paths: ${census.distinctMissingPaths.length}`)
  console.log(
    `records naming >=1 unmarked missing path: ${census.recordsWithMissingPaths.length}`,
  )
  for (const row of census.recordsWithMissingPaths) {
    console.log(`\n${row.record}`)
    for (const candidate of row.missing) console.log(`  MISSING  ${candidate}`)
  }
}

export function main(): number {
  const root = path.resolve(import.meta.dir, '..')
  const census = scanFidArtifacts(
    root,
    collectFidRecords(root, process.argv.includes('--all')),
  )
  printCensus(census)
  if (census.recordsWithMissingPaths.length > 0) {
    console.error(
      'fid-artifact-census FAILED — every missing path needs an artifact::absent marker',
    )
    return 1
  }
  console.log(
    'fid-artifact-census PASS — all declared active artifacts exist or are explicitly marked absent',
  )
  return 0
}

if (import.meta.main) process.exitCode = main()
