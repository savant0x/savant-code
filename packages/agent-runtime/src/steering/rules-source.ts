import { readProtocolConfig } from '@savant-code/common/util/protocol-config'

import type { SteeringRuleSpec } from '@savant-code/common/types/steering'

/**
 * Project-scoped steering-rule source (FID-2026-1006-002 WP1).
 *
 * Mirrors `hooks/engine.ts`: rules come from `protocol.config.yaml` under
 * `steering:`, cached per project root so the gate's compile cache has a
 * stable array identity. Pass `refresh: true` to re-read (tests, config
 * edits). A missing/unreadable config yields NO rules — fail-safe, never
 * fatal: steering is an additional gate, so its absence must not block work.
 */
const NO_RULES: readonly SteeringRuleSpec[] = Object.freeze([])

const cache = new Map<string, readonly SteeringRuleSpec[]>()

export function getSteeringRules(
  cwd: string,
  options?: { refresh?: boolean },
): readonly SteeringRuleSpec[] {
  if (!cwd) return NO_RULES
  const cached = cache.get(cwd)
  if (cached && !options?.refresh) return cached
  const rules = readProtocolConfig(cwd).steering
  cache.set(cwd, rules)
  return rules
}
