import { applyBudgets } from './apply-budgets'
import { CONTEXT_PRUNER_CONSTANTS } from './constants'
import { runFoldOldestExchange } from './fold-exchange'
import * as helpers from './helpers'
import { runContextPrunerMain } from './main'
import * as preservedState from './preserved-state'
import * as structuredSummary from './structured-summary'
import { summarizeMessages } from './summarize-messages'
import { summarizeToolCall } from './summarize-tool-call'
import { buildFullSummary } from './summary-assembly'
import * as summaryParsing from './summary-parsing'
import * as telemetry from './telemetry'

import type { AgentDefinition } from '../types/agent-definition'

type ContextPrunerHandleSteps = Extract<
  NonNullable<AgentDefinition['handleSteps']>,
  (...args: never[]) => unknown
>

/**
 * Builds the context-pruner handleSteps generator as a fully self-contained
 * source string (the savant pattern, FID-2026-0802-005 L5): handleSteps is
 * serialized/re-eval'd via `.toString()` (prebuild-agents.ts,
 * deserializeHandleSteps), so the generated function MUST reference only
 * literals, params, and locals — no closure variables.
 *
 * Composition:
 *   - constants are baked in as `const NAME = <JSON literal>` declarations;
 *   - pure helper, phase, and orchestrator functions are embedded via
 *     .toString(); Bun transpiles TypeScript on import, so bodies are plain JS
 *     and cross-references resolve in the generated scope.
 *   - the generator delegates to runContextPrunerMain via `yield*`.
 *
 * The eval runs once at module load with string literals only — the same
 * trust domain as the runtime's existing deserializeHandleSteps.
 */
export function createContextPrunerHandleSteps(): ContextPrunerHandleSteps {
  const bakedConstants = Object.entries(CONTEXT_PRUNER_CONSTANTS)
    .map(([name, value]) => `const ${name} = ${JSON.stringify(value)}`)
    .join('\n')

  const embeddedHelpers = [
    ...Object.values(helpers).map((fn) => fn.toString()),
    summarizeToolCall.toString(),
    summarizeMessages.toString(),
    applyBudgets.toString(),
    // P1 modules: filter to functions; interfaces erase and have no runtime constants.
    ...Object.values(preservedState)
      .filter((v) => typeof v === 'function')
      .map((fn) => (fn as () => unknown).toString()),
    ...Object.values(structuredSummary)
      .filter((v) => typeof v === 'function')
      .map((fn) => (fn as () => unknown).toString()),
    // Summary-parsing and telemetry helpers extracted from main.ts.
    ...Object.values(summaryParsing)
      .filter((v) => typeof v === 'function')
      .map((fn) => (fn as () => unknown).toString()),
    ...Object.values(telemetry)
      .filter((v) => typeof v === 'function')
      .map((fn) => (fn as () => unknown).toString()),
    buildFullSummary.toString(),
    runFoldOldestExchange.toString(),
    runContextPrunerMain.toString(),
  ].join('\n\n')

  const source = [
    'function* ({ agentState, params, logger }) {',
    bakedConstants,
    embeddedHelpers,
    '  yield* runContextPrunerMain(agentState, params, logger)',
    '}',
  ].join('\n\n')

  return eval(`(${source})`) as ContextPrunerHandleSteps
}
