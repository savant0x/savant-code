import * as fs from 'node:fs'
import * as path from 'node:path'

import type { HorizonState } from './experiences-recurrence'

export function parseRecurrenceArgs(args: readonly string[]): {
  json: boolean
  assertion?: string
} {
  let json = false
  let assertion: string | undefined
  for (const arg of args) {
    if (arg === '--json' && !json) {
      json = true
      continue
    }
    const owner = arg.match(/^--assert-repaired=(FID-\d{4}-\d{4}-\d{3})$/)?.[1]
    if (owner && assertion === undefined) {
      assertion = owner
      continue
    }
    throw new Error(`invalid or repeated recurrence option: ${arg}`)
  }
  return { json, assertion }
}

/** A closed owner cannot bypass the assertion by omitting repair boundaries. */
export function closedOwnerIssues(
  root: string,
  owners: readonly string[],
  classes: readonly { key: string; owner?: string; state: HorizonState }[],
): string[] {
  const issues: string[] = []
  for (const fid of new Set(owners)) {
    const matches = ['dev/fids', 'dev/fids/archive'].flatMap((directory) => {
      const absolute = path.join(root, directory)
      if (!fs.existsSync(absolute)) return []
      return fs
        .readdirSync(absolute)
        .filter((name) => name.startsWith(`${fid}-`) && name.endsWith('.md'))
        .map((name) => path.join(absolute, name))
    })
    if (matches.length !== 1) {
      issues.push(`owner FID is missing or ambiguous: ${fid}`)
      continue
    }
    const status = fs
      .readFileSync(matches[0]!, 'utf8')
      .match(/^\*\*Status:\*\*\s*(.*)$/m)?.[1]
    if (!status) issues.push(`owner FID has no status: ${fid}`)
    if (status && /\bclosed\b/i.test(status)) {
      for (const entry of classes.filter(
        (candidate) => candidate.owner === fid,
      )) {
        if (entry.state !== 'observed')
          issues.push(`closed owner has unproved class: ${entry.key}`)
      }
    }
  }
  return issues
}
