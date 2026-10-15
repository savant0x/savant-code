// FID-2026-0905-005 — office-scene decomposition: living lights.
//
// FID-2026-0901-003: living-light rig — a slow day/night cycle (ambient,
// hemisphere, background and fog lerp between a warm "day" and a deep noir
// "night" on a 3-minute loop) plus two ceiling spotlights that sweep the
// floor. Zero state outside refs; reduced motion freezes the cycle at night
// (the signature look) instead of animating. Verbatim move.

import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'

import { DECK_TOKENS } from '../deck-tokens.generated'
import { REDUCED } from './scene-constants'

import type { JSX } from 'react'

const DAY_CYCLE_MS = 180000
const DAY_BG = new THREE.Color('#182234')
const NIGHT_BG = new THREE.Color('#070b12')
const DAY_AMBIENT = new THREE.Color('#d8e2f2')
const NIGHT_AMBIENT = new THREE.Color('#8fa4c4')

export function LivingLights(): JSX.Element {
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
