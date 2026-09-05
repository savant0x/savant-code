/**
 * FID-2026-0831-002 P6b — cyberpunk office deck scene.
 *
 * The office structure the operator approved (walls, windows, desks, plants,
 * rug) restyled to neon-noir: dark metal tech floor with cyan seams, dark
 * panel walls, glowing cyan/magenta window panels, neon desk-edge strips,
 * cool lighting with accent pools — and the cast swapped from box figures to
 * rigged CC0 robots (two designs rotating across the pad ring) skinned in the
 * per-role hologram material with Idle/Walking animations.
 *
 * All P1-P5 seams (walk motion, nameplates, speech bubbles, reduced motion,
 * camera rig) are unchanged. Textures: procedural PBR from
 * `procedural-textures.ts` — no bundled image assets.
 *
 * FID-2026-0905-005: the scene is decomposed into single-responsibility
 * stage modules under ./office/ (scene-* prefix) — this file is the
 * composition facade. It owns: the agent-contents frame-loop mounting
 * (OfficeContents), the burst state bridging the stepper to the renderer,
 * and the `OfficeScene` Canvas composition. The public export surface
 * (`OfficeScene`, `OfficeSceneProps`) is byte-identical — deck-view.tsx is
 * untouched.
 */

import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'

import { roleAccent } from '../roles'
import { NeonAtmosphere } from './neon-atmosphere'
import { homePosition, savantSpot } from './office-plan'
import { officeWalkerCast } from './office-walker-cast'
import { SparkBurst } from './scene-agent-fx'
import { makeThinkingPredicate } from './scene-agent-logic'
import { AgentCharacter } from './scene-agent-ui'
import { CameraRig } from './scene-camera'
import { REDUCED } from './scene-constants'
import { OfficeEnvironment } from './scene-environment'
import { createWalkerFrameStepper } from './scene-frame-loop'
import { LivingLights } from './scene-lights'
import { ProcessingRing, WallModelSign } from './scene-overlay'

import type { FloorState } from '../adapter/floor-adapter'
import type { DeckRoleId } from '../roles'
import type { SpeechBubble } from './speech-bubbles'
import type { JSX } from 'react'
import type * as THREE from 'three'

export interface OfficeSceneProps {
  readonly floor: FloorState
  /** FID-2026-0831-002 P4 — live bubble snapshot from the shared driver. */
  readonly bubbles?: readonly SpeechBubble[]
  /** P18: true while a chat run is streaming — pulses the red processing
   *  ring around the central emblem so the deck mirrors "something is
   *  processing" at a glance. */
  readonly processing?: boolean
  /** P18: the active model label, shown on a tag by the command tile. */
  readonly model?: string | null
}

type Burst = {
  key: string
  x: number
  z: number
  color: string
  startMs: number
}

/**
 * The live agent layer: mounts the walker-frame stepper (which owns the
 * per-frame simulation state) and renders one AgentCharacter per walker.
 * React scaffolding only — every computation lives in the stage modules.
 */
function OfficeContents({
  floor,
  bubbles,
}: {
  readonly floor: FloorState
  readonly bubbles: readonly SpeechBubble[]
}): JSX.Element {
  const groupRef = useRef<THREE.Group>(null)
  const [reduced] = useState(REDUCED)
  const stepper = useRef(createWalkerFrameStepper()).current
  // FID-2026-0901-006 P11: pure cast builder dedupes a spawned subagent's
  // role against the standby fillers (a spawned Thinker replaces the idle
  // Thinker figure; it never duplicates it).
  const walkers = useMemo(
    () => officeWalkerCast(floor.walkers),
    [floor.walkers],
  )
  const bubbleByAgent = useMemo(() => {
    const map = new Map<string, SpeechBubble>()
    for (const bubble of bubbles) map.set(bubble.agentId, bubble)
    return map
  }, [bubbles])

  // FID-2026-0901-003: completion spark bursts — when an agent's station
  // target releases (tool finished), a short particle burst fires at its
  // position. Purely visual; entries self-expire after 700ms.
  const [bursts, setBursts] = useState<Burst[]>([])

  useFrame(() => {
    const group = groupRef.current
    if (group === null) return
    stepper.step({
      group,
      walkers,
      now: performance.now(),
      reduced,
      onBurst: (burst) => {
        setBursts((current) => [...current.slice(-5), burst])
      },
      accentFor: (roleId) => roleAccent(roleId as DeckRoleId),
    })
  })

  return (
    <group ref={groupRef}>
      {/* FID-2026-0901-003: completion spark bursts + streaming indicators */}
      {bursts.map((burst) => (
        <SparkBurst
          key={burst.key}
          x={burst.x}
          z={burst.z}
          color={burst.color}
          startMs={burst.startMs}
          onDone={() =>
            setBursts((current) =>
              current.filter((entry) => entry.key !== burst.key),
            )
          }
        />
      ))}
      {walkers.map((walker) => (
        <AgentCharacter
          key={walker.agentId}
          walker={walker}
          position={
            walker.roleId === 'savant'
              ? savantSpot()
              : homePosition(walker.padIndex)
          }
          walking={walker.stationTarget !== null}
          bobY={0}
          bubble={bubbleByAgent.get(walker.agentId)}
          movingMap={stepper.movingMap}
          isThinking={makeThinkingPredicate(walker, floor)}
        />
      ))}
    </group>
  )
}

export function OfficeScene({
  floor,
  bubbles = [],
  processing = false,
  model = null,
}: OfficeSceneProps): JSX.Element {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 24, 30], fov: 48, near: 0.1, far: 150 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#0a0e16']} />
      <fog attach="fog" args={['#0a0e16', 55, 130]} />
      {/* Living lighting: day/night cycle + sweeping ceiling spotlights. */}
      <LivingLights />
      <CameraRig />
      <OfficeEnvironment floor={floor} />
      <OfficeContents floor={floor} bubbles={bubbles} />
      {/* P18: processing ring at the central emblem. P21: the model name is
          a wall neon banner, not a floor Billboard. */}
      <ProcessingRing active={processing} />
      <WallModelSign model={model} />
      <NeonAtmosphere />
    </Canvas>
  )
}
