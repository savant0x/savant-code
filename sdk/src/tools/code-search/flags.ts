import type { Logger } from '@savant-code/common/types/contracts/logger'

/**
 * Parse the `flags` parameter into a ripgrep argv fragment plus any stray
 * non-flag arguments. Do NOT deduplicate flags: deduplicating would break up
 * flag-argument pairs like `-g *.ts`. Surrounding quotes are stripped since
 * spawn() passes args directly without shell interpretation.
 *
 * FID-076: agents sometimes misuse `flags` for directory filtering
 * (e.g. "cli/src -g '*.ts'"). Non-flag arguments (not starting with '-') break
 * ripgrep's argument structure on Windows, causing patterns to be treated as
 * filenames — so they are moved to `extraSearchPaths` instead.
 *
 * FID-2026-1012-019: two structural shapes are dropped rather than passed
 * through, because the caller appends its own `--` terminator before the
 * pattern. A model-supplied `--` ("unrecognized flag `--`" / exit 2 once the
 * duplicate terminator shifts the pattern) and a trailing value-taking flag
 * with no value (its value would silently become the wrapper's `--`) both
 * change the search without saying so. Dropping them preserves the caller's
 * intent and cannot introduce an argument ripgrep did not already receive.
 */
export function parseSearchFlags(
  flags: string | undefined,
  logger?: Logger,
): { flagsArray: string[]; extraSearchPaths: string[] } {
  const rawFlagsArray = (flags || '')
    .split(' ')
    .filter(Boolean)
    .map((token) => token.replace(/^['"]|['"]$/g, ''))

  const flagsArray: string[] = []
  const extraSearchPaths: string[] = []
  let prevWasFlag = false
  for (let i = 0; i < rawFlagsArray.length; i++) {
    const token = rawFlagsArray[i]!
    if (token === '--') {
      // FID-2026-1012-019: the terminator is added by the caller.
      if (logger) {
        logger.warn(
          { flags },
          'code-search: the `--` flag terminator is added by the tool itself and was dropped from the flags parameter.',
        )
      }
      continue
    }
    if (prevWasFlag) {
      // Previous token was a flag — this token is its value (e.g., -g *.ts, -A 2)
      // Defensive: treat any non-"-" token after a flag as its value,
      // regardless of whether the flag is in a known list.
      flagsArray.push(token)
      prevWasFlag = false
      continue
    }
    if (token.startsWith('-')) {
      flagsArray.push(token)
      // Heuristic: flags that are NOT boolean (i.e., take a value argument)
      // typically have a longer form or are followed by a non-"-" token.
      // We conservatively assume the next token is a value if the flag is
      // single-char with a value or a long flag without '='.
      const isBooleanFlag = [
        '--no-config',
        '-n',
        '--json',
        '-i',
        '-l',
        '-c',
        '--count',
        '--files-with-matches',
        '--files-without-match',
        '-h',
        '--help',
        '--version',
        '-v',
        '--invert-match',
        '--no-filename',
        '--no-line-number',
        '--no-messages',
        '--no-heading',
        '--with-filename',
        '--heading',
        '--hidden',
        '--no-ignore',
        '-u',
        '--unrestricted',
        '--binary',
        '--crlf',
        '--no-unicode',
      ].includes(token)
      prevWasFlag = !isBooleanFlag && !token.includes('=')
      if (prevWasFlag && i === rawFlagsArray.length - 1) {
        // FID-2026-1012-019: a value-taking flag with no value would take the
        // caller's `--` as its value and silently change the search.
        flagsArray.pop()
        prevWasFlag = false
        if (logger) {
          logger.warn(
            { flags, token },
            'code-search: a flag expecting a value was given none and was dropped; pass its value or remove the flag.',
          )
        }
      }
    } else {
      // Non-flag argument — likely a directory path misuse. Move to search paths.
      extraSearchPaths.push(token)
      if (logger) {
        logger.warn(
          { token, flags },
          'code-search: Non-flag argument in flags parameter moved to search paths. Use the cwd parameter instead for directory filtering.',
        )
      }
    }
  }
  return { flagsArray, extraSearchPaths }
}
