import fs from 'node:fs'
import path from 'node:path'

import {
  readLessonLocator,
  resolveLesson,
  LIVE_LESSONS,
} from './learnings-locator'
import { wrapLearningMarkdown } from './learnings-markdown'
import { EMBEDDED_LEARNINGS_PATH } from './learnings-projection'
import { readCanonicalRuleCatalog } from './learnings-rules'

export type ConsolidationEntry = {
  title: string
  invariant: string
  guard: string
  canonicalRule?: string
  status: string
  locations: Array<{ file: string; line: number }>
}
export type ConsolidationInventory = {
  entries: ConsolidationEntry[]
  proposals: string[][]
  issues: string[]
  ledgerCharacters: number
  digestCharacters: number
}

const normalized = (value: string): string => value.trim().replace(/\s+/g, ' ')

/** Thematic similarity is not equality; differing guards/rules remain distinct. */
export function exactConsolidationProposals(
  entries: readonly ConsolidationEntry[],
): string[][] {
  const groups = new Map<string, string[]>()
  for (const entry of entries) {
    if (
      !entry.canonicalRule ||
      !normalized(entry.invariant) ||
      !normalized(entry.guard)
    )
      continue
    const key = JSON.stringify([
      normalized(entry.invariant),
      normalized(entry.guard),
      entry.canonicalRule,
    ])
    const titles = groups.get(key) ?? []
    if (!titles.includes(entry.title)) titles.push(entry.title)
    groups.set(key, titles)
  }
  return [...groups.values()]
    .filter((titles) => titles.length > 1)
    .map((titles) => titles.sort())
    .sort((a, b) => (a[0] ?? '').localeCompare(b[0] ?? ''))
}

export function reviewLearningConsolidation(
  root: string,
): ConsolidationInventory {
  const locator = readLessonLocator(root)
  const catalog = readCanonicalRuleCatalog(root)
  const entries: ConsolidationEntry[] = []
  const issues = catalog.issues.map((issue) => issue.message)
  for (const [title, locations] of locator) {
    const resolved = resolveLesson(locator, title)
    if (!resolved.ok) {
      issues.push(resolved.issue)
      continue
    }
    const location =
      locations.find((candidate) => !candidate.retired) ?? locations[0]
    if (!location) continue
    entries.push({
      title,
      invariant: location.entry.invariant,
      guard: location.entry.guard,
      canonicalRule: location.entry.canonicalRule,
      status: location.entry.status,
      locations: locations.map(({ file, line }) => ({ file, line })),
    })
  }
  const names = new Set(catalog.rules.map((rule) => rule.name))
  return {
    entries,
    proposals: exactConsolidationProposals(
      entries.filter(
        (entry) =>
          entry.canonicalRule !== undefined &&
          names.has(entry.canonicalRule) &&
          entry.status === 'active',
      ),
    ),
    issues,
    ledgerCharacters: fs.readFileSync(path.join(root, LIVE_LESSONS), 'utf8')
      .length,
    digestCharacters: fs.readFileSync(
      path.join(root, EMBEDDED_LEARNINGS_PATH),
      'utf8',
    ).length,
  }
}

export function renderConsolidationInventory(
  inventory: ConsolidationInventory,
): string {
  const lines = [
    '# Learning consolidation inventory',
    '',
    `Inventory: ${inventory.entries.length} unique titles; ${inventory.proposals.length} exact merge proposals.`,
    '',
    `Live ledger: ${inventory.ledgerCharacters} JavaScript characters. Boot digest: ${inventory.digestCharacters} characters.`,
    'Measured boot reduction from this inventory pass: 0 characters; no rule selection or lesson status changed.',
    '',
    'Merge eligibility requires the same invariant, guard and canonical rule. Thematic families alone do not qualify.',
    'Any concrete supersession requires the recorded operator ruling. All incident accounts and distinct guards remain.',
    '',
  ]
  for (const entry of inventory.entries)
    lines.push(
      `## ${entry.title}`,
      '',
      `Locations: ${entry.locations.map((location) => `${location.file}:${location.line}`).join(', ')}.`,
      `Status: ${entry.status || 'unstructured'}. Rule: ${entry.canonicalRule ?? 'unruled historical evidence'}.`,
      `Invariant: ${entry.invariant || 'not structured'}`,
      `Guard: ${entry.guard || 'not structured'}`,
      '',
    )
  for (const titles of inventory.proposals)
    lines.push(`Proposal requiring operator ruling: ${titles.join(' → ')}`, '')
  for (const issue of inventory.issues) lines.push(`Issue: ${issue}`, '')
  return wrapLearningMarkdown(lines)
}
