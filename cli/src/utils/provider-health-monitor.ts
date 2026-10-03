import {
  observeDatedFailure,
  hasElapsedFailureWindow,
} from '@savant-code/common/providers/discovery-health'
import {
  getModelRouteConfig,
  type ModelRoute,
} from '@savant-code/common/providers/model-route'
import {
  probeEndpoint,
  type ProbeResult,
} from '@savant-code/common/providers/probe-endpoint'

import { providerNotifications } from './provider-notifications'

import type { ProviderConfig } from '@savant-code/common/providers/types'

export async function monitorProviderHealth(
  route: ModelRoute,
  selected: boolean,
  signal: AbortSignal,
  now = Date.now,
  probe = probeEndpoint,
): Promise<void> {
  const config = getModelRouteConfig(route)
  const state = providerNotifications.storage.presentation()
  const sameEndpoint =
    state.facts[`health-config:${config.id}`] === route.configRevision
  if (
    sameEndpoint &&
    now() - (state.sourceTimes[`health-${config.id}`] ?? 0) < 6 * 3600_000
  )
    return
  if (!sameEndpoint)
    providerNotifications.storage.stage((s) => ({
      ...s,
      revision: s.revision + 1,
      facts: {
        ...s.facts,
        [`health-config:${config.id}`]: route.configRevision ?? '',
        [`health-${config.id}:${config.id}`]: 'unknown',
        [`health-evidence:${config.id}`]: '{}',
      },
    }))
  const result = await probe({
    baseUrl: config.baseUrl,
    allowPrivate: true,
    timeoutMs: 5000,
    signal,
  })
  if (signal.aborted) return
  getModelRouteConfig(route)
  recordHealth(config, result, selected, now())
}
function recordHealth(
  config: ProviderConfig,
  result: ProbeResult,
  selected: boolean,
  now: number,
): void {
  const status =
    result.boundary === 'open-relay-reject'
      ? 'unsafe'
      : result.boundary === 'boundary-ok'
        ? 'up-verified'
        : result.reachable
          ? 'unknown'
          : 'down'
  let removal = status === 'unsafe'
  providerNotifications.storage.stage((s) => {
    const key = `health-evidence:${config.id}`
    const previous = s.facts[key] ? JSON.parse(s.facts[key]) : undefined
    const evidence = observeDatedFailure(
      previous,
      status === 'down' ? 'down' : status === 'up-verified' ? 'up' : 'unknown',
      now,
    )
    removal ||= hasElapsedFailureWindow(evidence, now)
    return {
      ...s,
      revision: s.revision + 1,
      facts: { ...s.facts, [key]: JSON.stringify(evidence) },
    }
  })
  const detail =
    status === 'unsafe'
      ? 'authentication boundary is open; review this provider'
      : status === 'down'
        ? 'keyless endpoint check failed; account and model access remain unverified'
        : 'endpoint check completed; account and model access remain unverified'
  const review = removal
    ? ` Review /provider remove ${config.id}.${status === 'down' ? ' Repeated failures span the observed interval; continuous downtime is unproven.' : ''}`
    : ''
  providerNotifications.observe(
    `health-${config.id}`,
    [
      {
        key: config.id,
        value: `${status}${removal ? '-review' : ''}`,
        providerId: config.id,
        selected,
        kind: status === 'up-verified' ? 'health-up' : 'health-down',
        severity:
          status === 'unsafe'
            ? 'critical'
            : status === 'down'
              ? 'warning'
              : 'info',
        message: `${config.label}: ${detail}.${review}`,
      },
    ],
    now,
  )
}
