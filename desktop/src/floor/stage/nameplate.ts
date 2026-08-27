/**
 * FID-2026-0822-012 asset pass — billboard nameplates.
 *
 * Canvas-chip sprites that always face the camera (THREE.Sprite billboards)
 * floating over cast figures and station pedestals: accent title, muted role
 * line, live status. Zero text dependencies — the chip is drawn onto a 2D
 * canvas and consumed as a CanvasTexture (the research doc's raw-three
 * alternative to troika/drei). Redraws are cached by a content key so a
 * per-sync status flip costs canvas work only on actual change. The chip
 * renders on top (depthTest off, high render order) so labels never hide
 * behind geometry. The canvas creator is injectable — bun tests have no DOM.
 */

import { CanvasTexture, Sprite, SpriteMaterial } from 'three'

export type NameplateCanvas = HTMLCanvasElement

export interface Nameplate {
  readonly sprite: Sprite
  /** Flip the status chip; redraws only when the content actually changes. */
  update(active: boolean): void
  dispose(): void
}

export interface NameplateOptions {
  readonly title: string
  readonly subtitle: string
  /** Chip border + title color (role/station accent). */
  readonly accent: string
  /** World-space width; height follows the canvas aspect. */
  readonly worldWidth?: number
  /** Custom chip wording (stations flip BUSY/IDLE instead of the default). */
  readonly statusLabels?: StatusLabels
  /** DI seam: bun tests have no DOM — inject a stub canvas. */
  readonly createCanvas?: () => NameplateCanvas
}

const CANVAS_WIDTH = 512
const CANVAS_HEIGHT = 128
const DEFAULT_WORLD_WIDTH = 2.4

/** Status chip wording (stations say BUSY/IDLE; the cast ACTIVE/STANDBY). */
export interface StatusLabels {
  readonly active: string
  readonly idle: string
}

const DEFAULT_STATUS_LABELS: StatusLabels = {
  active: 'ACTIVE',
  idle: 'STANDBY',
}

/** Status chip text for a figure's active state (pure, pinned by test). */
export function statusLabel(
  active: boolean,
  labels: StatusLabels = DEFAULT_STATUS_LABELS,
): string {
  return active ? labels.active : labels.idle
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

function drawChip(
  ctx: CanvasRenderingContext2D,
  accent: string,
  title: string,
  subtitle: string,
  active: boolean,
  labels: StatusLabels,
): void {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  ctx.fillStyle = 'rgba(5, 5, 8, 0.78)'
  ctx.strokeStyle = accent
  ctx.lineWidth = 3
  traceRoundedRect(ctx, 6, 6, CANVAS_WIDTH - 12, CANVAS_HEIGHT - 12, 18)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = accent
  ctx.font = '700 46px system-ui, sans-serif'
  ctx.textBaseline = 'top'
  ctx.fillText(title.toUpperCase(), 26, 18)
  ctx.fillStyle = 'rgba(228, 228, 232, 0.82)'
  ctx.font = '500 30px system-ui, sans-serif'
  ctx.fillText(
    `${subtitle.toUpperCase()} · ${statusLabel(active, labels)}`,
    26,
    76,
  )
}

/** No-op 2D context for DOM-free environments (bun tests) — Law 14. */
function blankContext(): CanvasRenderingContext2D {
  const noop = (): void => {}
  return {
    clearRect: noop,
    fillRect: noop,
    fillText: noop,
    beginPath: noop,
    moveTo: noop,
    arcTo: noop,
    closePath: noop,
    fill: noop,
    stroke: noop,
    measureText: () => ({ width: 0 }),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    textBaseline: '',
  } as unknown as CanvasRenderingContext2D
}

function defaultCreateCanvas(): NameplateCanvas {
  // DOM-free environments (bun tests) get a blank offscreen chip: the
  // sprite still mounts and the layers stay structurally identical (Law 14).
  if (typeof document === 'undefined') {
    return {
      width: 0,
      height: 0,
      getContext: () => blankContext(),
    } as unknown as NameplateCanvas
  }
  return document.createElement('canvas')
}

export function createNameplate(options: NameplateOptions): Nameplate {
  const worldWidth = options.worldWidth ?? DEFAULT_WORLD_WIDTH
  const createCanvas = options.createCanvas ?? defaultCreateCanvas
  const canvas = createCanvas()
  canvas.width = CANVAS_WIDTH
  canvas.height = CANVAS_HEIGHT
  const ctx = canvas.getContext('2d')
  if (ctx === null) {
    throw new Error('nameplate: 2D canvas context unavailable')
  }
  const texture = new CanvasTexture(canvas)
  const material = new SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  })
  const sprite = new Sprite(material)
  sprite.renderOrder = 999
  sprite.scale.set(worldWidth, (worldWidth * CANVAS_HEIGHT) / CANVAS_WIDTH, 1)

  const labels = options.statusLabels ?? DEFAULT_STATUS_LABELS
  let active = false
  let drawnActive: boolean | null = null
  const redrawIfChanged = (): void => {
    if (active === drawnActive) return
    drawnActive = active
    drawChip(
      ctx,
      options.accent,
      options.title,
      options.subtitle,
      active,
      labels,
    )
    texture.needsUpdate = true
  }
  redrawIfChanged()

  return {
    sprite,
    update(next) {
      if (next === active) return
      active = next
      redrawIfChanged()
    },
    dispose() {
      texture.dispose()
      material.dispose()
    },
  }
}
