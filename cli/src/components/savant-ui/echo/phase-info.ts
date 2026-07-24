/**
 * Shared ECHO Phase Info (FID-2026-0720-033b Phase B Step 4)
 *
 * Canonical mapping of FSM phases + runtime activities to (glyph name, theme
 * color key). Eliminates the Law 13 duplication between `right-sidebar.tsx`
 * and `phase-indicator.tsx`, both of which previously carried identical
 * `PHASE_INFO` tables with hardcoded hex.
 *
 * Consumers call `phaseGlyph(phase)` / `activityGlyph(kind)` to get the icon
 * character, and `phaseColorKey(phase)` / `activityColorKey(kind)` to get the
 * ChatTheme color key. The caller resolves the key via `resolveThemeColor()`.
 */

import type { GlyphName } from '../../../utils/glyphs'
import type { ThemeColorKey } from '../icon-theme-keys'

export interface PhaseMapping {
  glyph: GlyphName
  colorKey: ThemeColorKey
  label: string
}

/** FSM phase → glyph + theme color key + label. One truth for the TUI. */
const PHASE_MAP: Record<string, PhaseMapping> = {
  idle: { glyph: 'phaseIdle', colorKey: 'muted', label: 'IDLE' },
  red: { glyph: 'phaseActive', colorKey: 'error', label: 'RED' },
  green: { glyph: 'phaseActive', colorKey: 'success', label: 'GREEN' },
  audit: { glyph: 'phaseAudit', colorKey: 'warning', label: 'AUDIT' },
  self_correct: { glyph: 'phaseFix', colorKey: 'warning', label: 'FIX' },
  complete: { glyph: 'phaseDone', colorKey: 'primary', label: 'DONE' },
}

/** Runtime activity → glyph + theme color key + label (FID-009 two-signal). */
const ACTIVITY_MAP: Record<string, PhaseMapping> = {
  idle: { glyph: 'phaseIdle', colorKey: 'muted', label: 'IDLE' },
  thinking: { glyph: 'activityThinking', colorKey: 'syntaxKeyword', label: 'thinking' },
  tool: { glyph: 'activityTool', colorKey: 'warning', label: 'tool' },
  subagent: { glyph: 'activitySubagent', colorKey: 'warning', label: 'subagent' },
  researching: { glyph: 'activityResearching', colorKey: 'info', label: 'researching' },
}

const FALLBACK_PHASE: PhaseMapping = PHASE_MAP.idle
const FALLBACK_ACTIVITY: PhaseMapping = ACTIVITY_MAP.idle

export const phaseMapping = (phase: string): PhaseMapping =>
  PHASE_MAP[phase] ?? FALLBACK_PHASE

export const activityMapping = (kind: string): PhaseMapping =>
  ACTIVITY_MAP[kind] ?? FALLBACK_ACTIVITY

/** Status-step icons (stepper / render-ui step widgets). */
const STATUS_MAP: Record<string, PhaseMapping> = {
  pending: { glyph: 'phaseIdle', colorKey: 'muted', label: '' },
  active: { glyph: 'phaseActive', colorKey: 'primary', label: '' },
  done: { glyph: 'phaseComplete', colorKey: 'success', label: '' },
  error: { glyph: 'phaseError', colorKey: 'error', label: '' },
}

export const statusMapping = (status: string): PhaseMapping =>
  STATUS_MAP[status] ?? STATUS_MAP.pending
