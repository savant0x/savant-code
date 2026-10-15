import { DECK_TOKENS } from '../deck-tokens.generated'
import { NeonStrip } from './office-props-tech'

import type { JSX } from 'react'

/** Deterministic 0..1 hash (module-local twin of the scene's helper). */
function hash01(seed: number): number {
  let h = Math.imul(seed | 0, 374761393)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
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
