import stringWidth from 'string-width'

import { activityMapping, phaseMapping } from './savant-ui/echo/phase-info'

import type { StatusIndicatorState } from '../utils/status-indicator-state'

export type SidebarDensity = 'minimal' | 'compact' | 'spacious'
export function sidebarDensity(height: number): SidebarDensity {
  return height >= 20 ? 'spacious' : height >= 12 ? 'compact' : 'minimal'
}

/** Terminal cell fit, including combining sequences and wide graphemes. */
export function sidebarEllipsis(value: string, cells: number): string {
  const text = value.replace(/\s+/g, ' ').trim()
  if (stringWidth(text) <= cells) return text
  const marker =
    process.env.SAVANT_GLYPH_TIER?.toLowerCase() === 'ascii' ? '...' : '…'
  let result = ''
  for (const { segment } of new Intl.Segmenter(undefined, {
    granularity: 'grapheme',
  }).segment(text)) {
    if (stringWidth(result + segment + marker) > cells) break
    result += segment
  }
  return result + marker
}

export function contextDisplay(
  used: number,
  max: number,
  warningThreshold = 0.7,
) {
  if (!Number.isFinite(used) || used < 0)
    return { label: 'Usage unknown', band: 'unknown' as const }
  if (!Number.isFinite(max) || max <= 0)
    return { label: 'Window unknown', band: 'unknown' as const }
  const ratio = used / max
  return {
    label: `${used.toLocaleString('en-US')}/${max.toLocaleString('en-US')}`,
    band:
      ratio >= 1
        ? ('error' as const)
        : ratio >= warningThreshold
          ? ('warning' as const)
          : ('normal' as const),
    percent: ratio * 100,
  }
}

export function sidebarActivity(
  kind: string,
  lifecycle?: StatusIndicatorState,
) {
  if (lifecycle?.kind === 'paused')
    return { label: 'Paused · awaiting input', tone: 'warning' as const }
  if (lifecycle?.kind === 'connecting' || lifecycle?.kind === 'retrying') {
    return {
      label: lifecycle.kind === 'connecting' ? 'Connecting' : 'Retrying',
      tone: 'warning' as const,
    }
  }
  const mapping = activityMapping(kind)
  if (mapping.label === 'IDLE' && kind !== 'idle')
    return { label: `Unknown activity: ${kind}`, tone: 'warning' as const }
  if (kind !== 'idle') return { label: mapping.label, tone: 'active' as const }
  if (lifecycle?.kind === 'streaming')
    return { label: 'Responding', tone: 'active' as const }
  if (lifecycle?.kind === 'waiting')
    return { label: 'Waiting for response', tone: 'active' as const }
  return { label: 'Idle · ready', tone: 'idle' as const }
}

export function sidebarPhase(phase: string) {
  const mapping = phaseMapping(phase)
  return mapping.label === 'IDLE' && phase !== 'idle'
    ? `Unknown phase: ${phase}`
    : `ECHO · ${mapping.label}`
}
