/**
 * Inline SVG renderer for the exported HTML report (FID-2026-1009-004 Phase 1,
 * Q1 full replacement of Font Awesome).
 *
 * Every FA call site in export-conversation/ becomes a semantic slot look-up:
 * the slot→icon mapping lives in the generated family module
 * (`SAVANT_EXPORT_ICON_MAP`, codegen-emitted from art/icons/cyberpunk/), so
 * the family stays the single source of truth and a manifest rename fails the
 * drift test instead of silently rendering broken markup.
 *
 * Law 14: an unknown or missing slot renders an empty string — a cosmetic
 * lookup must never throw inside the export render path.
 */

import {
  savantExportIconSvg,
  type SavantExportIconSlot,
} from '../../constants/savant-icons'

/** CSS class for inline icon spans — sized/recolored by the export CSS. */
const SVG_ICO_CLASS = 'svg-ico'

/**
 * Render one inline family SVG for a semantic slot.
 * The `aria-hidden` span matches the FA `<i>` semantics it replaces.
 */
export function ico(slot: SavantExportIconSlot): string {
  const svg = savantExportIconSvg(slot)
  // Defensive: unknown slot or missing constant → empty (Law 14).
  if (!svg || typeof svg !== 'string' || !svg.startsWith('<svg')) return ''
  return `<span class="${SVG_ICO_CLASS}" aria-hidden="true">${svg}</span>`
}

/** Make the 18 slots a compile-time-complete union for renderer call sites. */
export type ExportIconSlot = SavantExportIconSlot
