import { sha256 } from '@savant-code/common/util/hash'
import { MAX_ARGUMENT_CHARS } from '@savant-code/common/util/tool-argument-budget'

import {
  deleteStagedWrite,
  getStagedWrite,
  setStagedWrite,
} from './proposed-content-store'

/**
 * FID-2026-1012-017 (program FID-2026-1012-022, RC1 / feature E1): bounded,
 * revision-guarded staging for bulk writes.
 *
 * A bulk write is the one kind of payload that legitimately exceeds a single
 * tool call's argument budget, and the emission budget states a number the model
 * plans a split against. This module is the other half of that contract: the
 * write is staged as bounded chunks and becomes visible to the proposed-content surface
 * only when the staging is complete, contiguous and verified, so
 *
 * - an oversized payload is refused up front instead of being carried whole,
 * - a write authored against content that has since changed is refused by the
 *   revision guard rather than applied over someone else's edit,
 * - a staging that never completes exposes nothing, leaving the target
 *   untouched — the failure mode is "no write", never "half a write".
 *
 * Chunk boundaries are an internal transport detail: the assembled content is
 * byte-identical to what was staged (asserted at plan time, Law 14).
 */

/** The revision of a piece of file content — the guard value both ends use. */
export function contentRevision(content: string): string {
  return sha256(content)
}

export interface BoundedWriteChunk {
  index: number
  content: string
}

export interface BoundedWritePlan {
  content: string
  /** Revision of `content`: the integrity guard for the assembled result. */
  revision: string
  chunks: readonly BoundedWriteChunk[]
}

/**
 * Split content into chunks no larger than `maxChunkChars` and record the
 * revision the assembled result must reproduce. Throws on an unusable budget
 * rather than producing a plan no caller could honour (Law 14).
 */
export function planBoundedWrite(params: {
  content: string
  maxChunkChars: number
}): BoundedWritePlan {
  const { content, maxChunkChars } = params
  if (!Number.isInteger(maxChunkChars) || maxChunkChars < 1) {
    throw new Error(
      `Bounded write needs a positive integer chunk size; received ${maxChunkChars}.`,
    )
  }
  const chunks: BoundedWriteChunk[] = []
  for (let index = 0; index * maxChunkChars < content.length; index += 1) {
    chunks.push({
      index,
      content: content.slice(
        index * maxChunkChars,
        (index + 1) * maxChunkChars,
      ),
    })
  }
  if (chunks.length === 0) chunks.push({ index: 0, content: '' })
  const assembled = chunks.map((chunk) => chunk.content).join('')
  if (assembled !== content) {
    throw new Error(
      'Bounded write plan does not reassemble to the staged content; refusing to stage a lossy split.',
    )
  }
  return { content, revision: contentRevision(content), chunks }
}

export type StageWriteResult =
  | { ok: true; revision: string; chunkCount: number }
  | { ok: false; errorMessage: string }

/**
 * Stage a write for `path` in `runId` as bounded chunks. `baseRevision` is the
 * revision of the content the write was authored against: restaging the same
 * path against different base content is refused, because the first staging's
 * guard no longer describes the file.
 */
export function stageBoundedWrite(params: {
  runId: string
  path: string
  content: string
  baseRevision: string
  maxChunkChars: number
}): StageWriteResult {
  const { runId, path, content, baseRevision, maxChunkChars } = params
  // The ceiling is the same number the execution seam refuses on, so a payload
  // that cannot be committed whole is refused here instead of being staged.
  if (content.length > MAX_ARGUMENT_CHARS) {
    return {
      ok: false,
      errorMessage:
        `${path}: this write carries ${content.length} characters, above the ` +
        `${MAX_ARGUMENT_CHARS}-character ceiling for a single tool call, so nothing was staged or ` +
        'applied. Split the work across calls: create the file first, then append the rest.',
    }
  }
  const existing = getStagedWrite(runId, path)
  if (existing && existing.baseRevision !== baseRevision) {
    return {
      ok: false,
      errorMessage:
        `${path}: this run already staged a write against a different revision of the file ` +
        `(staged ${existing.baseRevision.slice(0, 12)}, now ${baseRevision.slice(0, 12)}). ` +
        'Read the file again and re-stage; the earlier staging was discarded instead of being applied over it.',
    }
  }
  let plan: BoundedWritePlan
  try {
    plan = planBoundedWrite({ content, maxChunkChars })
  } catch (error) {
    return {
      ok: false,
      errorMessage: error instanceof Error ? error.message : String(error),
    }
  }
  if (existing) deleteStagedWrite(runId, path)
  setStagedWrite(runId, path, {
    baseRevision,
    revision: plan.revision,
    expectedChunks: plan.chunks.length,
    chunks: new Map(plan.chunks.map((chunk) => [chunk.index, chunk.content])),
  })
  return {
    ok: true,
    revision: plan.revision,
    chunkCount: plan.chunks.length,
  }
}

export type AssembleWriteResult =
  | { ok: true; content: string; revision: string }
  | { ok: false; errorMessage: string }

/**
 * Assemble a completed staging. Every chunk must be present and the result must
 * reproduce the staged revision; a staging that is incomplete, or whose base
 * content has moved on, returns no content at all — nothing partial is exposed.
 */
export function assembleStagedWrite(params: {
  runId: string
  path: string
  currentContent: string
}): AssembleWriteResult {
  const { runId, path, currentContent } = params
  const staged = getStagedWrite(runId, path)
  if (!staged) {
    return {
      ok: false,
      errorMessage: `${path}: no write is staged for this run, so nothing can be committed.`,
    }
  }
  const currentRevision = contentRevision(currentContent)
  if (staged.baseRevision !== currentRevision) {
    return {
      ok: false,
      errorMessage:
        `${path}: the file changed after this write was staged (staged against ` +
        `${staged.baseRevision.slice(0, 12)}, currently ${currentRevision.slice(0, 12)}), so the ` +
        'staged write was not applied. Re-read the file and re-stage the change.',
    }
  }
  if (staged.chunks.size !== staged.expectedChunks) {
    return {
      ok: false,
      errorMessage:
        `${path}: the staged write is incomplete (${staged.chunks.size} of ` +
        `${staged.expectedChunks} chunks present), so nothing was committed.`,
    }
  }
  const parts: string[] = []
  for (let index = 0; index < staged.expectedChunks; index += 1) {
    const chunk = staged.chunks.get(index)
    if (chunk === undefined) {
      return {
        ok: false,
        errorMessage: `${path}: staged chunk ${index} is missing, so nothing was committed.`,
      }
    }
    parts.push(chunk)
  }
  const content = parts.join('')
  const revision = contentRevision(content)
  if (revision !== staged.revision) {
    return {
      ok: false,
      errorMessage:
        `${path}: the staged chunks do not reproduce the staged revision ` +
        `(${staged.revision.slice(0, 12)}), so the write was refused rather than committed lossily.`,
    }
  }
  return { ok: true, content, revision }
}
