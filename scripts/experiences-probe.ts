import * as fs from 'node:fs'
import * as path from 'node:path'

import { z } from 'zod/v4'

import type { HorizonState } from './experiences-recurrence'

const FID_PATTERN = /^FID-\d{4}-\d{4}-\d{3}$/

export const closureWaiverManifestSchema = z.object({
  version: z.literal(1),
  waivers: z.array(
    z.object({
      fid: z.string().regex(FID_PATTERN),
      grantedAt: z.iso.date(),
      fixCutoff: z.iso.datetime({ offset: true }),
      reason: z.string().trim().min(1),
      classes: z.array(z.string().trim().min(1)).min(1),
    }),
  ),
})
export type ClosureWaiverManifest = z.infer<typeof closureWaiverManifestSchema>

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
  classes: readonly {
    key: string
    owner?: string
    state: HorizonState
    lastSeen?: string
  }[],
  waivers: ClosureWaiverManifest = { version: 1, waivers: [] },
): string[] {
  const issues: string[] = []
  const waiverMap = new Map<string, ClosureWaiverManifest['waivers'][number]>()
  const ownerStatus = new Map<string, string | undefined>()
  const hasActiveContinuation = (
    fid: string | undefined,
    previous: string,
    classKey: string,
  ): boolean => {
    if (!fid || !FID_PATTERN.test(fid)) return false
    const directory = path.join(root, 'dev/fids')
    if (!fs.existsSync(directory)) return false
    const matches = fs
      .readdirSync(directory)
      .filter((name) => name.startsWith(`${fid}-`) && name.endsWith('.md'))
    if (matches.length !== 1) return false
    const content = fs.readFileSync(path.join(directory, matches[0]), 'utf8')
    const status = content.match(/^\*\*Status:\*\*\s*([^\r\n]*)/m)?.[1]?.trim()
    const predecessors =
      content
        .match(/^\*\*Continues Classes From:\*\*\s*([^\r\n]*)/m)?.[1]
        ?.split(/[,\s]+/) ?? []
    return (
      ['created', 'analyzed', 'converged', 'fixed', 'verified'].includes(
        status ?? '',
      ) &&
      predecessors.includes(previous) &&
      content
        .split(/\r?\n/)
        .some(
          (line) =>
            line.startsWith(`- ${classKey} `) || line === `- ${classKey}`,
        )
    )
  }
  const getOwnerStatus = (fid: string): string | undefined => {
    if (ownerStatus.has(fid)) return ownerStatus.get(fid)
    const matches = ['dev/fids', 'dev/fids/archive'].flatMap((directory) => {
      const absolute = path.join(root, directory)
      if (!fs.existsSync(absolute)) return []
      return fs
        .readdirSync(absolute)
        .filter((name) => name.startsWith(`${fid}-`) && name.endsWith('.md'))
        .map((name) => path.join(absolute, name))
    })
    const status =
      matches.length === 1
        ? fs
            .readFileSync(matches[0]!, 'utf8')
            .match(/^\*\*Status:\*\*\s*(.*)$/m)?.[1]
        : undefined
    ownerStatus.set(fid, status)
    return status
  }
  for (const waiver of waivers.waivers) {
    if (waiverMap.has(waiver.fid))
      issues.push(`duplicate closure waiver: ${waiver.fid}`)
    waiverMap.set(waiver.fid, waiver)
    const fixCutoff = Date.parse(waiver.fixCutoff)
    const waiverClasses = new Set<string>()
    for (const classKey of waiver.classes) {
      if (waiverClasses.has(classKey))
        issues.push(`duplicate closure waiver class: ${classKey}`)
      waiverClasses.add(classKey)
      const entry = classes.find((candidate) => candidate.key === classKey)
      if (!entry) {
        issues.push(`closure waiver has no recorded class: ${classKey}`)
      } else if (entry.owner !== waiver.fid) {
        if (!hasActiveContinuation(entry.owner, waiver.fid, classKey))
          issues.push(
            `closure waiver names class owned by another FID: ${classKey}`,
          )
      } else if (entry.state === 'observed') {
        issues.push(`closure waiver names observed class: ${classKey}`)
      } else if (entry.state === 'recurred') {
        issues.push(`closure waiver cannot excuse recurrent class: ${classKey}`)
      } else if (
        /\bclosed\b/i.test(getOwnerStatus(waiver.fid) ?? '') &&
        entry.lastSeen &&
        Number.isFinite(fixCutoff) &&
        Date.parse(entry.lastSeen) > fixCutoff
      ) {
        issues.push(
          `closure waiver cannot excuse post-fix recurrence: ${classKey}`,
        )
      }
    }
  }
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
    const fidContent = fs.readFileSync(matches[0]!, 'utf8')
    const status = fidContent.match(/^\*\*Status:\*\*\s*(.*)$/m)?.[1]
    if (!status) issues.push(`owner FID has no status: ${fid}`)
    if (status && /\bclosed\b/i.test(status)) {
      const waiver = waiverMap.get(fid)
      if (
        waiver &&
        (!fidContent.includes('closure-waivers.json') ||
          !/\bQ25\b/.test(fidContent))
      ) {
        issues.push(
          `closed owner is missing its Q25 closure-waiver citation: ${fid}`,
        )
      }
      for (const entry of classes.filter(
        (candidate) => candidate.owner === fid,
      )) {
        if (entry.state === 'observed') continue
        if (entry.state === 'recurred') {
          issues.push(`closed owner has recurrent class: ${entry.key}`)
          continue
        }
        if (!waiver?.classes.includes(entry.key))
          issues.push(`closed owner has unproved class: ${entry.key}`)
      }
    }
  }
  return issues
}
