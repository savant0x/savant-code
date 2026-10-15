import { spawnSync, type SpawnSyncOptions } from 'child_process'

export const VERBOSE = process.env.VERBOSE === 'true'
export const OVERRIDE_TARGET = process.env.OVERRIDE_TARGET
export const OVERRIDE_PLATFORM = process.env.OVERRIDE_PLATFORM as
  NodeJS.Platform | undefined
export const OVERRIDE_ARCH = process.env.OVERRIDE_ARCH ?? undefined
export const OVERRIDE_COMPILE_EXECUTABLE_PATH =
  process.env.BUN_COMPILE_EXECUTABLE_PATH

export function log(message: string): void {
  if (VERBOSE) console.log(message)
}

export function logAlways(message: string): void {
  console.log(message)
}

export function getBunExecutable(): string {
  if (process.execPath && !process.execPath.endsWith('node')) {
    return process.execPath
  }
  return 'bun'
}

export function runCommand(
  command: string,
  args: string[],
  options: SpawnSyncOptions = {},
): void {
  const executable = command === 'bun' ? getBunExecutable() : command
  const result = spawnSync(executable, args, {
    cwd: options.cwd,
    stdio: VERBOSE ? 'inherit' : 'pipe',
    env: options.env,
  })

  if (result.status !== 0) {
    const stderr = result.stderr?.toString() ?? ''
    const failure = result.error
      ? `${result.error.message}`
      : result.signal
        ? `signal ${result.signal}`
        : result.status === null
          ? 'exited without a status (null)'
          : `exit code ${result.status}`
    throw new Error(
      `Command "${command} ${args.join(' ')}" failed: ${failure}${
        stderr ? `\n${stderr}` : ''
      }`,
    )
  }
}
