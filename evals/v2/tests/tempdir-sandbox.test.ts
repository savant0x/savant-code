import { existsSync } from 'node:fs'

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'

import { TempDirSandbox } from '../src/sandboxes/tempdir'

describe('TempDirSandbox', () => {
  let sandbox: TempDirSandbox

  beforeEach(async () => {
    sandbox = new TempDirSandbox({ prefix: 'bench-test-' })
    await sandbox.prepare()
  })

  afterEach(async () => {
    await sandbox.teardown()
  })

  it('creates a working directory that exists', () => {
    const dir = sandbox.getWorkingDir()
    expect(dir).toBeTruthy()
    expect(existsSync(dir)).toBe(true)
  })

  it('runs a simple command and captures stdout', async () => {
    const isWindows = process.platform === 'win32'
    const result = await sandbox.runCommand(
      isWindows ? 'echo hello' : 'printf hello',
      {
        shell: true,
      },
    )
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('hello')
  })

  it('captures stderr on failed commands', async () => {
    const result = await sandbox.runCommand('this_command_should_not_exist', {
      shell: true,
    })
    expect(result.exitCode).not.toBe(0)
  })

  it('removes the directory on teardown', async () => {
    const dir = sandbox.getWorkingDir()
    await sandbox.teardown()
    expect(existsSync(dir)).toBe(false)
  })
})
