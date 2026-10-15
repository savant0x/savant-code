// Shared harness for the markdown-renderer test family.
// Sibling of the Loop-336 decomposition (suite files all import these).
import React from 'react'

export type El = React.ReactElement<Record<string, unknown>>

export const flattenNodes = (input: unknown): React.ReactNode[] => {
  const result: React.ReactNode[] = []

  const visit = (value: unknown): void => {
    if (value === null || value === undefined || typeof value === 'boolean') {
      return
    }

    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }

    if (React.isValidElement(value) && value.type === React.Fragment) {
      visit((value as El).props.children)
      return
    }

    result.push(value as React.ReactNode)
  }

  visit(input)
  return result
}

export const flattenChildren = (value: unknown): React.ReactNode[] =>
  flattenNodes(value)
