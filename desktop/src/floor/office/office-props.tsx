/**
 * FID-2026-0831-002 P7 — sci-fi prop layer for the office deck.
 *
 * The operator asked for MORE: bookshelves already exist in the scene; this
 * module adds the cyberpunk clutter that makes a floor read as lived-in —
 * server racks, glowing holo-columns, cargo crates, canisters, a charging
 * pad, and ceiling light strips. All deterministic (seeded), all authored
 * geometry + procedural materials — no bundled assets.
 *
 * Zero state: every component is a pure function of its props (same
 * discipline as the rest of the office modules).
 */

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
export function CargoStack({
  position,
  rotation = 0,
  seed = 1,
}: {
  readonly position: [number, number, number]
  readonly rotation?: number
  readonly seed?: number
}): JSX.Element {
  const crates = [
    { pos: [0, 0.3, 0], size: [0.6, 0.6, 0.6], color: '#232b36' },
    { pos: [0.62, 0.25, 0.1], size: [0.5, 0.5, 0.5], color: '#2b3442' },
    { pos: [0.1, 0.9, 0.05], size: [0.45, 0.45, 0.45], color: '#1d242e' },
  ] as const
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {crates.map((crate, index) => (
        <group
          key={`crate-${index}`}
          position={crate.pos as unknown as [number, number, number]}
        >
          <mesh>
            <boxGeometry
              args={crate.size as unknown as [number, number, number]}
            />
            <meshStandardMaterial
              color={crate.color}
              roughness={0.6}
              metalness={0.5}
            />
          </mesh>
          {/* Hazard stripe on the front face */}
          <NeonStrip
            position={[0, 0, crate.size[2] / 2 + 0.011]}
            size={[crate.size[0] * 0.8, 0.06, 0.01]}
            color={
              hash01(seed * 7 + index) > 0.5
                ? DECK_TOKENS.warning
                : DECK_TOKENS.primary
            }
            opacity={0.7}
          />
        </group>
      ))}
      {/* A fuel canister beside the stack */}
      <group position={[-0.75, 0, 0.3]} rotation={[0, seed, 0]}>
        <mesh position={[0, 0.35, 0]}>
          <capsuleGeometry args={[0.16, 0.4, 4, 10]} />
          <meshStandardMaterial
            color="#3a2f4a"
            roughness={0.4}
            metalness={0.6}
          />
        </mesh>
        <NeonStrip
          position={[0, 0.6, 0]}
          size={[0.05, 0.05, 0.05]}
          color={DECK_TOKENS.error}
          opacity={0.9}
        />
      </group>
    </group>
  )
}

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
export function CoffeeMachine({
  position,
  rotation = 0,
}: {
  readonly position: [number, number, number]
  readonly rotation?: number
}): JSX.Element {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Counter the machine sits on */}
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[1.5, 0.9, 0.7]} />
        <meshStandardMaterial
          color="#1c232d"
          roughness={0.35}
          metalness={0.65}
        />
      </mesh>
      <NeonStrip
        position={[0, 0.42, 0.36]}
        size={[1.3, 0.04, 0.02]}
        color={DECK_TOKENS.primary}
        opacity={0.7}
      />
      {/* Machine body */}
      <mesh position={[0, 1.18, -0.05]}>
        <boxGeometry args={[0.7, 0.62, 0.55]} />
        <meshStandardMaterial color="#232a34" roughness={0.4} metalness={0.6} />
      </mesh>
      {/* Brew panel — warm glow when in use */}
      <NeonStrip
        position={[0, 1.22, 0.24]}
        size={[0.34, 0.16, 0.01]}
        color="#ffb35c"
        opacity={0.95}
      />
      {/* Spout + carafe */}
      <mesh position={[0, 0.98, 0.08]}>
        <boxGeometry args={[0.16, 0.1, 0.16]} />
        <meshStandardMaterial color="#141a21" roughness={0.5} metalness={0.5} />
      </mesh>
      <mesh position={[0, 0.92, 0.08]}>
        <cylinderGeometry args={[0.11, 0.09, 0.16, 12]} />
        <meshStandardMaterial
          color="#2a2018"
          roughness={0.25}
          metalness={0.2}
          transparent
          opacity={0.85}
        />
      </mesh>
      {/* A waiting cup */}
      <mesh position={[0.42, 0.99, 0.12]}>
        <cylinderGeometry args={[0.05, 0.045, 0.09, 10]} />
        <meshStandardMaterial color="#b3543f" roughness={0.8} />
      </mesh>
    </group>
  )
}

/** Water cooler: bottle on a pedestal with a glowing status ring. */
export function WaterCooler({
  position,
  rotation = 0,
}: {
  readonly position: [number, number, number]
  readonly rotation?: number
}): JSX.Element {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[0.5, 1.0, 0.45]} />
        <meshStandardMaterial color="#1c232d" roughness={0.4} metalness={0.6} />
      </mesh>
      {/* Bottle */}
      <mesh position={[0, 1.22, 0]}>
        <cylinderGeometry args={[0.19, 0.16, 0.44, 14]} />
        <meshStandardMaterial
          color="#7fc4dd"
          roughness={0.15}
          metalness={0.05}
          transparent
          opacity={0.6}
        />
      </mesh>
      <NeonStrip
        position={[0, 0.86, 0.24]}
        size={[0.2, 0.03, 0.01]}
        color={DECK_TOKENS.primary}
        opacity={0.85}
      />
      {/* Cups dispenser on the side */}
      <mesh position={[0.33, 0.86, 0]}>
        <cylinderGeometry args={[0.07, 0.06, 0.28, 10]} />
        <meshStandardMaterial color="#2a2f36" roughness={0.5} metalness={0.4} />
      </mesh>
    </group>
  )
}

/** Fridge: tall dark cabinet, glowing door seal, handle. */
export function Fridge({
  position,
  rotation = 0,
}: {
  readonly position: [number, number, number]
  readonly rotation?: number
}): JSX.Element {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.95, 0]}>
        <boxGeometry args={[0.8, 1.9, 0.7]} />
        <meshStandardMaterial
          color="#181e26"
          roughness={0.35}
          metalness={0.7}
        />
      </mesh>
      {/* Door seal glow */}
      <NeonStrip
        position={[0, 1.35, 0.36]}
        size={[0.66, 0.03, 0.01]}
        color={DECK_TOKENS.primary}
        opacity={0.6}
      />
      {/* Handle */}
      <mesh position={[0.3, 1.1, 0.38]}>
        <boxGeometry args={[0.05, 0.5, 0.04]} />
        <meshStandardMaterial color="#3a424d" roughness={0.3} metalness={0.8} />
      </mesh>
    </group>
  )
}

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
