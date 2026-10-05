import { spawn } from 'child_process'
import * as fs from 'fs'
import { StringDecoder } from 'node:string_decoder'
import * as path from 'path'

import { createEscalatingKill } from './child-kill'
import { settleOnClose, type CodeSearchResult } from './close-payload'
import { parseSearchFlags } from './flags'
import { buildLimitedOutput, buildPartialOutput } from './format'
import { RipgrepMatchCollector } from './match-collector'
import { INCLUDED_HIDDEN_DIRS } from './schema'
import { getBundledRgPath } from '../../native/ripgrep'

import type { SavantCodeToolOutput } from '../../../../common/src/tools/list'
import type { Logger } from '@savant-code/common/types/contracts/logger'

/**
 * True when `p` exists and is a directory.
 *
 * FID-2026-1004-006: deliberately total — a `statSync` that throws means "not
 * a directory", because a path that does not exist is also not a directory and
 * both must be rejected before they reach `spawn` (which reports either case
 * as an ENOENT naming the executable).
 */
function isExistingDirectory(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory()
  } catch {
    return false
  }
}

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

    // FID-2026-1004-006 (A)+(C-1): `uv_spawn` rejects a non-directory `cwd` and
    // reports the failure against the EXECUTABLE, so a file path — and equally a
    // path that does not exist — surfaces as an ENOENT naming the ripgrep
    // binary and prescribing `fetch-ripgrep`, a remedy that cannot apply.
    // Measured (dev/scratchpad/active/enoent-cwd-probe.ts): directory cwd
    // spawns; file cwd and non-existent cwd both return the identical ENOENT.
    // Measure the search directory here and name the real offending path.
    if (!isExistingDirectory(searchCwd)) {
      return resolve([
        {
          type: 'json',
          value: {
            stdout: '',
            message:
              `Code search failed: the search path is not a directory: ` +
              `"${searchCwd}". Pass a directory path, or omit \`cwd\` to ` +
              `search the project root.`,
          },
        },
      ])
    }

    const { flagsArray, extraSearchPaths } = parseSearchFlags(flags, logger)

    // JSON output for robust parsing + early stopping; --no-config keeps a
    // user .ripgreprc out; `--` stops a leading-'-' pattern parsing as a flag.
    // Search paths: '.' plus existing blessed hidden dirs (no stderr noise).
    const existingHiddenDirs = INCLUDED_HIDDEN_DIRS.filter((dir) =>
      isExistingDirectory(path.join(searchCwd, dir)),
    )
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
    const escalatingKill = createEscalatingKill(childProcess)
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

    const settle = (payload: CodeSearchResult) => {
      if (isResolved) return
      isResolved = true

      // Clean up listeners immediately to prevent further events
      childProcess.stdout.removeAllListeners()
      childProcess.stderr.removeAllListeners()
      childProcess.removeAllListeners()
      signal?.removeEventListener('abort', onAbort)

      // Clear both the main timeout and any pending kill escalation to
      // prevent late callbacks.
      clearTimeout(timeoutId)
      escalatingKill.dispose()

      resolve([{ type: 'json', value: payload }])
    }

    const onAbort = () => {
      if (isResolved) return
      escalatingKill.terminate()

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
      escalatingKill.terminate()

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
          escalatingKill.terminate()

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
      settle(
        settleOnClose({
          childExitCode: code,
          collector,
          remainingStdout: jsonRemainder + stdoutDecoder.end(),
          stderrBuf,
          maxResults,
          globalMaxResults,
          maxOutputStringLength,
        }),
      )
    })

    childProcess.once('error', (error) => {
      if (isResolved) return
      // FID-2026-0918-007: the message names the resolved path and the
      // workspace-correct repair command so a mid-session failure is
      // self-explanatory.
      // FID-2026-1004-006 (A): that remedy is only truthful when the
      // executable is genuinely absent — which is now decidable, because the
      // search directory has already been proven to be a directory above. A
      // bad `cwd` can no longer reach this branch, so ENOENT here really does
      // mean "ripgrep is not where we resolved it".
      const remedy =
        (error as NodeJS.ErrnoException).code === 'ENOENT'
          ? " Repair with 'bun run --cwd=sdk fetch-ripgrep' or set SAVANT_CODE_RG_PATH."
          : ''
      settle({
        errorMessage: `Failed to execute ripgrep at "${rgPath}": ${error.message}.${remedy}`,
      })
    })
  })
}
