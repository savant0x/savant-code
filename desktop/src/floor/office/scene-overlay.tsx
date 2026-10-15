// FID-2026-0905-005 — office-scene decomposition: status overlays.
//
// P18 processing ring (spins + pulses while a run streams) and the P21
// wall-mounted neon model sign (fixed banner on the back wall — the stale
// P18 floor-Billboard comment from the monolith is dropped; the wall-sign
// behavior is verbatim).

import { Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'

import { formatModelLabel } from '../../lib/model-label'
import { DECK_TOKENS } from '../deck-tokens.generated'
import { OFFICE_DEPTH, REDUCED } from './scene-constants'

import type { JSX } from 'react'

/** P18 (operator: "when the chat is processing something, i want a red glow
 * to circle the center logo/circle ring"): an additive red ring around the
 * central emblem that spins + pulses while a run is streaming. Invisible
 * (and free) when idle. Reduced motion renders a static lit ring. */
export function ProcessingRing({
  active,
}: {
  readonly active: boolean
}): JSX.Element {
  const ringRef = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    const ring = ringRef.current
    if (ring === null) return
    ring.visible = active
    if (!active) return
    // Spin + breathe: rotation for motion, opacity pulse for urgency.
    ring.rotation.z = clock.elapsedTime * 1.6
    const material = ring.material as THREE.MeshBasicMaterial
    material.opacity = REDUCED
      ? 0.55
      : 0.38 + 0.22 * Math.sin(clock.elapsedTime * 4)
  })
  return (
    <mesh
      ref={ringRef}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.05, 0]}
      visible={false}
    >
      <ringGeometry args={[6.05, 6.55, 64, 1]} />
      <meshBasicMaterial
        color={DECK_TOKENS.error}
        transparent
        opacity={0.5}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

/** P21 (operator: "put the model name on a wall as a big banner/neon
 * sign"): a fixed wall-mounted neon sign on the BACK wall facing the camera
 * — not a floor Billboard. A dark signboard + neon glow frame + big model
 * label. Hidden when no model is known so it never reads as a bare empty
 * board. */
export function WallModelSign({
  model,
}: {
  readonly model: string | null
}): JSX.Element {
  const label = model !== null ? formatModelLabel(model).toUpperCase() : ''
  if (label.length === 0) return <></>
  const signWidth = 8.2
  const signHeight = 1.9
  const z = -OFFICE_DEPTH / 2 + 0.22
  return (
    <group position={[0, 2.55, z]}>
      {/* Signboard backing — dark, slightly larger than the text. */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[signWidth, signHeight, 0.06]} />
        <meshStandardMaterial
          color="#0d1118"
          roughness={0.5}
          metalness={0.55}
          emissive="#0a0e16"
          emissiveIntensity={0.3}
        />
      </mesh>
      {/* Neon glow frame — thin rounded rectangle in the accent. */}
      <mesh position={[0, 0, 0.035]}>
        <planeGeometry args={[signWidth - 0.22, signHeight - 0.22]} />
        <meshBasicMaterial
          color={DECK_TOKENS.border}
          transparent
          opacity={0.18}
        />
      </mesh>
      {/* Neon model text — bright primary glow, the big banner. */}
      <Text
        position={[0, 0, 0.05]}
        fontSize={0.62}
        color={DECK_TOKENS.primary}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.06}
        outlineWidth={0.022}
        outlineColor={DECK_TOKENS.primary}
        outlineOpacity={0.55}
      >
        {label}
      </Text>
      <Text
        position={[0, -0.78, 0.05]}
        fontSize={0.2}
        color={DECK_TOKENS.muted}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.26}
      >
        ACTIVE MODEL
      </Text>
    </group>
  )
}
