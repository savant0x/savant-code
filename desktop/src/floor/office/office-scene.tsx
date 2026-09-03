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
 */

import { Billboard, OrbitControls, Text } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

import { DECK_TOKENS } from '../deck-tokens.generated'
import { DECK_ROLE_IDS, ROLE_LABELS, roleAccent } from '../roles'
import { NeonAtmosphere } from './neon-atmosphere'
import {
  ARRIVE_EPSILON,
  breakDwellMs,
  breakKindFor,
  breakLingerMs,
  distance2d,
  idleBob,
  prefersReducedMotion,
  routeAround,
  separationOffset,
  walkBob,
  walkPose,
} from './office-motion'
import { OfficeNameplate } from './office-nameplate'
import {
  breakUseSpot,
  deskFaceTarget,
  deskPosition,
  homePosition,
  savantSpot,
  SPAWN_POINT,
  standSpot,
  TOOL_DESKS,
  WALK_OBSTACLES,
} from './office-plan'
import {
  CeilingStrips,
  CoffeeMachine,
  Couch,
  CargoStack,
  ChargingPad,
  Fridge,
  HoloColumn,
  ServerRack,
  WaterCooler,
  Whiteboard,
} from './office-props'
import { officeWalkerCast } from './office-walker-cast'
import {
  getDarkPanelTextures,
  getTechFloorTextures,
} from './procedural-textures'
import {
  castModelUrlForPad,
  createOfficeRobotFigure,
  loadCastTemplate,
} from './robot-cast'
import { AgentSpeechBubble } from './speech-bubble-3d'
import { formatModelLabel } from '../../lib/model-label'
import { buildFallbackFigure, ROBOT_TARGET_HEIGHT } from '../stage/deck-robots'

import type { Vec2 } from './office-motion'
import type { BreakSpot } from './office-plan'
import type { SpeechBubble } from './speech-bubbles'
import type { FloorState, WalkerState } from '../adapter/floor-adapter'
import type { RobotFigure } from '../stage/deck-robots'
import type { JSX } from 'react'

const OFFICE_WIDTH = 42
const OFFICE_DEPTH = 38
const WALL_HEIGHT = 3.4
// Savant is taller than the cast, so its nameplate rides higher than the
// specialists' (which sit at NAMEPLATE_Y). Kept below the ceiling beams
// (raised in office-props.tsx) so it never pokes through.
const NAMEPLATE_Y = 2.45
const REDUCED = prefersReducedMotion()

/** The real Savant brand character (assets/logo.png, copied into the
 * desktop public dir for the renderer). */
const SAVANT_LOGO_URL = '/floor-assets/emblem/savant-logo.png'
/** Which axis a vendored robot GLB faces by default, in radians.
 * 0 = +Z. Quaternius/Khronos rigs face +Z, so travelling direction angle
 * `atan2(dx, dz)` is used directly. If a model read face-backwards, set PI. */
const MODEL_FORWARD_OFFSET = 0

/** Dark metal desk-top tints rotated per desk so the floor does not read
 * as a single repeated slab. */
const DESK_METAL_TONES = ['#1c232d', '#222a35', '#181e27'] as const
/** Cast figures normalize to office-world height (pad ring radius 16). */
const ROBOT_OFFICE_HEIGHT = 1.85

type LivePositions = Map<string, Vec2>

function targetFor(walker: WalkerState): Vec2 {
  if (walker.stationTarget !== null)
    return standSpot(deskPosition(walker.stationTarget))
  // P6c: the orchestrator's home is the command tile, not a pad slot.
  return walker.roleId === 'savant'
    ? savantSpot()
    : standSpot(homePosition(walker.padIndex))
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

/** Load the Savant brand logo as a texture, cached so repeated reads share
 * it. Returns null until the PNG arrives (the emblem just shows empty). */
function useSavantLogoTexture(): THREE.Texture | null {
  const [texture, setTexture] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    let cancelled = false
    const loader = new THREE.TextureLoader()
    loader.load(
      SAVANT_LOGO_URL,
      (loaded) => {
        if (cancelled) return
        loaded.colorSpace = THREE.SRGBColorSpace
        loaded.anisotropy = 8
        setTexture(loaded)
      },
      undefined,
      () => {
        // Stream/fetch failure: leave the emblem empty, never throw.
        if (!cancelled) setTexture(null)
      },
    )
    return () => {
      cancelled = true
    }
  }, [])
  return texture
}

/** The central floor emblem — the real Savant character logo (operator: "change
 * the logo on the ground to the savant logo i attached"). Blacked-out bust with
 * a cyan neon glow outline. A flat, additive-tinted plane decal on the pad. */
function SavantLogo({
  texture,
}: {
  readonly texture: THREE.Texture | null
}): JSX.Element {
  return (
    <group>
      {/* Dark glossy command tile */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <circleGeometry args={[6.2, 48]} />
        <meshStandardMaterial
          color="#10161f"
          roughness={0.25}
          metalness={0.75}
        />
      </mesh>
      {/* Outer neon ring — heavily dimmed so it reads as a subtle inlay edge
       * (operator: "the savant logo is still too bright"). */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[5.7, 5.95, 56]} />
        <meshBasicMaterial
          color={DECK_TOKENS.primary}
          transparent
          opacity={0.18}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* The brand character bust at a much lower opacity — a faint floor
       * inlay, not a glowing sign. The logo's own bright cyan is the culprit
       * under bloom, so we drop the map opacity hard. */}
      {texture !== null ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
          <planeGeometry args={[7.0, 7.0]} />
          <meshBasicMaterial
            map={texture}
            transparent
            opacity={0.22}
            toneMapped={false}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ) : null}
    </group>
  )
}

/** One perimeter wall: dark panel texture with a thin cap trim on top. */
function PerimeterWall({
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

type PbrSet = {
  map: THREE.Texture | null
  roughnessMap: THREE.Texture | null
}

/** Layered foliage clumps on a planter pot (Hermes planter pattern). */
function OfficePlant({
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
} /**
 * Bookshelf: dark frame, shelves, and two rows of colored book spines —
 * seeded variation so no two shelves repeat (operator: "we need bookshelfs").
 */
function Bookshelf({
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

/**
 * Role desk prop (P6c — operator: agents "have nothing related to that
 * name/task visually"): a small per-role artifact on every home desk.
 * Geometry is authored per role; the accent ties it to the cast color.
 */
function RoleProp({
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

/** Neon floor grid: thin cyan lines in both directions (Tron-style). */
function FloorGrid(): JSX.Element {
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
function WindowStrip({
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

function OfficeEnvironment({
  floor,
}: {
  readonly floor: FloorState
}): JSX.Element {
  const activeStations = useMemo(
    () => new Set([...floor.pendingTools.values()].map((tool) => tool.station)),
    [floor.pendingTools],
  )
  const tech = useMemo(() => getTechFloorTextures(), [])
  const panels = useMemo(() => getDarkPanelTextures(), [])
  const savantLogo = useSavantLogoTexture()
  useMemo(() => {
    if (tech.map) tech.map.repeat.set(12, 10)
    if (panels.map) panels.map.repeat.set(8, 2)
  }, [tech, panels])
  return (
    <group>
      {/* Dark metal tech floor with cyan seam lines */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[OFFICE_WIDTH, OFFICE_DEPTH]} />
        <meshStandardMaterial
          map={tech.map ?? undefined}
          roughnessMap={tech.roughnessMap ?? undefined}
          color="#ffffff"
          roughness={0.4}
          metalness={0.5}
        />
      </mesh>
      {/* Neon floor grid — the cyberpunk ground design */}
      <FloorGrid />
      {/* Bookshelves along the walls (operator: "we need bookshelfs") */}
      <Bookshelf position={[-17, 0, -OFFICE_DEPTH / 2 + 0.4]} seed={3} />
      <Bookshelf position={[17, 0, -OFFICE_DEPTH / 2 + 0.4]} seed={11} />
      <Bookshelf
        position={[-OFFICE_WIDTH / 2 + 0.4, 0, 8]}
        rotation={Math.PI / 2}
        seed={19}
      />
      <Bookshelf
        position={[-OFFICE_WIDTH / 2 + 0.4, 0, -6]}
        rotation={Math.PI / 2}
        seed={27}
      />
      {/* Center: the real Savant brand character on the command tile (P7) */}
      <SavantLogo texture={savantLogo} />
      {/* Perimeter walls */}
      <PerimeterWall
        center={[0, -OFFICE_DEPTH / 2]}
        length={OFFICE_WIDTH}
        axis="x"
        panels={panels}
      />
      <PerimeterWall
        center={[0, OFFICE_DEPTH / 2]}
        length={OFFICE_WIDTH}
        axis="x"
        panels={panels}
      />
      <PerimeterWall
        center={[-OFFICE_WIDTH / 2, 0]}
        length={OFFICE_DEPTH}
        axis="z"
        panels={panels}
      />
      <PerimeterWall
        center={[OFFICE_WIDTH / 2, 0]}
        length={OFFICE_DEPTH}
        axis="z"
        panels={panels}
      />
      <WindowStrip
        color={DECK_TOKENS.inlineCodeFg}
        center={[0, 1.9, -OFFICE_DEPTH / 2 + 0.14]}
      />
      <WindowStrip
        color={DECK_TOKENS.error}
        rotation={-Math.PI / 2}
        center={[OFFICE_WIDTH / 2 - 0.14, 1.9, 0]}
      />
      {/* Thin neon baseboard lines along the windowed walls. */}
      <NeonLine
        position={[0, 0.12, -OFFICE_DEPTH / 2 + 0.16]}
        length={OFFICE_WIDTH - 6}
        color={DECK_TOKENS.primary}
      />
      <NeonLine
        position={[OFFICE_WIDTH / 2 - 0.16, 0.12, 0]}
        length={OFFICE_DEPTH - 6}
        color={DECK_TOKENS.error}
        rotation={[0, Math.PI / 2, 0]}
      />
      {/* Corner plants */}
      <OfficePlant
        position={[-OFFICE_WIDTH / 2 + 1.6, 0, -OFFICE_DEPTH / 2 + 1.6]}
        scale={1.5}
      />
      <OfficePlant
        position={[OFFICE_WIDTH / 2 - 1.6, 0, -OFFICE_DEPTH / 2 + 1.6]}
        scale={1.2}
      />
      <OfficePlant
        position={[-OFFICE_WIDTH / 2 + 1.6, 0, OFFICE_DEPTH / 2 - 1.6]}
        scale={1.2}
      />
      <OfficePlant
        position={[OFFICE_WIDTH / 2 - 1.6, 0, OFFICE_DEPTH / 2 - 1.6]}
        scale={1.5}
      />
      {TOOL_DESKS.map((desk) => (
        <ToolDesk
          key={desk.id}
          label={desk.label}
          accent={desk.accent}
          position={desk.position}
          busy={activeStations.has(desk.id)}
        />
      ))}
      {Array.from({ length: 9 }, (_, index) => (
        <HomeDesk key={`home-${index}`} index={index} />
      ))}
      <CommandConsole
        active={floor.savantPresent || floor.pendingTools.size > 0}
      />
      {/* Sci-fi prop layer (P7 — operator: "more models... get creative") */}
      <CeilingStrips width={OFFICE_WIDTH} depth={OFFICE_DEPTH} />
      <ServerRack position={[-OFFICE_WIDTH / 2 + 1.1, 0, -10]} seed={5} />
      <ServerRack position={[-OFFICE_WIDTH / 2 + 1.1, 0, -8.6]} seed={9} />
      <ServerRack
        position={[OFFICE_WIDTH / 2 - 1.1, 0, 12]}
        rotation={Math.PI}
        seed={13}
      />
      <HoloColumn position={[7.5, 0, -12.5]} seed={2} />
      <HoloColumn position={[-7.5, 0, -12.5]} seed={3} />
      <CargoStack position={[13.5, 0, -13]} rotation={0.4} seed={7} />
      <CargoStack position={[-13.5, 0, 13]} rotation={2.1} seed={15} />
      <ChargingPad position={[16, 0, 2]} />
      <ChargingPad position={[-16, 0, -2]} color={DECK_TOKENS.error} />
      {/* Break area (+X/+Z corner) — where idle agents take purposeful breaks */}
      <CoffeeMachine position={[14.5, 0, 14.5]} rotation={Math.PI * 1.25} />
      <WaterCooler position={[16.2, 0, 11.5]} rotation={Math.PI * 1.25} />
      <Fridge position={[16.6, 0, 15.8]} rotation={Math.PI * 1.15} />
      <Couch position={[11, 0, 15.5]} rotation={3.76} />
      <Whiteboard position={[15.5, 0, 6]} rotation={-1.94} seed={4} />
    </group>
  )
}

/** Office chair: seat, back, pole, base — fabric and dark plastic. */
function OfficeChair({
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
function DeskLamp({
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

function ToolDesk({
  label,
  accent,
  position,
  busy,
}: {
  readonly label: string
  readonly accent: string
  readonly position: Vec2
  readonly busy: boolean
}): JSX.Element {
  // Face the console at the origin.
  const facing = Math.atan2(-position.x, -position.z)
  // P8 (operator: "desks look entirely too small for the models"): a
  // tool-class desk is a full workstation a working robot occupies.
  const deskW = 4.8
  const deskD = 2.6
  const deskY = 1.0
  return (
    <group position={[position.x, 0, position.z]} rotation={[0, facing, 0]}>
      {/* Desk top + legs — dark metal with an accent edge strip */}
      <mesh position={[0, deskY, 0]}>
        <boxGeometry args={[deskW, 0.12, deskD]} />
        <meshStandardMaterial
          color="#1c232d"
          roughness={0.35}
          metalness={0.65}
        />
      </mesh>
      <NeonLine
        position={[0, deskY - 0.03, deskD / 2]}
        length={deskW}
        color={accent}
      />
      {(
        [
          [-deskW / 2 + 0.12, -deskD / 2 + 0.12],
          [deskW / 2 - 0.12, -deskD / 2 + 0.12],
          [-deskW / 2 + 0.12, deskD / 2 - 0.12],
          [deskW / 2 - 0.12, deskD / 2 - 0.12],
        ] as const
      ).map(([x, z], index) => (
        <mesh key={`leg-${index}`} position={[x, deskY / 2, z]}>
          <boxGeometry args={[0.12, deskY, 0.12]} />
          <meshStandardMaterial
            color="#2a2e33"
            roughness={0.5}
            metalness={0.7}
          />
        </mesh>
      ))}
      {/* Monitor: dark body, screen glows only while the station is busy */}
      <mesh position={[0, deskY + 0.62, -deskD / 2 + 0.45]}>
        <boxGeometry args={[1.5, 0.9, 0.06]} />
        <meshStandardMaterial color="#10151c" roughness={0.4} metalness={0.5} />
      </mesh>
      <mesh position={[0, deskY + 0.62, -deskD / 2 + 0.48]}>
        <planeGeometry args={[1.38, 0.78]} />
        <meshStandardMaterial
          color="#0d1420"
          emissive={accent}
          emissiveIntensity={busy ? 1.5 : 0.15}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, deskY + 0.06, -deskD / 2 + 0.45]}>
        <boxGeometry args={[0.22, 0.14, 0.22]} />
        <meshStandardMaterial color="#23272c" roughness={0.5} metalness={0.6} />
      </mesh>
      {/* Keyboard */}
      <mesh position={[0, deskY + 0.05, 0.2]}>
        <boxGeometry args={[0.9, 0.04, 0.3]} />
        <meshStandardMaterial color="#2c3138" roughness={0.7} metalness={0.2} />
      </mesh>
      <OfficeChair position={[0, 0, deskD / 2 + 0.6]} />
      {/* P18: station plates now use the SAME designed nameplate as the
       * agents (glass pill + accent glow + status dot) instead of a bare
       * floating text — one design language across the floor. Stations are
       * always "ready"; busy state lights the monitor + point light. */}
      <OfficeNameplate
        title={label}
        subtitle="STATION · READY"
        accent={accent}
        active={busy}
        position={[0, deskY + 1.7, 0]}
        worldWidth={3.1}
      />
      {busy ? (
        <pointLight
          position={[0, deskY + 0.8, 0]}
          color={accent}
          intensity={4}
          distance={7}
        />
      ) : null}
    </group>
  )
}

function HomeDesk({ index }: { readonly index: number }): JSX.Element {
  const position = homePosition(index)
  const role = DECK_ROLE_IDS[index + 1] ?? 'savant'
  const accent = roleAccent(role)
  const metal = DESK_METAL_TONES[index % DESK_METAL_TONES.length]
  // Face the console at the origin.
  const facing = Math.atan2(-position.x, -position.z)
  // P8 (operator: "desks look entirely too small for the models"): a home
  // desk is a full workstation a robot occupies — sized so the model works
  // AT it rather than towering over it.
  const deskW = 4.2
  const deskD = 2.4
  const deskY = 1.0
  return (
    <group position={[position.x, 0, position.z]} rotation={[0, facing, 0]}>
      <mesh position={[0, deskY, 0]}>
        <boxGeometry args={[deskW, 0.12, deskD]} />
        <meshStandardMaterial color={metal} roughness={0.35} metalness={0.65} />
      </mesh>
      <NeonLine
        position={[0, deskY - 0.03, deskD / 2]}
        length={deskW}
        color={accent}
      />
      {(
        [
          [-deskW / 2 + 0.1, -deskD / 2 + 0.1],
          [deskW / 2 - 0.1, -deskD / 2 + 0.1],
          [-deskW / 2 + 0.1, deskD / 2 - 0.1],
          [deskW / 2 - 0.1, deskD / 2 - 0.1],
        ] as const
      ).map(([x, z], legIndex) => (
        <mesh key={`leg-${legIndex}`} position={[x, deskY / 2, z]}>
          <boxGeometry args={[0.1, deskY, 0.1]} />
          <meshStandardMaterial
            color="#2a2e33"
            roughness={0.5}
            metalness={0.7}
          />
        </mesh>
      ))}
      <DeskLamp
        position={[-deskW / 2 + 0.5, deskY, -deskD / 2 + 0.4]}
        accent={accent}
      />
      {/* Mug */}
      <mesh position={[deskW / 2 - 0.7, deskY + 0.09, -deskD / 2 + 0.4]}>
        <cylinderGeometry args={[0.09, 0.08, 0.18, 10]} />
        <meshStandardMaterial
          color="#b3543f"
          roughness={0.8}
          metalness={0.05}
        />
      </mesh>
      {/* Role artifact: the desk carries an item tied to the agent's task */}
      <group position={[0.3, deskY, -deskD / 2 + 0.3]}>
        <RoleProp role={role} accent={accent} />
      </group>
      {/* Monitor on the back edge so the robot works the desk, not into it */}
      <mesh position={[0, deskY + 0.45, -deskD / 2 + 0.28]}>
        <boxGeometry args={[1.3, 0.8, 0.06]} />
        <meshStandardMaterial color="#10151c" roughness={0.4} metalness={0.5} />
      </mesh>
      <mesh position={[0, deskY + 0.45, -deskD / 2 + 0.31]}>
        <planeGeometry args={[1.18, 0.7]} />
        <meshStandardMaterial
          color="#0d1420"
          emissive={accent}
          emissiveIntensity={0.18}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, deskY + 0.04, -deskD / 2 + 0.28]}>
        <boxGeometry args={[0.2, 0.08, 0.2]} />
        <meshStandardMaterial color="#23272c" roughness={0.5} metalness={0.6} />
      </mesh>
      <OfficeChair position={[0, 0, deskD / 2 + 0.6]} />
      {/* P18: role desk plates use the shared nameplate design too. */}
      <OfficeNameplate
        title={ROLE_LABELS[role]}
        subtitle={`${ROLE_LABELS[role].toUpperCase()} DESK`}
        accent={accent}
        active={false}
        position={[0, deskY + 1.7, 0]}
        worldWidth={2.7}
      />
    </group>
  )
}

function CommandConsole({ active }: { readonly active: boolean }): JSX.Element {
  return (
    <group>
      {/* Slim central holo pedestal (operator: remove the "COMMAND" table —
      Savant stands at the center; the pedestal is just the projector). */}
      <mesh position={[0, 0.09, 0]}>
        <cylinderGeometry args={[0.55, 0.7, 0.18, 20]} />
        <meshStandardMaterial
          color="#1a2028"
          roughness={0.35}
          metalness={0.75}
        />
      </mesh>
      {/* Projector beam: a soft additive cone rising from the base */}
      <mesh position={[0, 0.9, 0]}>
        <coneGeometry args={[0.55, 1.5, 20, 1, true]} />
        <meshBasicMaterial
          color={DECK_TOKENS.primary}
          transparent
          opacity={active ? 0.14 : 0.06}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Floating holo ring above the beam — pulses with activity */}
      <mesh position={[0, 1.7, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 0.62, 32]} />
        <meshBasicMaterial
          color={DECK_TOKENS.primary}
          toneMapped={false}
          transparent
          opacity={active ? 0.9 : 0.3}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}

/** FID-2026-0901-003: completion spark burst — a ring of small emissive
 * particles that flies outward and fades over ~700ms when an agent finishes
 * a tool run. Self-removes via onDone. */
const BURST_LIFETIME_MS = 700
function SparkBurst({
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
 * agent (operator: "i want a status bubble over the head, something like
 * 'Thinking...'"). Rendered as a billboarded rounded label with the role
 * accent — the same visual voice as the nameplate, but for live activity. */
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
 * One rigged robot cast body (P6b): the shared hologram-skinned figure from
 * `stage/deck-robots.ts` (Idle/Walking clips, standby/active emissive),
 * design-rotated across two CC0 models. Falls back to the solid silhouette
 * when the GLB cannot load — never a wireframe (operator directive).
 */
function RobotBody({
  accent,
  modelUrl,
  walking,
  agentId,
  movingMap,
  heightScale = 1,
}: {
  readonly accent: string
  readonly modelUrl: string
  readonly walking: boolean
  readonly agentId: string
  readonly movingMap: React.RefObject<Map<string, boolean>>
  /** Savant renders 2-3x taller than the cast (operator directive). */
  readonly heightScale?: number
}): JSX.Element {
  const [figure, setFigure] = useState<RobotFigure | null>(null)
  const walkingRef = useRef(walking)
  walkingRef.current = walking
  useEffect(() => {
    let cancelled = false
    loadCastTemplate(modelUrl).then((template) => {
      if (cancelled) return
      const built: RobotFigure = template
        ? createOfficeRobotFigure(
            template,
            accent,
            ROBOT_OFFICE_HEIGHT * heightScale,
          )
        : rescaleFallback(buildFallbackFigure(accent), heightScale)
      built.setActive(walkingRef.current)
      setFigure(built)
    })
    return () => {
      cancelled = true
      setFigure((current) => {
        current?.dispose()
        return null
      })
    }
  }, [accent, modelUrl, heightScale])
  useEffect(() => {
    figure?.setActive(walking)
  }, [figure, walking])
  useFrame((_, delta) => {
    // Walk-in flag from the scene frame loop wins: a freshly spawned walker
    // glides to its post with the Walking clip even before any tool traffic.
    const gliding = movingMap.current?.get(agentId) ?? false
    figure?.update(Math.min(delta * 1000, 100), {
      moving: walkingRef.current || gliding,
      reduced: REDUCED,
    })
  })
  if (figure === null) return <></>
  return <primitive object={figure.root} />
}

/** Normalize the fallback silhouette to office-world height. */
function rescaleFallback(figure: RobotFigure, heightScale = 1): RobotFigure {
  figure.root.scale.multiplyScalar(
    (ROBOT_OFFICE_HEIGHT * heightScale) / ROBOT_TARGET_HEIGHT,
  )
  return figure
}

/** Subtitle for an agent's nameplate: role label + living status verb. */
function labelFor(walker: WalkerState): string {
  // ROLE_LABELS only covers the 10 core roles; an unknown role renders the
  // walker's display name (never a blank subtitle).
  const core = walker.roleId as keyof typeof ROLE_LABELS
  const role =
    walker.roleId === 'generic'
      ? walker.displayName
      : (ROLE_LABELS[core] ?? walker.displayName)
  if (walker.roleId === 'savant') return 'ORCHESTRATOR'
  if (walker.stationTarget !== null) return `${role} · WORKING`
  return `${role} · STANDBY`
}

/**
 * P19 (operator: "when a agent is active/thinking, it should show a chat
 * bubble over that agent on the deck"): hold window for the reasoning-driven
 * thinking pill. Reasoning deltas arrive in bursts (REASONING_GAP_MS = 1500
 * segmentation); the pill holds 3s past the last delta so it never flickers
 * between deltas, then yields to the speech bubble.
 */
const THINKING_PILL_HOLD_MS = 3000

/**
 * P19: reasoning/working signal evaluated per frame inside the tiny
 * ThinkingIndicator (not the whole scene) — the pill must switch off on the
 * clock even when no new events arrive (no parent re-render to lean on).
 */
function makeThinkingPredicate(
  walker: Pick<WalkerState, 'agentId' | 'roleId' | 'stationTarget'>,
  floor: FloorState,
): () => boolean {
  return (): boolean => {
    // Working at a station (live tool call) — the original signal.
    if (walker.stationTarget !== null) return true
    const now = performance.now()
    // Reasoning attributed to THIS walker's id (subagent streams).
    const last = floor.reasoningClocks.get(walker.agentId)
    if (last !== undefined && now - last < THINKING_PILL_HOLD_MS) return true
    // Main-run reasoning arrives under the orchestrator's runtime id, which
    // is never a walker map entry (the orchestrator does not spawn itself).
    // Only the Savant centerpiece may claim recent non-walker reasoning,
    // and only while the run is live (savantPresent) — an idle floor with
    // stale clocks must never light up.
    if (walker.roleId === 'savant' && floor.savantPresent) {
      for (const [agentId, lastMs] of floor.reasoningClocks) {
        if (floor.walkers.has(agentId)) continue
        if (now - lastMs < THINKING_PILL_HOLD_MS) return true
      }
    }
    return false
  }
}

/**
 * P19: self-evaluating thinking indicator — calls the predicate every frame
 * and toggles only its own (tiny) render. React bails out when the value is
 * unchanged, so an idle scene costs one boolean compare per agent per frame.
 */
function ThinkingIndicator({
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

function AgentCharacter({
  walker,
  position,
  walking,
  bobY,
  bubble,
  movingMap,
  isThinking,
}: {
  readonly walker: WalkerState
  readonly position: Vec2
  readonly walking: boolean
  readonly bobY: number
  readonly bubble?: SpeechBubble
  readonly movingMap: React.RefObject<Map<string, boolean>>
  readonly isThinking: () => boolean
}): JSX.Element {
  const accent = roleAccent(walker.roleId)
  // P8 (operator: "when chat is doing an action, the deck should represent
  // something is happening with the correct agent on the deck"): a working
  // agent — one with a live `stationTarget` — gets a vertical accent beacon
  // that makes it unmistakable who is acting.
  const isWorking = walker.stationTarget !== null
  // FID-2026-0901-003: hover + click-to-focus. Hover lifts the nameplate
  // glow (cursor pointer); click eases the camera onto this agent; F then
  // toggles follow-cam; Escape releases.
  const [hovered, setHovered] = useState(false)
  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : 'auto'
    return () => {
      document.body.style.cursor = 'auto'
    }
  }, [hovered])
  return (
    <group
      position={[position.x, bobY, position.z]}
      userData={{ agentId: walker.agentId }}
      onPointerOver={(event) => {
        event.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => {
        setHovered(false)
      }}
      onClick={(event) => {
        event.stopPropagation()
        deckFocus.agentId = walker.agentId
        deckFocus.follow = false
        deckFocus.version += 1
      }}
    >
      {isWorking ? (
        <mesh position={[0, 1.4, 0]}>
          <cylinderGeometry args={[0.18, 0.42, 2.8, 12, 1, true]} />
          <meshBasicMaterial
            color={accent}
            transparent
            opacity={0.22}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ) : null}
      {/* Hover affordance: a flat focus ring under the agent */}
      {hovered ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
          <ringGeometry args={[0.55, 0.72, 32]} />
          <meshBasicMaterial
            color={accent}
            transparent
            opacity={0.85}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ) : null}
      <RobotBody
        accent={accent}
        modelUrl={
          // Savant is the orchestrator — a distinct design from every
          // specialist (pad-ring cast alternates; Savant always uses the
          // OTHER model than its pad index would assign).
          walker.roleId === 'savant'
            ? castModelUrlForPad(1)
            : castModelUrlForPad(walker.padIndex)
        }
        walking={walking}
        agentId={walker.agentId}
        movingMap={movingMap}
        heightScale={walker.roleId === 'savant' ? 1.55 : 1}
      />
      <OfficeNameplate
        title={walker.displayName}
        subtitle={labelFor(walker)}
        accent={accent}
        active={walker.phase === 'active'}
        position={[
          0,
          // Savant is taller — lift the nameplate so it floats above its head
          // instead of clipping into the shoulders.
          walker.roleId === 'savant' ? NAMEPLATE_Y * 1.25 : NAMEPLATE_Y,
          0,
        ]}
        worldWidth={walker.roleId === 'savant' ? 3.0 : 2.6}
      />
      {/* P19: live status bubble over a thinking/working agent — driven by
          the reasoning/tool-recency predicate (stationTarget OR recent
          reasoning burst), not just station routing. */}
      <ThinkingIndicator
        isThinking={isThinking}
        accent={accent}
        y={walker.roleId === 'savant' ? NAMEPLATE_Y * 1.25 : NAMEPLATE_Y}
      />
      {bubble ? <AgentSpeechBubble bubble={bubble} accent={accent} /> : null}
    </group>
  )
}

function OfficeContents({
  floor,
  bubbles,
}: {
  readonly floor: FloorState
  readonly bubbles: readonly SpeechBubble[]
}): JSX.Element {
  const groupRef = useRef<THREE.Group>(null)
  const positionsRef = useRef<LivePositions>(new Map())
  const lastMs = useRef(performance.now())
  const [reduced] = useState(REDUCED)
  const movingMap = useRef<Map<string, boolean>>(new Map())
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
  const [bursts, setBursts] = useState<
    { key: string; x: number; z: number; color: string; startMs: number }[]
  >([])
  const workingRef = useRef<Map<string, boolean>>(new Map())
  // P9: per-agent waypoint route (recomputed only when the target changes).
  const routeCache = useRef<
    Map<string, { key: string; points: Vec2[]; index: number }>
  >(new Map())

  const useFrameState = useRef<{
    heading: Map<string, number>
    // FID-2026-0901-003: per-agent break state machine — idle agents take
    // purposeful breaks (coffee/water/couch/whiteboard) on a slow deterministic
    // schedule, then return to their post. 'none' = at post.
    breakState: Map<
      string,
      | {
          phase: 'work' | 'outbound' | 'linger' | 'return'
          sinceMs: number
          kind: BreakSpot['kind']
        }
      | undefined
    >
  }>({ heading: new Map(), breakState: new Map() })

  useFrame(() => {
    const now = performance.now()
    const dt = Math.min(now - lastMs.current, 100)
    lastMs.current = now
    const group = groupRef.current
    if (group === null) return
    for (const child of group.children) {
      const id = child.userData.agentId as string | undefined
      if (id === undefined) continue
      const walker = walkers.find((candidate) => candidate.agentId === id)
      if (walker === undefined) continue
      // P6c (operator: "everything is static, nothing moves"): newly
      // appeared walkers materialize at the console edge and WALK to their
      // post — sending a message visibly animates the floor.
      // P7 (operator: "everything is stationary, it's supposed to feel
      // alive"): idle agents (no station target) periodically ROAM — they
      // pick a deterministic wander point, walk there, dwell, and drift
      // again. Working agents stay at their post.
      // P8 (operator: "agents wandering endlessly with no reason") — agents
      // leave their desk ONLY when the adapter says so, via `stationTarget`
      // (a live tool call routed to that agent). Otherwise they stand at
      // their post. No aimless roam: the deck mirrors real chat activity.
      const current =
        positionsRef.current.get(id) ??
        // FID-2026-0901-003 P9b (operator: "when you click chat/deck, the deck
        // resets and all agents spawn from center and walk out"): the module-
        // level position map survives scene unmounts, so a re-mounted deck
        // RESUMES each agent where it stood instead of teleporting it back to
        // the spawn point. The spawn point is only for genuinely new agents.
        agentWorldPositions.get(id) ??
        SPAWN_POINT
      // FID-2026-0901-003: purposeful breaks. A specialist with no station
      // target may be on a break — walking to it, lingering, or returning.
      // Savant and working agents are always at their post. The schedule is
      // deterministic per (padIndex, epoch) so no flicker and no lockstep.
      const breakEntry = useFrameState.current.breakState.get(id)
      let onBreak: BreakSpot['kind'] | null = null
      if (
        walker.roleId !== 'savant' &&
        walker.stationTarget === null &&
        !reduced
      ) {
        const nowEntry = breakEntry
        const home = standSpot(homePosition(walker.padIndex))
        const atPost = distance2d(current, home) < ARRIVE_EPSILON * 4
        let state = nowEntry
        if (state === undefined) {
          state = { phase: 'work', sinceMs: now, kind: 'coffee' }
          useFrameState.current.breakState.set(id, state)
        }
        const elapsed = now - state.sinceMs
        if (state.phase === 'work') {
          if (
            atPost &&
            elapsed > breakDwellMs(walker.padIndex, Math.floor(now / 1000) >> 6)
          ) {
            // Time for a break: pick one and head out.
            state.kind = breakKindFor(
              walker.padIndex,
              Math.floor(now / 1000) >> 4,
            )
            state.phase = 'outbound'
            state.sinceMs = now
          }
        } else if (state.phase === 'outbound') {
          onBreak = state.kind
          if (atPost) {
            state.phase = 'linger'
            state.sinceMs = now
          }
        } else if (state.phase === 'linger') {
          onBreak = state.kind
          if (
            elapsed >
            breakLingerMs(walker.padIndex, Math.floor(now / 1000) >> 6)
          ) {
            state.phase = 'return'
            state.sinceMs = now
          }
        } else {
          // 'return' — heading back to the desk.
          if (atPost) {
            useFrameState.current.breakState.set(id, undefined)
          }
        }
      } else if (breakEntry !== undefined) {
        // Got a station target mid-break: drop everything, back to work.
        useFrameState.current.breakState.set(id, undefined)
      }
      const target =
        onBreak !== null ? breakUseSpot(onBreak) : targetFor(walker)
      // P9 (operator: "agents walking through desks, not around them"): the
      // walk follows ROUTED waypoints — a detour point is injected for every
      // furniture footprint the straight line would cross, so agents walk
      // AROUND desks instead of through them.
      const routeKey = `${target.x.toFixed(2)},${target.z.toFixed(2)}`
      let route = routeCache.current.get(id)
      if (route === undefined || route.key !== routeKey) {
        route = {
          key: routeKey,
          points: routeAround(current, target, WALK_OBSTACLES),
          index: 0,
        }
        routeCache.current.set(id, route)
      }
      // Advance to the active waypoint; recompute the remaining path from the
      // live position so the detour stays valid as the agent progresses.
      let waypoint = route.points[route.index] ?? target
      if (distance2d(current, waypoint) < ARRIVE_EPSILON * 4) {
        route.index = Math.min(route.index + 1, route.points.length - 1)
        waypoint = route.points[route.index] ?? target
      }
      const pose = walkPose(current, waypoint, dt, reduced)
      let next = pose.position
      // P9c (operator: "subtle avoidance between agents"): push apart figures
      // that came within body radius of each other — but never through a
      // desk. The candidate position is rejected if it would land inside a
      // furniture footprint; the un-pushed walked position is kept then.
      if (!reduced && pose.walking) {
        const others: Vec2[] = []
        for (const [otherId, pos] of positionsRef.current) {
          if (otherId !== id) others.push(pos)
        }
        const push = separationOffset(next, others)
        if (push.x !== 0 || push.z !== 0) {
          const candidate = { x: next.x + push.x, z: next.z + push.z }
          const blocked = WALK_OBSTACLES.some(
            (obs) => distance2d(candidate, obs) < obs.r,
          )
          if (!blocked) next = candidate
        }
      }
      positionsRef.current.set(id, next)
      movingMap.current.set(id, pose.walking)
      // P7 (operator: "model facing forward but walking left by gliding across
      // the floor"): rotate the figure to face its ACTUAL travel direction so
      // it walks the way it faces. Heading is the angle of the velocity vector
      // (next - current) relative to +Z, smoothed by a shortest-path lerp so
      // it turns, never snaps.
      const dx = next.x - current.x
      const dz = next.z - current.z
      if (pose.walking && Math.hypot(dx, dz) > 1e-6) {
        let heading = Math.atan2(dx, dz) + MODEL_FORWARD_OFFSET
        const prev =
          useFrameState.current.heading.get(id) ??
          agentHeadings.get(id) ??
          heading
        // Shortest angular path, wrapped to [-PI, PI].
        let delta = heading - prev
        while (delta > Math.PI) delta -= Math.PI * 2
        while (delta < -Math.PI) delta += Math.PI * 2
        const turn = Math.min(1, dt * 10)
        heading = prev + delta * turn
        useFrameState.current.heading.set(id, heading)
        child.rotation.y = heading
      } else {
        // Not walking: settle to face the desk's MONITOR (the outward edge)
        // so idle agents look at their screen, not away from it (operator:
        // "agents are on the opposite of the computer screens, their backs
        // are to the screens"). For Savant (at center) face the console.
        if (!pose.walking) {
          const prev =
            useFrameState.current.heading.get(id) ?? agentHeadings.get(id)
          if (prev !== undefined) {
            // Face target: on a break, face the break furniture; otherwise the
            // desk's outward monitor edge. Savant faces the room (+Z).
            const base =
              onBreak !== null
                ? breakUseSpot(onBreak)
                : walker.roleId === 'savant'
                  ? { x: 0, z: 1 }
                  : deskFaceTarget(homePosition(walker.padIndex))
            const dir = Math.atan2(base.x, base.z) + MODEL_FORWARD_OFFSET
            let delta = dir - prev
            while (delta > Math.PI) delta -= Math.PI * 2
            while (delta < -Math.PI) delta += Math.PI * 2
            child.rotation.y = prev + delta * Math.min(1, dt * 4)
            useFrameState.current.heading.set(id, child.rotation.y)
          }
        }
      }
      agentHeadings.set(id, child.rotation.y)
      // P5: reduced motion gates every vertical animation — walkers stand
      // static at their target (walkPose teleports) with no idle bob.
      let bob = 0.0
      if (!reduced) {
        bob = pose.walking
          ? walkBob(now, walker.padIndex)
          : idleBob(now, walker.padIndex)
      }
      child.position.set(next.x, bob, next.z)
      // FID-2026-0901-003: publish live positions for the follow-cam.
      agentWorldPositions.set(id, next)
      // Completion spark: working → idle transition fires a burst at the
      // agent (the tool finished). Deterministic position, colored by role.
      const isWorkingNow = walker.stationTarget !== null
      const wasWorking = workingRef.current.get(id) ?? false
      if (wasWorking && !isWorkingNow) {
        workingRef.current.set(id, false)
        setBursts((current) => [
          ...current.slice(-5),
          {
            key: `${id}-${now}`,
            x: next.x,
            z: next.z,
            color: roleAccent(walker.roleId),
            startMs: now,
          },
        ])
      } else if (!wasWorking && isWorkingNow) {
        workingRef.current.set(id, true)
      }
    }
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
          movingMap={movingMap}
          isThinking={makeThinkingPredicate(walker, floor)}
        />
      ))}
    </group>
  )
}

/** FID-2026-0901-003: living-light rig — a slow day/night cycle (ambient,
 * hemisphere, background and fog lerp between a warm "day" and a deep noir
 * "night" on a 3-minute loop) plus two ceiling spotlights that sweep the
 * floor. Zero state outside refs; reduced motion freezes the cycle at night
 * (the signature look) instead of animating. */
const DAY_CYCLE_MS = 180000
const DAY_BG = new THREE.Color('#182234')
const NIGHT_BG = new THREE.Color('#070b12')
const DAY_AMBIENT = new THREE.Color('#d8e2f2')
const NIGHT_AMBIENT = new THREE.Color('#8fa4c4')

function LivingLights(): JSX.Element {
  const ambientRef = useRef<THREE.AmbientLight>(null)
  const hemiRef = useRef<THREE.HemisphereLight>(null)
  const dirRef = useRef<THREE.DirectionalLight>(null)
  const spotARef = useRef<THREE.SpotLight>(null)
  const spotBRef = useRef<THREE.SpotLight>(null)
  const { scene } = useThree()
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 1000
    // 0..1 phase across the day; night at the ends, mid-day in the middle.
    const phase = REDUCED
      ? 1
      : 0.5 - 0.5 * Math.cos(((t % DAY_CYCLE_MS) / DAY_CYCLE_MS) * Math.PI * 2)
    const bg = NIGHT_BG.clone().lerp(DAY_BG, phase)
    scene.background = bg
    if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(bg)
    if (ambientRef.current)
      ambientRef.current.color.copy(NIGHT_AMBIENT).lerp(DAY_AMBIENT, phase)
    if (ambientRef.current) ambientRef.current.intensity = 0.55 + phase * 0.35
    if (hemiRef.current) hemiRef.current.intensity = 0.4 + phase * 0.4
    if (dirRef.current) dirRef.current.intensity = 0.5 + phase * 0.9
    // Sweeping spotlights: slow convergent oscillation around the center.
    const sweep = (t / 1000) * 0.22
    if (spotARef.current) {
      spotARef.current.position.set(
        Math.cos(sweep) * 13,
        3.2,
        Math.sin(sweep) * 11,
      )
      spotARef.current.target.position.set(
        Math.cos(sweep + 2.4) * 5,
        0,
        Math.sin(sweep + 2.4) * 5,
      )
      spotARef.current.target.updateMatrixWorld()
    }
    if (spotBRef.current) {
      spotBRef.current.position.set(
        Math.cos(sweep + Math.PI) * 13,
        3.2,
        Math.sin(sweep + Math.PI) * 11,
      )
      spotBRef.current.target.position.set(
        Math.cos(sweep + Math.PI + 2.4) * 5,
        0,
        Math.sin(sweep + Math.PI + 2.4) * 5,
      )
      spotBRef.current.target.updateMatrixWorld()
    }
  })
  return (
    <group>
      <ambientLight ref={ambientRef} intensity={0.85} color="#c2d6ea" />
      <hemisphereLight ref={hemiRef} args={['#7a90b8', '#141821', 0.7]} />
      <directionalLight
        ref={dirRef}
        position={[12, 22, 10]}
        intensity={1.3}
        color="#dfe8ff"
      />
      <spotLight
        ref={spotARef}
        color={DECK_TOKENS.primary}
        intensity={140}
        distance={45}
        angle={0.5}
        penumbra={0.7}
        decay={2}
      />
      <spotLight
        ref={spotBRef}
        color={DECK_TOKENS.error}
        intensity={140}
        distance={45}
        angle={0.5}
        penumbra={0.7}
        decay={2}
      />
      {/* Neon accent pools in opposite corners (noir palette). */}
      <pointLight
        position={[-14, 6, -10]}
        color={DECK_TOKENS.primary}
        intensity={80}
        distance={40}
        decay={2}
      />
      <pointLight
        position={[14, 6, 10]}
        color={DECK_TOKENS.error}
        intensity={80}
        distance={40}
        decay={2}
      />
    </group>
  )
}

/** FID-2026-0901-003: shared interaction bus — which agent (if any) the
 * operator clicked to focus, and whether follow-cam is armed. Module-level
 * because the picker (meshes) and the rig (camera) live in different
 * subtrees; a tiny external store beats prop-drilling through the scene. */
const deckFocus: {
  agentId: string | null
  follow: boolean
  /** Bumped whenever focus changes so the rig re-reads it. */
  version: number
} = { agentId: null, follow: false, version: 0 }

/** The live world position of each agent, written by the frame loop and read
 * by the follow-cam — one map, single writer, no react state churn. */
const agentWorldPositions = new Map<string, Vec2>()
/** P9b: last heading (facing) per agent — survives deck unmount/remount so
 * agents don't snap to a default rotation after a chat/deck toggle. */
const agentHeadings = new Map<string, number>()

function CameraRig(): JSX.Element {
  const { camera } = useThree()
  const controlsRef = useRef<React.ComponentRef<typeof OrbitControls>>(null)
  const focusVersion = useRef(deckFocus.version)
  const followLerp = useRef(new THREE.Vector3(0, 0, 0))
  useEffect(() => {
    camera.position.set(0, 24, 30)
    camera.lookAt(0, 0, 0)
  }, [camera])
  useFrame((_, delta) => {
    const controls = controlsRef.current
    if (controls === null) return
    // Re-read focus when it changes.
    if (focusVersion.current !== deckFocus.version) {
      focusVersion.current = deckFocus.version
      followLerp.current.set(0, 0, 0)
    }
    const target = deckFocus.agentId
      ? agentWorldPositions.get(deckFocus.agentId)
      : undefined
    if (deckFocus.agentId !== null && target !== undefined) {
      // Ease the orbit target onto the focused agent (also drives follow-cam
      // — every frame the agent moves, the target trails it).
      const desired = followLerp.current.set(target.x, 0.9, target.z)
      controls.target.lerp(
        desired,
        Math.min(1, delta * (deckFocus.follow ? 6 : 3.5)),
      )
      // Follow-cam also pulls the camera in closer.
      if (deckFocus.follow) {
        const dir = camera.position.clone().sub(controls.target)
        const len = dir.length()
        if (len > 14)
          camera.position.sub(
            dir.multiplyScalar(((len - 14) / len) * Math.min(1, delta * 3)),
          )
      }
      controls.update()
    }
  })
  // F key toggles follow-cam on the focused agent.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'f' && deckFocus.agentId !== null) {
        deckFocus.follow = !deckFocus.follow
        deckFocus.version += 1
      }
      if (event.key === 'Escape') {
        deckFocus.agentId = null
        deckFocus.follow = false
        deckFocus.version += 1
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <OrbitControls
      ref={controlsRef}
      target={[0, 0, 0]}
      minDistance={8}
      maxDistance={48}
      maxPolarAngle={Math.PI / 2.15}
      enableDamping
      dampingFactor={0.08}
    />
  )
}

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

/** P18 (operator: "when the chat is processing something, i want a red glow
 * to circle the center logo/circle ring"): an additive red ring around the
 * central emblem that spins + pulses while a run is streaming. Invisible
 * (and free) when idle. Reduced motion renders a static lit ring. */
function ProcessingRing({ active }: { readonly active: boolean }): JSX.Element {
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

/** P18 (operator: "the deck does not even show the model"): a small accent
 * tag on the floor beside the command tile naming the active model. Hidden
 * until the runtime reports one (no guessing). */
/** P21 (operator: "the current model is shown randomly on the ground,
 * rotating … put the model name on a wall as a big banner/neon sign"): a
 * fixed wall-mounted neon sign on the BACK wall (z = -OFFICE_DEPTH / 2)
 * facing the camera — not a floor Billboard that spins and sits beside a
 * desk. A dark signboard + neon glow frame + big model label. Hidden when
 * no model is known so it never reads as a bare empty board.
 */
function WallModelSign({
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
