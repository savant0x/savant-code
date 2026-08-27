import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'

import { killProcessTree } from '../src/sandboxes/process-tree'
import { buildAllowlistedEnv, TempDirSandbox } from '../src/sandboxes/tempdir'

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

  it('teardown is idempotent (FID-2026-0824-015)', async () => {
    const dir = sandbox.getWorkingDir()
    await sandbox.teardown()
    await expect(sandbox.teardown()).resolves.toBeUndefined()
    expect(existsSync(dir)).toBe(false)
  })
})

describe('env allowlist (FID-2026-0824-015)', () => {
  let sandbox: TempDirSandbox

  beforeEach(async () => {
    sandbox = new TempDirSandbox({ prefix: 'bench-test-' })
    await sandbox.prepare()
  })

  afterEach(async () => {
    await sandbox.teardown()
  })

  it('strips host secrets not on the allowlist', () => {
    const base = {
      ...process.env,
      EVAL_SECRET_PROBE: 'leak-me',
    } as NodeJS.ProcessEnv
    const env = buildAllowlistedEnv(base)
    expect(env.EVAL_SECRET_PROBE).toBeUndefined()
    expect(env.PATH).toBeTruthy()
  })

  it('applies overrides last', () => {
    const env = buildAllowlistedEnv(process.env, { PATH: '/custom' })
    expect(env.PATH).toBe('/custom')
  })

  it('runCommand env excludes non-allowlisted host variables', async () => {
    const probeKey = 'EVAL_LEAK_PROBE_TOKEN'
    process.env[probeKey] = 'host-secret-value'
    try {
      const isWindows = process.platform === 'win32'
      const script = isWindows
        ? 'echo %EVAL_LEAK_PROBE_TOKEN%'
        : 'printf %s "$EVAL_LEAK_PROBE_TOKEN"'
      const result = await sandbox.runCommand(script, { shell: true })
      expect(result.stdout).not.toContain('host-secret-value')
    } finally {
      delete process.env[probeKey]
    }
  })
})

describe('bounded log capture (FID-2026-0824-015)', () => {
  let sandbox: TempDirSandbox

  beforeEach(async () => {
    sandbox = new TempDirSandbox({ prefix: 'bench-log-' })
    await sandbox.prepare()
  })

  afterEach(async () => {
    await sandbox.teardown()
  })

  it('writes a bounded log file with a truncation marker', async () => {
    const logPath = path.join(sandbox.getWorkingDir(), 'out.log')
    const result = await sandbox.runCommand(
      `bun -e "console.log('a'.repeat(300000))"`,
      { shell: true, logFile: logPath, maxLogBytes: 50_000 },
    )
    expect(result.exitCode).toBe(0)
    expect(existsSync(logPath)).toBe(true)
    const content = readFileSync(logPath, 'utf8')
    expect(Buffer.byteLength(content, 'utf8')).toBeLessThanOrEqual(60_000)
    expect(content).toContain('[truncated')
  })
})

describe('process-tree teardown (FID-2026-0824-015)', () => {
  let sandbox: TempDirSandbox

  beforeEach(async () => {
    sandbox = new TempDirSandbox({ prefix: 'bench-tree-' })
    await sandbox.prepare()
  })

  afterEach(async () => {
    await sandbox.teardown()
  })

  it('killProcessTree on a dead PID never throws and returns a boolean', async () => {
    const result = await killProcessTree(4_000_000_000)
    expect(typeof result).toBe('boolean')
  })

  it('times out with the whole tree dead — live orphan-process proof', async () => {
    if (process.platform !== 'win32') {
      console.log('skip: live orphan-process proof targets Windows')
      return
    }

    const pidFile = path.join(sandbox.getWorkingDir(), 'grandchild.pid')
    const command = `bun -e "require('fs').writeFileSync('grandchild.pid', String(process.pid)); setInterval(() => {}, 1000)"`

    const result = await sandbox.runCommand(command, {
      shell: true,
      timeout: 2_500,
    })
    expect(result.timedOut).toBe(true)

    // The capability-probed tree-kill must reap the long-lived process the
    // shell spawned — the old child.kill() left exactly this class orphaned.
    const pid = readFileSync(pidFile, 'utf8').trim()
    let alive = true
    for (let attempt = 0; attempt < 20 && alive; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 500))
      const check = await sandbox.runCommand(
        `tasklist /FI "PID eq ${pid}" /NH`,
        { shell: true },
      )
      alive = check.stdout.includes(pid)
    }
    expect(alive).toBe(false)
  }, 30_000)
})
