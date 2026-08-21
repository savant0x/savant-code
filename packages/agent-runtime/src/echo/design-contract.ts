import {
  allowedColors,
  allowedValues,
  computedCssProperties,
  dynamicVisualProperties,
  isVisualPath,
  maskComments,
  missingAccessibilityTokens,
  missingComponentTokens,
  unknownColors,
  unknownCssValues,
  unknownOpenTuiValues,
  unsupportedTypography,
  unsupportedTypographyValues,
} from './design-contract-scan'

import type {
  AdvisoryWarning,
  EnforcementMode,
  EnforcementResult,
  EnforcementState,
} from './types'
import type { DesignContract } from '@savant-code/common/types/design-system'

export function runDesignContractScanner(params: {
  state: EnforcementState
  contract?: DesignContract
  mode: EnforcementMode
  getWrittenFileContent: (path: string) => string | undefined
}): EnforcementResult {
  if (!params.contract) return { blocked: false, warnings: [] }

  const warnings: AdvisoryWarning[] = []
  const violations: string[] = []
  const allowed = allowedColors(params.contract)

  for (const filePath of params.state.dirtyFiles) {
    if (!isVisualPath(filePath)) continue
    const content = params.getWrittenFileContent(filePath)
    if (content === undefined) {
      const message = `DESIGN_CONTRACT_NEEDS_REVIEW: final content unavailable for visual file "${filePath}"`
      violations.push(message)
      warnings.push({
        law: 0,
        severity: 'warning',
        classification: 'design_contract',
        message,
        file: filePath,
      })
      continue
    }

    const scanContent = maskComments(content)
    const colors = unknownColors(scanContent, allowed)
    const allowedSpacing = allowedValues(params.contract, 'spacing')
    const allowedRadius = allowedValues(params.contract, 'radius')
    const spacing = unknownCssValues(
      scanContent,
      allowedSpacing,
      /(?:padding|margin|gap)\s*:\s*([^;}]*)/gi,
    )
    const radius = unknownCssValues(
      scanContent,
      allowedRadius,
      /border-radius\s*:\s*([^;}]*)/gi,
    )
    const openTuiValues = unknownOpenTuiValues(
      scanContent,
      allowedSpacing,
      allowedRadius,
    )
    const typography = unsupportedTypography(scanContent, params.contract)
    const typographyValues = unsupportedTypographyValues(
      scanContent,
      params.contract,
    )
    const computed = computedCssProperties(scanContent)
    const dynamic = dynamicVisualProperties(scanContent)
    const components = missingComponentTokens(scanContent, params.contract)
    const accessibility = missingAccessibilityTokens(
      params.contract,
      scanContent,
    )
    const findings: string[] = []
    if (colors.length > 0) findings.push(`colors: ${colors.join(', ')}`)
    if (openTuiValues.spacing.length > 0)
      findings.push(`spacing: ${openTuiValues.spacing.join(', ')}`)
    if (openTuiValues.radius.length > 0)
      findings.push(`radius: ${openTuiValues.radius.join(', ')}`)
    if (spacing.length > 0) findings.push(`spacing: ${spacing.join(', ')}`)
    if (radius.length > 0) findings.push(`radius: ${radius.join(', ')}`)
    if (typography.length > 0)
      findings.push(`typography: ${typography.join(', ')}`)
    if (typographyValues.length > 0)
      findings.push(`typography-values: ${typographyValues.join(', ')}`)
    if (computed.length > 0)
      findings.push(
        `computed-values NEEDS-REVIEW: ${computed.join(', ')} use tokenized literals or an explicit contract extension`,
      )
    if (dynamic.length > 0)
      findings.push(
        `dynamic-values NEEDS-REVIEW: ${dynamic.join(', ')} require explicit token mapping`,
      )
    if (components.length > 0)
      findings.push(`components: ${components.join(', ')}`)
    if (accessibility.length > 0)
      findings.push(`accessibility: ${accessibility.join(', ')}`)

    if (findings.length > 0) {
      const status = params.mode === 'strict' ? 'BLOCK' : 'NEEDS-REVIEW'
      const message = `DESIGN_CONTRACT_${status}: ${filePath} is outside active system ${params.contract.id}: ${findings.join('; ')}`
      violations.push(message)
      warnings.push({
        law: 0,
        severity: 'warning',
        classification: 'design_contract',
        message,
        file: filePath,
      })
    }
  }

  if (violations.length === 0) return { blocked: false, warnings: [] }
  return {
    blocked: params.mode === 'strict',
    reason: violations.join('; '),
    warnings,
    classification: 'design_contract',
  }
}
