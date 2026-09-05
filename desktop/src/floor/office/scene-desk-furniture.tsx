// FID-2026-0905-005 — office-scene decomposition: desk furniture.
//
// Shared desk furniture: the office chair and the per-desk accent lamp.
// Split from scene-desks.tsx (Wave-1 ceiling split); verbatim moves from
// office-scene.tsx.

import * as THREE from 'three'

import type { JSX } from 'react'

/** Office chair: seat, back, pole, base — fabric and dark plastic. */
export function OfficeChair({
  position,
  rotation = 0,
}: {
  readonly position: [number, number, number]
  readonly rotation?: number
}): JSX.Element {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.46, 0]}>
        <boxGeometry args={[0.56, 0.09, 0.56]} />
        <meshStandardMaterial
          color="#3d4854"
          roughness={0.9}
          metalness={0.05}
        />
      </mesh>
      <mesh position={[0, 0.78, 0.26]}>
        <boxGeometry args={[0.52, 0.6, 0.09]} />
        <meshStandardMaterial
          color="#3d4854"
          roughness={0.9}
          metalness={0.05}
        />
      </mesh>
      <mesh position={[0, 0.24, 0]}>
        <cylinderGeometry args={[0.045, 0.045, 0.42, 10]} />
        <meshStandardMaterial color="#23272c" roughness={0.5} metalness={0.7} />
      </mesh>
      <mesh position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.32, 0.34, 0.07, 14]} />
        <meshStandardMaterial color="#23272c" roughness={0.5} metalness={0.7} />
      </mesh>
    </group>
  )
}

/** Desk lamp with a muted accent shade — the per-desk neon touch. */
export function DeskLamp({
  position,
  accent,
}: {
  readonly position: [number, number, number]
  readonly accent: string
}): JSX.Element {
  return (
    <group position={position}>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.09, 0.11, 0.06, 12]} />
        <meshStandardMaterial color="#23272c" roughness={0.5} metalness={0.7} />
      </mesh>
      <mesh position={[0.1, 0.2, 0]} rotation={[0, 0, -0.5]}>
        <cylinderGeometry args={[0.02, 0.02, 0.34, 8]} />
        <meshStandardMaterial color="#23272c" roughness={0.5} metalness={0.7} />
      </mesh>
      <mesh position={[0.22, 0.36, 0]} rotation={[0, 0, 0.5]}>
        <coneGeometry args={[0.12, 0.16, 12, 1, true]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={0.8}
          roughness={0.6}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}
