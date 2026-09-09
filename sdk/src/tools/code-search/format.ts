import { formatCodeSearchOutput } from '../../../../common/src/util/format-code-search'

/** Truncate an output string to a max length with an explicit truncation marker. */
export function truncateOutput(output: string, maxLength: number): string {
  return output.length > maxLength
    ? output.substring(0, maxLength) + '\n\n[Output truncated]'
    : output
}

/**
 * Build the partial collected output used by the abort and timeout settles
 * (and the close settle's stdout) — joins all collected lines, formats them,
 * and truncates to `maxLength`.
 */
export function buildPartialOutput(
  fileGroups: Map<string, string[]>,
  matchesGlobal: number,
  maxLength: number,
): string {
  const collectedLines: string[] = []
  for (const fileLines of fileGroups.values()) {
    collectedLines.push(...fileLines)
  }
  const partialOutput = collectedLines.join('\n')
  return truncateOutput(
    formatCodeSearchOutput(partialOutput, { matchCount: matchesGlobal }),
    maxLength,
  )
}

/** Build the stdout + message for the global-limit settle inside the data handler. */
export function buildLimitedOutput(
  fileGroups: Map<string, string[]>,
  matchesGlobal: number,
  globalMaxResults: number,
  maxOutputStringLength: number,
): { stdout: string; message: string } {
  const limitedLines: string[] = []
  for (const lines of fileGroups.values()) {
    limitedLines.push(...lines)
  }
  const rawOutput = limitedLines.join('\n')
  const finalOutput = truncateOutput(
    formatCodeSearchOutput(rawOutput, { matchCount: matchesGlobal }),
    maxOutputStringLength,
  )
  const limitReason =
    matchesGlobal >= globalMaxResults
      ? `[Global limit of ${globalMaxResults} results reached. Re-run with a narrower pattern, cwd, or -g globs; or pass globalMaxResults to raise this cap.]`
      : `[Output size limit reached (cap ${maxOutputStringLength} chars). Re-run with a narrower pattern, cwd, or -g globs; or pass maxOutputStringLength to raise this cap.]`
  return {
    stdout: finalOutput + '\n\n' + limitReason,
    message: `Stopped early after ${matchesGlobal} match(es).`,
  }
}

/** Build the final close settle output (stdout + optional stderr). */
export function buildCloseOutput({
  fileGroups,
  filesLimitedByMaxResults,
  matchesGlobal,
  killedForLimit,
  maxResults,
  globalMaxResults,
  maxOutputStringLength,
  stderrBuf,
}: {
  fileGroups: Map<string, string[]>
  filesLimitedByMaxResults: Set<string>
  matchesGlobal: number
  killedForLimit: boolean
  maxResults: number
  globalMaxResults: number
  maxOutputStringLength: number
  stderrBuf: string
}): { stdout: string; stderr?: string } {
  const limitedLines: string[] = []
  const truncatedFiles: string[] = []

  for (const [filename, fileLines] of fileGroups) {
    limitedLines.push(...fileLines)
    if (filesLimitedByMaxResults.has(filename)) {
      truncatedFiles.push(
        `${filename}: limited to ${maxResults} results per file`,
      )
    }
  }

  let rawOutput = limitedLines.join('\n')

  // Add truncation messages
  const truncationMessages: string[] = []
  if (truncatedFiles.length > 0) {
    truncationMessages.push(
      `Results limited to ${maxResults} per file (pass maxResults to raise). Truncated files:\n${truncatedFiles.join('\n')}`,
    )
  }
  if (killedForLimit) {
    truncationMessages.push(
      `Global limit of ${globalMaxResults} results reached (pass globalMaxResults to raise), or output size cap ${maxOutputStringLength} chars reached (pass maxOutputStringLength to raise). Re-run with a narrower pattern, cwd, or -g globs first.`,
    )
  }

  if (truncationMessages.length > 0) {
    rawOutput += `\n\n[${truncationMessages.join('\n\n')}]`
  }

  // Truncate output to prevent memory issues
  const truncatedStdout = truncateOutput(
    formatCodeSearchOutput(rawOutput, { matchCount: matchesGlobal }),
    maxOutputStringLength,
  )

  const truncatedStderr = stderrBuf
    ? stderrBuf +
      (stderrBuf.length >= Math.floor(maxOutputStringLength / 5)
        ? '\n\n[Error output truncated]'
        : '')
    : ''

  return {
    stdout: truncatedStdout,
    ...(truncatedStderr && { stderr: truncatedStderr }),
  }
}
