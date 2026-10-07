/**
 * FID-2026-1007-002 — module-scope state that is deliberately NOT reset.
 *
 * `audit-module-state.ts` reports every module-scope mutable binding with no
 * same-file reset. A binding can be a legitimate exception for exactly one
 * reason: resetting it would BREAK the contract the module documents. That is
 * not a judgement the scanner can make, so it is recorded here by hand — and
 * each entry is self-verifying (the file must still exist and still declare the
 * binding), so an exemption cannot outlive the code it describes.
 *
 * This list is deliberately tiny. "It is probably fine" is not a reason; the
 * reason must be a documented behaviour that a reset would violate.
 */
export type ModuleStateExemption = {
  file: string
  name: string
  reason: string
}

/**
 * A module whose reset exists and is real, but which a preload must NOT load.
 * The reason is what makes the isolation claim honest: every other resettable
 * binding in the repository is reached by a preload, and these are not, on
 * purpose. `audit-module-state.ts` fails when an unreached module has no entry
 * here, so the remainder cannot grow silently.
 */
export type UnwiredModuleReason = {
  file: string
  reason: string
}

export const UNWIRED_MODULE_REASONS: readonly UnwiredModuleReason[] = [
  {
    file: 'scripts/test-count.ts',
    reason:
      'Program tooling with top-level side effects: importing it runs its whole ' +
      'body, which exits the process when no path argument is present. A preload ' +
      'must not load it, and no test file does.',
  },
  {
    file: 'scripts/providers/verify-window-truth.ts',
    reason:
      'Program tooling with top-level side effects: importing it performs live ' +
      'network fetches before its functions are callable. A preload must not ' +
      'load it, and no test file does.',
  },
]

export const MODULE_STATE_EXEMPTIONS: readonly ModuleStateExemption[] = [
  {
    file: 'cli/src/utils/openrouter-models/gateway.ts',
    name: 'gatewayCatalogListeners',
    reason:
      'Deliberately survives cache resets: the module documents that the ' +
      'gateway-catalog store holds a single subscription here, so clearing it ' +
      'would silently unsubscribe the store for the rest of the process.',
  },
]
