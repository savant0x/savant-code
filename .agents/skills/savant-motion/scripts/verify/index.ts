/**
 * savant-motion verification harness entrypoint.
 *
 * Serves the build directory over localhost, walks every scroll position in a
 * headless browser, and emits strictly-typed JSON evidence:
 *
 *   - dead-scroll zones (identical raster while scroll advanced)
 *   - cues that never reach opacity 1 at their viewport-center moment
 *   - WCAG 2.1 AA contrast graded on composited raster pixels at each text
 *     line's brightest background frame
 *   - reduced-motion static readability
 *   - page console errors
 *
 * Usage:
 *   bun run .agents/skills/savant-motion/scripts/verify/index.ts --dir <buildDir>
 *        [--out <verifyDir>] [--name <build>] [--width 1440] [--height 900]
 *        [--step 400] [--self-test]
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

import {
  assertCueOpacity,
  checkReducedMotion,
  discoverActs,
  findDeadScroll,
  walkAndCapture,
  type CapturedFrame,
  type CueFailure,
  type DeadScrollViolation,
  type ReducedMotionFailure,
} from './assertions.ts'
import {
  contrastRatio,
  evaluateFrameContrast,
  relativeLuminance,
  requiredRatio,
  type ContrastFailure,
} from './contrast.ts'
import { resolvePlaywright } from '../doctor.ts'
import { decodePng } from './png.ts'
import { startStaticServer } from './server.ts'

interface Evidence {
  schemaVersion: number
  build: string
  url: string
  channel: string
  viewport: { width: number; height: number }
  generatedAt: string
  metrics: {
    positions: number
    acts: number
    deadScroll: DeadScrollViolation[]
    cueFailures: CueFailure[]
    contrastFailures: ContrastFailure[]
    reducedMotionFailures: ReducedMotionFailure[]
    consoleErrors: string[]
  }
  violations: number
}

interface BrowserLauncher {
  chromium: {
    launch(options: Record<string, unknown>): Promise<{
      newPage(): Promise<PageLike>
      close(): Promise<void>
    }>
  }
}

interface PageLike {
  goto(url: string): Promise<unknown>
  on(event: string, handler: (payload: unknown) => void): void
  evaluate<T>(fn: () => T): Promise<T>
  close(): Promise<void>
}

function selfTest(): boolean {
  const white = relativeLuminance(255, 255, 255)
  const black = relativeLuminance(0, 0, 0)
  const rgba = new Uint8Array(40 * 40 * 4)
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = 128
    rgba[i + 1] = 128
    rgba[i + 2] = 128
    rgba[i + 3] = 255
  }
  const frame = { width: 40, height: 40, rgba }
  const failures = evaluateFrameContrast(frame, [
    {
      id: 'probe',
      colorRgb: [255, 255, 255],
      largeText: false,
      rect: { x: 10, y: 10, width: 20, height: 10 },
    },
  ])
  const expectedRatio = contrastRatio(white, relativeLuminance(128, 128, 128))
  const checks: Array<[boolean, string]> = [
    [white === 1 && black === 0, 'luminance anchors exact'],
    [
      Math.abs(contrastRatio(white, black) - 21) < 0.01,
      'white-on-black ratio is 21',
    ],
    [
      failures.length === 1 &&
        failures[0] !== undefined &&
        Math.abs(failures[0].ratio - Math.round(expectedRatio * 100) / 100) <
          0.01,
      'gray-band failure ratio matches math',
    ],
    [
      requiredRatio(false) === 4.5 && requiredRatio(true) === 3,
      'AA thresholds pinned',
    ],
  ]
  let ok = true
  for (const [condition, label] of checks) {
    console.log(`${condition ? 'ok' : 'FAIL'} ${label}`)
    ok = ok && condition
  }
  return ok
}

function flag(args: string[], name: string, fallback: string): string {
  const index = args.indexOf(name)
  if (index >= 0 && index + 1 < args.length) return args[index + 1] ?? fallback
  return fallback
}

function numericFlag(args: string[], name: string, fallback: number): number {
  const raw = flag(args, name, '')
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

async function launchBrowser(
  cwd: string,
): Promise<{ launcher: BrowserLauncher; channel: string }> {
  const resolved = resolvePlaywright(cwd)
  if (resolved === undefined) {
    throw new Error(
      'playwright-core is not resolvable — run `bun add playwright-core` first',
    )
  }
  const pw = createRequire(resolved)('playwright-core') as BrowserLauncher
  try {
    await pw.chromium
      .launch({ channel: 'chrome', headless: true })
      .then((b) => b.close())
    return { launcher: pw, channel: 'chrome' }
  } catch {
    return { launcher: pw, channel: 'chromium-fallback' }
  }
}

function worstContrastPerBox(frames: CapturedFrame[]): ContrastFailure[] {
  const worst = new Map<string, ContrastFailure>()
  for (const frame of frames) {
    let decoded
    try {
      decoded = decodePng(frame.png)
    } catch (error) {
      console.warn(
        `frame decode failed at scrollY=${frame.scrollY}: ${String(error)}`,
      )
      continue
    }
    for (const failure of evaluateFrameContrast(decoded, frame.boxes)) {
      const existing = worst.get(failure.id)
      if (existing === undefined || failure.ratio > existing.ratio)
        worst.set(failure.id, failure)
    }
  }
  return [...worst.values()]
}

async function main(): Promise<number> {
  const args = process.argv.slice(2)
  if (args.includes('--self-test')) return selfTest() ? 0 : 1
  const dir = path.resolve(flag(args, '--dir', process.cwd()))
  const buildName = flag(args, '--name', path.basename(dir))
  const width = numericFlag(args, '--width', 1440)
  const height = numericFlag(args, '--height', 900)
  const step = numericFlag(args, '--step', 400)

  const outArgIndex = args.indexOf('--out')
  const outDir =
    outArgIndex >= 0 && outArgIndex + 1 < args.length
      ? path.resolve(args[outArgIndex + 1] ?? dir)
      : path.join(path.dirname(dir), 'verify', buildName)
  mkdirSync(outDir, { recursive: true })
  mkdirSync(path.join(outDir, 'shots'), { recursive: true })

  const { launcher, channel } = await launchBrowser(process.cwd())
  const server = await startStaticServer(dir)
  const url = `http://127.0.0.1:${server.port}/`
  const consoleErrors: string[] = []
  const browser = await launcher.chromium.launch({
    channel: channel === 'chrome' ? 'chrome' : undefined,
    headless: true,
  })
  const skipped: string[] = []
  if (channel !== 'chrome') {
    skipped.push('video-scrub decode metrics (bundled chromium lacks h264)')
  }
  try {
    const page = await browser.newPage()
    page.on('pageerror', (error) => {
      consoleErrors.push(`pageerror: ${String(error)}`)
    })
    page.on('console', (message) => {
      if ((message as { type?: string })?.type === 'error') {
        consoleErrors.push(`console.error: ${String(message)}`)
      }
    })
    await page.setViewportSize({ width, height })
    await page.goto(url)
    const acts = await discoverActs(page as unknown as PageLike)
    const docHeight = await (page as unknown as PageLike).evaluate(() =>
      Math.ceil(document.documentElement.scrollHeight),
    )
    const positions: number[] = []
    for (let y = 0; y <= docHeight; y += step) positions.push(y)
    const frames = await walkAndCapture(page, positions)
    const cueFailures = await assertCueOpacity(page)
    const reducedMotionFailures = await checkReducedMotion(page)
    const deadScroll = findDeadScroll(frames)
    const contrastFailures = worstContrastPerBox(frames)

    for (let i = 0; i < frames.length; i += 1) {
      const shotPath = path.join(
        outDir,
        'shots',
        `${String(i).padStart(3, '0')}-y${frames[i]?.scrollY ?? 0}.png`,
      )
      writeFileSync(shotPath, frames[i]?.png ?? new Uint8Array())
    }
    const evidence: Evidence = {
      schemaVersion: 1,
      build: buildName,
      url,
      channel,
      viewport: { width, height },
      generatedAt: new Date().toISOString(),
      metrics: {
        positions: frames.length,
        acts: acts.length,
        deadScroll,
        cueFailures,
        contrastFailures,
        reducedMotionFailures,
        consoleErrors,
      },
      violations:
        deadScroll.length +
        cueFailures.length +
        contrastFailures.length +
        reducedMotionFailures.length +
        consoleErrors.length,
    }
    writeFileSync(
      path.join(outDir, 'evidence.json'),
      `${JSON.stringify({ ...evidence, skipped }, null, 2)}\n`,
    )
    console.log(JSON.stringify({ ...evidence, skipped }, null, 2))
    return evidence.violations > 0 ? 1 : 0
  } finally {
    await browser.close()
    await server.close()
  }
}

process.exit(await main())
