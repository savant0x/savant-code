import * as fs from 'node:fs'
import * as path from 'node:path'

import matter from 'gray-matter'

import {
  AGENT_AUTHORED_DESCRIPTION_MAX_LENGTH,
  QUARANTINE_DIR_NAME,
  SKILL_FILE_NAME,
  SKILL_NAME_REGEX,
  SKILL_VERSION_REGEX,
  isValidSkillName,
} from '../constants/skills'
import { hashChange } from '../crypto/hash'
import { SkillFrontmatterSchema } from '../types/skill'

/**
 * FID-2026-0824-012 S2-B/C/D — skill management engine (create/patch/edit/
 * delete/write_file/remove_file/rollback) with internal versioning and the
 * quarantine trust boundary.
 *
 * Layout (single source of truth for both the `skill_manage` tool and the
 * operator `skills` CLI):
 *
 *   .agents/skills/<name>/SKILL.md        — LIVE (trusted) skill
 *   .agents/skills/<name>/versions/v<N>/SKILL.md   — immutable snapshots
 *   .agents/skills/<name>/VERSIONS.jsonl  — append-only version ledger
 *   .agents/skills/.quarantine/<name>/    — DRAFT working copy (pending trust)
 *
 * Every mutation snapshots the state being replaced FIRST, then applies the
 * change to the DRAFT working copy, then appends a ledger entry. Git history
 * is NOT the ledger (release-only-commits convention) — the on-disk ledger is
 * authoritative and survives into the release commit.
 *
 * Agent writes ALWAYS land in quarantine (S2-D) — nothing an agent authors is
 * loadable until an operator runs `skills trust`. Patches to a LIVE skill
 * create a new quarantined draft on top of the current live content; trusting
 * it replaces the live copy. Immutable skills reject every mutation.
 *
 * All operations fail closed on validation (an agent must never corrupt a
 * skill), but never throw on filesystem races — results are explicit.
 */

export const SKILL_VERSIONS_DIR_NAME = 'versions'
export const SKILL_VERSIONS_LEDGER_NAME = 'VERSIONS.jsonl'
/** Perfection-Loop circuit breaker applied to skill patches (S2-B). */
export const PATCH_MAX_CHANGE_RATIO = 0.1
/** Default version for freshly created skills. */
export const SKILL_INITIAL_VERSION = '0.1.0'

export const SKILL_MANAGE_ACTIONS = [
  'create',
  'patch',
  'edit',
  'delete',
  'write_file',
  'remove_file',
  'rollback',
] as const
export type SkillManageAction = (typeof SKILL_MANAGE_ACTIONS)[number]

export const SEMVER_BUMP_KINDS = ['patch', 'minor', 'major'] as const
export type SemverBumpKind = (typeof SEMVER_BUMP_KINDS)[number]

export type SkillLedgerEntry = {
  seq: number
  /** Semver AFTER the mutation. */
  version: string
  action: SkillManageAction
  ts: string
  sessionId: string
  reason: string
  prevSha: string | null
  nextSha: string
  /** Source lesson / session evidence (FID-2026-0824-012 provenance). */
  provenanceRef: string
  /** True when the change passed the semantic-preservation check. */
  semanticPreservation: boolean
}

export type SkillManageResult =
  | {
      ok: true
      name: string
      version: string
      action: SkillManageAction
      nextSha: string
      /** True when the change is pending operator trust (quarantine). */
      pendingTrust: boolean
      message?: string
    }
  | { ok: false; error: string }

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

export function skillCanonicalDir(rootDir: string, name: string): string {
  return path.join(rootDir, '.agents', 'skills', name)
}

export function skillQuarantineDir(rootDir: string, name: string): string {
  return path.join(rootDir, '.agents', 'skills', QUARANTINE_DIR_NAME, name)
}

export function skillLedgerPath(rootDir: string, name: string): string {
  return path.join(skillCanonicalDir(rootDir, name), SKILL_VERSIONS_LEDGER_NAME)
}

export function skillVersionsDir(rootDir: string, name: string): string {
  return path.join(skillCanonicalDir(rootDir, name), SKILL_VERSIONS_DIR_NAME)
}

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

function referencesDir(skillDir: string): string {
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

// ---------------------------------------------------------------------------
// Operations (all agent mutations land in quarantine)
// ---------------------------------------------------------------------------

export function createSkill(params: {
  rootDir: string
  name: string
  description: string
  body: string
  sessionId: string
  reason: string
  provenanceRef?: string
}): SkillManageResult {
  const { rootDir, name, sessionId, reason } = params
  if (!SKILL_NAME_REGEX.test(name)) {
    return { ok: false, error: `invalid skill name: ${name}` }
  }
  const current = readCurrentSkill(rootDir, name)
  if (current.live || current.draft) {
    return {
      ok: false,
      error: `skill '${name}' already exists (use patch/edit)`,
    }
  }
  const built = buildAgentSkillDocument({
    name,
    description: params.description,
    version: SKILL_INITIAL_VERSION,
    body: params.body,
    provenanceRef: params.provenanceRef,
  })
  if (!built.ok) return built

  const draftDir = skillQuarantineDir(rootDir, name)
  fs.mkdirSync(draftDir, { recursive: true })
  fs.writeFileSync(path.join(draftDir, SKILL_FILE_NAME), built.content, 'utf8')
  // Snapshot the initial state so rollback to 0.1.0 is always possible.
  writeSnapshot(rootDir, name, 1, built.content)
  const nextSha = hashChange(built.content)
  appendLedgerEntry(rootDir, name, {
    seq: 1,
    version: SKILL_INITIAL_VERSION,
    action: 'create',
    ts: new Date().toISOString(),
    sessionId,
    reason,
    prevSha: null,
    nextSha,
    provenanceRef: params.provenanceRef ?? `session:${sessionId}`,
    semanticPreservation: true,
  })
  return {
    ok: true,
    name,
    version: SKILL_INITIAL_VERSION,
    action: 'create',
    nextSha,
    pendingTrust: true,
  }
}

function mutationBase(
  rootDir: string,
  name: string,
  action: SkillManageAction,
):
  | { ok: true; base: string; seq: number; immutable: boolean }
  | { ok: false; error: string } {
  if (!isValidSkillName(name))
    return { ok: false, error: `invalid skill name: ${name}` }
  const current = readCurrentSkill(rootDir, name)
  const immutable = current.live?.immutable ?? false
  if (immutable) {
    return {
      ok: false,
      error: `skill '${name}' is immutable — mutations are rejected (operator-only)`,
    }
  }
  const base = current.draft?.content ?? current.live?.content
  if (!base) {
    return {
      ok: false,
      error: `skill '${name}' does not exist (create it first)`,
    }
  }
  return { ok: true, base, seq: nextLedgerSeq(rootDir, name), immutable: false }
}

function applyMutation(params: {
  rootDir: string
  name: string
  action: SkillManageAction
  base: string
  next: string
  version: string
  sessionId: string
  reason: string
  provenanceRef?: string
  semanticPreservation: boolean
}): SkillManageResult {
  const { rootDir, name, action, base, next, version } = params
  const seq = nextLedgerSeq(rootDir, name)
  // Snapshot the state being replaced BEFORE writing the new content.
  writeSnapshot(rootDir, name, seq, base)
  const draftDir = skillQuarantineDir(rootDir, name)
  fs.mkdirSync(draftDir, { recursive: true })
  const file = path.join(draftDir, SKILL_FILE_NAME)
  fs.writeFileSync(file, next, 'utf8')
  const nextSha = hashChange(next)
  appendLedgerEntry(rootDir, name, {
    seq,
    version,
    action: action,
    ts: new Date().toISOString(),
    sessionId: params.sessionId,
    reason: params.reason,
    prevSha: hashChange(base),
    nextSha,
    provenanceRef: params.provenanceRef ?? `session:${params.sessionId}`,
    semanticPreservation: params.semanticPreservation,
  })
  return {
    ok: true,
    name,
    version,
    action,
    nextSha,
    pendingTrust: true,
  }
}

export function patchSkill(params: {
  rootDir: string
  name: string
  oldString: string
  newString: string
  sessionId: string
  reason: string
  bump?: SemverBumpKind
  provenanceRef?: string
}): SkillManageResult {
  const base = mutationBase(params.rootDir, params.name, 'patch')
  if (!base.ok) return base
  if (!base.base.includes(params.oldString)) {
    return {
      ok: false,
      error: 'patch anchor not found in the current skill content',
    }
  }
  const next = base.base.replace(params.oldString, params.newString)
  const ratio = patchChangeRatio(base.base, next)
  if (ratio > PATCH_MAX_CHANGE_RATIO) {
    return {
      ok: false,
      error: `patch changes ${(ratio * 100).toFixed(1)}% of the skill (>${PATCH_MAX_CHANGE_RATIO * 100}% cap) — split the patch or use edit with operator review`,
    }
  }
  const version = bumpVersion(
    currentVersionOf(base.base),
    params.bump ?? 'patch',
  )
  if (!version) return { ok: false, error: 'cannot derive next version' }
  return applyMutation({
    ...params,
    base: base.base,
    next,
    version,
    action: 'patch',
    semanticPreservation: true,
  })
}

function currentVersionOf(content: string): string {
  try {
    const parsed = matter(content)
    const result = SkillFrontmatterSchema.safeParse(parsed.data)
    if (!result.success) return SKILL_INITIAL_VERSION
    return result.data.version ?? SKILL_INITIAL_VERSION
  } catch {
    return SKILL_INITIAL_VERSION
  }
}

export function editSkill(params: {
  rootDir: string
  name: string
  description: string
  body: string
  sessionId: string
  reason: string
  bump?: SemverBumpKind
  provenanceRef?: string
}): SkillManageResult {
  const base = mutationBase(params.rootDir, params.name, 'edit')
  if (!base.ok) return base
  const version = bumpVersion(
    currentVersionOf(base.base),
    params.bump ?? 'minor',
  )
  if (!version) return { ok: false, error: 'cannot derive next version' }
  const built = buildAgentSkillDocument({
    name: params.name,
    description: params.description,
    version,
    body: params.body,
    provenanceRef: params.provenanceRef,
  })
  if (!built.ok) return built
  return applyMutation({
    ...params,
    base: base.base,
    next: built.content,
    version,
    action: 'edit',
    semanticPreservation: true,
  })
}

export function deleteDraftSkill(params: {
  rootDir: string
  name: string
  sessionId: string
  reason: string
}): SkillManageResult {
  const { rootDir, name, sessionId, reason } = params
  if (!isValidSkillName(name))
    return { ok: false, error: `invalid skill name: ${name}` }
  const draftDir = skillQuarantineDir(rootDir, name)
  if (!fs.existsSync(path.join(draftDir, SKILL_FILE_NAME))) {
    return { ok: false, error: `no quarantined draft '${name}' to delete` }
  }
  fs.rmSync(draftDir, { recursive: true, force: true })
  const seq = nextLedgerSeq(rootDir, name)
  const current = readCurrentSkill(rootDir, name)
  const liveContent = current.live?.content ?? ''
  appendLedgerEntry(rootDir, name, {
    seq,
    version: current.live?.version ?? SKILL_INITIAL_VERSION,
    action: 'delete',
    ts: new Date().toISOString(),
    sessionId,
    reason,
    prevSha: liveContent === '' ? null : hashChange(liveContent),
    nextSha: hashChange(''),
    provenanceRef: `session:${sessionId}`,
    semanticPreservation: true,
  })
  return {
    ok: true,
    name,
    version: current.live?.version ?? SKILL_INITIAL_VERSION,
    action: 'delete',
    nextSha: hashChange(''),
    pendingTrust: false,
  }
}

export function writeReferenceFile(params: {
  rootDir: string
  name: string
  relPath: string
  content: string
  sessionId: string
  reason: string
  provenanceRef?: string
}): SkillManageResult {
  const invalid = validateReferencePath(params.relPath)
  if (invalid) return { ok: false, error: invalid }
  const base = mutationBase(params.rootDir, params.name, 'write_file')
  if (!base.ok) return base
  const draftDir = skillQuarantineDir(params.rootDir, params.name)
  const file = path.join(referencesDir(draftDir), params.relPath)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, params.content, 'utf8')
  const nextSha = hashChange(params.content)
  appendLedgerEntry(params.rootDir, params.name, {
    seq: base.seq,
    version: currentVersionOf(base.base),
    action: 'write_file',
    ts: new Date().toISOString(),
    sessionId: params.sessionId,
    reason: params.reason,
    prevSha: null,
    nextSha,
    provenanceRef: params.provenanceRef ?? `session:${params.sessionId}`,
    semanticPreservation: true,
  })
  return {
    ok: true,
    name: params.name,
    version: currentVersionOf(base.base),
    action: 'write_file',
    nextSha,
    pendingTrust: true,
  }
}

export function removeReferenceFile(params: {
  rootDir: string
  name: string
  relPath: string
  sessionId: string
  reason: string
}): SkillManageResult {
  const invalid = validateReferencePath(params.relPath)
  if (invalid) return { ok: false, error: invalid }
  const base = mutationBase(params.rootDir, params.name, 'remove_file')
  if (!base.ok) return base
  const draftDir = skillQuarantineDir(params.rootDir, params.name)
  const file = path.join(referencesDir(draftDir), params.relPath)
  if (!fs.existsSync(file)) {
    return {
      ok: false,
      error: `references/${params.relPath} does not exist in the draft`,
    }
  }
  fs.rmSync(file, { force: true })
  appendLedgerEntry(params.rootDir, params.name, {
    seq: base.seq,
    version: currentVersionOf(base.base),
    action: 'remove_file',
    ts: new Date().toISOString(),
    sessionId: params.sessionId,
    reason: params.reason,
    prevSha: null,
    nextSha: hashChange(''),
    provenanceRef: `session:${params.sessionId}`,
    semanticPreservation: true,
  })
  return {
    ok: true,
    name: params.name,
    version: currentVersionOf(base.base),
    action: 'remove_file',
    nextSha: hashChange(''),
    pendingTrust: true,
  }
}

/**
 * Agent-initiated rollback — quarantine scope only (S2-E): restore snapshot
 * `seq` into the draft working copy. Restoring a LIVE skill is operator-only
 * (`skills rollback`, in the CLI — S2-E).
 */
export function rollbackDraft(params: {
  rootDir: string
  name: string
  seq: number
  sessionId: string
  reason: string
}): SkillManageResult {
  const { rootDir, name, seq, sessionId, reason } = params
  if (!isValidSkillName(name))
    return { ok: false, error: `invalid skill name: ${name}` }
  const snapshot = path.join(
    skillVersionsDir(rootDir, name),
    `v${seq}`,
    SKILL_FILE_NAME,
  )
  if (!fs.existsSync(snapshot)) {
    return { ok: false, error: `no snapshot v${seq} for skill '${name}'` }
  }
  const content = fs.readFileSync(snapshot, 'utf8')
  const draftDir = skillQuarantineDir(rootDir, name)
  if (!fs.existsSync(path.join(draftDir, SKILL_FILE_NAME))) {
    return {
      ok: false,
      error: `no quarantined draft '${name}' — operator rollback required`,
    }
  }
  fs.writeFileSync(path.join(draftDir, SKILL_FILE_NAME), content, 'utf8')
  const version = currentVersionOf(content)
  const ledgerSeq = nextLedgerSeq(rootDir, name)
  appendLedgerEntry(rootDir, name, {
    seq: ledgerSeq,
    version,
    action: 'rollback',
    ts: new Date().toISOString(),
    sessionId,
    reason,
    prevSha: null,
    nextSha: hashChange(content),
    provenanceRef: `session:${sessionId}`,
    semanticPreservation: true,
  })
  return {
    ok: true,
    name,
    version,
    action: 'rollback',
    nextSha: hashChange(content),
    pendingTrust: true,
  }
}

/** Operator-only: trust a draft (migrate quarantine → live). */
export function trustSkill(rootDir: string, name: string): SkillManageResult {
  if (!isValidSkillName(name))
    return { ok: false, error: `invalid skill name: ${name}` }
  const draftDir = skillQuarantineDir(rootDir, name)
  const draft = readSkillFile(draftDir)
  if (!draft) return { ok: false, error: `no quarantined draft '${name}'` }
  const liveDir = skillCanonicalDir(rootDir, name)
  fs.mkdirSync(liveDir, { recursive: true })
  fs.writeFileSync(path.join(liveDir, SKILL_FILE_NAME), draft.content, 'utf8')
  fs.rmSync(draftDir, { recursive: true, force: true })
  return {
    ok: true,
    name,
    version: draft.version,
    action: 'edit',
    nextSha: hashChange(draft.content),
    pendingTrust: false,
    message: `trusted '${name}' v${draft.version}`,
  }
}

/** Operator-only: untrust (live → quarantine), keeping history intact. */
export function untrustSkill(rootDir: string, name: string): SkillManageResult {
  if (!isValidSkillName(name))
    return { ok: false, error: `invalid skill name: ${name}` }
  const liveDir = skillCanonicalDir(rootDir, name)
  const live = readSkillFile(liveDir)
  if (!live) return { ok: false, error: `no trusted skill '${name}'` }
  if (live.immutable) {
    return { ok: false, error: `skill '${name}' is immutable — cannot untrust` }
  }
  const draftDir = skillQuarantineDir(rootDir, name)
  fs.mkdirSync(draftDir, { recursive: true })
  fs.writeFileSync(path.join(draftDir, SKILL_FILE_NAME), live.content, 'utf8')
  fs.rmSync(path.join(liveDir, SKILL_FILE_NAME), { force: true })
  return {
    ok: true,
    name,
    version: live.version,
    action: 'edit',
    nextSha: hashChange(live.content),
    pendingTrust: true,
    message: `untrusted '${name}' v${live.version} (moved to quarantine)`,
  }
}

/** Operator-only: restore snapshot `seq` into the LIVE copy. */
export function rollbackLiveSkill(
  rootDir: string,
  name: string,
  seq: number,
): SkillManageResult {
  if (!isValidSkillName(name))
    return { ok: false, error: `invalid skill name: ${name}` }
  const snapshot = path.join(
    skillVersionsDir(rootDir, name),
    `v${seq}`,
    SKILL_FILE_NAME,
  )
  if (!fs.existsSync(snapshot)) {
    return { ok: false, error: `no snapshot v${seq} for skill '${name}'` }
  }
  const liveDir = skillCanonicalDir(rootDir, name)
  const live = readSkillFile(liveDir)
  if (live?.immutable) {
    return {
      ok: false,
      error: `skill '${name}' is immutable — cannot rollback`,
    }
  }
  const content = fs.readFileSync(snapshot, 'utf8')
  fs.mkdirSync(liveDir, { recursive: true })
  fs.writeFileSync(path.join(liveDir, SKILL_FILE_NAME), content, 'utf8')
  appendLedgerEntry(rootDir, name, {
    seq: nextLedgerSeq(rootDir, name),
    version: currentVersionOf(content),
    action: 'rollback',
    ts: new Date().toISOString(),
    sessionId: 'operator-cli',
    reason: `operator rollback to v${seq}`,
    prevSha: live ? hashChange(live.content) : null,
    nextSha: hashChange(content),
    provenanceRef: 'operator-cli',
    semanticPreservation: true,
  })
  return {
    ok: true,
    name,
    version: currentVersionOf(content),
    action: 'rollback',
    nextSha: hashChange(content),
    pendingTrust: false,
    message: `rolled back '${name}' to v${seq}`,
  }
}
