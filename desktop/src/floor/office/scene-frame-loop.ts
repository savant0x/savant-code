// FID-2026-0905-005 — office-scene decomposition: walker frame stepper.
//
// The per-frame walker simulation from OfficeContents' useFrame closure,
// extracted as a factory that OWNS the per-frame state (live positions,
// headings, routes, break state machine, working flags, moving map). Every
// computation inside the loop body (walkPose, routeAround,
// separationOffset, break timing, bob) stays in the sibling pure modules
// the existing office test files already pin — this factory is the
// composition the original closure was. The body is a verbatim move.

import {
  ARRIVE_EPSILON,
  breakDwellMs,
  breakKindFor,
  breakLingerMs,
  distance2d,
  idleBob,
  routeAround,
  separationOffset,
  walkBob,
  walkPose,
} from './office-motion'
import {
  breakUseSpot,
  deskFaceTarget,
  homePosition,
  standSpot,
  SPAWN_POINT,
  WALK_OBSTACLES,
} from './office-plan'
import { targetFor } from './scene-agent-logic'
import { MODEL_FORWARD_OFFSET } from './scene-constants'
import { agentHeadings, agentWorldPositions } from './scene-focus-bus'

import type { Vec2 } from './office-motion'
import type { BreakSpot } from './office-plan'
import type { WalkerState } from '../adapter/floor-adapter'

type BreakState = {
  phase: 'work' | 'outbound' | 'linger' | 'return'
  sinceMs: number
  kind: BreakSpot['kind']
}

/** Minimal walker view the stepper needs (AgentCharacter passes real ones). */
export type StepperWalker = Pick<
  WalkerState,
  'agentId' | 'roleId' | 'padIndex' | 'stationTarget'
> & {
  /** Defensive: walkers render `labelFor` through AgentCharacter with the
   *  full WalkerState; the stepper only forwards, so the display fields
   *  ride along (never used by the simulation). */
  displayName: WalkerState['displayName']
  phase: WalkerState['phase']
}

export type WalkerFrameStepper = {
  /** Advance the simulation one frame. Returns true when any walker's
   *  working→idle transition fired this frame (burst emission). */
  step: (params: {
    group: THREEGroup
    walkers: StepperWalker[]
    now: number
    reduced: boolean
    onBurst: (burst: {
      key: string
      x: number
      z: number
      color: string
      startMs: number
    }) => void
    accentFor: (roleId: string) => string
  }) => void
  /** Walk-in flag per agent (read by RobotBody's frame loop). */
  movingMap: React.RefObject<Map<string, boolean>>
}

/** Minimal structural type for the R3F group children the loop drives —
 * keeps this module free of a three import (the original loop only touches
 * position/rotation/userData). */
type THREEObject3DLike = {
  userData: { agentId?: string }
  position: { set: (x: number, y: number, z: number) => void }
  rotation: { y: number }
}

type THREEGroup = {
  children: THREEObject3DLike[]
}

/**
 * Create the walker frame stepper. One instance per OfficeContents mount;
 * the P9b heading/position maps stay MODULE-level in scene-focus-bus so
 * state survives unmounts.
 */
export function createWalkerFrameStepper(): WalkerFrameStepper {
  const positionsRef = new Map<string, Vec2>()
  const routeCache = new Map<
    string,
    { key: string; points: Vec2[]; index: number }
  >()
  const workingRef = new Map<string, boolean>()
  const breakState = new Map<string, BreakState | undefined>()
  const movingMap: { current: Map<string, boolean> } = {
    current: new Map<string, boolean>(),
  }
  let lastMs = performance.now()

  const stepper: WalkerFrameStepper = {
    movingMap,
    step: ({ group, walkers, now, reduced, onBurst, accentFor }) => {
      const dt = Math.min(now - lastMs, 100)
      lastMs = now
      for (const child of group.children) {
        const id = child.userData.agentId as string | undefined
        if (id === undefined) continue
        const walker = walkers.find((candidate) => candidate.agentId === id)
        if (walker === undefined) continue
        // P6c: newly appeared walkers materialize at the console edge and
        // WALK to their post. P8: agents leave their desk ONLY via
        // `stationTarget`. P9b: a re-mounted deck RESUMES each agent where
        // it stood (module-level position map).
        const current =
          positionsRef.get(id) ?? agentWorldPositions.get(id) ?? SPAWN_POINT
        // FID-2026-0901-003: purposeful breaks — walk out, linger, return.
        const breakEntry = breakState.get(id)
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
            breakState.set(id, state)
          }
          const elapsed = now - state.sinceMs
          if (state.phase === 'work') {
            if (
              atPost &&
              elapsed >
                breakDwellMs(walker.padIndex, Math.floor(now / 1000) >> 6)
            ) {
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
              breakState.set(id, undefined)
            }
          }
        } else if (breakEntry !== undefined) {
          // Got a station target mid-break: drop everything, back to work.
          breakState.set(id, undefined)
        }
        const target =
          onBreak !== null ? breakUseSpot(onBreak) : targetFor(walker)
        // P9: ROUTED waypoints — walk AROUND desks, not through them.
        const routeKey = `${target.x.toFixed(2)},${target.z.toFixed(2)}`
        let route = routeCache.get(id)
        if (route === undefined || route.key !== routeKey) {
          route = {
            key: routeKey,
            points: routeAround(current, target, WALK_OBSTACLES),
            index: 0,
          }
          routeCache.set(id, route)
        }
        let waypoint = route.points[route.index] ?? target
        if (distance2d(current, waypoint) < ARRIVE_EPSILON * 4) {
          route.index = Math.min(route.index + 1, route.points.length - 1)
          waypoint = route.points[route.index] ?? target
        }
        const pose = walkPose(current, waypoint, dt, reduced)
        let next = pose.position
        // P9c: subtle avoidance between agents — never through a desk.
        if (!reduced && pose.walking) {
          const others: Vec2[] = []
          for (const [otherId, pos] of positionsRef) {
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
        positionsRef.set(id, next)
        movingMap.current.set(id, pose.walking)
        // P7: face the ACTUAL travel direction, smoothed by shortest-path
        // lerp; idle agents settle facing the desk's monitor edge.
        const dx = next.x - current.x
        const dz = next.z - current.z
        if (pose.walking && Math.hypot(dx, dz) > 1e-6) {
          let heading = Math.atan2(dx, dz) + MODEL_FORWARD_OFFSET
          const prev = agentHeadings.get(id) ?? heading
          let delta = heading - prev
          while (delta > Math.PI) delta -= Math.PI * 2
          while (delta < -Math.PI) delta += Math.PI * 2
          const turn = Math.min(1, dt * 10)
          heading = prev + delta * turn
          agentHeadings.set(id, heading)
          child.rotation.y = heading
        } else {
          if (!pose.walking) {
            const prev = agentHeadings.get(id)
            if (prev !== undefined) {
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
              agentHeadings.set(id, child.rotation.y)
            }
          }
        }
        agentHeadings.set(id, child.rotation.y)
        // P5: reduced motion gates every vertical animation.
        let bob = 0.0
        if (!reduced) {
          bob = pose.walking
            ? walkBob(now, walker.padIndex)
            : idleBob(now, walker.padIndex)
        }
        child.position.set(next.x, bob, next.z)
        // Publish live positions for the follow-cam.
        agentWorldPositions.set(id, next)
        // Completion spark: working → idle fires a burst at the agent.
        const isWorkingNow = walker.stationTarget !== null
        const wasWorking = workingRef.get(id) ?? false
        if (wasWorking && !isWorkingNow) {
          workingRef.set(id, false)
          onBurst({
            key: `${id}-${now}`,
            x: next.x,
            z: next.z,
            color: accentFor(walker.roleId),
            startMs: now,
          })
        } else if (!wasWorking && isWorkingNow) {
          workingRef.set(id, true)
        }
      }
    },
  }

  return stepper
}
