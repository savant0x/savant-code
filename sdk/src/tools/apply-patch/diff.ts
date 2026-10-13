/**
 * Diff application + fallback strategies for the apply_patch tool
 * (FID-2026-0805-003). Extracted from apply-patch.ts verbatim.
 */

import {
  ensureTrailingNewline,
  normalizeDiffLines,
  normalizeLineEndings,
  parseCreateDiff,
  parseUpdateDiff,
  patchHasIntendedChanges,
  stripTrailingNewline,
} from './parser'
import { safePatchError } from '../patch-diagnostics'

import type { Chunk, DiffMode, PatchAttempt } from './types'

export function applyChunks(input: string, chunks: Chunk[]): string {
  const originalLines = input.split('\n')
  const destinationLines: string[] = []
  let originalIndex = 0

  for (const chunk of chunks) {
    if (chunk.origIndex > originalLines.length) {
      throw new Error(
        `applyDiff: chunk.origIndex ${chunk.origIndex} > input length ${originalLines.length}`,
      )
    }

    if (originalIndex > chunk.origIndex) {
      throw new Error(
        `applyDiff: overlapping chunk at ${chunk.origIndex} (cursor ${originalIndex})`,
      )
    }

    destinationLines.push(
      ...originalLines.slice(originalIndex, chunk.origIndex),
    )
    originalIndex = chunk.origIndex

    if (chunk.insLines.length > 0) {
      destinationLines.push(...chunk.insLines)
    }

    originalIndex += chunk.delLines.length
  }

  destinationLines.push(...originalLines.slice(originalIndex))
  return destinationLines.join('\n')
}

export function applyDiff(
  input: string,
  diff: string,
  mode: DiffMode = 'default',
): { result: string; fuzz: number } {
  const diffLines = normalizeDiffLines(diff)

  if (mode === 'create') {
    return { result: parseCreateDiff(diffLines), fuzz: 0 }
  }

  const { chunks, fuzz } = parseUpdateDiff(diffLines, input)
  return { result: applyChunks(input, chunks), fuzz }
}

export function isConsistentlyCrlf(input: string): boolean {
  const hasCrlf = /\r\n/.test(input)
  const hasBareLf = /(^|[^\r])\n/.test(input)
  return hasCrlf && !hasBareLf
}

export function preserveOriginalLineEndings(params: {
  original: string
  patched: string
}): string {
  const { original, patched } = params

  if (!isConsistentlyCrlf(original)) {
    return patched
  }

  return normalizeLineEndings(patched).replace(/\n/g, '\r\n')
}

export function buildPatchAttempts(
  oldContent: string,
  diff: string,
): PatchAttempt[] {
  const normalizedOld = normalizeLineEndings(oldContent)
  const normalizedDiff = normalizeLineEndings(diff)

  return [
    { name: 'codex_like', source: normalizedOld, diff: normalizedDiff },
    {
      name: 'with_trailing_newline',
      source: ensureTrailingNewline(normalizedOld),
      diff: normalizedDiff,
    },
    {
      name: 'without_trailing_newline',
      source: stripTrailingNewline(normalizedOld),
      diff: normalizedDiff,
    },
  ]
}

export function tryApplyPatchWithFallbacks(params: {
  oldContent: string
  diff: string
}): {
  patched: string | null
  attemptedStrategies: string[]
  lastError?: string
} {
  const attempts = buildPatchAttempts(params.oldContent, params.diff)
  const attemptedStrategies: string[] = []
  let lastError: string | undefined

  const seen = new Set<string>()

  for (const attempt of attempts) {
    const key = JSON.stringify({
      source: attempt.source,
      diff: attempt.diff,
    })

    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    attemptedStrategies.push(attempt.name)

    try {
      const { result: patched } = applyDiff(
        attempt.source,
        attempt.diff,
        'default',
      )

      if (patchHasIntendedChanges(attempt.diff) && patched === attempt.source) {
        lastError = 'Patch produced no content changes'
        continue
      }

      return {
        patched,
        attemptedStrategies,
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
  }

  return {
    patched: null,
    attemptedStrategies,
    ...(lastError ? { lastError } : {}),
  }
}

export function formatPatchFailureMessage(params: {
  path: string
  attemptedStrategies: string[]
  lastError?: string
  diagnosis?: string
}): string {
  const { path, attemptedStrategies, lastError, diagnosis } = params

  return [
    `Failed to apply patch to ${path}.`,
    attemptedStrategies.length > 0
      ? `Tried strategies: ${attemptedStrategies.join(', ')}.`
      : undefined,
    lastError ? `Last error: ${safePatchError(lastError)}.` : undefined,
    diagnosis,
    'Please re-read the file and generate a patch with exact context lines.',
  ]
    .filter(Boolean)
    .join(' ')
}
