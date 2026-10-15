import { useMemo } from 'react'
import * as THREE from 'three'

import { DECK_TOKENS } from '../deck-tokens.generated'

import type { JSX } from 'react'

/** Deterministic 0..1 hash (module-local twin of the scene's helper). */
function hash01(seed: number): number {
  let h = Math.imul(seed | 0, 374761393)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

/** Neon strip: thin emissive bar — the recurring cyberpunk motif. */
export function NeonStrip({
  position,
  rotation = [0, 0, 0],
  size,
  color,
  opacity = 0.9,
}: {
  readonly position: [number, number, number]
  readonly rotation?: [number, number, number]
  readonly size: [number, number, number]
  readonly color: string
  readonly opacity?: number
}): JSX.Element {
  return (
    <mesh position={position} rotation={rotation}>
      <boxGeometry args={size} />
      <meshBasicMaterial
        color={color}
        toneMapped={false}
        transparent
        opacity={opacity}
      />
    </mesh>
  )
}

/** Server rack: dark cabinet with blinking activity lights (seeded). */

/** Server rack: dark cabinet with blinking activity lights (seeded). */
export function ServerRack({
  position,
  rotation = 0,
  seed = 1,
}: {
  readonly position: [number, number, number]
  readonly rotation?: number
  readonly seed?: number
}): JSX.Element {
  const lights = useMemo(() => {
    const rows: { y: number; x: number; color: string; on: boolean }[] = []
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        rows.push({
          y: 0.25 + row * 0.22,
          x: -0.3 + col * 0.3,
          color:
            hash01(seed * 13 + row * 7 + col) > 0.7 ? '#67d97e' : '#5fd8d8',
          on: hash01(seed * 29 + row * 11 + col) > 0.35,
        })
      }
    }
    return rows
  }, [seed])
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 1.05, 0]}>
        <boxGeometry args={[1.0, 2.1, 0.7]} />
        <meshStandardMaterial color="#171c24" roughness={0.4} metalness={0.7} />
      </mesh>
      {/* Front bezel */}
      <mesh position={[0, 1.05, 0.36]}>
        <boxGeometry args={[0.92, 2.0, 0.03]} />
        <meshStandardMaterial color="#0d1117" roughness={0.5} metalness={0.6} />
      </mesh>
      {lights.map((light, index) => (
        <mesh key={`lt-${index}`} position={[light.x, light.y, 0.39]}>
          <boxGeometry args={[0.07, 0.05, 0.02]} />
          <meshBasicMaterial
            color={light.color}
            toneMapped={false}
            transparent
            opacity={light.on ? 0.95 : 0.25}
          />
        </mesh>
      ))}
      {/* Top vent glow */}
      <NeonStrip
        position={[0, 2.12, 0]}
        size={[0.8, 0.02, 0.1]}
        color={DECK_TOKENS.primary}
        opacity={0.5}
      />
    </group>
  )
}

/** Holo column: a tall glass tube with a pulsing accent core. */

/** Holo column: a tall glass tube with a pulsing accent core. */
export function HoloColumn({
  position,
  color = DECK_TOKENS.primary,
  seed = 1,
}: {
  readonly position: [number, number, number]
  readonly color?: string
  readonly seed?: number
}): JSX.Element {
  const coreColor = seed % 2 === 0 ? color : DECK_TOKENS.error
  return (
    <group position={position}>
      {/* Base + cap */}
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.42, 0.5, 0.16, 12]} />
        <meshStandardMaterial color="#1a2028" roughness={0.4} metalness={0.7} />
      </mesh>
      <mesh position={[0, 2.3, 0]}>
        <cylinderGeometry args={[0.42, 0.42, 0.12, 12]} />
        <meshStandardMaterial color="#1a2028" roughness={0.4} metalness={0.7} />
      </mesh>
      {/* Glass tube */}
      <mesh position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.36, 0.36, 2.1, 12, 1, true]} />
        <meshStandardMaterial
          color="#9fd8e8"
          roughness={0.1}
          metalness={0.1}
          transparent
          opacity={0.18}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Pulsing core */}
      <mesh position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 1.7, 8]} />
        <meshBasicMaterial
          color={coreColor}
          toneMapped={false}
          opacity={0.85}
          transparent
        />
      </mesh>
      {/* Floating data rings */}
      {[0.7, 1.2, 1.7].map((y, index) => (
        <mesh
          key={`ring-${index}`}
          position={[0, y, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.2 + index * 0.04, 0.26 + index * 0.04, 24]} />
          <meshBasicMaterial
            color={coreColor}
            toneMapped={false}
            transparent
            opacity={0.4}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  )
}

/** Cargo crates + canisters: stacked sci-fi freight. */

/** Charging pad: a floor plate where idle robots "dock" — glowing ring. */
export function ChargingPad({
  position,
  color = DECK_TOKENS.primary,
}: {
  readonly position: [number, number, number]
  readonly color?: string
}): JSX.Element {
  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <circleGeometry args={[0.9, 32]} />
        <meshStandardMaterial color="#141a23" roughness={0.3} metalness={0.8} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
        <ringGeometry args={[0.72, 0.82, 32]} />
        <meshBasicMaterial
          color={color}
          toneMapped={false}
          transparent
          opacity={0.75}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Small connector nub */}
      <mesh position={[0, 0.12, -0.85]}>
        <boxGeometry args={[0.3, 0.22, 0.12]} />
        <meshStandardMaterial color="#1a2028" roughness={0.4} metalness={0.7} />
      </mesh>
    </group>
  )
}

/** Ceiling light strips: cool bars with cyan trim, hanging over the floor. */

/** Ceiling light strips: cool bars with cyan trim, hanging over the floor. */
export function CeilingStrips({
  width,
  depth,
}: {
  readonly width: number
  readonly depth: number
}): JSX.Element {
  // P8 (operator: "3 black beams, middle clipping through Savant's head"):
  // hang the strips near the ceiling OUTSIDE the central bay so none of them
  // ever intersects the tall Savant figure standing at the emblem. The center
  // is left open (no beam at z=0) and everything is raised to WALL_HEIGHT+.
  const rows = [-depth / 3, depth / 3]
  return (
    <group>
      {rows.map((z, index) => (
        <group key={`strip-${index}`} position={[0, 3.32, z]}>
          <mesh>
            <boxGeometry args={[width * 0.5, 0.07, 0.5]} />
            <meshStandardMaterial
              color="#1c232d"
              roughness={0.4}
              metalness={0.7}
            />
          </mesh>
          <NeonStrip
            position={[0, -0.05, 0]}
            size={[width * 0.45, 0.02, 0.3]}
            color="#dfe8ff"
            opacity={0.85}
          />
        </group>
      ))}
    </group>
  )
}

// ─── FID-2026-0901-003: break-area furniture ────────────────────────────────

/** Coffee machine: dark body, glowing brew panel, carafe, tiny cup. */
