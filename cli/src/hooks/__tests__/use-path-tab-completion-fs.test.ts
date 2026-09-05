import { mkdirSync, mkdtempSync, rmSync } from 'fs'
import os from 'os'
import path from 'path'

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'

// FID-2026-0819-005 Loop 171: filesystem-integration + edge-case suites
// split verbatim from use-path-tab-completion.test.ts. The helpers below are
// copied verbatim from the parent's helper block (each split file is
// self-contained).

// Helper to expand ~ to home directory (same as in the hook)
const expandPath = (inputPath: string): string => {
  if (inputPath.startsWith('~')) {
    return path.join(os.homedir(), inputPath.slice(1))
  }
  return inputPath
}

// Helper to check if a path is absolute-style (starts with / or ~)
const isAbsolutePath = (searchQuery: string): boolean => {
  return searchQuery.startsWith('/') || searchQuery.startsWith('~')
}

describe('usePathTabCompletion - integration with filesystem', () => {
  let tempDir: string
  let nestedDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'tab-completion-test-'))
    nestedDir = path.join(tempDir, 'nested')
    mkdirSync(nestedDir)
    mkdirSync(path.join(nestedDir, 'subdir'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  test('builds relative path correctly for completion', () => {
    const currentPath = tempDir
    const searchQuery = 'nest'

    // This simulates what the hook does: join currentPath with searchQuery
    const relativePath = path.join(currentPath, searchQuery)
    expect(relativePath).toBe(path.join(tempDir, 'nest'))
  })

  test('extracts directory path from completion result', () => {
    const completed = '/some/path/to/directory/'

    // Remove trailing / to get directory path for navigation
    const dirPath = completed.slice(0, -1)
    expect(dirPath).toBe('/some/path/to/directory')
  })

  test('converts completion result back to relative display', () => {
    const currentPath = tempDir
    const completed = path.join(tempDir, 'nested') + path.sep

    // Simulate the conversion logic
    let displayPath: string
    if (completed.startsWith(currentPath + path.sep)) {
      displayPath = completed.slice(currentPath.length + 1)
    } else {
      displayPath = completed
    }

    // Should show 'nested/' as the relative path
    expect(displayPath).toBe('nested' + path.sep)
  })
})

describe('usePathTabCompletion - edge cases', () => {
  test('handles path with spaces', () => {
    const searchQuery = '~/My Documents'
    expect(isAbsolutePath(searchQuery)).toBe(true)

    const expanded = expandPath(searchQuery)
    expect(expanded).toBe(path.join(os.homedir(), 'My Documents'))
  })

  test('handles path with special characters', () => {
    const searchQuery = '~/project-v2.0'
    const expanded = expandPath(searchQuery)
    expect(expanded).toBe(path.join(os.homedir(), 'project-v2.0'))
  })

  test('handles double slashes in path', () => {
    const searchQuery = '/usr//local'
    expect(isAbsolutePath(searchQuery)).toBe(true)
    // Note: path.join would normalize this, but the raw check doesn't
  })

  test('handles very long paths', () => {
    const longPath = '/' + 'a'.repeat(100) + '/' + 'b'.repeat(100)
    expect(isAbsolutePath(longPath)).toBe(true)
  })

  test('handles unicode characters in path', () => {
    const searchQuery = '~/文档'
    expect(isAbsolutePath(searchQuery)).toBe(true)

    const expanded = expandPath(searchQuery)
    expect(expanded).toBe(path.join(os.homedir(), '文档'))
  })
})
