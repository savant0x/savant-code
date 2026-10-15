// FID-2026-0913-004 — pre-audit check family C: config-dir integrity. Guards
// against the FID-2026-0913-003 damage class: a test run reaching the real
// `~/.savant-code/` and writing test fakes over operator credentials.

import { spawnSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import os from 'os'
import path from 'path'

import type { AuditFinding, CheckResult } from './audit-types'

/** Values a test run would have written into the real credentials store. */
export function isTestFakeValue(value: string): boolean {
  return value.startsWith('test-') || value === 'stored-key'
}

export function findTestFakesInRecord(record: unknown): string[] {
  const fakes: string[] = []
  const walk = (node: unknown, pathSoFar: string): void => {
    if (node === null || typeof node !== 'object') return
    for (const [key, value] of Object.entries(
      node as Record<string, unknown>,
    )) {
      const nextPath = pathSoFar ? `${pathSoFar}.${key}` : key
      if (typeof value === 'string') {
        if (isTestFakeValue(value)) fakes.push(`${nextPath}=<test fake>`)
      } else if (value && typeof value === 'object') {
        walk(value, nextPath)
      }
    }
  }
  walk(record, '')
  return fakes
}

export function checkConfigDirUnpolluted(): CheckResult {
  const findings: AuditFinding[] = []
  const home = os.homedir()
  for (const dirName of ['.savant-code-dev', '.savant-code']) {
    const credentialsPath = path.join(home, dirName, 'credentials.json')
    if (!existsSync(credentialsPath)) continue
    try {
      const record: unknown = JSON.parse(readFileSync(credentialsPath, 'utf8'))
      const fakes = findTestFakesInRecord(record)
      if (fakes.length > 0) {
        findings.push({
          check: 'config-dir-unpolluted',
          severity: 'block',
          message: `${credentialsPath} contains test-fake credential values (${fakes.slice(0, 5).join(', ')}${fakes.length > 5 ? ` +${fakes.length - 5}` : ''}) — a test run wrote into the real config dir (FID-2026-0913-003 class). Restore the real keys before releasing.`,
        })
      }
    } catch {
      findings.push({
        check: 'config-dir-unpolluted',
        severity: 'warn',
        message: `${credentialsPath} is unreadable JSON — inspect it manually`,
      })
    }
  }
  return { findings, fixes: [] }
}

/** The config-dir isolation canary must pass from the repo root. */
export function checkConfigDirIsolation(root: string): CheckResult {
  const spawned = spawnSync(
    process.execPath,
    ['test', 'scripts/probes/config-dir-isolation.test.ts'],
    { cwd: root, encoding: 'utf8', windowsHide: true, shell: false },
  )
  if (spawned.status === 0) return { findings: [], fixes: [] }
  return {
    findings: [
      {
        check: 'config-dir-isolation',
        severity: 'block',
        message: `the config-dir isolation canary failed (exit ${spawned.status}) — test runs may reach the real config dir again (FID-2026-0913-003 regression). Output: ${String(spawned.stderr ?? spawned.stdout ?? '').slice(-400)}`,
      },
    ],
    fixes: [],
  }
}
