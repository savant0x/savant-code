import { describe, expect, test } from 'bun:test'

import {
  getDefaultDesignSystemResource,
  resolveActiveDesignSystem,
} from '../index'

describe('design-system selection', () => {
  test('uses session > project > user > default precedence', () => {
    const resolve = (id: string) => ({
      ...getDefaultDesignSystemResource(),
      id,
    })
    expect(
      resolveActiveDesignSystem({
        selection: { session: 'session', project: 'project', user: 'user' },
        resolve,
      }).selectionScope,
    ).toBe('session')
    expect(
      resolveActiveDesignSystem({
        selection: { project: 'project', user: 'user' },
        resolve,
      }).selectionScope,
    ).toBe('project')
    expect(
      resolveActiveDesignSystem({ selection: { user: 'user' }, resolve })
        .selectionScope,
    ).toBe('user')
    expect(resolveActiveDesignSystem({ resolve }).selectionScope).toBe(
      'default',
    )
  })

  test('does not silently fall through an invalid configured selection', () => {
    expect(() =>
      resolveActiveDesignSystem({
        selection: { project: 'missing' },
        resolve: () => undefined,
      }),
    ).toThrow('project')
  })
})
