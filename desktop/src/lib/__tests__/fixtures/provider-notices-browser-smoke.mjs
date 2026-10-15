/* eslint-disable no-console -- standalone node smoke script; console is its JSON result channel */
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'

const controlPort = Number(process.argv[2])
assert(Number.isInteger(controlPort) && controlPort > 0)
const control = `http://127.0.0.1:${controlPort}`
const initial = await (await fetch(control)).json()
const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: ['--disable-features=LocalNetworkAccessChecks'],
})
const page = await browser.newPage({ viewport: { width: 1000, height: 720 } })
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (event) => {
  if (event.type() === 'error') console.log(event.text())
})
await page.route('**/provider-smoke.html', (route) =>
  route.fulfill({
    contentType: 'text/html',
    body: '<html><body><script type="module">import RefreshRuntime from "/@react-refresh"; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => (type) => type; window.__vite_plugin_react_preamble_installed__ = true; await import("/src/lib/__tests__/fixtures/provider-notices-browser.tsx");</script></body></html>',
  }),
)
try {
  await page.goto('http://127.0.0.1:1420/provider-smoke.html')
  await page.waitForFunction(() => Boolean(window.providerSmoke))
  await page.evaluate(
    (port) => window.providerSmoke.connect(port),
    initial.gatewayPort,
  )
  await page
    .getByRole('status')
    .filter({ hasText: 'ready' })
    .waitFor({ timeout: 10_000 })
    .catch(async (error) => {
      console.log(await page.locator('body').innerText())
      throw error
    })
  const first = page
    .getByRole('article', { name: 'fixture health-down' })
    .filter({ hasText: 'Fixture endpoint unavailable' })
  await first.waitFor({ timeout: 10_000 }).catch(async (error) => {
    console.log(await page.locator('body').innerText())
    throw error
  })
  await page.waitForFunction(() => window.providerSmoke.unread() >= 1)
  const transcriptSize = await page.evaluate(() =>
    window.providerSmoke.transcriptSize(),
  )
  assert.equal(transcriptSize, 0)
  await first.getByRole('button', { name: 'Mark read' }).click()
  await page.waitForFunction(() => window.providerSmoke.unread() === 1)
  let state = await (await fetch(control)).json()
  assert.equal(
    state.snapshot.notices.find(
      (n) => n.message === 'Fixture endpoint unavailable',
    ).unread,
    false,
  )
  await first.getByRole('button', { name: 'Dismiss' }).click()
  await first.waitFor({ state: 'detached' })
  state = await (await fetch(control)).json()
  assert.equal(
    state.snapshot.notices.find(
      (n) => n.message === 'Fixture endpoint unavailable',
    ).dismissed,
    true,
  )
  await page.evaluate(() => window.providerSmoke.disconnect())
  await page.getByRole('status').filter({ hasText: 'offline' }).waitFor()
  await fetch(control, { method: 'POST' })
  await page.evaluate(
    (port) => window.providerSmoke.connect(port),
    initial.gatewayPort,
  )
  const recovered = page
    .getByRole('article', { name: 'fixture health-down' })
    .filter({ hasText: 'Fixture warning created while disconnected' })
  await recovered.waitFor()
  assert.equal(await recovered.count(), 1)
  assert.equal(
    await page.evaluate(() => window.providerSmoke.transcriptSize()),
    transcriptSize,
  )
  await page.getByRole('button', { name: /Provider notifications/ }).click()
  const dir = fileURLToPath(
    new URL('../../../../../dev/session-summaries/', import.meta.url),
  )
  mkdirSync(dir, { recursive: true })
  await page.screenshot({
    path: `${dir}/2026-10-03-free-provider-desktop-smoke.png`,
  })
  assert.deepEqual(errors, [])
  console.log(
    JSON.stringify({
      outcome: 'PASS',
      browser: await browser.version(),
      checks: [
        'hello capability',
        'snapshot',
        'read',
        'dismiss',
        'disconnect/reconnect',
        'replay dedup',
        'transcript isolation',
      ],
      pageErrors: errors,
    }),
  )
} finally {
  if (errors.length) console.log(JSON.stringify({ pageErrors: errors }))
  await browser.close()
}
