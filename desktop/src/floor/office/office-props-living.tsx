import { useMemo } from 'react'

/** Deterministic 0..1 hash (module-local twin of the scene's helper). */
function hash01(seed: number): number {
  let h = Math.imul(seed | 0, 374761393)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

import { DECK_TOKENS } from '../deck-tokens.generated'
import { NeonStrip } from './office-props-tech'

import type { JSX } from 'react'

/** Couch: dark upholstered lounge with accent piping — the noir break spot. */
export function Couch({
  position,
  rotation = 0,
}: {
  readonly position: [number, number, number]
  readonly rotation?: number
}): JSX.Element {
  const cushion = '#2c3644'
  const body = '#232b37'
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Base */}
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[2.6, 0.35, 1.0]} />
        <meshStandardMaterial color={body} roughness={0.9} metalness={0.05} />
      </mesh>
      {/* Backrest */}
      <mesh position={[0, 0.72, -0.36]}>
        <boxGeometry args={[2.6, 0.65, 0.28]} />
        <meshStandardMaterial color={body} roughness={0.9} metalness={0.05} />
      </mesh>
      {/* Armrests */}
      {[-1.22, 1.22].map((x) => (
        <mesh key={`arm-${x}`} position={[x, 0.52, 0]}>
          <boxGeometry args={[0.16, 0.45, 1.0]} />
          <meshStandardMaterial
            color={cushion}
            roughness={0.9}
            metalness={0.05}
          />
        </mesh>
      ))}
      {/* Seat cushions */}
      {[-0.6, 0.6].map((x) => (
        <mesh key={`seat-${x}`} position={[x, 0.5, 0.05]}>
          <boxGeometry args={[1.16, 0.14, 0.88]} />
          <meshStandardMaterial
            color={cushion}
            roughness={0.95}
            metalness={0}
          />
        </mesh>
      ))}
      {/* Accent piping along the base — the neon touch */}
      <NeonStrip
        position={[0, 0.12, 0.51]}
        size={[2.4, 0.03, 0.01]}
        color={DECK_TOKENS.primary}
        opacity={0.55}
      />
      {/* Legs */}
      {(
        [
          [-1.1, -0.35],
          [1.1, -0.35],
          [-1.1, 0.35],
          [1.1, 0.35],
        ] as const
      ).map(([x, z], index) => (
        <mesh key={`leg-${index}`} position={[x, 0.06, z]}>
          <cylinderGeometry args={[0.035, 0.035, 0.12, 8]} />
          <meshStandardMaterial
            color="#14181e"
            roughness={0.4}
            metalness={0.7}
          />
        </mesh>
      ))}
    </group>
  )
}

/** Whiteboard: wall-style board on legs with faint marker scrawls. */

/** Whiteboard: wall-style board on legs with faint marker scrawls. */
export function Whiteboard({
  position,
  rotation = 0,
  seed = 1,
}: {
  readonly position: [number, number, number]
  readonly rotation?: number
  readonly seed?: number
}): JSX.Element {
  const scrawls = useMemo(() => {
    const marks: { x: number; y: number; w: number; c: string }[] = []
    const colors = ['#5fd8d8', '#ff6b9d', '#ffd35c']
    for (let index = 0; index < 7; index += 1) {
      marks.push({
        x: -1.0 + hash01(seed * 13 + index) * 2.0,
        y: 0.5 + hash01(seed * 29 + index) * 0.7,
        w: 0.2 + hash01(seed * 31 + index) * 0.5,
        c: colors[Math.floor(hash01(seed * 37 + index) * colors.length)],
      })
    }
    return marks
  }, [seed])
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Board face */}
      <mesh position={[0, 1.55, 0]}>
        <boxGeometry args={[2.6, 1.5, 0.06]} />
        <meshStandardMaterial
          color="#0f141b"
          roughness={0.25}
          metalness={0.4}
        />
      </mesh>
      {/* Frame */}
      <mesh position={[0, 1.55, 0.045]}>
        <boxGeometry args={[2.72, 1.62, 0.03]} />
        <meshStandardMaterial color="#232a34" roughness={0.4} metalness={0.6} />
      </mesh>
      {/* Marker scrawls (planner brain-space) */}
      {scrawls.map((mark, index) => (
        <mesh
          key={`scrawl-${index}`}
          position={[mark.x, 1.3 + mark.y * 0.6, 0.08]}
        >
          <boxGeometry args={[mark.w, 0.035, 0.01]} />
          <meshBasicMaterial
            color={mark.c}
            toneMapped={false}
            opacity={0.8}
            transparent
          />
        </mesh>
      ))}
      {/* Legs */}
      {[-1.1, 1.1].map((x) => (
        <mesh key={`leg-${x}`} position={[x, 0.4, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.8, 8]} />
          <meshStandardMaterial
            color="#232a34"
            roughness={0.4}
            metalness={0.6}
          />
        </mesh>
      ))}
    </group>
  )
}
