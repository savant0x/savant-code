// FID-2026-0905-005 — office-scene decomposition: role desk props.
//
// The per-role desk artifact (P6c — operator: agents "have nothing related
// to that name/task visually"): a small per-role item on every home desk.
// Geometry is authored per role; the accent ties it to the cast color.
// Verbatim move from office-scene.tsx (ceiling split from scene-desks.tsx).

import type { JSX } from 'react'

export function RoleProp({
  role,
  accent,
}: {
  readonly role: string
  readonly accent: string
}): JSX.Element {
  const emissive = (
    <meshStandardMaterial
      color={accent}
      emissive={accent}
      emissiveIntensity={0.7}
      roughness={0.4}
      metalness={0.3}
    />
  )
  switch (role) {
    case 'forge':
      // Crucible with a burning core.
      return (
        <group>
          <mesh position={[0, 0.07, 0]}>
            <cylinderGeometry args={[0.09, 0.06, 0.14, 8]} />
            <meshStandardMaterial
              color="#2a2f36"
              roughness={0.5}
              metalness={0.6}
            />
          </mesh>
          <mesh position={[0, 0.15, 0]}>{emissive}</mesh>
        </group>
      )
    case 'thinker':
      // Floating thought orb over a ring base.
      return (
        <group>
          <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.07, 0.015, 8, 20]} />
            <meshStandardMaterial
              color="#2a2f36"
              roughness={0.5}
              metalness={0.6}
            />
          </mesh>
          <mesh position={[0, 0.13, 0]}>{emissive}</mesh>
        </group>
      )
    case 'detective':
      // Stacked case files.
      return (
        <group>
          <mesh position={[0, 0.03, 0]}>
            <boxGeometry args={[0.18, 0.05, 0.13]} />
            <meshStandardMaterial color="#4a3b2a" roughness={0.8} />
          </mesh>
          <mesh position={[0.015, 0.08, 0]} rotation={[0, 0.2, 0]}>
            <boxGeometry args={[0.18, 0.05, 0.13]} />
            <meshStandardMaterial color="#5a4632" roughness={0.8} />
          </mesh>
        </group>
      )
    case 'verifier':
      // Stamp/seal cone.
      return (
        <group>
          <mesh position={[0, 0.09, 0]}>
            <coneGeometry args={[0.06, 0.16, 10]} />
            <meshStandardMaterial
              color="#2a2f36"
              roughness={0.5}
              metalness={0.6}
            />
          </mesh>
          <mesh position={[0, 0.18, 0]}>{emissive}</mesh>
        </group>
      )
    case 'recorder':
    case 'scribe':
      // Ledger with a standing quill cylinder.
      return (
        <group>
          <mesh position={[-0.05, 0.025, 0]}>
            <boxGeometry args={[0.16, 0.05, 0.12]} />
            <meshStandardMaterial color="#31404f" roughness={0.7} />
          </mesh>
          <mesh position={[0.08, 0.09, 0]}>{emissive}</mesh>
        </group>
      )
    case 'scout':
      // Binocular cylinders.
      return (
        <group>
          <mesh position={[-0.035, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.028, 0.028, 0.12, 8]} />
            <meshStandardMaterial
              color="#2a2f36"
              roughness={0.5}
              metalness={0.6}
            />
          </mesh>
          <mesh position={[0.035, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.028, 0.028, 0.12, 8]} />
            <meshStandardMaterial
              color="#2a2f36"
              roughness={0.5}
              metalness={0.6}
            />
          </mesh>
        </group>
      )
    case 'researcher':
      // Flask.
      return (
        <group>
          <mesh position={[0, 0.07, 0]}>
            <cylinderGeometry args={[0.025, 0.05, 0.13, 8]} />
            <meshStandardMaterial
              color="#9fd8e8"
              roughness={0.2}
              metalness={0.1}
              transparent
              opacity={0.7}
            />
          </mesh>
          <mesh position={[0, 0.035, 0]}>{emissive}</mesh>
        </group>
      )
    case 'adversary':
      // Crossed red blades.
      return (
        <group>
          <mesh position={[0, 0.06, 0]} rotation={[0, 0, 0.6]}>
            <boxGeometry args={[0.02, 0.18, 0.02]} />
            <meshStandardMaterial
              color="#2a2f36"
              roughness={0.5}
              metalness={0.6}
            />
          </mesh>
          <mesh position={[0, 0.06, 0]} rotation={[0, 0, -0.6]}>
            <boxGeometry args={[0.02, 0.18, 0.02]} />
            {emissive}
          </mesh>
        </group>
      )
    default:
      // Small crate.
      return (
        <mesh position={[0, 0.05, 0]}>
          <boxGeometry args={[0.1, 0.1, 0.1]} />
          {emissive}
        </mesh>
      )
  }
}
