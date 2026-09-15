/**
 * FID-2026-0914-003 — boot-check gating (MQ4).
 *
 * The CLI boot path asks this pure function whether the daily harvest should
 * run: yes when no report exists, yes when the report is stale (>24h), no
 * when fresh (exactly 24h counts as fresh). The caller owns the side
 * effects: run stages A+B in the background, fail-silent, never block the
 * TUI. Repository-gated: the boot path only consults this inside the
 * savant-code repo itself (`isDiscoveryRepo`) — ordinary users in their own
 * projects never trigger network fetches.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const FRESH_MS = 24 * 60 * 60 * 1000

export function shouldRunBootCheck(input: {
  reportExists: boolean
  reportAgeMs: number | null
}): boolean {
  if (!input.reportExists) return true
  if (input.reportAgeMs === null) return true
  return input.reportAgeMs > FRESH_MS
}

/**
 * Repository gate (defense in depth on top of the harvester's own existence
 * check): the boot path only ever considers the discovery pipeline inside
 * the savant-code repo itself, where `dev/provider-candidates/` lives.
 * Ordinary users in their own projects never trigger boot network fetches.
 */
export function isDiscoveryRepo(repoRoot: string): boolean {
  return (
    existsSync(join(repoRoot, 'dev', 'provider-candidates')) ||
    existsSync(join(repoRoot, 'scripts', 'providers'))
  )
}
