/**
 * Types + section markers for the apply_patch tool (FID-2026-0805-003).
 * Extracted from apply-patch.ts verbatim.
 */

import type { SavantCodeToolOutput } from '@savant-code/common/tools/list'

export type ApplyPatchResult = SavantCodeToolOutput<'apply_patch'>
export type ApplyPatchJson = ApplyPatchResult[number] & { type: 'json' }
export type PatchAction = 'add' | 'delete' | 'update'
export type DiffMode = 'default' | 'create'

export type Chunk = {
  origIndex: number
  delLines: string[]
  insLines: string[]
}

export type ParserState = {
  lines: string[]
  index: number
  fuzz: number
}

export type PatchAttempt = {
  name: string
  source: string
  diff: string
}

export const END_PATCH = '*** End Patch'
export const END_FILE = '*** End of File'
export const END_SECTION_MARKERS = [
  END_PATCH,
  '*** Update File:',
  '*** Delete File:',
  '*** Add File:',
  END_FILE,
]

export const SECTION_TERMINATORS = [
  END_PATCH,
  '*** Update File:',
  '*** Delete File:',
  '*** Add File:',
]
