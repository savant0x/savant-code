/**
 * Page-level assertions for the savant-motion verify harness.
 *
 * All functions take a live playwright Page and return plain data so
 * verify/index.ts stays orchestration-only and the evidence JSON stays
 * strictly typed.
 */
import type { TextBox } from './contrast.ts'
import type { Page } from 'playwright-core'

export interface ActInfo {
  index: number
  type: string
  top: number
  height: number
}

export interface CueFailure {
  selector: string
  expected: number
  actual: number
}

export interface DeadScrollViolation {
  fromY: number
  toY: number
}

export interface ReducedMotionFailure {
  selector: string
  detail: string
}

export interface CapturedFrame {
  scrollY: number
  png: Uint8Array
  boxes: TextBox[]
}

const SETTLE_MS = 350

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('load')
  await page.waitForTimeout(SETTLE_MS)
}

/** Discover engine acts: [data-sm-act] elements with their document spans. */
export async function discoverActs(page: Page): Promise<ActInfo[]> {
  return page.evaluate(() => {
    const elements = [...document.querySelectorAll('[data-sm-act]')]
    return elements.map((element, index) => {
      const box = element.getBoundingClientRect()
      const top = box.top + window.scrollY
      return {
        index,
        type: element.getAttribute('data-sm-act') ?? 'flow',
        top,
        height: Math.max(box.height, window.innerHeight),
      }
    })
  })
}

/**
 * Scroll through `positions` (document Y values), settling at each, and
 * capture a PNG screenshot per stop.
 */
export async function walkAndCapture(
  page: Page,
  positions: number[],
): Promise<CapturedFrame[]> {
  const frames: CapturedFrame[] = []
  for (const y of positions) {
    await page.evaluate((target) => window.scrollTo(0, target), y)
    await settle(page)
    const scrollY = await page.evaluate(() => window.scrollY)
    const shot = await page.screenshot({ type: 'png', fullPage: false })
    const boxes = await collectTextBoxes(page)
    frames.push({ scrollY, png: new Uint8Array(shot), boxes })
  }
  return frames
}

/**
 * Every [data-sm-cue] must reach computed opacity 1 (±0.01) when its center
 * sits at viewport center — a cue the reader can only ever see faded is a
 * shipping blocker.
 */
export async function assertCueOpacity(page: Page): Promise<CueFailure[]> {
  return page.evaluate(async () => {
    const settleMs = 350
    const sleep = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms))
    const failures: CueFailure[] = []
    const cues = [...document.querySelectorAll('[data-sm-cue]')]
    for (let index = 0; index < cues.length; index += 1) {
      const element = cues[index] as HTMLElement
      const rect = element.getBoundingClientRect()
      const target =
        rect.top + window.scrollY + rect.height / 2 - window.innerHeight / 2
      window.scrollTo(0, target)
      await sleep(settleMs)
      const opacity = Number.parseFloat(getComputedStyle(element).opacity)
      if (Math.abs(opacity - 1) > 0.01) {
        failures.push({
          selector: `cue#${index}`,
          expected: 1,
          actual: opacity,
        })
      }
    }
    return failures
  })
}

/**
 * Collect real-text boxes for raster contrast grading: headings, paragraphs,
 * list items, links, blockquotes — visible ones only.
 */
export async function collectTextBoxes(page: Page): Promise<TextBox[]> {
  return page.evaluate(() => {
    const selector = 'h1, h2, h3, h4, h5, h6, p, li, a, blockquote'
    const elements = [...document.querySelectorAll(selector)]
    const boxes: TextBox[] = []
    let counter = 0
    for (const element of elements) {
      const style = getComputedStyle(element)
      if (style.visibility === 'hidden' || style.display === 'none') continue
      if (Number.parseFloat(style.opacity) < 0.5) continue
      const range = document.createRange()
      range.selectNodeContents(element)
      const rect = range.getBoundingClientRect()
      if (rect.width < 8 || rect.height < 6) continue
      const match = /^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(style.color)
      if (match === null) continue
      const fontSize = Number.parseFloat(style.fontSize)
      counter += 1
      boxes.push({
        id: `${element.tagName.toLowerCase()}@${counter}`,
        colorRgb: [
          Number.parseInt(match[1] ?? '0', 10),
          Number.parseInt(match[2] ?? '0', 10),
          Number.parseInt(match[3] ?? '0', 10),
        ],
        largeText:
          fontSize >= 24 ||
          (fontSize >= 18.66 && Number.parseFloat(style.fontWeight) >= 700),
        rect: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        },
      })
    }
    return boxes
  })
}

/**
 * With prefers-reduced-motion forced, the page must be statically readable:
 * every cue at least 90% opaque somewhere in its resting state and no
 * transform-hidden content.
 */
export async function checkReducedMotion(
  page: Page,
): Promise<ReducedMotionFailure[]> {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await settle(page)
  const failures = await page.evaluate(() => {
    const problems: Array<{ selector: string; detail: string }> = []
    for (const element of [
      ...document.querySelectorAll('[data-sm-cue], [data-sm-reveal]'),
    ]) {
      const style = getComputedStyle(element)
      const label = `<${element.tagName.toLowerCase()} ${[...element.attributes]
        .slice(0, 1)
        .map((a) => `${a.name}="${a.value}"`)
        .join(' ')}>`
      if (style.visibility === 'hidden' || style.display === 'none') {
        problems.push({
          selector: label,
          detail: 'hidden under reduced motion',
        })
        continue
      }
      if (Number.parseFloat(style.opacity) < 0.9) {
        problems.push({
          selector: label,
          detail: `opacity ${style.opacity} under reduced motion`,
        })
      }
    }
    return problems
  })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.reload()
  await settle(page)
  return failures
}

/** Compare consecutive captured frames: identical bytes while scrolled = dead zone. */
export function findDeadScroll(
  frames: CapturedFrame[],
  minAdvancePx = 50,
): DeadScrollViolation[] {
  const violations: DeadScrollViolation[] = []
  for (let i = 1; i < frames.length; i += 1) {
    const previous = frames[i - 1] as CapturedFrame
    const current = frames[i] as CapturedFrame
    const advanced = current.scrollY - previous.scrollY
    if (advanced < minAdvancePx) continue
    if (
      previous.png.length === current.png.length &&
      previous.png.every((b, j) => b === current.png[j])
    ) {
      violations.push({ fromY: previous.scrollY, toY: current.scrollY })
    }
  }
  return violations
}
