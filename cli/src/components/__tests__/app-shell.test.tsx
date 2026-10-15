import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, test } from 'bun:test'

import { createAppShellStyle } from '../app-shell'

describe('AppShell', () => {
  test('keeps the viewport shell non-focusable in source', () => {
    const appShellSource = readFileSync(
      resolve(import.meta.dir, '..', 'app-shell.tsx'),
      'utf8',
    )

    const shellStart = appShellSource.indexOf('<box')
    const shellEnd = appShellSource.indexOf('>', shellStart) + 1
    const shellSource = appShellSource.slice(shellStart, shellEnd)

    expect(shellSource).toContain('focusable={false}')
    expect(shellSource).not.toContain('selectable={false}')
  })

  test('fills the OpenTUI viewport with the resolved theme background', () => {
    const style = createAppShellStyle('#050508')
    expect(style).toEqual({
      width: '100%',
      height: '100%',
      flexGrow: 1,
      flexDirection: 'column',
      backgroundColor: '#050508',
    })
    expect(style.backgroundColor).toBe('#050508')
    expect(style.width).toBe('100%')
    expect(style.height).toBe('100%')
  })
})
