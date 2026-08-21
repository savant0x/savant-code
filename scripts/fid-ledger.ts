import fs from 'node:fs'
import path from 'node:path'

import { validateFidStepLedger } from './fid-ledger-steps'

import type { FidLedgerIssue } from './fid-ledger-types'

export type { FidLedgerIssue } from './fid-ledger-types'

type FidRecord = {
  id: string
  fileName: string
  status: string | undefined
  masterFid: string | undefined
  dependencies: string[]
}

const FID_ID_PATTERN = /^FID-\d{4}-\d{4}-\d{3}$/
const ALLOWED_ACTIVE_STATUSES = new Set([
  'created',
  'analyzed',
  'fixed',
  'verified',
])
const REQUIRED_HEADINGS = [
  '## Summary',
  '## Perfection Loop',
  '### Missed Questions',
  '### Code Verification Evidence',
  '## Resolution',
]
const FORBIDDEN_ATTRIBUTION = /^\*\*(Author|Fixed By|Verified By|Signed by):/m
const FID_REFERENCE_PATTERN = /FID-\d{4}-\d{4}-\d{3}/g

function references(value: string | undefined): string[] {
  return [...new Set(value?.match(FID_REFERENCE_PATTERN) ?? [])]
}

function tracked(root: string, relativePath: string): boolean {
  const result = Bun.spawnSync(
    ['git', 'ls-files', '--error-unmatch', '--', relativePath],
    {
      cwd: root,
      stdout: 'ignore',
      stderr: 'ignore',
    },
  )
  return result.exitCode === 0
}

function archivedFidPath(root: string, id: string): string | undefined {
  const archive = path.join(root, 'dev', 'fids', 'archive')
  if (!fs.existsSync(archive)) return undefined
  const name = fs
    .readdirSync(archive)
    .find((entry) => entry.startsWith(`${id}-`))
  return name ? path.join(archive, name) : undefined
}

function archivedFidExists(root: string, id: string): boolean {
  const filePath = archivedFidPath(root, id)
  if (!filePath) return false
  const relative = path.relative(root, filePath).replaceAll(path.sep, '/')
  if (!tracked(root, relative)) return false
  const content = fs.readFileSync(filePath, 'utf8')
  const status = metadata(content, 'Status')
  if (status !== 'closed') return false
  const changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8')
  if (!changelog.includes(id)) return false
  return /### Code Verification Evidence|## Resolution/.test(content)
}

function validateRelationshipGraph(
  root: string,
  records: readonly FidRecord[],
  contentById: ReadonlyMap<string, string>,
): FidLedgerIssue[] {
  const issues: FidLedgerIssue[] = []
  const byId = new Map(records.map((record) => [record.id, record]))
  const declaredMasters = records.filter((record) => record.masterFid)
  const masterIds = [
    ...new Set(declaredMasters.map((record) => record.masterFid!)),
  ]

  if (masterIds.length > 1) {
    issues.push({
      code: 'fid.graph.multiple-masters',
      message: `Active FIDs declare multiple master FIDs: ${masterIds.join(', ')}.`,
    })
  }

  const masterId = masterIds[0]
  if (masterId) {
    const master = byId.get(masterId)
    if (!master) {
      issues.push({
        code: 'fid.graph.master-missing',
        message: `Declared master FID ${masterId} is not active or archived.`,
      })
    } else {
      if (master.masterFid) {
        issues.push({
          code: 'fid.graph.master-nested',
          message: `Master FID ${master.fileName} must not declare another master FID.`,
        })
      }
      for (const child of declaredMasters) {
        if (child.id === masterId) continue
        if (!(contentById.get(masterId) ?? '').includes(child.id)) {
          issues.push({
            code: 'fid.graph.master-child-missing',
            message: `Master ${master.fileName} does not list child ${child.id}.`,
          })
        }
      }
    }
  }

  for (const record of records) {
    for (const dependency of record.dependencies) {
      if (!byId.has(dependency) && !archivedFidExists(root, dependency)) {
        issues.push({
          code: 'fid.graph.dependency-missing',
          message: `${record.fileName} depends on missing or uncertified ${dependency}.`,
        })
      }
      if (dependency === record.id) {
        issues.push({
          code: 'fid.graph.dependency-cycle',
          message: `${record.fileName} depends on itself.`,
        })
      }
    }
  }

  const visiting = new Set<string>()
  const visited = new Set<string>()
  const walk = (id: string, chain: string[]): void => {
    if (visiting.has(id)) {
      issues.push({
        code: 'fid.graph.dependency-cycle',
        message: `Dependency cycle detected: ${[...chain, id].join(' -> ')}.`,
      })
      return
    }
    if (visited.has(id)) return
    visiting.add(id)
    const record = byId.get(id)
    for (const dependency of record?.dependencies ?? []) {
      if (byId.has(dependency)) walk(dependency, [...chain, id])
    }
    visiting.delete(id)
    visited.add(id)
  }
  for (const record of records) walk(record.id, [])
  return issues
}

function metadata(content: string, field: string): string | undefined {
  return content.match(new RegExp(`^\\*\\*${field}:\\*\\*\\s*(.+)$`, 'm'))?.[1]
}

function activeFidFiles(root: string): string[] {
  const directory = path.join(root, 'dev', 'fids')
  if (!fs.existsSync(directory)) return []
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() && /^FID-\d{4}-\d{4}-\d{3}-.+\.md$/.test(entry.name),
    )
    .map((entry) => path.join(directory, entry.name))
    .sort()
}

export function validateActiveFidLedger(root: string): FidLedgerIssue[] {
  const issues: FidLedgerIssue[] = []
  const files = activeFidFiles(root)
  const ids = new Map<string, string[]>()
  const records: FidRecord[] = []
  const contentById = new Map<string, string>()

  for (const filePath of files) {
    const fileName = path.basename(filePath)
    const content = fs.readFileSync(filePath, 'utf8')
    const declaredFilename = metadata(content, 'Filename')
    const declaredId = metadata(content, 'ID')
    const severity = metadata(content, 'Severity')
    const status = metadata(content, 'Status')
    const expectedId = fileName.match(/^(FID-\d{4}-\d{4}-\d{3})-/)?.[1]

    const normalizedFilename = declaredFilename?.replace(/^`|`$/g, '')
    if (normalizedFilename !== fileName) {
      issues.push({
        code: 'fid.metadata.filename',
        message: `${fileName} declares filename ${declaredFilename ?? 'missing'}; expected ${fileName}.`,
      })
    }
    if (!declaredId || !FID_ID_PATTERN.test(declaredId)) {
      issues.push({
        code: 'fid.metadata.id',
        message: `${fileName} has a missing or malformed ID.`,
      })
    } else {
      const locations = ids.get(declaredId) ?? []
      locations.push(fileName)
      ids.set(declaredId, locations)
    }
    if (declaredId && expectedId && declaredId !== expectedId) {
      issues.push({
        code: 'fid.metadata.filename-id',
        message: `${fileName} declares ${declaredId}; expected ${expectedId}.`,
      })
    }
    if (
      !severity ||
      !['critical', 'high', 'medium', 'low'].includes(severity)
    ) {
      issues.push({
        code: 'fid.metadata.severity',
        message: `${fileName} has a missing or invalid severity.`,
      })
    }
    if (!status || !ALLOWED_ACTIVE_STATUSES.has(status)) {
      issues.push({
        code: 'fid.metadata.status',
        message: `${fileName} has a missing or non-active status: ${status ?? 'missing'}.`,
      })
    }
    for (const heading of REQUIRED_HEADINGS) {
      if (!content.includes(heading)) {
        issues.push({
          code: 'fid.structure.heading',
          message: `${fileName} is missing ${heading}.`,
        })
      }
    }
    if (FORBIDDEN_ATTRIBUTION.test(content)) {
      issues.push({
        code: 'fid.policy.attribution',
        message: `${fileName} contains a forbidden attribution field.`,
      })
    }

    const masterFid = metadata(content, 'Master FID')
    const dependencies = metadata(content, 'Depends On')
    if (declaredId && FID_ID_PATTERN.test(declaredId)) {
      records.push({
        id: declaredId,
        fileName,
        status,
        masterFid: masterFid ? references(masterFid)[0] : undefined,
        dependencies: references(dependencies),
      })
      contentById.set(declaredId, content)
    }
  }

  for (const [id, locations] of ids) {
    if (locations.length > 1) {
      issues.push({
        code: 'fid.metadata.duplicate-active-id',
        message: `${id} is declared by multiple active files: ${locations.join(', ')}.`,
      })
    }
  }
  issues.push(...validateRelationshipGraph(root, records, contentById))
  issues.push(...validateFidStepLedger(root))
  return issues
}
