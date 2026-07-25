import { spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

import { z } from 'zod/v4'

import { formatCodeSearchOutput } from '../../../common/src/util/format-code-search'
import { getBundledRgPath } from '../native/ripgrep'

import type { SavantCodeToolOutput } from '../../../common/src/tools/list'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { JSONValue } from '@savant-code/common/types/json'

type CodeSearchResult =
  | { stdout: string; message: string; stderr?: string; exitCode?: number }
  | { errorMessage: string; stdout?: string; stderr?: string }

const ripgrepEventSchema = z.object({
  type: z.enum(['match', 'context']),
  data: z.object({
    path: z.object({
      text: z.string().optional(),
      bytes: z.string().optional(),
    }).optional(),
    line_number: z.number().optional(),
    lines: z.object({
      text: z.string().optional(),
    }).optional(),
  }),
})

type RipgrepEvent = z.infer<typeof ripgrepEventSchema>

function parseRipgrepEventLine(line: string): RipgrepEvent | null {
  let parsed: JSONValue
  try {
    parsed = JSON.parse(line) as JSONValue
  } catch {
    return null
  }
  const result = ripgrepEventSchema.safeParse(parsed)
  return result.success ? result.data : null
}

// Hidden directories to include in code search by default.
// These are searched in addition to '.' to ensure important config/workflow files are discoverable.
const INCLUDED_HIDDEN_DIRS = [
  '.agents', // SavantCode agent definitions
  '.claude', // Claude settings
  '.github', // GitHub Actions, workflows, issue templates
  '.gitlab', // GitLab CI configuration
  '.circleci', // CircleCI configuration
  '.husky', // Git hooks
]

export function codeSearch({
  projectPath,
  pattern,
  flags,
  cwd,
  maxResults = 15,
  globalMaxResults = 250,
  maxOutputStringLength = 20_000,
  timeoutSeconds = 10,
  logger,
  signal,
}: {
  projectPath: string
  pattern: string
  flags?: string
  cwd?: string
  maxResults?: number
  globalMaxResults?: number
  maxOutputStringLength?: number
  timeoutSeconds?: number
  logger?: Logger
  /** External abort (e.g. user interrupt); kills the ripgrep process. */
  signal?: AbortSignal
}): Promise<SavantCodeToolOutput<'code_search'>> {
  return new Promise((resolve) => {
    let isResolved = false

    // Resolve the search directory: absolute `cwd` is honored as-is, relative
    // `cwd` is resolved against the project root. Searches may target any
    // directory on the system.
    const projectRoot = path.resolve(projectPath)
    const searchCwd = cwd ? path.resolve(projectRoot, cwd) : projectRoot

    // Parse flags - do NOT deduplicate to preserve flag-argument pairs like '-g *.ts'
    // Deduplicating would break up these pairs and cause errors
    // Strip surrounding quotes from each token since spawn() passes args directly
    // without shell interpretation (e.g. "'foo.md'" → "foo.md")
    const rawFlagsArray = (flags || '')
      .split(' ')
      .filter(Boolean)
      .map((token) => token.replace(/^['"]|['"]$/g, ''))

    // FID-076: Validate flagsArray — separate actual flags from positional arguments.
    // Agents sometimes misuse `flags` for directory filtering (e.g., "cli/src -g '*.ts'").
    // Non-flag arguments (not starting with '-') break ripgrep's argument structure
    // on Windows, causing patterns to be treated as filenames.
    const flagsArray: string[] = []
    const extraSearchPaths: string[] = []
    let prevWasFlag = false
    for (const token of rawFlagsArray) {
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
          '--no-config', '-n', '--json', '-i', '-l', '-c', '--count',
          '--files-with-matches', '--files-without-match', '-h', '--help',
          '--version', '-v', '--invert-match', '--no-filename',
          '--no-line-number', '--no-messages', '--no-heading',
          '--with-filename', '--heading', '--hidden', '--no-ignore',
          '-u', '--unrestricted', '--binary', '--crlf', '--no-unicode',
        ].includes(token)
        prevWasFlag = !isBooleanFlag && !token.includes('=')
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

    // Use JSON output for robust parsing and early stopping
    // --no-config prevents user/system .ripgreprc from interfering
    // -n shows line numbers
    // --json outputs in JSON format, which streams in and allows us to cut off the output if it grows too long
    // "--"" prevents pattern from being misparsed as a flag (e.g., pattern starting with '-')
    // Search paths: '.' plus blessed hidden directories that actually exist
    // Filter out non-existent directories to avoid ripgrep stderr errors
    const existingHiddenDirs = INCLUDED_HIDDEN_DIRS.filter((dir) => {
      try {
        return fs.statSync(path.join(searchCwd, dir)).isDirectory()
      } catch {
        return false
      }
    })
    // FID-076: Extra search paths from non-flag arguments in flagsArray
    const searchPaths = ['.', ...extraSearchPaths, ...existingHiddenDirs]
    const args = [
      '--no-config',
      '-n',
      '--json',
      ...flagsArray,
      '--',
      pattern,
      ...searchPaths,
    ]

    if (signal?.aborted) {
      return resolve([
        {
          type: 'json',
          value: {
            stdout: '',
            message: 'Code search cancelled: the run was aborted by the user.',
          },
        },
      ])
    }

    const rgPath = getBundledRgPath(import.meta.url)
    if (logger) {
      logger.info(
        { rgPath, args, searchCwd },
        'code-search: Spawning ripgrep process',
      )
    }
    const childProcess = spawn(rgPath, args, {
      cwd: searchCwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let jsonRemainder = ''
    let stderrBuf = ''
    // Track matches by file for grouping and limiting
    const fileGroups = new Map<string, string[]>()
    // Track match count per file separately from total lines
    const fileMatchCounts = new Map<string, number>()
    const filesLimitedByMaxResults = new Set<string>()
    let matchesGlobal = 0
    let estimatedOutputLen = 0
    let killedForLimit = false

    // Guard to prevent double-settlement from concurrent timeout and process close events
    let killTimeoutId: ReturnType<typeof setTimeout> | null = null

    const settle = (payload: CodeSearchResult) => {
      if (isResolved) return
      isResolved = true

      // Clean up listeners immediately to prevent further events
      childProcess.stdout.removeAllListeners()
      childProcess.stderr.removeAllListeners()
      childProcess.removeAllListeners()
      signal?.removeEventListener('abort', onAbort)

      // Clear both the main timeout and the kill timeout to prevent late callbacks
      clearTimeout(timeoutId)
      if (killTimeoutId) {
        clearTimeout(killTimeoutId)
        killTimeoutId = null
      }

      resolve([{ type: 'json', value: payload }])
    }

    const hardKill = () => {
      try {
        childProcess.kill('SIGTERM')
      } catch {}
      // Store timeout reference so it can be cleared if process closes normally
      killTimeoutId = setTimeout(() => {
        try {
          childProcess.kill('SIGKILL')
        } catch {
          try {
            childProcess.kill()
          } catch {}
        }
        killTimeoutId = null
      }, 1000)
    }

    const formatCollectedOutput = (rawOutput: string) =>
      formatCodeSearchOutput(rawOutput, {
        matchCount: matchesGlobal,
      })

    const truncateOutput = (output: string, maxLength: number) =>
      output.length > maxLength
        ? output.substring(0, maxLength) + '\n\n[Output truncated]'
        : output

    const onAbort = () => {
      if (isResolved) return
      hardKill()

      const collectedLines: string[] = []
      for (const fileLines of fileGroups.values()) {
        collectedLines.push(...fileLines)
      }
      const partialOutput = collectedLines.join('\n')

      settle({
        stdout: truncateOutput(formatCollectedOutput(partialOutput), 1000),
        message: 'Code search cancelled: the run was aborted by the user.',
      })
    }
    signal?.addEventListener('abort', onAbort, { once: true })

    const timeoutId = setTimeout(() => {
      if (isResolved) return
      hardKill()

      // Build output from collected matches
      const collectedLines: string[] = []
      for (const fileLines of fileGroups.values()) {
        collectedLines.push(...fileLines)
      }
      const partialOutput = collectedLines.join('\n')

      const truncatedStdout = truncateOutput(
        formatCollectedOutput(partialOutput),
        1000,
      )
      const truncatedStderr =
        stderrBuf.length > 1000
          ? stderrBuf.substring(0, 1000) + '\n\n[Error output truncated]'
          : stderrBuf

      settle({
        errorMessage: `Code search timed out after ${timeoutSeconds} seconds. The search may be too broad or the pattern too complex. Try narrowing your search with more specific flags or a more specific pattern.`,
        stdout: truncatedStdout,
        stderr: truncatedStderr,
      })
    }, timeoutSeconds * 1000)

    // Parse ripgrep JSON for early stopping
    childProcess.stdout.on('data', (chunk: Buffer | string) => {
      if (isResolved) return
      const chunkStr =
        typeof chunk === 'string' ? chunk : chunk.toString('utf8')
      jsonRemainder += chunkStr

      // Split by lines; last line might be partial
      const lines = jsonRemainder.split('\n')
      jsonRemainder = lines.pop() || ''

      for (const line of lines) {
        if (!line) continue
        const evt = parseRipgrepEventLine(line)
        if (!evt) {
          continue
        }

        // Process both match and context events
        if (evt.type === 'match' || evt.type === 'context') {
          // Handle both text and bytes for non-UTF8 paths
          const filePath = evt.data.path?.text ?? evt.data.path?.bytes ?? ''
          const lineNumber = evt.data.line_number ?? 0
          // Strip trailing newlines to prevent blank lines in output
          const rawText = evt.data.lines?.text ?? ''
          const lineText = rawText.replace(/\r?\n$/, '')

          // Format as ripgrep output: filename:line_number:content
          const formattedLine = `${filePath}:${lineNumber}:${lineText}`

          // Group by file
          if (!fileGroups.has(filePath)) {
            fileGroups.set(filePath, [])
            fileMatchCounts.set(filePath, 0)
          }
          const fileLines = fileGroups.get(filePath)!
          const fileMatchCount = fileMatchCounts.get(filePath)!

          // Only count matches toward limits, not context lines
          const isMatch = evt.type === 'match'

          // Check if we should include this line
          // For matches: only if we haven't hit the per-file limit
          // For context: always include (they don't count toward limit)
          const shouldInclude = !isMatch || fileMatchCount < maxResults
          if (isMatch && !shouldInclude) {
            filesLimitedByMaxResults.add(filePath)
          }

          if (shouldInclude) {
            // Add the line to output
            fileLines.push(formattedLine)
            estimatedOutputLen += formattedLine.length + 1

            // Only increment match counters for actual matches
            if (isMatch) {
              fileMatchCounts.set(filePath, fileMatchCount + 1)
              matchesGlobal++

              // Check global limit or output size limit
              if (
                matchesGlobal >= globalMaxResults ||
                estimatedOutputLen >= maxOutputStringLength
              ) {
                killedForLimit = true
                hardKill()

                // Build final output from collected matches
                const limitedLines: string[] = []
                for (const lines of fileGroups.values()) {
                  limitedLines.push(...lines)
                }
                const rawOutput = limitedLines.join('\n')
                const finalOutput = truncateOutput(
                  formatCollectedOutput(rawOutput),
                  maxOutputStringLength,
                )

                const limitReason =
                  matchesGlobal >= globalMaxResults
                    ? `[Global limit of ${globalMaxResults} results reached.]`
                    : '[Output size limit reached.]'

                return settle({
                  stdout: finalOutput + '\n\n' + limitReason,
                  message: `Stopped early after ${matchesGlobal} match(es).`,
                })
              }
            }
          }
        }
      }
    })

    childProcess.stderr.on('data', (chunk: Buffer | string) => {
      if (isResolved) return
      const chunkStr =
        typeof chunk === 'string' ? chunk : chunk.toString('utf8')
      // Keep stderr bounded during streaming
      const limit = Math.floor(maxOutputStringLength / 5)
      if (stderrBuf.length < limit) {
        const space = limit - stderrBuf.length
        stderrBuf += chunkStr.slice(0, space)
      }
    })

    childProcess.once('close', (code) => {
      if (isResolved) return

      // Flush any remaining JSON - handle multiple complete lines
      try {
        if (jsonRemainder) {
          // Ensure we have a trailing newline for split to work correctly
          const maybeMany = jsonRemainder.endsWith('\n')
            ? jsonRemainder
            : jsonRemainder + '\n'
          for (const ln of maybeMany.split('\n')) {
            if (!ln) continue
            try {
              const evt = parseRipgrepEventLine(ln)
              if (evt) {
                const filePath =
                  evt.data.path?.text ?? evt.data.path?.bytes ?? ''
                const lineNumber = evt.data.line_number ?? 0
                const rawText = evt.data.lines?.text ?? ''
                const lineText = rawText.replace(/\r?\n$/, '')
                const formattedLine = `${filePath}:${lineNumber}:${lineText}`

                if (!fileGroups.has(filePath)) {
                  fileGroups.set(filePath, [])
                  fileMatchCounts.set(filePath, 0)
                }
                const fileLines = fileGroups.get(filePath)!
                const fileMatchCount = fileMatchCounts.get(filePath)!
                const isMatch = evt.type === 'match'

                // Check if we should include this line
                const shouldInclude =
                  !isMatch ||
                  (fileMatchCount < maxResults &&
                    matchesGlobal < globalMaxResults)
                if (
                  isMatch &&
                  fileMatchCount >= maxResults &&
                  matchesGlobal < globalMaxResults
                ) {
                  filesLimitedByMaxResults.add(filePath)
                }

                if (shouldInclude) {
                  fileLines.push(formattedLine)

                  // Only increment match counter for actual matches
                  if (isMatch) {
                    fileMatchCounts.set(filePath, fileMatchCount + 1)
                    matchesGlobal++
                  }
                }
              }
            } catch {}
          }
        }
      } catch {}

      // Build final output from collected matches
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
          `Results limited to ${maxResults} per file. Truncated files:\n${truncatedFiles.join('\n')}`,
        )
      }
      if (killedForLimit) {
        truncationMessages.push(
          `Global limit of ${globalMaxResults} results reached.`,
        )
      }

      if (truncationMessages.length > 0) {
        rawOutput += `\n\n[${truncationMessages.join('\n\n')}]`
      }

      // Truncate output to prevent memory issues
      const truncatedStdout = truncateOutput(
        formatCollectedOutput(rawOutput),
        maxOutputStringLength,
      )

      const truncatedStderr = stderrBuf
        ? stderrBuf +
          (stderrBuf.length >= Math.floor(maxOutputStringLength / 5)
            ? '\n\n[Error output truncated]'
            : '')
        : ''

      settle({
        stdout: truncatedStdout,
        ...(truncatedStderr && { stderr: truncatedStderr }),
        message:
          code !== null
            ? `Exit code: ${code}${killedForLimit ? ' (early stop)' : ''}`
            : '',
      })
    })

    childProcess.once('error', (error) => {
      if (isResolved) return
      settle({
        errorMessage: `Failed to execute ripgrep: ${error.message}. Vendored ripgrep not found; ensure @savant-code/sdk is up-to-date or set SAVANT_CODE_RG_PATH.`,
      })
    })
  })
}
