import {
  validateAgents as validateAgentsCommon,
  type DynamicAgentValidationError,
} from '@savant-code/common/templates/agent-validation'

import type { AgentDefinition } from '@savant-code/common/templates/initial-agents-dir/types/agent-definition'

export interface ValidationResult {
  success: boolean
  validationErrors: Array<{
    id: string
    message: string
  }>
  errorCount: number
}

export interface ValidateAgentsOptions {
  /**
   * The base URL of the SavantCode website API.
   *
   * @deprecated FID-2026-0929-005 (gut the backend): remote validation POSTed
   * to `${websiteUrl}/api/agents/validate`, a backend that does not exist.
   * The option is retained for one type-compat cycle but is ignored — local
   * Zod validation always runs.
   */
  websiteUrl?: string
}

/**
 * Validates an array of agent definitions using local Zod schema validation.
 *
 * FID-2026-0929-005 (gut the backend): the `remote` option (web-API
 * validation against `${websiteUrl}/api/agents/validate`) is deleted — the
 * backend it targeted does not exist. `options.remote` is accepted and
 * ignored for source compatibility.
 *
 * @param definitions - Array of agent definitions to validate
 * @param options - Optional configuration for validation
 * @returns Promise<ValidationResult> - Validation results with any errors
 *
 * @example
 * ```typescript
 * const result = await validateAgents(definitions)
 * ```
 */
export async function validateAgents(
  definitions: AgentDefinition[],
  options?: ValidateAgentsOptions & { remote?: boolean },
): Promise<ValidationResult> {
  void options
  // Convert array of definitions to Record<string, AgentDefinition> format
  // that the common validation functions expect
  // Use index as key to preserve all entries (including duplicates)
  const agentTemplates: Record<string, AgentDefinition> = {}
  for (const [index, definition] of definitions.entries()) {
    // Skip null/undefined entries (FID-2026-0802-008 D8): they were
    // previously stored as runtime-undefined values into a non-null record.
    if (!definition) continue
    // Use index to ensure duplicates aren't overwritten
    const key = definition.id ? `${definition.id}_${index}` : `agent_${index}`
    agentTemplates[key] = definition
  }

  // Simple logger implementation for common validation functions
  const logger = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  }

  // FID-2026-0929-005: local Zod validation is the only validation. The
  // remote web-API branch (POST ${websiteUrl}/api/agents/validate) is
  // deleted with the backend it targeted.
  const result = validateAgentsCommon({
    agentTemplates,
    logger,
  })

  const validationErrors: DynamicAgentValidationError[] = result.validationErrors

  // Transform validation errors to the SDK format
  const transformedErrors = validationErrors.map((error) => ({
    id: error.filePath ?? 'unknown',
    message: error.message,
  }))

  return {
    success: transformedErrors.length === 0,
    validationErrors: transformedErrors,
    errorCount: transformedErrors.length,
  }
}
