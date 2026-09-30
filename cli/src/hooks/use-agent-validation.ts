import { validateAgents } from '@savant-code/sdk'
import { useCallback, useState } from 'react'

import { loadAgentDefinitions } from '../utils/local-agent-registry'
import { logger } from '../utils/logger'
import { filterNetworkErrors } from '../utils/validation-error-helpers'

export type ValidationError = {
  id: string
  message: string
}

export type ValidationCheckResult = {
  success: boolean
  errors: ValidationError[]
}

type UseAgentValidationResult = {
  validationErrors: ValidationError[]
  isValidating: boolean
  validate: () => Promise<ValidationCheckResult>
}

/**
 * Hook that provides agent validation functionality.
 * Call validate() manually to trigger validation (e.g., on message send).
 *
 * FID-2026-0929-005 (gut the backend): the direct-provider early return and
 * the SDK's `remote: true` branch are deleted — there is no backend to POST
 * `/api/agents/validate` to. Validation is local-schema-only; the SDK call
 * now has no `remote` option at all (hard API break, per the operator
 * ruling on Q1).
 */
export const useAgentValidation = (): UseAgentValidationResult => {
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>(
    [],
  )
  const [isValidating, setIsValidating] = useState(false)

  // Validate agents and update state
  // Returns validation result with success status and any errors
  const validate = useCallback(async (): Promise<ValidationCheckResult> => {
    setIsValidating(true)

    try {
      const agentDefinitions = loadAgentDefinitions()

      const validationResult = await validateAgents(agentDefinitions)

      if (validationResult.success) {
        setValidationErrors([])
        return { success: true, errors: [] }
      } else {
        const filteredValidationErrors = filterNetworkErrors(
          validationResult.validationErrors,
        )
        setValidationErrors(filteredValidationErrors)
        return { success: false, errors: filteredValidationErrors }
      }
    } catch (error) {
      logger.error({ error }, 'Agent validation failed with exception')
      // Don't update validation errors on exception - keep previous state
      // Return failure to block message sending on validation errors
      return { success: false, errors: [] }
    } finally {
      setIsValidating(false)
    }
  }, [])

  return {
    validationErrors,
    isValidating,
    validate,
  }
}
