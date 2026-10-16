import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { expect, test } from 'bun:test'

import { createWindowsCommandJob } from '../tools/windows-command-job'

test.skipIf(process.platform !== 'win32')(
  'a compiled SDK consumer can launch its contained command host',
  () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'compiled-command-host-'))
    try {
      const executable = path.join(root, 'consumer.exe')
      const build = spawnSync(
        process.execPath,
        [
          'build',
          '--compile',
          path.join(import.meta.dir, 'fixtures/terminal-job-compiled-host.ts'),
          '--outfile',
          executable,
        ],
        { encoding: 'utf8', timeout: 60000, windowsHide: true },
      )
      expect(build.status, build.stderr).toBe(0)
      const run = spawnSync(executable, [], {
        encoding: 'utf8',
        timeout: 20000,
        windowsHide: true,
      })
      expect(run.status, run.stderr).toBe(0)
      expect(run.stdout).toContain('"stdout":"compiled-command-host"')
      expect(run.stdout).toContain('"exitCode":0')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  },
  90000,
)

test.skipIf(process.platform !== 'win32')(
  'job admission rejects an invalid process and closes idempotently',
  () => {
    const job = createWindowsCommandJob()
    expect(job).toBeDefined()
    if (!job) return
    try {
      expect(() => job.attach(0)).toThrow('Could not open')
    } finally {
      job.close()
      job.close()
    }
    expect(job.terminate()).toBe(false)
  },
)
