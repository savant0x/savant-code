// FID-2026-0905-004 — gateway decomposition: default run path.
//
// The SDK-client default for the runPrompt DI seam (ceiling-contingency
// extraction from run-lifecycle.ts: the module stayed over 300 after the
// verbatim moves). Carries the P18/P19 desktop-parity behavior verbatim.

import { readProtocolConfig } from '@savant-code/common/util/protocol-config'

import {
  applySavantCodeModelOverride,
  resolveAgent,
} from '../../hooks/helpers/send-message-agent'
import { getProjectRoot } from '../../project-files'
import { loadAgentDefinitions } from '../../utils/local-agent-registry'
import { resolveContextWindowForModel } from '../../utils/openrouter-models/lookup'
import { getSavantCodeClient } from '../../utils/savant-code-client'

import type { GatewayRunPromptParams } from './types'
import type { RunState } from '@savant-code/sdk'

/** Default run path: the SDK client (existing step loop + event mapping). */
export async function defaultRunPrompt(
  params: GatewayRunPromptParams,
): Promise<RunState> {
  const client = await getSavantCodeClient({ headless: false })
  if (!client) {
    throw new Error(
      'Failed to initialize the SDK client. Set a provider key or run the login flow first.',
    )
  }
  const agentDefinitions = loadAgentDefinitions()
  // P18 (operator: compaction fired non-stop + the desktop ran the wrong
  // model/window): the CLI resolves the effective agent through
  // `applySavantCodeModelOverride` — the UI model store is the single
  // source of truth for the effective model (FID-2026-0814-004 H-08/H-09).
  // The gateway decomposition did NOT change this path: override first,
  // THEN resolve the window from the override's own model
  // (send-message-run-config.ts:107-155 parity).
  const resolvedAgentRaw = resolveAgent('HYBRID', undefined, agentDefinitions)
  const agent = applySavantCodeModelOverride(resolvedAgentRaw, agentDefinitions)
  // FID-2026-0901-006: desktop/CLI parity — the CLI threads `contextWindow`
  // (resolved from the model catalog) and `compression` (from
  // protocol.config.yaml, which sets microCompact:false) into client.run. The
  // gateway previously passed neither, so the runtime defaulted
  // microCompactEnabled:true and micro-compacted EVERY step/turn — a behavior
  // the CLI never exhibits. Resolve the same values here so the desktop
  // session compacts exactly like the terminal.
  const resolvedAgent =
    typeof agent === 'string'
      ? agentDefinitions.find((def) => def.id === agent)
      : agent
  const modelId = resolvedAgent?.model
  const contextWindow = modelId
    ? resolveContextWindowForModel(modelId)
    : undefined
  const compression = readProtocolConfig(
    getProjectRoot() ?? process.cwd(),
  ).compression
  // P19 (operator: "the deck does not even show the model"): seed the model
  // on run-accept so the desktop header badge + deck tag render the model
  // immediately — before the first thinking activity event arrives (which
  // now carries the model too; both paths agree, belt-and-suspenders). The
  // override-resolved agent's model IS the run's effective model. Root-level
  // only (no agentId), so the desktop's root-activity reducer accepts it.
  if (typeof modelId === 'string' && modelId.length > 0) {
    params.onEvent({
      type: 'activity',
      activity: { kind: 'thinking', startedAt: Date.now(), model: modelId },
    })
  }
  return client.run({
    agent,
    prompt: params.prompt,
    previousRun: params.previousRun,
    signal: params.signal,
    permissionMode: 'safe',
    protocolVariant: 'harness',
    devMode: false,
    agentDefinitions,
    contextWindow,
    compression,
    handleEvent: (event) => params.onEvent(event),
    handleStreamChunk: (chunk) => {
      if (typeof chunk === 'string') {
        params.onTextChunk(chunk)
      }
    },
  })
}
