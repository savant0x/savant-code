import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import {
  designAuthoringInputV1Schema,
  type DesignAuthoringInputV1,
} from './authoring'

function writeDraftAtomic(filePath: string, data: string): void {
  const temporary = `${filePath}.${process.pid}.${randomUUID()}.tmp`
  try {
    fs.writeFileSync(temporary, data, 'utf8')
    fs.renameSync(temporary, filePath)
  } catch (error) {
    fs.rmSync(temporary, { force: true })
    throw error
  }
}

const MAX_DRAFTS = 20
const MAX_DRAFT_BYTES = 256 * 1024
const DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

export type DesignDraft = {
  id: string
  createdAt: string
  updatedAt: string
  input: DesignAuthoringInputV1
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80)
}

function draftRoot(root: string): string {
  return path.join(root, 'drafts')
}

function draftPath(root: string, id: string): string {
  return path.join(draftRoot(root), `${safeId(id)}.json`)
}

function isSaneTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) && parsed <= Date.now()
}

function readDraft(filePath: string): DesignDraft | undefined {
  try {
    const stat = fs.lstatSync(filePath)
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_DRAFT_BYTES)
      return undefined
    const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    if (!parsed || typeof parsed !== 'object') return undefined
    const candidate = parsed as Partial<DesignDraft>
    if (
      typeof candidate.id !== 'string' ||
      typeof candidate.createdAt !== 'string' ||
      typeof candidate.updatedAt !== 'string' ||
      !isSaneTimestamp(candidate.createdAt) ||
      !isSaneTimestamp(candidate.updatedAt) ||
      Date.parse(candidate.createdAt) > Date.parse(candidate.updatedAt) ||
      !candidate.input ||
      !designAuthoringInputV1Schema.safeParse(candidate.input).success
    ) {
      return undefined
    }
    return candidate as DesignDraft
  } catch {
    return undefined
  }
}

function allDesignDrafts(root: string): DesignDraft[] {
  const directory = draftRoot(root)
  if (!fs.existsSync(directory)) return []
  return fs
    .readdirSync(directory)
    .filter((name) => name.endsWith('.json'))
    .flatMap((name): DesignDraft[] => {
      const filePath = path.join(directory, name)
      const draft = readDraft(filePath)
      if (!draft) {
        // Malformed, future-dated, or oversized drafts are not resumable.
        // Remove them so a broken artifact cannot reappear indefinitely.
        fs.rmSync(filePath, { force: true })
        return []
      }
      const fresh = Date.now() - Date.parse(draft.updatedAt) <= DRAFT_MAX_AGE_MS
      if (!fresh) {
        fs.rmSync(filePath, { force: true })
        return []
      }
      return [draft]
    })
    .sort((left, right) => {
      const byUpdatedAt = right.updatedAt.localeCompare(left.updatedAt)
      return byUpdatedAt !== 0 ? byUpdatedAt : right.id.localeCompare(left.id)
    })
}

export function listDesignDrafts(root: string): DesignDraft[] {
  const drafts = allDesignDrafts(root)
  for (const stale of drafts.slice(MAX_DRAFTS)) {
    fs.rmSync(draftPath(root, stale.id), { force: true })
  }
  return drafts.slice(0, MAX_DRAFTS)
}

export function saveDesignDraft(
  root: string,
  input: DesignAuthoringInputV1,
  draftId: string = randomUUID(),
): DesignDraft {
  const now = new Date().toISOString()
  const existing = allDesignDrafts(root).find((draft) => draft.id === draftId)
  const draft: DesignDraft = {
    id: draftId,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    input,
  }
  const serialized = JSON.stringify(draft, null, 2)
  if (Buffer.byteLength(serialized, 'utf8') > MAX_DRAFT_BYTES) {
    throw new Error('Design-system draft exceeds the size limit.')
  }
  fs.mkdirSync(draftRoot(root), { recursive: true })
  writeDraftAtomic(draftPath(root, draftId), `${serialized}\n`)
  const drafts = allDesignDrafts(root)
  for (const stale of drafts.slice(MAX_DRAFTS)) {
    fs.rmSync(draftPath(root, stale.id), { force: true })
  }
  return draft
}

export function getDesignDraft(
  root: string,
  draftId: string,
): DesignDraft | undefined {
  const filePath = draftPath(root, draftId)
  const draft = readDraft(filePath)
  if (!draft) {
    fs.rmSync(filePath, { force: true })
    return undefined
  }
  if (Date.now() - Date.parse(draft.updatedAt) > DRAFT_MAX_AGE_MS) {
    fs.rmSync(filePath, { force: true })
    return undefined
  }
  const retained = allDesignDrafts(root).slice(0, MAX_DRAFTS)
  if (!retained.some((candidate) => candidate.id === draft.id)) {
    fs.rmSync(filePath, { force: true })
    return undefined
  }
  return draft
}

export function discardDesignDraft(root: string, draftId: string): boolean {
  const filePath = draftPath(root, draftId)
  if (!fs.existsSync(filePath)) return false
  fs.rmSync(filePath, { force: true })
  return true
}

export function clearDesignDraft(root: string, draftId: string): void {
  discardDesignDraft(root, draftId)
}
