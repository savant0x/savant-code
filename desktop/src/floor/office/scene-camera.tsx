// FID-2026-0905-005 — office-scene decomposition: camera rig.
//
// FID-2026-0901-003: the orbit rig — click-to-focus eases the orbit target
// onto the clicked agent, F toggles follow-cam, Escape releases. The focus
// state itself lives in scene-focus-bus (single owner, P9b: survives deck
// unmounts). Verbatim move.

import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

import { agentWorldPositions, deckFocus } from './scene-focus-bus'

import type { JSX } from 'react'

export function CameraRig(): JSX.Element {
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
