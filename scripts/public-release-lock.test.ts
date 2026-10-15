// Public release contract — release lock lifecycle. Sibling of the
// FID-2026-0819-005 Loop 317 decomposition.

import { spawnSync } from 'child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import os from 'os'
import path from 'path'

import { describe, expect, test } from 'bun:test'

import { acquireReleaseLock, releaseLockPath } from './public-release'

describe('public release contract — lock', () => {
  test('rejects a live-owner lock and releases it for the next process', () => {
    const version = '9.9.9'
    const lockPath = releaseLockPath(version)
    let release: (() => void) | undefined
    try {
      release = acquireReleaseLock(version, 'test')
      // P1-A (FID-2026-0821-002): the lock dir carries a release-in-progress
      // marker as a signal to concurrent sessions, removed with the lock.
      expect(existsSync(path.join(lockPath, 'IN-PROGRESS.md'))).toBe(true)
      expect(() => acquireReleaseLock(version, 'test')).toThrow(
        'owns the release lock',
      )
      release()
      release = undefined
      expect(existsSync(lockPath)).toBe(false)
      release = acquireReleaseLock(version, 'test')
    } finally {
      release?.()
      rmSync(lockPath, { recursive: true, force: true })
    }
  })

  test('recovers a stale lock only with valid owner metadata and a dead PID', () => {
    const version = '8.8.8'
    const lockPath = releaseLockPath(version)
    const dead = spawnSync(process.execPath, ['-e', ''], { encoding: 'utf8' })
    const deadPid = dead.pid
    expect(deadPid).toBeGreaterThan(0)
    try {
      mkdirSync(lockPath)
      writeFileSync(
        path.join(lockPath, 'owner.json'),
        JSON.stringify({
          pid: deadPid,
          host: os.hostname(),
          startedAt: new Date().toISOString(),
          ownerToken: 'stale-token',
          version,
          mode: 'test',
        }),
      )
      let release: (() => void) | undefined
      try {
        release = acquireReleaseLock(version, 'test')
      } finally {
        release?.()
      }
    } finally {
      rmSync(lockPath, { recursive: true, force: true })
    }
  })

  test('refuses locks whose owner evidence cannot be safely classified', () => {
    const version = '7.7.7'
    const lockPath = releaseLockPath(version)
    try {
      mkdirSync(lockPath)
      expect(() => acquireReleaseLock(version, 'test')).toThrow(
        'owner evidence is missing',
      )
      writeFileSync(
        path.join(lockPath, 'owner.json'),
        JSON.stringify({ pid: 1 }),
      )
      expect(() => acquireReleaseLock(version, 'test')).toThrow(
        'cannot be safely classified',
      )
    } finally {
      rmSync(lockPath, { recursive: true, force: true })
    }
  })
})
