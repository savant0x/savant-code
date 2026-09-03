/**
 * FID-2026-0822-012 P1 — command-deck stage shell.
 *
 * The Void (#050508 plane) under a static #20202a grid with fog-based
 * distance fade, rendered on a Three.js WebGL stage. Blueprint principle 2
 * ("calm base, alive surface"): the floor never animates, so P1 renders on
 * demand — camera changes, resizes, context restoration — with no idle rAF
 * spin. Animated entities arrive with P2+ and introduce the continuous loop.
 *
 * P6: `render()` and `getScene()` expose the on-demand frame and the scene
 * so the runtime driver (stage/deck-runtime.ts) can attach layers and run
 * the continuous ticker; the stage itself still never spins.
 *
 * Robustness gates: DPR clamped [1,2], ResizeObserver-driven resize,
 * webglcontextlost/restored handled without stale-resource resumption, and
 * an idempotent dispose that is safe under strict-mode double-mount.
 */

import {
  Color,
  DirectionalLight,
  Fog,
  GridHelper,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  WebGLRenderer,
} from 'three'

import { DECK_TOKENS } from '../deck-tokens.generated'
import { cameraPosition, clampDpr } from './camera-controls'

import type { CameraOrbit } from './camera-controls'

const GRID_SIZE = 400
const GRID_DIVISIONS = 200
const VOID_SIZE = GRID_SIZE * 2
const VOID_Y_OFFSET = -0.02
const FOG_NEAR = 45
/** Fade horizon sits beyond the grid edge so the floor reads as filling
 * the viewport instead of a finite island (live-webview operator feedback). */
const FOG_FAR = 340
const CAMERA_FOV = 55
const CAMERA_NEAR = 0.1
const CAMERA_FAR = 420

/** Thrown when the webview cannot provide a WebGL context (Linux WebKitGTK);
 * DeckView swaps to its honest fallback message on this error. */
export class DeckStageError extends Error {}

interface FloorContents {
  readonly grid: GridHelper
  readonly voidMesh: Mesh<PlaneGeometry, MeshBasicMaterial>
}

export class DeckStage {
  private readonly renderer: WebGLRenderer
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(
    CAMERA_FOV,
    1,
    CAMERA_NEAR,
    CAMERA_FAR,
  )
  private floor: FloorContents | null = null
  private disposed = false

  constructor(private readonly canvas: HTMLCanvasElement) {
    try {
      this.renderer = new WebGLRenderer({ canvas, antialias: true })
    } catch (error: unknown) {
      throw new DeckStageError(`WebGL context unavailable: ${String(error)}`)
    }
    // Depth-tested alpha cutouts stay crisp under MSAA once Alpha-to-Coverage
    // is enabled (research doc: holographic wireframe depth sorting).
    const gl = this.renderer.getContext()
    gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE)
    this.scene.background = new Color(DECK_TOKENS.background)
    this.scene.fog = new Fog(DECK_TOKENS.background, FOG_NEAR, FOG_FAR)
    // Asset-pass lighting rig: the cast robots are lit MeshStandardMaterial
    // figures — with zero lights they would render black. FID-2026-0828-002
    // (operator: "background is still too bright by a lot"): hemisphere and
    // key intensities are cut roughly in half and the fill is nearly off, so
    // the void stays a calm dark base and the accent emissive carries the
    // hologram read instead of the light rig.
    const hemisphere = new HemisphereLight('#101a24', '#020204', 0.45)
    const key = new DirectionalLight('#bfe9ff', 0.7)
    key.position.set(12, 20, 8)
    const fill = new DirectionalLight('#18faf9', 0.12)
    fill.position.set(-10, 12, -8)
    this.scene.add(hemisphere, key, fill)
    this.buildFloor()
    canvas.addEventListener('webglcontextlost', this.onContextLost)
    canvas.addEventListener('webglcontextrestored', this.onContextRestored)
  }

  applyOrbit(orbit: CameraOrbit): void {
    if (this.disposed) return
    const position = cameraPosition(orbit)
    this.camera.position.set(position.x, position.y, position.z)
    this.camera.lookAt(orbit.targetX, 0, orbit.targetZ)
    this.recenterFloor(orbit.targetX, orbit.targetZ)
    this.renderFrame()
  }

  /** Recentre the floor on the orbit target, snapped to the grid cell so
   * lines never swim relative to world geometry — panning reads as an
   * infinite floor because the receding edge stays inside the fog horizon
   * (live-webview operator feedback, 2026-08-24). */
  private recenterFloor(targetX: number, targetZ: number): void {
    if (this.floor === null) return
    const cell = GRID_SIZE / GRID_DIVISIONS
    const x = Math.round(targetX / cell) * cell
    const z = Math.round(targetZ / cell) * cell
    this.floor.grid.position.set(x, 0, z)
    this.floor.voidMesh.position.set(x, VOID_Y_OFFSET, z)
  }

  resize(width: number, height: number, devicePixelRatio: number): void {
    if (this.disposed || width <= 0 || height <= 0) return
    this.renderer.setPixelRatio(clampDpr(devicePixelRatio))
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderFrame()
  }

  /** Public one-shot frame for the P6 runtime ticker / static renders. */
  render(): void {
    this.renderFrame()
  }

  /** Scene accessor so atmosphere-style layers attach without leaking privates. */
  getScene(): Scene {
    return this.scene
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost)
    this.canvas.removeEventListener(
      'webglcontextrestored',
      this.onContextRestored,
    )
    this.destroyFloor()
    this.renderer.dispose()
  }

  private buildFloor(): void {
    const voidGeometry = new PlaneGeometry(VOID_SIZE, VOID_SIZE)
    // FID-2026-0828-002 (operator: "background is still too bright by a lot"):
    // the void plane is darkened to near-black instead of the contract
    // background token, and the grid uses the contract border color only —
    // the "calm base" of the blueprint, with the emissive layers as the
    // sole bright elements.
    const voidMaterial = new MeshBasicMaterial({
      color: new Color(0x020204),
    })
    const voidMesh = new Mesh(voidGeometry, voidMaterial)
    voidMesh.rotation.x = -Math.PI / 2
    voidMesh.position.y = VOID_Y_OFFSET
    // Grid dimmed to ~40% of the border token — the operator read the full-
    // brightness lattice as part of the overall floor wash.
    const gridColor = new Color(DECK_TOKENS.border).multiplyScalar(0.4)
    const grid = new GridHelper(GRID_SIZE, GRID_DIVISIONS, gridColor, gridColor)
    this.scene.add(voidMesh)
    this.scene.add(grid)
    this.floor = { grid, voidMesh }
  }

  /** GPU resources die with the context; rebuild from scratch, never resume. */
  private destroyFloor(): void {
    if (this.floor === null) return
    this.scene.remove(this.floor.grid)
    this.scene.remove(this.floor.voidMesh)
    this.floor.grid.geometry.dispose()
    this.floor.grid.material.dispose()
    this.floor.voidMesh.geometry.dispose()
    this.floor.voidMesh.material.dispose()
    this.floor = null
  }

  private renderFrame(): void {
    if (this.disposed) return
    this.renderer.render(this.scene, this.camera)
  }

  private readonly onContextLost = (event: Event): void => {
    // Owning the event keeps the canvas element alive; restoration below
    // recreates GPU resources instead of resuming anything stale.
    event.preventDefault()
  }

  private readonly onContextRestored = (): void => {
    if (this.disposed) return
    this.destroyFloor()
    this.buildFloor()
    this.renderFrame()
  }
}
