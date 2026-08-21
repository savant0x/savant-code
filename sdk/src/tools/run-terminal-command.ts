import { spawn } from 'child_process'
import * as os from 'os'
import * as path from 'path'

import { BoundedOutputBuffer } from './bounded-output-buffer'
import {
  KILL_ESCALATION_MS,
  isProcessGroupAlive,
  killProcessGroup,
  registerLiveChild,
  unregisterLiveChild,
} from './child-process-registry'
import { createWindowsBashNotFoundError, findWindowsBash } from './windows-bash'
import { getSystemProcessEnv } from '../env'

import type { SavantCodeToolOutput } from '../../../common/src/tools/list'

export { BoundedOutputBuffer } from './bounded-output-buffer'
export {
  getActiveTerminalCommandProcesses,
  type ActiveTerminalCommandProcess,
} from './child-process-registry'

const COMMAND_OUTPUT_LIMIT = 50_000

export function runTerminalCommand({
  command,
  process_type,
  cwd,
  timeout_seconds,
  env,
  signal,
}: {
  command: string
  process_type: 'SYNC'
  cwd: string
  timeout_seconds: number
  env?: NodeJS.ProcessEnv
  signal?: AbortSignal
}): Promise<SavantCodeToolOutput<'run_terminal_command'>> {
  return new Promise((resolve, reject) => {
    const isWindows = os.platform() === 'win32'
    const processEnv = {
      ...getSystemProcessEnv(),
      ...(env ?? {}),
    } as NodeJS.ProcessEnv
    if (isWindows) {
      // Preserve other MSYS options while preventing Git Bash descendants from
      // allocating a ConPTY despite the detached/hidden process flags.
      processEnv.MSYS = [processEnv.MSYS, 'disable_pcon']
        .filter(Boolean)
        .join(' ')
    }

    if (signal?.aborted) {
      resolve([
        {
          type: 'json',
          value: {
            command,
            message: 'Command cancelled: the run was aborted by the user.',
          },
        },
      ])
      return
    }

    let shell: string
    let shellArgs: string[]

    if (isWindows) {
      const bashPath = findWindowsBash(processEnv)
      if (!bashPath) {
        reject(createWindowsBashNotFoundError())
        return
      }
      shell = bashPath
      shellArgs = ['-c']
    } else {
      shell = 'bash'
      shellArgs = ['-c']
    }

    // Resolve cwd to absolute path
    const resolvedCwd = path.resolve(cwd)

    const childProcess = spawn(shell, [...shellArgs, command], {
      cwd: resolvedCwd,
      env: processEnv,
      stdio: 'pipe',
      // Give the command its own process group so that killing it (timeout or
      // user abort) also kills any grandchild processes. On POSIX this uses a
      // negative pid kill against the process group. On Windows `detached: true`
      // maps to DETACHED_PROCESS, which combined with CREATE_NO_WINDOW (from
      // windowsHide) fully detaches the child from the parent's console.
      // Without DETACHED_PROCESS, console-attached descendants can open
      // CONIN$/CONOUT$ directly even when stdio is piped, stealing the VT input
      // that ConPTY generates for the TUI's mouse/focus tracking and echoing it
      // as gibberish like `^[[I^[[<35;12;7M` painted over the UI.
      detached: true,
      windowsHide: true,
    })

    registerLiveChild(childProcess)

    const stdout = new BoundedOutputBuffer(COMMAND_OUTPUT_LIMIT)
    const stderr = new BoundedOutputBuffer(COMMAND_OUTPUT_LIMIT)
    let timer: NodeJS.Timeout | null = null
    let sigkillTimer: NodeJS.Timeout | null = null
    let processFinished = false

    const killChildProcess = () => {
      killProcessGroup(childProcess, 'SIGTERM')
      // Escalate in case the command traps or ignores SIGTERM.
      sigkillTimer = setTimeout(() => {
        sigkillTimer = null
        if (isProcessGroupAlive(childProcess)) {
          killProcessGroup(childProcess, 'SIGKILL')
        }
        unregisterLiveChild(childProcess)
      }, KILL_ESCALATION_MS)
      sigkillTimer.unref?.()
    }

    const onAbort = () => {
      if (processFinished) return
      processFinished = true

      if (timer) {
        clearTimeout(timer)
      }
      killChildProcess()

      resolve([
        {
          type: 'json',
          value: {
            command,
            stdout: stdout.format(),
            ...(stderr.retainedLength > 0 ? { stderr: stderr.format() } : {}),
            message:
              'Command interrupted: the run was aborted by the user and the process was killed before it completed.',
          },
        },
      ])

      // The result is already settled; stop buffering output from a child
      // that may linger through the SIGTERM grace period.
      childProcess.stdout.destroy()
      childProcess.stderr.destroy()
    }
    signal?.addEventListener('abort', onAbort, { once: true })

    // Set up timeout if timeout_seconds >= 0 (infinite timeout when < 0)
    if (timeout_seconds >= 0) {
      timer = setTimeout(() => {
        if (!processFinished) {
          processFinished = true
          signal?.removeEventListener('abort', onAbort)
          killChildProcess()
          reject(
            new Error(`Command timed out after ${timeout_seconds} seconds`),
          )
        }
      }, timeout_seconds * 1000)
    }

    // Collect stdout
    childProcess.stdout.on('data', (data: Buffer) => {
      stdout.append(data.toString())
    })

    // Collect stderr
    childProcess.stderr.on('data', (data: Buffer) => {
      stderr.append(data.toString())
    })

    // Handle process completion
    childProcess.on('close', (exitCode) => {
      if (sigkillTimer) {
        // The shell can exit while a grandchild ignores SIGTERM. Keep both the
        // registry entry and escalation timer in that case so the process
        // group is still visible to diagnostics and receives SIGKILL.
        if (!isProcessGroupAlive(childProcess)) {
          clearTimeout(sigkillTimer)
          sigkillTimer = null
          unregisterLiveChild(childProcess)
        }
      } else {
        unregisterLiveChild(childProcess)
      }

      if (processFinished) return
      processFinished = true

      if (timer) {
        clearTimeout(timer)
      }
      signal?.removeEventListener('abort', onAbort)

      // Truncate stdout to prevent excessive output
      const truncatedStdout = stdout.format()
      const truncatedStderr = stderr.format()

      // Include stderr in stdout for compatibility with existing behavior
      const combinedOutput = {
        command,
        stdout: truncatedStdout,
        ...(truncatedStderr ? { stderr: truncatedStderr } : {}),
        ...(exitCode !== null ? { exitCode } : {}),
      }

      resolve([{ type: 'json', value: combinedOutput }])
    })

    // Handle spawn errors
    childProcess.on('error', (error) => {
      unregisterLiveChild(childProcess)

      if (processFinished) return
      processFinished = true

      if (timer) {
        clearTimeout(timer)
      }
      signal?.removeEventListener('abort', onAbort)

      reject(new Error(`Failed to spawn command: ${error.message}`))
    })
  })
}
