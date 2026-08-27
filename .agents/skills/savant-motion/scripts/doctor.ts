#!/usr/bin/env bun
/**
 * savant-motion preflight doctor.
 *
 * Checks, in order:
 *   1. Bun runtime version
 *   2. playwright-core resolvable from the current project (no monorepo dep)
 *   3. a usable Chromium binary behind that playwright-core
 *   4. workspace resolution + registry state
 *   5. engine templates present in the skill directory
 *
 * Exit codes: 0 all hard checks pass; 1 any hard check fails.
 * `--json` prints machine-readable results instead of the table.
 *
 * Usage: bun run .agents/skills/savant-motion/scripts/doctor.ts [--json]
 */
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

import { resolveWorkspace } from './workspace.ts'

interface CheckResult {
  name: string
  ok: boolean
  hard: boolean
  detail: string
}

interface PlaywrightModule {
  chromium: { executablePath(): string }
}

function checkRuntime(): CheckResult {
  const version =
    typeof process.versions.bun === 'string' ? process.versions.bun : 'unknown'
  return {
    name: 'bun runtime',
    ok: version !== 'unknown',
    hard: true,
    detail: `bun ${version}`,
  }
}

export function resolvePlaywright(cwd: string): string | undefined {
  const bases = [cwd]
  let current = path.resolve(cwd)
  for (;;) {
    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
    bases.push(current)
  }
  for (const base of bases) {
    try {
      return createRequire(path.join(base, 'index.js')).resolve(
        'playwright-core',
      )
    } catch {
      // keep walking up; report failure after the loop
    }
  }
  return undefined
}

function checkPlaywright(cwd: string): CheckResult {
  const resolved = resolvePlaywright(cwd)
  return {
    name: 'playwright-core',
    ok: resolved !== undefined,
    hard: true,
    detail:
      resolved ??
      'not resolvable — run `bun add playwright-core` (or npm i playwright-core) in your project',
  }
}

function checkChromium(cwd: string): CheckResult {
  const resolved = resolvePlaywright(cwd)
  if (resolved === undefined) {
    return {
      name: 'chromium binary',
      ok: false,
      hard: false,
      detail: 'skipped (playwright-core absent)',
    }
  }
  try {
    const pw = createRequire(resolved)('playwright-core') as PlaywrightModule
    const exe = pw.chromium.executablePath()
    const present = existsSync(exe)
    return {
      name: 'chromium binary',
      ok: present,
      hard: false,
      detail: present
        ? exe
        : `${exe} (missing — run \`bunx playwright install chromium\`)`,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { name: 'chromium binary', ok: false, hard: false, detail: message }
  }
}

function checkWorkspace(cwd: string): CheckResult {
  const ws = resolveWorkspace(cwd)
  const seeded = existsSync(ws.registryPath)
  return {
    name: 'workspace',
    ok: true,
    hard: false,
    detail: `${ws.root}${seeded ? '' : ' (registry absent — run workspace.ts --ensure)'}`,
  }
}

function checkEngineTemplates(): CheckResult {
  const engineFile = path.join(
    import.meta.dir,
    '..',
    'templates',
    'engine',
    'savant-motion.js',
  )
  const cssFile = path.join(
    import.meta.dir,
    '..',
    'templates',
    'engine',
    'savant-motion.css',
  )
  const ok = existsSync(engineFile) && existsSync(cssFile)
  return {
    name: 'engine templates',
    ok,
    hard: false,
    detail: ok
      ? path.dirname(engineFile)
      : `${path.dirname(engineFile)} missing savant-motion.js/css`,
  }
}

function main(): void {
  const cwd = process.cwd()
  const checks = [
    checkRuntime(),
    checkPlaywright(cwd),
    checkChromium(cwd),
    checkWorkspace(cwd),
    checkEngineTemplates(),
  ]
  if (process.argv.slice(2).includes('--json')) {
    console.log(
      JSON.stringify({ checks, pass: checks.every((c) => c.ok || !c.hard) }),
    )
  } else {
    for (const c of checks) {
      console.log(
        `${c.ok ? 'ok  ' : c.hard ? 'FAIL' : 'warn'} ${c.name}: ${c.detail}`,
      )
    }
  }
  process.exit(checks.every((c) => c.ok || !c.hard) ? 0 : 1)
}

if (import.meta.main) main()
