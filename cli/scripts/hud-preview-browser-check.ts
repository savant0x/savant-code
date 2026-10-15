import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { chromium } from 'playwright'

const fixtureDir = join(process.cwd(), '../dev/fixtures')
console.log('Launching local Chrome for design verification')
const browser = await chromium.launch({
  timeout: 15000,
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
})
const evidence: Array<{
  design: string
  loadedImages: number
  smallestIcon: number
  foldedWidth: number
}> = []
try {
  const page = await browser.newPage({
    viewport: { width: 1500, height: 1150 },
    reducedMotion: 'reduce',
  })
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  console.log('Chrome ready; loading comparison artifact')
  await page.goto(
    pathToFileURL(join(fixtureDir, 'sidebar-hud-comparison.html')).href,
  )
  page.setDefaultTimeout(10000)
  for (const design of ['circuit', 'observatory', 'matrix']) {
    await page.locator(`[data-target="${design}"]`).click()
    const panel = page.locator(`#${design}`)
    await panel.waitFor({ state: 'visible' })
    const images = await panel
      .locator('img[data-source]')
      .evaluateAll((elements) =>
        elements.map((element) => {
          const image = element as HTMLImageElement
          const rect = image.getBoundingClientRect()
          return {
            loaded: image.complete && image.naturalWidth > 0,
            width: rect.width,
            height: rect.height,
            visible: rect.width > 0,
          }
        }),
      )
    assert(
      images.every((image) => image.loaded),
      `${design}: missing SVG image`,
    )
    const visibleImages = images.filter((image) => image.visible)
    assert(
      visibleImages.length >= 25,
      `${design}: insufficient original artwork coverage`,
    )
    assert(
      visibleImages.every((image) => image.width >= 24 && image.height >= 24),
      `${design}: tiny unreadable icon`,
    )
    assert.equal(await panel.locator('.traffic i').count(), 3)
    const details = panel.locator('[data-section="Active agents"]')
    await details.locator('summary').click()
    assert.equal(await details.getAttribute('open'), null)
    await panel.locator('.fold-button').click()
    await page.waitForFunction((id) => {
      const sidebar = document.querySelector(`#${id} .sidebar`)
      return sidebar !== null && sidebar.getBoundingClientRect().width <= 120
    }, design)
    const foldedWidth = await panel
      .locator('.sidebar')
      .evaluate((element) => element.getBoundingClientRect().width)
    assert(foldedWidth <= 120)
    await panel.screenshot({
      path: join(fixtureDir, `sidebar-hud-${design}-folded.png`),
    })
    await panel.locator('.fold-button').click()
    assert.equal(
      await details.getAttribute('open'),
      null,
      `${design}: section state lost after unfolding`,
    )
    await details.locator('summary').focus()
    await page.keyboard.press('Enter')
    assert.notEqual(
      await details.getAttribute('open'),
      null,
      `${design}: keyboard section fold failed`,
    )
    await panel.locator('.fold-button').focus()
    await page.keyboard.press('Enter')
    await panel.locator('[data-reveal="History"]').click()
    assert.equal(
      await panel
        .locator('.sidebar')
        .evaluate((element) => element.classList.contains('folded')),
      false,
    )
    assert.notEqual(
      await panel.locator('[data-section="History"]').getAttribute('open'),
      null,
    )
    await panel.locator('[data-section="History"] summary').click()
    await panel.screenshot({
      path: join(fixtureDir, `sidebar-hud-${design}.png`),
    })
    evidence.push({
      design,
      loadedImages: images.length,
      smallestIcon: Math.min(...visibleImages.map((image) => image.width)),
      foldedWidth,
    })
  }
  await page.setViewportSize({ width: 640, height: 1000 })
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    'Narrow report overflows horizontally',
  )
  assert.deepEqual(errors, [], 'Browser errors')
  await writeFile(
    join(fixtureDir, 'sidebar-hud-browser-evidence.json'),
    JSON.stringify(
      {
        kind: 'browser design-mockup verification, not terminal acceptance',
        evidence,
        narrowWidth: 640,
        horizontalOverflow: false,
        browserErrors: errors,
      },
      null,
      2,
    ),
  )
  console.log(JSON.stringify(evidence, null, 2))
  console.log(
    'PASS: original SVGs loaded; folding, keyboard, rail navigation, traffic lights and narrow layout verified.',
  )
} finally {
  await browser.close()
}
