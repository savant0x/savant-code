/**
 * FID-2026-0807-020 D2: Code Universe `file://` interactive contract suite.
 *
 * Every network request is aborted globally — if the artifact ever tries to
 * fetch a font, library, or telemetry pixel, the test fails. The graph must
 * still initialize WebGL, search must work, and the console must stay clean.
 */
import { execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

import { expect, test } from '@playwright/test'

const specDir = path.dirname(fileURLToPath(import.meta.url))

/**
 * Resolve the bun executable for the fixture subprocess. Playwright's worker
 * runs under node, so bun must be located explicitly: the npm-global layout
 * (Windows), the official installer layout (BUN_INSTALL / ~/.bun), and PATH.
 */
function bunExecutable(): string {
  const candidates: string[] = []
  if (process.execPath && /bun/i.test(process.execPath)) {
    candidates.push(process.execPath)
  }
  const isWin = process.platform === 'win32'
  const binName = isWin ? 'bun.exe' : 'bun'
  if (process.env.BUN_INSTALL) {
    candidates.push(path.join(process.env.BUN_INSTALL, 'bin', binName))
  }
  if (process.env.APPDATA) {
    candidates.push(
      path.join(
        process.env.APPDATA,
        'npm',
        'node_modules',
        'bun',
        'bin',
        binName,
      ),
    )
  }
  candidates.push(path.join(os.homedir(), '.bun', 'bin', binName))
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  for (const candidate of ['bun', 'bun.exe']) {
    try {
      execFileSync(candidate, ['--version'], { stdio: 'ignore' })
      return candidate
    } catch {
      // try the next candidate
    }
  }
  throw new Error(
    'bun executable not found (process.execPath=' + process.execPath + ')',
  )
}

let artifactPath: string

test.beforeAll(() => {
  // The artifact is generated in a plain `bun` subprocess: the CLI template
  // imports graphology with ESM named exports that only bun's resolver
  // handles correctly, so the fixture must never be built inside Playwright's
  // own module loader.
  const generator = path.join(specDir, 'fixture-generator.ts')
  const out = execFileSync(bunExecutable(), ['run', generator], {
    cwd: path.join(specDir, '..'),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  artifactPath = out.trim().split(/\r?\n/).pop() ?? ''
  if (!artifactPath || !artifactPath.endsWith('.html')) {
    throw new Error('fixture generator did not emit an artifact path: ' + out)
  }
})

test('file:// export: zero network, WebGL init, search, clean console', async ({
  page,
}) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  const networkAttempts: string[] = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => pageErrors.push(String(err)))
  await page.route('**/*', (route) => {
    const url = route.request().url()
    if (url.startsWith('file://')) {
      // The artifact itself loads from disk; anything external is blocked.
      route.continue()
      return
    }
    networkAttempts.push(url)
    route.abort()
  })

  await page.goto(pathToFileURL(artifactPath).href)
  // Sigma mounts its WebGL <canvas> inside the container div.
  await page.waitForSelector('#sigma-container canvas', {
    state: 'visible',
    timeout: 15_000,
  })

  // The graph canvas paints and the shell is interactive.
  await expect(page.locator('.universe-shell')).toBeVisible()
  await expect(page.locator('.universe-search input')).toBeVisible()

  // '/' focuses the search input; typing yields live ranked results.
  await page.keyboard.press('/')
  await page.keyboard.type('a.ts')
  const results = page.locator('#search-results .search-row')
  await expect(results.first()).toBeVisible({ timeout: 5_000 })
  await expect(page.locator('#search-results')).toContainText('src/a.ts')

  // Enter navigates to the file without errors.
  await page.keyboard.press('Enter')
  await expect(page.locator('.center-focus')).toBeVisible()

  // Staged Escape: first press keeps panels/state consistent and errors out
  // cleanly regardless of which panel owns focus.
  await page.keyboard.press('Escape')

  // The zero-network invariant must hold: any request attempt is a failure.
  expect(
    networkAttempts,
    'network attempts: ' + networkAttempts.join(', '),
  ).toEqual([])
  expect(consoleErrors, 'console errors: ' + consoleErrors.join(' | ')).toEqual(
    [],
  )
  expect(pageErrors, 'page errors: ' + pageErrors.join(' | ')).toEqual([])
})
