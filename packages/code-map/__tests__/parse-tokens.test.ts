// code-map parse module — parseTokens happy paths and degradation cases.
// Sibling of the Loop 324 decomposition (extraction/dedup logic lives in
// parse-extraction; integration suites in parse-integration).

import {
  createMockTreeSitterCaptures,
  createMockTreeSitterParser,
  createMockTreeSitterQuery,
  createMockTree,
} from '@savant-code/common/testing/mocks/tree-sitter'
import { describe, it, expect } from 'bun:test'

import { parseTokens } from '../src/parse'

import type { LanguageConfig } from '../src/languages-common'

describe('parse module - parseTokens', () => {
  it('should handle valid language config and file content', () => {
    const mockCaptures = createMockTreeSitterCaptures([
      { name: 'identifier', text: 'hello' },
      { name: 'call.identifier', text: 'console' },
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

    const sourceCode = 'function hello() { return "world"; }'
    const result = parseTokens('test.ts', mockLanguageConfig, () => sourceCode)

    expect(result.numLines).toBe(1)
    expect(result.identifiers).toContain('hello')
    expect(result.calls).toContain('console')
    expect(mockParser.parse).toHaveBeenCalledWith(sourceCode)
    expect(mockQuery.captures).toHaveBeenCalledWith(mockTree.rootNode)
  })

  it('should skip parsing source larger than the byte limit', () => {
    const mockParser = createMockTreeSitterParser()
    const mockLanguageConfig: LanguageConfig = {
      extensions: ['.ts'],
      wasmFile: 'tree-sitter-typescript.wasm',
      queryText: 'mock query',
      parser: mockParser,
      query: createMockTreeSitterQuery(),
    }

    const result = parseTokens(
      'test.ts',
      mockLanguageConfig,
      () => 'x'.repeat(20),
      { maxBytes: 10 },
    )

    expect(result).toEqual({
      numLines: 0,
      identifiers: [],
      calls: [],
    })
    expect(mockParser.parse).not.toHaveBeenCalled()
  })

  it('should handle null file content gracefully', () => {
    const mockLanguageConfig: LanguageConfig = {
      extensions: ['.ts'],
      wasmFile: 'tree-sitter-typescript.wasm',
      queryText: 'mock query',
      parser: createMockTreeSitterParser(),
      query: createMockTreeSitterQuery(),
    }

    const result = parseTokens('test.ts', mockLanguageConfig, () => null)

    expect(result).toEqual({
      numLines: 0,
      identifiers: [],
      calls: [],
    })
  })

  it('should handle missing parser gracefully', () => {
    const configWithoutParser: LanguageConfig = {
      extensions: ['.ts'],
      wasmFile: 'tree-sitter-typescript.wasm',
      queryText: 'mock query',
      parser: null,
      query: null,
    }

    const result = parseTokens('test.ts', configWithoutParser, () => 'content')

    expect(result).toEqual({
      numLines: 0,
      identifiers: [],
      calls: [],
    })
  })

  it('should handle missing query gracefully', () => {
    const configWithoutQuery: LanguageConfig = {
      extensions: ['.ts'],
      wasmFile: 'tree-sitter-typescript.wasm',
      queryText: 'mock query',
      parser: createMockTreeSitterParser(),
      query: null,
    }

    const result = parseTokens('test.ts', configWithoutQuery, () => 'content')

    expect(result).toEqual({
      numLines: 0,
      identifiers: [],
      calls: [],
    })
  })

  it('should count lines correctly', () => {
    const mockCaptures = createMockTreeSitterCaptures([
      { name: 'identifier', text: 'test' },
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

    const multilineCode = 'line1\nline2\nline3'
    const result = parseTokens(
      'test.ts',
      mockLanguageConfig,
      () => multilineCode,
    )

    expect(result.numLines).toBe(3)
  })

  it('should handle null tree from parser', () => {
    const mockParser = createMockTreeSitterParser({ tree: null })

    const mockLanguageConfig: LanguageConfig = {
      extensions: ['.ts'],
      wasmFile: 'tree-sitter-typescript.wasm',
      queryText: 'mock query',
      parser: mockParser,
      query: createMockTreeSitterQuery(),
    }

    const result = parseTokens('test.ts', mockLanguageConfig, () => 'content')

    expect(result).toEqual({
      numLines: 1, // Still counts lines even when tree is null (content.match(/\n/g)?.length ?? 0 + 1 = 1)
      identifiers: [],
      calls: [],
    })
  })
})
