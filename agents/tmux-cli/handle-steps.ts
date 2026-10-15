import { TMUX_HELPER_SCRIPT } from './helper-script'
import { TMUX_INTERACTION_BODY } from './interaction-body'

import type { SecretAgentDefinition } from '../types/secret-agent-definition'

type TmuxHandleSteps = NonNullable<SecretAgentDefinition['handleSteps']>

/**
 * Builds the tmux-cli handleSteps generator as a fully self-contained source
 * string (the savant pattern, FID-2026-0802-005 L5): handleSteps is serialized
 * via .toString() and re-eval'd (prebuild-agents.ts +
 * run-programmatic-step.ts deserializeHandleSteps), so the generated function
 * MUST reference only literals, params, and locals — no closure variables.
 * The bash helper script is baked in as a JSON string literal and the
 * interaction body (whose markdown backticks are stored escaped) is restored
 * verbatim, so the composed source is equivalent to the Bun-transpiled
 * original (TS-only `as`/type annotations were stripped at extraction — the
 * runtime serialized form of the original was transpiled the same way).
 * Differential-verified against the git-HEAD original across the full command
 * flow (success, setup-failure, no-command). The eval runs once at module
 * load with string literals only — the same trust domain as the runtime's
 * existing deserializeHandleSteps.
 */
export function createTmuxCliHandleSteps(): TmuxHandleSteps {
  const source = `function* ({ params, logger }) {
    // Self-contained tmux helper script written to /tmp at startup.
    const helperScript = ${JSON.stringify(TMUX_HELPER_SCRIPT)}
${TMUX_INTERACTION_BODY}
  }`
  return eval(`(${source})`) as TmuxHandleSteps
}
