// FID-2026-0905-005 — office-scene decomposition: environment decor.
//
// The static environment structure: neon line helper, perimeter walls,
// plants, bookshelves, floor grid, window strips. Components are verbatim
// moves from office-scene.tsx (PbrSet declared before use — Loop-2 fix of
// the monolith's after-use declaration). The brand emblem lives in
// scene-identity.tsx (ceiling split).

import { DECK_TOKENS } from '../deck-tokens.generated'
import { OFFICE_DEPTH, OFFICE_WIDTH, WALL_HEIGHT } from './scene-constants'

import type { JSX } from 'react'
import type * as THREE from 'three'

export type PbrSet = {
  map: THREE.Texture | null
  roughnessMap: THREE.Texture | null
}

function NeonLine({
  position,
  rotation = [0, 0, 0],
  length,
  color,
}: {
  readonly position: [number, number, number]
  readonly rotation?: [number, number, number]
  readonly length: number
  readonly color: string
}): JSX.Element {
  const args: [number, number, number] = [length, 0.06, 0.06]
  return (
    <mesh position={position} rotation={rotation}>
      <boxGeometry args={args} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  )
}

/** One perimeter wall: dark panel texture with a thin cap trim on top. */
export function PerimeterWall({
  center,
  length,
  axis,
  panels,
}: {
  readonly center: [number, number]
  readonly length: number
  readonly axis: 'x' | 'z'
  readonly panels: PbrSet
}): JSX.Element {
  const thickness = 0.25
  const capHeight = 0.08
  const dims = (
    along: number,
    height: number,
    across: number,
  ): [number, number, number] =>
    axis === 'x' ? [along, height, across] : [across, height, along]
  return (
    <group position={[center[0], 0, center[1]]}>
      <mesh position={[0, WALL_HEIGHT / 2, 0]}>
        <boxGeometry args={dims(length, WALL_HEIGHT, thickness)} />
        <meshStandardMaterial
          map={panels.map ?? undefined}
          roughnessMap={panels.roughnessMap ?? undefined}
          color="#aeb6c2"
          roughness={0.8}
          metalness={0.25}
        />
      </mesh>
      <mesh position={[0, WALL_HEIGHT + capHeight / 2, 0]}>
        <boxGeometry args={dims(length, capHeight, thickness + 0.06)} />
        <meshStandardMaterial
          color="#2b2f33"
          roughness={0.42}
          metalness={0.68}
        />
      </mesh>
    </group>
  )
}

/** Layered foliage clumps on a planter pot (Hermes planter pattern). */
export function OfficePlant({
  position,
  scale = 1,
}: {
  readonly position: [number, number, number]
  readonly scale?: number
}): JSX.Element {
  const clumps: {
    readonly offset: [number, number, number]
    readonly scale: [number, number, number]
    readonly color: string
  }[] = [
    { offset: [-0.14, 0, 0.02], scale: [0.3, 0.14, 0.17], color: '#4e7a2f' },
    {
      offset: [0.03, 0.05, -0.04],
      scale: [0.34, 0.16, 0.19],
      color: '#5f8f38',
    },
    { offset: [0.15, 0.01, 0.03], scale: [0.27, 0.12, 0.16], color: '#6da345' },
  ]
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.26, 0]}>
        <cylinderGeometry args={[0.34, 0.28, 0.52, 14]} />
        <meshStandardMaterial
          color="#5a4632"
          roughness={0.85}
          metalness={0.05}
        />
      </mesh>
      <group position={[0, 0.62, 0]}>
        {clumps.map((clump, index) => (
          <mesh
            key={`clump-${index}`}
            position={clump.offset}
            scale={clump.scale}
          >
            <sphereGeometry args={[1, 12, 10]} />
            <meshStandardMaterial
              color={clump.color}
              roughness={0.98}
              metalness={0}
            />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/**
 * Bookshelf: dark frame, shelves, and two rows of colored book spines —
 * seeded variation so no two shelves repeat.
 */
export function Bookshelf({
  position,
  rotation = 0,
  seed = 1,
}: {
  readonly position: [number, number, number]
  readonly rotation?: number
  readonly seed?: number
}): JSX.Element {
  const spineColors = ['#8a3b2c', '#2c5a8a', '#3d7a4a', '#8a6b2c', '#5a3d7a']
  const books: JSX.Element[] = []
  for (let shelf = 0; shelf < 3; shelf += 1) {
    let x = -0.62
    let index = 0
    while (x < 0.55) {
      const w = 0.05 + hash01(seed * 31 + shelf * 7 + index) * 0.06
      const h = 0.34 + hash01(seed * 17 + shelf * 13 + index) * 0.12
      const color = spineColors[(seed + shelf * 3 + index) % spineColors.length]
      books.push(
        <mesh
          key={`b-${shelf}-${index}`}
          position={[x + w / 2, 0.1 + h / 2, -0.14 + (shelf % 2) * 0.28]}
        >
          <boxGeometry args={[w, h, 0.2]} />
          <meshStandardMaterial
            color={color}
            roughness={0.85}
            metalness={0.05}
          />
        </mesh>,
      )
      x += w + 0.012
      index += 1
    }
  }
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.95, 0]}>
        <boxGeometry args={[1.5, 1.9, 0.42]} />
        <meshStandardMaterial color="#20262e" roughness={0.6} metalness={0.3} />
      </mesh>
      {[0.45, 0.95, 1.45].map((y) => (
        <mesh key={`shelf-${y}`} position={[0, y, 0]}>
          <boxGeometry args={[1.4, 0.05, 0.36]} />
          <meshStandardMaterial
            color="#2c343e"
            roughness={0.55}
            metalness={0.35}
          />
        </mesh>
      ))}
      {books}
    </group>
  )
}

/** Deterministic 0..1 hash for book variation (module-local). */
function hash01(seed: number): number {
  let h = seed * 374761393
  h = (h ^ (h >> 13)) * 1274126177
  return ((h ^ (h >> 16)) >>> 0) / 4294967295
}

/** Neon floor grid: thin cyan lines in both directions (Tron-style). */
export function FloorGrid(): JSX.Element {
  const lines: JSX.Element[] = []
  for (const offset of [-14, -7, 0, 7, 14]) {
    lines.push(
      <mesh key={`x-${offset}`} position={[0, 0.02, offset]}>
        <boxGeometry args={[OFFICE_WIDTH - 3, 0.02, 0.07]} />
        <meshBasicMaterial
          color={DECK_TOKENS.primary}
          transparent
          opacity={0.55}
          toneMapped={false}
        />
      </mesh>,
      <mesh key={`z-${offset}`} position={[offset, 0.02, 0]}>
        <boxGeometry args={[0.07, 0.02, OFFICE_DEPTH - 3]} />
        <meshBasicMaterial
          color={DECK_TOKENS.primary}
          transparent
          opacity={0.55}
          toneMapped={false}
        />
      </mesh>,
    )
  }
  return <group>{lines}</group>
}

/** Glowing window panels — city-night view, cyan on the back wall and
 * magenta on the side wall: the neon-noir accent pair. */
export function WindowStrip({
  color,
  rotation = 0,
  center,
}: {
  readonly color: string
  readonly rotation?: number
  readonly center: [number, number, number]
}): JSX.Element {
  const frames: [number, number][] = [
    [-9, 0],
    [0, 0],
    [9, 0],
  ]
  return (
    <group position={center} rotation={[0, rotation, 0]}>
      {frames.map(([x, z], index) => (
        <group key={`win-${index}`} position={[x, 0, z]}>
          <mesh>
            <boxGeometry args={[5.6, 1.7, 0.08]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={0.8}
              toneMapped={false}
            />
          </mesh>
          <mesh position={[0, 0, 0.06]}>
            <boxGeometry args={[5.9, 1.95, 0.05]} />
            <meshStandardMaterial
              color="#11151b"
              roughness={0.5}
              metalness={0.6}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export { NeonLine }
