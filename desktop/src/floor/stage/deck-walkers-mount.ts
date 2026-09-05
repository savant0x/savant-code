// FID-2026-0819-005 Loop 236: cast-entry + mount + motion helpers, extracted
// verbatim from deck-walkers.ts (over the 300-line ceiling). WalkerLayer
// wires these; behavior contract unchanged (FID-2026-0824-030/032 rules
// live here).

import { ROLE_LABELS } from '../roles'
import {
  buildFallbackFigure,
  createRobotFigure,
  loadRobotTemplate,
  ROBOT_TARGET_HEIGHT,
} from './deck-robots'
import { createNameplate } from './nameplate'

import type { RobotFigure } from './deck-robots'
import type { Nameplate } from './nameplate'
import type { DeckCoreRoleId } from '../roles'

export interface CastEntry {
  readonly roleId: DeckCoreRoleId
  /** Position in DECK_ROLE_IDS (deterministic layout). */
  readonly roleIndex: number
  readonly accent: string
  readonly homeX: number
  readonly homeZ: number
  readonly scale: number
  figure: RobotFigure | null
  nameplate: Nameplate | null
  lastNowMs: number | null
  lastTrailMs: number | null
  active: boolean
}

/** Production factory: the vendored robot, or the solid fallback silhouette. */
export function defaultFigureFactory(
  roleId: DeckCoreRoleId,
  accent: string,
  height: number,
): Promise<RobotFigure | null> {
  return loadRobotTemplate().then((template) =>
    template === null
      ? buildFallbackFigure(accent)
      : createRobotFigure(template, accent, { height }),
  )
}

/**
 * Mount one figure (+ nameplate) into the layer; null mounts the fallback.
 * `mountContext` supplies the layer's disposed flag and root group so the
 * verbatim body keeps its original effects.
 */
export function mountFigure(
  entry: CastEntry,
  figure: RobotFigure | null,
  mountContext: {
    isDisposed: () => boolean
    root: { add(child: object): unknown }
  },
): void {
  // FID-2026-0828-002: the live cast was stuck at 0/10 — the GLB loaded
  // but no figure attached. Instrument the exact failure so the console
  // shows WHERE it breaks instead of silently leaving an empty cast.
  // eslint-disable-next-line no-console
  console.info(
    `[deck] mount ${entry.roleId}: ${figure === null ? 'fallback' : 'glb'}`,
  )
  if (mountContext.isDisposed()) {
    figure?.dispose()
    return
  }
  const settled = figure ?? buildFallbackFigure(entry.accent)
  settled.root.position.set(entry.homeX, 0, entry.homeZ)
  settled.root.scale.setScalar(entry.scale)
  // Face the console on mount (operator: the crew faces Savant).
  faceTowards(settled.root, entry.homeX, entry.homeZ, 0, 0)
  entry.figure = settled
  const nameplate = createNameplate({
    title: ROLE_LABELS[entry.roleId],
    subtitle: entry.roleId,
    accent: entry.accent,
    // Coherent-world rescale: 2.2 world units was authored when bodies
    // were ~25 units tall; against a 6-unit body the plate must shrink
    // proportionally (≈1/3 body height). Height follows the 4:1 canvas.
    worldWidth: 1.9,
  })
  // FID-2026-0828-002 C (operator directive 2026-08-29): cast nameplates
  // sit at CHEST height on each figure — a proportional fraction of the
  // normalized body height. The plate is a child of the scaled figure
  // root, so the local fraction lands proportionally on every body size
  // (Savant taller, specialists standard). The earlier shared-plane
  // revision (all chips on NAMEPLATE_PLANE_Y) was revoked by the operator:
  // it lifted agent chips far above their bodies. Station plates keep
  // their own NAMEPLATE_PLANE_Y altitude.
  nameplate.sprite.position.y = ROBOT_TARGET_HEIGHT * 0.4
  settled.root.add(nameplate.sprite)
  entry.nameplate = nameplate
  mountContext.root.add(settled.root)
}

/** Yaw a figure so it FACES a world point (operator: all subagents face
 * Savant at the center). The GLB's forward axis is +Z; atan2 of the
 * direction vector gives the rotation that turns +Z toward the target. */
export function faceTowards(
  root: { rotation: { y: number } },
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
): void {
  const dx = toX - fromX
  const dz = toZ - fromZ
  if (Math.abs(dx) < 1e-6 && Math.abs(dz) < 1e-6) return
  root.rotation.y = Math.atan2(dx, dz)
}
