import { constants as osConstants } from 'node:os'

import {
  diagnoseMissingEdit,
  renderMissingEditDiagnosis,
} from '@savant-code/agent-runtime/edit-diagnostics'
import { READ_FILES_MAX_CHARS } from '@savant-code/common/constants/read-files'

import { normalizeDiffLines, readSection } from './apply-patch/parser'

const MAX_CONTEXT_LINES = 32
const SYSTEM_ERROR_CODES = new Set(Object.keys(osConstants.errno))

/** Only a bounded context sample is inspected; it never changes the patch. */
export function diagnosePatchFailure(content: string, diff: string): string {
  try {
    const lines = normalizeDiffLines(diff.slice(0, READ_FILES_MAX_CHARS))
    const header = lines.findIndex((line) => line.startsWith('@@'))
    if (header < 0)
      return 'No patch hunk was found. Generate a patch with exact context.'
    const { nextContext } = readSection(lines, header + 1)
    const diagnosis = diagnoseMissingEdit({
      content: content.slice(0, READ_FILES_MAX_CHARS),
      oldStr: nextContext.slice(0, MAX_CONTEXT_LINES).join('\n'),
    })
    return (
      'Inspected first-hunk context sample (bounded file prefix):\n' +
      renderMissingEditDiagnosis(diagnosis)
    )
  } catch {
    return 'Patch context could not be inspected. Re-read the file and correct the patch format.'
  }
}

/** Filesystem codes are metadata; raw exception messages can contain payloads. */
export function filesystemErrorCode<T>(error: T): string {
  if (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string' &&
    SYSTEM_ERROR_CODES.has(error.code)
  )
    return error.code
  return 'unknown'
}

/** Parser exceptions embed user lines; classify them without echoing those lines. */
export function safePatchError<T>(error: T): string {
  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : ''
  if (/^Invalid (?:EOF )?Context/.test(message))
    return 'Patch context did not match the file'
  if (/^Invalid Add File Line:/.test(message))
    return 'Invalid added-line format'
  if (/^Invalid Line:/.test(message)) return 'Invalid patch line format'
  if (/^Nothing in this section/.test(message))
    return 'Patch hunk contains no changes'
  if (message === 'Patch produced no content changes') return message
  const code = filesystemErrorCode(error)
  return code === 'unknown'
    ? 'Patch could not be parsed or applied'
    : `Filesystem operation failed (${code}); check the path and permissions`
}
