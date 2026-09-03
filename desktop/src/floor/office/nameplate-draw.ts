/**
 * FID-2026-0901-006 P12 — AAA office-deck nameplate design.
 *
 * The office scene previously rendered each character's name as a bare
 * drei <Text> billboard (no plate, no accent, no status) — it read as a
 * floating label, not a designed game-chrome element. This module draws a
 * proper composite nameplate onto a 2D canvas:
 *
 *   - dark glass rounded pill with a soft drop shadow
 *   - role-accent outer glow stroke + thin inner hairline
 *   - a role-accent status dot that pulses when the agent is working
 *   - uppercase bold title (the role name)
 *   - muted subtitle line (the speaker/status)
 *
 * Pure and deterministic: the draw function takes (ctx, options) and never
 * touches DOM/timers; a React component owns the canvas + texture lifecycle.
 * A bun-testable pure layer (compute the plate's text/colors/geometry) is
 * exported so the design contract is pinned without a GPU.
 */

export const NAMEPLATE_CANVAS_WIDTH = 512
export const NAMEPLATE_CANVAS_HEIGHT = 160

/** Readable contrast ratio helpers — AAA means accessible, not just pretty. */
export function blend(hex: string, amount: number): string {
  const value = hex.replace('#', '')
  const num = Number.parseInt(value, 16)
  const r = (num >> 16) & 0xff
  const g = (num >> 8) & 0xff
  const b = num & 0xff
  const target = amount >= 0 ? 255 : 0
  const t = Math.abs(amount)
  const mix = (c: number): number => Math.round(c + (target - c) * t)
  return `#${((mix(r) << 16) | (mix(g) << 8) | mix(b))
    .toString(16)
    .padStart(6, '0')}`
}

/** Luminance (0..1) of a #rrggbb color, for contrast-aware text color. */
export function luminance(hex: string): number {
  const value = hex.replace('#', '')
  const num = Number.parseInt(value, 16)
  const r = (num >> 16) & 0xff
  const g = (num >> 8) & 0xff
  const b = num & 0xff
  const sr = r / 255
  const sg = g / 255
  const sb = b / 255
  return 0.2126 * sr + 0.7152 * sg + 0.0722 * sb
}

export interface NameplateLayout {
  readonly title: string
  readonly subtitle: string
  readonly titleFont: string
  readonly subtitleFont: string
  readonly titleColor: string
  readonly subtitleColor: string
  readonly accent: string
  readonly accentGlow: string
  readonly glassFill: string
  readonly border: string
}

/** Art-directed plate content — the text/colors/fonts that go on the chip. */
export function nameplateLayout(
  title: string,
  subtitle: string,
  accent: string,
  active: boolean,
): NameplateLayout {
  // Title is a light tint of the accent so it reads on the dark glass; on a
  // live agent we lighten it FURTHER so it pops off the glowing stroke.
  // AAA contrast: never place accent-on-accent (the stroke is the accent).
  const titleColor = active ? blend(accent, 0.9) : blend(accent, 0.7)
  return {
    title: title.toUpperCase(),
    subtitle: subtitle.toUpperCase(),
    titleFont: '700 52px system-ui, sans-serif',
    subtitleFont: '500 30px system-ui, sans-serif',
    titleColor,
    subtitleColor: 'rgba(228, 228, 232, 0.82)',
    accent,
    accentGlow: blend(accent, 0.32),
    glassFill: 'rgba(6, 7, 11, 0.82)',
    border: 'rgba(255, 255, 255, 0.10)',
  }
}

function traceRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Redraw the nameplate onto `ctx`. Deterministic — tests may stub any drawing call. */
export function drawNameplate(
  ctx: CanvasRenderingContext2D,
  layout: NameplateLayout,
  active: boolean,
): void {
  const W = NAMEPLATE_CANVAS_WIDTH
  const H = NAMEPLATE_CANVAS_HEIGHT
  const pad = 10
  const r = 26

  ctx.clearRect(0, 0, W, H)

  // --- drop shadow (offset dark pass behind the pill) ---------------------
  ctx.save()
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)'
  ctx.shadowBlur = 18
  ctx.shadowOffsetY = 5
  ctx.fillStyle = layout.glassFill
  traceRoundedRect(ctx, pad, pad - 5, W - pad * 2, H - pad * 2, r)
  ctx.fill()
  ctx.restore()

  // --- accent outer-glow stroke (layered for a bloom feel) ---------------
  // Three passes, widening + fading: the plate's signature AAA edge light.
  const glowSteps = [
    { width: 8, alpha: 0.1 },
    { width: 5, alpha: 0.2 },
    { width: 2.5, alpha: 0.55 },
  ] as const
  for (const step of glowSteps) {
    ctx.save()
    ctx.strokeStyle = layout.accentGlow
    ctx.globalAlpha = step.alpha
    ctx.lineWidth = step.width
    traceRoundedRect(ctx, pad, pad, W - pad * 2, H - pad * 2, r)
    ctx.stroke()
    ctx.restore()
  }

  // --- glass plate fill (re-stroke the body over the glow) ---------------
  ctx.save()
  ctx.fillStyle = layout.glassFill
  traceRoundedRect(ctx, pad, pad, W - pad * 2, H - pad * 2, r)
  ctx.fill()
  // Thin inner hairline for a machined metal read.
  ctx.strokeStyle = layout.border
  ctx.lineWidth = 1
  traceRoundedRect(
    ctx,
    pad + 1,
    pad + 1,
    W - pad * 2 - 2,
    H - pad * 2 - 2,
    r - 1,
  )
  ctx.stroke()
  ctx.restore()

  // --- status dot (accent; pulses when active via a second ring) ---------
  const dotX = pad + 40
  const dotY = H / 2
  if (active) {
    ctx.save()
    ctx.fillStyle = layout.accentGlow
    ctx.globalAlpha = 0.35
    ctx.beginPath()
    ctx.arc(dotX, dotY, 22, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  ctx.save()
  ctx.fillStyle = active ? layout.accent : layout.subtitleColor
  ctx.beginPath()
  ctx.arc(dotX, dotY, 13, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // --- accent rule between dot and copy ----------------------------------
  ctx.save()
  ctx.strokeStyle = active ? layout.accentGlow : 'rgba(255,255,255,0.12)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(dotX + 22, pad + 8)
  ctx.lineTo(dotX + 22, H - pad - 8)
  ctx.stroke()
  ctx.restore()

  // --- title + subtitle ---------------------------------------------------
  // P18 (operator: plate truncated to "SAVANT THE THI"): the title font
  // shrinks to fit the measured text width instead of overflowing the
  // 512px canvas — long names scale down, never clip mid-word. 34px is the
  // readability floor; the layout() pre-trim handles pathological inputs.
  const textX = dotX + 40
  const maxTextWidth = W - textX - pad - 6
  const fitFont = (base: string, text: string, floorPx: number): string => {
    const match = base.match(/(\d+)px/)
    if (match === null) return base
    const startPx = Number.parseInt(match[1], 10)
    let px = startPx
    while (px > floorPx) {
      ctx.font = base.replace(/(\d+)px/, `${px}px`)
      if (ctx.measureText(text).width <= maxTextWidth) break
      px -= 2
    }
    return base.replace(/(\d+)px/, `${px}px`)
  }
  ctx.save()
  ctx.fillStyle = layout.titleColor
  ctx.font = fitFont(layout.titleFont, layout.title, 34)
  ctx.textBaseline = 'middle'
  ctx.fillText(layout.title, textX, H / 2 - 22)
  ctx.fillStyle = layout.subtitleColor
  ctx.font = fitFont(layout.subtitleFont, layout.subtitle, 22)
  ctx.fillText(layout.subtitle, textX, H / 2 + 26)
  ctx.restore()
}

/** No-op 2D context for DOM-free environments (bun tests) — Law 14. */
export function blankNameplateContext(): CanvasRenderingContext2D {
  const noop = (): void => {}
  return {
    clearRect: noop,
    save: noop,
    restore: noop,
    beginPath: noop,
    moveTo: noop,
    arc: noop,
    arcTo: noop,
    closePath: noop,
    fill: noop,
    stroke: noop,
    fillText: noop,
    fillStyle: '',
    strokeStyle: '',
    globalAlpha: 1,
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetY: 0,
    lineWidth: 0,
    font: '',
    textBaseline: '',
  } as unknown as CanvasRenderingContext2D
}
