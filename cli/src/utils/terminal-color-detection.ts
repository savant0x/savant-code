/**
 * Terminal Color Detection using OSC 10/11 Escape Sequences
 *
 * This module provides utilities for detecting terminal theme (dark/light) by querying
 * the terminal's foreground and background colors using OSC (Operating System Command)
 * escape sequences.
 *
 * OSC 10: Query foreground (text) color
 * OSC 11: Query background color
 *
 * FID-2026-0809-016: Backward-compatible shim. The implementation was split
 * into `terminal-color-detection/osc-query.ts` and
 * `terminal-color-detection/theme.ts`. All public symbols are re-exported so
 * existing imports continue to resolve unchanged.
 */

export * from './terminal-color-detection/osc-query'
export * from './terminal-color-detection/theme'
