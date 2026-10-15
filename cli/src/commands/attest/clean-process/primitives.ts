/**
 * Clean-process primitives — Node/Bun built-ins only (FID-2026-0813-008).
 *
 * No Savant package, common validator, or crypto helper is imported anywhere
 * in this module tree; the independent implementation re-proves the same
 * outcomes with its own primitives.
 */
import { createHash } from 'node:crypto'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function hasUnknownKeys(
  value: Record<string, unknown>,
  allowed: string[],
): boolean {
  const allowedKeys = new Set(allowed)
  return Object.keys(value).some((key) => !allowedKeys.has(key))
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

export function hexToBytes(hex: string): Buffer {
  return Buffer.from(hex, 'hex')
}

export function base64UrlToBytes(value: string): Buffer {
  const normalized =
    value.replace(/-/g, '+').replace(/_/g, '/') +
    '='.repeat((4 - (value.length % 4)) % 4)
  return Buffer.from(normalized, 'base64')
}
