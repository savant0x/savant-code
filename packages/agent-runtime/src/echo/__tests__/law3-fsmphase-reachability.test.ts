/**
 * FID-2026-0927-003 F2 — the `fsmPhase` reachability guard.
 *
 * The `self_correct` exemption shipped inert once already. `fsmPhase` was added
 * to `EchoEnforcement.beforeToolCall`, threaded correctly through four modules,
 * and its own tests passed — because the tests pass the phase directly. No
 * PRODUCTION caller supplied it (`custom.ts` and `ehel-gate.ts` both omitted it),
 * so the exemption could never fire in a real session while every test said it
 * worked. Only an adversarial audit comparing the tests against the call sites
 * found it.
 *
 * A parameter that is accepted and ignored is invisible to every other check:
 * `tsc` passes (the field is optional), `eslint` passes (it is used, downstream),
 * and the unit tests pass (they pass it). The defect is only observable by
 * asking a different question — not "is the parameter plumbed?" but "does anyone
 * actually SEND it?".
 *
 * This test asks that question against the source of truth: the real production
 * call sites.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'bun:test'

/** `packages/agent-runtime/src` — the EHEL enforcement surface. */
const SRC_ROOT = path.resolve(import.meta.dir, '..', '..')

/** Recursively collect production sources, excluding every test. */
function productionSources(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__' || entry === 'node_modules') continue
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...productionSources(full))
      continue
    }
    if (/\.test\.(ts|tsx)$/.test(entry)) continue
    if (/\.(ts|tsx)$/.test(entry)) out.push(full)
  }
  return out
}

/**
 * Every `.beforeToolCall(` method CALL in a file, with its argument text.
 *
 * The leading dot is load-bearing: it separates a real call from the facade
 * DECLARATION (`beforeToolCall(params: {`), which is a definition and
 * legitimately declares the parameter without supplying it.
 *
 * Argument text is extracted with a paren-depth scan rather than a fixed window,
 * so a nearby unrelated `fsmPhase` cannot satisfy the assertion by proximity.
 * The scan is bounded and assumes balanced parens outside string literals —
 * true of every call site in this surface, and a false positive would have to
 * be a call whose arguments happen to contain a *different* file's `fsmPhase`,
 * which the depth scan excludes.
 */
function beforeToolCallArgs(content: string): string[] {
  const sites: string[] = []
  const marker = '.beforeToolCall('
  let from = 0
  for (;;) {
    const at = content.indexOf(marker, from)
    if (at === -1) break
    from = at + marker.length
    let depth = 1
    const limit = Math.min(content.length, from + 2000)
    for (let i = from; i < limit && depth > 0; i++) {
      if (content[i] === '(') depth++
      else if (content[i] === ')') depth--
    }
    sites.push(content.slice(from, limit))
  }
  return sites
}

type CallSite = { file: string; args: string }

function productionCallSites(): CallSite[] {
  const sites: CallSite[] = []
  for (const file of productionSources(SRC_ROOT)) {
    const content = readFileSync(file, 'utf8')
    for (const args of beforeToolCallArgs(content)) {
      // Normalised to forward slashes: `path.relative` emits the platform
      // separator, so on win32 the inventory would not match the POSIX-spelled
      // expectation below and the guard would fail for a reason that has
      // nothing to do with what it is guarding.
      sites.push({
        file: path.relative(SRC_ROOT, file).split(path.sep).join('/'),
        args,
      })
    }
  }
  return sites
}

const callSites = productionCallSites()

describe('FID-2026-0927-003 F2 — fsmPhase is actually SENT, not just accepted', () => {
  it('finds the production beforeToolCall call sites (anti-vacuity guard)', () => {
    // Without this leg the suite would pass happily if the scan stopped
    // matching anything — the exact shape of the vacuous test the F3 audit
    // caught. A reachability test that finds nothing proves nothing.
    expect(callSites.length).toBeGreaterThan(0)
    // The two sites the audit found, so a silent rename or relocation is visible.
    const files = callSites.map((site) => site.file).sort()
    expect(files).toEqual([
      'tools/tool-executor/custom.ts',
      'tools/tool-executor/ehel-gate.ts',
    ])
  })

  it('every production call site supplies fsmPhase', () => {
    const missing = callSites
      .filter((site) => !/\bfsmPhase\b/.test(site.args))
      .map((site) => site.file)
    expect(missing).toEqual([])
  })

  it('every production call site supplies the LIVE phase, not a literal', () => {
    // Guards against satisfying the previous leg by hardcoding
    // `fsmPhase: 'self_correct'`, which would unlock the exemption in every
    // phase rather than only during a real repair.
    const hardcoded = callSites
      .filter((site) => /fsmPhase:\s*['"`]/.test(site.args))
      .map((site) => site.file)
    expect(hardcoded).toEqual([])
  })

  it('every production call site reads the phase from the agent state', () => {
    // Pins the SOURCE of the value. `agentState.fsmPhase` /
    // `ctx.params.agentState.fsmPhase` are the two real spellings; anything
    // else means the call site is no longer reading the FSM.
    const fromState = callSites.filter((site) =>
      /agentState\.fsmPhase/.test(site.args),
    )
    expect(fromState.length).toBe(callSites.length)
  })
})
