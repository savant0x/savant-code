// FID-2026-0905-005 — office-scene decomposition: agent character.
//
// The AgentCharacter group: hover/click focus, working beacon, nameplate,
// speech bubble, and the rigged robot body. The self-animating FX (spark
// burst, thinking indicator) live in scene-agent-fx.tsx; the robot body in
// scene-robot-body.tsx (ceiling splits).

import { useEffect, useState } from 'react'
import * as THREE from 'three'

import { roleAccent } from '../roles'
import { OfficeNameplate } from './office-nameplate'
import { castModelUrlForPad } from './robot-cast'
import { ThinkingIndicator } from './scene-agent-fx'
import { labelFor } from './scene-agent-logic'
import { NAMEPLATE_Y } from './scene-constants'
import { deckFocus } from './scene-focus-bus'
import { RobotBody } from './scene-robot-body'
import { AgentSpeechBubble } from './speech-bubble-3d'

import type { Vec2 } from './office-motion'
import type { SpeechBubble } from './speech-bubbles'
import type { WalkerState } from '../adapter/floor-adapter'
import type { JSX } from 'react'

export function AgentCharacter({
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
      {/* P19: live status bubble over a thinking/working agent. */}
      <ThinkingIndicator
        isThinking={isThinking}
        accent={accent}
        y={walker.roleId === 'savant' ? NAMEPLATE_Y * 1.25 : NAMEPLATE_Y}
      />
      {bubble ? <AgentSpeechBubble bubble={bubble} accent={accent} /> : null}
    </group>
  )
}
