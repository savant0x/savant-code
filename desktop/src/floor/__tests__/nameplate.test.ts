import { describe, expect, test } from 'bun:test'

import { createNameplate, statusLabel } from '../stage/nameplate'

// FID-2026-0822-012 asset pass — the nameplate's DOM-free contract: pure
// status labels plus the redraw cache (a per-sync status flip must cost
// canvas work only on actual change). The canvas is a stub via the DI seam.

function stubCanvas(): {
  canvas: HTMLCanvasElement
  draws: () => number
  texts: () => string[]
} {
  const texts: string[] = []
  const ctx = {
    clearRect: () => {},
    fillRect: () => {},
    fillText: (text: string) => {
      texts.push(text)
    },
    beginPath: () => {},
    moveTo: () => {},
    arcTo: () => {},
    closePath: () => {},
    fill: () => {},
    stroke: () => {},
    measureText: () => ({ width: 10 }),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    textBaseline: '',
  } as unknown as CanvasRenderingContext2D
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement
  return { canvas, draws: () => texts.length, texts: () => texts }
}

describe('billboard nameplates (asset pass)', () => {
  test('statusLabel maps the active flag to chip text', () => {
    expect(statusLabel(true)).toBe('ACTIVE')
    expect(statusLabel(false)).toBe('STANDBY')
    expect(statusLabel(true, { active: 'BUSY', idle: 'IDLE' })).toBe('BUSY')
    expect(statusLabel(false, { active: 'BUSY', idle: 'IDLE' })).toBe('IDLE')
  })

  test('creates a camera-facing chip with aspect-correct scale', () => {
    const { canvas } = stubCanvas()
    const plate = createNameplate({
      title: 'Detective',
      subtitle: 'detective',
      accent: '#22d3ee',
      worldWidth: 2.2,
      createCanvas: () => canvas,
    })
    try {
      expect(plate.sprite.renderOrder).toBe(999)
      // World width honored; height follows the 512x128 canvas aspect.
      expect(plate.sprite.scale.x).toBeCloseTo(2.2, 10)
      expect(plate.sprite.scale.y).toBeCloseTo(2.2 * (128 / 512), 10)
      const material = plate.sprite.material
      expect(material.map).not.toBeNull()
      expect(material.depthTest).toBe(false)
    } finally {
      plate.dispose()
    }
  })

  test('redraws only when the status actually flips (cache contract)', () => {
    const { canvas, draws } = stubCanvas()
    const plate = createNameplate({
      title: 'Savant',
      subtitle: 'savant',
      accent: '#18faf9',
      createCanvas: () => canvas,
    })
    try {
      const initial = draws()
      expect(initial).toBeGreaterThan(0)
      plate.update(true)
      const afterFlip = draws()
      expect(afterFlip).toBeGreaterThan(initial)
      // Same status again: cached, zero canvas work.
      plate.update(true)
      expect(draws()).toBe(afterFlip)
      plate.update(false)
      expect(draws()).toBeGreaterThan(afterFlip)
    } finally {
      plate.dispose()
    }
  })

  test('custom status labels render through the same cache', () => {
    const { canvas, texts } = stubCanvas()
    const plate = createNameplate({
      title: 'File Forge',
      subtitle: 'station',
      accent: '#ff9500',
      statusLabels: { active: 'BUSY', idle: 'IDLE' },
      createCanvas: () => canvas,
    })
    try {
      expect(texts()).toContain('STATION · IDLE')
      plate.update(true)
      expect(texts()).toContain('STATION · BUSY')
      plate.update(true)
      expect(texts().filter((text) => text.includes('BUSY'))).toHaveLength(1)
    } finally {
      plate.dispose()
    }
  })
})
