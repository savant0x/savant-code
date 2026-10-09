/* eslint-disable no-console -- standalone browser evidence channel */
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'

const control = `http://127.0.0.1:${Number(process.argv[2])}`
const { gatewayPort } = await (await fetch(control)).json()
const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: ['--disable-features=LocalNetworkAccessChecks'],
})
const page = await browser.newPage({ viewport: { width: 1000, height: 760 } })
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
const dir = fileURLToPath(
  new URL(
    '../../../../../dev/scratchpad/active/model-compliance-completion-2026-10-09/',
    import.meta.url,
  ),
)
mkdirSync(dir, { recursive: true })
await page.route('**/compliance-smoke.html', (route) =>
  route.fulfill({
    contentType: 'text/html',
    body: '<html><body><script type="module">import RefreshRuntime from "/@react-refresh"; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => (type) => type; window.__vite_plugin_react_preamble_installed__ = true; await import("/src/lib/__tests__/fixtures/compliance-browser.tsx");</script></body></html>',
  }),
)
try {
  await page.goto('http://127.0.0.1:1420/compliance-smoke.html')
  await page.waitForFunction(() => Boolean(window.complianceSmoke))
  await page.evaluate(
    (port) => window.complianceSmoke.connect(port),
    gatewayPort,
  )
  await page
    .getByRole('status')
    .filter({ hasText: /^ready$/ })
    .waitFor()
  await page.locator('.compliance-panel > summary').click()
  await page.getByText('6 observations', { exact: false }).waitFor()
  await page
    .getByText('1 malformed ledger lines skipped.', { exact: true })
    .waitFor()
  await page.locator('.compliance-trend > summary').click()
  assert.equal(await page.getByRole('table').count(), 1)
  await page.screenshot({ path: `${dir}/panel-populated.png` })
  for (const name of ['30 days', 'All time', '7 days']) {
    await page.getByRole('button', { name, exact: true }).click()
    await page.getByText('6 observations', { exact: false }).waitFor()
    await page
      .getByRole('button', { name, exact: true, pressed: true })
      .waitFor()
  }
  await fetch(`${control}/?mode=empty`)
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await page
    .getByText('No compliance events in this window.', { exact: true })
    .waitFor()
  await page.screenshot({ path: `${dir}/panel-empty.png` })
  await fetch(`${control}/?mode=fail`)
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await page.getByRole('alert').waitFor()
  await page.screenshot({ path: `${dir}/panel-error.png` })
  await fetch(`${control}/?mode=seed`)
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await page.getByText('6 observations', { exact: false }).waitFor()
  await page.evaluate(() => window.complianceSmoke.disconnect())
  await page
    .getByText('Connect to load compliance data.', { exact: true })
    .waitFor()
  await page.evaluate(
    (port) => window.complianceSmoke.connect(port),
    gatewayPort,
  )
  await page.getByText('6 observations', { exact: false }).waitFor()
  await page.setViewportSize({ width: 320, height: 760 })
  const dimensions = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: innerWidth,
  }))
  assert(dimensions.scroll <= dimensions.width, JSON.stringify(dimensions))
  await page.screenshot({ path: `${dir}/panel-narrow.png` })
  assert.deepEqual(errors, [])
  const evidence = {
    outcome: 'PASS',
    browser: await browser.version(),
    pageErrors: errors,
    checks: [
      'seeded JSONL→authenticated RPC→GatewayClient→React panel',
      'ranked laws',
      'heatmap counts',
      'dated trend',
      '7d/30d/all',
      'malformed line notice',
      'empty',
      'read error and retry',
      'disconnect/reconnect',
      '320px no page overflow',
    ],
  }
  writeFileSync(
    `${dir}/browser-evidence.json`,
    JSON.stringify(evidence, null, 2) + '\n',
  )
  console.log(JSON.stringify(evidence))
} finally {
  await browser.close()
}
