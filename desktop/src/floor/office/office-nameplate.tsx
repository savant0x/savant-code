/**
 * FID-2026-0901-006 P12 — React nameplate billboard for the office deck.
 *
 * Wraps the pure `drawNameplate` (office-nameplate.ts) in a canvas+texture
 * lifecycle and renders it as an always-facing drei <Billboard> sprite. The
 * texture redraws only when the content/active state actually changes, so an
 * agent flipping ACTIVE/STANDBY costs one redraw, not a per-frame loop.
 *
 * DOM-free environments (bun tests) get a placeholder texture so the scene
 * mounts structurally intact (Law 14 degradation) — the draw never throws.
 */

import { Billboard } from '@react-three/drei'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import {
  NAMEPLATE_CANVAS_HEIGHT,
  NAMEPLATE_CANVAS_WIDTH,
  drawNameplate,
  nameplateLayout,
} from './nameplate-draw'

import type { JSX } from 'react'

export interface OfficeNameplateProps {
  readonly title: string
  readonly subtitle: string
  readonly accent: string
  readonly active: boolean
  readonly position: [number, number, number]
  /** World-space width; height follows the plate aspect. */
  readonly worldWidth?: number
}

export const OfficeNameplate = ({
  title,
  subtitle,
  accent,
  active,
  position,
  worldWidth = 2.6,
}: OfficeNameplateProps): JSX.Element => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const { canvas, ctx, texture } = useMemo(() => {
    if (typeof document === 'undefined') {
      // DOM-free (bun/test): an empty texture keeps the scene mounting.
      const texture = new THREE.CanvasTexture(
        undefined as unknown as HTMLCanvasElement,
      )
      return { canvas: null, ctx: null, texture }
    }
    const canvas = document.createElement('canvas')
    canvas.width = NAMEPLATE_CANVAS_WIDTH
    canvas.height = NAMEPLATE_CANVAS_HEIGHT
    const ctx = canvas.getContext('2d')
    const texture = new THREE.CanvasTexture(canvas)
    texture.needsUpdate = true
    return { canvas, ctx, texture }
  }, [])

  canvasRef.current = canvas

  const layout = useMemo(
    () => nameplateLayout(title, subtitle, accent, active),
    [title, subtitle, accent, active],
  )

  useEffect(() => {
    if (ctx === null || canvas === null) return
    drawNameplate(ctx, layout, active)
    texture.needsUpdate = true
  }, [ctx, canvas, texture, layout, active])

  const aspect = NAMEPLATE_CANVAS_HEIGHT / NAMEPLATE_CANVAS_WIDTH
  return (
    <Billboard position={position}>
      <sprite scale={[worldWidth, worldWidth * aspect, 1]}>
        <spriteMaterial
          map={texture}
          transparent
          depthTest={false}
          toneMapped={false}
        />
      </sprite>
    </Billboard>
  )
}
