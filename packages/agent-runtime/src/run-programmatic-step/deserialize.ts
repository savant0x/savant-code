import type { AgentTemplate } from '@savant-code/common/types/agent-template'

export type HandleStepsFn = Exclude<
  AgentTemplate['handleSteps'],
  string | undefined
>

/**
 * Deserializes a stringified handleSteps generator for sandboxed/resumed
 * templates. Trust boundary (FID-2026-0802-005 L16): agent definitions are
 * code, so a malicious template could already act arbitrarily; this eval only
 * widens the surface if templates come from untrusted sources. Prefer
 * `template.handleStepsFn` (the live function) whenever the runtime is
 * in-process — see the call site below.
 */
export function deserializeHandleSteps(source: string): HandleStepsFn {
  const globalEval = eval as unknown as (code: string) => unknown
  return globalEval(`(${source})`) as HandleStepsFn
}
