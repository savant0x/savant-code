// GridLayout test family — shared fixtures.
// Sibling of the Loop 326 decomposition (suite files all import these).

import React from 'react'

export interface TestItem {
  id: string
  name: string
}

export const createTestItem = (id: string, name: string): TestItem => ({
  id,
  name,
})

export const defaultGetItemKey = (item: TestItem): string => item.id

export const defaultRenderItem = (
  item: TestItem,
  _idx: number,
  _columnWidth: number,
): React.ReactNode => <text key={item.id}>{item.name}</text>
