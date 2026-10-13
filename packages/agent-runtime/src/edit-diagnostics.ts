/**
 * Edit-path diagnosis (FID-2026-1012-020).
 *
 * `str_replace`'s mismatch message told the model *that* the old string was not
 * found and then prescribed "try again with a different old string" — asking it
 * to guess which part of its own request was wrong. This module turns the
 * mismatch into evidence: the decidable cause, and the closest line that *did*
 * match, bounded so the diagnostic never becomes a body dump.
 *
 * Pure and side-effect free: it is a function of the file content the tool
 * already read and the request it was given.
 */

/** The decidable causes of a missing edit target. */
export type MissingEditClassification =
  /** A line of the request appears verbatim: the surrounding block differs. */
  | 'partial-line-match'
  /** Every non-whitespace character occurs, but no contiguous block matches. */
  | 'whitespace-only-difference'
  /** No line of the request appears anywhere in the file. */
  | 'no-near-match'

export interface MissingEditDiagnosis {
  classification: MissingEditClassification
  /** 1-based line number of the closest verbatim line, when there is one. */
  candidateLine?: number
  /** That line, trimmed and bounded — evidence, never the whole body. */
  candidateText?: string
  fileLines: number
  fileChars: number
}

/** Longest candidate line reported. One bounded line, never a body dump. */
export const MAX_DIAGNOSTIC_SNIPPET = 200

function bound(text: string, maxChars: number): string {
  return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text
}

/**
 * Locate the closest evidence for a target that did not match. Only lines the
 * request itself contains are ever reported, so the diagnosis cannot widen what
 * the session already read.
 */
export function diagnoseMissingEdit(params: {
  content: string
  oldStr: string
  maxSnippet?: number
}): MissingEditDiagnosis {
  const { content, oldStr, maxSnippet = MAX_DIAGNOSTIC_SNIPPET } = params
  const lines = content.split('\n')
  const fileLines = lines.length
  const fileChars = content.length

  const requestedLines = oldStr
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)

  for (const requested of requestedLines) {
    const index = lines.findIndex((line) => line.trim() === requested)
    if (index >= 0) {
      return {
        classification: 'partial-line-match',
        candidateLine: index + 1,
        candidateText: bound(lines[index]!.trim(), maxSnippet),
        fileLines,
        fileChars,
      }
    }
  }

  const stripWhitespace = (value: string) => value.replace(/\s+/g, '')
  const requestedNoWhitespace = stripWhitespace(oldStr)
  if (
    requestedNoWhitespace.length > 0 &&
    stripWhitespace(content).includes(requestedNoWhitespace)
  ) {
    return {
      classification: 'whitespace-only-difference',
      fileLines,
      fileChars,
    }
  }

  return { classification: 'no-near-match', fileLines, fileChars }
}

const CLASSIFICATION_TEXT: Readonly<Record<MissingEditClassification, string>> =
  {
    'partial-line-match':
      'a line of your old string appears verbatim in the file, so the block around it differs — indentation, blank lines, or content you have not read',
    'whitespace-only-difference':
      'every non-whitespace character of your old string occurs in the file, but no contiguous block matches — the difference is whitespace or line wrapping',
    'no-near-match':
      'no line of your old string appears anywhere in the file — the target is absent, or the file changed since you read it',
  }

/** The evidence block appended after the stable mismatch line. */
export function renderMissingEditDiagnosis(
  diagnosis: MissingEditDiagnosis,
): string {
  const parts = [`Why: ${CLASSIFICATION_TEXT[diagnosis.classification]}.`]
  if (diagnosis.candidateLine !== undefined) {
    parts.push(
      `Closest line ${diagnosis.candidateLine}: "${
        diagnosis.candidateText ?? ''
      }"`,
    )
  }
  parts.push(
    `The file is ${diagnosis.fileLines.toLocaleString('en-US')} lines / ` +
      `${diagnosis.fileChars.toLocaleString('en-US')} chars. Re-read the region ` +
      'you are editing with read_files offset/limit, then retry with the exact ' +
      'text you saw — do not resend the same old string.',
  )
  return parts.join('\n')
}
