/**
 * FID-2026-0822-012 asset pass — deck activity overlay.
 *
 * A DOM panel (perf-hud pattern) listing what every robot is doing RIGHT
 * NOW: role, current in-flight tool, the station pedestal it is working,
 * and the live G2 FSM phase — folded straight from the same FloorState the
 * stage consumes, so the panel and the 3-D floor can never disagree.
 * `activityRows` is PURE (FloorState → display rows, unit-tested against
 * real folded events); the DOM half mirrors PerfHud (idempotent <style>
 * injection, stub-cast Document in tests). Updates are cached by a content
 * key — a per-tick call costs DOM work only when the activity changed.
 * Colors route through the contract-token maps (phaseAccent); the single
 * literal (#8f8f99) is the design-contract 'muted' token, same as PerfHud.
 */

import { GENERIC_ROLE_ID, ROLE_LABELS } from '../roles'
import { phaseAccent, STATION_LABELS } from '../stations'

import type { FloorState } from '../adapter/floor-adapter'

const OVERLAY_STYLE_ID = 'deck-activity-overlay-style'
const OVERLAY_CLASS = 'deck-activity-overlay'
const MAX_ROWS = 12
const IDLE_TEXT = 'floor idle — no active agents'

const OVERLAY_CSS = `.${OVERLAY_CLASS}{position:absolute;top:8px;left:10px;z-index:20;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:.04em;color:#8f8f99;pointer-events:none;user-select:none;white-space:pre}`

/** One overlay line: who, and what they are doing right now. */
export interface ActivityRow {
  readonly role: string
  readonly detail: string
}

/** Oldest in-flight (non-aura) tool for an agent, or null when idle. */
function currentTool(
  floor: FloorState,
  agentId: string,
): { tool: string; station: string } | null {
  for (const flight of floor.pendingTools.values()) {
    if (flight.agentId === agentId && !flight.aura) {
      return { tool: flight.toolName, station: STATION_LABELS[flight.station] }
    }
  }
  return null
}

/** Pure FloorState → display rows (unit-tested against real folds). */
export function activityRows(floor: FloorState): ActivityRow[] {
  const rows: ActivityRow[] = []
  if (floor.savantPresent) {
    rows.push({ role: 'SAVANT', detail: 'orchestrating' })
  }
  for (const walker of floor.walkers.values()) {
    if (rows.length >= MAX_ROWS) break
    if (walker.phase !== 'active') continue
    const label =
      walker.roleId === GENERIC_ROLE_ID
        ? walker.displayName
        : (ROLE_LABELS[walker.roleId] ?? walker.roleId)
    const flight = currentTool(floor, walker.agentId)
    rows.push({
      role: label.toUpperCase(),
      detail:
        flight === null
          ? 'idle at pad'
          : `${flight.tool} → ${flight.station.toUpperCase()}`,
    })
  }
  return rows
}

/** Optional cast mount telemetry (FID-2026-0824-030). */
export interface CastTelemetry {
  readonly mounted: number
  readonly total: number
  /** Raw robot-template loader outcome (deck-robots lastTemplateOutcome).
   * Its single production consumer is the CAST line below (Verifier AUDIT
   * condition, FID-2026-0824-030). */
  readonly template?: string
}

/** First clause of the loader note — the em-dash tail is mount guidance,
 * not telemetry ("failed to load — mounting fallback silhouettes"). */
function templateNote(note: string): string {
  return note.split(' — ')[0]
}

export interface ActivityOverlay {
  update(floor: FloorState, cast?: CastTelemetry): void
  dispose(): void
}

let activeInstances = 0

function ensureStyles(doc: Document): void {
  if (doc.getElementById(OVERLAY_STYLE_ID) !== null) return
  const style = doc.createElement('style')
  style.id = OVERLAY_STYLE_ID
  style.textContent = OVERLAY_CSS
  doc.head?.appendChild(style)
}

function releaseStyles(doc: Document): void {
  if (activeInstances > 0) return
  doc.getElementById(OVERLAY_STYLE_ID)?.remove()
}

export function createActivityOverlay(
  doc: Document,
  container: HTMLElement,
): ActivityOverlay {
  activeInstances += 1
  ensureStyles(doc)
  const el = doc.createElement('div')
  el.className = OVERLAY_CLASS
  const phaseEl = doc.createElement('div')
  const castEl = doc.createElement('div')
  const bodyEl = doc.createElement('div')
  el.appendChild(phaseEl)
  el.appendChild(castEl)
  el.appendChild(bodyEl)
  container.appendChild(el)
  let lastKey: string | null = null
  let disposed = false
  return {
    update(floor, cast) {
      if (disposed) return
      const rows = activityRows(floor)
      const phase = floor.fsmPhase ?? 'idle'
      const castLine = cast
        ? `CAST ${cast.mounted}/${cast.total} mounted${
            cast.template === undefined
              ? ''
              : ` · ${templateNote(cast.template)}`
          }`
        : null
      const key = `${phase}\n${castLine ?? ''}\n${rows
        .map((row) => `${row.role}|${row.detail}`)
        .join('\n')}`
      if (key === lastKey) return
      lastKey = key
      phaseEl.textContent = `DECK ACTIVITY · ${phase.toUpperCase()}`
      phaseEl.style.color = phaseAccent(phase)
      castEl.textContent = castLine ?? ''
      bodyEl.textContent =
        rows.length === 0
          ? IDLE_TEXT
          : rows.map((row) => `${row.role} · ${row.detail}`).join('\n')
    },
    dispose() {
      if (disposed) return
      disposed = true
      el.remove()
      activeInstances -= 1
      releaseStyles(doc)
    },
  }
}
