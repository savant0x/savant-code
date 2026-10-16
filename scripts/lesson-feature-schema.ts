import fs from 'node:fs'
import path from 'node:path'

import z from 'zod/v4'

import { parseFidStatus } from '@savant-code/agent-runtime/echo/fid-verification-enforcement'

const digest = z.string().regex(/^[a-f0-9]{64}$/)
const fid = z.string().regex(/^FID-\d{4}-\d{4}-\d{3}$/)
const text = z.string().trim().min(1).max(1500)

/** One candidate entry, shared by the active queue and the implemented archive. */
export const featureCandidateSchema = z.strictObject({
  id: z.string().regex(/^LF-\d{3}$/),
  title: z.string().trim().min(1).max(100),
  priority: z.enum(['P1', 'P2', 'P3']),
  state: z.enum(['draft', 'ready', 'routed', 'implemented']),
  basis: z.enum(['observed-gap', 'investigation']),
  lessons: z.array(text).min(1),
  gap: text,
  acceptance: z.array(text).min(1).max(20),
  evidence: z
    .array(
      z.strictObject({
        path: z.string().min(1).max(300),
        sha256: digest.optional(),
        reason: text,
      }),
    )
    .min(1),
  fid: fid.optional(),
  commit: z
    .string()
    .regex(/^[a-f0-9]{8,40}$/)
    .optional(),
})

/**
 * FID-2026-1016-009: the active store holds OPEN work only. Implemented
 * candidates retire to the archive, which keeps their entry shape verbatim so a
 * retired record stays comparable with what admission passed, and so the
 * lesson-to-feature mapping survives retirement.
 */
export const featureManifestSchema = z.strictObject({
  version: z.literal(1),
  catalogHash: digest,
  features: z.array(featureCandidateSchema).max(1000),
})

/** The implemented archive: the same entries, distinguished by the file. */
export const featureArchiveSchema = z.strictObject({
  version: z.literal(1),
  features: z.array(featureCandidateSchema).max(1000),
})

export type FeatureManifest = z.infer<typeof featureManifestSchema>
export type FeatureArchive = z.infer<typeof featureArchiveSchema>
export type FeatureCandidate = z.infer<typeof featureCandidateSchema>

/** Reject traversal and symlink escapes before reading candidate evidence. */
export function featureEvidencePath(root: string, relative: string): string {
  if (path.isAbsolute(relative) || /^[A-Za-z]:/.test(relative)) {
    throw new Error('Evidence paths must be repo-relative')
  }
  const resolved = fs.realpathSync(path.resolve(root, relative))
  const within = path.relative(fs.realpathSync(root), resolved)
  if (
    !within ||
    within === '..' ||
    within.startsWith(`..${path.sep}`) ||
    path.isAbsolute(within) ||
    !fs.statSync(resolved).isFile()
  ) {
    throw new Error('Evidence must resolve to a file inside the repository')
  }
  return resolved
}

/** A routed item has exactly one real owner; closure also needs code evidence. */
export function inspectFeatureFid(root: string, id: string): string {
  const matches: string[] = []
  for (const directory of ['dev/fids', 'dev/fids/archive']) {
    const folder = path.join(root, directory)
    if (!fs.existsSync(folder)) continue
    for (const name of fs.readdirSync(folder)) {
      if (name.startsWith(`${id}-`) && name.endsWith('.md')) {
        matches.push(featureEvidencePath(root, `${directory}/${name}`))
      }
    }
  }
  if (matches.length !== 1) throw new Error('FID owner is missing or ambiguous')
  const content = fs.readFileSync(matches[0]!, 'utf8')
  const identity = new RegExp(
    `^\\s*(?:[-*]\\s+)?\\*\\*ID:\\*\\*\\s*${id}\\s*$`,
    'm',
  )
  if (!identity.test(content)) throw new Error('FID identity mismatch')
  if (
    parseFidStatus(content) === 'closed' &&
    path.dirname(matches[0]!) !==
      fs.realpathSync(path.join(root, 'dev/fids/archive'))
  ) {
    throw new Error('A closed FID must be archived')
  }
  return content
}
