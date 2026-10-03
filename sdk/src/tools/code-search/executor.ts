import { spawn } from 'child_process'
import * as fs from 'fs'
import { StringDecoder } from 'node:string_decoder'
import * as path from 'path'

import { classifyCodeSearchOutcome } from './anomaly'
import { parseSearchFlags } from './flags'
import {
  buildCloseOutput,
  buildLimitedOutput,
  buildPartialOutput,
} from './format'
import { RipgrepMatchCollector } from './match-collector'
import { INCLUDED_HIDDEN_DIRS } from './schema'
import { getBundledRgPath } from '../../native/ripgrep'

import type { SavantCodeToolOutput } from '../../../../common/src/tools/list'
import type { Logger } from '@savant-code/common/types/contracts/logger'

type CodeSearchResult =
  | { stdout: string; message: string; stderr?: string; exitCode?: number }
  | { errorMessage: string; stdout?: string; stderr?: string }

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

    const { flagsArray, extraSearchPaths } = parseSearchFlags(flags, logger)

    // JSON output for robust parsing + early stopping; --no-config keeps a
    // user .ripgreprc out; `--` stops a leading-'-' pattern parsing as a flag.
    // Search paths: '.' plus existing blessed hidden dirs (no stderr noise).
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
    // Decode across chunk boundaries so split UTF-8 characters remain intact.
    const stdoutDecoder = new StringDecoder('utf8')
    const stderrDecoder = new StringDecoder('utf8')

    let jsonRemainder = ''
    let stderrBuf = ''
    // Track matches by file for grouping and limiting
    const collector = new RipgrepMatchCollector(
      maxResults,
      globalMaxResults,
      maxOutputStringLength,
    )

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
      } catch {
        // Best-effort kill: an already-exited child is the expected outcome.
      }
      // Store timeout reference so it can be cleared if process closes normally
      killTimeoutId = setTimeout(() => {
        try {
          childProcess.kill('SIGKILL')
        } catch {
          // Best-effort escalation: the process may have exited between
          // signals — the fallback kill below shares that contract.
          try {
            childProcess.kill()
          } catch {
            // Same best-effort contract; nothing actionable remains.
          }
        }
        killTimeoutId = null
      }, 1000)
    }

    const onAbort = () => {
      if (isResolved) return
      hardKill()

      settle({
        stdout: buildPartialOutput(
          collector.fileGroups,
          collector.matchesGlobal,
          1000,
        ),
        message: 'Code search cancelled: the run was aborted by the user.',
      })
    }
    signal?.addEventListener('abort', onAbort, { once: true })

    const timeoutId = setTimeout(() => {
      if (isResolved) return
      hardKill()

      const truncatedStdout = buildPartialOutput(
        collector.fileGroups,
        collector.matchesGlobal,
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

    childProcess.stdout.on('data', (chunk: Buffer | string) => {
      if (isResolved) return
      const chunkStr =
        typeof chunk === 'string' ? chunk : stdoutDecoder.write(chunk)
      jsonRemainder += chunkStr

      // Split by lines; last line might be partial
      const lines = jsonRemainder.split('\n')
      jsonRemainder = lines.pop() || ''

      for (const line of lines) {
        if (!line) continue
        if (collector.addEventLine(line, 'stream') === 'limit-hit') {
          hardKill()

          const limited = buildLimitedOutput(
            collector.fileGroups,
            collector.matchesGlobal,
            globalMaxResults,
            maxOutputStringLength,
          )

          return settle(limited)
        }
      }
    })

    childProcess.stderr.on('data', (chunk: Buffer | string) => {
      if (isResolved) return
      const chunkStr =
        typeof chunk === 'string' ? chunk : stderrDecoder.write(chunk)
      // Keep stderr bounded during streaming
      const limit = Math.floor(maxOutputStringLength / 5)
      if (stderrBuf.length < limit) {
        const space = limit - stderrBuf.length
        stderrBuf += chunkStr.slice(0, space)
      }
    })

    childProcess.once('close', (code) => {
      if (isResolved) return

      // Flush any remaining JSON — possibly multiple complete lines
      // (FID-2026-1002-001: remainder flushing lives on the collector and
      // every dropped line is accounted, never silent).
      collector.flushRemainder(jsonRemainder + stdoutDecoder.end())

      const outcome = classifyCodeSearchOutcome({
        code,
        collected: collector.matchesGlobal,
        dropped: collector.droppedEventLines,
        firstDroppedLine: collector.firstDroppedLine,
        stderrBuf,
      })
      const closeOutput = buildCloseOutput({
        fileGroups: collector.fileGroups,
        filesLimitedByMaxResults: collector.filesLimitedByMaxResults,
        matchesGlobal: collector.matchesGlobal,
        killedForLimit: collector.killedForLimit,
        maxResults,
        globalMaxResults,
        maxOutputStringLength,
        stderrBuf,
        // FID-2026-1002-001 step 4: an anomalous run NEVER renders a
        // "Found 0 matches" line — the formatter renders the anomaly text.
        emptyResultText:
          outcome.kind === 'anomaly' ? outcome.emptyResultText : undefined,
      })

      if (outcome.kind === 'anomaly') {
        // The absence-shaped result is not trustworthy: settle through the
        // error channel carrying stderr and the drop count (step 3).
        settle({
          errorMessage: outcome.errorMessage,
          stdout: closeOutput.stdout,
          stderr: closeOutput.stderr,
        })
        return
      }

      settle({
        ...closeOutput,
        message:
          (code !== null
            ? `Exit code: ${code}${collector.killedForLimit ? ' (early stop)' : ''}`
            : '') +
          (outcome.kind === 'warning' ? ` — warning: ${outcome.message}` : ''),
      })
    })

    childProcess.once('error', (error) => {
      if (isResolved) return
      // FID-2026-0918-007: the message names the resolved path and the
      // workspace-correct repair command so a mid-session failure is
      // self-explanatory.
      settle({
        errorMessage: `Failed to execute ripgrep at "${rgPath}": ${error.message}. Repair with 'bun run --cwd=sdk fetch-ripgrep' or set SAVANT_CODE_RG_PATH.`,
      })
    })
  })
}
