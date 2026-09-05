/**
 * Pure helpers: distance, patch ratio, semver, ledger IO, snapshot/read
 * primitives, frontmatter validation and doc building
 * (FID-2026-0819-005 Loop 304: extracted verbatim).
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

import matter from 'gray-matter'

import {
  skillCanonicalDir,
  skillLedgerPath,
  skillQuarantineDir,
  skillVersionsDir,
} from './paths'
import {
  AGENT_AUTHORED_DESCRIPTION_MAX_LENGTH,
  SKILL_FILE_NAME,
  SKILL_VERSION_REGEX,
  isValidSkillName,
} from '../../constants/skills'
import { SkillFrontmatterSchema } from '../../types/skill'

import type { SemverBumpKind, SkillLedgerEntry } from './types'

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Standard Levenshtein edit distance (bounded DP, O(n·m)). */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  let prev = new Array<number>(b.length + 1)
  let curr = new Array<number>(b.length + 1)
  for (let j = 0; j <= b.length; j++) prev[j] = j
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[b.length]
}

/**
 * Change ratio of a patch: edit distance over the original length.
 * A ratio > PATCH_MAX_CHANGE_RATIO (10%) fails — the patch must be split or
 * go through `edit` with operator review (Perfection Loop circuit breaker).
 */
export function patchChangeRatio(original: string, patched: string): number {
  if (original.length === 0) return patched.length === 0 ? 0 : 1
  return levenshteinDistance(original, patched) / original.length
}

export function bumpVersion(
  version: string,
  kind: SemverBumpKind,
): string | null {
  if (!SKILL_VERSION_REGEX.test(version)) return null
  const [major, minor, patch] = version.split('.').map(Number)
  switch (kind) {
    case 'patch':
      return `${major}.${minor}.${patch + 1}`
    case 'minor':
      return `${major}.${minor + 1}.0`
    case 'major':
      return `${major + 1}.0.0`
  }
}

/** Atomic single-line append to the version ledger. */
export function appendLedgerEntry(
  rootDir: string,
  name: string,
  entry: SkillLedgerEntry,
): void {
  const ledger = skillLedgerPath(rootDir, name)
  fs.mkdirSync(path.dirname(ledger), { recursive: true })
  fs.appendFileSync(ledger, `${JSON.stringify(entry)}\n`, 'utf8')
}

export function readLedgerEntries(
  rootDir: string,
  name: string,
): SkillLedgerEntry[] {
  const ledger = skillLedgerPath(rootDir, name)
  if (!fs.existsSync(ledger)) return []
  const entries: SkillLedgerEntry[] = []
  for (const line of fs.readFileSync(ledger, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed === '') continue
    try {
      entries.push(JSON.parse(trimmed) as SkillLedgerEntry)
    } catch {
      // Malformed ledger line — skip (never corrupt the chain).
    }
  }
  return entries
}

export function nextLedgerSeq(rootDir: string, name: string): number {
  const entries = readLedgerEntries(rootDir, name)
  if (entries.length === 0) return 1
  const last = entries[entries.length - 1]
  return Number.isFinite(last.seq) ? last.seq + 1 : 1
}

export function writeSnapshot(
  rootDir: string,
  name: string,
  seq: number,
  content: string,
): string {
  const dir = path.join(skillVersionsDir(rootDir, name), `v${seq}`)
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, SKILL_FILE_NAME)
  fs.writeFileSync(file, content, 'utf8')
  return file
}

export function readSkillFile(
  dir: string,
): { content: string; version: string; immutable: boolean } | null {
  const file = path.join(dir, SKILL_FILE_NAME)
  if (!fs.existsSync(file)) return null
  const content = fs.readFileSync(file, 'utf8')
  try {
    const parsed = matter(content)
    const result = SkillFrontmatterSchema.safeParse(parsed.data)
    if (!result.success) return { content, version: '0.0.0', immutable: false }
    return {
      content,
      version: result.data.version ?? '0.0.0',
      immutable: result.data.immutable ?? false,
    }
  } catch {
    return null
  }
}

export type CurrentSkill = {
  /** Live trusted content, or null when no trusted skill exists. */
  live: { content: string; version: string; immutable: boolean } | null
  /** Quarantine draft content, or null when no draft exists. */
  draft: { content: string; version: string } | null
}

/** The skill's current state: draft wins over live for agent edits. */
export function readCurrentSkill(rootDir: string, name: string): CurrentSkill {
  return {
    live: readSkillFile(skillCanonicalDir(rootDir, name)),
    draft: (() => {
      const d = readSkillFile(skillQuarantineDir(rootDir, name))
      return d ? { content: d.content, version: d.version } : null
    })(),
  }
}

export function referencesDir(skillDir: string): string {
  return path.join(skillDir, 'references')
}

/**
 * Validate a relative references/ path: must be relative, non-empty, no
 * traversal (`..` / absolute / backslash tricks).
 */
export function validateReferencePath(relPath: string): string | null {
  if (relPath === '') return 'reference path must not be empty'
  const normalized = relPath.replace(/\\/g, '/')
  if (path.isAbsolute(relPath) || path.isAbsolute(normalized)) {
    return 'reference path must be relative'
  }
  const parts = normalized.split('/')
  if (parts.some((part) => part === '..' || part === '')) {
    return 'reference path must not traverse directories'
  }
  return null
}

/**
 * Build a SKILL.md document with agent-authored frontmatter. Agent-authored
 * skills get `metadata.origin: agent` so the trust boundary is auditable.
 */
export function buildAgentSkillDocument(params: {
  name: string
  description: string
  version: string
  body: string
  provenanceRef?: string
}): { ok: true; content: string } | { ok: false; error: string } {
  const { name, description, version, body } = params
  if (!isValidSkillName(name))
    return { ok: false, error: `invalid skill name: ${name}` }
  if (
    description.length === 0 ||
    description.length > AGENT_AUTHORED_DESCRIPTION_MAX_LENGTH
  ) {
    return {
      ok: false,
      error: `agent-authored description must be 1-${AGENT_AUTHORED_DESCRIPTION_MAX_LENGTH} characters`,
    }
  }
  if (!SKILL_VERSION_REGEX.test(version)) {
    return { ok: false, error: `invalid semver version: ${version}` }
  }
  if (body.trim() === '')
    return { ok: false, error: 'skill body must not be empty' }
  const metadata = { origin: 'agent' }
  const frontmatter: Record<string, unknown> = {
    name,
    description,
    version,
    metadata,
  }
  if (params.provenanceRef) {
    frontmatter.provenanceRef = params.provenanceRef
  }
  const yaml = Object.entries(frontmatter)
    .map(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        const inner = Object.entries(value as Record<string, string>)
          .map(([k, v]) => `    ${k}: ${v}`)
          .join('\n')
        return `${key}:\n${inner}`
      }
      return `${key}: ${value}`
    })
    .join('\n')
  return { ok: true, content: `---\n${yaml}\n---\n\n${body.trim()}\n` }
}

/**
 * Rewrite the `version` in a SKILL.md document's frontmatter, preserving
 * everything else byte-for-byte.
 */
export function rewriteVersion(content: string, version: string): string {
  try {
    const parsed = matter(content)
    const data = (parsed.data ?? {}) as Record<string, unknown>
    return `---\n${Object.entries({ ...data, version })
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join('\n')}\n---\n\n${parsed.content}`
  } catch {
    return content
  }
}
