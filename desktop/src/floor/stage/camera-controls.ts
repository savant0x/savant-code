/**
 * FID-2026-0822-012 P1 — deck camera controls.
 *
 * Pure orbit math lives here (zero three.js imports) so clamping and pan
 * geometry stay unit-testable without a GL context. The controller only
 * translates DOM events into orbit mutations and notifies the stage.
 */

export const ZOOM_MIN_DISTANCE = 8
export const ZOOM_MAX_DISTANCE = 90
/** Wheel delta (px) -> exponential dolly factor multiplier. */
export const ZOOM_WHEEL_SENSITIVITY = 0.0016
/** Drag px -> world units of target travel, scaled by current distance. */
export const DRAG_PAN_SCALE = 0.0018

export const DPR_FLOOR = 1
export const DPR_CEILING = 2

export interface Vec3 {
  readonly x: number
  readonly y: number
  readonly z: number
}

/** Orbit rig: the camera circles a ground-plane target at fixed pitch/yaw. */
export interface CameraOrbit {
  targetX: number
  targetZ: number
  distance: number
  /** Ground heading; yaw=0 places the camera on the +Z side of the target. */
  yaw: number
  /** Elevation in radians, kept in (0.15, PI/2 - 0.05); default is a
   * cinematic low-orbit view per live-webview operator feedback. */
  pitch: number
}

export const DEFAULT_ORBIT: CameraOrbit = {
  targetX: 0,
  targetZ: 2,
  // Pulled in from 34 (2026-08-25): at 34 units the 4.2-unit cast read as
  // floor texture; 22 keeps the full pad ring framed with readable robots.
  distance: 22,
  yaw: 0,
  pitch: 0.6,
}

export function clampDistance(distance: number): number {
  if (!Number.isFinite(distance)) return DEFAULT_ORBIT.distance
  return Math.min(ZOOM_MAX_DISTANCE, Math.max(ZOOM_MIN_DISTANCE, distance))
}

export function clampDpr(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return DPR_FLOOR
  return Math.min(DPR_CEILING, Math.max(DPR_FLOOR, value))
}

export function nextDistance(orbit: CameraOrbit, deltaY: number): number {
  return clampDistance(
    orbit.distance * Math.exp(deltaY * ZOOM_WHEEL_SENSITIVITY),
  )
}

/**
 * Ground-plane pan that follows the pointer: drag-right moves the world
 * right along the camera-right vector, drag-down reveals what is further
 * ahead along the ground-projected view direction.
 */
export function panned(
  orbit: CameraOrbit,
  dxPx: number,
  dyPx: number,
): { targetX: number; targetZ: number } {
  const scale = orbit.distance * DRAG_PAN_SCALE
  const rightX = Math.cos(orbit.yaw)
  const rightZ = -Math.sin(orbit.yaw)
  const fwdX = -Math.sin(orbit.yaw)
  const fwdZ = -Math.cos(orbit.yaw)
  return {
    targetX: orbit.targetX - dxPx * rightX * scale + dyPx * fwdX * scale,
    targetZ: orbit.targetZ - dxPx * rightZ * scale + dyPx * fwdZ * scale,
  }
}

export function cameraPosition(orbit: CameraOrbit): Vec3 {
  const horizontal = Math.cos(orbit.pitch) * orbit.distance
  return {
    x: orbit.targetX + Math.sin(orbit.yaw) * horizontal,
    y: Math.sin(orbit.pitch) * orbit.distance,
    z: orbit.targetZ + Math.cos(orbit.yaw) * horizontal,
  }
}

export class CameraControls {
  readonly orbit: CameraOrbit = { ...DEFAULT_ORBIT }

  private canvas: HTMLCanvasElement | null = null
  private lastPointer: { x: number; y: number } | null = null

  constructor(private readonly onChange: () => void) {}

  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas
    canvas.addEventListener('wheel', this.onWheel, { passive: false })
    canvas.addEventListener('pointerdown', this.onPointerDown)
    window.addEventListener('pointermove', this.onPointerMove)
    window.addEventListener('pointerup', this.onPointerUp)
  }

  detach(): void {
    const canvas = this.canvas
    if (canvas !== null) {
      canvas.removeEventListener('wheel', this.onWheel)
      canvas.removeEventListener('pointerdown', this.onPointerDown)
    }
    window.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerup', this.onPointerUp)
    this.canvas = null
    this.lastPointer = null
  }

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault()
    this.orbit.distance = nextDistance(this.orbit, event.deltaY)
    this.onChange()
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return
    this.lastPointer = { x: event.clientX, y: event.clientY }
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    const last = this.lastPointer
    if (last === null) return
    const dx = event.clientX - last.x
    const dy = event.clientY - last.y
    this.lastPointer = { x: event.clientX, y: event.clientY }
    if (dx === 0 && dy === 0) return
    const next = panned(this.orbit, dx, dy)
    this.orbit.targetX = next.targetX
    this.orbit.targetZ = next.targetZ
    this.onChange()
  }

  private readonly onPointerUp = (): void => {
    this.lastPointer = null
  }
}
