/**
 * Diff string helpers for the apply_patch tool (FID-2026-0805-003). Extracted
 * from apply-patch/parser.ts verbatim.
 */

export function normalizeLineEndings(input: string): string {
  return input.replace(/\r\n/g, '\n')
}

export function ensureTrailingNewline(input: string): string {
  return input.endsWith('\n') ? input : `${input}\n`
}

export function stripTrailingNewline(input: string): string {
  return input.endsWith('\n') ? input.slice(0, -1) : input
}

export function sanitizeUnifiedDiff(rawDiff: string): string {
  const diffFenceMatch = rawDiff.match(/```diff\r?\n([\s\S]*?)\r?\n```/i)
  if (diffFenceMatch) {
    return diffFenceMatch[1]!
  }

  const trimmed = rawDiff.trim()
  const fencedMatch = trimmed.match(
    /^```(?:[a-zA-Z0-9_-]+)?\r?\n([\s\S]*?)\r?\n```$/,
  )
  if (fencedMatch) {
    return fencedMatch[1]!
  }

  return rawDiff
}

export function patchHasIntendedChanges(diff: string): boolean {
  return normalizeLineEndings(diff)
    .split('\n')
    .some((line) => {
      if (line.startsWith('+++') || line.startsWith('---')) {
        return false
      }

      return line.startsWith('+') || line.startsWith('-')
    })
}
