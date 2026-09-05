// FID-2026-0905-005 — office-scene decomposition: desk families.
//
// The per-role workstations: role desk props, tool desks (with live-busy
// monitor + nameplate), home desks (with role artifacts), and the central
// command console. Verbatim moves from office-scene.tsx; the shared
// chair/lamp furniture lives in scene-desk-furniture.tsx (ceiling split).

import * as THREE from 'three'

import { DECK_TOKENS } from '../deck-tokens.generated'
import { DECK_ROLE_IDS, ROLE_LABELS, roleAccent } from '../roles'
import { OfficeNameplate } from './office-nameplate'
import { homePosition } from './office-plan'
import { DESK_METAL_TONES } from './scene-constants'
import { NeonLine } from './scene-decor'
import { DeskLamp, OfficeChair } from './scene-desk-furniture'
import { RoleProp } from './scene-desk-props'

import type { Vec2 } from './office-motion'
import type { JSX } from 'react'

export function ToolDesk({
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

export function HomeDesk({ index }: { readonly index: number }): JSX.Element {
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

export function CommandConsole({
  active,
}: {
  readonly active: boolean
}): JSX.Element {
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
