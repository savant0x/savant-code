/**
 * Mutation operations (create/patch/edit/delete) — every agent mutation
 * lands in quarantine (FID-2026-0819-005 Loop 304: extracted verbatim).
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

import matter from 'gray-matter'

import {
  appendLedgerEntry,
  buildAgentSkillDocument,
  bumpVersion,
  nextLedgerSeq,
  patchChangeRatio,
  readCurrentSkill,
  writeSnapshot,
} from './helpers'
import { skillQuarantineDir } from './paths'
import { PATCH_MAX_CHANGE_RATIO, SKILL_INITIAL_VERSION } from './types'
import {
  SKILL_FILE_NAME,
  SKILL_NAME_REGEX,
  isValidSkillName,
} from '../../constants/skills'
import { hashChange } from '../../crypto/hash'
import { SkillFrontmatterSchema } from '../../types/skill'

import type {
  SemverBumpKind,
  SkillManageAction,
  SkillManageResult,
} from './types'

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

export function mutationBase(
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

export function currentVersionOf(content: string): string {
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
