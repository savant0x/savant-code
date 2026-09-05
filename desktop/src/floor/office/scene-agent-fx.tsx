// FID-2026-0905-005 — office-scene decomposition: agent FX overlays.
//
// Self-animating per-agent effects: the completion spark burst and the
// thinking indicator (status pill + pulsing dots behind the P19
// self-evaluating toggle). Verbatim moves from office-scene.tsx (ceiling
// split from scene-agent-ui.tsx).

import { Billboard, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'

import { DECK_TOKENS } from '../deck-tokens.generated'

import type { JSX } from 'react'
import type * as THREE from 'three'

/** FID-2026-0901-003: completion spark burst — a ring of small emissive
 * particles that flies outward and fades over ~700ms when an agent finishes
 * a tool run. Self-removes via onDone. */
const BURST_LIFETIME_MS = 700

export function SparkBurst({
  x,
  z,
  color,
  startMs,
  onDone,
}: {
  readonly x: number
  readonly z: number
  readonly color: string
  readonly startMs: number
  readonly onDone: () => void
}): JSX.Element {
  const groupRef = useRef<THREE.Group>(null)
  const doneRef = useRef(false)
  const particles = useMemo(
    () =>
      Array.from({ length: 10 }, (_, index) => {
        const angle = (index / 10) * Math.PI * 2
        return {
          dx: Math.cos(angle),
          dz: Math.sin(angle),
          dy: 0.5 + (index % 3) * 0.2,
        }
      }),
    [],
  )
  useFrame(() => {
    const elapsed = performance.now() - startMs
    if (elapsed > BURST_LIFETIME_MS) {
      if (!doneRef.current) {
        doneRef.current = true
        onDone()
      }
      return
    }
    const group = groupRef.current
    if (group === null) return
    const t = elapsed / BURST_LIFETIME_MS
    const spread = 0.2 + t * 1.1
    group.children.forEach((child, index) => {
      const particle = particles[index]
      if (particle === undefined) return
      child.position.set(
        particle.dx * spread,
        particle.dy * (1 - t) + 0.3,
        particle.dz * spread,
      )
      const mesh = child as THREE.Mesh
      const material = mesh.material as THREE.MeshBasicMaterial
      material.opacity = 1 - t
    })
  })
  return (
    <group ref={groupRef} position={[x, 0, z]}>
      {particles.map((particle, index) => (
        <mesh key={`p-${index}`}>
          <sphereGeometry args={[0.06, 6, 6]} />
          <meshBasicMaterial
            color={color}
            transparent
            toneMapped={false}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  )
}

/** FID-2026-0901-006: an explicit status pill floating above a working
 * agent. Rendered as a billboarded rounded label with the role accent. */
function ThinkingStatus({
  accent,
  y,
}: {
  readonly accent: string
  readonly y: number
}): JSX.Element {
  return (
    <Billboard position={[0, y, 0]}>
      <mesh>
        <planeGeometry args={[1.5, 0.42]} />
        <meshBasicMaterial
          color={DECK_TOKENS.background}
          transparent
          opacity={0.92}
        />
      </mesh>
      <Text
        fontSize={0.17}
        color={accent}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.012}
        outlineColor={DECK_TOKENS.background}
      >
        Thinking…
      </Text>
    </Billboard>
  )
}

/** FID-2026-0901-003: streaming indicator — three dots pulsing in sequence
 * above a WORKING agent (chat is producing output for that agent). */
function ThinkingDots({
  accent,
  y,
}: {
  readonly accent: string
  readonly y: number
}): JSX.Element {
  const groupRef = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const group = groupRef.current
    if (group === null) return
    group.children.forEach((child, index) => {
      const phase = clock.elapsedTime * 3 - index * 0.9
      const mesh = child as THREE.Mesh
      const material = mesh.material as THREE.MeshBasicMaterial
      material.opacity = 0.35 + 0.65 * Math.max(0, Math.sin(phase))
      child.position.y = 0.06 * Math.max(0, Math.sin(phase))
    })
  })
  return (
    <group ref={groupRef} position={[0, y, 0]}>
      {[-0.18, 0, 0.18].map((x) => (
        <mesh key={`dot-${x}`} position={[x, 0, 0]}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshBasicMaterial
            color={accent}
            transparent
            toneMapped={false}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  )
}

/**
 * P19: self-evaluating thinking indicator — calls the predicate every frame
 * and toggles only its own (tiny) render. React bails out when the value is
 * unchanged, so an idle scene costs one boolean compare per agent per frame.
 */
export function ThinkingIndicator({
  isThinking,
  accent,
  y,
}: {
  readonly isThinking: () => boolean
  readonly accent: string
  readonly y: number
}): JSX.Element {
  const [on, setOn] = useState(isThinking)
  useFrame(() => {
    const next = isThinking()
    setOn((prev) => (prev === next ? prev : next))
  })
  if (!on) return <></>
  return (
    <>
      <ThinkingStatus accent={accent} y={y + 0.4} />
      <ThinkingDots accent={accent} y={y} />
    </>
  )
}
