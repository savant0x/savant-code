/**
 * FID-2026-0829-001 L4 — action labels layer.
 *
 * Renders floating tool-name sprites above stations when a tool_call fires.
 * Each label fades in over 200ms, stays visible for the tool's lifetime,
 * and fades out on tool_result. Billboard sprites (like nameplates) that
 * always face the camera. Color-coded by tool class (read=blue, search=cyan,
 * write=orange, etc.).
 *
 * Animation contract: `sync(floor, nowMs)` takes the injected clock — same
 * deterministic-replay discipline as WalkerLayer; nothing spins on its own.
 */

import { Group, Sprite, SpriteMaterial, CanvasTexture } from 'three'

import {
  STATION_ACCENTS,
  STATION_COUNT,
  STATION_IDS,
  stationPosition,
} from '../stations'

import type { AnimationSyncOptions } from './motion'
import type { FloorState } from '../adapter/floor-adapter'
import type { Scene } from 'three'

/** Fade-in duration in ms. */
const FADE_IN_MS = 200
/** Fade-out duration in ms. */
const FADE_OUT_MS = 150
/** Maximum number of active labels (bounded resource rule). */
const MAX_LABELS = 12

/** Tool class → color mapping for visual differentiation. */
function _toolClassColor(toolName: string): string {
  const name = toolName.toLowerCase()
  if (name.includes('read') || name.includes('list') || name.includes('glob'))
    return '#5fd8d8' // primary cyan
  if (name.includes('search') || name.includes('code_search')) return '#5ccbd8' // inline code fg
  if (
    name.includes('write') ||
    name.includes('edit') ||
    name.includes('str_replace')
  )
    return '#e0aa4f' // warning orange
  if (
    name.includes('run') ||
    name.includes('terminal') ||
    name.includes('command')
  )
    return '#67d97e' // success green
  if (name.includes('skill') || name.includes('web')) return '#b8a6e8' // lavender
  return '#c4c4d0' // foreground white
}

/** Canvas dimensions for the label chip. */
const CANVAS_WIDTH = 320
const CANVAS_HEIGHT = 64

/** No-op 2D context for DOM-free environments (bun tests) — Law 14. */
function _blankContext(): CanvasRenderingContext2D {
  const noop = (): void => {}
  return {
    clearRect: noop,
    fillRect: noop,
    fillText: noop,
    measureText: () => ({ width: 0 }),
    fillStyle: '',
    font: '',
    textBaseline: '',
  } as unknown as CanvasRenderingContext2D
}

function createLabelSprite(toolName: string, accent: string): Sprite | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_WIDTH
  canvas.height = CANVAS_HEIGHT
  const ctx = canvas.getContext('2d')
  if (ctx === null) return null

  // Draw the label chip
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  ctx.fillStyle = 'rgba(5, 5, 8, 0.85)'
  ctx.strokeStyle = accent
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(4, 4, CANVAS_WIDTH - 8, CANVAS_HEIGHT - 8, 12)
  ctx.fill()
  ctx.stroke()

  // Tool name text
  ctx.fillStyle = accent
  ctx.font = '600 28px system-ui, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.fillText(toolName.toUpperCase(), 16, CANVAS_HEIGHT / 2)

  const texture = new CanvasTexture(canvas)
  const material = new SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    depthTest: false,
  })
  const sprite = new Sprite(material)
  sprite.renderOrder = 998
  sprite.scale.set(2.2, (2.2 * CANVAS_HEIGHT) / CANVAS_WIDTH, 1)
  return sprite
}

interface ActionLabel {
  readonly sprite: Sprite
  readonly toolCallId: string
  readonly stationIndex: number
  readonly bornMs: number
  readonly toolName: string
  fadingOut: boolean
  fadeOutStartMs: number | null
}

export class ActionLabelsLayer {
  private readonly root = new Group()
  private readonly labels: ActionLabel[] = []
  private readonly stationY: number[] = []
  private disposed = false

  constructor(scene: Scene) {
    // Pre-compute station Y positions (above the core hover height).
    for (let i = 0; i < STATION_COUNT; i += 1) {
      this.stationY.push(2.8) // Above CORE_HOVER_HEIGHT (1.55) + some margin
    }
    scene.add(this.root)
  }

  /**
   * Sync action labels with floor state. Each active tool_call gets a label
   * at its station; labels fade out when the tool_result arrives.
   */
  sync(
    floor: FloorState,
    nowMs: number,
    options: AnimationSyncOptions = {},
  ): void {
    if (this.disposed) return
    const reduced = options.reduced === true

    // Track which tool calls are currently active
    const activeToolCalls = new Set<string>()
    for (const [toolCallId, flight] of floor.pendingTools) {
      if (!flight.aura) {
        activeToolCalls.add(toolCallId)
      }
    }

    // Remove labels for completed tool calls (fading out)
    for (let i = this.labels.length - 1; i >= 0; i--) {
      const label = this.labels[i]
      if (!activeToolCalls.has(label.toolCallId)) {
        if (!label.fadingOut) {
          label.fadingOut = true
          label.fadeOutStartMs = nowMs
        }
        const elapsed = nowMs - label.fadeOutStartMs!
        const opacity = Math.max(0, 1 - elapsed / FADE_OUT_MS)
        ;(label.sprite.material as SpriteMaterial).opacity = opacity
        if (opacity <= 0) {
          this.root.remove(label.sprite)
          label.sprite.material.dispose()
          label.sprite.material.map?.dispose()
          this.labels.splice(i, 1)
        }
      }
    }

    // Add labels for new tool calls
    for (const [toolCallId, flight] of floor.pendingTools) {
      if (flight.aura) continue
      // Check if label already exists
      if (this.labels.some((l) => l.toolCallId === toolCallId)) continue

      // Bounded resource: cap at MAX_LABELS
      if (this.labels.length >= MAX_LABELS) {
        const oldest = this.labels.shift()
        if (oldest) {
          this.root.remove(oldest.sprite)
          oldest.sprite.material.dispose()
          oldest.sprite.material.map?.dispose()
        }
      }

      const stationIdx = STATION_IDS.indexOf(flight.station)
      const accent = STATION_ACCENTS[stationIdx] ?? '#c4c4d0'
      const sprite = createLabelSprite(flight.toolName, accent)
      if (sprite === null) continue

      const pos = stationPosition(stationIdx)
      sprite.position.set(pos.x, this.stationY[stationIdx], pos.z)
      this.root.add(sprite)

      this.labels.push({
        sprite,
        toolCallId,
        stationIndex: stationIdx,
        bornMs: nowMs,
        toolName: flight.toolName,
        fadingOut: false,
        fadeOutStartMs: null,
      })
    }

    // Animate fade-in for new labels (not yet fading out)
    for (const label of this.labels) {
      if (label.fadingOut) continue
      const elapsed = nowMs - label.bornMs
      const opacity = reduced ? 1 : Math.min(1, elapsed / FADE_IN_MS)
      ;(label.sprite.material as SpriteMaterial).opacity = opacity
    }
  }

  /** Idempotent teardown — safe under strict-mode double-mount. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const label of this.labels) {
      this.root.remove(label.sprite)
      label.sprite.material.dispose()
      label.sprite.material.map?.dispose()
    }
    this.labels.length = 0
    this.root.removeFromParent()
  }
}
