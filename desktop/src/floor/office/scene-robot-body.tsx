// FID-2026-0905-005 — office-scene decomposition: robot body.
//
// The rigged cast body: GLB template loading, hologram-skinned figure
// construction with fallback rescale, and the per-frame animation update
// driven by the shared movingMap. Split from scene-agent-ui.tsx (ceiling
// split); verbatim moves from office-scene.tsx.

import { useFrame } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'

import { createOfficeRobotFigure, loadCastTemplate } from './robot-cast'
import { REDUCED, ROBOT_OFFICE_HEIGHT } from './scene-constants'
import { buildFallbackFigure, ROBOT_TARGET_HEIGHT } from '../stage/deck-robots'

import type { RobotFigure } from '../stage/deck-robots'
import type { JSX } from 'react'

/**
 * One rigged robot cast body (P6b): the shared hologram-skinned figure from
 * `stage/deck-robots.ts` (Idle/Walking clips, standby/active emissive),
 * design-rotated across two CC0 models. Falls back to the solid silhouette
 * when the GLB cannot load — never a wireframe (operator directive).
 */
export function RobotBody({
  accent,
  modelUrl,
  walking,
  agentId,
  movingMap,
  heightScale = 1,
}: {
  readonly accent: string
  readonly modelUrl: string
  readonly walking: boolean
  readonly agentId: string
  readonly movingMap: React.RefObject<Map<string, boolean>>
  /** Savant renders 2-3x taller than the cast (operator directive). */
  readonly heightScale?: number
}): JSX.Element {
  const [figure, setFigure] = useState<RobotFigure | null>(null)
  const walkingRef = useRef(walking)
  walkingRef.current = walking
  useEffect(() => {
    let cancelled = false
    loadCastTemplate(modelUrl).then((template) => {
      if (cancelled) return
      const built: RobotFigure = template
        ? createOfficeRobotFigure(
            template,
            accent,
            ROBOT_OFFICE_HEIGHT * heightScale,
          )
        : rescaleFallback(buildFallbackFigure(accent), heightScale)
      built.setActive(walkingRef.current)
      setFigure(built)
    })
    return () => {
      cancelled = true
      setFigure((current) => {
        current?.dispose()
        return null
      })
    }
  }, [accent, modelUrl, heightScale])
  useEffect(() => {
    figure?.setActive(walking)
  }, [figure, walking])
  useFrame((_, delta) => {
    // Walk-in flag from the scene frame loop wins: a freshly spawned walker
    // glides to its post with the Walking clip even before any tool traffic.
    const gliding = movingMap.current?.get(agentId) ?? false
    figure?.update(Math.min(delta * 1000, 100), {
      moving: walkingRef.current || gliding,
      reduced: REDUCED,
    })
  })
  if (figure === null) return <></>
  return <primitive object={figure.root} />
}

/** Normalize the fallback silhouette to office-world height. */
function rescaleFallback(figure: RobotFigure, heightScale = 1): RobotFigure {
  figure.root.scale.multiplyScalar(
    (ROBOT_OFFICE_HEIGHT * heightScale) / ROBOT_TARGET_HEIGHT,
  )
  return figure
}
