// FID-2026-0819-005 Loop 164: handleSteps failure message construction,
// extracted from runProgrammaticStep's catch block (pure — no side effects).
import type { AgentTemplate } from '@savant-code/common/types/agent-template'

export function handleStepsErrorMessage(
  error: unknown,
  template: AgentTemplate,
): string {
  // A ReferenceError from an eval'd handleSteps string almost always means
  // the source was serialized from a bundled/minified function and
  // references an out-of-scope bundler helper. Call it out so the failure
  // is diagnosable from the message alone.
  const minifiedSourceHint =
    error instanceof ReferenceError &&
    !template.handleStepsFn &&
    typeof template.handleSteps === 'string'
      ? ' (handleSteps was deserialized from a string that references an out-of-scope identifier — likely a minified bundle serialized the function; ship the live function or unminified source)'
      : ''
  return `Error executing handleSteps for agent ${template.id}: ${
    error instanceof Error ? error.message : 'Unknown error'
  }${minifiedSourceHint}`
}
