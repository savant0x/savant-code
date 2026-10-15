// code-map parse module — capture extraction, deduplication, and error
// resilience in parseTokens.
// Sibling of the Loop 324 decomposition (happy-path/degradation cases live
// in parse-tokens; integration suites in parse-integration).

import {
  createMockTreeSitterCaptures,
  createMockTreeSitterParser,
  createMockTreeSitterQuery,
  createMockTree,
} from '@savant-code/common/testing/mocks/tree-sitter'
import { describe, it, expect } from 'bun:test'

import { parseTokens } from '../src/parse'

import type { LanguageConfig } from '../src/languages-common'

describe('parse module - parseTokens extraction and errors', () => {
  it('should deduplicate identifiers and calls', () => {
    const mockCaptures = createMockTreeSitterCaptures([
      { name: 'identifier', text: 'hello' },
      { name: 'identifier', text: 'hello' }, // Duplicate
      { name: 'call.identifier', text: 'console' },
      { name: 'call.identifier', text: 'console' }, // Duplicate
    ])

    const mockTree = createMockTree()
    const mockQuery = createMockTreeSitterQuery({ captures: mockCaptures })
    const mockParser = createMockTreeSitterParser({ tree: mockTree })

    const mockLanguageConfig: LanguageConfig = {
      extensions: ['.ts'],
      wasmFile: 'tree-sitter-typescript.wasm',
      queryText: 'mock query',
      parser: mockParser,
      query: mockQuery,
    }

    const result = parseTokens('test.ts', mockLanguageConfig, () => 'content')

    expect(result.identifiers).toEqual(['hello'])
    expect(result.calls).toEqual(['console'])
  })

  it('should handle parsing errors gracefully', () => {
    const mockParser = createMockTreeSitterParser({
      parseImpl: () => {
        throw new Error('Parse error')
      },
    })

    const mockLanguageConfig: LanguageConfig = {
      extensions: ['.ts'],
      wasmFile: 'tree-sitter-typescript.wasm',
      queryText: 'mock query',
      parser: mockParser,
      query: createMockTreeSitterQuery(),
    }

    const result = parseTokens('test.ts', mockLanguageConfig, () => 'content')

    expect(result).toEqual({
      numLines: 0,
      identifiers: [],
      calls: [],
    })
  })

  it('should handle query captures errors', () => {
    const mockTree = createMockTree()
    const mockQuery = createMockTreeSitterQuery({
      capturesImpl: () => {
        throw new Error('Query error')
      },
    })
    const mockParser = createMockTreeSitterParser({ tree: mockTree })

    const mockLanguageConfig: LanguageConfig = {
      extensions: ['.ts'],
      wasmFile: 'tree-sitter-typescript.wasm',
      queryText: 'mock query',
      parser: mockParser,
      query: mockQuery,
    }

    const result = parseTokens('test.ts', mockLanguageConfig, () => 'content')

    expect(result).toEqual({
      numLines: 0,
      identifiers: [],
      calls: [],
    })
  })

  it('should handle empty capture results', () => {
    const mockCaptures = createMockTreeSitterCaptures([]) // Empty captures
    const mockTree = createMockTree()
    const mockQuery = createMockTreeSitterQuery({ captures: mockCaptures })
    const mockParser = createMockTreeSitterParser({ tree: mockTree })

    const mockLanguageConfig: LanguageConfig = {
      extensions: ['.ts'],
      wasmFile: 'tree-sitter-typescript.wasm',
      queryText: 'mock query',
      parser: mockParser,
      query: mockQuery,
    }

    const result = parseTokens('test.ts', mockLanguageConfig, () => 'content')

    expect(result.identifiers).toEqual([])
    expect(result.calls).toEqual([])
  })

  it('should handle captures with missing properties', () => {
    const mockCaptures = createMockTreeSitterCaptures([
      { name: 'unknown.type', text: 'test' },
    ])

    const mockTree = createMockTree()
    const mockQuery = createMockTreeSitterQuery({ captures: mockCaptures })
    const mockParser = createMockTreeSitterParser({ tree: mockTree })

    const mockLanguageConfig: LanguageConfig = {
      extensions: ['.ts'],
      wasmFile: 'tree-sitter-typescript.wasm',
      queryText: 'mock query',
      parser: mockParser,
      query: mockQuery,
    }

    const result = parseTokens('test.ts', mockLanguageConfig, () => 'content')

    expect(result.identifiers).toEqual([])
    expect(result.calls).toEqual([])
  })

  it('should extract identifiers and calls from captures', () => {
    const mockCaptures = createMockTreeSitterCaptures([
      { name: 'identifier', text: 'myFunction' },
      { name: 'identifier', text: 'myVariable' },
      { name: 'call.identifier', text: 'console' },
      { name: 'call.identifier', text: 'log' },
    ])

    const mockTree = createMockTree()
    const mockQuery = createMockTreeSitterQuery({ captures: mockCaptures })
    const mockParser = createMockTreeSitterParser({ tree: mockTree })

    const mockLanguageConfig: LanguageConfig = {
      extensions: ['.ts'],
      wasmFile: 'tree-sitter-typescript.wasm',
      queryText: 'mock query',
      parser: mockParser,
      query: mockQuery,
    }

    const result = parseTokens('test.ts', mockLanguageConfig, () => 'some code')

    expect(result.identifiers).toEqual(['myFunction', 'myVariable'])
    expect(result.calls).toEqual(['console', 'log'])
  })

  it('should handle mixed capture types', () => {
    const mockCaptures = createMockTreeSitterCaptures([
      { name: 'identifier', text: 'myFunction' },
      { name: 'some.other.type', text: 'ignored' },
      { name: 'call.identifier', text: 'console' },
      { name: 'another.type', text: 'alsoIgnored' },
    ])

    const mockTree = createMockTree()
    const mockQuery = createMockTreeSitterQuery({ captures: mockCaptures })
    const mockParser = createMockTreeSitterParser({ tree: mockTree })

    const mockLanguageConfig: LanguageConfig = {
      extensions: ['.ts'],
      wasmFile: 'tree-sitter-typescript.wasm',
      queryText: 'mock query',
      parser: mockParser,
      query: mockQuery,
    }

    const result = parseTokens('test.ts', mockLanguageConfig, () => 'some code')

    expect(result.identifiers).toEqual(['myFunction'])
    expect(result.calls).toEqual(['console'])
  })
})
