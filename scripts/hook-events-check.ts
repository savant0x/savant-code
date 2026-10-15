#!/usr/bin/env bun

/**
 * FID-2026-0919-030 / FID-2026-0919-031 — hook event delivery check.
 *
 * `HOOK_EVENTS` is the parse-time vocabulary, so an event listed there validates
 * and loads. Nothing used to relate that list to the wiring: five of the twelve
 * entries had no firing site anywhere in the runtime, and `docs/design/
 * hook-system.md` documented all five as active. A hook declared for one of them
 * was **silently inert** — no parse error, no warning, nothing to observe.
 *
 * This probe asks the questions the vocabulary cannot answer on its own:
 *
 * 1. **The classification matches the source.** Every event the runtime fires is
 *    in `FIRED_HOOK_EVENTS`, every `NEVER_FIRED_HOOK_EVENTS` entry has zero
 *    firing sites, and no declared event is unclassified. The census
 *    (`hook-events-census.ts`) reads the real source, so wiring an event (or
 *    un-wiring one) fails here until the classification is updated.
 * 2. **A site is a call, not a mention.** A helper module necessarily NAMES
 *    every event it can fire, in its own parameter types; that is not a firing
 *    site. The census credits a helper-mediated event only when a caller
 *    outside the module passes it. Reachability, not spelling.
 * 3. **This repository's own config cannot declare an inert hook.** The parsed
 *    `protocol.config.yaml` is checked against the same classification, so the
 *    repo cannot adopt an operator surface that never runs.
 *
 * Exit 0 = the vocabulary, the runtime and the repo's config agree.
 * Exit 1 = at least one event is advertised without a reachable firing site.
 */

import {
  classifyHookEvent,
  FIRED_HOOK_EVENTS,
  HOOK_EVENTS,
  NEVER_FIRED_HOOK_EVENTS,
} from '@savant-code/common/types/hooks'
import { readProtocolConfig } from '@savant-code/common/util/protocol-config'

import { firedEventsFromSource, hookEventSites } from './hook-events-census'

/**
 * Re-exported so the shipped probe stays the single import surface for the
 * census: `packages/agent-runtime/src/hooks/__tests__/hook-surface-truth.test.ts`
 * and `lifecycle-hooks.test.ts` import it from here, and the implementation
 * lives in the census module only.
 */
export { firedEventsFromSource, hookEventSites }
export type { HookEventSite } from './hook-events-census'

export function hookEventsMain(): number {
  const root = process.cwd()
  const sites = hookEventSites(root)
  const fired = firedEventsFromSource(root)
  const issues: string[] = []

  console.log('== declared events: classification vs source ==')
  for (const event of HOOK_EVENTS) {
    const eventSites = sites.filter((site) => site.event === event)
    const live = fired.get(event) ?? []
    const kind = classifyHookEvent(event)
    const expected = kind === 'fired' ? live.length > 0 : live.length === 0
    if (!expected || kind === 'unknown') issues.push(event)
    const helperSites = eventSites.filter((site) => site.helper !== undefined)
    const via = helperSites.length
      ? ` via ${[...new Set(helperSites.map((s) => s.helper))].join(', ')}`
      : ''
    console.log(
      `${(expected ? 'ok' : 'MISMATCH').padEnd(11)} ${event.padEnd(20)} ${kind.padEnd(12)} files=${live.length}${
        live.length > 0
          ? ` (${live[0]}${live.length > 1 ? ` +${live.length - 1}` : ''})`
          : ''
      }${via}`,
    )
  }

  console.log('')
  console.log('== fired list has no stale entry ==')
  for (const event of FIRED_HOOK_EVENTS) {
    const live = fired.get(event) ?? []
    if (live.length === 0) {
      issues.push(event)
      console.log(
        `${'NO-SITE'.padEnd(11)} ${event} is declared fired but nothing reachable fires it`,
      )
    }
  }
  console.log(
    `${FIRED_HOOK_EVENTS.length} fired events verified against the source`,
  )

  console.log('')
  console.log('== helper-mediated events are reachable (not just named) ==')
  const helperSites = sites.filter((site) => site.helper !== undefined)
  for (const helper of [
    ...new Set(helperSites.map((site) => `${site.file}:${site.helper}`)),
  ]) {
    const owned = helperSites.filter(
      (site) => `${site.file}:${site.helper}` === helper,
    )
    const live = owned.filter((site) => site.reason === undefined)
    const unreached = owned.filter((site) => site.reason !== undefined)
    const events = [...new Set(owned.map((site) => site.event))].sort()
    console.log(
      `${(unreached.length ? 'UNREACHED' : 'ok').padEnd(11)} ${helper.padEnd(58)} fires ${events.join(', ')}`,
    )
    if (unreached.length === live.length) {
      console.log(`${' '.repeat(12)}no caller reaches this helper`)
    }
    for (const site of unreached) {
      console.log(`${' '.repeat(12)}${site.event}: ${site.reason}`)
      issues.push(site.event)
    }
  }
  if (helperSites.length === 0) console.log('no helper-mediated events')

  console.log('')
  console.log('== inert events: declared, with the reason (not silent) ==')
  const inert = Object.entries(NEVER_FIRED_HOOK_EVENTS) as [string, string][]
  if (inert.length === 0) {
    console.log(
      'none — every declared event has a reachable firing site (the record exists so a future inert event must state its blocker)',
    )
  }
  for (const [event, reason] of inert) {
    console.log(`${event.padEnd(14)} ${reason.slice(0, 96)}…`)
  }

  console.log('')
  console.log('== repo protocol.config.yaml hook declarations ==')
  let configured: { event: string; command?: string; action?: string }[] = []
  try {
    configured = readProtocolConfig(root).hooks
  } catch {
    console.log('no protocol.config.yaml hooks block parsed — nothing to check')
  }
  if (configured.length === 0) {
    console.log('no hooks declared')
  }
  for (const hook of configured) {
    const kind = classifyHookEvent(hook.event)
    const inertHook = kind !== 'fired'
    if (inertHook) issues.push(hook.event)
    console.log(
      `${(inertHook ? 'INERT' : 'ok').padEnd(11)} ${hook.event.padEnd(20)} ${hook.command ?? hook.action ?? ''}`,
    )
  }

  const unique = [...new Set(issues)]
  if (unique.length > 0) {
    console.log('')
    console.log(
      `hook-events: FAIL — ${unique.join(', ')} advertised without a reachable firing site (classification and source disagree)`,
    )
    return 1
  }
  console.log('')
  console.log(
    'hook-events: PASS — every fired event has a reachable site in the source, every inert event is declared with a reason, and the repo config declares no inert hook',
  )
  return 0
}

if (import.meta.main) {
  process.exit(hookEventsMain())
}
