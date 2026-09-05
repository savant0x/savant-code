/**
 * Robot template loader for the deck cast: loads the vendored CC0 rigged
 * robot once (Quaternius' RobotExpressive), never throws and never hangs —
 * a missing or corrupt asset resolves null so the walker layer falls back to
 * a solid minimal silhouette. Extracted verbatim from deck-robots.ts.
 */

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

import type { AnimationClip, Object3D } from 'three'

export const ROBOT_MODEL_URL = '/floor-assets/robots/robot.glb'

export interface RobotTemplate {
  readonly scene: Object3D
  readonly animations: readonly AnimationClip[]
}

let templatePromise: Promise<RobotTemplate | null> | null = null

/** The loader must never hang silently — H1 in FID-2026-0824-028. */
const TEMPLATE_LOAD_TIMEOUT_MS = 8000

let lastOutcome = 'pending'

/** Last loader outcome for UI telemetry (FID-2026-0824-030). */
export function lastTemplateOutcome(): string {
  return lastOutcome
}

/** One honest console line per load outcome (H1/H2 diagnostics). */
function reportTemplateOutcome(note: string): void {
  lastOutcome = note
  // eslint-disable-next-line no-console
  console.info(`[deck] robot template ${note}`)
}

/** Load (once) the vendored robot; null when missing/corrupt/timed out. */
export function loadRobotTemplate(
  url: string = ROBOT_MODEL_URL,
): Promise<RobotTemplate | null> {
  if (templatePromise === null) {
    templatePromise = new Promise((resolve) => {
      let settled = false
      const finish = (result: RobotTemplate | null, note: string): void => {
        if (settled) return
        settled = true
        reportTemplateOutcome(note)
        // A failed/timed-out load clears the cache so the next figure mount
        // retries the real asset — one transient failure must not permanently
        // degrade the cast to fallback silhouettes (Verifier C2).
        if (result === null) templatePromise = null
        resolve(result)
      }
      const timeout = setTimeout(
        () =>
          finish(
            null,
            'load TIMED OUT after 8s — mounting fallback silhouettes',
          ),
        TEMPLATE_LOAD_TIMEOUT_MS,
      )
      try {
        new GLTFLoader().load(
          url,
          (gltf) => {
            clearTimeout(timeout)
            finish(
              { scene: gltf.scene, animations: gltf.animations },
              `loaded (${gltf.animations.length} clips)`,
            )
          },
          undefined,
          () => {
            clearTimeout(timeout)
            finish(null, 'failed to load — mounting fallback silhouettes')
          },
        )
      } catch (error: unknown) {
        clearTimeout(timeout)
        finish(
          null,
          `loader threw: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    })
  }
  return templatePromise
}
